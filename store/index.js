/**
 * store/index.js  — Redux-lite Store
 *
 * Arquitectura:
 *   dispatch(action) → reducer(state, action) → #notify(changed)
 *
 * Middleware soportado:
 *   - logger   (solo en desarrollo)
 *   - thunk    (acciones asíncronas como función)
 *
 * API pública:
 *   store.dispatch({ type, payload })
 *   store.getState()
 *   store.get(key)
 *   store.subscribe(keys, cb)        → unsub()
 *   store.subscribeAll(cb)           → unsub()
 *   // Métodos de dominio (wrappers sobre dispatch)
 *   store.toggleFav(id), store.toggleCompare(id), etc.
 */

// ── Persistencia ───────────────────────────────────────────────
function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch { return fallback; }
}
function saveLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ── Estado inicial ─────────────────────────────────────────────
const initialState = {
  // Base de datos (se carga async)
  aircraftDB:  [],
  conflictsDB: {},
  fleetsDB:    [],
  killsDB:     [],

  // UI
  theme:        loadLS('aeropedia_theme', 'dark'),
  view:         'gallery',
  currentRoute: '/',

  // Filtros de la galería
  search:   '',
  cat:      'all',
  onlyFavs: false,

  // Favoritos
  favs:        loadLS('aeropedia_favs',        []),
  favsMeta:    loadLS('aeropedia_favs_meta',    {}),
  collections: loadLS('aeropedia_collections',  {}),

  // Filtros de favoritos
  favsSearch:          '',
  favsSortBy:          'addedAt',
  favsSortAsc:         false,
  favsFilterTag:       'all',
  favsActiveCollection:'all',

  // Timeline
  timelineOpen:   false,
  timelineActive: false,
  timelineMin:    1940,
  timelineMax:    2030,

  // Comparador
  compareList: [],

  // Recientes
  recents: loadLS('aeropedia_recents', []),

  // Ranking
  sortStat: 'speed',
  sortAsc:  false,
};

// ── Claves persistidas en localStorage ─────────────────────────
const PERSIST_MAP = {
  theme:       'aeropedia_theme',
  favs:        'aeropedia_favs',
  favsMeta:    'aeropedia_favs_meta',
  collections: 'aeropedia_collections',
  recents:     'aeropedia_recents',
};

