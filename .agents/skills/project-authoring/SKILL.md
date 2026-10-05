---
name: project-authoring
description: Author, structure, and showcase portfolio case studies, technical implementations, architecture blueprints, and open-source software projects.
---

# Project Authoring (Portfolio & Case Studies)

This skill governs the creation and maintenance of engineering case studies and portfolio projects in `src/content/projects/`.

## 1. Directory Structure & Schema
Every project lives in its own directory under `src/content/projects/<slug>/`:
- File: `src/content/projects/<slug>/index.md`.
- Frontmatter schema (`src/content.config.ts`):
  ```yaml
  title: "Steward Workflow Engine"
  tagline: "High-Performance Distributed Agent Orchestrator"
  description: "Echtzeitfähige Orchestrierung autonomer KI-Agenten mit deterministischer State-Machine und lokaler Telemetrie."
  href: "https://steward.hackenberg.tech"
  repoName: "ghackenberg/steward"
  accentColor: "blue"
  order: 1
  tags:
    - software-architektur
    - prompt-engineering
  screenshot:
    src: "./screenshot-dark.png"
    title: "Steward Dashboard Dark Mode"
    description: "Visuelle Übersicht der Agenten-Ausführungspipeline im Dark Theme"
  screenshotLight:
    src: "./screenshot-light.png"
    title: "Steward Dashboard Light Mode"
    description: "Visuelle Übersicht der Agenten-Ausführungspipeline im Light Theme"
  screenshots: []
  pubDate: 2026-09-15
  ```

## 2. Case Study Narrative Structure
Structure project descriptions into a rigorous engineering case study:
1. **The Challenge / Problemstellung**: What technical limitation, bottleneck, or business problem necessitated this system?
2. **Architecture & Solution**: System architecture, data flow, key abstractions, and design decisions.
3. **Tech Stack & Libraries**: Core languages, frameworks, storage engines, and tools used.
4. **Key Takeaways & Impact**: Benchmarks, performance gains, operational stability, or user adoption metrics.

## 3. Visual Assets & Screenshots
- **Aspect Ratio**: 16:9 widescreen format for all screenshots.
- **Theme Parity**: Provide both dark (`screenshot`) and light (`screenshotLight`) captures when available to match user system preferences.
- **Asset Co-location**: Store screenshot images directly within `src/content/projects/<slug>/`.

## 4. Verification Gate
Project entries and screenshot schemas are validated during the master release verification gate (see `build-engineering`).
