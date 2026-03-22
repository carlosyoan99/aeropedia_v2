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
├── index.html              # Entry point
├── 404.html                # GitHub Pages SPA redirect
├── main.js                 # Bootstrap: datos, rutas, PWA, atajos globales
├── sw.js                   # Service Worker — offline completo
├── manifest.json           # PWA con shortcuts
├── styles.css              # CSS puro — ~2650 líneas, 3 temas, responsive
│
├── store/
│   ├── index.js            # Estado global (Observer Pattern) con igualdad en setState
│   └── preferences.js      # Preferencias persistidas con esquema versionado v1.2.0
│
├── router/
│   └── index.js            # History API router con basePath para GitHub Pages
│
├── utils/
│   ├── index.js            # debounce, Markdown lite, búsqueda avanzada, FALLBACK_IMG SVG
│   └── exportImage.js      # Canvas 2D → PNG de colección favoritos
│
├── components/
│   ├── Header.js           # Nav fija — SOLO navegación + tema + hamburger mobile
│   ├── Charts.js           # Radar · Bar · Pie · Gauge · Sparkline (SVG/Canvas nativos)
│   └── PWAInstallBanner.js # Banner instalación + iOS guide + update toast
│
├── views/
│   ├── HomeView.js         # Archivo: galería + ranking + búsqueda + filtros + timeline
│   ├── AircraftDetailView.js # Ficha + fav button + Web Share API + Wikipedia + Radar SVG
│   ├── CompareView.js      # Comparador hasta 3 aeronaves
│   ├── FavoritesView.js    # Colección + colecciones + notas Markdown + export PNG
│   ├── TheaterView.js      # Mapa SVG interactivo de 53 conflictos
│   ├── StatsView.js        # Estadísticas + histograma velocidades + records
│   ├── KillsView.js        # Historial de combate con K/D ratios
│   ├── FleetsView.js       # Inventarios de flota por país
│   ├── MachView.js         # Calculadora Mach + recientes de sesión
│   ├── SettingsView.js     # 5 secciones con live preview
│   ├── HelpView.js         # Documentación interactiva con sidebar
│   └── SharedView.js       # Colección compartida por URL
│
└── data/
    ├── aircraft.json       # 196 aeronaves · 95%+ completeness
    ├── conflicts.json      # 53 conflictos
    ├── fleets.json         # 83 países
    └── kills.json          # 47 aeronaves con estadísticas de combate
```

---

## Header — solo navegación

El header es **fijo** (`position: fixed`) y contiene únicamente:
- Logo
- Links de navegación (Archivo, Comparar, Combate, Flotas, Mach, Teatro, Favoritos, Stats)
- Badge del comparador (aparece solo cuando hay items)
- Toggle de tema (dark → light → high-contrast)
- Ayuda y Configuración
- Botón hamburger (solo mobile, <768px)

**Los controles de contexto** (búsqueda, filtros, densidad, vista galería/ranking) están dentro de cada página, no en el header.

### Mobile hamburger
El botón ☰ abre un drawer lateral desde la izquierda que parte desde debajo del header fijo. Se cierra con Escape, haciendo clic fuera, o al navegar a una página.

---

## Arquitectura

### Store global con igualdad en setState

```js
// setState solo notifica si el valor realmente cambia
store.setState({ search: 'F-22' });  // notifica
store.setState({ search: 'F-22' });  // NO notifica — mismo valor

// Suscribirse
const unsub = store.subscribe(['favs', 'favsMeta'], () => this.#render());
unsub(); // limpiar
```

### Render optimizado en HomeView

La galería compara los IDs de las tarjetas actuales con los nuevos antes de reconstruir el DOM. Si la lista de aeronaves no cambió (solo cambiaron estados de fav/compare), solo actualiza los botones sin reemplazar el HTML.

El ranking tiene un `data-sortKey` + `data-rowIds` para evitar rebuild cuando nada relevante cambió.

---

## Base de datos

### `aircraft.json` — 196 aeronaves

| Tipo | Cantidad |
|---|---|
| Caza | 77 |
| Bombardero | 23 |
| Ataque | 18 |
| Drone/UAV | 12 |
| Transporte | 13 |
| Experimental | 12 |
| Helicóptero de ataque | 7 |
| Helicóptero de transporte | 9 |
| Especial/ISR | 7 |
| Entrenamiento | 7 |
| Patrulla marítima | 2 |
| Guerra electrónica | 1 |

El campo `combat_history` incluye ahora notas detalladas verificadas para todos los aviones que han participado en conflictos documentados.

---

## Rutas

| Ruta | Vista | Atajo |
|---|---|---|
| `/` | Galería + Ranking | — |
| `/aircraft/:id` | Ficha técnica | — |
| `/compare` | Comparador | — |
| `/favorites` | Colección | — |
| `/theater` | Mapa de conflictos | `T` |
| `/stats` | Estadísticas | `S` |
| `/kills` | Historial | — |
| `/fleets` | Flotas | — |
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
f35               ← busca también por ID interno
```

---

## Atajos de teclado

| Atajo | Acción |
|---|---|
| `/` | Enfocar búsqueda (desde la página de Archivo) |
| `G` / `R` | Vista galería / ranking |
| `F` | Toggle favoritos |
| `T` | Toggle Timeline |
| `H` | Panel de recientes |
| `D` | Cambiar tema |
| `S` | Estadísticas |
| `M` | Calculadora Mach |
| `Ctrl+,` | Configuración |
| `Esc` | Volver / cerrar overlay |

---

## GitHub Pages

Para desplegar en `username.github.io/repo-name`:

1. Subir todos los archivos al repositorio
2. Activar Pages desde rama `main` / carpeta raíz
3. El `404.html` incluido gestiona el redirect de rutas profundas
4. El router detecta automáticamente el prefijo del repositorio

---

## PWA

- **Cache-first**: JS, CSS, iconos, vistas principales
- **Network-first**: JSON de datos (con fallback offline)
- **Shortcuts en launcher**: Favoritos · Teatro · Comparador

Instalación iOS: Safari → Compartir → Añadir a pantalla de inicio.

---

## Temas

| Tema | Descripción |
|---|---|
| **Oscuro** (defecto) | Fondo #090d1a |
| **Claro** | Fondo #f8fafc |
| **Alto contraste** | Negro puro #000, bordes blancos 60%, texto #fff, links #4d9fff — completamente distinto al tema oscuro |

Cambiar con `D` o en Settings → Apariencia.

---

*AeroPedia · Proyecto educativo · Zero dependencias externas*
