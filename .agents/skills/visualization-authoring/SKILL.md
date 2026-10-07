---
name: visualization-authoring
description: Author, structure, and document interactive data visualizations, WebGL graph engines, Canvas simulations, and vector charts in strict English.
---

# Visualization Authoring (Interactive Graphics & Graph Engines)

This skill governs the creation, documentation, and technical benchmarking of interactive visualizations and graphics engines in `src/content/visualizations/`.

## 1. Directory Structure & Schema
Every visualization entry lives under `src/content/visualizations/<slug>/`:
- File: `src/content/visualizations/<slug>/index.md` or `index.mdx`.
- Frontmatter schema (`src/content.config.ts`):
  ```yaml
  title: "Three.js: 3D Force-Directed Graph"
  description: "GPU-accelerated force-directed 3D network visualization leveraging Three.js WebGL rendering and spatial force simulation."
  screenshot:
    src: "./preview.png"
    title: "3D Force Graph Preview"
    description: "Orbital perspective of interconnected 3D nodes and glowing edge lines on a dark canvas"
  tags:
    - data-visualization
    - webgl
    - threejs
  pubDate: 2026-05-27
  ```

## 2. Core Language & Tone Rules
- **Strict English**: All visualization overviews, architectural documentation, and technical summaries must be written in English (`en`).
- **Answer-First Explanations**: Open with a high-density paragraph explaining the graphics pipeline, underlying math, or layout simulation engine.

## 3. Interaction Ergonomics & Motion Rules
When building or embedding interactive Canvas/WebGL viewports:
- **No Scroll-Trapping**: Interactive canvases must not trap native vertical page scrolling on touch devices.
- **8px Direction-Locking Contract**: Evaluate touch gestures immediately upon movement. If $|\Delta Y| > |\Delta X|$ at the 8px threshold, immediately yield gesture control to native page scrolling and lock the canvas interaction. If $|\Delta X| > |\Delta Y|$, lock the canvas horizontally and prevent vertical scrolling.
- **Drag vs. Click Disambiguation**: When interactive nodes are clickable links or inspectable modals, suppress click events if the pointer displacement exceeds 12px during the gesture.
- **Perceptual Stability**: Interactive visual states (hover, camera zoom, focus tiers) must never resize neighboring DOM layout rows or cause Cumulative Layout Shifts (CLS).

## 4. Verification Gate
Visualization entries and interactive engines are verified during the master release verification gate (see `build-engineering`).
