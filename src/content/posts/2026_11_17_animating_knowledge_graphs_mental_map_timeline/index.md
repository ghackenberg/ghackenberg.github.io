---
title: "Animating Knowledge Graphs Without Breaking the Mental Map"
pubDate: 2026-11-17
description: "Animate evolving knowledge graphs without breaking the mental map via final-corpus clustering, Procrustes alignment, and u² blending."
inLanguage: "en"
tags:
  - data-visualization
  - knowledge-graphs
  - computer-graphics
  - human-computer-interaction
  - typescript
image:
  src: "./hero.jpg"
  title: "Temporal Knowledge Graph Timeline and Procrustes Alignment Blueprint"
  description: "Architectural timber drafting table blueprint in the Grünau im Almtal office illustrating a temporal knowledge graph timeline, chronological slicing, and Procrustes frame alignment"
references:
  - id: "misue-1995-mental-map"
    type: "article"
    authors:
      - name: "Kazuo Misue"
      - name: "Peter Eades"
      - name: "Wei Lai"
      - name: "Kozo Sugiyama"
    title: "Layout Adjustment and the Mental Map"
    journal: "Journal of Visual Languages & Computing"
    year: 1995
    volume: "6"
    number: "2"
    pages: "183--210"
    doi: "10.1006/jvlc.1995.1010"
    url: "https://doi.org/10.1006/jvlc.1995.1010"
  - id: "beck-2017-dynamic-graphs"
    type: "article"
    authors:
      - name: "Fabian Beck"
      - name: "Michael Burch"
      - name: "Stephan Diehl"
      - name: "Daniel Weiskopf"
    title: "A Taxonomy and Survey of Dynamic Graph Visualization"
    journal: "Computer Graphics Forum"
    year: 2017
    volume: "36"
    number: "1"
    pages: "133--159"
    doi: "10.1111/cgf.12791"
    url: "https://doi.org/10.1111/cgf.12791"
---

Temporal knowledge graph timelines preserve the viewer's mental map by clustering the final corpus once, slicing content nodes chronologically, and anchoring every intermediate solve to the resting layout. Weighted Procrustes alignment removes rotation and reflection drift, while quadratic `u²` blending guarantees smooth playback and exact static parity at the final step.

<!-- caption: "Comparison of naive per-step re-clustering and our final-anchored temporal timeline" -->
| Dimension | Naive Per-Step Re-Layout | Final-Anchored Temporal Timeline |
| --- | --- | --- |
| Cluster Identity | Re-computed per step; labels and colors shift | Clustered once on `finalCanonical` (`renames=0, colourBreaks=0`) |
| Historical Filtering | Rebuilds topology from scratch each frame | Filters `visible` items up to `s` and reveals `activeClusters` |
| Frame Orientation | Arbitrary rotation, scale, and reflection drift | Weighted `alignLayoutProcrustes` (`[0.85, 1.15]`, no mirror) |
| End-State Parity | Drifts from the resting static graph | Quadratic `u²` blend guarantees `0.0000px` delta at `n - 1` |
| Scrubbing UX | Re-solves on every seek | Cached keyframes in `keyframeCache` via `GraphTimelineController` |

## Why Do Naive Temporal Graph Animations Destroy the Mental Map?

Naive dynamic graph animations break the viewer's mental map because force-directed layouts are invariant to rotation, reflection, and translation. Re-solving and re-clustering each historical slice independently causes topic anchors to rename, recolor, and spin across the canvas, forcing visitors to re-learn spatial neighborhoods instead of tracking thematic growth [@misue-1995-mental-map; @beck-2017-dynamic-graphs].

In our previous article on [edge-free knowledge graphs](/posts/2026_11_16_edge_free_knowledge_graphs_oklab_cluster_pills/), we compressed 126 tags into macro topic clusters and OKLab-blended polygons. Extending that static map into a chronological replay exposes a classic dynamic-graph failure mode: when a new year of articles arrives, running a fresh clustering pass and unconstrained force simulation can flip the entire graph upside down or reassign cluster hues mid-playback, breaking the viewer's spatial memory even when the underlying themes barely changed.

## How Does Final-Corpus Clustering With Chronological Slicing Work?

`buildTemporalGraphKeyframes` computes macro topic clusters once on the complete final corpus (`finalCanonical`), then filters content items up to timestamp `s` (`visible`) and activates only the final clusters already touched (`activeClusters`). Because cluster identities never change mid-timeline, every theme keeps its exact name, OKLab color, and tag membership throughout.

