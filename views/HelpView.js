/**
 * views/HelpView.js — Página de ayuda interactiva
 * Ruta: /help  · Acceso: botón ? en el header
 */

import { router }      from '../router/index.js';
import { store }       from '../store/index.js';
import { setPageMeta } from '../utils/index.js';

// ── Secciones de ayuda ─────────────────────────────────────────
const SECTIONS = [
  {
    id: 'start', icon: '🚀', title: 'Inicio rápido',
    content: `
      <h3 class="help-sub">Requisitos</h3>
      <p>AeroPedia necesita un servidor HTTP local para funcionar. Los ES Modules y el Service Worker no funcionan con <code>file://</code>.</p>
      <div class="help-code-block">
        <code>npx serve .</code>
        <code>python -m http.server 8080</code>
        <code>php -S localhost:8080</code>
      </div>

      <h3 class="help-sub">Navegación principal</h3>
      <p>La barra superior contiene todos los controles. De izquierda a derecha: logo (volver al inicio), menú de páginas, búsqueda, filtro de categoría, favoritos, vista galería/ranking, densidad de tarjetas, comparador, tema, estadísticas, ayuda y configuración.</p>

      <h3 class="help-sub">Páginas disponibles</h3>
      <div class="help-pages-grid">
        ${[
          ['/','Archivo','Galería y ranking de aeronaves'],
          ['/compare','Comparar','Hasta 3 aeronaves cara a cara'],
          ['/favorites','Favoritos','Tu colección personal'],
          ['/theater','Teatro','Mapa de conflictos mundiales'],
          ['/stats','Estadísticas','Análisis global de la base de datos'],
          ['/kills','Combate','Historial de victorias aéreas'],
          ['/fleets','Flotas','Inventarios por país'],
          ['/mach','Mach','Calculadora de número Mach'],
          ['/settings','Ajustes','Personalizar la aplicación'],
        ].map(([url,name,desc]) => `
          <a href="${url}" data-link class="help-page-card">
            <span class="help-page-name">${name}</span>
            <span class="help-page-url mono">${url}</span>
            <span class="help-page-desc">${desc}</span>
          </a>`).join('')}
      </div>
    `,
  },
  {
    id: 'search', icon: '🔍', title: 'Búsqueda y filtros',
    content: `
      <h3 class="help-sub">Búsqueda básica</h3>
      <p>Escribe en el campo del encabezado para filtrar por nombre, país, tipo o fabricante. Atajo: <kbd>/</kbd> desde cualquier página enfoca la búsqueda.</p>

      <h3 class="help-sub">Búsqueda avanzada con operadores</h3>
      <p>Añade operadores <code>clave:valor</code> para filtros precisos. Se combinan libremente:</p>
      <div class="help-operators-grid">
        ${[
          ['tipo:Caza',        'Tipo de aeronave (Caza, Bombardero, Ataque, Drone…)'],
          ['país:USA',         'País operador (nombre en inglés o español)'],
          ['gen:5',            'Generación de caza: 1ª, 2ª, 3ª, 4ª, 4.5ª, 5ª, 6ª'],
          ['año:>2000',        'Año de servicio — soporta > y <'],
          ['velocidad:>2000',  'Velocidad máxima en km/h'],
          ['estado:active',    'Estado: active / retired / prototype'],
          ['stealth:alto',     'Nivel de sigilo: alto / medio / bajo'],
          ['naval:sí',         'Solo aeronaves embarcadas en portaaviones'],
          ['uav:0',            'Solo drones no tripulados (crew = 0)'],
        ].map(([op,desc]) => `
          <div class="help-op-row">
            <code class="help-op-code">${op}</code>
            <span class="help-op-desc">${desc}</span>
          </div>`).join('')}
      </div>
      <div class="help-example-box">
        <span class="help-example-label">Ejemplos:</span>
        <code>tipo:Caza gen:5 país:USA</code>
        <code>stealth:alto año:>2010</code>
        <code>naval:sí velocidad:>1500</code>
      </div>

      <h3 class="help-sub">Filtros del encabezado</h3>
      <p>El selector de categoría filtra por tipo. El botón ★ muestra solo tus favoritos. Ambos se combinan con la búsqueda avanzada.</p>

      <h3 class="help-sub">Timeline</h3>
      <p>Pulsa el botón <strong>Timeline</strong> (o <kbd>T</kbd>) para desplegar el panel con dos sliders de año de entrada en servicio. Haz clic en las marcas de décadas para saltar directamente a esa era.</p>

      <h3 class="help-sub">Panel de recientes</h3>
      <p>Botón <strong>Recientes</strong> (o <kbd>H</kbd>) muestra las últimas 20 aeronaves que visitaste, ordenadas por recencia.</p>
    `,
  },
  {
    id: 'gallery', icon: '⊞', title: 'Galería y ranking',
    content: `
      <h3 class="help-sub">Vista galería (<kbd>G</kbd>)</h3>
      <p>Tarjetas visuales con imagen, estadísticas de vuelo y acciones rápidas: ver ficha, guardar favorito, añadir al comparador y comparación rápida inline.</p>

      <h3 class="help-sub">Densidad de tarjetas</h3>
      <p>Los tres iconos del encabezado (≡ ⊞ ⊟) cambian el tamaño de las tarjetas entre <strong>Compacta</strong> (más aeronaves por pantalla), <strong>Normal</strong> y <strong>Grande</strong> (más detalle).</p>

      <h3 class="help-sub">Vista ranking (<kbd>R</kbd>)</h3>
      <p>Tabla ordenable por velocidad, alcance, techo, MTOW o año. Haz clic en el encabezado de una columna para ordenar; segundo clic invierte el orden.</p>
      <p>En móvil, usa las <strong>pills de ordenación</strong> debajo del encabezado y el botón ↑↓ para cambiar la dirección. El texto debajo de la tabla indica el campo activo y dirección.</p>

      <h3 class="help-sub">Comparación rápida inline</h3>
      <p>Al pasar el cursor sobre una tarjeta aparece el botón <strong>⊥</strong>. Al pulsarlo, se abre un overlay junto a la tarjeta con las 6 estadísticas principales en barras de progreso relativas. Si ya tienes aeronaves en el comparador, las muestra todas juntas.</p>
    `,
  },
  {
    id: 'aircraft', icon: '📋', title: 'Fichas técnicas',
    content: `
      <h3 class="help-sub">Contenido de la ficha</h3>
      <p>Cada ficha incluye:</p>
      <ul class="help-list">
        <li><strong>Rendimiento de vuelo</strong> — 3 gauges SVG animados: velocidad, techo y alcance</li>
        <li><strong>Extracto de Wikipedia</strong> — cargado en tiempo real via REST API</li>
        <li><strong>Radar de aviónica</strong> — polígono SVG de 6 ejes: radar, IRST, EW, data-link, stealth y sigilo</li>
        <li><strong>Planta motriz y dimensiones</strong> — empuje, T/W, Wing Loading, envergadura, longitud</li>
        <li><strong>Armamento</strong> — cañones, hardpoints, misiles y bombas verificados</li>
        <li><strong>Historial operacional</strong> — conflictos con misiones y notas históricas</li>
        <li><strong>Producción</strong> — unidades fabricadas, operadores, coste unitario</li>
        <li><strong>Dato de inteligencia</strong> — hecho relevante verificado</li>
      </ul>

      <h3 class="help-sub">Comparador completo</h3>
      <p>Usa el botón <strong>+</strong> en tarjetas para añadir hasta 3 aeronaves al comparador flotante (barra inferior). Al pulsar "Comparar" verás radar chart superpuesto, barras por estadística y tabla con el mejor valor destacado.</p>

      <h3 class="help-sub">Compartir</h3>
      <p>El botón "Compartir" en la ficha copia la URL directa de esa aeronave al portapapeles.</p>
    `,
  },
  {
    id: 'favorites', icon: '⭐', title: 'Favoritos y colecciones',
    content: `
      <h3 class="help-sub">Guardar aeronaves</h3>
      <p>Botón ★ en tarjetas o en la ficha técnica. El filtro ★ del encabezado muestra solo favoritos en la galería.</p>

      <h3 class="help-sub">Editar favorito</h3>
      <p>En <strong>/favorites</strong>, el botón Editar (o <kbd>E</kbd>) abre un modal con:</p>
      <ul class="help-list">
        <li><strong>Rating 1–5 estrellas</strong> — valoración personal</li>
        <li><strong>Nota Markdown</strong> — con barra de herramientas y vista previa en vivo</li>
        <li><strong>Etiquetas</strong> — propias o de las 8 sugeridas (hasta 10 por aeronave)</li>
        <li><strong>Colecciones</strong> — asignar a una o varias colecciones</li>
      </ul>

      <h3 class="help-sub">Formato Markdown en notas</h3>
      <div class="help-md-grid">
        <code>**texto**</code><span>→ <strong>negrita</strong></span>
        <code>*texto*</code><span>→ <em>cursiva</em></span>
        <code>\`código\`</code><span>→ código inline</span>
        <code>- elemento</code><span>→ lista con viñeta</span>
        <code>&gt; cita</code><span>→ cita destacada</span>
      </div>
      <p>Usa el botón 👁 en la barra del modal para ver la preview renderizada en tiempo real.</p>

      <h3 class="help-sub">Colecciones</h3>
      <p>Botón <strong>+</strong> en la barra lateral de Favoritos. Cada colección tiene nombre, color e icono propios. Una aeronave puede estar en varias colecciones.</p>

      <h3 class="help-sub">Reordenar</h3>
      <p>Arrastra las tarjetas por el icono ⠿ (extremo izquierdo) para reordenar manualmente.</p>

      <h3 class="help-sub">Vistas disponibles</h3>
      <p>Toggle ⊞ ≡ ⊟ en Favoritos: <strong>Normal</strong> (tarjetas completas), <strong>Compacto</strong> (filas densas) y <strong>Tabla</strong> (columnas comparativas con barras de progreso relativas).</p>

      <h3 class="help-sub">Exportar</h3>
      <ul class="help-list">
        <li><strong>JSON</strong> — backup completo con notas, tags, ratings y colecciones. Importable en otro dispositivo.</li>
        <li><strong>PNG</strong> — imagen visual con tarjetas para compartir en redes. Generada con Canvas 2D nativo.</li>
      </ul>

      <h3 class="help-sub">Compartir colección</h3>
      <p>Botón "Compartir" copia una URL con los IDs codificados en base64. Quien la abra verá la colección en modo solo lectura con opción de importar a sus favoritos.</p>

      <h3 class="help-sub">Atajos en /favorites</h3>
      <div class="help-shortcuts-mini">
        ${[['↑↓','Navegar'],['E','Editar'],['P','Pin'],['C','Comparador'],['Del','Quitar'],['Enter','Abrir ficha'],['/', 'Buscar']].map(([k,d]) => `<span><kbd>${k}</kbd> ${d}</span>`).join('')}
      </div>
    `,
  },
  {
    id: 'theater', icon: '🗺', title: 'Teatro de Operaciones',
    content: `
      <h3 class="help-sub">¿Qué es el Teatro?</h3>
      <p>Vista <strong>/theater</strong> — mapa SVG mundial con 53 conflictos militares, desde la Guerra Civil Española (1936) hasta conflictos actuales.</p>

      <h3 class="help-sub">Puntos animados</h3>
      <p>Cada punto tiene un pulso de color según la era: <span style="color:#f59e0b">■</span> II GM · <span style="color:#3b82f6">■</span> Guerra Fría I · <span style="color:#8b5cf6">■</span> Guerra Fría II · <span style="color:#ef4444">■</span> Moderno.</p>

      <h3 class="help-sub">Filtros de era</h3>
      <p>Botones en la barra superior para ver solo los conflictos de una era. La lista lateral se actualiza en sincronía.</p>

      <h3 class="help-sub">Panel de detalle</h3>
      <p>Click en un punto o en la lista lateral muestra: descripción, aeronaves participantes con foto, estadísticas de combate (victorias/pérdidas) y el botón <strong>"Ver en galería"</strong> — filtra la galería principal mostrando solo esas aeronaves.</p>
    `,
  },
  {
    id: 'stats', icon: '📊', title: 'Estadísticas globales',
    content: `
      <h3 class="help-sub">Acceso: <kbd>S</kbd> o menú Stats</h3>

      <h3 class="help-sub">¿Qué incluye?</h3>
      <ul class="help-list">
        <li><strong>8 métricas clave</strong> — total aeronaves, países, unidades fabricadas, velocidad media, aeronaves activas, retiradas</li>
        <li><strong>4 records clickables</strong> — más rápida, mayor alcance, mayor techo, más pesada (con foto y enlace a ficha)</li>
        <li><strong>Gráficos de distribución</strong> — pie chart por tipo, bar chart por décadas, top 10 países, distribución por generación</li>
        <li><strong>Histograma de velocidades</strong> — segmentado por régimen: subsónico &lt;1235 km/h · transsónico · supersónico · hipersónico &gt;5xMach</li>
        <li><strong>Top 10 más rápidas</strong> — con ranking, foto y medallas</li>
      </ul>
      <p>Todos los gráficos son nativos (SVG y Canvas 2D), sin librerías externas.</p>
    `,
  },
  {
    id: 'mach', icon: '⚡', title: 'Calculadora Mach',
    content: `
      <h3 class="help-sub">¿Qué calcula?</h3>
      <p>Convierte velocidad en km/h, mph o nudos a número Mach según la altitud, usando el modelo atmosférico estándar ISA (International Standard Atmosphere). A mayor altitud, la velocidad del sonido disminuye, por lo que el mismo Mach representa menos km/h.</p>

      <h3 class="help-sub">Cómo usar</h3>
      <ol class="help-list help-list--numbered">
        <li>Introduce la velocidad en el campo superior</li>
        <li>Selecciona la unidad: km/h, mph o nudos</li>
        <li>Ajusta la altitud con el slider (0 = nivel del mar = 1225 km/h = Mach 1)</li>
        <li>El resultado se actualiza en tiempo real con la categoría de vuelo</li>
      </ol>

      <h3 class="help-sub">Referencias rápidas</h3>
      <p>Los botones de la parte inferior cargan velocidades conocidas (F-22, SR-71, Concorde, X-15, espacial…) para comparación inmediata. El sparkline muestra el Mach en función de la altitud para la velocidad introducida.</p>
    `,
  },
  {
    id: 'settings', icon: '⚙', title: 'Configuración',
    content: `
      <h3 class="help-sub">Acceso: botón ⚙ en el encabezado o <kbd>Ctrl+,</kbd></h3>

      <h3 class="help-sub">Apariencia</h3>
      <ul class="help-list">
        <li><strong>Tema</strong> — Oscuro (por defecto) · Claro · Alto contraste (WCAG AAA)</li>
        <li><strong>Densidad de tarjetas</strong> — Compacta / Normal / Grande</li>
        <li><strong>Columnas galería</strong> — Automático / 2 / 3 / 4 columnas fijas</li>
        <li><strong>Escala de texto</strong> — 85% a 120% (slider)</li>
        <li><strong>Animaciones</strong> — desactivar para mejor rendimiento o reducir distracciones</li>
        <li><strong>Barras de estadísticas</strong> — mostrar/ocultar las barras de progreso en tarjetas</li>
      </ul>

      <h3 class="help-sub">Comportamiento</h3>
      <p>Toggle "Recordar filtros" — restaura la categoría, ordenación y vista al abrir la app. Muestra los filtros guardados actualmente con opción de limpiarlos.</p>

      <h3 class="help-sub">Favoritos</h3>
      <p>Ordenación por defecto · Layout en /favorites (normal/compacto/tabla) · Columnas visibles en vista tabla · Confirmación al quitar · Mostrar gráficos de composición.</p>

      <h3 class="help-sub">Accesibilidad</h3>
      <ul class="help-list">
        <li><strong>Focus ring siempre visible</strong> — muestra el indicador de foco aunque uses ratón</li>
        <li><strong>Anunciar cambios de ruta</strong> — aria-live para lectores de pantalla</li>
        <li><strong>Atajos en tooltips</strong> — mostrar el atajo junto al título del botón</li>
      </ul>

      <h3 class="help-sub">Datos</h3>
      <p>Exportar/importar preferencias (JSON) · Exportar/importar favoritos (JSON) · Información de almacenamiento en KB · Restablecer sección o configuración completa · Eliminar todos los datos.</p>

      <h3 class="help-sub">Los cambios se aplican en tiempo real</h3>
      <p>No hay botón "Guardar". Todos los cambios se escriben automáticamente en localStorage con un debounce de 300 ms.</p>
    `,
  },
  {
    id: 'pwa', icon: '📱', title: 'Instalación como app',
    content: `
      <h3 class="help-sub">¿Qué es una PWA?</h3>
      <p>AeroPedia es una Progressive Web App: instalable como aplicación nativa en Android, iOS, Windows y macOS sin pasar por ninguna tienda de aplicaciones.</p>

      <h3 class="help-sub">Instalar en Android / Chrome escritorio</h3>
      <p>Tras la segunda visita aparecerá un banner de instalación. También puedes usar el menú del navegador → "Instalar AeroPedia" o "Añadir a pantalla de inicio".</p>

      <h3 class="help-sub">Instalar en iPhone / iPad</h3>
      <ol class="help-list help-list--numbered">
        <li>Abre AeroPedia en <strong>Safari</strong> (Chrome en iOS no permite instalar PWA)</li>
        <li>Toca el botón <strong>Compartir</strong> (cuadrado con flecha)</li>
        <li>Selecciona <strong>"Añadir a pantalla de inicio"</strong></li>
        <li>Confirma el nombre y toca <strong>Añadir</strong></li>
      </ol>

      <h3 class="help-sub">Shortcuts en el launcher</h3>
      <p>Al instalar la app, el menú de larga pulsación del icono (Android/escritorio) ofrece accesos directos a <strong>Mis Favoritos</strong>, <strong>Teatro de Operaciones</strong> y <strong>Comparador</strong>.</p>

      <h3 class="help-sub">Uso offline</h3>
      <p>Una vez instalada o tras la primera visita completa, AeroPedia funciona sin conexión. Los datos de 196 aeronaves, 53 conflictos y 83 flotas se cachean automáticamente.</p>

      <h3 class="help-sub">Actualización automática</h3>
      <p>Si hay una nueva versión disponible, aparecerá un toast en la parte superior con botón "Recargar" para aplicar la actualización al instante.</p>
    `,
  },
  {
    id: 'data', icon: '🗃', title: 'Datos y fuentes',
    content: `
      <h3 class="help-sub">Base de datos</h3>
      <p>AeroPedia incluye <strong>196 aeronaves</strong> con una completeness media del <strong>95.5%</strong> en los 16 campos técnicos principales.</p>

      <h3 class="help-sub">Tipos incluidos</h3>
      <div class="help-types-grid">
        ${[
          ['Caza','77'],['Bombardero','23'],['Ataque','18'],['Drone/UAV','12'],
          ['Transporte','13'],['Experimental','12'],['Helicóptero de ataque','7'],
          ['Helicóptero de transporte','9'],['Especial/ISR','7'],['Entrenamiento','7'],
          ['Patrulla marítima','2'],['Guerra electrónica','1'],
        ].map(([t,c]) => `<span class="help-type-chip">${t} <strong>${c}</strong></span>`).join('')}
      </div>

      <h3 class="help-sub">Otros datos</h3>
      <ul class="help-list">
        <li><strong>53 conflictos</strong> — desde la Guerra Civil Española (1936) hasta Ucrania (2022+)</li>
        <li><strong>83 países</strong> con inventarios de flota verificados</li>
        <li><strong>47 aeronaves</strong> con estadísticas de combate (victorias, pérdidas, ratio K/D)</li>
      </ul>

      <h3 class="help-sub">Fuentes verificadas</h3>
      <ul class="help-list">
        <li>Jane's All the World's Aircraft</li>
        <li>Flight International / Flightglobal</li>
        <li>Federation of American Scientists (fas.org)</li>
        <li>Military Balance — IISS</li>
        <li>Documentación oficial de fabricantes</li>
        <li>Wikipedia REST API (extractos en fichas técnicas)</li>
      </ul>

      <h3 class="help-sub">Nota sobre datos clasificados</h3>
      <p>Algunos valores (techo real, RCS exacto, especificaciones de aviónica) están marcados como "clasificados" o "estimado". Para aeronaves muy recientes (J-36, B-21, F-47 NGAD), los datos son aproximaciones basadas en fuentes de análisis de defensa.</p>
    `,
  },
];

