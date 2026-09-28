# SYSTEM-004: Content Manifest & Notification Integrity Linter

- **ID:** `SYSTEM-004`
- **Domäne:** `data-integrity` / `ci-cd`
- **Status:** `proposed`
- **Priorität / Hebel:** `HOCH`
- **Ursprung:** Session 2026-09-28 (Synchronisationsfehler bei Notification Badges & Content Collections)

---

## 1. Problem & Reibungspunkt

1. **Fragmentierte Collection-Metadaten:**  
   Wenn neue Content-Typen oder Seiten hinzugefügt werden (z. B. `interests`), müssen mehrere Systeme synchron gehalten werden:
   - Die Astro Content Collections (`src/content/<collection>/...`)
   - Das statisch generierte Manifest (`src/pages/content-manifest.json.ts`)
   - Der clientseitige Notification-Manager (`src/scripts/notifications.ts` mit `SECTIONS` und `SECTION_CONFIG`)
   - Die Frontmatter-Metadaten (Pflichtfeld `pubDate` für die Berechnung des "Gelesen"-Status)
2. **Stille Laufzeitfehler bei Benutzern:**  
   Fehlt eine Collection im Manifest oder fehlt ein `pubDate` in einer Markdown-Datei, schlägt die "Als gelesen markieren"-Funktion lautlos fehl oder Notification-Badges tauchen nach einem Seiten-Reload erneut auf.
3. **Iterativer Token-Verlust:**  
   Coding Agents beheben solche Inkonsistenzen oft erst nach mehreren Test- und Feedback-Schleifen manuell.

---

## 2. Zielsetzung

Ein schlankes Node/TypeScript-Validierungsskript (`npm run validate:manifest` oder integriert in `npm run test` / Pre-Build), das vor dem Build oder Commit die Konsistenz aller Collections, Manifeste und Notification-Registrierungen garantiert.

---

## 3. Geplante Prüfungen

```typescript
// Prüfkriterien des Linters:
// 1. Vollständigkeit: Jedes src/content/<collection>/ Verzeichnis mit öffentlichen Seiten
//    ist in content-manifest.json.ts registriert.
// 2. Notification-Synchronität: Jede im Manifest geführte Collection ist in notifications.ts
//    unter SECTIONS und SECTION_CONFIG deklariert.
// 3. Schema-Validität: Alle Markdown-Dateien in überwachten Collections enthalten ein valides
//    pubDate im ISO-Format (YYYY-MM-DD).
// 4. Broken Anchors: Verweise auf Detailpfade stimmen mit den real existierenden Slugs überein.
```

---

## 4. Erwarteter Nutzen

- Sofortiger Fehlerabbruch im Build oder Pre-Commit bei vergessenen Metadaten.
- 0 % manuelle Debugging-Zeit für Notification-Badge-Gültigkeit.
- Garantierte Datenintegrität bei neuen Sektionen.
