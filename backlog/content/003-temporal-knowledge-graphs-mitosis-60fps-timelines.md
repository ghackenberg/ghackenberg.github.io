# CONTENT-003: Animating Knowledge Graphs Without Breaking the Mental Map

- **ID:** `CONTENT-003`
- **Typ:** `post`
- **Status:** `in-progress`
- **Sprache:** `en`
- **Priorität / Hebel:** `HOCH`
- **Datum der Erfassung:** `2026-11-16`

---

## 1. Kernthese & Leitfrage

- **Leitfrage:** Wie animiert man das chronologische Wachstum eines Wissensgraphen über viele Jahre hinweg über fünf Render-Engines hinweg, ohne dass Cluster bei jedem Zeitschritt umbenannt werden, ihre Farben wechseln oder die Mental Map des Betrachters durch Rotation und Drift zerstören?
- **Kernthese:** Eine ruhige, nachvollziehbare Timeline-Steuerung entsteht, wenn man den finalen Korpus **genau einmal** auf `finalCanonical` clustert, Content-Knoten chronologisch bis zum Zeitschritt `s` filtert (`renames=0, colourBreaks=0, weightDrift=0`), jeden Zwischen-Solve über **cluster-gewichtetes Procrustes-Alignment** (`1.0` auf Clustern, `0.01` auf Content, Scale `[0.85, 1.15]`, keine Spiegelung) ausrichtet und über **quadratisches `u²`-Blending** mit `0.0000px` Delta ins statische End-Layout überführt.

---

## 2. Kernbotschaften & Stichpunkte

- **1. Einmaliges Clustering auf dem finalen Korpus & chronologisches Slicing:**
  - `buildTemporalGraphKeyframes` berechnet die Makro-Cluster einmalig auf `finalCanonical`.
  - Für Schritt `s` werden nur `visible`-Knoten bis zum Zeitstempel `s` sowie die von ihnen berührten `activeClusters` aktiviert (`renames=0, colourBreaks=0, weightDrift=0`).
- **2. Final-Seeded Layout + Gewichtetes Procrustes-Alignment + `u²`-Blending:**
  - Verhindert Rotations-, Skalierungs- und Spiegelungs-Drift in frühen, dünn besetzten Zeitschritten via `alignLayoutProcrustes` und `computeFinalLayoutAlignmentWeights` (`1.0` für `group === 0`, `0.01` für Content).
  - `alignAndBlendToFinalLayout` (`u = step / (total - 1)`, `u²`-Blend) wahrt natürliche frühe Proportionen und garantiert 100 % statische Parität (`0.0000px` Delta) am Timeline-Ende.
- **3. Interaktive `#timeline-bar` & Left-Sidebar `#tune-panel` über 5 Engines:**
  - `GraphTimelineController` + `keyframeCache` + `#timeline-bar` (`#timeline-prev`, `#timeline-play`, `#timeline-next`, `#timeline-scrubber`) + `#tune-panel` Left-Sidebar-Overlay über alle 5 Engines.

---

## 3. Quellen, Links & Evidenz

- **Repository-Implementierung (kanonische `main`-Links):**
  - Timeline-Builder, Keyframe-Slicing & Procrustes-Alignment: [`src/commons/shared/graph-payload.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts)
  - Timeline-Controller & Caching: [`src/commons/client/graph-timeline-controller.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/graph-timeline-controller.ts)
  - Timeline-UI, Left-Sidebar-Tune-Overlay & 5-Engine-Integration: [`src/pages/visualizations/[slug].astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/visualizations/[slug].astro)
- **Live-Showcases:** `/visualizations/cytoscape/`, `/visualizations/sigma/`, `/visualizations/d3/`, `/visualizations/vis-network/`, `/visualizations/3d-force-graph/`.
- **Primärliteratur:**
  - Misue, K. et al. (1995): *Layout Adjustment and the Mental Map* (Journal of Visual Languages & Computing).
  - Beck, F., Burch, M., Diehl, S., & Weiskopf, D. (2017): *A Taxonomy and Survey of Dynamic Graph Visualization* (Computer Graphics Forum).

---

## 4. Zielgruppe & Verwertungskontext

- **Zielgruppe:** Data-Visualization-Engineers, Graph-Algorithmiker, Knowledge-Management-Entwickler und Frontend-Architekten.
- **Detailtiefe & Fachsprache:** Praxis- und UI/Design-orientiert, konsistent zu `CONTENT-002`.
- **Cross-Links:** Baut direkt auf [`CONTENT-002`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/backlog/content/002-edge-free-knowledge-graphs-oklab-cluster-pills.md) sowie den fünf `/visualizations/*`-Sandboxes auf.
