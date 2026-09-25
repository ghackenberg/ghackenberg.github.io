# TOOL-002: Visual Asset Graph MCP (Scene-Anchor & Room-DNA Resolver)

- **ID:** `TOOL-002`
- **Domäne:** `images` / `visual-asset-engine`
- **Status:** `proposed`
- **Priorität / Hebel:** `HOCH`
- **Ursprung:** Sessions 2026-09-24 & 2026-09-25 (Fokus-Varianten-Auswahl, Slot-Constraints, Kontrast-Theming)

---

## 1. Problem & Reibungspunkt

1. **Komplexe relationale Suche im Vorfeld von `generate_image`:**
   Vor der Generierung eines Bildes muss der Agent aktuell:
   - Die Verzeichnisse `src/content/characters/`, `environments/` und `objects/` scannen.
   - Prüfen, welche `variants` für den gewählten Raum existieren (z. B. `workplace-focus`, `beamer-screen-focus`).
   - Die `characterSlots` abgleichen (welche Posen sind erlaubt? Welche Slot-Prioritäten gelten?).
   - Die `visibleObjects` identifizieren.
   - Die korrekten Bildpfade für `ImagePaths` (maximal 3 Bilder) zusammensetzen.
2. **Fehlerrisiko:**
   - Auswahl verbotener Posen (z. B. stehend am Whiteboard in einem sitzenden Desk-Slot).
   - Falsche Referenzbilder (Layout-Locking durch Übergabe von Weitwinkel-Fotos).
   - Stil- oder Farbinkonsistenzen (z. B. Beamer-Screen dunkel statt hell).

---

## 2. Zielsetzung

Ein MCP-Server, der den relationalen Wissensgraphen in `src/content/{characters,environments,objects}/` abfragt und auf Knopfdruck die fertigen, validierten Bildparameter ausgibt.

---

## 3. Geplante MCP-Tools

### A. `resolve_scene_context`
Nimmt Raum, Fokusvariante und Charaktere entgegen und gibt die validierte Konfiguration zurück:

```typescript
interface ResolveSceneParams {
  environmentId: string; // z.B. "design-thinking-lab-wels"
  variantId: string;     // z.B. "beamer-screen-focus"
  characterId: string;   // z.B. "georg"
  desiredAction?: string;
}

interface SceneContextResult {
  valid: boolean;
  imagePaths: string[];         // z.B. ["characters/georg/portrait.png", "environments/.../beamer-screen-focus.jpg"]
  allowedPoses: string[];       // z.B. ["standing at lectern", "pointing to screen"]
  prohibitedPoses: string[];    // z.B. ["seated at desk"]
  roomDnaSnippet: string;       // Text-Baustein für Prompt
  visibleObjects: string[];     // z.B. ["wooden-lectern", "interactive-beamer-screen"]
  promptDraftTemplate: string;  // Vorgefertigtes Prompt-Skelett mit Tiefenzonierung
}
```

### B. `validate_image_prompt`
Prüft einen entworfenen Prompt vor der Vorlage an den User:
- Stimmen Stilvorgaben (Pixar/Disney Comic, cel shading)?
- Sind unzulässige Posen oder Frames enthalten?
- Entspricht das Farbschema den Richtlinien?

---

## 4. Erwarteter Nutzen
- Schließt Halluzinationen bei Bildreferenzen und Raumelementen aus.
- Reduziert die Vorbereitungszeit und Dateisuch-Tool-Calls um **80 %**.
- Garantiert strikte Einhaltung von `IMAGE_STYLE_GUIDELINES.md`.
