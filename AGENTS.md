# Project Rules for AI Agents

## 1. Visual Style & Image Generation Protocol
Whenever asked to generate or modify an image (preview, hero, social card, or diagram):
1. **Protagonist & Character Discovery Protocol**:
   - For solo professional scenes (author, professor, software architect, presenter), use **Dr. Georg Hackenberg** as the protagonist (`src/content/characters/georg/portrait.png`).
   - Before generating any scene:
     1. Inspect `src/content/characters/` to identify existing characters.
     2. Verify which characters are suitable for the chosen environment (check cross-references in `environments` and `characters`).
     3. **Character Slot & Pose Enforcement Gate**:
        - Each focus variant defines discrete `characterSlots` (the maximum physical capacity is strictly `characterSlots.length`; pure object or unoccupied views have empty `characterSlots: []`).
        - **Slot Requirements**: Any slot with `required: true` must be filled. Slots with `required: false` (default) can be filled or left empty (e.g. for unoccupied room plates).
        - **Slot Priority**: Assign characters in order of `priority` (Priority 1 is reserved for the primary protagonist Dr. Georg Hackenberg).
        - **Pose Constraints (Strict)**: The character's pose in the prompt must strictly be chosen from `allowedPoses` and must **NEVER** use any pose from `prohibitedPoses` (e.g., never generate a standing pose in a seated desk slot, and never generate a seated pose in a standing whiteboard slot).
        - **Spatial Grounding & Framing**: Prompts must incorporate the slot's `spatialPlacement`, `defaultAction`, and `cutline` to ensure realistic anatomy and avoid floating/amputated limbs.
     4. If a scene logically requires additional people (e.g. students, workshop participants, collaboration partners) and no suitable character exists, **propose and introduce the new character first** in `src/content/characters/` (with role, attributes, portrait, and references).
2. **Follow the Relational Library Protocol (Environments & Objects)**:
   - Check `src/content/characters/`, `src/content/objects/`, and `src/content/environments/`.
   - **Environment & Focus Variant Selection (Mandatory)**:
     - Inspect existing environments and their available `variants` (e.g., `workplace-focus`, `beamer-screen-focus`).
     - **Select the best matching focus variant** for the camera angle, setting, and available `characterSlots`.
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


## 3. Blog Post Writing & Formatting Guidelines
- **NO Horizontal Dividers**: **NEVER** use horizontal rules (`---`) between sections in blog posts (only use `---` to enclose the YAML frontmatter at the very top of the file). Rely solely on clean semantic heading hierarchies (`##`, `###`) for visual and document section separation.
- **Nested Code Blocks**: When demonstrating code blocks inside Markdown (e.g. showing an example Markdown snippet that contains backticks), **ALWAYS** use 4 backticks (` ````markdown ... ```` `) for the outer block to avoid terminating code blocks early and breaking the markdown parser.
- **Mermaid Diagram Frontmatter (`title` & `caption`)**:
  - Every `mermaid` diagram code block **MUST** contain a YAML frontmatter header enclosing distinct `title` and `caption` properties.
  - The build pipeline (`remark-mermaid.js`) compiles Mermaid diagrams statically at build time into dual-theme SVGs and embeds Schema.org `ImageObject` metadata. Builds will strictly fail if either property is missing, too short, or identical:
    ````markdown
    ```mermaid
    ---
    title: "Architektur-Übersicht des Systems"
    caption: "Schematische Darstellung des Datenflusses zwischen Client, MCP-Server und Analyse-Backends."
    ---
    flowchart TD
      Client[Client] --> Server[MCP Server]
    ```
    ````
