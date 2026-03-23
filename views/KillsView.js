/**
 * views/KillsView.js — Historial de combate aéreo
 */

import { store } from '../store/index.js';
import { setPageMeta, debounce, FALLBACK_IMG  } from '../utils/index.js';

export class KillsView {
  #el = null;
  #rows = [];

  async render() {
    setPageMeta({
      title: 'Historial de Combate — AeroPedia',
      description: 'Estadísticas de victorias y derribos en combate aéreo.',
    });

    this.#el = document.createElement('div');
    this.#el.className = 'kills-view';
    this.#el.innerHTML = `
      <div class="kills-header">
<button class="btn-back" onclick="history.back()" aria-label="Volver atrás">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>
        Volver
      </button>
        <h1 class="kills-title">Historial de Combate Aéreo</h1>
      </div>

      <div class="kills-controls">
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
          <input type="search" id="killsSearch" class="search-input" placeholder="Buscar aeronave…" aria-label="Buscar en historial de combate">
        </div>
        <select id="killsEra" class="cat-select" aria-label="Filtrar por era">
          <option value="all">Todas las eras</option>
          <option value="wwii">II Guerra Mundial</option>
          <option value="korea">Guerra de Corea</option>
          <option value="coldwar">Guerra Fría</option>
          <option value="modern">Era Moderna</option>
        </select>
        <select id="killsSort" class="cat-select" aria-label="Ordenar por">
          <option value="kills_desc">Más victorias</option>
          <option value="kills_asc">Menos victorias</option>
          <option value="ratio_desc">Mejor ratio</option>
          <option value="losses_asc">Menos pérdidas</option>
          <option value="year">Por año</option>
        </select>
        <span id="killsCount" class="kills-count mono" aria-live="polite"></span>
      </div>

      <div class="kills-layout">
        <div class="kills-table-wrap">
          <table class="kills-table" aria-label="Tabla de historial de combate">
            <thead>
              <tr>
                <th scope="col">Aeronave</th>
                <th scope="col">Victorias</th>
                <th scope="col">Pérdidas</th>
                <th scope="col">Ratio</th>
                <th scope="col" class="hidden-sm">Barras</th>
                <th scope="col" class="hidden-md">Conflictos</th>
              </tr>
            </thead>
            <tbody id="killsBody" aria-live="polite"></tbody>
          </table>
        </div>

        <aside id="conflictDetail" class="kills-detail hidden" aria-label="Detalle de conflictos" role="complementary">
          <button id="closeDetailBtn" class="kills-detail-close" aria-label="Cerrar detalle">×</button>
          <h2 id="cdPlane" class="kills-detail-plane"></h2>
          <p id="cdMeta" class="kills-detail-meta mono"></p>
          <div id="cdConflicts" class="kills-detail-conflicts"></div>
          <p id="cdNotes" class="kills-detail-notes"></p>
          <p id="cdSource" class="kills-detail-source mono"></p>
        </aside>
      </div>`;

    this.#bindEvents();
    await this.#loadData();
    this.#renderKills();
    return this.#el;
  }

  async #loadData() {
    if (!store.get('killsDB')?.length) {
      try {
        const r = await fetch('./data/kills.json');
        if (r.ok) store.setState({ killsDB: await r.json() });
      } catch {}
    }
  }

  #renderKills() {
    const killsDB = store.get('killsDB');
    const aircraftDB = store.get('aircraftDB');
    const conflictsDB = store.get('conflictsDB');
    const body = this.#el?.querySelector('#killsBody');
    const countEl = this.#el?.querySelector('#killsCount');
    if (!body) return;

    const q = (this.#el.querySelector('#killsSearch')?.value || '').toLowerCase();
    const era = this.#el.querySelector('#killsEra')?.value || 'all';
    const sort = this.#el.querySelector('#killsSort')?.value || 'kills_desc';

    const ERA_MAP = {
      wwii: ['wwii_europe','wwii_pacific','wwii_east','wwii_africa'],
      korea: ['korea'],
      coldwar: ['vietnam','sixday','yom_kippur','iran_iraq','coldwar_patrols','falklands','gulf_war'],
      modern: ['desert_storm','gwot','iraq','syria','ukraine','india_pakistan'],
    };

    let rows = killsDB.map(k => {
      const plane = aircraftDB.find(p => p.id === k.id);
      return plane ? { ...k, plane } : null;
    }).filter(Boolean);

    if (q) rows = rows.filter(r =>
      r.plane.name.toLowerCase().includes(q) || r.plane.country.toLowerCase().includes(q));

    if (era !== 'all') {
      const eraConflicts = ERA_MAP[era] || [];
      rows = rows.filter(r => (r.conflicts || []).some(c => eraConflicts.includes(c.id)));
    }

    rows.sort((a, b) => {
      if (sort === 'kills_asc') return a.kills_total - b.kills_total;
      if (sort === 'kills_desc') return b.kills_total - a.kills_total;
      if (sort === 'ratio_desc') return (b.kill_ratio || 0) - (a.kill_ratio || 0);
      if (sort === 'losses_asc') return (a.losses_combat || 0) - (b.losses_combat || 0);
      if (sort === 'year') return a.plane.year - b.plane.year;
      return b.kills_total - a.kills_total;
    });

    this.#rows = rows;
    if (countEl) countEl.textContent = `${rows.length} aeronaves`;

    const maxKills = Math.max(...rows.map(r => r.kills_total || 0), 1);
    const maxLosses = Math.max(...rows.map(r => r.losses_combat || 0), 1);

    body.innerHTML = rows.map((r, i) => {
      const p = r.plane;
      const kPct = ((r.kills_total || 0) / maxKills) * 100;
      const lPct = ((r.losses_combat || 0) / maxLosses) * 100;
      const ratio = r.kill_ratio;
      const ratioCls = !ratio ? 'nodata' : ratio >= 3 ? 'dominant' : ratio >= 1 ? 'positive' : 'negative';

      const cfChips = (r.conflicts || []).slice(0, 3).map(c => {
        const cf = conflictsDB[c.id];
        return cf ? `<span class="kt-cf-chip">${cf.flag} ${c.id?.toUpperCase().replace(/_/g, ' ')}</span>` : '';
      }).join('');

      return `<tr class="kills-row" data-idx="${i}" tabindex="0" role="button" aria-label="Ver detalle de ${p.name}">
        <td class="col-plane">
          <div class="kt-plane-cell">
            <img data-src="./public/min/${p.img}.webp"
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"
              class="kt-thumb" alt="${p.name}" width="52" height="30"
              onerror="this.src='${FALLBACK_IMG}'">
            <div>
              <p class="kt-name">${p.name}</p>
              <p class="kt-meta mono">${p.country} · ${p.year}</p>
            </div>
          </div>
        </td>
        <td>${r.kills_total ? `<span class="kt-kills">${r.kills_total.toLocaleString('es-ES')}</span>` : '<span class="kt-kills-nd">—</span>'}</td>
        <td>${r.losses_combat != null ? `<span class="kt-losses">${r.losses_combat.toLocaleString('es-ES')}</span>` : '<span class="kt-losses-nd">—</span>'}</td>
        <td><span class="kt-ratio-badge ${ratioCls}">${ratio ? ratio.toFixed(2) : 'N/D'}</span></td>
        <td class="hidden-sm">
          <div class="kt-bar-wrap">
            <div class="kt-bar-row"><span class="kt-bar-label">Vict.</span><div class="kt-bar-track"><div class="kt-bar-fill k" style="width:${kPct}%"></div></div></div>
            <div class="kt-bar-row"><span class="kt-bar-label">Pérd.</span><div class="kt-bar-track"><div class="kt-bar-fill l" style="width:${lPct}%"></div></div></div>
          </div>
        </td>
        <td class="hidden-md"><div class="kt-conflict-chips">${cfChips}</div></td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" class="kills-empty">Sin resultados</td></tr>';

    // Lazy load images
    body.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
  }

