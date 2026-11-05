---
title: "Five Graph Engines, One Interaction Physics: Unifying D3, Vis.js, Cytoscape, Sigma, and Three.js"
pubDate: 2026-11-05
description: "How we unified hover tooltips, 60fps drag physics, dynamic hop z-ordering, and 750ms sine-eased highlight transitions across D3.js SVG, vis-network, Cytoscape.js, Sigma.js WebGL, and Three.js 3d-force-graph."
inLanguage: "en"
tags:
  - data-visualization
  - knowledge-graphs
  - d3
  - cytoscape
  - threejs
image:
  src: "./hero.jpg"
  title: "Unified Interaction Physics Across Five Web Graph Engines"
  description: "Curved ultra-wide workstation monitor in the Grünau im Almtal timber office displaying five synchronized network rendering pipelines sharing a unified interaction physics kernel."
references:
  - id: "bostock-2011-d3"
    type: "article"
    authors:
      - name: "Michael Bostock"
      - name: "Vadim Ogievetsky"
      - name: "Jeffrey Heer"
    title: "D3: Data-Driven Documents"
    journal: "IEEE Transactions on Visualization and Computer Graphics"
    year: 2011
    volume: "17"
    number: "12"
    pages: "2301--2309"
    doi: "10.1109/TVCG.2011.185"
    url: "https://doi.org/10.1109/TVCG.2011.185"
  - id: "jacomy-2014-forceatlas2"
    type: "article"
    authors:
      - name: "Mathieu Jacomy"
      - name: "Tommaso Venturini"
      - name: "Sebastien Heymann"
      - name: "Michael Bastian"
    title: "ForceAtlas2, a Continuous Graph Layout Algorithm for Handy Network Visualization Designed for the Gephi Software"
    journal: "PLOS ONE"
    year: 2014
    volume: "9"
    number: "6"
    pages: "e98679"
    doi: "10.1371/journal.pone.0098679"
    url: "https://doi.org/10.1371/journal.pone.0098679"
  - id: "franz-2016-cytoscape-js"
    type: "article"
    authors:
      - name: "Max Franz"
      - name: "Christian T. Lopes"
      - name: "Gerardo Huck"
      - name: "Yue Dong"
      - name: "Onur Sumer"
      - name: "Gary D. Bader"
    title: "Cytoscape.js: a graph theory library for visualisation and analysis"
    journal: "Bioinformatics"
    year: 2016
    volume: "32"
    number: "2"
    pages: "309--311"
    doi: "10.1093/bioinformatics/btv557"
    url: "https://doi.org/10.1093/bioinformatics/btv557"
---

**Unified Multi-Engine Graph Physics** synchronizes hover tooltips, 60fps drag adaptation, dynamic hop z-ordering, and 750ms sine transitions across five heterogeneous web renderers, spanning D3.js SVG [@bostock-2011-d3], `vis-network` Canvas, Cytoscape.js Canvas [@franz-2016-cytoscape-js], Sigma.js WebGL [@jacomy-2014-forceatlas2], and Three.js `3d-force-graph`, by decoupling visual tokens in [`graph-payload.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts) and Preact overlays in [`vis-tooltip.tsx`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/vis-tooltip.tsx) from engine-specific draw loops.

<!-- caption: "Comparison of the five interactive graph engines across rendering pipelines, 60fps live drag solvers, and dynamic hop z-ordering strategies." -->
| Graph Engine | Render Pipeline | Live Drag Solver (`force` / `radial` & `columns`) | Z-Order Strategy |
| :--- | :--- | :--- | :--- |
| **[`d3/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/d3/engine.ts)** | Retained SVG DOM [@bostock-2011-d3] | Native `d3.forceSimulation` `alphaTarget(0.3)` / live `recomputeSlotTargets(true)` | `.sort()` on SVG `<line>` & `<g>` DOM nodes |
| **[`vis-network/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/vis-network/engine.ts)** | 2D HTML5 Canvas | Live `forceAtlas2Based` simulation / cubic-eased `animateTo()` slot interpolation | Sorting `network.body.edgeIndices` & `nodeIndices` |
| **[`cytoscape/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/cytoscape/engine.ts)** | 2D HTML5 Canvas [@franz-2016-cytoscape-js] | Auxiliary `d3.forceSimulation` coupled via `cy.batch()` / live `animateTo()` slots | Stylesheet `z-index` mapper on `displayZIndex` |
| **[`sigma/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/sigma/engine.ts)** | 2D WebGL Shaders | Per-frame `forceAtlas2.assign` [@jacomy-2014-forceatlas2] + 8% centroid shift / `animateTo()` | Graphology `zIndex` attributes (`zIndex: true`) |
| **[`3d-force/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/3d-force/engine.ts)** | Three.js WebGL | `d3ReheatSimulation()` on unpinned nodes / 3D cubic-eased `animateTo()` | True 3D WebGL depth buffer + $s^3$ volume scaling |

