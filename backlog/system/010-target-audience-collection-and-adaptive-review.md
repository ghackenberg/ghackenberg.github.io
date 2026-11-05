# SYSTEM-010: Target Audience Profiles as an Astro Content Collection, Adaptive Linting & Multi-Persona Review Governance

- **ID:** `SYSTEM-010`
- **Domäne:** `content-architecture` / `ci-linting` / `agent-orchestration` / `geo-schema`
- **Status:** `proposed`
- **Priorität / Hebel:** `HOCH`
- **Ursprung:** Session 2026-11-05 (Architektur-Reflexion zu Artikel-Längeninflation durch statische Multi-Persona-Reviews und fragmentierte Zielgruppen-Metadaten)

---

## 1. Problem & Motivation

1. **Systematische Text- und Komplexitätsinflation durch ein statisches 3-Persona-Review-Panel:**  
   Sowohl [`.agents/skills/post-authoring/SKILL.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/post-authoring/SKILL.md) als auch [`.agents/skills/agent-orchestration/SKILL.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/agent-orchestration/SKILL.md) schreiben derzeit für jeden Artikel-Entwurf ein starres, identisches 3-Persona-Review-Panel vor:
   - *Persona A (CTO / Principal Architect)*: Fordert umfassende System-Trade-offs, Fehler-Taxonomien und Architekturentscheidungen.
   - *Persona B (Senior Staff Engineer)*: Fordert tiefgehende TypeScript-/CLI-Implementierungsdetails, Bit-Level-Randfälle und Code-Verweise.
   - *Persona C (Academic / Systems Researcher)*: Fordert formale mathematische Beweise, Laufzeitkomplexitäts-Herleitungen und akademische Primärliteratur-Dichte.
   
   Da jeder Entwurf im geschlossenen Revisionszyklus (`REVISIONS_REQUIRED` $\rightarrow$ `APPROVED`) gleichzeitig alle drei hochanspruchsvollen Personas zufriedenstellen muss, blähen sich selbst praxisorientierte, visuell geführte Engineering-Guides (intendierter Zielkorridor: ~180–240 Zeilen) systematisch zu 500–700 Zeilen langen akademischen Whitepapers auf. Es fehlt ein deklaratives Steuerungsprimitiv, das dem Reviewer-Subagenten vorgibt, *welche* Tiefe gefordert ist und *wann* akademischer Ballast als Anti-Pattern abgelehnt werden muss.

2. **Fehlende deklarative Format- und Dichtebudgets in den CI-Lintern:**  
   Während [`src/scripts/lint-posts.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/lint-posts.ts), [`src/scripts/lint-svgs.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/lint-svgs.ts) und [`src/scripts/validate-slides.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/validate-slides.ts) strukturelle GEO/AIO-Invarianten (wie 38–58 Wörter für Answer-First-Absätze oder maximal 5 Knoten in Mermaid-Diagrammen) deterministisch prüfen, existieren keine zielgruppenabhängigen Obergrenzen für Gesamtzeilenanzahl, Sektionsanzahl, Code-Block-Längen, Zitationsdichte oder SVG-Textknoten-Komplexität.

3. **Fragmentierte, ungetypte Zielgruppen-Metadaten über die 8 Content-Domänen hinweg:**  
   In [`src/content.config.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content.config.ts) wird die Zielgruppe heute inkonsistent und ohne gemeinsame Referenz-Integrität modelliert:
   - `presentations` nutzt ein ungetyptes Freitextfeld `audience: z.string().optional()`.
   - `courses` nutzt ein ungetyptes Freitextfeld `targetAudience: z.string().optional()`.
   - `services` nutzt ein ungetyptes String-Array `targetAudience: z.array(z.string()).default([])`.
   - `posts`, `projects`, `publications`, `newsletters` und `visualizations` besitzen überhaupt kein Zielgruppen-Feld im Schema.

4. **Ungenutztes Potenzial in Schema.org JSON-LD (`schema:Audience`) und `/llms.txt`:**  
   Weder [`src/commons/server/json-ld.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/json-ld.ts) noch [`src/pages/llms.txt.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/llms.txt.ts) exponieren derzeit strukturierte `schema:Audience`- oder `educationalLevel`-Annotationen. Sowohl Suchmaschinen als auch abrufende KI-/RAG-Agenten können vor dem Abruf einer Ressource nicht maschinenlesbar erkennen, ob es sich um ein kompaktes Executive-Briefing, einen verdaulichen Practitioner-Guide, universitäre Bachelor-/Master-Lehrunterlagen oder einen tiefgehenden Forschungsbeitrag handelt.

---

