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

## 2. Universal Content Authoring & Anti-Hallucination Gate
- **Zero Assumptions**: Never invent personal opinions, technical stances, career milestones, evaluations of commercial tools, or organizational judgments without explicit user alignment.
- **Interview-First (`/grill-me`)**: Before drafting or restructuring content (posts, presentations, courses, services), present 4–8 targeted interview questions to establish core thesis, quantitative metrics, industry partners, and terminology preferences. Drafting begins only after the user confirms the outline.

## 3. Modular Skill Ecosystem (.agents/skills/)
Operational domain logic, layout archetypes, schemas, and workflows are decoupled into on-demand skills under `.agents/skills/`. Before performing specialized tasks, inspect the corresponding `SKILL.md`:
- **Content Creation**: `post-authoring`, `presentation-authoring`, `course-authoring`, `project-authoring`, `service-authoring`, `publication-authoring`, `visualization-authoring`.
- **Cross-Cutting Standards**: `citation-management`, `image-generation`, `tag-management`, `legal-compliance`.
- **Site & Platform Engineering**: `site-curation`, `site-optimization`, `site-analytics`, `build-engineering`, `tool-engineering`.
- **Continuous Meta-Governance**: `backlog-management`, `skill-engineering`.

## 4. Release Verification Gate
Before proposing to merge any feature branch to `main`, the master verification gate MUST pass with 0 errors:
```powershell
npm run verify
```
(Aggregates ESLint, TypeScript check, script contracts, slide syntax, citation parity, style isolation, architecture rules, Astro SSG build, and `postbuild` semantic ID validation).

## 5. Continuous Improvement & Post-Task Reflection
After completing any major task or release, proactively reflect on friction, validation loops, and token waste. Formulate concrete tooling RFCs (`backlog/system/`) or content proposals (`backlog/content/`) following `backlog-management` and promote repetitive logic into automated tools.
