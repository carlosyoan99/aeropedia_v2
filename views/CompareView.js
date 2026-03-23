/**
 * views/CompareView.js — Comparador de aeronaves con radar SVG nativo
 */

import { store } from '../store/index.js';
import { router } from '../router/index.js';
import { formatNumber, formatStat, FALLBACK_IMG, setPageMeta, STAT_META, genBadgeHTML , buildBreadcrumb } from '../utils/index.js';
import { drawRadarChart, drawBarChart } from '../components/Charts.js';

const COMPARE_COLORS = ['#3b82f6', '#f59e0b', '#10b981'];

export class CompareView {
  #el = null;
  #planes = [];
  #unsubs = [];

  async render() {
    setPageMeta({
      title: 'Comparador — AeroPedia',
      description: 'Compara especificaciones técnicas de aeronaves militares.',
    });

    // Recuperar IDs a comparar
    let ids = store.get('compareList');
    if (!ids.length) {
      try { ids = JSON.parse(sessionStorage.getItem('aeropedia_compare') || '[]'); } catch {}
    }

    const aircraftDB = store.get('aircraftDB');
    this.#planes = ids.map(id => aircraftDB.find(p => p.id === id)).filter(Boolean);

    this.#el = document.createElement('div');
    this.#el.className = 'compare-view';
    this.#el.innerHTML = this.#template();
    this.#renderCharts();
    this.#bindEvents();
    return this.#el;
  }

  destroy() {
    this.#unsubs.forEach(u => u());
  }

  #template() {
    if (!this.#planes.length) {
      return `<div class="compare-empty">
        <div class="compare-empty-inner">
          <p class="compare-empty-icon">⚖</p>
          <p class="compare-empty-title">Nada que comparar</p>
          <p class="compare-empty-sub">Selecciona 2 o 3 aeronaves desde la galería para compararlas aquí.</p>
          <a href="/" data-link class="btn-back-home">← Ir a la galería</a>
        </div>
      </div>`;
    }

    const planes = this.#planes;
    const stats = ['speed', 'range', 'ceiling', 'mtow'];

