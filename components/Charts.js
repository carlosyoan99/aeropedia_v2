/**
 * components/Charts.js — Gráficos ligeros con SVG/Canvas nativos
 * Sin ninguna librería externa.
 */

// ── RADAR CHART (SVG) ──────────────────────────────────────────
/**
 * @param {HTMLElement} container
 * @param {Array<{label: string, value: number, max: number, color: string}>} axes
 * @param {object[]} datasets - [{label, color, values: number[0..1]}]
 * @param {object} options
 */
export function drawRadarChart(container, datasets, axes, options = {}) {
  const {
    size = 280,
    levels = 5,
    labelOffset = 24,
    fillOpacity = 0.2,
    strokeWidth = 2,
    darkMode = document.body.classList.contains('dark'),
  } = options;

  const cx = size / 2;
  const cy = size / 2;
  const radius = (size / 2) - labelOffset - 10;
  const n = axes.length;
  const angle = (2 * Math.PI) / n;

  const gridColor = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const textColor = darkMode ? '#94a3b8' : '#64748b';

  // Calcular punto en el polígono
  const point = (i, r) => ({
    x: cx + r * Math.sin(i * angle - Math.PI / 2),
    y: cy - r * Math.cos(i * angle - Math.PI / 2),
  });

  let svg = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"
    role="img" aria-label="Gráfico radar de comparación" xmlns="http://www.w3.org/2000/svg">`;

  // Capas de fondo
  for (let l = 1; l <= levels; l++) {
    const r = (radius / levels) * l;
    const pts = Array.from({ length: n }, (_, i) => {
      const p = point(i, r);
      return `${p.x},${p.y}`;
    }).join(' ');
    svg += `<polygon points="${pts}" fill="none" stroke="${gridColor}" stroke-width="1"/>`;
  }

  // Ejes radiales + etiquetas
  for (let i = 0; i < n; i++) {
    const outer = point(i, radius);
    const center = { x: cx, y: cy };
    svg += `<line x1="${center.x}" y1="${center.y}" x2="${outer.x}" y2="${outer.y}"
      stroke="${gridColor}" stroke-width="1"/>`;

    const lp = point(i, radius + labelOffset);
    const anchor = lp.x < cx - 5 ? 'end' : lp.x > cx + 5 ? 'start' : 'middle';
    svg += `<text x="${lp.x}" y="${lp.y + 4}" fill="${textColor}"
      font-size="9" text-anchor="${anchor}" font-family="monospace">${axes[i].label}</text>`;
  }

  // Datasets
  for (const ds of datasets) {
    const pts = ds.values.map((v, i) => {
      const r = Math.max(0, Math.min(1, v)) * radius;
      const p = point(i, r);
      return `${p.x},${p.y}`;
    }).join(' ');

    svg += `<polygon points="${pts}"
      fill="${ds.color}" fill-opacity="${fillOpacity}"
      stroke="${ds.color}" stroke-width="${strokeWidth}"
      stroke-linejoin="round"/>`;

    // Puntos en vértices
    for (let i = 0; i < ds.values.length; i++) {
      const r = Math.max(0, Math.min(1, ds.values[i])) * radius;
      const p = point(i, r);
      svg += `<circle cx="${p.x}" cy="${p.y}" r="3.5"
        fill="${ds.color}" stroke="${darkMode ? '#1e293b' : '#fff'}" stroke-width="1.5"/>`;
    }
  }

  svg += '</svg>';
  container.innerHTML = svg;
}

// ── BAR CHART (Canvas) ─────────────────────────────────────────
/**
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{label: string, value: number}>} data
 * @param {object} options
 */
export function drawBarChart(canvas, data, options = {}) {
  const {
    color = '#3b82f6',
    backgroundColor = 'transparent',
    darkMode = document.body.classList.contains('dark'),
    unit = '',
    horizontal = false,
    animated = true,
  } = options;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 400;
  const H = canvas.offsetHeight || 220;

  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const textColor = darkMode ? '#94a3b8' : '#64748b';
  const gridColor = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const padding = { top: 20, right: 16, bottom: 40, left: 52 };

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, W, H);

  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;
  const barW = (chartW / data.length) * 0.65;
  const barGap = (chartW / data.length) * 0.35;

  // Líneas de grilla
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + chartH - (chartH / 4) * i;
    ctx.beginPath();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.stroke();

    // Etiqueta eje Y
    const label = Math.round((maxVal / 4) * i).toLocaleString('es-ES');
    ctx.fillStyle = textColor;
    ctx.font = `9px monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(label, padding.left - 6, y + 3);
  }

  // Barras con animación opcional
  let progress = animated ? 0 : 1;
  const draw = () => {
    ctx.clearRect(padding.left, padding.top, chartW, chartH + 1);

    // Redibujar grilla en área de barras
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + chartH - (chartH / 4) * i;
      ctx.beginPath();
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();
    }

    data.forEach((d, i) => {
      const x = padding.left + (chartW / data.length) * i + barGap / 2;
      const pct = (d.value / maxVal) * progress;
      const bH = pct * chartH;
      const y = padding.top + chartH - bH;

      // Sombra bajo la barra
      ctx.shadowColor = color + '44';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;

      // Barra con gradiente
      const grad = ctx.createLinearGradient(x, y, x, y + bH);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color + '88');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, bH, [3, 3, 0, 0]);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Etiqueta eje X
      ctx.fillStyle = textColor;
      ctx.font = `9px monospace`;
      ctx.textAlign = 'center';
      const label = d.label.length > 8 ? d.label.slice(0, 8) + '…' : d.label;
      ctx.fillText(label, x + barW / 2, H - padding.bottom + 14);

      // Valor encima (solo si está cerca del tope)
      if (progress > 0.9 && pct > 0.15) {
        ctx.fillStyle = color;
        ctx.font = `bold 8px monospace`;
        ctx.fillText(d.value.toLocaleString('es-ES') + unit, x + barW / 2, y - 5);
      }
    });

    if (animated && progress < 1) {
      progress = Math.min(1, progress + 0.05);
      requestAnimationFrame(draw);
    }
  };

  draw();
}

