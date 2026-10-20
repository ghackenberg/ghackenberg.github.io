---
name: source-research
description: Conduct rigorous literature and web research using trusted academic outlets, enforce primary source attribution, and ensure factual fidelity without distortion.
---

# Source Research (Scientific Literature & Fact Verification)

This skill governs literature research, primary source discovery, and factual verification across all technical publications, posts, presentations, and courses.

## 1. Trusted Publisher Whitelist
When researching claims, frameworks, or benchmarks, prioritize verified sources:
- **Peer-Reviewed Outlets**: arXiv, ACM Digital Library, IEEE Xplore, Top Conferences (NeurIPS, ICML, ICLR, ACL, ICSE, CHI), Google Scholar.
- **Leading Industry Labs**: Anthropic Research, OpenAI Research, Google DeepMind, Microsoft Research, Meta AI Research.
- **Formal Specifications**: W3C, IETF RFCs, NIST FIPS, Schema.org, Model Context Protocol Specification, ISO/IEC.
- **Prohibited Sources**: SEO content farms, unverified Medium blogs, AI aggregator spam, and anonymous opinion posts.

## 2. Primary Source Law & Pre-Draft Methodology Verification
- **Zero Tertiary Citing**: Never cite secondary blogs or aggregators. Trace all findings back to the foundational paper (e.g. Dwork & Naor 1992, Viégas et al. 2009) or official specification.
- **Pre-Draft Methodology & Experimental Audit**: Before describing how a cited study was conducted in prose, verify the exact experimental methodology from the primary paper rather than relying on memory:
  - *Example*: Rivadeneira et al. (CHI 2007) and Bateman et al. (HT 2008) evaluated tag clouds via target-search click-timing and free-recall tasks, **not** hardware corneal-reflection eye-tracking. Never hallucinate apparatus or experimental protocols not present in the paper.
- **Pre-Draft Co-Author & DOI Verification**: Before writing frontmatter `references:`, verify all co-authors and DOIs against Crossref or the official standard header (e.g. RFC 8058 is authored by `Levine, John and Herkula, Tobias`; Balinski & Young's *Fair Representation* is cataloged under `10.2307/1288706`).
- **No Over-Interpretation**: Clearly separate what the authors proved empirically from our own architectural synthesis. Never attribute speculative extensions to third-party authors.
- **Normative Specification vs. Incubator Explainer Separation**: When researching emerging W3C, IETF, or industry standards (e.g., WebMCP), strictly distinguish between the **normative specification** (`index.bs` / Draft Community Group Report) and **non-normative repository explainers or incubator roadmap documents** (`README.md`, `proposal.md`). Never present non-normative explainer items (such as `navigator.modelContextTesting`, declarative HTML `<form toolname="...">` attributes, or `.well-known/webmcp` manifests) as part of the normative specification interface; explicitly label them as non-normative incubator explainers or complementary roadmap proposals.
- **Verbatim Metric Extraction**: Quantitative metrics (e.g. accuracy gain, latency, complexity bounds, baselines) must match the primary paper or repository benchmark exactly.

## 3. SOTA Reconnaissance & Anti-Dogma Scan (The Zig-Zag Workflow)
Before any content outline or slide deck is drafted:
1. **Premise Deconstruction**: Identify the core assumptions, claims, and potential dogmatic biases in the initial topic idea.
2. **Conflicting Viewpoint Search**: Proactively query for alternative paradigms, hybrid architectures, and counter-benchmarks across arXiv, ACM/IEEE, and formal standards.
3. **Trade-Off Matrix Synthesis**: Map findings across objective engineering axes (e.g. autonomy vs. determinism, token latency vs. recovery, client PoW vs. third-party CAPTCHA).
4. **Handoff to Alignment Gate**: Present the sharpened trade-offs and evidence-based positioning options to the author via `/grill-me`.

## 4. Independent Fact-Check & Blast-Radius Audit
1. **Independent Reviewer Audit**: During multi-agent content workflows (`agent-orchestration`), an independent Reviewer subagent must audit every in-text claim and frontmatter reference against the primary source.
2. **Blast-Radius Inspection**: When mid-flight verification uncovers a methodology nuance, broken URL, or DOI mismatch, trace the impact cascade (Title $\rightarrow$ Answer-First Definition $\rightarrow$ Body Prose $\rightarrow$ References Frontmatter).
3. **Handoff to Citation Management**: Pass verified metadata to `references:` ensuring 100% bidirectional parity and HTTP 200 / Crossref resolution (see `citation-management`).
