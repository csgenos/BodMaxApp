import { supabase } from './supabase'

// Set VITE_VAPID_PUBLIC_KEY in .env.local — generate with:
//   npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(b64) {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4)
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)))
}

export const getNotifPermission = () =>
  'Notification' in window ? Notification.permission : 'unsupported'

export const requestNotifPermission = () =>
  'Notification' in window ? Notification.requestPermission() : Promise.resolve('unsupported')

export const subscribePush = async (userId) => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  if (!VAPID_PUBLIC_KEY) {
    console.warn('VITE_VAPID_PUBLIC_KEY not set — push notifications disabled')
    return null
  }
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }
  const json = sub.toJSON()
  await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
  }, { onConflict: 'endpoint' })
  return sub
}

export const unsubscribePush = async (userId) => {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  const { endpoint } = sub.toJSON()
  await sub.unsubscribe()
  await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint)
}

export const isPushSubscribed = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return !!sub
}

// Show a native notification via the registered service worker.
// Works both in foreground and background for standalone PWAs.
export const showTimerNotification = async (title, body) => {
  if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification(title, {
    body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: 'rest-timer',
    renotify: true,
  })
}
