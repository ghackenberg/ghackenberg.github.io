---
title: "Unified Three-Band Figures, Font-Weighted SVG Scaling, and Cross-Layer Color Token Governance"
pubDate: 2026-11-07
description: "How we unified heterogeneous technical artifacts into three-band figure cards with fullscreen pan/zoom inspection, font-weighted SVG max-width scaling, and static AST linters for prose rhythm and Soft Nordic Pastel color parity."
inLanguage: "en"
tags:
  - design-systems
  - computer-graphics
  - web-development
  - software-architecture
image:
  src: "./hero.jpg"
  title: "Three-Band Figure Architecture, Font-Weighted SVG Scaling, and Cross-Layer Color Token Governance"
  description: "Architectural blueprint on a timber drafting table in Grünau im Almtal illustrating the unified three-band artifact card anatomy, font-weighted SVG scaling curve, and Soft Nordic Pastel color token swatches"
references:
  - id: "ware-2020-information-visualization"
    type: "book"
    authors:
      - name: "Colin Ware"
    title: "Information Visualization: Perception for Design"
    publisher: "Morgan Kaufmann"
    year: 2020
    doi: "10.1016/C2016-0-02395-1"
    url: "https://doi.org/10.1016/C2016-0-02395-1"
  - id: "knuth-1981-breaking-paragraphs"
    type: "article"
    authors:
      - name: "Donald Ervin Knuth"
      - name: "Michael Frederick Plass"
    title: "Breaking Paragraphs into Lines"
    journal: "Software: Practice and Experience"
    volume: "11"
    number: "11"
    pages: "1119--1184"
    year: 1981
    doi: "10.1002/spe.4380111102"
    url: "https://doi.org/10.1002/spe.4380111102"
  - id: "w3c-2018-svg2"
    type: "online"
    authors:
      - name: "Nikos Andronikos"
      - name: "Tavmjong Bah"
      - name: "Brian Birtles"
      - name: "Cyril Concolato"
      - name: "Erik Dahlström"
      - name: "Chris Lilley"
      - name: "Cameron McCormack"
      - name: "Doug Schepers"
      - name: "Dirk Schulze"
      - name: "Richard Schwerdtfeger"
      - name: "Satoru Takagi"
      - name: "Jonathan Watt"
    title: "Scalable Vector Graphics (SVG) 2"
    siteName: "W3C Candidate Recommendation"
    year: 2018
    url: "https://www.w3.org/TR/SVG2/"
---

Technical articles routinely mix standalone vector diagrams, Mermaid flowcharts, syntax-highlighted code listings, data tables, and raster images that look visually disjointed without a unified container [@ware-2020-information-visualization; @w3c-2018-svg2]. We engineered a build-time three-band artifact card architecture paired with font-weighted SVG scaling and static AST linters to unify every technical figure across light and dark themes [@knuth-1981-breaking-paragraphs].

