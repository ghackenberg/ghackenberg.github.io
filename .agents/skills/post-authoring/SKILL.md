---
name: post-authoring
description: Research, interview, structure, write, and optimize long-form technical blog posts in German or English with GEO/AIO answer-first patterns and semantic citations.
---

# Post Authoring (Blog & Technical Articles)

This skill governs the end-to-end authoring, multi-agent review, and GEO/AIO optimization of long-form technical articles in `src/content/posts/`.

## 1. Directory Structure & Schema
Every post lives in its own directory under `src/content/posts/<slug>/` where `<slug>` starts with `YYYY_MM_DD_` matching `pubDate` (new posts must default `pubDate` to `max(today, latest_post_pubDate + 1 day)` so no two modern posts share the exact same `pubDate`):
- File: `src/content/posts/<slug>/index.md` or `index.mdx` (MDX if embedding interactive components).
- Hero Image: `src/content/posts/<slug>/hero.jpg` (must be uniquely generated per post; duplicate image SHA-256 hashes and duplicate modern `pubDate` values across posts are blocked by `npm run lint:posts`).
- Frontmatter schema (`src/content.config.ts`):
  ```yaml
  title: "Sovereign Newsletter-as-Code with React Email, Listmonk & ALTCHA PoW"
  pubDate: 2026-10-20
  description: "How we engineered a Git-native Newsletter-as-Code pipeline with dual-target React Email compilation and an Int32Array SHA-256 Proof-of-Work Web Worker."
  lang: "en"
  tags:
    - software-architecture
    - web-development
    - typescript
  icon:
    src: "./hero.jpg"
    title: "Newsletter-as-Code Pipeline with React Email and SHA-256 Proof-of-Work"
    description: "Close-up engineering workstation monitor in the Grünau im Almtal timber office displaying a React Email pipeline alongside a 32-bit SHA-256 Proof-of-Work grid"
  references:
    - id: "dwork-1992-pricing-via-processing"
      type: "inproceedings"
      author: "Dwork, Cynthia and Naor, Moni"
      title: "Pricing via Processing or Combatting Junk Mail"
      booktitle: "Advances in Cryptology — CRYPTO '92 (LNCS, vol. 740)"
      year: 1992
      doi: "10.1007/3-540-48071-4_10"
      url: "https://doi.org/10.1007/3-540-48071-4_10"
  ```

## 2. Autonomous End-to-End Post Pipeline
When tasked with creating one or more blog posts, the Control Plane executes a structured 6-stage autonomous workflow (see `agent-orchestration`):
1. **Git Delta Topic Discovery & SOTA Reconnaissance**: Inspect recent repository commits, architectural subsystems, and primary academic literature (`source-research`) to identify concrete engineering innovations, quantitative metrics, and mathematical invariants. When covering emerging standards (e.g. W3C, IETF), strictly separate normative specification interfaces (`index.bs` / formal reports) from non-normative incubator explainers (`README.md`, `proposal.md`). Determine the next chronological `pubDate` via `max(today, latest_post_pubDate + 1 day)` (incrementing by `+1 day` per post when batch-authoring) so every post has a unique `pubDate`.
2. **Two-Stage Alignment Gate (`/grill-me`)**: Present a high-density alignment briefing to lock all parameters upfront without assumptions:
   - **Stage 2a (Thesis, Normative Boundary & Stack Bridging)**: Align on the core thesis, how the external standard or paradigm bridges to our existing stack and agent harnesses (e.g. MCP servers vs. browser runtimes, extension relays, native browser integration), and whether the article should be framed as a **general public architectural analysis** (zero repo-specific link coupling) or a **repository-coupled implementation case study** (linking to `blob/main/...` and opening a `backlog/system/` RFC if progressive enhancement is warranted).
   - **Stage 2b (Chronological Slot, Visual Surface Rotation & Golden Slice)**: Lock the language, unique chronological `pubDate`/slug, inline SVG schematic topology, hero surface selection (rotating across Wall-Mounted Whiteboard, Timber Drafting Table Blueprint, and Curved Monitor relative to adjacent posts), and Golden Slice structure.
