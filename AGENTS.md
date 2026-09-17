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


## 5. Presentation & Slide-as-Code Protocol (Talks)
Whenever authoring, modifying, or managing public talks, lectures, or keynotes in this repository:
1. **Repository Structure & Location**:
   - Every talk is located in its own subfolder: `src/content/talks/[YYYY_MM_DD_slug]/`.
   - The talk metadata is defined in `index.md` (with `title`, `event`, `location`, `pubDate`, `audience`, `lang`, `description`, `tags`).
   - All individual slides are co-located in `src/content/talks/[YYYY_MM_DD_slug]/slides/` as numbered files (e.g. `01_titelfolie.mdx`, `02_agenda.mdx`).
2. **Self-Contained Slide Bundle Requirement**:
   - Each slide file is an autonomous bundle. It **must** define:
     - `title`: Concise slide title
     - `voiceover`: Complete, natural German or English speech script for automated neural TTS synthesis
     - `notes`: Detailed speaker notes, time milestones, and academic/industry references for the Presenter Console (`S` key)
     - `slideLayout`: Layout archetype (`title`, `pipeline`, `split`, `metric`, `matrix`, `graph`, `code`, `custom`)
     - Body: The visual vector stage built with reusable slide primitives
3. **Strict Cue-Based Audio-Animation Synchronization**:
   - **NEVER hardcode absolute wall-clock timestamps in seconds** (e.g. `atSec: 14.5`) in slide code.
   - **ALWAYS couple visual animations to the voice-over via inline semantic cue tags**: `{cue:target-id}` placed in the prose text immediately preceding the spoken trigger word.
   - Every `{cue:target-id}` tag **must** have a corresponding SVG/DOM element in the slide with matching `id="target-id"`.
4. **Vector Design System & 1920x1080 16:9 Canvas**:
   - All slides must be wrapped in `<SlideCanvas>` with a fixed `1920x1080` coordinate space, technical dot-matrix background, and standardized presenter footer.
   - Use `<BentoBox>` (`<foreignObject>` wrapper) for Tailwind-styled HTML cards and multiline text.
   - Use `<GraphNode>`, `<GraphEdge>`, `<Pipeline>`, `<MetricStat>`, and `<CodeContainer>` primitives for diagrams and KPIs.
5. **Quality Gates & Automation**:
   - Always run `npm run validate:slides` to verify cue consistency, frontmatter completeness, and DOM target matching.
   - Run `npm run audio:talks` to synthesize neural speech audio (`.mp3`) and WordBoundary cue timings (`.cues.json`) with MD5 caching.
   - Run `npm run export:slides` to render the high-resolution vector PDF handout via Puppeteer.
