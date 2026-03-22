/**
 * views/StatsView.js — Estadísticas globales de la base de datos
 * Ruta: /stats
 * Característica nueva (no estaba en roadmap).
 */

import { store }  from '../store/index.js';
import { router } from '../router/index.js';
import { setPageMeta, FALLBACK_IMG, genBadgeHTML , buildBreadcrumb } from '../utils/index.js';
import { drawBarChart, drawPieChart } from '../components/Charts.js';

export class StatsView {
  #el = null;

  async render() {
    setPageMeta({
      title: 'Estadísticas Globales — AeroPedia',
      description: 'Análisis y distribución estadística de la base de datos de aviación militar.',
    });

    this.#el = document.createElement('div');
    this.#el.className = 'stats-view';

    const db = store.get('aircraftDB');
    if (!db.length) {
      this.#el.innerHTML = `<div class="not-found-inner"><p class="not-found-sub">Datos no disponibles.</p></div>`;
      return this.#el;
    }

    const stats = this.#compute(db);
    this.#el.innerHTML = this.#template(stats, db);
    this.#renderCharts(stats);
    this.#bindEvents();
    return this.#el;
  }

  // ── Computar estadísticas ──────────────────────────────────
  #compute(db) {
    const byType = {}, byCountry = {}, byGen = {}, byDecade = {}, byStatus = {};
    let maxSpeed = 0, maxRange = 0, maxCeiling = 0, totalUnits = 0;
    let fastest, longest, highest, heaviest;

    for (const p of db) {
      byType[p.type]                    = (byType[p.type] || 0) + 1;
      byCountry[p.country]              = (byCountry[p.country] || 0) + 1;
      const gen = p.generation || 'Sin gen';
      byGen[gen]                        = (byGen[gen] || 0) + 1;
      const decade = `${Math.floor(p.year / 10) * 10}s`;
      byDecade[decade]                  = (byDecade[decade] || 0) + 1;
      byStatus[p.status || 'unknown']   = (byStatus[p.status || 'unknown'] || 0) + 1;
      if (p.units_built) totalUnits += p.units_built;

      if (p.speed   > maxSpeed)   { maxSpeed   = p.speed;   fastest  = p; }
      if (p.range   > maxRange)   { maxRange   = p.range;   longest  = p; }
      if (p.ceiling > maxCeiling) { maxCeiling = p.ceiling; highest  = p; }
      if (!heaviest || p.mtow > heaviest.mtow) heaviest = p;
    }

    const avgSpeed   = Math.round(db.reduce((s,p)=>s+p.speed,0)   / db.length);
    const avgRange   = Math.round(db.reduce((s,p)=>s+p.range,0)   / db.length);
    const avgCeiling = Math.round(db.reduce((s,p)=>s+p.ceiling,0) / db.length);

    const topCountries = Object.entries(byCountry)
      .sort((a,b)=>b[1]-a[1]).slice(0, 10);
    const topTypes     = Object.entries(byType).sort((a,b)=>b[1]-a[1]);
    const decades      = Object.entries(byDecade).sort((a,b)=>a[0].localeCompare(b[0]));
    const generations  = Object.entries(byGen)
      .filter(([k])=>k!=='Sin gen')
      .sort((a,b)=>a[0].localeCompare(b[0]));

