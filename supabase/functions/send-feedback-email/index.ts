import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const TO_EMAIL = Deno.env.get('FEEDBACK_EMAIL') || 'feedback@bodmax.app'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': Deno.env.get('APP_URL') || 'https://getbodmax.com', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    const { message, rating, userId } = await req.json()

    if (!RESEND_API_KEY) {
      // No email key configured — silently succeed so the app still works
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
