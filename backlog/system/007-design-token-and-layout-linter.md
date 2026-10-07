# SYSTEM-007: Automatisierter Design-Token- & Layout-Boundary-Linter

- **ID:** `SYSTEM-007`
- **Domäne:** `ci-cd` / `quality-assurance`
- **Status:** `proposed`
- **Priorität / Hebel:** `MITTEL`
- **Ursprung:** Session 2026-10-07 (Prävention von Margin-Collisions und Ad-hoc-Styling)

---

## 1. Problem & Motivation

1. **Ad-hoc Inline-Styles und HTML-Fragmente in Content-Markdown:**  
   Bei der Erstellung von Markdown-Beiträgen (`src/content/**/*.md`) schleichen sich vereinzelt rohe HTML-Tags (`<div>`, `<p>`, `<span>`) mit Utility-Klassen oder Inline-Styles ein. Dies bricht die semantische Trennung zwischen Inhalt und Layout und umgeht die zentral gepflegte Typografie (`.prose-custom`).
2. **JIT-Pixel-Escapes in Templates:**  
   In Astro-Templates (`src/pages/`, `src/components/`) werden gelegentlich willkürliche Pixelwerte (z. B. `text-[17px]`, `mb-[35px]`, `w-[342px]`) eingesetzt, statt das definierte Tailwind-Design-Token-Raster (`mb-8`, `mb-10`, `text-lg` etc.) zu respektieren. Dies führt zu visuellem Rauschen und erschwert konsistente Responsive-Layouts.
3. **Margin-Collisions an Layout-Grenzen:**  
   Wenn Kind-Elemente oder Absätze am Ende eines Containers oder einer Sektion mit großen unteren Außenabständen (`mb-12`, `mb-16`, `mb-20`) versehen sind, addieren sich diese zu den Container-Paddings (`py-16`, `pb-20`). Das Resultat sind asymmetrische Weißräume und inkonsistente Abstände zwischen Sektionen.
4. **Iterative Nacharbeit:**  
   Bislang müssen solche Layout- und Styling-Defekte im manuellen Review oder Browser-Check aufgedeckt und korrigiert werden. Ein automatisiertes Gate verhindert dies deterministisch vor dem Merge.

---

## 2. Zielsetzung

Entwicklung eines schlanken, performanten CLI-Linters (`src/scripts/validate-design-tokens.ts`), der als npm-Script (`npm run validate:design-tokens`) bereitsteht und im Master-Verification-Gate (`npm run verify`) fest verankert wird. Der Linter erzwingt eine strikte 3-Punkte-Regel-Architektur.

---

## 3. 3-Punkte-Regel-Architektur

### Regel 1: Semantische Markdown-Integrität (`src/content/**/*.md`)
- **Vorgabe:** In Standard-Markdown-Dateien (`.md`) ist reines semantisches Markdown vorgeschrieben.
- **Verbot:** Keine HTML-Elemente mit Utility-Klassen (z. B. `<div class="...">`) oder Inline-Styles (`style="..."`).
- **Typografie:** Die Typografie und Abstände werden ausschließlich zentral über das Layout und `.prose-custom` geregelt.
- **Ausnahme:** MDX-Präsentationsfolien (`src/content/presentations/**/*.mdx` bzw. Folien-Templates), die für Layout-Archetypen explizite Komponenten und Hilfsklassen erfordern.

### Regel 2: Strikte Design-Token-Disziplin in Astro-Templates (`src/pages/`, `src/components/`)
- **Vorgabe:** Strikte Nutzung des Tailwind-Design-Token-Rasters für Typografie, Spacing, Radien und Farben.
- **Verbot:** Keine willkürlichen JIT-Pixel-Escapes (z. B. Regex-Pattern `/(text|m[trblxy]?|p[trblxy]?|gap|w|h|max-w)-\[\d+px\]/`).
- **Erlaubte Ausnahmen:** Nur gezielt annotierte Ausnahmen (z. B. `/* token-lint-disable */`) für SVG-Canvas-Dimensionen oder hochspezifische D3-/WebGL-Container.

### Regel 3: Layout-Boundary- & Trailing-Margin-Check (`dist/` via Cheerio)
- **Vorgabe:** Container und Sektionen definieren ihre Abstände nach außen und innen über konsistente Paddings/Gaps.
- **Verbot:** Keine überflüssigen Trailing-Margins an Layout-Grenzen. Das letzte Kind-Element (`:last-child`) innerhalb eines Containers, einer Section oder eines Content-Blocks darf keine massiven unteren Außenabstände besitzen (z. B. `mb-12`, `mb-16`, `mb-20`).
- **Prüfung:** Post-Build-Analyse der gerenderten HTML-Artefakte im Build-Verzeichnis (`dist/**/*.html`) mittels `cheerio`.

---

## 4. Technische Spezifikation (`src/scripts/validate-design-tokens.ts`)

```typescript
/**
 * src/scripts/validate-design-tokens.ts
 *
 * Prüfarchitektur:
 * 1. Markdown Scan:
 *    - Liest alle .md-Dateien in src/content/ (außer Präsentationen).
 *    - Meldet Fundstellen von `<div class=` oder `style=`.
 * 2. Template Scan:
 *    - Liest alle .astro-Dateien in src/pages/ und src/components/.
 *    - Identifiziert JIT-Klassen der Form `*-[\d+px]`.
 * 3. Layout Boundary Scan (Post-Build / dist-Prüfung):
 *    - Lädt HTML-Seiten aus dist/ via cheerio.
 *    - Sucht nach `section > :last-child` oder `main > :last-child` mit `mb-12`, `mb-16`, `mb-20`.
 *
 * Exit-Code: 0 bei Erfolg, 1 bei Regelverletzungen mit detailliertem Report.
 */
```

### Integration in den Build-Lifecycle
- Script-Befehl in `package.json`: `"validate:design-tokens": "tsx src/scripts/validate-design-tokens.ts"`
- Integration in `npm run verify` vor oder nach dem SSG-Build (Regel 1 & 2 pre-build, Regel 3 post-build oder integriert in `postbuild`).

---

## 5. Erwarteter Nutzen & Akzeptanzkriterien

- **0 % Margin-Collisions:** Keine unvorhergesehenen asymmetrischen Weißräume an Sektionsenden.
- **Design-Konsistenz:** Vollständige Einhaltung des Tailwind-Spacing- und Typografie-Rasters.
- **Saubere Markdown-Trennung:** Reiner Content bleibt entkoppelt von Frontend-Implementierungsdetails.
- **Deterministische CI-Sicherheit:** Lokale und automatisierte Verifikation via `npm run verify` schlägt fehl, sobald JIT-Escapes oder unzulässige Margins eingeführt werden.
