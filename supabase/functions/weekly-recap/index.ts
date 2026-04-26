// Supabase Edge Function — send weekly recap push notifications every Sunday
//
// Deploy:
//   supabase functions deploy weekly-recap
//
// Triggered by Vercel cron at /api/weekly-recap (runs Sunday 8pm UTC)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') || 'https://getbodmax.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
    const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@bodmax.app'

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response('VAPID keys not configured', { status: 500 })
    }

    // Week window: last 7 days
    const now = new Date()
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoISO = weekAgo.toISOString()

    // Get all push subscriptions
    const { data: subs, error: subErr } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
    if (subErr) throw subErr
    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userIds = [...new Set(subs.map((s: any) => s.user_id))]

    // Fetch this week's sessions for all subscribed users
    const { data: sessions, error: sessErr } = await supabase
      .from('sessions')
      .select('user_id, date, duration, exercises(name, sets(weight, reps, is_warmup))')
      .in('user_id', userIds)
      .gte('date', weekAgoISO)
      .not('completed_at', 'is', null)
    if (sessErr) throw sessErr

    // Fetch profiles for names
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, workout_split')
      .in('id', userIds)
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

    // Group sessions by user
    const sessionsByUser: Record<string, any[]> = {}
    for (const s of sessions || []) {
      if (!sessionsByUser[s.user_id]) sessionsByUser[s.user_id] = []
      sessionsByUser[s.user_id].push(s)
    }

    const results = await Promise.allSettled(subs.map(async (sub: any) => {
      const userSessions = sessionsByUser[sub.user_id] || []

      // Only notify users who actually trained this week
      if (!userSessions.length) return

      // Check user opted into notifications
      const profile = profileMap.get(sub.user_id) as any
      if (profile?.workout_split?.notifyEnabled === false) return

      const sessionCount = userSessions.length
      const totalVol = userSessions.reduce((t: number, s: any) => {
        return t + (s.exercises || []).reduce((te: number, ex: any) =>
          te + (ex.sets || []).reduce((ts: number, st: any) =>
            ts + (st.is_warmup ? 0 : (+st.weight || 0) * (+st.reps || 0)), 0), 0)
      }, 0)
      const totalDur = userSessions.reduce((t: number, s: any) => t + (s.duration || 0), 0)

      // Find top exercise by volume this week
      const exVols: Record<string, number> = {}
      userSessions.forEach((s: any) => {
        ;(s.exercises || []).forEach((ex: any) => {
          const v = (ex.sets || []).reduce((t: number, st: any) =>
            t + (st.is_warmup ? 0 : (+st.weight || 0) * (+st.reps || 0)), 0)
          exVols[ex.name] = (exVols[ex.name] || 0) + v
        })
      })
      const topEx = Object.entries(exVols).sort((a, b) => b[1] - a[1])[0]

      const firstName = ((profile?.name as string) || 'there').split(' ')[0]
      const volK = (totalVol / 1000).toFixed(1)
      const durMin = Math.round(totalDur / 60)
      const topExStr = topEx ? ` Top lift: ${topEx[0]}.` : ''

      const payload = JSON.stringify({
        title: `Weekly Recap 📊`,
        body: `${firstName}: ${sessionCount} session${sessionCount !== 1 ? 's' : ''}, ${volK}k lbs, ${durMin} min.${topExStr} Keep it up!`,
        url: '/progress',
        tag: 'weekly-recap',
      })

      return sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
        { vapidPublicKey: VAPID_PUBLIC_KEY, vapidPrivateKey: VAPID_PRIVATE_KEY, vapidSubject: VAPID_SUBJECT },
      )
    }))

    const sent = results.filter(r => r.status === 'fulfilled' && r.value !== undefined).length
    return new Response(JSON.stringify({ sent, total: subs.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(String(e), { status: 500, headers: corsHeaders })
  }
})

async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapid: { vapidPublicKey: string; vapidPrivateKey: string; vapidSubject: string },
) {
  const url = new URL(sub.endpoint)
  const audience = `${url.protocol}//${url.host}`
  const expiry = Math.floor(Date.now() / 1000) + 12 * 3600

  const b64url = (s: string) => btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  const claims = b64url(JSON.stringify({ aud: audience, exp: expiry, sub: vapid.vapidSubject }))

  const privKeyBytes = base64UrlDecode(vapid.vapidPrivateKey)
  const cryptoKey = await crypto.subtle.importKey(
    'raw', privKeyBytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
  )
  const sigBytes = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(`${header}.${claims}`),
  )
  const sig = b64url(String.fromCharCode(...new Uint8Array(sigBytes)))
  const jwt = `${header}.${claims}.${sig}`

  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt},k=${vapid.vapidPublicKey}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
    },
    body: new TextEncoder().encode(payload),
  })
  if (!res.ok && res.status !== 201) throw new Error(`Push failed: ${res.status}`)
}

function base64UrlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - str.length % 4) % 4)
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}
