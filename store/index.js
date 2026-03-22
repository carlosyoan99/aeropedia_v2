/**
 * store/index.js — Estado global centralizado con Observer Pattern
 * Persistencia opcional en localStorage, actualización reactiva de UI.
 */

const PERSIST_KEYS = ['theme', 'favs', 'view', 'sortStat', 'sortAsc'];

const initialState = {
  // Datos
  aircraftDB: [],
  conflictsDB: {},
  fleetsDB: [],
  killsDB: [],

  // UI
  theme: localStorage.getItem('aeropedia_theme') || 'dark',
  view: 'gallery',           // 'gallery' | 'ranking'
  currentRoute: '/',
  currentDetailId: null,

  // Filtros
  search: '',
  cat: 'all',
  onlyFavs: false,
  favs: (() => { try { return JSON.parse(localStorage.getItem('aeropedia_favs')) || []; } catch { return []; } })(),
  activeConflict: 'all',

  // Timeline
  timelineOpen: false,
  timelineActive: false,
  timelineMin: 1940,
  timelineMax: 2030,

  // Comparador
  compareList: [],

  // Ranking
  sortStat: 'speed',
  sortAsc: false,

  // Loading
  loading: false,
  error: null,
};

class Store {
  #state;
  #listeners = new Map();
  #batchQueue = null;

  constructor(initial) {
    this.#state = { ...initial };
  }

  /** Devuelve el estado actual (inmutable shallow copy) */
  getState() {
    return { ...this.#state };
  }

  /** Lee una clave del estado */
  get(key) {
    return this.#state[key];
  }

  /**
   * Actualiza el estado y notifica a suscriptores.
   * @param {Partial<typeof initialState>} patch
   */
  setState(patch) {
    const prevState = { ...this.#state };
    this.#state = { ...this.#state, ...patch };

    // Persistir claves marcadas
    for (const key of PERSIST_KEYS) {
      if (key in patch) {
        try {
          if (key === 'favs') {
            localStorage.setItem('aeropedia_favs', JSON.stringify(this.#state.favs));
          } else if (key === 'theme') {
            localStorage.setItem('aeropedia_theme', this.#state.theme);
          }
        } catch {}
      }
    }

    // Notificar suscriptores
    this.#notify(patch, prevState);
  }

  /**
   * Suscribirse a cambios de una o varias claves.
   * @param {string|string[]} keys - Clave(s) a escuchar
   * @param {Function} callback - fn(newVal, prevVal, state)
   * @returns {Function} unsubscribe
   */
  subscribe(keys, callback) {
    const keyList = Array.isArray(keys) ? keys : [keys];
    const id = Symbol();

    for (const key of keyList) {
      if (!this.#listeners.has(key)) this.#listeners.set(key, new Map());
      this.#listeners.get(key).set(id, callback);
    }

    return () => {
      for (const key of keyList) {
        this.#listeners.get(key)?.delete(id);
      }
    };
  }

  /**
   * Suscribirse a CUALQUIER cambio del estado.
   * @param {Function} callback - fn(state, changedKeys)
   * @returns {Function} unsubscribe
   */
  subscribeAll(callback) {
    const id = Symbol();
    if (!this.#listeners.has('*')) this.#listeners.set('*', new Map());
    this.#listeners.get('*').set(id, callback);
    return () => this.#listeners.get('*')?.delete(id);
  }

  #notify(patch, prevState) {
    const changedKeys = Object.keys(patch);

    // Notificar suscriptores específicos
    for (const key of changedKeys) {
      const keyListeners = this.#listeners.get(key);
      if (keyListeners) {
        for (const [, cb] of keyListeners) {
          cb(this.#state[key], prevState[key], this.#state);
        }
      }
    }

    // Notificar suscriptores globales
    const globalListeners = this.#listeners.get('*');
    if (globalListeners) {
      for (const [, cb] of globalListeners) {
        cb({ ...this.#state }, changedKeys);
      }
    }
  }

  /** Togglea favorito */
  toggleFav(id) {
    const favs = [...this.#state.favs];
    const idx = favs.indexOf(id);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.push(id);
    this.setState({ favs });
  }

  isFav(id) {
    return this.#state.favs.includes(id);
  }

  /** Togglea tema */
  toggleTheme() {
    const theme = this.#state.theme === 'dark' ? 'light' : 'dark';
    this.setState({ theme });
  }

  /** Comparador */
  toggleCompare(id) {
    const list = [...this.#state.compareList];
    const idx = list.indexOf(id);
    if (idx >= 0) list.splice(idx, 1);
    else if (list.length < 3) list.push(id);
    this.setState({ compareList: list });
  }

  clearCompare() {
    this.setState({ compareList: [] });
  }
}

export const store = new Store(initialState);
