# SYSTEM-008: Client-Side W3C WebMCP Progressive Enhancement (`document.modelContext`)

- **ID:** `SYSTEM-008`
- **Domäne:** `agentic-web` / `frontend-architecture` / `mcp`
- **Status:** `proposed`
- **Priorität / Hebel:** `HOCH`
- **Ursprung:** Session 2026-10-20 (Architektur-Analyse im Rahmen von `2026_10_23_webmcp_w3c_standard_architecture_history_future`)

---

## 1. Problem & Motivation

1. **Fragile DOM-Interaktion für kooperative Browser-Agenten:**  
   Obwohl `hackenberg.tech` für statische Wissensabfragen bereits über semantisches HTML5, JSON-LD, Answer-First-Blöcke und `/llms.txt` verfügt und für Backend-Telemetrie den `stdio`-basierten MCP-Server [`src/tools/unified-analytics.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/tools/unified-analytics.ts) bereitstellt, müssen Browser-Agenten (Chrome Gemini, Edge Copilot sowie IDE-Agenten wie Google Antigravity und Claude Code über `chrome-devtools-mcp`) bei interaktiven Client-Komponenten derzeit noch auf fragile DOM-Selektoren und synthetische Tastatur-/Mauseingaben zurückgreifen.
2. **Drei interaktive Client-State-Maschinen mit hohem WebMCP-Hebel:**  
   Eine Analyse der bestehenden Client-Skripte zeigt drei konkrete Oberflächen, die bereits über saubere, zustandsbehaftete TypeScript-Controller verfügen und sich ohne externes Framework-Gewicht als **W3C WebMCP (`document.modelContext`)** Progressive Enhancement exponieren lassen:
   - **Newsletter-Anmeldung mit ALTCHA SHA-256 Proof-of-Work:** [`src/components/NewsletterSignup.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/NewsletterSignup.astro) und [`src/commons/client/newsletter.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/newsletter.ts).
   - **Multi-Kriterien-Katalogfilterung (`ClientListFilter`):** [`src/commons/client/filter.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/filter.ts) auf allen 7 Sammlungs-Übersichtsseiten (`/posts/`, `/publications/`, `/presentations/`, `/courses/`, `/projects/`, `/services/`, `/visualizations/`).
   - **Interaktive Reveal.js Slide-Engine & Audio-Synchronisation:** [`src/components/slides/player/SlideDeck.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/slides/player/SlideDeck.astro).

---

## 2. Zielsetzung

Implementierung einer leichtgewichtigen, standardkonformen W3C WebMCP Progressive-Enhancement-Schicht (`if ('modelContext' in document)`), die sowohl die **deklarative HTML-Form-API** (`<form toolname="...">`) als auch die **imperative WebIDL-API** (`document.modelContext.registerTool(tool, { signal })`) auf den drei interaktiven Kernoberflächen von `hackenberg.tech` bereitstellt.

---

## 3. Lösungsarchitektur (3 Oberflächen)

### Oberfläche 1: Deklarative & Imperative Newsletter-Subskription (`NewsletterSignup.astro` & `newsletter.ts`)
- **Deklaratives HTML-Formular:** Erweiterung des bestehenden `<form data-newsletter-form>` in [`src/components/NewsletterSignup.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/NewsletterSignup.astro) um:
  - `toolname="subscribe_newsletter"`
  - `tooldescription="Stages a subscription to Dr. Georg Hackenberg's technical newsletter after human confirmation."`
  - Expliziter Verzicht auf `toolautosubmit`, sodass der Browser-Agent die Felder vorbefüllt und der menschliche Nutzer die Eintragung visuell prüft (unterstützt durch `:tool-form-active` und `:tool-submit-active` Focus-Styling).
  - Parameter-Annotationen (`toolparamdescription`) auf den Eingabefeldern `email` und `name` sowie Behandlung von `SubmitEvent.agentInvoked` und `SubmitEvent.respondWith(Promise)`.
- **Imperatives Tool (`subscribe_newsletter`):** Registrierung über `document.modelContext.registerTool()` in [`src/commons/client/newsletter.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/newsletter.ts) (`consequentialHint: true`, `readOnlyHint: false`), das die bestehende `Int32Array`-basierte SHA-256 Proof-of-Work-Berechnung (`solveAltchaChallengeInWorker`) im Hintergrund-Web-Worker kapselt und das strukturierte Listmonk-Opt-In-Ergebnis zurückgibt.

### Oberfläche 2: Kooperative Katalog-Filterung (`src/commons/client/filter.ts`)
- **Integration in `ClientListFilter`:** Wenn `document.modelContext` verfügbar ist, registriert `ClientListFilter` bei der Initialisierung ein `AbortController`-gebundenes Tool `filter_catalog` (`readOnlyHint: true`, `untrustedContentHint: false`, `consequentialHint: false`).
- **Dynamisches JSON Schema 2020-12:** Das `inputSchema` wird zur Laufzeit automatisch aus den im DOM vorhandenen Filter-Dimensionen (`query`, verfügbare `tags`, `years`, `types`, `categories`, `roles`, `venues`, `Access`-Modi) generiert.
- **Synchroner UI- & Rückgabe-Effekt:** Ein einziger Aufruf von `executeTool("filter_catalog", { query, tags, year })` aktualisiert synchron die sichtbare Filter-UI für den menschlichen Besucher (inklusive `<mark>`-Highlighting und Zähler-Badges) und liefert dem Agenten sofort das JSON-Array der sichtbaren Einträge (`title`, `url`, `tags`, `summary`) zurück.

### Oberfläche 3: Slide-Deck-Inspektion & Folien-Navigation (`SlideDeck.astro`)
- **`search_slide_deck` (`readOnlyHint: true`):** Durchsucht das bereits im DOM eingebettete `#slides-meta`-JSON-Manifest nach Folientiteln, Archetypen, Sprechernotizen (`voiceover`) und Literaturreferenzen (`references`) und gibt passende Folienindizes zurück.
- **`navigate_to_slide` (`readOnlyHint: false`, `consequentialHint: false`):** Steuert `window.__revealDeck.slide(index)` sowie optional `window.audioSync` direkt an, sodass ein kooperativer Browser- oder Coding-Agent während einer Vorlesung oder eines Reviews gezielt auf eine angefragte Architektur-Folie springen kann.

---

## 4. Verifikations- & Teststrategie via `chrome-devtools-mcp`

1. **Statische Typ- & Architektur-Gates:**  
   Zentrale WebIDL-Typdefinitionen in `src/commons/client/webmcp-types.ts` (importiert über `@commons/client/webmcp-types`), geprüft durch `npm run typecheck` und `npm run lint`.
2. **End-to-End CDP-Verifikation (`chrome-devtools-mcp`):**  
   Verifikation sowohl über den experimentellen Flag `--categoryExperimentalWebmcp=true` (`list_webmcp_tools`, `execute_webmcp_tool`) als auch über universelle `evaluate_script`-Aufrufe (`await document.modelContext.getTools()` und `await document.modelContext.executeTool(tool, input)`).

---

## 5. Akzeptanzkriterien

- **0 Bytes Zusatz-Bundle für Standard-Besucher ohne WebMCP:** Reine Progressive-Enhancement-Weiche (`if (typeof document !== 'undefined' && document.modelContext)`).
- **100 % W3C-Spezifikationskonformität:** Einhaltung von JSON Schema Draft 2020-12, `ToolAnnotations`, `AbortSignal`-Bereinigung und `DOMException`-Fehlerbehandlung.
- **Bestehen aller Master-Verification-Gates:** `npm run verify` läuft mit 0 Fehlern und 0 Warnungen durch.
