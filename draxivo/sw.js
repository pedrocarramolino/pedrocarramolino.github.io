// Service worker de DRAXIVO. Generado en el build.
const VERSION = 'mwe07lfz';
const CACHE = 'draxivo-' + VERSION;
const PRECACHE = ["./","index.html","manifest.webmanifest","icons/icon.svg","icons/icon-192.png","icons/icon-512.png","icons/apple-touch-icon.png","icons/maskable-512.png","assets/index-CVhdjLHr.js","assets/index-D2vHZBWf.css"];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('draxivo-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ---------- Aviso push de fin de descanso ----------
// El servidor solo envía la hora de fin; el texto sale del entrenamiento guardado en el dispositivo.
function activeWorkout() {
  return new Promise((resolve) => {
    let req;
    try {
      req = indexedDB.open('draxivo');
    } catch {
      return resolve(null);
    }
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      try {
        const all = db.transaction('workouts').objectStore('workouts').index('status').getAll('active');
        all.onsuccess = () => {
          db.close();
          resolve(all.result.sort((a, b) => b.startedAt - a.startedAt)[0] || null);
        };
        all.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        db.close();
        resolve(null);
      }
    };
  });
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  if (data.type !== 'rest') return;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Con la app en pantalla ya suenan el pitido y la vibración.
      if (wins.some((c) => c.visibilityState === 'visible')) return;
      const w = await activeWorkout();
      const rest = w && w.rest;
      if (!rest || rest.pausedRemainingMs != null || rest.endsAt !== data.endsAt) return;
      const prev = await self.registration.getNotifications({ tag: 'draxivo-rest' });
      const already = prev.some((n) => n.data && n.data.endsAt === data.endsAt);
      await self.registration.showNotification('Descanso terminado', {
        body: rest.label ? 'Siguiente serie: ' + rest.label : 'Vuelve a entrenar.',
        tag: 'draxivo-rest',
        renotify: !already,
        silent: already,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        vibrate: [200, 100, 200],
        data: { url: self.registration.scope, endsAt: data.endsAt },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const own = list.find((c) => c.url.startsWith(self.registration.scope));
      if (own) return own.focus();
      return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Navegación: red primero, copia en caché como respaldo sin conexión.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('index.html', copy));
          return res;
        })
        .catch(() => caches.match('index.html', { ignoreSearch: true })),
    );
    return;
  }
  // Recursos con hash: caché primero.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && url.pathname.startsWith(new URL('./', self.registration.scope).pathname)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
