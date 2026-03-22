/**
 * views/HomeView.js — Vista principal: galería + ranking
 * Fixes: timeline panel UI, activeConflict filter, conflict badge in counter.
 */

import { store } from '../store/index.js';
import { prefs }  from '../store/preferences.js';
import { router } from '../router/index.js';
import { genBadgeHTML, formatStat, FALLBACK_IMG, lazyLoad, setPageMeta, debounce } from '../utils/index.js';

const STAT_COLORS = {
  speed: '#3b82f6', range: '#8b5cf6', ceiling: '#06b6d4', mtow: '#f59e0b', year: '#10b981',
};
const TL_MIN = 1940, TL_MAX = 2030, TL_STEP = 10;

export class HomeView {
  #el      = null;
  #unsubs  = [];
  #tl      = { open: false };   // timeline local state

  async render() {
    setPageMeta({
      title: 'AeroPedia — Archivo Global de Aviación',
      description: 'Enciclopedia interactiva de aviación militar: fichas técnicas, comparador y más.',
    });

    this.#el = document.createElement('div');
    this.#el.className = 'home-view';
    this.#el.innerHTML = this.#scaffold();

    this.#bindEvents();
    this.#subscribeStore();
    this.#renderAll();
    this.#syncView(store.get('view'));
    this.#applyDensityPrefs();
    this.#unsubs.push(prefs.subscribe('display', () => this.#applyDensityPrefs()));

    // Activar filtro de conflicto si viene de Theater
    const conflict = store.get('activeConflict');
    if (conflict && conflict !== 'all') {
      this.#showConflictBadge(conflict);
    }

    return this.#el;
  }

  destroy() { this.#unsubs.forEach(u => u()); }

  // ── Scaffold ─────────────────────────────────────────────────
  #scaffold() {
    const sort = store.get('sortStat');
    return `
      <!-- Barra de herramientas contextual -->
      <div class="home-toolbar">
        <div class="result-bar" role="status" aria-live="polite" aria-atomic="true">
          <span class="result-label">// Mostrando</span>
          <span id="resultCount" class="result-count">0</span>
          <span class="result-label">aeronaves</span>
          <div class="result-divider" aria-hidden="true"></div>
          <span id="resultFilterLabel" class="result-filter"></span>
        </div>
        <div class="home-toolbar-actions">
          <button id="timelineToggleBtn" class="header-btn timeline-toggle-btn" aria-expanded="false" aria-controls="timelinePanel" title="Línea de tiempo (T)">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V7z" clip-rule="evenodd"/></svg>
            Timeline
          </button>
          <button id="clearConflictBtn" class="header-btn conflict-badge hidden" aria-label="Limpiar filtro de conflicto">
            <span id="conflictBadgeText"></span>
            <svg viewBox="0 0 20 20" fill="currentColor" width="11" height="11" aria-hidden="true"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
          </button>
        </div>
      </div>

      <!-- Panel Timeline (colapsable) -->
      <div id="timelinePanel" class="timeline-panel" aria-hidden="true" role="region" aria-label="Filtro por línea de tiempo">
        <div class="timeline-panel-inner">
          <div class="timeline-header">
            <div class="timeline-header-left">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style="color:#60a5fa" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V7z" clip-rule="evenodd"/></svg>
              <span class="timeline-title">Línea de Tiempo</span>
              <span id="timelineRangeLabel" class="timeline-range-label">TODAS LAS ÉPOCAS</span>
            </div>
            <button id="timelineResetBtn" class="timeline-reset-btn" disabled aria-label="Restablecer rango de tiempo">
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12" aria-hidden="true"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1z" clip-rule="evenodd"/></svg>
              Reset
            </button>
          </div>

          <!-- Marcas de décadas -->
          <div id="decadeMarks" class="decade-marks" role="group" aria-label="Décadas"></div>

          <!-- Sliders duales -->
          <div class="timeline-sliders-wrap" aria-label="Rango de años">
            <div class="timeline-track-bg"><div id="timelineTrackFill" class="timeline-track-fill"></div></div>
            <input type="range" id="timelineMin" class="timeline-input" min="${TL_MIN}" max="2020" step="${TL_STEP}" value="${TL_MIN}"
              aria-label="Año inicial" aria-valuemin="${TL_MIN}" aria-valuemax="2020">
            <input type="range" id="timelineMax" class="timeline-input" min="1950" max="${TL_MAX}" step="${TL_STEP}" value="${TL_MAX}"
              aria-label="Año final" aria-valuemin="1950" aria-valuemax="${TL_MAX}">
          </div>
          <div class="timeline-ticks" aria-hidden="true">
            ${[1940,1960,1980,2000,2024].map(y=>`<span>${y}</span>`).join('')}
          </div>
          <p class="timeline-hint">Arrastra los extremos para filtrar por año de entrada en servicio</p>
        </div>
      </div>

      <!-- Galería -->
      <div id="galleryView" role="main">
        <div id="gallery" class="gallery-grid" aria-label="Galería de aeronaves" role="list"></div>
      </div>

      <!-- Ranking -->
      <div id="rankingView" class="hidden" role="main">
        <div class="ranking-pills" role="group" aria-label="Ordenar por">
          <span class="ranking-pills-label">Ordenar por:</span>
          ${['speed','range','ceiling','mtow','year'].map(stat =>
            `<button class="rank-stat-pill ${stat===sort?'active':''}" data-stat="${stat}" aria-pressed="${stat===sort}">
              ${{speed:'Velocidad',range:'Alcance',ceiling:'Techo',mtow:'MTOW',year:'Año'}[stat]}
            </button>`
          ).join('')}
        </div>
        <div class="ranking-table-wrap">
          <table class="ranking-table" aria-label="Tabla de ranking">
            <thead><tr>
              <th scope="col">#</th>
              <th scope="col">Aeronave</th>
              <th scope="col" class="sort-th" data-col="speed">Velocidad <span class="sort-icon" aria-hidden="true">↕</span></th>
              <th scope="col" class="sort-th hidden-sm" data-col="range">Alcance <span class="sort-icon" aria-hidden="true">↕</span></th>
              <th scope="col" class="sort-th hidden-sm" data-col="ceiling">Techo <span class="sort-icon" aria-hidden="true">↕</span></th>
              <th scope="col" class="sort-th hidden-md" data-col="mtow">MTOW <span class="sort-icon" aria-hidden="true">↕</span></th>
              <th scope="col" class="sort-th hidden-md" data-col="year">Año <span class="sort-icon" aria-hidden="true">↕</span></th>
              <th scope="col"></th>
            </tr></thead>
            <tbody id="rankingBody"></tbody>
          </table>
        </div>
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
      </div>`;
  }