<!-- caption: "Architectural comparison of uncoordinated Markdown media blocks, fixed-width column wrappers, and our unified three-band artifact card pipeline with font-weighted SVG scaling and AST governance." -->
| Architectural Dimension | Uncoordinated Markdown Media | Fixed-Width Column Wrappers | Three-Band Artifact Cards & Font-Weighted SVG Pipeline |
| :--- | :--- | :--- | :--- |
| **Container Anatomy** | Ad-hoc `<pre>`, `<table>`, and `<img>` tags | Inconsistent borders and missing captions | Unified 3-band `<figure class="artifact-card">` (Header, Viewport, Footer) |
| **SVG Label Ergonomics** | Shrinks dense schematics on mobile | Inflates `16px` labels on `480x480` SVGs to `25.3px` at `760px` | Font-weighted `max-width` clamping diagram labels to `14px–14.5px` body prose |
| **Interactive Inspection** | Static inline rendering only | Separate per-widget modal scripts | Unified `<dialog>` lightbox in [`media-deck.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/media-deck.ts) (`0.5x–4x` pan/zoom + carousel) |
| **Theme & Prose Hygiene** | Hardcoded hex colors and stacked figures | Manual review prone to visual drift | Static AST gates across 150 posts, 136 collection docs, and 108 standalone SVGs |

## How Do Three-Band Artifact Cards Unify Figures, Code, and Tables?

Three-band artifact cards unify heterogeneous technical figures by wrapping every standalone image, vector schematic, Mermaid flowchart, code block, and table in an identical `<figure class="artifact-card">` frame at build time [@ware-2020-information-visualization]. Each card pairs a top badge header with a central interactive viewport and an italicized caption footer connected to a fullscreen pan-and-zoom lightbox.

When an engineering article interleaves a standalone SVG schematic, a Shiki dual-theme (`github-light` / `github-dark`) code snippet, and a multi-column comparison table, uncoordinated DOM wrappers force the reader to re-parse different visual boundaries on every scroll [@ware-2020-information-visualization]. We consolidated our Markdown and Rehype compilation pipeline across [`rehype-inline-svg.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/plugins/rehype-inline-svg.ts), [`rehype-code-captions.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/plugins/rehype-code-captions.ts), [`rehype-responsive-tables.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/plugins/rehype-responsive-tables.ts), and [`remark-mermaid.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/plugins/remark-mermaid.ts) so every non-prose artifact compiles into a deterministic three-band structure (while explicitly skipping `.slide-mdx-content` presentation decks in `/src/content/presentations/`):

- **Band 1 — Header Bar (`.artifact-card-header`)**: Displays a semantic left pill badge (`.artifact-card-badge`: `SVG`, `Mermaid`, language name such as `TypeScript`, `Table`, or `Image`) alongside right-aligned action controls (`.artifact-card-controls`) rendered at build time with zero cumulative layout shift (CLS).
- **Band 2 — Interactive Viewport (`.artifact-card-body`)**: Houses the scoped inline `<svg>`, dual-theme Shiki `<pre>` block, container-query sortable `<table>` (`▤ Cards` / `⊞ Table` views), or responsive raster `<img>`.
- **Band 3 — Semantic Caption Footer (`figcaption.artifact-card-footer`)**: Renders the italicized caption extracted from image `alt` attributes, code fence `caption="..."` metadata, or `<!-- caption: "..." -->` table comments.

The schematic below illustrates how all five Markdown artifact classes converge into this unified three-band `<figure class="artifact-card">` container and connect to the fullscreen `<dialog>` gallery lightbox:

![Semantic vector schematic of the unified Three-Band Artifact Card anatomy across SVG, Mermaid, Code, Table, and Image nodes connected to the native dialog lightbox](./three-band-artifact-card-anatomy.svg "Unified Three-Band Artifact Card and Lightbox Architecture")

On the client, [`media-deck.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/media-deck.ts) binds all five artifact classes in exact DOM reading order to a single native `<dialog>` gallery lightbox supporting `0.5x–4x` pointer-centered wheel zoom, drag panning, clipboard copy, and keyboard carousel navigation.

## Why Does Font-Weighted SVG Scaling Outperform Fixed Column Widths?

Font-weighted SVG scaling prevents optical text bloat on desktop displays by sizing each diagram container inversely to its internal label font sizes rather than stretching every graphic across a fixed `760px` column [@w3c-2018-svg2]. Our build-time plugin samples `<text>` nodes inside each SVG and clamps the wrapper width so rendered labels match body prose.

Standard mobile-first square diagrams (`viewBox="0 0 480 480"`) use `13px–16px` labels so text remains legible when scaled down by $0.71\times$ on a `340px` smartphone viewport [@w3c-2018-svg2]. However, if that same `480x480` SVG is stretched across a full `760px` desktop prose column ($1.58\times$ magnification), a `16px` node title inflates to $16 \times (760 / 480) = 25.3\text{px}$, dwarfing the surrounding `14.5px` article text. Starting from a 25th-percentile prototype ($W_{\text{target}} = \operatorname{clamp}(\operatorname{round}(V_w \cdot 14.5 / f_{0.25}), 360, 760)\text{px}$), we refined `createFigureElement` in [`rehype-inline-svg.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/plugins/rehype-inline-svg.ts) to weight every `<text>` element by character length (`weight`), pairing a character-weighted mean target ($\bar{f}_w \to 14\text{px}$) with a 15th-percentile small-font floor ($f_{0.15} \to 12.2\text{px}$):

```typescript caption="Character-weighted mean and 15th-percentile font-size scaling in src/plugins/rehype-inline-svg.ts."
const totalWeight = textSamples.reduce((acc, s) => acc + s.weight, 0);
const weightedMeanFs =
  textSamples.reduce((acc, s) => acc + s.fs * s.weight, 0) / totalWeight;

const sortedSamples = [...textSamples].sort((a, b) => a.fs - b.fs);
let cumWeight = 0;
let p15Fs = sortedSamples[0].fs;
for (const sample of sortedSamples) {
  cumWeight += sample.weight;
  if (cumWeight >= totalWeight * 0.15) {
    p15Fs = sample.fs;
    break;
  }
}

const TARGET_MEAN_FONT_PX = 14;
const MIN_SMALL_FONT_PX = 12.2;
const rawTargetSvgWidth = Math.max(
  vbWidth * (TARGET_MEAN_FONT_PX / weightedMeanFs),
  vbWidth * (MIN_SMALL_FONT_PX / p15Fs)
);
const maxSvgWidthPx = Math.round(
  Math.max(320, Math.min(880, Math.min(vbWidth, rawTargetSvgWidth)))
);
```

This dual constraint guarantees that compact `480x480` schematics with bold `15px–16px` labels cap cleanly around `435px–480px` on desktop, whereas wide architectural canvases with `12px` metadata expand up to their natural `viewBox` width without ever dropping small annotations below `12.2px`.

![Semantic vector diagram contrasting fixed 760px column SVG stretching (25.3px inflated labels) against font-weighted SVG scaling in rehype-inline-svg.ts targeting 14px-14.5px body prose parity](./font-weighted-svg-scaling-curve.svg "Font-Weighted SVG Max-Width Scaling Curve")

In addition to computing `style="max-width: ...px"`, [`rehype-inline-svg.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/plugins/rehype-inline-svg.ts) strips redundant `@import url('/styles/graphics.css');` declarations during HTML inlining and prefixes every internal SVG `[id]`, `url(#...)`, and `href="#..."` reference with a deterministic 8-character SHA-256 hash (`svg-${hash}-`) to prevent DOM ID collisions when multiple diagrams appear in the same post.