  #showDetail(idx) {
    const r = this.#rows[idx];
    if (!r) return;
    const conflictsDB = store.get('conflictsDB');

    this.#el?.querySelectorAll('.kills-row').forEach((row, i) => {
      row.classList.toggle('active-row', i === idx);
    });

    const panel = this.#el?.querySelector('#conflictDetail');
    if (!panel) return;

    this.#el.querySelector('#cdPlane').textContent = r.plane.name;
    this.#el.querySelector('#cdMeta').textContent = `${r.plane.country} · ${r.plane.year} · ${r.plane.type}`;
    this.#el.querySelector('#cdNotes').textContent = r.notes || '';
    this.#el.querySelector('#cdSource').textContent = `Fuente: ${r.source_note || 'Datos históricos'}`;

    this.#el.querySelector('#cdConflicts').innerHTML = (r.conflicts || []).map(c => {
      const cf = conflictsDB[c.id];
      const label = cf ? `${cf.flag} ${cf.label} (${cf.years})` : c.id;
      return `<div class="cd-conflict-entry">
        <p class="cd-cf-title">${label}</p>
        <div class="cd-cf-stats">
          <div class="cd-cf-stat">Victorias A-A: <span class="green">${(c.kills || 0).toLocaleString('es-ES')}</span></div>
          <div class="cd-cf-stat">Derribados A-A: <span class="red">${(c.losses_aa || 0).toLocaleString('es-ES')}</span></div>
          ${c.losses_other ? `<div class="cd-cf-stat">Otras pérdidas: <span class="red">${c.losses_other.toLocaleString('es-ES')}</span></div>` : ''}
        </div>
        <p class="cd-cf-notes">${c.notes || ''}</p>
      </div>`;
    }).join('') || '<p style="color:var(--text-3);font-size:.8rem">Sin detalle disponible.</p>';

    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  #bindEvents() {
    const debouncedRender = debounce(() => this.#renderKills(), 250);
    this.#el?.querySelector('#killsSearch')?.addEventListener('input', debouncedRender);
    this.#el?.querySelector('#killsEra')?.addEventListener('change', () => this.#renderKills());
    this.#el?.querySelector('#killsSort')?.addEventListener('change', () => this.#renderKills());

    this.#el?.querySelector('#closeDetailBtn')?.addEventListener('click', () => {
      this.#el?.querySelector('#conflictDetail')?.classList.add('hidden');
      this.#el?.querySelectorAll('.kills-row').forEach(r => r.classList.remove('active-row'));
    });

    this.#el?.addEventListener('click', (e) => {
      const row = e.target.closest('.kills-row');
      if (row) this.#showDetail(parseInt(row.dataset.idx));
    });

    this.#el?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const row = e.target.closest('.kills-row');
        if (row) { e.preventDefault(); this.#showDetail(parseInt(row.dataset.idx)); }
      }
    });
  }
}
