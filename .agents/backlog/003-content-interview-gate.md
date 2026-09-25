# TOOL-003: Content Interview Gatekeeper (Interaktiver Fragebogen-Generator)

- **ID:** `TOOL-003`
- **Domäne:** `content-creation` / `workflow`
- **Status:** `proposed`
- **Priorität / Hebel:** `MITTEL`
- **Ursprung:** Session 2026-09-25 (Fakten- und Positionierungs-Abstimmung bei Tech-Biografie)

---

## 1. Problem & Reibungspunkt

1. **Gefahr von Halluzinationen & Fehlannahmen:**  
   Wenn die KI eigenständig längere Texte, Artikel oder Präsentationen entwirft, ohne vorher die persönlichen Ansichten, Stationen oder No-Go-Begriffe des Autors zu kennen, entstehen Entwürfe, die inhaltlich korrigiert werden müssen.
2. **Uneinheitliche Interview-Struktur:**  
   Ohne tooling-gestützte Struktur vergisst ein Agent oft wesentliche Fragen (z. B. nach konkreten Zahlen, Industriepartnern oder vermiedenen Begriffen).

---

## 2. Zielsetzung

Ein Tool, das für eine gewünschte Content-Kategorie (`post`, `presentation`, `course`, `service`) automatisch einen prägnanten, strukturierten Fragebogen (4–6 Kernfragen) generiert und als interaktive Modal-Maske oder Markdown-Entwurf vorlegt.

---

## 3. Geplante Schnittstelle

```typescript
interface GenerateInterviewParams {
  collection: "posts" | "presentations" | "courses" | "publications" | "services";
  workingTitle: string;
  targetAudience?: string;
  knownPoints?: string[];
}

interface InterviewResult {
  questions: Array<{
    category: "thesis" | "evidence" | "stakeholders" | "terminology_nogos";
    question: string;
    rationale: string;
  }>;
  markdownDraftPath: string; // z.B. "src/content/presentations/.../interview.md"
}
```

---

## 4. Erwarteter Nutzen
- 100 % Vermeidung von inhaltlichen Fehltritten vor Beginn des Schreibprozesses.
- Drastische Reduktion von Review-Schleifen.
