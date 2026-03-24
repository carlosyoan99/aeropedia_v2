/**
 * views/TheaterView.js — Teatro de Operaciones
 * Mapa SVG mundial interactivo de conflictos con aeronaves participantes.
 * Sin dependencias externas.
 */

import { store }   from '../store/index.js';
import { router }  from '../router/index.js';
import { prefs }   from '../store/preferences.js';
import { setPageMeta, FALLBACK_IMG, debounce  } from '../utils/index.js';

// Coordenadas aproximadas por conflicto [cx%, cy%] sobre un mapa Mercator simple
const CONFLICT_COORDS = {
  wwii_europe: [54.2, 22.2],
  wwii_pacific: [91.7, 41.7],
  wwii_east: [75.0, 25.0],
  wwii_africa: [55.6, 36.1],
  spanish_civil_war: [49.2, 27.8],
  korea: [85.3, 29.4],
  vietnam: [79.7, 41.1],
  india_pakistan: [69.4, 34.4],
  india_china: [73.6, 32.2],
  suez: [59.2, 33.3],
  sixday: [59.7, 32.8],
  yom_kippur: [59.7, 32.8],
  war_of_attrition: [59.2, 33.3],
  gulf_war: [63.1, 33.9],
  desert_storm: [63.1, 33.9],
  iran_iraq: [62.8, 31.7],
  iraq: [62.2, 31.7],
  syria: [60.6, 30.6],
  israel_lebanon: [59.7, 31.7],
  afghanistan: [68.3, 31.1],
  gwot: [68.3, 31.1],
  yugoslavia: [55.0, 25.6],
  kosovo: [55.8, 26.7],
  ukraine: [58.9, 22.8],
  chechnya: [62.8, 26.1],
  mali: [49.4, 40.6],
  libya: [54.7, 35.0],
  somalia: [62.5, 46.7],
  mozambique: [59.7, 60.0],
  ethiopia_tigray: [60.6, 42.2],
  nagorno_karabakh: [63.1, 27.8],
  rwanda: [58.3, 51.1],
  sudanese: [58.3, 41.7],
  falklands: [33.6, 78.9],
  panama: [27.8, 45.0],
  korean_war: [85.3, 29.4],
  coldwar_patrols: [50.0, 11.1],
  portuguese_colonial: [53.9, 56.7],
  nagorno: [63.1, 27.8],
  cuba_missile: [22.1, 52.0],
  borneo: [115.0, 57.8],
  iran: [53.3, 45.0],
  south_africa: [22.0, 72.2],
};

const ERA_MAP = {
  all:     null,
  wwii:    ['wwii_europe','wwii_pacific','wwii_east','wwii_africa','spanish_civil_war'],
  korea:   ['korea','suez','vietnam'],
  coldwar: ['sixday','war_of_attrition','yom_kippur','iran_iraq','coldwar_patrols','falklands','gulf_war','india_pakistan','india_china'],
  modern:  ['desert_storm','gwot','iraq','syria','ukraine','india_pakistan','mali','libya','chechnya','yugoslavia','kosovo','somalia','nagorno_karabakh'],
};

export class TheaterView {
  #el           = null;
  #subs         = [];
  #selectedId   = null;
  #hoveredId    = null;
  #tooltipEl    = null;

