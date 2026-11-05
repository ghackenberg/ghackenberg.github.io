# SYSTEM-009: Client-Side Script Deduplication, Declarative Preact/Nanostores Rendering & Zero-`innerHTML` Gate

- **ID:** `SYSTEM-009`
- **Domäne:** `frontend-architecture` / `type-safety` / `security` / `ci`
- **Status:** `implemented`
- **Priorität / Hebel:** `HOCH`
- **Ursprung:** Session 2026-11-05 (Vollständiges Audit aller 49 clientseitigen Skript-Fundstellen)
- **Branch:** `feat/client-script-hardening-and-preact`

---

## 1. Problem & Motivation

Ein vollständiges Audit aller 49 clientseitigen Skripte (`src/commons/client/`, `src/components/`, `src/layouts/`, `src/pages/` und `src/content/visualizations/`) hat vier zentrale strukturelle Schwachstellen offengelegt:

1. **Ungetypte & teils unescapte HTML-String-Konkatenation (`.innerHTML`):**
   An 6 Stellen im Repository werden komplexe UI-Bäume als Template-Literal-Strings zusammengebaut und per `.innerHTML` injiziert:
   - [`src/content/visualizations/vis-network/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/vis-network/engine.ts): Interpoliert `n.name`, `n.description`, `n.image`, `n.tags` und `n.typeLabel` **ohne HTML-Escaping** direkt in `card.innerHTML`.
   - [`src/commons/client/filter.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/filter.ts) & [`src/pages/tags/[tag].astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/tags/%5Btag%5D.astro): Erzeugen Paginierungs-Buttons per `numbersContainer.innerHTML = pageNumbers.map(...).join('')` und überschreiben `.className` komplett mit langen Tailwind-Strings.
   - [`src/components/slides/player/SlideDeck.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/slides/player/SlideDeck.astro): Baut Zitationskarten über ein ~80-zeiliges HTML-Template-Literal (`renderReferenceItem`) für `referencesModalBody.innerHTML` zusammen (inkl. duplizierter `escapeHtml()`-Funktion).
   - [`src/commons/client/dev-sankey.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/dev-sankey.ts): ~600 Zeilen HTML-/SVG-String-Konkatenation (`renderMediaBox`, `renderCenterInspectorCard`, `renderSideNodeCard`, `columnsHtml`, `ribbonsSvgHtml`).
   - [`src/components/dev/AnalyticsDevOverlay.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/dev/AnalyticsDevOverlay.astro): Erzeugt Badge-Container via `document.createElement`, befüllt sie aber per `badge.innerHTML` (inkl. unescaptem `#${id}`).
   - [`src/components/dev/DevStudioShell.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/dev/DevStudioShell.astro): Nutzt `.innerHTML` für SVG-`<stop>`-Knoten, Milestone-Marker und den Loading-State.

2. **Massive Code-Duplizierung in `<script is:inline>`- und Seiten-Skripten:**
   - **7 Katalog-Indexseiten** (`courses`, `posts`, `presentations`, `projects`, `publications`, `visualizations`, `services`) enthalten jeweils ~75 Zeilen copy-pasteten ES5-Code (`<script is:inline>`), um Karten vor dem First Paint anhand von URL-Parametern (`?tag=`, `?q=`, `?page=`, `?lang=`, `?trl=`) zu filtern, plus ein redundantes `has-filter-query`-Snippet (bereits in [`src/layouts/Layout.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/layouts/Layout.astro) vorhanden).
   - **Paginierungs-Logik** (`getPageNumbers` + DOM-Rendering) ist zwischen [`src/commons/client/filter.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/filter.ts) und [`src/pages/tags/[tag].astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/tags/%5Btag%5D.astro) 1:1 dupliziert.
   - **Priority+ Navbar-Messung** ist in [`src/components/Navbar.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/Navbar.astro) doppelt implementiert (einmal als 108-zeiliges ES5-`<script is:inline>`, einmal im TypeScript-`<script>`), ergänzt um einen `cloneNode(true)`-Hack zum Entfernen alter Event-Listener.
   - **Copy-to-Clipboard-Logik** ist vierfach dupliziert ([`src/pages/contact.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/contact.astro), [`src/components/GetInTouchCard.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/GetInTouchCard.astro), [`src/pages/publications/[slug].astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/publications/%5Bslug%5D.astro)) und unterstützt kein `astro:page-load`.

3. **Fehlende deklarative Client-Rendering- & State-Schicht:**
   Verstreute Statusvariablen, `window.*`-Globals und fragile `.className`-Komplettüberschreibungen erschweren die Wartung komplexer Client-Komponenten.

---

## 2. Lösungsarchitektur & Umsetzungsphasen