- **Linking Repository Source Files via Public GitHub URLs**:
  - Source code files, scripts, plugins, or configurations from the repository (e.g. `scripts/sync.js`, `src/plugins/remark-mermaid.js`, `astro.config.mjs`) are **NOT** copied to the public web server during the Astro build (`dist/`).
  - **NEVER** use relative paths, local website paths, or `file:///` URLs to link to source code files inside markdown blog posts (e.g., `[script.js](/scripts/script.js)`, `[plugin](src/plugins/...)`, or `file:///...` will result in 404 broken links for live visitors).
  - **ALWAYS** link to repository source files using their canonical GitHub URL on `main`:
    `https://github.com/ghackenberg/ghackenberg.github.io/blob/main/<path-to-file>` (e.g. `[`src/plugins/remark-mermaid.js`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/plugins/remark-mermaid.js)`).



## 4. Content Optimization Guidelines (SEO, GEO & AIO)
Follow these holistic optimization principles across all written technical content, actively leveraging the repository's custom MCP server (`unified-analytics`):

### 1. Mandatory Use of the Custom MCP Server (`unified-analytics`)
Whenever tasked with analyzing, optimizing, writing, or inspecting content in this repository:
- **Pre-Optimization Content Audits**: Always query the custom MCP server to inspect consolidated Google Search Console (GSC) search performance and Plausible engagement metrics (`get_page_audit`) for the target URL before making revisions. Protect high-performing search queries identified in top search results.
- **Opportunity Discovery**: Leverage the MCP server's opportunity heuristic tools (`find_seo_opportunities`) to identify striking-distance keywords (positions 4–15), high-bounce top performers, and hidden champions across the site.
- **Batch Content Screening**: Use `scan_aio_readiness` to scan markdown collections and immediately uncover content with the lowest AIO scores and highest optimization leverage.
- **Internal Link & Orphan Page Auditing**: Use `audit_internal_linking` to detect orphan pages (< 2 incoming internal links) and discover relevant donor articles for backlinking to hidden champions.
- **SERP Snippet & Metadata Auditing**: Use `audit_serp_snippets` to catch titles > 60 chars, descriptions outside 140-160 chars, and verify that primary GSC search queries appear in page titles.
- **AIO / GEO Evaluation & Impact Diffing**: Run `evaluate_aio_extractability` against drafted or revised markdown articles (`src/content/**`) to verify direct-answer density, table/list structure, and Schema.org metadata. Use `diff_aio_impact` to measure the exact delta against git `HEAD` before committing.
- **Indexation & Canonical Verification**: Use `inspect_url_index_status` to diagnose live indexation state, verify user vs. Google-selected canonicals, and check last crawl timestamps via the GSC URL Inspection API.
- **Environment Setup**: On fresh checkouts or new machines, run `npm run setup:mcp` if the MCP server has not yet been compiled or linked.

### 2. Traditional On-Page & Technical SEO

- **Search Intent & Snippet Optimization**: Craft concise, compelling frontmatter `title` tags (< 60 characters) and `description` meta tags (140–160 characters) with explicit value propositions.
- **Keyword & Ranking Preservation**: When revising existing articles, never strip out high-volume organic search queries or established internal anchor links that drive existing traffic.
- **Strict Hierarchy**: Maintain strict semantic nesting (`#` title $\rightarrow$ `##` sections $\rightarrow$ `###` subsections). Never skip heading levels.

### 3. Generative Engine Optimization (GEO & AEO)
- **Answer-First Pattern (Direct Answers)**:
  - Place a concise direct-answer definition paragraph (40–55 words) immediately below key `##` headings.
  - Answer the heading's core topic directly without throat-clearing or filler phrases (e.g. avoid "In this section, we will explore...").
- **Question-Framed Headings**:
  - Formulate at least 1–2 headings per article as explicit, natural-language search queries (e.g. "Was ist...", "Wie funktioniert...", "How does...").
- **Structured Synthesis (Tables & Steps)**:
  - Generative engines (Google AI Overviews, Perplexity, ChatGPT Search) disproportionately cite tabular comparisons. Always summarize trade-offs, architectures, or metric benchmarks in markdown tables (`| ... |`).
  - Use numbered lists (`1. ... 2. ...`) for sequential instructions and procedures.