  async render() {
    setPageMeta({
      title:       'Teatro de Operaciones — AeroPedia',
      description: 'Mapa interactivo de conflictos militares aéreos del mundo.',
    });

    this.#el = document.createElement('div');
    this.#el.className = 'theater-view';

    const lastConflict = prefs.get('theater', 'lastConflict');
    const lastEra      = prefs.get('theater', 'lastEra') || 'all';

    this.#el.innerHTML = this.#template(lastEra);
    this.#renderMap();
    this.#bindEvents();

    // Restaurar último conflicto desde prefs
    if (lastConflict) {
      setTimeout(() => this.#selectConflict(lastConflict), 100);
    }

    return this.#el;
  }

  destroy() {
    this.#subs.forEach(u => u());
    this.#tooltipEl?.remove();
  }

  // ── Template ─────────────────────────────────────────────────
  #template(era = 'all') {
    return `
    <div class="theater-header">
      <button class="btn-back" onclick="history.back()" aria-label="Volver atrás">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>
        Volver
      </button>
<div>
        <h1 class="page-title">
          Teatro de Operaciones
        </h1>
        <p class="theater-subtitle">${Object.keys(store.get('conflictsDB')).length} conflictos · Click en un punto para ver detalles</p>
      </div>
    </div>

    <!-- Filtros de era -->
    <div class="theater-era-bar" role="group" aria-label="Filtrar por era histórica">
      ${[['all','Todos'],['wwii','II GM'],['korea','Guerra Fría I'],['coldwar','Guerra Fría II'],['modern','Moderno']].map(([v,l]) =>
        `<button class="theater-era-btn ${era===v?'active':''}" data-era="${v}">${l}</button>`
      ).join('')}
      <div class="theater-era-count">
        <span id="conflictCountBadge" class="theater-count-badge">— conflictos</span>
      </div>
    </div>

    <div class="theater-layout">
      <!-- Mapa -->
      <div class="theater-map-wrap" role="main" aria-label="Mapa de conflictos">
        <div id="theaterMap" class="theater-map"></div>
        <div class="theater-legend" aria-label="Leyenda">
          <div class="theater-legend-item"><span class="theater-dot wwii"></span>II GM</div>
          <div class="theater-legend-item"><span class="theater-dot coldwar"></span>Guerra Fría</div>
          <div class="theater-legend-item"><span class="theater-dot modern"></span>Moderno</div>
          <div class="theater-legend-item"><span class="theater-dot selected"></span>Seleccionado</div>
        </div>
      </div>

      <!-- Panel lateral -->
      <aside class="theater-panel" aria-label="Detalle del conflicto">
        <div id="theaterDetail" class="theater-detail">
          <div class="theater-detail-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" width="40" height="40" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
            </svg>
            <p>Selecciona un conflicto en el mapa</p>
          </div>
        </div>

        <!-- Lista de conflictos -->
        <div class="theater-list-wrap">
          <input type="search" id="theaterSearch" class="search-input" style="width:100%;margin-bottom:.65rem"
            placeholder="Buscar conflicto…" aria-label="Buscar conflicto">
          <div id="theaterList" class="theater-list" role="list" aria-label="Lista de conflictos"></div>
        </div>
      </aside>
    </div>`;
  }

  // ── Renderizar mapa SVG ──────────────────────────────────────
  #renderMap(filterEra = 'all') {
    const container   = this.#el?.querySelector('#theaterMap');
    const conflictsDB = store.get('conflictsDB');
    if (!container) return;

    const eraFilter = ERA_MAP[filterEra];
    const conflicts = Object.entries(conflictsDB).filter(([id]) =>
      !eraFilter || eraFilter.includes(id)
    );