// ── Reducer puro ───────────────────────────────────────────────
function reducer(state, { type, payload }) {
  switch (type) {
    // DB
    case 'db/loaded':
      return { ...state, ...payload };

    // UI
    case 'ui/setView':
      return { ...state, view: payload };
    case 'ui/setRoute':
      return { ...state, currentRoute: payload };
    case 'ui/setTheme':
      return { ...state, theme: payload };

    // Galería
    case 'gallery/setSearch':
      return { ...state, search: payload };
    case 'gallery/setCat':
      return { ...state, cat: payload };
    case 'gallery/setOnlyFavs':
      return { ...state, onlyFavs: payload };
    case 'gallery/setSort':
      return { ...state, sortStat: payload.stat, sortAsc: payload.asc };

    // Timeline
    case 'timeline/toggle':
      return { ...state, timelineOpen: !state.timelineOpen };
    case 'timeline/setRange':
      return { ...state, timelineActive: true, timelineMin: payload.min, timelineMax: payload.max };
    case 'timeline/reset':
      return { ...state, timelineActive: false, timelineMin: 1940, timelineMax: 2030 };

    // Comparador
    case 'compare/toggle': {
      const id   = payload;
      const list = state.compareList;
      const next = list.includes(id)
        ? list.filter(x => x !== id)
        : list.length < 3 ? [...list, id] : list;
      return { ...state, compareList: next };
    }
    case 'compare/clear':
      return { ...state, compareList: [] };

    // Recientes
    case 'recents/add': {
      const r = [payload, ...state.recents.filter(x => x !== payload)].slice(0, 20);
      return { ...state, recents: r };
    }

    // Favoritos
    case 'favs/toggle': {
      const id   = payload;
      const favs = state.favs;
      const meta = { ...state.favsMeta };
      if (favs.includes(id)) {
        const cols = removeFromAllCollections(state.collections, id);
        delete meta[id];
        return { ...state, favs: favs.filter(x => x !== id), favsMeta: meta, collections: cols };
      }
      meta[id] = { note:'', tags:[], pinned:false, rating:0, addedAt:Date.now(), updatedAt:Date.now() };
      return { ...state, favs: [...favs, id], favsMeta: meta };
    }
    case 'favs/updateMeta': {
      const meta = { ...state.favsMeta, [payload.id]: { ...state.favsMeta[payload.id], ...payload.data, updatedAt: Date.now() } };
      return { ...state, favsMeta: meta };
    }
    case 'favs/reorder':
      return { ...state, favs: payload };
    case 'favs/setFilters':
      return { ...state, ...payload };

    // Colecciones
    case 'collections/create': {
      const cols = { ...state.collections, [payload.id]: payload };
      return { ...state, collections: cols };
    }
    case 'collections/update': {
      const cols = { ...state.collections, [payload.id]: { ...state.collections[payload.id], ...payload } };
      return { ...state, collections: cols };
    }
    case 'collections/delete': {
      const cols = { ...state.collections };
      delete cols[payload];
      return { ...state, collections: cols };
    }
    case 'collections/toggleFav': {
      const { colId, favId } = payload;
      const col  = state.collections[colId];
      if (!col) return state;
      const ids  = col.ids || [];
      const next = ids.includes(favId) ? ids.filter(x => x !== favId) : [...ids, favId];
      return { ...state, collections: { ...state.collections, [colId]: { ...col, ids: next } } };
    }

    default:
      return state;
  }
}

// ── Helper puro ────────────────────────────────────────────────
function removeFromAllCollections(collections, id) {
  const result = {};
  for (const [k, col] of Object.entries(collections)) {
    result[k] = { ...col, ids: (col.ids || []).filter(x => x !== id) };
  }
  return result;
}

// ── Store class ────────────────────────────────────────────────
class Store {
  #state     = { ...initialState };
  #listeners = new Map();                   // key → Map<Symbol, cb>
  #batch     = null;                        // microtask batch handle
  #batchKeys = new Set();

