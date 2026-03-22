import { useState, useEffect, useCallback } from "react";

// ── Datos del roadmap ────────────────────────────────────────────
const PHASES = [
  {
    id: "p1",
    phase: "Fase 1",
    label: "Fundación de Preferencias",
    color: "#3b82f6",
    eta: "1–2 días",
    icon: "⚙",
    features: [
      {
        id: "p1-f1",
        title: "PreferencesManager",
        file: "store/preferences.js",
        priority: "crítico",
        effort: "M",
        description: "Módulo dedicado al manejo de preferencias del usuario separado del store global. Gestiona carga, guardado y migración de versiones en localStorage.",
        details: [
          "Clave: aeropedia_prefs (objeto versionado con semver)",
          "Persistencia automática en cada cambio con debounce 300ms",
          "Migración de esquema al detectar versión antigua",
          "Exportar / importar preferencias como JSON",
          "Reset a valores por defecto por sección o total",
          "Escucha storage events para sincronizar entre pestañas",
        ],
        lsKey: "aeropedia_prefs",
      },
      {
        id: "p1-f2",
        title: "Preferencias de visualización",
        file: "store/preferences.js → display",
        priority: "crítico",
        effort: "S",
        description: "Persistir todas las decisiones visuales del usuario entre sesiones.",
        details: [
          "theme: 'dark' | 'light' | 'high-contrast'",
          "view: 'gallery' | 'ranking' — última vista usada",
          "cardDensity: 'compact' | 'normal' | 'large'",
          "galleryColumns: 'auto' | 2 | 3 | 4",
          "animationsEnabled: boolean — reducir movimiento",
          "fontScale: 0.9 | 1 | 1.1 | 1.2 — accesibilidad",
        ],
        lsKey: "aeropedia_prefs.display",
      },
      {
        id: "p1-f3",
        title: "Preferencias de filtros",
        file: "store/preferences.js → filters",
        priority: "alto",
        effort: "S",
        description: "Recordar los últimos filtros activos y restaurarlos al regresar.",
        details: [
          "lastCat: última categoría seleccionada",
          "lastSortStat + lastSortAsc: último orden del ranking",
          "rememberFilters: boolean — activar/desactivar restauración",
          "defaultView: vista preferida al arrancar",
          "timelineDefaults: rango min/max guardado",
        ],
        lsKey: "aeropedia_prefs.filters",
      },
    ],
  },
  {
    id: "p2",
    phase: "Fase 2",
    label: "UI de Preferencias",
    color: "#8b5cf6",
    eta: "2–3 días",
    icon: "🎛",
    features: [
      {
        id: "p2-f1",
        title: "Panel de Configuración (/settings)",
        file: "views/SettingsView.js",
        priority: "alto",
        effort: "L",
        description: "Vista dedicada con todas las preferencias organizadas en secciones con aplicación en tiempo real.",
        details: [
          "Ruta: /settings con lazy import",
          "Sección Apariencia: tema, densidad, columnas, escala",
          "Sección Comportamiento: filtros recordados, animaciones",
          "Sección Colecciones: gestión completa de favoritos",
          "Sección Datos: exportar/importar JSON, limpiar caché",
          "Preview en vivo de cambios antes de confirmar",
          "Botón 'Restablecer sección' y 'Restablecer todo'",
        ],
        lsKey: null,
      },
      {
        id: "p2-f2",
        title: "Densidad de tarjetas dinámica",
        file: "views/HomeView.js + styles.css",
        priority: "medio",
        effort: "S",
        description: "Aplicar cardDensity desde preferencias usando clases CSS en el gallery-grid.",
        details: [
          ".gallery-grid[data-density='compact'] → minmax(220px,1fr)",
          ".gallery-grid[data-density='large'] → minmax(360px,1fr)",
          "Persistido en preferencias, aplicado en mount de HomeView",
          "Toggle rápido en el header (3 iconos compacto/normal/grande)",
        ],
        lsKey: "aeropedia_prefs.display.cardDensity",
      },
      {
        id: "p2-f3",
        title: "Reducir movimiento (prefers-reduced-motion)",
        file: "styles.css + PreferencesManager",
        priority: "medio",
        effort: "S",
        description: "Respetar la preferencia del OS y permitir override manual.",
        details: [
          "Leer prefers-reduced-motion al inicio",
          "Si está activo, desactivar animaciones CSS por defecto",
          "Opción manual en Settings para override del usuario",
          "@media (prefers-reduced-motion) ya en el CSS",
          "Persistir override en aeropedia_prefs.display.animationsEnabled",
        ],
        lsKey: "aeropedia_prefs.display.animationsEnabled",
      },
    ],
  },
  {
    id: "p3",
    phase: "Fase 3",
    label: "Colecciones de Favoritos",
    color: "#f59e0b",
    eta: "3–4 días",
    icon: "📁",
    features: [
      {
        id: "p3-f1",
        title: "Sistema de Colecciones",
        file: "store/index.js → collections",
        priority: "alto",
        effort: "L",
        description: "Agrupar favoritos en colecciones/listas nombradas y con color propio.",
        details: [
          "Estructura: collections: Record<id, {name, color, icon, ids[]}>",
          "Persistido en aeropedia_favs_collections",
          "Un favorito puede pertenecer a varias colecciones",
          "CRUD completo: crear, renombrar, colorear, eliminar",
          "Colecciones por defecto: 'Sin colección'",
          "Filtro lateral por colección en FavoritesView",
        ],
        lsKey: "aeropedia_favs_collections",
      },
      {
        id: "p3-f2",
        title: "Vista de colección individual",
        file: "views/FavoritesView.js",
        priority: "medio",
        effort: "M",
        description: "Panel lateral o subruta que muestra solo los favoritos de una colección.",
        details: [
          "URL: /favorites?collection=<id>",
          "Sidebar con lista de colecciones + conteo",
          "Drag & drop entre colecciones",
          "Barra de progreso: colección vs total de favoritos",
          "Renombrar colección con doble clic",
        ],
        lsKey: null,
      },
      {
        id: "p3-f3",
        title: "Compartir colección via URL",
        file: "utils/share.js",
        priority: "bajo",
        effort: "S",
        description: "Codificar los IDs de una colección en la URL para compartir sin backend.",
        details: [
          "URL: /shared?ids=f22,su57,mig29 (base64 comprimido)",
          "Vista de solo lectura con botón 'Añadir a mis favoritos'",
          "Web Share API con fallback a clipboard",
          "No requiere autenticación ni servidor",
        ],
        lsKey: null,
      },
    ],
  },
  {
    id: "p4",
    phase: "Fase 4",
    label: "Teatro & Visualización",
    color: "#06b6d4",
    eta: "3–5 días",
    icon: "🗺",
    features: [
      {
        id: "p4-f1",
        title: "Vista Teatro de Operaciones (/theater)",
        file: "views/TheaterView.js",
        priority: "alto",
        effort: "L",
        description: "Mapa interactivo SVG de conflictos mundiales con aeronaves participantes.",
        details: [
          "Mapa SVG mundial simplificado (sin dependencias externas)",
          "Puntos de conflicto clicables por zona geográfica",
          "Panel lateral: aeronaves del conflicto seleccionado",
          "Filtro por era (WWII, Guerra Fría, Moderno)",
          "Timeline deslizable para ver conflictos por año",
          "Último conflicto seleccionado guardado en preferencias",
        ],
        lsKey: "aeropedia_prefs.theater.lastConflict",
      },
      {
        id: "p4-f2",
        title: "Gráficos de composición de favoritos",
        file: "components/Charts.js + FavoritesView.js",
        priority: "medio",
        effort: "M",
        description: "Visualización estadística de la colección personal con pie chart y bar chart nativos.",
        details: [
          "Pie chart: distribución por tipo de aeronave",
          "Bar chart: distribución por generación",
          "Bar chart: distribución por país de origen",
          "Sparkline de velocidades máximas de favoritos",
          "Sección 'Mis estadísticas' en FavoritesView",
        ],
        lsKey: null,
      },
      {
        id: "p4-f3",
        title: "Tabla comparativa de favoritos",
        file: "views/FavoritesView.js",
        priority: "bajo",
        effort: "M",
        description: "Vista de tabla tipo ranking pero solo con tus favoritos y columnas elegidas.",
        details: [
          "Toggle de columnas visibles: velocidad, alcance, techo, MTOW, T/W",
          "Columnas elegidas persistidas en preferencias",
          "Resaltado del mejor valor por columna en tu colección",
          "Exportar tabla como CSV",
        ],
        lsKey: "aeropedia_prefs.favs.tableColumns",
      },
    ],
  },
  {
    id: "p5",
    phase: "Fase 5",
    label: "PWA & Offline",
    color: "#10b981",
    eta: "2–3 días",
    icon: "📱",
    features: [
      {
        id: "p5-f1",
        title: "Service Worker con caché offline",
        file: "sw.js",
        priority: "alto",
        effort: "M",
        description: "Caché de assets estáticos y datos JSON para uso offline completo.",
        details: [
          "Cache-first para assets: JS, CSS, iconos",
          "Network-first con fallback para los JSON de datos",
          "Versión de caché en constante — invalidar al actualizar",
          "Notificación de nueva versión disponible (toast)",
          "Indicador offline en el header si no hay red",
        ],
        lsKey: null,
      },
      {
        id: "p5-f2",
        title: "Banner de instalación PWA",
        file: "components/PWAInstallBanner.js",
        priority: "medio",
        effort: "S",
        description: "Banner inteligente que aparece después de 2 visitas y no es intrusivo.",
        details: [
          "Mostrar tras 2ª visita (conteo en localStorage)",
          "Dismiss persistido: no volver a mostrar si se rechaza",
          "Soporte beforeinstallprompt + iOS fallback",
          "Preferencia: aeropedia_prefs.pwa.installDismissed",
          "Botón en Settings para reintentar instalación",
        ],
        lsKey: "aeropedia_prefs.pwa.installDismissed",
      },
      {
        id: "p5-f3",
        title: "Sincronización multi-pestaña",
        file: "store/index.js",
        priority: "bajo",
        effort: "S",
        description: "Los favoritos y preferencias se sincronizan entre pestañas del mismo navegador.",
        details: [
          "storage event listener en Store para detectar cambios externos",
          "Reconciliar favs y favsMeta sin sobrescribir la más reciente",
          "Toast suave: 'Tus favoritos se actualizaron en otra pestaña'",
          "Solo sync de favs y prefs, no del estado de UI",
        ],
        lsKey: null,
      },
    ],
  },
  {
    id: "p6",
    phase: "Fase 6",
    label: "Accesibilidad & Pulido",
    color: "#f472b6",
    eta: "2–3 días",
    icon: "♿",
    features: [
      {
        id: "p6-f1",
        title: "Anuncios de ruta para lectores de pantalla",
        file: "router/index.js + index.html",
        priority: "alto",
        effort: "S",
        description: "aria-live region que anuncia cada cambio de vista para usuarios de screen readers.",
        details: [
          "<div aria-live='polite' aria-atomic='true' id='route-announcer'> en index.html",
          "Actualizar con el título de la nueva ruta en cada navegación",
          "Visualmente oculto con .sr-only",
          "Anuncio en español: 'Navegando a: Mis Favoritos'",
        ],
        lsKey: null,
      },
      {
        id: "p6-f2",
        title: "Tema de alto contraste",
        file: "styles.css + PreferencesManager",
        priority: "medio",
        effort: "M",
        description: "Tercer tema diseñado para accesibilidad visual con contrastes WCAG AAA.",
        details: [
          "[data-theme='high-contrast'] con ratios > 7:1",
          "Fondo negro puro, texto blanco puro, bordes visibles",
          "Sin gradientes — solo colores sólidos",
          "Opción en Settings y en el toggle del header",
          "Persistido en aeropedia_prefs.display.theme",
        ],
        lsKey: "aeropedia_prefs.display.theme",
      },
      {
        id: "p6-f3",
        title: "Atajos de teclado en favoritos",
        file: "views/FavoritesView.js",
        priority: "bajo",
        effort: "S",
        description: "Navegación completa por teclado en la vista de favoritos.",
        details: [
          "P → pin/unpin de la tarjeta enfocada",
          "E → abrir modal de edición",
          "Del → quitar de favoritos (con confirmación)",
          "C → añadir al comparador",
          "↑↓ → navegar entre tarjetas",
          "Panel de ayuda actualizado con nuevos atajos",
        ],
        lsKey: null,
      },
    ],
  },
];