This five-engine matrix allows direct empirical comparison of SVG, HTML5 Canvas, and WebGL rendering pipelines under identical interaction physics.

## How Do We Unify Hover Tooltips and Styling Tokens Across Five Renderers?

We unify visual identity across all five engines by suppressing cluttered on-canvas text labels globally, reading centralized radii, stroke widths, and domain palettes from `getGraphStyleTokens` in [`graph-payload.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts), and mounting a shared Preact hover card via `createGraphTooltipController` in [`vis-tooltip.tsx`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/vis-tooltip.tsx) with deterministic viewport boundary clamping across every interactive graph container [@bostock-2011-d3; @franz-2016-cytoscape-js].

![Radial constellation of five graph engines sharing centralized style tokens and Preact viewport-clamped hover tooltips](./unified-tooltip-five-engines-constellation.svg "Five Graph Engines Sharing One Preact Tooltip and Token Kernel")

Rendering permanent text labels next to 100+ nodes turns dense knowledge graphs into illegible typographic noise, whereas native tooltip implementations diverge wildly across SVG, Canvas, and WebGL. By setting `label: ''` across D3, Vis.js, and Cytoscape, `renderLabels: false` in Sigma, and `.nodeLabel(() => '')` in `3d-force-graph`, we delegate all metadata inspection to [`vis-tooltip.tsx`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/vis-tooltip.tsx). In [`3d-force/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/3d-force/engine.ts), we explicitly mount `createGraphTooltipController(container)` *after* invoking `ForceGraph3D()(container)` so Kapsule's internal DOM initialization does not wipe the overlay element, and fall back to `graph2ScreenCoords(x, y, z)` whenever pointer capture precedes cursor movement.

## How Do We Achieve 60fps Drag Adaptation Without Camera Jumps?

Achieving 60fps drag adaptation without disorienting camera jumps requires coupling pinned node coordinates to live force simulations in `force` mode while gently recentering the graph centroid instead of invoking `fit()`, dynamically re-sorting angular and linear slots during `radial` and `columns` drags, and enforcing `touch-action: pan-y` on all 2D canvases [@bostock-2011-d3; @jacomy-2014-forceatlas2].

![60fps live drag physics with steady 8 percent centroid drift compensation and dynamic polar and column slot re-sorting](./sixty-fps-drag-steady-centroid.svg "60fps Drag Physics, Steady Centroid Framing, and Live Slot Re-Sorting")

Because Cytoscape's initial `cose` layout is static and Sigma's WebGL renderer lacks a built-in drag spring loop, we drive live `force` dragging in [`cytoscape/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/cytoscape/engine.ts) via an auxiliary `d3.forceSimulation` flushed inside `cy.batch()` and in [`sigma/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/sigma/engine.ts) by running two `forceAtlas2.assign` iterations per animation frame while locking the camera (`setCustomBBox`) and shifting unpinned nodes by 8% of mean centroid drift. In `radial` and `columns` modes, dragging a node recomputes normalized polar angles $\theta = \operatorname{atan2}(y - c_y, x - c_x)$ or column coordinates (`useCurrentOrder = true`) and smoothly animates peer nodes into newly vacated slots when the ordering signature changes:

