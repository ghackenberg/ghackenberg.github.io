# SYSTEM-012: Natives Astro Asset-Hashing, Content-Layer Dependency-Tracking & Ablösung manueller Dev-Watcher-Workarounds

- **ID:** `SYSTEM-012`
- **Kategorie / Domäne:** `Build Engineering / Content Layer / DX`
- **Status:** `proposed`
- **Priorität / Hebel:** `Mittel` (Architektonische Bereinigung von `astro.config.ts` und der Rehype-Pipeline)
- **Erstellt am:** `2026-11-05`
- **Ursprung:** Session 2026-11-05 (Root-Cause-Analyse zur fehlenden Cache-Invalidierung in `.astro/data-store.json` bei Änderungen an eingebetteten `.svg`-Dateien und in-place überschriebenen Rasterbildern)

---

## 1. Problem & Motivation

Warum bemerkt Astro im Entwicklungs- (`astro dev`) oder inkrementellen Build-Modus standardmäßig nicht, wenn sich eine in Markdown eingebundene `.svg`-Datei ändert oder wenn ein ko-loziertes Rasterbild (`hero.jpg`, `preview.jpg`, `figure-1.png`) bei identischem Dateinamen überschrieben wird?

Die Ursache liegt im Zusammenspiel zweier Architekturschichten:

1. **Grund 1 — Unsichtbare Dateisystem-Lesezugriffe in [`src/plugins/rehype-inline-svg.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/plugins/rehype-inline-svg.ts) am Vite-Modulgraphen vorbei:**
   - Standardmäßig verarbeitet Astro Markdown-Bilder (`![alt](./diagram.svg)`) als externe `<img src="/_astro/diagram.hash.svg">`-Referenzen über die reguläre Vite-Asset-Pipeline.
   - Um jedoch adaptive Light-/Dark-Mode-Farbschemata über zentrale CSS-Design-Tokens (`var(--svg-bg)`, `var(--svg-node-blue-*)` aus [`src/styles/graphics.css`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/styles/graphics.css)) direkt im Dokument-DOM aufzulösen, liest unser eigenes Rehype-Plugin [`src/plugins/rehype-inline-svg.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/plugins/rehype-inline-svg.ts) lokale `.svg`-Dateien während der Markdown-Transformation synchron per `fs.readFileSync(resolvedPath, 'utf8')` ein und bettet den bereinigten `<svg>`-Baum direkt als `<figure class="svg-diagram">`-Knoten in den gerenderten HTML-String ein.
   - Weil dieser direkte `fs.readFileSync`-Aufruf für Astros `glob()`-Loader ([`src/content.config.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content.config.ts)) und den Vite-Modulgraphen vollständig unsichtbar ist, speichert `.astro/data-store.json` den fertig gerenderten HTML-Body ausschließlich unter dem Content-Digest der `.md`-Datei. Ändert sich nur die `.svg`-Datei auf der Festplatte, bleibt der `.md`-Digest unverändert — Astro liefert weiterhin das veraltete Inline-SVG aus `.astro/data-store.json` aus.

2. **Grund 2 — Pfadbasierte Digests und `/_image`-Caching bei in-place überschriebenen PNG/JPG-Dateien im Dev-Mode:**
   - Astros eingebauter `glob()`-Loader (`node_modules/astro/dist/content/loaders/glob.js`) berechnet den `digest`-Wert eines Content-Eintrags ausschließlich aus dem Textinhalt (`body`) und Frontmatter der `.md`- bzw. `.mdx`-Datei selbst, nicht jedoch aus den Binär-Hashes der im Frontmatter (`image.src: ./hero.jpg`) oder im Markdown-Body referenzierten Bilddateien.
   - Im statischen Production-Build (`astro build`) erzeugt Rollup/Vite zwar inhaltsbasierte Dateinamen (`hero-[hash].webp` über `getSemanticAssetPath` in [`astro.config.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/astro.config.ts)).
   - Im Dev-Server (`astro dev`) hingegen referenziert Astros Image-Endpoint (`/_image?href=%2F%40fs%2F...%2Fhero.jpg&w=...&f=webp`) lediglich den lokalen Dateipfad ohne Content-Hash. Wird `hero.jpg` oder `preview.jpg` durch ein neu generiertes Bild mit identischem Dateinamen ersetzt, ändert sich weder der `.md`-Digest noch die `/_image`-Query-URL — Browser-Cache und Dev-Pipeline zeigen ohne Hard-Reload weiterhin den veralteten Bildzustand.

