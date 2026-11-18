// Moloko service worker: app shell offline, images and hashed assets cached.
// API calls (Supabase) always go to the network.
const V = 'moloko-v2'
const SHELL = ['/', '/studio', '/manifest.webmanifest', '/manifest-studio.webmanifest', '/icons/icon-192.png', '/icons/studio-192.png']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).catch(() => {}))
  self.skipWaiting()
})
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', e => {
  const r = e.request
  if (r.method !== 'GET') return
  const u = new URL(r.url)
  if (u.origin !== location.origin) return
  if (r.mode === 'navigate') {
    const key = u.pathname.startsWith('/studio') ? '/studio' : '/'
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put(key, cp)); return res }).catch(() => caches.match(key)))
    return
  }
  if (/^\/(assets|img|icons)\//.test(u.pathname)) {
    e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)) } return res })))
  }
})

// a tap on a CRM notification focuses the open tab (or opens one) and tells it what to show
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const path = (e.notification.data && e.notification.data.path) || ''
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const tab = list.find(c => new URL(c.url).pathname.startsWith('/studio'))
    if (tab) { tab.postMessage({ type: 'moloko-open', path }); return tab.focus() }
    return self.clients.openWindow('/studio' + (path ? '#open=' + encodeURIComponent(path) : ''))
  }))
})
