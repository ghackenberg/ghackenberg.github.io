# TOOL-001: Slide-Engine MCP (Deterministisches Slide-Scaffolding & Cue-Linting)

- **ID:** `TOOL-001`
- **Domäne:** `presentations` / `slide-as-code`
- **Status:** `proposed`
- **Priorität / Hebel:** `HOCH`
- **Ursprung:** Session 2026-09-25 (80 Cue-Lint-Fehler bei Folienüberarbeitung)

---

## 1. Problem & Reibungspunkt

1. **Hohe Fehleranfälligkeit bei manueller Folienerstellung:**  
   Beim Erstellen von `.mdx`-Folien muss der Agent manuell sicherstellen, dass:
   - Jeder Bullet-Punkt (`desc`) und jede `CalloutBox` ein `{cue:hl-...}`-Tag enthält.
   - Die Cues im `voiceover` exakt in der Reihenfolge ihres Auftretens im DOM/JSX vorkommen.
   - Struktur-Cues keine schließenden Tags haben.
   - Die `TitleSlide` die 4 Pflicht-Cues in Reihe enthält.
2. **Token-Waste im Debug-Loop:**  
   Wenn eine Folie gegen diese Regeln verstößt, schlägt der Linter fehl. Der Agent muss die Fehlermeldungen parsen, Dateien erneut öffnen und korrigieren. Dies führte in der Vergangenheit zu über 20 iterativen Tool-Calls und unnötigen Audio-Invalidierungen.

---

## 2. Zielsetzung

Ein spezialisierter MCP-Server oder ein TypeScript-CLI-Generator, der die Erstellung und Prüfung von Präsentationsfolien deterministisch kapselt:
- Garantierte Syntax- und Cue-Gültigkeit im ersten Versuch.
- Strukturierte Fehlerrückgabe als JSON statt unformatierter Text-Logs.

---

## 3. Geplante MCP-Tools

### A. `scaffold_slide`
Erzeugt eine vollständig valide `.mdx`-Foliendatei basierend auf strukturierten Inputs:

```typescript
interface ScaffoldSlideParams {
  presentationId: string;
  slideNumber: string; // e.g. "04"
  title: string;
  subtitle: string;
  slideLayout: "split" | "pipeline" | "grid" | "metric" | "code" | "title";
  content: {
    // Layout-spezifische strukturierte Daten
    leftCard?: { title: string; bullets: { icon: string; title: string; desc: string; highlightPhrase: string }[] };
    rightCard?: { title: string; bullets: { icon: string; title: string; desc: string; highlightPhrase: string }[] };
  };
  voiceoverCoreMessage: string;
  speakerNotes?: string;
}
```

**Verhalten:**
- Generiert automatisch eindeutige Cue-IDs (`hl-04-...`, `box-...`).
- Betet die Highlight-Tags `{cue:hl-...}...{/cue}` direkt in den Text und die Voiceover-Vorlage ein.
- Garantiert die monotone DOM-Reihenfolge mathematisch durch sequentielle Generierung.

### B. `lint_slide_cues`
Prüft eine einzelne Folie oder eine ganze Präsentation und liefert strukturiertes Feedback:

```typescript
interface LintResult {
  valid: boolean;
  errors: Array<{
    file: string;
    line?: number;
    rule: "missing-highlight" | "out-of-order-cue" | "illegal-closing-tag" | "title-slide-cue-missing";
    message: string;
    suggestedFix?: string;
  }>;
}
```

---

## 4. Erwarteter Nutzen
- **100 % First-Shot-Erfolgsquote** bei neuen Folien.
- **Null kaskadierende Audio-Hash-Mismatches** durch Tippfehler in Cues.
- Einsparung von geschätzt **20.000–40.000 Tokens pro neu erstellter Präsentation**.