- **Entity Density & Factual Precision**:
  - Ground explanations with concrete technical entities, standards, version numbers, and architectural patterns to maximize LLM retrieval confidence.

### 4. Data-Driven Content Iteration Heuristics
- Leverage unified search performance (GSC impressions, CTR, rankings) and on-site engagement (Plausible visitors, bounce rates, visit durations) to guide content updates:
  - **Striking Distance (Positions 4–15)**: Target for title tag, meta snippet, and introductory hook refinement to gain page-1 clicks.
  - **High Bounce (>75%)**: Target for immediate answer-first restructuring, scannability enhancements, and prominent related internal links.
  - **Hidden Champions (High Duration, Low Impressions)**: Target for internal backlinks from top-ranking pillar articles.

### 5. Multilingual Content Architecture & Localization Protocol
To avoid mixed-language indexing penalties and ensure search engines and generative models accurately classify target audiences:
- **Baseline Language per Content Domain**:
  - **Technical Tooling, Visualizations, Academic Publications & GitHub Projects $\rightarrow$ English**: All interactive visualization pages (`src/content/visualizations/`), tool documentation, research papers, and software projects target a global audience and must be written strictly in English.
  - **Global Tags $\rightarrow$ English**: Since tag landing pages (`src/content/tags/` $\rightarrow$ `/tags/[tag]/`) aggregate across German blog posts, English papers, and English repositories, their metadata definitions and descriptions must remain in English.
  - **University Course Materials $\rightarrow$ Language of Instruction**: Academic lectures (`src/content/courses/`) are authored in their respective teaching language (e.g. German for FH Upper Austria courses with `language: "de"`).
  - **Blog Articles $\rightarrow$ Explicit Post Language**: Blog posts (`src/content/posts/`) can be in German or English, but must declare `language: "de"` or `language: "en"` in frontmatter.
- **Strict HTML & OpenGraph Locale Alignment**:
  - Whenever rendering localized content (posts or courses), the page template must pass `lang={item.data.language || 'en'}` to `Layout.astro` so that `<html lang="...">` and `og:locale` (`de_AT` or `en_US`) accurately reflect the document body for search crawlers.
- **Zero Language Mixing within Single Pages**:
  - Never place German body text onto English-titled or English-navigated pages without explicit language declarations. Maintain linguistic consistency across headings, body paragraphs, and UI labels.


## 5. Presentation & Slide-as-Code Protocol (PowerPoint-Style Architecture)
Whenever authoring, modifying, or managing presentations, public talks, lectures, or keynotes in this repository:

### 1. Repository Structure & Location
- Every presentation is located in its own subfolder: `src/content/presentations/[YYYY_MM_DD_slug]/`.
- The presentation metadata is defined in `index.md` (with `title`, `pubDate`, `lang`, `description`, `tags`, and optional `event`, `location`, `audience`).
- All individual slides are co-located in `src/content/presentations/[YYYY_MM_DD_slug]/slides/` as numbered files (e.g. `01_titelfolie.mdx`, `02_agenda.mdx`).

### 2. Self-Contained Slide Bundle Requirement
Each slide file is an autonomous bundle. It **must** define:
- `title`: Concise slide title
- `subtitle`: Descriptive secondary headline
- `number`: Slide number string (e.g. `"01"`, `"02"`)
- `slideLayout`: Layout archetype (`title`, `split`, `pipeline`, `matrix`, `metric`, `code`)
- `voiceover`: Natural speech script with `{cue:id}` triggers (and optional `{/cue}` spans) for neural TTS synthesis
- `notes`: Speaker notes, time milestones, and academic/industry references for Presenter Console (`S` key)
- Body: Declarative markup composed strictly of the 6 standardized master archetypes and slide primitives.

