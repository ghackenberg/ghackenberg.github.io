---
name: skill-engineering
description: Author, evaluate, refactor, and govern modular AI agent skills in .agents/skills/ following progressive disclosure standards.
---

# Skill Engineering (Agent Skill Meta-Governance)

This skill governs the creation, modularization, quality standards, and lifecycle of AI agent skills in `.agents/skills/`.

## 1. The 3-Level Progressive Disclosure Architecture
Skills are designed to minimize context window consumption while providing deep operational precision when activated:
- **Level 1 (System Prompt Discovery)**:
  - YAML frontmatter in `.agents/skills/<name>/SKILL.md` declaring `name` and `description`.
  - Only this concise description is loaded into the agent's `<skills>` system prompt at launch (~20–40 tokens per skill).
- **Level 2 (Active Working Context)**:
  - The markdown body of `SKILL.md`, read via `view_file` only when the skill is relevant to the user request.
  - Must remain concise, high-density, and actionable (<250 lines, ideally 50–120 lines).
- **Level 3 (Co-Located Specialized Resources)**:
  - Optional sub-directories within `.agents/skills/<name>/` (`scripts/`, `templates/`, `references/`) for complex workflows or large schemas.

## 2. Naming & Formatting Standard
- **Strict 2-Word Hyphenated Naming**: Every skill folder and frontmatter `name` must consist of **strictly two words separated by a hyphen** (`<topic>-<domain/action>`, e.g. `presentation-authoring`, `site-optimization`, `skill-engineering`).
- **Markdown Hygiene**: Never use horizontal dividers (`---`) in the body text (only in the YAML frontmatter). Use semantic headings (`##`, `###`).
- **Canonical URLs**: Link to repository code using canonical GitHub URLs on `main`.

## 3. Skill Design & Authoring Checklist
When authoring or updating a skill:
1. **Single Responsibility**: Does the skill focus on exactly one content collection, platform capability, or operational domain?
2. **Actionable Commands**: Are shell commands formatted strictly for Windows PowerShell?
3. **Validation Integration**: Does the skill declare pre-flight commands (`npm run validate:...` / `npm run verify`) to catch syntax and schema errors?
4. **Zero Fluff**: Does every line convey concrete constraints, schemas, workflows, or rules?
5. **No Token Bloat**: Is the document under 200 lines? If exceeding 250 lines, split off sub-resources (Level 3) or promote algorithms to CLI tools (see `tool-engineering`).

## 4. Promotion from Prompt to Tool
If an agent repeatedly encounters friction, executes multi-step manual validations, or spends excessive tokens parsing text:
- Promote the logic to an automated script (`src/scripts/`) or MCP server tool (`src/tools/`).
- Update the skill to invoke the tool instead of describing manual step-by-step procedures.
