# Project Backlog & RFC Register

Dieses Verzeichnis dient der formalen Konservierung, Spezifikation und Priorisierung von künftigen **System-Initiativen** (Website-Features, MCP-Server, CLI-Generatoren, Linter) und **Inhalts-Ideen** (Blog-Posts, Vorträge, Kurse).

---

## 1. System & Tooling (`backlog/system/`)

Initiativen, die das Zusammenspiel aus Frontend-Features auf `hackenberg.tech` und den zugehörigen Agenten-Werkzeugen (MCP-Server, Linter, CI-Skripte) betreffen.

| ID | Name | Domäne | Hebel / Priorität | Status | Spezifikation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SYSTEM-001** | Slide-Engine MCP | Presentations | Hoch | `proposed` | [001-slide-engine-mcp.md](./system/001-slide-engine-mcp.md) |
| **SYSTEM-002** | Visual Asset Graph MCP | Images / Content | Hoch | `proposed` | [002-visual-asset-graph-mcp.md](./system/002-visual-asset-graph-mcp.md) |
| **SYSTEM-003** | Content Interview Gatekeeper | Content Creation | Mittel | `proposed` | [003-content-interview-gate.md](./system/003-content-interview-gate.md) |
| **SYSTEM-004** | Content Manifest Integrity Linter | Data Integrity / CI | Hoch | `proposed` | [004-content-manifest-linter.md](./system/004-content-manifest-linter.md) |
| **SYSTEM-005** | Semantisches Section-Visibility-Tracking | Analytics / UX | Hoch | `planned` | [005-semantic-section-tracking.md](./system/005-semantic-section-tracking.md) |
| **SYSTEM-006** | Content Preview Image Rollout | Visual Design | Mittel | `planned` | [006-content-preview-image-rollout.md](./system/006-content-preview-image-rollout.md) |
| **SYSTEM-007** | Design-Token & Layout Linter | CI/CD / QA | Mittel | `proposed` | [007-design-token-and-layout-linter.md](./system/007-design-token-and-layout-linter.md) |
| **SYSTEM-008** | Client-Side W3C WebMCP Progressive Enhancement | Agentic Web / MCP | Hoch | `proposed` | [008-client-webmcp-progressive-enhancement.md](./system/008-client-webmcp-progressive-enhancement.md) |
| **SYSTEM-009** | Client-Script Deduplication, Preact/Nanostores & Zero-`innerHTML` Gate | Frontend Architecture / QA | Hoch | `implemented` | [009-client-script-deduplication-and-preact-dom-hardening.md](./system/009-client-script-deduplication-and-preact-dom-hardening.md) |
| **SYSTEM-010** | Target Audience Profiles Collection, Adaptive Linting & Multi-Persona Review | Content Architecture / CI | Hoch | `proposed` | [010-target-audience-collection-and-adaptive-review.md](./system/010-target-audience-collection-and-adaptive-review.md) |
| **SYSTEM-011** | Quadratisches SVG-Standardformat, Bestands-Migration & Aspect-Ratio-Linter | Visual Design / CI / QA | Mittel | `proposed` | [011-square-svg-aspect-ratio-migration-and-linter.md](./system/011-square-svg-aspect-ratio-migration-and-linter.md) |
| **SYSTEM-012** | Natives Astro Asset-Hashing, Content-Layer Dependency-Tracking & Ablösung manueller Dev-Watcher-Workarounds | Build Engineering / Content Layer / DX | Mittel | `implemented` | [012-astro-content-layer-asset-hashing-and-dependency-tracking.md](./system/012-astro-content-layer-asset-hashing-and-dependency-tracking.md) |
| **SYSTEM-013** | Ganzheitliche SEO-, GEO/AIO- & Reader-Retention-Remediation (Audit 11/2026) | SEO / GEO / Analytics / UX Retention | Hoch | `implemented` | [013-seo-geo-retention-audit-remediation.md](./system/013-seo-geo-retention-audit-remediation.md) |

---

## 2. Content & Publikationen (`backlog/content/`)

Ideen für künftige Artikel, Hochschulkurse, Keynotes und interaktive Visualisierungen. Neue Ideen nutzen das Template [`TEMPLATE.md`](./content/TEMPLATE.md).

| ID | Titel / Arbeitstitel | Typ | Sprache | Hebel / Priorität | Status | Spezifikation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| *Noch keine offenen Einträge* | — | — | — | — | — | [Vorlage](./content/TEMPLATE.md) |

---

## 3. Status-Definitionen

- `idea`: Erste Skizze / Gedankensammlung.
- `proposed`: Vollständig ausgearbeitete Spezifikation, wartet auf Priorisierung.
- `planned`: Für die Umsetzung in einer der nächsten Arbeits-Sessions eingeplant.
- `in-progress`: Aktuell in aktiver Entwicklung.
- `implemented`: Produktiv im Einsatz (registriert in `package.json`, `.agents/mcp_config.json` oder als veröffentlichter Content).
- `deprecated`: Durch modernere Architektur oder veränderte Prioritäten abgelöst.