### 3. Strict Typography Scale & "First-Shot" Rules for Coding Agents
- **Virtual 1920x1080 Canvas Scaling**: Slides run on a virtual 1920x1080 canvas that is scaled down by ~50% on standard laptop and desktop screens.
- **NO Microscopic Web Fonts**:
  - **NEVER** use web-document Tailwind sizes like `text-xs` (12px), `text-sm` (14px), or `text-base` (16px) inside slides (they scale to unreadable 6–8px).
  - The framework (`SlideBase.astro`) enforces a hard floor:
    - **Slide Title (`h1`)**: 56px–64px (`leading-[1.12]`)
    - **Card Headings (`h3`, `h4`)**: 32px–38px
    - **Body Text & Bullets (`p`, `li`)**: **24px–28px** (`leading-relaxed`)
    - **Footnotes & Metadata**: 18px–21px (absolute minimum allowed font size)
- **NO Bespoke Free-Form HTML**:
  - **NEVER** invent complex nested `<div>` layouts with manual pixel margins, ad-hoc emoji boxes, or custom grid styling.
  - **ALWAYS** use the 6 standardized slide archetypes and high-level primitives (`BentoCard`, `CalloutBox`, `BulletList`, `MetricStat`, `Pipeline`, `BarChart`).
  - **NEVER guess chart bar widths or zero-lines**: For data visualizations, always use `<BarChart items={[...]} />`. Numerical scaling, bounds, and the zero-line are computed mathematically at presentation time by client-side JavaScript.

### 4. The 6 Master Slide Archetypes

1. **Title Slide (`<TitleSlide />`)**:
   Classic keynote title layout with prominent headline, subtitle, and speaker/institution details placed directly beneath.
   ```mdx
   <TitleSlide
     title={frontmatter.title}
     subtitle={frontmatter.subtitle}
     slideNumber="01"
     totalSlides="30"
     speaker="Dr. Georg Hackenberg"
     role="Professor für Informatik & Industriesysteme"
     affiliation="FH Oberösterreich · Campus Wels"
     date="Oktober 2026"
     website="https://hackenberg.tech"
     cue="intro-sub"
   />
   ```

2. **Split / Comparison Slide (`<SplitSlide />`)**:
   Two-column layout (50/50 or 40/60) for comparisons, contrasts (Old vs. New), and problem/solution pairs.
   ```mdx
   <SplitSlide
     title={frontmatter.title}
     subtitle={frontmatter.subtitle}
     slideNumber="03"
     totalSlides="30"
   >
     <BentoCard slot="left" cue="col-classic" title="Klassischer Web-Index" accent="neutral">
       <CalloutBox type="quote" color="neutral">
         https://example.com/pumpen: Hocheffiziente Industriepumpen...
       </CalloutBox>
       <BulletList items={[
         { num: "1", title: "Keyword-Matching", desc: "Abgleich exakter Zeichenketten im Index." },
         { num: "2", title: "Hyperlink-Weiterleitung", desc: "Nutzer muss Website besuchen." }
       ]} />
     </BentoCard>

     <BentoCard slot="right" cue="col-modern" title="Synthese-Maschine" accent="blue">
       <CalloutBox type="statement" color="blue" title="Google / Perplexity">
         Für chemische Anlagen im B2B-Einsatz eignen sich Magnetkupplungspumpen...
       </CalloutBox>
       <BulletList items={[
         { icon: "check", accent: "blue", title: "Semantisches Verständnis", desc: "Sprachmodelle erfassen Kontext." },
         { icon: "check", accent: "blue", cue: "hl-zitation", title: "Zitation entscheidet", desc: "Relevanz entsteht durch Nennung." }
       ]} />
     </BentoCard>
   </SplitSlide>
   ```

3. **Process & Pipeline Slide (`<PipelineSlide />`)**:
   Horizontal or vertical progression for agendas, chronological phases, and multi-step architectures.
   ```mdx
   <PipelineSlide
     title={frontmatter.title}
     subtitle={frontmatter.subtitle}
     slideNumber="02"
     totalSlides="30"
   >
     <Pipeline steps={[
       { cue: "step-01", num: "01", title: "Paradigmenwechsel", desc: "Vom Web-Index zur Synthese.", accent: "blue" },
       { cue: "step-02", num: "02", title: "Technologie", desc: "RAG und Embeddings.", accent: "teal" },
       { cue: "step-03", num: "03", title: "3-Säulen-Methodik", desc: "Struktur, Inhalt, Autorität.", accent: "indigo" }
     ]} />
   </PipelineSlide>
   ```

