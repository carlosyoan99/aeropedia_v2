/**
 * store/preferences.js — Gestor de preferencias del usuario
 * Clave localStorage: "aeropedia_prefs" (objeto versionado)
 *
 * Secciones:
 *   display  → tema, densidad, columnas, animaciones, fontScale
 *   filters  → restaurar filtros, última cat/vista/sort
 *   favs     → ordenación, layout, columnas tabla, confirmación
 *   theater  → último conflicto, era, leyenda
 *   pwa      → dismissed, visitCount, lastVisit
 *   a11y     → keyboardHints, focusRingAlways, announceRoutes
 */

const PREFS_KEY      = 'aeropedia_prefs';
const SCHEMA_VERSION = '1.2.0';

// ── Defaults ───────────────────────────────────────────────────
export const DEFAULTS = Object.freeze({
  _version: SCHEMA_VERSION,

  display: {
    theme:             'dark',     // 'dark' | 'light' | 'high-contrast'
    cardDensity:       'normal',   // 'compact' | 'normal' | 'large'
    galleryColumns:    'auto',     // 'auto' | 2 | 3 | 4
    animationsEnabled: true,       // false → override reduce-motion
    fontScale:         1,          // 0.85 | 0.9 | 1 | 1.1 | 1.2
    showStatBars:      true,       // barras en cards
  },

  filters: {
    rememberFilters: true,
    lastCat:         'all',
    lastView:        'gallery',
    lastSortStat:    'speed',
    lastSortAsc:     false,
    timelineMin:     1940,
    timelineMax:     2030,
  },

  favs: {
    defaultSortBy:   'addedAt',
    defaultSortAsc:  false,
    tableColumns:    ['speed', 'range', 'ceiling', 'mtow'],
    cardLayout:      'normal',   // 'normal' | 'compact' | 'table'
    showCharts:      true,
    confirmOnRemove: false,
  },

  theater: {
    lastConflict: null,
    lastEra:      'all',
    showLegend:   true,
  },

  pwa: {
    installDismissed: false,
    visitCount:       0,
    lastVisit:        null,
  },

  a11y: {
    keyboardHints:   true,
    focusRingAlways: false,
    announceRoutes:  true,
  },
});

// ── Migraciones de esquema ─────────────────────────────────────
const MIGRATIONS = {
  '1.0.0': (p) => ({ ...p,
    display: { fontScale: 1, showStatBars: true, ...p.display },
    a11y: { keyboardHints: true, focusRingAlways: false, announceRoutes: true, ...p.a11y },
    _version: '1.1.0',
  }),
  '1.1.0': (p) => ({ ...p,
    filters: { timelineMin: 1940, timelineMax: 2030, ...p.filters },
    favs: { confirmOnRemove: false, ...p.favs },
    _version: '1.2.0',
  }),
};

// ── Helpers ────────────────────────────────────────────────────
function loadRaw() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY)); } catch { return null; }
}
function saveRaw(data) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(data)); } catch {}
}
function deepMerge(target, source) {
  const result = { ...target };
  for (const [k, v] of Object.entries(source ?? {})) {
    result[k] = (v !== null && typeof v === 'object' && !Array.isArray(v))
      ? deepMerge(target[k] ?? {}, v)
      : v;
  }
  return result;
}

// ── PreferencesManager ─────────────────────────────────────────
class PreferencesManager {
  #prefs;
  #listeners   = new Map();
  #saveTimeout = null;

  constructor() {
    this.#prefs = this.#load();
    this.#trackVisit();
    this.#watchStorage();
  }

  // ── Carga con migración ──────────────────────────────────────
  #load() {
    const raw = loadRaw();
    if (!raw) return deepMerge(DEFAULTS, {});

