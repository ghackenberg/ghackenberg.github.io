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

---

## 4. Generative AI Engineering Principles & Best Practices

To guarantee consistent results across different diffusion models and eliminate common generative artifacts, adhere strictly to these three core principles:

### A. Decoupled Viewpoints & Room DNA (Raum-DNA)
* **The 2D Layout-Locking Trap**: Passing a wide-angle room photo into `ImagePaths` causes the vision encoder (CLIP/SigLIP) to enforce the original 2D composition and spatial layout. If a novel camera angle (e.g. 3/4 workstation close-up) is requested while passing a wide room reference, the model will **not** rotate the 3D camera; instead, it leaves the room layout unchanged and inpaints floating or duplicate objects into the center of the frame.
* **The Room-DNA Solution**: To capture an environment from different camera viewpoints, do **not** pass a full-room reference image to `ImagePaths`. Instead, rely on the environment's **Room DNA** in the prompt (architecture, materials, lighting, permanent spatial anchors, window view).
* **Cinematographic Zonation (Foreground / Midground / Background)**: Structure prompts strictly in three depth layers. Diffusion models prioritize tokens at the start of prompts:
  1. *Foreground*: Nearest desk edge, signature mugs, keyboard, input devices.
  2. *Midground*: Primary focal target (angled monitor with front screen visible, ergonomic office chair, presenter).
  3. *Background*: Architectural walls, wall-mounted whiteboards, artwork, windows, external panorama.

### B. Canonical Object Isolation & Asset Hygiene
* **0% Occlusion Rule (No Foreground Contamination)**: When capturing reference assets for `src/content/objects/`, the target object must never be partially covered or obstructed by other items (e.g. a computer monitor in front of a wall painting). Occlusions cause **Attribute Bleeding** / **Semantic Leakage**, causing the model to blend unwanted features (like glowing IDE code) into the object.
* **Planar & Orthographic (No Perspective Baking)**: Reference objects must be captured or rendered as planar 2D flat-lays or orthographic frontal views. Perspective foreshortening or trapezoidal warping in the reference image will be baked into the object's embedding, causing double-distortion when placed in new scenes.
* **Style Purity**: All objects and characters must strictly adhere to the Disney/Pixar comic illustration style (crisp dark ink linework, cel shading, no photorealistic museum backgrounds, no drop-shadow margins).

### C. Environment Focus Variants & `ImagePaths` Conditioning
* **Never pass wide-angle room overview photos (`reference.jpg`) to `ImagePaths`** when requesting a close-up or novel perspective. This triggers the 2D layout-locking trap and causes inpainting of floating artifacts.
* **Mandatory Focus Variant Anchoring**: When generating a scene located in an existing environment, agents must:
  1. Inspect existing environments and their defined `variants` in `src/content/environments/`.
  2. Select the matching pre-rendered focus variant (e.g. `workplace-focus.jpg` or `beamer-screen-focus.jpg`).
  3. Pass the pre-rendered focus variant as the environment anchor in `ImagePaths` (e.g. alongside `portrait.png`).
* **Conditioning Slots (`ImagePaths`, up to 3 images)**:
  - Anchor 1: Protagonist portrait (`characters/georg/portrait.png`).
  - Anchor 2: Matching pre-rendered environment focus variant (`environments/[id]/[variant].jpg`).
  - Anchor 3 (optional): Clean isolated planar object (`objects/[id]/reference.jpg`).

---

## 5. Central Visual Asset Library & Relational Graph

All characters, key objects, and spatial environments are managed as first-class Astro content collections with typed cross-references:

1. **Characters** (`src/content/characters/[id]/`):
   - Contains `index.md` with canonical prompt description, facial/body attributes, role, and structured `variants`.
   - Linked to `environments` (primary workspaces) and `objects` (signature personal gear/items).
   - Reference images: `portrait.png`, plus variant poses/outfits.
2. **Objects** (`src/content/objects/[id]/`):
   - Key recurring physical and digital artifacts.
   - Contains `index.md` with category, canonical prompt, `geometry` metadata (form, materials, colors), and isolated planar reference image.
   - Linked to `environments` (where the object resides) and `characters` (who uses/owns it).
3. **Environments** (`src/content/environments/[id]/`):
   - Key recurring spatial locations.
   - Contains `index.md` with:
     - `dna`: Immutable architectural foundation (architecture, wall/ceiling/floor materials, lighting, brand palette, window panorama).
     - `variants`: Structured camera viewpoints with `shotType`, `cameraAngle`, `focalTarget`, `depthLayers`, and ready-to-use `promptSnippet`.
   - Linked to `characters` (occupants) and `objects` (contained key objects).

### Mandatory Generation Protocol
Before generating any new illustration:
1. **Environment & Focus Variant Selection (Mandatory)**:
   - Check `src/content/environments/` for available locations and their existing `variants`.
   - **Select** the most fitting focus variant for the camera framing and setting.
   - **Check Character Capacity (`maxCharacters`)**: Note the variant's capacity (e.g. `workplace-focus` max 1; `visitor-table-focus` max 2; `full-lab` max 6). Never place more characters in a shot than the variant permits.
   - **Check Object Visibility (`visibleObjects`)**: Check which signature objects are listed under `visibleObjects` for this variant (e.g. `almtal-abstract-painting`). Only include objects in the prompt that are physically in the variant's view.
   - **Propose new variant**: If the environment fits but the specific camera angle, focal target, or character capacity is missing, generate and register a new focus variant for that environment first.
   - **Propose new environment**: If a novel real-world setting is required, propose and register the environment with an initial set of focus variants and 1–3 signature objects first.
2. **Character & Object Discovery & Suitability Check**:
   - Check `src/content/characters/` for available characters and their associations with the environment.
   - If the scene requires additional human figures (e.g., student, client, collaborator) and no suitable character exists in the library, **propose and create the new character first** (portrait, attributes, role).
   - Check `src/content/objects/` for referenced `visibleObjects`. Ensure all referenced items are 100% planar, isolated, and occlusion-free.
3. **Prompt Composition**:
   - Combine character identity, the environment's `dna`, the variant's `depthLayers`, and any `visibleObjects`.
   - Pass the primary character (`portrait.png`) and the selected focus variant (`[variant].jpg`) to `ImagePaths` (plus optional secondary character or isolated object).
   - Always present the prompt and reference image list to the user before calling `generate_image`.


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
