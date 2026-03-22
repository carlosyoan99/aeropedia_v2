/**
 * store/index.js — Estado global centralizado con Observer Pattern
 * Persistencia en localStorage. Sistema de favoritos enriquecido.
 */

// ── Helpers localStorage ───────────────────────────────────────
function loadLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function saveLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ── Estado inicial ─────────────────────────────────────────────
const initialState = {
  // Datos
  aircraftDB:  [],
  conflictsDB: {},
  fleetsDB:    [],
  killsDB:     [],

  // UI
  theme:         loadLS('aeropedia_theme', 'dark'),
  view:          'gallery',
  currentRoute:  '/',

  // Filtros globales
  search:        '',
  cat:           'all',
  onlyFavs:      false,
  activeConflict:'all',

  // ── FAVORITOS ──────────────────────────────────────────────
  // favs: string[]  — IDs en orden de inserción
  favs:     loadLS('aeropedia_favs', []),
  /**
   * favsMeta: Record<id, FavMeta>
   * FavMeta {
   *   note:     string        — nota personal libre
   *   tags:     string[]      — etiquetas propias ('#favorito', '#pendiente', ...)
   *   pinned:   boolean       — fijado en la cima de la lista
   *   rating:   0|1|2|3|4|5  — valoración personal
   *   addedAt:  number        — timestamp ms
   *   updatedAt:number        — último edit
   * }
   */
  favsMeta: loadLS('aeropedia_favs_meta', {}),

  // Filtros internos de la vista Favoritos
  favsSearch:    '',
  favsSortBy:    'addedAt',   // 'addedAt' | 'name' | 'rating' | 'year' | 'pinned'
  favsSortAsc:   false,
  favsFilterTag: 'all',       // 'all' | cualquier tag

  // Timeline
  timelineOpen:   false,
  timelineActive: false,
  timelineMin:    1940,
  timelineMax:    2030,

  // Comparador
  compareList: [],

  // Ranking
  sortStat: 'speed',
  sortAsc:  false,

  // Estado de carga
  loading: false,
  error:   null,
};

class Store {
  #state;
  #listeners = new Map();

  constructor(initial) {
    this.#state = { ...initial };
  }

