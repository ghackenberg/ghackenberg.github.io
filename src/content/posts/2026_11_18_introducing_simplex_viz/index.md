---
title: "SimplexViz: 60° Triangulation for Knowledge Maps"
pubDate: 2026-11-18
description: "Open-source TypeScript visualization engine combining 60° simplex triangulation, OKLab color blending, 0.0 px overlap, and 1:4 drill-down."
inLanguage: "en"
tags:
  - data-visualization
  - knowledge-graphs
  - typescript
  - software-architecture
  - react
  - open-source
image:
  src: "./hero.jpg"
  title: "SimplexViz 60° Triangulation Architecture on Workstation Monitor"
  description: "Close-up of a curved ultra-wide workstation monitor in the Grünau im Almtal timber office displaying SimplexViz's 60° equilateral triangle lattice, OKLab cluster anchors, and 3-package TypeScript architecture"
references:
  - id: "ottosson-2020-oklab"
    type: "online"
    authors:
      - name: "Björn Ottosson"
    title: "A perceptual color space for image processing"
    year: 2020
    siteName: "bottosson.github.io"
    url: "https://bottosson.github.io/posts/oklab/"
  - id: "ghoniem-2004-graph-readability"
    type: "inproceedings"
    authors:
      - name: "Mohammad Ghoniem"
      - name: "Jean-Daniel Fekete"
      - name: "Philippe Castagliola"
    title: "A Comparison of the Readability of Graphs Using Node-Link and Matrix-Based Representations"
    booktitle: "IEEE Symposium on Information Visualization (InfoVis 2004)"
    year: 2004
    doi: "10.1109/INFVIS.2004.1"
    url: "https://doi.org/10.1109/INFVIS.2004.1"
  - id: "collins-2009-bubble-sets"
    type: "article"
    authors:
      - name: "Christopher Collins"
      - name: "Gerald Penn"
      - name: "Sheelagh Carpendale"
    title: "Bubble Sets: Revealing Set Relations with Isocontours over Existing Visualizations"
    journal: "IEEE Transactions on Visualization and Computer Graphics"
    year: 2009
    volume: "15"
    number: "6"
    pages: "1009--1016"
    doi: "10.1109/TVCG.2009.122"
    url: "https://doi.org/10.1109/TVCG.2009.122"
---

SimplexViz is an open-source TypeScript visualization engine that maps tagged items, vector embeddings, or pairwise similarity matrices onto an adaptive 60° equilateral triangle lattice. Using perceptual OKLab color mixing, a deterministic 0.0 px overlap solver, and conformal 1:4 hierarchical drill-down, it replaces cluttered hairballs with legible interactive topic maps.

<!-- caption: "Architectural comparison between traditional force-directed or scatter layouts and SimplexViz 60° triangulation" -->
| Dimension | Force-Directed & UMAP/t-SNE Layouts | SimplexViz (60° Triangulation) |
| --- | --- | --- |
| Spatial Structure | Unconstrained continuous coordinates | Adaptive 60° equilateral triangle lattice |
| Multi-Topic Bridges | Crossing edges or overlapping blobs | Barycentric interior coordinates inside covering simplices |
| Color Encoding | Discrete palettes or muddy sRGB blends | Perceptual OKLab contrast & barycentric hue mixing |
| Overlap Guarantee | Frequent label and node collisions | Deterministic `0.0 px` overlap via SAT & PBD relaxation |
| Deep Exploration | Flat camera pan and zoom only | Continuous camera plus conformal `1:4` hierarchical drill-down |

## Why Do Force-Directed Hairballs and Scatter Projections Break Down?

Traditional force-directed node-link graphs and raw UMAP or t-SNE scatter plots fail on multi-topic collections because crossing edges, conflicting attraction forces, and overlapping markers obscure structure. Empirical readability studies confirm node-link diagrams degrade above twenty vertices [@ghoniem-2004-graph-readability], while dense overlapping contours quickly turn visual fields opaque [@collins-2009-bubble-sets].

When an item belongs to three or four themes at once, classical spring layouts pull it across the canvas in competing directions. The resulting center mass hides which topics actually bridge one another and forces readers to hover blindly through stacked labels.

Dimensionality-reduction scatter plots like UMAP and t-SNE preserve local neighborhoods, yet they offer no explicit geometric anchors for macro themes and routinely stack dense clusters on top of each other. SimplexViz avoids both failure modes by anchoring balanced clusters onto the vertices of a planar 60° triangle mesh and placing multi-topic items cleanly inside the covering edges and faces.

## How Does SimplexViz's 5-Stage Pluggable Pipeline Work?

SimplexViz processes any collection through five hot-swappable strategy stages: adaptive 60° mesh construction, representation-agnostic clustering, perceptual OKLab coloring [@ottosson-2020-oklab], zero-overlap SAT and PBD layout resolution, and conformal 1:4 hierarchical drill-down. Each stage exposes a clean TypeScript interface, letting teams swap algorithms at runtime without rewriting rendering code.