![Diagram of final-corpus clustering followed by chronological slicing across three progressive timeline snapshots with fixed cluster colors and zero renames](./chronological-corpus-slicing.svg "Final-Corpus Clustering and Chronological Slicing")

Inside [`src/commons/shared/graph-payload.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts), `buildTemporalGraphKeyframes` sorts all content nodes chronologically by timestamp and builds `finalCanonical` once at the target cluster count. For any step `s`, it collects `visible` content items up to index `s` and enables only the `activeClusters` connected to those items. That single design choice eliminates mid-timeline label churn and palette jumps (`renames=0, colourBreaks=0, weightDrift=0`): a cluster that appears in 2018 wears the exact same pill label and OKLab hue it will hold in 2026.

## How Do Procrustes Alignment and u² Blending Prevent Frame Drift?

Even with frozen cluster identities, sparse early subsets still rotate, scale, or drift when relaxed freely. Seeding from final positions, aligning each solve via `alignLayoutProcrustes` (weighted `1.0` on clusters, `0.01` on content, scale clamped to `[0.85, 1.15]`, no mirroring), and applying quadratic `u²` blending preserves natural early proportions and `0.0000px` end-state parity.

![Comparison of unaligned spinning keyframes versus Procrustes-aligned and u-squared blended keyframes with the timeline scrubber bar](./procrustes-timeline-alignment.svg "Procrustes Frame Alignment, u-Squared Blending, and Timeline Scrubber")

In [`src/commons/shared/graph-payload.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts), `computeFinalLayoutAlignmentWeights` assigns `1.0` to macro clusters (`group === 0`) and `0.01` to content nodes, locking the coordinate frame onto the stable topic anchors while allowing individual articles to settle naturally. `alignLayoutProcrustes` solves the optimal rigid-body transformation—with uniform scale clamped to `[0.85, 1.15]` and zero reflection—in both 2D and 3D. Finally, `alignAndBlendToFinalLayout` computes normalized progress `u = step / (total - 1)` and blends each aligned frame toward the resting layout by `u²`, easing smoothly into 100% static parity (`0.0000px` delta) on the last step.

## Interactive Timeline Bar and Left-Sidebar Tune Panel Across Five Engines

`GraphTimelineController` coordinates asynchronous warm solves and caches every step inside `keyframeCache` across all five visualization engines. A compact `#timeline-bar` provides `#timeline-prev`, `#timeline-play`, `#timeline-next`, and `#timeline-scrubber` controls below the canvas, while the `#tune-panel` left sidebar overlay keeps physics sliders accessible without covering playback.

Across all five live sandboxes—[Cytoscape](/visualizations/cytoscape/), [Sigma](/visualizations/sigma/), [D3](/visualizations/d3/), [vis-network](/visualizations/vis-network/), and [3D Force Graph](/visualizations/3d-force-graph/)—[`src/commons/client/graph-timeline-controller.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/graph-timeline-controller.ts) drives chronological playback through a shared adapter contract. Caching each snapshot in `keyframeCache` keeps backward scrubbing instantaneous, while [`src/pages/visualizations/[slug].astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/visualizations/[slug].astro) docks `#timeline-bar` beneath the viewport and tucks `#tune-panel` into a collapsible left sidebar so visitors can adjust `K` or spring physics while watching the timeline unfold.

## Practical Trade-Offs: Free Convergence vs. Strict Pinning

Letting each historical slice converge freely before applying rigid-body Procrustes alignment balances early legibility with global spatial memory. Strict per-node pinning freezes early articles at awkward future distances, whereas unpinned convergence followed by weighted alignment and `u²` blending preserves local proportions while converging smoothly to the resting graph.

Pinning every early node to its 2026 coordinates leaves a three-article graph stretched across an empty canvas as if waiting for unseen neighbors. Letting the force solver relax each sparse slice naturally keeps early clusters compact and readable, while post-solve Procrustes alignment and `u²` blending ensure the viewer never loses their bearings as the corpus grows. For the zero-overlap successor engine built on 60° barycentric triangulation, read [SimplexViz: 60° Triangulation for Knowledge Maps](/posts/2026_11_18_introducing_simplex_viz/) or explore the [interactive SimplexViz graph](/visualizations/simplex-viz/).
