# Visual Archetype: Newsletters (`preview.jpg`)

Newsletter issue covers serve as the visual header for Light-Mode HTML email dispatches, Dark/Light-Mode web archive cards (`/newsletters/`), and OpenGraph social metadata on issue detail pages (`/newsletters/[slug]/`).

## Visual Archetype: Editorial Magazine Illustration / Tech Review Cover

A bold, conceptual editorial magazine cover illustration (inspired by *MIT Technology Review*, *Stripe Press*, and *The New Yorker* technical dispatches) that visually synthesizes the 1–2 primary engineering themes of the newsletter issue into a cohesive isometric or planar architectural metaphor.

## Layout & Composition Ergonomics
* **Dual-Theme Editorial Synthesis**: Fuse the issue's 1–2 core technical themes (e.g., multi-agent control-plane orchestration + 2D Signed Distance Field geometric wave grids; or neural Slide-as-Code pipelines + sovereign infrastructure) into a single harmonious centerpiece.
* **Central Focal Geometry**: The primary architectural metaphor occupies ~65–75% of the canvas height in the center of the 16:9 frame, surrounded by generous breathing room on all four sides.
* **High Thumbnail & Inbox Legibility**: Because the cover is rendered at `576px` width inside email clients and ~`360px` width in 3-column web archive grids, shapes must be bold, geometric, and immediately readable without micro-clutter.
* **Zero Text & Zero Borders**: Strictly no real text, no issue numbers, no typography, no pseudo-labels, and no outer picture frames or white margins (borderless full-bleed 16:9 composition).

## Avatar & Entity Rules
* **Avatar Inclusion**: **STRICTLY NO Georg avatar**.
* **Human Figures**: Strictly zero human figures, faces, or hands (`ImagePaths: []`).

## Email-First & Cross-Theme Palette
* **Mid-Tone Editorial Canvas**: Because newsletter covers appear inside Light-Mode HTML emails (`#ffffff` card container on `#f8fafc` paper) as well as Dark/Light-Mode website pages, avoid pure pitch-black (`#030712`) voids that look overly heavy on white email paper. Instead, use a rich, balanced **mid-tone editorial canvas gradient** transitioning from deep indigo-slate (`#1e293b`) to royal cobalt/violet (`#1e3a8a` / `#312e81`).
* **Luminous Brand Accents**: Illuminate the central architectural motif with warm Amber Gold (`#f59e0b`), Electric Cyan (`#06b6d4`), Brand Blue (`#3b82f6`), Emerald Green (`#10b981`), and Crisp Ivory (`#f8fafc`) highlights.
* **Aesthetic**: Stylized Disney/Pixar comic-book vector & editorial magazine illustration style with crisp dark ink outlines, bold cel shading, and clean geometric forms.
* **Format & Aspect Ratio**: `AspectRatio: "16:9"`, saved as `preview.jpg` in `src/content/newsletters/<slug>/preview.jpg`.

## Canonical Prompt Template

```text
Conceptual editorial magazine cover illustration (MIT Technology Review and Stripe Press aesthetic) synthesizing [Theme 1, e.g., deterministic multi-agent control-plane state graphs] and [Theme 2, e.g., 2D Signed Distance Field geometric contour wave grids and neural audio waveforms], centered as a cohesive isometric architectural sculpture occupying 70% of the frame with generous breathing room on all sides. Rich mid-tone editorial background gradient transitioning from deep indigo-slate (#1e293b) to royal cobalt and violet (#1e3a8a to #312e81), illuminated by warm amber gold (#f59e0b), electric cyan (#06b6d4), brand blue (#3b82f6), emerald (#10b981), and crisp ivory (#f8fafc) highlights. Stylized Disney/Pixar comic-book vector and editorial illustration style, crisp dark ink outlines, bold cel shading, clean geometric shapes. Strictly borderless full-bleed composition, no human figures, no hands, no real text or labels. 16:9 aspect ratio.
```
