---
name: presentation-authoring
description: Author, modify, or export Slide-as-Code presentations, synchronize voiceovers with cues, generate Edge-TTS audio, and render 0-diff thumbnails and PDF handouts.
---

# Presentation Authoring (Slide-as-Code Engine)

This skill governs the creation, modification, validation, and release of interactive presentations in `src/content/presentations/`.

## 1. Directory Structure & Naming
Every presentation lives in its own directory under `src/content/presentations/<id>/`:
- `<id>` format: `YYYY_MM_DD_kebab_case_title` (e.g. `2026_10_05_wie_promptet_man_richtig`).
- `index.md`: Deck-level frontmatter (`title`, `description`, `date`, `category`, `language`, `previewImage`, `authors`).
- `slides/`: Ordered slide files (`01_titelfolie.mdx`, `02_agenda.mdx`, etc.).
- `audio/`: Generated Edge-TTS MP3 files and word-level `.cues.json` manifests.
- `thumbnails/`: Generated 16:9 WebP slide thumbnails.
- `.visual-cache.json`: Deterministic SHA-256 visual fingerprints (`styleHash` + `slideVisualHash` + `deckHash`).
- `slides-dark.pdf` / `slides-light.pdf`: Generated export handouts.

## 2. Two-Phase Generation Protocol ("Text-Freeze Principle")
- **Phase 1 (Lightweight Drafting & Structure)**:
  1. Author slide MDX content, speaker notes, and voiceovers.
  2. Validate purely syntactically in <300ms using:
     ```powershell
     npm run validate:slides:syntax ; npm run validate:citations:syntax
     ```
  3. **DO NOT** generate TTS audio, thumbnails, or PDFs during text iteration!
- **Phase 2 (Heavy Build & Release)**:
  Once the text is explicitly frozen (*"Text steht"*):
  1. Synthesize speaker audio & cue timestamps:
     ```powershell
     npm run audio:presentations
     ```
  2. Render 16:9 thumbnails (with offscreen 0-diff pixel protection):
     ```powershell
     npm run export:slides-thumbs
     ```
  3. Render PDF handouts (Dark & Light mode):
     ```powershell
     npm run export:slides
     ```
  4. Follow the master release verification gate (see `build-engineering`).

## 3. The 5-Point Cue Pre-Flight Checklist
Before finalizing any `.mdx` slide, enforce these 5 mandatory cue rules:
1. **Highlights on every bullet & callout**: Every `BulletList` item `desc` and every `CalloutBox` MUST contain at least one inline `{cue:hl-...}` marker.
2. **Monotonic visual DOM progression**: Spoken cues in `voiceover` MUST follow the exact order in which elements appear in the slide DOM (from top-to-bottom, left-to-right). Never reference an earlier element after a later one has been introduced.
3. **Point-cues vs. Highlight spans**:
   - Structural block cues (`card-`, `box-`, `col-`, `step-`, `stat-`, `vis-`) are POINT cues: they mark an entrance and MUST NEVER have a closing tag (`{/cue}`).
   - Inline text-highlights (`hl-*`) have matching closing tags: `{cue:hl-...}highlighted text{/cue}`.
4. **Title Slide Quadruple**: Title slides must sequence `title-main`, `title-sub`, a highlight `{cue:hl-...}` in subtitle, and `title-speaker` in that exact spoken order.
5. **Title-Hook Orientation**: Voiceover MUST start with 12–20 words (~3–5s) introducing the slide topic before the first `{cue:...}` trigger fires.

## 4. Slide Layout Archetypes
Consult [`src/content/presentations/GUIDELINES.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/presentations/GUIDELINES.md) for full prop definitions:
- `<TitleSlide />`: Title, subtitle, speaker badge, optional teaser card.
- `<SplitSlide />`: 50/50 or 40/60 two-column comparisons (e.g. Problem vs. Solution).
- `<PipelineSlide />`: Step sequences. For >3 steps with imagery, prefer `<StoryHeroSlide />` to avoid vertical squeezing.
- `<GridSlide cols={2|3} />`: 2x2 quadrants or 3-column taxonomies.
- `<StoryHeroSlide visualSpan="col-span-7" narrativeSpan="col-span-5" />`: Dominant visual stage (4:3 aspect ratio) with narrative insights.
- `<CodeComparisonSlide />`: Dual-column code or structured schema diffs.
- `<SectionSlide />`: Chapter breaks with Leitfrage, divider, and bridge cue.

## 5. Style Isolation & DOM ID Integrity
- `src/pages/presentations/[slug]/print.astro` MUST only import `theme.css` and `slides.css` (enforced by `npm run lint:styles`).
- **Never assign `cue` as an HTML `id`**: Slides share a single DOM in Reveal.js. Always use `data-cue="cue-id"`, never duplicate `id="cue-id"` across slides.