3. **Technischer Debt durch aktuelle Workarounds in [`astro.config.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/astro.config.ts):**
   - Um dieses Verhalten kurzfristig im Dev-Server abzufangen, überwacht die Integration `copyContentAssets` in [`astro.config.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/astro.config.ts) (`astro:server:setup`) manuell Änderungen an `src/plugins/` und `.svg`-Dateien in `src/content/`, löscht bei jedem Treffer brutal die gesamte `.astro/data-store.json` (`fs.rmSync`) oder triggert `server.restart()` bzw. `utimesSync`-Touch-Workarounds.
   - Ein Komplett-Reset von `.astro/data-store.json` mit anschließendem Server-Neustart invalidiert sämtliche Collections gleichzeitig, kostet mehrere Sekunden Rebuild-Latenz und behebt das zugrundeliegende Fehlen eines granularen Asset-Dependency-Trackings im Content Layer nicht an der Wurzel.

---

## 2. Ziel-Architektur (`SYSTEM-012`)

`SYSTEM-012` ersetzt die symptomatischen Datei-Watcher- und Cache-Lösch-Workarounds durch eine dreiteilige, nativ in Astros Content Layer und Asset-Pipeline integrierte Architektur:

### 2.1 Säule 1: Natives Content-Digest-Einbeziehen ko-lozierter Assets (`assetAwareGlob` Loader-Wrapper)

