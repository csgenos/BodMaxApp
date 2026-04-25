// Handles Stripe webhook events to keep subscription status in sync.
// No JWT auth — Stripe signature verification is used instead.
//
// Required secrets:
//   supabase secrets set STRIPE_SECRET_KEY=sk_...
//   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
//
// Webhook endpoint to register in Stripe Dashboard:
//   https://<project-ref>.supabase.co/functions/v1/stripe-webhook
//
// Events to enable in Stripe:
//   checkout.session.completed
//   customer.subscription.updated
//   customer.subscription.deleted
//   invoice.paid
//   invoice.payment_failed

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('Missing stripe-signature', { status: 400 })

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response(`Webhook error: ${err.message}`, { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const updateByUserId = (userId: string, data: Record<string, unknown>) =>
    supabase.from('profiles').update(data).eq('id', userId)

  const updateByCustomerId = (customerId: string, data: Record<string, unknown>) =>
    supabase.from('profiles').update(data).eq('stripe_customer_id', customerId)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        if (userId) {
          await updateByUserId(userId, {
            stripe_customer_id: session.customer as string,
            subscription_status: 'active',
            subscription_end_at: null,
          })
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.user_id
        const status = sub.status === 'active' ? 'active'
          : sub.status === 'past_due' ? 'past_due'
          : 'canceled'
        const endAt = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null
        const update = { subscription_status: status, subscription_end_at: endAt }
        if (userId) await updateByUserId(userId, update)
        else await updateByCustomerId(sub.customer as string, update)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.user_id
        const endAt = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null
        const update = { subscription_status: 'canceled', subscription_end_at: endAt }
        if (userId) await updateByUserId(userId, update)
        else await updateByCustomerId(sub.customer as string, update)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        await updateByCustomerId(invoice.customer as string, { subscription_status: 'active' })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await updateByCustomerId(invoice.customer as string, { subscription_status: 'past_due' })
        break
      }
    }
  } catch (err) {
    console.error(`Error handling ${event.type}:`, err)
    return new Response('Handler error', { status: 500 })
  }

  return new Response('OK', { status: 200 })
})