## 2. Vorgeschlagene Architektur (`src/content/audiences/` als Single Source of Truth)

Analog zu den bestehenden Querschnitts-Collections (`tags`, `characters`, `environments`, `objects`) folgt `SYSTEM-010` strikt dem Architekturprinzip des Repositories: **„Daten & Schemata in `src/content/`, Prozesse & Workflows in `.agents/skills/`"** — verifiziert durch deterministische CLI-Linter in `src/scripts/`.

### 2.1 Neue Astro Content Collection `audiences` (`src/content/audiences/<id>.md`)

In [`src/content.config.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content.config.ts) wird eine erstklassige Collection `audiences` definiert. Jedes Zielgruppen-Profil unter `src/content/audiences/<id>.md` kombiniert **maschinenprüfbare YAML-Frontmatter-Budgets** mit einer **redaktionellen Markdown-Spezifikation**:

- **YAML-Frontmatter (Deterministische Budgets, Schema.org-Mapping & Reviewer-Panel):**
  - Semantische Kernfelder: `title`, `description`, `schemaAudienceType` (z. B. `Researcher`, `SoftwareEngineer`, `Student`, `Executive`, `AI_RAG_Retriever`) sowie `educationalLevel` (`Beginner`, `Intermediate`, `Advanced`, `Research`).
  - Domänenspezifische Format- und Komplexitätsbudgets (`budgets.posts`, `budgets.presentations`, `budgets.courses`), z. B. für Blog-Posts:
    - `minLines` / `maxLines` (harte Korridore gegen Textinflation, z. B. `160–240` Zeilen für `practitioner-guide` vs. `350–550` Zeilen für `research-deep-dive`).
    - `minSections` / `maxSections` (Anzahl der `##`-Hauptkapitel exkl. Referenzen).
    - `maxCodeLinesPerBlock` (Vermeidung monolithischer Code-Dumps in kompakten Guides).
    - `minReferences` / `maxReferences` (angemessene Belegdichte statt Pflicht-Literaturlisten von 15+ Papers bei Praxisartikeln).
    - `svgMaxWordsPerTextNode` (maximale Wortdichte pro `<text>`-Knoten in Inline-SVGs für schnelle visuelle Erfassbarkeit).
  - Dynamische **3-Persona-Reviewer-Konfiguration (`reviewerPersonas`)**: Ein exakt 3-elementiges Tupel aus `{ role, focus, antiPatternsToReject }`, das im Multi-Agenten-Workflow das bisherige statische Panel ersetzt.

- **Markdown-Body (Didaktik, Tonalität & Review-Rubrik für Subagenten):**
  - Definiert für Author- und Reviewer-Subagenten verbindlich das vorausgesetzte mentale Modell der Leserschaft, die sprachliche Dichte, den Einsatz visueller Brücken (Inline-SVGs, Vergleichstabellen) sowie konkrete Positiv-/Negativbeispiele.

### 2.2 Entwurf des Zod-Schemas in `src/content.config.ts`

```typescript
const reviewerPersonaSchema = z.object({
  role: z.string().min(3),
  focus: z.string().min(10),
  antiPatternsToReject: z.array(z.string().min(5)).min(1),
});

const postBudgetSchema = z.object({
  minLines: z.number().int().positive(),
  maxLines: z.number().int().positive(),
  minSections: z.number().int().positive(),
  maxSections: z.number().int().positive(),
  maxCodeLinesPerBlock: z.number().int().positive(),
  minReferences: z.number().int().nonnegative(),
  maxReferences: z.number().int().positive(),
  svgMaxWordsPerTextNode: z.number().int().positive().default(6),
});

const presentationBudgetSchema = z.object({
  minSlides: z.number().int().positive(),
  maxSlides: z.number().int().positive(),
  maxVoiceoverWordsPerSlide: z.number().int().positive(),
  minReferencesPerDeck: z.number().int().nonnegative(),
});

const audiences = defineCollection({
  loader: glob({
    base: './src/content/audiences',
    pattern: '**/*.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '').replace(/\.(md|mdx)$/, ''),
  }),
  schema: z.object({
    title: z.string().min(3),
    description: z.string().min(10),
    schemaAudienceType: z.enum([
      'SoftwareEngineer',
      'SystemArchitect',
      'Researcher',
      'Student',
      'Executive',
      'AI_RAG_Retriever',
    ]),
    educationalLevel: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Research']),
    budgets: z.object({
      posts: postBudgetSchema.optional(),
      presentations: presentationBudgetSchema.optional(),
    }).default({}),
    reviewerPersonas: z.tuple([
      reviewerPersonaSchema,
      reviewerPersonaSchema,
      reviewerPersonaSchema,
    ]),
  }).strict(),
});
```

### 2.3 Beispiel eines konkreten Zielgruppen-Profils (`src/content/audiences/practitioner-guide.md`)

```yaml
---
title: "Practitioner & AI-Digestible Engineering Guide"
description: "Kompakter, visuell geführter Architektur- und Praxis-Guide für Software-Ingenieure und KI-/RAG-Agenten mit Fokus auf schnelle kognitive Erfassbarkeit."
schemaAudienceType: "SoftwareEngineer"
educationalLevel: "Intermediate"
budgets:
  posts:
    minLines: 160
    maxLines: 240
    minSections: 3
    maxSections: 4
    maxCodeLinesPerBlock: 25
    minReferences: 3
    maxReferences: 6
    svgMaxWordsPerTextNode: 4
  presentations:
    minSlides: 10
    maxSlides: 16
    maxVoiceoverWordsPerSlide: 110
    minReferencesPerDeck: 3
reviewerPersonas:
  - role: "Pragmatic Senior Product Engineer"
    focus: "Prüft sofortige praktische Umsetzbarkeit, klare Architektur-Mental-Models, prägnante Code-Snippets und ein hohes Signal-Rausch-Verhältnis."
    antiPatternsToReject:
      - "Akademische Beweisführungen oder unnötige griechische Formelnotation ohne direkten Praxishebel"
      - "Monolithische Code-Blöcke über 25 Zeilen oder redundante Boilerplate-Listings"
      - "Theoretische Exkurse, die das Zeilenbudget von 240 Zeilen sprengen"
  - role: "AI / RAG Synthesis & Knowledge Extraction Agent"
    focus: "Prüft maschinelle Extrahierbarkeit, selbsttragende Answer-First-Absätze (40–55 Wörter), eindeutige Entitäts-Relationen und Vergleichstabellen."
    antiPatternsToReject:
      - "Implizite Pronomen-Referenzen in Sektions-Einstiegen ohne klaren Entitätsbezug"
      - "Fließtext-Wüsten ohne strukturierte Markdown-Vergleichstabellen oder präzise Frage-Überschriften"
  - role: "Visual-First Technical Editor"
    focus: "Prüft das Zusammenspiel aus knappem Sachtext und hochgradig selbsterklärenden Inline-SVG-/Mermaid-Schemata."
    antiPatternsToReject:
      - "Überfrachtete SVG-Diagramme mit langen Satzfragmenten (> 4 Wörter pro Textknoten)"
      - "Wiederholung derselben Aufzählung im Fließtext, in der Tabelle und im Diagramm"
---

# Didaktisches Profil & Autorenschafts-Richtlinien

Artikel und Präsentationen mit dem Profil `practitioner-guide` richten sich an erfahrene Entwicklerinnen und Entwickler sowie an abrufende KI-Assistenten, die ein technisches Konzept in **unter 5 Minuten Lesezeit** vollständig durchdringen und adaptieren wollen...
```

---

## 3. Cross-Domain-Verknüpfungsstrategie & Downstream-Konsumenten

### 3.1 Anbindung der 8 primären Content Collections in `src/content.config.ts`

Durch eine einheitliche Referenz-Validierung (analog zu `tagReference` bzw. `reference('audiences')` in [`src/content.config.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content.config.ts)) werden die bisherigen Freitext-Insellösungen abgelöst:

| Collection | Aktueller Zustand in `src/content.config.ts` | Ziel-Anbindung an `src/content/audiences/` | Typische Profile / Domänen-Defaults |
| :--- | :--- | :--- | :--- |
| **`posts`** | Kein Feld | Explizite Referenz (`audience: reference('audiences')`) | `practitioner-guide`, `senior-engineering`, `research-deep-dive` |
| **`presentations`** | `audience: z.string().optional()` | Migration auf typisierte Referenz (`reference('audiences')`) | `practitioner-guide`, `academic-coursework`, `executive-briefing` |
| **`courses`** | `targetAudience: z.string().optional()` | Typisierte Referenz `audience` (+ optionales Freitext-Detailfeld für Semester/Studiengang) | `academic-coursework` (Bachelor / Master FH OÖ) |
| **`services`** | `targetAudience: z.array(z.string())` | Typisierte Referenz `audience` (Default: `executive-briefing`) + bestehende B2B-Rollenliste | `executive-briefing`, `senior-engineering` |
| **`publications`** | Kein Feld | Impliziter Domänen-Default oder explizite Referenz | Default: `research-deep-dive` |
| **`projects`** | Kein Feld | Optionale oder Default-gestützte Referenz | `executive-briefing`, `senior-engineering` |
| **`newsletters`** | Kein Feld | Impliziter Domänen-Default oder explizite Referenz | Default: `practitioner-guide` |
| **`visualizations`** | Kein Feld | Optionale oder Default-gestützte Referenz | Default: `practitioner-guide` / `research-deep-dive` |

### 3.2 Deterministische Durchsetzung in den CI-Lintern (`src/scripts/`)

1. **[`src/scripts/lint-posts.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/lint-posts.ts)**:
   - Liest für jeden modernen Post das verknüpfte `audience`-Profil aus `src/content/audiences/<id>.md`.
   - Prüft deterministisch `budgets.posts`:
     - Gesamtzeilenanzahl des Markdown-Bodys liegt innerhalb `[minLines, maxLines]`.
     - Anzahl der `##`-Sektionen liegt innerhalb `[minSections, maxSections]`.
     - Kein einzelner Fenced-Code-Block überschreitet `maxCodeLinesPerBlock`.
     - Anzahl der `references` im Frontmatter liegt innerhalb `[minReferences, maxReferences]`.
2. **[`src/scripts/lint-svgs.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/lint-svgs.ts)**:
   - Prüft bei Inline-SVGs innerhalb eines Posts die im jeweiligen `audience`-Profil hinterlegte Obergrenze `svgMaxWordsPerTextNode`, um überladene Text-Diagramme in kompakten Formaten mechanisch abzublocken.
3. **[`src/scripts/validate-slides.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/validate-slides.ts)**:
   - Prüft Folienanzahl (`[minSlides, maxSlides]`), maximale Sprechernotiz-Länge (`maxVoiceoverWordsPerSlide`) und Mindest-Referenzen (`minReferencesPerDeck`) gegen `budgets.presentations`.

### 3.3 Semantische Anreicherung in Schema.org JSON-LD & `/llms.txt`

1. **[`src/commons/server/json-ld.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/json-ld.ts)**:
   - Löst die `audience`-Referenz eines Eintrags auf und emittiert standardkonformes Schema.org-Vokabular auf `TechArticle`, `ScholarlyArticle`, `Course`, `PresentationDigitalDocument` und `Service`:
     ```json
     {
       "audience": {
         "@type": "Audience",
         "audienceType": "SoftwareEngineer",
         "name": "Practitioner & AI-Digestible Engineering Guide"
       },
       "educationalLevel": "Intermediate"
     }
     ```
2. **[`src/pages/llms.txt.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/llms.txt.ts)**:
   - Ergänzt die Index-Zeilen in `/llms.txt` um ein kompaktes Metadaten-Tag (z. B. `[Audience: Practitioner Guide | Level: Intermediate]`), sodass externe LLM-Crawler und RAG-Pipelines die Granularität jeder Ressource vor dem HTTP-Fetch erkennen.

### 3.4 Katalog-UI, Pre-Filtering & Wissensgraph (Optional / Ausbaustufe)

- **Katalog-Filterung**: [`src/components/FilterToolbar.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/FilterToolbar.astro), [`src/components/CatalogPreFilter.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/CatalogPreFilter.astro) und [`src/commons/client/filter.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/filter.ts) können bei Bedarf um eine Filter-Dimension `?audience=` bzw. dezente Zielgruppen-Badges auf den Katalogkarten erweitert werden.
- **Graph-Payloads & Manifest**: [`src/pages/content-manifest.json.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/content-manifest.json.ts) und [`src/commons/shared/graph-payload.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts) können die `audience`-Metadaten im Tooltip oder als Graph-Facette bereitstellen.

### 3.5 Kopplung an die Agenten-Skills (`.agents/skills/`)

- **Alignment Gate (`/grill-me`)**: In [`.agents/skills/post-authoring/SKILL.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/post-authoring/SKILL.md), [`.agents/skills/presentation-authoring/SKILL.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/presentation-authoring/SKILL.md) und [`.agents/skills/course-authoring/SKILL.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/course-authoring/SKILL.md) wird die Wahl des `audience`-Profils als expliziter Pflichtparameter in Stage 2 (`/grill-me`) verankert.
- **Dynamisches Subagent-Briefing**: In [`.agents/skills/agent-orchestration/SKILL.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/agent-orchestration/SKILL.md) und [`.agents/skills/svg-graphics/SKILL.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/svg-graphics/SKILL.md) wird das statische 3-Persona-Panel durch den Verweis auf `src/content/audiences/<id>.md` ersetzt. Sowohl der Author-Subagent als auch der unabhängige Reviewer-Subagent müssen vor ihrer Ausführung die referenzierte Profildatei lesen und deren `budgets` sowie `reviewerPersonas` (`antiPatternsToReject`) strikt durchsetzen.

---

## 4. Offene Design-Entscheidungen & Klärungspunkte (`/grill-me` vor Implementierung)

Vor dem Start der Implementierung sind folgende fünf Architekturentscheidungen mit dem Autor abzustimmen:

- [ ] **Q1 (1:1 vs. 1:N Kardinalität):**  
  Soll ein Content-Eintrag genau **ein** primäres `audience`-Profil referenzieren (`audience: reference('audiences')` — erzwingt *ein* eindeutiges, widerspruchsfreies Linter-Budget für Zeilenlänge und Tiefe) oder ein Array `audiences` (bzw. `primaryAudience` für das Linter-Budget + optionale `secondaryAudiences` für JSON-LD/Filterung)?
- [ ] **Q2 (Pflichtfeld vs. Domänen-Defaults & Backfill):**  
  Soll `audience` über alle 8 primären Collections hinweg ein explizites Pflichtfeld im Frontmatter sein (inkl. automatischem Backfill für bestehende Posts, Präsentationen und Kurse), oder soll es nur bei `posts`, `presentations` und `courses` explizit gesetzt werden, während `publications` (`research-deep-dive`), `services` (`executive-briefing`) und `newsletters` (`practitioner-guide`) über implizite Domänen-Defaults im Schema verfügen?
- [ ] **Q3 (Sichtbarkeit im Frontend & Wissensgraphen):**  
  Soll `audiences` primär als **Backend-, CI-Linter-, JSON-LD-, `/llms.txt`- und Agenten-Governance-Primitiv** unter der Haube agieren, oder sollen Zielgruppen auch sichtbar im Frontend gerendert werden (als Karten-Badge, als `?audience=`-Filter in [`src/components/FilterToolbar.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/FilterToolbar.astro) / [`src/components/CatalogPreFilter.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/CatalogPreFilter.astro) oder als Knoten/Facette in den 5 interaktiven Graph-Visualisierungen)?
- [ ] **Q4 (Granularität des initialen Profil-Sets):**  
  Welches kanonische Starter-Set an Profilen unter `src/content/audiences/` soll initial ausgerollt werden? Vorschlag:
  1. `practitioner-guide` (~160–240 Zeilen, visuell geführt, kompakte Code-Snippets, max. 6 Referenzen)
  2. `senior-engineering` (~240–360 Zeilen, Produktions-Architektur, tiefere Implementierungs- und Edge-Case-Analyse)
  3. `research-deep-dive` (~360–550 Zeilen, formale Beweise, Laufzeitkomplexität, volle akademische Literaturdichte)
  4. `executive-briefing` (Strategische Entscheidungsmatrix, ROI/Risiko-Fokus, minimale Code-Tiefe)
  5. `academic-coursework` (Didaktische Progression, Lernziele, Bachelor-/Master-Vorlesungsniveau)
- [ ] **Q5 (AI / LLM als Co-Reader vs. Eigenes Profil):**  
  Da *jeder* moderne Beitrag auf `hackenberg.tech` über Answer-First-Blöcke und Synthese-Tabellen für GEO/AIO optimiert wird ([`src/scripts/lint-posts.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/lint-posts.ts)), stellt sich die Frage: Soll die Perspektive *„AI / RAG Retriever"* als **querschnittliche Standard-Persona B in jedem Zielgruppen-Profil** verankert sein (sodass Menschen *und* KI-Agenten gleichermaßen von der gewählten Tiefe profitieren), statt `ai-rag` als separates, isoliertes Zielgruppen-Tag zu führen?

---

## 5. Erwarteter Nutzen & Akzeptanzkriterien

- **Ende der ungewollten Whitepaper-Inflation:** Ein als `practitioner-guide` deklarierter Beitrag wird sowohl vom Reviewer-Subagenten als auch von `npm run lint:posts` hart auf seinen kompakten Zielkorridor (z. B. 160–240 Zeilen) verpflichtet; akademischer Überhang wird im Review aktiv als Fehler gemeldet.
- **100 % Referenz-Integrität über alle Content-Domänen:** Keine ungetypten `audience`-/`targetAudience`-Freitextfelder mehr ohne Rückbindung an `src/content/audiences/`.
- **Maschinenlesbare Tiefe für Suchmaschinen & KI-Agenten:** Vollständige Ausspielung von `schema:Audience` und `educationalLevel` in JSON-LD sowie in `/llms.txt`.
- **Zero-Warning Master Verification Gate:** `npm run verify` prüft Schema-Validität, Zielgruppen-Budgets und Zitations-Parität in einem einheitlichen Durchlauf.