3. **Unique Technical `hero.jpg` Generation (Strictly No Avatar, 3-Surface Rotation & Macro-Label Rule)**: Dispatch the `image-generator` subagent with `ImagePaths: []` (`AspectRatio: "16:9"`) to render a unique close-up technical artifact in the Grünau im Almtal timber office (see `image-generation` and `resources/archetypes/posts.md`). Check the 2–3 chronologically adjacent posts and rotate across the three approved single-surface archetypes (Surface A: Wall-Mounted Magnetic Glass Whiteboard, Surface B: Architectural Timber Drafting Table Blueprint, Surface C: Curved Ultra-Wide Workstation Monitor) to prevent consecutive monitor repetition. Prompt for **one** surface only and restrict in-image text to 1–2 large uppercase headers with clean color-coded geometric nodes (no tiny node labels or axis numbers). Note that `image-generator` writes output images to the brain artifact folder (`<appDataDir>\brain\<conversation-id>\`), which must then be copied to `src/content/posts/<slug>/hero.jpg` by the Author subagent. Never copy or reuse an existing image from another post.
4. **Independent Author Subagent Drafting**: Dispatch a dedicated Author subagent per post with exact line-level code references, verified primary citations, and strict GEO/AIO formatting constraints.
5. **Independent 3-Persona Visitor Review & Primary-Source Fact-Check**: Automatically dispatch an independent Reviewer subagent (separate from the Author) that audits the draft through three critical visitor personas plus a primary-source audit:
   - **Persona A (CTO / Principal Architect)**: Evaluates architectural trade-offs, failure modes, and decision clarity.
   - **Persona B (Senior Staff Engineer)**: Audits production TypeScript/CLI code accuracy, bit-level or mathematical edge cases, and canonical GitHub links.
   - **Persona C (Academic / Systems Researcher)**: Audits mathematical rigor, experimental methodology descriptions, and citation fidelity.
6. **Iterative Revision Loop Until `APPROVED`**: If the Reviewer identifies any factual, structural, or stylistic defect, route surgical fixes back to the Author subagent and re-verify until all gates pass with zero warnings.

## 3. Generative Engine Optimization (GEO & AIO) & Structural Invariants
Every modern post (`pubDate >= 2026-10-16`) is deterministically audited by `npm run lint:posts` for the following invariants:
- **Top Answer-First Definition & Synthesis Table**: Immediately at the start of the Markdown body (before the first `##` heading), open with a concise **40–55 word** Answer-First definition paragraph (linter tolerance: 38–58 words), followed by a structured **Markdown comparison table** contrasting architectural alternatives before the first `##` heading.
- **Section-Level Answer-First Paragraphs**: Immediately below every `##` heading (excluding `## References` / `## Referenzen`), place a standalone **40–55 word** Answer-First paragraph (tolerance: 38–58 words) that directly answers or defines the section's core mechanism before diving into prose, lists, or code.
- **Question-Framed Headings**: Formulate at least 1–2 `##` headings per post as explicit natural-language engineering questions ending with `?` (e.g. `## How Does Our Three-Phase Heuristic Solve Elliptical Row Assignment?`).
- **Mermaid Complexity Cap ($\le 5$ Nodes)**: Every `mermaid` block must include a YAML frontmatter block with distinct `title` and `caption`, zero raw HTML tags (`<br>`, `<span>`, `<div>`), and **at most 5 distinct nodes** (see `mermaid-diagrams`). Escalate complex graphs to inline SVG (`svg-graphics`).
- **Canonical GitHub Code Links & Disk Existence Check**: Always link to repository source files using canonical GitHub URLs on `main` (`https://github.com/ghackenberg/ghackenberg.github.io/blob/main/...`). Never use `file:///` or relative `src/` paths. `npm run lint:posts` automatically decodes and verifies that every linked `blob/main/...` or `tree/main/...` repository path exists on disk.

## 4. Mandatory Pre-Flight Validation
Before reporting completion, Author and Verification agents must run all three pre-flight checks in Windows PowerShell (passing `<slug>` for fast targeted iteration before the full gate):
```powershell
npm run lint:posts -- <slug>
npm run validate:citations:syntax -- <slug>
npm run lint:citations -- <slug>
```
For full production release, follow the master verification gate (see `build-engineering`).