  getState() { return { ...this.#state }; }
  get(key)   { return this.#state[key]; }

  setState(patch) {
    const prev = { ...this.#state };
    this.#state = { ...this.#state, ...patch };
    this.#persist(patch);
    this.#notify(patch, prev);
  }

  subscribe(keys, cb) {
    const list = Array.isArray(keys) ? keys : [keys];
    const id = Symbol();
    for (const k of list) {
      if (!this.#listeners.has(k)) this.#listeners.set(k, new Map());
      this.#listeners.get(k).set(id, cb);
    }
    return () => { for (const k of list) this.#listeners.get(k)?.delete(id); };
  }

  subscribeAll(cb) {
    const id = Symbol();
    if (!this.#listeners.has('*')) this.#listeners.set('*', new Map());
    this.#listeners.get('*').set(id, cb);
    return () => this.#listeners.get('*')?.delete(id);
  }

  // ── Persistencia ─────────────────────────────────────────────
  #persist(patch) {
    if ('theme'    in patch) saveLS('aeropedia_theme',     this.#state.theme);
    if ('favs'     in patch) saveLS('aeropedia_favs',      this.#state.favs);
    if ('favsMeta' in patch) saveLS('aeropedia_favs_meta', this.#state.favsMeta);
  }

  #notify(patch, prev) {
    const changed = Object.keys(patch);
    for (const k of changed) {
      const map = this.#listeners.get(k);
      if (map) for (const [, cb] of map) cb(this.#state[k], prev[k], this.#state);
    }
    const all = this.#listeners.get('*');
    if (all) for (const [, cb] of all) cb({ ...this.#state }, changed);
  }

  // ── Tema ─────────────────────────────────────────────────────
  toggleTheme() {
    this.setState({ theme: this.#state.theme === 'dark' ? 'light' : 'dark' });
  }

  // ── Favoritos básicos ─────────────────────────────────────────
  isFav(id) { return this.#state.favs.includes(id); }

  toggleFav(id) {
    const favs    = [...this.#state.favs];
    const meta    = { ...this.#state.favsMeta };
    const idx     = favs.indexOf(id);

    if (idx >= 0) {
      favs.splice(idx, 1);
      delete meta[id];
    } else {
      favs.push(id);
      meta[id] = {
        note:      '',
        tags:      [],
        pinned:    false,
        rating:    0,
        addedAt:   Date.now(),
        updatedAt: Date.now(),
      };
    }
    this.setState({ favs, favsMeta: meta });
  }

  // ── Metadatos de favorito ──────────────────────────────────────
  getFavMeta(id) {
    return this.#state.favsMeta[id] ?? null;
  }

  /**
   * Actualiza campos parciales de la meta de un favorito.
   * @param {string} id
   * @param {Partial<FavMeta>} patch
   */
  updateFavMeta(id, patch) {
    if (!this.#state.favs.includes(id)) return;
    const meta = { ...this.#state.favsMeta };
    meta[id] = { ...meta[id], ...patch, updatedAt: Date.now() };
    this.setState({ favsMeta: meta });
  }

  /** Añade o elimina una tag de un favorito */
  toggleFavTag(id, tag) {
    const m    = this.getFavMeta(id);
    if (!m) return;
    const tags = m.tags.includes(tag)
      ? m.tags.filter(t => t !== tag)
      : [...m.tags, tag];
    this.updateFavMeta(id, { tags });
  }

  /** Fija/desfija un favorito en la cima de la lista */
  toggleFavPin(id) {
    const m = this.getFavMeta(id);
    if (!m) return;
    this.updateFavMeta(id, { pinned: !m.pinned });
  }

  /** Cambia la valoración personal (0–5) */
  setFavRating(id, rating) {
    this.updateFavMeta(id, { rating: Math.max(0, Math.min(5, rating)) });
  }

  /** Reordena un favorito (mueve de fromIdx a toIdx) */
  reorderFav(fromIdx, toIdx) {
    const favs = [...this.#state.favs];
    const [item] = favs.splice(fromIdx, 1);
    favs.splice(toIdx, 0, item);
    this.setState({ favs });
  }

  /**
   * Devuelve todas las tags únicas usadas en los favoritos.
   * @returns {string[]}
   */
  getAllFavTags() {
    const tags = new Set();
    for (const meta of Object.values(this.#state.favsMeta)) {
      for (const t of (meta.tags || [])) tags.add(t);
    }
    return [...tags].sort();
  }

  /**
   * Devuelve los favoritos filtrados y ordenados según el estado interno.
   * @returns {Array<{plane, meta}>}
   */
  getFilteredFavs() {
    const { favs, favsMeta, aircraftDB, favsSearch, favsSortBy, favsSortAsc, favsFilterTag } = this.#state;

    const q = favsSearch.toLowerCase().trim();

    let list = favs
      .map(id => ({ plane: aircraftDB.find(p => p.id === id), meta: favsMeta[id] || {} }))
      .filter(({ plane }) => !!plane)
      .filter(({ plane }) => !q || plane.name.toLowerCase().includes(q) || plane.country.toLowerCase().includes(q) || plane.type.toLowerCase().includes(q))
      .filter(({ meta }) => favsFilterTag === 'all' || (meta.tags || []).includes(favsFilterTag));

    list.sort((a, b) => {
      // Siempre pinned primero
      if (a.meta.pinned !== b.meta.pinned) return a.meta.pinned ? -1 : 1;

      let va, vb;
      switch (favsSortBy) {
        case 'name':    va = a.plane.name;   vb = b.plane.name; break;
        case 'rating':  va = a.meta.rating || 0; vb = b.meta.rating || 0; break;
        case 'year':    va = a.plane.year;   vb = b.plane.year; break;
        case 'speed':   va = a.plane.speed;  vb = b.plane.speed; break;
        default:        va = a.meta.addedAt || 0; vb = b.meta.addedAt || 0;
      }
      if (typeof va === 'string') return favsSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return favsSortAsc ? va - vb : vb - va;
    });

    return list;
  }

  /** Exporta favoritos como JSON descargable */
  exportFavs() {
    const { favs, favsMeta, aircraftDB } = this.#state;
    const data = favs.map(id => {
      const plane = aircraftDB.find(p => p.id === id);
      return { id, name: plane?.name, type: plane?.type, country: plane?.country, year: plane?.year, meta: favsMeta[id] };
    });
    return JSON.stringify({ exportedAt: new Date().toISOString(), count: data.length, favs: data }, null, 2);
  }

  // ── Comparador ────────────────────────────────────────────────
  toggleCompare(id) {
    const list = [...this.#state.compareList];
    const idx  = list.indexOf(id);
    if (idx >= 0) list.splice(idx, 1);
    else if (list.length < 3) list.push(id);
    this.setState({ compareList: list });
  }
  clearCompare() { this.setState({ compareList: [] }); }
}

export const store = new Store(initialState);
