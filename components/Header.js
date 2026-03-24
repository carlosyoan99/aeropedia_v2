/**
 * components/Header.js
 * Nav fixed: logo + main links + "Más" dropdown + compare badge + theme + hamburger
 */

import { store, selectCompareList }  from '../store/index.js';
import { prefs, applyThemeToDom } from '../store/preferences.js';
import { router } from '../router/index.js';

const NAV_PRIMARY = [
  { href: '/',          page: 'home',      label: 'Archivo',   icon: '<path d="M2 11l8-8 8 8v7a1 1 0 01-1 1h-5v-4H6v4H3a1 1 0 01-1-1v-7z"/>' },
  { href: '/favorites', page: 'favorites', label: 'Favoritos', icon: '<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>' },
  { href: '/theater',   page: 'theater',   label: 'Teatro',    icon: '<path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>' },
];

const NAV_MORE = [
  { href: '/kills',   page: 'kills',   label: 'Combate',     icon: '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V7z" clip-rule="evenodd"/>' },
  { href: '/fleets',  page: 'fleets',  label: 'Flotas',      icon: '<path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10z" clip-rule="evenodd"/>' },
  { href: '/mach',    page: 'mach',    label: 'Calculadora Mach', icon: '<path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/>' },
  { href: '/stats',   page: 'stats',   label: 'Estadísticas', icon: '<path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>' },
  { href: '/settings', page: 'settings', label: 'Configuración', icon: '<path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>' },
  { href: '/help',    page: 'help',    label: 'Ayuda',        icon: '<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>' },
];

function navIcon(d) {
  return `<svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true">${d}</svg>`;
}

export class Header {
  #el           = null;
  #subs         = [];
  #boundKey     = null;
  #boundOutside = null;

  render() {
    this.#el = document.createElement('header');
    this.#el.className = 'site-header';
    this.#el.setAttribute('role', 'banner');
    this.#el.innerHTML = this.#template();
    this.#bindEvents();
    this.#syncAll();

    this.#subs.push(
      store.subscribe('theme',        () => this.#syncTheme()),
      store.subscribe('currentRoute', () => this.#syncNav()),
      store.subscribe('compareList',  () => this.#syncCompareLink()),
      prefs.subscribe('display',      () => this.#syncTheme()),
    );
    return this.#el;
  }

  destroy() {
    this.#subs.forEach(u => u());
    if (this.#boundKey)     document.removeEventListener('keydown', this.#boundKey);
    if (this.#boundOutside) document.removeEventListener('click',   this.#boundOutside);
  }

  #template() {
    const cmpCount = (selectCompareList(store.getState())).length;
    const primaryLinks = NAV_PRIMARY.map(n => `
      <a href="${n.href}" data-link class="nav-link" data-page="${n.page}">
        ${navIcon(n.icon)}${n.label}
      </a>`).join('');

    const moreItems = NAV_MORE.map(n => `
      <a href="${n.href}" data-link class="nav-link nav-dropdown-item" data-page="${n.page}">
        ${navIcon(n.icon)}${n.label}
      </a>`).join('');

    return `
    <div class="header-inner">
      <div class="header-row">

        <!-- Logo -->
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

        <!-- Desktop nav -->
        <nav class="main-nav" id="mainNav" aria-label="Navegación principal">
          ${primaryLinks}

          <!-- Comparar con badge -->
          <a href="/compare" data-link class="nav-link nav-link--compare" data-page="compare" aria-label="Comparador">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
            Comparar
            ${cmpCount ? `<span class="nav-badge" id="navCompareBadge">${cmpCount}</span>` : `<span class="nav-badge hidden" id="navCompareBadge"></span>`}
          </a>

          <!-- Más dropdown -->
          <div class="nav-more" id="navMore">
            <button class="nav-link nav-more-btn" id="navMoreBtn"
              aria-haspopup="true" aria-expanded="false" aria-controls="navMoreMenu">
              Más
              <svg viewBox="0 0 20 20" fill="currentColor" width="11" height="11" aria-hidden="true" class="nav-more-chevron">
                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
            </button>
            <div class="nav-dropdown" id="navMoreMenu" role="menu" aria-hidden="true">
              ${moreItems}
            </div>
          </div>
        </nav>

        <!-- Right controls -->
        <div class="header-controls">
          <!-- Tema -->
          <button id="themeToggle" class="header-btn icon-btn theme-btn"
            aria-label="Cambiar tema" title="Cambiar tema (D)">
            <span class="theme-icon-sun"  aria-hidden="true">☀</span>
            <span class="theme-icon-moon" aria-hidden="true">☽</span>
            <span class="theme-icon-hc"   aria-hidden="true">◑</span>
          </button>

          <!-- Hamburger (solo mobile) -->
          <button id="navToggle" class="header-btn icon-btn nav-toggle-btn"
            aria-label="Abrir menú" aria-expanded="false" aria-controls="mainNav">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
              <path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
      </div>
    </div>`;
  }

  #bindEvents() {
    // Tema
    this.#el.querySelector('#themeToggle')?.addEventListener('click', () => {
      const themes = ['dark', 'light', 'high-contrast'];
      const cur    = prefs.get('display', 'theme') || 'dark';
      const next   = themes[(themes.indexOf(cur) + 1) % themes.length];
      prefs.setOne('display', 'theme', next);
      store.setState({ theme: next });
    });

    // Hamburger
    this.#el.querySelector('#navToggle')?.addEventListener('click', () => this.#toggleMobileNav());
    this.#el.querySelector('#mainNav')?.addEventListener('click', (e) => {
      if (e.target.closest('[data-link]')) this.#closeMobileNav();
    });