    let data    = raw;
    let version = data._version || '1.0.0';
    while (MIGRATIONS[version]) {
      data    = MIGRATIONS[version](data);
      version = data._version;
    }
    return deepMerge(DEFAULTS, data);
  }

  // ── Escritura con debounce 300ms ─────────────────────────────
  #scheduleSave() {
    clearTimeout(this.#saveTimeout);
    this.#saveTimeout = setTimeout(() => saveRaw(this.#prefs), 300);
  }

  // ── Contador de visitas ──────────────────────────────────────
  #trackVisit() {
    this.#prefs.pwa = {
      ...this.#prefs.pwa,
      visitCount: (this.#prefs.pwa.visitCount || 0) + 1,
      lastVisit:  Date.now(),
    };
    this.#scheduleSave();
  }

  // ── Sincronización multi-pestaña ─────────────────────────────
  #watchStorage() {
    window.addEventListener('storage', (e) => {
      if (e.key !== PREFS_KEY || !e.newValue) return;
      try {
        this.#prefs = deepMerge(DEFAULTS, JSON.parse(e.newValue));
        this.#notifyAll();
      } catch {}
    });
  }

  // ── API pública ──────────────────────────────────────────────
  getSection(section) { return { ...this.#prefs[section] }; }
  get(section, key)   { return this.#prefs[section]?.[key]; }

  set(section, patch) {
    if (!(section in this.#prefs)) return;
    this.#prefs[section] = { ...this.#prefs[section], ...patch };
    this.#scheduleSave();
    this.#notify(section);
  }

  setOne(section, key, value) { this.set(section, { [key]: value }); }

  resetSection(section) {
    if (!(section in DEFAULTS)) return;
    this.#prefs[section] = { ...DEFAULTS[section] };
    this.#scheduleSave();
    this.#notify(section);
  }

  resetAll() {
    this.#prefs = deepMerge(DEFAULTS, { _version: SCHEMA_VERSION });
    saveRaw(this.#prefs);
    this.#notifyAll();
  }

  // Exportar / importar
  export() {
    return JSON.stringify({ exportedAt: new Date().toISOString(), app: 'AeroPedia', prefs: this.#prefs }, null, 2);
  }

  import(jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      const data   = parsed.prefs ?? parsed;
      if (typeof data !== 'object') throw new Error('Formato inválido');
      this.#prefs = deepMerge(DEFAULTS, { ...data, _version: SCHEMA_VERSION });
      saveRaw(this.#prefs);
      this.#notifyAll();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── Suscripciones ────────────────────────────────────────────
  subscribe(section, cb) {
    if (!this.#listeners.has(section)) this.#listeners.set(section, new Set());
    this.#listeners.get(section).add(cb);
    return () => this.#listeners.get(section)?.delete(cb);
  }

  #notify(section) {
    this.#listeners.get(section)?.forEach(cb => cb(this.getSection(section)));
    this.#listeners.get('*')?.forEach(cb => cb(section, this.getSection(section)));
  }

  #notifyAll() {
    for (const s of Object.keys(DEFAULTS).filter(k => k !== '_version')) this.#notify(s);
  }

  // ── Helpers de dominio ───────────────────────────────────────
  shouldShowInstallBanner() {
    const { installDismissed, visitCount } = this.#prefs.pwa;
    return !installDismissed && visitCount >= 2;
  }
  dismissInstallBanner() { this.set('pwa', { installDismissed: true }); }

  animationsEnabled() {
    const osReduces = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return osReduces ? this.#prefs.display.animationsEnabled === true : this.#prefs.display.animationsEnabled !== false;
  }

  getThemeAttr() { return this.#prefs.display.theme; }
}

export const prefs = new PreferencesManager();

// ── Sincronización prefs ↔ store ───────────────────────────────
export function syncPrefsWithStore(store) {
  // 1. Aplicar tema inicial desde prefs
  const savedTheme = prefs.get('display', 'theme');
  if (savedTheme !== store.get('theme')) store.setState({ theme: savedTheme });

  // 2. Store → prefs cuando cambia el tema desde el header
  store.subscribe('theme', (theme) => {
    if (theme !== prefs.get('display', 'theme')) prefs.setOne('display', 'theme', theme);
    applyThemeToDom(theme);
  });

  // 3. Prefs → store cuando cambia desde Settings
  prefs.subscribe('display', (display) => {
    if (display.theme !== store.get('theme')) store.setState({ theme: display.theme });
    applyThemeToDom(display.theme);
    applyFontScale(display.fontScale);
    applyAnimations(display.animationsEnabled);
    applyDensity(display.cardDensity);
  });

  // 4. Restaurar filtros si está activo
  if (prefs.get('filters', 'rememberFilters')) {
    const f = prefs.getSection('filters');
    store.setState({
      cat:      f.lastCat      || 'all',
      view:     f.lastView     || 'gallery',
      sortStat: f.lastSortStat || 'speed',
      sortAsc:  f.lastSortAsc  ?? false,
    });
  }

  // 5. Guardar filtros cuando cambian en store
  store.subscribe(['cat', 'view', 'sortStat', 'sortAsc'], (_, __, state) => {
    if (prefs.get('filters', 'rememberFilters')) {
      prefs.set('filters', {
        lastCat:      state.cat,
        lastView:     state.view,
        lastSortStat: state.sortStat,
        lastSortAsc:  state.sortAsc,
      });
    }
  });

  // 6. Aplicar preferencias de display al DOM
  applyFontScale(prefs.get('display', 'fontScale'));
  applyAnimations(prefs.get('display', 'animationsEnabled'));
  applyDensity(prefs.get('display', 'cardDensity'));

  // 7. A11y: focus ring siempre visible
  applyFocusRing(prefs.get('a11y', 'focusRingAlways'));
  prefs.subscribe('a11y', (a11y) => applyFocusRing(a11y.focusRingAlways));
}

// ── Aplicadores DOM ────────────────────────────────────────────
export function applyThemeToDom(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.body.classList.toggle('dark', theme === 'dark' || theme === 'high-contrast');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' || theme === 'high-contrast' ? '#090d1a' : '#f8fafc');
}

export function applyFontScale(scale = 1) {
  document.documentElement.style.fontSize = `${scale * 16}px`;
}

export function applyAnimations(enabled) {
  document.documentElement.classList.toggle('no-animations', !enabled);
}

export function applyDensity(density = 'normal') {
  document.documentElement.setAttribute('data-density', density);
}

export function applyFocusRing(always = false) {
  document.documentElement.classList.toggle('focus-ring-always', always);
}
