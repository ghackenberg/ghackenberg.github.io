# CONTENT-001: 5 Graph-Engines auf demselben Wissensgraphen: WebGL vs. Canvas 2D vs. SVG, Build-zu-Client-Solver-Parität und 60-FPS-Interaktion im Praxis-Benchmark

- **ID:** `CONTENT-001`
- **Typ:** `post`
- **Status:** `idea`
- **Sprache:** `de`
- **Priorität / Hebel:** `HOCH`
- **Datum der Erfassung:** `2026-11-10`

---

## 1. Kernthese & Leitfrage

- **Leitfrage:** Wie verhalten sich fünf grundverschiedene Web-Graph-Bibliotheken (`Cytoscape.js`, `Sigma.js`, `D3.js`, `Vis.js` und `3D Force Graph / Three.js`) auf exakt demselben realen Wissensgraphen (~350 Knoten, ~1.100 TF-IDF-spezifitätsgewichtete Kanten) — warum driften vorberechnete Build-Layouts und interaktive Browser-Physik in der Praxis fast immer lautlos auseinander, und welche konkreten Engineering-Eingriffe sind nötig, um über alle fünf Rendering-Pipelines hinweg 100 % Solver-Parität sowie stabile 60 FPS beim Ziehen, Hovern und Live-Tuning zu erreichen?
- **Kernthese:** Die Wahl zwischen SVG, Canvas 2D und WebGL (2D/3D) entscheidet bei mittelgroßen Wissensgraphen weniger durch theoretische Knoten-Obergrenzen als durch subtile Architektur-Fallstricke an der Grenze zwischen statischer Layout-Vorberechnung, bibliotheksinternen Reheat-/Kamera-Automatismen und Main-Thread-Budgetierung. Erst ein isomorph geteilter Layout-Solver zwischen Build und Browser, kalibrierte Gleichgewichts-Drag-Controller und kooperatives Time-Slicing (`<= 8.5 ms` Frame-Budget) verwandeln fünf heterogene Engines in deterministische, ruckelfreie Werkzeuge — jeweils mit klaren, empirisch messbaren Stärken und Trade-offs statt dogmatischem „WebGL schlägt alles".

---

## 2. Kernbotschaften & Stichpunkte

