---
name: svg-graphics
description: Author, embed, and style deterministic standalone SVG architecture diagrams, flowcharts, and technical schematics with adaptive light/dark themes.
---

# SVG Graphics (Deterministic Vector Architecture & Schematics)

This skill governs the creation, styling, and embedding of responsive, accessible standalone `.svg` diagrams for architecture blueprints, execution pipelines, and technical schematics.

## 1. Standalone `.svg` Files & Mental-Model Visual-First Rule
- **Mandatory Standalone `.svg` Files (Zero Inline `<svg>` in Markdown)**: Save every SVG diagram as a standalone `.svg` file co-located in the content directory (e.g. `src/content/posts/<slug>/<diagram-name>.svg`) and embed it via standard Markdown image syntax with distinct caption and title:
  `![Descriptive caption explaining the visual topology](./<diagram-name>.svg "Concise Distinct Diagram Title")`
  Never embed raw `<svg>` tags directly inside `.md` or `.mdx` content files (blocked deterministically by `npm run lint:posts`).
- **Mental-Model Visual-First & Semantic Iconography Rule**: Rather than cramming an entire post into a single abstract diagram or nesting boxy `<rect>` containers inside containers, create **focused, per-section SVGs** (`1` focused SVG per major `##` section) using **recognizable semantic vector iconography** (e.g. document sheets, person silhouettes, 3D isometric cubes, shield/check emblems, hexagonal hubs, and directional flow ribbons drawn with `<path>`, `<circle>`, `<polygon>`, `<line>`) paired with **concise 1–3 word labels**. Avoid nested rectangular container boxes ("no box-in-box-in-box"); separate zones with subtle curved horizon arcs or open whitespace.
- **Escalation Target**: Primary escalation target from `mermaid-diagrams` when layout complexity exceeds 5 nodes or demands custom coordinate geometry and adaptive themes.

## 2. Standard ViewBox & Responsive Sizing
Always configure explicit `viewBox` coordinates with responsive scaling:
- **Primary Standard — Mobile-First Square (`viewBox="0 0 480 480"`, `1:1` Aspect Ratio)**:
  - **Standard Post & Article Illustration**: `viewBox="0 0 480 480"` (or `640 640` when higher density is required).
  - **Font-Size-Relative Desktop `max-width` & Mobile Ergonomics**: On a `340px` mobile viewport, a `480x480` ($1:1$) canvas scales by $0.71\times$ so `13px–16px` labels remain crisp and legible. On wide desktop screens, `src/plugins/rehype-inline-svg.ts` automatically computes the median `<text>` `font-size` inside each SVG and caps the `<figure class="svg-diagram">` wrapper width (`style="max-width: ...px"` with `mx-auto`) so rendered diagram text targets $\approx 13\text{px}$ rather than inflating to oversized proportions across the full article column.
  - **Slide-Deck Wide Exception**: Wide aspect ratios (`viewBox="0 0 800 420"` or `880 380`) should only be used when embedding inside landscape `16:9` presentation slides.
- **Root `<svg>` Attributes**: Include `xmlns="http://www.w3.org/2000/svg"`, `width="100%"`, `height="auto"`, `role="img"`, and a descriptive `aria-label` on the root `<svg>`.
- **Safe Padding**: Keep at least 20px–24px padding from canvas edges (e.g. min `x=20`, max `x=460` on a `480`-wide canvas) to prevent stroke clipping.

## 3. Typography & Font Hierarchy
Use system sans-serif fonts consistent with site typography:
- **Font Stack**: `font-family="Outfit, Inter, system-ui, -apple-system, sans-serif"`
- **Hierarchy (for `480x480` Mobile-First Canvas)**:
  - Section / Zone Header: `font-size="15"` to `"17"`, `font-weight="700"`, letter-spacing `0.05em`, uppercase.
  - Primary Node Title: `font-size="14"` to `"16"`, `font-weight="700"`, 1–3 words maximum.
  - Secondary Metadata / Subtitle: `font-size="12"` to `"13"`, `font-weight="500"` or `"600"`, concise metric or token name (never below `11.5` on `480x480` canvases).
  - Badges / Status Pills: `font-size="11.5"` to `"12.5"`, `font-weight="700"`.
- **Text Alignment**: Use `text-anchor="middle"` for centered node labels, `dominant-baseline="central"` or `dominant-baseline="middle"` for vertical centering.
- **Horizontal Character-Width Budget**: In `Outfit`/`Inter`, average proportional character advance is $\approx 0.56 \times \text{font-size}$ (up to $\approx 0.62 \times \text{font-size}$ for uppercase/bold or `letter-spacing`). Ensure every `<text>` element maintains at least `12px–14px` horizontal padding inside its enclosing `<rect>` container (`x_left + text_width <= rect_right - 12`). Never place multi-sentence paragraphs inside `<text>` nodes. Enforced deterministically by `npm run lint:svgs`.

