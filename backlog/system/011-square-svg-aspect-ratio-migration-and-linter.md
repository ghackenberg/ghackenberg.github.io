# SYSTEM-011: Quadratisches SVG-Standardformat, Bestands-Migration & Aspect-Ratio-Linter

- **ID:** `SYSTEM-011`
- **Kategorie / Domäne:** `Visual Design / CI / QA`
- **Status:** `proposed`
- **Priorität / Hebel:** `Mittel` (Hohe UX-Wirkung auf Mobilgeräten, aber manueller/gestalterischer Umbauaufwand für die ~90 bestehenden Bestands-SVGs)
- **Erstellt am:** `2026-11-05`
- **Ursprung:** Session 2026-11-05 (Mobile-Readability-Audit technischer SVG-Architekturdiagramme und Einführung des `640×640`-Quadratformats)

---

## 1. Problem & Motivation

1. **Unlesbare Mikro-Typografie auf mobilen Hochformat-Viewports durch breite Querformat-Leinwände:**  
   Bisherige technische SVG-Illustrationen in `src/content/` nutzten überwiegend breite Querformat-Leinwände wie `viewBox="0 0 880 340"` (Seitenverhältnis $\approx 2{,}59:1$), `viewBox="0 0 880 380"` ($\approx 2{,}32:1$) oder `viewBox="0 0 960 420"` ($\approx 2{,}29:1$). Während diese Diagramme auf breiten Desktop-Monitoren innerhalb der Artikelspalte gut lesbar sind, werden sie auf Smartphones im Hochformat (`375px`–`393px` Viewport-Breite, abzüglich horizontalem Seiten-Padding effektiv $\approx 340\text{px}$ Container-Breite) proportional über `width="100%"` und `height="auto"` um den **Faktor $2{,}5\times$ bis $2{,}8\times$ herunterskaliert**.
   - Eine nominelle SVG-Schriftgröße von `11px`–`12px` schrumpft dadurch auf dem Smartphone-Display effektiv auf **unlesbare `4px`–`5px` Bildschirmgröße**.
   - Gleichzeitig schrumpft die effektive Darstellungsfläche eines `880×340`-Diagramms auf einem Smartphone auf eine flache, kaum entzifferbare Leiste von rund `340×131px`.

2. **Warum ein rein automatisiertes Skript-Refactoring bestehender Querformat-Diagramme ausscheidet:**  
   Eine mechanische Transformation per Skript (z. B. bloßes Überschreiben des `viewBox`-Attributs auf `0 0 640 640` oder uniforme Skalierung) ist **nicht sinnvoll möglich**:
   - Horizontale Links-nach-Rechts-Pipelines (3–5 Spalten nebeneinander), orthogonale Verbindungspfeile (`<path d="M ... H ... V ...">`) und hartcodierte $(x, y)$-Koordinatensysteme würden bei einer bloßen `viewBox`-Verengung rechtsseitig abgeschnitten (`x > 640`) oder bei einer globalen `scale()`-Stauchung weiterhin exakt denselben Schrumpfungsfaktor für die Typografie erleiden.
   - Jedes Diagramm muss daher **topologisch neu komponiert** werden: von einer einzeiligen horizontalen Links-Rechts-Kette hin zu einer mehrstufigen **vertikalen Stapelung (Top-to-Bottom-Flow)**, einer **Zickzack-/Serpentinen-Pipeline** oder einem **$2\times 2$-Quadranten-Grid** auf einer quadratischen Leinwand (`viewBox="0 0 640 640"`).

3. **Fehlende deterministische Absicherung von Seitenverhältnis und Mindest-Schriftgrößen im CI-Gate:**  
   Obwohl [`src/scripts/lint-svgs.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/lint-svgs.ts) bereits den verpflichtenden Design-Token-Import (`@import url('/styles/graphics.css')`), das Verbot hartcodierter Hex-Farben sowie horizontale `<text>`-Überläufe gegen umschließende `<rect>`-Karten und die `viewBox`-Grenzen verifiziert, prüft der Linter derzeit weder das **`viewBox`-Seitenverhältnis ($W / H$)** noch eine **verbindliche Mindest-Schriftgröße (`font-size`)**. Ohne ein solches Linter-Gate droht bei künftigen Autoren- oder Subagenten-Läufen ein unbeabsichtigter Rückfall in breite Querformat-Geometrien.

---

## 2. Bereits umgesetzter Vorab-Standard (ab 2026-11-05)

Als sofortige Vorwärts-Konvention wurden am `2026-11-05` bereits folgende Grundlagen geschaffen:

1. **Pilot-Umstellung der 6 aktuellen Blogposts (`2026_10_25_...` bis `2026_11_05_...`):**  
   Sämtliche Architektur- und Pipeline-SVGs der sechs neuesten Artikel in `src/content/posts/` wurden bereits als eigenständige `.svg`-Dateien im quadratischen Standardformat `viewBox="0 0 640 640"` ($1:1$) mit vergrößerter Basistypografie (`12px`–`16px`) und mehrstufiger vertikaler bzw. Quadranten-Topologie umgesetzt.
2. **Aktualisierung der Autoren-Richtlinien in [`.agents/skills/svg-graphics/SKILL.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/svg-graphics/SKILL.md):**  
   Der Skill für deterministische Vektorgrafiken gibt für neue Diagramme bereits das quadratische Format (`viewBox="0 0 640 640"`) sowie eigenständige `.svg`-Dateien (keine rohen Inline-`<svg>`-Blöcke in Markdown) vor.

