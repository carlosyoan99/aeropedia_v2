/**
 * sw.js — Service Worker de AeroPedia v4
 * Cache-first para todos los assets estáticos (JS, CSS, vistas, utils, componentes).
 * Network-first para datos JSON.
 * Cache-first con límite para imágenes.
 */

const CACHE_VERSION = 'aeropedia-v5.2';
const CACHE_STATIC  = `${CACHE_VERSION}-static`;
const CACHE_DATA    = `${CACHE_VERSION}-data`;
const CACHE_IMAGES  = `${CACHE_VERSION}-images`;

// Todos los assets estáticos que pueden cachearse en install
const STATIC_ASSETS = [
  './',
  './index.html',
  './main.js',
  './styles.css',
  './manifest.json',

  // Core modules
  './router/index.js',
  './store/index.js',
  './store/preferences.js',

  // Utils
  './utils/index.js',
  './utils/exportImage.js',

  // Components
  './components/Header.js',
  './components/Footer.js',
  './components/Charts.js',
  './components/PWAInstallBanner.js',

  // ALL views (lazy loaded but better cached upfront)
  './views/HomeView.js',
  './views/AircraftDetailView.js',
  './views/CompareView.js',
  './views/FavoritesView.js',
  './views/TheaterView.js',
  './views/StatsView.js',
  './views/KillsView.js',
  './views/FleetsView.js',
  './views/MachView.js',
  './views/SettingsView.js',
  './views/HelpView.js',
  './views/SharedView.js',

  // Icons
  './icons/icon-96.svg',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
];

// Data files — network-first (need fresh data)
const DATA_PATTERNS = [
  /\/data\/aircraft\.json$/,
  /\/data\/conflicts\.json$/,
  /\/data\/fleets\.json$/,
  /\/data\/kills\.json$/,
];

// Images — cache-first with 300 item limit
const IMAGE_PATTERN = /\/public\/(min|max|mid)\/.+\.webp$/;

// ── Install: precache all static assets ──────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      // Use individual adds so one failure doesn't block others
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn(`[SW] Failed to cache ${url}:`, err))
        )
      );
    })
  );
});

// ── Activate: purge old caches ────────────────────────────────
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

  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  // JSON data: network-first (keep fresh, fallback to cache)
  if (DATA_PATTERNS.some(p => p.test(url.pathname))) {
    event.respondWith(networkFirst(request, CACHE_DATA));
    return;
  }

  // Images: cache-first with eviction limit
  if (IMAGE_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirstWithLimit(request, CACHE_IMAGES, 300));
    return;
  }

  // SPA navigation: serve index.html from cache when offline
  if (request.mode === 'navigate') {
    event.respondWith(navigateSPA(request));
    return;
  }

  // All other static assets: cache-first
  event.respondWith(cacheFirst(request, CACHE_STATIC));
});

// ── Strategies ────────────────────────────────────────────────
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(6000) });
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached ?? new Response(JSON.stringify({ offline: true, error: 'No network' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
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
  const cache = await caches.open(CACHE_STATIC);
  try {
    // Try network first for navigation
    const response = await fetch(request, { signal: AbortSignal.timeout(5000) });
    if (response.ok) return response;
    throw new Error('Non-ok response');
  } catch {
    // Serve cached index.html for all navigation (SPA routing)
    const cached = await cache.match('./index.html') ?? await cache.match('./');
    return cached ?? new Response(
      '<!DOCTYPE html><html lang="es"><body style="font-family:system-ui;padding:2rem;text-align:center"><h1>✈ AeroPedia</h1><p>Sin conexión. Abre la app desde tu pantalla de inicio.</p></body></html>',
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

// ── Messages ──────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION')  event.ports[0]?.postMessage({ version: CACHE_VERSION });
});
