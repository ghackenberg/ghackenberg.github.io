# Diffusion Conditioning & Asset Engineering

This document details the mathematical and diffusion conditioning principles, asset hygiene rules, and relational graph protocols required to generate deterministic, artifact-free illustrations.

## 1. Decoupled Viewpoints & Room DNA (Raum-DNA)

Diffusion vision encoders (e.g. CLIP, SigLIP) process visual reference images by conditioning both semantic features and spatial geometry:

### The 2D Layout-Locking Trap
* Passing a wide-angle room reference photo into `ImagePaths` causes the vision encoder to lock the global 2D composition, perspective lines, and spatial layout of that photo.
* If a prompt requests a novel viewpoint (such as a 3/4 workstation close-up), the model cannot rotate the 3D camera. Instead, it preserves the wide-room geometry and attempts to inpaint floating duplicates or warped miniature elements into the center of the frame.
* **Solution**: Never pass a wide-angle room overview photo (`reference.jpg`) to `ImagePaths` when requesting a specific angle or close-up framing.

### The Room-DNA Prompt Architecture
* Rely on explicit **Room DNA** in the prompt text: architectural style, structural materials, lighting sources, permanent spatial anchors, and exterior window views.
* Room DNA decouples geometric camera positioning from semantic environment identity, allowing the diffusion model to render any angle reliably.

### Cinematographic Zonation (Depth Layering)
Structure diffusion prompts strictly in three progressive depth layers to exploit token priority:
1. **Foreground (FG)**: Nearest desk edge, signature mugs, mechanical keyboard, input devices, or lectern edges.
2. **Midground (MG)**: Primary focal hero — angled monitor with legible screen content, ergonomic chair, or active presenter.
3. **Background (BG)**: Architectural timber or concrete walls, wall-mounted whiteboards, framed art, and floor-to-ceiling panoramic windows framing natural landscapes.

## 2. Canonical Object Isolation & Asset Hygiene

To prevent unwanted visual contamination across scenes, reference assets in `src/content/objects/` must adhere to strict hygiene:

### 0% Occlusion Rule (No Foreground Contamination)
* The target object must never be partially covered or obstructed by other items (e.g., a monitor partially blocking a wall painting).
* Occlusion causes **Attribute Bleeding** and **Semantic Leakage**: the encoder conflates overlapping items and bakes extraneous details (such as glowing code syntax or bezels) into the target asset's representation.

### Planar & Orthographic (No Perspective Baking)
* Reference objects must be captured or rendered as planar 2D flat-lays or orthographic frontal views.
* Perspective foreshortening or trapezoidal warping in reference images is permanently baked into the latent representation, causing unnatural double-distortion when re-projected into novel scenes.

### Style Purity
* All reference assets must strictly embody the stylized Disney/Pixar comic aesthetic (crisp ink linework, cel shading, no photorealistic museum backgrounds, no drop-shadow borders).

## 3. Environment Focus Variants & Conditioning Slots

To achieve consistent perspective without the layout-locking trap, the repository uses pre-rendered environment focus variants:

### Focus Variant Anchoring Protocol
1. Inspect existing environments and their registered variants under `src/content/environments/[environment_id]/`.
2. Select the matching pre-rendered focus variant (e.g. `workplace-focus.jpg` or `beamer-screen-focus.jpg`).
3. Pass the pre-rendered focus variant as the environment anchor in `ImagePaths`.

### Conditioning Slots (`ImagePaths`, up to 3 images)
* **Anchor 1 (Character)**: Protagonist portrait (`src/content/characters/georg/portrait.png`).
* **Anchor 2 (Environment)**: Matching pre-rendered focus variant (`src/content/environments/[id]/[variant].jpg`).
* **Anchor 3 (Object - Optional)**: Clean, isolated, planar reference item (`src/content/objects/[id]/reference.jpg`).

## 4. Central Visual Asset Library & Relational Graph

All recurring visual entities are managed as typed Astro content collections with cross-references:

### Characters (`src/content/characters/[id]/`)
* `index.md`: Declares canonical prompt description, facial/body attributes, role, primary workspaces (`environments`), and signature gear (`objects`).
* Reference images: `portrait.png`, plus variant poses or attire.

### Objects (`src/content/objects/[id]/`)
* `index.md`: Declares category, canonical prompt, form, materials, brand colors, host `environments`, and owner `characters`.
* Reference images: Isolated, planar, 0% occlusion `reference.jpg`.

### Environments (`src/content/environments/[id]/`)
* `index.md`: Declares immutable `dna` (architecture, materials, lighting, palette, window vista) and structured `variants`.
* Each variant defines: `shotType`, `cameraAngle`, `focalTarget`, `depthLayers`, `visibleObjects`, `maxCharacters`, and `promptSnippet`.
* Reference renders: Pre-rendered focus variants (`[variant].jpg`).

## 5. Mandatory Generation Protocol

Before invoking `generate_image`, execute the following verification steps:

1. **Focus Variant Selection**: Match the requested perspective against `src/content/environments/`. Verify `maxCharacters` and `visibleObjects` capacity. If no variant fits, author a new focus variant first.
2. **Character & Object Verification**: Confirm characters exist in `src/content/characters/` and referenced objects exist in `src/content/objects/`.
3. **Prompt Composition**: Synthesize character traits, environment DNA, depth layers (FG/MG/BG), and visible object cues.
4. **User Review Gate**: Present the final prompt, aspect ratio, and selected `ImagePaths` to the user before calling `generate_image`.
