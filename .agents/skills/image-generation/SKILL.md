---
name: image-generation
description: Design, prompt, condition, and generate brand-consistent comic illustrations, pipeline motifs, and presentation visuals following brand guidelines.
---

# Image Generation (Diffusion Prompts & Visual Brand DNA)

This skill governs prompt engineering, reference conditioning, and visual asset generation using `generate_image`.

## 1. Modular Architecture & Level 3 Resources
Before prompting or generating images, inspect the specialized Level 3 specifications:
- **Style Index**: [`style-guidelines.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/image-generation/resources/style-guidelines.md)
- **Brand DNA & Identity**: [`brand-dna.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/image-generation/resources/brand-dna.md) (Palette `#3b82f6`, `#f59e0b`, `#a855f7`, `#10b981`, slate canvas `#030712`, Disney/Pixar comic style, Georg Hackenberg identity).
- **Diffusion Principles**: [`diffusion-conditioning.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/image-generation/resources/diffusion-conditioning.md) (Room DNA, layout-locking avoidance, FG/MG/BG zonation, 0% occlusion planar assets, relational asset graph).
- **Archetype Guides**: [`archetypes/`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/image-generation/resources/archetypes/) (`posts.md`, `presentations.md`, `courses.md`, `projects.md`, `services.md`, `service-modules.md`, `interests.md`).

## 2. Visual Content Archetypes & Avatar Rules

| Content Type | Visual Archetype | Avatar Rule | Setting & Guidance |
| :--- | :--- | :--- | :--- |
| **Posts** | In-the-Lab / Engineering Scene | **Yes** (Hands-on Engineer) | [posts.md](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/image-generation/resources/archetypes/posts.md) |
| **Presentations** | Keynote Beamer Stage / Pipeline / Hero | **Yes / No** (Context-specific) | [presentations.md](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/image-generation/resources/archetypes/presentations.md) |
| **Courses** | Academic Lecture & Lab Blackboard | **Strictly No Avatar** (Didactic) | [courses.md](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/image-generation/resources/archetypes/courses.md) |
| **Projects** | Isometric Tech Workbench Showcase | **Strictly No Avatar** (Product) | [projects.md](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/image-generation/resources/archetypes/projects.md) |
| **Services** | Executive Architecture Strategy Board | **Yes** (Executive Advisor) | [services.md](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/image-generation/resources/archetypes/services.md) |
| **Service Modules** | Iconic Cyber-Physical Module Artifact | **Strictly No Avatar** (Emblem) | [service-modules.md](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/image-generation/resources/archetypes/service-modules.md) |
| **Interests** | Conceptual Macro-Cosmos / Domain Realm | **Strictly No Avatar** (Macro Realm) | [interests.md](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/image-generation/resources/archetypes/interests.md) |

## 3. Conditioning Protocol & Asset Graph
- **Protagonist Anchor**: Pass Dr. Georg Hackenberg (`src/content/characters/georg/portrait.png`) as Anchor 1 in `ImagePaths` when an avatar is required.
- **The 2D Layout-Locking Trap**: Never pass a wide-angle room overview photo (`reference.jpg`) into `ImagePaths` when requesting a novel perspective. This locks the 2D layout and causes duplicate floating artifacts.
- **Focus Variants (Mandatory)**: Inspect `src/content/environments/[id]/` and pass the specific pre-rendered focus variant (`[variant].jpg`) as Anchor 2.
- **Object Isolation**: Reference objects in `src/content/objects/` must be 100% planar, isolated, and free of foreground occlusion.

## 4. Key Staging Contracts
- **Keynote Decks (`preview.jpg`)**: White screen contract (luminous `#ffffff` projection canvas), presenter waist-up in left third, minimal text (1 title, 2–3 short labels).
- **Pipeline Step Cards (`Pipeline.astro`)**: Aspect ratio 16:9, strictly NO avatar, "1-Hero + 1–2 Interaction" rule, central virtual square safe-zone (50–56% width), luminous nebula background.
- **Story Hero Cards (`StoryHeroSlide.astro`)**: Aspect ratio 4:3, narrative stage framing.

## 5. Procedural User Review Gate
**MANDATORY**: Always present the exact prompt, aspect ratio, and list of reference `ImagePaths` to the user for explicit approval before calling `generate_image`. Never call the tool unannounced.