// ── SPARKLINE (Canvas) ─────────────────────────────────────────
export function drawSparkline(canvas, values, color = '#3b82f6') {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const min = Math.min(...values);
  const max = Math.max(...values) || 1;

  ctx.clearRect(0, 0, W, H);

  const pad = 3;
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
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

// ── GAUGE (SVG) ────────────────────────────────────────────────
export function drawGauge(container, value, max, options = {}) {
  const {
    size = 120,
    color = '#3b82f6',
    label = '',
    unit = '',
    darkMode = document.body.classList.contains('dark'),
  } = options;

  const pct = Math.min(value / max, 1);
  const r = 42;
  const cx = size / 2;
  const cy = size / 2 + 8;
  const startAngle = -Math.PI * 0.75;
  const endAngle = Math.PI * 0.75;
  const totalAngle = endAngle - startAngle;
  const currentAngle = startAngle + totalAngle * pct;

  const polarToCartesian = (angle) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });

  const arcPath = (start, end, r) => {
    const s = polarToCartesian(start);
    const e = polarToCartesian(end);
    const large = Math.abs(end - start) > Math.PI ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const trackColor = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textC = darkMode ? '#e2e8f0' : '#1e293b';
  const subC = darkMode ? '#64748b' : '#94a3b8';

  const formatted = value >= 1000
    ? `${(value / 1000).toFixed(1)}k`
    : String(Math.round(value));

  container.innerHTML = `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"
      role="img" aria-label="${label}: ${formatted} ${unit}" xmlns="http://www.w3.org/2000/svg">
      <path d="${arcPath(startAngle, endAngle, r)}"
        fill="none" stroke="${trackColor}" stroke-width="6" stroke-linecap="round"/>
      <path d="${arcPath(startAngle, currentAngle, r)}"
        fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round">
        <animate attributeName="stroke-dasharray"
          from="0 ${r * totalAngle}"
          to="${r * totalAngle * pct} ${r * totalAngle}"
          dur="0.8s" fill="freeze"/>
      </path>
      <text x="${cx}" y="${cy - 2}" text-anchor="middle"
        fill="${textC}" font-size="13" font-weight="700" font-family="monospace">${formatted}</text>
      <text x="${cx}" y="${cy + 11}" text-anchor="middle"
        fill="${subC}" font-size="8" font-family="monospace">${unit}</text>
      <text x="${cx}" y="${size - 8}" text-anchor="middle"
        fill="${subC}" font-size="8" font-family="monospace" text-transform="uppercase">${label}</text>
    </svg>`;
}

// ── PIE CHART (SVG) ────────────────────────────────────────────
export function drawPieChart(container, segments, options = {}) {
  const {
    size = 160,
    innerRadius = 45,
    darkMode = document.body.classList.contains('dark'),
  } = options;

  const cx = size / 2;
  const cy = size / 2;
  const r = (size / 2) - 4;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;

  let startAngle = -Math.PI / 2;
  let paths = '';

  for (const seg of segments) {
    const slice = (seg.value / total) * 2 * Math.PI;
    const endAngle = startAngle + slice;
    const large = slice > Math.PI ? 1 : 0;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);

    let d;
    if (innerRadius > 0) {
      const ix1 = cx + innerRadius * Math.cos(startAngle);
      const iy1 = cy + innerRadius * Math.sin(startAngle);
      const ix2 = cx + innerRadius * Math.cos(endAngle);
      const iy2 = cy + innerRadius * Math.sin(endAngle);
      d = `M ${ix1} ${iy1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${large} 0 ${ix1} ${iy1}`;
    } else {
      d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    }

    paths += `<path d="${d}" fill="${seg.color}" stroke="${darkMode ? '#0f172a' : '#fff'}" stroke-width="1.5">
      <title>${seg.label}: ${seg.value}</title>
    </path>`;

    startAngle = endAngle;
  }

  const textC = darkMode ? '#e2e8f0' : '#1e293b';
  const subC = darkMode ? '#64748b' : '#94a3b8';

  container.innerHTML = `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"
      role="img" aria-label="Gráfico de distribución" xmlns="http://www.w3.org/2000/svg">
      ${paths}
      ${innerRadius > 0 ? `
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="${textC}" font-size="13" font-weight="700" font-family="monospace">${total.toLocaleString('es-ES')}</text>
        <text x="${cx}" y="${cy + 11}" text-anchor="middle" fill="${subC}" font-size="8" font-family="monospace">TOTAL</text>
      ` : ''}
    </svg>`;
}
