---
name: post-authoring
description: Research, interview, structure, write, and optimize long-form technical blog posts in German or English with GEO/AIO answer-first patterns and semantic citations.
---

# Post Authoring (Blog & Technical Articles)

This skill governs the end-to-end authoring and optimization of long-form articles in `src/content/posts/`.

## 1. Directory Structure & Schema
Every post lives in its own directory under `src/content/posts/<slug>/`:
- File: `src/content/posts/<slug>/index.md` or `index.mdx` (MDX if embedding interactive components).
- Frontmatter schema (`src/content.config.ts`):
  ```yaml
  title: "Titel des Artikels"
  pubDate: 2026-10-05
  description: "Prägnante Zusammenfassung (140–160 Zeichen) für Google-Snippets und Social Previews."
  lang: "de"
  tags:
    - prompt-engineering
    - software-architektur
  icon:
    src: "./featured.jpg"
    title: "Titelbild"
    description: "Detaillierte visuelle Beschreibung des Titelbilds"
  references:
    - id: "vaswani-2017-attention"
      type: "inproceedings"
      author: "Vaswani, Ashish et al."
      title: "Attention Is All You Need"
      booktitle: "NeurIPS 2017"
      year: 2017
      url: "https://arxiv.org/abs/1706.03762"
  ```

## 2. Content Authoring Gate & Interview Protocol
Before writing any article body:
1. **Interview-First Gate (`/grill-me`)**: Establish core thesis, real-world benchmarks, quantitative metrics, and partner or tool references.
2. **Zero Assumptions**: Never invent personal opinions, technical stances, or organizational evaluations without explicit user alignment.
3. **Outline Confirmation**: Only begin drafting after the user confirms the proposed section outline.

## 3. Generative Engine Optimization (GEO & AIO)
Structure posts according to the site's generative engine standards (see `site-optimization`):
- **Answer-First Pattern**: Immediately below every major `##` heading, provide a concise, high-density definition paragraph (40–55 words) explaining the core concept directly.
- **Question-Framed Headings**: Formulate 1–2 headings per article as explicit natural-language queries (e.g. `## Was ist Prompt Injection?`).
- **Structured Synthesis Tables**: Compare trade-offs and benchmarks using markdown tables.
- **Mermaid Diagrams**: Every `mermaid` code block must contain a YAML header with distinct `title` and `caption`.

## 4. Markdown Hygiene & Heading Telemetry
- Semantic Headings: In `.post-body` or `main`, headings (`h2`, `h3`) with unique IDs are tracked automatically via `telemetry.ts` (see `site-analytics`).
- External Citations: Cite external academic papers using `[@id]` with 100% bidirectional parity (see `citation-management`).

## 5. Pre-Flight Validation
Validate in-text citation syntax during drafting:
```powershell
npm run validate:citations:syntax
```
For production release, follow the master release gate (see `build-engineering`).
