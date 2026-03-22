/**
 * sw.js — Service Worker de AeroPedia
 * Cache-first para assets estáticos, network-first para datos JSON.
 * Soporte offline completo.
 */

const CACHE_VERSION  = 'aeropedia-v1';
const CACHE_STATIC   = `${CACHE_VERSION}-static`;
const CACHE_DATA     = `${CACHE_VERSION}-data`;
const CACHE_IMAGES   = `${CACHE_VERSION}-images`;

// Assets que se cachean en el install
const STATIC_ASSETS = [
  './',
  './index.html',
  './main.js',
  './styles.css',
  './store/index.js',
  './store/preferences.js',
  './router/index.js',
  './utils/index.js',
  './components/Header.js',
  './components/Charts.js',
  './manifest.json',
  './icons/icon-96.svg',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
];

// JSON de datos — network-first con fallback a caché
const DATA_PATTERNS = [
  /\/data\/aircraft\.json$/,
  /\/data\/conflicts\.json$/,
  /\/data\/fleets\.json$/,
  /\/data\/kills\.json$/,
];

// Imágenes — cache-first (no críticas)
const IMAGE_PATTERN = /\/public\/(min|max|mid)\/.+\.webp$/;

// ── Install ───────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Error cacheando assets:', err);
      });
    })
  );
});

// ── Activate ──────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(k => k.startsWith('aeropedia-') && k !== CACHE_STATIC && k !== CACHE_DATA && k !== CACHE_IMAGES)
          .map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar requests del mismo origen
  if (url.origin !== location.origin) return;

  // 1. Datos JSON → Network-first con fallback a caché
  if (DATA_PATTERNS.some(p => p.test(url.pathname))) {
    event.respondWith(networkFirstData(request));
    return;
  }

  // 2. Imágenes → Cache-first (no bloquear en fallo)
  if (IMAGE_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirstImage(request));
    return;
  }

  // 3. Navegación (HTML) → Network con fallback al index
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  // 4. Resto (JS, CSS) → Cache-first
  event.respondWith(cacheFirst(request, CACHE_STATIC));
});

// ── Estrategias ───────────────────────────────────────────────

/** Network-first: intenta red, si falla usa caché */
async function networkFirstData(request) {
  const cache = await caches.open(CACHE_DATA);
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Sin conexión y sin caché disponible' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/** Cache-first: busca en caché, si no va a red */
async function cacheFirst(request, cacheName = CACHE_STATIC) {
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

/** Cache-first para imágenes con límite de tamaño */
async function cacheFirstImage(request) {
  const cache  = await caches.open(CACHE_IMAGES);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Limitar caché de imágenes a las últimas 200
      const keys = await cache.keys();
      if (keys.length > 200) await cache.delete(keys[0]);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 404 });
  }
}

/** SPA navigation: siempre devuelve index.html */
async function navigationHandler(request) {
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(4000) });
    return response;
  } catch {
    const cache  = await caches.open(CACHE_STATIC);
    const cached = await cache.match('./index.html') || await cache.match('./');
    if (cached) return cached;
    return new Response('<h1>Sin conexión</h1>', { status: 503, headers: { 'Content-Type': 'text/html' } });
  }
}

// ── Mensaje de nueva versión ──────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: CACHE_VERSION });
  }
});
