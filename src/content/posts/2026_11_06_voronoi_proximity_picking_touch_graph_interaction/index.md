---
title: "Voronoi Proximity Picking & Tooltip Repulsion in Graphs"
pubDate: 2026-11-06
description: "How we replaced fragile 8px hit tests with bounded Voronoi proximity picking, an 8px touch deadzone, and 8-sector tooltip repulsion across 5 graph engines."
inLanguage: "en"
tags:
  - data-visualization
  - human-computer-interaction
  - knowledge-graphs
  - typescript
  - web-development
image:
  src: "./hero.jpg"
  title: "Voronoi Proximity Picking and 8-Sector Tooltip Repulsion Blueprint"
  description: "Architectural blueprint on the Grünau im Almtal timber drafting table illustrating Voronoi proximity picking cells, an 8px touch deadzone gate, and 8-sector tooltip repulsion."
references:
  - id: "fitts-1954-information-capacity"
    type: "article"
    authors:
      - name: "Paul Morris Fitts"
    title: "The information capacity of the human motor system in controlling the amplitude of movement"
    journal: "Journal of Experimental Psychology"
    year: 1954
    volume: "47"
    number: "6"
    pages: "381--391"
    doi: "10.1037/h0055392"
    url: "https://doi.org/10.1037/h0055392"
  - id: "grossman-2005-bubble-cursor"
    type: "inproceedings"
    authors:
      - name: "Tovi Grossman"
      - name: "Ravin Balakrishnan"
    title: "The bubble cursor: enhancing target acquisition by dynamic resizing of the cursor's activation area"
    booktitle: "Proceedings of the SIGCHI Conference on Human Factors in Computing Systems (CHI '05)"
    year: 2005
    pages: "281--290"
    doi: "10.1145/1054972.1055012"
    url: "https://doi.org/10.1145/1054972.1055012"
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
---

**Bounded Voronoi Proximity Picking** replaces fragile `8px` geometry hit tests with unified `24px` mouse and `36px` touch capture radii across five heterogeneous graph engines [@fitts-1954-information-capacity; @grossman-2005-bubble-cursor]. Centralizing pointer arbitration in [`vis-tooltip.tsx`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/vis-tooltip.tsx) unifies hover, two-step touch tap, `8px` deadzone dragging, and 8-sector tooltip repulsion across SVG, Canvas, and WebGL [@bostock-2011-d3].

