/**
 * views/HomeView.js — Galería + Ranking + Búsqueda avanzada +
 *                     Panel de recientes + Comparación rápida inline +
 *                     Timeline panel + Filtro por conflicto
 */

import { store, selectAircraftDB, selectCategories, selectFavs, selectTimeline, selectSearch, selectCat, selectOnlyFavs } from '../store/index.js';
import { prefs }  from '../store/preferences.js';
import { router } from '../router/index.js';
import {
  genBadgeHTML, formatStat, FALLBACK_IMG, lazyLoad, setPageMeta, debounce,
  parseAdvancedQuery, matchAdvancedQuery, getQueryHints,
} from '../utils/index.js';

const STAT_COLORS = {
  speed: '#3b82f6', range: '#8b5cf6', ceiling: '#06b6d4', mtow: '#f59e0b', year: '#10b981',
};
const TL_MIN = 1940, TL_MAX = 2030, TL_STEP = 10;

export class HomeView {
  #el      = null;
  #unsubs  = [];
  #tl      = { open: false };

  async render() {
    setPageMeta({
      title: 'AeroPedia — Archivo Global de Aviación',
      description: 'Enciclopedia interactiva de aviación militar.',
    });

    this.#el = document.createElement('div');
    this.#el.className = 'home-view';
    this.#el.innerHTML = this.#scaffold();

    this.#bindEvents();
    this.#subscribeStore();
    this.#applyDensityPrefs();
    // If data is already loaded (e.g. navigating back), render immediately.
    // Otherwise wait for store.subscribe('aircraftDB') which fires after load.
    if (store.get('aircraftDB')?.length) {
      // Data already loaded (e.g. navigating back)
      this.#renderAll();
      this.#updateCompareBar();
    } else {
      // Data loading in background — show skeleton
      this.#renderSkeleton();
      this.#updateCompareBar();
    }
    // Only react to cardDensity/galleryColumns/showStatBars changes, not all display prefs
    this.#unsubs.push(prefs.subscribe('display', (d) => {
      const density  = d.cardDensity || 'normal';
      const cols     = d.galleryColumns || 'auto';
      const gallery  = this.#el?.querySelector('#gallery');
      if (!gallery) return;
      const changed = gallery.dataset.density !== density
        || document.documentElement.getAttribute('data-gallery-cols') !== cols;
      if (changed) this.#applyDensityPrefs();
    }));

    return this.#el;
  }


  // ── Skeleton UI (muestra mientras cargan los datos) ──────────
  #renderSkeleton() {
    const gallery = this.#el?.querySelector('#gallery');
    if (!gallery) return;
    // 8 skeleton cards
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 8; i++) {
      const card = document.createElement('div');
      card.className = 'card card--skeleton';
      card.setAttribute('aria-hidden', 'true');
      card.innerHTML = `
        <div class="skeleton" style="height:135px;border-radius:var(--radius-lg) var(--radius-lg) 0 0"></div>
        <div style="padding:.75rem;display:flex;flex-direction:column;gap:.5rem">
          <div class="skeleton" style="height:.9rem;width:70%;border-radius:4px"></div>
          <div class="skeleton" style="height:.75rem;width:45%;border-radius:4px"></div>
          <div class="skeleton" style="height:.7rem;width:55%;border-radius:4px;margin-top:.25rem"></div>
        </div>`;
      frag.appendChild(card);
    }
    gallery.innerHTML = '';
    gallery.appendChild(frag);
  }

  destroy() {
    this.#unsubs.forEach(u => u());
  }

  // ── Scaffold ──────────────────────────────────────────────────
  #scaffold() {
    const sort = store.get('sortStat');
    return `
      <!-- Controles del archivo: búsqueda + filtros + vista + acciones -->
      <div class="archive-controls" role="search" aria-label="Controles del archivo">
        <div class="archive-controls-row1">

          <!-- Búsqueda con hint de operadores -->
          <div class="search-wrap archive-search" role="search">
            <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
            </svg>
            <input type="search" id="mainSearch" class="search-input"
              placeholder="Buscar aeronave, país, ID… (p. ej. f35, tipo:Caza)"
              aria-label="Buscar aeronave" autocomplete="off" value="">
            <kbd class="search-kbd" aria-hidden="true">/</kbd>
          </div>

          <!-- Filtro de categoría -->
          <select id="catFilter" class="cat-select" aria-label="Filtrar por categoría">
            <option value="all">Todos los tipos</option>
            ${selectCategories(store.getState()).map(t =>
              `<option value="${t}" ${store.get('cat') === t ? 'selected' : ''}>${t}</option>`
            ).join('')}
          </select>

          <!-- Acciones secundarias -->
          <div class="archive-actions">
            <button id="favFilterBtn" class="btn-back archive-btn" title="Ver solo favoritos (F)" aria-expanded="false" aria-label="Favoritos">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
              <span class="archive-btn-label">Favoritos</span>
            </button>
            <button id="recentsBtn" class="btn-back archive-btn" title="Aeronaves vistas recientemente (H)" aria-expanded="false" aria-controls="recentsPanel" aria-label="Recientes">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V7z" clip-rule="evenodd"/></svg>
              <span class="archive-btn-label">Recientes</span>
            </button>
            <button id="timelineToggleBtn" class="btn-back archive-btn timeline-toggle-btn" aria-expanded="false" aria-controls="timelinePanel" title="Filtrar por época (T)" aria-label="Timeline">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zm6-8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z"/></svg>
              <span class="archive-btn-label">Timeline</span>
            </button>
          </div>
        </div>

        <div class="archive-controls-row2">
          <!-- Contador de resultados -->
          <div class="result-bar" role="status" aria-live="polite" aria-atomic="true">
            <span class="result-label">// Mostrando</span>
            <span id="resultCount" class="result-count">0</span>
            <span class="result-label">aeronaves</span>
            <div class="result-divider" aria-hidden="true"></div>
            <span id="resultFilterLabel" class="result-filter"></span>
          </div>

          <!-- View toggle: galería / ranking -->
          <div class="view-toggle" role="group" aria-label="Cambiar vista">
            <button id="viewGalleryBtn" class="view-btn active" data-view="gallery" title="Vista galería (G)" aria-pressed="true">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zm6-8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z"/></svg>
              <span class="view-btn-label">Galería</span>
            </button>
            <button id="viewRankingBtn" class="view-btn" data-view="ranking" title="Vista ranking (R)" aria-pressed="false">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>
              <span class="view-btn-label">Ranking</span>
            </button>
          </div>

          <!-- Densidad de tarjetas (solo galería) -->
          <div class="density-toggle archive-density" id="densityToggle" role="group" aria-label="Densidad de tarjetas">
            <button class="density-btn" data-density="compact" aria-pressed="false" aria-label="Densidad compacta" title="Compacta">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"><path d="M3 4h14v2H3V4zm0 5h14v2H3V9zm0 5h14v2H3v-2z"/></svg>
            </button>
            <button class="density-btn active" data-density="normal" aria-pressed="true" aria-label="Densidad normal" title="Normal">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zm6-8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z"/></svg>
            </button>
            <button class="density-btn" data-density="large" aria-pressed="false" aria-label="Densidad grande" title="Grande">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"><path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zm-8 8h6v6H3v-6zm8 0h6v6h-6v-6z"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Hint de búsqueda avanzada -->
      <div id="searchHint" class="search-hint hidden" aria-live="polite" role="status"></div>

      <!-- Panel de búsqueda avanzada (hint) -->
      <div id="searchHint" class="search-hint hidden" aria-live="polite" role="status"></div>

      <!-- Panel de recientes -->
      <div id="recentsPanel" class="recents-panel hidden" aria-hidden="true" role="region" aria-label="Aeronaves vistas recientemente">
        <div class="recents-panel-header">
          <span class="recents-panel-title">Vistas recientemente</span>
          <button id="clearRecentsBtn" class="recents-clear-btn" aria-label="Limpiar historial">Limpiar</button>
        </div>
        <div id="recentsList" class="recents-list" role="list"></div>
      </div>

      <!-- Timeline panel -->
      <div id="timelinePanel" class="timeline-panel" aria-hidden="true" role="region" aria-label="Filtro por año">
        <div class="timeline-panel-inner">
          <div class="timeline-header">
            <div class="timeline-header-left">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style="color:#60a5fa" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V7z" clip-rule="evenodd"/></svg>
              <span class="timeline-title">Línea de Tiempo</span>
              <span id="timelineRangeLabel" class="timeline-range-label">TODAS LAS ÉPOCAS</span>
            </div>
            <button id="timelineResetBtn" class="timeline-reset-btn" disabled>
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12" aria-hidden="true"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1z" clip-rule="evenodd"/></svg>
              Reset
            </button>
          </div>
          <div id="decadeMarks" class="decade-marks" role="group" aria-label="Décadas"></div>
          <div class="timeline-sliders-wrap">
            <div class="timeline-track-bg"><div id="timelineTrackFill" class="timeline-track-fill"></div></div>
            <input type="range" id="timelineMin" class="timeline-input" min="${TL_MIN}" max="2020" step="${TL_STEP}" value="${TL_MIN}" aria-label="Año inicial">
            <input type="range" id="timelineMax" class="timeline-input" min="1950" max="${TL_MAX}" step="${TL_STEP}" value="${TL_MAX}" aria-label="Año final">
          </div>
          <div class="timeline-ticks" aria-hidden="true">
            ${[1940,1960,1980,2000,2020].map(y => `<span>${y}</span>`).join('')}
          </div>
          <p class="timeline-hint">Arrastra para filtrar por año de entrada en servicio</p>
        </div>
      </div>

      <!-- Galería -->
      <div id="galleryView" role="main">
        <div id="gallery" class="gallery-grid" aria-label="Galería de aeronaves" role="list"></div>
      </div>

      <!-- Ranking -->
      <div id="rankingView" class="hidden" role="main">
        <!-- Pills de ordenación (mobile) -->
        <div class="ranking-pills" role="group" aria-label="Ordenar por">
          <span class="ranking-pills-label">Ordenar por:</span>
          ${['speed','range','ceiling','mtow','year'].map(stat =>
            `<button class="rank-stat-pill ${stat===sort?'active':''}" data-stat="${stat}" aria-pressed="${stat===sort}">
              ${{speed:'Velocidad',range:'Alcance',ceiling:'Techo',mtow:'MTOW',year:'Año'}[stat]}
            </button>`
          ).join('')}
          <!-- Dirección en mobile -->
          <button class="rank-dir-btn" id="rankDirBtn" aria-label="Invertir dirección de ordenación" title="Invertir orden">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" id="rankDirIcon" aria-hidden="true">
              <path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
        <div class="ranking-table-wrap">
          <table class="ranking-table" aria-label="Tabla de ranking">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Aeronave</th>
                <th scope="col" class="sort-th" data-col="speed">
                  <span class="sort-th-inner">Velocidad <span class="sort-icon" aria-hidden="true">↕</span></span>
                </th>
                <th scope="col" class="sort-th hidden-sm" data-col="range">
                  <span class="sort-th-inner">Alcance <span class="sort-icon" aria-hidden="true">↕</span></span>
                </th>
                <th scope="col" class="sort-th hidden-sm" data-col="ceiling">
                  <span class="sort-th-inner">Techo <span class="sort-icon" aria-hidden="true">↕</span></span>
                </th>
                <th scope="col" class="sort-th hidden-md" data-col="mtow">
                  <span class="sort-th-inner">MTOW <span class="sort-icon" aria-hidden="true">↕</span></span>
                </th>
                <th scope="col" class="sort-th hidden-md" data-col="year">
                  <span class="sort-th-inner">Año <span class="sort-icon" aria-hidden="true">↕</span></span>
                </th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody id="rankingBody"></tbody>
          </table>
        </div>
        <!-- Info de ordenación actual (mobile feedback) -->
        <p class="rank-sort-info mono" id="rankSortInfo" aria-live="polite"></p>
      </div>

      <!-- Barra de comparación flotante -->
      <div id="compareBar" class="compare-bar" role="complementary" aria-label="Comparador" aria-hidden="true">
        <div class="compare-bar-inner">
          <div class="compare-bar-left">
            <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" style="color:#60a5fa;flex-shrink:0" aria-hidden="true"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
            <span class="compare-bar-label">Comparación</span>
            <div id="compareSlots" aria-label="Aeronaves seleccionadas"></div>
          </div>
          <div class="compare-bar-right">
            <span id="compareHint" class="compare-hint" aria-live="polite"></span>
            <button id="compareBtn" class="btn-compare" disabled aria-disabled="true">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
              Comparar
            </button>
            <button id="clearCompareBtn" class="btn-cancel">
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12" aria-hidden="true"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ── Suscripciones ──────────────────────────────────────────────
  #subscribeStore() {
    const rerender = debounce(() => this.#renderAll(), 120);
    this.#unsubs.push(
      store.subscribe(['search','cat','onlyFavs','favs','timelineActive','timelineMin',
        'timelineMax','sortStat','sortAsc'], rerender),
      store.subscribe('view',        v => this.#syncView(v)),
      store.subscribe('compareList', () => this.#updateCompareBar()),
      store.subscribe('aircraftDB',  () => { this.#buildDecadeMarks(); this.#syncCatOptions(); this.#renderAll(); this.#updateCompareBar(); }),
      store.subscribe('recents',     () => this.#renderRecentsList()),
    );
  }

  // ── Filtrado avanzado ──────────────────────────────────────────
  #getFiltered() {
    const state = store.getState();
    const aircraftDB   = selectAircraftDB(state);
    const favs         = selectFavs(state);
    const q            = selectSearch(state);
    const cat          = selectCat(state);
    const onlyFavs     = selectOnlyFavs(state);
    const { timelineActive, timelineMin, timelineMax } = selectTimeline(state);

    const parsed = parseAdvancedQuery(q);
    const useAdvanced = q.includes(':');

    // Mostrar hint de operadores activos
    const hintEl = this.#el?.querySelector('#searchHint');
    const hints  = getQueryHints(q);
    if (hintEl) {
      if (hints) {
        hintEl.textContent = `Filtros activos: ${hints}`;
        hintEl.classList.remove('hidden');
      } else {
        hintEl.classList.add('hidden');
      }
    }

    return [...aircraftDB]
      .filter(p => {
        const matchSearch = !q
          ? true
          : useAdvanced
            ? matchAdvancedQuery(p, parsed)
            : p.id.toLowerCase().includes(q.toLowerCase()) ||
              p.name.toLowerCase().includes(q.toLowerCase()) ||
              p.country.toLowerCase().includes(q.toLowerCase()) ||
              p.type.toLowerCase().includes(q.toLowerCase()) ||
              (p.manufacturer || '').toLowerCase().includes(q.toLowerCase());

        const matchCat      = cat === 'all' || p.type === cat;
        const matchFav      = !onlyFavs || favs.includes(p.id);
        const matchTimeline = !timelineActive || (p.year >= timelineMin && p.year <= timelineMax);
        return matchSearch && matchCat && matchFav && matchTimeline;
      });
  }

  #renderAll() {
    const filtered = this.#getFiltered();
    this.#updateCounter(filtered);
    // Render above-the-fold immediately
    this.#renderAboveTheFold(filtered);
    // Defer recents sidebar (lower priority)
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => this.#renderRecentsList(), { timeout: 500 });
    } else {
      setTimeout(() => this.#renderRecentsList(), 100);
    }
  }

  #renderAboveTheFold(filtered) {
    // Reset page only when filter changes (new filtered set)
    if (this.#allFiltered.length && filtered.length !== this.#allFiltered.length) {
      this.#page = 1;
    }
    if ((store.get('view') || 'gallery') === 'gallery') {
      this.#renderGallery(filtered);
    } else {
      this.#renderRanking(filtered);
    }
  }

  #updateCounter(filtered) {
    const countEl = this.#el?.querySelector('#resultCount');
    if (countEl && countEl.textContent !== String(filtered.length))
      countEl.textContent = filtered.length;
    const { cat, search: q, onlyFavs, timelineActive, timelineMin, timelineMax} = store.getState();
    const labels = [];
    if (cat !== 'all') labels.push(cat.toUpperCase());
    if (onlyFavs) labels.push('⭐ FAVORITOS');
    if (timelineActive) labels.push(`${timelineMin}–${timelineMax}`);
    if (q && !q.includes(':')) labels.push(`"${q}"`);
    const lbl = this.#el?.querySelector('#resultFilterLabel');
    if (lbl) lbl.textContent = labels.length ? labels.join(' · ') : 'TODOS LOS MODELOS';
  }

  // ── Galería ────────────────────────────────────────────────────
  #renderGallery(planes) {
    const gallery = this.#el?.querySelector('#gallery');
    if (!gallery) return;
    if (!planes.length) { gallery.innerHTML = this.#emptyState(); return; }

    // Reset page if planes changed meaningfully
    if (planes.length !== this.#allFiltered.length) this.#page = 1;
    // Store full list for load-more
    this.#allFiltered = planes;
    const visible = planes.slice(0, PAGE_SIZE * this.#page);

    // Skip full rebuild if same planes in same order (avoids flicker on minor state changes)
    const currentIds  = [...gallery.querySelectorAll('[id^="card-"]')].map(e => e.id.replace('card-',''));
    const newIds      = planes.map(p => p.id);
    const compareList = store.get('compareList');
    const favs        = store.get('favs');
    const sameIds     = currentIds.length === newIds.length && newIds.every((id, i) => id === currentIds[i]);

    if (sameIds) {
      // Only update fav/compare button states without rebuilding DOM
      planes.forEach(p => {
        const card   = gallery.querySelector(`#card-${p.id}`);
        if (!card) return;
        const isFav  = favs.includes(p.id);
        const isCmp  = compareList.includes(p.id);

        const favBtn = card.querySelector('[data-fav]');
        if (favBtn) {
          favBtn.classList.toggle('active', isFav);
          favBtn.setAttribute('aria-pressed', isFav);
        }

        const cmpBtn = card.querySelector('[data-cmp]');
        if (cmpBtn) {
          cmpBtn.classList.toggle('active', isCmp);
          cmpBtn.setAttribute('aria-pressed', isCmp);
          card.classList.toggle('selected-for-compare', isCmp);
          // Update SVG icon path: checkmark when active, plus when not
          const svgPath = cmpBtn.querySelector('path');
          if (svgPath) {
            svgPath.setAttribute('d', isCmp
              ? 'M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
              : 'M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z'
            );
          }
        }
      });
      return;
    }

    const frag = document.createDocumentFragment();
    for (const plane of planes) frag.appendChild(this.#createCard(plane));
    gallery.innerHTML = '';
    gallery.appendChild(frag);

    // Load-more sentinel (shows when more items exist)
    const existing = gallery.querySelector('.gallery-load-more');
    if (existing) existing.remove();
    if (planes.length > PAGE_SIZE * this.#page) {
      const more = document.createElement('div');
      more.className = 'gallery-load-more';
      more.innerHTML = `<button class="btn-back" id="loadMoreBtn">
        Ver más (${planes.length - PAGE_SIZE * this.#page} restantes)
      </button>`;
      gallery.appendChild(more);
      gallery.querySelector('#loadMoreBtn')?.addEventListener('click', () => {
        this.#page++;
        this.#renderGallery(this.#allFiltered);
      }, { once: true });
    }
    lazyLoad(gallery);
  }

  #createCard(plane) {
    const favActive = store.isFav(plane.id);
    const inCompare = store.get('compareList').includes(plane.id);
    const speedPct   = Math.min((plane.speed   / 3600)  * 100, 100);
    const rangePct   = Math.min((plane.range   / 15000) * 100, 100);
    const ceilingPct = Math.min((plane.ceiling / 25000) * 100, 100);
    const statusMap  = { active:['Activo','active'], prototype:['Prototipo','proto'], limited:['Limitado','limited'] };
    const [statusLabel, statusCls] = statusMap[plane.status] || [null,''];

    const card = document.createElement('article');
    card.className = `card${inCompare ? ' selected-for-compare' : ''}`;
    card.id = `card-${plane.id}`;
    card.setAttribute('role', 'listitem');
    card.innerHTML = `
      ${inCompare ? '<div class="card-selected-bar" aria-hidden="true"></div>' : ''}
      <div class="card-img-wrap">
        <img data-src="./public/min/${plane.img?.[0] ?? plane.img}.webp"
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"
          alt="${plane.name} — ${plane.type}" loading="lazy" width="280" height="158"
          onerror="this.src='${FALLBACK_IMG}'">
        <span class="card-badge-type">${plane.type}</span>
      </div>
      <div class="card-body">
        <h2 class="card-name">${plane.name}</h2>
        <div class="card-tags">
          <span class="card-tag tag-country">${plane.country}</span>
          ${statusLabel ? `<span class="card-tag tag-status ${statusCls}">${statusLabel}</span>` : ''}
          <span class="card-tag tag-year mono">${plane.year}</span>
          ${genBadgeHTML(plane)}
        </div>
        <div class="card-stats">
          <div class="stat-row">
            <span class="stat-label">Velocidad</span>
            <span class="stat-value mono">${plane.speed.toLocaleString('es-ES')} km/h</span>
            <div class="stat-bar-track" aria-hidden="true"><div class="stat-bar-fill sp" style="width:${speedPct}%"></div></div>
          </div>
          <div class="stat-row">
            <span class="stat-label">Techo</span>
            <span class="stat-value mono">${plane.ceiling.toLocaleString('es-ES')} m</span>
            <div class="stat-bar-track" aria-hidden="true"><div class="stat-bar-fill ce" style="width:${ceilingPct}%"></div></div>
          </div>
          <div class="stat-row">
            <span class="stat-label">Alcance</span>
            <span class="stat-value mono">${plane.range.toLocaleString('es-ES')} km</span>
            <div class="stat-bar-track" aria-hidden="true"><div class="stat-bar-fill ra" style="width:${rangePct}%"></div></div>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn-detail" data-id="${plane.id}" aria-label="Ver ficha de ${plane.name}">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/></svg>
            Ficha
          </button>
          <button class="btn-icon fav-btn${favActive?' active':''}" data-fav="${plane.id}"
            aria-label="${favActive?'Quitar de':'Guardar en'} favoritos" aria-pressed="${favActive}">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          </button>
          <button class="btn-icon cmp-btn${inCompare?' active':''}" data-cmp="${plane.id}"
            aria-label="${inCompare?'Quitar de':'Añadir a'} comparación" aria-pressed="${inCompare}">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
              ${inCompare
                ? '<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>'
                : '<path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>'}
            </svg>
          </button>
          <!-- Quick compare button -->
        </div>
      </div>`;
    return card;
  }

  // ── Ranking — FIX: ordenación mobile consistente ────────────────
  #renderRanking(planes) {
    const body = this.#el?.querySelector('#rankingBody');
    if (!body) return;

    const { sortStat, sortAsc } = store.getState();
    const sorted = [...planes].sort((a, b) =>
      sortAsc ? a[sortStat] - b[sortStat] : b[sortStat] - a[sortStat]
    );

    // Skip rebuild when only fav/compare status changed, not the list or sort
    const sortKey = `${sortStat}:${sortAsc}`;
    const newIds  = sorted.map(p => p.id).join(',');
    if (body.dataset.sortKey === sortKey && body.dataset.rowIds === newIds) return;
    body.dataset.sortKey = sortKey;
    body.dataset.rowIds  = newIds;

    const maxVal = sorted.length ? Math.max(...sorted.map(p => p[sortStat])) : 1;
    const color  = STAT_COLORS[sortStat] || '#3b82f6';
    const medals = ['🥇','🥈','🥉'];

    body.innerHTML = sorted.length
      ? sorted.map((p, i) => {
          const pct = (p[sortStat] / maxVal) * 100;
          return `<tr class="rank-row" data-id="${p.id}" tabindex="0" role="button" aria-label="${p.name}: ${formatStat(sortStat, p[sortStat])}">
            <td class="rank-pos mono">${medals[i] || (i+1)}</td>
            <td class="rank-plane">
              <div class="rank-plane-cell">
                <img data-src="./public/min/${p.img?.[0] ?? p.img}.webp"
                  src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"
                  class="rank-thumb" alt="${p.name}" width="50" height="28"
                  onerror="this.src='${FALLBACK_IMG}'">
                <div><p class="rank-name">${p.name}</p><p class="rank-sub mono">${p.country} · ${p.year}</p></div>
              </div>
            </td>
            <td class="rank-stat-cell">
              <span class="mono rank-stat-val" style="color:${color}">${formatStat(sortStat, p[sortStat])}</span>
              <div class="rank-bar-track" aria-hidden="true"><div class="rank-bar-fill" style="width:${pct}%;background:${color}"></div></div>
            </td>
            <td class="mono hidden-sm">${p.range.toLocaleString('es-ES')} km</td>
            <td class="mono hidden-sm">${p.ceiling.toLocaleString('es-ES')} m</td>
            <td class="mono hidden-md">${(p.mtow/1000).toFixed(1)} T</td>
            <td class="mono hidden-md">${p.year}</td>
            <td><span class="rank-type-badge">${p.type}</span></td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="8" class="rank-empty">Sin resultados</td></tr>';

    // Sync headers — incluyendo dirección
    this.#el?.querySelectorAll('.sort-th').forEach(th => {
      const active = th.dataset.col === sortStat;
      th.classList.toggle('sorted', active);
      th.setAttribute('aria-sort', active ? (sortAsc ? 'ascending' : 'descending') : 'none');
      const icon = th.querySelector('.sort-icon');
      if (icon) icon.textContent = active ? (sortAsc ? '↑' : '↓') : '↕';
    });

    // Sync pills
    this.#el?.querySelectorAll('.rank-stat-pill').forEach(b => {
      b.classList.toggle('active', b.dataset.stat === sortStat);
      b.setAttribute('aria-pressed', b.dataset.stat === sortStat);
    });

    // Mobile sort info label
    const info = this.#el?.querySelector('#rankSortInfo');
    if (info) {
      const statLabel = {speed:'Velocidad',range:'Alcance',ceiling:'Techo',mtow:'MTOW',year:'Año'}[sortStat];
      info.textContent = `Ordenado por ${statLabel} ${sortAsc ? '↑ asc.' : '↓ desc.'}`;
    }

    // Mobile dir btn icon
    const dirIcon = this.#el?.querySelector('#rankDirIcon');
    if (dirIcon) {
      dirIcon.innerHTML = sortAsc
        ? '<path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"/>'
        : '<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>';
    }

    lazyLoad(body);
  }

  // ── Quick Compare ──────────────────────────────────────────────

  // ── Recientes ──────────────────────────────────────────────────
  #toggleRecents() {
    const panel = this.#el?.querySelector('#recentsPanel');
    const btn   = this.#el?.querySelector('#recentsBtn');
    const isOpen = !panel?.classList.contains('hidden');
    panel?.classList.toggle('hidden', isOpen);
    panel?.setAttribute('aria-hidden', isOpen);
    btn?.classList.toggle('active', !isOpen);
    btn?.setAttribute('aria-expanded', !isOpen);
    if (!isOpen) this.#renderRecentsList();
  }

  #renderRecentsList() {
    const listEl = this.#el?.querySelector('#recentsList');
    if (!listEl) return;
    const recents = store.get('recents');
    const db      = store.get('aircraftDB');
    const planes  = recents.map(id => db.find(p => p.id === id)).filter(Boolean);

    if (!planes.length) {
      listEl.innerHTML = '<p class="recents-empty">Ninguna aeronave vista aún. Explora el archivo para que aparezcan aquí.</p>';
      return;
    }

    listEl.innerHTML = planes.map(p => `
      <button class="recents-item" data-id="${p.id}" role="listitem" aria-label="Ver ficha de ${p.name}">
        <img src="./public/min/${p.img?.[0] ?? p.img}.webp" alt="" width="52" height="30"
          style="object-fit:cover;border-radius:4px;flex-shrink:0"
          onerror="this.style.display='none'">
        <div class="recents-item-info">
          <span class="recents-item-name">${p.name}</span>
          <span class="recents-item-sub mono">${p.country} · ${p.year}</span>
        </div>
        <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12" style="color:var(--text-4);flex-shrink:0" aria-hidden="true"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
      </button>`).join('');
  }

  // ── Timeline ───────────────────────────────────────────────────
  #toggleTimeline() {
    this.#tl.open = !this.#tl.open;
    const panel = this.#el?.querySelector('#timelinePanel');
    const btn   = this.#el?.querySelector('#timelineToggleBtn');
    panel?.classList.toggle('timeline-panel--open', this.#tl.open);
    panel?.setAttribute('aria-hidden', !this.#tl.open);
    btn?.classList.toggle('active', this.#tl.open);
    btn?.setAttribute('aria-expanded', this.#tl.open);
    if (this.#tl.open) this.#buildDecadeMarks();
  }

  #buildDecadeMarks() {
    const container = this.#el?.querySelector('#decadeMarks');
    if (!container || container.dataset.built) return;
    container.dataset.built = 'true';
    for (let y = TL_MIN; y <= TL_MAX; y += TL_STEP) {
      const btn = document.createElement('button');
      btn.className = 'decade-mark'; btn.dataset.year = y;
      btn.setAttribute('aria-label', `Año ${y}`);
      btn.innerHTML = `<div class="decade-dot"></div><span class="decade-label mono">'${String(y).slice(2)}</span>`;
      btn.addEventListener('click', () => this.#jumpToDecade(y));
      container.appendChild(btn);
    }
    this.#syncTimelineUI();
  }

  #jumpToDecade(year) {
    const minEl = this.#el?.querySelector('#timelineMin');
    const maxEl = this.#el?.querySelector('#timelineMax');
    if (!minEl || !maxEl) return;
    const curMin = parseInt(minEl.value), curMax = parseInt(maxEl.value);
    if (year >= curMin && year <= curMax && curMin !== curMax) {
      minEl.value = year; maxEl.value = year;
    } else {
      minEl.value = Math.min(curMin, year);
      maxEl.value = Math.max(curMax, year);
    }
    this.#onTimelineChange();
  }

  #onTimelineChange() {
    const minEl = this.#el?.querySelector('#timelineMin');
    const maxEl = this.#el?.querySelector('#timelineMax');
    if (!minEl || !maxEl) return;
    let minVal = parseInt(minEl.value), maxVal = parseInt(maxEl.value);
    if (minVal > maxVal) { minVal = maxVal; minEl.value = minVal; }
    const active = !(minVal === TL_MIN && maxVal === TL_MAX);
    store.setState({ timelineMin: minVal, timelineMax: maxVal, timelineActive: active });
    this.#syncTimelineUI();
  }

  #syncTimelineUI() {
    const { timelineMin, timelineMax, timelineActive } = store.getState();
    const label = this.#el?.querySelector('#timelineRangeLabel');
    if (label) label.textContent = timelineActive ? `${timelineMin}–${timelineMax}` : 'TODAS LAS ÉPOCAS';
    const total = TL_MAX - TL_MIN;
    const leftPct  = ((timelineMin - TL_MIN) / total) * 100;
    const rightPct = ((timelineMax - TL_MIN) / total) * 100;
    const fill = this.#el?.querySelector('#timelineTrackFill');
    if (fill) { fill.style.left = `${leftPct}%`; fill.style.width = `${rightPct - leftPct}%`; }
    this.#el?.querySelectorAll('.decade-mark').forEach(m => {
      const y = parseInt(m.dataset.year);
      m.classList.toggle('active', y >= timelineMin && y <= timelineMax);
    });
    const resetBtn = this.#el?.querySelector('#timelineResetBtn');
    if (resetBtn) resetBtn.disabled = !timelineActive;
    this.#el?.querySelector('#timelineToggleBtn')?.classList.toggle('active', timelineActive);
  }
  // ── Compare bar ────────────────────────────────────────────────
  #updateCompareBar() {
    const bar = this.#el?.querySelector('#compareBar');
    if (!bar) return;
    const list = store.get('compareList');
    const db   = store.get('aircraftDB');
    if (!list.length) { bar.classList.remove('visible'); bar.setAttribute('aria-hidden','true'); return; }
    bar.classList.add('visible'); bar.setAttribute('aria-hidden','false');
    const slots = bar.querySelector('#compareSlots');
    if (slots) slots.innerHTML = list.map(id => {
      const p = db.find(x => x.id === id);
      return `<div class="compare-slot"><span>${p?.name || id}</span><button data-remove="${id}" aria-label="Quitar ${p?.name||id}">×</button></div>`;
    }).join('');
    const btn  = bar.querySelector('#compareBtn');
    const hint = bar.querySelector('#compareHint');
    if (btn) { btn.disabled = list.length < 2; btn.setAttribute('aria-disabled', list.length < 2); }
    if (hint) hint.textContent = list.length < 2 ? `Selecciona ${2-list.length} más` : list.length < 3 ? 'Puedes añadir 1 más' : 'Máximo (3)';
  }

  // ── Vista toggle ───────────────────────────────────────────────
  // ── Sync category dropdown from DB ──────────────────────────
  #syncCatOptions() {
    const sel = this.#el?.querySelector('#catFilter');
    if (!sel) return;
    const types = selectCategories(store.getState());
    const cur   = store.get('cat') || 'all';
    sel.innerHTML =
      '<option value="all">Todos los tipos</option>' +
      types.map(t => `<option value="${t}"${cur === t ? ' selected' : ''}>${t}</option>`).join('');
  }

  #syncView(view) {
    const gv = this.#el?.querySelector('#galleryView');
    const rv = this.#el?.querySelector('#rankingView');
    if (!gv || !rv) return;
    const wasGallery = !gv.classList.contains('hidden');
    const nowGallery = view === 'gallery';
    gv.classList.toggle('hidden', !nowGallery);
    rv.classList.toggle('hidden', nowGallery);
    // Sync view buttons
    this.#el?.querySelectorAll('.view-btn').forEach(btn => {
      const a = btn.dataset.view === view;
      btn.classList.toggle('active', a);
      btn.setAttribute('aria-pressed', a);
    });
    // Show density only in gallery view
    const densityToggle = this.#el?.querySelector('#densityToggle');
    if (densityToggle) densityToggle.style.display = nowGallery ? '' : 'none';
    // Only re-render if view type changed
    const galleryEmpty = gv.querySelector('#gallery')?.children.length === 0;
    const rankingEmpty  = rv.querySelector('#rankingBody')?.children.length === 0;
    if (wasGallery !== nowGallery || (galleryEmpty && rankingEmpty)) {
      this.#renderAll();
    }
  }

  // ── Densidad ───────────────────────────────────────────────────
  #applyDensityPrefs() {
    const gallery  = this.#el?.querySelector('#gallery');
    if (!gallery) return;
    const density  = prefs.get('display','cardDensity') || 'normal';
    const cols     = prefs.get('display','galleryColumns') || 'auto';
    const showBars = prefs.get('display','showStatBars') !== false;
    gallery.setAttribute('data-density', density);
    document.documentElement.setAttribute('data-density', density);
    document.documentElement.setAttribute('data-gallery-cols', cols);
    document.documentElement.classList.toggle('no-stat-bars', !showBars);
  }

  // ── Eventos ────────────────────────────────────────────────────
  #bindEvents() {
    // ── Búsqueda (dentro de la vista) ────────────────────────
    const searchInput = this.#el.querySelector('#mainSearch');
    if (searchInput) {
      const debouncedSearch = debounce(e => store.setState({ search: e.target.value }), 380);
      searchInput.addEventListener('input', debouncedSearch);
      searchInput.value = store.get('search') || '';
    }

    // Categoría
    this.#el.querySelector('#catFilter')?.addEventListener('change', e => {
      store.setState({ cat: e.target.value });
    });
    const catEl = this.#el.querySelector('#catFilter');
    if (catEl) catEl.value = store.get('cat') || 'all';

    // View toggle
    this.#el.querySelectorAll('.view-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => store.setState({ view: btn.dataset.view }));
    });

    // Densidad de tarjetas
    this.#el.querySelectorAll('.density-btn').forEach(btn => {
      btn.addEventListener('click', () => prefs.setOne('display', 'cardDensity', btn.dataset.density));
    });

    // Favoritos toggle
    this.#el.querySelector('#favFilterBtn')?.addEventListener('click', () => {
      const nowFavs = !store.get('onlyFavs');
      store.setState({ onlyFavs: nowFavs });
      this.#el.querySelector('#favFilterBtn')?.classList.toggle('active', nowFavs);
    });
    // Sync favs btn on external changes
    this.#unsubs.push(store.subscribe('onlyFavs', v => {
      this.#el?.querySelector('#favFilterBtn')?.classList.toggle('active', v);
    }));

    // ── Timeline
    this.#el.querySelector('#timelineToggleBtn')?.addEventListener('click', () => this.#toggleTimeline());
    this.#el.querySelector('#timelineMin')?.addEventListener('input', () => this.#onTimelineChange());
    this.#el.querySelector('#timelineMax')?.addEventListener('input', () => this.#onTimelineChange());
    this.#el.querySelector('#timelineResetBtn')?.addEventListener('click', () => {
      this.#el.querySelector('#timelineMin').value = TL_MIN;
      this.#el.querySelector('#timelineMax').value = TL_MAX;
      store.setState({ timelineMin: TL_MIN, timelineMax: TL_MAX, timelineActive: false });
      this.#syncTimelineUI();
    });

    // Recientes
    this.#el.querySelector('#recentsBtn')?.addEventListener('click', () => this.#toggleRecents());
    this.#el.querySelector('#clearRecentsBtn')?.addEventListener('click', () => {
      store.setState({ recents: [] });
    });
    // ESC cierra overlay
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {}
      const tag    = document.activeElement?.tagName.toLowerCase();
      const typing = ['input','select','textarea'].includes(tag);
      if (!typing) {
        if ((e.key === 't' || e.key === 'T') && store.get('currentRoute') === '/') this.#toggleTimeline();
        if ((e.key === 'h' || e.key === 'H') && store.get('currentRoute') === '/') this.#toggleRecents();
      }
    });

    // Clicks delegados principales
    this.#el.addEventListener('click', e => {
      // Ficha
      const detailBtn = e.target.closest('.btn-detail[data-id]');
      if (detailBtn) { router.navigate(`/aircraft/${detailBtn.dataset.id}`); return; }
      // Favorito
      const favBtn = e.target.closest('[data-fav]');
      if (favBtn) {
        const id = favBtn.dataset.fav; store.toggleFav(id);
        const now = store.isFav(id);
        favBtn.classList.toggle('active', now); favBtn.setAttribute('aria-pressed', now); return;
      }
      // Comparar (toggle al comparador)
      const cmpBtn = e.target.closest('.cmp-btn[data-cmp]');
      if (cmpBtn) { store.toggleCompare(cmpBtn.dataset.cmp); return; }
      // Quick compare
      // Rank row
      const rankRow = e.target.closest('.rank-row');
      if (rankRow?.dataset.id) { router.navigate(`/aircraft/${rankRow.dataset.id}`); return; }
      // Remove from compare bar
      const removeBtn = e.target.closest('[data-remove]');
      if (removeBtn) { store.toggleCompare(removeBtn.dataset.remove); return; }
      // Compare nav
      if (e.target.closest('#compareBtn')) {
        const list = store.get('compareList');
        if (list.length >= 2) { sessionStorage.setItem('aeropedia_compare', JSON.stringify(list)); router.navigate('/compare'); }
        return;
      }
      // Clear compare
      if (e.target.closest('#clearCompareBtn')) { store.clearCompare(); return; }
      // Sort pills (mobile)
      const pill = e.target.closest('.rank-stat-pill');
      if (pill) {
        const stat = pill.dataset.stat;
        store.setState({ sortAsc: stat === store.get('sortStat') ? !store.get('sortAsc') : false, sortStat: stat });
        return;
      }
      // Dir btn (mobile)
      if (e.target.closest('#rankDirBtn')) {
        store.setState({ sortAsc: !store.get('sortAsc') }); return;
      }
      // Sort th (desktop)
      const sortTh = e.target.closest('.sort-th');
      if (sortTh) {
        const col = sortTh.dataset.col;
        store.setState({ sortAsc: col === store.get('sortStat') ? !store.get('sortAsc') : false, sortStat: col });
        return;
      }
      // Recents item
      const recentItem = e.target.closest('.recents-item[data-id]');
      if (recentItem) { this.#toggleRecents(); router.navigate(`/aircraft/${recentItem.dataset.id}`); return; }
      // Click fuera del overlay lo cierra
    });

    // Teclado en ranking rows
    this.#el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        const row = e.target.closest('.rank-row');
        if (row?.dataset.id) { e.preventDefault(); router.navigate(`/aircraft/${row.dataset.id}`); }
      }
    });
  }

  #emptyState() {
    const { onlyFavs} = store.getState();
    const msg = onlyFavs ? 'No tienes aeronaves guardadas. Usa ★ en las tarjetas.'
      : cf ? `Ninguna aeronave registrada en "${cf.label}".`
      : 'No hay resultados. Prueba con la búsqueda avanzada: <code>tipo:Caza país:USA</code>';
    return `<div class="empty-state" role="status">
      <div class="hud-lines" aria-hidden="true"><div class="hud-scan-line"></div><div class="hud-scan-line" style="animation-delay:.25s"></div></div>
      <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6m-3-3h6"/>
      </svg>
      <p class="empty-title">// 0 AERONAVES ENCONTRADAS</p>
      <p class="empty-msg">${msg}</p>
    </div>`;
  }
}
