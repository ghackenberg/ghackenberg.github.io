---
title: "Edge-Free Knowledge Graphs: OKLab & Cluster Pills"
pubDate: 2026-11-16
description: "How compressing 126 tags into 3D/2D cluster simplexes unlocks invisible springs, perceptual OKLab color blending, pill clearance zones, and N-gon content shapes."
inLanguage: "en"
tags:
  - data-visualization
  - knowledge-graphs
  - computer-graphics
  - human-computer-interaction
  - typescript
image:
  src: "./hero.jpg"
  title: "Edge-Free Knowledge Graph Cluster Simplex on Magnetic Glass Whiteboard"
  description: "Close-up of a wall-mounted magnetic glass whiteboard in the Grünau im Almtal timber office illustrating an edge-free knowledge graph with color-coded cluster pills and OKLab-blended polygon nodes"
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

Edge-free knowledge graphs replace cluttered node-link hairballs with invisible physics springs, macro topic cluster pills, and perceptual OKLab color blending. Compressing 126 individual tags into three 2D or four 3D cluster anchors eliminates crossing edges while encoding semantic membership through spatial proximity, hue mixing, and regular N-gon content shapes.

<!-- caption: "Comparison of the legacy 126-tag node-link graph and the edge-free cluster simplex architecture" -->
| Dimension | Legacy 126-Tag Node-Link Graph | Edge-Free Cluster Simplex |
| --- | --- | --- |
| Topic Anchors | 126 individual tag hubs | 3 in 2D (`K = 3`), 4 in 3D (`K = 4`), tunable `2..18` |
| Edge Rendering | Dense crossing web of visible links | Invisible physics springs; edges on hover only |
| Color Encoding | Discrete palette collisions | Perceptual OKLab weighted hue blending |
| Label Collision | Overlapping tag badges | Rectangular pill clearance (half-extents `79.5 x 17.2`) + `%` badge |
| Content Type Cue | Uniform circles | Regular N-gon shapes (`3` to `10` corners) |

## Why Do 126 Individual Tag Nodes Create Visual Hairballs?

Displaying all 126 canonical tags as independent graph hubs forces a high-dimensional semantic space onto a flat screen, producing severe edge crossings and overlapping labels. Controlled readability experiments show that dense node-link diagrams break down above roughly twenty vertices [@ghoniem-2004-graph-readability], obscuring both topic structure and individual items.

When every tag acts as a gravitational hub, items with five or six tags get pulled in conflicting directions across the canvas. Instead of revealing clean thematic neighborhoods, the force simulation settles into a tangled core where crossing lines dominate the viewer's visual field.

Alternative set-visualization techniques such as Bubble Sets [@collins-2009-bubble-sets] wrap scattered nodes in translucent isocontours without moving them. However, when more than a hundred overlapping tag sets coexist on a single canvas, stacked contours quickly turn opaque and obscure the underlying items.

## How Does Dimensional Compression Into 3 or 4 Cluster Simplexes Work?

Aggregating 126 tags into three macro clusters in 2D (`DEFAULT_TOPIC_CLUSTER_COUNT`) and four in 3D (`DEFAULT_TOPIC_CLUSTER_COUNT_3D`) maps topics onto a triangle or tetrahedron simplex. Content nodes float inside this clean geometric hull under invisible physics springs, while visitors can optionally refine granularity interactively across `K ∈ [2, 18]`.

![Comparison of 126 cluttered individual tag hubs against a clean 2D triangle simplex with K=3 clusters and a 3D tetrahedron simplex with K=4 clusters](./tag-compression-simplex.svg "Dimensional Compression into 2D Triangle and 3D Tetrahedron Simplexes")

