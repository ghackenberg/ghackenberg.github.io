# Project Rules for AI Agents

## 1. Visual Style & Image Generation Protocol
Whenever asked to generate or modify an image (preview, hero, social card, or diagram):
1. **Protagonist & Character Discovery Protocol**:
   - For solo professional scenes (author, professor, software architect, presenter), use **Dr. Georg Hackenberg** as the protagonist (`src/content/characters/georg/portrait.png`).
   - Before generating any scene:
     1. Inspect `src/content/characters/` to identify existing characters.
     2. Verify which characters are suitable for the chosen environment (check cross-references in `environments` and `characters`).
     3. **Character Capacity Gate**: Respect the focus variant's `maxCharacters` limit (e.g., workstation focus = 1 character; beamer stage = up to 2; visitor table = up to 2; full lab = up to 6; pure object shots = 0).
     4. If a scene logically requires additional people (e.g. students, workshop participants, collaboration partners) and no suitable character exists, **propose and introduce the new character first** in `src/content/characters/` (with role, attributes, portrait, and references).
2. **Follow the Relational Library Protocol (Environments & Objects)**:
   - Check `src/content/characters/`, `src/content/objects/`, and `src/content/environments/`.
   - **Environment & Focus Variant Selection (Mandatory)**:
     - Inspect existing environments and their available `variants` (e.g., `workplace-focus`, `beamer-screen-focus`).
     - **Select the best matching focus variant** for the camera angle, setting, and required `maxCharacters`.
     - If no suitable focus variant exists for an existing environment, **propose and generate the new focus variant first** and register it in `index.md`.
     - If the scene requires a completely new location, **propose and create the new environment with an initial set of focus variants first**.
   - **Object Discovery, Signature Anchors & Asset Hygiene**:
     - Check `src/content/objects/` for recurring signature objects.
     - **Signature Objects per Environment**: Every real-world environment should have 1–3 signature objects (e.g. wall art, custom ceramic mugs, engraved nameplates). When introducing a new environment, propose its signature objects.
     - **Variant Object Visibility (`visibleObjects`)**: Respect which objects are physically visible from the chosen focus variant's camera angle (`visibleObjects`). Incorporate visible objects into the prompt's depth layers. If an object is not in `visibleObjects`, do not invent it in the frame.
     - Object references must be 100% planar/orthographic flat-lays with 0% foreground occlusion. If missing, create/isolate them first before registering in the library.
3. **Decoupled Viewpoints & `ImagePaths` Conditioning Rules**:
   - **NEVER pass wide-angle room overview photos (`reference.jpg`) to `ImagePaths`** when requesting a close-up or novel perspective (avoids the 2D layout-locking trap).
   - **MANDATORY: Always use pre-rendered Focus Variants as environment anchors in `ImagePaths`** when the scene takes place at that specific setting/angle:
     - Anchor 1: Protagonist portrait (`characters/georg/portrait.png`) or primary character portrait.
     - Anchor 2: Matching environment focus variant (`environments/[id]/[variant].jpg`, e.g. `workplace-focus.jpg` or `beamer-screen-focus.jpg`).
     - Anchor 3 (optional): Isolated planar object (`objects/[id]/reference.jpg`) or second character.
   - Use text-based **Room DNA** and depth zonation (`Foreground / Midground / Background`) to guide action, screens, and lighting.
4. **User Review Gate**:
   - Before calling `generate_image`, **always present the exact prompt to the user for review**.
5. **Style Aesthetic**:
   - Strictly adhere to `IMAGE_STYLE_GUIDELINES.md`: Disney/Pixar comic illustration style, crisp dark ink line art, bold cel shading, dark slate background (`#030712`), and website brand color accents (`#3b82f6`, `#f59e0b`, `#a855f7`, `#10b981`).


## 2. Shell Environment
- The execution environment is **Windows PowerShell**.
- **NEVER** use Linux Bash syntax (e.g., `&&`, `rm`, `ls`).
- Always use PowerShell commands (`Copy-Item`, `New-Item`, `;`, etc.).
