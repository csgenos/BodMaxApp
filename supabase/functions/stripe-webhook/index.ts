import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe'

serve(async (req) => {
  const sig = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!sig || !webhookSecret) {
    return new Response('Webhook secret not configured', { status: 400 })
  }

  const body = await req.text()
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-04-10' })

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret)
  } catch (e) {
    return new Response(`Webhook signature failed: ${e.message}`, { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const sub = event.data.object as Stripe.Subscription

  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated'
  ) {
    const userId = sub.metadata?.userId
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
    const status = sub.status === 'active' || sub.status === 'trialing' ? 'active' : 'canceled'

    if (userId) {
      await supabase.from('profiles').update({
        subscription_status: status,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
      }).eq('id', userId)
    } else if (customerId) {
      await supabase.from('profiles').update({
        subscription_status: status,
        stripe_subscription_id: sub.id,
      }).eq('stripe_customer_id', customerId)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const userId = sub.metadata?.userId
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id

    if (userId) {
      await supabase.from('profiles').update({ subscription_status: 'canceled' }).eq('id', userId)
    } else if (customerId) {
      await supabase.from('profiles').update({ subscription_status: 'canceled' }).eq('stripe_customer_id', customerId)
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
    if (customerId) {
      await supabase.from('profiles').update({ subscription_status: 'canceled' }).eq('stripe_customer_id', customerId)
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
