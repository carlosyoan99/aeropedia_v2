/**
 * views/FleetsView.js — Vista de flotas por país
 */

import { store } from '../store/index.js';
import { setPageMeta, debounce, FALLBACK_IMG, lazyLoad  } from '../utils/index.js';
import { router } from '../router/index.js';

const ROLE_COLORS = {
  'Caza': '#3b82f6', 'Ataque': '#f59e0b', 'Bombardero': '#ef4444',
  'Transporte': '#8b5cf6', 'AWACS': '#06b6d4', 'Reabastecimiento': '#10b981',
  'ISR': '#f472b6', 'default': '#64748b',
};

export class FleetsView {
  #el = null;
  #unsubs = [];

  async render() {
    setPageMeta({
      title: 'Flotas Aéreas — AeroPedia',
      description: 'Inventario y análisis de flotas aéreas militares por país.',
    });

    this.#el = document.createElement('div');
    this.#el.className = 'fleets-view';
    this.#el.innerHTML = `
      <div class="fleets-header">
<button class="btn-back" onclick="history.back()" aria-label="Volver atrás">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>
        Volver
      </button>
        <h1 class="page-title">Flotas Aéreas Mundiales</h1>
      </div>

      <div id="fleetsSummary" class="fleets-summary" role="region" aria-label="Resumen global"></div>

      <div class="fleets-controls">
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
          <input type="search" id="fleetsSearch" class="search-input" placeholder="Buscar país o aeronave…" aria-label="Buscar flotillas">
        </div>
        <select id="fleetsRegion" class="cat-select" aria-label="Filtrar por región">
          <option value="all">Todas las regiones</option>
          <option value="Europa Occidental">Europa Occidental</option>
          <option value="Europa del Este">Europa del Este</option>
          <option value="Europa del Sur / Asia Menor">Europa del Sur</option>
          <option value="Norteamérica">Norteamérica</option>
          <option value="Latinoamérica">Latinoamérica</option>
          <option value="Asia-Pacífico">Asia-Pacífico</option>
          <option value="Asia del Sur">Asia del Sur</option>
          <option value="Oriente Medio">Oriente Medio</option>
          <option value="Norte de África">Norte de África</option>
          <option value="África Subsahariana">África Subsahariana</option>
          <option value="Oceanía">Oceanía</option>
        </select>
        <select id="fleetsSort" class="cat-select" aria-label="Ordenar por">
          <option value="rank">Por ranking</option>
          <option value="total_desc">Mayor flota</option>
          <option value="name">Alfabético</option>
        </select>
        <span id="fleetsCount" class="fleets-count mono" aria-live="polite"></span>
      </div>

      <div id="fleetsGrid" class="fleets-grid" role="list" aria-label="Flotas aéreas por país">
        <div class="loading-skeleton">Cargando datos…</div>
      </div>`;

    this.#bindEvents();
    await this.#loadData();
    this.#buildSummary();
    this.#renderFleets();

    return this.#el;
  }

  destroy() {
    this.#unsubs.forEach(u => u());
  }

  async #loadData() {
    if (!store.get('fleetsDB')?.length) {
      try {
        const r = await fetch('./data/fleets.json');
        if (r.ok) store.setState({ fleetsDB: await r.json() });
      } catch {}
    }
  }

  #buildSummary() {
    const fleetsDB = store.get('fleetsDB');
    const aircraftDB = store.get('aircraftDB');
    const summaryEl = this.#el?.querySelector('#fleetsSummary');
    if (!summaryEl) return;

    const totalCombat = fleetsDB.reduce((s, c) => s + (c.total_combat || 0), 0);
    const gen5Count = fleetsDB.reduce((s, c) =>
      s + c.aircraft.reduce((ss, a) => {
        const p = aircraftDB.find(x => x.id === a.id);
        return ss + (p?.generation === '5ª' ? (a.qty || 0) : 0);
      }, 0), 0);
    const f35Total = fleetsDB.reduce((s, c) =>
      s + c.aircraft.reduce((ss, a) => ss + (a.id === 'f35' ? (a.qty || 0) : 0), 0), 0);

    summaryEl.innerHTML = [
      { n: fleetsDB.length, l: 'países' },
      { n: totalCombat.toLocaleString('es-ES'), l: 'aviones combate' },
      { n: gen5Count.toLocaleString('es-ES'), l: 'cazas 5ª gen' },
      { n: f35Total.toLocaleString('es-ES'), l: 'F-35 en servicio' },
    ].map(s => `<div class="flt-summary-card">
      <p class="flt-summary-num">${s.n}</p>
      <p class="flt-summary-label">${s.l}</p>
    </div>`).join('');
  }

  #renderFleets() {
    const fleetsDB = store.get('fleetsDB');
    const aircraftDB = store.get('aircraftDB');
    const grid = this.#el?.querySelector('#fleetsGrid');
    const countEl = this.#el?.querySelector('#fleetsCount');
    if (!grid) return;

    const q = (this.#el.querySelector('#fleetsSearch')?.value || '').toLowerCase();
    const region = this.#el.querySelector('#fleetsRegion')?.value || 'all';
    const sort = this.#el.querySelector('#fleetsSort')?.value || 'rank';

    let data = fleetsDB.filter(c => {
      const matchSearch = !q || c.country.toLowerCase().includes(q) ||
        c.aircraft.some(a => a.name?.toLowerCase().includes(q));
      const matchRegion = region === 'all' || c.region === region;
      return matchSearch && matchRegion;
    });

    data.sort((a, b) => {
      if (sort === 'total_desc') return (b.total_combat || 0) - (a.total_combat || 0);
      if (sort === 'name') return a.country.localeCompare(b.country);
      return (a.strength_rank || 99) - (b.strength_rank || 99);
    });

    if (countEl) countEl.textContent = `${data.length} países`;

    if (!data.length) {
      grid.innerHTML = '<p class="fleets-empty">Sin resultados para los filtros seleccionados.</p>';
      return;
    }

    const frag = document.createDocumentFragment();
    for (const country of data) {
      const card = document.createElement('div');
      card.className = 'fleet-card';
      card.setAttribute('role', 'listitem');
      card.innerHTML = this.#buildFleetCard(country, aircraftDB);
      frag.appendChild(card);
    }
    grid.innerHTML = '';
    grid.appendChild(frag);
    // Lazy-load images now visible
    if (typeof lazyLoad !== 'undefined') lazyLoad(grid);
    else {
      grid.querySelectorAll('img[data-src]').forEach(img => {
        img.src = img.dataset.src;
        delete img.dataset.src;
      });
    }
  }

  #buildFleetCard(country, aircraftDB) {
    const fighterCount = country.aircraft.reduce((s, a) => {
      const p = aircraftDB.find(x => x.id === a.id);
      return s + (p?.type === 'Caza' ? (a.qty || 0) : 0);
    }, 0);
    const gen5Count = country.aircraft.reduce((s, a) => {
      const p = aircraftDB.find(x => x.id === a.id);
      return s + (p?.generation === '5ª' ? (a.qty || 0) : 0);
    }, 0);

    const typeGroups = {};
    country.aircraft.forEach(a => {
      const p = aircraftDB.find(x => x.id === a.id);
      const type = p?.type || 'default';
      typeGroups[type] = (typeGroups[type] || 0) + (a.qty || 0);
    });
    const totalForBar = Object.values(typeGroups).reduce((s, v) => s + v, 0) || 1;
    const typeBarSegs = Object.entries(typeGroups).map(([type, qty]) => {
      const color = ROLE_COLORS[type] || ROLE_COLORS.default;
      const pct = (qty / totalForBar) * 100;
      return `<div class="fleet-type-segment" style="width:${pct}%;background:${color}" title="${type}: ${qty}"></div>`;
    }).join('');

    const rows = country.aircraft.map(a => {
      const p = aircraftDB.find(x => x.id === a.id);
      return `<tr class="fleet-aircraft-row" data-id="${a.id}" tabindex="0" role="button" aria-label="Ver ficha de ${a.name}">
        <td style="width:44px">
          <img data-src="./public/min/${p?.img?.[0] ?? p?.img}.webp"
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"
            class="fat-img" alt="${a.name}" width="44" height="25"
            onerror="this.src='${FALLBACK_IMG}'">
        </td>
        <td>
          <p class="fat-name">${a.name}${p?.generation === '5ª' ? ' <span style="color:#f472b6;font-size:.55rem">◈5ª</span>' : ''}</p>
          <p class="fat-role">${a.role || ''}</p>
        </td>
        <td style="text-align:right">
          <span class="fat-qty" style="color:${a.qty === 0 ? 'var(--text-3)' : 'var(--primary)'}">${a.qty || '—'}</span>
        </td>
        <td class="fat-note hidden-sm">${a.notes || ''}</td>
      </tr>`;
    }).join('');

    return `
    <div class="fleet-card-header">
      <span class="fleet-flag" role="img" aria-label="${country.country}">${country.flag}</span>
      <div>
        <p class="fleet-name">${country.country}</p>
        <p class="fleet-af">${country.air_force || ''}</p>
      </div>
      ${country.strength_rank ? `<span class="fleet-rank-badge">#${country.strength_rank}</span>` : ''}
    </div>
    <div class="fleet-quick-stats" role="list">
      <div class="fleet-qs" role="listitem"><p class="fleet-qs-num">${country.total_combat || '?'}</p><p class="fleet-qs-label">Combate</p></div>
      <div class="fleet-qs" role="listitem"><p class="fleet-qs-num">${fighterCount}</p><p class="fleet-qs-label">Cazas</p></div>
      <div class="fleet-qs" role="listitem"><p class="fleet-qs-num" style="color:${gen5Count > 0 ? '#f472b6' : 'var(--text-3)'}">${gen5Count}</p><p class="fleet-qs-label">Gen 5ª</p></div>
      ${country.budget_bn_usd ? `<div class="fleet-qs" role="listitem"><p class="fleet-qs-num" style="font-size:.8rem">${country.budget_bn_usd}B$</p><p class="fleet-qs-label">Presupuesto</p></div>` : ''}
    </div>
    <table class="fleet-aircraft-table" aria-label="Aeronaves de ${country.country}"><tbody>${rows}</tbody></table>
    <div class="fleet-type-bar" aria-label="Distribución por tipo">
      <span class="fleet-type-bar-label mono">Mix</span>
      <div class="fleet-type-bar-track">${typeBarSegs}</div>
    </div>
    ${country.notes ? `<p class="fleet-notes">${country.notes}</p>` : ''}`;
  }

  #bindEvents() {
    const debouncedRender = debounce(() => this.#renderFleets(), 250);
    this.#el?.querySelector('#fleetsSearch')?.addEventListener('input', debouncedRender);
    this.#el?.querySelector('#fleetsRegion')?.addEventListener('change', () => this.#renderFleets());
    this.#el?.querySelector('#fleetsSort')?.addEventListener('change', () => this.#renderFleets());

    this.#el?.addEventListener('click', (e) => {
      const row = e.target.closest('.fleet-aircraft-row');
      if (row?.dataset.id && row.dataset.id !== 'undefined') {
        router.navigate(`/aircraft/${row.dataset.id}`);
      }
    });

    this.#el?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const row = e.target.closest('.fleet-aircraft-row');
        if (row?.dataset.id) {
          e.preventDefault();
          router.navigate(`/aircraft/${row.dataset.id}`);
        }
      }
    });
  }
}
