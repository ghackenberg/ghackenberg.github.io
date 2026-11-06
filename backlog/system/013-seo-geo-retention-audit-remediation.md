# SYSTEM-013: Ganzheitliche SEO-, GEO/AIO- & Reader-Retention-Remediation (Audit 11/2026)

- **ID:** `SYSTEM-013`
- **Kategorie / Domäne:** `SEO / GEO / Analytics / Content Architecture / UX Retention`
- **Status:** `implemented`
- **Priorität / Hebel:** `Hoch` (Behebung von Telemetrie-Bugs, Erschließung von >500 GSC-Impressionen im Graph-Cluster, Eliminierung verwaister 2026-Artikel und Beseitigung von 100%-Bounce-Raten)
- **Erstellt am:** `2026-11-06`
- **Ursprung:** Session 2026-11-06 (Vollständiges Site-Audit über Google Search Console, Plausible Analytics, `scan_aio_readiness`, `audit_serp_snippets` und `analyze_internal_links`)

---

## 1. Problem & Motivation

Eine kombinierte Auswertung der organischen Suchdaten (Google Search Console), der Interaktions- und Scroll-Telemetrie (Plausible Analytics) sowie der statischen Content-Qualitäts-Scanner (`scanAllContentAio`, `auditSerpSnippets`, `analyzeInternalLinks`) vom `2026-11-06` (28-Tage-Fenster: `927` GSC-Impressionen, `20` Klicks, `2,16 %` CTR, Ø-Position `9,9`; `153` Besucher, `284` Seitenaufrufe) hat fünf strukturelle Engpässe offengelegt:

1. **Telemetrie-Bug bei benutzerdefinierten Zeiträumen (`last_14_days`, `last_90_days`) & falsch-negative GEO/AIO-Bewertung:**
   - In [`src/commons/server/analytics/clients/plausible.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/analytics/clients/plausible.ts) rufen `getPlausibleSiteOverview` und `getPlausibleTrafficSources` noch den veralteten Helper `mapPeriodToPlausible(period)` statt `resolvePlausibleParams(period)` auf. Bei `last_14_days` und `last_90_days` wird dadurch zwar `period=custom` gesetzt, aber der zwingend erforderliche Query-Parameter `date=YYYY-MM-DD,YYYY-MM-DD` weggelassen — die Plausible-API quittiert dies mit `HTTP 400 Bad Request` und liefert fälschlich `0` Besucher zurück.
   - Gleichzeitig prüft [`src/commons/server/analytics/services/aio-evaluator.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/analytics/services/aio-evaluator.ts) beim Scannen von Markdown-Quelldateien (`src/content/**`) per Regex auf eingebettete `"@context": "https://schema.org"`-Strings im Rohtext. Da unsere Astro-Architektur Schema.org JSON-LD (`BlogPosting`, `SoftwareApplication`, `Course`, `LearningResource`, `BreadcrumbList` etc.) zentral zur Build-Zeit über [`src/commons/server/json-ld.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/json-ld.ts), [`src/components/JsonLd.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/JsonLd.astro) und [`src/layouts/Layout.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/layouts/Layout.astro) injiziert, verwehrt der Evaluator sämtlichen Markdown-Dateien die `15` Schema.org-Punkte. Zudem fehlen im Frage-Überschriften-Regex wichtige deutsche Interrogativpronomen (`wer`, `welche[rsmn]`, `wieso`, `weshalb`, `wodurch`, `wozu`, `inwiefern`).

2. **Ungehobenes organisches Suchpotenzial (>500 Impressionen) & 100 % Abbruchrate im Graph-Visualisierungs-Cluster:**
   - Das Themencluster rund um JavaScript-Graph-Bibliotheken vereint über `500` GSC-Impressionen (`/visualizations/cytoscape/`: `341` Impr. bei Pos. `13,4`, CTR `0,59 %`; `/visualizations/sigma/`: `110` Impr. bei Pos. `8,6`, CTR `0,91 %`; `/posts/2015_12_21_javascript_graph_libraries_cytoscape_sigma_d3/`: `42` Impr., `2` Klicks; `/visualizations/d3/`: `15` Impr.).
   - Auf `/visualizations/cytoscape/` und `/visualizations/d3/` liegt die Bounce-Rate bei `100 %` und die mediane Scrolltiefe bei lediglich `30 %`: Besucher interagieren ausschließlich mit dem `500px` hohen WebGL-/Canvas-Viewport in [`src/pages/visualizations/[slug].astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/visualizations/[slug].astro), entdecken weder die darunterliegenden Architektur-Vergleiche noch die anderen vier Graph-Engines und verlassen die Seite wieder.
   - Der historische Vergleichsartikel [`src/content/posts/2015_12_21_javascript_graph_libraries_cytoscape_sigma_d3/index.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/posts/2015_12_21_javascript_graph_libraries_cytoscape_sigma_d3/index.md) verzeichnet ebenfalls `100 %` Bounce-Rate, da am Artikelanfang ein direkter Verweis auf die fünf modernen interaktiven Sandboxes (`/visualizations/*`) und die 2026er Tiefenanalysen fehlt.

3. **Verwaiste moderne Architektur-Artikel (Orphan Pages) & fehlende Cross-Domain-Verlinkung:**
   - Die interne Link-Analyse (`analyzeInternalLinks`) zeigt, dass `14`–`15` neu erschienene technische Deep-Dive-Artikel aus dem Zeitraum `2026_10_16` bis `2026_11_08` sowie alle fünf `/visualizations/*`-Detailseiten `0` eingehende Markdown-Body-Links (`inboundCount === 0`) aus anderen Artikeln besitzen. Dadurch fehlt sowohl für Suchmaschinen-Crawler (PageRank-Fluss) als auch für Leser ein kuratierter Pfad zwischen thematisch eng verwandten Beiträgen.

4. **SERP-Titel-Trunkierung (>60 Zeichen) & 0 % Preview-Card-CTR auf der Startseite:**
   - Fast alle modernen 2026er Blogposts weisen Frontmatter-Titel zwischen `66` und `98` Zeichen auf, die im Browser-Title-Tag durch das Suffix ` | Dr. Georg Hackenberg` zusätzlich verlängert und in Google-SERPs abgeschnitten werden.
   - In Plausible weisen genau diese Artikel auf der Startseite hohe Sichtbarkeit (`Card Viewed`: `26x` bei `2026_10_24_zero_artifact_repositories...`, `21x` bei `2026_10_22_emergent_properties...`, `21x` bei `2026_10_23_webmcp...`), aber `0` Klicks (`0 %` Card-CTR) auf, während prägnant betitelte Artikel wie `2026_10_05_wie_promptet_man_richtig` `30 %` CTR (`10` Views $\rightarrow$ `3` Klicks) erzielen. Auch Hub-Seiten mit Top-10-Rankings (`/publications/` Pos. `7,4` bei `88` Impr.; `/services/` Pos. `5,0` bei `19` Impr.; `/projects/caddrive/` Pos. `8,1` bei `11` Impr.) stehen bei `0` Klicks.

5. **Zu kurze Kurs-Titel (<30 Zeichen) & knappe Modul-Kurzbeschreibungen (<110 Zeichen):**
   - Im Hochschulbereich (`src/content/courses/` und `src/content/course-modules/`) rankt `/courses/course-digital-factory/` bereits auf Position `7,1` für Suchanfragen wie `"digital factory simulation"`, nutzt aber nur den generischen 15-Zeichen-Titel `"Digital Factory"`. Zudem unterschreiten sämtliche `45` Kursmodule die empfohlene Meta-Description-Mindestlänge von `110–160` Zeichen.

---

## 2. Ziel-Architektur & Arbeitspakete (`SYSTEM-013`)

Die Remediation gliedert sich in fünf klar abgegrenzte, inkrementell verifizierbare Arbeitspakete (`AP1` bis `AP5`):

### 2.1 Arbeitspaket 1 (`AP1`, Priorität P0): Analytics & AIO Evaluator Hardening

1. **Plausible Custom-Date-Range-Fix in [`src/commons/server/analytics/clients/plausible.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/analytics/clients/plausible.ts):**
   - Umstellung von `getPlausibleSiteOverview` und `getPlausibleTrafficSources` von `mapPeriodToPlausible(period)` auf `const { period: plausiblePeriod, date: plausibleDate } = resolvePlausibleParams(period)`.
   - Wenn `plausibleDate` definiert ist (`last_14_days` / `14d` bzw. `last_90_days` / `90d`), wird `url.searchParams.set('date', plausibleDate)` an den `/api/v1/stats/aggregate`- bzw. `/api/v1/stats/breakdown`-Request angehängt.

2. **Architektur-konforme Schema.org-Erkennung & deutsche Interrogativ-Abdeckung in [`src/commons/server/analytics/services/aio-evaluator.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/analytics/services/aio-evaluator.ts):**
   - **Build-Time JSON-LD Credit:** Da jede über [`src/layouts/Layout.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/layouts/Layout.astro) und [`src/commons/server/json-ld.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/json-ld.ts) gerenderte Content-Collection (`posts`, `visualizations`, `courses`, `course-modules`, `publications`, `presentations`, `projects`, `services`, `service-modules`, `newsletters`, `tags`) sowie die Seiten-Templates in `src/pages/` deterministisch einen validen `@graph` mit `BreadcrumbList` und domänenspezifischen Schema-Typen (`BlogPosting`, `SoftwareApplication`, `WebApplication`, `Course`, `LearningResource`, `ScholarlyArticle`, `PresentationDigitalDocument`, `Service`, `Article`) erhalten, erkennt `evaluateContentString` den Collection-/Template-Kontext anhand von `filePath` bzw. `target` + gültigem Frontmatter und schreibt die erzeugten Schema-Typen gut.
   - **Erweiterte Frage-Überschriften-Erkennung (`questionHeadingRegex`):** Erweiterung des Regex für H2-/H3-Überschriften (inkl. optionaler Abschnittsnummerierung wie `## 1. Warum ...` oder `### 2.1 Wie ...`) um sämtliche deutschen und englischen Fragewörter:
     `wie|warum|was|wann|wo|wer|welche[rsmn]?|wieso|weshalb|wodurch|wozu|inwiefern|how|what|why|which|when|where|who`.

---

### 2.2 Arbeitspaket 2 (`AP2`, Priorität P0): Graph Visualization Cluster SEO & Canvas UX Retention

1. **SERP-Optimierung der 5 Graph-Visualisierungs-Seiten (`src/content/visualizations/*.md`):**
   - Schärfung von `title` (`35–60` Zeichen) und `description` (`140–160` Zeichen) für:
     - [`src/content/visualizations/cytoscape.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/cytoscape.md) (`/visualizations/cytoscape/`)
     - [`src/content/visualizations/sigma.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/sigma.md) (`/visualizations/sigma/`)
     - [`src/content/visualizations/d3.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/d3.md) (`/visualizations/d3/`)
     - [`src/content/visualizations/vis-network.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/vis-network.md) (`/visualizations/vis-network/`)
     - [`src/content/visualizations/3d-force-graph/index.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/visualizations/3d-force-graph/index.md) (`/visualizations/3d-force-graph/`, kanonische URL-Ausrichtung auf das npm-Paket `3d-force-graph` inkl. permanentem GitHub-Pages-Redirect von `/visualizations/3d-force/` auf `/visualizations/3d-force-graph/` in [`astro.config.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/astro.config.ts))
   - Gezielte Abdeckung der nachgefragten Suchbegriffe (`Cytoscape.js`, `Sigma.js`, `D3-Force`, `Vis-Network`, `3D Force Graph`, `Interactive Knowledge Graph Demo`, `WebGL vs. Canvas Benchmark`).

2. **Above-the-Fold Engine-Switcher & Architektur-Linkleiste in [`src/pages/visualizations/[slug].astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/visualizations/[slug].astro):**
   - Integration einer kompakten, deklarativ getrackten (`data-track-event`) Navigations- und Vergleichsleiste unmittelbar am Canvas-Viewport, über die Besucher mit einem Klick zwischen den fünf Live-Engines (`Cytoscape.js`, `Sigma.js`, `D3.js`, `Vis-Network`, `3D Force`) wechseln oder direkt zum Architektur-Deep-Dive springen können.

3. **2026-Update-Callout im historischen Graph-Artikel [`src/content/posts/2015_12_21_javascript_graph_libraries_cytoscape_sigma_d3/index.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/posts/2015_12_21_javascript_graph_libraries_cytoscape_sigma_d3/index.md):**
   - Ergänzung eines prominenten Hinweisblocks direkt im Einstieg mit direkten Links auf die fünf interaktiven 2026-Demos (`/visualizations/*`) sowie den aktuellen Architektur-Vergleich (`/posts/2026_11_05_five_graph_engines_unified_interaction_physics/`).

---

### 2.3 Arbeitspaket 3 (`AP3`, Priorität P1): Internal Link Graph Mesh & Orphan Elimination

1. **Bidirektionale Vernetzung der 14+ verwaisten modernen Blogposts (`2026_10_16` bis `2026_11_08`):**
   - Systematische Integration kontextueller Markdown-Body-Links zwischen den thematischen Clustern:
     - **Knowledge Graph & Visualisierungs-Cluster:** `2026_11_04_focus_aware_hop_attenuation_knowledge_graphs`, `2026_11_05_five_graph_engines_unified_interaction_physics`, `2026_11_06_voronoi_proximity_picking_touch_graph_interaction` $\leftrightarrow$ alle 5 `/visualizations/*`-Seiten sowie `2026_10_17_elliptical_bin_packing_tag_cloud_layout_engine`.
     - **Build-, Content-Layer- & Asset-Governance-Cluster:** `2026_10_16_schema_org_image_object_metadata_asset_governance`, `2026_10_24_zero_artifact_repositories_content_addressable_build_caching`, `2026_10_25_single_root_json_ld_knowledge_graph_validator`, `2026_10_29_foit_free_vector_branding_svg_path_compilation`, `2026_11_07_three_band_figures_adaptive_svg_color_governance`, `2026_11_08_astro_content_layer_merkle_asset_digesting`.
     - **Frontend-, Agentic-Web- & Privacy-Analytics-Cluster:** `2026_10_18_consent_free_markov_chain_visitor_flows_plausible`, `2026_10_20_newsletter_as_code_react_email_listmonk_altcha_pow`, `2026_10_22_emergent_properties_history_theory_ai_security_incidents`, `2026_10_23_webmcp_w3c_standard_architecture_history_future`, `2026_10_27_priority_plus_navigation_ten_domain_color_spectrum`, `2026_11_02_zero_innerhtml_architecture_preact_nanostores`.

---

### 2.4 Arbeitspaket 4 (`AP4`, Priorität P1): SERP Snippet & Preview Card CTR Optimization (2026 Posts & Hubs)

1. **Prägnante SERP- & Card-Titel (`<60` Zeichen) sowie Descriptions (`140–160` Zeichen) für moderne 2026er Posts:**
   - Überarbeitung bzw. Entkopplung überlanger Titel (>65 Zeichen) und inkonsistenter Kurzbeschreibungen in den 2026er Beiträgen, sodass sowohl Google-SERPs (ohne Ellipsen-Abbruch) als auch die Preview-Cards auf der Startseite (`Card Viewed` $\rightarrow$ `Card Clicked`) einen klaren Click-Hook bieten.
2. **Meta-Optimierung reichweitenstarker Hub- und Projektseiten:**
   - Gezieltes Schärfen der `<title>`- und `<meta name="description">`-Attribute auf [`src/pages/publications/index.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/publications/index.astro), [`src/pages/services.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/services.astro) und [`src/content/projects/caddrive/index.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/projects/caddrive/index.md).

---

### 2.5 Arbeitspaket 5 (`AP5`, Priorität P2): University Course & Module Snippet Expansion

1. **Aussagekräftige Kurstitel (`30–60` Zeichen) für alle 9 Hochschulkurse (`src/content/courses/**/index.md`):**
   - Insbesondere Erweiterung von [`src/content/courses/course-digital-factory/index.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/courses/course-digital-factory/index.md) für das Suchcluster `"Digital Factory Simulation & Production Engineering"` sowie Harmonisierung der weiteren 8 Kurstitel.
