---
name: tag-management
description: Maintain taxonomic integrity, define canonical tags in src/content/tags/, resolve taxonomy conflicts, and eliminate orphan or missing tags.
---

# Tag Management (Taxonomy & Content Classification)

This skill governs the categorization, semantic labeling, and integrity validation of tags across all content collections.

## 1. Directory Structure & Schema
Tags are first-class content entities in Astro. Every tag must be explicitly defined in its own file:
- Directory: `src/content/tags/<tag-id>.md`.
- `<tag-id>`: Lowercase kebab-case slug (e.g. `software-architektur`, `prompt-engineering`, `threejs`).
- Schema (`src/content.config.ts`):
  ```yaml
  title: "Software-Architektur"
  description: "Entwurfsmuster, modulare Systemgrenzen, Domain-Driven Design und verteilte Architekturen."
  ```

## 2. The Strict Tag Reference Gate
In `src/content.config.ts`, the `tagReference` schema strictly verifies every tag used in any content collection (`posts`, `projects`, `courses`, `services`, `visualizations`, `publications`, `presentations`):
- **Missing Tag Error**: If a document references a tag that does not have a corresponding `.md` file in `src/content/tags/`, the Astro build **fails immediately**:
  `Unknown tag "<tag-id>". The tag is not defined in "src/content/tags/". Please create "src/content/tags/<tag-id>.md" with a description or fix the tag reference.`
- **Zero Orphan References**: Never introduce a new tag in frontmatter without simultaneously creating its entity definition in `src/content/tags/<tag-id>.md`.

## 3. Taxonomy Governance Principles
- **Canonical Naming**: Prevent duplicate synonyms (e.g. choose between `machine-learning` vs `ml`, `typescript` vs `ts`).
- **Granularity Control**: Prefer 2–5 highly relevant, high-signal tags per piece of content over laundry lists of generic terms.
- **Kebab-Case Slugs**: Only lowercase letters, digits, and hyphens (`[a-z0-9-]+`).

## 4. Verification Gate
Tag definitions and references are validated during the master release verification gate (see `build-engineering`).