<!-- caption: "Cross-engine coordinate projection, native drag suppression, and inverse screen-to-graph mapping unified under bindProximityInteraction in vis-tooltip.tsx." -->
| Graph Engine | Screen Projection (`getScreenNodes`) | Native Drag Suppression | Inverse Drag Mapping (`onNodeDragMove`) |
| :--- | :--- | :--- | :--- |
| **[`d3/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/d3/engine.ts)** | `d3.zoomTransform(svg).apply([x, y])` [@bostock-2011-d3] | Omitted `d3.drag()` behavior on `<g>` nodes | `zoomT.invert([sx, sy])` via `screenToGraph` |
| **[`vis-network/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/vis-network/engine.ts)** | `network.canvasToDOM(positions[id])` | `interaction: { dragNodes: false, hover: false }` | `network.DOMtoCanvas({ x, y })` + `moveNode()` |
| **[`cytoscape/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/cytoscape/engine.ts)** | `node.renderedPosition()` | `autoungrabify: true, autounselectify: true` | `(s - pan) / zoom` via `renderedToModel` |
| **[`sigma/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/sigma/engine.ts)** | `sigma.graphToViewport({ x, y })` | Custom pointer capture overrides camera pan | `sigma.viewportToGraph({ x, y })` |
| **[`3d-force-graph/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/3d-force-graph/engine.ts)** | `graph.graph2ScreenCoords(x, y, z)` | `.enableNodeDrag(false)` + `controls.enabled = false` | `graph.screen2GraphCoords(sx, sy, dragDepth)` |

Decoupling target acquisition from renderer-specific hit buffers guarantees identical pointer ergonomics across 2D and 3D network layouts.

## Why Do Exact 8px Hit Tests Fail Fitts's Law on Mouse and Touch?

Exact `8px` node hit tests fail Fitts's Law because tiny visual targets inflate the index of difficulty $\text{ID} = \log_2(1 + D/W)$ during rapid cursor movement and finger touch [@fitts-1954-information-capacity]. By evaluating bounded Voronoi cells (`24px` mouse and `36px` touch radii) in `findNearest`, we unify hover, tap, and drag acquisition [@grossman-2005-bubble-cursor].

![Comparison between failing 8px exact node hit tests and bounded 24px mouse and 36px touch Voronoi proximity picking across five graph engines](./voronoi-capture-radius-unification.svg "Bounded Voronoi Proximity Picking vs. Exact 8px Hit Testing")

Under Fitts's formulation $\text{ID} = \log_2(1 + D/W)$, an `8px` node radius ($W = 16\text{px}$) forces users to decelerate sharply at the end of a ballistic movement, while human fingertips occlude the target completely [@fitts-1954-information-capacity]. Area cursors and the Bubble Cursor [@grossman-2005-bubble-cursor] resolve this bottleneck by expanding the effective target width $W$ to the nearest Voronoi cell boundary in screen space (`MOUSE_PROXIMITY_RADIUS = 24` and `TOUCH_PROXIMITY_RADIUS = 36`).

Crucially, early iterations only applied proximity picking to hover previews while leaving node dragging wired to each library's native `8px` geometry picker. That created a jarring interaction mismatch: a user could highlight a node from `20px` away, press the mouse button or touch the screen to drag it, and grab empty air because the native drag handler required an exact `8px` hit. We eliminated this split by disabling native node dragging across all five engines—omitting `d3.drag()` in [`d3/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/d3/engine.ts) [@bostock-2011-d3], setting `dragNodes: false` in [`vis-network/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/vis-network/engine.ts), setting `autoungrabify: true` in [`cytoscape/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/cytoscape/engine.ts), bypassing camera pan in [`sigma/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/sigma/engine.ts), and calling `.enableNodeDrag(false)` in [`3d-force-graph/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/3d-force-graph/engine.ts)—so `bindProximityInteraction` in [`vis-tooltip.tsx`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/vis-tooltip.tsx) drives hover, tap, and drag from the exact same `findNearest` query.

## How Does an 8px Drag Deadzone Reconcile Touch Scrolling with Node Dragging?

Mobile browsers abort pointer streams with `pointercancel` after roughly `5px` of vertical movement whenever `touch-action: pan-y` is enabled for page scrolling. We reconcile native vertical scrolling, two-step touch taps, and single-finger node dragging by combining `DRAG_DEADZONE_PX = 8`, selective `e.preventDefault()` on non-passive `touchmove`, and an `800ms` synthetic mouse guard in [`vis-tooltip.tsx`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/vis-tooltip.tsx).

![Touch interaction state machine reconciling vertical pan-y scrolling, two-step touch tap preview and navigation, and 8px deadzone node dragging](./touch-deadzone-state-machine.svg "8px Touch Deadzone State Machine and Gesture Arbitration")

Supporting three distinct touch intents on a single canvas requires careful event arbitration. When a finger touches empty canvas outside the `36px` Voronoi radius (`dragCandidate === null`), we never cancel `touchmove`, allowing the browser's compositor to scroll the page smoothly via `touch-action: pan-y`. When a finger lands inside a node's `36px` Voronoi cell, `onTouchStart` records `dragCandidate`; if movement remains within `DRAG_DEADZONE_PX = 8` on release, `handleTouchTap` executes our two-step tap flow (first tap reveals the tooltip and ego-network highlight; second tap on the active node or tooltip card navigates to the target URL). Once displacement exceeds `8px` with an active `dragCandidate`, the non-passive `touchmove` listener calls `e.preventDefault()` to lock out browser scrolling and streams inverse coordinates to `onNodeDragMove`:

```ts caption="Selective non-passive touchmove cancellation and 8px drag deadzone arbitration in src/commons/client/vis-tooltip.tsx."
// src/commons/client/vis-tooltip.tsx — 8px deadzone & selective touch scroll lock
if (Math.hypot(tx - downX, ty - downY) > DRAG_DEADZONE_PX) {
  dragMoved = true;
  if (dragCandidate && config.onNodeDragStart) {
    if (e.cancelable) {
      e.preventDefault();
    }
    if (!customDragActive) {
      customDragActive = true;
      hideInternal();
      config.onActiveNodeChange(dragCandidate.id);
      config.onNodeDragStart(dragCandidate, tx, ty);
    }
    config.onNodeDragMove?.(dragCandidate, tx, ty);
    return;
  }
}
```

