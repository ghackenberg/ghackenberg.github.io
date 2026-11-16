# CONTENT-002: Edge-Free Knowledge Graphs: OKLab & Cluster Pills

- **ID:** `CONTENT-002`
- **Typ:** `post`
- **Status:** `in-progress`
- **Sprache:** `en`
- **Priorität / Hebel:** `HOCH`
- **Datum der Erfassung:** `2026-11-16`

---

## 1. Kernthese & Leitfrage

- **Leitfrage:** Wie vermeidet man in dichten Wissensgraphen unlesbare „Hairball“-Kantenknäuel, ohne die visuelle Information über Themenzugehörigkeit und Brückenknoten zu verlieren?
- **Kernthese:** Sichtbare Kanten sind in mittelgroßen Multi-Cluster-Wissensgraphen oft das falsche visuelle Medium. Indem Kanten zu 100 % unsichtbaren, kontinuierlichen Physik-Federn werden und Themenzugehörigkeit stattdessen über **wahrnehmungsgleiche OKLab-Farbmischung**, **Pill-Superknoten mit elliptischer Solver-Freihaltezone**, **flächig normierte $N$-Eck-Polygone** und **dynamisches Re-Clustering ($K \in [2, 18]$)** kodiert wird, steigt die visuelle Klarheit drastisch — bei voller Interaktivität über alle fünf Render-Engines hinweg.

---

## 2. Kernbotschaften & Stichpunkte

- **1. Unsichtbare Physik-Kanten + Baryzentrische Gravitation:**
  - Kanten zwischen Content-Knoten und Themen-Clustern werden weder im Ruhezustand noch bei Hover gezeichnet, wirken aber als stufenfreie Federn (`weight ∈ [0.20, 0.96]`).
  - Brückenknoten zwischen mehreren Themengebieten pendeln sich exakt an ihrem überlappungsgewichteten Schwerpunkt ein.
- **2. Wahrnehmungsgleiche OKLab-Farbmischung (`mixHexColorsOklab`):**
  - Warum klassische RGB- oder HSL-Interpolation bei Multi-Cluster-Knoten zu grauen/schlammigen Zwischentönen führt.
  - Wie OKLab-Blending mit Chroma-Erhaltung Cluster-Zugehörigkeit ohne eine einzige gezeichnete Kante unmittelbar lesbar macht.
- **3. Die Pill als eigener Superknoten (`group === 0`) & elliptische Freihaltezone:**
  - Kein dahinterliegender Kreis, keine gestrichelte Leader-Line: das zentrierte Pill-Badge *ist* der Themen-Cluster-Knoten.
  - Größenkonstante Haupt-Pill + angedocktes `%`-Coverage-Satelliten-Badge bei Hover (null Layout-Flackern) sowie deterministische Solver-Freihaltezone (`enforceClusterPillClearance2D/3D`), damit kein Content-Knoten unter einem Pill-Text verschwindet.
- **4. Flächig normierte $N$-Eck-Polygone & Simplex-Defaults (`K = 3` in 2D, `K = 4` in 3D):**
  - Kodierung von 8 Content-Typen (`Posts`, `Publications`, `Courses`, etc.) als reguläre Polygone (`3..10` Ecken) in allen 5 Engines und in der exklusiven Single-Select-Filterleiste.
  - Client-seitiges Live-Reclustering (`reclusterCanonicalGraphPayload`) für beliebige $K \in [2, 18]$ ohne Server-Roundtrip.

---

## 3. Quellen, Links & Evidenz

- **Repository-Implementierung (kanonische `main`-Links):**
  - Payload-, OKLab- & Reclustering-Logik: [`src/commons/shared/graph-payload.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts)
  - 2D/3D-Layout-Solver & elliptische Pill-Freihaltezone: [`src/commons/shared/graph-solvers.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-solvers.ts)
  - Tooltip-Kollisionsvermeidung & Interaktion: [`src/commons/client/vis-tooltip.tsx`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/vis-tooltip.tsx)
  - Architektur-RFC (Etappe 1-Fundament): [`backlog/system/014-temporal-knowledge-graph-timeline-and-cluster-evolution.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/backlog/system/014-temporal-knowledge-graph-timeline-and-cluster-evolution.md)
- **Live-Showcases:** `/visualizations/cytoscape/`, `/visualizations/sigma/`, `/visualizations/d3/`, `/visualizations/vis-network/`, `/visualizations/3d-force-graph/`.
- **Primärliteratur (vor `/grill-me` über `source-research` abzusichern):**
  - Björn Ottosson (2020): *A perceptual color space for image processing (OKLab)*.
  - Tamara Munzner (2014): *Visualization Analysis and Design* (Visuelle Kanäle: Position vs. Farbe vs. Form).

---

## 4. Zielgruppe & Verwertungskontext

- **Zielgruppe:** Data-Visualization-Engineers, Information-Design-Spezialisten, Frontend-Architekten und Entwickler von Knowledge-Graph- / RAG-Explorern.
- **Detailtiefe & Fachsprache:** Mittel bis hoch, visuell-perzeptiv und architektonisch (*Perceptual Color Space / OKLab, Barycentric Seeding, Visual Clutter, Clearance Zone*).
- **Cross-Links:** Direkter Vorläufer zu [`CONTENT-003`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/backlog/content/003-temporal-knowledge-graphs-mitosis-60fps-timelines.md) (Timeline-Steuerung) und Ergänzung zur November-Serie (`2026_11_04_focus_aware_hop_attenuation_knowledge_graphs`, `2026_11_05_five_graph_engines_unified_interaction_physics`).
