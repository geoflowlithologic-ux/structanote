/* StructaNote — service worker
   App shell pré-cacheado; tiles de mapa em cache limitada (stale-while-revalidate). */

const VERSION = 'structanote-v1.3.1';
const SHELL_CACHE = `${VERSION}-shell`;
const TILE_CACHE = `${VERSION}-tiles`;
const MAX_TILES = 400;

const SHELL = [
  './',
  'index.html',
  'manifest.json',
  'icons/favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'vendor/tailwind.js',
  'vendor/fontawesome/css/all.min.css',
  'vendor/fontawesome/webfonts/fa-solid-900.woff2',
  'vendor/fontawesome/webfonts/fa-regular-400.woff2',
  'vendor/fontawesome/webfonts/fa-brands-400.woff2',
  'vendor/leaflet/leaflet.js',
  'offline-map.js',
  'native-bridge.js',
  'photo-store.js',
  'ios-support.js',
  'vendor/leaflet/leaflet.css',
  'vendor/leaflet/images/marker-icon.png',
  'vendor/leaflet/images/marker-icon-2x.png',
  'vendor/leaflet/images/marker-shadow.png',
  'vendor/leaflet/images/layers.png',
  'vendor/leaflet/images/layers-2x.png',
  'vendor/jszip.min.js',
  'vendor/pdfjs/pdf.min.js',
  'vendor/pdfjs/pdf.worker.min.js'
];

const TILE_HOSTS = [
  'server.arcgisonline.com',
  'services.arcgisonline.com',
  'tile.openstreetmap.org',
  'basemaps.cartocdn.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Um ficheiro em falta não deve impedir a instalação.
      Promise.all(
        SHELL.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined)
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  for (const key of keys.slice(0, keys.length - maxEntries)) {
    await cache.delete(key);
  }
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const shell = await cache.match('index.html');
    if (shell) return shell;
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(request, response.clone());
        if (cacheName === TILE_CACHE) trimCache(TILE_CACHE, MAX_TILES);
      }
      return response;
    })
    .catch(() => undefined);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
  if (!isHttp) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (TILE_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, TILE_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
  }
});
