# Project Rules for AI Coding Agents

## 1. Core Operating Constraints
- **Shell Environment**: The execution environment is **Windows PowerShell**.
  - **NEVER** use Linux Bash syntax (e.g. `&&`, `rm`, `ls`).
  - Always use PowerShell commands (`Copy-Item`, `New-Item`, `;`, etc.).
- **Public GitHub URLs for Source Code**:
  - Code files, plugins, and scripts from this repository are **NOT** served as static assets in `dist/`.
  - **NEVER** link to repository files using relative paths, local website paths, or `file:///` URLs inside markdown documents.
  - **ALWAYS** link using canonical GitHub URLs on `main`:  
    `https://github.com/ghackenberg/ghackenberg.github.io/blob/main/<path-to-file>` (e.g. `[`src/plugins/remark-mermaid.js`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/plugins/remark-mermaid.js)`).
- **Markdown & Diagram Hygiene**:
  - **NO Horizontal Dividers**: Never use `---` between markdown body sections (only for YAML frontmatter at the top). Use semantic headings (`##`, `###`).
  - **Nested Code Blocks**: Always use 4 backticks (` ````markdown ... ```` `) for outer code blocks enclosing markdown or backticks.
  - **Mermaid Diagrams**: Every `mermaid` code block **MUST** contain a YAML header with distinct `title` and `caption`:
    ````markdown
    ```mermaid
    ---
    title: "Systemarchitektur"
    caption: "Datenfluss zwischen Client und MCP-Server."
    ---
    flowchart TD
      A[Client] --> B[Server]
    ```
    ````
- **Cross-Platform Hashing & Path Normalization**:
  - Cryptographic hashes computed over source text files (`.astro`, `.css`, `.js`, `.ts`, `.md`, `.mdx`) **MUST** normalize line endings via `.replace(/\r\n/g, '\n')` before hashing (prevents Windows CRLF vs. Linux/Git LF divergence).
  - Relative file paths included in hash seeds **MUST** be normalized to POSIX format via `.replace(/\\/g, '/')`.
- **Windows File I/O Resilience**:
  - File write operations targeting generated cache, metadata, or export files (`.visual-cache.json`, audio caches, PDFs, thumbnails) **MUST** anticipate transient file locks by background indexers or watchers. Implement backoff retry loops (e.g. 5–6 attempts with 200–250ms backoff) rather than unprotected writes.
- **Path Aliases & Cohesion Boundary Contract**:
  - **Always** use configured path aliases (`@shared/*`, `@components/*`, `@layouts/*`, `@assets/*`, `@styles/*`, `@content/*`, `@plugins/*`) when importing across directory boundaries.
  - **NEVER** use relative parent directory traversals (`../components`, `../../shared`, `../../../layouts`, `../../plugins`, etc.). Strictly enforced by ESLint `no-restricted-imports` with zero tolerance (`--max-warnings=0`).
  - **Co-located Sibling Imports**: Relative sibling imports (`./...`) within the same directory are permitted and encouraged for tightly-coupled private helpers, types, and sub-controllers to maintain cohesion and encapsulation.
- **Scripts & CLI Architecture Contract**:
  - `scripts/` is exclusively reserved for standalone executable CLI entrypoints. **EVERY** `.ts` file anywhere within `scripts/` **MUST** have at least one corresponding script command in `package.json`.
  - Internal helper modules, libraries, and asset templates for scripts **MUST** live in `shared/` (e.g. `shared/slide-fingerprint.ts`, `shared/sync/`, `shared/templates/`) and be imported via `@shared/*`.
  - **NEVER** import from `scripts/` inside `src/` or `astro.config.ts`. Build-time integrations and plugins belong in `src/plugins/` under `@plugins/*`.
  - Strictly enforced by `npm run validate:scripts` in CI and ESLint architectural boundaries.

---

## 2. Universal Content Authoring & Interview Gate
Mandatory for **ALL** content creation (blog posts, presentations, lecture courses, documentation, or conceptual roadmaps):
- **Zero Assumptions / Anti-Hallucination Gate**:
  - Never invent personal opinions, technical stances, career milestones, evaluations of commercial tools, or organizational judgments without explicit user alignment.
