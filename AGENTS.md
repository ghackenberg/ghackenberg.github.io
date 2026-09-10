# Project Rules for AI Agents

## 1. Visual Style & Image Generation Protocol
Whenever asked to generate or modify an image (preview, hero, social card, or diagram):
1. **Never use generic or random human characters**: If a person (author, professor, software engineer, presenter) is in the scene, use **Dr. Georg Hackenberg** as the protagonist (`src/content/characters/georg/portrait.png`).
2. **Follow the 2-Step Generation Protocol**:
   - Check `src/content/characters/`, `src/content/objects/`, and `src/content/environments/`.
   - If the required character, key object, or environment does not exist (or lacks the required angle/outfit variant), **create and register the asset in the library FIRST** (including reference image and `index.md`).
   - Before calling the image generation tool, **present the exact prompt to the user for review**.
   - Use `ImagePaths` in `generate_image` (up to 3 reference images) pointing to the canonical library assets.
3. **Style Aesthetic**:
   - Strictly adhere to `IMAGE_STYLE_GUIDELINES.md`: Disney/Pixar comic illustration style, crisp ink line art, bold cel shading, dark slate background (`#030712`), and website brand color accents (`#3b82f6`, `#f59e0b`, `#a855f7`, `#10b981`).

## 2. Shell Environment
- The execution environment is **Windows PowerShell**.
- **NEVER** use Linux Bash syntax (e.g., `&&`, `rm`, `ls`).
- Always use PowerShell commands (`Copy-Item`, `New-Item`, `;`, etc.).
