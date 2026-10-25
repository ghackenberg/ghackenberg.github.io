---
name: citation-management
description: Manage academic citations, YAML reference schemas, in-text [@id] semantic citations, and 100% bidirectional reference parity across posts and presentations.
---

# Citation Management (Scientific References & Parity)

This skill governs the declaration, in-text citation, formatting, and validation of external references across blog posts (`src/content/posts/`) and slide decks (`src/content/presentations/`).

## 1. Structured Frontmatter Schema
Every cited work must be declared in the YAML frontmatter `references:` array. The schema is a discriminated union on `type` (`src/content.config.ts`):

```yaml
references:
  - id: "vaswani-2017-attention" # Kebab-case semantic key (author-year-keyword)
    type: "inproceedings" # inproceedings | article | book | online | misc
    authors:
      - name: "Ashish Vaswani"
    title: "Attention Is All You Need"
    booktitle: "Advances in Neural Information Processing Systems (NeurIPS 2017)"
    year: 2017
    url: "https://arxiv.org/abs/1706.03762" # Mandatory deep URL or DOI
    doi: "10.48550/arXiv.1706.03762"
    label: "Vas17" # Optional: overrides auto-generated BibTeX-Alpha key

  - id: "bostock-2011-d3"
    type: "article"
    authors:
      - name: "Michael Bostock"
      - name: "Vadim Ogievetsky"
      - name: "Jeffrey Heer"
    title: "D3: Data-Driven Documents"
    journal: "IEEE Transactions on Visualization and Computer Graphics"
    year: 2011
    volume: "17"
    number: "12"
    pages: "2301--2309"
    url: "https://doi.org/10.1109/TVCG.2011.185"

  - id: "mcp-specification-2024"
    type: "online"
    authors:
      - name: "Anthropic"
        type: "Organization"
    title: "Model Context Protocol Specification"
    year: 2024
    siteName: "Model Context Protocol"
    url: "https://modelcontextprotocol.io/specification"
```

## 2. In-Text Semantic Citation Contract
- **Semantic Tag Syntax**: Always cite using `[@id]` for single sources (e.g. `wie bereits von [@vaswani-2017-attention] gezeigt`) or `[@id1; @id2]` for multi-source citation groups separated by `;` or `,` (e.g. `[@jimenez-2024-swebench; @yang-2024-sweagent]` or `[@jimenez-2024-swebench; @xie-2024-osworld; @wang-2025-openhands]`).
- **Strictly Prohibited**: Never hardcode numeric indices (`[1]`), manual keys (`[Vas17]`), or unprefixed keys inside a group (`[@id1; id2]`) in body text.
- **Build-Time Compilation**: The remark plugin [`src/plugins/remark-citations.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/plugins/remark-citations.ts) (sharing canonical parser utilities from [`src/commons/shared/citations.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/citations.ts)) transforms single `[@id]` and multi-source `[@id1; @id2]` groups into:
  - Alphanumeric BibTeX-Alpha labels (e.g. `[Vas17]`).
  - Individual interactive anchor jumps in blog posts (`#ref-vaswani-2017-attention`).
  - Individual interactive reference detail modal triggers in slide decks (`data-open-reference="vaswani-2017-attention"`).

## 3. The 100% Bidirectional Parity Gate
Every document supporting references must satisfy three strict invariant rules:
1. **Zero Undefined Citations**: Every key in `[@id]` or `[@id1; @id2]` used in the Markdown/MDX body must match an entry declared in `references:`.
2. **Zero Orphan References**: Every entry declared in `references:` must be cited at least once in the document body via `[@id]` or `[@id1; @id2]`.
3. **Zero Malformed Citation Brackets**: Every `[@...]` occurrence in prose must conform to the canonical citation grammar (`/\[@([a-zA-Z0-9_-]+(?:\s*[;,]\s*@[a-zA-Z0-9_-]+)*)\]/g`).

## 4. Deep-Link, DOI & Primary Author Accuracy Contract
- **Deep URLs Mandatory**: Every cited article, paper, report, or guide must link to the specific target page or DOI (`https://doi.org/...`).
- **No Bare Domain Roots**: Never use root URLs like `openai.com/` or `anthropic.com/`. Bare domains are only permitted if the domain itself is the official standard or specification being cited (e.g. `https://zod.dev` or `https://modelcontextprotocol.io`).
- **Exact Co-Author & DOI Verification**: Always verify exact author names (e.g. `Levine, John and Herkula, Tobias` on RFC 8058) and DOIs against Crossref or the primary document via `npm run lint:citations` so no mismatched DOI or HTTP 404 enters the repository.

## 5. Reference Section Layout & Tabular CSS Subgrid
- **No Horizontal Divider**: Never place `---` or divider lines immediately before the `## References` / `## Referenzen` heading or list.
- **Tabular Two-Column CSS Subgrid (`src/pages/posts/[slug].astro`)**: Blog post references are rendered automatically by [`src/pages/posts/[slug].astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/posts/%5Bslug%5D.astro) using a two-column CSS Grid (`<ol class="grid grid-cols-[max-content_1fr] gap-x-3 sm:gap-x-4 gap-y-4">`) where each `<li class="col-span-2 grid grid-cols-subgrid items-baseline">` places the `[Key]` badge (`justify-self-start`) in column 1 and the bibliography text in column 2. This guarantees that variable-width BibTeX-Alpha keys (`[W3C23]` vs `[GBC+16]`) align to the widest badge and wrapped lines never drift under the badge column.

## 6. Pre-Flight Validation Tools
Run fast syntax and remote content checks (pass an optional `<slug>` or `--file <path>` argument to scope validation to a single post or presentation during authoring):
- **Phase 1 (Syntax & Parity Gate, <200ms)**:
  ```powershell
  npm run validate:citations:syntax
  npm run validate:citations:syntax -- <slug>
  ```
- **Phase 2 (Remote HTTP Keyword, DOI & Author Linter)**:
  ```powershell
  npm run lint:citations
  npm run lint:citations -- <slug>
  ```
- **Phase 3 (CI Mode)**:
  ```powershell
  npm run lint:citations:ci
  ```