- **Interview-First (`/grill-me` or Structured Q&A)**:
  - Before writing or restructuring content, present 4–8 targeted interview questions to establish:
    1. Core message & central thesis
    2. Key milestones, facts, dates, benchmarks, or quantitative metrics
    3. Industry partners, client projects, or specific tool/framework references
    4. Explicit terminology preferences and *No-Go* terms/framings (e.g. avoided controversies, positive vs. negative framing)
  - Content drafting may **only** begin after the user confirms the outline and key positions.

---

## 3. Co-Location Content Architecture & Local Guidelines
Domain-specific documentation and specifications live co-located with the content:
- **Presentation Engine**: Deep archetype specs, props, and TTS lexicon rules live in [`src/content/presentations/GUIDELINES.md`](src/content/presentations/GUIDELINES.md).
- **Local Guideline Lookup**: Before creating or restructuring content in any `src/content/<collection>/` directory, inspect and follow its local `GUIDELINES.md` if present.
- **Multilingual Content Architecture**:
  - **English (Strict)**: Technical tooling, interactive visualizations (`src/content/visualizations/`), academic publications (`src/content/publications/`), and GitHub projects.
  - **German (Instruction Language)**: University courses (`src/content/courses/`) with `language: "de"`.
  - **Explicit Post Language**: Blog posts (`src/content/posts/`) declare `language: "de"` or `language: "en"`.
  - **Zero Language Mixing**: Never mix German body text with English navigation/headings on the same page.

---

## 4. Visual Style & Image Generation Protocol
- **Visual Aesthetic**: Disney/Pixar comic illustration style, crisp dark ink line art, bold cel shading, dark slate background (`#030712`), and website brand color accents (`#3b82f6`, `#f59e0b`, `#a855f7`, `#10b981`).
- **Single Source of Truth**: For detailed diffusion prompts, Room DNA, character attributes, and object catalog, strictly consult [`IMAGE_STYLE_GUIDELINES.md`](IMAGE_STYLE_GUIDELINES.md).
- **Procedural Gate**:
  1. *Protagonist*: Use Dr. Georg Hackenberg (`src/content/characters/georg/portrait.png`) for solo professional scenes.
  2. *Focus Variants & Anti-Layout-Locking*: Always select a pre-rendered focus variant (`environments/[id]/[variant].jpg`) as Anchor 2 in `ImagePaths`. **NEVER** pass wide-angle room overviews (`reference.jpg`) into `ImagePaths` (prevents 2D layout-locking).
  3. *Character Slots & Poses*: Respect `characterSlots`, slot priorities, and strictly enforce `allowedPoses` (never generate standing poses in seated desk slots).
  4. *User Review Gate*: **Always present the exact prompt to the user for review** before calling `generate_image`.
  5. *Pipeline Step Images (16:9 Central Safe-Zone & Visual Sweet Spot)*: Horizontal pipeline images (`<Pipeline steps={[...]} />`) MUST use `AspectRatio: "16:9"`. The primary motif MUST be strictly confined within a **virtual square in the center** of the canvas (occupying ~50–56% width, matching height), with generous empty background padding across all outer edges. Background MUST be luminous blue-violet / deep indigo galaxy nebula with soft starlight. Never place motif elements in the outer left/right thirds (prevents lateral clipping under dynamic `object-cover` resizing). All elements float freely without containing boxes or borders. **Aesthetic Tone & Complexity Sweet Spot**: SOBER, TECHNICAL & PRECISE engineering finish instead of playful/emotional cartoon doodles (NO cartoon faces or cute eyes on objects). Enforce the **1-Hero + 1–2 Interaction Rule**: exactly 1 dominant central iconic object + maximum 1–2 directed interaction cues. Strictly NO micro-dashboards, multi-window UI panels, or unreadable miniature text/charts. Consult `IMAGE_STYLE_GUIDELINES.md` (Section 5.F).
  6. *Presentation Story Hero Slide Images (4:3 Aspect Ratio)*: Visual stage images in `StoryHeroSlide` (`<StoryHeroSlide ... />`) MUST use `AspectRatio: "4:3"`. This fills the 7-column card stage in 16:9 presentation slides with optimal vertical and horizontal proportions without lateral clipping. Consult `IMAGE_STYLE_GUIDELINES.md` (Section 5.G).

