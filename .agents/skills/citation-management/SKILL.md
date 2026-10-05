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
    author: "Vaswani, Ashish et al."
    title: "Attention Is All You Need"
    booktitle: "Advances in Neural Information Processing Systems (NeurIPS 2017)"
    year: 2017
    url: "https://arxiv.org/abs/1706.03762" # Mandatory deep URL or DOI
    doi: "10.48550/arXiv.1706.03762"
    label: "Vas17" # Optional: overrides auto-generated BibTeX-Alpha key

  - id: "bostock-2011-d3"
    type: "article"
    author: "Bostock, Michael and Ogievetsky, Vadim and Heer, Jeffrey"
    title: "D3: Data-Driven Documents"
    journal: "IEEE Transactions on Visualization and Computer Graphics"
    year: 2011
    volume: "17"
    number: "12"
    pages: "2301--2309"
    url: "https://doi.org/10.1109/TVCG.2011.185"

  - id: "mcp-specification-2024"
    type: "online"
    author: "Anthropic"
    title: "Model Context Protocol Specification"
    year: 2024
    siteName: "Model Context Protocol"
    url: "https://modelcontextprotocol.io/specification"
```

## 2. In-Text Semantic Citation Contract
- **Semantic Tag Syntax**: Always cite using `[@id]` in Markdown or MDX prose (e.g. `wie bereits von [@vaswani-2017-attention] gezeigt`).
- **Strictly Prohibited**: Never hardcode numeric indices (`[1]`) or manual keys (`[Vas17]`) in body text.
- **Build-Time Compilation**: The remark plugin `remarkCitations` transforms `[@id]` into:
  - Alphanumeric BibTeX-Alpha labels (e.g. `[Vas17]`).
  - Interactive anchor jumps in blog posts (`#ref-vaswani-2017-attention`).
  - Interactive reference detail modals in slide decks (`data-open-reference="vaswani-2017-attention"`).

## 3. The 100% Bidirectional Parity Gate
Every document supporting references must satisfy two strict invariant rules:
1. **Zero Undefined Citations**: Every `[@id]` used in the Markdown/MDX body must match an entry declared in `references:`.
2. **Zero Orphan References**: Every entry declared in `references:` must be cited at least once in the document body via `[@id]`.

## 4. Deep-Link & Anti-Shallow URL Contract
- **Deep URLs Mandatory**: Every cited article, paper, report, or guide must link to the specific target page or DOI.
- **No Bare Domain Roots**: Never use root URLs like `openai.com/` or `anthropic.com/`. Bare domains are only permitted if the domain itself is the official standard or specification being cited (e.g. `https://zod.dev` or `https://modelcontextprotocol.io`).

## 5. Reference Section Layout
- **No Horizontal Divider**: Never place `---` or divider lines immediately before the `## Referenzen` heading or list.

## 6. Pre-Flight Validation Tools
Run fast syntax and remote content checks:
- **Phase 1 (Syntax & Parity Gate, <200ms)**:
  ```powershell
  npm run validate:citations:syntax
  ```
- **Phase 2 (Remote HTTP Keyword & Author Linter)**:
  ```powershell
  npm run lint:citations
  ```
- **Phase 3 (CI Mode)**:
  ```powershell
  npm run lint:citations:ci
  ```
