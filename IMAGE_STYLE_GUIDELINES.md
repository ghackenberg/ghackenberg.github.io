# Image Style & Brand Guidelines

This document serves as the single source of truth for generating or editing image materials across the website. All images (previews, diagrams, and media) must strictly align with these guidelines to preserve visual consistency.

---

## 1. Global Color Palette & Theme Colors

All generated images must use a color scheme based on the website's custom dark theme (`#030712` background) combined with the four brand colors:

| Color Role | Color Name | Hex Code | Purpose / Context |
| :--- | :--- | :--- | :--- |
| **Deep Work** | Brand Blue | `#3b82f6` | Software engineering, development, Astro, TS |
| **Meetings** | Brand Yellow | `#f59e0b` | External partnerships, academic affairs, FH Wels |
| **Strategy** | Brand Purple | `#a855f7` | Strategy, briefings, advisory services |
| **Personal** | Brand Green | `#10b981` | Personal, sport, recreation, sponsorships |
| **Background** | Slate Black | `#030712` | Dark background panels and cards |

---

## 2. Core Visual Aesthetic: Comic Illustration Style

All non-screenshot images must follow a **stylized comic-book/vector illustration** aesthetic:

*   **Crisp Outlines**: Use distinct, dark (slate or black) borders and outlines for figures, cards, and diagrams to emulate a cartoon/comic layout.
*   **Cel Shading & Gradients**: Use flat fills, bold cel-shading, or clean gradients. Avoid realistic lighting, photographic textures, or soft-blurred 3D renders.
*   **No Border Frames**: Previews and diagrams must not contain mock frames, photo-like white margins, or borders around the image canvas.
*   **No Picture-in-Picture**: Avoid nesting smaller image mockups or screenshots inside a larger frame. Keep the canvas as a single unified scene.
*   **Aesthetic Details**: Incorporate comic-style details such as subtle halftone dot patterns, hand-drawn vector arrows, or comic speech/info bubbles where appropriate.
*   **Background Integration**: Always design with a dark background matching `#030712` or slate gray. Avoid solid white backgrounds so the images blend seamlessly into the site's premium dark mode.

---

## 3. Modular Guidelines by Image Category

### A. Services Overview & Detail Previews
*   **Subject**: High-tech workspaces, glowing code editors, digital mockups, or conceptual tech drawings.
*   **Style**: Stylized comic-book vector illustration of the subject. Crisp ink outlines.
*   **Aesthetic**: Vibrant accent glows matching the service color (e.g., Yellow for Corporate Training, Blue for R&D Prototyping). Must be a single visual composition with no nested image-in-image components or white margins.
*   **Format**: 16:9 ratio, flat PNG.

### B. Service Module Previews
*   **Subject**: A single, focused visual metaphor representing the specific module's core utility (e.g., a glowing server rack for hosting, a fountain pen for copywriting, a camera lens for tutorials).
*   **Style**: Centered flat vector comic icon or emblem on a dark slate background (`#0b1329` or `#030712`).
*   **Aesthetic**: Bold cel-shading, prominent ink borders, halftone dot shading, and custom colored accent glows matching the parent service. No nested images or margins.
*   **Format**: 16:9 ratio, flat PNG.

### C. Methodology & Technical Diagrams
*   **Subject**: Flowcharts, step-by-step processes, or system architectures.
*   **Style**: Highly polished technical SVG diagrams matching the blog post schematics. Solid dark background card `#0b1329` with round corners (`rx="16"`), a thin border stroke (`rgba(255, 255, 255, 0.08)`), and step groups connected by dashed flowlines and color-coded arrow markers.
*   **Aesthetic**: Crisp typography using `'Outfit', 'Inter', sans-serif`. Focus nodes colored with the respective service theme accent. Detail summary cards placed at the bottom for technical context.
*   **Format**: Inline vector SVG files (`.svg`) placed in the service collection folder. PNGs are forbidden for this category.

### D. Course Preview Images
*   **Subject**: Educational topics, specific programming languages, or tools (e.g. Kotlin, WebGL, CAD).
*   **Style**: Clean vector design with prominent tech logos surrounded by hand-drawn comic elements.
*   **Format**: 16:9 ratio.

### E. Blog Post Featured Images
*   **Subject**: Article specific technical concepts (e.g., WebGL water flow, unread indicators).
*   **Style**: High-quality technical vector illustrations or schematics with clean comic outlines.
