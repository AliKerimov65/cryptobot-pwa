/* CryptoBot PWA — service worker (ручной, без плагинов)
 * Стратегия: cache-first для статики оболочки, network-first для навигации.
 * WSS и api.bybit.com НИКОГДА не кэшируются.
 */
const CACHE = 'cryptobot-shell-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './empty-chart.svg',
  './offline-glyph.svg',
  './assets/parts/manifest.json',
  './assets/parts/js-00.txt',
  './assets/parts/js-01.txt',
  './assets/parts/js-02a.txt',
  './assets/parts/js-02b1.txt',
  './assets/parts/js-02b2.txt',
  './assets/parts/js-03.txt',
  './assets/parts/js-04q1.txt',
  './assets/parts/js-04q2.txt',
  './assets/parts/js-04q3.txt',
  './assets/parts/js-04q4.txt',
  './assets/parts/js-05q1.txt',
  './assets/parts/js-05q2.txt',
  './assets/parts/js-05q3.txt',
  './assets/parts/js-05q4.txt',
  './assets/parts/js-06a.txt',
  './assets/parts/js-06b1.txt',
  './assets/parts/js-06b2.txt',
  './assets/parts/js-07q1.txt',
  './assets/parts/js-07q2.txt',
  './assets/parts/js-07q3.txt',
  './assets/parts/js-07q4.txt',
  './assets/parts/js-08q1.txt',
  './assets/parts/js-08q2a.txt',
  './assets/parts/js-08q2b.txt',
  './assets/parts/js-08q3.txt',
  './assets/parts/js-08q4.txt',
  './assets/parts/js-09q1.txt',
  './assets/parts/js-09q2.txt',
  './assets/parts/js-09q3.txt',
  './assets/parts/js-09q4.txt',
  './assets/parts/js-10q1.txt',
  './assets/parts/js-10q2.txt',
  './assets/parts/js-10q3.txt',
  './assets/parts/js-10q4.txt',
  './assets/parts/js-11q1.txt',
  './assets/parts/js-11q2.txt',
  './assets/parts/js-11q3.txt',
  './assets/parts/js-11q4.txt',
  './assets/parts/js-12q1.txt',
  './assets/parts/js-12q2.txt',
  './assets/parts/js-12q3.txt',
  './assets/parts/js-12q4.txt',
  './assets/parts/js-13q1.txt',
  './assets/parts/js-13q2.txt',
  './assets/parts/css-00a1.txt',
  './assets/parts/css-00a2.txt',
  './assets/parts/css-00b.txt',
  './assets/parts/css-01.txt',
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
