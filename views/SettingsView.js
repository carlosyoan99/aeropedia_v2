/**
 * views/SettingsView.js — Vista de configuración de usuario
 * Ruta: /settings
 *
 * Secciones:
 *   1. Apariencia  — tema, densidad, columnas, escala, animaciones, barras
 *   2. Comportamiento — restaurar filtros, página de inicio
 *   3. Favoritos   — ordenación, layout, columnas tabla, confirmación, gráficos
 *   4. Accesibilidad — focus ring, anuncios de ruta, atajos
 *   5. Datos        — exportar/importar prefs, exportar/importar favs, reset
 */

import { store }    from '../store/index.js';
import { prefs, DEFAULTS, applyThemeToDom, applyFontScale, applyAnimations, applyDensity, applyFocusRing } from '../store/preferences.js';
import { router }   from '../router/index.js';
import { setPageMeta, showToast, debounce , buildBreadcrumb } from '../utils/index.js';

export class SettingsView {
  #el   = null;
  #subs = [];

  async render() {
    setPageMeta({
      title:       'Configuración — AeroPedia',
      description: 'Personaliza la apariencia, comportamiento y accesibilidad de AeroPedia.',
    });

    this.#el = document.createElement('div');
    this.#el.className = 'settings-view';
    this.#el.innerHTML = this.#template();
    this.#populateValues();
    this.#bindEvents();
    this.#subscribeLive();
    return this.#el;
  }

