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
| **SYSTEM-004** | Content Manifest & Notification Linter | Data Integrity / CI | Hoch | `proposed` | [004-content-manifest-linter.md](./system/004-content-manifest-linter.md) |
| **SYSTEM-005** | Semantisches Section-Visibility-Tracking | Analytics / UX | Hoch | `planned` | [005-semantic-section-tracking.md](./system/005-semantic-section-tracking.md) |

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