```ts caption="Per-frame ForceAtlas2 drag solver with 8% mean centroid drift compensation in sigma/engine.ts."
// src/content/visualizations/sigma/engine.ts — 60fps ForceAtlas2 drag loop with steady centroid
const pinnedX = this.graph.getNodeAttribute(draggedNode, 'x') as number;
const pinnedY = this.graph.getNodeAttribute(draggedNode, 'y') as number;
forceAtlas2.assign(this.graph, { iterations: 2, settings: { gravity: 0.8, slowDown: 6 } });
this.graph.setNodeAttribute(draggedNode, 'x', pinnedX);
this.graph.setNodeAttribute(draggedNode, 'y', pinnedY);

let sumX = 0, sumY = 0, count = 0;
this.graph.forEachNode(nId => {
  sumX += (this.graph?.getNodeAttribute(nId, 'x') as number) || 0;
  sumY += (this.graph?.getNodeAttribute(nId, 'y') as number) || 0;
  count++;
});
const shiftX = (sumX / count) * 0.08, shiftY = (sumY / count) * 0.08;
this.graph.forEachNode(nId => {
  if (nId !== draggedNode) {
    this.graph?.setNodeAttribute(nId, 'x', (this.graph.getNodeAttribute(nId, 'x') as number) - shiftX);
    this.graph?.setNodeAttribute(nId, 'y', (this.graph.getNodeAttribute(nId, 'y') as number) - shiftY);
  }
});
this.sigma.refresh();
```

Subtracting 8% of mean centroid displacement per frame keeps the dragged sub-network centered within the locked viewport without triggering abrupt camera zoom resets.

## Why Are Dynamic Z-Ordering and 750ms Sine Transitions Essential for Readability?

Without dynamic z-ordering, dimmed background edges drawn later in canvas or SVG paint order slice across bright foreground hubs and active ego-network links; we eliminate this occlusion by sorting draw order through `getNodeHopZIndex` and `getEdgeHopZIndex` while interpolating colors and radii over a 750ms sine ease-in-out `requestAnimationFrame` loop [@franz-2016-cytoscape-js].

![Comparison between unsorted background edge occlusion and dynamic hop z-ordering with 750ms sine-eased transitions](./dynamic-hop-z-order-sine-transition.svg "Dynamic Hop Z-Stack and 750ms Sine Easing Loop")

When a user hovers or drags a node, [`graph-payload.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts) maps effective hop distances $d_{\text{eff}}$ to discrete z-layers (`40` for the focus node, `30` for 1-hop neighbors and incident edges, `20` for 2-hop, `10` for 3-hop, and `1` for background elements) and eases every node and link over `HIGHLIGHT_TRANSITION_MS = 750` via $e(p) = -\frac{1}{2}(\cos(\pi p) - 1)$:

- **D3.js SVG DOM**: Invokes `.sort()` on `linkElements` and `nodeElements` while guarding `isReorderingDom = true` so DOM mutation does not trigger spurious `mouseleave` events [@bostock-2011-d3].
- **vis-network & Cytoscape.js 2D Canvas**: Sorts `this.network.body.edgeIndices` and `nodeIndices` prior to `redraw()` in [`vis-network/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/vis-network/engine.ts), and batches `displayZIndex` data updates mapped to stylesheet `z-index` in [`cytoscape/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/cytoscape/engine.ts) [@franz-2016-cytoscape-js].
- **Sigma.js & Three.js WebGL**: Updates Graphology `zIndex` attributes (`zIndex: true`) in [`sigma/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/sigma/engine.ts) and scales 3D sphere volume by $s(d_{\text{eff}})^3$ in [`3d-force/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/3d-force/engine.ts) so Three.js sphere radius $r \propto \sqrt[3]{\text{val}}$ matches our 2D linear radius progression.

Coupling hop-sorted draw order with a 750ms sine-eased interpolation loop ensures that foreground ego-neighborhoods remain crisp and unoccluded across all five rendering technologies.
