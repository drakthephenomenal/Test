// ═══════════════════════════════════════════════
// Radha Naam Jap — Service Worker
// Update CACHE version when index.html changes
// ═══════════════════════════════════════════════
const CACHE = 'radha-jap-v53';  // v53: bg-sync midnight Drive backup, owner global add UI, share modal

const PRECACHE = [
  './index.html',
  './style.css',
  './stotrams.js',
  './app.js',
  './guru.jpg',
  './icon-192.png',
  './icon-512.png',
  './manifest.json',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
  'https://fonts.googleapis.com/css2?family=Tiro+Devanagari+Hindi&family=Hind+Siliguri:wght@400;600;700&family=Cinzel+Decorative:wght@400;700&family=EB+Garamond:wght@400;600&family=Inter:wght@300;400;500;600&display=swap',
  'https://accounts.google.com/gsi/client',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js',
  'https://apis.google.com/js/api.js'
];

// Firebase & Google auth must pass through — their SDKs handle offline internally
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

// ── Install: pre-cache critical assets ──
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(
        PRECACHE.map(url => cache.add(url).catch(() => {}))
      )
    )
  );
});

// ── Activate: delete old caches ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys.filter(k => k !== CACHE).map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: stale-while-revalidate strategy ──
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Let Firebase & Google auth requests pass through untouched
  if (BYPASS.some(h => url.href.includes(h))) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && resp.type !== 'error') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => null);

      if (cached) return cached;

      return networkFetch.then(resp => {
        if (resp) return resp;
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// ── Handle notification requests from the page ──
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SHOW_NOTIFICATION') {
    e.waitUntil(
      self.registration.showNotification(e.data.title, {
        body: e.data.body,
        tag: e.data.tag,
        renotify: true,
        vibrate: [200, 100, 200]
      })
    );
  }
});

// ── Handle notification tap — bring app to focus ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

// ═══════════════════════════════════════════════
// Periodic Background Sync — runs even when the app is CLOSED
// (Chrome/Edge on installed PWA with permission granted)
// Reads latest snapshot + token written by app to IDB 'rjap_bg' / 'snap'
// ═══════════════════════════════════════════════
function _readSnap() {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open('rjap_bg', 1);
      req.onupgradeneeded = () => { req.result.createObjectStore('snap'); };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('snap', 'readonly');
        const g = tx.objectStore('snap').get('latest');
        g.onsuccess = () => { db.close(); resolve(g.result || null); };
        g.onerror = () => { db.close(); resolve(null); };
      };
      req.onerror = () => resolve(null);
    } catch(e) { resolve(null); }
  });
}

async function _bgDriveBackup() {
  const snap = await _readSnap();
  if (!snap || !snap.token || !snap.payload) return;
  const filename = snap.filename || 'radha-naam-jap-backup.json';
  try {
    const listResp = await fetch(
      'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent("name='" + filename + "' and trashed=false") + '&spaces=drive&fields=files(id)',
      { headers: { 'Authorization': 'Bearer ' + snap.token } }
    );
    if (!listResp.ok) return;
    const listData = await listResp.json();
    const fileId = listData.files && listData.files.length ? listData.files[0].id : null;
    const boundary = 'rjap_' + Date.now();
    const metadata = JSON.stringify({ name: filename, mimeType: 'application/json' });
    const data = JSON.stringify(snap.payload, null, 2);
    const body = '--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+metadata+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+data+'\r\n--'+boundary+'--';
    const url = fileId
      ? 'https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=multipart'
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    await fetch(url, {
      method: fileId ? 'PATCH' : 'POST',
      headers: { 'Authorization': 'Bearer ' + snap.token, 'Content-Type': 'multipart/related; boundary=' + boundary },
      body
    });
  } catch(e) { /* swallow */ }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'rjap-midnight-backup') {
    event.waitUntil(_bgDriveBackup());
  }
});
// One-shot Background Sync as fallback
self.addEventListener('sync', (event) => {
  if (event.tag === 'rjap-midnight-backup') {
    event.waitUntil(_bgDriveBackup());
  }
});