export class HelpView {
  #el     = null;
  #active = 'start';

  async render() {
    setPageMeta({
      title:       'Ayuda — AeroPedia',
      description: 'Guía completa: búsqueda avanzada, favoritos, teatro de operaciones, PWA y más.',
    });

    this.#el = document.createElement('div');
    this.#el.className = 'help-view';
    this.#el.innerHTML = this.#template();
    this.#bindEvents();
    this.#showSection('start');
    return this.#el;
  }

  // ── Template ─────────────────────────────────────────────────
  #template() {
    return `
    <div class="help-header">
      <a href="/" data-link class="btn-back">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
          <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/>
        </svg>
        Volver
      </a>
      <div>
        <h1 class="help-title">
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" aria-hidden="true">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
          </svg>
          Ayuda
        </h1>
        <p class="help-subtitle">Guía completa de uso · AeroPedia</p>
      </div>
    </div>

    <div class="help-layout">
      <!-- Sidebar de navegación -->
      <nav class="help-nav" aria-label="Secciones de ayuda">
        ${SECTIONS.map(s => `
          <button class="help-nav-item" data-section="${s.id}" aria-pressed="false">
            <span aria-hidden="true">${s.icon}</span>
            ${s.title}
          </button>`).join('')}
        <div class="help-nav-divider"></div>
        <a href="/settings" data-link class="help-nav-item help-nav-link">
          <span aria-hidden="true">⚙</span>
          Ir a Configuración
          <svg viewBox="0 0 20 20" fill="currentColor" width="11" height="11" style="margin-left:auto;color:var(--text-4)" aria-hidden="true">
            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
          </svg>
        </a>
      </nav>

      <!-- Contenido de la sección -->
      <div class="help-content" id="helpContent" role="region" aria-live="polite"></div>
    </div>

    <!-- Referencia completa de atajos de teclado -->
    <section class="help-shortcuts-ref" aria-labelledby="shortcuts-title">
      <h2 id="shortcuts-title" class="help-section-label">Todos los atajos de teclado</h2>
      <div class="help-shortcuts-grid">
        ${[
          ['/','Enfocar búsqueda'],
          ['G','Vista galería'],
          ['R','Vista ranking'],
          ['F','Filtrar favoritos'],
          ['T','Toggle Timeline'],
          ['H','Panel de recientes'],
          ['D','Cambiar tema (ciclo)'],
          ['S','Estadísticas globales'],
          ['M','Calculadora Mach'],
          ['Ctrl+,','Configuración'],
          ['Esc','Volver / cerrar overlay'],
          ['↑↓','Navegar en favoritos'],
          ['E','Editar favorito'],
          ['P','Pin/unpin favorito'],
          ['C','Añadir al comparador'],
          ['Del','Quitar de favoritos'],
          ['Enter','Abrir ficha de favorito'],
        ].map(([k,d]) => `
          <div class="help-shortcut-item">
            <kbd class="shortcut-key">${k}</kbd>
            <span class="shortcut-desc">${d}</span>
          </div>`).join('')}
      </div>
    </section>`;
  }

  // ── Mostrar sección ────────────────────────────────────────
  #showSection(id) {
    const section = SECTIONS.find(s => s.id === id);
    if (!section) return;
    this.#active = id;

    this.#el?.querySelectorAll('.help-nav-item[data-section]').forEach(btn => {
      const active = btn.dataset.section === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active);
    });

    const content = this.#el?.querySelector('#helpContent');
    if (content) {
      content.innerHTML = `
        <div class="help-section-content" role="article">
          <div class="help-section-header">
            <span class="help-section-icon" aria-hidden="true">${section.icon}</span>
            <h2 class="help-section-title">${section.title}</h2>
          </div>
          <div class="help-section-body">${section.content}</div>
        </div>`;
    }
  }

  // ── Eventos ────────────────────────────────────────────────
  #bindEvents() {
    this.#el?.addEventListener('click', e => {
      const btn = e.target.closest('[data-section]');
      if (btn) this.#showSection(btn.dataset.section);
    });

    this.#el?.querySelector('.help-nav')?.addEventListener('keydown', e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const items = [...this.#el.querySelectorAll('[data-section]')];
      const cur   = items.findIndex(i => i.dataset.section === this.#active);
      const next  = e.key === 'ArrowDown' ? Math.min(cur+1, items.length-1) : Math.max(cur-1, 0);
      items[next]?.click();
      items[next]?.focus();
    });
  }
}