- **1. Fairer 1:1-Systemvergleich über 5 Rendering- und Physik-Paradigmen auf identischem Datenmodell:**
  - Einheitlicher Produktions-Datensatz (~350 domänenübergreifende Content-Knoten aus Posts, Kursen, Publikationen, Projekten, Services, Präsentationen und Tags sowie ~1.100 TF-IDF-spezifitätsgewichtete Kanten) und kanonisches Payload-/Farb-Schema in [`src/commons/shared/graph-payload.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts).
  - Gegenüberstellung der realen Pipeline-Trade-offs ohne Hype:
    - **SVG (`D3.js`)**: Deklarative DOM-Inspektionsfähigkeit, präzise CSS-/Vektor-Schärfe und direkte Accessibility-Anbindung vs. kostspieliges DOM-Attribut-Mutieren pro Tick bei globalen Kanten-Updates.
    - **Canvas 2D (`Cytoscape.js`, `Vis.js`)**: Reichhaltige Out-of-the-Box-Graph-Theorie und ergonomische Interaktions-APIs vs. versteckte Redraw-Kaskaden bei Stil-Layern und Einzelknoten-Mutationen.
    - **WebGL 2D (`Sigma.js` + `Graphology`) & WebGL 3D (`3D Force Graph / Three.js`)**: Maximale GPU-Instancing-Durchsatzrate bei tausenden Primitiven vs. Shader-/Label-Abstraktionsaufwand, Tiefenwahrnehmungs-Trade-offs in 3D und strengere Anforderungen an Headless-CI-Tests.

- **2. Warum Build-Zeit-Layouts und Live-Client-Physik lautlos divergieren — und wie 100 % Solver-Parität entsteht:**
  - Vier konkrete Divergenz-Ursachen aus der Implementierungspraxis:
    1. **3D-Gravitations-Kollaps**: Unskalierte radiale Zentralgravitation in 3D schnürt äußere Cluster auf eine dichte Kugeloberfläche zusammen, wenn Build-Solver und Client-Physik unterschiedliche Abstands-Exponenten oder Skalierungsfaktoren verwenden.
    2. **Bibliotheksinterne Drag-Reheat-Overrides**: Standard-Drag-Handler vieler Bibliotheken setzen eigene `alphaTarget`-Werte oder überschreiben Federlängen/Abstoßungskräfte, wodurch der Graph beim ersten Ziehen explosionsartig in ein völlig anderes Gleichgewicht springt als das statisch geladene Startbild.
    3. **$1/d^2$- vs. $1/d$-Hub-Hairballs**: Klassische Coulomb-Abstoßung ($1/d^2$) zusammen mit ungedämpften hochgradigen Tag-Hubs zieht dichte Nachbarschaften zu unlesbaren Knäueln zusammen, sofern keine gradabhängige Abstoßung und TF-IDF-Kantengewichtung (z. B. ForceAtlas2-Prinzipien vs. Barnes-Hut/Velocity-Verlet) konsistent kalibriert sind.
    4. **Radiales Auto-Zoom-Paradoxon**: Automatische `fitToViewport`-Kamerakorrekturen nach jedem Parameter-Update kompensieren größere Außenring-Radien sofort wieder optisch weg, solange keine feste radiale Referenzgeometrie (`getRadialReferenceBounds2D`) als Kamera-Anker dient.
  - **Architektonische Lösung**: Ein einziges isomorphes Solver-Modul in [`src/commons/shared/graph-solvers.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-solvers.ts) speist sowohl den Build-Time-Endpunkt ([`src/commons/server/graph-layout-endpoint.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/graph-layout-endpoint.ts)) als auch alle fünf Client-Engines; ergänzt durch den auf das exakte Solver-Gleichgewicht kalibrierten 2D/3D-Drag-Controller in [`src/commons/client/graph-drag-controller.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/graph-drag-controller.ts).

- **3. Reale Bottleneck-Telemetrie & der Weg zu durchgehenden 60 FPS:**
  - Reproduzierbare Vorher-/Nachher-Messwerte aus [`src/scripts/benchmark-visualizations.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/benchmark-visualizations.ts) über die Phasen `idle`, `hover`, `drag`, `layout` und `tuning`:
    - **`9.1 FPS` Drag-Einbruch (`Vis.js`)**: Aufrufe der öffentlichen `moveNode()`-API pro Nachbarknoten lösten pro Frame dutzende vollständige interne Layout-/Redraw-Zyklen aus $\rightarrow$ gelöst durch gebatchte direkte `body.nodes`-Koordinaten-Updates mit einem einzigen gebündelten Frame-Redraw.
    - **`17.8 FPS` Hover-Einbruch (`Cytoscape.js`)**: Mehrschichtige Selektor- und Stil-Neuberechnungen bei Ego-Netzwerk-Hervorhebungen blockierten die Canvas-Pipeline $\rightarrow$ gelöst durch zustandsarmes `cy.batch(...)`-Klassenschalten und entkoppelte Preact-HUD-Overlays ([`src/commons/client/vis-tooltip.tsx`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/vis-tooltip.tsx)).
    - **`183–965 ms` Main-Thread-Freezes beim Live-Slider-Scrubbing (`#tune-hud`)**: Synchrone Komplett-Iterationen blockierten Pointer-Events beim Bewegen der Physik-Regler $\rightarrow$ gelöst durch kooperative, zeitgeslicte Async-Generatoren (`solve*LayoutAsync` mit `<= 8.5 ms` Frame-Budget pro Slice) inklusive sofortigem Abbruch veralteter Berechnungs-Generationen (Stale-Solve-Cancellation).

- **4. Drei-Säulen-Verifikationsstrategie für interaktive Grafik-Pipelines:**
  1. **Mathematische & architektonische Invarianten in Node.js** (`npm run validate:vis`, [`src/scripts/validate-visualizations.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/validate-visualizations.ts)): Deterministische Prüfung von Cluster-Separation (`>= 1.9x`), radialen und hierarchischen Geometrie-Invarianten, exakter Reset-Deterministik der Tuning-Parameter, 2D/3D-Drag-Nachbarschaftsreaktion und strikter Speicher-Privatsphäre (null `localStorage`/`sessionStorage`).
  2. **Automatisierte Browser- & WebGL-E2E-Prüfung in CI** (`npm run test:vis:e2e -- --ci`, [`src/scripts/test-visualizations-e2e.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/test-visualizations-e2e.ts)): 25 Puppeteer-Checks über alle fünf Engines inklusive Software-WebGL via ANGLE SwiftShader in GitHub Actions.
  3. **Lokales GPU-Frame-Time-Benchmarking** (`npm run benchmark:vis`, [`src/scripts/benchmark-visualizations.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/benchmark-visualizations.ts)): Automatisierte Messung von Durchschnitts-FPS und P95-Frame-Times unter synthetischer Pointer- und Slider-Last auf realer Hardware.

---

## 3. Quellen, Links & Evidenz

- **Repository-Implementierung & Verifikations-Skripte (kanonische `main`-Links):**
  - Isomorphe 2D/3D-Layout-Solver & Time-Sliced Async-Generatoren: [`src/commons/shared/graph-solvers.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-solvers.ts)
  - Geteilter Payload-, Tuning- & Referenzgeometrie-Vertrag: [`src/commons/shared/graph-payload.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts)
  - Build-Time-Layout-Endpunkt: [`src/commons/server/graph-layout-endpoint.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/graph-layout-endpoint.ts)
  - Kalibrierter 2D/3D-Drag- & Gleichgewichts-Controller: [`src/commons/client/graph-drag-controller.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/graph-drag-controller.ts)
  - Deterministisches Node.js-Invarianten-Gate: [`src/scripts/validate-visualizations.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/validate-visualizations.ts)
  - Puppeteer-Browser- & SwiftShader-WebGL-E2E-Suite: [`src/scripts/test-visualizations-e2e.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/test-visualizations-e2e.ts)
  - 60-FPS- & P95-Frame-Time-Benchmark-Runner: [`src/scripts/benchmark-visualizations.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/benchmark-visualizations.ts)
- **Live-Showcases auf demselben Wissensgraphen (Cross-Links):**
  - Cytoscape.js (Canvas 2D): [`/visualizations/cytoscape/`](https://hackenberg.tech/visualizations/cytoscape/)
  - Sigma.js + Graphology (WebGL 2D): [`/visualizations/sigma/`](https://hackenberg.tech/visualizations/sigma/)
  - D3.js Force Simulation (SVG): [`/visualizations/d3/`](https://hackenberg.tech/visualizations/d3/)
  - Vis.js Network (Canvas 2D): [`/visualizations/vis-network/`](https://hackenberg.tech/visualizations/vis-network/)
  - 3D Force Graph / Three.js (WebGL 3D): [`/visualizations/3d-force-graph/`](https://hackenberg.tech/visualizations/3d-force-graph/)
- **Primärliteratur für die spätere SOTA-Fundierung (`source-research` vor `/grill-me`):**
  - Jacomy, M., Venturini, T., Heymann, S., & Bastian, M. (2014): *ForceAtlas2, a Continuous Graph Layout Algorithm for Handy Network Visualization Designed for the Gephi Software* (PLOS ONE) — theoretisches Fundament für gradabhängige Abstoßung und lineare vs. quadratische Anziehungs-/Abstoßungsgesetze.
  - Bostock, M., Ogievetsky, V., & Heer, J. (2011): *D³: Data-Driven Documents* (IEEE TVCG) sowie Velocity-Verlet-Integrations- und Quadtree-/Barnes-Hut-Approximationen ($O(N \log N)$).
  - Franz, M. et al. (2016): *Cytoscape.js: a graph theory library for visualisation and analysis* (Bioinformatics).

---

## 4. Zielgruppe & Verwertungskontext

- **Zielgruppe:** Frontend- und Full-Stack-Architekten, Data-Visualization-Engineers, Entwickler von Knowledge-Graph-/RAG-Explorern sowie technisch interessierte Studierende, die vor der konkreten Auswahl und Produktionshärtung einer Web-Graph-Engine stehen.
- **Cross-Links & Strategischer Hebel:**
  - Bildet das moderne 2026er Architektur- und Benchmark-Flaggschiff zum hochfrequentierten organischen Suchcluster rund um den Klassiker [`2015_12_21_javascript_graph_libraries_cytoscape_sigma_d3`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/posts/2015_12_21_javascript_graph_libraries_cytoscape_sigma_d3/index.md) (vgl. [`SYSTEM-013`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/backlog/system/013-seo-geo-retention-audit-remediation.md)) und bündelt den Link-Fluss zu allen fünf interaktiven `/visualizations/<engine>/`-Sandboxes.
  - Verknüpfbar mit bestehenden Artikeln zu Zero-Artifact-Architekturen, Client-Hardening ([`SYSTEM-009`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/backlog/system/009-client-script-deduplication-and-preact-dom-hardening.md)) und deterministischer Build-Zeit-Vorberechnung in Astro.