const PRIORITY_STYLES = {
  crítico: { bg: "rgba(239,68,68,0.12)", color: "#f87171", border: "rgba(239,68,68,0.3)" },
  alto:    { bg: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "rgba(245,158,11,0.3)" },
  medio:   { bg: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "rgba(59,130,246,0.3)" },
  bajo:    { bg: "rgba(100,116,139,0.12)", color: "#94a3b8", border: "rgba(100,116,139,0.3)" },
};

const EFFORT_LABEL = { S: "Pequeño", M: "Medio", L: "Grande" };

const LS_KEY = "aeropedia_roadmap_state";

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { done: {}, expanded: {}, activePhase: null, view: "board" };
    return JSON.parse(raw);
  } catch { return { done: {}, expanded: {}, activePhase: null, view: "board" }; }
}

function saveState(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
}

// ── Componente principal ─────────────────────────────────────────
export default function RoadmapApp() {
  const [state, setStateRaw] = useState(loadState);

  const setState = useCallback((patch) => {
    setStateRaw(prev => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      saveState(next);
      return next;
    });
  }, []);

  const toggleDone    = (id)   => setState(s => ({ ...s, done: { ...s.done, [id]: !s.done[id] } }));
  const toggleExpand  = (id)   => setState(s => ({ ...s, expanded: { ...s.expanded, [id]: !s.expanded[id] } }));
  const setPhase      = (id)   => setState(s => ({ ...s, activePhase: s.activePhase === id ? null : id }));
  const setView       = (v)    => setState(s => ({ ...s, view: v }));
  const resetAll      = ()     => { const fresh = { done: {}, expanded: {}, activePhase: null, view: state.view }; saveState(fresh); setStateRaw(fresh); };

  const totalFeatures = PHASES.flatMap(p => p.features).length;
  const doneCount     = Object.values(state.done).filter(Boolean).length;
  const pct           = Math.round((doneCount / totalFeatures) * 100);

  const visiblePhases = state.activePhase
    ? PHASES.filter(p => p.id === state.activePhase)
    : PHASES;

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.headerTitle}>
            <span style={{ fontSize: "1.3rem" }}>✈</span>
            <h1 style={S.title}>AeroPedia — Roadmap</h1>
          </div>
          <p style={S.subtitle}>Plan de desarrollo con preferencias persistentes</p>
        </div>
        <div style={S.headerRight}>
          <div style={S.viewToggle}>
            {["board", "list"].map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{ ...S.viewBtn, ...(state.view === v ? S.viewBtnActive : {}) }}>
                {v === "board" ? "⊞ Tablero" : "≡ Lista"}
              </button>
            ))}
          </div>
          <button onClick={resetAll} style={S.resetBtn} title="Reiniciar progreso">↺ Reset</button>
        </div>
      </div>

      {/* Progreso global */}
      <div style={S.progressCard}>
        <div style={S.progressTop}>
          <span style={S.progressLabel}>Progreso total</span>
          <span style={S.progressPct}>{doneCount} / {totalFeatures} características</span>
        </div>
        <div style={S.progressTrack}>
          <div style={{ ...S.progressFill, width: `${pct}%` }} />
        </div>
        <div style={S.progressPhases}>
          {PHASES.map(p => {
            const phaseDone = p.features.filter(f => state.done[f.id]).length;
            const complete  = phaseDone === p.features.length;
            return (
              <button key={p.id} onClick={() => setPhase(p.id)}
                style={{ ...S.phaseChip, borderColor: state.activePhase === p.id ? p.color : "transparent", background: state.activePhase === p.id ? p.color + "22" : "rgba(255,255,255,0.04)" }}>
                <span style={{ color: p.color }}>{p.icon}</span>
                <span style={{ color: complete ? p.color : "#64748b", fontSize: ".65rem" }}>
                  {p.phase} {phaseDone}/{p.features.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Vista tablero / lista */}
      {state.view === "board" ? (
        <div style={S.board}>
          {visiblePhases.map(phase => (
            <PhaseCard key={phase.id} phase={phase} state={state}
              toggleDone={toggleDone} toggleExpand={toggleExpand} />
          ))}
        </div>
      ) : (
        <ListView phases={visiblePhases} state={state} toggleDone={toggleDone} toggleExpand={toggleExpand} />
      )}

      {/* Footer */}
      <div style={S.footer}>
        <span style={{ color: "#334155" }}>Guardado automáticamente en</span>
        <code style={S.lsKey}>localStorage → {LS_KEY}</code>
      </div>
    </div>
  );
}

// ── Phase Card (vista tablero) ───────────────────────────────────
function PhaseCard({ phase, state, toggleDone, toggleExpand }) {
  const done    = phase.features.filter(f => state.done[f.id]).length;
  const all     = phase.features.length;
  const complete = done === all;

  return (
    <div style={{ ...S.phaseCard, borderTopColor: phase.color }}>
      <div style={S.phaseHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
          <span style={{ fontSize: "1.1rem" }}>{phase.icon}</span>
          <div>
            <div style={{ ...S.phaseLabel, color: phase.color }}>{phase.phase}</div>
            <div style={S.phaseName}>{phase.label}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ ...S.phaseEta, color: phase.color }}>{phase.eta}</div>
          <div style={{ ...S.phaseDoneCount, color: complete ? phase.color : "#64748b" }}>
            {done}/{all} {complete && "✓"}
          </div>
        </div>
      </div>

      <div style={S.phaseMiniBar}>
        <div style={{ ...S.phaseMiniBarFill, width: `${(done/all)*100}%`, background: phase.color }} />
      </div>

      <div style={S.featureList}>
        {phase.features.map(f => (
          <FeatureItem key={f.id} feature={f} phase={phase}
            done={!!state.done[f.id]} expanded={!!state.expanded[f.id]}
            onToggleDone={() => toggleDone(f.id)} onToggleExpand={() => toggleExpand(f.id)} />
        ))}
      </div>
    </div>
  );
}

// ── Feature Item ─────────────────────────────────────────────────
function FeatureItem({ feature: f, phase, done, expanded, onToggleDone, onToggleExpand }) {
  const pr = PRIORITY_STYLES[f.priority] || PRIORITY_STYLES.bajo;

  return (
    <div style={{ ...S.featureItem, opacity: done ? .55 : 1, borderColor: done ? phase.color + "44" : "rgba(255,255,255,0.06)" }}>
      <div style={S.featureRow}>
        <button onClick={onToggleDone} style={{ ...S.checkbox, borderColor: done ? phase.color : "#334155", background: done ? phase.color : "transparent" }}
          aria-label={done ? "Marcar como pendiente" : "Marcar como hecho"}>
          {done && <span style={{ color: "#fff", fontSize: ".75rem", lineHeight: 1 }}>✓</span>}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: ".4rem", flexWrap: "wrap" }}>
            <span style={{ ...S.featureTitle, textDecoration: done ? "line-through" : "none" }}>{f.title}</span>
            <span style={{ ...S.badge, background: pr.bg, color: pr.color, borderColor: pr.border }}>{f.priority}</span>
            <span style={{ ...S.badge, background: "rgba(255,255,255,0.04)", color: "#475569", borderColor: "rgba(255,255,255,0.06)" }}>{EFFORT_LABEL[f.effort]}</span>
          </div>
          <div style={S.featureFile}>{f.file}</div>
          <div style={S.featureDesc}>{f.description}</div>
        </div>
        <button onClick={onToggleExpand} style={S.expandBtn} aria-label={expanded ? "Colapsar" : "Expandir"}>
          <span style={{ transition: "transform .2s", display: "block", transform: expanded ? "rotate(180deg)" : "none" }}>▾</span>
        </button>
      </div>

      {expanded && (
        <div style={S.featureDetails}>
          <div style={S.detailsHeader}>Detalles de implementación</div>
          <ul style={S.detailsList}>
            {f.details.map((d, i) => <li key={i} style={S.detailItem}>{d}</li>)}
          </ul>
          {f.lsKey && (
            <div style={S.lsKeyWrap}>
              <span style={S.lsKeyLabel}>localStorage:</span>
              <code style={S.lsKey}>{f.lsKey}</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Vista Lista ──────────────────────────────────────────────────
function ListView({ phases, state, toggleDone, toggleExpand }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}>
      {phases.flatMap(phase =>
        phase.features.map(f => (
          <div key={f.id} style={{ display: "flex", gap: ".75rem", alignItems: "flex-start", ...S.featureItem, padding: ".65rem .85rem" }}>
            <button onClick={() => toggleDone(f.id)}
              style={{ ...S.checkbox, marginTop: "2px", flexShrink: 0, borderColor: state.done[f.id] ? phase.color : "#334155", background: state.done[f.id] ? phase.color : "transparent" }}>
              {state.done[f.id] && <span style={{ color: "#fff", fontSize: ".75rem" }}>✓</span>}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: ".35rem" }}>
                <span style={{ ...S.phaseLabel, color: phase.color, fontSize: ".6rem" }}>{phase.phase}</span>
                <span style={{ ...S.featureTitle, opacity: state.done[f.id] ? .4 : 1, textDecoration: state.done[f.id] ? "line-through" : "none" }}>{f.title}</span>
              </div>
              <div style={S.featureFile}>{f.file}</div>
            </div>
            <div style={{ display: "flex", gap: ".35rem", alignItems: "center", flexShrink: 0 }}>
              {(() => { const pr = PRIORITY_STYLES[f.priority]; return <span style={{ ...S.badge, background: pr.bg, color: pr.color, borderColor: pr.border }}>{f.priority}</span>; })()}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const S = {
  root: {
    fontFamily: "'Inter', system-ui, sans-serif",
    background: "#060a14",
    color: "#e2e8f0",
    minHeight: "100vh",
    padding: "1.5rem 1rem",
    maxWidth: "960px",
    margin: "0 auto",
    fontSize: "14px",
  },
  header: {
    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
    flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem",
  },
  headerTitle: { display: "flex", alignItems: "center", gap: ".55rem", marginBottom: ".2rem" },
  headerRight: { display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" },
  title: { fontFamily: "'Orbitron', monospace", fontSize: "1.1rem", fontWeight: 900, letterSpacing: ".08em", color: "#f1f5f9", margin: 0 },
  subtitle: { fontSize: ".72rem", color: "#475569", margin: 0, marginTop: ".15rem" },

  viewToggle: { display: "flex", borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" },
  viewBtn: { padding: ".35rem .75rem", fontSize: ".72rem", background: "transparent", border: "none", color: "#64748b", cursor: "pointer" },
  viewBtnActive: { background: "rgba(59,130,246,.15)", color: "#3b82f6" },
  resetBtn: { padding: ".35rem .7rem", fontSize: ".72rem", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: "6px", color: "#64748b", cursor: "pointer" },

  progressCard: {
    background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)",
    borderRadius: "14px", padding: "1rem 1.1rem", marginBottom: "1.25rem",
  },
  progressTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".55rem" },
  progressLabel: { fontSize: ".7rem", color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em" },
  progressPct: { fontFamily: "'JetBrains Mono', monospace", fontSize: ".78rem", color: "#3b82f6", fontWeight: 600 },
  progressTrack: { height: "5px", background: "rgba(255,255,255,.06)", borderRadius: "3px", overflow: "hidden", marginBottom: ".75rem" },
  progressFill: { height: "100%", background: "linear-gradient(90deg,#2563eb,#7c3aed)", borderRadius: "3px", transition: "width .5s ease" },
  progressPhases: { display: "flex", flexWrap: "wrap", gap: ".35rem" },
  phaseChip: { display: "flex", alignItems: "center", gap: ".3rem", padding: ".2rem .55rem", borderRadius: "999px", border: "1px solid", cursor: "pointer", fontSize: ".65rem" },

  board: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "1rem" },

  phaseCard: {
    background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)",
    borderTop: "3px solid", borderRadius: "14px", padding: "1rem",
    display: "flex", flexDirection: "column", gap: ".75rem",
  },
  phaseHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  phaseLabel: { fontSize: ".62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em" },
  phaseName: { fontSize: ".82rem", fontWeight: 600, color: "#cbd5e1", marginTop: ".08rem" },
  phaseEta: { fontSize: ".65rem", fontFamily: "monospace" },
  phaseDoneCount: { fontSize: ".72rem", fontWeight: 600, marginTop: ".1rem" },
  phaseMiniBar: { height: "3px", background: "rgba(255,255,255,.06)", borderRadius: "2px", overflow: "hidden" },
  phaseMiniBarFill: { height: "100%", borderRadius: "2px", transition: "width .4s ease" },
  featureList: { display: "flex", flexDirection: "column", gap: ".4rem" },

  featureItem: {
    border: "1px solid",
    borderRadius: "8px", padding: ".55rem .65rem",
    transition: "opacity .2s, border-color .2s",
  },
  featureRow: { display: "flex", gap: ".55rem", alignItems: "flex-start" },
  checkbox: {
    width: "18px", height: "18px", borderRadius: "4px", border: "2px solid",
    flexShrink: 0, display: "grid", placeItems: "center", cursor: "pointer",
    transition: "all .15s", marginTop: "1px",
  },
  featureTitle: { fontSize: ".78rem", fontWeight: 600, color: "#e2e8f0" },
  featureFile: { fontFamily: "monospace", fontSize: ".62rem", color: "#3b82f6", marginTop: ".18rem", wordBreak: "break-all" },
  featureDesc: { fontSize: ".72rem", color: "#64748b", marginTop: ".25rem", lineHeight: 1.55 },
  expandBtn: { background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: ".85rem", padding: "0 2px", flexShrink: 0 },
  badge: { fontSize: ".58rem", padding: ".1rem .38rem", borderRadius: "999px", border: "1px solid", fontWeight: 600, letterSpacing: ".04em", whiteSpace: "nowrap" },

  featureDetails: {
    marginTop: ".55rem", paddingTop: ".55rem", borderTop: "1px solid rgba(255,255,255,.06)",
  },
  detailsHeader: { fontSize: ".62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "#475569", marginBottom: ".38rem" },
  detailsList: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: ".28rem" },
  detailItem: { fontSize: ".72rem", color: "#94a3b8", display: "flex", alignItems: "flex-start", gap: ".4rem", lineHeight: 1.5 },
  lsKeyWrap: { display: "flex", alignItems: "center", gap: ".4rem", marginTop: ".5rem" },
  lsKeyLabel: { fontSize: ".62rem", color: "#475569" },
  lsKey: { fontFamily: "monospace", fontSize: ".68rem", color: "#22d3ee", background: "rgba(34,211,238,.08)", padding: ".1rem .38rem", borderRadius: "4px" },

  footer: { marginTop: "2rem", display: "flex", alignItems: "center", gap: ".5rem", justifyContent: "center", fontSize: ".68rem", color: "#1e293b" },
};
