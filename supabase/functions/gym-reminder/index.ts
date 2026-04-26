// Supabase Edge Function — send daily gym reminder push notifications
//
// Deploy:
//   supabase functions deploy gym-reminder
//
// Required secrets (set in Supabase dashboard → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY   — from `npx web-push generate-vapid-keys`
//   VAPID_PRIVATE_KEY  — from same command
//   VAPID_SUBJECT      — e.g. "mailto:you@example.com"
//
// This function is meant to be triggered by a Vercel cron job every hour
// (see /api/gym-reminder.js and vercel.json).
// It sends reminders only to users whose notifyTime hour matches UTC now.

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

    const now = new Date()

    // Fetch all users who have workout_split with notifications enabled
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, name, workout_split')
      .not('workout_split', 'is', null)

    if (profErr) throw profErr

    const eligible = (profiles || []).filter(p => {
      const split = p.workout_split
      if (!split?.notifyEnabled) return false
      if (!split?.notifyTime) return false

      // Resolve the user's timezone — fall back to UTC if unknown
      const tz = (split.timezone as string) || 'UTC'

      // Derive the user's local hour and day-of-week using Intl APIs
      let localHour: number
      let localDayIndex: number
      try {
        // formatToParts gives us named fields without string parsing
        const parts = Object.fromEntries(
          new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour: '2-digit',
            hour12: false,
            weekday: 'short',  // "Sun" | "Mon" | …
          }).formatToParts(now).map(p => [p.type, p.value])
        )
        localHour = parseInt(parts.hour, 10) % 24  // guard against "24" midnight edge case
        const DAY_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
        localDayIndex = DAY_MAP[parts.weekday] ?? now.getUTCDay()
      } catch {
        // Unknown/invalid timezone — fall back to UTC
        localHour = now.getUTCHours()
        localDayIndex = now.getUTCDay()
      }

      // Check if the notification hour matches the user's local time
      const [hh] = (split.notifyTime as string).split(':').map(Number)
      if (hh !== localHour) return false

      // Check if today (in the user's timezone) is a workout day
      const todayMuscles = split.days?.[localDayIndex]
      return todayMuscles !== null && todayMuscles !== undefined
    })

    if (!eligible.length) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no eligible users' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userIds = eligible.map((p: any) => p.id)
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
      .in('user_id', userIds)

    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no push subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Map userId → split data for message building
    const profileMap = new Map(eligible.map((p: any) => [p.id, p]))

    const results = await Promise.allSettled(subs.map(sub => {
      const p = profileMap.get(sub.user_id) as any
      const tz = (p?.workout_split?.timezone as string) || 'UTC'
      let localDay = now.getUTCDay()
      try {
        const parts = Object.fromEntries(
          new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' })
            .formatToParts(now).map(x => [x.type, x.value])
        )
        const DAY_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
        localDay = DAY_MAP[parts.weekday] ?? localDay
      } catch { /* keep UTC fallback */ }
      const muscles: string[] = p?.workout_split?.days?.[localDay] || []
      const muscleStr = muscles.length ? muscles.join(' & ') : 'your workout'
      const firstName = (p?.name || 'there').split(' ')[0]

      const payload = JSON.stringify({
        title: `Hey ${firstName}, time to train! 💪`,
        body: `Today is ${muscleStr} day. Let's get it!`,
        url: '/session',
        tag: 'gym-reminder',
      })

      return sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
        { vapidPublicKey: VAPID_PUBLIC_KEY, vapidPrivateKey: VAPID_PRIVATE_KEY, vapidSubject: VAPID_SUBJECT },
      )
    }))

    const sent = results.filter(r => r.status === 'fulfilled').length
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
