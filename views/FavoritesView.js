/**
 * views/FavoritesView.js — Vista de favoritos con gestión completa
 * - Notas personales por aeronave
 * - Etiquetas propias (tags)
 * - Rating 0-5 estrellas
 * - Fijar (pin) favoritos en la cima
 * - Reordenar arrastrando
 * - Filtros y ordenación
 * - Exportar / Importar JSON
 * - Persistencia en localStorage via store
 */

import { store } from '../store/index.js';
import { router } from '../router/index.js';
import { setPageMeta, FALLBACK_IMG, genBadgeHTML, debounce, copyToClipboard, showToast } from '../utils/index.js';

// Tags predefinidas sugeridas
const SUGGESTED_TAGS = ['favorito', 'pendiente', 'histórico', 'moderno', 'furtivo', 'naval', 'UAV', 'supersónico', 'hipersónico', 'legendario'];

export class FavoritesView {
  #el = null;
  #unsubs = [];
  #dragSrcId = null;

  async render() {
    setPageMeta({
      title: 'Mis Favoritos — AeroPedia',
      description: 'Tu colección personal de aeronaves favoritas con notas y valoraciones.',
    });

    this.#el = document.createElement('div');
    this.#el.className = 'favs-view';
    this.#el.innerHTML = this.#scaffoldTemplate();

    this.#subscribeStore();
    this.#bindEvents();
    this.#renderAll();

    return this.#el;
  }

  destroy() {
    this.#unsubs.forEach(u => u());
  }

