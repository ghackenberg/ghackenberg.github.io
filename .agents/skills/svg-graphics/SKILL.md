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
- **Mental-Model Visual-First Rule**: Diagrams must communicate topological structure at a glance using rich geometric primitives (`<circle>`, `<polygon>`, `<path>`, concentric rings, Bezier curves, dashed boundaries, and status icons) paired with **concise 1–3 word labels**. Never turn an SVG into a wall of multi-sentence text boxes.
- **Escalation Target**: Primary escalation target from `mermaid-diagrams` when layout complexity exceeds 5 nodes or demands custom coordinate geometry and adaptive themes.

## 2. Standard ViewBox & Responsive Sizing
Always configure explicit `viewBox` coordinates with responsive scaling:
- **Primary Standard — Square / Near-Square (`1:1` Aspect Ratio)**:
  - **Standard Post & Article Illustration**: `viewBox="0 0 640 640"` (or near-square `viewBox="0 0 640 560"` / `viewBox="0 0 640 680"`).
  - **Mobile + Desktop Ergonomics**: A `640x640` ($1:1$) canvas scales down by less than $2\times$ on portrait mobile viewports (`393px` wide) while scaling cleanly to 100% container width (`w-full h-auto max-w-full`) across both mobile and desktop viewports. Structure diagrams into **2–3 vertical tiers** or a **2×2 grid** rather than wide horizontal ribbons (`880x340`) that shrink text to illegible sizes on smartphones.
  - **Slide-Deck Wide Exception**: Wide aspect ratios (`viewBox="0 0 800 420"` or `880 380`) should only be used when embedding inside landscape `16:9` presentation slides.
- **Root `<svg>` Attributes**: Include `xmlns="http://www.w3.org/2000/svg"`, `width="100%"`, `height="auto"`, `role="img"`, and a descriptive `aria-label` on the root `<svg>`.
- **Safe Padding**: Keep at least 20px–24px padding from canvas edges (e.g. min `x=24`, max `x=616` on a `640`-wide canvas) to prevent stroke clipping.

## 3. Typography & Font Hierarchy
Use system sans-serif fonts consistent with site typography:
- **Font Stack**: `font-family="Outfit, Inter, system-ui, -apple-system, sans-serif"`
- **Hierarchy**:
  - Section / Container Header: `font-size="13"` or `"14"`, `font-weight="700"`, letter-spacing `0.05em`, uppercase.
  - Primary Node Title: `font-size="12"` or `"13"`, `font-weight="600"` or `"700"`, 1–3 words maximum.
  - Secondary Metadata / Subtitle: `font-size="10"` or `"11"`, `font-weight="400"`, concise metric or token name.
  - Badges / Status Pills: `font-size="9"` or `"10"`, `font-weight="600"`.
- **Text Alignment**: Use `text-anchor="middle"` for centered node labels, `dominant-baseline="central"` or `dominant-baseline="middle"` for vertical centering.
- **Horizontal Character-Width Budget**: In `Outfit`/`Inter`, average proportional character advance is $\approx 0.56 \times \text{font-size}$ (up to $\approx 0.62 \times \text{font-size}$ for uppercase/bold or `letter-spacing`). Ensure every `<text>` element maintains at least `12px–14px` horizontal padding inside its enclosing `<rect>` container (`x_left + text_width <= rect_right - 12`). Never place multi-sentence paragraphs inside `<text>` nodes. Enforced deterministically by `npm run lint:svgs`.

## 4. Brand Color Tokens & Node Archetypes
All colors and visual archetypes are centralized in `src/styles/graphics.css`. Every SVG imports these tokens to guarantee seamless dark/light theme switching:
- **Blue Archetype (`--svg-node-blue-*`)**: Orchestration, control planes, invariant monitoring, computation.
- **Purple Archetype (`--svg-node-purple-*`)**: Probabilistic execution, autonomous ReAct loops, planning.
- **Amber Archetype (`--svg-node-amber-*`)**: Fail-safe subsystems, human verification gates, alerts, fallback paths.
- **Green Archetype (`--svg-node-green-*`)**: Verified states, audited outcomes, persistent storage, safe delivery.
- **Red Archetype (`--svg-node-red-*`)**: Errors, violations, strict alerts, and terminal failure paths.

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
    - Backgrounds: `var(--svg-node-blue-bg)`, `var(--svg-node-purple-bg)`, `var(--svg-node-amber-bg)`, `var(--svg-node-green-bg)`, `var(--svg-node-red-bg)`.
    - Borders: `var(--svg-node-blue-border)`, `var(--svg-node-purple-border)`, `var(--svg-node-amber-border)`, `var(--svg-node-green-border)`, `var(--svg-node-red-border)`.
    - Titles: `var(--svg-node-blue-text)`, `var(--svg-node-purple-text)`, `var(--svg-node-amber-text)`, `var(--svg-node-green-text)`, `var(--svg-node-red-text)`.
    - Subtext: `var(--svg-node-blue-subtext)`, `var(--svg-node-purple-subtext)`, `var(--svg-node-amber-subtext)`, `var(--svg-node-green-subtext)`, `var(--svg-node-red-subtext)`.

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
  - Connective pills: Use archetype background and border tokens for status chips.

## 7. Clean Output & Linting Checklist
1. Save as a standalone `.svg` file and reference via `![Descriptive caption](./<name>.svg "Distinct Title")` (never raw inline `<svg>` in Markdown).
2. Import `@import url('/styles/graphics.css');` inside `<defs><style>`.
3. Zero hardcoded hex colors (`#...`) in `fill` or `stroke` attributes on graphical elements (enforced by `npm run lint:svgs`).
4. Visual-first geometry with concise 1–3 word labels; text blocks use explicit `x` and `y` baseline coordinates without overflowing their enclosing `<rect>` or root `viewBox` horizontal bounds (enforced by `npm run lint:svgs`).
5. Node rectangles use rounded corners (`rx="6"` to `rx="10"`).
6. All elements have distinct IDs or semantic class names.
