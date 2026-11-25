---
title: "SimplexViz: Barycentric Knowledge Graph Engine"
trl: 7
description: "Open-source TypeScript simplex mesh library for multi-tag knowledge graphs with OKLab color blending, SAT packing, and 1:4 drill-down."
href: "https://hackenberg.tech/simplex-viz/"
repoName: "simplex-viz"
accentColor: "blue"
order: 3
pubDate: 2026-11-18
tags:
  - "data-visualization"
  - "knowledge-graphs"
  - "open-source"
  - "react"
  - "software-architecture"
  - "typescript"
image:
  src: "./preview.jpg"
  title: "SimplexViz: Interactive Barycentric Simplex Mesh Explorer"
  description: "Equilateral 60-degree simplex triangulation mesh with OKLab-tinted topic clusters, zero-overlap geometric content nodes, and live collision inspector"
screenshots:
  - src: "./preview-demo.png"
    title: "Barycentric Simplex Mesh & Geometry Inspector"
    description: "Interactive 60-degree equilateral triangle lattice displaying 8 topic clusters, 92 non-overlapping content nodes at 60 fps, and live rendering plugin crossfades"
challenge: "Traditional force-directed graph layouts collapse densely connected, multi-tag knowledge items into tangled hairballs where overlapping labels and unpredictable spring equilibria obscure semantic structure."
solution: "A deterministic, framework-agnostic TypeScript geometry kernel and SVG rendering engine (@simplex-viz/svg) that anchors topic clusters to a 60-degree equilateral simplex triangulation lattice, projects items via barycentric tag weights, and guarantees 0.0 px node overlap through Position-Based Dynamics and SAT hull dispersion."
keyCapabilities:
  - title: "60° Simplex Triangulation"
    description: "Anchors canonical topic clusters to an adaptive equilateral triangular lattice via Jaccard annealing, eliminating force-directed hairballs."
    icon: "📐"
  - title: "Zero-Overlap PBD & SAT"
    description: "Resolves node collisions to 0.0 px using Position-Based Dynamics and Separating Axis Theorem (SAT) hull checks inside each simplex."
    icon: "🎯"
  - title: "OKLab Perceptual Mixing"
    description: "Computes edge-contrast cluster hues and smoothly blends multi-tag item colors in perceptual OKLab space for dark and light themes."
    icon: "🎨"
  - title: "Conformal 1:4 Drill-Down"
    description: "Supports both continuous free-camera pan/zoom and discrete hierarchical 1:4 triangle subdivision for inspecting dense subspaces."
    icon: "🔍"
techStackHighlights:
  - category: "Core Engine & Geometry"
    technologies:
      - "TypeScript"
      - "Barycentric Coordinate Projection"
      - "Position-Based Dynamics (PBD)"
      - "Separating Axis Theorem (SAT)"
  - category: "Rendering & Color"
    technologies:
      - "Reconciled SVG Scene Graph"
      - "@simplex-viz/svg"
      - "OKLab Perceptual Color Space"
  - category: "Demo & Ecosystem"
    technologies:
      - "React"
      - "Vite"
      - "Open Source"
outcomes:
  - "Published as a modular, zero-dependency TypeScript SVG engine (@simplex-viz/svg) powering live interactive knowledge graph exploration."
  - "Achieves deterministic 0.0 px node overlap and smooth 60 fps spring transitions across dynamic item mutations."
  - "Integrated directly into this portfolio's interactive knowledge-graph workbench at /visualizations/simplex-viz/."
---

## 1. The Challenge

Multi-tag knowledge bases, research portfolios, and software catalogs rarely fit into strict tree hierarchies: a single article, project, or component frequently belongs to three or more overlapping domains. When rendered with classical force-directed physics, high-degree topic hubs pull shared items toward the center, producing dense visual "hairballs" with severe label occlusion and non-deterministic layouts that shift unpredictably on every reload or data mutation.

SimplexViz was engineered to solve this legibility bottleneck by replacing global spring-repulsion heuristics with a deterministic, geometry-first spatial model that preserves multi-tag membership without sacrificing zero-overlap clarity.

## 2. Architecture & Solution

SimplexViz decouples spatial computation from DOM rendering inside a clean, layered pipeline:

1. **Cluster Derivation & Adaptive Simplex Lattice**: Canonical topic clusters are derived from tag co-occurrence (Jaccard annealing) and anchored to the vertices of an aspect-aligned 60° equilateral triangular mesh (`createAdaptiveHexMeshStrategy`).
2. **Barycentric Projection & Zero-Overlap Dispersion**: Every content item is projected onto the convex hull of its active topic anchors using normalized tag weights. Iterative Position-Based Dynamics (PBD) paired with Separating Axis Theorem (SAT) hull checks then disperses neighboring items to guarantee `0.0 px` overlap.
3. **OKLab Perceptual Color Mixing**: Cluster vertices receive edge-contrasting hues, and multi-tag items blend their assigned cluster colors inside the perceptual OKLab color space, maintaining uniform contrast across both light and dark themes.
4. **Pluggable Rendering & Camera Strategies**: The `@simplex-viz/svg` controller reconciles a crisp SVG scene graph with `60 fps` spring transitions across three visual presets—`geometric` (rank-coded shapes), `glyphs` (multi-sector donuts), and `badges` (auto-sized cards)—while supporting both continuous free-camera navigation (`createFreeCameraZoomStrategy`) and discrete hierarchical `1:4` triangle subdivision (`createBarycentricZoomStrategy`).

Explore the live interactive integration on this site in the [SimplexViz Visualization Workbench](/visualizations/simplex-viz/).

## 3. Tech Stack & Libraries

The implementation separates pure geometric layout computation from DOM rendering and framework-specific UI chrome across three layers:

- **Core Geometry & SVG Engine**: Strict TypeScript (`@simplex-viz/svg`), reconciled SVG DOM scene graph, custom PBD/SAT collision solver, and OKLab color math.
- **Interactive Demo & Diagnostics**: React + Vite showcase application featuring live rendering-plugin crossfades, dynamic item mutation stress tests (`+1`/`+10` items), and a real-time collision/FPS inspector.
- **Host Integration**: Embedded directly in this Astro portfolio via a dedicated engine adapter (`src/content/visualizations/simplex-viz/engine.ts`) with touch direction-locking and drag-vs-click disambiguation.

## 4. Key Takeaways & Impact

SimplexViz demonstrates that deterministic simplex geometry can replace stochastic force-directed layouts for multi-tag knowledge exploration:

- **Deterministic Clarity**: Replacing chaotic force-directed physics with barycentric simplex projection makes multi-tag relationships immediately readable at a glance.
- **Guaranteed `0.0 px` Overlap**: Combining barycentric equilibrium with SAT-backed PBD keeps dense clusters legible even under dynamic item additions or size-multiplier scaling.
- **Production Integration**: Deployed both as a standalone interactive explorer ([hackenberg.tech/simplex-viz/](https://hackenberg.tech/simplex-viz/)) and as an integrated engine in the [SimplexViz Visualization Workbench](/visualizations/simplex-viz/).
