# Project Operating Guidelines for AI Coding Agents

## 1. Core Operating Constraints
- **Shell Environment**: The execution environment is **Windows PowerShell**.
  - **NEVER** use Linux Bash syntax (e.g. `&&`, `rm`, `ls`).
  - Always use PowerShell commands (`Copy-Item`, `New-Item`, `;`, etc.).
- **Public GitHub URLs for Source Code**:
  - Code files, plugins, and scripts from this repository are **NOT** served as static assets in `dist/`.
  - **NEVER** link to repository files using relative paths, local website paths, or `file:///` URLs inside markdown documents.
  - **ALWAYS** link using canonical GitHub URLs on `main`: `https://github.com/ghackenberg/ghackenberg.github.io/blob/main/<path-to-file>`.
- **Path Aliases & Architectural Boundaries**:
  - **ALWAYS** use configured path aliases (`@commons/*`, `@components/*`, `@layouts/*`, `@assets/*`, `@styles/*`, `@content/*`, `@plugins/*`, `@tools/*`) across directory boundaries.
  - **NEVER** use relative parent directory traversals (`../components`, `../../commons`, etc.). Enforced by ESLint `no-restricted-imports` with zero tolerance (`--max-warnings=0`).
  - Co-located sibling imports (`./...`) are permitted within the same directory for tightly-coupled private sub-modules.
- **Scripts & CLI Contract**:
  - `src/scripts/` is exclusively reserved for standalone executable CLI entrypoints. **EVERY** `.ts` file in `src/scripts/` **MUST** have a corresponding script command in `package.json` (enforced by `npm run validate:scripts`).
  - Internal helper modules and libraries MUST live in `src/commons/` and be imported via `@commons/*`.
  - **NEVER** import from `src/scripts/` or `src/tools/` inside web application code (`src/pages/`, `src/components/`, `src/layouts/`).

- **Orchestrator-Worker Contract (Control Plane vs. Data Plane)**:
  - During complex, multi-phase, or multi-skill workflows, the primary agent operates strictly as the **Control Plane** (orchestrator and gatekeeper).
  - The Control Plane plans, decomposes, validates gates, and communicates with the user, but **NEVER directly performs heavy file mutations or code edits**.
  - All discrete phases and execution tasks are delegated to subagents (Data Plane) via `invoke_subagent` using structured briefings following `agent-orchestration`.

## 2. Universal Content Authoring & Grounding Lifecycle
Mandatory across ALL content formats (posts, presentations, courses, services, case studies):
1. **SOTA Reconnaissance & Anti-Dogma Scan**: Before outlining, conduct an objective primary literature scan (following `source-research`) to uncover empirical trade-offs and counter-positions. Never adopt dogmatic stances or secondary hype.
2. **Interactive Alignment Gate (`/grill-me`)**: Present evidence-based positioning options and targeted interview questions to establish the author's core thesis, quantitative metrics, industry examples, and terminology preferences.
3. **Incremental Golden Slice (No Big-Bang Drafting)**: Draft only the format's defined pilot slice (e.g. Answer-First definition + Section 1 for posts; Title + Agenda + first archetype slide for decks) for review to align on voice, depth, and layout before expanding.
4. **Progressive Asset Layering**: Build in strict dependency layers: (1) Semantics & Text $\rightarrow$ (2) Structural Schematics (`mermaid-diagrams`, `svg-graphics`) $\rightarrow$ (3) Diffusion Imagery (`image-generation`) $\rightarrow$ (4) Audio/PDF Build Exports. Never generate heavy visual/audio assets before text freeze.
5. **Controlled Backtracking & Blast-Radius Audit**: If mid-flight discoveries require shifting earlier premises, re-synchronize title, answer-first block, prior slices, and citation parity (`citation-management`) before proceeding.
- **Zero Assumptions**: Never invent personal opinions, technical stances, career milestones, evaluations of commercial tools, or organizational judgments without explicit user alignment.

## 3. Modular Skill Ecosystem (.agents/skills/)
Operational domain logic, layout archetypes, schemas, and workflows are decoupled into on-demand skills under `.agents/skills/`. Before performing specialized tasks, inspect the corresponding `SKILL.md`:
- **Content Creation**: `post-authoring`, `presentation-authoring`, `course-authoring`, `project-authoring`, `service-authoring`, `publication-authoring`, `visualization-authoring`.
- **Visuals & Schematics**: `svg-graphics`, `mermaid-diagrams`, `image-generation`.
- **Cross-Cutting Standards**: `source-research`, `citation-management`, `tag-management`, `legal-compliance`.
- **Site & Platform Engineering**: `site-curation`, `site-optimization`, `site-analytics`, `build-engineering`, `tool-engineering`.
- **Continuous Meta-Governance & Orchestration**: `agent-orchestration`, `backlog-management`, `skill-engineering`.

## 4. Release Verification Gate
Before proposing to merge any feature branch to `main`, the master verification gate MUST pass with 0 errors:
```powershell
npm run verify
```
(Aggregates ESLint, TypeScript check, script contracts, slide syntax, citation parity, style isolation, architecture rules, Astro SSG build, and `postbuild` semantic ID validation).

## 5. Continuous Improvement & Post-Task Reflection
After completing any major task or release, proactively reflect on friction, validation loops, and token waste. Formulate concrete tooling RFCs (`backlog/system/`) or content proposals (`backlog/content/`) following `backlog-management` and promote repetitive logic into automated tools.
