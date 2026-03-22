/**
 * components/PWAInstallBanner.js — Banner de instalación PWA
 * Muestra el banner tras la 2ª visita, respeta el dismiss persistido en prefs.
 * Soporte: beforeinstallprompt (Chrome/Edge) + guía manual (iOS/Safari).
 */

import { prefs }    from '../store/preferences.js';
import { showToast } from '../utils/index.js';

let deferredPrompt = null;  // BeforeInstallPromptEvent

export class PWAInstallBanner {
  #el       = null;
  #mounted  = false;

  init() {
    // Capturar el evento nativo antes de que el navegador lo muestre
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      this.#maybeShow();
    });

    // En iOS no hay beforeinstallprompt, detectar por user-agent
    if (this.#isIOS() && !this.#isInStandaloneMode()) {
      // Mostrar después de un breve delay para no bloquear el render inicial
      setTimeout(() => this.#maybeShow(), 3000);
    }

    // Cuando se instala exitosamente
    window.addEventListener('appinstalled', () => {
      prefs.set('pwa', { installDismissed: true });
      this.#hide();
      showToast('✓ AeroPedia instalada correctamente');
    });

    // Escuchar mensajes del Service Worker para mostrar toast de actualización
    navigator.serviceWorker?.addEventListener('message', (e) => {
      if (e.data?.type === 'SW_UPDATED') this.#showUpdateToast();
    });
  }

  #maybeShow() {
    if (prefs.shouldShowInstallBanner() && !this.#mounted && !this.#isInStandaloneMode()) {
      this.#mount();
    }
  }

  #mount() {
    if (this.#mounted) return;
    this.#mounted = true;

    this.#el = document.createElement('div');
    this.#el.className = 'pwa-banner';
    this.#el.setAttribute('role', 'complementary');
    this.#el.setAttribute('aria-label', 'Instalar AeroPedia');
    this.#el.innerHTML = this.#isIOS() ? this.#iosTemplate() : this.#nativeTemplate();

    document.body.appendChild(this.#el);
    requestAnimationFrame(() => this.#el.classList.add('pwa-banner--visible'));

    this.#el.querySelector('#pwaDismiss')?.addEventListener('click', () => {
      prefs.dismissInstallBanner();
      this.#hide();
    });

    this.#el.querySelector('#pwaInstall')?.addEventListener('click', () => {
      this.#triggerInstall();
    });
  }

  async #triggerInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome === 'dismissed') prefs.dismissInstallBanner();
    this.#hide();
  }

  #hide() {
    if (!this.#el) return;
    this.#el.classList.remove('pwa-banner--visible');
    setTimeout(() => { this.#el?.remove(); this.#el = null; this.#mounted = false; }, 400);
  }

  #nativeTemplate() {
    return `
      <div class="pwa-banner-inner">
        <div class="pwa-banner-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="24" height="24">
            <path d="M21 16l-9-4-9 4 9-1.5L21 16z"/>
            <path d="M3 16v2l9-1.5 9 1.5v-2"/>
          </svg>
        </div>
        <div class="pwa-banner-text">
          <p class="pwa-banner-title">Instalar AeroPedia</p>
          <p class="pwa-banner-sub">Acceso rápido sin necesidad de navegador</p>
        </div>
        <div class="pwa-banner-actions">
          <button id="pwaInstall" class="pwa-btn-install">Instalar</button>
          <button id="pwaDismiss" class="pwa-btn-dismiss" aria-label="Cerrar">×</button>
        </div>
      </div>`;
  }

  #iosTemplate() {
    return `
      <div class="pwa-banner-inner">
        <div class="pwa-banner-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="24" height="24">
            <path d="M21 16l-9-4-9 4 9-1.5L21 16z"/>
          </svg>
        </div>
        <div class="pwa-banner-text">
          <p class="pwa-banner-title">Instalar en iPhone / iPad</p>
          <p class="pwa-banner-sub">Toca <strong>Compartir</strong> → <strong>Añadir a pantalla de inicio</strong></p>
        </div>
        <button id="pwaDismiss" class="pwa-btn-dismiss" aria-label="Cerrar">×</button>
      </div>`;
  }

  #showUpdateToast() {
    const toast = document.createElement('div');
    toast.className = 'pwa-update-toast';
    toast.innerHTML = `
      <div class="pwa-update-inner">
        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
          <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
        </svg>
        <div>
          <p class="pwa-update-title">Nueva versión disponible</p>
          <p class="pwa-update-sub">Recarga para aplicar la actualización</p>
        </div>
        <button class="pwa-update-reload" onclick="location.reload()">Recargar</button>
        <button class="pwa-update-close" onclick="this.parentElement.parentElement.remove()" aria-label="Cerrar">×</button>
      </div>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('pwa-update-toast--visible'));
  }

  #isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  #isInStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }
}

// ── Registrar Service Worker ──────────────────────────────────
export async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });

    // Detectar actualizaciones
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker?.addEventListener('statechange', () => {
        if (newWorker.statechange === 'installed' && navigator.serviceWorker.controller) {
          // Hay una nueva versión esperando — notificar al cliente
          navigator.serviceWorker.controller?.postMessage({ type: 'SW_UPDATED' });
        }
      });
    });

    // Verificar actualizaciones cada 30 minutos
    setInterval(() => reg.update(), 30 * 60 * 1000);

    console.info('[SW] Registrado correctamente:', reg.scope);
  } catch (err) {
    console.warn('[SW] Error al registrar:', err);
  }
}
