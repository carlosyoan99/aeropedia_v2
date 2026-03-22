/**
 * components/Header.js — Barra de navegación principal
 */

import { store } from '../store/index.js';
import { router } from '../router/index.js';
import { debounce } from '../utils/index.js';

export class Header {
  #el = null;
  #unsubs = [];
  #searchInput = null;

  render() {
    this.#el = document.createElement('header');
    this.#el.className = 'site-header';
    this.#el.setAttribute('role', 'banner');
    this.#el.innerHTML = this.#template();
    this.#bindEvents();
    this.#syncTheme();

    // Suscribirse a cambios relevantes
    this.#unsubs.push(
      store.subscribe('theme', () => this.#syncTheme()),
      store.subscribe('currentRoute', () => this.#syncNav()),
      store.subscribe(['compareList'], () => this.#syncCompareBtn()),
      store.subscribe('onlyFavs', (v) => this.#el.querySelector('#favFilterBtn')?.classList.toggle('active', v)),
    );

    return this.#el;
  }

  destroy() {
    this.#unsubs.forEach(u => u());
  }

  #template() {
    const s = store.getState();
    return `
    <div class="header-inner">
      <div class="header-row">

        <a class="logo" href="/" data-link aria-label="AeroPedia — Inicio">
          <div class="logo-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22">
              <path d="M21 16l-9-4-9 4 9-1.5L21 16z"/>
              <path d="M3 16v2l9-1.5 9 1.5v-2"/>
              <path d="M12 12V4l3 4-3 4z" fill="currentColor" stroke="none" opacity="0.6"/>
            </svg>
          </div>
          <span class="logo-text">AERO<span>PEDIA</span></span>
        </a>

        <nav class="main-nav" aria-label="Navegación principal">
          <a href="/" data-link class="nav-link" data-page="home">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M2 11l8-8 8 8v7a1 1 0 01-1 1h-5v-4H6v4H3a1 1 0 01-1-1v-7z"/></svg>
            Archivo
          </a>
          <a href="/compare" data-link class="nav-link" data-page="compare">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M10 6H6a2 2 0 00-2 2v7a2 2 0 002 2h4a2 2 0 002-2V8a2 2 0 00-2-2zm0-2H6a4 4 0 00-4 4v7a4 4 0 004 4h4a4 4 0 004-4V8a4 4 0 00-4-4zM14 6a4 4 0 014 4v7a4 4 0 01-4 4"/></svg>
            Comparar
          </a>
          <a href="/kills" data-link class="nav-link" data-page="kills">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V7z" clip-rule="evenodd"/></svg>
            Combate
          </a>
          <a href="/fleets" data-link class="nav-link" data-page="fleets">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10z" clip-rule="evenodd"/></svg>
            Flotas
          </a>
          <a href="/mach" data-link class="nav-link" data-page="mach">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V7z" clip-rule="evenodd"/></svg>
            Mach
          </a>
        </nav>

        <div class="header-controls">
          <div class="search-wrap" role="search">
            <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
            </svg>
            <input
              type="search"
              id="mainSearch"
              class="search-input"
              placeholder="Buscar aeronave, país…"
              aria-label="Buscar aeronave"
              autocomplete="off"
              value="${store.get('search') || ''}"
            >
            <kbd class="search-kbd" aria-hidden="true">/</kbd>
          </div>

          <select id="catFilter" class="cat-select" aria-label="Filtrar por categoría">
            <option value="all">Todos</option>
            <option value="Caza">Cazas</option>
            <option value="Bombardero">Bombarderos</option>
            <option value="Ataque">Ataque CAS</option>
            <option value="Especial">AWACS / ISR</option>
            <option value="Transporte">Transporte</option>
            <option value="Experimental">Experimental</option>
          </select>

          <button id="favFilterBtn"
            class="header-btn icon-btn ${store.get('onlyFavs') ? 'active' : ''}"
            aria-pressed="${store.get('onlyFavs')}"
            title="Mostrar favoritos (F)">
            <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
            </svg>
          </button>

          <div class="view-toggle" role="group" aria-label="Cambiar vista">
            <button id="viewGalleryBtn" class="view-btn active" data-view="gallery" title="Vista galería (G)" aria-pressed="true">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zm6-8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z"/></svg>
            </button>
            <button id="viewRankingBtn" class="view-btn" data-view="ranking" title="Vista ranking (R)" aria-pressed="false">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>
            </button>
          </div>

          <button id="compareNavBtn"
            class="header-btn icon-btn compare-nav-btn ${store.get('compareList').length > 0 ? 'has-items' : ''}"
            data-link
            title="Ver comparador"
            aria-label="Comparador de aeronaves"
            data-compare-count="${store.get('compareList').length}">
            <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true">
              <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/>
            </svg>
            ${store.get('compareList').length > 0 ? `<span class="compare-badge">${store.get('compareList').length}</span>` : ''}
          </button>

          <button id="themeToggle"
            class="header-btn icon-btn theme-btn"
            aria-label="Cambiar tema (D)"
            title="Tema oscuro/claro (D)">
            <span class="theme-icon-sun" aria-hidden="true">☀</span>
            <span class="theme-icon-moon" aria-hidden="true">☽</span>
          </button>

        </div>
      </div>
    </div>`;
  }

  #bindEvents() {
    // Búsqueda con debounce
    this.#searchInput = this.#el.querySelector('#mainSearch');
    const debouncedSearch = debounce((e) => {
      store.setState({ search: e.target.value });
    }, 280);
    this.#searchInput?.addEventListener('input', debouncedSearch);

    // Filtro categoría
    this.#el.querySelector('#catFilter')?.addEventListener('change', (e) => {
      store.setState({ cat: e.target.value });
    });

