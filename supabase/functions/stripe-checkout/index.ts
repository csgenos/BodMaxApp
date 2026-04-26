import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ALLOWED_ORIGIN = Deno.env.get('APP_URL') || 'https://getbodmax.com'
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { userId, successUrl, cancelUrl } = await req.json()
    if (!userId) return json({ error: 'userId required' }, 400)

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
    const STRIPE_PRICE_ID = Deno.env.get('STRIPE_PRICE_ID')
    if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) {
      return json({ error: 'Stripe not configured' }, 500)
    }

    const appUrl = Deno.env.get('APP_URL') || 'https://getbodmax.com'
    const safeUrl = (url: string | undefined, fallback: string) =>
      url?.startsWith(appUrl) ? url : fallback
    const params = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': STRIPE_PRICE_ID,
      'line_items[0][quantity]': '1',
      'metadata[userId]': userId,
      'subscription_data[metadata][userId]': userId,
      success_url: safeUrl(successUrl, `${appUrl}/coach?subscribed=1`),
      cancel_url: safeUrl(cancelUrl, `${appUrl}/coach`),
      'payment_method_types[0]': 'card',
    })

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!res.ok) {
      const err = await res.text()
      return json({ error: err }, 500)
    }

    const session = await res.json()
    return json({ checkoutUrl: session.url })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
