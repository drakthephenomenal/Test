// ═══════════════════════════════════════════════
// Radha Naam Jap — Service Worker
// Update CACHE version when index.html changes
// ═══════════════════════════════════════════════
const CACHE = 'radha-jap-v30';

const PRECACHE = [
  './index.html',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
  'https://fonts.googleapis.com/css2?family=Tiro+Devanagari+Hindi&family=Hind+Siliguri:wght@400;600;700&family=Cinzel+Decorative:wght@400;700&family=EB+Garamond:wght@400;600&family=Inter:wght@300;400;500;600&display=swap',
  'https://accounts.google.com/gsi/client',
  'https://apis.google.com/js/api.js'
];

const BYPASS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'firebase.googleapis.com',
  'firebaseio.com',
  'oauth2.googleapis.com',
  'accounts.google.com'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(cache => Promise.allSettled(PRECACHE.map(url => cache.add(url).catch(() => {})))));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (BYPASS.some(h => url.href.includes(h))) return;

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && resp.type !== 'error') {
          caches.open(CACHE).then(c => c.put('./index.html', resp.clone()));
        }
        return resp;
      }).catch(async () => (await caches.match('./index.html')) || new Response('Offline', { status: 503 }))
    );
    return;
  }

  e.respondWith(caches.match(e.request).then(cached => {
    const networkFetch = fetch(e.request).then(resp => {
      if (resp && resp.status === 200 && resp.type !== 'error') {
        caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
      }
      return resp;
    }).catch(() => null);
    if (cached) return cached;
    return networkFetch.then(resp => resp || new Response('Offline', { status: 503 }));
  }));
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SHOW_NOTIFICATION') {
    e.waitUntil(self.registration.showNotification(e.data.title, { body: e.data.body, tag: e.data.tag, renotify: true, vibrate: [200, 100, 200] }));
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    for (const client of list) {
      if ('focus' in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow('./');
  }));
});
