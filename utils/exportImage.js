/**
 * utils/exportImage.js — Exportar colección de favoritos como imagen PNG
 * Renderiza tarjetas en un Canvas 2D sin dependencias externas.
 */

import { FALLBACK_IMG } from './index.js';

const CARD_W    = 320;
const CARD_H    = 140;
const CARD_GAP  = 12;
const COLS      = 3;
const PAD       = 20;
const HEADER_H  = 72;
const FOOTER_H  = 36;

/**
 * @param {Array<{plane, meta}>} items — resultado de store.getFilteredFavs()
 * @param {{ dark: boolean, title: string }} options
 * @returns {Promise<string>} — data URL PNG
 */
export async function exportFavsAsImage(items, options = {}) {
  const { dark = true, title = 'Mis Favoritos — AeroPedia' } = options;

  const cols    = Math.min(COLS, items.length || 1);
  const rows    = Math.ceil(items.length / cols);
  const W       = cols * CARD_W + (cols - 1) * CARD_GAP + PAD * 2;
  const H       = HEADER_H + rows * CARD_H + (rows - 1) * CARD_GAP + PAD * 2 + FOOTER_H;

  const canvas  = document.createElement('canvas');
  const dpr     = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  const ctx     = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Colores
  const BG      = dark ? '#090d1a' : '#f8fafc';
  const CARD_BG = dark ? '#0f1729' : '#ffffff';
  const BORDER  = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const TEXT1   = dark ? '#f1f5f9' : '#0f172a';
  const TEXT2   = dark ? '#94a3b8' : '#64748b';
  const ACCENT  = '#3b82f6';
  const STAR    = '#f59e0b';
  const FONT    = 'system-ui, -apple-system, sans-serif';

  // ── Fondo ──────────────────────────────────────────────────────
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Patrón de puntos sutil
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.02)';
  for (let x = 0; x < W; x += 28) {
    for (let y = 0; y < H; y += 28) {
      ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── Header ─────────────────────────────────────────────────────
  // Línea de acento
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, ACCENT); grad.addColorStop(1, '#8b5cf6');
  ctx.fillStyle = grad;
  ctx.fillRect(PAD, PAD, W - PAD * 2, 3);

  // Logo + título
  ctx.font = `900 18px Orbitron, ${FONT}`;
  ctx.fillStyle = TEXT1;
  ctx.fillText('AERO', PAD, PAD + 36);
  ctx.fillStyle = ACCENT;
  const aeroW = ctx.measureText('AERO').width;
  ctx.fillText('PEDIA', PAD + aeroW, PAD + 36);

  ctx.font = `400 12px ${FONT}`;
  ctx.fillStyle = TEXT2;
  ctx.fillText(title, PAD, PAD + 56);

  // Contador
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = ACCENT;
  ctx.textAlign = 'right';
  ctx.fillText(`${items.length} aeronaves`, W - PAD, PAD + 36);
  ctx.textAlign = 'left';

  // ── Cargar imágenes ────────────────────────────────────────────
  const images = await Promise.all(
    items.map(({ plane }) =>
      loadImage(`./public/min/${plane.img?.[0] ?? plane.img}.webp`).catch(() => null)
    )
  );

  // ── Tarjetas ───────────────────────────────────────────────────
  const TYPE_COLORS = {
    'Caza': '#3b82f6', 'Bombardero': '#ef4444', 'Ataque': '#f59e0b',
    'Transporte': '#8b5cf6', 'Especial': '#06b6d4', 'Experimental': '#f472b6',
  };

  items.forEach(({ plane: p, meta }, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x   = PAD + col * (CARD_W + CARD_GAP);
    const y   = HEADER_H + PAD + row * (CARD_H + CARD_GAP);
    const typeColor = TYPE_COLORS[p.type] || '#64748b';

    // Sombra
    ctx.shadowColor = dark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.15)';
    ctx.shadowBlur  = 16; ctx.shadowOffsetY = 4;

    // Fondo de card
    ctx.fillStyle = CARD_BG;
    roundRect(ctx, x, y, CARD_W, CARD_H, 10);
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    // Borde de card
    ctx.strokeStyle = BORDER; ctx.lineWidth = 1;
    roundRect(ctx, x, y, CARD_W, CARD_H, 10);
    ctx.stroke();

    // Borde color por tipo (izquierda)
    ctx.fillStyle = typeColor;
    roundRect(ctx, x, y, 3, CARD_H, [10, 0, 0, 10]);
    ctx.fill();

    // Imagen
    const IMG_W = 90, IMG_H = CARD_H - 20;
    const imgX  = x + 10, imgY = y + 10;
    ctx.save();
    roundRect(ctx, imgX, imgY, IMG_W, IMG_H, 6); ctx.clip();
    ctx.fillStyle = dark ? '#1a2744' : '#e2e8f0';
    ctx.fillRect(imgX, imgY, IMG_W, IMG_H);
    if (images[i]) {
      ctx.drawImage(images[i], imgX, imgY, IMG_W, IMG_H);
    }
    ctx.restore();

    // Nombre
    const textX = imgX + IMG_W + 10;
    const maxW  = CARD_W - IMG_W - 26;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = TEXT1;
    const name = truncate(ctx, p.name, maxW);
    ctx.fillText(name, textX, y + 24);

    // País · año
    ctx.font = `400 10px ${FONT}`;
    ctx.fillStyle = TEXT2;
    ctx.fillText(`${p.country} · ${p.year}`, textX, y + 40);

    // Badge de tipo
    ctx.font = `600 9px ${FONT}`;
    ctx.fillStyle = typeColor;
    ctx.fillText(p.type.toUpperCase(), textX, y + 56);

    // Stats
    const statY = y + 74;
    const stats = [
      { label: '⚡', val: `${p.speed.toLocaleString('es-ES')}km/h`, color: '#3b82f6' },
      { label: '📡', val: `${(p.ceiling/1000).toFixed(0)}km alt.`, color: '#06b6d4' },
      { label: '🗺', val: `${p.range.toLocaleString('es-ES')}km`,   color: '#8b5cf6' },
    ];
    stats.forEach((s, si) => {
      const sx = textX + si * (maxW / 3);
      ctx.font = `500 9px ${FONT}`;
      ctx.fillStyle = s.color;
      ctx.fillText(s.label + ' ' + s.val, sx, statY);
    });

    // Rating
    if (meta?.rating) {
      const stars = '★'.repeat(meta.rating) + '☆'.repeat(5 - meta.rating);
      ctx.font = `400 11px ${FONT}`;
      ctx.fillStyle = STAR;
      ctx.fillText(stars, textX, y + CARD_H - 14);
    }

    // Tags
    if (meta?.tags?.length) {
      const tagsY = y + CARD_H - 14;
      let tagsX   = meta?.rating ? textX + 72 : textX;
      ctx.font = `400 9px ${FONT}`;
      ctx.fillStyle = TEXT2;
      for (const tag of meta.tags.slice(0, 3)) {
        ctx.fillText(`#${tag}`, tagsX, tagsY);
        tagsX += ctx.measureText(`#${tag} `).width + 4;
        if (tagsX > x + CARD_W - 10) break;
      }
    }
  });

  // ── Footer ─────────────────────────────────────────────────────
  const footerY = H - FOOTER_H;
  ctx.fillStyle = BORDER;
  ctx.fillRect(PAD, footerY, W - PAD * 2, 1);

  ctx.font = `400 10px ${FONT}`;
  ctx.fillStyle = TEXT2;
  ctx.fillText('aeropedia.app', PAD, footerY + 22);
  ctx.textAlign = 'right';
  ctx.fillText(new Date().toLocaleDateString('es-ES'), W - PAD, footerY + 22);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png', 0.92);
}

// ── Helpers ────────────────────────────────────────────────────
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar: ${src}`));
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  const radii = Array.isArray(r) ? r : [r, r, r, r];
  ctx.beginPath();
  ctx.moveTo(x + radii[0], y);
  ctx.lineTo(x + w - radii[1], y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radii[1]);
  ctx.lineTo(x + w, y + h - radii[2]);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radii[2], y + h);
  ctx.lineTo(x + radii[3], y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radii[3]);
  ctx.lineTo(x, y + radii[0]);
  ctx.quadraticCurveTo(x, y, x + radii[0], y);
  ctx.closePath();
}

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 3 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}
