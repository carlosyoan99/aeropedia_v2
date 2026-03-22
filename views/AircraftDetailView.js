/**
 * views/AircraftDetailView.js — Ficha técnica completa
 */

import { store } from '../store/index.js';
import { router } from '../router/index.js';
import { genBadgeHTML, formatNumber, val, FALLBACK_IMG, setPageMeta, copyToClipboard, showToast } from '../utils/index.js';
import { drawGauge, drawRadarChart } from '../components/Charts.js';

const wikiCache = new Map();

export class AircraftDetailView {
  #el = null;
  #plane = null;
  #unsubs = [];

  async render({ id }) {
    const aircraftDB = store.get('aircraftDB');
    this.#plane = aircraftDB.find(p => p.id === id);

    if (!this.#plane) {
      const el = document.createElement('div');
      el.className = 'detail-not-found';
      el.innerHTML = `
        <div class="not-found-inner">
          <p class="not-found-code mono">404</p>
          <p class="not-found-title">Aeronave no encontrada</p>
          <p class="not-found-sub">ID: <code>${id}</code></p>
          <a href="/" data-link class="btn-back-home">← Volver al archivo</a>
        </div>`;
      return el;
    }

    const p = this.#plane;
    setPageMeta({
      title: `${p.name} — AeroPedia`,
      description: p.desc,
    });

    this.#el = document.createElement('div');
    this.#el.className = 'detail-view';
    this.#el.innerHTML = this.#template(p);

    this.#bindEvents();
    this.#renderGauges(p);
    this.#renderRadar(p);
    this.#loadWikipedia(p);

    return this.#el;
  }

  destroy() {
    this.#unsubs.forEach(u => u());
  }

  #template(p) {
    const conflictsDB = store.get('conflictsDB');
    const conflictChips = (p.conflicts || [])
      .filter(c => conflictsDB[c])
      .map(c => {
        const cf = conflictsDB[c];
        return `<a class="conflict-chip" href="/theater#${c}" data-link
          title="${cf.label}" style="--chip-color:${cf.color}">${cf.flag} ${cf.label}</a>`;
      }).join('');

    const roleTags = (p.roles || []).map(r => `<span class="role-tag">${r}</span>`).join('');
    const variantTags = (p.variants || []).map(v => `<span class="variant-tag mono">${v}</span>`).join('');
    const tagsHtml = (p.tags || []).map(t => `<span class="tech-tag">#${t}</span>`).join('');

    const ops = (p.operators || []).slice(0, 8).join(' · ');
    const moreOps = p.operators?.length > 8
      ? ` <span style="color:var(--text-3)">+${p.operators.length - 8} más</span>` : '';

    const statusMap = {
      active: '<span class="status-badge active">⬤ Activo</span>',
      retired: '<span class="status-badge retired">⬤ Retirado</span>',
      prototype: '<span class="status-badge proto">⬤ Prototipo</span>',
      limited: '<span class="status-badge limited">⬤ Limitado</span>',
    };

    const stealthMap = {
      high: '<span class="stealth-badge high">✦ Sigilo alto</span>',
      medium: '<span class="stealth-badge medium">Sigilo medio</span>',
      low: '<span class="stealth-badge low">Sigilo bajo</span>',
    };

    const radarTypeMap = {
      AESA: '<span class="radar-badge aesa">AESA</span>',
      PESA: '<span class="radar-badge pesa">PESA</span>',
      mechanical: '<span class="radar-badge mech">Mecánico</span>',
      none: '<span class="radar-badge none">Sin radar</span>',
    };

    const crewLabel = p.crew === 0
      ? 'No tripulado (UAV)'
      : `${p.crew}${p.crew_roles?.length ? ' — ' + p.crew_roles.join(', ') : ''}`;

    const armBlock = this.#armamentBlock(p);

