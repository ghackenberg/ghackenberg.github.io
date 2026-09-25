# Presentation & Slide-as-Code Guidelines

Dieses Dokument definiert die verbindlichen architektonischen, typografischen und akustischen Standards für alle Präsentationen, Talks und Keynotes in `src/content/presentations/`.

---

## 1. Repository-Struktur & Slide-Bundle

Jede Präsentation liegt in einem eigenen Unterverzeichnis:
```text
src/content/presentations/[YYYY_MM_DD_slug]/
├── index.md                 <-- Metadaten (title, pubDate, lang, description, tags, etc.)
├── preview.jpg              <-- 16:9 Vorschau-Bild (Beamer/Präsentations-Szene)
├── slides-dark.pdf          <-- Generiertes Handout (Dark Mode)
├── slides-light.pdf         <-- Generiertes Handout (Light Mode)
├── slides/                  <-- Autonome Slide-Dateien (.mdx)
│   ├── 01_titelfolie.mdx
│   ├── 02_agenda.mdx
│   └── ...
├── audio/                   <-- Generierte TTS-Audiodateien & Cue-Timings
│   ├── 01_titelfolie.mp3
│   ├── 01_titelfolie.cues.json
│   └── .cache.json
└── thumbnails/              <-- Generierte WebP-Folien-Thumbnails
```

### Autonomes Slide-Bundle Requirement
Jede Folie (`.mdx`) ist ein eigenständiges Modul und **muss** definieren:
- `title`: Prägnanter Folientitel
- `subtitle`: Kontextualisierende Unterzeile (mit mind. einem `{cue:hl-...}`)
- `number`: Foliennummer als String (z. B. `"01"`, `"02"`)
- `slideLayout`: Layout-Archetyp (`title`, `split`, `pipeline`, `grid`, `metric`, `code`)
- `voiceover`: Natürlicher Sprechtext mit eingebetteten `{cue:id}`- und `{cue:hl-id}...{/cue}`-Tags
- `notes`: Sprechernotizen und Zeitmarken für die Presenter-Konsole (`S`-Taste)
- Body: Deklaratives Markup aus den 6 Master-Archetypen und Standard-Primitiven.

---

## 2. Typografie & 1920x1080 Vektor-Canvas

Slides rendern auf einer virtuellen **1920x1080** Vektorbühne, die auf Laptops/Desktops um ~50 % herunterskaliert wird. Web-Standard-Größen (`text-xs`, `text-sm`, `text-base`) sind unlesbar und strikt verboten!

### Verbindliche Mindestgrößen:
- **Slide Title (`h1`)**: 56px–64px (`leading-[1.12]`)
- **Card Headings (`h3`, `h4`)**: 32px–38px
- **Body Text & Bullets (`p`, `li`)**: **24px–28px** (`leading-relaxed`)
- **Footnotes & Metadaten**: 18px–21px (absolutes Minimum)

### Keine Ad-Hoc-Layouts:
- **NIEMALS** freie verschachtelte `<div>`-Konstrukte mit manuellen Pixel-Margins oder Emojis bauen.
- **IMMER** die 6 Master-Archetypen und Primitiven nutzen: `<BentoCard>`, `<CalloutBox>`, `<BulletList>`, `<MetricStat>`, `<Pipeline>`, `<BarChart>`.
- Balkendiagramme immer über `<BarChart items={[...]} />` einbinden (Skalierung und Nulllinie werden dynamisch berechnet).

---

## 3. Die 6 Master Slide-Archetypen

### 1. Title Slide (`<TitleSlide />`)
Klassisches Eröffnungs-Layout mit Sprecher-, Rollen- und Institutsangaben.
```mdx
import TitleSlide from '../../../../components/slides/layouts/TitleSlide.astro';

<TitleSlide
  title={frontmatter.title}
  subtitle={frontmatter.subtitle}
  slideNumber="01"
  totalSlides="21"
  speaker="Dr. Georg Hackenberg"
  role="Professor für Informatik & Industriesysteme"
  affiliation="FH Oberösterreich · Campus Wels"
  date="Oktober 2026"
  website="https://hackenberg.tech"
/>
```