    // "Más" dropdown
    this.#el.querySelector('#navMoreBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#toggleDropdown();
    });

    // Arrow fn stored for cleanup
    this.#boundKey     = (e) => this.#handleKey(e);
    this.#boundOutside = (e) => this.#handleOutside(e);
    document.addEventListener('keydown', this.#boundKey);
    document.addEventListener('click',   this.#boundOutside);
  }

  #handleKey(e) {
    const tag    = document.activeElement?.tagName.toLowerCase();
    const typing = ['input', 'select', 'textarea'].includes(tag);
    if (typing) return;
    if (e.key === 'd' || e.key === 'D') this.#el?.querySelector('#themeToggle')?.click();
    if (e.key === 'Escape') { this.#closeMobileNav(); this.#closeDropdown(); }
  }

  #handleOutside(e) {
    // Close mobile nav
    const nav    = this.#el?.querySelector('#mainNav');
    const toggle = this.#el?.querySelector('#navToggle');
    if (nav?.classList.contains('nav-open')
        && !nav.contains(e.target) && !toggle?.contains(e.target)) {
      this.#closeMobileNav();
    }
    // Close dropdown
    if (!this.#el?.querySelector('#navMore')?.contains(e.target)) {
      this.#closeDropdown();
    }
  }

  #toggleDropdown() {
    const menu = this.#el?.querySelector('#navMoreMenu');
    const btn  = this.#el?.querySelector('#navMoreBtn');
    const open = menu?.getAttribute('aria-hidden') === 'false';
    if (open) {
      this.#closeDropdown();
    } else {
      // Position fixed dropdown relative to the button
      if (menu && btn) {
        const rect = btn.getBoundingClientRect();
        menu.style.top   = `${rect.bottom + 6}px`;
        menu.style.right = `${window.innerWidth - rect.right}px`;
      }
      menu?.setAttribute('aria-hidden', 'false');
      menu?.classList.add('open');
      btn?.setAttribute('aria-expanded', 'true');
    }
  }

  #closeDropdown() {
    const menu = this.#el?.querySelector('#navMoreMenu');
    const btn  = this.#el?.querySelector('#navMoreBtn');
    menu?.setAttribute('aria-hidden', 'true');
    menu?.classList.remove('open');
    btn?.setAttribute('aria-expanded', 'false');
  }

  #toggleMobileNav() {
    const nav    = this.#el?.querySelector('#mainNav');
    const toggle = this.#el?.querySelector('#navToggle');
    if (nav?.classList.contains('nav-open')) {
      this.#closeMobileNav();
    } else {
      nav?.classList.add('nav-open');
      toggle?.setAttribute('aria-expanded', 'true');
      toggle?.setAttribute('aria-label', 'Cerrar menú');
    }
  }

  #closeMobileNav() {
    const nav    = this.#el?.querySelector('#mainNav');
    const toggle = this.#el?.querySelector('#navToggle');
    nav?.classList.remove('nav-open');
    toggle?.setAttribute('aria-expanded', 'false');
    toggle?.setAttribute('aria-label', 'Abrir menú');
  }

  // ── Sync ───────────────────────────────────────────────────
  #syncAll() { this.#syncTheme(); this.#syncNav(); this.#syncCompareLink(); }

  #syncTheme() { applyThemeToDom(prefs.getThemeAttr()); }

  #syncNav() {
    const route = store.get('currentRoute') || '/';
    this.#el?.querySelectorAll('[data-page]').forEach(link => {
      const href   = link.getAttribute('href');
      const active = href === '/' ? route === '/' : route?.startsWith(href);
      link.classList.toggle('active', !!active);
      link.setAttribute('aria-current', active ? 'page' : 'false');
    });
    // Mark "Más" btn active if current page is inside it
    const morePages = NAV_MORE.map(n => n.href);
    const moreActive = morePages.some(h => h === '/' ? route === '/' : route?.startsWith(h));
    this.#el?.querySelector('#navMoreBtn')?.classList.toggle('active', moreActive);
  }

  #syncCompareLink() {
    const count = (store.get('compareList') || []).length;
    const badge = this.#el?.querySelector('#navCompareBadge');
    if (!badge) return;
    badge.textContent = count || '';
    badge.classList.toggle('hidden', count === 0);
  }
}
