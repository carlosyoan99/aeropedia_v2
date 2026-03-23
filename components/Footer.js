/**
 * components/Footer.js — Footer global + FAB (Floating Action Bar)
 * La FAB soluciona el problema de controles lejos en páginas largas:
 * aparece flotando en la esquina inferior derecha con Inicio, Favoritos y Subir.
 */

import { store }  from '../store/index.js';
import { prefs, applyThemeToDom } from '../store/preferences.js';

export class Footer {
  #el  = null;
  #fab = null;

  render() {
    // Footer
    this.#el = document.createElement('footer');
    this.#el.className = 'site-footer';
    this.#el.setAttribute('role', 'contentinfo');
    this.#el.innerHTML = `
      <div class="footer-inner">
        <div class="footer-left">
          <a href="/" data-link class="footer-logo">AERO<span>PEDIA</span></a>
          <span class="footer-tagline">Enciclopedia interactiva de aviación militar · 196 aeronaves</span>
        </div>
        <nav class="footer-links" aria-label="Navegación del pie de página">
          <a href="/"          data-link class="footer-link">Archivo</a>
          <a href="/compare"   data-link class="footer-link">Comparar</a>
          <a href="/favorites" data-link class="footer-link">Favoritos</a>
          <a href="/theater"   data-link class="footer-link">Teatro</a>
          <a href="/stats"     data-link class="footer-link">Estadísticas</a>
          <a href="/kills"     data-link class="footer-link">Combate</a>
          <a href="/fleets"    data-link class="footer-link">Flotas</a>
          <a href="/mach"      data-link class="footer-link">Mach</a>
          <a href="/help"      data-link class="footer-link">Ayuda</a>
          <a href="/settings"  data-link class="footer-link">Ajustes</a>
        </nav>
        <div class="footer-bottom">
          <span>Proyecto educativo · Zero dependencias externas · Datos verificados</span>
          <span>Desarrollado con Claude (Anthropic)</span>
        </div>
      </div>`;

    // FAB — aparece solo cuando el usuario ha hecho scroll
    this.#fab = document.createElement('div');
    this.#fab.className = 'fab-bar';
    this.#fab.setAttribute('aria-label', 'Acciones rápidas');
    this.#fab.innerHTML = `
      <button class="fab-btn" id="fabTop" title="Ir arriba" aria-label="Volver al inicio de la página">
        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
          <path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"/>
        </svg>
      </button>

      <button class="fab-btn" id="fabTheme" title="Cambiar tema" aria-label="Cambiar tema">
        <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
        </svg>
      </button>`;

    this.#fab.style.opacity = '0';
    this.#fab.style.pointerEvents = 'none';
    this.#fab.style.transition = 'opacity .25s ease';
    document.body.appendChild(this.#fab);

    this.#bindEvents();
    return this.#el;
  }

  #bindEvents() {
    // Show FAB when scrolled > 200px
    window.addEventListener('scroll', () => {
      const show = window.scrollY > 200;
      if (this.#fab) {
        this.#fab.style.opacity    = show ? '1' : '0';
        this.#fab.style.pointerEvents = show ? 'auto' : 'none';
      }
    }, { passive: true });

    this.#fab?.querySelector('#fabTop')?.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

this.#fab?.querySelector('#fabTheme')?.addEventListener('click', () => {
      const themes = ['dark', 'light', 'high-contrast'];
      const cur  = prefs.get('display', 'theme') || 'dark';
      const next = themes[(themes.indexOf(cur) + 1) % themes.length];
      prefs.setOne('display', 'theme', next);
      store.setState({ theme: next });
    });
  }

  destroy() {
    this.#fab?.remove();
  }
}
