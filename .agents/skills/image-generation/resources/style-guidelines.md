# Image Style & Brand Guidelines (Level 3 Resource Index)

This document serves as the central index and entrypoint for generating visual assets across the website. The image generation system enforces a cohesive, brand-aligned visual language using diffusion conditioning protocols and structured content archetypes.

## 1. Design Philosophy & Visual Aesthetic

All illustrations across the platform follow a **stylized Disney/Pixar comic-book vector illustration** aesthetic:
* **Dark Slate Canvas**: All imagery is built on the dark theme foundation (`#030712`), blending seamlessly into the site's design system.
* **Linework & Shading**: Crisp dark ink outlines, bold cel shading, and clean gradients without photorealistic textures or soft 3D renders.
* **Clean Framing**: Borderless full-bleed compositions with zero perimeter frames, white photo margins, or nested picture-in-picture boxes.

## 2. Core Architectural Resources

For deep specifications, consult the dedicated Level 3 modular reference documents:

* [**Visual Brand DNA & Identity Core**](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/image-generation/resources/brand-dna.md): Global color palette (`#3b82f6`, `#f59e0b`, `#a855f7`, `#10b981`), comic vector styling, and canonical protagonist identity (Dr. Georg Hackenberg facial identity and attire contexts).
* [**Diffusion Conditioning & Asset Engineering**](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/image-generation/resources/diffusion-conditioning.md): Mathematical diffusion principles, Room DNA, avoiding the 2D layout-locking trap, cinematographic zonation (FG/MG/BG), object isolation (0% occlusion), focus variant conditioning slots, and the relational asset graph.

## 3. Visual Content Archetypes

Every generated asset adheres to one of seven specialized visual archetypes:

| Content Type | Visual Archetype | Avatar Rule | Detailed Guide |
| :--- | :--- | :--- | :--- |
| **Posts** | In-the-Lab / Engineering Scene | **Yes** (Hands-on Engineer) | [archetypes/posts.md](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/image-generation/resources/archetypes/posts.md) |
| **Presentations** | Keynote Beamer Stage / Pipeline / Hero | **Yes / No** (Context-specific) | [archetypes/presentations.md](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/image-generation/resources/archetypes/presentations.md) |
| **Courses** | Academic Lecture & Lab Blackboard | **Strictly No Avatar** (Didactic) | [archetypes/courses.md](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/image-generation/resources/archetypes/courses.md) |
| **Projects** | Isometric Tech Workbench Showcase | **Strictly No Avatar** (Product) | [archetypes/projects.md](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/image-generation/resources/archetypes/projects.md) |
| **Services** | Executive Architecture Strategy Board | **Yes** (Executive Advisor) | [archetypes/services.md](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/image-generation/resources/archetypes/services.md) |
| **Service Modules** | Iconic Cyber-Physical Module Artifact | **Strictly No Avatar** (Emblem) | [archetypes/service-modules.md](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/image-generation/resources/archetypes/service-modules.md) |
| **Interests** | Conceptual Macro-Cosmos / Domain Realm | **Strictly No Avatar** (Macro Realm) | [archetypes/interests.md](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/image-generation/resources/archetypes/interests.md) |

## 4. Generation & Review Protocol

Before calling `generate_image`, always:
1. Select the relevant archetype and consult its prompt template.
2. Check `src/content/environments/` and `src/content/characters/` for conditioning anchors (`ImagePaths`).
3. Present the prompt, aspect ratio, and reference images to the user for explicit approval.
