/**
 * store/preferences.js — Gestor de preferencias del usuario
 *
 * Separado del store global para responsabilidad única.
 * Todas las preferencias se persisten en localStorage bajo
 * una única clave versionada: "aeropedia_prefs".
 *
 * Estructura:
 *   aeropedia_prefs: {
 *     _version: string,
 *     display:  DisplayPrefs,
 *     filters:  FilterPrefs,
 *     favs:     FavsPrefs,
 *     theater:  TheaterPrefs,
 *     pwa:      PwaPrefs,
 *     a11y:     A11yPrefs,
 *   }
 */

const PREFS_KEY     = 'aeropedia_prefs';
const SCHEMA_VERSION = '1.1.0';

// ── Valores por defecto ──────────────────────────────────────────
const DEFAULTS = Object.freeze({
  _version: SCHEMA_VERSION,

  /** Apariencia y presentación visual */
  display: {
    theme:            'dark',          // 'dark' | 'light' | 'high-contrast'
    cardDensity:      'normal',        // 'compact' | 'normal' | 'large'
    galleryColumns:   'auto',          // 'auto' | 2 | 3 | 4
    animationsEnabled: true,           // false → reduce-motion override
    fontScale:        1,               // 0.9 | 1 | 1.1 | 1.2
    imageQuality:     'auto',          // 'auto' | 'low' | 'high'
    showStatBars:     true,            // barras de velocidad/techo/alcance en cards
  },

  /** Comportamiento de filtros y navegación */
  filters: {
    rememberFilters:  true,            // restaurar filtros al regresar
    lastCat:          'all',           // última categoría activa
    lastView:         'gallery',       // 'gallery' | 'ranking'
    lastSortStat:     'speed',         // campo de ordenación en ranking
    lastSortAsc:      false,
    timelineMin:      1940,
    timelineMax:      2030,
    defaultHomepage:  '/',             // ruta que abre al arrancar
  },

  /** Preferencias de la vista de favoritos */
  favs: {
    defaultSortBy:    'addedAt',       // ordenación por defecto en FavoritesView
    defaultSortAsc:   false,
    tableColumns:     ['speed','range','ceiling','mtow'], // columnas visibles en tabla
    cardLayout:       'normal',        // 'normal' | 'compact' | 'table'
    showCharts:       true,            // mostrar gráficos de composición
    confirmOnRemove:  false,           // pedir confirmación al quitar un favorito
  },

  /** Teatro de operaciones */
  theater: {
    lastConflict:     null,            // ID del último conflicto visto
    lastEra:          'all',           // era seleccionada ('wwii', 'coldwar', etc.)
    showLegend:       true,
  },

  /** PWA / instalación */
  pwa: {
    installDismissed: false,           // no mostrar banner de instalación
    visitCount:       0,               // número de visitas (para mostrar banner en 2ª)
    lastVisit:        null,            // timestamp de última visita
  },

  /** Accesibilidad */
  a11y: {
    highContrast:     false,           // alias de display.theme === 'high-contrast'
    keyboardHints:    true,            // mostrar atajos de teclado en tooltips
    focusRingAlways:  false,           // mostrar focus ring siempre (no solo con teclado)
    announceRoutes:   true,            // aria-live en cambios de ruta
  },
});

// ── Migraciones de esquema ───────────────────────────────────────
const MIGRATIONS = {
  // '1.0.0' → '1.1.0': añade display.fontScale y a11y.focusRingAlways
  '1.0.0': (prefs) => ({
    ...prefs,
    display: { fontScale: 1, imageQuality: 'auto', showStatBars: true, ...prefs.display },
    a11y:    { focusRingAlways: false, announceRoutes: true, ...prefs.a11y },
    _version: '1.1.0',
  }),
};

// ── Utilidades localStorage ──────────────────────────────────────
function loadRaw() {
  try   { return JSON.parse(localStorage.getItem(PREFS_KEY)); }
  catch { return null; }
}

function saveRaw(data) {
  try   { localStorage.setItem(PREFS_KEY, JSON.stringify(data)); }
  catch (e) { console.warn('[Prefs] No se pudo guardar en localStorage:', e.message); }
}

