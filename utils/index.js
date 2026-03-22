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

export const FALLBACK_IMG = './public/No-Image-Placeholder.png';
