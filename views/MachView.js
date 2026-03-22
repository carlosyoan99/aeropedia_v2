/**
 * views/MachView.js — Calculadora de Número Mach
 */

import { store } from '../store/index.js';
import { setPageMeta, speedOfSound, FALLBACK_IMG } from '../utils/index.js';
import { drawSparkline } from '../components/Charts.js';

export class MachView {
  #el   = null;
  #subs = [];

  async render() {
    setPageMeta({
      title: 'Calculadora Mach — AeroPedia',
      description: 'Calcula el número Mach de una aeronave a cualquier altitud.',
    });

    this.#el = document.createElement('div');
    this.#el.className = 'mach-view';
    this.#el.innerHTML = this.#template();
    this.#bindEvents();
    this.#populateRecents();
    // Re-populate when recents change (new aircraft visited)
    this.#subs.push(store.subscribe('recents', () => this.#populateRecents()));
    return this.#el;
  }

  destroy() {
    this.#subs.forEach(u => u());
  }

  #populateRecents() {
    const recents = store.get('recents') || [];
    const db      = store.get('aircraftDB') || [];
    const section = this.#el?.querySelector('#machRecents');
    const grid    = this.#el?.querySelector('#machRecentsGrid');
    if (!section || !grid) return;

    const planes = recents
      .map(id => db.find(p => p.id === id))
      .filter(p => p && p.speed > 0)
      .slice(0, 5);

    if (!planes.length) return;

    section.style.display = '';
    grid.innerHTML = planes.map(p => `
      <button class="mach-ref-btn mach-ref-btn--recent" data-speed="${p.speed}"
        aria-label="Usar velocidad de ${p.name}: ${p.speed.toLocaleString('es-ES')} km/h">
        <img src="./public/min/${p.img}.webp" alt="" width="44" height="25"
          style="object-fit:cover;border-radius:3px;flex-shrink:0"
          onerror="this.style.display='none'">
        <span class="mach-ref-name" style="flex:1;text-align:left">${p.name}</span>
        <span class="mach-ref-speed mono">${p.speed.toLocaleString('es-ES')} km/h</span>
      </button>`).join('');

