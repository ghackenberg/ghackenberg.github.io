---
name: agent-orchestration
description: Decompose complex workflows, dispatch subagents, enforce control-plane gatekeeping, and maintain isolated context with zero polling.
---

# Agent Orchestration (Control Plane & Subagent Governance)

This skill governs the Orchestrator-Worker protocol, dividing multi-step agentic tasks into a clean separation between high-level governance (Control Plane) and focused execution (Data Plane).

## 1. Control Plane vs. Data Plane Architecture
To prevent context saturation, instruction drift, and runaway tool loops, multi-phase tasks must adhere to a strict separation of concerns:
- **Parent Agent (Control Plane)**:
  - Maintains overall task lifecycle, phase progression, and user interaction.
  - Owns architectural decisions, planning, decomposition, and verification gates.
  - **Zero Direct Mutations**: During multi-phase or multi-skill initiatives, the parent agent must NEVER directly edit files, execute deep code rewrites, or run manual loops. All heavy data-plane work is delegated.
- **Subagents (Data Plane)**:
  - Invoked to execute a single, well-defined phase or specialized objective.
  - Operates with clean, isolated context window focused entirely on its assigned task.
  - Delivers structured deliverables and validation reports back to the Control Plane via `send_message`.

## 2. Work Breakdown & Task Decomposition
Before dispatching work:
1. **Phase Granularity**: Break initiatives into discrete, verifiable phases (e.g. Phase 1: Skill Authoring, Phase 2: Content Drafting, Phase 3: Build Verification).
2. **Single Responsibility**: Each subagent must have one specific role (e.g. Specialist Engineer, Content Author, Verification Auditor).
3. **Dependency Ordering**: Never launch dependent workers concurrently. Finish and gate Phase N before launching Phase N+1.

## 3. Structured Briefing Schema
When dispatching a subagent via `invoke_subagent`, the prompt must include a four-part structured briefing:
- **1. Target Skills & Operating Guidelines**: Explicit skills the worker must consult (e.g. `post-authoring`, `svg-graphics`) and rules to respect.
- **2. Inputs & Context**: File paths, source drafts, research notes, and architectural constraints needed for execution.
- **3. Concrete Steps**: Actionable checklist of implementation steps.
- **4. Quality & Gate Requirements**: Deterministic commands, schema checks, or tests that must pass before the worker reports completion.

### Example Briefing Template
```yaml
briefing:
  role: "Graphics Engineer"
  skills: ["svg-graphics"]
  inputs:
    target_file: "src/content/posts/<slug>/diagram.svg"
    dimensions: "viewBox 0 0 880 380"
  steps:
    - "Draft responsive inline SVG diagram"
    - "Apply brand tokens and adaptive dark/light CSS variables"
  gates:
    - "Verify no stroke clipping at canvas boundaries"
    - "Confirm valid XML and CSS syntax"
```

## 4. Reactive Wake-Up & Zero-Polling Contract
- **Asynchronous Execution**: Subagents run asynchronously in the background.
- **Zero Polling**: Never run sleep loops, timer checks, or repetitive status queries while waiting for a subagent.
- **Automatic Wake-Up**: The messaging infrastructure resumes parent agent execution immediately upon receipt of a message or subagent termination. Conclude your tool turn and await reactive notification.

## 5. Gatekeeping & Acceptance Review
When a worker reports completion:
1. **Audit Deliverables**: Inspect produced files, diffs, and verification outputs against the briefing requirements.
2. **Deterministic Validation**: Verify that domain scripts or linting commands passed with zero errors.
3. **Escalation / Remediation**: If acceptance criteria are unmet, send corrective instructions via `send_message` or dispatch a targeted remediation task.
4. **Phase Advance**: Only after the gate passes may the Control Plane mark the phase complete and proceed to the next milestone.