4. **Grid / Matrix Slide (`<GridSlide />`)**:
   2x2 quadrant or 3-column layout for terminology, taxonomies, and multi-pillar overviews.
   ```mdx
   <GridSlide
     title={frontmatter.title}
     subtitle={frontmatter.subtitle}
     slideNumber="05"
     totalSlides="30"
     cols={2}
   >
     <BentoCard cue="box-seo" title="SEO: Search Engine Optimization" accent="neutral">
       <p><strong>Zielsystem:</strong> Google Web Search (10 blaue Links).</p>
       <p><strong>Mechanismus:</strong> Keywords, Backlinks, Core Web Vitals.</p>
     </BentoCard>
     <BentoCard cue="box-aeo" title="AEO: Answer Engine Optimization" accent="cyan">
       <p><strong>Zielsystem:</strong> Google Featured Snippets, Voice Search.</p>
       <p><strong>Mechanismus:</strong> Q&A-Struktur, Tabellen, Schema.org.</p>
     </BentoCard>
     <!-- Additional 2 cards -->
   </GridSlide>
   ```

5. **Metric Hero Slide (`<MetricSlide />` or `<SplitSlide ratio="40/60" />`)**:
   High-impact data slide with a massive numeric KPI stat on one side and strategic takeaways on the other.
   ```mdx
   <SplitSlide title={frontmatter.title} subtitle={frontmatter.subtitle} ratio="40/60">
     <MetricStat
       slot="left"
       cue="stat-zeroclick"
       value="64"
       unit="%"
       label="Zero-Click Suchanfragen"
       sublabel="SparkToro / Similarweb Global Search Study"
       color="blue"
     />
     <BentoCard slot="right" cue="bento-impact" title="Konsequenzen für B2B" accent="cyan">
       <CalloutBox type="statement" color="cyan" title="Geschäftsführung">
         „Wir optimieren nicht mehr für Klicks – wir optimieren für Zitation.“
       </CalloutBox>
       <BulletList items={[
         { icon: "📉", title: "Verlust unqualifizierten Traffics", desc: "Massen-Traffic bricht um 40–60 % ein." },
         { icon: "🎯", accent: "cyan", title: "Höhere Konversionsrate", desc: "Kunden mit hoher Kaufabsicht konvertieren." }
       ]} />
     </BentoCard>
   </SplitSlide>
   ```

6. **Code & Architecture Slide (`<CodeSlide />`)**:
   Side-by-side layout with code syntax container on the left (`col-span-7`) and structured explanations on the right (`col-span-5`).

### 5. Acoustic Word-Anchor Synchronization & The "Title-Hook" Voiceover Protocol
- Animations are coupled to the neural voiceover via `{cue:id}` tags.
- The build engine uses semantic acoustic word-anchor matching to bind cues to spoken words with microsecond precision.
- Use `{cue:hl-id}marked text{/cue}` to trigger live highlighter sweeps.

#### The 2-Phase Voiceover Architecture ("Title-Hook Protocol")
When a slide appears on screen, all content cards, metrics, or pipeline steps start in an inactive, dimmed state while the audience reads the slide `title` and `subtitle` at the top of the canvas:
1. **Phase 1: Title-Hook Orientation (0–4s, Pre-Cue)**:
   - Every slide voiceover **MUST** start with 1–2 orienting sentences (minimum 12–20 words, ~3–5 seconds) that verbally introduce, mirror, or contextualize the slide's `title` and `subtitle` **BEFORE** the first `{cue:...}` trigger fires.
   - **Prohibited**: Never fire a cue in the very first sentence without an introductory title hook (e.g., do NOT start with `{cue:step-01}` or jump straight into bullet points). Give the audience cognitive space to absorb the slide title before spotlights and highlights begin.