  destroy() { this.#subs.forEach(u => u()); }

  // ── Template ────────────────────────────────────────────────
  #template() {
    return `
    <div class="settings-header">
      <button class="btn-back" onclick="history.back()" aria-label="Volver atrás">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>
        Volver
      </button>
        ${buildBreadcrumb('/settings')}
      <div>
        <h1 class="settings-title">
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" aria-hidden="true"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>
          Configuración
        </h1>
        <p class="settings-subtitle">Los cambios se aplican en tiempo real y se guardan automáticamente.</p>
      </div>
    </div>

    <div class="settings-layout">

      <!-- Sidebar nav -->
      <nav class="settings-nav" aria-label="Secciones de configuración">
        ${[
          ['appearance', '🎨', 'Apariencia'],
          ['behavior',   '⚡', 'Comportamiento'],
          ['favs',       '⭐', 'Favoritos'],
          ['a11y',       '♿', 'Accesibilidad'],
          ['data',       '💾', 'Datos'],
        ].map(([id, icon, label]) =>
          `<a href="#section-${id}" class="settings-nav-item" data-section="${id}">
            <span aria-hidden="true">${icon}</span> ${label}
          </a>`
        ).join('')}
      </nav>

      <!-- Contenido -->
      <div class="settings-content">

        <!-- ── APARIENCIA ────────────────────────────────── -->
        <section id="section-appearance" class="settings-section" aria-labelledby="hd-appearance">
          <div class="settings-section-header">
            <h2 id="hd-appearance" class="settings-section-title">🎨 Apariencia</h2>
            <button class="settings-reset-btn" data-reset="display" aria-label="Restablecer apariencia">Restablecer</button>
          </div>

          <!-- Tema -->
          <div class="settings-field">
            <label class="settings-label" for="themeSel">Tema de color</label>
            <p class="settings-desc">Afecta a toda la interfaz. "Alto contraste" mejora legibilidad.</p>
            <div class="settings-radio-group" role="radiogroup" aria-labelledby="hd-appearance" id="themeGroup">
              ${[['dark','Oscuro','🌙'],['light','Claro','☀'],['high-contrast','Alto contraste','◑']].map(([v,l,i]) =>
                `<label class="settings-radio-card">
                  <input type="radio" name="theme" value="${v}" aria-label="Tema ${l}">
                  <span class="radio-card-icon" aria-hidden="true">${i}</span>
                  <span class="radio-card-label">${l}</span>
                </label>`
              ).join('')}
            </div>
          </div>

          <!-- Densidad -->
          <div class="settings-field">
            <label class="settings-label">Densidad de tarjetas</label>
            <p class="settings-desc">Controla el tamaño de las tarjetas en la galería.</p>
            <div class="settings-radio-group" role="radiogroup" aria-label="Densidad de tarjetas" id="densityGroup">
              ${[['compact','Compacta','Más tarjetas visibles'],['normal','Normal','Equilibrado'],['large','Grande','Más detalle']].map(([v,l,d]) =>
                `<label class="settings-radio-card">
                  <input type="radio" name="cardDensity" value="${v}" aria-label="Densidad ${l}">
                  <span class="radio-card-label">${l}</span>
                  <span class="radio-card-desc">${d}</span>
                </label>`
              ).join('')}
            </div>
          </div>

          <!-- Columnas galería -->
          <div class="settings-field">
            <label class="settings-label" for="galleryCols">Columnas de la galería</label>
            <p class="settings-desc">Número fijo de columnas, o automático según el ancho.</p>
            <select id="galleryCols" class="settings-select" aria-label="Columnas de la galería">
              <option value="auto">Automático (recomendado)</option>
              <option value="2">2 columnas</option>
              <option value="3">3 columnas</option>
              <option value="4">4 columnas</option>
            </select>
          </div>

          <!-- Escala de fuente -->
          <div class="settings-field">
            <label class="settings-label" for="fontScaleRange">
              Tamaño de texto:
              <strong id="fontScaleVal" class="settings-range-val"></strong>
            </label>
            <p class="settings-desc">Escala global del texto. Útil para mejorar legibilidad.</p>
            <input type="range" id="fontScaleRange" class="settings-range"
              min="0.85" max="1.2" step="0.05"
              aria-label="Escala de fuente" aria-valuemin="85" aria-valuemax="120">
            <div class="settings-range-labels" aria-hidden="true">
              <span>85%</span><span>100%</span><span>120%</span>
            </div>
          </div>

          <!-- Animaciones -->
          <div class="settings-field">
            <label class="settings-toggle-label">
              <span>
                <span class="settings-label">Animaciones y transiciones</span>
                <span class="settings-desc">Desactiva para mejorar rendimiento o reducir distracciones.</span>
              </span>
              <input type="checkbox" id="animationsToggle" role="switch" class="settings-toggle-input"
                aria-label="Activar animaciones">
              <span class="settings-toggle-track" aria-hidden="true"></span>
            </label>
          </div>

          <!-- Barras de stats -->
          <div class="settings-field">
            <label class="settings-toggle-label">
              <span>
                <span class="settings-label">Barras de estadísticas en tarjetas</span>
                <span class="settings-desc">Muestra barras visuales de velocidad, techo y alcance.</span>
              </span>
              <input type="checkbox" id="statBarsToggle" role="switch" class="settings-toggle-input"
                aria-label="Mostrar barras de estadísticas">
              <span class="settings-toggle-track" aria-hidden="true"></span>
            </label>
          </div>
        </section>

        <!-- ── COMPORTAMIENTO ─────────────────────────────── -->
        <section id="section-behavior" class="settings-section" aria-labelledby="hd-behavior">
          <div class="settings-section-header">
            <h2 id="hd-behavior" class="settings-section-title">⚡ Comportamiento</h2>
            <button class="settings-reset-btn" data-reset="filters" aria-label="Restablecer comportamiento">Restablecer</button>
          </div>

          <div class="settings-field">
            <label class="settings-toggle-label">
              <span>
                <span class="settings-label">Recordar filtros al regresar</span>
                <span class="settings-desc">Restaura la categoría, ordenación y vista al abrir la aplicación.</span>
              </span>
              <input type="checkbox" id="rememberFiltersToggle" role="switch" class="settings-toggle-input"
                aria-label="Recordar filtros">
              <span class="settings-toggle-track" aria-hidden="true"></span>
            </label>
          </div>

          <div class="settings-field" id="filtersSavedInfo">
            <p class="settings-label">Filtros actualmente guardados</p>
            <div class="settings-saved-filters" id="savedFiltersDisplay"></div>
            <button class="settings-action-btn" id="clearSavedFilters" style="margin-top:.5rem">
              Limpiar filtros guardados
            </button>
          </div>
        </section>

        <!-- ── FAVORITOS ─────────────────────────────────── -->
        <section id="section-favs" class="settings-section" aria-labelledby="hd-favs">
          <div class="settings-section-header">
            <h2 id="hd-favs" class="settings-section-title">⭐ Favoritos</h2>
            <button class="settings-reset-btn" data-reset="favs" aria-label="Restablecer favoritos">Restablecer</button>
          </div>

          <div class="settings-field">
            <label class="settings-label" for="favsDefaultSort">Ordenación por defecto</label>
            <select id="favsDefaultSort" class="settings-select">
              <option value="addedAt">Recién añadidos</option>
              <option value="name">Nombre A-Z</option>
              <option value="rating">Valoración</option>
              <option value="year">Año de servicio</option>
              <option value="speed">Velocidad</option>
            </select>
          </div>

          <div class="settings-field">
            <label class="settings-label" for="favsLayout">Layout de tarjetas en Favoritos</label>
            <select id="favsLayout" class="settings-select">
              <option value="normal">Normal (tarjetas completas)</option>
              <option value="compact">Compacto (filas densas)</option>
              <option value="table">Tabla (columnas)</option>
            </select>
          </div>

          <div class="settings-field">
            <label class="settings-label">Columnas visibles en vista tabla</label>
            <div class="settings-checkboxes" id="tableColsGroup" role="group" aria-label="Columnas de la tabla">
              ${[['speed','Velocidad'],['range','Alcance'],['ceiling','Techo'],['mtow','MTOW'],['year','Año'],['crew','Tripulación']].map(([v,l]) =>
                `<label class="settings-checkbox-label">
                  <input type="checkbox" class="table-col-check" value="${v}" aria-label="Columna ${l}">
                  <span>${l}</span>
                </label>`
              ).join('')}
            </div>
          </div>

          <div class="settings-field">
            <label class="settings-toggle-label">
              <span>
                <span class="settings-label">Confirmar al quitar un favorito</span>
                <span class="settings-desc">Muestra un diálogo antes de quitar aeronaves de favoritos.</span>
              </span>
              <input type="checkbox" id="confirmRemoveToggle" role="switch" class="settings-toggle-input"
                aria-label="Pedir confirmación al quitar favoritos">
              <span class="settings-toggle-track" aria-hidden="true"></span>
            </label>
          </div>

          <div class="settings-field">
            <label class="settings-toggle-label">
              <span>
                <span class="settings-label">Mostrar gráficos en Favoritos</span>
                <span class="settings-desc">Gráficos de distribución por tipo, generación y país.</span>
              </span>
              <input type="checkbox" id="showChartsToggle" role="switch" class="settings-toggle-input"
                aria-label="Mostrar gráficos de favoritos">
              <span class="settings-toggle-track" aria-hidden="true"></span>
            </label>
          </div>

          <!-- Info favoritos guardados -->
          <div class="settings-field">
            <p class="settings-label">Tu colección actual</p>
            <div class="settings-favs-info" id="favsSummary"></div>
          </div>
        </section>

        <!-- ── ACCESIBILIDAD ──────────────────────────────── -->
        <section id="section-a11y" class="settings-section" aria-labelledby="hd-a11y">
          <div class="settings-section-header">
            <h2 id="hd-a11y" class="settings-section-title">♿ Accesibilidad</h2>
            <button class="settings-reset-btn" data-reset="a11y" aria-label="Restablecer accesibilidad">Restablecer</button>
          </div>

          <div class="settings-field">
            <label class="settings-toggle-label">
              <span>
                <span class="settings-label">Focus ring siempre visible</span>
                <span class="settings-desc">Muestra el indicador de foco en todos los elementos, no solo al usar teclado.</span>
              </span>
              <input type="checkbox" id="focusRingToggle" role="switch" class="settings-toggle-input"
                aria-label="Mostrar focus ring siempre">
              <span class="settings-toggle-track" aria-hidden="true"></span>
            </label>
          </div>

          <div class="settings-field">
            <label class="settings-toggle-label">
              <span>
                <span class="settings-label">Anunciar cambios de ruta</span>
                <span class="settings-desc">Anuncia la nueva página a lectores de pantalla al navegar.</span>
              </span>
              <input type="checkbox" id="announceRoutesToggle" role="switch" class="settings-toggle-input"
                aria-label="Anunciar cambios de ruta">
              <span class="settings-toggle-track" aria-hidden="true"></span>
            </label>
          </div>

          <div class="settings-field">
            <label class="settings-toggle-label">
              <span>
                <span class="settings-label">Mostrar atajos de teclado en tooltips</span>
                <span class="settings-desc">Los tooltips de los botones incluyen el atajo de teclado correspondiente.</span>
              </span>
              <input type="checkbox" id="keyboardHintsToggle" role="switch" class="settings-toggle-input"
                aria-label="Mostrar atajos en tooltips">
              <span class="settings-toggle-track" aria-hidden="true"></span>
            </label>
          </div>

          <!-- Atajos de teclado -->
          <div class="settings-field">
            <p class="settings-label">Atajos de teclado globales</p>
            <div class="settings-shortcuts">
              ${[
                ['/', 'Enfocar búsqueda'],
                ['G', 'Vista galería'],
                ['R', 'Vista ranking'],
                ['F', 'Filtrar favoritos'],
                ['D', 'Cambiar tema'],
                ['Ctrl+,', 'Configuración'],
                ['Esc', 'Volver al inicio'],
              ].map(([k,l]) => `
                <div class="shortcut-row">
                  <span class="shortcut-desc">${l}</span>
                  <kbd class="shortcut-key">${k}</kbd>
                </div>`).join('')}
            </div>
          </div>
        </section>

        <!-- ── DATOS ──────────────────────────────────────── -->
        <section id="section-data" class="settings-section" aria-labelledby="hd-data">
          <div class="settings-section-header">
            <h2 id="hd-data" class="settings-section-title">💾 Datos y Privacidad</h2>
          </div>

          <!-- Preferencias -->
          <div class="settings-field">
            <p class="settings-label">Preferencias de la aplicación</p>
            <p class="settings-desc">Exporta o importa todos tus ajustes de configuración.</p>
            <div class="settings-actions-row">
              <button class="settings-action-btn" id="exportPrefs">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                Exportar preferencias
              </button>
              <label class="settings-action-btn" style="cursor:pointer">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
                Importar preferencias
                <input type="file" accept=".json" id="importPrefsFile" class="sr-only">
              </label>
            </div>
          </div>

          <!-- Favoritos -->
          <div class="settings-field">
            <p class="settings-label">Colección de favoritos</p>
            <p class="settings-desc">Exporta tus favoritos con notas y etiquetas, o importa desde otro dispositivo.</p>
            <div class="settings-actions-row">
              <button class="settings-action-btn" id="exportFavs">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                Exportar favoritos
              </button>
              <label class="settings-action-btn" style="cursor:pointer">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
                Importar favoritos
                <input type="file" accept=".json" id="importFavsFile" class="sr-only">
              </label>
            </div>
          </div>

          <!-- Info localStorage -->
          <div class="settings-field">
            <p class="settings-label">Almacenamiento local</p>
            <div class="settings-ls-info" id="lsInfo"></div>
          </div>

          <!-- Reset total -->
          <div class="settings-field settings-danger-zone">
            <p class="settings-label" style="color:var(--danger)">Zona de peligro</p>
            <p class="settings-desc">Estas acciones son irreversibles.</p>
            <div class="settings-actions-row">
              <button class="settings-action-btn danger" id="resetAllPrefs">
                Restablecer toda la configuración
              </button>
              <button class="settings-action-btn danger" id="clearAllData">
                Eliminar todos los datos
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>`;
  }

