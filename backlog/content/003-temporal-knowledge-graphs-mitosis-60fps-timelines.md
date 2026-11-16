# CONTENT-003: Temporal Knowledge Graphs: Mitosis & 60fps Timelines

- **ID:** `CONTENT-003`
- **Typ:** `post`
- **Status:** `idea`
- **Sprache:** `en`
- **Priorität / Hebel:** `HOCH`
- **Datum der Erfassung:** `2026-11-16`

---

## 1. Kernthese & Leitfrage

- **Leitfrage:** Wie animiert man das chronologische Wachstum eines Wissensgraphen über viele Jahre hinweg über fünf Render-Engines hinweg, ohne dass Cluster bei jedem Zeitschritt unruhig springen und die Mental Map des Betrachters zerstören?
- **Kernthese:** Eine flüssige Timeline-Steuerung für evolvierende Wissensgraphen scheitert, wenn jeder Zeitpunkt isoliert neu gelayoutet wird. Erst die Kombination aus **adaptivem Cluster-Budget $K(t)$**, **bipartitem Jaccard-Cluster-Matching** (für Persistenz, Mitose, Fusion und Geburt), **final-geseedetem Procrustes+$u_2$-Alignment** und **gecachten 60-FPS-Keyframes** erlaubt stufenloses Scrubbing durch die Themen-Evolution ohne Orientierungsverlust.

---

## 2. Kernbotschaften & Stichpunkte

- **1. Chronologische Keyframes & Adaptives $K(t)$:**
  - Zeitliche Filterung aktiver Content-Knoten $V_{\text{content}}(t_k)$ und Tags über $T$ Keyframes.
  - Warum ein fixes $K$ frühe Jahre übersegmentiert — organisches Wachstum $K(t_k)$ bis zum Ziel-$K_{\text{target}}$ am rechten Timeline-Ende (100 % Parität zum statischen Initial-Layout).
- **2. Mental-Map-Erhaltung durch Bipartites Jaccard-Matching:**
  - IDF-gewichtete Tag-Ähnlichkeit zwischen aufeinanderfolgenden Keyframes $t_{k-1} \rightarrow t_k$.
  - Vier klassifizierte Übergangs-Events: **Persistenz** (1:1-Fortführung mit Warm-Start-Koordinaten), **Cluster-Mitose / Split** (Tochtercluster spawnt am Eltern-Cluster), **Cluster-Fusion / Merge** und **Cluster-Geburt**.
- **3. Final-Seeded Procrustes+$u_2$-Alignment:**
  - Wie Rotations-, Spiegelungs- und Translations-Drift zwischen aufeinanderfolgenden Keyframe-Relaxationen verhindert wird, sodass sich der Graph in der Zeitachse kontinuierlich entfaltet statt zu taumeln.
- **4. 60-FPS-Timeline-Player & UI-Steuerung über 5 Engines:**
  - Kompakte Timeline-Leiste (Play/Pause, Scrubber, Geschwindigkeitswahl `0.5x`/`1x`/`2x`, Keyframe-Zähler) und Konvertierung des Tune-Panels in ein schlankes Left-Sidebar-Overlay.
  - Keyframe-Caching für verzögerungsfreies Vorwärts- und Rückwärts-Scrubben.

---

## 3. Quellen, Links & Evidenz

- **Repository-Implementierung (kanonische `main`-Links):**
  - Timeline-Builder, Jaccard-Matching & Procrustes-Alignment: [`src/commons/shared/graph-payload.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts)
  - Timeline-UI, Left-Sidebar-Tune-Overlay & 5-Engine-Interpolation: [`src/pages/visualizations/[slug].astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/visualizations/[slug].astro)
  - Vollständige Architektur-Spezifikation: [`backlog/system/014-temporal-knowledge-graph-timeline-and-cluster-evolution.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/backlog/system/014-temporal-knowledge-graph-timeline-and-cluster-evolution.md)
- **Live-Showcases:** `/visualizations/cytoscape/`, `/visualizations/sigma/`, `/visualizations/d3/`, `/visualizations/vis-network/`, `/visualizations/3d-force-graph/`.
- **Primärliteratur (vor `/grill-me` über `source-research` abzusichern):**
  - Misue, K. et al. (1995): *Layout Adjustment and the Mental Map* (Journal of Visual Languages & Computing).
  - Beck, F., Burch, M., Diehl, S., & Weiskopf, D. (2017): *A Taxonomy and Survey of Dynamic Graph Visualization* (Computer Graphics Forum).

---

## 4. Zielgruppe & Verwertungskontext

- **Zielgruppe:** Data-Visualization-Engineers, Graph-Algorithmiker, Scientometrics- / Knowledge-Management-Entwickler und Frontend-Architekten.
- **Detailtiefe & Fachsprache:** Hoch, algorithmisch-interaktionstechnisch (*Mental-Map Preservation, Bipartite Matching, Cluster Mitosis, Procrustes Alignment, Keyframe Interpolation*).
- **Cross-Links:** Baut direkt auf [`CONTENT-002`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/backlog/content/002-edge-free-knowledge-graphs-oklab-cluster-pills.md) (Clustering & OKLab-Kodierung) sowie den fünf `/visualizations/*`-Sandboxes auf.
