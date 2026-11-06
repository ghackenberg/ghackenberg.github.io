---
title: "Focus-Aware Hop Attenuation in Web Knowledge Graphs"
pubDate: 2026-11-04
description: "How we replaced unweighted k-hop BFS with focus-budgeted effective hop distances, logarithmic hub-degree penalties, and parametric decay in web graphs."
inLanguage: "en"
tags:
  - knowledge-graphs
  - data-visualization
  - cognitive-ergonomics
  - typescript
image:
  src: "./hero.jpg"
  title: "Focus-Aware Hop Attenuation in Interactive Knowledge Graphs"
  description: "Ego-neighborhood rings and parametric decay curves illustrating focus budgets and logarithmic hub penalties in knowledge graph navigation."
references:
  - id: "furnas-1986-fisheye-views"
    type: "inproceedings"
    authors:
      - name: "George W. Furnas"
    title: "Generalized Fisheye Views"
    booktitle: "Proceedings of the SIGCHI Conference on Human Factors in Computing Systems (CHI '86)"
    year: 1986
    pages: "16--23"
    doi: "10.1145/22627.22342"
    url: "https://doi.org/10.1145/22627.22342"
  - id: "barabasi-1999-scaling-random-networks"
    type: "article"
    authors:
      - name: "Albert-László Barabási"
      - name: "Réka Albert"
    title: "Emergence of Scaling in Random Networks"
    journal: "Science"
    year: 1999
    volume: "286"
    number: "5439"
    pages: "509--512"
    doi: "10.1126/science.286.5439.509"
    url: "https://doi.org/10.1126/science.286.5439.509"
  - id: "herman-2000-graph-visualization-survey"
    type: "article"
    authors:
      - name: "Ivan Herman"
      - name: "Guy Melançon"
      - name: "M. Scott Marshall"
    title: "Graph Visualization and Navigation in Information Visualization: A Survey"
    journal: "IEEE Transactions on Visualization and Computer Graphics"
    year: 2000
    volume: "6"
    number: "1"
    pages: "24--43"
    doi: "10.1109/2945.841119"
    url: "https://doi.org/10.1109/2945.841119"
---

