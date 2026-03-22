/**
 * sw.js — Service Worker de AeroPedia
 * Cache-first para assets, network-first para datos JSON.
 */

const CACHE_VERSION = 'aeropedia-v3';
const CACHE_STATIC  = `${CACHE_VERSION}-static`;
const CACHE_DATA    = `${CACHE_VERSION}-data`;
const CACHE_IMAGES  = `${CACHE_VERSION}-images`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './main.js',
  './styles.css',
  './manifest.json',
  './sw.js',
  './store/index.js',
  './store/preferences.js',
  './router/index.js',
  './utils/index.js',
  './components/Header.js',
  './components/Charts.js',
  './components/PWAInstallBanner.js',
  './icons/icon-96.svg',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  // Vistas (precachear las más usadas)
  './views/HomeView.js',
  './views/AircraftDetailView.js',
  './views/FavoritesView.js',
  './views/SettingsView.js',
  // Resto se cachean en primer uso (lazy)
];

const DATA_PATTERNS = [
  /\/data\/aircraft\.json$/,
  /\/data\/conflicts\.json$/,
  /\/data\/fleets\.json$/,
  /\/data\/kills\.json$/,
];

const IMAGE_PATTERN = /\/public\/(min|max|mid)\/.+\.webp$/;

// ── Install ───────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache =>
      cache.addAll(STATIC_ASSETS).catch(err => console.warn('[SW] precache error:', err))
    )
  );
});

// ── Activate — limpiar versiones anteriores ────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('aeropedia-') && ![CACHE_STATIC, CACHE_DATA, CACHE_IMAGES].includes(k))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== location.origin) return;

  if (DATA_PATTERNS.some(p => p.test(url.pathname))) {
    event.respondWith(networkFirst(request, CACHE_DATA));
    return;
  }

  if (IMAGE_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirstWithLimit(request, CACHE_IMAGES, 250));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(navigateSPA(request));
    return;
  }

  event.respondWith(cacheFirst(request, CACHE_STATIC));
});

// ── Estrategias ───────────────────────────────────────────────
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(6000) });
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached ?? new Response(JSON.stringify({ offline: true }), {
      status: 503, headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Sin conexión', { status: 503 });
  }
}

async function cacheFirstWithLimit(request, cacheName, limit) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const keys = await cache.keys();
      if (keys.length >= limit) await cache.delete(keys[0]);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 404 });
  }
}

async function navigateSPA(request) {
  try {
    return await fetch(request, { signal: AbortSignal.timeout(5000) });
  } catch {
    const cache  = await caches.open(CACHE_STATIC);
    const cached = await cache.match('./index.html') ?? await cache.match('./');
    return cached ?? new Response('<!DOCTYPE html><html><body><h1>Sin conexión</h1></body></html>',
      { status: 200, headers: { 'Content-Type': 'text/html' } });
  }
}

// ── Mensajes ──────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION')  event.ports[0]?.postMessage({ version: CACHE_VERSION });
});
