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

All non-screenshot images must follow a **stylized Disney/Pixar comic-book vector illustration** aesthetic:

*   **Crisp Outlines**: Use distinct, dark (slate or black) borders and outlines for figures, cards, and diagrams to emulate a cartoon/comic layout.
*   **Cel Shading & Gradients**: Use flat fills, bold cel-shading, or clean gradients. Avoid realistic lighting, photographic textures, or soft-blurred 3D renders.
*   **No Border Frames**: Previews and diagrams must not contain mock frames, photo-like white margins, or borders around the image canvas.
*   **No Picture-in-Picture**: Avoid nesting smaller image mockups or screenshots inside a larger frame. Keep the canvas as a single unified scene.
*   **Aesthetic Details**: Incorporate comic-style details such as subtle halftone dot patterns, hand-drawn vector arrows, or comic speech/info bubbles where appropriate.
*   **Background Integration**: Always design with a dark background matching `#030712` or slate gray. Avoid solid white backgrounds so the images blend seamlessly into the site's premium dark mode.

---

## 3. Canonical Protagonist & Character Representation

Whenever an image features a person (e.g. author, researcher, professor, developer, or presenter), **never use a generic or random character**. 

*   **Dr. Georg Hackenberg (Site Owner / Author)**:
    *   **Facial Identity**: Based on `src/content/characters/georg/portrait.png`. Early 40s, neatly groomed styled dark brown hair with silver highlights at temples, neatly trimmed full beard and mustache, warm genuine smile showing white teeth, expressive intelligent hazel/brown eyes. No eyeglasses unless specified for a specific technical variant.
    *   **Attire Contexts**:
        *   *Academic / Consulting / Enterprise*: Tailored dark suit jacket over a checked or collared shirt.
        *   *Home Office / Video Call / Everyday*: Friendly, approachable casual knit sweater or casual collared shirt in welcoming tones (e.g., petrol blue, royal blue, or heather grey). Avoid dark/black hoodies in home office scenes.
        *   *Hands-on Tech / Lab / Dev*: Dark navy or slate tech pullover, dark t-shirt, or workshop layer.
        *   *Outdoor / Smart Systems*: Sporty tech outdoor jacket.
    *   **Whiteboard & Presentation Staging**:
        *   When illustrating whiteboard concept discussions, the camera framing must prioritize the whiteboard surface so that technical diagrams, flowcharts, and notes are prominently displayed and clearly legible.
        *   Georg should be positioned to one side (e.g., the left or right third of the frame), marker in hand, turning warmly toward the viewer, never obscuring or blocking the central diagram on the whiteboard.
    *   **Inclusion Rule**: Include Georg in comic scenes whenever it makes narrative sense (the author presenting a project, building an architecture, running an experiment, or teaching a concept).

---

## 4. Central Visual Asset Library (Characters, Objects, Environments)

To prevent visual drift and enforce continuity across generations, all characters, key objects, and spatial environments are managed systematically as first-class Astro content collections:

1. **Characters** (`src/content/characters/[id]/`):
   - Contains `index.md` with canonical prompt description, facial/body attributes, role, and a structured `variants` list.
   - Reference images: `portrait.png`, plus variant poses/outfits (`casual.png`, `standing.png`, etc.).
2. **Objects** (`src/content/objects/[id]/`):
   - Key recurring physical and digital artifacts (e.g., solid wood cooling dock, IoT irrigation sensor, 3-tier parallax conveyor track).
   - Contains `index.md` with category, canonical prompt description, and reference images.
3. **Environments** (`src/content/environments/[id]/`):
   - Key recurring spatial locations (e.g., dark digital software lab, FH Wels lecture hall, Almtal smart garden).
   - Contains `index.md` with category, canonical prompt description, and reference images.

### Mandatory 2-Step Generation Protocol
Before generating any new illustration:
1. **Identify Required Entities**: Determine the character(s), key object(s), and environment required for the scene.
2. **Library Verification & Pre-Creation**:
   - Check if each entity exists in `src/content/characters/`, `src/content/objects/`, or `src/content/environments/`.
   - **If an entity or variant is missing, generate and register that entity/variant in the library FIRST** (including its reference image and `index.md`).
3. **Final Scene Composition**:
   - Compose the scene prompt using the canonical prompt snippets from the library.
   - Supply up to 3 library reference images via `ImagePaths` in `generate_image` to anchor identity, style, and object geometry.

---

## 5. Modular Guidelines by Image Category

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
*   **Subject**: Article-specific technical concepts featuring Dr. Georg Hackenberg and relevant library objects/environments.
*   **Style**: High-quality technical comic-book illustrations with clean ink outlines, vibrant brand accents, and cel shading.
*   **Format**: 16:9 ratio.
