/**
 * views/FavoritesView.js — Favoritos con Colecciones, Gráficos, Tabla, Atajos
 */

import { store, COLLECTION_COLORS, COLLECTION_ICONS } from '../store/index.js';
import { prefs }   from '../store/preferences.js';
import { router }  from '../router/index.js';
import { setPageMeta, FALLBACK_IMG, genBadgeHTML, debounce, copyToClipboard, showToast } from '../utils/index.js';
import { drawPieChart, drawBarChart } from '../components/Charts.js';

const SUGGESTED_TAGS = ['favorito','pendiente','histórico','moderno','furtivo','naval','UAV','legendario'];

export class FavoritesView {
  #el            = null;
  #subs          = [];
  #dragSrcId     = null;
  #focusedIdx    = -1;   // para atajos de teclado

  async render() {
    setPageMeta({ title: 'Mis Favoritos — AeroPedia', description: 'Tu colección personal de aeronaves.' });
    this.#el = document.createElement('div');
    this.#el.className = 'favs-view';
    this.#el.innerHTML = this.#scaffold();
    this.#syncCollectionsSidebar();
    this.#renderStats();
    this.#renderTagFilter();
    this.#renderList();
    this.#bindEvents();
    this.#bindKeyboard();
    this.#subs.push(
      store.subscribe(['favs','favsMeta','favsSearch','favsSortBy','favsSortAsc','favsFilterTag','favsActiveCollection','aircraftDB'], debounce(() => {
        this.#syncCollectionsSidebar();
        this.#renderStats();
        this.#renderTagFilter();
        this.#renderList();
      }, 40)),
      store.subscribe('collections', () => this.#syncCollectionsSidebar()),
    );
    return this.#el;
  }