---

## 5. Presentation & Slide-as-Code Safety Gates
For complete slide archetype definitions and props, consult [`src/content/presentations/GUIDELINES.md`](src/content/presentations/GUIDELINES.md).
- **Two-Phase Generation Protocol ("Text-Freeze Principle")**:
  - **Phase 1 (Lightweight Drafting & Structure)**: Author and refine slide texts, frontmatter, references, and voiceovers. Validate purely syntactically using `npm run validate:slides:syntax` and `npm run validate:citations:syntax` (runs in <300ms without needing audio or PDF exports). **Do NOT run TTS synthesis or PDF exports during iterative text drafting!**
  - **Phase 2 (Heavy Build & Release)**: Once the user explicitly freezes the text (*"Text steht"*), run:
    `npm run audio:presentations` $\rightarrow$ `npm run export:slides-thumbs` $\rightarrow$ `npm run export:slides` $\rightarrow$ `npm run validate:slides` $\rightarrow$ `npm run lint:citations:ci`.
- **The 5-Point Cue Pre-Flight Checklist (Mandatory before saving any `.mdx` slide)**:
  1. *Highlights on every bullet & callout*: Every `BulletList` item `desc` and every `CalloutBox` MUST contain at least one inline `{cue:hl-...}` marker.
  2. *Monotonic visual DOM progression*: Spoken cues in `voiceover` MUST follow the exact sequence in which elements appear in the slide DOM (from top-to-bottom, left-to-right).
  3. *Structural point-cues vs. inline highlight spans*: Structural cues (`card-`, `box-`, `col-`, `step-`, `stat-`) are POINT cues and MUST NEVER have a closing tag (`{/cue}`). Only inline text-highlights (`hl-*`) have closing tags (`{cue:hl-...}...{/cue}`).
  4. *Title Slide Quadruple*: Title slides must include `title-main`, `title-sub`, a highlight `{cue:hl-...}` in subtitle, and `title-speaker` in that exact spoken order.
  5. *Title-Hook Orientation*: Voiceover MUST begin with 12–20 words (~3–5s) introducing the slide before the first `{cue:...}` trigger fires.
- **Modular Stylesheet Architecture & Slide Isolation Gate**:
  - `src/styles/` is decoupled into strict domain layers: `theme.css` (Tailwind core, design tokens, `@layer base`), `slides.css` (slide layouts, citation badges, print rules), `posts.css` (blog prose, markdown tables, callouts), and `components.css` (navbar, preview cards, badges, marquee).
  - `src/pages/presentations/[slug]/print.astro` **MUST ONLY** import `theme.css` and `slides.css`. It is strictly forbidden from importing `global.css`, `posts.css`, or `components.css` (guarantees that post/component style refactoring physically never affects slide rendering).
  - Enforced via `npm run lint:styles`.
- **Deterministic Visual Fingerprinting & 0-Diff Pixel Protection**:
  - Slide thumbnail and PDF handout freshness is tracked deterministically in `src/content/presentations/<id>/.visual-cache.json` using composite SHA-256 hashes (`styleHash` + `slideVisualHash` + `deckHash`).
  - *Separation of visual and narrative content*: Changes to speaker `voiceover:` or `notes:` **NEVER** invalidate slide thumbnails or PDF handouts.
  - *Pixel-by-pixel 0-Diff Protection*: Before writing any newly rendered WebP thumbnail to disk, `scripts/generate-slide-thumbnails.js` performs an offscreen pixel comparison via Chrome's native `OffscreenCanvas`. If `diffPixels === 0`, writing is suppressed, completely eliminating false binary git diffs.

---