Statt den Standard-`glob()`-Loader aus `astro/loaders` in [`src/content.config.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content.config.ts) ungefiltert aufzurufen, wird ein wiederverwendbarer Loader-Wrapper `assetAwareGlob(options)` in `src/commons/server/content-loader.ts` eingeführt:

1. **Kombinierter Entry- & Asset-Digest (`generateDigest`):**
   - Für jeden geladenen Markdown-/MDX-Eintrag (`src/content/<collection>/<slug>/index.md`) ermittelt der Loader alle im selben Eintrag-Verzeichnis ko-lozierten bzw. im Dokument referenzierten lokalen Assets (`.svg`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`, `.gif`).
   - Über die bereits vorhandene schnelle Hashing-Infrastruktur ([`src/commons/server/content-hash.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/content-hash.ts)) wird ein deterministischer **Composite-Digest** berechnet:
     $$\text{digest}(\text{entry}) = \text{SHA-256}\Big(\text{rawMarkdown} \;\Vert\; \bigoplus_{a \in \text{Assets}(\text{entry})} \big(\text{relPath}(a) + \text{":"} + \text{SHA-256}(a)\big)\Big)$$
2. **Granulare Datei-Watcher-Registrierung im Astro Content Layer:**
   - Im Loader-Kontext (`LoaderContext.watcher`) werden Änderungen (`change`, `add`, `unlink`) an ko-lozierten `.svg`- und Bilddateien direkt auf die zugehörige Entry-ID (`<slug>`) abgebildet.
   - Ändert sich `src/content/posts/2026_11_05_.../architecture.svg`, wird **ausschließlich dieser eine Post-Eintrag** im `DataStore` neu durch die Remark-/Rehype-Pipeline (`rehype-inline-svg.ts`) gerendert — ohne `.astro/data-store.json` komplett zu löschen und ohne `server.restart()` auszulösen.

#### Architektur-Skizze für `src/commons/server/content-loader.ts`

```typescript
import { glob } from 'astro/loaders';
import type { Loader, LoaderContext } from 'astro/loaders';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TRACKED_ASSET_EXT_REGEX = /\.(svg|png|jpe?g|webp|avif|gif)$/i;

function computeDirectoryAssetFingerprint(entryDir: string): string {
  if (!fs.existsSync(entryDir)) return '';
  const hash = crypto.createHash('sha256');
  const entries = fs.readdirSync(entryDir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  for (const entry of entries) {
    if (entry.isFile() && TRACKED_ASSET_EXT_REGEX.test(entry.name)) {
      const fullPath = path.join(entryDir, entry.name);
      const stat = fs.statSync(fullPath);
      const fileBuf = fs.readFileSync(fullPath);
      const fileSha = crypto.createHash('sha256').update(fileBuf).digest('hex').slice(0, 16);
      hash.update(`${entry.name}:${stat.size}:${fileSha};`);
    }
  }
  return hash.digest('hex').slice(0, 16);
}

export function assetAwareGlob(options: Parameters<typeof glob>[0]): Loader {
  const baseLoader = glob(options);
  return {
    name: 'asset-aware-glob-loader',
    load: async (context: LoaderContext) => {
      const originalGenerateDigest = context.generateDigest;
      context.generateDigest = (data: Record<string, unknown> | string) => {
        const baseDigest = originalGenerateDigest(data);
        // Combine markdown digest with co-located SVG/raster asset hashes
        return baseDigest;
      };
      return baseLoader.load(context);
    },
  };
}
```

*(Ergänzend hinterlegt [`src/plugins/rehype-inline-svg.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/plugins/rehype-inline-svg.ts) für jede per `fs.readFileSync` eingebettete `.svg`-Datei sowohl den abhängigen Dateipfad in `file.data` als auch einen inhaltsbasierten `data-svg-hash="<sha256-8>"`-Fingerabdruck am `<figure>`-Element).*

---

### 2.2 Säule 2: Durchgängiges Content-Hash-Busting im Dev-Server (`/_image` & Middleware)

Damit auch in-place überschriebene Rasterbilder (`hero.jpg`, `preview.jpg`, Diagramm-PNGs) im laufenden Dev-Server sofort ohne Browser-Cache-Stale-State aktualisiert werden:

1. **Content-Hash-Parametrisierung für Dev-Asset-URLs (`?v=<sha256-prefix>`):**
   - Lokale Asset-URLs, die im Dev-Mode über die Middleware in [`astro.config.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/astro.config.ts) oder über Astros `/_image`-Transformations-Endpoint ausgeliefert werden, erhalten den 8-stelligen SHA-256-Content-Hash aus [`src/commons/server/content-hash.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/content-hash.ts) als Cache-Busting-Parameter (`?v=<hash>`) bzw. eine gehashte virtuelle Route (`/presentations/<id>/preview-<hash>.jpg`).
2. **Saubere Cache-Control-Header im Dev-Server vs. Production:**
   - Für ungehashte direkte Content-Pfade im Dev-Server setzt die Dev-Middleware `Cache-Control: no-cache`, während gehashte Artefakte (`[name]-[hash][extname]`) ihre Immutability behalten.
   - Wird ein Bild mit gleichem Dateinamen überschrieben, ändert sich sein SHA-256-Präfix $\rightarrow$ der Composite-Digest des Content-Eintrags invalidiert den Eintrag $\rightarrow$ die neue URL erzwingt automatisch einen frischen Fetch im Browser.

---

### 2.3 Säule 3: Vollständiger Rückbau manueller Dev-Watcher-Workarounds in `astro.config.ts`

Sobald die Dependency-Registrierung nativ über den Content-Layer-Digest (Säule 1) und das Dev-Hash-Busting (Säule 2) läuft, wird [`astro.config.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/astro.config.ts) drastisch entschlackt:

- **Ersatzloser Wegfall von `fs.rmSync('.astro/data-store.json')` und `server.restart()` bei `.svg`-Änderungen:**  
  Der manuelle Datei-Watcher `invalidateContentCacheOnAssetOrPluginChange` für `.svg`-Dateien in `copyContentAssets` entfällt vollständig; nur noch echte Code-Änderungen an `src/plugins/*.ts` lösen bei Bedarf einen gezielten Reload aus.
- **Vermeidung jeglicher `fs.utimesSync`-Touch-Hacks:**  
  Keine künstlichen Zeitstempel-Mutationen auf `.md`-Quelldateien im Arbeitsbaum mehr (verhindert unnötige File-System-Events in der IDE und in Git-Status-Checks).

---

## 3. Betroffene Dateien & Komponenten

| Datei / Modul | Geplante Änderung im Rahmen von `SYSTEM-012` |
| :--- | :--- |
| [`src/commons/server/content-loader.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/content-hash.ts) *(Neu)* | Implementierung des `assetAwareGlob`-Loaders mit Composite-SHA-256-Digest über Markdown-Inhalt + ko-lozierte `.svg`/Bild-Assets und gezielter Einzel-Entry-Invalidierung im `watcher`. |
| [`src/content.config.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content.config.ts) | Umstellung der relevanten Collections (`posts`, `presentations`, `courses`, `projects`, `services`, `publications`, `visualizations`, `newsletters`) von `glob(...)` auf `assetAwareGlob(...)`. |
| [`src/plugins/rehype-inline-svg.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/plugins/rehype-inline-svg.ts) | Berechnung des SVG-ID-Scoping-Hashes über den **SVG-Dateiinhalt + Pfad** (statt nur über `resolvedPath`) sowie Registrierung der gelesenen `.svg`-Pfade im `VFile`-Metadatenobjekt. |
| [`astro.config.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/astro.config.ts) | Entfernung des `.astro/data-store.json`-Lösch- und `server.restart()`-Workarounds für Content-SVGs in `copyContentAssets`; Ergänzung von `Cache-Control: no-cache` auf ungehashten Dev-Middleware-Routen. |

---

## 4. Offene Design-Entscheidungen & Klärungspunkte (`/grill-me` vor Implementierung)

Vor der Umsetzung sind folgende technische Detailfragen abzustimmen:

- [ ] **Q1 (Umfang des Asset-Fingerprints im Loader — Verzeichnis-Scan vs. AST-Referenz-Scan):**  
  Soll `assetAwareGlob` pauschal alle ko-lozierten Bild- und `.svg`-Dateien im jeweiligen Eintrag-Ordner (`src/content/posts/<slug>/*`) in den Composite-Digest einbeziehen (extrem schnell und erfasst automatisch auch Frontmatter-Bilder wie `hero.jpg` und `preview.jpg`), oder sollen zusätzlich auch ordnerübergreifende Referenzen (z. B. `src/assets/...`) aus dem Markdown-Text geparst werden?
- [ ] **Q2 (Verhalten bei Änderungen an `src/styles/graphics.css`):**  
  Da [`src/styles/graphics.css`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/styles/graphics.css) im Production-Build direkt in eigenständige `.svg`-Kopien eingebettet wird, im HTML-DOM jedoch global über [`src/styles/theme.css`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/styles/theme.css) geladen wird: Reicht im Dev-Server das native Vite-CSS-HMR für `graphics.css`, oder soll der Hash von `graphics.css` ebenfalls Teil des SVG-Build-Digests sein?

---

## 5. Erwarteter Nutzen & Akzeptanzkriterien

- **Sub-Sekunden-HMR bei `.svg`-Edits ohne Data-Store-Wipe:** Eine Änderung an einer ko-lozierten `.svg`-Datei aktualisiert im laufenden `astro dev`-Server gezielt nur den betroffenen Content-Eintrag in `< 200ms`, ohne `.astro/data-store.json` zu löschen und ohne den gesamten Astro-Dev-Server neu zu starten.
- **Sofortige Sichtbarkeit in-place überschriebener Bilder:** Das Ersetzen einer `hero.jpg`, `preview.jpg` oder `.png`-Grafik mit identischem Dateinamen führt deterministisch zu einem neuen Entry-Digest und einer aktualisierten Browser-Darstellung ohne Stale-Cache.
- **Saubere Trennung von Control Plane & Build Pipeline:** [`astro.config.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/astro.config.ts) kommt vollständig ohne manuelle `.astro/data-store.json`-Löschungen oder `utimesSync`-Touch-Workarounds für Content-Assets aus; `npm run verify` läuft mit 0 Warnungen durch.
