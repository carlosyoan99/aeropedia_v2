/**
 * main.js — Bootstrap de AeroPedia SPA
 * History API routing, ES Modules, store global.
 */

import { store }                           from './store/index.js';
import { prefs, syncPrefsWithStore, applyThemeToDom } from './store/preferences.js';
import { router }                          from './router/index.js';
import { Header }                          from './components/Header.js';

// ── Tema inmediato (anti-FOUC) ─────────────────────────────────
(function applyEarlyTheme() {
  const theme = (() => {
    try {
      const raw = JSON.parse(localStorage.getItem('aeropedia_prefs'));
      return raw?.display?.theme || localStorage.getItem('aeropedia_theme') || 'dark';
    } catch { return 'dark'; }
  })();
  applyThemeToDom(theme);
})();

// ── Carga de datos ─────────────────────────────────────────────
async function loadCoreData() {
  const [aRes, cRes] = await Promise.all([
    fetch('./data/aircraft.json'),
    fetch('./data/conflicts.json'),
  ]);
  if (!aRes.ok || !cRes.ok)
    throw new Error('No se pudieron cargar los datos. Usa un servidor HTTP (npx serve .)');
  const [aircraftDB, conflictsDB] = await Promise.all([aRes.json(), cRes.json()]);
  store.setState({ aircraftDB, conflictsDB });
}

// ── Rutas (dynamic import para lazy loading) ───────────────────
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

    .notFound(async () => ({
      render: () => {
        const el = document.createElement('div');
        el.className = 'not-found-view';
        el.innerHTML = `<div class="not-found-inner">
          <p class="not-found-code mono">404</p>
          <p class="not-found-title">Página no encontrada</p>
          <a href="/" data-link class="btn-back-home">← Volver al archivo</a>
        </div>`;
        return el;
      },
    }));
}

// ── Inicialización ─────────────────────────────────────────────
async function init() {
  // 1. Conectar prefs ↔ store (tema, filtros, densidad, fontScale, animaciones)
  syncPrefsWithStore(store);

  // 2. Montar header
  const headerEl = document.getElementById('app-header');
  if (headerEl) {
    const header = new Header();
    headerEl.appendChild(header.render());
  }

  // 3. Announcer para lectores de pantalla (aria-live)
  const announcer = document.getElementById('route-announcer');

  // 4. Skeleton de carga
  const outlet = document.getElementById('app-outlet');
  if (outlet) outlet.innerHTML = `
    <div class="init-loading" role="status" aria-live="polite">
      <div class="init-loading-inner">
        <div class="init-spinner" aria-hidden="true"></div>
        <p class="init-loading-text mono">Cargando base de datos…</p>
      </div>
    </div>`;

  // 5. Cargar datos
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

  // 6. Registrar rutas e inicializar router
  registerRoutes();

  // 7. Hook: anunciar ruta a lectores de pantalla
  if (prefs.get('a11y', 'announceRoutes') && announcer) {
    router.beforeEach((path) => {
      const title = document.title || path;
      announcer.textContent = `Navegando a: ${title}`;
      setTimeout(() => { announcer.textContent = ''; }, 1000);
    });
  }

  await router.init();

  // 8. Atajos de teclado globales
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName.toLowerCase();
    if (['input', 'select', 'textarea'].includes(tag)) return;
    if (e.key === 'Escape' && store.get('currentRoute') !== '/') router.navigate('/');
    if ((e.key === ',' || e.key === '<') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      router.navigate('/settings');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
