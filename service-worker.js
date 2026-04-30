const CACHE = 'oracle-v5';
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  './lava.mp4',
];
const CDN_LIBS = [
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
  'https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(PRECACHE.map((u) => cache.add(u).catch(() => {})));
      await Promise.all(
        CDN_LIBS.map((u) => cache.add(new Request(u, { mode: 'cors' })).catch(() => {})),
      );
    })(),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  e.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) {
          try {
            const cache = await caches.open(CACHE);
            await cache.put(req, res.clone());
          } catch (_) {}
        }
        return res;
      } catch (_) {
        const fallback = await caches.match('./index.html');
        if (fallback) return fallback;
        return new Response('offline', { status: 503 });
      }
    })(),
  );
});
