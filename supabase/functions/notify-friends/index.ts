// Supabase Edge Function — notify friends when a session is posted
//
// Deploy:
//   supabase functions deploy notify-friends
//
// Required env vars (set in Supabase dashboard → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY   — from `npx web-push generate-vapid-keys`
//   VAPID_PRIVATE_KEY  — from same command
//   VAPID_SUBJECT      — e.g. "mailto:you@example.com"
//
// Call from client after saveSession() succeeds:
//   supabase.functions.invoke('notify-friends', { body: { sessionId } })

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

    const { sessionId } = await req.json()
    if (!sessionId) return new Response('sessionId required', { status: 400 })

    // Get session + owner profile
    const { data: session } = await supabase
      .from('sessions')
      .select('user_id, date, profiles!sessions_user_id_fkey(name, username)')
      .eq('id', sessionId)
      .single()
    if (!session) return new Response('session not found', { status: 404 })

    const { user_id, profiles: poster } = session as any

    // Get all accepted friends of the poster
    const { data: friendships } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .eq('status', 'accepted')
      .or(`user_id.eq.${user_id},friend_id.eq.${user_id}`)

    const friendIds = (friendships || []).map((f: any) =>
      f.user_id === user_id ? f.friend_id : f.user_id
    )
    if (!friendIds.length) return new Response('no friends', { status: 200 })

    // Fetch push subscriptions for all friends
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', friendIds)
    if (!subs?.length) return new Response('no subscriptions', { status: 200 })

    const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
    const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@bodmax.app'

    const payload = JSON.stringify({
      title: `${poster.name} just finished a workout 💪`,
      body: `Check their latest session on the feed`,
      url: '/social',
      tag: `session-${sessionId}`,
    })

    // Send push to each subscription using the Web Push Protocol
    const results = await Promise.allSettled(subs.map(sub =>
      sendWebPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload, {
        vapidPublicKey: VAPID_PUBLIC_KEY,
        vapidPrivateKey: VAPID_PRIVATE_KEY,
        vapidSubject: VAPID_SUBJECT,
      })
    ))

    const sent = results.filter(r => r.status === 'fulfilled').length
    return new Response(JSON.stringify({ sent, total: subs.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(String(e), { status: 500, headers: corsHeaders })
  }
})

// Minimal Web Push sender using the VAPID + ece encryption stack available in Deno.
// For production, consider the `web-push` npm package via esm.sh.
async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapid: { vapidPublicKey: string; vapidPrivateKey: string; vapidSubject: string },
) {
  // Build VAPID JWT
  const url = new URL(sub.endpoint)
  const audience = `${url.protocol}//${url.host}`
  const expiry = Math.floor(Date.now() / 1000) + 12 * 3600

  const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const claims = btoa(JSON.stringify({ aud: audience, exp: expiry, sub: vapid.vapidSubject })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const privKeyBytes = base64UrlDecode(vapid.vapidPrivateKey)
  const cryptoKey = await crypto.subtle.importKey(
    'raw', privKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign'],
  )
  const sigBytes = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(`${header}.${claims}`),
  )
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
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
