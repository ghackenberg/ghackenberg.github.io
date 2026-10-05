---
name: backlog-management
description: Curate project backlogs, specify system RFCs and content initiatives, assign unique IDs, and maintain backlog/README.md registers.
---

# Backlog Management (RFCs, Content Ideas & Project Register)

This skill governs the structured recording, formal specification, and lifecycle tracking of system enhancements and content ideas in `backlog/`.

## 1. Directory Structure & Architecture
- Central Register: `backlog/README.md`.
- System RFCs: `backlog/system/` (tooling, MCP servers, linter, CI, architecture).
- Content Proposals: `backlog/content/` (articles, presentations, courses, case studies).
- Content Template: `backlog/content/TEMPLATE.md`.

## 2. ID Conventions & Numbering
- **System RFCs**: `SYSTEM-xxx` (e.g. `SYSTEM-001`, `SYSTEM-002`). The filename must be padded: `001-feature-name.md`.
- **Content Proposals**: `CONTENT-xxx` (e.g. `CONTENT-001`). The filename must be padded: `001-topic-name.md`.

## 3. RFC Lifecycle & Status Definitions
Every entry moves through a defined lifecycle:
- `idea`: Early scratchpad notes or brainstorming concept.
- `proposed`: Fully specified architecture or content plan awaiting user alignment.
- `planned`: Prioritized and scheduled for upcoming development sessions.
- `in-progress`: Actively being implemented on a feature branch.
- `implemented`: Merged to `main` and verified in production (with corresponding script, MCP tool, or live content).
- `deprecated`: Retired or superseded by a newer architectural pattern.

## 4. Continuous Improvement & Post-Task Reflection Workflow
Whenever a task reveals developer friction, repetitive manual effort, or missed optimizations:
1. **Reflect**: Pinpoint where iteration loops, validation failures, or token waste occurred.
2. **Specify**: Author a new RFC in `backlog/system/` or content idea in `backlog/content/` following the existing format (Motivation, Solution Architecture, Acceptance Criteria).
3. **Register**: Add the new item to the table in `backlog/README.md` with its ID, title, domain, priority, and link.
4. **Align**: Present the proposal to the user for prioritization.
