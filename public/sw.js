/* CryptoBot PWA — service worker (ручной, без плагинов)
 * Стратегия: cache-first для статики оболочки, network-first для навигации.
 * WSS и api.bybit.com НИКОГДА не кэшируются.
 */
const CACHE = 'cryptobot-shell-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './empty-chart.svg',
  './offline-glyph.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Никогда не трогаем сокеты и живой API биржи
  if (url.protocol === 'wss:' || url.protocol === 'ws:' || url.hostname === 'api.bybit.com') {
    return;
  }
  if (event.request.method !== 'GET') return;

  // Навигация — network-first с честным фолбэком на оболочку из кэша
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return resp;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  // Статика своего origin — cache-first с докэшированием
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(
        (hit) =>
          hit ||
          fetch(event.request).then((resp) => {
            if (resp.ok) {
              const copy = resp.clone();
              caches.open(CACHE).then((cache) => cache.put(event.request, copy));
            }
            return resp;
          }),
      ),
    );
  }
});
