---
name: source-research
description: Conduct rigorous literature and web research using trusted academic outlets, enforce primary source attribution, and ensure factual fidelity without distortion.
---

# Source Research (Scientific Literature & Fact Verification)

This skill governs the literature research, primary source discovery, and factual verification required for all technical publications, posts, presentations, and courses.

## 1. Trusted Publisher Whitelist
When researching claims, frameworks, or benchmarks, prioritize verified sources in this order:
- **Peer-Reviewed Outlets**: arXiv, ACM Digital Library, IEEE Xplore, Top Conferences (NeurIPS, ICML, ICLR, ACL, ICSE), Google Scholar.
- **Leading Industry Labs**: Anthropic Research, OpenAI Research, Google DeepMind, Microsoft Research, Meta AI Research.
- **Formal Specifications**: W3C, IETF, Model Context Protocol Specification, ISO/IEC.
- **Prohibited Sources**: SEO content farms, unverified Medium blogs, AI aggregator spam, and anonymous opinion posts.

## 2. Primary Source Law
- **Zero Tertiary Citing**: If a secondary blog post or news article mentions a finding (e.g. "Chain-of-Thought improves reasoning by 30%"), never cite the secondary blog.
- **Trace to the Origin**: Trace the claim back to the foundational paper (e.g. Wei et al. 2022) or official specification.
- **Verify Direct Findings**: Read the original abstract, evaluation tables, and methodology section to confirm the claim.

## 3. Factual Fidelity & Anti-Distortion Protocol
To maintain absolute scientific and professional integrity:
- **No Over-Interpretation**: Explicitly separate what the authors proved empirically from our own architectural synthesis. Never attribute speculative extensions or organizational opinions to the authors.
- **Verbatim Metric Extraction**: Quantitative metrics (e.g. accuracy gain, latency, dataset size, baselines) must match the primary paper exactly.
- **Preserve Context & Nuance**: Never cherry-pick isolated sentences out of context. If the original paper states significant limitations or edge cases, acknowledge them.
- **Distinguish Corroboration from Causation**: Accurately reflect whether the source claims a causal mechanism or an empirical correlation.

## 4. Operational Research Workflow
1. **Query Formulation**: Search academic repositories and trusted labs using technical terms (e.g. paper title, author name, specific benchmark).
2. **Document Retrieval**: Inspect full papers via arXiv or direct publisher URLs.
3. **Fact Extraction**: Document exact quotes, quantitative figures, and limitations.
4. **Handoff to Citation Management**: Pass verified metadata (author, title, year, venue, DOI/URL) to the document's `references:` frontmatter (see `citation-management`).