    return `
    <div class="compare-header">
      <button class="btn-back" onclick="history.back()" aria-label="Volver atrás">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>
        Volver
      </button>
        ${buildBreadcrumb('/compare')}
      <h1 class="compare-title">
        <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" aria-hidden="true"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
        Comparación de Aeronaves
      </h1>
      <button id="clearCompareAllBtn" class="btn-cancel" style="margin-left:auto"
        aria-label="Limpiar comparador">
        <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true">
          <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
        Limpiar comparador
      </button>
    </div>

    <!-- Cards de aeronaves -->
    <div class="compare-planes" style="--n:${planes.length}">
      ${planes.map((p, i) => `
        <div class="compare-plane-card" style="--accent:${COMPARE_COLORS[i]}">
          <div class="compare-plane-img-wrap">
            <img src="./public/min/${p.img}.webp" alt="${p.name}" width="240" height="135"
              onerror="this.src='${FALLBACK_IMG}'">
            <div class="compare-plane-color-bar" style="background:${COMPARE_COLORS[i]}"></div>
          </div>
          <div class="compare-plane-info">
            <h2 class="compare-plane-name">${p.name}</h2>
            <div class="compare-plane-meta">
              <span>${p.country}</span>
              <span>·</span>
              <span>${p.year}</span>
              <span>·</span>
              <span>${p.type}</span>
              ${genBadgeHTML(p)}
            </div>
          </div>
        </div>`).join('')}
    </div>

    <!-- Radar Chart -->
    <section class="compare-section" aria-label="Gráfico radar comparativo">
      <h2 class="compare-section-title">Perfil de Capacidades</h2>
      <div class="compare-radar-wrap">
        <div id="radarContainer" class="compare-radar" aria-label="Radar comparativo"></div>
        <div class="radar-legend" role="list">
          ${planes.map((p, i) => `
            <div class="radar-legend-item" role="listitem">
              <span class="radar-legend-dot" style="background:${COMPARE_COLORS[i]}"></span>
              <span>${p.name}</span>
            </div>`).join('')}
        </div>
      </div>
    </section>

    <!-- Bar Charts por stat -->
    <section class="compare-section" aria-label="Comparación por estadísticas">
      <h2 class="compare-section-title">Estadísticas Clave</h2>
      <div class="compare-bar-charts">
        ${stats.map(stat => `
          <div class="compare-bar-chart-wrap">
            <h3 class="compare-bar-title">${STAT_META[stat]?.label || stat}</h3>
            <canvas id="barChart-${stat}" class="compare-bar-canvas" width="300" height="160"
              aria-label="Gráfico de barras: ${STAT_META[stat]?.label}"></canvas>
          </div>`).join('')}
      </div>
    </section>

    <!-- Tabla comparativa -->
    <section class="compare-section" aria-label="Tabla comparativa detallada">
      <h2 class="compare-section-title">Tabla Comparativa</h2>
      <div class="compare-table-wrap">
        <table class="compare-table" aria-label="Comparación de especificaciones">
          <thead>
            <tr>
              <th scope="col" class="compare-th-label">Especificación</th>
              ${planes.map((p, i) => `
                <th scope="col" style="color:${COMPARE_COLORS[i]}">${p.name}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${this.#buildTableRows(planes)}
          </tbody>
        </table>
      </div>
    </section>`;
  }

  #buildTableRows(planes) {
    const rows = [
      { label: 'País', fn: p => p.country },
      { label: 'Año servicio', fn: p => String(p.year) },
      { label: 'Tipo', fn: p => p.type },
      { label: 'Generación', fn: p => p.generation || '—' },
      { label: 'Velocidad máx.', fn: p => `${p.speed.toLocaleString('es-ES')} km/h`, key: 'speed', higherBetter: true },
      { label: 'Mach máx.', fn: p => `M ${(p.speed / 1234.8).toFixed(2)}`, key: 'speed', higherBetter: true },
      { label: 'Alcance', fn: p => `${p.range.toLocaleString('es-ES')} km`, key: 'range', higherBetter: true },
      { label: 'Radio combate', fn: p => p.combat_radius ? `${p.combat_radius.toLocaleString('es-ES')} km` : '—', key: 'combat_radius', higherBetter: true },
      { label: 'Techo servicio', fn: p => `${p.ceiling.toLocaleString('es-ES')} m`, key: 'ceiling', higherBetter: true },
      { label: 'MTOW', fn: p => `${(p.mtow / 1000).toFixed(1)} T`, key: 'mtow', higherBetter: false },
      { label: 'Empuje/Peso', fn: p => p.thrust_to_weight ? p.thrust_to_weight.toFixed(2) : '—', key: 'thrust_to_weight', higherBetter: true },
      { label: 'Carga alar', fn: p => p.wing_loading ? `${p.wing_loading} kg/m²` : '—', key: 'wing_loading', higherBetter: false },
      { label: 'Motor', fn: p => p.engine || '—' },
      { label: 'Empuje total', fn: p => p.thrust_kn ? `${p.thrust_kn} kN` : '—', key: 'thrust_kn', higherBetter: true },
      { label: 'Radar', fn: p => p.radar || '—' },
      { label: 'Tipo radar', fn: p => p.radar_type || '—' },
      { label: 'IRST', fn: p => p.irst ? '✔ Sí' : '✘ No' },
      { label: 'Sigilo', fn: p => p.stealth || '—' },
      { label: 'Envergadura', fn: p => `${p.wing_span} m`, key: 'wing_span' },
      { label: 'Longitud', fn: p => `${p.length} m`, key: 'length' },
      { label: 'Tripulación', fn: p => p.crew === 0 ? 'UAV' : String(p.crew) },
      { label: 'Unidades fab.', fn: p => p.units_built ? p.units_built.toLocaleString('es-ES') : '—' },
      { label: 'Coste unit.', fn: p => p.unit_cost_m ? `${p.unit_cost_m} M$` : '—' },
      { label: 'Estado', fn: p => p.status || '—' },
    ];

    return rows.map(row => {
      const values = planes.map(p => ({ text: row.fn(p), raw: row.key ? p[row.key] : null }));

      // Determinar mejor/peor si hay key numérico
      let bestIdx = -1;
      let worstIdx = -1;
      if (row.key && row.higherBetter !== undefined) {
        const nums = values.map(v => parseFloat(v.raw) || 0);
        const valid = nums.filter(n => n > 0);
        if (valid.length > 1) {
          const best = row.higherBetter ? Math.max(...nums) : Math.min(...nums.filter(n => n > 0));
          const worst = row.higherBetter ? Math.min(...nums.filter(n => n > 0)) : Math.max(...nums);
          bestIdx = nums.indexOf(best);
          worstIdx = nums.indexOf(worst);
        }
      }

      return `<tr class="compare-table-row">
        <td class="compare-td-label">${row.label}</td>
        ${values.map((v, i) => `
          <td class="compare-td${i === bestIdx ? ' best' : i === worstIdx ? ' worst' : ''}"
            style="${i === bestIdx ? `color:${COMPARE_COLORS[i]}` : ''}">
            ${v.text}
            ${i === bestIdx ? '<span class="best-badge" aria-label="Mejor">▲</span>' : ''}
          </td>`).join('')}
      </tr>`;
    }).join('');
  }

  #renderCharts() {
    const planes = this.#planes;
    if (!planes.length) return;

    // Radar
    const radarContainer = this.#el?.querySelector('#radarContainer');
    if (radarContainer) {
      const axes = [
        { label: 'Vel.' }, { label: 'Alcance' }, { label: 'Techo' },
        { label: 'MTOW' }, { label: 'T/W' },
      ];
      const datasets = planes.map((p, i) => ({
        label: p.name,
        color: COMPARE_COLORS[i],
        values: [
          p.speed / 4000,
          p.range / 15000,
          p.ceiling / 25000,
          (p.mtow / 1000) / 300,
          Math.min((p.thrust_to_weight || 0) / 1.5, 1),
        ].map(v => Math.min(Math.max(v, 0), 1)),
      }));
      drawRadarChart(radarContainer, datasets, axes, { size: 300 });
    }

    // Bar charts
    const stats = ['speed', 'range', 'ceiling', 'mtow'];
    const units = { speed: ' km/h', range: ' km', ceiling: ' m', mtow: ' T' };

    for (const stat of stats) {
      const canvas = this.#el?.querySelector(`#barChart-${stat}`);
      if (!canvas) continue;

      const data = planes.map((p, i) => ({
        label: p.name.split(' ').pop(), // apellido del avión
        value: stat === 'mtow' ? Math.round(p.mtow / 1000) : p[stat],
        color: COMPARE_COLORS[i],
      }));

      // Bar chart con barras por colores
      const maxVal = Math.max(...data.map(d => d.value), 1);
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.offsetWidth || 280;
      const H = 160;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);