    // SVG base — mapa simplificado estilizado
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 1000 500');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Mapa mundial de conflictos militares');
    svg.setAttribute('class', 'theater-svg');

    // Fondo oceánico
    const ocean = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    ocean.setAttribute('width', '1000'); ocean.setAttribute('height', '500');
    ocean.setAttribute('fill', 'currentColor'); ocean.setAttribute('class', 'theater-ocean');
    svg.appendChild(ocean);

    // Continentes simplificados (polígonos aproximados)
    const landmasses = [
      // América del Norte (más precisa)
      'M 100,55 L 135,50 L 165,48 L 195,50 L 220,52 L 240,58 L 255,72 L 265,95 L 270,118 L 265,140 L 250,165 L 235,185 L 218,195 L 200,200 L 185,195 L 170,185 L 155,168 L 140,148 L 125,130 L 112,108 L 102,82 Z',
      // América Central (puente)
      'M 218,195 L 230,198 L 238,205 L 235,215 L 228,218 L 220,212 L 215,205 Z',
      // América del Sur
      'M 210,222 L 255,218 L 280,228 L 292,248 L 290,278 L 282,310 L 275,340 L 268,368 L 252,395 L 235,415 L 218,420 L 205,408 L 195,385 L 188,355 L 188,322 L 192,292 L 198,262 L 202,238 Z',
      // Europa occidental
      'M 442,58 L 470,50 L 500,48 L 528,52 L 548,62 L 555,80 L 548,100 L 530,115 L 510,122 L 490,118 L 468,110 L 450,95 L 442,78 Z',
      // Escandinavia
      'M 475,38 L 495,32 L 512,35 L 520,48 L 508,58 L 490,55 L 478,48 Z',
      // Groenlandia
      'M 305,25 L 345,20 L 380,22 L 400,32 L 405,48 L 390,62 L 365,68 L 340,65 L 315,55 L 305,40 Z',
      // África (forma más fiel)
      'M 455,148 L 490,140 L 525,142 L 555,148 L 572,168 L 578,195 L 575,225 L 572,255 L 568,285 L 558,315 L 545,348 L 528,375 L 508,392 L 488,398 L 468,390 L 452,368 L 445,338 L 442,305 L 445,272 L 448,238 L 450,208 L 452,178 Z',
      // Cuerno de África
      'M 558,250 L 578,245 L 590,255 L 582,270 L 568,272 Z',
      // Madagascar
      'M 572,310 L 582,305 L 588,318 L 585,335 L 575,340 L 568,330 Z',
      // Asia (Eurasia)
      'M 548,62 L 595,52 L 650,48 L 705,45 L 755,42 L 800,40 L 840,42 L 875,48 L 905,55 L 920,70 L 915,90 L 900,110 L 882,128 L 858,142 L 828,155 L 798,162 L 768,168 L 738,172 L 708,178 L 680,182 L 652,185 L 625,182 L 598,172 L 575,158 L 558,140 L 550,118 L 548,95 Z',
      // Península Arábiga
      'M 575,185 L 598,178 L 618,182 L 628,198 L 622,218 L 608,228 L 592,225 L 578,212 Z',
      // India
      'M 658,185 L 678,185 L 695,195 L 698,218 L 692,240 L 680,258 L 668,262 L 656,250 L 648,228 L 648,208 Z',
      // Sudeste asiático
      'M 730,185 L 758,182 L 780,192 L 788,212 L 782,232 L 762,242 L 742,238 L 728,222 L 725,205 Z',
      // Japón (simplificado)
      'M 845,115 L 858,112 L 865,122 L 858,132 L 845,128 Z',
      // Australia
      'M 775,318 L 820,308 L 865,310 L 898,325 L 915,348 L 912,375 L 895,398 L 865,412 L 832,418 L 800,412 L 775,392 L 762,368 L 762,342 Z',
      // Nueva Zelanda (simplificado)
      'M 928,388 L 935,382 L 940,392 L 935,402 L 928,398 Z',
      // Islas Británicas
      'M 445,68 L 455,62 L 465,65 L 468,75 L 460,82 L 450,80 Z',
      // Península Ibérica
      'M 438,90 L 460,88 L 472,95 L 470,112 L 455,118 L 440,110 L 435,98 Z',
      // Cor de Ceilán / Sri Lanka
      'M 690,248 L 696,244 L 700,250 L 696,258 L 688,255 Z',
    ];

    for (const d of landmasses) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'theater-land');
      svg.appendChild(path);
    }

    // Línea ecuatorial
    const equator = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    equator.setAttribute('x1', '0'); equator.setAttribute('y1', '250');
    equator.setAttribute('x2', '1000'); equator.setAttribute('y2', '250');
    equator.setAttribute('class', 'theater-equator');
    svg.appendChild(equator);

    // Puntos de conflicto
    for (const [id, cf] of conflicts) {
      const [cx, cy] = CONFLICT_COORDS[id] || [50, 50];
      const x = cx * 10;
      const y = cy * 5;

      const era = this.#getEra(id);
      const g   = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `theater-conflict-group ${this.#selectedId === id ? 'selected' : ''}`);
      g.setAttribute('data-id', id);
      g.setAttribute('role', 'button');
      g.setAttribute('tabindex', '0');
      g.setAttribute('aria-label', `${cf.flag} ${cf.label} (${cf.years})`);

      // Pulso animado
      const pulse = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      pulse.setAttribute('cx', x); pulse.setAttribute('cy', y); pulse.setAttribute('r', '12');
      pulse.setAttribute('class', `theater-pulse theater-pulse--${era}`);
      g.appendChild(pulse);

      // Punto central
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', '6');
      dot.setAttribute('class', `theater-dot-main theater-dot--${era}`);
      g.appendChild(dot);

      // Bandera emoji
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x); text.setAttribute('y', y - 12);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '11');
      text.setAttribute('class', 'theater-flag-text');
      text.textContent = cf.flag;
      g.appendChild(text);

      svg.appendChild(g);
    }

    container.innerHTML = '';
    container.appendChild(svg);

    // Tooltip flotante
    this.#tooltipEl = document.createElement('div');
    this.#tooltipEl.className = 'theater-tooltip';
    this.#tooltipEl.setAttribute('role', 'tooltip');
    this.#tooltipEl.setAttribute('aria-live', 'polite');
    container.appendChild(this.#tooltipEl);

    // Bind events en SVG
    svg.addEventListener('click', (e) => {
      const g = e.target.closest('[data-id]');
      if (g) this.#selectConflict(g.dataset.id);
    });
    svg.addEventListener('mouseover', (e) => {
      const g = e.target.closest('[data-id]');
      if (g) this.#showTooltip(g.dataset.id, e);
    });
    svg.addEventListener('mousemove', (e) => {
      if (this.#hoveredId) this.#positionTooltip(e);
    });
    svg.addEventListener('mouseout', (e) => {
      if (!e.target.closest('[data-id]')) this.#hideTooltip();
    });
    svg.addEventListener('keydown', (e) => {
      const g = e.target.closest('[data-id]');
      if (g && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        this.#selectConflict(g.dataset.id);
      }
    });

    // Actualizar contador
    const badge = this.#el?.querySelector('#conflictCountBadge');
    if (badge) badge.textContent = `${conflicts.length} conflictos`;

    // Renderizar lista lateral
    this.#renderList(conflicts);
  }

  // ── Lista de conflictos ──────────────────────────────────────
  #renderList(conflicts) {
    const listEl = this.#el?.querySelector('#theaterList');
    if (!listEl) return;
    const q = (this.#el?.querySelector('#theaterSearch')?.value || '').toLowerCase();
    const filtered = conflicts.filter(([, cf]) =>
      !q || cf.label.toLowerCase().includes(q) || cf.years.includes(q)
    );

    listEl.innerHTML = filtered.map(([id, cf]) => {
      const era = this.#getEra(id);
      return `<button class="theater-list-item ${this.#selectedId === id ? 'active' : ''}"
        data-id="${id}" role="listitem" aria-pressed="${this.#selectedId === id}">
        <span class="theater-list-flag" aria-hidden="true">${cf.flag}</span>
        <div class="theater-list-info">
          <span class="theater-list-label">${cf.label}</span>
          <span class="theater-list-years mono">${cf.years}</span>
        </div>
        <span class="theater-era-dot theater-dot--${era}" aria-hidden="true"></span>
      </button>`;
    }).join('');

    listEl.querySelectorAll('[data-id]').forEach(btn => {
      btn.addEventListener('click', () => this.#selectConflict(btn.dataset.id));
    });
  }

  // ── Seleccionar conflicto ────────────────────────────────────
  #selectConflict(id) {
    const conflictsDB = store.get('conflictsDB');
    const cf          = conflictsDB[id];
    if (!cf) return;

    this.#selectedId = id;
    prefs.setOne('theater', 'lastConflict', id);

    // Actualizar clases en el mapa (setAttribute for SVG compat)
    this.#el?.querySelectorAll('.theater-conflict-group').forEach(g => {
      const base = 'theater-conflict-group';
      g.setAttribute('class', g.dataset.id === id ? `${base} selected` : base);
    });

    // Actualizar lista
    this.#el?.querySelectorAll('.theater-list-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.id === id);
      btn.setAttribute('aria-pressed', btn.dataset.id === id);
    });

    // Construir panel de detalle
    this.#renderDetail(id, cf);

    // Scroll a la lista si es mobile
    if (window.innerWidth < 768) {
      this.#el?.querySelector('.theater-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  #renderDetail(id, cf) {
    const detailEl  = this.#el?.querySelector('#theaterDetail');
    if (!detailEl) return;

    const aircraftDB = store.get('aircraftDB');
    const planes     = aircraftDB.filter(p => (p.conflicts || []).includes(id));

    const kills = store.get('killsDB')?.filter(k => (k.conflicts||[]).some(c=>c.id===id)) || [];

    detailEl.innerHTML = `
      <div class="theater-detail-header">
        <span class="theater-detail-flag">${cf.flag}</span>
        <div>
          <h2 class="theater-detail-title">${cf.label}</h2>
          <span class="theater-detail-years mono">${cf.years}</span>
        </div>
      </div>

      <p class="theater-detail-desc">${cf.desc || ''}</p>

      ${planes.length ? `
        <div class="theater-detail-section">
          <h3 class="theater-detail-sub">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path d="M21 16l-9-4-9 4 9-1.5L21 16z"/></svg>
            ${planes.length} aeronaves participantes
          </h3>
          <div class="theater-planes-grid">
            ${planes.map(p => `
              <button class="theater-plane-chip" data-id="${p.id}"
                aria-label="Ver ficha de ${p.name}">
                <img src="./public/min/${p.img?.[0] ?? p.img}.webp" alt=""
                  width="44" height="25" style="object-fit:cover;border-radius:3px;flex-shrink:0"
                  onerror="this.style.display='none'">
                <div class="theater-plane-chip-info">
                  <span class="theater-plane-name">${p.name}</span>
                  <span class="theater-plane-country mono">${p.country}</span>
                </div>
              </button>`).join('')}
          </div>
        </div>` : ''}

      ${kills.length ? `
        <div class="theater-detail-section">
          <h3 class="theater-detail-sub">📊 Estadísticas de combate</h3>
          ${kills.slice(0, 5).map(k => {
            const p    = aircraftDB.find(x => x.id === k.id);
            const c    = (k.conflicts||[]).find(x => x.id === id);
            if (!p || !c) return '';
            return `<div class="theater-kill-row">
              <span class="theater-kill-name">${p.name}</span>
              <span style="color:var(--success);font-family:var(--font-mono);font-size:.72rem">${(c.kills||0)} victorias</span>
              <span style="color:var(--danger);font-family:var(--font-mono);font-size:.72rem">${(c.losses_aa||0)} pérdidas</span>
            </div>`;
          }).join('')}
        </div>` : ''}

      <div class="theater-detail-actions">
        <button class="btn-detail theater-filter-btn" data-conflict="${id}"
          aria-label="Ver aeronaves de este conflicto en la galería">
          <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/></svg>
          Ver en galería
        </button>
      </div>`;

    // Bind: click en aeronave → navegar a su ficha
    detailEl.querySelectorAll('.theater-plane-chip').forEach(btn => {
      btn.addEventListener('click', () => router.navigate(`/aircraft/${btn.dataset.id}`));
    });

    // Filtrar galería por conflicto
    detailEl.querySelector('.theater-filter-btn')?.addEventListener('click', () => {
      store.setState({ activeConflict: id });
      router.navigate('/');
    });
  }

  // ── Tooltip ──────────────────────────────────────────────────
  #showTooltip(id, event) {
    const cf = store.get('conflictsDB')[id];
    if (!cf || !this.#tooltipEl) return;
    this.#hoveredId = id;
    this.#tooltipEl.innerHTML = `<strong>${cf.flag} ${cf.label}</strong><br><span>${cf.years}</span>`;
    this.#tooltipEl.classList.add('theater-tooltip--visible');
    this.#positionTooltip(event);
  }

  #positionTooltip(event) {
    if (!this.#tooltipEl) return;
    const rect = this.#el?.querySelector('#theaterMap')?.getBoundingClientRect();
    if (!rect) return;
    const x = event.clientX - rect.left + 12;
    const y = event.clientY - rect.top - 36;
    this.#tooltipEl.style.transform = `translate(${x}px, ${y}px)`;
  }

  #hideTooltip() {
    this.#hoveredId = null;
    this.#tooltipEl?.classList.remove('theater-tooltip--visible');
  }

  // ── Helpers ──────────────────────────────────────────────────
  #getEra(id) {
    if (ERA_MAP.wwii?.includes(id))    return 'wwii';
    if (ERA_MAP.korea?.includes(id))   return 'korea';
    if (ERA_MAP.coldwar?.includes(id)) return 'coldwar';
    return 'modern';
  }

  // ── Events ───────────────────────────────────────────────────
  #bindEvents() {
    // Era buttons
    this.#el?.querySelectorAll('.theater-era-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const era = btn.dataset.era;
        prefs.setOne('theater', 'lastEra', era);
        this.#el?.querySelectorAll('.theater-era-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.era === era);
        });
        this.#selectedId = null;
        this.#renderMap(era);
      });
    });

    // Search
    const debouncedSearch = debounce(() => {
      const conflictsDB = store.get('conflictsDB');
      const era = prefs.get('theater','lastEra') || 'all';
      const eraFilter = ERA_MAP[era];
      const conflicts = Object.entries(conflictsDB).filter(([id]) => !eraFilter || eraFilter.includes(id));
      this.#renderList(conflicts);
    }, 200);
    this.#el?.querySelector('#theaterSearch')?.addEventListener('input', debouncedSearch);
  }
}
