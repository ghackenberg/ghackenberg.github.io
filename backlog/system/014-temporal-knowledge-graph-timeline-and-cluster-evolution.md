# SYSTEM-014: Chronologische Wissensgraph-Evolution, Dynamische Cluster-Mitose & 60-FPS-Timeline-Player (Etappe 2)

- **ID:** `SYSTEM-014`
- **Kategorie / Domäne:** `Visualizations / Graph Physics / Interactive UX`
- **Status:** `planned`
- **Priorität / Hebel:** `Hoch` (Interaktive Zeitreise durch die Werk- und Themen-Evolution über alle 5 Graph-Engines mit Mental-Map-Erhaltung)
- **Erstellt am:** `2026-11-12`
- **Ursprung:** Session 2026-11-12 (Zweistufige Architektur-Roadmap: Etappe 1 Dynamische Themen-Cluster & Coverage-Visualisierung $\rightarrow$ Etappe 2 Temporale Wissensgraph-Evolution)

---

## 1. Problem & Motivation

Der interaktive Wissensgraph auf `/visualizations/*` vereint sämtliche Inhalte der Plattform (`posts`, `publications`, `presentations`, `projects`, `courses`, `services`, `visualizations`, `newsletters`) und gruppiert die 126 Fach-Tags automatisch über Co-Occurrence-Clustering in übergeordnete Themen-Cluster-Superknoten (`group === 0`).

Bislang bildet diese Darstellung jedoch ausschließlich einen statischen Querschnitt des gesamten Archivs ab. Besucher und Fachleser können noch nicht interaktiv nachvollziehen:
1. **Wie sich Forschungsschwerpunkte und Themen-Cluster chronologisch entwickelt haben** (z. B. von frühen Arbeiten im Bereich Computer Vision, Simulation und Systems Engineering hin zu modernen Schwerpunkten wie AI Optimization, Agentic Web und Datenvisualisierung).
2. **Wie neue Themengebiete organisch aus bestehenden Disziplinen hervorgehen (Cluster-Mitose / Split)** oder wie sich benachbarte Teilgebiete im Zeitverlauf zu einem gemeinsamen Schwerpunkt verdichten (**Cluster-Fusion / Merge**).
3. **Wie das Publikations- und Projektnetzwerk über die Jahre gewachsen ist**, gesteuert über ein intuitives Timeline-Control mit Auto-Play, Geschwindigkeitswahl und direktem Scrubber-Zugriff über alle fünf Render-Engines (`Cytoscape.js`, `Sigma.js`, `D3.js`, `Vis-Network`, `3D Force Graph`).

---

## 2. Fundament aus Etappe 1 (Bereits geschaffene Architektur-Bausteine)