### 2. Split Slide (`<SplitSlide />`)
Zwei-Spalten-Layout (50/50 oder 40/60) für Gegenüberstellungen, Vorher/Nachher oder Problem/Lösung.
```mdx
import SplitSlide from '../../../../components/slides/layouts/SplitSlide.astro';
import BentoCard from '../../../../components/slides/primitives/BentoCard.astro';
import CalloutBox from '../../../../components/slides/primitives/CalloutBox.astro';
import BulletList from '../../../../components/slides/primitives/BulletList.astro';

<SplitSlide title={frontmatter.title} subtitle={frontmatter.subtitle} slideNumber="03" totalSlides="21">
  <BentoCard slot="left" cue="col-problem" title="Problemstellung" accent="neutral">
    <CalloutBox type="quote">
      „Proprietäre Silos {cue:hl-quote}verhindern echten Fortschritt{/cue}.“
    </CalloutBox>
    <BulletList items={[
      { icon: "cross", title: "Vendor-Lock-in", desc: "Geschlossene Software bricht {cue:hl-lockin}Interoperabilität{/cue}." }
    ]} />
  </BentoCard>

  <BentoCard slot="right" cue="col-loesung" title="Lösungsansatz" accent="blue">
    <CalloutBox type="statement" title="Architektur-Prinzip">
      Offene Standards und {cue:hl-offen}funktionierender Code{/cue}.
    </CalloutBox>
    <BulletList items={[
      { icon: "check", title: "Datenhoheit", desc: "Volle Kontrolle über {cue:hl-daten}eigene Datenmodelle{/cue}." }
    ]} />
  </BentoCard>
</SplitSlide>
```

### 3. Pipeline Slide (`<PipelineSlide />`)
Horizontale oder vertikale Schrittabfolgen für Agenden, Phasen oder Architekturen.
```mdx
import PipelineSlide from '../../../../components/slides/layouts/PipelineSlide.astro';
import Pipeline from '../../../../components/slides/primitives/Pipeline.astro';

<PipelineSlide title={frontmatter.title} subtitle={frontmatter.subtitle} slideNumber="02" totalSlides="21">
  <Pipeline steps={[
    { cue: "step-01", num: "01", title: "Analyse", desc: "Erfassung der {cue:hl-step-01}Ist-Situation{/cue}.", accent: "blue" },
    { cue: "step-02", num: "02", title: "Architektur", desc: "Entwurf {cue:hl-step-02}modularer Pipelines{/cue}.", accent: "teal" }
  ]} />
</PipelineSlide>
```

### 4. Grid Slide (`<GridSlide />`)
2x2-Quadranten oder 3-Spalten-Layout für Taxonomien, Pillar-Overviews und Begriffsabgrenzungen.
```mdx
import GridSlide from '../../../../components/slides/layouts/GridSlide.astro';
import BentoCard from '../../../../components/slides/primitives/BentoCard.astro';

<GridSlide title={frontmatter.title} subtitle={frontmatter.subtitle} slideNumber="05" totalSlides="21" cols={2}>
  <BentoCard cue="box-1" title="Säule 1" accent="blue">
    <p>Inhalte mit {cue:hl-box1}klarem Fokus{/cue}.</p>
  </BentoCard>
  <BentoCard cue="box-2" title="Säule 2" accent="cyan">
    <p>Inhalte mit {cue:hl-box2}hoher Tiefe{/cue}.</p>
  </BentoCard>
</GridSlide>
```

### 5. Metric Hero Slide (`<SplitSlide ratio="40/60" />`)
Große numerische Kennzahl links, strategische Konsequenzen rechts.
```mdx
import SplitSlide from '../../../../components/slides/layouts/SplitSlide.astro';
import MetricStat from '../../../../components/slides/primitives/MetricStat.astro';
import BentoCard from '../../../../components/slides/primitives/BentoCard.astro';
import BulletList from '../../../../components/slides/primitives/BulletList.astro';

<SplitSlide title={frontmatter.title} subtitle={frontmatter.subtitle} ratio="40/60">
  <MetricStat slot="left" cue="stat-kpi" value="64" unit="%" label="Zero-Click Suchanfragen" color="blue" />
  <BentoCard slot="right" cue="card-takeaways" title="Strategische Konsequenz" accent="cyan">
    <BulletList items={[
      { icon: "target", title: "Fokus Zitation", desc: "Optimierung auf {cue:hl-zitation}semantische Nennung{/cue}." }
    ]} />
  </BentoCard>
</SplitSlide>
```

