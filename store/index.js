/**
 * store/index.js — Estado global centralizado con Observer Pattern
 * Favoritos enriquecidos + Colecciones + Comparador + Ranking
 */

function loadLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function saveLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

// ── Estado inicial ─────────────────────────────────────────────
const initialState = {
  aircraftDB:  [], conflictsDB: {}, fleetsDB: [], killsDB: [],
  theme:         loadLS('aeropedia_theme', 'dark'),
  view:          'gallery',
  currentRoute:  '/',
  search:        '', cat: 'all', onlyFavs: false, activeConflict: 'all',

  // Favoritos
  favs:     loadLS('aeropedia_favs', []),
  favsMeta: loadLS('aeropedia_favs_meta', {}),

  /**
   * Colecciones: Record<id, { name, color, icon, createdAt, ids: string[] }>
   * Un favorito puede estar en varias colecciones.
   */
  collections: loadLS('aeropedia_collections', {}),

  favsSearch: '', favsSortBy: 'addedAt', favsSortAsc: false,
  favsFilterTag: 'all', favsActiveCollection: 'all',

  timelineOpen: false, timelineActive: false, timelineMin: 1940, timelineMax: 2030,
  compareList: [],
  // Historial de aeronaves vistas recientemente
  recents: loadLS('aeropedia_recents', []),   // string[] últimos 20 IDs
  sortStat: 'speed', sortAsc: false,
  loading: false, error: null,
};

// ── Colores predefinidos para colecciones ──────────────────────
export const COLLECTION_COLORS = [
  '#3b82f6','#f59e0b','#10b981','#8b5cf6','#ef4444',
  '#06b6d4','#f472b6','#84cc16','#fb923c','#a78bfa',
];
export const COLLECTION_ICONS = ['📁','⭐','🔥','🏆','🎯','🚀','🛡','⚡','🌍','🔬'];

class Store {
  #state; #listeners = new Map();