## 6. Content Optimization & Analytics Guidelines (SEO, GEO & AIO)
- **Mandatory MCP Server (`unified-analytics`)**:
  - *Pre-Optimization Audits*: Run `get_page_audit` before modifying existing articles to protect top search queries AND inspect reader retention (`scrollFunnel`), median scroll reach, and device/browser anomaly warnings.
  - *Retention & Opportunity Discovery*: Discover striking-distance keywords with `find_seo_opportunities`, identify retention bottlenecks with `find_retention_bottlenecks`, and analyze technical audience segments with `get_audience_breakdown`.
  - *AIO Readiness Audits*: Audit collections with `scan_aio_readiness` and evaluate GEO/AIO extractability on drafted markdown with `evaluate_aio_extractability`.
- **Telemetry & Custom Event Tracking**:
  - *Declarative Click Tracking Contract (`data-track-*`)*:
    - **Never** write ad-hoc imperative JavaScript click listeners purely for tracking buttons, modals, or links.
    - **Always** use the declarative HTML attribute schema:
      - `data-track-event="<Event Name>"` (e.g. `data-track-event="High Intent: Copy Email"`, `data-track-event="Modal Opened"`, `data-track-event="Filter Content"`).
      - `data-track-<prop-name>="<value>"`: Automatically parsed into event props (e.g. `data-track-location="home-contact"` $\rightarrow$ `{ location: "home-contact" }`, `data-track-modal="privacy"` $\rightarrow$ `{ modal: "privacy" }`).
      - `data-track-props='{"key": "value"}'`: Optional JSON payload for complex or structured data.
  - *Semantic Section & Heading Contract*:
    - Every `<section>` on landing pages and pages with structured blocks MUST declare a human-readable `id` (e.g. `<section id="research">`).
    - In long-form reading contexts (`article`, `.post-body`, `main`), content headings (`h2`, `h3`, `h4`) with IDs are automatically tracked alongside sections.
    - `telemetry.ts` observes these elements with a 2.0s dwell threshold at $\ge 50\%$ viewport visibility to emit `Section Viewed` (`{ id }`) without intrusive per-asset tracking or string redundancy.
  - *Preview Card Discovery & CTR Contract*:
    - Feed and catalog cards MUST use `<article class="... preview-card ...">` with `data-card-id="<slug>"` and `data-collection="<collection>"`.
    - Dwell time of 1.5s at $\ge 50\%$ viewport visibility emits `Card Viewed` (`{ id, collection }`).
    - User clicks on preview cards trigger delegated `Card Clicked` events (`{ id, collection }`) for automated CTR analytics.
  - *Semantic ID Integrity Gate*:
    - Build output is strictly verified via `npm run validate:semantic-ids`:
      1. Zero duplicate DOM IDs per HTML page.
      2. 100% of `<section>` elements must possess a non-empty `id` attribute.
  - *Component-Internal State Controllers*: Deeply interactive state machines (like `SlideDeck.astro` or `AudioSyncController.ts`) co-locate their event emissions (`Slide Viewed`, `Presentation Completed`, `Audio Played`) within their lifecycle hooks.
- **Generative Engine Optimization (GEO/AEO)**:
  - *Answer-First Pattern*: Concise definition paragraph (40–55 words) immediately below key `##` headings.
  - *Question-Framed Headings*: Formulate 1–2 headings per article as explicit natural-language queries ("Was ist...", "Wie funktioniert...").
  - *Structured Synthesis*: Summarize trade-offs, metrics, and comparisons in markdown tables (`| ... |`).

---

## 7. Citation Management & Reference Integrity Gate
Mandatory for **ALL** content collections supporting references (blog posts in `src/content/posts/` and presentation slides in `src/content/presentations/`):
- **Structured Frontmatter Schema**:
  - Every external reference MUST be declared in the YAML frontmatter `references:` array.
  - Required fields: `id` (semantic kebab-case key, e.g. `aggarwal-2024-geo`, `bostock-2011-datadriven-documents`), `type` (`article`, `inproceedings`, `book`, `online`, `misc`), `title`, `author`, `year`, and `url` (or `doi`).
  - Optional field: `label` (explicitly overrides the auto-generated BibTeX-Alpha key if necessary).
