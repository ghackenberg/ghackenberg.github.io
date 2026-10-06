---
name: svg-graphics
description: Author, embed, and style deterministic inline SVG architecture diagrams, flowcharts, and technical schematics with adaptive light/dark themes.
---

# SVG Graphics (Deterministic Vector Architecture & Schematics)

This skill governs the creation, styling, and embedding of responsive, accessible inline SVG diagrams for architecture blueprints, execution pipelines, and technical schematics.

## 1. When to Use Inline SVG
- **Deterministic Layouts**: Multi-tier architecture diagrams, decision trees, control loops, and pipelines exceeding 4–5 nodes where Mermaid scaling breaks or lacks brand styling.
- **Visual Precision**: Exact coordinate control over node dimensions, connection paths, badges, icons, and micro-typography.
- **Escalation Target**: Primary escalation target from `mermaid-diagrams` when layout complexity demands responsive typography and custom themes.

## 2. Standard ViewBox & Responsive Sizing
Always configure explicit `viewBox` coordinates with responsive scaling:
- **Aspect & Dimensions**:
  - Wide Architecture Overview: `viewBox="0 0 880 380"` or `viewBox="0 0 880 440"`
  - Standard Technical Schematic: `viewBox="0 0 800 420"`
  - Compact Flow / Component Box: `viewBox="0 0 720 320"`
- **Container Sizing**: Set `width="100%"`, `height="auto"`, and `role="img"` on `<svg>`. Always supply descriptive `aria-label` or `<title>` for accessibility.
- **Safe Padding**: Keep at least 20px padding from canvas edges (e.g. min `x=24`, max `x=856` on 880-wide canvas) to prevent stroke clipping.

## 3. Typography & Font Hierarchy
Use system sans-serif fonts consistent with site typography:
- **Font Stack**: `font-family="Outfit, Inter, system-ui, -apple-system, sans-serif"`
- **Hierarchy**:
  - Section / Container Header: `font-size="14"`, `font-weight="700"`, letter-spacing `0.05em`, uppercase.
  - Primary Node Title: `font-size="13"` or `14"`, `font-weight="600"`.
  - Secondary Metadata / Subtitle: `font-size="11"` or `12"`, `font-weight="400"`.
  - Badges / Status Pills: `font-size="10"`, `font-weight="600"`.
- **Text Alignment**: Use `text-anchor="middle"` for centered node labels, `dominant-baseline="central"` or `dominant-baseline="middle"` for vertical centering.

## 4. Brand Color Tokens & Node Archetypes
All colors and visual archetypes are centralized in `public/styles/graphics.css`. Every SVG imports these tokens to guarantee seamless dark/light theme switching:
- **Blue Archetype (`--svg-node-blue-*`)**: Orchestration, control planes, invariant monitoring, computation.
- **Purple Archetype (`--svg-node-purple-*`)**: Probabilistic execution, autonomous ReAct loops, planning.
- **Amber Archetype (`--svg-node-amber-*`)**: Fail-safe subsystems, human verification gates, alerts, fallback paths.
- **Green Archetype (`--svg-node-green-*`)**: Verified states, audited outcomes, persistent storage, safe delivery.
- **Red Archetype (`--svg-node-red-*`)**: Errors, violations, strict alerts, and terminal failure paths.

## 5. Centralized Theme Contract (`/styles/graphics.css`)
Inline and standalone SVGs must import the centralized stylesheet. Hardcoded `#...` hex colors on diagram elements are strictly prohibited and enforced by `npm run lint:svgs`:
- **Centralized Import Block**: Embed a `<style>` block inside `<svg><defs>`:
  ```xml
  <defs>
    <style>
      @import url('/styles/graphics.css');
    </style>
  </defs>
  ```
- **Standardized Design Tokens**:
  - **Canvas & Containers**:
    - `fill="var(--svg-bg)"`: Canvas outer background.
    - `fill="var(--svg-card)"` / `stroke="var(--svg-border)"`: Standard card frames.
    - `fill="var(--svg-card-alt)"`: Sub-container or boundary background.
    - `stroke="var(--svg-line)"`: Separator lines and subtle dividers.
    - `fill="var(--svg-pill-bg)"`: Category badge and pill background.
  - **Typography**:
    - `fill="var(--svg-text-primary)"`: Primary headings and node titles.
    - `fill="var(--svg-text-secondary)"`: Subtitles, descriptions, and labels.
    - `fill="var(--svg-text-muted)"`: Captions, timestamps, and metadata.
  - **Node Archetype Tokens**:
    - Backgrounds: `var(--svg-node-blue-bg)`, `var(--svg-node-purple-bg)`, `var(--svg-node-amber-bg)`, `var(--svg-node-green-bg)`.
    - Borders: `var(--svg-node-blue-border)`, `var(--svg-node-purple-border)`, `var(--svg-node-amber-border)`, `var(--svg-node-green-border)`.
    - Titles: `var(--svg-node-blue-text)`, `var(--svg-node-purple-text)`, `var(--svg-node-amber-text)`, `var(--svg-node-green-text)`.
    - Subtext / Bullet Points: `var(--svg-node-blue-subtext)`, `var(--svg-node-purple-subtext)`, `var(--svg-node-amber-subtext)`, `var(--svg-node-green-subtext)`.

## 6. Markers, Connectors & Connective Elements
- **Arrowhead Markers**: Define arrow markers in `<defs>` using archetype tokens:
  ```xml
  <marker id="arr-blue" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--svg-node-blue-border)" />
  </marker>
  ```
- **Connectors**:
  - Use `<path>` with orthogonal routing (`d="M ... H ... V ..."` or smooth bezier curves `d="M ... C ..."`).
  - Stroke: `stroke="var(--svg-node-blue-border)"`, `stroke-width="1.5"` or `2`.
  - Dashed lines for fallback or asynchronous signals: `stroke-dasharray="4,3"`.
  - Connective pills: Use archetype background and border tokens for "OK", "VERLETZUNG", or status chips.

## 7. Clean Output & Linting Checklist
1. Import `@import url('/styles/graphics.css');` inside `<defs><style>`.
2. Zero hardcoded hex colors (`#...`) in `fill` or `stroke` attributes on graphical elements (enforced by `npm run lint:svgs`).
3. Text blocks use explicit `x` and `y` baseline coordinates without overlapping.
4. Node rectangles use rounded corners (`rx="6"` to `rx="10"`).
5. All elements have distinct IDs or semantic class names.
6. Run `npm run lint:svgs` to guarantee compliance.
