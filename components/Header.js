/**
 * components/Header.js — Barra de navegación principal
 * Integrada con store (tema, compareList, favs) y prefs (densidad, tema).
 */

import { store }  from '../store/index.js';
import { prefs, applyThemeToDom } from '../store/preferences.js';
import { router } from '../router/index.js';
import { debounce } from '../utils/index.js';

const DENSITY_ICONS = {
  compact: `<svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"><path d="M3 4h14v2H3V4zm0 5h14v2H3V9zm0 5h14v2H3v-2z"/></svg>`,
  normal:  `<svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zm6-8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z"/></svg>`,
  large:   `<svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"><path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zm-8 8h6v6H3v-6zm8 0h6v6h-6v-6z"/></svg>`,
};

export class Header {
  #el   = null;
  #subs = [];

  render() {
    this.#el = document.createElement('header');
    this.#el.className = 'site-header';
    this.#el.setAttribute('role', 'banner');
    this.#el.innerHTML = this.#template();
    this.#bindEvents();
    this.#syncAll();

    this.#subs.push(
      store.subscribe('theme',        ()  => this.#syncTheme()),
      store.subscribe('currentRoute', ()  => this.#syncNav()),
      store.subscribe('compareList',  ()  => this.#syncCompareBtn()),
      store.subscribe('onlyFavs',     (v) => this.#el?.querySelector('#favFilterBtn')?.classList.toggle('active', v)),
      store.subscribe('view',         (v) => this.#syncViewBtns(v)),
      prefs.subscribe('display',      (d) => {
        this.#syncTheme();
        this.#syncDensityBtn(d.cardDensity);
      }),
    );
    return this.#el;
  }

  destroy() { this.#subs.forEach(u => u()); }

  #template() {
    const s = store.getState();
    const density = prefs.get('display', 'cardDensity') || 'normal';
    const theme   = prefs.getThemeAttr();

    return `
    <div class="header-inner">
      <div class="header-row">

        <a class="logo" href="/" data-link aria-label="AeroPedia — Inicio">
          <div class="logo-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20">
              <path d="M21 16l-9-4-9 4 9-1.5L21 16z"/>
              <path d="M3 16v2l9-1.5 9 1.5v-2"/>
              <path d="M12 12V4l3 4-3 4z" fill="currentColor" stroke="none" opacity="0.6"/>
            </svg>
          </div>
          <span class="logo-text">AERO<span>PEDIA</span></span>
        </a>

        <nav class="main-nav" aria-label="Navegación principal">
          <a href="/" data-link class="nav-link" data-page="home">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path d="M2 11l8-8 8 8v7a1 1 0 01-1 1h-5v-4H6v4H3a1 1 0 01-1-1v-7z"/></svg>
            Archivo
          </a>
          <a href="/compare" data-link class="nav-link" data-page="compare">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
            Comparar
          </a>
          <a href="/kills" data-link class="nav-link" data-page="kills">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V7z" clip-rule="evenodd"/></svg>
            Combate
          </a>
          <a href="/fleets" data-link class="nav-link" data-page="fleets">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10z" clip-rule="evenodd"/></svg>
            Flotas
          </a>
          <a href="/mach" data-link class="nav-link" data-page="mach">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/></svg>
            Mach
          </a>
          <a href="/theater" data-link class="nav-link" data-page="theater">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
            Teatro
          </a>
          <a href="/favorites" data-link class="nav-link" data-page="favorites">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
            Favoritos
          </a>
        </nav>

        <div class="header-controls">

          <!-- Búsqueda -->
          <div class="search-wrap" role="search">
            <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
            </svg>
            <input type="search" id="mainSearch" class="search-input"
              placeholder="Buscar aeronave, país…" aria-label="Buscar aeronave"
              autocomplete="off" value="${s.search || ''}">
            <kbd class="search-kbd" aria-hidden="true">/</kbd>
          </div>

          <!-- Filtro categoría -->
          <select id="catFilter" class="cat-select" aria-label="Filtrar por categoría">
            <option value="all">Todos</option>
            <option value="Caza">Cazas</option>
            <option value="Bombardero">Bombarderos</option>
            <option value="Ataque">Ataque CAS</option>
            <option value="Especial">AWACS / ISR</option>
            <option value="Transporte">Transporte</option>
            <option value="Experimental">Experimental</option>
          </select>

          <!-- Favoritos -->
          <button id="favFilterBtn" class="header-btn icon-btn ${s.onlyFavs ? 'active' : ''}"
            aria-pressed="${s.onlyFavs}" title="Mostrar favoritos (F)" aria-label="Filtrar favoritos">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
            </svg>
          </button>

          <!-- Vista galería / ranking -->
          <div class="view-toggle" role="group" aria-label="Cambiar vista">
            <button id="viewGalleryBtn" class="view-btn ${s.view === 'gallery' ? 'active' : ''}"
              data-view="gallery" title="Vista galería (G)" aria-pressed="${s.view === 'gallery'}">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zm6-8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z"/></svg>
            </button>
            <button id="viewRankingBtn" class="view-btn ${s.view === 'ranking' ? 'active' : ''}"
              data-view="ranking" title="Vista ranking (R)" aria-pressed="${s.view === 'ranking'}">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>
            </button>
          </div>

          <!-- Densidad de tarjetas -->
          <div class="density-toggle" role="group" aria-label="Densidad de tarjetas" title="Densidad de tarjetas">
            ${(['compact','normal','large']).map(d => `
              <button class="density-btn ${density === d ? 'active' : ''}"
                data-density="${d}" aria-pressed="${density === d}" aria-label="Densidad ${d}">
                ${DENSITY_ICONS[d]}
              </button>`).join('')}
          </div>

          <!-- Comparador -->
          <button id="compareNavBtn" class="header-btn icon-btn ${s.compareList.length ? 'has-items' : ''}"
            title="Ver comparador" aria-label="Comparador de aeronaves">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
            </svg>
            ${s.compareList.length ? `<span class="compare-badge" aria-label="${s.compareList.length} aeronaves">${s.compareList.length}</span>` : ''}
          </button>

          <!-- Tema -->
          <button id="themeToggle" class="header-btn icon-btn theme-btn"
            aria-label="Cambiar tema (D)" title="Cambiar tema (D)">
            <span class="theme-icon-sun" aria-hidden="true">☀</span>
            <span class="theme-icon-moon" aria-hidden="true">☽</span>
            <span class="theme-icon-hc" aria-hidden="true">◑</span>
          </button>

          <!-- Configuración -->
          <a href="/settings" data-link class="header-btn icon-btn settings-btn"
            aria-label="Configuración (Ctrl+,)" title="Configuración (Ctrl+,)">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
              <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>
            </svg>
          </a>

        </div>
      </div>
    </div>`;
  }

  #bindEvents() {
    // Búsqueda con debounce
    const input = this.#el.querySelector('#mainSearch');
    const debouncedSearch = debounce((e) => store.setState({ search: e.target.value }), 280);
    input?.addEventListener('input', debouncedSearch);

    // Categoría
    this.#el.querySelector('#catFilter')?.addEventListener('change', (e) => {
      store.setState({ cat: e.target.value });
    });

    // Favoritos
    this.#el.querySelector('#favFilterBtn')?.addEventListener('click', () => {
      store.setState({ onlyFavs: !store.get('onlyFavs') });
    });

