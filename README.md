# ✈ AeroPedia — Archivo Global de Aviación Militar

Enciclopedia interactiva de **196 aeronaves militares** — fichas técnicas, comparador, teatro de conflictos, estadísticas, historial de combate, calculadora Mach y más. **Zero dependencias externas.** SPA completa con PWA offline.

---

## Inicio rápido

```bash
cd aeropedia/

# Requiere servidor HTTP (ES Modules + Service Worker no funcionan con file://)
npx serve .
# También: python -m http.server 8080  /  php -S localhost:8080

# Abrir: http://localhost:3000
```

---

## Estructura del proyecto

```
aeropedia/
├── index.html              # Entry point — HTML semántico, og:tags, PWA meta
├── main.js                 # Bootstrap: datos, rutas, PWA, atajos globales
├── sw.js                   # Service Worker — offline completo
├── manifest.json           # PWA con shortcuts (Favoritos, Teatro, Comparar)
├── styles.css              # CSS puro — 2450+ líneas, 3 temas, responsive
│
├── store/
│   ├── index.js            # Estado global (Observer Pattern, colecciones, recientes)
│   └── preferences.js      # Preferencias persistidas con esquema versionado v1.2.0
│
├── router/
│   └── index.js            # History API router con lazy loading y scroll-to-top
│
├── utils/
│   ├── index.js            # debounce, Markdown lite, búsqueda avanzada con operadores
│   └── exportImage.js      # Canvas 2D → PNG de colección de favoritos
│
├── components/
│   ├── Header.js           # Nav reactiva (tema, densidad, búsqueda, comparador)
│   ├── Charts.js           # Radar SVG · Bar Canvas · Pie SVG · Gauge SVG · Sparkline
│   └── PWAInstallBanner.js # Banner instalación + iOS guide + update toast
│
├── views/
│   ├── HomeView.js         # Galería + Ranking + Timeline + Búsqueda avanzada + Recientes
│   ├── AircraftDetailView.js # Ficha + Wikipedia + Radar SVG + Combat history
│   ├── CompareView.js      # Comparador hasta 3 (radar chart superpuesto)
│   ├── FavoritesView.js    # Colección + Colecciones + Notas Markdown + Export PNG
│   ├── TheaterView.js      # Mapa SVG interactivo de 53 conflictos
│   ├── StatsView.js        # Estadísticas + histograma de velocidades + records
│   ├── KillsView.js        # Historial de combate con K/D ratios
│   ├── FleetsView.js       # Inventarios de flota por país
│   ├── MachView.js         # Calculadora Mach con modelo ISA
│   ├── SettingsView.js     # 5 secciones con live preview
│   ├── HelpView.js         # Documentación interactiva con sidebar
│   └── SharedView.js       # Colección compartida por URL (solo lectura)
│
└── data/
    ├── aircraft.json       # 196 aeronaves · 95.5% completeness en campos clave
    ├── conflicts.json      # 53 conflictos con coordenadas y metadatos
    ├── fleets.json         # 83 países con inventarios verificados
    └── kills.json          # 47 aeronaves con estadísticas de combate
```

---

## Arquitectura

### Store global — Observer Pattern

```js
// Suscribirse a uno o varios campos
const unsub = store.subscribe(['favs', 'favsMeta'], () => this.#renderStats());

// Actualizar → notifica automáticamente a todos los suscriptores
store.setState({ theme: 'dark' });

// Limpiar al destruir la vista
unsub();
```

### Preferencias persistidas (localStorage)

| Clave | Contenido |
|---|---|
| `aeropedia_prefs` | Tema, densidad, filtros, a11y (esquema v1.2.0) |
| `aeropedia_favs` | `string[]` — IDs en orden |
| `aeropedia_favs_meta` | Nota Markdown, tags, rating 0–5, pinned |
| `aeropedia_collections` | Colecciones con nombre, color, icono |
| `aeropedia_recents` | Últimas 20 aeronaves vistas |

---

## Base de datos

### `aircraft.json` — 196 aeronaves

| Tipo | Cantidad | Ejemplos |
|---|---|---|
| Caza | 77 | F-22, Su-57, J-20, KAAN, J-36, F-47 NGAD |
| Bombardero | 23 | B-21 Raider, Tu-22M3, H-6K |
| Ataque | 18 | Su-34, A-10C, J-16, Jaguar |
| Drone/UAV | 12 | TB2, MQ-9, S-70 Okhotnik, RQ-4 |
| Transporte | 13 | KC-46, An-225, C-17 |
| Experimental | 12 | X-15, B-21, YF-23, NASA X-59 |
| Helicóptero de ataque | 7 | AH-64E, Ka-52M, Mi-28N |
| Helicóptero de transporte | 9 | CH-53K, Mi-26 |
| Especial / ISR | 7 | E-7A Wedgetail, E-4B, SR-71 |
| Entrenamiento | 7 | T-50/FA-50, Yak-130, T-7 Red Hawk |
| Patrulla marítima | 2 | P-8A Poseidon, P-3C Orion |
| Guerra electrónica | 1 | EA-18G Growler |