  // ── Suscripciones ─────────────────────────────────────────────
  #subscribeStore() {
    const rerender = debounce(() => this.#renderAll(), 50);
    this.#unsubs.push(
      store.subscribe(['search','cat','onlyFavs','favs','timelineActive','timelineMin','timelineMax','sortStat','sortAsc','activeConflict'], rerender),
      store.subscribe('view',        (v) => this.#syncView(v)),
      store.subscribe('compareList', ()  => this.#updateCompareBar()),
      store.subscribe('aircraftDB',  ()  => { this.#buildDecadeMarks(); this.#renderAll(); }),
      store.subscribe('activeConflict', (v) => this.#showConflictBadge(v)),
    );
  }

  // ── Filtrado — FIX CRÍTICO: incluye activeConflict ─────────────
  #getFiltered() {
    const { aircraftDB, search: q, cat, onlyFavs, timelineActive,
            timelineMin, timelineMax, favs, activeConflict } = store.getState();

    return [...aircraftDB]
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter(p => {
        const s = q.toLowerCase();
        const matchSearch   = !q || p.name.toLowerCase().includes(s) ||
          p.country.toLowerCase().includes(s) || p.type.toLowerCase().includes(s) ||
          (p.manufacturer || '').toLowerCase().includes(s);
        const matchCat      = cat === 'all' || p.type === cat;
        const matchFav      = !onlyFavs || favs.includes(p.id);
        const matchTimeline = !timelineActive || (p.year >= timelineMin && p.year <= timelineMax);
        // FIX: filtro por conflicto activo
        const matchConflict = activeConflict === 'all' || (p.conflicts || []).includes(activeConflict);
        return matchSearch && matchCat && matchFav && matchTimeline && matchConflict;
      });
  }

  #renderAll() {
    const filtered = this.#getFiltered();
    this.#updateCounter(filtered);
    store.get('view') === 'gallery' ? this.#renderGallery(filtered) : this.#renderRanking(filtered);
  }

  #updateCounter(filtered) {
    const countEl = this.#el?.querySelector('#resultCount');
    if (countEl) countEl.textContent = filtered.length;

    const labels = [];
    const { cat, search: q, onlyFavs, timelineActive, timelineMin, timelineMax, activeConflict } = store.getState();
    if (cat !== 'all') labels.push(cat.toUpperCase());
    if (onlyFavs) labels.push('⭐ FAVORITOS');
    if (timelineActive) labels.push(`${timelineMin}–${timelineMax}`);
    if (activeConflict !== 'all') {
      const cf = store.get('conflictsDB')[activeConflict];
      if (cf) labels.push(`${cf.flag} ${cf.label}`);
    }
    if (q) labels.push(`"${q}"`);

    const lbl = this.#el?.querySelector('#resultFilterLabel');
    if (lbl) lbl.textContent = labels.length ? labels.join(' · ') : 'TODOS LOS MODELOS';
  }

  // ── Galería ───────────────────────────────────────────────────
  #renderGallery(planes) {
    const gallery = this.#el?.querySelector('#gallery');
    if (!gallery) return;
    if (!planes.length) { gallery.innerHTML = this.#emptyState(); return; }
    const frag = document.createDocumentFragment();
    for (const plane of planes) frag.appendChild(this.#createCard(plane));
    gallery.innerHTML = '';
    gallery.appendChild(frag);
    lazyLoad(gallery);
  }

  #createCard(plane) {
    const favActive = store.isFav(plane.id);
    const inCompare = store.get('compareList').includes(plane.id);
    const speedPct   = Math.min((plane.speed   / 3600)  * 100, 100);
    const rangePct   = Math.min((plane.range   / 15000) * 100, 100);
    const ceilingPct = Math.min((plane.ceiling / 25000) * 100, 100);
    const statusMap  = { active:['Activo','active'], prototype:['Prototipo','proto'], limited:['Limitado','limited'] };
    const [statusLabel, statusCls] = statusMap[plane.status] || [null, ''];

    const card = document.createElement('article');
    card.className = `card${inCompare ? ' selected-for-compare' : ''}`;
    card.id = `card-${plane.id}`;
    card.setAttribute('role', 'listitem');
    card.innerHTML = `
      ${inCompare ? '<div class="card-selected-bar" aria-hidden="true"></div>' : ''}
      <div class="card-img-wrap">
        <img data-src="./public/min/${plane.img}.webp"
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
        </div>
      </div>`;
    return card;
  }

  // ── Ranking ───────────────────────────────────────────────────
  #renderRanking(planes) {
    const body = this.#el?.querySelector('#rankingBody');
    if (!body) return;
    const { sortStat, sortAsc } = store.getState();
    const sorted = [...planes].sort((a,b) => sortAsc ? a[sortStat]-b[sortStat] : b[sortStat]-a[sortStat]);
    const maxVal = sorted.length ? Math.max(...sorted.map(p => p[sortStat])) : 1;
    const color  = STAT_COLORS[sortStat] || '#3b82f6';
    const medals = ['🥇','🥈','🥉'];

    body.innerHTML = sorted.length
      ? sorted.map((p,i) => {
          const pct = (p[sortStat] / maxVal) * 100;
          return `<tr class="rank-row" data-id="${p.id}" tabindex="0" role="button" aria-label="Ver ficha de ${p.name}">
            <td class="rank-pos mono">${medals[i] || (i+1)}</td>
            <td class="rank-plane">
              <div class="rank-plane-cell">
                <img data-src="./public/min/${p.img}.webp"
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

    this.#el?.querySelectorAll('.sort-th').forEach(th => {
      const active = th.dataset.col === sortStat;
      th.classList.toggle('sorted', active);
      const icon = th.querySelector('.sort-icon');
      if (icon) icon.textContent = active ? (sortAsc ? '↑' : '↓') : '↕';
    });
    lazyLoad(body);
  }

  // ── Timeline ──────────────────────────────────────────────────
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
      btn.className    = 'decade-mark';
      btn.dataset.year = y;
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

    const total    = TL_MAX - TL_MIN;
    const leftPct  = ((timelineMin - TL_MIN) / total) * 100;
    const rightPct = ((timelineMax - TL_MIN) / total) * 100;
    const fill     = this.#el?.querySelector('#timelineTrackFill');
    if (fill) { fill.style.left = `${leftPct}%`; fill.style.width = `${rightPct - leftPct}%`; }

    this.#el?.querySelectorAll('.decade-mark').forEach(m => {
      const y = parseInt(m.dataset.year);
      m.classList.toggle('active', y >= timelineMin && y <= timelineMax);
    });

    const resetBtn = this.#el?.querySelector('#timelineResetBtn');
    if (resetBtn) resetBtn.disabled = !timelineActive;
    this.#el?.querySelector('#timelineToggleBtn')?.classList.toggle('active', timelineActive);
  }

  // ── Conflict badge ────────────────────────────────────────────
  #showConflictBadge(conflictId) {
    const btn  = this.#el?.querySelector('#clearConflictBtn');
    const text = this.#el?.querySelector('#conflictBadgeText');
    if (!btn || !text) return;

    if (!conflictId || conflictId === 'all') {
      btn.classList.add('hidden');
      return;
    }
    const cf = store.get('conflictsDB')[conflictId];
    if (!cf) return;
    text.textContent = `${cf.flag} ${cf.label}`;
    btn.classList.remove('hidden');
  }

  // ── Compare Bar ───────────────────────────────────────────────
  #updateCompareBar() {
    const bar = this.#el?.querySelector('#compareBar');
    if (!bar) return;
    const list       = store.get('compareList');
    const aircraftDB = store.get('aircraftDB');

    if (!list.length) { bar.classList.remove('visible'); bar.setAttribute('aria-hidden','true'); return; }
    bar.classList.add('visible');
    bar.setAttribute('aria-hidden','false');

    const slots = bar.querySelector('#compareSlots');
    if (slots) slots.innerHTML = list.map(id => {
      const p = aircraftDB.find(x => x.id === id);
      return `<div class="compare-slot">
        <span>${p ? p.name : id}</span>
        <button data-remove="${id}" aria-label="Quitar ${p?.name||id}">×</button>
      </div>`;
    }).join('');

    const btn  = bar.querySelector('#compareBtn');
    const hint = bar.querySelector('#compareHint');
    if (btn) { btn.disabled = list.length < 2; btn.setAttribute('aria-disabled', list.length < 2); }
    if (hint) hint.textContent = list.length < 2 ? `Selecciona ${2-list.length} más`
      : list.length < 3 ? 'Puedes añadir 1 más' : 'Máximo alcanzado (3)';
  }

  // ── Vista toggle ──────────────────────────────────────────────
  #syncView(view) {
    this.#el?.querySelector('#galleryView')?.classList.toggle('hidden', view !== 'gallery');
    this.#el?.querySelector('#rankingView')?.classList.toggle('hidden', view !== 'ranking');
    this.#renderAll();
  }

  // ── Preferencias de densidad ──────────────────────────────────
  #applyDensityPrefs() {
    const gallery = this.#el?.querySelector('#gallery');
    if (!gallery) return;
    const density  = prefs.get('display','cardDensity') || 'normal';
    const cols     = prefs.get('display','galleryColumns') || 'auto';
    const showBars = prefs.get('display','showStatBars') !== false;
    gallery.setAttribute('data-density', density);
    document.documentElement.setAttribute('data-density', density);
    document.documentElement.setAttribute('data-gallery-cols', cols);
    document.documentElement.classList.toggle('no-stat-bars', !showBars);
  }

  // ── Eventos ───────────────────────────────────────────────────
  #bindEvents() {
    // Timeline toggle button
    this.#el.querySelector('#timelineToggleBtn')?.addEventListener('click', () => this.#toggleTimeline());

    // Timeline sliders
    this.#el.querySelector('#timelineMin')?.addEventListener('input', () => this.#onTimelineChange());
    this.#el.querySelector('#timelineMax')?.addEventListener('input', () => this.#onTimelineChange());

    // Timeline reset
    this.#el.querySelector('#timelineResetBtn')?.addEventListener('click', () => {
      const minEl = this.#el.querySelector('#timelineMin');
      const maxEl = this.#el.querySelector('#timelineMax');
      if (minEl) minEl.value = TL_MIN;
      if (maxEl) maxEl.value = TL_MAX;
      store.setState({ timelineMin: TL_MIN, timelineMax: TL_MAX, timelineActive: false });
      this.#syncTimelineUI();
    });

    // Limpiar filtro de conflicto
    this.#el.querySelector('#clearConflictBtn')?.addEventListener('click', () => {
      store.setState({ activeConflict: 'all' });
    });

    // Keyboard shortcut: T → toggle timeline
    document.addEventListener('keydown', (e) => {
      const tag    = document.activeElement?.tagName.toLowerCase();
      const typing = ['input','select','textarea'].includes(tag);
      if (!typing && (e.key === 't' || e.key === 'T') && store.get('currentRoute') === '/') {
        this.#toggleTimeline();
      }
    });

    // Clicks delegados
    this.#el.addEventListener('click', (e) => {
      // Ficha
      const detailBtn = e.target.closest('[data-id]');
      if (detailBtn?.classList.contains('btn-detail')) {
        router.navigate(`/aircraft/${detailBtn.dataset.id}`); return;
      }
      // Favorito
      const favBtn = e.target.closest('[data-fav]');
      if (favBtn) {
        const id = favBtn.dataset.fav;
        store.toggleFav(id);
        const now = store.isFav(id);
        favBtn.classList.toggle('active', now);
        favBtn.setAttribute('aria-pressed', now);
        return;
      }
      // Comparar
      const cmpBtn = e.target.closest('[data-cmp]');
      if (cmpBtn) { store.toggleCompare(cmpBtn.dataset.cmp); return; }
      // Ranking row
      const rankRow = e.target.closest('.rank-row');
      if (rankRow?.dataset.id) { router.navigate(`/aircraft/${rankRow.dataset.id}`); return; }
      // Remove from compare
      const removeBtn = e.target.closest('[data-remove]');
      if (removeBtn) { store.toggleCompare(removeBtn.dataset.remove); return; }
      // Compare button
      if (e.target.closest('#compareBtn')) {
        const list = store.get('compareList');
        if (list.length >= 2) { sessionStorage.setItem('aeropedia_compare', JSON.stringify(list)); router.navigate('/compare'); }
        return;
      }
      // Clear compare
      if (e.target.closest('#clearCompareBtn')) { store.clearCompare(); return; }
      // Sort pills
      const pill = e.target.closest('.rank-stat-pill');
      if (pill) {
        const stat = pill.dataset.stat;
        store.setState({ sortAsc: stat === store.get('sortStat') ? !store.get('sortAsc') : false, sortStat: stat });
        this.#el.querySelectorAll('.rank-stat-pill').forEach(b => {
          b.classList.toggle('active', b.dataset.stat === stat);
          b.setAttribute('aria-pressed', b.dataset.stat === stat);
        });
        return;
      }
      // Sort table header
      const sortTh = e.target.closest('.sort-th');
      if (sortTh) {
        const col = sortTh.dataset.col;
        store.setState({ sortAsc: col === store.get('sortStat') ? !store.get('sortAsc') : false, sortStat: col });
      }
    });

    // Keyboard en ranking rows
    this.#el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const row = e.target.closest('.rank-row');
        if (row?.dataset.id) { e.preventDefault(); router.navigate(`/aircraft/${row.dataset.id}`); }
      }
    });
  }

  #emptyState() {
    const { onlyFavs, activeConflict } = store.getState();
    const cf  = activeConflict !== 'all' ? store.get('conflictsDB')[activeConflict] : null;
    const msg = onlyFavs
      ? 'No tienes aeronaves guardadas. Usa ★ en las tarjetas.'
      : cf
        ? `Ninguna aeronave registrada en "${cf.label}". Prueba en Teatro de Operaciones.`
        : 'No hay resultados. Ajusta la búsqueda o los filtros.';
    return `<div class="empty-state" role="status">
      <div class="hud-lines" aria-hidden="true">
        <div class="hud-scan-line"></div>
        <div class="hud-scan-line" style="animation-delay:.25s"></div>
        <div class="hud-scan-line" style="animation-delay:.5s"></div>
      </div>
      <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6m-3-3h6"/>
      </svg>
      <p class="empty-title">// 0 AERONAVES ENCONTRADAS</p>
      <p class="empty-msg">${msg}</p>
    </div>`;
  }
}
