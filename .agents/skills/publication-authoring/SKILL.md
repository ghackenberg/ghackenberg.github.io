---
name: publication-authoring
description: Catalog, structure, format, and generate BibTeX records for peer-reviewed academic publications, conference proceedings, and journals in strict English.
---

# Publication Authoring (Academic Literature)

This skill governs the cataloging, metadata curation, and formatting of peer-reviewed scientific papers in `src/content/publications/`.

## 1. Directory Structure & Schema
Every publication lives under `src/content/publications/<slug>/`:
- File: `src/content/publications/<slug>/index.md`.
- Frontmatter schema (`src/content.config.ts`):
  ```yaml
  title: "Formal Verification of Distributed Agent Protocols"
  pubDate: "2026-06-15"
  book: "IEEE International Conference on Software Engineering (ICSE 2026)"
  author: "Georg Hackenberg, John Doe, Jane Smith"
  abstract: "This paper presents a formal verification framework for asynchronous multi-agent coordination..."
  tags:
    - software-architektur
    - distributed-systems
  publisherUrl: "https://doi.org/10.1109/ICSE.2026.12345" # Deep URL to publisher/DOI
  bibtex: |
    @inproceedings{hackenberg2026formal,
      author    = {Georg Hackenberg and John Doe and Jane Smith},
      title     = {Formal Verification of Distributed Agent Protocols},
      booktitle = {Proceedings of the IEEE International Conference on Software Engineering (ICSE)},
      year      = {2026},
      pages     = {102--115},
      doi       = {10.1109/ICSE.2026.12345}
    }
  slides: "https://hackenberg.tech/presentations/2026_06_15_formal_verification/" # Optional link to presentation
  icon: "paper" # Optional icon name
  ```

## 2. Core Language & Metadata Rules
- **Strict English**: All academic publication entries, abstracts, titles, and BibTeX snippets must be written in English (`en`).
- **Deep-Link URL Contract**: Always provide a deep link to the permanent digital object identifier (`https://doi.org/...`), publisher paper page, or arXiv abstract page. Never provide shallow bare publisher roots.
- **BibTeX Hygiene**:
  - Keys must follow the standard `<primaryauthor><year><firstword>` convention (e.g. `hackenberg2026formal`).
  - Separate multiple authors with ` and ` (e.g. `Georg Hackenberg and Jane Smith`).
  - Enclose titles in double braces or quotes to preserve exact capitalization.
  - Include `doi`, `pages`, `year`, and canonical conference/journal names.

## 3. Publication Content Body
The markdown body of `index.md` can provide:
- Extended summary of contributions and core theorems.
- Links to artifact repositories, benchmark datasets, or replication packages.
- High-level takeaways and industrial application contexts.

## 4. Pre-Flight Validation
Ensure all referenced tags exist in `src/content/tags/` and check schema validation:
```powershell
npm run typecheck
npm run verify
```