![Five-stage pluggable SimplexViz pipeline mapping arbitrary collections through a 60° equilateral lattice, clustering, OKLab color mixing, zero-overlap SAT/PBD layout, and 1:4 hierarchical zoom](./simplex-pipeline.svg "SimplexViz 5-Stage Pluggable Pipeline")

At the geometry layer, `SimplexMeshStrategy` selects the most area-efficient 60° lattice orientation for the available viewport. Next, `SimplexClusteringStrategy` partitions tagged items, single- or multi-modal vector embeddings, or custom pairwise similarity matrices into balanced clusters, embedding their centroids onto mesh vertices via quadratic assignment.

Once cluster anchors are fixed, `SimplexColorStrategy` assigns high-contrast vertex hues in the perceptual OKLab color space [@ottosson-2020-oklab] and blends bridge items smoothly by their barycentric weights. `SimplexLayoutStrategy` then pairs a seeder, position-based dynamics (PBD) dispersion, and Separating Axis Theorem (SAT) hull checks to guarantee `0.0 px` overlap inside every triangle. Finally, `SimplexZoomStrategy` switches seamlessly between free-camera pan/zoom and conformal `1:4` sub-triangle drill-down with breadcrumb navigation:

1. **Adaptive Mesh (`SimplexMeshStrategy`):** Selects the highest-area 60° equilateral lattice orientation for the host viewport.
2. **Topic Clustering (`SimplexClusteringStrategy`):** Partitions items, embeddings, or similarity matrices onto balanced vertex anchors.
3. **Perceptual Coloring (`SimplexColorStrategy`):** Assigns high-contrast OKLab vertex hues and blends multi-tag bridge colors smoothly.
4. **Zero-Overlap Solver (`SimplexLayoutStrategy`):** Applies PBD dispersion and SAT hull separation to guarantee `0.0 px` card collisions.
5. **Conformal Zoom (`SimplexZoomStrategy`):** Transitions seamlessly between free camera panning and `1:4` hierarchical triangle drill-down.

Each strategy contract accepts plain TypeScript data structures so teams can replace individual stages without altering the SVG renderer.

## Three-Package TypeScript Architecture and Zero-Config Quickstart

SimplexViz separates pure geometric math from DOM rendering across three TypeScript packages: zero-dependency `@simplex-viz/core`, framework-agnostic `@simplex-viz/svg`, and declarative `@simplex-viz/react`. Each layer re-exports the helpers beneath it, so developers install only one package and render an interactive, overlap-free map with zero configuration.

![Three-layer TypeScript package architecture separating headless @simplex-viz/core math, framework-agnostic @simplex-viz/svg rendering, and @simplex-viz/react bindings](./package-architecture.svg "Three-Package TypeScript Architecture")

Because `@simplex-viz/core` has zero DOM, SVG, or React dependencies, the exact same layout solver runs identically in browser workers, Node.js servers, or static site generators across three layered packages:

- **`@simplex-viz/core`:** Headless geometry, clustering, OKLab mixing, and PBD/SAT solver running identically in Node.js or Web Workers.
- **`@simplex-viz/svg`:** Framework-agnostic DOM reconciliation controller (`createSimplexSvg`) with animated spring transitions.
- **`@simplex-viz/react`:** Declarative React wrapper (`<SimplexTopicGraph />`) with zero-config presets and tooltips.

Framework-agnostic applications mount directly with `createSimplexSvg` from `@simplex-viz/svg`, while React applications drop in `<SimplexTopicGraph />` from `@simplex-viz/react`:

```tsx caption="Zero-config React quickstart rendering an overlap-free topic map with SimplexTopicGraph"
import { SimplexTopicGraph } from '@simplex-viz/react';

const items = [
  { id: '1', label: 'Simplex Mesh', tags: ['geometry', 'triangulation'] },
  { id: '2', label: 'OKLab Mixing', tags: ['color', 'geometry'] },
  { id: '3', label: 'SAT Solver', tags: ['collision', 'geometry'] },
];

export function TopicMap() {
  return <SimplexTopicGraph items={items} preset="glyphs" tooltip />;
}
```

For static SVG export or server-side precomputation without a browser DOM, `@simplex-viz/core` also exposes `solveSimplexSnapshot(items, { width, height })` to return solved coordinates, OKLab colors, and verified zero-overlap metrics synchronously.

## Live Demo, GitHub Repository, and On-Site Integration

You can test SimplexViz immediately in the interactive [Live Demo](https://hackenberg.tech/simplex-viz/), inspect the full MIT-licensed TypeScript source code in the [GitHub repository](https://github.com/ghackenberg/simplex-viz), or see how the engine powers our own knowledge portfolio on the [SimplexViz Visualization](/visualizations/simplex-viz/) and [SimplexViz Project](/projects/simplex-viz/) pages.

In the standalone workbench, visitors can toggle presets (`geometric`, `glyphs`, `badges`), hot-swap all five pipeline stages in real time, and drill down `1:4` into individual topic triangles with `0` overlaps at `60 fps`. Upcoming deep-dive articles will unpack the barycentric embedding math, the composable SAT/PBD layout solver, and the conformal `1:4` hierarchical zoom mechanics in detail.