    // Vista
    this.#el.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => store.setState({ view: btn.dataset.view }));
    });

    // Densidad
    this.#el.querySelectorAll('.density-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = btn.dataset.density;
        prefs.setOne('display', 'cardDensity', d);
        // applyDensity ya se dispara vía subscribe en preferences.js
      });
    });

    // Comparador
    this.#el.querySelector('#compareNavBtn')?.addEventListener('click', () => {
      router.navigate('/compare');
    });

    // Tema — cicla: dark → light → high-contrast → dark
    this.#el.querySelector('#themeToggle')?.addEventListener('click', () => {
      const themes = ['dark', 'light', 'high-contrast'];
      const cur    = prefs.get('display', 'theme') || 'dark';
      const next   = themes[(themes.indexOf(cur) + 1) % themes.length];
      prefs.setOne('display', 'theme', next);
      store.setState({ theme: next });
    });

    // Atajos de teclado
    document.addEventListener('keydown', this.#onKey.bind(this));
  }

  #onKey(e) {
    const tag    = document.activeElement?.tagName.toLowerCase();
    const typing = ['input','select','textarea'].includes(tag);
    if (e.key === '/' && !typing) { e.preventDefault(); this.#el?.querySelector('#mainSearch')?.focus(); }
    if (!typing) {
      if (e.key === 'g' || e.key === 'G') store.setState({ view: 'gallery' });
      if (e.key === 'r' || e.key === 'R') store.setState({ view: 'ranking' });
      if (e.key === 'f' || e.key === 'F') store.setState({ onlyFavs: !store.get('onlyFavs') });
      if (e.key === 'd' || e.key === 'D') this.#el?.querySelector('#themeToggle')?.click();
    }
  }

  // ── Sincronizadores ────────────────────────────────────────
  #syncAll() {
    this.#syncTheme();
    this.#syncNav();
    this.#syncCompareBtn();
    this.#syncViewBtns(store.get('view'));
    this.#syncDensityBtn(prefs.get('display', 'cardDensity'));

    const catFilter = this.#el?.querySelector('#catFilter');
    if (catFilter) catFilter.value = store.get('cat') || 'all';
  }

  #syncTheme() {
    const theme = prefs.getThemeAttr();
    applyThemeToDom(theme);
    this.#el?.querySelector('#themeToggle')?.setAttribute('aria-label',
      `Tema: ${theme} — click para cambiar`);
  }

  #syncNav() {
    const route = store.get('currentRoute');
    this.#el?.querySelectorAll('.nav-link').forEach(link => {
      const href  = link.getAttribute('href');
      const active = href === '/' ? route === '/' : route.startsWith(href);
      link.classList.toggle('active', active);
      link.setAttribute('aria-current', active ? 'page' : 'false');
    });
    // Settings btn activo
    this.#el?.querySelector('.settings-btn')?.classList.toggle('active', route === '/settings');
  }

  #syncViewBtns(view) {
    this.#el?.querySelectorAll('.view-btn').forEach(btn => {
      const a = btn.dataset.view === view;
      btn.classList.toggle('active', a);
      btn.setAttribute('aria-pressed', a);
    });
  }

  #syncDensityBtn(density) {
    this.#el?.querySelectorAll('.density-btn').forEach(btn => {
      const a = btn.dataset.density === density;
      btn.classList.toggle('active', a);
      btn.setAttribute('aria-pressed', a);
      btn.innerHTML = DENSITY_ICONS[btn.dataset.density];
    });
    document.documentElement.setAttribute('data-density', density);
  }

  #syncCompareBtn() {
    const count = store.get('compareList').length;
    const btn   = this.#el?.querySelector('#compareNavBtn');
    if (!btn) return;
    btn.classList.toggle('has-items', count > 0);
    const badge = btn.querySelector('.compare-badge');
    if (count > 0) {
      if (badge) { badge.textContent = count; badge.setAttribute('aria-label', `${count} aeronaves`); }
      else btn.insertAdjacentHTML('beforeend', `<span class="compare-badge" aria-label="${count} aeronaves">${count}</span>`);
    } else { badge?.remove(); }
  }
}
