/**
 * router/index.js — History API Router
 * Fixes: scroll-to-top en navegación, beforeEach async correcto.
 */

import { store } from '../store/index.js';

class Router {
  #routes     = new Map();
  #notFound   = null;
  #outlet     = null;
  #currentView = null;
  #beforeEach = null;
  #base       = '';   // e.g. '/aeropedia_v2' for GitHub Pages subdirectory

  constructor(selector, { base = '' } = {}) {
    this.#outlet = document.querySelector(selector);
    if (!this.#outlet) throw new Error(`Router: outlet "${selector}" not found`);
    // Normalize base: strip trailing slash
    this.#base = base.replace(/\/+$/, '');

    window.addEventListener('popstate', (e) => {
      this.#resolve(this.#stripBase(location.pathname) + location.search, e.state, false);
    });

    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-link]');
      if (!link) return;
      e.preventDefault();
      this.navigate(link.getAttribute('href') || '/');
    });
  }

  /** Strip the base prefix from an absolute pathname */
  #stripBase(pathname) {
    if (this.#base && pathname.startsWith(this.#base)) {
      const stripped = pathname.slice(this.#base.length) || '/';
      return stripped.startsWith('/') ? stripped : '/' + stripped;
    }
    return pathname;
  }

  /** Prepend base to a path for pushState */
  #addBase(path) {
    if (!this.#base || path.startsWith(this.#base)) return path;
    return this.#base + path;
  }

  /** Set the base path (called from main.js after auto-detection) */
  setBase(base) {
    this.#base = (base || '').replace(/\/+$/, '');
  }

  route(path, viewFactory, meta = {}) {
    this.#routes.set(path, { viewFactory, meta, pattern: this.#pathToRegex(path) });
    return this;
  }

  notFound(viewFactory) { this.#notFound = viewFactory; return this; }

  beforeEach(fn) { this.#beforeEach = fn; return this; }

  async navigate(path, state = {}) {
    const currentStripped = this.#stripBase(location.pathname);
    if (path === currentStripped && !location.search) return;
    history.pushState(state, '', this.#addBase(path));
    await this.#resolve(path, state, true);
  }

  async replace(path, state = {}) {
    history.replaceState(state, '', this.#addBase(path));
    await this.#resolve(path, state, false);
  }

  async init() {
    // Restore route stored by 404.html GitHub Pages redirect
    const ghRedirect = sessionStorage.getItem('gh_redirect');
    if (ghRedirect) {
      sessionStorage.removeItem('gh_redirect');
      history.replaceState(null, '', this.#addBase(ghRedirect));
    }
    await this.#resolve(this.#stripBase(location.pathname) + location.search, history.state, false);
  }

  async #resolve(fullPath, state, isPush) {
    // Separar path de query string
    const [path] = fullPath.split('?');

    if (this.#beforeEach) {
      const result = await this.#beforeEach(path, state);
      if (result === false) return;
    }

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
      if (this.#notFound) await this.#render(this.#notFound, params, {});
      return;
    }

    if (matchedRoute.meta?.title) {
      document.title = matchedRoute.meta.title;
      this.#updateMeta('description', matchedRoute.meta.description || '');
    }

    await this.#render(matchedRoute.viewFactory, params, matchedRoute.meta);

    // FIX: Scroll al top en cada navegación
    if (isPush) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  async #render(viewFactory, params, meta) {
    if (this.#currentView?.destroy) {
      await this.#currentView.destroy();
    }

    this.#outlet.classList.add('route-loading');

    try {
      const view = await viewFactory(params, meta);
      this.#currentView = view;
      this.#outlet.innerHTML = '';
      const el = await view.render(params);
      if (el) this.#outlet.appendChild(el);
    } catch (err) {
      console.error('[Router]', err);
      this.#outlet.innerHTML = `<div class="route-error" role="alert">
        <p>Error al cargar la vista.</p>
        <small>${err.message}</small>
        <a href="/" data-link style="margin-top:.75rem;display:inline-block">← Volver al inicio</a>
      </div>`;
    } finally {
      this.#outlet.classList.remove('route-loading');
    }
  }

  #pathToRegex(path) {
    const escaped = path
      .replace(/\//g, '\\/')
      .replace(/:([a-zA-Z]+)/g, '([^/?]+)');
    return new RegExp(`^${escaped}\\/?$`);
  }

  #extractParams(routePath, actualPath) {
    const keys = [];
    const keyRe = /:([a-zA-Z]+)/g;
    let m;
    while ((m = keyRe.exec(routePath)) !== null) keys.push(m[1]);
    const values = actualPath.match(this.#pathToRegex(routePath))?.slice(1) || [];
    return Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(values[i] || '')]));
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
