# SYSTEM-005: Semantisches Section-Visibility-Tracking für Plausible Analytics

- **ID:** `SYSTEM-005`
- **Domäne:** `analytics` / `ux-telemetry`
- **Status:** `planned`
- **Priorität / Hebel:** `HOCH`
- **Ursprung:** Session 2026-09-28 (Scroll-Tiefen-Übersetzung auf konkrete Bildschirminhalte)

---

## 1. Problem & Reibungspunkt

1. **Viewport-Abhängigkeit von Prozent-Scroll-Tiefen:**  
   Die standardmäßige Scroll-Tiefe in Plausible (10 % bis 90 %) misst die relative Position im Dokument. Auf einem Desktop (z. B. 2.500 px Gesamthöhe) entspricht eine Scroll-Tiefe von 50 % jedoch einem völlig anderen Textabschnitt als auf einem Smartphone (z. B. 6.500 px Gesamthöhe durch vertikales Stapeln und Textumbruch).
2. **Unschärfe bei Inhalts-Audits:**  
   Wenn die Analytik meldet, dass zwischen 30 % und 50 % viele Leser abspringen, muss ein Coding Agent heute aufwändig die DOM-Positionen aller Zwischenüberschriften gegenprüfen, um den verursachenden Abschnitt zu identifizieren.
3. **Mangelnde Granularität bei Langformaten:**  
   Besonders lange Blog-Posts, Tutorials oder Dokumentationen besitzen 5–10 Zwischenüberschriften. Hier reicht ein grobes 10-%-Raster nicht aus, um exakt zu bestimmen, welches Unterkapitel überflogen oder gemieden wird.

---

## 2. Zielsetzung & Architektur (Der geschlossene Regelkreis)

### Teil A: Frontend (Website-Erfassung)
Ein leichtgewichtiges, barrierefreies und datenschutzkonformes Astro-Client-Skript (`src/scripts/section-tracking.ts`), das automatisch in Inhaltslayouts (`Layout.astro`, `PostLayout.astro`) eingebunden wird:

1. **Beobachtung via `IntersectionObserver`:**  
   Sobald eine semantische Zwischenüberschrift (`##` / `h2` oder `###` / `h3`) für mindestens 1,5 bis 2 Sekunden zu $\ge 50\,\%$ im Viewport verweilt (Verweildauer-Schutz gegen schnelles Durchscrollen), wird ein Plausible-Event gefeuert.
2. **Einmaligkeit pro Session/Pageview:**  
   Jeder Abschnitt wird pro Seitenaufruf nur genau einmal gezählt (`Set<string>`), um Event-Spamming beim Hin- und Herscrollen zu verhindern.
3. **Plausible Custom Event Payload:**  
   ```javascript
   plausible('Section Viewed', {
     props: {
       section_id: heading.id,
       section_title: heading.innerText.trim(),
       section_level: heading.tagName.toLowerCase(), // "h2" | "h3"
       section_index: index + 1
     }
   });
   ```

### Teil B: Agentic Tooling (Unified Analytics MCP)
Im MCP-Server `mcp-unified-analytics` wird die Abfrage über `getPlausiblePageGoals` oder ein dediziertes Tool `get_section_retention` erweitert:

```typescript
export interface SectionViewMetric {
  sectionId: string;
  title: string;
  level: 'h2' | 'h3';
  visitors: number;
  retentionRate: number; // % bezogen auf Seitenbesucher
  dropOffFromPrevious: number; // % Verlust gegenüber vorherigem Abschnitt
}
```

Dadurch kann `get_page_audit` künftig eine exakte Tabelle liefern:
```markdown
| Abschnitt | Besucher | Retention | Drop-Off | Status |
| :--- | :--- | :--- | :--- | :--- |
| ## 1. Problemstellung | 140 | 100 % | 0 % | Gesund |
| ## 2. Systemarchitektur | 125 | 89 % | -11 % | Gesund |
| ## 3. Benchmark-Vergleich | 60 | 43 % | -52 % | ⚠️ Kritischer Abbruch |
| ## 4. Fazit | 45 | 32 % | -25 % | Stabil |
```

---

## 3. Erwarteter Nutzen

- **100 % Viewport-Unabhängigkeit:** Exakte Zuordnung von Leserabbrüchen unabhängig von Desktop-, Tablet- oder Smartphone-Bildschirmen.
- **Datengestützte Inhalts-Redaktion:** Sofortiges Erkennen von "Dead-Sections", langweiligen Einleitungen oder überladenen Tabellen.
- **Optimale Platzierung interaktiver Elemente:** Perfekte Positionierung von Demos, Slide-Embeds oder Kontakt-Links direkt vor dem stärksten Drop-Off-Punkt.
