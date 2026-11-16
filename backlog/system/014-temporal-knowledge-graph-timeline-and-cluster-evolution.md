# SYSTEM-014: Chronologische Wissensgraph-Evolution, Dynamische Cluster-Mitose & 60-FPS-Timeline-Player (Etappe 2)

- **ID:** `SYSTEM-014`
- **Kategorie / Domäne:** `Visualizations / Graph Physics / Interactive UX`
- **Status:** `in-progress` (Etappe 1/1b/2 implementiert, Verifikation läuft)
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

1. **Dynamische Cluster-Anzahl $K \in [2, 18]$ mit dimensionalem Simplex-Default ($K = 3$ in 2D, $K = 4$ in 3D):**
   - Standardmäßig gruppiert der Wissensgraph die 126 Fach-Tags in `DEFAULT_TOPIC_CLUSTER_COUNT = 3` (2D-Dreiecks-Simplex für `cytoscape`, `sigma`, `d3`, `vis-network`) bzw. `DEFAULT_TOPIC_CLUSTER_COUNT_3D = 4` (3D-Tetraeder-Simplex für `3d-force-graph`) klar getrennte Makro-Themencluster (`getDefaultTopicClusterCount(engine)`), während der Live-Slider im Tune-Panel (`Topic Clusters (K)`) eine stufenlose Verfeinerung von `2` bis `18` Clustern erlaubt. (`SOLVER_VERSION = 'v23'`, getrennte Layout-Caches pro `targetK`.)
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
   - In frühen Jahren mit wenigen Beiträgen wäre $K = 4$ bereits eine Übersegmentierung (bei $N \lesssim 20$ gilt $K = 2$). Daher wächst die Cluster-Anzahl organisch mit dem Korpusumfang:
     $$K(t_k) = \min\!\left(K_{\text{target}}, \max\!\left(2, \left\lfloor \sqrt{\frac{|V_{\text{content}}(t_k)|}{2.2}} \right\rfloor\right)\right)$$
   - Am rechten Ende der Timeline ($t_T = \text{Heute}$) erreicht $K(t_T)$ exakt den im Tuning-HUD gewählten Wert $K_{\text{target}}$ (Standard: `3` für 2D, `4` für 3D), sodass der Endzustand zu 100 % mit dem statischen Initial-Layout übereinstimmt.

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

## 4a. Etappe 1b: Warm-Start-Seeding, Jaccard-Farbvererbung & Pill-Morphing (`SOLVER_VERSION = 'v21'`)

Etappe 1b liefert die wiederverwendbaren Bausteine, die der Timeline-Player (Etappe 2) unverändert nutzt:

1. **Warm-Start-Seeding (`SolverGraphInput.seedPositions`, [`graph-solvers.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-solvers.ts)):**
   - `buildInitialSpiralPositions` überlagert den kalten Spiral-Start mit Seeds: eigener Seed > Seed des `originClusterId` (Geschwister-Cluster mit gleichem Ursprung werden deterministisch um `rank · 20 px` versetzt, bevorzugt in Richtung des Schwerpunkts ihrer verbundenen Content-Seeds) > coverage-gewichteter Schwerpunkt der verbundenen Content-Seeds. Neue Content-Knoten ohne Seed übernehmen den relativen Offset ihres Primär-Hubs.
   - D3-, Vis- und 3D-Solver starten bei Seeds mit ruhigerer Temperatur (`alpha = 0.45` bzw. Vis-`heat = 0.45`). Sync- und Async-Varianten teilen sich dieselbe Init-Funktion (`maxDelta = 0.0000 px`).
   - **Kaltpfad bleibt bit-identisch:** Ohne `seedPositions` wird kein Warm-Code ausgeführt (`heat = 1`, kein `alpha`-Override), damit gecachte statische Layouts gültig bleiben.
   - **Live-Tuning ist immer warm:** Physik-/K-Tuning übergibt die aktuellen Live-Positionen (`forcePositions`, Cytoscape `modelPositions`), sodass Drag-and-Drop-Anpassungen erhalten bleiben. Nur `applyTuning('reset')` kehrt zu `initialForcePositions` und Default-K zurück.
2. **Jaccard-Farbvererbung (`reclusterCanonicalGraphPayload(canonical, K, previousNodes?)`):**
   - Neue Cluster werden über das Jaccard-Maß der Tag-Mengen (`memberTags`) greedy (höchste Ähnlichkeit zuerst, `sim > 0`) den vorherigen Clustern zugeordnet. Treffer erben **exakt** `colorDark/colorLight` und erhalten `originClusterId` + `originKind = 'match'`.
   - Nicht zugeordnete (abgespaltene) Cluster erhalten das erste unbenutzte `CLUSTER_PALETTE`-Paar und `originKind = 'split'` mit dem Alt-Cluster der größten Tag-Überlappung als Ursprung. Verschwindende Alt-Cluster (K sinkt) werden in `mergeTargetByOldClusterId` auf den überlappungsstärksten neuen Cluster abgebildet. Content-Knotenfarben werden mit den stabilisierten Cluster-Farben per `mixHexColorsOklab` neu berechnet.
3. **Split-/Merge-Pill-Morphing (~`520 ms`, `easeHighlightTransition`):**
   - Gemeinsame Helfer in [`graph-payload.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/graph-payload.ts) (`createKChangeTransition`, `sampleKChangeNodePosition/NodeColor/ClusterPill/GhostPills`, `resolveKChangeCanonical`, `computeKChangeStartPositions`) und der Controller [`graph-k-transition.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/graph-k-transition.ts) steuern alle fünf Engines identisch: Content-Knoten interpolieren Position und OKLab-Farbe; fortgesetzte Cluster gleiten Alt→Neu; neu gespaltene Cluster spawnen an der Eltern-Position (`alpha 0 → 0.97`); verschwindende Cluster bleiben als Ghost-Pill bestehen und gleiten zum Merge-Ziel (`alpha 0.97 → 0`). Overlay: 2D-Canvas (Cytoscape/Sigma/Vis/3D via `alphaOverride`), temporäre SVG-`<g class="cluster-pill">` in D3.
4. **D3-Pill-Messregeln (kein Flackern, exakter Textrahmen):**
   - `formatClusterLabelShort` kürzt erst ab `44` Zeichen (`slice(0, 42) + '…'`); `measureTextWidthPx` addiert `+4 px` Sicherheitsrand (SSR-Fallback `length · 6.35`).
   - D3 wartet in `init()` auf `document.fonts.ready`, setzt explizit `font-family/size/weight` und rahmt jede Pill synchron in `syncD3ClusterPillGeometry` (vor dem ersten Paint): `textW = ceil(max(getComputedTextLength, getBBox().width))`, `pillW = ceil(11 + textW + 2·9)` mit symmetrischem 9-px-Innenabstand (Punkt-Radius 3, Lücke 5). E2E prüft `rect.right − text.right ≥ 4`, `dot.left − rect.left ≥ 4` und Symmetrie ≤ 4 px.
5. **Validierungs-Gates (`validate:vis`, Gate 3b):** Warm-Start-Determinismus, Sync/Async-Parität, Farbvererbung K=4→5→4, Merge-Targets, Label-Länge ≤ 44 und unveränderter Kaltpfad.

---

## 4b. Etappe 2: Umgesetzter Timeline-Player (`SOLVER_VERSION = 'v22'`)

Der Timeline-Player ist implementiert (alle 5 Engines). Design-Entscheidungen:

1. **Granularität:** Jedes Content-Item ist ein eigener Schritt (aktuell 223 Schritte), sortiert nach `timestamp` (UTC-ms aus `pubDate`, stabiler Tie-Break per `id`, undatierte Items zuletzt). Neues Feld `GraphNodePayload.timestamp`. Schritt `s` zeigt exakt `s + 1` Items; die Sichtbarkeitsmenge wächst streng monoton.
2. **Feste End-Cluster & organisches Erscheinen (`buildTemporalGraphKeyframes`):** Die finale Cluster-Topologie für `K_target` (Default `3` für 2D-Engines, `4` für `3d-force-graph`) wird **einmalig** auf dem Gesamtkorpus berechnet (`finalCanonical`). Während der Timeline erfolgt **kein** temporäres Re-Clustering und keine Farbverschiebung: Jeder Schritt `s` zeigt die chronologischen Content-Items `0..s` mit ihren **exakten finalen Kanten-Gewichten und OKLab-Farben** sowie ausschließlich jene Themen-Cluster (`group === 0`), die bereits mindestens ein aktives Content-Item besitzen.
3. **Sichtbarkeits-Wachstum:** Sobald ein zuvor verborgenes Cluster sein erstes Item erhält, erscheint es sanft per Fade-in (`0 -> 0.97` über `520 ms`) am Schwerpunkt seiner aktiven Items (und blendet beim Rückwärts-Scrubben als Ghost-Pill aus). Der UI-Zähler `N Items · K Clusters` meldet die Anzahl der aktuell aktiven Cluster.
4. **100 % Identitäts- & Farbstabilität:** Da die Partition fest bleibt, behalten alle Themen-Cluster vom ersten Erscheinen bis zum Ende ihre exakte `id`, `name` und `colorDark/colorLight` (`0` Umbenennungen, `0` Farbwechsel, `0` Gewichts-Drift; letzter Schritt = `0.0000 px` Parität zum statischen Graphen). Bei manueller Änderung des `K`-Sliders wird `buildTemporalGraphKeyframes(canonical, newKTarget)` sofort neu aufgebaut.
5. **Positionen:** Bestehende Knoten behalten ihre Live-Position (Drag-Anpassungen bleiben erhalten). Neue Cluster spawnen am Ursprungs-Cluster (Geschwister `20 px · Rang` versetzt), neue Items am Barycentrum ihrer Cluster (`w^2.1`) auf dem ersten freien Platz (`computeTimelineStartPositions`, nie im Ursprung, ohne Überlappung/Pill-Box). Nur bei Re-Clustering-Schritten läuft der asynchrone Warm-Start-Solver (Latest-Wins-Abbruch, Cache pro `von->nach | K | Physik | Seed-Signatur`) und anschließend der 520-ms-Cluster-Morph; zwischen Re-Clusterings gibt es keinen Solver-Lauf.
6. **FX:** Neue Items blenden per `sampleTimelineNodeFx` ein (alpha 0→1, Skalierung 0.35→1, 320 ms), entfernte Items blenden als Ghost-Knoten aus; pro Knoten unabhängig, damit schnelle Schritte nicht abgeschnitten werden.
7. **Controller:** [`graph-timeline-controller.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/graph-timeline-controller.ts) ist engine-agnostisch; jede Engine liefert nur einen `TimelineAdapter` (`applySnapshot`, `solveWarm`, `playMorph`, `setNodeFx`, Live-/Ruhepositionen). Wiedergabe: 4 Schritte/s bei `1x` (~56 s Gesamtlauf), `2x` halbiert, `0.5x` verdoppelt. Scrubben: ein Apply pro Frame, Solver latest-wins. `prefers-reduced-motion`: kein animierter Morph (1 ms) und kurzes 120-ms-Fade.
8. **UI & Layouts:** Kompakte, reduzierte Leiste `#timeline-bar` direkt über der Filterleiste (Schritt zurück/vor, Play/Pause mit `Space`, vollbreiter Scrubber `#timeline-scrubber`; ohne Datums-, Zähler- oder Speed-UI). Play am Ende startet von vorn; Tune-Reset und Layoutwechsel führen zum Endzustand zurück. Die Timeline wirkt nur im **Force-Layout**; in Radial/Columns ist die Leiste deaktiviert (Tooltip: "The timeline is available in the force-directed layout"). Tune-Änderungen während eines Laufs invalidieren den Cache und wenden den aktuellen Schritt mit neuem `K_target` an.
10. **Hintergrund-Solve statt Live-Iteration (v22):** Ein Schritt wird vollständig headless gelöst (warm aus den Live-Positionen, bis zu 2 bzw. 3 Runden bis `maxDelta < 4/1 px`, `shouldCancel` = Latest-Wins) — das sichtbare Layout bleibt währenddessen unverändert. Erst mit fertigen Zielpositionen wird die Topologie getauscht und alles gemeinsam in ~520 ms animiert (Positionen, Farben, Ein-/Ausblenden, Pill-Morphing). Die Wiedergabe ist konvergenz-gesteuert: nächster Schritt erst nach Solve + Animation + Mindest-Verweildauer (`0.5x/1x/2x` = 2000/1000/500 ms/4); `stats.playbackViolations` und `stepLog` (`startedAt/animStartedAt/settledAt`) belegen das im E2E. Beim Scrubben liefern abgeschlossene Schritte einen Cache (`settledCache`) für sofortige Reaktion.
11. **Mental-Map-Stabilität (Final-Layout-Seeded + Procrustes-to-Final + $u^2$-Blend, ankerfrei):**
    - **Ankerfrei (`TIMELINE_ANCHOR_ENABLED = false`, `TIMELINE_CLUSTER_ANCHOR_ENABLED = false`):** Alle Knoten (Content und Cluster) konvergieren in jedem Zwischenschritt $t < T - 1$ völlig frei ohne künstliche Anker-Federn.
    - **Final-Layout-Seeding:** Jeder Zwischenschritt $t$ wird deterministisch und pfadunabhängig aus den auf die aktiven Knoten gefilterten End-Koordinaten (`finalPositions`, also `initialForcePositions` bzw. gelöstem `kTarget`-Endlayout) geseedet. Vorwärts-Play und Rückwärts-Scrubben liefern für Schritt $t$ bit-identische Layouts.
    - **Procrustes-to-Final + quadratischer Blend ($u^2$):** Das frei konvergierte Layout wird per Cluster-gewichtetem Procrustes (`computeFinalLayoutAlignmentWeights`: Cluster `1.0`, Content `0.01`) direkt auf das gefilterte `finalPositions` ausgerichtet und mit $\text{blend} = (t / (T - 1))^2$ weich auf das Endlayout übergeblendet (`0 %` am Start, `25 %` in der Mitte, `100 %` am Ende; `0.0000 px` statische Parität, `N-2 -> N-1` Rotation `< 5°`).
    - **Gates:** `validate:vis` Gate 3c/3d (Schritt-Determinismus `0.0000 px`, `N-2 -> N-1` Rotation `< 5°`, Cluster-Zentrierung `offset/intra < 0.85`, topische Separation) und `test:vis:e2e` Check 6 über alle 5 Engines.

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