### Phase 1: Konsolidierung der Code-Duplizierungen (DRY & Modularisierung)
- [x] **1a. Katalog-Pre-Filter konsolidieren:** Extraktion einer zentralen, wiederverwendbaren Astro-Komponente [`src/components/CatalogPreFilter.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/CatalogPreFilter.astro) (bzw. Integration in `FilterToolbar.astro`), die die 7 redundanten ES5-Pre-Filter-Blöcke und die 7 redundanten `has-filter-query`-Gate-Skripte auf allen Katalogseiten ablöst.
- [x] **1b. Gemeinsames Paginierungs-Modul:** Extraktion von `getPageNumbers()` und der Paginierungs-Steuerung in ein gemeinsames Client-Modul unter `src/commons/client/`, genutzt von [`src/commons/client/filter.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/filter.ts) und [`src/pages/tags/[tag].astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/tags/%5Btag%5D.astro).
- [x] **1c. Priority+ Navbar bereinigen:** Zusammenführung der doppelten Priority+-Breitenberechnung in [`src/components/Navbar.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/Navbar.astro) und Ablösung des `cloneNode(true)`-Listener-Resets durch sauberes Event-Binding.
- [x] **1d. Zentraler Clipboard-Controller:** Einführung von [`src/commons/client/clipboard.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/clipboard.ts) mit deklarativem `[data-copy-text]`-Contract und `astro:page-load`-Unterstützung für `contact.astro`, `GetInTouchCard.astro` und `publications/[slug].astro`.

### Phase 2: Deklaratives Client-Rendering mit Preact (`.tsx`) & Nanostores
- [x] **2a. Setup & Tooling (`preact`, `nanostores`, `@nanostores/preact`):**
  - Installation von `preact`, `nanostores` und `@nanostores/preact`.
  - Konfiguration von `tsconfig.json` für Preact-JSX (`"jsxImportSource": "preact"`) unter Beibehaltung von `/** @jsxImportSource react */` in den 4 serverseitigen React-Email-Dateien unter `src/commons/server/email/*.tsx`.
  - Einführung typsicherer Nanostores für geteilten Client-State (z. B. Theme/Privacy-Consent, Filter-/Paginierungs-State).
- [x] **2b. Ablösung aller `.innerHTML`-Stellen durch typsichere Preact-`.tsx`-Komponenten:**
  1. `vis-network` Tooltip (`src/content/visualizations/vis-network/engine.ts` $\rightarrow$ deklarative Preact-Tooltip-Komponente, 100 % XSS-sicher).
  2. Paginierungs-Leiste (`src/commons/client/pagination.tsx` $\rightarrow$ deklarative Preact-Buttons ohne `.innerHTML` und ohne `.className`-Überschreibung).
  3. SlideDeck Zitations-Modal (`src/components/slides/player/SlideDeck.astro` $\rightarrow$ deklarative Preact-Referenzliste).
  4. AnalyticsDevOverlay Badges (`src/components/dev/AnalyticsDevOverlay.astro` $\rightarrow$ deklarative Preact-Badge-Komponente).
  5. DevStudioShell SVG-Stops, Milestones & Loading-State (`src/components/dev/DevStudioShell.astro`).
  6. DevSankey Inspector & Node Cards (`src/commons/client/dev-sankey.ts` $\rightarrow$ deklaratives Preact-JSX für Karten, Tabellen und SVG-Ribbons).

### Phase 3: Harte ESLint- & Architektur-Gates (Zero-`innerHTML` Policy)
- [x] **3a. ESLint-Verbot (`eslint.config.ts`):**
  Verankerung von `no-restricted-properties` (`.innerHTML`, `.outerHTML`) und `no-restricted-syntax` (`insertAdjacentHTML`) als `error` für alle `.ts`, `.tsx` und `.astro` Dateien (unumgehbar durch `'eslint-comments/no-use': 'error'`).
- [x] **3b. Architektur-Linter (`src/scripts/validate-architecture.ts`):**
  Statische Prüfung über alle Dateien in `src/` (inkl. `<script is:inline>`), dass nirgendwo `.innerHTML`, `.outerHTML` oder `insertAdjacentHTML` verwendet wird.
- [x] **3c. Master Verification Gate (`npm run verify`) & Browser-Abnahme:**
  0 Fehler / 0 Warnungen über alle Linter, Typechecks und den Astro-SSG-Build hinweg.

---

## 3. Fortschrittsprotokoll

- **2026-11-05:** Branch `feat/client-script-hardening-and-preact` erstellt, RFC `SYSTEM-009` angelegt und in `backlog/README.md` registriert. Start von Phase 1.
- **2026-11-05:** Phase 1 abgeschlossen (`1a`, `1b`, `1c`, `1d`):
  - `src/components/CatalogPreFilter.astro` eingeführt und die 7 redundanten `has-filter-query` Gate-Skripte sowie die 7 duplizierten ~75-zeiligen Pre-Filter-Blöcke auf allen Katalogseiten (`courses`, `posts`, `presentations`, `projects`, `publications`, `visualizations`, `services`) konsolidiert; `Layout.astro` berücksichtigt nun auch `?lang=` und `?trl=` für `has-filter-query`.
  - `src/commons/client/pagination.ts` (`getPageNumbers`, `renderPaginationControls`, `setupSectionPagination`) erstellt und in `src/commons/client/filter.ts`, `src/pages/tags/[tag].astro` und `src/pages/publications/index.astro` eingebunden.
  - `src/components/Navbar.astro` Priority+-Breitenberechnung in eine zentrale Evaluierungsfunktion (`__evaluateNavbarPriority`) zusammengeführt und den `cloneNode(true)`-Event-Listener-Hack beim Theme-Toggle durch `dataset.themeInitialized`-Guards ersetzt.
  - `src/commons/client/clipboard.ts` eingeführt und `src/pages/contact.astro`, `src/components/GetInTouchCard.astro` sowie `src/pages/publications/[slug].astro` auf den deklarativen `[data-copy-text]`/`[data-copy-target]`-Contract mit `astro:page-load`-Unterstützung umgestellt.
- **2026-11-05:** Phasen 2 & 3 abgeschlossen (`2a`, `2b`, `3a`, `3b`, `3c`):
  - `preact`, `nanostores` und `@nanostores/preact` installiert; `tsconfig.json` auf `"jsxImportSource": "preact"` umgestellt und die 4 serverseitigen React-Email-Templates unter `src/commons/server/email/*.tsx` mit `/** @jsxImportSource react */` annotiert.
  - `src/commons/client/stores.ts` mit typsicheren Nanostores (`$themeSetting`, `$analyticsConsent`, `$paginationPages`, `$devSankeyConfig`) eingeführt und in `Navbar.astro`, `PrivacyModal.astro`, `pagination.tsx` und `dev-sankey.ts` angebunden.
  - Alle 6 komplexen HTML-String-Builder auf deklarative Preact-`.tsx`-Komponenten umgestellt: `src/commons/client/pagination.tsx`, `src/commons/client/vis-tooltip.tsx` (behebt die unescapte HTML-Injektion in `vis-network/engine.ts`), `src/commons/client/slide-references.tsx`, `src/commons/client/dev-overlay-badge.tsx`, `src/commons/client/dev-studio-views.tsx` sowie `src/commons/client/dev-sankey-view.tsx` (~600 Zeilen HTML/SVG-Templates aus `dev-sankey.ts` extrahiert).
  - Triviales Container-Leeren in `src/pages/visualizations/[slug].astro` und `src/pages/index.astro` auf `.replaceChildren()` sowie `style.innerHTML` in `src/commons/server/branding-assets.ts` auf `style.textContent` umgestellt.
  - Harte Zero-`innerHTML`-Gates in `eslint.config.ts` (`no-restricted-properties` für `innerHTML`/`outerHTML`, `no-restricted-syntax` für `insertAdjacentHTML`) und `src/scripts/validate-architecture.ts` (Vollscan über `src/`) verankert.
- **2026-11-05:** Vereinheitlichung der Graph-Hover-Effekte, Preact-Tooltips & Knoten-Größen über alle 5 Visualisierungs-Engines (`vis-network`, `d3`, `cytoscape`, `sigma`, `3d-force`):
  - `src/commons/shared/graph-payload.ts` & `src/pages/visualizations/[slug].astro`: Volle Knoten-Metadaten (`typeLabel`, `description`, `date`, `image`, `tags`, `rawSize`) für alle 5 Engine-Payloads (`vis-network`, `cytoscape`, `d3`, `sigma`, `3d-force`) angereichert.
  - `src/commons/client/vis-tooltip.tsx`: Wiederverwendbaren `createGraphTooltipController(container)` implementiert, der das Preact-basierte `VisNetworkTooltip`-Overlay mit Viewport-Clamping, Domain-Farben (`GRAPH_COLORS`), Typ-Labels (`GRAPH_GROUP_NAMES`) und Theme-Tokens (`getThemeTokens`) für alle Engines kapselt.
  - Hover-Highlighting (Knoten-Akzent, verbundene Kanten mit `0.35`-Opacity, `cursor: pointer`), Preact-Tooltip-Anbindung und UTM-getrackte Klick-Navigation in `d3/engine.ts`, `cytoscape/engine.ts`, `sigma/engine.ts` und `3d-force/engine.ts` harmonisiert.
  - `3d-force/engine.ts`, `cytoscape/engine.ts` & `sigma/engine.ts`: Mount-Reihenfolge von `createGraphTooltipController(container)` auf **nach** der Initialisierung von `ForceGraph3D()(container)`, `cytoscape({...})` bzw. `new Sigma(...)` verlegt, damit Kapsule/Three.js das `.vis-tooltip`-DOM-Element beim Mounten von `.scene-container` nicht aus dem Container entfernt; außerdem `pointermove`/`mousemove`-Tracking im Capture-Modus (`{ capture: true, passive: true }`) und Ausblenden von `.scene-tooltip` ergänzt.
  - Einheitliche Knoten-Skalierung über alle 5 Visualisierungen: Tag-spezifische Größenskalierung (`Math.log(count) + 1`, quadratisches `nodeValue`-Scaling in `vis-network`, Gruppen-Ternaries in `cytoscapeElements` und `sigmaNodes`) entfernt, sodass alle Knoten (Tags und Content-Items) in sämtlichen 5 Engines exakt gleich groß dargestellt werden.
