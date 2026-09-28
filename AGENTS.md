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

---

## 5. Presentation & Slide-as-Code Safety Gates
For complete slide archetype definitions and props, consult [`src/content/presentations/GUIDELINES.md`](src/content/presentations/GUIDELINES.md).
- **Two-Phase Generation Protocol ("Text-Freeze Principle")**:
  - **Phase 1 (Lightweight Drafting & Structure)**: Author and refine slide texts, frontmatter, and voiceovers. Validate purely syntactically using `npm run validate:slides:syntax` (runs in <300ms without needing audio or PDF exports). **Do NOT run TTS synthesis or PDF exports during iterative text drafting!**
  - **Phase 2 (Heavy Build & Release)**: Once the user explicitly freezes the text (*"Text steht"*), run:
    `npm run audio:presentations` $\rightarrow$ `npm run export:slides-thumbs` $\rightarrow$ `npm run export:slides` $\rightarrow$ `npm run validate:slides`.
- **The 5-Point Cue Pre-Flight Checklist (Mandatory before saving any `.mdx` slide)**:
  1. *Highlights on every bullet & callout*: Every `BulletList` item `desc` and every `CalloutBox` MUST contain at least one inline `{cue:hl-...}` marker.
  2. *Monotonic visual DOM progression*: Spoken cues in `voiceover` MUST follow the exact sequence in which elements appear in the slide DOM (from top-to-bottom, left-to-right).
  3. *Structural point-cues vs. inline highlight spans*: Structural cues (`card-`, `box-`, `col-`, `step-`, `stat-`) are POINT cues and MUST NEVER have a closing tag (`{/cue}`). Only inline text-highlights (`hl-*`) have closing tags (`{cue:hl-...}...{/cue}`).
  4. *Title Slide Quadruple*: Title slides must include `title-main`, `title-sub`, a highlight `{cue:hl-...}` in subtitle, and `title-speaker` in that exact spoken order.
  5. *Title-Hook Orientation*: Voiceover MUST begin with 12–20 words (~3–5s) introducing the slide before the first `{cue:...}` trigger fires.

---

## 6. Content Optimization & Analytics Guidelines (SEO, GEO & AIO)
- **Mandatory MCP Server (`unified-analytics`)**:
  - *Pre-Optimization Audits*: Run `get_page_audit` before modifying existing articles to protect top search queries AND inspect reader retention (`scrollFunnel`), median scroll reach, and device/browser anomaly warnings.
  - *Retention & Opportunity Discovery*: Discover striking-distance keywords with `find_seo_opportunities`, identify retention bottlenecks with `find_retention_bottlenecks`, and analyze technical audience segments with `get_audience_breakdown`.
  - *AIO Readiness Audits*: Audit collections with `scan_aio_readiness` and evaluate GEO/AIO extractability on drafted markdown with `evaluate_aio_extractability`.
- **Telemetry & Custom Event Tracking**:
  - *Semantic Event Tracking*: When creating or refactoring interactive components (audio players, slide presentations, interactive calculators, downloadable assets), always integrate Plausible Custom Events with descriptive properties (e.g. download URLs, slide progress, audio completion) to feed back into the analytics engine.
- **Generative Engine Optimization (GEO/AEO)**:
  - *Answer-First Pattern*: Concise definition paragraph (40–55 words) immediately below key `##` headings.
  - *Question-Framed Headings*: Formulate 1–2 headings per article as explicit natural-language queries ("Was ist...", "Wie funktioniert...").
  - *Structured Synthesis*: Summarize trade-offs, metrics, and comparisons in markdown tables (`| ... |`).

---

## 7. Continuous Improvement, Retrospectives & Tool Promotion
- **Post-Task Reflection Protocol**:
  - After completing any major milestone or release (e.g. merge to `main`, publication of a keynote or article), the agent proactively reflects on:
    1. *Friction & Waste*: Where did iteration loops, validation failures, or token waste occur?
    2. *Gate & Tooling Evolution*: What pre-flight check or tooling upgrade would prevent this in the first attempt?
    3. *Direct Codification*: Propose concrete guideline updates or tool creations.
- **Rule $\rightarrow$ Tool Promotion & Backlog Management**:
  - Repetitive, algorithmic, or token-heavy processes must not stay as verbose prompt rules; they should be promoted into automated tools or MCP servers.
  - New tool and system proposals are specified as numbered RFCs in [`backlog/system/`](backlog/system/) (e.g. `001-slide-engine-mcp.md`), content ideas in [`backlog/content/`](backlog/content/), and tracked in [`backlog/README.md`](backlog/README.md).

## 8. UI Interaction & Motion Ergonomics
- **Touch Gesture Ergonomics (Axis-Locking & Disambiguation)**:
  - *No Scroll-Trapping*: Horizontally swipeable or draggable components (e.g. carousels, marquees, code viewports) must never capture or trap native vertical page scrolling on touch devices.
  - *8px Direction-Locking Contract*: Evaluate touch delta vectors immediately upon movement. If $|\Delta Y| > |\Delta X|$ at the 8px threshold, immediately yield gesture control to native page scrolling and lock the component's horizontal drag. If $|\Delta X| > |\Delta Y|$, lock the component horizontally and prevent native vertical scrolling.
  - *Drag vs. Click Disambiguation*: When an interactive component contains clickable links or cards, suppress the click event in the capture phase if the pointer displacement exceeds 12px during the gesture.
- **Perceptual Stability & Static Spatial Scaffolding**:
  - *Static Layout Integrity*: Interactive visual states (focus, hover, parallax tiers, active rows) must never resize or dynamically morph the bounding boxes or heights of neighboring content rows (prevents layout jitter, Cumulative Layout Shifts, and disorientation).
  - *Separation of Interaction and Visuals*: Ergonomic touch issues must always be resolved via interaction/gesture logic (axis-locking, thresholds), never through ad-hoc visual restructuring, row-zooming, or blurring/dimming neighboring elements.

