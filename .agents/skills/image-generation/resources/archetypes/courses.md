# Visual Archetype: Courses (`preview.jpg`)

Course previews showcase university lecture modules, programming curricula, and academic engineering labs.

# Visual Archetype: Courses (`preview.jpg`)

Course previews showcase university lecture modules, programming curricula, and academic engineering labs.

## Visual Archetype: Didactic Functional Model / Technical Schematic (Orthogonal 2D)

A clean, tangible technical schematic and didactic functional model illustrating the core engineering concept, architecture, or computational pipeline of the course.

## 4-Column Layout Ergonomics
* **Thumbnail Scaling Factor**: Course cards are rendered in multi-column catalog layouts (~280–360px wide per card).
* **Simplicity Contract**: Exactly **1 dominant, concrete didactic functional pipeline or modular assembly** centered in the 16:9 frame (occupying ~60–70% of canvas height).
* **Orthographic Frontal Projection**: Strictly planar, direct frontal or top-down alignment with zero perspective tilt for maximum architectural precision and instant thumbnail readability.
* **Generous Padding**: Ample margin around the central subject to all four canvas edges so the motif "breathes".
* **Zero Clutter**: Strictly no micro-details, no cluttered backgrounds, no unreadable pseudo-text code blocks, no room walls.

## Avatar & Entity Rules
* **Avatar Inclusion**: **STRICTLY NO Georg avatar**.
* **Human Figures**: Strictly no professors, students, or human figures (including no hands).
* **Scenery**: Strictly no lecture halls, no classroom benches, no physical desks or room walls.

## Environment & Palette
* **Environment**: Clean, uncluttered deep slate-black void (`#030712`).
* **Palette**: Dark slate foundation with soft ambient radial glow in domain brand colors:
  * Hardware & IoT: Amber (`#f59e0b`) and Cyan (`#06b6d4`)
  * Data & SQL: Emerald Green (`#10b981`) and Brand Blue (`#3b82f6`)
  * Simulation & Factory: Brand Yellow (`#f59e0b`) and Slate/Purple
  * Software Architecture & Web: Brand Blue (`#3b82f6`) and Mint/Cyan
  * Mobile & Cloud: Brand Purple (`#a855f7`) and Cyan
  * Systems Engineering: Brand Blue (`#3b82f6`) and Orange
* **Format & Aspect Ratio**: `AspectRatio: "16:9"`, saved as `preview.jpg` in `src/content/courses/[course_id]/preview.jpg`.

## Canonical Prompt Template

```text
Planar direct frontal orthographic 2D view of [didactic subject: IoT microcontroller telemetry pipeline / relational SQL data funnel / OOP class inheritance hierarchy / client-server API bridge / control loop block diagram], centered with generous padding on all sides. [Left component] on the left flows horizontally through [center processing engine] into [right output/target component] on the right. Deep slate-black background (#030712) with a soft ambient radial glow in [domain colors, e.g. #3b82f6 blue and #10b981 green]. Stylized Disney/Pixar comic-book vector illustration style, crisp dark ink outlines, bold cel shading, clean graphic shapes, ample breathing room between the subject and canvas borders. Strictly no human figures, no hands, no real text, no perspective tilt, no classroom background. 16:9 aspect ratio.
```