### 6. Code Slide (`<CodeSlide />`)
Code-Syntax-Container links (`col-span-7`), Erläuterungen und Takeaways rechts (`col-span-5`).

---

## 4. Akustische Cue-Synchronisation & Voiceover-Regeln

### Das „Title-Hook-Protokoll“ (Zwei-Phasen-Voiceover)
Wenn eine Folie eingeblendet wird, sind alle Inhaltskarten abgedunkelt:
1. **Phase 1: Orientierung (0–4s, Pre-Cue):**  
   Das Voiceover **muss** mit 1–2 orientierenden Sätzen (12–20 Wörter, ~3–5 Sekunden) beginnen, die Titel und Unterzeile verbal einführen, **bevor** der erste Inhalts-Cue feuert.
2. **Phase 2: Progressive Cues:**  
   Karten, Schritte und Textmarker werden sequentiell und synchron zum gesprochenen Text enthüllt.

### Die 5-Punkte-Checkliste vor dem Speichern (Strikte Fehlervermeidung):
1. **Highlight-Pflicht:** Jeder Bullet-Punkt (`desc`) und jede `CalloutBox` **muss** mind. ein `{cue:hl-...}` enthalten.
2. **Monotone Reihenfolge:** Cues im Voiceover **müssen exakt** der visuellen DOM-Reihenfolge (links $\rightarrow$ rechts, oben $\rightarrow$ unten) folgen.
3. **Keine schließenden Tags bei Struktur-Cues:** Struktur-Tags (`col-`, `box-`, `card-`, `step-`, `stat-`) sind Punkt-Cues und dürfen **kein** `{/cue}` haben. Nur Inline-Highlights (`hl-*`) werden geschlossen.
4. **TitleSlide-Reihenfolge:** `title-main` $\rightarrow$ `title-sub` $\rightarrow$ `{cue:hl-...}` $\rightarrow$ `title-speaker`.
5. **Title-Hook vor erstem Cue:** Niemals im ersten Satz direkt einen Inhalts-Cue feuern.

---

## 5. Zentrales Aussprache- & Akronym-Lexikon (`tts-lexicon.json`)

Liegt in `src/content/presentations/tts-lexicon.json`:
- `acronyms`: Buchstabierte Abkürzungen mit Bindestrich (z. B. `"RAG": "R-A-G"`, `"MCP": "M-C-P"`, `"TYPO3": "Teipo-Drei"`).
- `phonetics`: Lautschrift für englische Lehnwörter (z. B. `"Zero-Click": "Siero-Klick"`, `"Knowledge Graph": "Nolledsch Graf"`).
- **Sauberes Markdown:** Das `voiceover` im Frontmatter bleibt orthografisch sauberes Standarddeutsch; die Lautschrift wird erst zur Synthese dynamisch injiziert.

---

## 6. Pipeline-Step Illustrationen (`Pipeline.astro`)

- **Stil:** Pixar/Disney Comic-Illustration, Cel Shading, schwarze Vektor-Outlines.
- **Format:** 1:1 quadratisch (`AspectRatio: "1:1"`), randlos (Full-Bleed).
- **Motiv-Safe-Zone:** Das Hauptmotiv füllt ~60–66 % der Bildmitte; Außenbereiche frei für dynamisches `object-cover`.
- **Hintergrund:** Lebendiger Blau-Violett/Indigo-Nebel mit Sternenstaub (funktioniert in Dark- und Light-Mode).
- **Keine Personen:** Pipeline-Karten zeigen Werkzeuge, Konzepte oder Symbole – Dr. Georg Hackenberg erscheint hier nicht.