    return { db, byType, byCountry, byGen, byDecade, byStatus,
             topCountries, topTypes, decades, generations,
             avgSpeed, avgRange, avgCeiling, totalUnits,
             fastest, longest, highest, heaviest };
  }

  // ── Template ─────────────────────────────────────────────────
  #template(s, db) {
    const fmt = n => (n||0).toLocaleString('es-ES');
    return `
    <div class="stats-header">
      <a href="/" data-link class="btn-back">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>
        Volver
      </a>
      <div>
        <h1 class="stats-title">
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" aria-hidden="true"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
          Estadísticas Globales
        </h1>
        <p class="stats-subtitle">Análisis completo de ${db.length} aeronaves militares</p>
      </div>
    </div>

    <!-- Mega stats -->
    <div class="stats-mega-grid" role="list">
      ${[
        [db.length, 'aeronaves totales', '#3b82f6'],
        [Object.keys(s.byCountry).length, 'países operadores', '#8b5cf6'],
        [Object.keys(s.byType).length, 'tipos de aeronave', '#06b6d4'],
        [fmt(s.totalUnits), 'unidades fabricadas', '#f59e0b'],
        [fmt(s.avgSpeed)+'km/h', 'velocidad media', '#3b82f6'],
        [fmt(s.avgRange)+'km', 'alcance medio', '#8b5cf6'],
        [s.byStatus['active']||0, 'en servicio activo', '#10b981'],
        [s.byStatus['retired']||0, 'retiradas', '#64748b'],
      ].map(([n,l,c])=>`
        <div class="stats-mega-card" role="listitem">
          <p class="stats-mega-num" style="color:${c}">${n}</p>
          <p class="stats-mega-label">${l}</p>
        </div>`).join('')}
    </div>

    <!-- Records -->
    <section class="stats-section" aria-labelledby="hd-records">
      <h2 id="hd-records" class="stats-section-title">🏆 Records de la Base de Datos</h2>
      <div class="stats-records-grid">
        ${[
          [s.fastest,  '⚡ Más veloz',      `${fmt(s.fastest?.speed)} km/h`],
          [s.longest,  '🗺 Mayor alcance',   `${fmt(s.longest?.range)} km`],
          [s.highest,  '📡 Mayor techo',     `${fmt(s.highest?.ceiling)} m`],
          [s.heaviest, '⚖ Más pesado',      `${fmt(Math.round((s.heaviest?.mtow||0)/1000))} T`],
        ].map(([p, label, val]) => p ? `
          <button class="stats-record-card" data-id="${p.id}" aria-label="Ver ficha de ${p.name}">
            <img src="./public/min/${p.img}.webp" alt="${p.name}" width="160" height="90"
              style="width:100%;height:90px;object-fit:cover;border-radius:6px;margin-bottom:.5rem"
              onerror="this.style.display='none'">
            <p class="stats-record-label">${label}</p>
            <p class="stats-record-plane">${p.name}</p>
            <p class="stats-record-val">${val}</p>
            <p class="stats-record-country mono">${p.country} · ${p.year}</p>
          </button>` : '').join('')}
      </div>
    </section>

    <!-- Charts grid -->
    <div class="stats-charts-grid">

      <section class="stats-section" aria-labelledby="hd-type">
        <h2 id="hd-type" class="stats-section-title">Por tipo de aeronave</h2>
        <div class="stats-chart-row">
          <div id="chartType" aria-label="Gráfico circular por tipo"></div>
          <div class="stats-legend" id="legendType"></div>
        </div>
      </section>

      <section class="stats-section" aria-labelledby="hd-decade">
        <h2 id="hd-decade" class="stats-section-title">Por década de introducción</h2>
        <canvas id="chartDecade" width="320" height="160" class="compare-bar-canvas"
          aria-label="Gráfico de barras por décadas"></canvas>
      </section>

      <section class="stats-section" aria-labelledby="hd-country">
        <h2 id="hd-country" class="stats-section-title">Top 10 países</h2>
        <canvas id="chartCountry" width="320" height="160" class="compare-bar-canvas"
          aria-label="Gráfico de barras top 10 países"></canvas>
      </section>

      <section class="stats-section" aria-labelledby="hd-gen">
        <h2 id="hd-gen" class="stats-section-title">Por generación</h2>
        <canvas id="chartGen" width="320" height="160" class="compare-bar-canvas"
          aria-label="Gráfico de barras por generación"></canvas>
      </section>

    </div>

    <!-- Speed distribution -->
    <section class="stats-section" aria-labelledby="hd-speed">
      <h2 id="hd-speed" class="stats-section-title">Distribución de velocidades</h2>
      <canvas id="chartSpeed" width="700" height="160" style="width:100%;display:block"
        aria-label="Histograma de distribución de velocidades"></canvas>
      <div class="stats-speed-legend" aria-hidden="true">
        <span style="color:#64748b">▐ Subsónico &lt; 1235 km/h</span>
        <span style="color:#f59e0b">▐ Transsónico 1235–1482</span>
        <span style="color:#3b82f6">▐ Supersónico &gt; 1482 km/h</span>
      </div>
    </section>

    <!-- Top velocidades -->
    <section class="stats-section" aria-labelledby="hd-top">
      <h2 id="hd-top" class="stats-section-title">Las 10 aeronaves más rápidas</h2>
      <div class="stats-top-list" role="list">
        ${[...db].sort((a,b)=>b.speed-a.speed).slice(0,10).map((p,i)=>
          `<button class="stats-top-item" data-id="${p.id}" role="listitem" aria-label="Ver ficha de ${p.name}">
            <span class="stats-top-rank mono">${['🥇','🥈','🥉'][i]||`#${i+1}`}</span>
            <img src="./public/min/${p.img}.webp" alt="" width="52" height="30"
              style="object-fit:cover;border-radius:4px;flex-shrink:0" onerror="this.style.display='none'">
            <div class="stats-top-info">
              <span class="stats-top-name">${p.name}</span>
              <span class="stats-top-country mono">${p.country} · ${p.year}</span>
            </div>
            <span class="stats-top-val" style="color:#3b82f6">${p.speed.toLocaleString('es-ES')} km/h</span>
          </button>`
        ).join('')}
      </div>
    </section>`;
  }

  // ── Render charts ──────────────────────────────────────────
  #renderCharts(s) {
    const TYPE_COLORS = {
      'Caza':'#3b82f6','Bombardero':'#ef4444','Ataque':'#f59e0b',
      'Transporte':'#8b5cf6','Especial':'#06b6d4','Experimental':'#f472b6'
    };
    const dark = document.body.classList.contains('dark');

    // Pie: tipo
    const typeSegs = s.topTypes.map(([k,v])=>({ label:k, value:v, color:TYPE_COLORS[k]||'#64748b' }));
    drawPieChart(this.#el.querySelector('#chartType'), typeSegs, { size:150 });
    const legendType = this.#el.querySelector('#legendType');
    if (legendType) legendType.innerHTML = typeSegs.map(t=>
      `<div style="display:flex;align-items:center;gap:.35rem;font-size:.7rem;color:var(--text-2)">
        <span style="width:9px;height:9px;border-radius:50%;background:${t.color};flex-shrink:0"></span>
        ${t.label} <span style="color:var(--text-3);font-family:var(--font-mono)">${t.value}</span>
      </div>`
    ).join('');

    // Bar: décadas
    const decadeCanvas = this.#el.querySelector('#chartDecade');
    if (decadeCanvas) drawBarChart(decadeCanvas, s.decades.map(([k,v])=>({label:k,value:v})), { color:'#8b5cf6', animated:true });

    // Bar: países
    const countryCanvas = this.#el.querySelector('#chartCountry');
    if (countryCanvas) drawBarChart(countryCanvas, s.topCountries.map(([k,v])=>({label:k.split(' ')[0],value:v})), { color:'#06b6d4', animated:true });

    // Bar: generaciones
    const genCanvas = this.#el.querySelector('#chartGen');
    if (genCanvas) drawBarChart(genCanvas, s.generations.map(([k,v])=>({label:k,value:v})), { color:'#f472b6', animated:true });

    // Histograma de velocidades
    this.#renderSpeedHistogram(s.db);
  }

  #renderSpeedHistogram(db) {
    const canvas = this.#el?.querySelector('#chartSpeed');
    if (!canvas) return;
    const ctx  = canvas.getContext('2d');
    const dpr  = window.devicePixelRatio || 1;
    const W    = canvas.offsetWidth || 700;
    const H    = 160;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const dark      = document.body.classList.contains('dark');
    const gridColor = dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)';
    const textColor = dark ? '#64748b' : '#94a3b8';

    // Buckets: 0-500, 500-1000, 1000-1500, 1500-2000, 2000-2500, 2500-3000, 3000+
    const buckets = [
      { label:'0–500',    min:0,    max:500,  color:'#64748b' },
      { label:'500–1k',   min:500,  max:1000, color:'#94a3b8' },
      { label:'1k–1.2k',  min:1000, max:1200, color:'#f59e0b' },
      { label:'1.2k–1.5k',min:1200, max:1500, color:'#f97316' },
      { label:'1.5k–2k',  min:1500, max:2000, color:'#3b82f6' },
      { label:'2k–3k',   min:2000, max:3000, color:'#6366f1' },
      { label:'3k+',     min:3000, max:Infinity, color:'#8b5cf6' },
    ];

    buckets.forEach(b => { b.count = db.filter(p => p.speed >= b.min && p.speed < b.max).length; });
    const maxCount = Math.max(...buckets.map(b=>b.count), 1);
    const pad = { t:20, r:12, b:38, l:36 };
    const cW  = W - pad.l - pad.r;
    const cH  = H - pad.t - pad.b;
    const bW  = (cW / buckets.length) * 0.7;
    const gap = (cW / buckets.length) * 0.3;

    ctx.clearRect(0, 0, W, H);

    // Grilla
    for (let i=0; i<=4; i++) {
      const y = pad.t + cH - (cH/4)*i;
      ctx.beginPath(); ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
      ctx.moveTo(pad.l, y); ctx.lineTo(pad.l+cW, y); ctx.stroke();
      ctx.fillStyle = textColor; ctx.font = '8px monospace'; ctx.textAlign = 'right';
      ctx.fillText(Math.round((maxCount/4)*i), pad.l-4, y+3);
    }

    buckets.forEach((b, i) => {
      const x   = pad.l + (cW / buckets.length) * i + gap/2;
      const bH  = (b.count / maxCount) * cH;
      const y   = pad.t + cH - bH;
      const grad = ctx.createLinearGradient(x, y, x, y+bH);
      grad.addColorStop(0, b.color); grad.addColorStop(1, b.color+'88');
      ctx.fillStyle = grad;
      ctx.shadowColor = b.color+'44'; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.roundRect(x, y, bW, bH, [3,3,0,0]); ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = textColor; ctx.font = '8px monospace'; ctx.textAlign = 'center';
      ctx.fillText(b.label, x+bW/2, H-pad.b+14);
      if (b.count > 0) {
        ctx.fillStyle = b.color; ctx.font = 'bold 8px monospace';
        ctx.fillText(b.count, x+bW/2, y-4);
      }
    });
  }

  // ── Eventos ───────────────────────────────────────────────────
  #bindEvents() {
    this.#el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-id]');
      if (btn?.dataset.id) router.navigate(`/aircraft/${btn.dataset.id}`);
    });
  }
}
