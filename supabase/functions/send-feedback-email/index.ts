import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const TO_EMAIL = Deno.env.get('FEEDBACK_EMAIL') || 'feedback@bodmax.app'
const ALLOWED_ORIGIN = Deno.env.get('APP_URL') || 'https://getbodmax.com'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  // Require a valid Supabase JWT — rejects unauthenticated spam requests
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 })
  }
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const { message, rating, userId } = await req.json()

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    const stars = rating ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : 'No rating'
    const body = `
New BodMax Feedback

Rating: ${stars} (${rating || 0}/5)
User ID: ${userId || 'anonymous'}

---
${message}
---
`
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'BodMax <noreply@bodmax.app>',
        to: [TO_EMAIL],
        subject: `BodMax Feedback — ${stars}`,
        text: body,
      }),
    })

    if (!res.ok) throw new Error(await res.text())
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
