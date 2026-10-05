---
name: course-authoring
description: Structure, author, and maintain university courses, syllabi, learning goals, and lecture materials for higher education (FH OÖ Wels).
---

# Course Authoring (Higher Education & Curricula)

This skill governs the creation and maintenance of university courses and lecture modules in `src/content/courses/`.

## 1. Directory Structure & Schema
Every course resides in its own directory under `src/content/courses/<course-id>/`:
- File: `src/content/courses/<course-id>/index.md` or `index.mdx`.
- Frontmatter schema (`src/content.config.ts`):
  ```yaml
  title: "Software Engineering & Architecture"
  description: "Grundlagen moderner Softwarearchitektur, Entwurfsmuster und verteilter Systeme."
  repoName: "ghackenberg/course-software-engineering"
  language: "de"
  terms:
    - "WS 2025/26"
    - "SS 2026"
  learningGoals:
    - "Verstehen und Anwenden modularer Architekturmuster in TypeScript und C#."
    - "Entwurf robuster API-Schnittstellen und Event-Driven Architekturen."
    - "Beherrschung automatisierter Test- und CI/CD-Pipelines."
  tags:
    - software-architektur
    - clean-code
  screenshot:
    src: "./preview.jpg"
    title: "Kursübersicht"
    description: "Vorschau des Vorlesungsmaterials für Software Engineering"
  pubDate: 2026-10-01
  ```

## 2. Pedagogical Architecture & The Golden Slice Checkpoint
Follow the Universal Content Lifecycle in `AGENTS.md` (SOTA Reconnaissance $\rightarrow$ Alignment Gate $\rightarrow$ Golden Slice $\rightarrow$ Controlled Backtracking).
- **The Golden Slice Checkpoint (No Big-Bang Drafting)**:
  Before authoring all lecture modules, author and present only the pilot slice:
  1. Complete course frontmatter with Bloom-taxonomized `learningGoals`.
  2. The course overview and didactic target framing.
  3. Module 1 syllabus with Leitfragen, reading list, and practical lab assignment.
  Confirm with the instructor before expanding remaining modules.
- **Instruction Language**: FH OÖ Wels courses use German as the primary instructional language (`language: "de"`). Maintain crisp academic and professional terminology.
- **Zero Language Mixing**: Do not mix German prose with English headings or navigation elements on the same page.
- **Actionable Learning Goals**: Formulate learning goals using Bloom's Revised Taxonomy (Erinnern $\rightarrow$ Verstehen $\rightarrow$ Anwenden $\rightarrow$ Analysieren $\rightarrow$ Evaluieren $\rightarrow$ Erschaffen). Begin with active verbs.
- **Repository Integration**: Each course links to its companion GitHub repository (`repoName`) providing exercise code, lab assignments, and starter templates.

## 3. Syllabus & Course Body Structure
Organize lecture content into modular thematic blocks:
- **Überblick & Zielgruppe**: Zielgruppe (z. B. Bachelor/Master Informatik), Voraussetzungen und didaktischer Aufbau.
- **Vorlesungsinhalte & Module**: Wöchentliche oder modulare Gliederung mit Leitfragen und praktischen Übungen.
- **Leistungsbeurteilung**: Transparente Aufteilung (z. B. 40% Übungsaufgaben / Praktika, 60% Abschlussprojekt / Klausur).
- **Literatur & Referenzen**: Empfohlene Lehrbücher und weiterführende wissenschaftliche Publikationen.

## 4. Verification Gate
Course schemas and tags are verified during the master release verification gate (see `build-engineering`).
