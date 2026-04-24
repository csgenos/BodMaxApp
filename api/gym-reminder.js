// Vercel Serverless Function — triggered hourly by Vercel Cron Jobs.
// Calls the Supabase Edge Function that sends gym reminder push notifications.
//
// Required environment variables (set in Vercel project settings):
//   SUPABASE_URL              — your Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY — service role key (never expose client-side)
//   CRON_SECRET               — Vercel sets this automatically for cron jobs

export default async function handler(req, res) {
  // Vercel cron jobs send the CRON_SECRET in the Authorization header
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set' })
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/gym-reminder`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json().catch(() => ({}))
    return res.status(response.status).json(data)
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}