**Completeness de campos clave:** speed/range/ceiling/mtow/engine/crew/operators/manufacturer (100%) · radar/endurance_h (90%) · combat_history (100%) · units_built (97%) · unit_cost_m (73%)

**Schema completo:** `id` · `name` · `type` · `country` · `year` · `generation` · `speed` · `range` · `ceiling` · `mtow` · `engine` · `thrust_kn` · `wing_span` · `length` · `height` · `wing_area` · `fuel_capacity` · `crew` · `crew_roles` · `combat_radius` · `endurance_h` · `thrust_to_weight` · `wing_loading` · `radar` · `radar_type` (AESA/PESA/mechanical/none) · `irst` · `ew_system` · `data_link` · `helmet_system` · `stealth` (none/low/medium/high) · `carrier_capable` · `stol` · `vtol` · `armament` (gun/hardpoints/missiles/bombs) · `status` · `units_built` · `unit_cost_m` · `operators` · `manufacturer` · `derived_from` · `variants` · `roles` · `tags` · `conflicts` · `combat_history` · `radar_cross_section` · `endurance_h` · `trivia` · `desc` · `wiki`

---

## Rutas

| Ruta | Vista | Atajo |
|---|---|---|
| `/` | Galería + Ranking | — |
| `/aircraft/:id` | Ficha técnica | — |
| `/compare` | Comparador hasta 3 aeronaves | — |
| `/favorites` | Colección personal | — |
| `/theater` | Mapa de conflictos | `T` |
| `/stats` | Estadísticas globales | `S` |
| `/kills` | Historial de combate | — |
| `/fleets` | Flotas por país | — |
| `/mach` | Calculadora Mach | `M` |
| `/settings` | Configuración | `Ctrl+,` |
| `/help` | Documentación | — |
| `/shared?ids=...` | Colección compartida | — |

---

## Búsqueda avanzada

```
tipo:Caza gen:5 país:USA
stealth:alto año:>2010
naval:sí velocidad:>1500
uav:0
estado:active
```

Operadores: `tipo` · `país` · `gen` · `año` · `velocidad` · `estado` · `stealth` · `naval` · `uav`  
Soportan comparadores `>` y `<` para valores numéricos.

---

## Atajos de teclado

| Atajo | Acción |
|---|---|
| `/` | Enfocar búsqueda |
| `G` / `R` | Vista galería / ranking |
| `F` | Filtrar favoritos |
| `T` | Toggle Timeline |
| `H` | Panel de recientes |
| `D` | Cambiar tema |
| `S` | Estadísticas |
| `M` | Calculadora Mach |
| `Ctrl+,` | Configuración |
| `Esc` | Volver / cerrar overlay |
| `↑↓ E P C Del Enter` | Navegar y editar favoritos (en `/favorites`) |

---

## PWA

Service Worker con tres estrategias de caché:
- **Cache-first** — JS, CSS, iconos, vistas
- **Network-first** — JSON de datos (fallback a caché offline)
- **Cache-first con límite** — imágenes WebP (máximo 250)

Instalación iOS: Safari → Compartir → Añadir a pantalla de inicio.  
Shortcuts en launcher de Android/escritorio: Favoritos · Teatro · Comparador.

---

## Accesibilidad

HTML semántico completo · `aria-live` en resultados, sort info, cambios de ruta · `aria-sort` en tabla de ranking · `aria-expanded` en toggles · focus ring configurable · soporte `prefers-reduced-motion` · 3 temas (oscuro, claro, alto contraste WCAG AAA).

---

## Gráficos nativos (sin librerías)

| Gráfico | Tecnología | Dónde |
|---|---|---|
| Radar chart | SVG | Comparador |
| Gauge/Arc | SVG animado | Fichas técnicas |
| Bar chart | Canvas 2D | Stats, favoritos |
| Pie/Donut | SVG | Distribución por tipo |
| Sparkline | Canvas 2D | Calculadora Mach |
| Histograma | Canvas 2D | Distribución velocidades |
| Mapa mundial | SVG | Teatro de operaciones |

---

## Fuentes de datos

Jane's All the World's Aircraft · Flight International · FAS (fas.org) · Military Balance (IISS) · Documentación oficial de fabricantes (Boeing, Lockheed Martin, Sukhoi, AVIC, etc.) · Wikipedia REST API (extractos en fichas)

Los valores marcados como "clasificados" o "estimado" reflejan información no confirmada oficialmente.

---

*AeroPedia · Proyecto educativo · Desarrollado con Claude (Anthropic)*