    const relatedAircraftDB = store.get('aircraftDB');
    const relatedHtml = p.related_aircraft?.length
      ? `<div class="related-aircraft">
          <span class="related-label mono">Ver también:</span>
          ${p.related_aircraft.slice(0, 4).map(rid => {
            const rel = relatedAircraftDB.find(x => x.id === rid);
            return rel ? `<a class="related-btn" href="/aircraft/${rid}" data-link>${rel.name}</a>` : '';
          }).join('')}
        </div>`
      : '';

    const inCompare = store.get('compareList').includes(p.id);

    return `
    <div class="detail-topbar">
      <a href="/" data-link class="btn-back" aria-label="Volver al archivo">
        <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>
        Volver
      </a>
      <div class="detail-topbar-actions">
        <button class="btn-share" id="shareBtn" aria-label="Compartir ficha">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/></svg>
          Compartir
        </button>
        <button class="btn-compare-detail ${inCompare ? 'active' : ''}"
          id="compareDetailBtn"
          aria-label="${inCompare ? 'Quitar de comparación' : 'Añadir a comparación'}"
          aria-pressed="${inCompare}">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
          Comparar
        </button>
      </div>
    </div>

    <div class="detail-grid">
      <!-- Columna info -->
      <div class="detail-info">
        <div class="detail-header-block">
          <h1 class="detail-name">${p.name}</h1>
          <div class="detail-badges-row">
            <span class="detail-type-badge">${p.type}</span>
            <span class="detail-country mono">${p.country} · ${p.year}</span>
            ${genBadgeHTML(p)}
            ${statusMap[p.status] || ''}
            ${stealthMap[p.stealth] || ''}
          </div>
          <div class="detail-caps-row">${this.#capIcons(p)}</div>
        </div>

        <p class="detail-desc">${p.desc}</p>

        <!-- Wikipedia -->
        <section class="detail-section detail-wiki" aria-label="Extracto de Wikipedia">
          <h2 class="detail-section-title">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>
            Wikipedia
            <span id="wikiSpinner" class="wiki-spinner" aria-hidden="true"></span>
          </h2>
          <p id="wikiText" class="wiki-text loading" aria-live="polite">Cargando…</p>
          <a id="wikiLink" href="#" target="_blank" rel="noopener noreferrer" class="wiki-link hidden">
            Leer artículo completo
            <svg viewBox="0 0 20 20" fill="currentColor" width="11" height="11" aria-hidden="true"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/></svg>
          </a>
        </section>

        <!-- Rendimiento gauges -->
        <section class="detail-section" aria-label="Rendimiento de vuelo">
          <h2 class="detail-section-title">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V7z" clip-rule="evenodd"/></svg>
            Rendimiento de Vuelo
          </h2>
          <div class="gauges-row" id="gaugesRow" aria-label="Gauges de rendimiento"></div>
          <div class="detail-specs">
            ${this.#specRow('Velocidad máx.', `${formatNumber(p.speed)} km/h — Mach ${(p.speed / 1234.8).toFixed(2)}`)}
            ${this.#specRow('Alcance operativo', formatNumber(p.range, 0, ' km'))}
            ${p.combat_radius ? this.#specRow('Radio de combate', formatNumber(p.combat_radius, 0, ' km')) : ''}
            ${this.#specRow('Techo de servicio', formatNumber(p.ceiling, 0, ' m'))}
            ${p.thrust_to_weight ? this.#specRow('Empuje/Peso', p.thrust_to_weight.toFixed(2)) : ''}
            ${p.wing_loading ? this.#specRow('Carga alar', formatNumber(p.wing_loading, 0, ' kg/m²')) : ''}
            ${p.endurance_h ? this.#specRow('Autonomía', `${p.endurance_h} h`) : ''}
          </div>
        </section>

        <!-- Motor -->
        <section class="detail-section" aria-label="Planta motriz">
          <h2 class="detail-section-title">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/></svg>
            Planta Motriz
          </h2>
          <div class="detail-specs">
            ${this.#specRow('Motor', val(p.engine))}
            ${p.thrust_kn ? this.#specRow('Empuje total', formatNumber(p.thrust_kn, 1, ' kN')) : ''}
            ${p.fuel_capacity ? this.#specRow('Combustible interno', formatNumber(p.fuel_capacity, 0, ' L')) : ''}
          </div>
        </section>

        <!-- Dimensiones -->
        <section class="detail-section" aria-label="Dimensiones y masa">
          <h2 class="detail-section-title">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm3 2h6v4H7V5zm8 8v2h1v-2h-1zm-2-2H7v4h6v-4zm2 0h1V9h-1v2zm1-4V5h-1v2h1zM5 5v2H4V5h1zm-1 4h1v2H4V9zm0 4h1v2H4v-2z" clip-rule="evenodd"/></svg>
            Dimensiones y Masa
          </h2>
          <div class="detail-specs detail-specs-grid4">
            <div class="spec-item"><span class="spec-label">Envergadura</span><span class="spec-value mono">${formatNumber(p.wing_span, 2, ' m')}</span></div>
            <div class="spec-item"><span class="spec-label">Longitud</span><span class="spec-value mono">${formatNumber(p.length, 2, ' m')}</span></div>
            <div class="spec-item"><span class="spec-label">Altura</span><span class="spec-value mono">${formatNumber(p.height, 2, ' m')}</span></div>
            ${p.wing_area ? `<div class="spec-item"><span class="spec-label">Sup. alar</span><span class="spec-value mono">${formatNumber(p.wing_area, 1, ' m²')}</span></div>` : ''}
            <div class="spec-item"><span class="spec-label">MTOW</span><span class="spec-value mono">${formatNumber(p.mtow / 1000, 1, ' T')}</span></div>
            <div class="spec-item"><span class="spec-label">Tripulación</span><span class="spec-value mono">${crewLabel}</span></div>
          </div>
        </section>

        <!-- Aviónica -->
        <section class="detail-section" aria-label="Aviónica y sensores">
          <h2 class="detail-section-title">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"/><path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z"/></svg>
            Aviónica y Sensores
          </h2>
          <div class="detail-specs">
            ${p.radar ? `<div class="spec-item spec-avionics"><span class="spec-label">Radar</span><span class="spec-value mono">${p.radar} ${radarTypeMap[p.radar_type] || ''}</span></div>` : (radarTypeMap[p.radar_type] ? `<div class="spec-item"><span class="spec-label">Radar</span><span class="spec-value mono">${radarTypeMap[p.radar_type]}</span></div>` : '')}
            ${this.#specRow('IRST', p.irst ? '✔ Sí' : '✘ No')}
            ${p.ew_system && p.ew_system !== 'Ninguno' ? this.#specRow('Guerra Electrónica', p.ew_system) : ''}
            ${p.data_link && p.data_link !== 'Radio' ? this.#specRow('Enlace de datos', p.data_link) : ''}
            ${p.helmet_system ? this.#specRow('HMD', p.helmet_system) : ''}
          </div>
        </section>

        <!-- Armamento -->
        <section class="detail-section" aria-label="Armamento">
          <h2 class="detail-section-title">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17z"/><path fill-rule="evenodd" d="M15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" clip-rule="evenodd"/></svg>
            Armamento
          </h2>
          <div class="armament-block">${armBlock}</div>
        </section>

        <!-- Radar SVG -->
        <section class="detail-section" aria-label="Perfil de capacidades">
          <h2 class="detail-section-title">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg>
            Perfil de Capacidades
          </h2>
          <div id="radarChartContainer" class="radar-chart-wrap" aria-label="Gráfico radar de capacidades"></div>
        </section>

        ${roleTags ? `<section class="detail-section"><h2 class="detail-section-title">Roles</h2><div class="roles-row">${roleTags}</div></section>` : ''}

        <!-- Producción -->
        <section class="detail-section" aria-label="Producción y estado">
          <h2 class="detail-section-title">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2H4a1 1 0 010-2V4z" clip-rule="evenodd"/></svg>
            Producción y Estado
          </h2>
          <div class="detail-specs">
            ${this.#specRow('Fabricante', val(p.manufacturer))}
            ${p.units_built ? this.#specRow('Unidades fabricadas', formatNumber(p.units_built)) : ''}
            ${p.unit_cost_m ? this.#specRow('Coste unitario', `${p.unit_cost_m} M$ aprox.`) : ''}
            ${p.retired_year ? this.#specRow('Año de retiro', String(p.retired_year)) : ''}
            ${ops ? `<div class="spec-item spec-full"><span class="spec-label">Operadores</span><span class="spec-value mono" style="font-size:.72rem">${ops}${moreOps}</span></div>` : ''}
          </div>
        </section>

        ${variantTags ? `<section class="detail-section"><h2 class="detail-section-title">Variantes</h2><div class="variants-row">${variantTags}</div></section>` : ''}

        <!-- Teatro -->
        <section class="detail-section detail-theater" aria-label="Teatro de operaciones">
          <h2 class="detail-section-title">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
            Teatro de Operaciones
          </h2>
          ${conflictChips
            ? `<div class="conflict-chips-wrap">${conflictChips}</div>`
            : '<p class="no-conflicts">Sin despliegues registrados.</p>'}
          ${p.combat_history?.length
            ? `<div style="margin-top:1rem">
                <h3 class="detail-section-title" style="font-size:.75rem">Historial Operacional</h3>
                <div class="combat-history">${this.#combatHistoryBlock(p.combat_history)}</div>
              </div>` : ''}
        </section>

        ${p.radar_cross_section ? `<section class="detail-section"><h2 class="detail-section-title">Firma de Radar (RCS)</h2><p class="spec-value mono rcs-value">${p.radar_cross_section}</p></section>` : ''}

        <section class="detail-section detail-trivia" aria-label="Dato de inteligencia">
          <h2 class="detail-section-title">⚡ Dato de Inteligencia</h2>
          <blockquote class="trivia-text">"${p.trivia}"</blockquote>
        </section>

        ${tagsHtml ? `<div class="detail-tags" aria-label="Etiquetas">${tagsHtml}</div>` : ''}

        ${relatedHtml}
      </div>

      <!-- Columna visual -->
      <aside class="detail-visual" aria-label="Imagen y estadísticas clave">
        <div class="detail-img-glow" aria-hidden="true"></div>
        <img
          src="./public/max/${p.img}.webp"
          onerror="this.src='${FALLBACK_IMG}'"
          class="detail-img"
          alt="${p.name} — Vista lateral"
          width="600" height="338"
        >
        <div class="detail-img-stats" role="list" aria-label="Estadísticas clave">
          <div class="img-stat" role="listitem"><span class="img-stat-label">Vel. máx.</span><span class="img-stat-val">${formatNumber(p.speed)} km/h</span></div>
          <div class="img-stat" role="listitem"><span class="img-stat-label">Techo</span><span class="img-stat-val">${formatNumber(p.ceiling / 1000, 1)}km</span></div>
          <div class="img-stat" role="listitem"><span class="img-stat-label">Alcance</span><span class="img-stat-val">${formatNumber(p.range)} km</span></div>
          <div class="img-stat" role="listitem"><span class="img-stat-label">MTOW</span><span class="img-stat-val">${formatNumber(p.mtow / 1000, 0)}T</span></div>
        </div>
        ${p.thrust_to_weight ? this.#twBlock(p.thrust_to_weight) : ''}
      </aside>
    </div>`;
  }