## 4. Dual Orthogonal Token Families (`src/styles/graphics.css`)
All colors are centralized in [src/styles/graphics.css](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/styles/graphics.css) and calibrated to the Soft Nordic Pastel light/dark palette via two independent token families:
- **Family B — Semantic Status & Architectural Node Archetypes (`--svg-node-{blue,purple,amber,green,red}-{bg,border,text,subtext}`)**:
  - **Blue (`--svg-node-blue-*`)**: Orchestration, control planes, invariant monitoring, computation (`note` parity).
  - **Purple (`--svg-node-purple-*`)**: Probabilistic execution, autonomous ReAct loops, planning (`important` parity).
  - **Amber (`--svg-node-amber-*`)**: Fail-safe subsystems, human verification gates, warnings, fallback paths (`warning` parity).
  - **Green (`--svg-node-green-*`)**: Verified states, audited outcomes, persistent storage, safe delivery (`tip` parity).
  - **Red (`--svg-node-red-*`)**: Errors, violations, strict alerts, and terminal failure paths (`caution` parity).
- **Family A — 10-Stop Aurora Domain Spectrum (`--svg-accent-{1..10}-{bg,border,text,subtext}`)**:
  - Dedicated ordinal spectrum stops rotating across `164°` Soft Sage (`--svg-accent-1-*`, Brand), `176°` Misty Teal (`--svg-accent-2-*`, Posts), `190°` Dusty Cyan (`--svg-accent-3-*`, Publications), `204°` Slate Sky (`--svg-accent-4-*`, Presentations), `216°` Dusty Blue (`--svg-accent-5-*`, Courses), `228°` Periwinkle Slate (`--svg-accent-6-*`, Projects), `240°` Muted Indigo (`--svg-accent-7-*`, Services), `252°` Soft Iris (`--svg-accent-8-*`, Newsletters), `263°` Dusty Lavender (`--svg-accent-9-*`, Visualizations), and `274°` Muted Mauve (`--svg-accent-10-*`, Tags).

## 5. Centralized Theme Contract (`/styles/graphics.css`)
Standalone SVGs must import the centralized stylesheet. Hardcoded `#...` hex colors on diagram elements are strictly prohibited and enforced by `npm run lint:svgs`:
- **Centralized Import Block**: Embed a `<style>` block inside `<svg><defs>`:
  ```xml
  <defs>
    <style>
      @import url('/styles/graphics.css');
    </style>
  </defs>
  ```
- **Standardized Design Tokens**:
  - **Canvas & Containers**: `fill="var(--svg-bg)"`, `fill="var(--svg-card)"`, `stroke="var(--svg-border)"`, `fill="var(--svg-card-alt)"`, `stroke="var(--svg-line)"`, `fill="var(--svg-pill-bg)"`.
  - **Typography**: `fill="var(--svg-text-primary)"`, `fill="var(--svg-text-secondary)"`, `fill="var(--svg-text-muted)"`.
  - **Status Node Archetypes**: `var(--svg-node-{blue,purple,amber,green,red}-{bg,border,text,subtext})`.
  - **10-Stop Aurora Spectrum**: `var(--svg-accent-{1..10}-{bg,border,text,subtext})`.

## 6. Markers, Connectors & Connective Elements
- **Arrowhead Markers**: Define arrow markers in `<defs>` using archetype or spectrum border tokens:
  ```xml
  <marker id="arr-blue" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--svg-node-blue-border)" />
  </marker>
  ```
- **Connectors**: Use `<path>` with orthogonal routing (`d="M ... H ... V ..."`) or smooth curves (`d="M ... Q ..."`), `stroke-width="1.5"` to `"2"`, and `stroke-dasharray="4,3"` for asynchronous or fallback signals.

## 7. Clean Output & Linting Checklist
1. Save as a standalone `.svg` file and reference via `![Descriptive caption](./<name>.svg "Distinct Title")` (never raw inline `<svg>` in Markdown).
2. Import `@import url('/styles/graphics.css');` inside `<defs><style>`.
3. Zero hardcoded hex colors (`#...`) in `fill` or `stroke` attributes on graphical elements (enforced by `npm run lint:svgs` and `npm run lint:colors`).
4. Visual-first geometry with concise 1–3 word labels; text blocks use explicit `x` and `y` baseline coordinates without overflowing their enclosing `<rect>` or root `viewBox` horizontal bounds (enforced by `npm run lint:svgs`).
5. Node rectangles use rounded corners (`rx="6"` to `rx="10"`).
6. All elements have distinct IDs or semantic class names.
