---
title: "SimplexViz: Barycentric Simplex Mesh Graph"
description: "Interactive 60° simplex mesh knowledge graph powered by @simplex-viz/svg with OKLab color blending, 0.0 px SAT packing, and 1:4 drill-down."
image:
  src: "./simplex-viz.png"
  title: "SimplexViz Barycentric Simplex Mesh"
  description: "Equilateral 60-degree simplex triangulation mesh with OKLab-tinted topic clusters and non-overlapping geometric content nodes on a dark background"
pubDate: 2026-11-18
tags:
  - data-visualization
  - knowledge-graphs
  - javascript
  - typescript
specs:
  renderingBackend: "Scalable Vector Graphics (Simplex SVG DOM)"
  spatialTopology: "2D Equivariant 60° Simplex Triangulation Mesh"
  nodeCapacity: "500+ Items (Reconciled SVG Scene Graph)"
  physicsSolver: "Position-Based Dynamics (PBD) & SAT Hull Dispersion"
  computationalComplexity: "O(N) Barycentric Projection + Iterative PBD"
  primaryStrength: "Zero-overlap 0.0 px hull packing, OKLab perceptual mixing & 1:4 conformal drill-down"
  tradeOff: "DOM SVG reconciliation scales best for focused to mid-sized knowledge graphs (< 1,000 items)"
  bestUseCase: "Multi-tag knowledge maps, topic-cluster exploration & hierarchical 1:4 subspace drill-down"
---

## Engine Overview

**SimplexViz** (`@simplex-viz/svg`) replaces traditional force-directed hairballs with a **60° equilateral simplex triangulation mesh**. Instead of letting edges pull nodes into tangled clusters, SimplexViz derives canonical topic clusters via Jaccard annealing, anchors each cluster to a vertex of a planar triangular lattice, and projects every content item into the mesh using its barycentric tag weights.

### Architectural Pipeline

The `@simplex-viz/svg` rendering pipeline combines geometric layout determinism with perceptual color theory:

- **Adaptive Hexagonal Mesh**: Generates an aspect-aligned 60° equilateral triangle lattice (`createAdaptiveHexMeshStrategy`) whose vertices serve as topic-cluster anchors.
- **Barycentric Projection & PBD Dispersion**: Projects multi-tag items onto the convex hull of their topic anchors and resolves overlaps to `0.0 px` via Position-Based Dynamics (PBD) and Separating Axis Theorem (SAT) hull checks.
- **OKLab Perceptual Mixing**: Computes edge-contrast cluster hues and blends item colors smoothly inside the perceptual OKLab color space.
- **Semantic Tag Split & Conformal 1:4 Drill-Down**: Uses `createSemanticZoomStrategy` by default to split focused triangles into sub-topic vertices by semantic tags, with `createBarycentricZoomStrategy` available as an alternative 1:4 drill-down mode.
- **Readable Tag Cluster Badges**: Defaults to the `badges` preset (`BadgeClusterSvgView`) so primary topic clusters and zoomed intermediate subclusters display readable tag labels with automatic `getBBox()` overlap-free packing.

### Engine Specifications

The table below summarizes the technical characteristics of the SimplexViz SVG engine:

<!-- caption: "Technical specifications and geometric rendering capabilities of the @simplex-viz/svg simplex mesh engine." -->
| Feature | Specification | Architectural Advantage |
| :--- | :--- | :--- |
| **Rendering Backend** | Reconciled SVG Scene Graph | Crisp vector typography and smooth 60 fps spring transitions |
| **Spatial Solver** | Barycentric + PBD Dispersion | Deterministic `0.0 px` node overlap without hairball tangles |
| **Color Model** | Perceptual OKLab Mixing | Uniformly legible cluster contrast in both dark and light themes |
| **Visual Presets** | Geometric, Glyphs, Badges | Switch between rank-coded shapes, sector donuts, and auto-sized cards |
| **Zoom Modes** | Free Camera & 1:4 Drill-Down | Continuous pan/zoom or conformal hierarchical triangle subdivision |

## Technical FAQ

The following answers explain how SimplexViz differs from force-directed graph engines, how it guarantees zero overlap, and when to choose it.

### How Does Barycentric Projection Prevent Force-Directed Hairballs?

Force-directed layouts balance spring attraction against global repulsion, which often collapses densely connected multi-tag nodes into an unreadable center. SimplexViz anchors topic clusters at fixed lattice vertices and computes each item's equilibrium directly from its normalized tag weights, guaranteeing spatial separation across triangles.

### How Does SimplexViz Guarantee Zero Node Overlap Inside Dense Triangles?

Even when multiple articles share identical tag distributions, SimplexViz runs Position-Based Dynamics (PBD) paired with Separating Axis Theorem (SAT) bounding checks after initial barycentric projection. Neighboring cards and badges disperse locally inside their host simplex until every viewport element achieves deterministic `0.0 px` overlap.

### When Should You Choose SimplexViz Over Force-Directed Graph Engines?

Choose **SimplexViz** when multi-tag membership, perceptual OKLab cluster coloring, and guaranteed zero-overlap legibility matter more than explicit link-line tracing. Compare its strengths against our force-directed and 3D visualization engines:

- **Zero-Overlap Multi-Tag Exploration**: Best suited for portfolios, taxonomies, and catalogs where items bridge two or three overlapping topic domains.
- **Complementary Engines**: Compare with [Cytoscape.js](/visualizations/cytoscape/) for shortest-path graph algorithms, [Sigma.js](/visualizations/sigma/) for 50,000+ WebGL nodes, [D3.js](/visualizations/d3/) for custom vector bindings, [Vis-Network](/visualizations/vis-network/) for spring physics, or [3D Force-Graph](/visualizations/3d-force-graph/) for volumetric Three.js rendering.
- **Deep-Dive Documentation**: Read [Introducing SimplexViz](/posts/2026_11_18_introducing_simplex_viz/) and inspect the [SimplexViz project page](/projects/simplex-viz/) for package architecture and React bindings.