2. **Phase 2: Progressive Cued Content**:
   - Deliver cards, steps, comparisons, and text highlights sequentially, perfectly paced to spoken voiceover cues.

### 6. Central TTS Pronunciation & Acronym Lexicon (`tts-lexicon.json`)
Neural speech synthesis engines (such as Microsoft Edge TTS `de-DE-ConradNeural`) struggle with English loanwords embedded in German prose (e.g. *Snapshot*, *Knowledge Graph*) and technical acronyms (e.g. *RAG*, *URL*, *MCP*):
- **Single Source of Truth (`src/content/presentations/tts-lexicon.json`)**:
  - `acronyms`: Technical abbreviations hyphenated for correct spell-out pronunciation (e.g. `"RAG": "R-A-G"`, `"URL": "U-R-L"`, `"MCP": "M-C-P"`, `"LLM": "L-L-M"`, `"JSON-LD": "Dschäison-L-D"`).
  - `phonetics`: German phonetic respellings for English loanwords and terminology (e.g. `"Snapshot": "Snäpschott"`, `"Zero-Click": "Siero-Klick"`, `"Knowledge Graph": "Nolledsch Graf"`).
- **Clean Markdown vs. Phonetic Audio**:
  - Slide frontmatter `voiceover` **MUST** remain clean, grammatically correct German/English text for the presenter notes and the website's accessible transcript.
  - The build script (`scripts/generate-presentation-audio.js`) dynamically applies the lexicon mapping to generate `spokenText` strictly for the TTS stream.
- **Automated Lexicon Hygiene Gate**:
  - `npm run validate:slides` scans all slide voiceovers for unregistered uppercase acronyms (`\b[A-Z]{2,}\b`) and alerts the developer if an abbreviation is missing in `tts-lexicon.json`.
  - Audio cache invalidation is tied to a composite hash (`v3-${lexiconHash}:${voiceover}`), ensuring audio is automatically flagged for re-synthesis whenever `tts-lexicon.json` is modified.

### 7. Quality Gates & Automation
- Always run `npm run validate:slides` to verify cue consistency, frontmatter completeness, acronym coverage, and DOM target matching.
- Run `npm run audio:presentations` to synthesize neural speech audio (`.mp3`) and WordBoundary cue timings (`.cues.json`).
- Run `npm run typecheck`, `npm run lint`, and `npm run build` before committing.

### 8. Pipeline Step Image Standards
Whenever illustrating horizontal pipeline steps (`<Pipeline steps={[...]} />`):
- **Universal Style & Aesthetic**: Stylized Disney/Pixar comic illustration style, crisp dark ink lines, bold cel shading.
- **Edge-to-Edge Full Bleed**: Absolutely borderless, running seamlessly to all four edges of the canvas with zero perimeter frames, zero border lines, and zero margins.
- **Subject Safe Margins & Dynamic Sizing**: Centered motif occupying roughly **two-thirds (60–66%)** of width and height, leaving generous cosmic breathing room around all edges to prevent clipping during dynamic `object-cover` resizing in `Pipeline.astro`.
- **Cognitive Simplicity**: Exactly 1 prominent, iconic central subject per step. No visual overload, no text clutter.
- **Background**: Luminous vibrant blue-violet and deep indigo galaxy nebula with soft ambient starlight (blends cleanly into both dark and light presentation modes; avoid pitch-black backgrounds).
- **Characters & Agenda Exception**: No human characters (Georg does not appear in pipeline step cards). Agenda slides (Slide 02) require **NO images**.
- **Aspect Ratio & Location**: 1:1 square aspect ratio (`AspectRatio: "1:1"`), stored in `src/content/presentations/[presentation_id]/images/` and referenced via `/presentations/[presentation_id]/images/[filename].jpg`.
- **Single Source of Truth**: For detailed prompt templates, consult `IMAGE_STYLE_GUIDELINES.md` (Section 5.F).
