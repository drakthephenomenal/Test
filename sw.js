// ═══════════════════════════════════════════════════════
// Radha Naam Jap — Service Worker
// v83: Fixed Gaudiya/ISKCON toggle visibility in PWA homescreen mode
//      and Radha option hidden when Gaudiya ON (CSS + applyGaudiyaMode helper)
// ═══════════════════════════════════════════════════════
const CACHE = 'radha-jap-v83';

const ALWAYS_FRESH = [
  'index.html',
  'app.js',
  'style.css',
  'stotrams.js',
  'panchangData.js',
];

const PRECACHE = [
  './index.html',
  './style.css?v=83',
  './stotrams.js?v=83',
  './app.js?v=83',
  './panchangData.js?v=83',
  './guru.jpg',
  './icon-192.png?v=83',
  './icon-512.png',
  './manifest.json?v=83',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
  'https://fonts.googleapis.com/css2?family=Tiro+Devanagari+Hindi&family=Hind+Siliguri:wght@400;600;700&family=Cinzel+Decorative:wght@400;700&family=EB+Garamond:wght@400;600&family=Inter:wght@300;400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js'
];

const BYPASS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'firebase.googleapis.com',
  'firebaseio.com',
  'oauth2.googleapis.com',
  'accounts.google.com',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(PRECACHE.map(url => cache.add(url).catch(() => {})))
    )
  );
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clients) {
      try {
        const u = new URL(c.url);
        u.searchParams.set('_swv', '83');
        await c.navigate(u.toString());
      } catch (_) {
        c.postMessage({ type: 'SW_UPDATED', version: CACHE });
      }
    }
  })());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (BYPASS.some(h => url.href.includes(h))) return;
  const filename = url.pathname.split('/').pop();
  if (
    e.request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    ALWAYS_FRESH.some(f => filename === f)
  ) {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then(resp => {
          if (resp && resp.status === 200)
            caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          return resp;
        })
        .catch(() =>
          caches.match(e.request).then(cached => cached || caches.match('./index.html'))
        )
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && resp.type !== 'error')
          caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        return resp;
      }).catch(() => null);
      return cached || net.then(r => r || new Response('Offline', { status: 503 }));
    })
  );
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SHOW_NOTIFICATION') {
    e.waitUntil(
      self.registration.showNotification(e.data.title, {
        body: e.data.body,
        tag: e.data.tag,
        renotify: true,
        vibrate: [200, 100, 200],
        icon: './icon-192.png'
      })
    );
  }
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const client of list) { if ('focus' in client) return client.focus(); }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});