      const dark = document.body.classList.contains('dark');
      const gridColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
      const textColor = dark ? '#64748b' : '#94a3b8';
      const pad = { t: 20, r: 10, b: 38, l: 40 };
      const cW = W - pad.l - pad.r;
      const cH = H - pad.t - pad.b;

      ctx.clearRect(0, 0, W, H);

      // Grilla
      for (let i = 0; i <= 4; i++) {
        const y = pad.t + cH - (cH / 4) * i;
        ctx.beginPath();
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.moveTo(pad.l, y);
        ctx.lineTo(pad.l + cW, y);
        ctx.stroke();
        const val = Math.round((maxVal / 4) * i);
        ctx.fillStyle = textColor;
        ctx.font = '8px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val, pad.l - 4, y + 3);
      }

      const bW = (cW / data.length) * 0.6;
      const gap = (cW / data.length) * 0.4;

      data.forEach((d, i) => {
        const x = pad.l + (cW / data.length) * i + gap / 2;
        const bH = (d.value / maxVal) * cH;
        const y = pad.t + cH - bH;

        ctx.shadowColor = d.color + '44';
        ctx.shadowBlur = 6;
        const grad = ctx.createLinearGradient(x, y, x, y + bH);
        grad.addColorStop(0, d.color);
        grad.addColorStop(1, d.color + '77');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, bW, bH, [3, 3, 0, 0]);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = textColor;
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(d.label.length > 10 ? d.label.slice(0, 9) + '…' : d.label, x + bW / 2, H - pad.b + 12);

        if (bH > 20) {
          ctx.fillStyle = d.color;
          ctx.font = 'bold 7px monospace';
          const vStr = d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : String(d.value);
          ctx.fillText(vStr + (units[stat] || ''), x + bW / 2, y - 4);
        }
      });
    }
  }

  #bindEvents() {
    this.#el?.addEventListener('click', (e) => {
      if (e.target.closest('[data-link]')) return;

      // Limpiar comparador completo
      if (e.target.closest('#clearCompareAllBtn')) {
        store.clearCompare();
        router.navigate('/');
      }
    });
  }
}
