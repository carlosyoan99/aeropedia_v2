/**
 * components/Header.js — Barra de navegación principal
 * Solo navegación + tema + hamburger mobile. Sin controles de contexto.
 */

import { store }  from '../store/index.js';
import { prefs, applyThemeToDom } from '../store/preferences.js';
import { router } from '../router/index.js';

export class Header {
  #el              = null;
  #subs            = [];
  #boundOnKey      = null;   // referencia guardada para removeEventListener
  #boundOutside    = null;

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
      store.subscribe('compareList',  () => this.#syncCompareBtn()),
      prefs.subscribe('display',      () => this.#syncTheme()),
    );
    return this.#el;
  }

  destroy() {
    this.#subs.forEach(u => u());
    if (this.#boundOnKey)   document.removeEventListener('keydown', this.#boundOnKey);
    if (this.#boundOutside) document.removeEventListener('click',   this.#boundOutside);
  }

  // ── Template ───────────────────────────────────────────────
  #template() {
    const s = store.getState();
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

        <nav class="main-nav" id="mainNav" aria-label="Navegación principal">
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
          <a href="/stats" data-link class="nav-link" data-page="stats">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
            Stats
          </a>
        </nav>

        <div class="header-controls">

          <!-- Comparador -->
          <button id="compareNavBtn"
            class="header-btn icon-btn ${s.compareList.length ? 'has-items' : ''}"
            title="Ver comparador" aria-label="Comparador de aeronaves">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
            </svg>
            ${s.compareList.length ? `<span class="compare-badge">${s.compareList.length}</span>` : ''}
          </button>

          <!-- Tema -->
          <button id="themeToggle" class="header-btn icon-btn theme-btn"
            aria-label="Cambiar tema" title="Cambiar tema (D)">
            <span class="theme-icon-sun"  aria-hidden="true">☀</span>
            <span class="theme-icon-moon" aria-hidden="true">☽</span>
            <span class="theme-icon-hc"   aria-hidden="true">◑</span>
          </button>

          <!-- Ayuda -->
          <a href="/help" data-link class="header-btn icon-btn help-btn"
            aria-label="Ayuda" title="Ayuda">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
            </svg>
          </a>

          <!-- Settings -->
          <a href="/settings" data-link class="header-btn icon-btn settings-btn"
            aria-label="Configuración" title="Configuración (Ctrl+,)">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
              <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>
            </svg>
          </a>

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

  // ── Eventos ────────────────────────────────────────────────
  #bindEvents() {
    // Comparador
    this.#el.querySelector('#compareNavBtn')?.addEventListener('click', () => {
      router.navigate('/compare');
    });

    // Tema
    this.#el.querySelector('#themeToggle')?.addEventListener('click', () => {
      const themes = ['dark', 'light', 'high-contrast'];
      const cur    = prefs.get('display', 'theme') || 'dark';
      const next   = themes[(themes.indexOf(cur) + 1) % themes.length];
      prefs.setOne('display', 'theme', next);
      store.setState({ theme: next });
    });

    // Hamburger
    this.#el.querySelector('#navToggle')?.addEventListener('click', () => {
      this.#toggleMobileNav();
    });

    // Cerrar nav al hacer clic en un enlace
    this.#el.querySelector('#mainNav')?.addEventListener('click', (e) => {
      if (e.target.closest('[data-link]')) this.#closeMobileNav();
    });

    // Guardar referencias bound para poder eliminarlas en destroy()
    this.#boundOnKey   = (e) => this.#handleKey(e);
    this.#boundOutside = (e) => this.#handleOutside(e);
    document.addEventListener('keydown', this.#boundOnKey);
    document.addEventListener('click',   this.#boundOutside);
  }

  #handleKey(e) {
    const tag    = document.activeElement?.tagName.toLowerCase();
    const typing = ['input', 'select', 'textarea'].includes(tag);
    if (typing) return;
    if (e.key === 'd' || e.key === 'D') this.#el?.querySelector('#themeToggle')?.click();
    if (e.key === 'Escape') this.#closeMobileNav();
  }

  #handleOutside(e) {
    const nav    = this.#el?.querySelector('#mainNav');
    const toggle = this.#el?.querySelector('#navToggle');
    if (nav?.classList.contains('nav-open')
        && !nav.contains(e.target)
        && !toggle?.contains(e.target)) {
      this.#closeMobileNav();
    }
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

  // ── Sincronizadores ────────────────────────────────────────
  #syncAll() {
    this.#syncTheme();
    this.#syncNav();
    this.#syncCompareBtn();
  }

  #syncTheme() {
    applyThemeToDom(prefs.getThemeAttr());
  }

  #syncNav() {
    const route = store.get('currentRoute') || '/';
    this.#el?.querySelectorAll('[data-page]').forEach(link => {
      const href   = link.getAttribute('href');
      const active = href === '/' ? route === '/' : route.startsWith(href);
      link.classList.toggle('active', !!active);
      link.setAttribute('aria-current', active ? 'page' : 'false');
    });
    this.#el?.querySelector('.settings-btn')?.classList.toggle('active', route === '/settings');
    this.#el?.querySelector('.help-btn')?.classList.toggle('active', route === '/help');
  }

  #syncCompareBtn() {
    const count = store.get('compareList').length;
    const btn   = this.#el?.querySelector('#compareNavBtn');
    if (!btn) return;
    btn.classList.toggle('has-items', count > 0);
    const badge = btn.querySelector('.compare-badge');
    if (count > 0) {
      if (badge) badge.textContent = count;
      else btn.insertAdjacentHTML('beforeend', `<span class="compare-badge">${count}</span>`);
    } else {
      badge?.remove();
    }
  }
}