    // Bind the new buttons
    grid.querySelectorAll('.mach-ref-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = this.#el?.querySelector('#machSpeedInput');
        if (input) { input.value = btn.dataset.speed; input.dispatchEvent(new Event('input')); }
      });
    });
  }

  #template() {
    return `
    <div class="mach-header">
      <a href="/" data-link class="btn-back">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>
        Volver
      </a>
      <h1 class="mach-title">Calculadora Mach</h1>
    </div>

    <div class="mach-layout">
      <div class="mach-calc-card" role="main" aria-label="Calculadora de número Mach">

        <!-- Input de velocidad -->
        <div class="mach-input-group" role="group" aria-label="Velocidad de la aeronave">
          <label class="mach-label" for="machSpeedInput">Velocidad de la aeronave</label>
          <div class="mach-speed-row">
            <input
              type="number"
              id="machSpeedInput"
              class="mach-number-input"
              placeholder="Ej. 2000"
              min="0"
              max="40000"
              step="10"
              aria-describedby="machResultStatus"
            >
            <select id="machUnit" class="mach-unit-select" aria-label="Unidad de velocidad">
              <option value="kmh">km/h</option>
              <option value="mph">mph</option>
              <option value="knots">nudos</option>
            </select>
          </div>
        </div>

        <!-- Altitud -->
        <div class="mach-input-group" role="group" aria-label="Altitud de vuelo">
          <label class="mach-label" for="altSlider">
            Altitud de vuelo:
            <span id="altLabel" class="mach-alt-val mono">0 m (nivel del mar)</span>
          </label>
          <input
            type="range"
            id="altSlider"
            class="mach-slider"
            min="0" max="20000" step="500" value="0"
            aria-label="Altitud en metros"
          >
          <div class="mach-slider-labels" aria-hidden="true">
            <span class="mono">0 m</span>
            <span class="mono">10.000 m</span>
            <span class="mono">20.000 m</span>
          </div>
        </div>

        <!-- Resultado -->
        <div class="mach-result-area" role="status" id="machResultStatus" aria-live="polite" aria-atomic="true">
          <div class="mach-result-main">
            <p id="machResult" class="mach-result header-font">—</p>
            <p id="machCategory" class="mach-category">Introduce una velocidad</p>
          </div>
          <div class="mach-result-sub" id="machResultSub"></div>
        </div>

        <!-- Velocidad del sonido -->
        <div class="mach-sos-info" aria-label="Velocidad del sonido a esta altitud">
          <span class="mono mach-sos-label">Vel. del sonido a esta altitud:</span>
          <span id="sosVal" class="mono mach-sos-val">1234.8 km/h</span>
        </div>

        <!-- Referencia de aeronaves -->
        <div class="mach-reference" aria-label="Referencia de velocidades conocidas">
          <p class="mach-ref-title">Referencias rápidas</p>
          <div class="mach-ref-grid">
            ${[
              { name: 'F-22 Raptor', speed: 1960 },
              { name: 'MiG-25', speed: 3395 },
              { name: 'SR-71 Blackbird', speed: 3540 },
              { name: 'F-35A', speed: 1900 },
              { name: 'F/A-18 Hornet', speed: 1915 },
              { name: 'Concorde', speed: 2179 },
            ].map(ref => `
              <button class="mach-ref-btn" data-speed="${ref.speed}" aria-label="Usar velocidad de ${ref.name}: ${ref.speed} km/h">
                <span class="mach-ref-name">${ref.name}</span>
                <span class="mach-ref-speed mono">${ref.speed.toLocaleString('es-ES')} km/h</span>
              </button>`).join('')}
          </div>
        </div>

        <!-- Recientes: aeronaves vistas -->
        <div class="mach-reference" id="machRecents" aria-label="Tus aeronaves recientes" style="display:none">
          <p class="mach-ref-title">Aeronaves que has visto</p>
          <div class="mach-ref-grid" id="machRecentsGrid"></div>
        </div>
      </div>

      <!-- Panel de info Mach -->
      <aside class="mach-info-panel" aria-label="Regímenes de vuelo">
        <h2 class="mach-info-title">Regímenes de Vuelo</h2>
        <div class="mach-regimes">
          ${[
            { cls: 'subsonic',    range: '< M 0.8',   name: 'Subsónico',       desc: 'Aviones comerciales, transporte, helicópteros.' },
            { cls: 'transonic',   range: 'M 0.8–1.2', name: 'Transsónico',     desc: 'Zona de ondas de choque mixtas. La mayoría de cazas operan aquí.' },
            { cls: 'supersonic',  range: 'M 1.2–5',   name: 'Supersónico',     desc: 'Cazas interceptores, misiles de crucero avanzados.' },
            { cls: 'hypersonic',  range: 'M 5–10',    name: 'Hipersónico',     desc: 'Misiles hipersónicos, planeadores. Calor extremo por fricción.' },
            { cls: 'highersonic', range: '> M 10',    name: 'Alta Hipersonía', desc: 'Vehículos de reentrada, proyectos experimentales.' },
          ].map(r => `
            <div class="mach-regime ${r.cls}">
              <div class="mach-regime-header">
                <span class="mach-regime-name">${r.name}</span>
                <span class="mach-regime-range mono">${r.range}</span>
              </div>
              <p class="mach-regime-desc">${r.desc}</p>
            </div>`).join('')}
        </div>

        <!-- Sparkline de velocidad del sonido vs altitud -->
        <div class="mach-sos-chart" aria-label="Variación de la velocidad del sonido con la altitud">
          <p class="mach-info-title" style="margin-bottom:.75rem">Vel. sonido vs. altitud</p>
          <canvas id="sosSparkline" width="260" height="80" aria-label="Gráfico de velocidad del sonido"></canvas>
          <div class="mach-sos-chart-labels" aria-hidden="true">
            <span class="mono">0 m</span>
            <span class="mono">20.000 m</span>
          </div>
        </div>
      </aside>
    </div>`;
  }

  #bindEvents() {
    const input = this.#el.querySelector('#machSpeedInput');
    const unit = this.#el.querySelector('#machUnit');
    const slider = this.#el.querySelector('#altSlider');

    input?.addEventListener('input', () => this.#calc());
    unit?.addEventListener('change', () => this.#calc());
    slider?.addEventListener('input', () => {
      const alt = parseInt(slider.value);
      const label = this.#el.querySelector('#altLabel');
      if (label) label.textContent = alt === 0 ? '0 m (nivel del mar)' : `${alt.toLocaleString('es-ES')} m`;
      this.#calc();
    });

    // Referencias rápidas
    this.#el.querySelectorAll('.mach-ref-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (input) {
          input.value = btn.dataset.speed;
          this.#calc();
          input.focus();
        }
      });
    });

    // Sparkline
    this.#drawSosSparkline();
  }

  #calc() {
    const rawVal = parseFloat(this.#el.querySelector('#machSpeedInput')?.value);
    const unitSel = this.#el.querySelector('#machUnit')?.value || 'kmh';
    const alt = parseInt(this.#el.querySelector('#altSlider')?.value || 0);

    const sosVal = this.#el.querySelector('#sosVal');
    const sos = speedOfSound(alt);
    if (sosVal) sosVal.textContent = `${Math.round(sos).toLocaleString('es-ES')} km/h`;

    const resultEl = this.#el.querySelector('#machResult');
    const catEl = this.#el.querySelector('#machCategory');
    const subEl = this.#el.querySelector('#machResultSub');

    if (!rawVal || rawVal <= 0) {
      if (resultEl) resultEl.textContent = '—';
      if (resultEl) resultEl.className = 'mach-result header-font';
      if (catEl) catEl.textContent = 'Introduce una velocidad';
      if (catEl) catEl.className = 'mach-category';
      if (subEl) subEl.innerHTML = '';
      return;
    }

    let kmh = rawVal;
    if (unitSel === 'knots') kmh = rawVal * 1.852;
    if (unitSel === 'mph') kmh = rawVal * 1.60934;

    const mach = kmh / sos;

    if (resultEl) resultEl.textContent = `M ${mach.toFixed(3)}`;

    const regimes = [
      { max: 0.8,  label: 'SUBSÓNICO',       cls: 'subsonic' },
      { max: 1.2,  label: 'TRANSSÓNICO',      cls: 'transonic' },
      { max: 5,    label: 'SUPERSÓNICO',      cls: 'supersonic' },
      { max: 10,   label: 'HIPERSÓNICO',      cls: 'hypersonic' },
      { max: Infinity, label: 'ALTA HIPERSONÍA', cls: 'highersonic' },
    ];

    const regime = regimes.find(r => mach < r.max);
    if (catEl) {
      catEl.textContent = regime.label;
      catEl.className = `mach-category ${regime.cls}`;
    }
    if (resultEl) resultEl.className = `mach-result header-font ${regime.cls}`;

    if (subEl) {
      subEl.innerHTML = `
        <div class="mach-sub-row">
          <span class="mach-sub-label mono">km/h:</span>
          <span class="mono">${Math.round(kmh).toLocaleString('es-ES')}</span>
        </div>
        <div class="mach-sub-row">
          <span class="mach-sub-label mono">km/s:</span>
          <span class="mono">${(kmh / 3600).toFixed(3)}</span>
        </div>
        <div class="mach-sub-row">
          <span class="mach-sub-label mono">nudos:</span>
          <span class="mono">${Math.round(kmh / 1.852).toLocaleString('es-ES')}</span>
        </div>`;
    }
  }

  #drawSosSparkline() {
    const canvas = this.#el?.querySelector('#sosSparkline');
    if (!canvas) return;
    const values = Array.from({ length: 20 }, (_, i) => speedOfSound(i * 1000));
    const { drawSparkline: draw } = { drawSparkline };
    // Inline sparkline
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const dark = document.body.classList.contains('dark');
    const color = '#06b6d4';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = 4;

    ctx.clearRect(0, 0, W, H);

    const pts = values.map((v, i) => ({
      x: pad + (i / (values.length - 1)) * (W - pad * 2),
      y: H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2),
    }));

    // Relleno
    ctx.beginPath();
    ctx.moveTo(pts[0].x, H - pad);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, H - pad);
    ctx.closePath();
    ctx.fillStyle = color + '22';
    ctx.fill();

    // Línea
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Punto actual (altitud 0 por defecto)
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}