// Deep merge: los valores guardados sobreescriben los defaults
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] ?? {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// ── Clase PreferencesManager ─────────────────────────────────────
class PreferencesManager {
  #prefs;
  #listeners   = new Map();   // section → Set<callback>
  #saveTimeout = null;

  constructor() {
    this.#prefs = this.#load();
    this.#trackVisit();
    this.#listenStorageEvents();
  }

  // ── Carga con migración ────────────────────────────────────────
  #load() {
    const raw = loadRaw();

    if (!raw) return deepMerge(DEFAULTS, {});

    let migrated = raw;
    let version  = raw._version || '1.0.0';

    // Aplicar migraciones en cadena
    while (MIGRATIONS[version]) {
      console.info(`[Prefs] Migrando ${version} → ${MIGRATIONS[version]({})._version}`);
      migrated = MIGRATIONS[version](migrated);
      version  = migrated._version;
    }

    // Merge con defaults para añadir claves nuevas sin romper las guardadas
    return deepMerge(DEFAULTS, migrated);
  }

  // ── Guardar con debounce ───────────────────────────────────────
  #scheduleSave() {
    clearTimeout(this.#saveTimeout);
    this.#saveTimeout = setTimeout(() => saveRaw(this.#prefs), 300);
  }

  // ── Visita ────────────────────────────────────────────────────
  #trackVisit() {
    const pwa = this.#prefs.pwa;
    this.#prefs.pwa = {
      ...pwa,
      visitCount: (pwa.visitCount || 0) + 1,
      lastVisit:  Date.now(),
    };
    this.#scheduleSave();
  }

  // ── Sincronización multi-pestaña ───────────────────────────────
  #listenStorageEvents() {
    window.addEventListener('storage', (e) => {
      if (e.key !== PREFS_KEY || !e.newValue) return;
      try {
        const incoming = JSON.parse(e.newValue);
        this.#prefs    = deepMerge(DEFAULTS, incoming);
        this.#notifyAll();
      } catch {}
    });
  }

  // ── API pública ────────────────────────────────────────────────

  /** Devuelve una sección completa */
  getSection(section) {
    return { ...this.#prefs[section] };
  }

  /** Lee una preferencia puntual */
  get(section, key) {
    return this.#prefs[section]?.[key];
  }

  /**
   * Actualiza una o varias preferencias de una sección.
   * @param {string} section - 'display' | 'filters' | 'favs' | etc.
   * @param {object} patch
   */
  set(section, patch) {
    if (!(section in this.#prefs)) {
      console.warn(`[Prefs] Sección desconocida: "${section}"`);
      return;
    }
    this.#prefs[section] = { ...this.#prefs[section], ...patch };
    this.#scheduleSave();
    this.#notify(section);
  }

  /** Atajo para actualizar una sola clave */
  setOne(section, key, value) {
    this.set(section, { [key]: value });
  }

  /** Resetea una sección a sus valores por defecto */
  resetSection(section) {
    if (!(section in DEFAULTS)) return;
    this.#prefs[section] = { ...DEFAULTS[section] };
    this.#scheduleSave();
    this.#notify(section);
  }

  /** Resetea TODAS las preferencias a los valores por defecto */
  resetAll() {
    this.#prefs = deepMerge(DEFAULTS, {});
    saveRaw(this.#prefs); // guardado inmediato en reset total
    this.#notifyAll();
  }

  /**
   * Exporta todas las preferencias como JSON string.
   * @returns {string}
   */
  export() {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      app:        'AeroPedia',
      prefs:      this.#prefs,
    }, null, 2);
  }

  /**
   * Importa preferencias desde un JSON string.
   * @param {string} jsonStr
   * @returns {{ ok: boolean, error?: string }}
   */
  import(jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      const data   = parsed.prefs ?? parsed; // soporta el formato exportado o raw
      if (typeof data !== 'object') throw new Error('Formato inválido');
      this.#prefs = deepMerge(DEFAULTS, data);
      this.#prefs._version = SCHEMA_VERSION; // normalizar versión
      saveRaw(this.#prefs);
      this.#notifyAll();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── Suscripciones ──────────────────────────────────────────────
  /**
   * Suscribirse a cambios de una sección.
   * @param {string} section
   * @param {Function} cb - (newSection) => void
   * @returns {Function} unsubscribe
   */
  subscribe(section, cb) {
    if (!this.#listeners.has(section)) this.#listeners.set(section, new Set());
    this.#listeners.get(section).add(cb);
    return () => this.#listeners.get(section)?.delete(cb);
  }

  /** Suscribirse a cualquier cambio */
  subscribeAll(cb) {
    return this.subscribe('*', cb);
  }

  #notify(section) {
    const sectionListeners = this.#listeners.get(section);
    if (sectionListeners) {
      const data = this.getSection(section);
      for (const cb of sectionListeners) cb(data);
    }
    const allListeners = this.#listeners.get('*');
    if (allListeners) {
      for (const cb of allListeners) cb(section, this.getSection(section));
    }
  }

  #notifyAll() {
    const sections = Object.keys(DEFAULTS).filter(k => k !== '_version');
    for (const s of sections) this.#notify(s);
  }

  // ── Helpers de dominio ─────────────────────────────────────────

  /** ¿Mostrar banner de instalación PWA? */
  shouldShowInstallBanner() {
    const { installDismissed, visitCount } = this.#prefs.pwa;
    return !installDismissed && visitCount >= 2;
  }

  /** Marcar banner de instalación como descartado */
  dismissInstallBanner() {
    this.set('pwa', { installDismissed: true });
  }

  /** ¿Animaciones activas? (respetando prefers-reduced-motion del OS) */
  animationsEnabled() {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const userOverride   = this.#prefs.display.animationsEnabled;
    // El usuario puede forzar animaciones incluso si el OS dice reduce-motion
    return prefersReduced ? userOverride === true : userOverride !== false;
  }

  /** Devuelve las clases CSS del tema actual */
  getThemeClass() {
    const theme = this.#prefs.display.theme;
    return theme === 'dark' ? 'dark' : theme === 'high-contrast' ? 'high-contrast' : '';
  }

  /** Devuelve el atributo data-theme */
  getThemeAttr() {
    return this.#prefs.display.theme;
  }
}

// ── Exportar instancia singleton ─────────────────────────────────
export const prefs = new PreferencesManager();

// ── Integración con el store global ──────────────────────────────
// Conecta el tema del PreferencesManager con el store para
// que el header y otros componentes reaccionen correctamente.
export function syncPrefsWithStore(store) {
  // Tema inicial
  const theme = prefs.get('display', 'theme');
  store.setState({ theme });

  // Cuando el store cambia el tema (toggle del header), actualizar prefs
  store.subscribe('theme', (newTheme) => {
    prefs.setOne('display', 'theme', newTheme);
  });

  // Cuando las prefs cambian el tema (desde Settings), actualizar store
  prefs.subscribe('display', (display) => {
    if (display.theme !== store.get('theme')) {
      store.setState({ theme: display.theme });
    }
  });

  // Restaurar filtros si el usuario lo prefiere
  if (prefs.get('filters', 'rememberFilters')) {
    const f = prefs.getSection('filters');
    store.setState({
      cat:      f.lastCat     || 'all',
      view:     f.lastView    || 'gallery',
      sortStat: f.lastSortStat|| 'speed',
      sortAsc:  f.lastSortAsc ?? false,
    });
  }

  // Guardar filtros cuando cambien en el store
  store.subscribe(['cat', 'view', 'sortStat', 'sortAsc'], (_, __, state) => {
    if (prefs.get('filters', 'rememberFilters')) {
      prefs.set('filters', {
        lastCat:     state.cat,
        lastView:    state.view,
        lastSortStat:state.sortStat,
        lastSortAsc: state.sortAsc,
      });
    }
  });

  // Aplicar fontScale al :root
  const applyFontScale = (scale) => {
    document.documentElement.style.fontSize = `${scale * 16}px`;
  };
  applyFontScale(prefs.get('display', 'fontScale') || 1);
  prefs.subscribe('display', (d) => applyFontScale(d.fontScale || 1));

  // Aplicar animaciones
  const applyAnimations = () => {
    document.documentElement.classList.toggle('no-animations', !prefs.animationsEnabled());
  };
  applyAnimations();
  prefs.subscribe('display', applyAnimations);
}
