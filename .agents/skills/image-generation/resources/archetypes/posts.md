# Visual Archetype: Blog Posts (`hero.jpg`)

Blog post hero illustrations showcase the concrete technical architecture, mathematical model, or software system under investigation without repetitive portrait staging.

## Visual Archetype: Technical Artifact / Workstation & Whiteboard Close-Up

A focused, close-up engineering composition set inside the Grünau im Almtal timber home office (`home-office-almtal`) that highlights the post's specific algorithm, protocol, or data structure on a curved ultra-wide workstation monitor, drafting desk, or magnetic whiteboard.

## Avatar & Asset Uniqueness Rules
* **Avatar Inclusion**: **Strictly No Avatar** (`ImagePaths: []`). Do not include Dr. Georg Hackenberg or any human characters in blog post `hero.jpg` illustrations unless explicitly requested by the user for a personal milestone post.
* **Why No Avatar**: Avoiding repetitive human portraits across sequential engineering posts prevents visual monotony on `/posts` and keeps 100% of the visual bandwidth on the technical subject matter.
* **Strict Cryptographic Uniqueness**: Never copy or reuse an existing image from another post or presentation. Every post's `hero.jpg` must be freshly generated via the `image-generator` subagent (enforced via SHA-256 hash uniqueness in `src/scripts/lint-posts.ts`).

## Camera Framing & Cinematographic Zonation
* **Perspective**: Close-up three-quarters perspective on the primary technical surface (curved ultra-wide monitor, magnetic whiteboard on a pine timber wall, or architectural drafting table).
* **Foreground (FG)**: Tactile engineering desk props framing the lower edge—black mechanical keyboard, precision aluminum ruler, dark slate notebook, dry-erase markers, small potted succulent, or signature `almtal-ceramic-mug`.
* **Midground (MG)**: Primary focal target (70%+ of frame area) — the curved ultra-wide monitor or magnetic whiteboard displaying crisp, readable topic-specific schematics (e.g., JSON-LD `ImageObject` graphs, elliptical bin-packing chords, Markov transition matrices, or SHA-256 register pipelines) with vibrant brand accents.
* **Background (BG)**: Warm horizontal honey-pine timber slats (`#f59e0b`) with delicate dark woodgrain ink lines and a soft glimpse of twilight alpine peaks and pine forests through the panoramic window.

## Environment & Palette
* **Environment**: `home-office-almtal` (Grünau im Almtal timber architecture, rendered directly from prompt description with `ImagePaths: []`).
* **Palette**: Dark slate foundation (`#030712`), warm honey pine timber (`#f59e0b`), Deep Work Brand Blue (`#3b82f6`), emerald green (`#10b981`), and royal purple (`#a855f7`).
* **Format & Aspect Ratio**: `AspectRatio: "16:9"`, saved as `src/content/posts/<slug>/hero.jpg` and referenced in frontmatter as `icon.src: "./hero.jpg"`.

## Canonical Prompt Template (`ImagePaths: []`)

```text
Close-up three-quarters perspective of an engineering workstation desk (or magnetic whiteboard on a horizontal honey-pine timber wall) inside a contemporary timber office in Grünau im Almtal. Strictly no human characters or people in the scene. In the center midground, a large curved ultra-wide monitor (or magnetic whiteboard) displays a crisp, detailed technical schematic of [article-specific algorithm / architecture / mathematical formula with 2–3 short readable labels]. In the foreground desk edge, a black mechanical keyboard, precision aluminum calipers or drafting pen, a small green succulent, and a dark matte ceramic mug sit on the warm wood surface. In the background, horizontal pine timber walls with dark ink woodgrain lines and a panoramic window revealing twilight snow-capped alpine peaks. Stylized Disney/Pixar comic-book vector illustration, crisp dark ink outlines, bold cel shading, deep slate background (#030712) with vibrant brand blue (#3b82f6), emerald green (#10b981), and warm amber (#f59e0b) accents. 16:9 aspect ratio.
```
