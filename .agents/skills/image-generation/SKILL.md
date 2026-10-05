---
name: image-generation
description: Design, prompt, condition, and generate brand-consistent comic illustrations, pipeline motifs, and presentation visuals following IMAGE_STYLE_GUIDELINES.md.
---

# Image Generation (Diffusion Prompts & Visual Brand DNA)

This skill governs the prompt engineering, reference conditioning, and generation of illustrations across the website using `generate_image`.

## 1. Single Source of Truth & Brand Aesthetic
Strictly consult [`IMAGE_STYLE_GUIDELINES.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/IMAGE_STYLE_GUIDELINES.md):
- **Core Aesthetic**: Stylized Disney/Pixar comic illustration style, crisp dark ink outlines, bold cel shading, no realistic photographic textures.
- **Color Palette**: Dark slate background (`#030712`) combined with the 4 brand colors:
  - `#3b82f6` (Brand Blue): Software engineering, TypeScript, Astro.
  - `#f59e0b` (Brand Yellow): University teaching, meetings, academic partnerships.
  - `#a855f7` (Brand Purple): Architecture strategy, executive advisory.
  - `#10b981` (Brand Green): Personal, sport, recreation.

## 2. Character & Environment Conditioning Protocol
- **Protagonist Anchor**: For professional solo scenes, pass Dr. Georg Hackenberg (`src/content/characters/georg/portrait.png`) as Anchor 1 in `ImagePaths`.
- **The 2D Layout-Locking Trap**: Never pass a wide-angle room overview photo (`reference.jpg`) into `ImagePaths` when requesting a novel perspective. This locks the 2D layout and causes duplicate floating artifacts.
- **Focus Variants (Mandatory)**: Always inspect `src/content/environments/[id]/` and pass the specific pre-rendered focus variant (`[variant].jpg`, e.g. `beamer-screen-focus.jpg` or `workplace-focus.jpg`) as Anchor 2.
- **Object Isolation**: Reference objects in `src/content/objects/` must be 100% planar, isolated, and free of foreground occlusion.

## 3. Presentation Pipeline Step Images (16:9 Safe-Zone)
For horizontal pipeline steps (`<Pipeline steps={[...]} />`):
- **Aspect Ratio**: `AspectRatio: "16:9"`, flat `.jpg`.
- **Central Virtual Square Safe-Zone**: Confine the primary motif strictly within a virtual square in the center (occupying ~50–56% width, matching height). Leave generous empty background padding on all 4 sides to prevent clipping under dynamic `object-cover`.
- **The "1-Hero + 1–2 Interaction" Rule**: Exactly 1 dominant central iconic object + maximum 1–2 directed interaction cues (e.g. 1 laser beam, 1 vector arrow).
- **Sober & Technical Tone**: Engineering precision, clean architectural symbols. **Strictly NO cute cartoon eyes or faces on inanimate objects**, no childish doodles, and no unreadable micro-dashboards.
- **Background**: Luminous blue-violet / deep indigo galaxy nebula with soft starlight. No containing boxes, frames, or borders.
- **No Characters**: Georg does not appear in pipeline step cards.

## 4. Presentation Story Hero Slide Images (4:3 Aspect Ratio)
For visual stage cards in `StoryHeroSlide` (`<StoryHeroSlide ... />`):
- **Aspect Ratio**: `AspectRatio: "4:3"`, flat `.jpg`.
- **Staging**: Fills the 7-column card stage in 16:9 presentation slides without lateral cropping.

## 5. Deck Preview Images (`preview.jpg` - Keynote Beamer Focus)
- **Aspect Ratio**: `AspectRatio: "16:9"`.
- **Illuminated White Screen Contract**: The motorized projection screen MUST be luminous bright white (`#ffffff`). Dark slate (`#030712`) is strictly confined to the studio room and Georg's suit jacket.
- **Presenter Framing**: Georg is positioned in the left third, waist-up framing (torso cropped cleanly at the bottom canvas edge), gesturing to the screen.
- **Zero-Typo Text Minimization**: Exactly 1 large title, iconic diagram nodes, and at most 2–3 short (1–2 word) category labels.

## 6. Procedural User Review Gate
**MANDATORY**: Always present the exact prompt, aspect ratio, and list of reference `ImagePaths` to the user for review before calling `generate_image`. Never call the tool unannounced.
