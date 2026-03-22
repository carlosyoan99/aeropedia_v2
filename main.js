/**
 * main.js — Bootstrap de AeroPedia SPA v5
 */

import { store }                               from './store/index.js';
import { prefs, syncPrefsWithStore, applyThemeToDom } from './store/preferences.js';
import { router }                              from './router/index.js';
import { Header }                              from './components/Header.js';
import { PWAInstallBanner, registerSW }        from './components/PWAInstallBanner.js';

// ── Anti-FOUC ─────────────────────────────────────────────────
;(function() {
  try {
    const raw = JSON.parse(localStorage.getItem('aeropedia_prefs'));
    const t   = raw?.display?.theme || localStorage.getItem('aeropedia_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
    if (t !== 'light') document.documentElement.classList.add('dark-preload');
  } catch { document.documentElement.setAttribute('data-theme', 'dark'); }
})();

// ── Carga de datos ─────────────────────────────────────────────
async function loadCoreData() {
  const [aRes, cRes, kRes] = await Promise.all([
    fetch('./data/aircraft.json'),
    fetch('./data/conflicts.json'),
    fetch('./data/kills.json'),
  ]);
  if (!aRes.ok || !cRes.ok)
    throw new Error('No se pudieron cargar los datos. Usa un servidor HTTP (npx serve .)');
  const [aircraftDB, conflictsDB, killsDB] = await Promise.all([aRes.json(), cRes.json(), kRes.ok ? kRes.json() : []]);
  store.setState({ aircraftDB, conflictsDB, killsDB });
}

// ── Rutas ──────────────────────────────────────────────────────
function registerRoutes() {
  router
    .route('/', async () => {
      const { HomeView } = await import('./views/HomeView.js');
      return new HomeView();
    }, { title: 'AeroPedia — Archivo Global de Aviación' })

    .route('/aircraft/:id', async () => {
      const { AircraftDetailView } = await import('./views/AircraftDetailView.js');
      return new AircraftDetailView();
    }, { title: 'Ficha técnica — AeroPedia' })

    .route('/compare', async () => {
      const { CompareView } = await import('./views/CompareView.js');
      return new CompareView();
    }, { title: 'Comparador — AeroPedia' })

    .route('/kills', async () => {
      const { KillsView } = await import('./views/KillsView.js');
      return new KillsView();
    }, { title: 'Historial de Combate — AeroPedia' })

    .route('/fleets', async () => {
      const { FleetsView } = await import('./views/FleetsView.js');
      return new FleetsView();
    }, { title: 'Flotas Aéreas — AeroPedia' })

    .route('/mach', async () => {
      const { MachView } = await import('./views/MachView.js');
      return new MachView();
    }, { title: 'Calculadora Mach — AeroPedia' })

    .route('/favorites', async () => {
      const { FavoritesView } = await import('./views/FavoritesView.js');
      return new FavoritesView();
    }, { title: 'Mis Favoritos — AeroPedia' })

    .route('/settings', async () => {
      const { SettingsView } = await import('./views/SettingsView.js');
      return new SettingsView();
    }, { title: 'Configuración — AeroPedia' })

    .route('/theater', async () => {
      const { TheaterView } = await import('./views/TheaterView.js');
      return new TheaterView();
    }, { title: 'Teatro de Operaciones — AeroPedia' })

    .route('/stats', async () => {
      const { StatsView } = await import('./views/StatsView.js');
      return new StatsView();
    }, { title: 'Estadísticas Globales — AeroPedia' })

    .route('/shared', async () => {
      const { SharedView } = await import('./views/SharedView.js');
      return new SharedView();
    }, { title: 'Colección compartida — AeroPedia' })

    .notFound(async () => ({
      render: () => {
        const el = document.createElement('div');
        el.className = 'not-found-view';
        const recents = store.get('recents').slice(0,3);
        const db      = store.get('aircraftDB');
        const recentPlanes = recents.map(id => db.find(p=>p.id===id)).filter(Boolean);
        el.innerHTML = `<div class="not-found-inner">
          <p class="not-found-code mono">404</p>
          <p class="not-found-title">Página no encontrada</p>
          <p class="not-found-sub">La ruta <code>${location.pathname}</code> no existe.</p>
          ${recentPlanes.length ? `
            <div class="not-found-recents">
              <p class="not-found-recents-label">Vistas recientemente:</p>
              ${recentPlanes.map(p=>`
                <a href="/aircraft/${p.id}" data-link class="not-found-recent-item">
                  <img src="./public/min/${p.img}.webp" alt="${p.name}" width="44" height="25"
                    style="object-fit:cover;border-radius:4px" onerror="this.style.display='none'">
                  <span>${p.name}</span>
                </a>`).join('')}
            </div>` : ''}
          <a href="/" data-link class="btn-back-home" style="margin-top:1rem">← Volver al archivo</a>
        </div>`;
        return el;
      },
    }));
}

// ── Sincronización multi-pestaña ──────────────────────────────
function initMultiTabSync() {
  window.addEventListener('storage', (e) => {
    // Sincronizar favoritos entre pestañas
    if (e.key === 'aeropedia_favs' && e.newValue) {
      try {
        const newFavs = JSON.parse(e.newValue);
        if (JSON.stringify(newFavs) !== JSON.stringify(store.get('favs'))) {
          store.setState({ favs: newFavs });
          // No mostrar toast intrusivo, solo actualizar silenciosamente
        }
      } catch {}
    }
    if (e.key === 'aeropedia_favs_meta' && e.newValue) {
      try { store.setState({ favsMeta: JSON.parse(e.newValue) }); } catch {}
    }
    if (e.key === 'aeropedia_collections' && e.newValue) {
      try { store.setState({ collections: JSON.parse(e.newValue) }); } catch {}
    }
  });
}

// ── Init ───────────────────────────────────────────────────────
async function init() {
  // 1. Prefs ↔ store
  syncPrefsWithStore(store);

  // 2. Multi-tab sync
  initMultiTabSync();

  // 3. Header
  const headerEl = document.getElementById('app-header');
  if (headerEl) headerEl.appendChild(new Header().render());

  // 4. Skeleton
  const outlet = document.getElementById('app-outlet');
  if (outlet) outlet.innerHTML = `
    <div class="init-loading" role="status" aria-live="polite">
      <div class="init-loading-inner">
        <div class="init-spinner" aria-hidden="true"></div>
        <p class="init-loading-text mono">Cargando base de datos…</p>
      </div>
    </div>`;

  // 5. Datos
  try {
    await loadCoreData();
  } catch (err) {
    if (outlet) outlet.innerHTML = `
      <div class="load-error" role="alert">
        <p class="load-error-title">Error al cargar la base de datos</p>
        <p class="load-error-msg">${err.message}</p>
        <p class="load-error-hint">Sirve el proyecto con: <code>npx serve .</code></p>
      </div>`;
    return;
  }

  // 6. Rutas
  registerRoutes();

  // 7. Aria-live announcer para lectores de pantalla
  if (prefs.get('a11y', 'announceRoutes')) {
    const announcer = document.getElementById('route-announcer');
    router.beforeEach(() => {
      setTimeout(() => {
        if (announcer) {
          announcer.textContent = `Navegando a: ${document.title}`;
          setTimeout(() => { announcer.textContent = ''; }, 1500);
        }
      }, 300);
    });
  }

  await router.init();

  // 8. PWA
  await registerSW();
  const pwaBanner = new PWAInstallBanner();
  pwaBanner.init();

  // 9. Atajos globales
  document.addEventListener('keydown', (e) => {
    const tag    = document.activeElement?.tagName.toLowerCase();
    const typing = ['input','select','textarea'].includes(tag);
    if (typing) return;
    if (e.key === 'Escape' && store.get('currentRoute') !== '/') router.navigate('/');
    if ((e.key === ',') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); router.navigate('/settings'); }
    if (e.key === 'm' || e.key === 'M') router.navigate('/mach');
    if (e.key === 't' || e.key === 'T') router.navigate('/theater');
  });
}

document.addEventListener('DOMContentLoaded', init);