  // ── Dispatch ─────────────────────────────────────────────────
  dispatch(action) {
    // Thunk middleware
    if (typeof action === 'function') {
      return action(this.dispatch.bind(this), () => ({ ...this.#state }));
    }

    const prev  = this.#state;
    const next  = reducer(prev, action);
    if (next === prev) return;

    // Detect changed keys
    const changed = Object.keys(next).filter(k => next[k] !== prev[k]);
    if (changed.length === 0) return;

    this.#state = next;

    // Persist changed keys
    for (const k of changed) {
      if (PERSIST_MAP[k]) saveLS(PERSIST_MAP[k], next[k]);
    }

    // Logger (development only)
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.groupCollapsed(`[store] ${action.type}`);
      console.log('payload:', action.payload);
      console.log('changed:', changed);
      console.groupEnd();
    }

    // Batch notifications via microtask
    for (const k of changed) this.#batchKeys.add(k);
    if (!this.#batch) {
      this.#batch = Promise.resolve().then(() => {
        const keys     = [...this.#batchKeys];
        const snapshot = { ...this.#state };
        this.#batchKeys.clear();
        this.#batch = null;
        this.#notify(keys, prev, snapshot);
      });
    }
  }

  // ── Legacy setState — proxies to dispatch for backwards compat ─
  setState(patch) {
    // Normalise patch into a synthetic action
    this.dispatch({ type: '__setState__', payload: patch });
  }

  // ── getState / get ────────────────────────────────────────────
  getState() { return { ...this.#state }; }
  get(key)   { return this.#state[key]; }

  // ── Subscribe ─────────────────────────────────────────────────
  subscribe(keys, cb) {
    const list = Array.isArray(keys) ? keys : [keys];
    // Filter out empty/falsy keys defensively
    const valid = list.filter(k => k && typeof k === 'string');
    if (!valid.length) return () => {};

    const id = Symbol();
    for (const k of valid) {
      if (!this.#listeners.has(k)) this.#listeners.set(k, new Map());
      this.#listeners.get(k).set(id, cb);
    }
    return () => { for (const k of valid) this.#listeners.get(k)?.delete(id); };
  }

  subscribeAll(cb) {
    const id = Symbol();
    if (!this.#listeners.has('*')) this.#listeners.set('*', new Map());
    this.#listeners.get('*').set(id, cb);
    return () => this.#listeners.get('*')?.delete(id);
  }

  // ── Notify ────────────────────────────────────────────────────
  #notify(changedKeys, prev, next) {
    for (const k of changedKeys) {
      const map = this.#listeners.get(k);
      if (map) for (const [, cb] of map) cb(next[k], prev[k], next);
    }
    const all = this.#listeners.get('*');
    if (all) for (const [, cb] of all) cb(next, changedKeys);
  }

  // ── Domain helpers (wrappers over dispatch) ──────────────────

  // Tema
  toggleTheme() {
    const next = this.#state.theme === 'dark' ? 'light' : 'dark';
    this.dispatch({ type: 'ui/setTheme', payload: next });
  }

  // Favoritos
  isFav(id)    { return Array.isArray(this.#state.favs) && this.#state.favs.includes(id); }
  toggleFav(id){ this.dispatch({ type: 'favs/toggle', payload: id }); }

  getFavMeta(id) { return this.#state.favsMeta?.[id] ?? null; }

  updateFavMeta(id, data) { this.dispatch({ type: 'favs/updateMeta', payload: { id, data } }); }

  toggleFavTag(id, tag) {
    const meta = this.#state.favsMeta?.[id];
    if (!meta) return;
    const tags = meta.tags || [];
    const next = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
    this.updateFavMeta(id, { tags: next });
  }

  toggleFavPin(id) {
    const meta = this.#state.favsMeta?.[id];
    if (!meta) return;
    this.updateFavMeta(id, { pinned: !meta.pinned });
  }

  setFavRating(id, rating) { this.updateFavMeta(id, { rating }); }

  reorderFav(ids) { this.dispatch({ type: 'favs/reorder', payload: ids }); }

  getAllFavTags() {
    return [...new Set(
      Object.values(this.#state.favsMeta || {}).flatMap(m => m.tags || [])
    )].sort();
  }

  getFilteredFavs() {
    const { favs, favsMeta, aircraftDB, favsSearch, favsSortBy, favsSortAsc,
            favsFilterTag, favsActiveCollection, collections } = this.#state;

    const db = Array.isArray(aircraftDB) ? aircraftDB : [];
    const q  = (favsSearch || '').toLowerCase().trim();

    const activeIds = favsActiveCollection === 'all'
      ? (favs || [])
      : ((collections?.[favsActiveCollection]?.ids || []).filter(id => (favs || []).includes(id)));

    let list = activeIds
      .map(id => ({ plane: db.find(p => p.id === id), meta: favsMeta?.[id] || {} }))
      .filter(({ plane }) => !!plane)
      .filter(({ plane }) => !q
        || plane.name.toLowerCase().includes(q)
        || plane.country.toLowerCase().includes(q)
        || plane.type.toLowerCase().includes(q))
      .filter(({ meta }) =>
        favsFilterTag === 'all' || (meta.tags || []).includes(favsFilterTag));

    const key = favsSortBy || 'addedAt';
    list.sort((a, b) => {
      let va = a.meta[key] ?? a.plane[key] ?? 0;
      let vb = b.meta[key] ?? b.plane[key] ?? 0;
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (key === 'pinned') return (vb ? 1 : 0) - (va ? 1 : 0);
      return favsSortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

    return list;
  }

  exportFavs() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      favs: this.#state.favs || [],
      favsMeta: this.#state.favsMeta || {},
      collections: this.#state.collections || {},
    };
  }

  // Colecciones
  createCollection(data) {
    const id = `col_${Date.now()}`;
    this.dispatch({ type: 'collections/create', payload: { id, ids: [], ...data } });
    return id;
  }
  updateCollection(id, data)       { this.dispatch({ type: 'collections/update',    payload: { id, ...data } }); }
  deleteCollection(id)             { this.dispatch({ type: 'collections/delete',    payload: id }); }
  toggleFavInCollection(colId, favId) { this.dispatch({ type: 'collections/toggleFav', payload: { colId, favId } }); }
  getFavCollections(favId)         { return Object.values(this.#state.collections || {}).filter(c => (c.ids || []).includes(favId)); }

  getCollection(id) { return this.#state.collections?.[id] ?? null; }

  // Compartir
  buildShareUrl(ids) {
    const safe = (Array.isArray(ids) ? ids : []).slice(0, 10);
    return `${location.origin}/shared?ids=${btoa(safe.join(','))}`;
  }
  decodeShareUrl(encoded) {
    try { return atob(encoded).split(',').filter(Boolean); } catch { return []; }
  }

  // Recientes
  addRecent(id) { this.dispatch({ type: 'recents/add', payload: id }); }

  // Comparador
  toggleCompare(id) { this.dispatch({ type: 'compare/toggle', payload: id }); }
  clearCompare()    { this.dispatch({ type: 'compare/clear' }); }
}

// ── Patch __setState__ through reducer ────────────────────────
// (Keeps full backwards-compat: any setState call flows through reducer)
const _origReducer = reducer;
function patchedReducer(state, action) {
  if (action.type === '__setState__') {
    return { ...state, ...action.payload };
  }
  return _origReducer(state, action);
}
// Monkey-patch the Store class to use patchedReducer
Store.prototype._reducer = patchedReducer;

// ── Singleton ─────────────────────────────────────────────────
export const store = new Store(initialState);

// ── Selectors ─────────────────────────────────────────────────

/** Memoize: re-computes only when inputs change */
function createSelector(...fns) {
  const compute = fns.pop();
  let lastArgs = null, lastResult = null;
  return (state) => {
    const args = fns.map(f => f(state));
    if (lastArgs && args.every((a, i) => a === lastArgs[i])) return lastResult;
    lastArgs   = args;
    lastResult = compute(...args);
    return lastResult;
  };
}

export const selectAircraftDB   = s => s.aircraftDB  || [];
export const selectConflictsDB  = s => s.conflictsDB || {};
export const selectFleetsDB     = s => s.fleetsDB    || [];
export const selectKillsDB      = s => s.killsDB     || [];
export const selectFavs         = s => s.favs        || [];
export const selectCompareList  = s => s.compareList || [];
export const selectSearch       = s => s.search      || '';
export const selectCat          = s => s.cat         || 'all';
export const selectOnlyFavs     = s => s.onlyFavs    ?? false;
export const selectView         = s => s.view        || 'gallery';
export const selectTimeline     = s => ({ active: s.timelineActive, min: s.timelineMin, max: s.timelineMax });
export const selectSortStat     = s => s.sortStat    || 'speed';
export const selectSortAsc      = s => s.sortAsc     ?? false;

/** Memoized: category list from DB */
export const selectCategories = createSelector(
  selectAircraftDB,
  db => [...new Set(db.map(p => p.type).filter(Boolean))].sort()
);

export const COLLECTION_COLORS = [
  '#3b82f6','#f59e0b','#10b981','#8b5cf6','#ef4444',
  '#06b6d4','#f472b6','#84cc16','#fb923c','#a78bfa',
];
export const COLLECTION_ICONS = ['📁','⭐','🔥','🏆','🎯','🚀','🛡','⚡','🌍','🔬'];