Focus-aware hop attenuation is a degree-of-interest graph rendering heuristic that replaces integer breadth-first search steps with a continuous effective hop distance $d_{\text{eff}} \in [0, 4]$ [@furnas-1986-fisheye-views; @herman-2000-graph-visualization-survey]. Implemented in [`graph-payload.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts), it bounds ego-network expansion via a 16-node focus budget, logarithmic hub penalties, and parametric power-decay curves.

<!-- caption: "Comparison of graph ego-network highlighting strategies across distance metrics, scale-free hub behavior, and visual retention profiles." -->
| Highlighting Strategy | Distance Metric | Scale-Free Hub Behavior | Visual Retention Profile |
| :--- | :--- | :--- | :--- |
| **1-Hop Binary Highlighting** | Discrete $d \in \{0, 1, \infty\}$ | Collapses on popular tag hubs; hides indirect semantic bridges | Binary step function (full opacity vs. uniform dimming) |
| **Unweighted $k$-Hop BFS** | Integer shortest path $d \in \{0..4\}$ | Small-world explosion floods $>80\%$ of the graph at $d = 2$ [@barabasi-1999-scaling-random-networks] | Linear or uniform shell decay without density awareness |
| **Focus-Aware Effective Distance (`graph-payload.ts`)** | Continuous $d_{\text{eff}} \in [0, 4]$ with `focusBudgetNodes: 16` | Logarithmic hub penalty ($\log_2(\text{deg} / 4)$) pushes hub children outward | Coupled power-decay curves $f(d_{\text{eff}})$ across scale, color, and edges |

The contrast across these three strategies illustrates why density-aware distance modulation is mandatory for interactive portfolio graphs.

## Why Does Unweighted Breadth-First Search Fail in Hub-Heavy Knowledge Graphs?

Unweighted breadth-first search fails in bipartite content-tag knowledge graphs because scale-free tag hubs create a small-world fan-out explosion within two hops [@barabasi-1999-scaling-random-networks]. When an interactive viewer highlights all nodes at integer distance $d \le 2$ equally, a single high-degree hub illuminates almost the entire graph and destroys visual figure-ground separation [@herman-2000-graph-visualization-survey].

In our portfolio graph, articles, publications, and courses connect through shared taxonomic tags. While specific engineering tags connect 2–4 artifacts, foundational hubs like `#Software-Architecture` or `#Artificial-Intelligence` link dozens of nodes. Under naive $k$-hop traversal, stepping from a post into a hub at $d=1$ immediately pulls every sibling artifact into shell $d=2$ at identical visual salience.

![Comparison between unweighted 2-hop BFS hub explosion flooding over 80 percent of the graph and focus-aware fisheye degree-of-interest attenuation stretching crowded hubs outward](./unweighted-bfs-vs-fisheye-doi.svg "Unweighted BFS Hub Explosion vs. Focus-Aware Fisheye DOI Attenuation")

To preserve cognitive ergonomics without severing multi-hop exploration, we adapt Furnas's Generalized Fisheye Degree-of-Interest ($DOI$) decomposition [@furnas-1986-fisheye-views]. Rather than treating topological distance as an unweighted integer, [`computeHopDistances`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts) stretches effective distance $d_{\text{eff}}$ whenever a path traverses a crowded shell or high-degree hub.

## How Do Focus Budgets and Hub Penalties Shape Effective Hop Distance?

In [`computeHopDistances`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts), effective hop distance $d_{\text{eff}}$ combines three deterministic regulators: a 16-node cumulative focus budget (`focusBudgetNodes: 16`), a logarithmic step penalty for parent hubs exceeding degree 4 (`hubDegreeBaseline: 4`), and a shared-parent multi-path discount (`/ sharedParents`) that preserves tightly coupled semantic clusters.

![Three deterministic regulators of effective hop distance in computeHopDistances: 16-node focus budget, logarithmic hub degree penalty, and shared-parent triangulation discount](./focus-budget-hub-penalty-triangulation.svg "Focus Budget, Logarithmic Hub Penalty, and Multi-Path Triangulation")

First, if direct 1-hop neighbors exceed `directHubSoftThreshold: 8`, shell 1 receives a crowding offset $d_{\text{eff}, 1} = 1 + 0.60 \cdot \text{clamp}((\lvert S_1 \rvert - 8) / 16, 0, 1)$. For outer shells $d \in \{2..4\}$, each candidate parent $u \in S_{d-1}$ incurs a logarithmic degree penalty above baseline 4, while multiple shared parents divide the excess penalty and `budgetDist` enforces the 16-node focus horizon:

```typescript caption="Logarithmic hub degree penalty and shared-parent triangulation discount in computeHopDistances."
const stepCost =
  1 +
  HOP_ATTENUATION_CONFIG.hubPenaltyWeight *
    Math.log2(
      Math.max(HOP_ATTENUATION_CONFIG.hubDegreeBaseline, degU) /
        HOP_ATTENUATION_CONFIG.hubDegreeBaseline
    );
const candidateCost = (minPathCost.get(u) ?? (d - 1)) + stepCost;
if (candidateCost < bestParentCost) {
  bestParentCost = candidateCost;
}
// After evaluating all parent neighbors u in shell d - 1:
const parentCount = Math.max(1, sharedParents);
const resolvedBestCost = Number.isFinite(bestParentCost) ? bestParentCost : d;
const hubAdjustedDist = d + Math.max(0, resolvedBestCost - d) / parentCount;
const dEff = Math.max(hubAdjustedDist, budgetDist);
```

Dividing the hub penalty excess $\max(0, \text{resolvedBestCost} - d)$ by `parentCount` rewards triangulation: an artifact sharing three tags with the focused node remains visually close even if one of those tags is a broad hub.

## Coupling Node Scale and Color Retention via Parametric Power Curves

Once [`computeHopDistances`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts) assigns an effective distance $d_{\text{eff}}$ to every reachable node, [`computeHopCurve`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts) maps $d_{\text{eff}} \in [0, D_{\max}]$ onto continuous visual channels using a bounded power-decay law $f(d_{\text{eff}}) = f_{\min} + (f_{\max} - f_{\min})(1 - (d_{\text{eff}} / D_{\max})^{\gamma})$ that smoothly couples node scale, foreground color retention, and edge stroke width across both light and dark themes.

![Parametric power-decay curves coupling node scale, foreground color retention, edge stroke width, and discrete z-index layers over effective hop distance](./parametric-power-decay-curves.svg "Coupled Parametric Power-Decay Curves and Hop Z-Index Layers")

In [`HOP_ATTENUATION_CONFIG`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts), each visual channel is parameterized with a tailored range and concavity exponent $\gamma > 1$ over $D_{\max} = 4$:

- **Node Scale (`getAttenuatedNodeScale`)**: Decays from $f_{\max} = 2.10\times$ at the focused node ($d_{\text{eff}} = 0$) down to $f_{\min} = 0.40\times$ at $d_{\text{eff}} \ge 4$ with exponent $\gamma = 1.25$.
- **Node Color Retention (`getAttenuatedNodeColor`)**: Interpolates foreground hex color against the active light/dark canvas background via `blendHexColor` from $1.0$ down to $0.20$ ($\gamma = 1.35$).
- **Edge Width & Retention (`getAttenuatedEdgeStyle`)**: Scales stroke width from $3.0\text{ px}$ to $0.80\text{ px}$ ($\gamma = 1.10$) and color retention from $1.0$ to $0.18$ ($\gamma = 1.20$) using shifted hop distance $\max(0, \max(d_{\text{src}}, d_{\text{tgt}}) - 1)$.
- **Depth-Ordered Z-Indexing (`getNodeHopZIndex`)**: Assigns discrete layer priorities ($40 \rightarrow 30 \rightarrow 20 \rightarrow 10 \rightarrow 1$) so foreground ego-neighborhoods always render above attenuated background shells during $750\text{ ms}$ cosine-eased transitions.

Together, these coupled power curves and discrete z-index layers guarantee that hovering or dragging any node produces a clear, flicker-free ego-neighborhood spotlight across every visualization engine—building upon our [May 2026 Interactive Graph Visualizations Update](/posts/2026_05_27_interactive_graph_visualizations_update/) and [2D Elliptical Bin-Packing Tag Cloud Layout Engine](/posts/2026_10_17_elliptical_bin_packing_tag_cloud_layout_engine/), while laying the mathematical foundation for [Five Graph Engines Under One Interaction Physics Contract](/posts/2026_11_05_five_graph_engines_unified_interaction_physics/), [Voronoi Proximity Picking and 8-Way Tooltip Placement](/posts/2026_11_06_voronoi_proximity_picking_touch_graph_interaction/), and live exploration in our [Cytoscape.js](/visualizations/cytoscape/) and [Sigma.js WebGL](/visualizations/sigma/) sandboxes.
