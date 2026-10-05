---
name: source-research
description: Conduct rigorous literature and web research using trusted academic outlets, enforce primary source attribution, and ensure factual fidelity without distortion.
---

# Source Research (Scientific Literature & Fact Verification)

This skill governs literature research, primary source discovery, and factual verification across all technical publications, posts, presentations, and courses.

## 1. Trusted Publisher Whitelist
When researching claims, frameworks, or benchmarks, prioritize verified sources:
- **Peer-Reviewed Outlets**: arXiv, ACM Digital Library, IEEE Xplore, Top Conferences (NeurIPS, ICML, ICLR, ACL, ICSE), Google Scholar.
- **Leading Industry Labs**: Anthropic Research, OpenAI Research, Google DeepMind, Microsoft Research, Meta AI Research.
- **Formal Specifications**: W3C, IETF, Model Context Protocol Specification, ISO/IEC.
- **Prohibited Sources**: SEO content farms, unverified Medium blogs, AI aggregator spam, and anonymous opinion posts.

## 2. Primary Source Law & Anti-Distortion
- **Zero Tertiary Citing**: Never cite secondary blogs or aggregators. Trace all findings back to the foundational paper (e.g. Wei et al. 2022) or official specification.
- **No Over-Interpretation**: Clearly separate what the authors proved empirically from our own architectural synthesis. Never attribute speculative extensions to third-party authors.
- **Verbatim Metric Extraction**: Quantitative metrics (e.g. accuracy gain, latency, dataset size, baselines) must match the primary paper exactly.
- **Context & Nuance Preservation**: Never cherry-pick isolated sentences. Always reflect stated limitations and boundary conditions.

## 3. SOTA Reconnaissance & Anti-Dogma Scan (The Zig-Zag Workflow)
Before any content outline or slide deck is drafted:
1. **Premise Deconstruction**: Identify the core assumptions, claims, and potential dogmatic biases in the initial topic idea.
2. **Conflicting Viewpoint Search**: Proactively query for alternative paradigms, hybrid architectures, and counter-benchmarks across arXiv and top labs.
3. **Trade-Off Matrix Synthesis**: Map findings across objective engineering axes (e.g. autonomy vs. determinism, token latency vs. recovery, cognitive flexibility vs. auditability).
4. **Handoff to Alignment Gate**: Present the sharpened trade-offs and evidence-based positioning options to the author via `/grill-me`.

## 4. Controlled Backtracking & Blast-Radius Audit
When mid-flight drafting uncovers new literature or the author redirects the core premise:
1. **Targeted Delta Search**: Execute a surgical search on the newly questioned mechanism or parameter.
2. **Blast-Radius Inspection**: Trace the impact kaskade (Titel $\rightarrow$ Answer-First Definition $\rightarrow$ Existing Draft Slices $\rightarrow$ References Frontmatter).
3. **Pivot Alignment**: Present the delta to the author (*"New research on X shows trade-off Y; proposing to update Section 1 and references"*) before rewriting approved sections.
4. **Handoff to Citation Management**: Pass verified metadata to `references:` ensuring 100% bidirectional parity (see `citation-management`).