## How Do Static AST Linters Enforce Prose Rhythm and Cross-Layer Color Parity?

Static AST linters enforce editorial prose rhythm and cross-layer color parity by auditing every Markdown document, CSS token file, and standalone vector graphic before build compilation [@knuth-1981-breaking-paragraphs]. These automated checks block consecutive non-prose blocks across 150 posts and 136 collection entries while guaranteeing 100% token alignment across 108 standalone SVGs.

Even well-designed figure cards degrade reading flow when authors stack tables, code blocks, or diagrams back-to-back without transitional explanation, or when vector graphics drift from site-wide theme variables [@knuth-1981-breaking-paragraphs; @ware-2020-information-visualization]. We coupled [`theme.css`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/styles/theme.css) and [`graphics.css`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/styles/graphics.css) with three deterministic verification scripts—[`lint-colors.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/lint-colors.ts), [`lint-svgs.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/lint-svgs.ts), and [`lint-posts.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/lint-posts.ts):

- **Dual Orthogonal SVG Token Families (`graphics.css` & `lint-colors.ts`)**: [`graphics.css`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/styles/graphics.css) defines five Soft Nordic Pastel status node archetypes (`--svg-node-{blue,purple,amber,green,red}-{bg,border,text,subtext}`) alongside the ten-stop Aurora domain spectrum (`--svg-accent-{1..10}-*`) across dark (`:root`) and light (`html.light` / `prefers-color-scheme: light`) modes, while [`lint-colors.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/lint-colors.ts) verifies 100% cross-layer parity with [`theme.css`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/styles/theme.css).
- **Standalone Vector Hygiene & Character-Width Bounds (`lint-svgs.ts`)**: Scans all 108 standalone content `.svg` files to require `@import url('/styles/graphics.css');`, reject hardcoded `#hex` fills or strokes, validate `var(--svg-*)` token names, and verify that proportional `Outfit`/`Inter` `<text>` glyphs never overflow their enclosing `<rect>` cards or `viewBox` edges.
- **AST Editorial Prose Rhythm & Mandatory Captions (`lint-posts.ts`)**: Parses Markdown block sequences across all 150 blog posts and 136 multi-collection documents (`projects`, `services`, `courses`, `publications`, and `visualizations`) to ensure every heading is followed immediately by a prose paragraph, no two structural blocks (`table`, `code`, `list`, `image`, `blockquote`) appear back-to-back without intervening prose, and every table and code block declares an explicit caption.

The architecture diagram below traces how [`theme.css`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/styles/theme.css) and [`graphics.css`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/styles/graphics.css) feed into these three static AST verification gates during continuous integration:

![Semantic vector diagram of the static AST governance pipeline uniting theme.css, graphics.css, lint-colors.ts, lint-svgs.ts across 108 SVGs, and lint-posts.ts across 150 posts and 136 collection entries](./cross-layer-token-prose-governance.svg "Cross-Layer Color Token and Editorial Prose Rhythm Governance")

Together, build-time three-band figure synthesis, font-weighted SVG width clamping, and static AST governance ensure that every diagram, code listing, and data table renders with uniform typographic rhythm and zero theme drift.