- **In-Text Semantic Citation Contract**:
  - Always cite using the semantic key syntax: `[@id]` (e.g. `[@aggarwal-2024-geo]`, `[@bostock-2011-datadriven-documents]`).
  - **NEVER** hardcode numeric indices (`[1]`) or manual labels (`[Agg24]`) in raw Markdown or MDX text.
  - Remark plugin `remarkCitations` transforms `[@id]` at build time into deterministic alphanumeric BibTeX-Alpha labels (e.g. `[Agg24]`) and creates interactive reference links (blog posts: anchor jump `#ref-id`; slides: click-to-open reference modal `[data-open-reference="id"]`).
- **100% Bidirectional Parity Gate**:
  - Every reference declared in `references:` MUST be cited at least once in the markdown body using `[@id]`.
  - Every `[@id]` used in content MUST correspond to a declared reference in that document's `references:` frontmatter.
  - Zero orphan references and zero undefined citation tags.
- **Reference Section Layout & Hygiene**:
  - **NO Horizontal Divider**: Never place `---` or border lines immediately before the references heading or list.
- **Pre-Flight Validation**:
  - *Phase 1 (Drafting)*: Validate syntax and in-text parity in <200ms using `npm run validate:citations:syntax` (and `npm run validate:slides:syntax` for slides).
  - *Phase 2 (Release)*: Verify external source links, DOIs, and metadata against remote APIs using `npm run lint:citations` (or `npm run lint:citations:ci`).

---

## 8. Continuous Improvement, Retrospectives & Tool Promotion
- **Post-Task Reflection Protocol**:
  - After completing any major milestone or release (e.g. merge to `main`, publication of a keynote or article), the agent proactively reflects on:
    1. *Friction & Waste*: Where did iteration loops, validation failures, or token waste occur?
    2. *Gate & Tooling Evolution*: What pre-flight check or tooling upgrade would prevent this in the first attempt?
    3. *Direct Codification*: Propose concrete guideline updates or tool creations.
- **Rule $\rightarrow$ Tool Promotion & Backlog Management**:
  - Repetitive, algorithmic, or token-heavy processes must not stay as verbose prompt rules; they should be promoted into automated tools or MCP servers.
  - New tool and system proposals are specified as numbered RFCs in [`backlog/system/`](backlog/system/) (e.g. `001-slide-engine-mcp.md`), content ideas in [`backlog/content/`](backlog/content/), and tracked in [`backlog/README.md`](backlog/README.md).

## 9. UI Interaction & Motion Ergonomics
- **Touch Gesture Ergonomics (Axis-Locking & Disambiguation)**:
  - *No Scroll-Trapping*: Horizontally swipeable or draggable components (e.g. carousels, marquees, code viewports) must never capture or trap native vertical page scrolling on touch devices.
  - *8px Direction-Locking Contract*: Evaluate touch delta vectors immediately upon movement. If $|\Delta Y| > |\Delta X|$ at the 8px threshold, immediately yield gesture control to native page scrolling and lock the component's horizontal drag. If $|\Delta X| > |\Delta Y|$, lock the component horizontally and prevent native vertical scrolling.
  - *Drag vs. Click Disambiguation*: When an interactive component contains clickable links or cards, suppress the click event in the capture phase if the pointer displacement exceeds 12px during the gesture.
- **Perceptual Stability & Static Spatial Scaffolding**:
  - *Static Layout Integrity*: Interactive visual states (focus, hover, parallax tiers, active rows) must never resize or dynamically morph the bounding boxes or heights of neighboring content rows (prevents layout jitter, Cumulative Layout Shifts, and disorientation).
  - *Separation of Interaction and Visuals*: Ergonomic touch issues must always be resolved via interaction/gesture logic (axis-locking, thresholds), never through ad-hoc visual restructuring, row-zooming, or blurring/dimming neighboring elements.

