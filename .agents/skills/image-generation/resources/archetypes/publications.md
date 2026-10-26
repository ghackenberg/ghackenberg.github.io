# Visual Archetype: Publications (`preview.jpg`)

Publication previews showcase peer-reviewed academic papers, conference proceedings, and engineering journal articles across the publications catalog and homepage cards.

## 1. Visual Archetype: Studio Sketchnote & Gouache-Marker Blueprint

An expressive, artistic studio sketchnote and bold engineering concept drawing translating the core scientific contribution, architecture, or empirical methodology of the paper into a memorable technical visual. The drawing fills 85–90% of the 16:9 frame with generous outer breathing room.

## 2. Aesthetic, Ductus & Linework
* **Sketch Lines & Shading**: Bold, expressive engineering concept sketch with energetic charcoal-black and soft chalk-white sketchy double-outlines, deliberate hand-drawn ductus, dynamic diagonal cross-hatching shadows, and loose marker-wash accents.
* **Translucent Gouache Washes**: Soft, vibrant watercolor and translucent marker washes in electric cyan-blue (`#38bdf8`), warm amber (`#f59e0b`), and rich indigo (`#6366f1`) illuminating the key components.
* **Calm Contrast Contract**: Set against a smooth, wide full-canvas atmospheric slate-blue background (`#1e293b` smoothly blending into `#2d4260` across the entire 16:9 surface) with soft, diffuse ambient studio light spread evenly across the whole image (strictly NO circular center spotlight, NO round halo ring, NO circular vignette). Strictly **NO stark white surfaces or glowing white backdrops**, ensuring the preview remains soft on the eyes and harmonizes with the card UI without overpowering surrounding typography.
* **Anti-Pattern Warning ("Radial Glow in the Center")**: Never prompt for a "radial glow in the center" or "lighter center glow". Diffusion models interpret this phrase literally as a harsh, circular spotlight or round halo ring in the middle of the canvas, creating artificial circular vignetting. Always prompt for full-canvas atmospheric blending and evenly spread ambient studio light.

## 3. Thumbnail Ergonomics & Simplicity
* **Catalog Scaling Factor**: Publication cards render in 3-column desktop grids (~340–380px width) and mobile feeds (~360–400px width).
* **Few Large Iconic Elements**: Strictly 2–4 dominant, clear pictograms or schematic blocks arranged in a distinctive spatial layout (e.g. radial assembly, fishbone spine, mirror comparison, Git-style branching graph, or bottom-up synthesis stack).
* **High-Level Hand-Lettered Labels**: At most 1–2 concise, uppercase hand-lettered technical keywords integrated directly into the sketch (e.g. `CADDRIVE`, `SPINE LAYOUT`, `ITS DESIGN`). Strictly no tiny micro-text or dense code snippets.
* **Boldness over Micro-Detail**: Thick confident marker strokes and clearly distinguishable silhouettes designed for instant legibility at small thumbnail sizes.

## 4. Entity & Avatar Rules
* **Avatar Inclusion**: **STRICTLY NO Georg avatar**.
* **Human Figures**: Strictly no professors, students, researchers, or human figures (no hands, no silhouettes).
* **Scenery**: Strictly no lecture halls, physical desks, computer monitors, room walls, or photo frames.

## 5. Zero Reference Image Rule (`ImagePaths: []`)
* **Avoid the 2D Layout-Locking Trap**: Always invoke `generate_image` with an empty reference array (`ImagePaths: []`).
* **Paper-Specific Spatial Compositions**: Generating purely from the standardized text prompt enables the diffusion model to invent paper-specific spatial metaphors (e.g. circular collaborative hub, central spine logistics spine, multi-tier control loop) rather than locking into the 2D layout of prior publication drawings.

## 6. Format & Storage
* **Format & Aspect Ratio**: `AspectRatio: "16:9"`.
* **Path**: Saved as `preview.jpg` inside the corresponding publication directory:
  `src/content/publications/<pub_directory>/preview.jpg`
* **Frontmatter Link**: Referenced via `image: "./preview.jpg"` in `src/content/publications/<pub_directory>/index.md`.

## 7. Canonical Prompt Template

```text
An expressive artistic studio sketchnote and bold engineering concept drawing illustrating [scientific contribution / technical architecture, e.g. collaborative cloud CAD modeling with modular digital construction bricks]. The composition fills 85-90% of the 16:9 frame with generous padding around the edges. Energetic charcoal-black and chalk-white sketchy double-outlines, dynamic diagonal cross-hatching shadows, and soft translucent gouache-marker washes in electric cyan-blue (#38bdf8), warm amber (#f59e0b), and rich indigo (#6366f1). Set against a smooth, wide full-canvas atmospheric slate-blue background (#1e293b smoothly blending into #2d4260 across the entire 16:9 surface) with soft, diffuse ambient studio light spread evenly across the whole image (strictly NO circular center spotlight, NO round halo ring, NO circular vignette), strictly no stark white surfaces. Bold hand-drawn technical blueprint aesthetics with 2-4 large iconic elements: [list key elements, e.g. central cloud engine with connecting directional arrows to modular components]. Minimal stylized uppercase hand-lettered technical label '[KEYWORD]'. Clean graphic simplicity, thick confident lines, highly readable as a thumbnail. Strictly no human figures, no hands, no real text paragraphs, no photo elements. 16:9 aspect ratio.
```
