/**
 * utils/index.js — Utilidades puras sin dependencias externas
 */

// ── DEBOUNCE NATIVO ────────────────────────────────────────────
/**
 * Crea una función debounced que retrasa la invocación hasta pasado `delay` ms.
 * @param {Function} fn
 * @param {number} delay - ms
 * @param {boolean} immediate - Ejecutar en el leading edge
 * @returns {Function & { cancel: Function, flush: Function }}
 */
export function debounce(fn, delay, immediate = false) {
  let timeoutId = null;
  let lastArgs = null;
  let lastThis = null;

  const debounced = function (...args) {
    lastArgs = args;
    lastThis = this;

    const callNow = immediate && !timeoutId;

    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (!immediate && lastArgs) {
        fn.apply(lastThis, lastArgs);
        lastArgs = null;
        lastThis = null;
      }
    }, delay);

    if (callNow) {
      fn.apply(lastThis, lastArgs);
      lastArgs = null;
      lastThis = null;
    }
  };

  /** Cancela el timeout pendiente sin ejecutar */
  debounced.cancel = () => {
    clearTimeout(timeoutId);
    timeoutId = null;
    lastArgs = null;
    lastThis = null;
  };

  /** Ejecuta inmediatamente si hay un call pendiente */
  debounced.flush = () => {
    if (timeoutId && lastArgs) {
      clearTimeout(timeoutId);
      fn.apply(lastThis, lastArgs);
      timeoutId = null;
      lastArgs = null;
      lastThis = null;
    }
  };

  return debounced;
}

// ── THROTTLE ───────────────────────────────────────────────────
export function throttle(fn, limit) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      return fn.apply(this, args);
    }
  };
}

// ── VELOCIDAD DEL SONIDO (modelo ISA) ─────────────────────────
export function speedOfSound(altMeters) {
  if (altMeters <= 11000) {
    const T = 288.15 - 0.0065 * altMeters;
    return 331.3 * Math.sqrt(T / 273.15) * 3.6;
  }
  return 1062.5; // km/h sobre troposfera
}

// ── FORMATTERS ────────────────────────────────────────────────
export function formatNumber(n, decimals = 0, suffix = '') {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('es-ES', { maximumFractionDigits: decimals }) + suffix;
}

export function formatStat(key, value) {
  if (value === null || value === undefined) return '—';
  const map = {
    speed:   v => `${formatNumber(v)} km/h`,
    range:   v => `${formatNumber(v)} km`,
    ceiling: v => `${formatNumber(v)} m`,
    mtow:    v => `${formatNumber(v / 1000, 1)} T`,
    year:    v => String(v),
  };
  return (map[key] || (v => String(v)))(value);
}

export function val(v, fallback = '—') {
  return (v === null || v === undefined || v === '') ? fallback : String(v);
}

// ── GENERACIÓN BADGE HTML ──────────────────────────────────────
export function genBadgeHTML(plane) {
  if (!plane.generation) return '';
  const map = {
    '1ª':   ['gen-1',  'Gen 1ª'],
    '2ª':   ['gen-2',  'Gen 2ª'],
    '3ª':   ['gen-3',  'Gen 3ª'],
    '4ª':   ['gen-4',  'Gen 4ª'],
    '4.5ª': ['gen-45', 'Gen 4.5ª'],
    '5ª':   ['gen-5',  '✦ Gen 5ª'],
    '6ª':   ['gen-6',  '◈ Gen 6ª'],
  };
  const g = map[plane.generation];
  return g ? `<span class="gen-badge ${g[0]}">${g[1]}</span>` : '';
}

// ── META SEO DINÁMICO ──────────────────────────────────────────
export function setPageMeta({ title, description, image } = {}) {
  if (title) document.title = title;

  const setMeta = (name, content) => {
    if (!content) return;
    let el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      const attr = name.startsWith('og:') ? 'property' : 'name';
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setMeta('description', description);
  setMeta('og:title', title);
  setMeta('og:description', description);
  if (image) setMeta('og:image', image);
}

// ── DOM HELPERS ────────────────────────────────────────────────
export function el(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') element.className = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      element.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'dataset') {
      Object.assign(element.dataset, v);
    } else {
      element.setAttribute(k, v);
    }
  }
  for (const child of children.flat()) {
    if (typeof child === 'string') element.appendChild(document.createTextNode(child));
    else if (child instanceof Node) element.appendChild(child);
  }
  return element;
}

export function html(strings, ...values) {
  return strings.reduce((acc, str, i) => {
    const val = values[i - 1];
    const safe = val === null || val === undefined ? '' : String(val);
    return acc + safe + str;
  });
}

// ── LAZY IMAGE OBSERVER ────────────────────────────────────────
let _lazyObserver = null;

export function lazyLoad(container = document) {
  if (!('IntersectionObserver' in window)) return;

  if (!_lazyObserver) {
    _lazyObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const img = entry.target;
        const src = img.dataset.src;
        if (src) {
          img.src = src;
          img.removeAttribute('data-src');
        }
        _lazyObserver.unobserve(img);
      }
    }, { rootMargin: '200px' });
  }

  container.querySelectorAll('img[data-src]').forEach(img => _lazyObserver.observe(img));
}

