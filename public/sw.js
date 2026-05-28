// OLYMPUS v2 — Service Worker
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(list => {
      for (const client of list) {
        if (client.url && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow('/')
    })
  )
})