  // ── Suscripciones ──────────────────────────────────────────
  #subscribeStore() {
    const rerender = debounce(() => this.#renderAll(), 40);
    this.#unsubs.push(
      store.subscribe(['favs', 'favsMeta', 'favsSearch', 'favsSortBy', 'favsSortAsc', 'favsFilterTag', 'aircraftDB'], rerender),
    );
  }

  // ── Scaffold HTML ──────────────────────────────────────────
  #scaffoldTemplate() {
    return `
    <div class="favs-header">
      <a href="/" data-link class="btn-back" aria-label="Volver al archivo">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>
        Volver
      </a>
      <div class="favs-title-wrap">
        <h1 class="favs-title">
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" style="color:#f59e0b" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          Mis Favoritos
        </h1>
        <p class="favs-subtitle" id="favsSubtitle"></p>
      </div>
      <div class="favs-header-actions">
        <button class="header-btn icon-btn" id="exportBtn" title="Exportar favoritos como JSON" aria-label="Exportar favoritos">
          <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        </button>
        <label class="header-btn icon-btn" title="Importar favoritos JSON" aria-label="Importar favoritos" style="cursor:pointer">
          <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
          <input type="file" id="importFile" accept=".json" class="sr-only" aria-label="Archivo JSON para importar">
        </label>
      </div>
    </div>

    <!-- Estadísticas rápidas -->
    <div id="favsStats" class="favs-stats" role="region" aria-label="Estadísticas de tu colección"></div>

    <!-- Controles de filtro -->
    <div class="favs-controls">
      <div class="search-wrap">
        <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
        <input type="search" id="favsSearch" class="search-input" placeholder="Buscar en mis favoritos…"
          value="${store.get('favsSearch')}" aria-label="Buscar favoritos">
      </div>

      <select id="favsSortBy" class="cat-select" aria-label="Ordenar favoritos por">
        <option value="addedAt">Recién añadidos</option>
        <option value="name">Nombre A-Z</option>
        <option value="rating">Valoración</option>
        <option value="year">Año de servicio</option>
        <option value="speed">Velocidad</option>
      </select>

      <button class="header-btn icon-btn" id="sortDirBtn" title="Invertir orden" aria-label="Invertir dirección de orden">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" id="sortDirIcon" aria-hidden="true">
          <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zm0 4a1 1 0 000 2h7a1 1 0 100-2H3zm0 4a1 1 0 100 2h4a1 1 0 100-2H3z"/>
        </svg>
      </button>

      <div id="tagFilterWrap" class="favs-tag-filter" role="group" aria-label="Filtrar por etiqueta">
        <!-- se rellena dinámicamente -->
      </div>

      <span id="favsCount" class="favs-count mono" aria-live="polite"></span>
    </div>

    <!-- Lista de favoritos -->
    <div id="favsList" class="favs-list" role="list" aria-label="Aeronaves favoritas">
      <!-- Cards inyectados -->
    </div>

    <!-- Modal de edición de metadatos -->
    <div id="favsEditModal" class="favs-modal hidden" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="favs-modal-backdrop"></div>
      <div class="favs-modal-inner">
        <div class="favs-modal-header">
          <h2 id="modalTitle" class="favs-modal-title">Editar favorito</h2>
          <button id="closeModalBtn" class="favs-modal-close" aria-label="Cerrar editor">×</button>
        </div>
        <div class="favs-modal-body">
          <div id="modalPlaneName" class="favs-modal-plane"></div>

          <!-- Rating -->
          <div class="favs-modal-field">
            <label class="favs-modal-label">Valoración personal</label>
            <div class="favs-stars" id="modalStars" role="group" aria-label="Valoración de 0 a 5 estrellas">
              ${[1,2,3,4,5].map(n => `
                <button class="star-btn" data-star="${n}" aria-label="${n} estrella${n>1?'s':''}">★</button>`).join('')}
            </div>
          </div>

          <!-- Nota -->
          <div class="favs-modal-field">
            <label class="favs-modal-label" for="modalNote">Nota personal</label>
            <textarea id="modalNote" class="favs-modal-textarea" placeholder="Añade una nota sobre esta aeronave…" rows="3"></textarea>
          </div>

          <!-- Tags -->
          <div class="favs-modal-field">
            <label class="favs-modal-label">Etiquetas</label>
            <div id="modalTagsWrap" class="favs-modal-tags-wrap">
              <div id="modalActiveTags" class="favs-modal-active-tags"></div>
              <div class="favs-modal-tag-input-row">
                <input type="text" id="modalTagInput" class="favs-modal-tag-input"
                  placeholder="Nueva etiqueta…" maxlength="24" aria-label="Escribir nueva etiqueta">
                <button id="addTagBtn" class="favs-modal-add-tag">+</button>
              </div>
              <div class="favs-modal-suggested-tags">
                ${SUGGESTED_TAGS.map(t => `<button class="fav-tag-suggested" data-tag="${t}">${t}</button>`).join('')}
              </div>
            </div>
          </div>
        </div>
        <div class="favs-modal-footer">
          <button id="saveModalBtn" class="favs-modal-save">Guardar cambios</button>
          <button id="removeFavBtn" class="favs-modal-remove">Quitar de favoritos</button>
        </div>
      </div>
    </div>`;
  }

  // ── Render principal ───────────────────────────────────────
  #renderAll() {
    this.#renderStats();
    this.#renderTagFilter();
    this.#renderList();
  }

  // ── Estadísticas ───────────────────────────────────────────
  #renderStats() {
    const favs     = store.get('favs');
    const favsMeta = store.get('favsMeta');
    const aircraft = store.get('aircraftDB');
    const el       = this.#el?.querySelector('#favsStats');
    const subtitle = this.#el?.querySelector('#favsSubtitle');
    if (!el) return;

    if (subtitle) subtitle.textContent = `${favs.length} aeronave${favs.length !== 1 ? 's' : ''} en tu colección`;

    if (!favs.length) { el.innerHTML = ''; return; }

    const planes = favs.map(id => aircraft.find(p => p.id === id)).filter(Boolean);

    const byType    = {};
    let   totalRating = 0, ratedCount = 0, pinnedCount = 0, taggedCount = 0;

    for (const p of planes) {
      byType[p.type] = (byType[p.type] || 0) + 1;
    }
    for (const [id, meta] of Object.entries(favsMeta)) {
      if (!favs.includes(id)) continue;
      if (meta.rating > 0) { totalRating += meta.rating; ratedCount++; }
      if (meta.pinned)  pinnedCount++;
      if (meta.tags?.length) taggedCount++;
    }
    const avgRating  = ratedCount > 0 ? (totalRating / ratedCount).toFixed(1) : '—';
    const topType    = Object.entries(byType).sort((a,b)=>b[1]-a[1])[0];
    const allTags    = store.getAllFavTags();

    el.innerHTML = `
      <div class="fav-stat-card">
        <p class="fav-stat-num">${favs.length}</p>
        <p class="fav-stat-label">Aeronaves</p>
      </div>
      <div class="fav-stat-card">
        <p class="fav-stat-num" style="color:#f59e0b">${pinnedCount}</p>
        <p class="fav-stat-label">Fijadas</p>
      </div>
      <div class="fav-stat-card">
        <p class="fav-stat-num" style="color:#f472b6">${avgRating}${ratedCount > 0 ? '★' : ''}</p>
        <p class="fav-stat-label">Rating medio</p>
      </div>
      <div class="fav-stat-card">
        <p class="fav-stat-num" style="color:#22d3ee">${allTags.length}</p>
        <p class="fav-stat-label">Tags creadas</p>
      </div>
      <div class="fav-stat-card">
        <p class="fav-stat-num" style="color:#34d399">${topType ? topType[0] : '—'}</p>
        <p class="fav-stat-label">Tipo más común</p>
      </div>`;
  }

  // ── Tag filter ─────────────────────────────────────────────
  #renderTagFilter() {
    const wrap = this.#el?.querySelector('#tagFilterWrap');
    if (!wrap) return;
    const tags    = store.getAllFavTags();
    const current = store.get('favsFilterTag');

    wrap.innerHTML = [
      `<button class="fav-tag-pill ${current === 'all' ? 'active' : ''}" data-filter-tag="all">Todas</button>`,
      ...tags.map(t => `<button class="fav-tag-pill ${current === t ? 'active' : ''}" data-filter-tag="${t}">${t}</button>`)
    ].join('');
  }

  // ── Lista de favoritos ─────────────────────────────────────
  #renderList() {
    const list  = this.#el?.querySelector('#favsList');
    const count = this.#el?.querySelector('#favsCount');
    if (!list) return;

    const filtered = store.getFilteredFavs();
    if (count) count.textContent = `${filtered.length} aeronave${filtered.length !== 1 ? 's' : ''}`;

    if (!filtered.length) {
      const favsTotal = store.get('favs').length;
      list.innerHTML = favsTotal === 0
        ? this.#emptyState()
        : this.#filteredEmpty();
      return;
    }

    const frag = document.createDocumentFragment();
    filtered.forEach(({ plane, meta }, idx) => {
      frag.appendChild(this.#createCard(plane, meta, idx));
    });
    list.innerHTML = '';
    list.appendChild(frag);
  }

  // ── Card de favorito ───────────────────────────────────────
  #createCard(plane, meta, idx) {
    const article = document.createElement('article');
    article.className = `fav-card${meta.pinned ? ' pinned' : ''}`;
    article.setAttribute('role', 'listitem');
    article.dataset.id = plane.id;
    article.draggable = true;

    const stars = this.#starsHTML(meta.rating || 0);
    const tags  = (meta.tags || []).map(t => `<span class="fav-tag-chip">${t}</span>`).join('');
    const addedDate = meta.addedAt
      ? new Date(meta.addedAt).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' })
      : '';

    article.innerHTML = `
      <div class="fav-card-drag-handle" aria-hidden="true" title="Arrastra para reordenar">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/></svg>
      </div>

      <div class="fav-card-img-wrap">
        <img src="./public/min/${plane.img}.webp"
          alt="${plane.name}" width="120" height="68"
          onerror="this.src='${FALLBACK_IMG}'"
          loading="lazy">
        ${meta.pinned ? '<span class="fav-pin-badge" aria-label="Fijado">📌</span>' : ''}
      </div>

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
          <div class="fav-card-rating" aria-label="Valoración: ${meta.rating || 0} de 5">${stars}</div>
        </div>

        ${meta.note ? `<p class="fav-card-note">"${meta.note}"</p>` : ''}

        ${tags ? `<div class="fav-card-tags" aria-label="Etiquetas">${tags}</div>` : ''}

        <div class="fav-card-stats" aria-label="Estadísticas">
          <span class="fav-stat-chip">⚡ ${plane.speed.toLocaleString('es-ES')} km/h</span>
          <span class="fav-stat-chip">📡 ${plane.ceiling.toLocaleString('es-ES')} m</span>
          <span class="fav-stat-chip">🗺 ${plane.range.toLocaleString('es-ES')} km</span>
        </div>

        <div class="fav-card-footer">
          ${addedDate ? `<span class="fav-added-date mono">Añadido ${addedDate}</span>` : ''}
          <div class="fav-card-actions">
            <button class="fav-action-btn fav-pin-btn ${meta.pinned ? 'active' : ''}"
              data-action="pin" data-id="${plane.id}"
              aria-label="${meta.pinned ? 'Desfijar' : 'Fijar en la cima'}"
              aria-pressed="${meta.pinned}"
              title="${meta.pinned ? 'Desfijar' : 'Fijar en la cima'}">
              📌
            </button>
            <button class="fav-action-btn fav-edit-btn"
              data-action="edit" data-id="${plane.id}"
              aria-label="Editar notas y etiquetas de ${plane.name}"
              title="Editar notas y etiquetas">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
              Editar
            </button>
            <button class="fav-action-btn fav-compare-btn"
              data-action="compare" data-id="${plane.id}"
              aria-label="Añadir ${plane.name} al comparador"
              title="Añadir al comparador">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
              Comparar
            </button>
            <button class="fav-action-btn fav-remove-btn"
              data-action="remove" data-id="${plane.id}"
              aria-label="Quitar ${plane.name} de favoritos"
              title="Quitar de favoritos">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
            </button>
          </div>
        </div>
      </div>`;

    this.#bindCardDrag(article);
    return article;
  }

  #starsHTML(rating) {
    return Array.from({ length: 5 }, (_, i) =>
      `<span class="fav-star ${i < rating ? 'filled' : ''}" aria-hidden="true">★</span>`
    ).join('');
  }

  // ── Drag & Drop reorder ────────────────────────────────────
  #bindCardDrag(card) {
    card.addEventListener('dragstart', (e) => {
      this.#dragSrcId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.id);
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      this.#el?.querySelectorAll('.fav-card').forEach(c => c.classList.remove('drag-over'));
    });
    card.addEventListener('dragover', (e) => {
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      if (card.dataset.id !== this.#dragSrcId) card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const srcId  = this.#dragSrcId;
      const dstId  = card.dataset.id;
      if (!srcId || srcId === dstId) return;
      const favs   = store.get('favs');
      const from   = favs.indexOf(srcId);
      const to     = favs.indexOf(dstId);
      if (from < 0 || to < 0) return;
      store.reorderFav(from, to);
      this.#dragSrcId = null;
    });
  }

  // ── Modal de edición ───────────────────────────────────────
  #openModal(id) {
    const aircraft = store.get('aircraftDB');
    const plane    = aircraft.find(p => p.id === id);
    const meta     = store.getFavMeta(id) || {};
    if (!plane) return;

    const modal = this.#el?.querySelector('#favsEditModal');
    if (!modal) return;

    modal.dataset.editId = id;
    modal.querySelector('#modalTitle').textContent = `Editar: ${plane.name}`;
    modal.querySelector('#modalPlaneName').textContent = `${plane.type} · ${plane.country} · ${plane.year}`;
    modal.querySelector('#modalNote').value = meta.note || '';

    // Stars
    this.#syncModalStars(meta.rating || 0);

    // Tags activas
    this.#renderModalTags(meta.tags || []);

    modal.classList.remove('hidden');
    modal.querySelector('#modalNote').focus();
    document.body.style.overflow = 'hidden';
  }

  #closeModal() {
    const modal = this.#el?.querySelector('#favsEditModal');
    modal?.classList.add('hidden');
    document.body.style.overflow = '';
  }

  #saveModal() {
    const modal   = this.#el?.querySelector('#favsEditModal');
    if (!modal) return;
    const id      = modal.dataset.editId;
    const note    = modal.querySelector('#modalNote')?.value?.trim() || '';
    const rating  = parseInt(modal.dataset.pendingRating ?? store.getFavMeta(id)?.rating ?? 0);
    const tags    = [...modal.querySelectorAll('.modal-active-tag')].map(t => t.dataset.tag);

    store.updateFavMeta(id, { note, rating, tags });
    this.#closeModal();
    showToast('✓ Cambios guardados');
  }

  #syncModalStars(rating) {
    const modal = this.#el?.querySelector('#favsEditModal');
    if (!modal) return;
    modal.dataset.pendingRating = rating;
    modal.querySelectorAll('.star-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i < rating);
      btn.setAttribute('aria-pressed', i < rating);
    });
  }

  #renderModalTags(tags) {
    const wrap = this.#el?.querySelector('#modalActiveTags');
    if (!wrap) return;
    wrap.innerHTML = tags.map(t => `
      <span class="modal-active-tag" data-tag="${t}">
        ${t}
        <button class="modal-tag-remove" data-remove-tag="${t}" aria-label="Quitar etiqueta ${t}">×</button>
      </span>`).join('');
  }

  #addModalTag(tag) {
    const modal = this.#el?.querySelector('#favsEditModal');
    if (!modal) return;
    const id    = modal.dataset.editId;
    const existing = [...modal.querySelectorAll('.modal-active-tag')].map(t => t.dataset.tag);
    const clean = tag.toLowerCase().trim().replace(/[^a-záéíóúüñ0-9\-]/gi, '');
    if (!clean || existing.includes(clean) || existing.length >= 10) return;
    this.#renderModalTags([...existing, clean]);
  }

  // ── Export / Import ────────────────────────────────────────
  #handleExport() {
    const json     = store.exportFavs();
    const blob     = new Blob([json], { type: 'application/json' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    a.href         = url;
    a.download     = `aeropedia-favoritos-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`✓ ${store.get('favs').length} favoritos exportados`);
  }

  #handleImport(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data.favs)) throw new Error('Formato inválido');

        const currentFavs = [...store.get('favs')];
        const currentMeta = { ...store.get('favsMeta') };
        let   added = 0;

        for (const entry of data.favs) {
          if (!entry.id || currentFavs.includes(entry.id)) continue;
          const aircraft = store.get('aircraftDB');
          if (!aircraft.find(p => p.id === entry.id)) continue;
          currentFavs.push(entry.id);
          currentMeta[entry.id] = {
            note:      entry.meta?.note || '',
            tags:      entry.meta?.tags || [],
            pinned:    entry.meta?.pinned || false,
            rating:    entry.meta?.rating || 0,
            addedAt:   entry.meta?.addedAt || Date.now(),
            updatedAt: Date.now(),
          };
          added++;
        }
        store.setState({ favs: currentFavs, favsMeta: currentMeta });
        showToast(`✓ ${added} favoritos importados`);
      } catch (err) {
        showToast(`✗ Error: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  // ── Event bindings ─────────────────────────────────────────
  #bindEvents() {
    // Búsqueda
    const searchInput = this.#el?.querySelector('#favsSearch');
    const debouncedSearch = debounce((e) => store.setState({ favsSearch: e.target.value }), 200);
    searchInput?.addEventListener('input', debouncedSearch);

    // Ordenación
    this.#el?.querySelector('#favsSortBy')?.addEventListener('change', (e) => {
      store.setState({ favsSortBy: e.target.value });
    });
    this.#el?.querySelector('#sortDirBtn')?.addEventListener('click', () => {
      store.setState({ favsSortAsc: !store.get('favsSortAsc') });
      this.#updateSortDirIcon();
    });

    // Clicks delegados en toda la vista
    this.#el?.addEventListener('click', (e) => {
      // Filtro de tag
      const tagPill = e.target.closest('[data-filter-tag]');
      if (tagPill) {
        store.setState({ favsFilterTag: tagPill.dataset.filterTag });
        return;
      }

      // Acciones de card
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        const { action, id } = actionBtn.dataset;
        if (action === 'pin')     { store.toggleFavPin(id); return; }
        if (action === 'edit')    { this.#openModal(id); return; }
        if (action === 'remove')  { store.toggleFav(id); showToast('Aeronave quitada de favoritos'); return; }
        if (action === 'compare') {
          store.toggleCompare(id);
          showToast(`${store.get('compareList').includes(id) ? '+ Añadido al' : '- Quitado del'} comparador`);
          return;
        }
      }

      // Stars del modal
      const starBtn = e.target.closest('.star-btn');
      if (starBtn) {
        const n = parseInt(starBtn.dataset.star);
        const modal = this.#el?.querySelector('#favsEditModal');
        const current = parseInt(modal?.dataset.pendingRating ?? 0);
        this.#syncModalStars(n === current ? 0 : n); // click mismo: reset a 0
        return;
      }

      // Quitar tag del modal
      const removeTag = e.target.closest('[data-remove-tag]');
      if (removeTag) {
        const wrap = this.#el?.querySelector('#modalActiveTags');
        const remaining = [...wrap?.querySelectorAll('.modal-active-tag') || []].map(t => t.dataset.tag).filter(t => t !== removeTag.dataset.removeTag);
        this.#renderModalTags(remaining);
        return;
      }

      // Tag sugerida del modal
      const suggestedTag = e.target.closest('.fav-tag-suggested');
      if (suggestedTag) { this.#addModalTag(suggestedTag.dataset.tag); return; }

      // Botón añadir tag manual
      if (e.target.closest('#addTagBtn')) {
        const input = this.#el?.querySelector('#modalTagInput');
        this.#addModalTag(input?.value || '');
        if (input) input.value = '';
        return;
      }

      // Guardar modal
      if (e.target.closest('#saveModalBtn')) { this.#saveModal(); return; }

      // Quitar desde modal
      if (e.target.closest('#removeFavBtn')) {
        const id = this.#el?.querySelector('#favsEditModal')?.dataset.editId;
        this.#closeModal();
        if (id) { store.toggleFav(id); showToast('Aeronave quitada de favoritos'); }
        return;
      }

      // Cerrar modal
      if (e.target.closest('#closeModalBtn') || e.target.closest('.favs-modal-backdrop')) {
        this.#closeModal(); return;
      }

      // Exportar
      if (e.target.closest('#exportBtn')) { this.#handleExport(); return; }
    });

    // Enter en input de tag del modal
    this.#el?.querySelector('#modalTagInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.#addModalTag(e.target.value);
        e.target.value = '';
      }
    });

    // Importar archivo
    this.#el?.querySelector('#importFile')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) { this.#handleImport(file); e.target.value = ''; }
    });

    // Cerrar modal con ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = this.#el?.querySelector('#favsEditModal');
        if (modal && !modal.classList.contains('hidden')) this.#closeModal();
      }
    });
  }

  #updateSortDirIcon() {
    const asc = store.get('favsSortAsc');
    const icon = this.#el?.querySelector('#sortDirIcon');
    if (icon) {
      icon.innerHTML = asc
        ? '<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>'
        : '<path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"/>';
    }
  }

  // ── Estados vacíos ─────────────────────────────────────────
  #emptyState() {
    return `<div class="favs-empty" role="status">
      <div class="favs-empty-icon" aria-hidden="true">⭐</div>
      <p class="favs-empty-title">Tu colección está vacía</p>
      <p class="favs-empty-sub">Usa el botón ★ en cualquier aeronave del archivo para guardarla aquí.</p>
      <a href="/" data-link class="btn-back-home" style="margin-top:.5rem">→ Explorar el archivo</a>
    </div>`;
  }

  #filteredEmpty() {
    return `<div class="favs-empty" role="status">
      <div class="favs-empty-icon" aria-hidden="true">🔍</div>
      <p class="favs-empty-title">Sin resultados</p>
      <p class="favs-empty-sub">Ningún favorito coincide con los filtros actuales.</p>
      <button class="btn-back-home" id="clearFavsFilters" style="margin-top:.5rem">Limpiar filtros</button>
    </div>`;
  }
}
