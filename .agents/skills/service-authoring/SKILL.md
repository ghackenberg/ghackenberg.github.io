---
name: service-authoring
description: Author, structure, and refine professional B2B engineering services, advisory offerings, consulting packages, and modular deliverables for technical leaders.
---

# Service Authoring (B2B Consulting & Engineering Services)

This skill governs the authoring, modular structuring, and refinement of commercial engineering and consulting services in `src/content/services/`.

## 1. Directory Structure & Architecture
Services are structured hierarchically:
- Parent Service: `src/content/services/<service-id>/index.md`.
- Modular Packages: `src/content/services/<service-id>/modules/<module-id>/index.md`.

### Parent Service Schema
```yaml
title: "KI-Agenten & System-Architektur"
tagline: "Maßgeschneiderte Agentensysteme, MCP-Server und skalierbare Backend-Architekturen"
description: "Strategische Beratung und praktische Umsetzung robuster KI-Pipelines und verteilter Softwaresysteme für Industrie und Technologieunternehmen."
order: 1
ctaText: "Beratungsgespräch vereinbaren"
tags:
  - software-architektur
  - prompt-engineering
previewImage:
  src: "./preview.png"
  title: "Serviceübersicht KI-Agenten"
  description: "Visuelle Darstellung moderner KI-Agenten-Architekturen"
pubDate: 2026-09-01
```

### Module Schema
```yaml
title: "MCP-Server & Tool Engineering"
serviceId: "ai-systems"
tagline: "Standardisierte Modellerweiterung für Unternehmenssysteme"
description: "Konzeption, Entwicklung und Integration sicherer Model Context Protocol (MCP) Server für Enterprise-Datenquellen."
ctaText: "Modul anfragen"
highlights:
  - "Entwicklung maßgeschneiderter MCP-Server in TypeScript oder Python"
  - "Anbindung interner SQL-, NoSQL- und REST-Unternehmensdaten"
  - "Sicherheits- und Berechtigungsgateways nach RFC-Standards"
inputs:
  - "Bestehende API- und Schema-Dokumentation"
  - "Sicherheits- und Authentifizierungsanforderungen"
outputs:
  - "Produktionsreifer, containerisierter MCP-Server"
  - "Umfassende Integrations- und Linter-Testsuite"
duration: "2–4 Wochen"
format: "Sprint-basiertes Engineering"
delivery: "Remote oder On-Site Workshop"
methodologyDescription: "Strukturierter 3-Phasen-Ansatz von der Anforderungsanalyse bis zur Produktivstellung."
methodologyPhases:
  - title: "Phase 1: Discovery & Schema-Design"
    description: "Definition der Tool-Schnittstellen und Zod-Schemas."
  - title: "Phase 2: Core Engineering & Mocking"
    description: "Implementierung der stdio- und HTTP/SSE-Transportschicht."
  - title: "Phase 3: Integration & Security Audit"
    description: "End-to-End Verifikation im Ziel-Client."
order: 1
previewImage:
  src: "./preview.png"
  title: "Modulübersicht MCP-Server"
  description: "Diagramm einer standardisierten MCP-Architektur"
```

## 2. Executive Tone & The Golden Slice Checkpoint
Follow the Universal Content Lifecycle in `AGENTS.md` (SOTA Reconnaissance $\rightarrow$ Alignment Gate $\rightarrow$ Golden Slice $\rightarrow$ Controlled Backtracking).
- **The Golden Slice Checkpoint (No Big-Bang Drafting)**:
  Before authoring all service packages, author and present only the pilot slice:
  1. Parent service frontmatter and executive value proposition.
  2. The first complete pilot module with `highlights`, `inputs`, `outputs`, and `methodologyPhases`.
  Align with the user before detailing remaining modular offerings.
- **Target Audience**: CTOs, VP Engineering, Tech Leads, and R&D Managers.
- **Tone**: Pragmatic, authoritative, engineering-first, with zero corporate buzzword fluff.
- **Clear Tangibles**: Every module must explicitly declare what the client provides (`inputs`) and the concrete technical deliverable received (`outputs`).
- **Methodology Transparency**: Outline concrete phases so prospects understand the timeline, milestones, and risk mitigation strategies.

## 3. Visual Assets & Diagrams
- **Service Previews**: 16:9 comic illustration vector images following visual brand guidelines (see `image-generation`).
- **Methodology Schematics**: Flowcharts and phase diagrams should use clean, self-contained SVG files co-located in the service folder.

## 4. Verification Gate
Service definitions and modules are verified during the master release verification gate (see `build-engineering`).
