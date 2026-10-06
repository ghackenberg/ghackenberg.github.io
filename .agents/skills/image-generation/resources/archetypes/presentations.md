# Visual Archetype: Presentations (Decks & Slide Visuals)

Presentation visuals encompass keynote deck previews, modular pipeline steps, and narrative story hero stages.

## 1. Deck Previews (`preview.jpg` - Keynote Beamer Stage)
* **Visual Archetype**: Keynote Beamer Stage in the Design Thinking Lab Campus Wels.
* **Avatar & Framing**: **Yes** (Dr. Georg Hackenberg as Keynote Presenter). Positioned in the left third, strictly a **waist-up medium presenter shot (torso cropped cleanly at the bottom edge)**. Holding a clicker and gesturing toward the screen. Tailored dark navy suit over collared shirt. No full-body shots or visible shoes.
* **Conditioning Anchors**: Anchor 1 (`src/content/characters/georg/portrait.png`), Anchor 2 (`src/content/environments/design-thinking-lab-wels/beamer-screen-focus.jpg`).
* **Illuminated White Screen Contract**: The motorized projection screen canvas **MUST ALWAYS BE LUMINOUS BRIGHT PURE WHITE (`#ffffff`)** with high-contrast diagrams. Dark slate (`#030712`) is strictly confined to the studio room walls and Georg's suit.
* **Zero-Typo Text Minimization**: Exactly 1 large prominent title on the screen, bold connected nodes/arrows, and at most 2–3 short (1–2 word) category labels. Zero paragraphs or sub-bullets.
* **Format & Aspect Ratio**: `AspectRatio: "16:9"`, saved as `preview.jpg` in `src/content/presentations/[presentation_id]/preview.jpg`.

## 2. Presentation Pipeline Step Images (`Pipeline.astro`)
* **Visual Archetype**: Minimalist Conceptual Pipeline Node.
* **Avatar Rule**: **STRICTLY NO Georg avatar**. Modular conceptual building blocks only.
* **Tone**: Sober technical precision. Strictly no cartoon eyes, faces on objects, or childish doodles.
* **The "1-Hero + 1–2 Interaction" Rule**: Exactly 1 dominant central iconic hero object + maximum 1–2 directed interaction cues (e.g. 1 laser beam, 1 vector arrow). No micro-dashboards or unreadable mini-charts.
* **Central Virtual Square Safe-Zone**: Borderless full-bleed. Confine the entire primary motif within a virtual square in the center (~50–56% width, matching canvas height). Generous empty space on all 4 sides; no elements touching edges.
* **Background Palette**: Luminous blue-violet and deep indigo galaxy nebula with soft starlight. No containing boxes or borders.
* **Format & Aspect Ratio**: `AspectRatio: "16:9"`, saved in `src/content/presentations/[presentation_id]/images/[name].jpg`.

## 3. Story Hero Slide Images (`StoryHeroSlide.astro`)
* **Visual Archetype**: Narrative Story Stage (industrial labs, workstations, collaborative architecture).
* **Avatar Rule**: Optional / context-dependent.
* **Format & Aspect Ratio**: `AspectRatio: "4:3"`, saved in `src/content/presentations/[presentation_id]/images/[name].jpg`.

## Canonical Preview Prompt Template

```text
Presentation preview illustration in stylized Disney/Pixar comic-book vector art. On the left third of the 16:9 frame, waist-up medium shot of Dr. Georg Hackenberg (early 40s, neatly groomed dark hair with silver temple highlights, full beard, warm charismatic smile, wearing a tailored dark navy suit jacket over a light collared shirt), holding a sleek presentation clicker and gesturing with an open palm toward the large beamer projection screen on the right. The motorized beamer screen has a luminous, pure bright white (#ffffff) canvas with high contrast. On the white screen is displayed: a bold prominent title "[Presentation Title]" at the top in clean dark typography, accompanied by a clean vector architectural diagram with connected circular nodes and arrows in brand blue (#3b82f6) and purple (#a855f7). The surrounding studio background is the dark slate (#030712) Design Thinking Lab at Campus Wels with subtle warm overhead spotlights. Crisp dark ink outlines, clean cel shading, high-contrast visual clarity. 16:9 aspect ratio.
```