Bei einer Container-Breite von `340px` auf Mobilgeräten beträgt der Skalierungsfaktor für ein `640×640`-Diagramm nur noch $\approx 1{,}88\times$ (statt $2{,}59\times$ bis $2{,}82\times$), während die vertikale Zeichenhöhe von `340px` auf volle `640px` (+88 %) anwächst. In Kombination mit einer auf `12px`–`16px` angehobenen Basisschriftgröße bleiben alle Knotenbeschriftungen auch im mobilen Hochformat ohne manuelles Pinch-to-Zoom unmittelbar lesbar.

---

## 3. Vorgeschlagene Architektur & Umfang von `SYSTEM-011`

Das Vorhaben gliedert sich in zwei eng verzahnte Arbeitspakete für künftige Sessions:

### 3.1 Arbeitspaket 1: Bestands-Inventur & Wellen-Migration (~90 Legacy-SVGs)

Schrittweise manuelle bzw. agentengestützte Neugestaltung (via Subagent-Orchestrierung gemäß [`.agents/skills/agent-orchestration/SKILL.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/.agents/skills/agent-orchestration/SKILL.md)) der rund **90 bestehenden Querformat-SVGs** in älteren Blogposts, Projekten, Services und Kursen auf ein quadratisches (`viewBox="0 0 640 640"`) oder nahezu quadratisches Seitenverhältnis ($\text{Aspect Ratio } W / H \in [0{,}85, 1{,}25]$).

#### Topologische Transformationsmuster (Querformat $\rightarrow$ Quadrat `640×640`)

| Bisheriger Querformat-Archetyp (`880×340` / `960×420`) | Neues quadratisches Ziel-Layout (`640×640`) | Typografische Mindeststandards |
| :--- | :--- | :--- |
| **4–5-stufige horizontale Pipeline** (Links $\rightarrow$ Rechts) | **2×2-Quadranten-Grid (U-Flow / S-Flow)** oder **3-Ebenen-Vertikalstapel** (Top $\rightarrow$ Bottom mit Rückkopplungspfad am Seitenrand) | Haupttitel: `15px`–`16px` (`font-weight="700"`), Knotentitel: `13px`–`14px`, Subtext/Metriken: `11px`–`12px` |
| **Drei-Spalten-Architekturvergleich** | **Drei gestapelte horizontale Schichten (Swimlanes)** über die volle Breite (`x=32` bis `x=608`, je `height=150px`–`165px`) | Swimlane-Header: `13px`–`14px` Uppercase, Karten-Labels: `12px`–`13px` |
| **Zentraler Hub mit links/rechts ausstrahlenden Satelliten** | **Symmetrischer Radial-/Kompass-Hub** im Zentrum (`cx=320, cy=330`) mit Satellitenknoten in den vier Eck-Quadranten | Zentrum-Label: `14px`–`15px`, Satelliten-Labels: `12px`–`13px`, Badges: $\ge 11\text{px}$ |

#### Geplante Migrations-Wellen (Iterative Abarbeitung)

1. **Welle 1 — Neuere Blogposts (`src/content/posts/2026_03_*` bis `2026_10_24_*`):**  
   Höchste Sichtbarkeit im Blog-Katalog und auf Social-/Search-Landingpages; Umstellung aller verbleibenden `880×340`- und `800×420`-Diagramme auf `640×640`.
2. **Welle 2 — Ältere Blogposts & Architektur-Serien (`src/content/posts/2025_*` bis `2026_02_*`):**  
   Konsolidierung älterer Diagramme inklusive etwaiger noch eingebetteter Inline-SVGs in eigenständige `.svg`-Dateien.
3. **Welle 3 — Projekte, Services & Kurse (`src/content/projects/`, `src/content/services/`, `src/content/courses/`):**  
   Migration der Systemarchitektur-Schaubilder in Portfolio-Case-Studies, B2B-Service-Beschreibungen und Vorlesungsunterlagen (unter Berücksichtigung von Folien-Spezialformaten in `presentations/`).

---

### 3.2 Arbeitspaket 2: Erweiterung von `src/scripts/lint-svgs.ts` (Aspect-Ratio & Mindest-Schriftgrößen-Gate)

Erweiterung des bestehenden SVG-Linters [`src/scripts/lint-svgs.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/lint-svgs.ts) um zwei deterministische Geometrie- und Typografie-Prüfungen:

1. **`viewBox`-Präsenz & Seitenverhältnis-Prüfung (`lintSvgAspectRatio`):**
   - Jedes geprüfte `<svg>`-Wurzelelement muss ein gültiges, 4-teiliges `viewBox="minX minY width height"`-Attribut besitzen.
   - Das Seitenverhältnis $\text{ratio} = \frac{\text{width}}{\text{height}}$ muss im Korridor **$0{,}85 \le \frac{W}{H} \le 1{,}25$** liegen (Optimum und Standard: $640 / 640 = 1{,}00$).
   - Überschreitet ein Diagramm $\frac{W}{H} > 1{,}25$ (typisches Querformat) oder unterschreitet es $0{,}85$ (überstrecktes Hochformat), meldet `npm run lint:svgs` einen präzisen CI-Fehler mit aktuellem Verhältnis und Ziel-Vorgabe (`viewBox="0 0 640 640"`).

2. **Mindest-Schriftgrößen-Prüfung (`lintSvgMinFontSize`):**
   - Für jedes sichtbare `<text>`- und `<tspan>`-Element (außerhalb von `<defs>`, `<clipPath>`, `<mask>`, `<symbol>`) wird die effektive `font-size` über die bestehende Helferfunktion `getInheritedAttr($, textEl, 'font-size')` bzw. aus Inline-`style`-Deklarationen ermittelt.
   - Unterschreitet die numerische Schriftgröße den Schwellenwert **`MIN_FONT_SIZE_PX = 11`** (für neue/migrierte `640×640`-Diagramme; Empfehlung `12px`–`16px`), wird ein Linter-Fehler ausgelöst.

3. **Zweistufiger Rollout-Mechanismus (Stichtags-Regel / Legacy-Allowlist $\rightarrow$ Globales Zero-Tolerance-Gate):**
   - **Phase A (Während der laufenden Wellen-Migration):**  
     Einführung einer expliziten Stichtags-Erkennung (alle Posts ab `2026_10_25_*` unterliegen sofort dem strikten Gate) kombiniert mit einer expliziten, monoton schrumpfenden `LEGACY_WIDE_SVG_ALLOWLIST` für Bestandsdateien vor dem `2026-10-25`. Wird eine Datei auf der Allowlist bereits auf $\frac{W}{H} \le 1{,}25$ migriert, gibt der Linter einen Hinweis aus, den veralteten Allowlist-Eintrag zu entfernen.
   - **Phase B (Nach Abschluss von Welle 1–3):**  
     Vollständige Entfernung der `LEGACY_WIDE_SVG_ALLOWLIST`; die Regel $0{,}85 \le \frac{W}{H} \le 1{,}25$ und `font-size >= 11px` gilt als globales Zero-Tolerance-Gate für alle Content-SVGs in [`npm run verify`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/package.json).

#### Entwurf der Linter-Erweiterung in `src/scripts/lint-svgs.ts`

```typescript
const MIN_ASPECT_RATIO = 0.85;
const MAX_ASPECT_RATIO = 1.25;
const MIN_FONT_SIZE_PX = 11;

function lintSvgAspectRatioAndTypography(
  relPath: string,
  $: cheerio.CheerioAPI,
  isLegacyAllowed: boolean
): void {
  const $svg = $('svg').first();
  if ($svg.length === 0) return;

  const viewBoxAttr = $svg.attr('viewBox')?.trim();
  if (!viewBoxAttr) {
    recordError(relPath, 'Root <svg> is missing a mandatory viewBox attribute (expected e.g. viewBox="0 0 640 640").', 'svg');
    return;
  }

  const parts = viewBoxAttr.split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n)) || parts[2] <= 0 || parts[3] <= 0) {
    recordError(relPath, `Invalid viewBox="${viewBoxAttr}". Expected 4 positive numbers.`, 'svg');
    return;
  }

  const [, , width, height] = parts;
  const aspectRatio = width / height;

  if (!isLegacyAllowed && (aspectRatio < MIN_ASPECT_RATIO || aspectRatio > MAX_ASPECT_RATIO)) {
    recordError(
      relPath,
      `SVG aspect ratio W/H = ${aspectRatio.toFixed(2)} (${width}x${height}) violates square mobile-readability bounds [${MIN_ASPECT_RATIO}, ${MAX_ASPECT_RATIO}]. Use standard viewBox="0 0 640 640".`,
      'svg'
    );
  }

  if (!isLegacyAllowed) {
    $('text, tspan').each((_, el) => {
      if (!('tagName' in el)) return;
      const textEl = el as Element;
      if (isInsideSkippedContainer(textEl)) return;
      const rawText = $(textEl).text().trim();
      if (!rawText) return;

      const fontSizeStr = getInheritedAttr($, textEl, 'font-size') || '12';
      const fontSize = parseFloat(fontSizeStr);
      if (!Number.isNaN(fontSize) && fontSize < MIN_FONT_SIZE_PX) {
        recordError(
          relPath,
          `<${textEl.tagName}> "${rawText.slice(0, 32)}" uses font-size="${fontSize}px" below mobile minimum (${MIN_FONT_SIZE_PX}px). Use 12px–16px on a 640x640 canvas.`,
          textEl.tagName
        );
      }
    });
  }
}
```

---

## 4. Offene Design-Entscheidungen & Klärungspunkte (`/grill-me` vor Implementierung)

Vor dem Start der flächendeckenden Bestands-Migration und Linter-Scharfschaltung sind folgende Punkte abzustimmen:

- [ ] **Q1 (Behandlung von `presentations/` und `talks/` im Aspect-Ratio-Linter):**  
  Präsentationsfolien in `src/content/presentations/` werden im `16:9`-Widescreen-Bühnenformat gerendert. Sollen eigenständige `.svg`-Diagramme innerhalb von `presentations/` ebenfalls dem quadratischen Standard ($\frac{W}{H} \in [0{,}85, 1{,}25]$, z. B. für einspaltige oder zweispaltige Folien-Slots) folgen oder für Vollbild-Folien ein eigenes Widescreen-Profil erlauben?
- [ ] **Q2 (Steuerung der Übergangsphase — Stichtags-Regel vs. explizites Allowlist-Manifest):**  
  Soll [`src/scripts/lint-svgs.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/lint-svgs.ts) während der Wellen-Migration über einen Datums-Präfix-Filter (`>= 2026_10_25`) plus eine explizite JSON-/Set-Allowlist für bereits migrierte ältere Verzeichnisse gesteuert werden, damit jede abgeschlossene Migrations-Welle sofort gegen Regressionen verriegelt ist?
- [ ] **Q3 (Maximale Darstellungsbreite quadratischer SVGs auf großen Desktop-Viewports):**  
  Ein `640×640`-SVG nimmt bei `width: 100%` in einer `760px`–`840px` breiten Desktop-Artikelspalte auch vertikal `760px`–`840px` Raum ein. Soll für quadratische Artikel-SVGs in Desktop-Ansichten eine dezente CSS-Obergrenze (z. B. `max-width: 640px; margin-inline: auto;`) gelten, damit die Textgröße bei 1:1 (`100%` von `640px`) scharf und unvergrößert bleibt, während auf Mobilgeräten weiterhin die volle Container-Breite genutzt wird?

---

## 5. Erwarteter Nutzen & Akzeptanzkriterien

- **Erstklassige Mobile-UX ohne Pinch-to-Zoom:** Alle technischen Architektur- und Pipeline-SVGs bleiben auf Smartphones (`375px`–`393px` Viewport) mit einer effektiven Mindest-Darstellungsgröße der Schriften von $\ge 6{,}5\text{px}$–$8{,}5\text{px}$ (statt bisher $4\text{px}$–$5\text{px}$) unmittelbar lesbar.
- **Deterministischer Schutz vor Querformat-Regressionen:** [`src/scripts/lint-svgs.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/lint-svgs.ts) blockiert neue SVGs mit $\frac{W}{H} > 1{,}25$ oder `font-size < 11px` automatisch innerhalb von `npm run verify`.
- **Vollständige Bestands-Harmonie:** Nach Abschluss der drei Migrations-Wellen nutzen sämtliche technischen Diagramme in `src/content/` einheitlich das quadratische `640×640`-Koordinatensystem, zentrale CSS-Design-Tokens (`/styles/graphics.css`) und geprüfte Text-Bounding-Boxen.