  // ── Poblar valores desde prefs ──────────────────────────────
  #populateValues() {
    const d = prefs.getSection('display');
    const f = prefs.getSection('filters');
    const fv = prefs.getSection('favs');
    const a = prefs.getSection('a11y');

    // Tema
    this.#el.querySelector(`input[name="theme"][value="${d.theme}"]`)?.setAttribute('checked', '');
    this.#el.querySelectorAll('input[name="theme"]').forEach(r => { r.checked = r.value === d.theme; });

    // Densidad
    this.#el.querySelectorAll('input[name="cardDensity"]').forEach(r => { r.checked = r.value === d.cardDensity; });

    // Columnas galería
    const galleryCols = this.#el.querySelector('#galleryCols');
    if (galleryCols) galleryCols.value = d.galleryColumns;

    // Font scale
    const scaleRange = this.#el.querySelector('#fontScaleRange');
    if (scaleRange) { scaleRange.value = d.fontScale; this.#updateScaleLabel(d.fontScale); }

    // Toggles display
    this.#setToggle('animationsToggle', d.animationsEnabled);
    this.#setToggle('statBarsToggle', d.showStatBars);

    // Filters
    this.#setToggle('rememberFiltersToggle', f.rememberFilters);
    this.#updateSavedFilters(f);

    // Favs
    const favsSort = this.#el.querySelector('#favsDefaultSort');
    if (favsSort) favsSort.value = fv.defaultSortBy;
    const favsLayout = this.#el.querySelector('#favsLayout');
    if (favsLayout) favsLayout.value = fv.cardLayout;
    this.#el.querySelectorAll('.table-col-check').forEach(cb => {
      cb.checked = fv.tableColumns.includes(cb.value);
    });
    this.#setToggle('confirmRemoveToggle', fv.confirmOnRemove);
    this.#setToggle('showChartsToggle', fv.showCharts);
    this.#updateFavsSummary();

    // A11y
    this.#setToggle('focusRingToggle', a.focusRingAlways);
    this.#setToggle('announceRoutesToggle', a.announceRoutes);
    this.#setToggle('keyboardHintsToggle', a.keyboardHints);

    // LS info
    this.#updateLsInfo();
  }

  #setToggle(id, value) {
    const el = this.#el.querySelector(`#${id}`);
    if (el) el.checked = !!value;
  }

  #updateScaleLabel(scale) {
    const el = this.#el.querySelector('#fontScaleVal');
    if (el) el.textContent = `${Math.round(scale * 100)}%`;
  }

  #updateSavedFilters(f) {
    const el = this.#el.querySelector('#savedFiltersDisplay');
    if (!el) return;
    if (!f.rememberFilters) { el.innerHTML = '<span class="settings-badge">Desactivado</span>'; return; }
    el.innerHTML = [
      `<span class="settings-badge">Categoría: ${f.lastCat}</span>`,
      `<span class="settings-badge">Vista: ${f.lastView}</span>`,
      `<span class="settings-badge">Orden: ${f.lastSortStat} ${f.lastSortAsc ? '↑' : '↓'}</span>`,
    ].join('');
  }

  #updateFavsSummary() {
    const el = this.#el.querySelector('#favsSummary');
    if (!el) return;
    const favs   = store.get('favs') || [];
    const meta   = store.get('favsMeta') || {};
    const tagged = Object.values(meta).filter(m => m?.tags?.length).length;
    const noted  = Object.values(meta).filter(m => m?.note?.trim()).length;
    const rated  = Object.values(meta).filter(m => m?.rating > 0).length;
    el.innerHTML = `
      <span class="settings-badge">${favs.length} aeronaves</span>
      <span class="settings-badge">${tagged} con etiquetas</span>
      <span class="settings-badge">${noted} con notas</span>
      <span class="settings-badge">${rated} valoradas</span>`;
  }

  #updateLsInfo() {
    const el = this.#el.querySelector('#lsInfo');
    if (!el) return;
    const keys = ['aeropedia_prefs','aeropedia_favs','aeropedia_favs_meta','aeropedia_theme'];
    let total = 0;
    const rows = keys.map(k => {
      const val = localStorage.getItem(k) || '';
      const kb  = (new Blob([val]).size / 1024).toFixed(1);
      total += parseFloat(kb);
      return `<div class="ls-row"><span class="ls-key mono">${k}</span><span class="ls-size mono">${kb} KB</span></div>`;
    });
    el.innerHTML = rows.join('') + `<div class="ls-total"><strong>Total: ${total.toFixed(1)} KB</strong></div>`;
  }

  // ── Eventos ─────────────────────────────────────────────────
  #bindEvents() {
    // Tema
    this.#el.querySelectorAll('input[name="theme"]').forEach(r => {
      r.addEventListener('change', () => {
        prefs.setOne('display', 'theme', r.value);
        store.setState({ theme: r.value });
        applyThemeToDom(r.value);
      });
    });

    // Densidad
    this.#el.querySelectorAll('input[name="cardDensity"]').forEach(r => {
      r.addEventListener('change', () => {
        prefs.setOne('display', 'cardDensity', r.value);
        applyDensity(r.value);
      });
    });

    // Columnas galería
    this.#el.querySelector('#galleryCols')?.addEventListener('change', (e) => {
      prefs.setOne('display', 'galleryColumns', e.target.value);
      document.documentElement.setAttribute('data-gallery-cols', e.target.value);
    });

    // Font scale
    const scaleRange = this.#el.querySelector('#fontScaleRange');
    const debouncedScale = debounce((val) => {
      prefs.setOne('display', 'fontScale', parseFloat(val));
      applyFontScale(parseFloat(val));
    }, 100);
    scaleRange?.addEventListener('input', (e) => {
      this.#updateScaleLabel(e.target.value);
      debouncedScale(e.target.value);
    });

    // Animaciones
    this.#el.querySelector('#animationsToggle')?.addEventListener('change', (e) => {
      prefs.setOne('display', 'animationsEnabled', e.target.checked);
      applyAnimations(e.target.checked);
    });

    // Barras stats
    this.#el.querySelector('#statBarsToggle')?.addEventListener('change', (e) => {
      prefs.setOne('display', 'showStatBars', e.target.checked);
      document.documentElement.classList.toggle('no-stat-bars', !e.target.checked);
    });

    // Recordar filtros
    this.#el.querySelector('#rememberFiltersToggle')?.addEventListener('change', (e) => {
      prefs.setOne('filters', 'rememberFilters', e.target.checked);
      this.#updateSavedFilters(prefs.getSection('filters'));
    });

    // Limpiar filtros guardados
    this.#el.querySelector('#clearSavedFilters')?.addEventListener('click', () => {
      prefs.set('filters', { lastCat: 'all', lastView: 'gallery', lastSortStat: 'speed', lastSortAsc: false });
      this.#updateSavedFilters(prefs.getSection('filters'));
      showToast('✓ Filtros guardados limpiados');
    });

    // Favs sort
    this.#el.querySelector('#favsDefaultSort')?.addEventListener('change', (e) => {
      prefs.setOne('favs', 'defaultSortBy', e.target.value);
    });

    // Favs layout
    this.#el.querySelector('#favsLayout')?.addEventListener('change', (e) => {
      prefs.setOne('favs', 'cardLayout', e.target.value);
    });

    // Table columns
    this.#el.querySelectorAll('.table-col-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const cols = [...this.#el.querySelectorAll('.table-col-check:checked')].map(c => c.value);
        prefs.setOne('favs', 'tableColumns', cols);
      });
    });

    // Confirmar quitar favorito
    this.#el.querySelector('#confirmRemoveToggle')?.addEventListener('change', (e) => {
      prefs.setOne('favs', 'confirmOnRemove', e.target.checked);
    });

    // Mostrar gráficos
    this.#el.querySelector('#showChartsToggle')?.addEventListener('change', (e) => {
      prefs.setOne('favs', 'showCharts', e.target.checked);
    });

    // A11y
    this.#el.querySelector('#focusRingToggle')?.addEventListener('change', (e) => {
      prefs.setOne('a11y', 'focusRingAlways', e.target.checked);
      applyFocusRing(e.target.checked);
    });
    this.#el.querySelector('#announceRoutesToggle')?.addEventListener('change', (e) => {
      prefs.setOne('a11y', 'announceRoutes', e.target.checked);
    });
    this.#el.querySelector('#keyboardHintsToggle')?.addEventListener('change', (e) => {
      prefs.setOne('a11y', 'keyboardHints', e.target.checked);
    });

    // Reset por sección
    this.#el.querySelectorAll('.settings-reset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.dataset.reset;
        if (confirm(`¿Restablecer la sección "${section}" a los valores por defecto?`)) {
          prefs.resetSection(section);
          this.#populateValues();
          showToast(`✓ Sección "${section}" restablecida`);
        }
      });
    });

    // Exportar preferencias
    this.#el.querySelector('#exportPrefs')?.addEventListener('click', () => {
      this.#downloadFile(prefs.export(), `aeropedia-prefs-${this.#dateStr()}.json`);
      showToast('✓ Preferencias exportadas');
    });

    // Importar preferencias
    this.#el.querySelector('#importPrefsFile')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = prefs.import(ev.target.result);
        if (result.ok) { this.#populateValues(); showToast('✓ Preferencias importadas'); }
        else showToast(`✗ Error: ${result.error}`);
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // Exportar favoritos
    this.#el.querySelector('#exportFavs')?.addEventListener('click', () => {
      this.#downloadFile(store.exportFavs(), `aeropedia-favs-${this.#dateStr()}.json`);
      showToast(`✓ ${store.get('favs').length} favoritos exportados`);
    });

    // Importar favoritos
    this.#el.querySelector('#importFavsFile')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (!Array.isArray(data.favs)) throw new Error('Formato inválido');
          const cur = [...store.get('favs')];
          const curMeta = { ...store.get('favsMeta') };
          let added = 0;
          for (const entry of data.favs) {
            if (!entry.id || cur.includes(entry.id)) continue;
            if (!store.get('aircraftDB').find(p => p.id === entry.id)) continue;
            cur.push(entry.id);
            curMeta[entry.id] = { note:'', tags:[], pinned:false, rating:0, addedAt:Date.now(), updatedAt:Date.now(), ...(entry.meta || {}) };
            added++;
          }
          store.setState({ favs: cur, favsMeta: curMeta });
          this.#updateFavsSummary();
          showToast(`✓ ${added} favoritos importados`);
        } catch(err) { showToast(`✗ Error: ${err.message}`); }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // Reset todos
    this.#el.querySelector('#resetAllPrefs')?.addEventListener('click', () => {
      if (confirm('¿Restablecer toda la configuración a los valores por defecto? Los favoritos no se borran.')) {
        prefs.resetAll();
        store.setState({ theme: prefs.get('display','theme') });
        this.#populateValues();
        showToast('✓ Configuración restablecida');
      }
    });

    // Eliminar todos los datos
    this.#el.querySelector('#clearAllData')?.addEventListener('click', () => {
      if (confirm('⚠ Esto borrará TODOS tus favoritos, notas, etiquetas y preferencias. ¿Continuar?')) {
        ['aeropedia_prefs','aeropedia_favs','aeropedia_favs_meta','aeropedia_theme','aeropedia_roadmap_state'].forEach(k => localStorage.removeItem(k));
        store.setState({ favs: [], favsMeta: {}, compareList: [] });
        prefs.resetAll();
        this.#populateValues();
        showToast('✓ Todos los datos eliminados');
      }
    });

    // Nav settings (scroll a sección)
    this.#el.querySelectorAll('.settings-nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const id = item.dataset.section;
        this.#el.querySelector(`#section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  // ── Reaccionar a cambios externos ──────────────────────────
  #subscribeLive() {
    this.#subs.push(
      store.subscribe(['favs', 'favsMeta'], () => {
        this.#updateFavsSummary();
        this.#updateLsInfo();
      }),
    );
  }

  // ── Helpers ────────────────────────────────────────────────
  #downloadFile(content, filename) {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  }

  #dateStr() {
    return new Date().toISOString().slice(0, 10);
  }
}