2. **Ausbau der Modul-Kurzbeschreibungen (`120–158` Zeichen) über alle 45 Kursmodule (`src/content/course-modules/**/*.md`):**
   - Ersatz der bisherigen Ein-Satz-Kurztexte (<100 Zeichen) durch präzise, keyword-reiche Zusammenfassungen der vermittelten Methoden, Algorithmen und Lernziele.

---

## 3. Betroffene Dateien & Komponenten

| Datei / Modul | Geplante Änderung im Rahmen von `SYSTEM-013` |
| :--- | :--- |
| [`src/commons/server/analytics/clients/plausible.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/analytics/clients/plausible.ts) | **AP1:** Nutzung von `resolvePlausibleParams(period)` inkl. `date`-Query-Parameter in `getPlausibleSiteOverview` und `getPlausibleTrafficSources`. |
| [`src/commons/server/analytics/services/aio-evaluator.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/analytics/services/aio-evaluator.ts) | **AP1:** Anerkennung der Build-Time-JSON-LD-Injektion (`Layout.astro` / `json-ld.ts`) für Content-Collections sowie Erweiterung des `questionHeadingRegex` um deutsche Interrogative. |
| [`src/pages/visualizations/[slug].astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/visualizations/[slug].astro) & `src/content/visualizations/*.md` | **AP2:** SERP-Snippet-Optimierung für das 500+-Impressionen-Cluster sowie Above-the-Fold Engine-Switcher und Architektur-Deep-Dive-Verlinkung. |
| [`src/content/posts/2015_12_21_javascript_graph_libraries_cytoscape_sigma_d3/index.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/posts/2015_12_21_javascript_graph_libraries_cytoscape_sigma_d3/index.md) | **AP2:** Prominenter 2026-Update-Callout mit Links zu den 5 interaktiven Graph-Demos und den 2026er Benchmark-Artikeln. |
| `src/content/posts/2026_*/index.md` | **AP3 & AP4:** Bidirektionale interne Verlinkung zur Beseitigung aller 2026er Orphan-Posts sowie Optimierung der SERP-/Card-Titel (`<60` Zeichen) und Descriptions (`140–160` Zeichen). |
| [`src/pages/publications/index.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/publications/index.astro), [`src/pages/services.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/services.astro), [`src/content/projects/caddrive/index.md`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content/projects/caddrive/index.md) | **AP4:** CTR-Optimierung der Hub- und Projekt-Snippets. |
| `src/content/courses/**/index.md` & `src/content/course-modules/**/*.md` | **AP5:** Ausbau zu kurzer Kurstitel (`<30` Zeichen) und knapper Modul-Descriptions (`<110` Zeichen) auf optimale SERP-Länge. |

---

## 4. Offene Design-Entscheidungen & Klärungspunkte

- [x] **Q1 (Reihenfolge der Umsetzung):** Sequenzielle Umsetzung von `AP1` (Analytics & Evaluator) $\rightarrow$ `AP2` (Graph-Visualisierungs-Cluster) $\rightarrow$ `AP3` (Interne Verlinkung) $\rightarrow$ `AP4` (SERP/Card-Snippets) $\rightarrow$ `AP5` (Kurse & Module) auf dem Feature-Branch `feat/seo-geo-retention-remediation`, damit die gehärteten Diagnose-Tools aus `AP1` unmittelbar als Verifikations-Gate für `AP2`–`AP5` dienen.
- [x] **Q2 (Beibehaltung der Artikel-Kernaussagen):** Bei der Schärfung von Titeln, Descriptions und internen Links bleiben sämtliche technischen Aussagen, Zitationen (`[@id]`) und bestehenden Such-Rankings unangetastet.

---

## 5. Erwarteter Nutzen & Akzeptanzkriterien

- **Fehlerfreie 14d/90d-Plausible-Abfragen (`AP1`):** `getSiteOverview('last_90_days')` und `getTrafficSourcesReport('last_90_days')` liefern valide Plausible-Aggregatdaten ohne `HTTP 400`-Fehler.
- **Präzise GEO/AIO-Bewertung (`AP1`):** `scanAllContentAio()` erkennt die über [`src/layouts/Layout.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/layouts/Layout.astro) und [`src/commons/server/json-ld.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/json-ld.ts) injizierten Schema.org-Typen sowie deutsche Frage-Überschriften zuverlässig.
- **Eliminierung moderner Orphan-Pages (`AP3`):** `analyzeInternalLinks()` meldet `0` verwaiste Artikel aus dem Jahrgang 2026 und `0` verwaiste `/visualizations/*`-Seiten.
- **SERP- & Build-Integrität (`AP2`–`AP5`):** `auditSerpSnippets` zeigt signifikant reduzierte Snippet-Längenfehler; `npm run verify` läuft mit `0` Fehlern und `0` Warnungen durch.

---

## 6. Ergebnis-Telemetrie & Verifikations-Metriken (Stand `2026-11-06`)

| Metrik / Prüf-Gate | Vorher (Baseline Audit) | Nachher (`AP1`–`AP5` umgesetzt) |
| :--- | :--- | :--- |
| **Plausible `last_14_days` / `last_90_days` API** | `HTTP 400 Bad Request` (`0` Besucher wegen fehlendem `date`-Parameter) | `HTTP 200 OK` (valide Zeitreihen- und Traffic-Sources-Aggregation via `resolvePlausibleParams`) |
| **GEO/AIO Schema.org & Frage-Erkennung (`scanAllContentAio`)** | `0` Punkte für Build-Time JSON-LD in Markdown-Collections; Ø-Score `31` | Volle Anerkennung des `Layout.astro`/`json-ld.ts` `@graph` + erweiterte deutsche Interrogative; Ø-Score `50` (`85–100` auf modernen 2026er Posts) |
| **Interne Verlinkung & Moderne Orphans (`auditInternalLinking`)** | `14` verwaiste 2026er Deep-Dive-Artikel (`2026_10_16`–`2026_11_08`) & `5` verwaiste `/visualizations/*`-Seiten | `0` verwaiste moderne Artikel (`2026_10_16`–`2026_11_08`), `0` verwaiste `/visualizations/*`-Seiten, `774` interne Body-Links |
| **SERP-Snippet-Audit (`auditSerpSnippets` über 224 Dateien)** | `178` Snippet-Fehler auf `143` Seiten (`posts`, `visualizations`, `courses` inkl. Module) | **`0` Snippet-Fehler auf `0` Seiten** über alle `224` auditierten Dateien sowie `0` Verletzungen in `projects` und `services` |
| **Master Release Gate (`npm run verify`)** | — | `0` Fehler, `0` Warnungen über ESLint, `astro check`, `lint:posts`, Citation-Parity, Astro-SSG-Build und 6-Gate JSON-LD Postbuild-Validator |
