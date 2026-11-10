---
name: visualization-authoring
description: Author, structure, and document interactive data visualizations, WebGL graph engines, Canvas simulations, and vector charts in strict English.
---

# Visualization Authoring (Interactive Graphics & Graph Engines)

This skill governs the creation, documentation, and technical benchmarking of interactive visualizations and graphics engines in `src/content/visualizations/`.

## 1. Directory Structure & Schema
Every visualization entry lives under `src/content/visualizations/<slug>/`:
- File: `src/content/visualizations/<slug>/index.md` or `index.mdx` paired with `src/content/visualizations/<slug>/engine.ts`.
- Frontmatter schema ([`src/content.config.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content.config.ts)):
  ```yaml
  title: "Three.js: 3D Force-Directed Graph"
  description: "GPU-accelerated force-directed 3D network visualization leveraging Three.js WebGL rendering and spatial force simulation."
  image:
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

## 4. Shared Architecture & Parity Contract
All interactive graph engines must maintain 100% mathematical parity between static build layouts and live client interactions:
- **Unified Layout Solvers**: Share deterministic build-time and live client solvers via [`src/commons/shared/graph-solvers.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-solvers.ts), consumed identically by [`src/commons/server/graph-layout-endpoint.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/graph-layout-endpoint.ts) and all 5 engines in `src/content/visualizations/<slug>/engine.ts`. Live `#tune-hud` physics sliders must invoke time-sliced non-blocking `solve*LayoutAsync` generators (`<= 8.5 ms` frame budget with stale-generation cancellation) to prevent main-thread freezes.
- **Shared Payload & Reference Geometry**: Centralize graph payloads, ego-network hop attenuation, canonical style tokens, tuning state (`GraphTuningState`), and fixed radial reference bounds (`getRadialReferenceBounds2D`) in [`src/commons/shared/graph-payload.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts).
- **Calibrated Drag & Tooltip Controllers**: Delegate 2D/3D equilibrium-calibrated node dragging and neighborhood reconfiguration to [`src/commons/client/graph-drag-controller.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/graph-drag-controller.ts), and render focus/hover overlays via the shared Preact HUD in [`src/commons/client/vis-tooltip.tsx`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/vis-tooltip.tsx).
- **Strict Client Privacy**: Enforce zero `localStorage` or `sessionStorage` usage across all visualization client and shared modules.

## 5. Verification & Performance Benchmarking
Run the three local verification and benchmark gates in PowerShell before relying on the master release verification gate (see `build-engineering`):
```powershell
npm run validate:vis
npm run test:vis:e2e
npm run benchmark:vis
```
- **`npm run validate:vis`** ([`src/scripts/validate-visualizations.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/validate-visualizations.ts)): Deterministic Node.js gate (also executed in GitHub Actions CI via `validate`) verifying storage privacy, solver cluster separation (`>= 1.9x`), geometry layouts, tuning reset determinism, and 2D/3D drag reconfiguration.
- **`npm run test:vis:e2e`** ([`src/scripts/test-visualizations-e2e.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/test-visualizations-e2e.ts)): Local pre-release browser E2E gate executing 25 Puppeteer UI and WebGL checks across all 5 graph engines on real hardware (`-- --ci` remains available for headless ANGLE SwiftShader environments).
- **`npm run benchmark:vis`** ([`src/scripts/benchmark-visualizations.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/benchmark-visualizations.ts)): Local hardware 60 FPS and P95/Max frame-time benchmark across `idle`, `hover`, `drag`, `layout`, and `tuning`.