    // Favoritos
    this.#el.querySelector('#favFilterBtn')?.addEventListener('click', () => {
      store.setState({ onlyFavs: !store.get('onlyFavs') });
    });

    // Vista
    this.#el.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        store.setState({ view: btn.dataset.view });
        this.#syncViewBtns(btn.dataset.view);
      });
    });

    // Comparador
    this.#el.querySelector('#compareNavBtn')?.addEventListener('click', () => {
      router.navigate('/compare');
    });

    // Tema
    this.#el.querySelector('#themeToggle')?.addEventListener('click', () => {
      store.toggleTheme();
    });

    // Shortcut /
    document.addEventListener('keydown', this.#onKeydown.bind(this));
  }

  #onKeydown(e) {
    const tag = document.activeElement?.tagName.toLowerCase();
    const typing = ['input', 'select', 'textarea'].includes(tag);
    if (e.key === '/' && !typing) {
      e.preventDefault();
      this.#searchInput?.focus();
    }
    if (!typing) {
      if (e.key === 'g' || e.key === 'G') store.setState({ view: 'gallery' });
      if (e.key === 'r' || e.key === 'R') store.setState({ view: 'ranking' });
      if (e.key === 'f' || e.key === 'F') store.setState({ onlyFavs: !store.get('onlyFavs') });
      if (e.key === 'd' || e.key === 'D') store.toggleTheme();
    }
  }

  #syncTheme() {
    const dark = store.get('theme') === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.body.classList.toggle('dark', dark);
    this.#el?.querySelector('#themeToggle')?.setAttribute('aria-pressed', dark);
  }

  #syncNav() {
    const route = store.get('currentRoute');
    this.#el?.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      link.classList.toggle('active', href === '/' ? route === '/' : route.startsWith(href));
      link.setAttribute('aria-current', (href === route) ? 'page' : 'false');
    });
  }

  #syncViewBtns(view) {
    this.#el?.querySelectorAll('.view-btn').forEach(btn => {
      const active = btn.dataset.view === view;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active);
    });
  }

  #syncCompareBtn() {
    const count = store.get('compareList').length;
    const btn = this.#el?.querySelector('#compareNavBtn');
    if (!btn) return;
    btn.classList.toggle('has-items', count > 0);
    btn.setAttribute('data-compare-count', count);
    const badge = btn.querySelector('.compare-badge');
    if (count > 0) {
      if (badge) badge.textContent = count;
      else btn.insertAdjacentHTML('beforeend', `<span class="compare-badge">${count}</span>`);
    } else {
      badge?.remove();
    }
  }
}