Why three clusters in 2D and four in 3D? Three non-collinear anchors form the maximum simplex that spans a two-dimensional plane without interior crossings, while four non-coplanar anchors span three-dimensional space as a tetrahedron. In [`src/commons/shared/graph-payload.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts), `getDefaultTopicClusterCount` selects `3` for 2D renderers and `4` for 3D engines, while `reclusterCanonicalGraphPayload` lets users slide `K` anywhere between `2` and `18` at runtime.

Because the simplex vertices are well separated, the physics springs between content nodes and their matched clusters no longer need to be drawn as permanent lines. Spatial position alone communicates which macro themes an article or project bridges—items sitting near a vertex belong strongly to one cluster, while bridges rest along the edges or center.

## Why Does Perceptual OKLab Blending Need Few Cluster Hues?

Color mixing only communicates multi-topic membership when the human eye can still distinguish the underlying base hues. Blending three or four cluster anchors from `CLUSTER_PALETTE` inside the perceptual OKLab color space [@ottosson-2020-oklab] preserves vivid chroma and uniform lightness, whereas mixing 126 hues collapses immediately into muddy gray.

In standard sRGB, averaging complementary colors like sky blue and amber drops saturation and produces a dull brownish gray in the middle. By converting hex colors into OKLab via `hexToOklab`, computing a weighted average over cluster overlap ratios, and gently boosting chroma in `mixHexColorsOklab` inside [`src/commons/shared/graph-payload.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts), bridge nodes retain clean, readable intermediate hues.

Even in OKLab, perceptual blending has a strict cognitive ceiling. Three primary cluster hues (Sky, Amber, and Mint in 2D) or four (adding Rose in 3D) form a legible color gamut where every mixed node visibly reveals its dominant and secondary topic weights at a glance.

## Cluster Pills, Clearance Zones, and Equal-Area N-Gons

Removing visible edges shifts the burden of legibility onto node geometry and label spacing. Macro topic anchors render as rounded cluster pills with a rectangular clearance zone (`enforceClusterPillClearance2D`) and a docked percentage coverage badge, while the eight content collections use equal-area regular N-gon polygons from three to ten corners.

![Diagram showing OKLab weighted color blending, the cluster pill rectangular clearance zone with a docked percentage coverage badge, and regular N-gon content type shapes](./oklab-pill-clearance.svg "Perceptual OKLab Blending, Pill Clearance Zones, and N-Gon Shapes")

In [`src/commons/shared/graph-solvers.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-solvers.ts), `enforceClusterPillClearance2D` and `enforceClusterPillClearance3D` enforce a rectangular exclusion zone (`boxHalfW = 79.5`, `boxHalfH = 17.2`) around each cluster pill so content nodes never hide behind pill typography. Any colliding node is pushed outward along staggered candidate offsets just beyond the pill boundary.

During hover interaction, [`src/commons/client/vis-tooltip.tsx`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/vis-tooltip.tsx) docks an external `%` coverage badge beside each connected cluster pill and adds its width (`extraBadgeW`) to the tooltip's collision-avoidance bounding box. Meanwhile, `getContentGroupPolygonSides` and `getPolygonAreaRadiusScale` in [`src/commons/shared/graph-payload.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts) map the eight content types onto regular polygons (`3` to `10` sides) scaled to equal visual area so triangles never look smaller than circles.

## Honest Trade-Offs: Path Finding vs. Global Clarity

Edge-free layouts are not a universal replacement for explicit links. While removing static edges eliminates hairball clutter and clarifies macro topic clusters, node-link diagrams still excel at direct path-finding tasks [@ghoniem-2004-graph-readability], whereas edge-free layouts trade away permanent link tracing for global clarity. Hover ego-focus and dynamic connection reveals restore path inspection on demand without permanent visual noise.

For global exploration—scanning which themes dominate a portfolio or spotting cross-disciplinary bridges—hiding default edges dramatically improves scan speed and reduces cognitive load. When a visitor actually needs to trace exact connections from one article to its shared clusters and peer items, hovering or pinning a node temporarily illuminates its local neighborhood and percentage overlap badges.