Etappe 1 legt das direkte mathematische und visuelle Fundament in [`src/commons/shared/graph-payload.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts), [`src/commons/shared/graph-solvers.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-solvers.ts) und [`src/pages/visualizations/[slug].astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/visualizations/[slug].astro):

1. **Dynamische Cluster-Anzahl $K \in [2, 18]$ mit Makro-Default $K = 4$ (`clusterCount` in `GraphTuningState`):**
   - Standardmäßig gruppiert der Wissensgraph die 126 Fach-Tags in `DEFAULT_TOPIC_CLUSTER_COUNT = 4` klar getrennte Makro-Themencluster (`Software Architecture · Software Engineering`, `Systems Engineering · Software Systems`, `Data Visualization · Hyperkit Software`, `Computer Vision · Motion Capture & Tracking`), während der Live-Slider im Tune-Panel (`Topic Clusters (K)`) eine stufenlose Verfeinerung von `2` bis `18` Clustern erlaubt.
   - `CanonicalGraphPayload` transportiert die kompakte `rawTags`-Metadatenliste, sodass das Client-Bundle über `reclusterCanonicalGraphPayload(canonical, clusterCount)` jederzeit ohne Server-Roundtrip für beliebige Teilmengen von Content-Knoten und beliebige Werte von $K$ neu clustern kann.
2. **Unsichtbare Physik-Kanten, Cluster-Farbpalette & OKLab-Farbmischung (`colorDark` / `colorLight`):**
   - Kanten werden in allen fünf Engines weder im Ruhezustand noch bei Hover visuell gezeichnet (`100 %` unsichtbar), wirken aber vollständig als kontinuierliche, stufenfreie Physik-Federn (`weight = clampNumber(baseMaxWeight * relToMax^(1 / 2.1), 0.20, 0.96)`), sodass Multi-Cluster-Knoten exakt an ihrem überlappungsgewichteten Schwerpunkt zwischen den zugehörigen Themen-Clustern liegen.
   - Jedes Themen-Cluster $k \in \{0 \dots K-1\}$ erhält eine eigene, klar unterscheidbare Cluster-Farbe aus `CLUSTER_PALETTE`. Content-Knoten (`group: 1..8`) erhalten als Knotenfarbe die wahrnehmungsgleichmäßige **OKLab-Mischung (`mixHexColorsOklab`)** ihrer verbundenen Themen-Cluster gewichtet nach `coverage` (mit Chroma-Erhaltung für Brückenknoten).
3. **Das Pill-Badge SELBST ist der Themen-Cluster-Knoten (`group === 0`) mit elliptischer Solver-Freihaltezone:**
   - Themen-Cluster werden direkt als zentriertes Pill-Badge an `(x, y)` gerendert (ohne zusätzlichen dahinterliegenden Kreis und ohne gestrichelte Leader-Line), ausgestattet mit einem `6px`-Farbpunkt in der Cluster-Farbe, cluster-getöntem Rahmen und integrierter Prozent-Abdeckung bei Hover auf einen Content-Knoten (`● #Cluster Title  ·  38%`; `0%`-Cluster treten mit `alpha = 0.14` in den Hintergrund).
   - Im Physik-Solver sorgt eine deterministische elliptische Freihaltezone (`enforceClusterPillClearance2D/3D`, `rx = 84`, `ry = 22`) dafür, dass kein Content-Knoten unterhalb eines Themen-Cluster-Pills zum Liegen kommt (`0` Überlappungen innerhalb `|dx| < 78 && |dy| < 16`).
4. **Interaktive Content-Typ-Filterleiste im Footer (`#content-filter-bar`):**
   - Anstelle einer statischen Farb-Legende bietet `.artifact-card-footer` interaktive Filter-Buttons (`All`, `Posts`, `Publications`, `Presentations`, `Courses`, `Projects`, `Services`, `Newsletters`, `Visualizations`), die nicht-gewählte Content-Typen live abdunkeln, während passende Content-Knoten und Themen-Cluster-Pills voll sichtbar bleiben.
5. **Live-Topologie-Mutation in allen 5 Engines:**
   - Alle fünf Engines unterstützen bereits das dynamische Austauschen von Cluster-Knoten und Kanten zur Laufzeit inklusive sanfter Positions-Interpolation (`animateTo`) sowie Re-Initialisierung der Drag- und Tooltip-Controller.

---

## 3. Ziel-Architektur für Etappe 2 (`SYSTEM-014`)

### 3.1 Chronologische Keyframes ($t_1 \dots t_T$) & Adaptives $K(t)$

1. **Zeitliche Sortierung & Keyframe-Bildung:**
   - Alle Content-Knoten (`group: 1..8`) verfügen über ein kanonisches Datum (`date`). Daraus wird eine geordnete Sequenz von $T \approx 16\text{--}24$ chronologischen Keyframes $t_1 < t_2 < \dots < t_T$ (z. B. auf Jahres-/Halbjahres- bzw. Quantil-Basis) gebildet.
   - Für jeden Zeitpunkt $t_k$ umfasst die aktive Knotenmenge $V_{\text{content}}(t_k) = \{ u \mid \text{date}(u) \le t_k \}$ sowie die bis dahin tatsächlich verwendeten Tags $V_{\text{tags}}(t_k)$.
2. **Skalierendes Cluster-Budget $K(t_k)$:**
   - In frühen Jahren mit wenigen Beiträgen wäre $K = 10$ übersegmentiert. Daher wächst die Cluster-Anzahl organisch mit dem Korpusumfang:
     $$K(t_k) = \min\!\left(K_{\text{target}}, \max\!\left(2, \left\lfloor \sqrt{\frac{|V_{\text{content}}(t_k)|}{2.2}} \right\rfloor\right)\right)$$
   - Am rechten Ende der Timeline ($t_T = \text{Heute}$) erreicht $K(t_T)$ exakt den im Tuning-HUD gewählten Wert $K_{\text{target}}$ (Standard: `10`), sodass der Endzustand zu 100 % mit dem statischen Initial-Layout übereinstimmt.

### 3.2 Mental-Map-Erhaltung durch Bipartites Jaccard-Cluster-Matching (Mitose, Fusion, Persistenz)

Damit Themen-Cluster zwischen zwei Zeitpunkten $t_{k-1}$ und $t_k$ nicht unruhig springen oder ihre Identität verlieren, wird zwischen den Tag-Mengen $C_i^{(k-1)}$ und $C_j^{(k)}$ eine gewichtete Ähnlichkeitsmatrix auf Basis des IDF-gewichteten Jaccard-/Overlap-Index berechnet:
$$S(i, j) = \frac{\sum_{g \in C_i^{(k-1)} \cap C_j^{(k)}} \text{idf}(g)}{\sum_{g \in C_i^{(k-1)} \cup C_j^{(k)}} \text{idf}(g)}$$

Über ein deterministisches Maximum-Weight-Matching werden vier klar definierte topologische Übergangs-Events klassifiziert:

1. **Persistenz (1:1-Fortführung, $S(i, j) \ge 0.35$):**
   - Das Cluster behält seine stabile Cluster-ID und startet seine Physik-Relaxation für Keyframe $t_k$ exakt an den Vorgänger-Koordinaten $(x_{t_{k-1}}, y_{t_{k-1}}, z_{t_{k-1}})$.
2. **Cluster-Mitose / Split ($1 \rightarrow 2$, ein Vorgänger $i$ teilt sich in Hauptcluster $j_1$ und abgespaltenes Tochtercluster $j_2$ mit $|C_i^{(k-1)} \cap C_{j_2}^{(k)}| / |C_{j_2}^{(k)}| \ge 0.40$):**
   - Das neue Tochtercluster $j_2$ spawnt im Moment der Abspaltung **exakt an der Position des Eltern-Clusters $i$** mit initialem Radius-Faktor `0.35 -> 1.0` und gleitet gemeinsam mit seinen umgehängten Content-Knoten sanft in sein neues Kräftegleichgewicht.
3. **Cluster-Fusion / Merge ($2 \rightarrow 1$, zwei Vorgänger $i_1, i_2$ verschmelzen in $j$):**
   - Das kleinere Vorgänger-Cluster gleitet während der Keyframe-Transition in die Zielposition von $j$ (`scale -> 0.2, opacity -> 0`), während seine Kanten auf $j$ übergehen, bevor der Knoten nach Abschluss der Transition entfernt wird.
4. **Cluster-Geburt (Birth, völlig neues Themenfeld ohne signifikante Tag-Überschneidung zu $t_{k-1}$):**
   - Spawnt im Schwerpunkt seiner zugeordneten Content-Knoten mit sanftem Scale-In (`0.2 -> 1.0`).

### 3.3 60-FPS-Timeline-Control & Auto-Play-HUD

1. **Kompakte Timeline-Leiste in [`src/pages/visualizations/[slug].astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/visualizations/[slug].astro):**
   - **Play / Pause Toggle-Button** mit klarem Status-Icon und Keyboard-Shortcut (`Space` bei fokussierter Timeline).
   - **Interaktiver Scrubber (`<input type="range">`)** mit Datums-/Jahres-Badge (`2014` $\dots$ `2026`), Zähler für aktive Knoten/Cluster (`N Items · K Clusters`) sowie Vor-/Zurück-Buttons für diskrete Keyframe-Schritte.
   - **Geschwindigkeits-Wahl (`0.5x`, `1x`, `2x`)** für langsame Analyse vs. schnellen Zeitraffer.
2. **Vorab- bzw. On-Demand-Keyframe-Cache:**
   - Beim ersten Klick auf Play oder beim Bewegen des Timeline-Sliders werden die Keyframe-Topologien und warm-gestarteten Zielkoordinaten berechnet und gecacht, sodass das Scrubben vorwärts und rückwärts verzögerungsfrei mit 60 FPS interpoliert.

---

## 4. Erkenntnisse aus Etappe 1 (Live-Topologie-Mutation & Dynamisches K)

Die Implementierung und Verifikation von Etappe 1 (`SOLVER_VERSION = 'v19'`) über alle fünf Engines hat folgende architektonische Erkenntnisse für Etappe 2 bestätigt:

1. **In-Place-Mutation von `adjacency` & Lookup-Maps vermeidet Listener-Rebinding:**
   - Der Preact-Tooltip-Controller (`bindProximityInteraction`) hält eine Referenz auf die beim `init()` übergebene `adjacency`-Map (`Map<string, Set<string>>`). Durch leeren und Wiederbefüllen derselben Map-Instanz (`this.adjacency.clear()` + `this.adjacency.set(...)`) in `rebuildClusterTopology(targetK)` bleiben sämtliche Hover-, Hop-Distanz- und Fokus-Interaktionen nach einem Topologie-Wechsel ohne erneute DOM-Event-Registrierung konsistent.
2. **Warm-Start-Koordinaten, Baryzentrisches Seeding & OKLab-Farbkontinuität:**
   - Wenn `clusterCount` ($K$) geändert wird (oder in Etappe 2 ein Tochter-Cluster per Mitose entsteht), verhindert das Initialisieren neuer `group === 0`-Superknoten nahe dem Schwerpunkt bestehender Cluster sowie das baryzentrische Seeding von Multi-Cluster-Knoten (`w^2.1`-gewichtetes Mittel der verbundenen Cluster-Hubs) unruhige Layout-Sprünge während des nachfolgenden `solve*LayoutAsync`-Laufs, während `mixHexColorsOklab` die Cluster-Zugehörigkeit ohne sichtbare Kanten unmittelbar über die Knotenfarbe kodiert.
3. **Zentrierte, größenkonstante Themen-Cluster-Pills (`group === 0`) mit angedocktem `%`-Badge & elliptischer Solver-Freihaltezone (`enforceClusterPillClearance2D/3D`):**
   - Da das Themen-Cluster-Pill-Badge selbst der Knoten ist (`px = cx`, `py = cy`) und im Solver eine elliptische Freihaltezone (`rx = 84`, `ry = 22`) um jedes Cluster-Zentrum durchgesetzt wird, kommt kein Content-Knoten unterhalb eines Pill-Badges zum Liegen (`0` Überlappungen in `|dx| < 78 && |dy| < 16`).
   - Die Haupt-Pill (`[ ● #Cluster Name ]`) behält im Rest- und Hover-Zustand exakt konstante Dimensionen (`getClusterPillDimensions` mit Offscreen-Canvas-Textmessung `measureTextWidthPx`), während die Coverage-Prozentzahl (`38%`) bei Hover eines Content-Knotens als separates externes Satelliten-Badge rechts außen angedockt wird (null Pill-Größensprung / null Flackern).
   - Beim Hover eines Themen-Clusters (`group === 0`) werden alle übrigen Themen-Cluster-Pills konsistent über alle 5 Engines gedimmt (`alpha = 0.14` via `resolveClusterPillVisualState`), und Content-Knoten werden proportional zu ihrer tatsächlichen Cluster-Coverage (`0..100 %`) gedimmt und skaliert (`100 %` Coverage = 100 % volle Sichtbarkeit).
4. **Reguläre Polygon-Formen (`3..10` Ecken für Content-Typen `1..8`), Exklusiver Single-Select-Filter & Tooltip-Kollisionsvermeidung:**
   - Content-Typen (`group 1..8`) werden über alle 5 Engines sowie in der Footer-Filterleiste als flächennormierte reguläre $N$-Ecke (`3..10` Ecken: Dreieck bis Zehneck) gerendert; die Filterleiste arbeitet im exklusiven Single-Select-Modus (`All` ODER genau ein Content-Typ).
   - Der schwebende HTML-Tooltip (`.vis-tooltip` in [`src/commons/client/vis-tooltip.tsx`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/vis-tooltip.tsx)) berücksichtigt die Bounding-Boxes aktiver Themen-Cluster-Pills samt angedocktem `%`-Badge in seiner Sektor-Bewertung und weicht diesen automatisch aus.
5. **Verifizierte Qualitäts-Metriken (`validate:vis` auf `K = 4`, `K = 6` und `K = 12`, `SOLVER_VERSION = 'v20'`):**
   - **Sync-vs-Async-Parität:** `0.0000 px` Abweichung zwischen statischem Build-Solver und asynchronem Browser-Solver über alle 5 Engines.
   - **Stufenfreie Kanten-Physik & Baryzentrische Positionierung:** Kontinuierliche Gewichte `weight ∈ [0.20, 0.96]` ohne Stufen-Cutoffs (`meanBaryDist < 0.85 * meanCoDomHubDist`).

---

## 5. Betroffene Dateien & Komponenten

| Datei / Modul | Geplante Änderung im Rahmen von `SYSTEM-014` (Etappe 2) |
| :--- | :--- |
| [`src/commons/shared/graph-payload.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts) | Chronologische Keyframe-Generierung (`buildTemporalGraphKeyframes`), Jaccard-Cluster-Matching sowie Mitose-/Fusions-Event-Klassifikation. |
| [`src/commons/shared/graph-solvers.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-solvers.ts) | Warm-Start-Solver-Seeding aus Vorgänger-Keyframes $(x_{t-1}, y_{t-1}, z_{t-1})$ zur Mental-Map-Erhaltung ohne globale Positions-Sprünge. |
| [`src/pages/visualizations/[slug].astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/visualizations/[slug].astro) | Timeline-Player-HUD (Play/Pause, Scrubber, Jahres-/Cluster-Badge, Speed-Selector `0.5x / 1x / 2x`). |
| [`src/content/visualizations/cytoscape/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/cytoscape/engine.ts), [`src/content/visualizations/sigma/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/sigma/engine.ts), [`src/content/visualizations/d3/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/d3/engine.ts), [`src/content/visualizations/vis-network/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/vis-network/engine.ts), [`src/content/visualizations/3d-force-graph/engine.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/3d-force-graph/engine.ts) | 60-FPS-Keyframe-Übergänge inklusive Spawn-/Merge-Animationen für entstehende und verschmelzende Themen-Cluster sowie neu hinzukommende Content-Knoten. |
| [`src/scripts/validate-visualizations.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/validate-visualizations.ts) & [`src/scripts/test-visualizations-e2e.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/test-visualizations-e2e.ts) | Automatisierte Gates für zeitliche Monotonie, Cluster-Matching-Stabilität und Browser-E2E-Test des Timeline-Players. |

---

## 6. Akzeptanzkriterien (`SYSTEM-014`)

1. **Mental-Map-Stabilität:** Persistierende Themen-Cluster behalten beim Übergang $t_{k-1} \rightarrow t_k$ ihre Identität und driften nur kontinuierlich; abgespaltene Tochter-Cluster spawnen exakt an der Position des Eltern-Clusters.
2. **Endzustands-Parität:** Bei $t_T = 100\,\%$ (heutiger Stand) stimmt die Topologie und das Layout exakt mit dem statischen Standard-Graphen überein (`0.0000 px` Abweichung).
3. **Engine-Konsistenz:** Alle fünf Visualisierungs-Engines (`cytoscape`, `sigma`, `d3`, `vis-network`, `3d-force-graph`) unterstützen Play, Pause, Speed-Wechsel und freies Scrubben ohne Console-Errors oder verwaiste DOM-/WebGL-Objekte.
