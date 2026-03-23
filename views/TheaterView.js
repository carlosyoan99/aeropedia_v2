/**
 * views/TheaterView.js — Teatro de Operaciones
 * Mapa SVG mundial interactivo de conflictos con aeronaves participantes.
 * Sin dependencias externas.
 */

import { store }   from '../store/index.js';
import { router }  from '../router/index.js';
import { prefs }   from '../store/preferences.js';
import { setPageMeta, FALLBACK_IMG, debounce , buildBreadcrumb } from '../utils/index.js';

// Coordenadas aproximadas por conflicto [cx%, cy%] sobre un mapa Mercator simple
const CONFLICT_COORDS = {
  wwii_europe:      [50, 35], wwii_pacific:    [80, 40], wwii_east:       [60, 30],
  wwii_africa:      [48, 52], spanish_civil_war:[44,40],
  korea:            [82, 35], vietnam:          [79, 48], suez:           [55, 48],
  sixday:           [56, 46], yom_kippur:       [56, 46], iran_iraq:      [60, 46],
  war_of_attrition: [56, 47], falklands:        [38, 78], gulf_war:       [60, 47],
  desert_storm:     [60, 47], yugoslavia:       [50, 37], kosovo:         [51, 37],
  india_pakistan:   [68, 45], india_china:      [70, 42], gwot:           [64, 46],
  iraq:             [60, 46], afghanistan:      [64, 44], syria:          [57, 45],
  ukraine:          [56, 32], mali:             [44, 53], libya:          [50, 48],
  chechnya:         [60, 36], somalia:          [58, 57], mozambique:     [56, 65],
  nagorno_karabakh: [60, 40], ethiopia_tigray:  [56, 54],
  coldwar_patrols:  [50, 25],
  panama:           [28, 50],  // Panamá: 8.9°N 79.5°O → posición corregida
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
        ${buildBreadcrumb('/theater')}
      <div>
        <h1 class="theater-title">
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" aria-hidden="true"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
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
      // América del Norte
      'M 100,50 L 280,50 L 300,80 L 290,150 L 260,200 L 220,220 L 180,200 L 140,180 L 100,130 Z',
      // América del Sur
      'M 200,230 L 280,230 L 290,280 L 270,370 L 230,420 L 200,400 L 180,350 L 190,290 Z',
      // Europa
      'M 440,50 L 560,50 L 580,80 L 560,120 L 520,130 L 480,120 L 440,110 Z',
      // África
      'M 460,150 L 560,150 L 580,200 L 570,310 L 530,380 L 490,390 L 460,350 L 450,260 L 460,200 Z',
      // Asia
      'M 560,50 L 900,50 L 920,80 L 900,160 L 860,200 L 800,220 L 730,210 L 650,190 L 590,160 L 560,120 Z',
      // Asia sur / sureste
      'M 650,200 L 780,200 L 800,240 L 790,300 L 760,320 L 700,300 L 660,260 Z',
      // Australia
      'M 780,310 L 900,310 L 920,360 L 890,400 L 840,410 L 800,390 L 780,360 Z',
      // Groenlandia
      'M 300,30 L 390,30 L 410,60 L 380,90 L 330,80 L 300,60 Z',
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
                <img src="./public/min/${p.img}.webp" alt=""
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
