/**
 * router/index.js — Sistema de enrutamiento con History API
 * pushState / replaceState / popstate — sin hash routing.
 */

import { store } from '../store/index.js';

class Router {
  #routes = new Map();
  #notFound = null;
  #outlet = null;
  #currentView = null;
  #beforeEach = null;

  /**
   * @param {string} selector - Selector CSS del contenedor de vistas
   */
  constructor(selector) {
    this.#outlet = document.querySelector(selector);
    if (!this.#outlet) throw new Error(`Router: outlet "${selector}" not found`);

    window.addEventListener('popstate', (e) => {
      this.#resolve(location.pathname, e.state, false);
    });

    // Interceptar clicks en <a> con data-link
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-link]');
      if (!link) return;
      e.preventDefault();
      this.navigate(link.getAttribute('href') || '/');
    });
  }

  /**
   * Registra una ruta.
   * @param {string} path - Ruta, puede tener parámetros :param
   * @param {Function} viewFactory - async () => instancia de vista
   * @param {object} [meta] - Metadatos (title, description)
   */
  route(path, viewFactory, meta = {}) {
    this.#routes.set(path, { viewFactory, meta, pattern: this.#pathToRegex(path) });
    return this;
  }

  /** Ruta 404 */
  notFound(viewFactory) {
    this.#notFound = viewFactory;
    return this;
  }

  /** Hook antes de cada navegación. Retorna false para cancelar. */
  beforeEach(fn) {
    this.#beforeEach = fn;
    return this;
  }

  /** Navega a una ruta nueva */
  async navigate(path, state = {}) {
    if (path === location.pathname) return;
    history.pushState(state, '', path);
    await this.#resolve(path, state, true);
  }

  /** Reemplaza la entrada actual del historial */
  async replace(path, state = {}) {
    history.replaceState(state, '', path);
    await this.#resolve(path, state, false);
  }

  /** Inicializa el router con la ruta actual */
  async init() {
    await this.#resolve(location.pathname, history.state, false);
  }

  async #resolve(path, state, isPush) {
    if (this.#beforeEach) {
      const result = await this.#beforeEach(path, state);
      if (result === false) return;
    }

    // Buscar ruta coincidente
    let matchedRoute = null;
    let params = {};

    for (const [routePath, routeDef] of this.#routes) {
      const match = path.match(routeDef.pattern);
      if (match) {
        matchedRoute = routeDef;
        params = this.#extractParams(routePath, path);
        break;
      }
    }

    store.setState({ currentRoute: path });

    if (!matchedRoute) {
      if (this.#notFound) {
        await this.#render(this.#notFound, params, {});
      }
      return;
    }

    // Actualizar meta tags SEO
    if (matchedRoute.meta?.title) {
      document.title = matchedRoute.meta.title;
      this.#updateMeta('description', matchedRoute.meta.description || '');
    }

    await this.#render(matchedRoute.viewFactory, params, matchedRoute.meta);
  }

  async #render(viewFactory, params, meta) {
    // Destruir vista anterior
    if (this.#currentView?.destroy) {
      await this.#currentView.destroy();
    }

    // Mostrar loading
    this.#outlet.classList.add('route-loading');

    try {
      // Dynamic import (lazy loading de la vista)
      const view = await viewFactory(params, meta);
      this.#currentView = view;

      this.#outlet.innerHTML = '';
      const el = await view.render(params);
      if (el) this.#outlet.appendChild(el);
    } catch (err) {
      console.error('[Router] Error al renderizar vista:', err);
      this.#outlet.innerHTML = `<div class="route-error">
        <p>Error al cargar la vista.</p>
        <small>${err.message}</small>
      </div>`;
    } finally {
      this.#outlet.classList.remove('route-loading');
    }
  }

  #pathToRegex(path) {
    const escaped = path
      .replace(/\//g, '\\/')
      .replace(/:([a-zA-Z]+)/g, '([^/]+)');
    return new RegExp(`^${escaped}\\/?$`);
  }

  #extractParams(routePath, actualPath) {
    const keys = [];
    const keyRe = /:([a-zA-Z]+)/g;
    let m;
    while ((m = keyRe.exec(routePath)) !== null) keys.push(m[1]);

    const values = actualPath.match(this.#pathToRegex(routePath))?.slice(1) || [];
    return Object.fromEntries(keys.map((k, i) => [k, values[i]]));
  }

  #updateMeta(name, content) {
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }
}

export const router = new Router('#app-outlet');
