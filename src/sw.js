import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// ── PUSH NOTIFICATIONS ────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'BodMax', {
      body: data.body ?? '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: data.tag ?? 'bodmax',
      renotify: !!data.tag,
      data: { url: data.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => 'focus' in c)
      if (existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})