In [`3d-force-graph/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/3d-force-graph/engine.ts), `onNodeDragStart` also sets `controls.enabled = false` so single-finger node dragging does not simultaneously orbit the Three.js camera, restoring `controls.enabled = true` on `onNodeDragEnd`. Furthermore, because mobile browsers synthesize compatibility `pointerdown`, `pointermove`, and `pointerup` events (`pointerType === 'mouse'`) hundreds of milliseconds after a touch tap, `bindProximityInteraction` records `lastTouchTime = performance.now()` and ignores non-touch events for `800ms` so synthetic mouse callbacks never immediately re-trigger navigation.

## How Does 8-Sector Angular Repulsion Prevent Tooltip Occlusion?

Static cursor-offset tooltips frequently cover the focused node's 1-hop neighbors, active ego-network edges, or container controls. Our `computeBestPosition` solver in [`vis-tooltip.tsx`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/vis-tooltip.tsx) evaluates eight compass candidate slots (`gap = 22px`) around the active node, minimizing a composite cost function over viewport boundaries, UI chrome rects, and incident neighbor edge rays.

![8-sector compass tooltip repulsion evaluating neighbor edge ray penalties and viewport clamping with 750ms sine-eased opacity transitions](./eight-sector-tooltip-repulsion.svg "8-Sector Compass Tooltip Repulsion and Neighbor Ray Cost Model")

When `showInternal` renders the Preact `VisNetworkTooltip` card, `findNearest` supplies the screen coordinates $(x, y)$ of the focused node alongside the projected screen coordinates $\{(x_i, y_i)\}$ of all connected 1-hop neighbors. For each of the eight compass candidates $c \in \{\text{N, NE, NW, E, W, SE, SW, S}\}$ with center $(c_x, c_y)$ and direction vector $\vec{u}_c = (c_x - x, c_y - y)$, `computeBestPosition` accumulates four penalty terms:

- **Directional Preference & Viewport Overflow**: Assigns a small top-first tie-breaking bias (`0` for `N` up to `8` for `S`) and adds `2000 + 25 * overflowPx` whenever a candidate box breaches the `12px` container padding.
- **UI Chrome Collision Avoidance**: Queries the live bounding rectangles of the domain legend (`.z-20:not(#layout-control-container)`) and layout switcher (`#layout-control-container`), adding `1800` if `rectsOverlap` detects an intersection.
- **Edge Midpoint & Neighbor Proximity**: Samples three points along each incident 1-hop edge ($t \in \{0.35, 0.68, 1.0\}$ with weights `220`, `220`, and `420`), penalizing both bounding-box overlap (`margin = 14px`) and radial proximity within `130px`.
- **Cosine Angular Alignment**: Computes the directional cosine similarity $\cos(\Delta\theta_i) = (\vec{u}_c \cdot \vec{e}_i) / (\|\vec{u}_c\| \|\vec{e}_i\|)$ against each incident edge vector $\vec{e}_i = (x_i - x, y_i - y)$ and adds $160 \cos(\Delta\theta_i)$ whenever $\cos(\Delta\theta_i) > 0.2$.

Selecting the minimum-penalty sector and clamping its coordinates within `[pad, clientDim - tooltipDim - pad]` anchors the card cleanly in the most open angular sector without cursor-tracking jitter. Finally, `animateOpacityTo` interpolates tooltip opacity over `HIGHLIGHT_TRANSITION_MS = 750` in lockstep with the graph's ego-network highlight transition, while [`3d-force-graph/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/3d-force-graph/engine.ts) fades the tooltip out immediately if the user orbits the 3D camera—completing the interactive architecture alongside [Focus-Aware Hop Attenuation](/posts/2026_11_04_focus_aware_hop_attenuation_knowledge_graphs/), [Five Graph Engines Unified Interaction Physics](/posts/2026_11_05_five_graph_engines_unified_interaction_physics/), [2D Elliptical Bin-Packing Tag Clouds](/posts/2026_10_17_elliptical_bin_packing_tag_cloud_layout_engine/), and our [Zero-innerHTML Preact UI Islands](/posts/2026_11_02_zero_innerhtml_architecture_preact_nanostores/) across the live [D3.js](/visualizations/d3/), [Vis-Network](/visualizations/vis-network/), and [3D Force-Graph](/visualizations/3d-force-graph/) canvases.
