# SYSTEM-004: Content Manifest Integrity Linter

- **ID:** `SYSTEM-004`
- **Domäne:** `data-integrity` / `ci-cd`
- **Status:** `proposed`
- **Priorität / Hebel:** `HOCH`
- **Ursprung:** Session 2026-09-28 (Aktualisiert 2026-10-26: Clientseitiges Notification-Read-Tracking entfernt; Fokus rein auf `content-manifest.json` Domain-Parität)

---

## 1. Problem & Reibungspunkt

1. **Fragmentierte Collection-Metadaten:**  
   Wenn neue Content-Typen oder Seiten hinzugefügt werden (z. B. `newsletters`, `course-modules`, `service-modules`), müssen mehrere Systeme synchron gehalten werden:
   - Die Astro Content Collections (`src/content/<collection>/...` und `src/content.config.ts`)
   - Das statisch generierte Manifest (`src/pages/content-manifest.json.ts`)
   - Die Konsumenten des Manifests (Homepage-Marquee `ImageGalleryMarquee.astro` und Dev-Sankey-Overlay `src/commons/client/dev-sankey.ts`)
   - Die Frontmatter-Metadaten (insb. `pubDate`, `tags` und `image`)
2. **Stille Lücken in Marquee & Sankey-Graph:**  
   Fehlt eine Collection oder Tag-Zählung im Manifest, tauchen neue Inhalte oder Sub-Module weder in der Startseiten-Galerie noch im Dev-Sankey-Graph vollständig auf.
3. **Iterativer Token-Verlust:**  
   Coding Agents beheben solche Inkonsistenzen oft erst nach mehreren Test- und Feedback-Schleifen manuell.

---

## 2. Zielsetzung

Ein schlankes Node/TypeScript-Validierungsskript (`npm run validate:manifest` oder integriert in `npm run verify`), das vor dem Build oder Commit die 100%ige Domain-Parität aller öffentlichen Content Collections mit `content-manifest.json.ts` garantiert.

---

## 3. Geplante Prüfungen

```typescript
// Prüfkriterien des Linters:
// 1. Vollständigkeit: Jede öffentliche Content Collection aus src/content.config.ts
//    (inkl. course-modules, service-modules, newsletters) ist in content-manifest.json.ts registriert.
// 2. Tag-Zähler-Parität: manifest.tags aggregiert Zähler für alle Tag-tragenden Domains
//    (posts, presentations, courses, projects, publications, visualizations, services, newsletters).
// 3. Schema-Validität: Alle überwachten Einträge enthalten valide pubDate- und URL-Felder.
// 4. Broken Anchors: Generierte Detailpfade im Manifest stimmen mit den realen Astro-Routen überein.
```

---

## 4. Erwarteter Nutzen

- Sofortiger Fehlerabbruch im Build oder Pre-Commit bei vergessenen Manifest-Domains.
- Garantierte 100%ige Domain-Parität zwischen Content Collections, `content-manifest.json`, Startseiten-Galerie und Dev-Analytics-Overlay.