  #twBlock(tw) {
    const pct = Math.min(tw * 80, 100);
    return `<div class="detail-tw-bar" aria-label="Relación empuje-peso ${tw.toFixed(2)}">
      <div class="tw-bar-label">
        <span class="mono">Empuje/Peso</span>
        <span class="mono tw-bar-val">${tw.toFixed(2)}</span>
      </div>
      <div class="tw-bar-track" aria-hidden="true">
        <div class="tw-bar-fill${tw >= 1 ? ' over-unity' : ''}" style="width:${pct}%"></div>
      </div>
      <p class="tw-note mono">${tw >= 1 ? '≥ 1.0 — Superioridad de empuje' : '< 1.0 — Empuje subunidad'}</p>
    </div>`;
  }

  #capIcons(p) {
    const caps = [];
    if (p.carrier_capable) caps.push('<span class="cap-icon">🚢 Naval</span>');
    if (p.vtol) caps.push('<span class="cap-icon">⇅ VTOL</span>');
    else if (p.stol) caps.push('<span class="cap-icon">↔ STOL</span>');
    if (p.irst) caps.push('<span class="cap-icon">👁 IRST</span>');
    if (p.stealth === 'high' || p.stealth === 'medium') caps.push('<span class="cap-icon">👻 Stealth</span>');
    if (p.crew === 0) caps.push('<span class="cap-icon">🤖 UAV</span>');
    return caps.join('');
  }

  #specRow(label, value) {
    if (!value || value === '—') return '';
    return `<div class="spec-item"><span class="spec-label">${label}</span><span class="spec-value mono">${value}</span></div>`;
  }

  #armamentBlock(p) {
    const arm = p.armament;
    if (!arm || typeof arm !== 'object') return `<p class="spec-value mono">${p.arm || '—'}</p>`;
    const rows = [];
    if (arm.gun) rows.push(`<div class="arm-row"><span class="arm-icon">🎯</span><span class="arm-label">Cañón</span><span class="arm-val mono">${arm.gun}</span></div>`);
    if (arm.hardpoints) rows.push(`<div class="arm-row"><span class="arm-icon">📦</span><span class="arm-label">Puntos de carga</span><span class="arm-val mono">${arm.hardpoints}</span></div>`);
    if (arm.missiles?.length) rows.push(`<div class="arm-row"><span class="arm-icon">⚡</span><span class="arm-label">Misiles</span><span class="arm-val mono">${arm.missiles.join(' · ')}</span></div>`);
    if (arm.bombs?.length) rows.push(`<div class="arm-row"><span class="arm-icon">💣</span><span class="arm-label">Bombas / Armas</span><span class="arm-val mono">${arm.bombs.join(' · ')}</span></div>`);
    return rows.join('') || `<p class="spec-value mono">${p.arm || '—'}</p>`;
  }

  #combatHistoryBlock(history) {
    const conflictsDB = store.get('conflictsDB');
    return history.map(h => {
      const cf = conflictsDB[h.conflict];
      const label = cf ? `${cf.flag} ${cf.label} (${cf.years})` : h.conflict;
      return `<div class="combat-entry">
        <p class="combat-label">${label}</p>
        ${h.missions ? `<p class="combat-missions mono">${h.missions.toLocaleString('es-ES')} misiones</p>` : ''}
        <p class="combat-notes">${h.notes}</p>
      </div>`;
    }).join('');
  }

  // ── Gauges SVG ─────────────────────────────────────────────
  #renderGauges(p) {
    const container = this.#el?.querySelector('#gaugesRow');
    if (!container) return;

    const gauges = [
      { value: p.speed, max: 4000, color: '#3b82f6', label: 'Velocidad', unit: 'km/h' },
      { value: p.range, max: 15000, color: '#8b5cf6', label: 'Alcance', unit: 'km' },
      { value: p.ceiling, max: 25000, color: '#06b6d4', label: 'Techo', unit: 'm' },
      { value: p.mtow / 1000, max: 300, color: '#f59e0b', label: 'MTOW', unit: 'T' },
    ];

    container.innerHTML = gauges.map(() => '<div class="gauge-item"></div>').join('');
    const items = container.querySelectorAll('.gauge-item');
    gauges.forEach((g, i) => drawGauge(items[i], g.value, g.max, { ...g, size: 110 }));
  }

  // ── Radar Chart SVG ────────────────────────────────────────
  #renderRadar(p) {
    const container = this.#el?.querySelector('#radarChartContainer');
    if (!container) return;

    const axes = [
      { label: 'Vel.' },
      { label: 'Alcance' },
      { label: 'Techo' },
      { label: 'MTOW' },
      { label: 'T/W' },
    ];

    const values = [
      p.speed / 4000,
      p.range / 15000,
      p.ceiling / 25000,
      (p.mtow / 1000) / 300,
      Math.min((p.thrust_to_weight || 0) / 1.5, 1),
    ].map(v => Math.min(Math.max(v, 0), 1));

    drawRadarChart(container, [
      { label: p.name, color: '#3b82f6', values }
    ], axes, { size: 240 });
  }

  // ── Wikipedia ──────────────────────────────────────────────
  async #loadWikipedia(p) {
    if (!p.wiki) return;
    const textEl = this.#el?.querySelector('#wikiText');
    const linkEl = this.#el?.querySelector('#wikiLink');
    const spinner = this.#el?.querySelector('#wikiSpinner');

    if (wikiCache.has(p.wiki)) {
      this.#renderWiki(wikiCache.get(p.wiki), textEl, linkEl, spinner);
      return;
    }

    try {
      const tryFetch = async (lang) => {
        const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(p.wiki)}`;
        const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (!r.ok) return null;
        const d = await r.json();
        return { extract: d.extract || '', url: d.content_urls?.desktop?.page || '', lang, title: d.title };
      };

      let result = await tryFetch('es');
      if (!result || result.extract.length < 60) result = await tryFetch('en');

      if (result) {
        wikiCache.set(p.wiki, result);
        this.#renderWiki(result, textEl, linkEl, spinner);
      } else {
        if (textEl) { textEl.textContent = 'Información no disponible.'; textEl.classList.remove('loading'); }
        spinner?.classList.add('hidden');
      }
    } catch {
      if (textEl) { textEl.textContent = 'No se pudo conectar con Wikipedia.'; textEl.classList.remove('loading'); }
      spinner?.classList.add('hidden');
    }
  }

  #renderWiki(result, textEl, linkEl, spinner) {
    spinner?.classList.add('hidden');
    if (textEl) {
      const sentences = result.extract.split(/(?<=[.!?])\s+/);
      textEl.textContent = sentences.slice(0, 3).join(' ') || 'Sin extracto.';
      textEl.classList.remove('loading');
    }
    if (result.url && linkEl) {
      linkEl.href = result.url;
      linkEl.classList.remove('hidden');
      linkEl.innerHTML = `Leer en Wikipedia ${result.lang === 'es' ? '🇪🇸 ES' : '🇬🇧 EN'} <svg viewBox="0 0 20 20" fill="currentColor" width="10" height="10" aria-hidden="true"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/></svg>`;
    }
  }

  // ── Eventos ────────────────────────────────────────────────
  #bindEvents() {
    this.#el.querySelector('#shareBtn')?.addEventListener('click', async () => {
      const url = `${location.origin}/aircraft/${this.#plane.id}`;
      await copyToClipboard(url);
      showToast('✓ Enlace copiado al portapapeles');
    });

    this.#el.querySelector('#compareDetailBtn')?.addEventListener('click', () => {
      store.toggleCompare(this.#plane.id);
      const inCompare = store.get('compareList').includes(this.#plane.id);
      const btn = this.#el.querySelector('#compareDetailBtn');
      btn.classList.toggle('active', inCompare);
      btn.setAttribute('aria-pressed', inCompare);
    });
  }
}