  constructor(initial) { this.#state = { ...initial }; }

  getState() { return { ...this.#state }; }
  get(key)   { return this.#state[key]; }

  setState(patch) {
    const prev = { ...this.#state };
    // Only include keys that actually changed (primitive equality)
    const changed = {};
    for (const [k, v] of Object.entries(patch)) {
      if (this.#state[k] !== v) changed[k] = v;
    }
    if (!Object.keys(changed).length) return;  // nothing changed → skip notify
    this.#state = { ...this.#state, ...changed };
    this.#persist(changed);
    this.#notify(changed, prev);
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

  #persist(patch) {
    if ('theme'       in patch) saveLS('aeropedia_theme',       this.#state.theme);
    if ('favs'        in patch) saveLS('aeropedia_favs',        this.#state.favs);
    if ('favsMeta'    in patch) saveLS('aeropedia_favs_meta',   this.#state.favsMeta);
    if ('collections' in patch) saveLS('aeropedia_collections', this.#state.collections);
    if ('recents'     in patch) saveLS('aeropedia_recents',     this.#state.recents);
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

  // ── Tema ────────────────────────────────────────────────────
  toggleTheme() {
    this.setState({ theme: this.#state.theme === 'dark' ? 'light' : 'dark' });
  }

  // ── Favoritos ────────────────────────────────────────────────
  isFav(id) { return this.#state.favs.includes(id); }

  toggleFav(id) {
    const favs = [...this.#state.favs];
    const meta = { ...this.#state.favsMeta };
    const idx  = favs.indexOf(id);
    if (idx >= 0) {
      favs.splice(idx, 1);
      delete meta[id];
      // quitar de todas las colecciones
      const cols = this.#removeFromAllCollections(id);
      this.setState({ favs, favsMeta: meta, collections: cols });
    } else {
      favs.push(id);
      meta[id] = { note:'', tags:[], pinned:false, rating:0, addedAt:Date.now(), updatedAt:Date.now() };
      this.setState({ favs, favsMeta: meta });
    }
  }

  getFavMeta(id) { return this.#state.favsMeta[id] ?? null; }

  updateFavMeta(id, patch) {
    if (!this.#state.favs.includes(id)) return;
    const meta = { ...this.#state.favsMeta };
    meta[id] = { ...meta[id], ...patch, updatedAt: Date.now() };
    this.setState({ favsMeta: meta });
  }

  toggleFavTag(id, tag) {
    const m = this.getFavMeta(id); if (!m) return;
    const tags = m.tags.includes(tag) ? m.tags.filter(t=>t!==tag) : [...m.tags, tag];
    this.updateFavMeta(id, { tags });
  }

  toggleFavPin(id) {
    const m = this.getFavMeta(id); if (!m) return;
    this.updateFavMeta(id, { pinned: !m.pinned });
  }

  setFavRating(id, rating) {
    this.updateFavMeta(id, { rating: Math.max(0, Math.min(5, rating)) });
  }

  reorderFav(fromIdx, toIdx) {
    const favs = [...this.#state.favs];
    const [item] = favs.splice(fromIdx, 1);
    favs.splice(toIdx, 0, item);
    this.setState({ favs });
  }

  getAllFavTags() {
    const tags = new Set();
    for (const m of Object.values(this.#state.favsMeta)) {
      for (const t of (m.tags||[])) tags.add(t);
    }
    return [...tags].sort();
  }

  getFilteredFavs() {
    const { favs, favsMeta, aircraftDB, favsSearch, favsSortBy, favsSortAsc,
            favsFilterTag, favsActiveCollection, collections } = this.#state;
    const q = favsSearch.toLowerCase().trim();

    // Filtrar por colección activa
    const activeIds = favsActiveCollection === 'all'
      ? favs
      : (collections[favsActiveCollection]?.ids || []).filter(id => favs.includes(id));

    let list = activeIds
      .map(id => ({ plane: aircraftDB.find(p => p.id === id), meta: favsMeta[id] || {} }))
      .filter(({ plane }) => !!plane)
      .filter(({ plane }) => !q || plane.name.toLowerCase().includes(q)
        || plane.country.toLowerCase().includes(q) || plane.type.toLowerCase().includes(q))
      .filter(({ meta }) => favsFilterTag === 'all' || (meta.tags||[]).includes(favsFilterTag));

    list.sort((a, b) => {
      if (a.meta.pinned !== b.meta.pinned) return a.meta.pinned ? -1 : 1;
      let va, vb;
      switch (favsSortBy) {
        case 'name':   va = a.plane.name;         vb = b.plane.name;         break;
        case 'rating': va = a.meta.rating||0;     vb = b.meta.rating||0;     break;
        case 'year':   va = a.plane.year;         vb = b.plane.year;         break;
        case 'speed':  va = a.plane.speed;        vb = b.plane.speed;        break;
        default:       va = a.meta.addedAt||0;    vb = b.meta.addedAt||0;
      }
      if (typeof va === 'string') return favsSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return favsSortAsc ? va - vb : vb - va;
    });
    return list;
  }

  exportFavs() {
    const { favs, favsMeta, aircraftDB, collections } = this.#state;
    const data = favs.map(id => {
      const plane = aircraftDB.find(p => p.id === id);
      return { id, name: plane?.name, type: plane?.type, country: plane?.country, year: plane?.year, meta: favsMeta[id] };
    });
    return JSON.stringify({ exportedAt: new Date().toISOString(), count: data.length, favs: data, collections }, null, 2);
  }

  // ── Colecciones ──────────────────────────────────────────────
  createCollection({ name, color, icon } = {}) {
    const id   = `col_${Date.now()}`;
    const cols = { ...this.#state.collections };
    cols[id]   = {
      name:      name || 'Nueva colección',
      color:     color || COLLECTION_COLORS[Object.keys(cols).length % COLLECTION_COLORS.length],
      icon:      icon  || COLLECTION_ICONS[Object.keys(cols).length % COLLECTION_ICONS.length],
      createdAt: Date.now(),
      ids:       [],
    };
    this.setState({ collections: cols });
    return id;
  }

  updateCollection(id, patch) {
    if (!this.#state.collections[id]) return;
    const cols = { ...this.#state.collections };
    cols[id]   = { ...cols[id], ...patch };
    this.setState({ collections: cols });
  }

  deleteCollection(id) {
    const cols = { ...this.#state.collections };
    delete cols[id];
    this.setState({ collections: cols, favsActiveCollection: 'all' });
  }

  toggleFavInCollection(favId, colId) {
    if (!this.#state.collections[colId]) return;
    const cols = { ...this.#state.collections };
    const ids  = [...(cols[colId].ids || [])];
    const idx  = ids.indexOf(favId);
    if (idx >= 0) ids.splice(idx, 1); else ids.push(favId);
    cols[colId] = { ...cols[colId], ids };
    this.setState({ collections: cols });
  }

  getFavCollections(favId) {
    return Object.entries(this.#state.collections)
      .filter(([, col]) => col.ids.includes(favId))
      .map(([id]) => id);
  }

  #removeFromAllCollections(favId) {
    const cols = { ...this.#state.collections };
    for (const id of Object.keys(cols)) {
      cols[id] = { ...cols[id], ids: cols[id].ids.filter(i => i !== favId) };
    }
    return cols;
  }

  // ── Compartir URL ────────────────────────────────────────────
  buildShareUrl(ids) {
    const encoded = btoa(ids.join(',')).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    return `${location.origin}/shared?ids=${encoded}`;
  }

  decodeShareUrl(encoded) {
    try {
      const b64 = encoded.replace(/-/g,'+').replace(/_/g,'/');
      return atob(b64).split(',').filter(Boolean);
    } catch { return []; }
  }

  // ── Historial reciente ───────────────────────────────────────────
  addRecent(id) {
    const recents = [id, ...this.#state.recents.filter(r => r !== id)].slice(0, 20);
    this.setState({ recents });
  }

  // ── Comparador ────────────────────────────────────────────────
  toggleCompare(id) {
    const list = [...this.#state.compareList];
    const idx  = list.indexOf(id);
    if (idx >= 0) list.splice(idx, 1); else if (list.length < 3) list.push(id);
    this.setState({ compareList: list });
  }
  clearCompare() { this.setState({ compareList: [] }); }
}

export const store = new Store(initialState);