// ── CLIPBOARD ─────────────────────────────────────────────────
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return true;
  }
}

// ── TOAST ──────────────────────────────────────────────────────
export function showToast(message, duration = 2500) {
  const existing = document.getElementById('global-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'global-toast';
  toast.className = 'toast';
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `<span>${message}</span>`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// ── SEARCH ────────────────────────────────────────────────────
/**
 * Búsqueda client-side fuzzy simple sobre un array de objetos.
 * @param {any[]} data
 * @param {string} query
 * @param {string[]} fields - Campos a buscar
 */
export function search(data, query, fields) {
  if (!query) return data;
  const q = query.toLowerCase().trim();
  return data.filter(item => fields.some(f => {
    const v = item[f];
    return v && String(v).toLowerCase().includes(q);
  }));
}

// ── STATS META ────────────────────────────────────────────────
export const STAT_META = {
  speed:   { label: 'Velocidad Máx.',     unit: 'km/h', max: 8000,   color: '#3b82f6' },
  range:   { label: 'Rango Operativo',    unit: 'km',   max: 15000,  color: '#8b5cf6' },
  ceiling: { label: 'Techo de Servicio',  unit: 'm',    max: 30000,  color: '#06b6d4' },
  mtow:    { label: 'Peso Máx. Despegue', unit: 'kg',   max: 420000, color: '#f59e0b' },
};

export const FALLBACK_IMG = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="280" height="158" viewBox="0 0 280 158"><rect width="280" height="158" fill="#1a2744"/><text x="140" y="72" font-family="system-ui" font-size="28" fill="#2a3f6f" text-anchor="middle">✈</text><text x="140" y="100" font-family="system-ui" font-size="11" fill="#3a5080" text-anchor="middle">Sin imagen</text></svg>`);

// ── BÚSQUEDA AVANZADA CON OPERADORES ─────────────────────────
/**
 * Parsea una query con operadores tipo `país:USA generación:5 tipo:Caza`
 * Operadores soportados: país/country, tipo/type, gen/generación, estado/status,
 *   año/year, velocidad/speed, stealth, naval, uav, g4/g5
 * Texto sin operador → búsqueda libre en nombre, país, fabricante.
 *
 * @param {string} raw — query cruda del usuario
 * @returns {{ terms: string, filters: Record<string, string> }}
 */
export function parseAdvancedQuery(raw) {
  if (!raw?.trim()) return { terms: '', filters: {} };

  const OPERATOR_MAP = {
    'país': 'country', 'pais': 'country', 'country': 'country',
    'tipo': 'type',    'type': 'type',
    'gen': 'generation', 'generación': 'generation', 'generacion': 'generation', 'generation': 'generation',
    'estado': 'status', 'status': 'status',
    'año': 'year', 'anio': 'year', 'year': 'year',
    'velocidad': 'speed', 'speed': 'speed',
    'stealth': 'stealth',
    'naval': 'carrier_capable',
    'uav': 'crew',
    'piloto': 'crew',
  };

  const filters  = {};
  const freeParts = [];

  // Tokenizar respetando comillas
  const tokens = raw.match(/\S+:"[^"]+"|[^\s]+/g) || [];

  for (const token of tokens) {
    const colonIdx = token.indexOf(':');
    if (colonIdx > 0) {
      const rawKey = token.slice(0, colonIdx).toLowerCase();
      const rawVal = token.slice(colonIdx + 1).replace(/^"|"$/g, '').toLowerCase();
      const mappedKey = OPERATOR_MAP[rawKey];
      if (mappedKey) { filters[mappedKey] = rawVal; continue; }
    }
    freeParts.push(token);
  }

  return { terms: freeParts.join(' '), filters };
}

/**
 * Aplica la query avanzada a un plano.
 * @param {object} plane
 * @param {{ terms: string, filters: Record<string, string> }} parsed
 * @returns {boolean}
 */
export function matchAdvancedQuery(plane, parsed) {
  const { terms, filters } = parsed;

  // Filtros de operadores
  for (const [key, val] of Object.entries(filters)) {
    switch (key) {
      case 'country': {
        if (!plane.country.toLowerCase().includes(val)) return false;
        break;
      }
      case 'type': {
        if (!plane.type.toLowerCase().includes(val)) return false;
        break;
      }
      case 'generation': {
        const g = (plane.generation || '').toLowerCase().replace('ª', '').replace('.', '');
        const v = val.replace('ª', '').replace('gen', '').trim();
        if (!g.includes(v)) return false;
        break;
      }
      case 'status': {
        if (plane.status !== val && !plane.status?.toLowerCase().includes(val)) return false;
        break;
      }
      case 'year': {
        const [op, num] = val.match(/^([<>]?)(\d+)$/)?.slice(1) || [];
        if (!num) break;
        const n = parseInt(num);
        if (op === '<' && !(plane.year < n)) return false;
        if (op === '>' && !(plane.year > n)) return false;
        if (!op && plane.year !== n) return false;
        break;
      }
      case 'speed': {
        const [op, num] = val.match(/^([<>]?)(\d+)$/)?.slice(1) || [];
        if (!num) break;
        const n = parseInt(num);
        if (op === '<' && !(plane.speed < n)) return false;
        if (op === '>' && !(plane.speed > n)) return false;
        if (!op && plane.speed !== n) return false;
        break;
      }
      case 'stealth': {
        if (val === 'sí' || val === 'si' || val === 'yes' || val === 'true') {
          if (plane.stealth === 'none' || !plane.stealth) return false;
        } else if (val === 'alto' || val === 'high') {
          if (plane.stealth !== 'high') return false;
        } else if (val === 'medio' || val === 'medium') {
          if (plane.stealth !== 'medium') return false;
        }
        break;
      }
      case 'carrier_capable': {
        if (val === 'sí' || val === 'si' || val === 'yes') {
          if (!plane.carrier_capable) return false;
        }
        break;
      }
      case 'crew': {
        if (val === '0' || val === 'uav') {
          if (plane.crew !== 0) return false;
        } else {
          const n = parseInt(val);
          if (!isNaN(n) && plane.crew !== n) return false;
        }
        break;
      }
    }
  }

  // Búsqueda libre en texto
  if (terms.trim()) {
    const q = terms.toLowerCase();
    const haystack = [
      plane.name, plane.country, plane.type,
      plane.manufacturer || '', plane.engine || '',
      ...(plane.tags || []), ...(plane.roles || []),
    ].join(' ').toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  return true;
}

/**
 * Tokeniza la query e identifica qué operadores se están usando (para hints en la UI).
 */
export function getQueryHints(raw) {
  if (!raw?.trim()) return null;
  const parsed = parseAdvancedQuery(raw);
  if (!Object.keys(parsed.filters).length) return null;
  return Object.entries(parsed.filters).map(([k, v]) => `${k}: "${v}"`).join(' · ');
}

// ── RENDER MARKDOWN LITE ──────────────────────────────────────
/**
 * Convierte Markdown básico a HTML seguro (sin XSS).
 * Soporta: **negrita**, *cursiva*, `código`, - lista, > cita, \n párrafo.
 */
export function renderMarkdown(text) {
  if (!text) return '';

  // Escapar HTML primero
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const lines = escaped.split('\n');
  const result = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) { result.push('<ul class="md-list">'); inList = true; }
      result.push(`<li class="md-li">${inlineMarkdown(trimmed.slice(2))}</li>`);
    } else {
      if (inList) { result.push('</ul>'); inList = false; }
      if (!trimmed) {
        result.push('<br>');
      } else if (trimmed.startsWith('&gt; ')) {
        result.push(`<blockquote class="md-blockquote">${inlineMarkdown(trimmed.slice(5))}</blockquote>`);
      } else {
        result.push(`<span class="md-p">${inlineMarkdown(trimmed)}</span><br>`);
      }
    }
  }
  if (inList) result.push('</ul>');

  return result.join('');
}

function inlineMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="md-code">$1</code>');
}

// ── Breadcrumbs ────────────────────────────────────────────────
const BREADCRUMB_MAP = {
  '/':         null,               // home has no crumbs
  '/compare':  [{ label: 'Comparar' }],
  '/favorites':[{ label: 'Favoritos' }],
  '/theater':  [{ label: 'Teatro de Operaciones' }],
  '/stats':    [{ label: 'Estadísticas' }],
  '/kills':    [{ label: 'Historial de Combate' }],
  '/fleets':   [{ label: 'Flotas' }],
  '/mach':     [{ label: 'Calculadora Mach' }],
  '/settings': [{ label: 'Configuración' }],
  '/help':     [{ label: 'Ayuda' }],
  '/shared':   [{ label: 'Colección compartida' }],
};

export function buildBreadcrumb(route, extra) {
  // extra = { label: 'F-22 Raptor' } for aircraft detail pages
  const home = { href: '/', label: 'Archivo' };
  let crumbs = BREADCRUMB_MAP[route];

  if (!crumbs && route.startsWith('/aircraft/')) {
    crumbs = [{ href: null, label: extra?.label || 'Ficha técnica' }];
  }
  if (!crumbs) return '';

  const items = [home, ...crumbs.map((c, i) => ({
    ...c,
    active: i === crumbs.length - 1 && !extra,
  }))];
  if (extra) items.push({ label: extra.label, active: true });

  return `<nav class="breadcrumb" aria-label="Ubicación">
    ${items.map((item, i) => `
      <span class="breadcrumb-item ${item.active ? 'active' : ''}">
        ${i > 0 ? '<span class="breadcrumb-sep" aria-hidden="true">›</span>' : ''}
        ${item.href && !item.active
          ? `<a href="${item.href}" data-link>${item.label}</a>`
          : `<span ${item.active ? 'aria-current="page"' : ''}>${item.label}</span>`}
      </span>`).join('')}
  </nav>`;
}
