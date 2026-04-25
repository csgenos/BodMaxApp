import { supabase } from './supabase'

export async function startCheckout() {
  const { data, error } = await supabase.functions.invoke('create-checkout', { body: {} })
  if (error) throw new Error(error.message || 'Checkout failed')
  if (data?.error) throw new Error(data.error)
  if (data?.url) window.location.href = data.url
}

export async function openPortal() {
  const { data, error } = await supabase.functions.invoke('create-portal', { body: {} })
  if (error) throw new Error(error.message || 'Portal failed')
  if (data?.error) throw new Error(data.error)
  if (data?.url) window.location.href = data.url
}

export const isPremium = (profile) => profile?.beta === true || profile?.subscription_status === 'active'
