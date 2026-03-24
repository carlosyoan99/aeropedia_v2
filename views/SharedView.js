/**
 * views/SharedView.js — Vista de solo lectura de colección compartida
 * Ruta: /shared?ids=<base64> o /shared?col=<colId>
 */

import { store }  from '../store/index.js';
import { router } from '../router/index.js';
import { setPageMeta, FALLBACK_IMG, genBadgeHTML, showToast } from '../utils/index.js';

export class SharedView {
  #el = null;

  async render() {
    setPageMeta({
      title: 'Colección compartida — AeroPedia',
      description: 'Colección de aeronaves compartida desde AeroPedia.',
    });

    this.#el = document.createElement('div');
    this.#el.className = 'shared-view';

    // Decodificar IDs desde URL
    const params  = new URLSearchParams(location.search);
    const encoded = params.get('ids') || '';
    const ids     = encoded ? store.decodeShareUrl(encoded) : [];

    if (!ids.length) {
      this.#el.innerHTML = `<div class="not-found-inner">
        <p class="not-found-code mono">?</p>
        <p class="not-found-title">Colección vacía o enlace inválido</p>
        <a href="/" data-link class="btn-back-home">← Ir al archivo</a>
      </div>`;
      return this.#el;
    }

    const aircraftDB = store.get('aircraftDB');
    const planes     = ids.map(id => aircraftDB.find(p => p.id === id)).filter(Boolean);

    this.#el.innerHTML = `
      <div class="shared-header">
        <button class="btn-back" onclick="history.back()" aria-label="Volver atrás">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>
        Volver
      </button>
        <div>
          <h1 class="shared-title">Colección compartida</h1>
          <p class="shared-sub">${planes.length} aeronaves · Solo lectura</p>
        </div>
        <button id="importAllBtn" class="btn-detail" style="flex-shrink:0" aria-label="Añadir todo a favoritos">
          <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          Guardar todo en favoritos
        </button>
      </div>

      <div class="gallery-grid" style="margin-top:1rem">
        ${planes.map(p => `
          <article class="card" data-id="${p.id}" style="cursor:pointer" role="button" tabindex="0"
            aria-label="Ver ficha de ${p.name}">
            <div class="card-img-wrap">
              <img src="./public/min/${p.img?.[0] ?? p.img}.webp" alt="${p.name}"
                loading="lazy" width="280" height="158"
                onerror="this.src='${FALLBACK_IMG}'">
              <span class="card-badge-type">${p.type}</span>
            </div>
            <div class="card-body">
              <h2 class="card-name">${p.name}</h2>
              <div class="card-tags">
                <span class="card-tag tag-country">${p.country}</span>
                <span class="card-tag tag-year mono">${p.year}</span>
                ${genBadgeHTML(p)}
              </div>
              <div class="shared-stats">
                <span>⚡ ${p.speed.toLocaleString('es-ES')} km/h</span>
                <span>📡 ${p.ceiling.toLocaleString('es-ES')} m</span>
                <span>🗺 ${p.range.toLocaleString('es-ES')} km</span>
              </div>
            </div>
          </article>`).join('')}
      </div>`;

    // Events
    this.#el.querySelectorAll('[data-id]').forEach(card => {
      card.addEventListener('click', () => router.navigate(`/aircraft/${card.dataset.id}`));
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.navigate(`/aircraft/${card.dataset.id}`); }
      });
    });

    this.#el.querySelector('#importAllBtn')?.addEventListener('click', () => {
      let added = 0;
      for (const id of ids) {
        if (!store.isFav(id) && store.get('aircraftDB').find(p => p.id === id)) {
          store.toggleFav(id);
          added++;
        }
      }
      showToast(`✓ ${added} aeronaves añadidas a favoritos`);
    });

    return this.#el;
  }
}
