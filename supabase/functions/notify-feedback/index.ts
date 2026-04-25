// Supabase Edge Function — email notification when a user submits feedback
//
// Triggered by a Supabase Database Webhook on INSERT to the feedback table.
//
// Required secrets (set via Supabase dashboard → Edge Functions → Secrets, or CLI):
//   supabase secrets set RESEND_API_KEY=re_xxxx
//   supabase secrets set FEEDBACK_EMAIL=you@youremail.com
//   supabase secrets set FROM_EMAIL="BodMax <feedback@yourdomain.com>"
//
// Deploy:
//   supabase functions deploy notify-feedback
//
// Webhook setup (Supabase dashboard → Database → Webhooks → Create):
//   Name:   notify-feedback
//   Table:  feedback
//   Events: INSERT
//   Type:   Supabase Edge Function
//   Function: notify-feedback

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const TO_EMAIL       = Deno.env.get('FEEDBACK_EMAIL')!
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL') || 'BodMax <onboarding@resend.dev>'

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let payload: { record?: Record<string, unknown> }
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const record = payload.record
  if (!record || !record.message) {
    return new Response('No record', { status: 400 })
  }

  const rating    = typeof record.rating === 'number' ? record.rating : null
  const message   = String(record.message)
  const userId    = String(record.user_id ?? 'unknown')
  const createdAt = record.created_at ? new Date(String(record.created_at)).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'unknown'

  const stars   = rating ? '⭐'.repeat(rating) : null
  const subject = rating ? `New BodMax Feedback ${stars}` : 'New BodMax Feedback'

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
        <div style="width:10px;height:10px;border-radius:50%;background:#e0161e;"></div>
        <a href="https://getbodmax.com" style="font-weight:800;font-size:18px;letter-spacing:-0.5px;color:#111;text-decoration:none;">BodMax</a>
      </div>
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111;">New Feedback</h2>
      ${rating
        ? `<div style="font-size:22px;margin-bottom:20px;">${stars} <span style="font-size:14px;color:#888;vertical-align:middle;">${rating}/5</span></div>`
        : `<div style="font-size:13px;color:#aaa;margin-bottom:20px;">No rating given</div>`
      }
      <div style="background:#f7f7f7;border-left:4px solid #e0161e;border-radius:0 8px 8px 0;padding:16px 20px;font-size:15px;line-height:1.7;color:#222;margin-bottom:24px;">
        "${message}"
      </div>
      <table style="font-size:12px;color:#aaa;border-collapse:collapse;">
        <tr><td style="padding:2px 12px 2px 0;font-weight:600;color:#888;">User ID</td><td>${userId}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;font-weight:600;color:#888;">Time</td><td>${createdAt}</td></tr>
      </table>
    </div>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: TO_EMAIL, subject, html }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Resend error:', err)
    return new Response('Email send failed', { status: 500 })
  }

  return new Response('OK', { status: 200 })
})
