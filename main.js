/**
 * main.js — Bootstrap de AeroPedia SPA
 * History API routing, ES Modules, store global.
 */

import { store } from './store/index.js';
import { prefs, syncPrefsWithStore } from './store/preferences.js';
import { router } from './router/index.js';
import { Header } from './components/Header.js';

// ── Loader de datos ────────────────────────────────────────────
async function loadCoreData() {
  const [aircraftRes, conflictsRes] = await Promise.all([
    fetch('./data/aircraft.json'),
    fetch('./data/conflicts.json'),
  ]);

  if (!aircraftRes.ok || !conflictsRes.ok) {
    throw new Error('Error al cargar los datos base. Sirve el proyecto con un servidor HTTP (ej: npx serve .)');
  }

  const [aircraftDB, conflictsDB] = await Promise.all([
    aircraftRes.json(),
    conflictsRes.json(),
  ]);

  store.setState({ aircraftDB, conflictsDB });
}

// ── Registrar rutas (con dynamic import para lazy loading) ─────
function registerRoutes() {
  router
    .route('/', async () => {
      const { HomeView } = await import('./views/HomeView.js');
      return new HomeView();
    }, {
      title: 'AeroPedia — Archivo Global de Aviación',
      description: 'Enciclopedia interactiva de aviación militar: fichas técnicas, comparador y más.',
    })

    .route('/aircraft/:id', async (params) => {
      const { AircraftDetailView } = await import('./views/AircraftDetailView.js');
      return new AircraftDetailView();
    }, {
      title: 'Ficha técnica — AeroPedia',
    })

    .route('/compare', async () => {
      const { CompareView } = await import('./views/CompareView.js');
      return new CompareView();
    }, {
      title: 'Comparador — AeroPedia',
    })

    .route('/kills', async () => {
      const { KillsView } = await import('./views/KillsView.js');
      return new KillsView();
    }, {
      title: 'Historial de Combate — AeroPedia',
    })

    .route('/fleets', async () => {
      const { FleetsView } = await import('./views/FleetsView.js');
      return new FleetsView();
    }, {
      title: 'Flotas Aéreas — AeroPedia',
    })

    .route('/mach', async () => {
      const { MachView } = await import('./views/MachView.js');
      return new MachView();
    }, {
      title: 'Calculadora Mach — AeroPedia',
    })

    .route('/favorites', async () => {
      const { FavoritesView } = await import('./views/FavoritesView.js');
      return new FavoritesView();
    }, {
      title: 'Mis Favoritos — AeroPedia',
    })


    .notFound(async () => ({
      render: () => {
        const el = document.createElement('div');
        el.className = 'not-found-view';
        el.innerHTML = `
          <div class="not-found-inner">
            <p class="not-found-code mono">404</p>
            <p class="not-found-title">Página no encontrada</p>
            <a href="/" data-link class="btn-back-home">← Volver al archivo</a>
          </div>`;
        return el;
      },
    }));
}

// ── Aplicar tema inmediatamente (antes del render) ─────────────
function applyInitialTheme() {
  const theme = store.get('theme');
  document.documentElement.setAttribute('data-theme', theme);
  document.body.classList.toggle('dark', theme === 'dark');
  store.subscribe('theme', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.toggle('dark', theme === 'dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a0f1e' : '#f8fafc');
  });
}

// ── Init ───────────────────────────────────────────────────────
async function init() {
  applyInitialTheme();
  syncPrefsWithStore(store);

  // Montar header
  const headerContainer = document.getElementById('app-header');
  if (headerContainer) {
    const header = new Header();
    headerContainer.appendChild(header.render());
  }

  // Mostrar skeleton mientras cargan datos
  const outlet = document.getElementById('app-outlet');
  if (outlet) {
    outlet.innerHTML = `
      <div class="init-loading" role="status" aria-live="polite">
        <div class="init-loading-inner">
          <div class="init-spinner" aria-hidden="true"></div>
          <p class="init-loading-text mono">Cargando base de datos…</p>
        </div>
      </div>`;
  }

  try {
    await loadCoreData();
  } catch (err) {
    console.error('[AeroPedia] Error de carga:', err);
    if (outlet) {
      outlet.innerHTML = `
        <div class="load-error" role="alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 15.75h.007v.008H12v-.008z"/>
          </svg>
          <p class="load-error-title">Error al cargar la base de datos</p>
          <p class="load-error-msg">${err.message}</p>
          <p class="load-error-hint">
            Sirve el proyecto con un servidor HTTP:
            <code>npx serve .</code> o <code>python -m http.server</code>
          </p>
        </div>`;
    }
    return;
  }

  // Registrar e inicializar router
  registerRoutes();
  await router.init();

  // Keyboard shortcuts globales
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName.toLowerCase();
    if (['input', 'select', 'textarea'].includes(tag)) return;
    if (e.key === 'Escape') {
      const route = store.get('currentRoute');
      if (route !== '/') router.navigate('/');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
