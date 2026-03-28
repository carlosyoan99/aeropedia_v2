/**
 * main.js — Bootstrap de AeroPedia SPA
 * Non-blocking: renderiza la app inmediatamente, carga datos en background.
 */

import { store }                               from './store/index.js';
import { prefs, syncPrefsWithStore }           from './store/preferences.js';
import { router }                              from './router/index.js';
import { Header }                              from './components/Header.js';
import { Footer }                              from './components/Footer.js';
import { PWAInstallBanner, registerSW }        from './components/PWAInstallBanner.js';

// ── Anti-FOUC ─────────────────────────────────────────────────
;(function() {
  try {
    const raw = JSON.parse(localStorage.getItem('aeropedia_prefs'));
    const t   = raw?.display?.theme || localStorage.getItem('aeropedia_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
    if (t === 'dark') document.body?.classList.add('dark');
    if (t === 'high-contrast') document.body?.classList.add('high-contrast');
    if (t !== 'light') document.documentElement.classList.add('dark-preload');
  } catch { document.documentElement.setAttribute('data-theme', 'dark'); }
})();

// ── Carga de datos (non-blocking, en background) ───────────────
async function loadCoreData() {
  const [aRes, cRes, kRes, fRes] = await Promise.all([
    fetch('./data/aircraft.json'),
    fetch('./data/conflicts.json'),
    fetch('./data/kills.json'),
    fetch('./data/fleets.json'),
  ]);

  if (!aRes.ok) throw new Error(`aircraft.json: HTTP ${aRes.status}`);
  if (!cRes.ok) throw new Error(`conflicts.json: HTTP ${cRes.status}`);

  const [aircraftDB, conflictsDB, killsDB, fleetsDB] = await Promise.all([
    aRes.json(),
    cRes.json(),
    kRes.ok ? kRes.json() : [],
    fRes.ok ? fRes.json() : [],
  ]);

  // Single dispatch → one render cycle
  store.dispatch({
    type: 'db/loaded',
    payload: { aircraftDB, conflictsDB, killsDB, fleetsDB },
  });
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

    .route('/help', async () => {
      const { HelpView } = await import('./views/HelpView.js');
      return new HelpView();
    }, { title: 'Ayuda — AeroPedia' })

    .route('/shared', async () => {
      const { SharedView } = await import('./views/SharedView.js');
      return new SharedView();
    }, { title: 'Colección compartida — AeroPedia' })

    .notFound(async () => ({
      render: () => {
        const el = document.createElement('div');
        el.className = 'not-found-view';
        const recents = (store.get('recents') || []).slice(0, 3);
        const db = store.get('aircraftDB') || [];
        const recentPlanes = recents.map(id => db.find(p => p.id === id)).filter(Boolean);
        el.innerHTML = `<div class="not-found-inner">
          <p class="not-found-code mono">404</p>
          <p class="not-found-title">Página no encontrada</p>
          <p class="not-found-sub">La ruta <code>${location.pathname}</code> no existe.</p>
          ${recentPlanes.length ? `
            <div class="not-found-recents">
              <p class="not-found-recents-label">Vistas recientemente:</p>
              ${recentPlanes.map(p => `
                <a href="/aircraft/${p.id}" data-link class="not-found-recent-item">
                  <img src="./public/min/${(p.img?.[0] ?? p.img)}.webp" alt="${p.name}" width="44" height="25"
                    style="object-fit:cover;border-radius:4px" onerror="this.style.display='none'">
                  <span>${p.name}</span>
                </a>`).join('')}
            </div>` : ''}
          <div style="display:flex;gap:.75rem;margin-top:1rem;justify-content:center;flex-wrap:wrap">
            <a href="/" data-link class="btn-back-home">← Volver al archivo</a>
            <button class="btn-back" onclick="history.back()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>
              Volver atrás
            </button>
          </div>
        </div>`;
        return el;
      },
      destroy() {},
    }));
}

// ── Sincronización multi-pestaña ──────────────────────────────
function initMultiTabSync() {
  window.addEventListener('storage', (e) => {
    if (e.key === 'aeropedia_favs' && e.newValue) {
      try {
        const newFavs = JSON.parse(e.newValue);
        if (JSON.stringify(newFavs) !== JSON.stringify(store.get('favs')))
          store.dispatch({ type: 'favs/syncExternal', payload: { favs: newFavs } });
      } catch {}
    }
    if (e.key === 'aeropedia_favs_meta' && e.newValue) {
      try { store.dispatch({ type: '__setState__', payload: { favsMeta: JSON.parse(e.newValue) } }); } catch {}
    }
    if (e.key === 'aeropedia_collections' && e.newValue) {
      try { store.dispatch({ type: '__setState__', payload: { collections: JSON.parse(e.newValue) } }); } catch {}
    }
  });
}

// ── Indicador offline ──────────────────────────────────────────
function initOfflineIndicator() {
  const show = () => {
    const el = document.getElementById('offline-indicator');
    if (el) el.hidden = navigator.onLine;
  };
  window.addEventListener('online', show);
  window.addEventListener('offline', show);
  show();
}

// ── Init ───────────────────────────────────────────────────────
async function init() {
  // 1. Prefs ↔ store
  syncPrefsWithStore(store);

  // 2. Multi-tab sync
  initMultiTabSync();

  // 3. Header + Footer (monta UI inmediatamente)
  const headerEl = document.getElementById('app-header');
  if (headerEl) headerEl.appendChild(new Header().render());

  const footerEl = document.getElementById('app-footer');
  if (footerEl) footerEl.appendChild(new Footer().render());

  // 4. Rutas registradas antes de init (para que el router funcione)
  registerRoutes();

  // 5. Router init → renderiza la vista actual (puede ser sin datos aún)
  await router.init();

  // 6. Carga de datos en BACKGROUND (no bloquea el primer render)
  loadCoreData().catch(err => {
    console.error('[AeroPedia] Error cargando datos:', err);
    // Mostrar error solo si la vista actual necesita los datos
    const outlet = document.getElementById('app-outlet');
    if (outlet && !store.get('aircraftDB')?.length) {
      outlet.innerHTML = `
        <div class="load-error" role="alert">
          <p class="load-error-title">Error al cargar la base de datos</p>
          <p class="load-error-msg">${err.message}</p>
          <p class="load-error-hint">Intenta recargar la página. Si usas el proyecto localmente: <code>npx serve .</code></p>
          <button onclick="location.reload()" class="btn-back" style="margin-top:1rem">↺ Recargar</button>
        </div>`;
    }
  });

  // 7. PWA
  await registerSW();
  const pwaBanner = new PWAInstallBanner();
  pwaBanner.init();

  // 8. Offline indicator
  initOfflineIndicator();

  // 9. Atajos globales
  document.addEventListener('keydown', (e) => {
    const tag    = document.activeElement?.tagName.toLowerCase();
    const typing = ['input', 'select', 'textarea'].includes(tag);
    if (typing) return;
    if (e.key === 'Escape' && store.get('currentRoute') !== '/') router.navigate('/');
    if (e.key === ',' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); router.navigate('/settings'); }
    if (e.key === 'm' || e.key === 'M') router.navigate('/mach');
    if (e.key === 's' || e.key === 'S') router.navigate('/stats');
    if (e.key === 't' || e.key === 'T') router.navigate('/theater');
  });
}

document.addEventListener('DOMContentLoaded', init);
