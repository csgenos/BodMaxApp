// Vercel Serverless Function — triggered every Sunday at 8pm UTC by Vercel Cron.
// Calls the Supabase Edge Function that sends weekly recap push notifications.

export default async function handler(req, res) {
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
    const response = await fetch(`${supabaseUrl}/functions/v1/weekly-recap`, {
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