  destroy() { this.#subs.forEach(u => u()); }

  // ── Scaffold ─────────────────────────────────────────────────
  #scaffold() {
    const view = prefs.get('favs','cardLayout') || 'normal';
    return `
    <div class="favs-header">
      <a href="/" data-link class="btn-back">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>
        Volver
      </a>
      <div class="favs-title-wrap">
        <h1 class="favs-title">
          <svg viewBox="0 0 20 20" fill="currentColor" width="17" height="17" style="color:#f59e0b" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          Mis Favoritos
        </h1>
        <p class="favs-subtitle" id="favsSubtitle"></p>
      </div>
      <div class="favs-header-actions">
        <button class="header-btn" id="shareCollectionBtn" title="Compartir colección activa como enlace">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/></svg>
          Compartir
        </button>
        <button class="header-btn" id="exportBtn" title="Exportar favoritos">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
          Exportar
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div id="favsStats" class="favs-stats" role="region" aria-label="Estadísticas"></div>

    <!-- Gráficos de composición -->
    <div id="favsCharts" class="favs-charts" style="display:none"></div>

    <div class="favs-main-layout">

      <!-- Sidebar de colecciones -->
      <aside class="favs-collections-sidebar" aria-label="Colecciones">
        <div class="favs-col-header">
          <span class="favs-col-title">Colecciones</span>
          <button class="favs-col-new-btn" id="newCollectionBtn" aria-label="Nueva colección" title="Nueva colección">+</button>
        </div>
        <div id="collectionsSidebar" class="favs-col-list" role="list"></div>
      </aside>

      <!-- Panel principal -->
      <div class="favs-content">

        <!-- Controles -->
        <div class="favs-controls">
          <div class="search-wrap" role="search">
            <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
            <input type="search" id="favsSearch" class="search-input" placeholder="Buscar en favoritos… (o presiona /)"
              value="${store.get('favsSearch')}" aria-label="Buscar favoritos">
            <kbd class="search-kbd" aria-hidden="true">/</kbd>
          </div>
          <select id="favsSortBy" class="cat-select" aria-label="Ordenar por">
            <option value="addedAt">Recientes</option>
            <option value="name">Nombre A-Z</option>
            <option value="rating">Valoración ★</option>
            <option value="year">Año</option>
            <option value="speed">Velocidad</option>
          </select>
          <button class="header-btn icon-btn" id="sortDirBtn" title="Invertir orden" aria-label="Invertir orden">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" id="sortDirSvg" aria-hidden="true"><path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>
          </button>

          <!-- View toggle: normal / compacto / tabla -->
          <div class="view-toggle" role="group" aria-label="Vista de favoritos">
            ${[['normal','⊞'],['compact','≡'],['table','⊟']].map(([v,i])=>
              `<button class="view-btn ${view===v?'active':''}" data-favview="${v}" aria-pressed="${view===v}" title="Vista ${v}">${i}</button>`
            ).join('')}
          </div>

          <!-- Tag filter -->
          <div id="tagFilterWrap" class="favs-tag-filter" role="group" aria-label="Filtrar por etiqueta"></div>

          <span id="favsCount" class="favs-count mono" aria-live="polite"></span>
        </div>

        <!-- Lista / tabla -->
        <div id="favsList" class="favs-list" role="list" aria-label="Aeronaves favoritas"></div>
      </div>
    </div>

    <!-- Modal de edición -->
    <div id="favsEditModal" class="favs-modal hidden" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="favs-modal-backdrop"></div>
      <div class="favs-modal-inner">
        <div class="favs-modal-header">
          <h2 id="modalTitle" class="favs-modal-title">Editar favorito</h2>
          <button id="closeModalBtn" class="favs-modal-close" aria-label="Cerrar">×</button>
        </div>
        <div class="favs-modal-body">
          <div id="modalPlaneName" class="favs-modal-plane"></div>
          <div class="favs-modal-field">
            <label class="favs-modal-label">Valoración</label>
            <div class="favs-stars" id="modalStars" role="group" aria-label="Valoración 0-5">
              ${[1,2,3,4,5].map(n=>`<button class="star-btn" data-star="${n}" aria-label="${n} estrella${n>1?'s':''}">★</button>`).join('')}
            </div>
          </div>
          <div class="favs-modal-field">
            <label class="favs-modal-label" for="modalNote">Nota personal</label>
            <textarea id="modalNote" class="favs-modal-textarea" rows="3" placeholder="Añade una nota…"></textarea>
          </div>
          <div class="favs-modal-field">
            <label class="favs-modal-label">Etiquetas</label>
            <div id="modalActiveTags" class="favs-modal-active-tags"></div>
            <div class="favs-modal-tag-input-row">
              <input type="text" id="modalTagInput" class="favs-modal-tag-input" placeholder="Nueva etiqueta…" maxlength="24">
              <button id="addTagBtn" class="favs-modal-add-tag">+</button>
            </div>
            <div class="favs-modal-suggested-tags">
              ${SUGGESTED_TAGS.map(t=>`<button class="fav-tag-suggested" data-tag="${t}">${t}</button>`).join('')}
            </div>
          </div>
          <div class="favs-modal-field">
            <label class="favs-modal-label">Colecciones</label>
            <div id="modalCollections" class="favs-modal-collections"></div>
          </div>
        </div>
        <div class="favs-modal-footer">
          <button id="saveModalBtn" class="favs-modal-save">Guardar</button>
          <button id="removeFavBtn" class="favs-modal-remove">Quitar de favoritos</button>
        </div>
      </div>
    </div>

    <!-- Modal nueva colección -->
    <div id="newCollectionModal" class="favs-modal hidden" role="dialog" aria-modal="true" aria-labelledby="newColTitle">
      <div class="favs-modal-backdrop"></div>
      <div class="favs-modal-inner" style="max-width:360px">
        <div class="favs-modal-header">
          <h2 id="newColTitle" class="favs-modal-title">Nueva colección</h2>
          <button id="closeNewColBtn" class="favs-modal-close" aria-label="Cerrar">×</button>
        </div>
        <div class="favs-modal-body">
          <div class="favs-modal-field">
            <label class="favs-modal-label" for="newColName">Nombre</label>
            <input type="text" id="newColName" class="favs-modal-tag-input" style="width:100%;padding:.5rem .65rem" maxlength="32" placeholder="Mi colección">
          </div>
          <div class="favs-modal-field">
            <label class="favs-modal-label">Color</label>
            <div class="favs-color-picker" id="newColColorPicker">
              ${COLLECTION_COLORS.map(c=>`<button class="color-swatch" data-color="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}
            </div>
          </div>
          <div class="favs-modal-field">
            <label class="favs-modal-label">Icono</label>
            <div class="favs-icon-picker" id="newColIconPicker">
              ${COLLECTION_ICONS.map(i=>`<button class="icon-swatch" data-icon="${i}">${i}</button>`).join('')}
            </div>
          </div>
        </div>
        <div class="favs-modal-footer">
          <button id="confirmNewColBtn" class="favs-modal-save">Crear colección</button>
        </div>
      </div>
    </div>`;
  }

  // ── Sidebar de colecciones ────────────────────────────────────
  #syncCollectionsSidebar() {
    const el   = this.#el?.querySelector('#collectionsSidebar');
    if (!el) return;
    const cols    = store.get('collections') || {};
    const active  = store.get('favsActiveCollection') || 'all';
    const favs    = store.get('favs');

    el.innerHTML = [
      `<button class="favs-col-item ${active==='all'?'active':''}" data-col="all" role="listitem" aria-pressed="${active==='all'}">
        <span>📚</span><span>Todos</span><span class="favs-col-count">${favs.length}</span>
      </button>`,
      ...Object.entries(cols).map(([id, col]) => {
        const count = col.ids.filter(i => favs.includes(i)).length;
        return `<div class="favs-col-item-wrap">
          <button class="favs-col-item ${active===id?'active':''}" data-col="${id}" role="listitem" aria-pressed="${active===id}"
            style="--col-color:${col.color}">
            <span>${col.icon}</span><span>${col.name}</span><span class="favs-col-count">${count}</span>
          </button>
          <button class="favs-col-delete-btn" data-delete-col="${id}" aria-label="Eliminar colección ${col.name}" title="Eliminar colección">×</button>
        </div>`;
      }),
    ].join('');

    el.querySelectorAll('[data-col]').forEach(btn => {
      btn.addEventListener('click', () => store.setState({ favsActiveCollection: btn.dataset.col }));
    });
    el.querySelectorAll('[data-delete-col]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm(`¿Eliminar la colección "${store.get('collections')[btn.dataset.deleteCol]?.name}"?`)) {
          store.deleteCollection(btn.dataset.deleteCol);
        }
      });
    });
  }

  // ── Estadísticas ──────────────────────────────────────────────
  #renderStats() {
    const favs    = store.get('favs');
    const meta    = store.get('favsMeta');
    const ac      = store.get('aircraftDB');
    const subtitle = this.#el?.querySelector('#favsSubtitle');
    if (subtitle) subtitle.textContent = `${favs.length} aeronave${favs.length!==1?'s':''} en tu colección`;

    const el = this.#el?.querySelector('#favsStats');
    if (!el || !favs.length) { if(el) el.innerHTML=''; return; }

    const planes = favs.map(id => ac.find(p=>p.id===id)).filter(Boolean);
    const byType = {}; let rated=0, totalRating=0, pinned=0;
    for (const p of planes) byType[p.type] = (byType[p.type]||0)+1;
    for (const [id, m] of Object.entries(meta)) {
      if (!favs.includes(id)) continue;
      if (m.rating>0) { totalRating+=m.rating; rated++; }
      if (m.pinned) pinned++;
    }
    const topType = Object.entries(byType).sort((a,b)=>b[1]-a[1])[0];
    const avgR    = rated>0 ? (totalRating/rated).toFixed(1) : '—';
    const tags    = store.getAllFavTags().length;

    el.innerHTML = [
      [favs.length, 'Aeronaves'],
      [pinned, 'Fijadas', '#f59e0b'],
      [avgR+(rated>0?'★':''), 'Rating medio', '#f472b6'],
      [tags, 'Tags', '#22d3ee'],
      [topType?topType[0]:'—', 'Tipo principal', '#34d399'],
    ].map(([n,l,c])=>`<div class="fav-stat-card">
      <p class="fav-stat-num" style="${c?`color:${c}`:''}">${n}</p>
      <p class="fav-stat-label">${l}</p>
    </div>`).join('');

    // Gráficos de composición
    if (prefs.get('favs','showCharts') && favs.length >= 3) {
      this.#renderCharts(planes);
    } else {
      const chartsEl = this.#el?.querySelector('#favsCharts');
      if (chartsEl) chartsEl.style.display = 'none';
    }
  }

  #renderCharts(planes) {
    const el = this.#el?.querySelector('#favsCharts');
    if (!el) return;
    el.style.display = '';

    const byType   = {}; const byGen = {};
    for (const p of planes) {
      byType[p.type] = (byType[p.type]||0)+1;
      const g = p.generation||'Sin gen';
      byGen[g] = (byGen[g]||0)+1;
    }

    const typeColors = {'Caza':'#3b82f6','Bombardero':'#ef4444','Ataque':'#f59e0b','Transporte':'#8b5cf6','Especial':'#06b6d4','Experimental':'#f472b6'};

    el.innerHTML = `
      <div class="favs-charts-grid">
        <div class="favs-chart-card">
          <p class="favs-chart-title">Por tipo</p>
          <div id="chartByType"></div>
          <div class="favs-chart-legend" id="legendByType"></div>
        </div>
        <div class="favs-chart-card">
          <p class="favs-chart-title">Por generación</p>
          <canvas id="chartByGen" width="300" height="140" class="compare-bar-canvas"></canvas>
        </div>
      </div>`;

    // Pie chart por tipo
    const typeSegs = Object.entries(byType).map(([k,v])=>({
      label:k, value:v, color: typeColors[k]||'#64748b'
    }));
    drawPieChart(el.querySelector('#chartByType'), typeSegs, { size:130 });

    // Leyenda pie
    const legendEl = el.querySelector('#legendByType');
    if (legendEl) legendEl.innerHTML = typeSegs.map(s=>
      `<span style="display:flex;align-items:center;gap:.3rem;font-size:.65rem;color:var(--text-2)">
        <span style="width:8px;height:8px;border-radius:50%;background:${s.color};flex-shrink:0"></span>${s.label}
      </span>`
    ).join('');

    // Bar chart generaciones
    const genCanvas = el.querySelector('#chartByGen');
    if (genCanvas) {
      const data = Object.entries(byGen).sort((a,b)=>a[0].localeCompare(b[0]))
        .map(([k,v])=>({label:k.replace('Sin gen','—'), value:v}));
      drawBarChart(genCanvas, data, { color:'#8b5cf6', animated:true });
    }
  }

  // ── Tag filter ────────────────────────────────────────────────
  #renderTagFilter() {
    const wrap = this.#el?.querySelector('#tagFilterWrap');
    if (!wrap) return;
    const tags = store.getAllFavTags();
    const cur  = store.get('favsFilterTag') || 'all';
    wrap.innerHTML = [
      `<button class="fav-tag-pill ${cur==='all'?'active':''}" data-filter-tag="all">Todas</button>`,
      ...tags.map(t=>`<button class="fav-tag-pill ${cur===t?'active':''}" data-filter-tag="${t}">${t}</button>`)
    ].join('');
  }

  // ── Lista de favoritos ────────────────────────────────────────
  #renderList() {
    const list  = this.#el?.querySelector('#favsList');
    const count = this.#el?.querySelector('#favsCount');
    if (!list) return;

    const filtered = store.getFilteredFavs();
    if (count) count.textContent = `${filtered.length} aeronave${filtered.length!==1?'s':''}`;

    if (!filtered.length) {
      list.innerHTML = store.get('favs').length === 0 ? this.#emptyState() : this.#filteredEmpty();
      return;
    }

    const view = prefs.get('favs','cardLayout') || 'normal';

    if (view === 'table') {
      list.innerHTML = this.#buildTable(filtered);
      list.querySelectorAll('[data-id]').forEach(row => {
        row.addEventListener('click', e => {
          if (e.target.closest('[data-action]')) return;
          router.navigate(`/aircraft/${row.dataset.id}`);
        });
      });
    } else {
      const frag = document.createDocumentFragment();
      filtered.forEach(({ plane, meta }, idx) => {
        const card = this.#createCard(plane, meta, idx, view === 'compact');
        frag.appendChild(card);
      });
      list.innerHTML = '';
      list.appendChild(frag);
    }
  }

  // ── Tabla comparativa ─────────────────────────────────────────
  #buildTable(filtered) {
    const cols = prefs.get('favs','tableColumns') || ['speed','range','ceiling','mtow'];
    const colMeta = {
      speed:   ['Velocidad', p=>`${p.speed.toLocaleString('es-ES')} km/h`,'#3b82f6'],
      range:   ['Alcance',   p=>`${p.range.toLocaleString('es-ES')} km`,  '#8b5cf6'],
      ceiling: ['Techo',     p=>`${p.ceiling.toLocaleString('es-ES')} m`, '#06b6d4'],
      mtow:    ['MTOW',      p=>`${(p.mtow/1000).toFixed(1)} T`,          '#f59e0b'],
      year:    ['Año',       p=>String(p.year),                            '#10b981'],
      crew:    ['Tripulación',p=>p.crew===0?'UAV':String(p.crew),         '#f472b6'],
    };

    const maxVals = {};
    for (const col of cols) {
      const vals = filtered.map(({plane})=>parseFloat(colMeta[col]?.[1]?.(plane))||0).filter(n=>n>0);
      maxVals[col] = Math.max(...vals, 1);
    }

    return `
      <div class="favs-table-wrap">
        <table class="compare-table" aria-label="Tabla de favoritos">
          <thead><tr>
            <th scope="col">Aeronave</th>
            <th scope="col">★</th>
            ${cols.map(c=>`<th scope="col">${colMeta[c]?.[0]||c}</th>`).join('')}
            <th scope="col"></th>
          </tr></thead>
          <tbody>
          ${filtered.map(({plane:p, meta})=>{
            const rating = Array.from({length:5},(_,i)=>`<span class="fav-star ${i<(meta.rating||0)?'filled':''}">★</span>`).join('');
            return `<tr class="compare-table-row" data-id="${p.id}" style="cursor:pointer" tabindex="0"
              role="button" aria-label="Ver ficha de ${p.name}">
              <td><div style="display:flex;align-items:center;gap:.5rem">
                <img src="./public/min/${p.img}.webp" alt="" width="44" height="25"
                  style="object-fit:cover;border-radius:4px;flex-shrink:0"
                  onerror="this.style.display='none'">
                <div>
                  <p style="font-family:var(--font-head);font-size:.78rem;font-weight:600">${p.name}</p>
                  <p style="font-size:.65rem;color:var(--text-3)">${p.country} · ${p.year}</p>
                </div>
              </div></td>
              <td><div style="display:flex;gap:1px">${rating}</div></td>
              ${cols.map(col=>{
                const val = colMeta[col]?.[1]?.(p)||'—';
                const raw = parseFloat(val)||0;
                const pct = (raw/maxVals[col])*100;
                return `<td class="compare-td">
                  <span style="color:${colMeta[col]?.[2]};font-family:var(--font-mono);font-size:.72rem">${val}</span>
                  <div class="rank-bar-track" style="margin-top:2px"><div class="rank-bar-fill" style="width:${pct}%;background:${colMeta[col]?.[2]}"></div></div>
                </td>`;
              }).join('')}
              <td>
                <button class="fav-action-btn fav-edit-btn" data-action="edit" data-id="${p.id}" aria-label="Editar ${p.name}">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                </button>
              </td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  // ── Card de favorito ─────────────────────────────────────────
  #createCard(plane, meta, idx, compact = false) {
    const article = document.createElement('article');
    article.className = `fav-card${meta.pinned?' pinned':''}${compact?' fav-card--compact':''}`;
    article.setAttribute('role','listitem');
    article.dataset.id  = plane.id;
    article.dataset.idx = idx;
    article.draggable   = true;
    article.setAttribute('tabindex','0');
    article.setAttribute('aria-label', plane.name);

    const stars  = Array.from({length:5},(_,i)=>`<span class="fav-star ${i<(meta.rating||0)?'filled':''}">★</span>`).join('');
    const tags   = (meta.tags||[]).map(t=>`<span class="fav-tag-chip">${t}</span>`).join('');
    const addedDate = meta.addedAt
      ? new Date(meta.addedAt).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'}) : '';

    article.innerHTML = `
      <div class="fav-card-drag-handle" aria-hidden="true" title="Arrastrar para reordenar">
        <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"><path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/></svg>
      </div>
      ${!compact?`<div class="fav-card-img-wrap">
        <img src="./public/min/${plane.img}.webp" alt="${plane.name}" width="120" height="68"
          loading="lazy" onerror="this.src='${FALLBACK_IMG}'">
        ${meta.pinned?'<span class="fav-pin-badge" aria-label="Fijado">📌</span>':''}
      </div>`:''}
      <div class="fav-card-body">
        <div class="fav-card-top">
          <div class="fav-card-info">
            <h2 class="fav-card-name">
              <a href="/aircraft/${plane.id}" data-link class="fav-card-name-link">${plane.name}</a>
            </h2>
            <div class="fav-card-meta">
              <span class="fav-meta-badge">${plane.type}</span>
              <span class="fav-meta-country mono">${plane.country}</span>
              <span class="fav-meta-year mono">${plane.year}</span>
              ${genBadgeHTML(plane)}
            </div>
          </div>
          <div class="fav-card-rating" aria-label="Valoración ${meta.rating||0} de 5">${stars}</div>
        </div>
        ${meta.note&&!compact?`<p class="fav-card-note">"${meta.note}"</p>`:''}
        ${tags?`<div class="fav-card-tags" aria-label="Etiquetas">${tags}</div>`:''}
        ${!compact?`<div class="fav-card-stats">
          <span class="fav-stat-chip">⚡ ${plane.speed.toLocaleString('es-ES')} km/h</span>
          <span class="fav-stat-chip">📡 ${plane.ceiling.toLocaleString('es-ES')} m</span>
          <span class="fav-stat-chip">🗺 ${plane.range.toLocaleString('es-ES')} km</span>
        </div>`:''}
        <div class="fav-card-footer">
          ${addedDate&&!compact?`<span class="fav-added-date mono">Añadido ${addedDate}</span>`:''}
          <div class="fav-card-actions">
            <button class="fav-action-btn fav-pin-btn ${meta.pinned?'active':''}"
              data-action="pin" data-id="${plane.id}" aria-label="${meta.pinned?'Desfijar':'Fijar'}" aria-pressed="${meta.pinned}" title="Fijar (P)">📌</button>
            <button class="fav-action-btn fav-edit-btn"
              data-action="edit" data-id="${plane.id}" aria-label="Editar" title="Editar (E)">
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12" aria-hidden="true"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
              Editar
            </button>
            <button class="fav-action-btn fav-compare-btn"
              data-action="compare" data-id="${plane.id}" aria-label="Comparar" title="Comparar (C)">
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12" aria-hidden="true"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
            </button>
            <button class="fav-action-btn fav-remove-btn"
              data-action="remove" data-id="${plane.id}" aria-label="Quitar" title="Quitar (Del)">
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12" aria-hidden="true"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
            </button>
          </div>
        </div>
      </div>`;

    this.#bindCardDrag(article);
    return article;
  }

  // ── Drag & Drop ───────────────────────────────────────────────
  #bindCardDrag(card) {
    card.addEventListener('dragstart', e => {
      this.#dragSrcId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      this.#el?.querySelectorAll('.drag-over').forEach(c=>c.classList.remove('drag-over'));
    });
    card.addEventListener('dragover', e => { e.preventDefault(); if(card.dataset.id!==this.#dragSrcId) card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', e => {
      e.preventDefault(); card.classList.remove('drag-over');
      const src = this.#dragSrcId, dst = card.dataset.id;
      if (!src || src===dst) return;
      const favs = store.get('favs');
      store.reorderFav(favs.indexOf(src), favs.indexOf(dst));
      this.#dragSrcId = null;
    });
  }

  // ── Modal edición ─────────────────────────────────────────────
  #openModal(id) {
    const plane = store.get('aircraftDB').find(p=>p.id===id);
    const meta  = store.getFavMeta(id)||{};
    if (!plane) return;

    const modal = this.#el?.querySelector('#favsEditModal');
    if (!modal) return;
    modal.dataset.editId = id;
    modal.querySelector('#modalTitle').textContent = `Editar: ${plane.name}`;
    modal.querySelector('#modalPlaneName').textContent = `${plane.type} · ${plane.country} · ${plane.year}`;
    modal.querySelector('#modalNote').value = meta.note||'';
    this.#syncModalStars(meta.rating||0);
    this.#renderModalTags(meta.tags||[]);
    this.#renderModalCollections(id);
    modal.classList.remove('hidden');
    modal.querySelector('#modalNote')?.focus();
    document.body.style.overflow = 'hidden';
  }

  #closeModal() {
    this.#el?.querySelector('#favsEditModal')?.classList.add('hidden');
    this.#el?.querySelector('#newCollectionModal')?.classList.add('hidden');
    document.body.style.overflow = '';
  }

  #saveModal() {
    const modal = this.#el?.querySelector('#favsEditModal');
    if (!modal) return;
    const id     = modal.dataset.editId;
    const note   = modal.querySelector('#modalNote')?.value?.trim()||'';
    const rating = parseInt(modal.dataset.pendingRating ?? store.getFavMeta(id)?.rating ?? 0);
    const tags   = [...modal.querySelectorAll('.modal-active-tag')].map(t=>t.dataset.tag);
    store.updateFavMeta(id, { note, rating, tags });
    this.#closeModal();
    showToast('✓ Cambios guardados');
  }

  #syncModalStars(rating) {
    const modal = this.#el?.querySelector('#favsEditModal');
    if (!modal) return;
    modal.dataset.pendingRating = rating;
    modal.querySelectorAll('.star-btn').forEach((btn,i) => {
      btn.classList.toggle('active', i<rating);
      btn.setAttribute('aria-pressed', i<rating);
    });
  }

  #renderModalTags(tags) {
    const wrap = this.#el?.querySelector('#modalActiveTags');
    if (!wrap) return;
    wrap.innerHTML = tags.map(t=>`
      <span class="modal-active-tag" data-tag="${t}">${t}
        <button class="modal-tag-remove" data-remove-tag="${t}" aria-label="Quitar ${t}">×</button>
      </span>`).join('');
  }

  #renderModalCollections(favId) {
    const el   = this.#el?.querySelector('#modalCollections');
    if (!el) return;
    const cols = store.get('collections')||{};
    if (!Object.keys(cols).length) { el.innerHTML = '<p style="font-size:.72rem;color:var(--text-3)">No hay colecciones creadas aún.</p>'; return; }
    el.innerHTML = Object.entries(cols).map(([id,col])=>{
      const inCol = col.ids.includes(favId);
      return `<button class="modal-col-toggle ${inCol?'active':''}" data-col-id="${id}"
        style="--col-color:${col.color}" aria-pressed="${inCol}">
        ${col.icon} ${col.name}
      </button>`;
    }).join('');
    el.querySelectorAll('[data-col-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        store.toggleFavInCollection(favId, btn.dataset.colId);
        btn.classList.toggle('active');
        btn.setAttribute('aria-pressed', btn.classList.contains('active'));
      });
    });
  }

  #addModalTag(tag) {
    const modal = this.#el?.querySelector('#favsEditModal');
    if (!modal) return;
    const clean = tag.toLowerCase().trim().replace(/[^a-záéíóúüñ0-9\-]/gi,'');
    const existing = [...modal.querySelectorAll('.modal-active-tag')].map(t=>t.dataset.tag);
    if (!clean||existing.includes(clean)||existing.length>=10) return;
    this.#renderModalTags([...existing, clean]);
  }

  // ── Atajos de teclado ─────────────────────────────────────────
  #bindKeyboard() {
    document.addEventListener('keydown', this.#onKey.bind(this));
  }

  #onKey(e) {
    const tag    = document.activeElement?.tagName.toLowerCase();
    const typing = ['input','select','textarea'].includes(tag);
    const modal  = !this.#el?.querySelector('#favsEditModal')?.classList.contains('hidden');

    // Atajos en modal
    if (modal) {
      if (e.key === 'Escape') this.#closeModal();
      return;
    }

    if (e.key === 'Escape') { this.#closeModal(); return; }
    if (typing) return;

    // Enfocar búsqueda
    if (e.key === '/') { e.preventDefault(); this.#el?.querySelector('#favsSearch')?.focus(); return; }

    // Navegar entre cards con flechas
    const cards = [...(this.#el?.querySelectorAll('.fav-card')||[])];
    if (!cards.length) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      this.#focusedIdx = Math.min(this.#focusedIdx+1, cards.length-1);
      cards[this.#focusedIdx]?.focus();
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      this.#focusedIdx = Math.max(this.#focusedIdx-1, 0);
      cards[this.#focusedIdx]?.focus();
      return;
    }

    // Atajos en la card enfocada
    const focused = document.activeElement?.closest('.fav-card');
    if (!focused) return;
    const id = focused.dataset.id;
    if (!id) return;

    switch (e.key) {
      case 'p': case 'P': store.toggleFavPin(id); break;
      case 'e': case 'E': this.#openModal(id); break;
      case 'c': case 'C': store.toggleCompare(id); showToast('Añadido al comparador'); break;
      case 'Delete': case 'Backspace': {
        const confirm_ = prefs.get('favs','confirmOnRemove');
        if (!confirm_ || confirm(`¿Quitar "${store.get('aircraftDB').find(p=>p.id===id)?.name}" de favoritos?`)) {
          store.toggleFav(id);
          showToast('Aeronave quitada de favoritos');
        }
        break;
      }
      case 'Enter': router.navigate(`/aircraft/${id}`); break;
    }
  }

  // ── Eventos globales de la vista ──────────────────────────────
  #bindEvents() {
    // Búsqueda
    const debouncedSearch = debounce(e => store.setState({favsSearch:e.target.value}), 200);
    this.#el?.querySelector('#favsSearch')?.addEventListener('input', debouncedSearch);

    // Orden
    this.#el?.querySelector('#favsSortBy')?.addEventListener('change', e => store.setState({favsSortBy:e.target.value}));
    this.#el?.querySelector('#sortDirBtn')?.addEventListener('click', () => {
      store.setState({favsSortAsc:!store.get('favsSortAsc')});
      const svg = this.#el?.querySelector('#sortDirSvg');
      if (svg) svg.style.transform = store.get('favsSortAsc') ? 'rotate(180deg)' : '';
    });

    // Vista (normal/compacto/tabla)
    this.#el?.querySelectorAll('[data-favview]').forEach(btn => {
      btn.addEventListener('click', () => {
        prefs.setOne('favs','cardLayout', btn.dataset.favview);
        this.#el?.querySelectorAll('[data-favview]').forEach(b => {
          b.classList.toggle('active', b.dataset.favview===btn.dataset.favview);
          b.setAttribute('aria-pressed', b.dataset.favview===btn.dataset.favview);
        });
        this.#renderList();
      });
    });

    // Click delegado general
    this.#el?.addEventListener('click', e => {
      // Tag filter
      const tagPill = e.target.closest('[data-filter-tag]');
      if (tagPill) { store.setState({favsFilterTag:tagPill.dataset.filterTag}); return; }

      // Acciones de card
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        const {action,id} = actionBtn.dataset;
        if (action==='pin')    { store.toggleFavPin(id); return; }
        if (action==='edit')   { this.#openModal(id); return; }
        if (action==='compare'){ store.toggleCompare(id); showToast(`${store.get('compareList').includes(id)?'+':'-'} Comparador`); return; }
        if (action==='remove') {
          const confirm_ = prefs.get('favs','confirmOnRemove');
          const name = store.get('aircraftDB').find(p=>p.id===id)?.name;
          if (!confirm_ || confirm(`¿Quitar "${name}" de favoritos?`)) {
            store.toggleFav(id);
            showToast('Aeronave quitada de favoritos');
          }
          return;
        }
      }

      // Stars modal
      const starBtn = e.target.closest('.star-btn');
      if (starBtn) {
        const n = parseInt(starBtn.dataset.star);
        const modal = this.#el?.querySelector('#favsEditModal');
        this.#syncModalStars(n===parseInt(modal?.dataset.pendingRating||0)?0:n);
        return;
      }

      // Quitar tag modal
      const rmTag = e.target.closest('[data-remove-tag]');
      if (rmTag) {
        const wrap = this.#el?.querySelector('#modalActiveTags');
        const remaining = [...wrap.querySelectorAll('.modal-active-tag')].map(t=>t.dataset.tag).filter(t=>t!==rmTag.dataset.removeTag);
        this.#renderModalTags(remaining);
        return;
      }

      // Tag sugerida
      const sugTag = e.target.closest('.fav-tag-suggested');
      if (sugTag) { this.#addModalTag(sugTag.dataset.tag); return; }

      // Añadir tag manual
      if (e.target.closest('#addTagBtn')) {
        const input = this.#el?.querySelector('#modalTagInput');
        this.#addModalTag(input?.value||'');
        if (input) input.value = '';
        return;
      }

      // Guardar / Cerrar / Quitar modal
      if (e.target.closest('#saveModalBtn'))  { this.#saveModal(); return; }
      if (e.target.closest('#removeFavBtn'))  {
        const id = this.#el?.querySelector('#favsEditModal')?.dataset.editId;
        this.#closeModal();
        if (id) { store.toggleFav(id); showToast('Aeronave quitada de favoritos'); }
        return;
      }
      if (e.target.closest('#closeModalBtn') || e.target.closest('.favs-modal-backdrop')) {
        this.#closeModal(); return;
      }

      // Nueva colección
      if (e.target.closest('#newCollectionBtn')) {
        const modal = this.#el?.querySelector('#newCollectionModal');
        modal?.classList.remove('hidden');
        // Preseleccionar primer color e icono
        modal?.querySelector('.color-swatch')?.classList.add('selected');
        modal?.querySelector('.icon-swatch')?.classList.add('selected');
        modal?.querySelector('#newColName')?.focus();
        document.body.style.overflow = 'hidden';
        return;
      }
      if (e.target.closest('#closeNewColBtn') || (e.target.classList.contains('favs-modal-backdrop') && !this.#el?.querySelector('#newCollectionModal')?.classList.contains('hidden'))) {
        this.#el?.querySelector('#newCollectionModal')?.classList.add('hidden');
        document.body.style.overflow = '';
        return;
      }
      if (e.target.closest('#confirmNewColBtn')) {
        const modal = this.#el?.querySelector('#newCollectionModal');
        const name  = modal?.querySelector('#newColName')?.value?.trim()||'Nueva colección';
        const color = modal?.querySelector('.color-swatch.selected')?.dataset.color || COLLECTION_COLORS[0];
        const icon  = modal?.querySelector('.icon-swatch.selected')?.dataset.icon  || COLLECTION_ICONS[0];
        store.createCollection({name,color,icon});
        modal?.classList.add('hidden');
        document.body.style.overflow = '';
        showToast(`✓ Colección "${name}" creada`);
        return;
      }

      // Color/icono picker
      const swatch = e.target.closest('.color-swatch');
      if (swatch) {
        this.#el?.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('selected'));
        swatch.classList.add('selected');
        return;
      }
      const iconSwatch = e.target.closest('.icon-swatch');
      if (iconSwatch) {
        this.#el?.querySelectorAll('.icon-swatch').forEach(s=>s.classList.remove('selected'));
        iconSwatch.classList.add('selected');
        return;
      }

      // Exportar / Compartir
      if (e.target.closest('#exportBtn')) {
        const json = store.exportFavs();
        const url  = URL.createObjectURL(new Blob([json],{type:'application/json'}));
        Object.assign(document.createElement('a'),{href:url,download:`aeropedia-favs-${new Date().toISOString().slice(0,10)}.json`}).click();
        URL.revokeObjectURL(url);
        showToast(`✓ ${store.get('favs').length} favoritos exportados`);
        return;
      }
      if (e.target.closest('#shareCollectionBtn')) {
        const active = store.get('favsActiveCollection');
        const ids = active==='all'
          ? store.get('favs')
          : (store.get('collections')[active]?.ids||[]);
        const url = store.buildShareUrl(ids);
        copyToClipboard(url).then(()=>showToast('✓ Enlace copiado al portapapeles'));
        return;
      }

      // Filtrar lista table
      if (e.target.closest('[data-id]') && !e.target.closest('[data-action]')) {
        const row = e.target.closest('[data-id]');
        if (row?.tagName === 'TR') router.navigate(`/aircraft/${row.dataset.id}`);
      }
    });

    // Enter en tag input
    this.#el?.querySelector('#modalTagInput')?.addEventListener('keydown', e => {
      if (e.key==='Enter') { e.preventDefault(); this.#addModalTag(e.target.value); e.target.value=''; }
    });

    // Cardfocus tracking
    this.#el?.addEventListener('focus', e => {
      const card = e.target.closest('.fav-card');
      if (card) {
        const cards = [...this.#el.querySelectorAll('.fav-card')];
        this.#focusedIdx = cards.indexOf(card);
      }
    }, true);
  }

  // ── Empty states ──────────────────────────────────────────────
  #emptyState() {
    return `<div class="favs-empty" role="status">
      <div class="favs-empty-icon" aria-hidden="true">⭐</div>
      <p class="favs-empty-title">Tu colección está vacía</p>
      <p class="favs-empty-sub">Usa el botón ★ en cualquier aeronave para guardarla aquí.</p>
      <a href="/" data-link class="btn-back-home" style="margin-top:.5rem">→ Explorar el archivo</a>
    </div>`;
  }

  #filteredEmpty() {
    return `<div class="favs-empty" role="status">
      <div class="favs-empty-icon" aria-hidden="true">🔍</div>
      <p class="favs-empty-title">Sin resultados</p>
      <p class="favs-empty-sub">Ningún favorito coincide con los filtros actuales.</p>
      <button class="btn-back-home" onclick="store.setState({favsSearch:'',favsFilterTag:'all',favsActiveCollection:'all'})" style="margin-top:.5rem">Limpiar filtros</button>
    </div>`;
  }
}
