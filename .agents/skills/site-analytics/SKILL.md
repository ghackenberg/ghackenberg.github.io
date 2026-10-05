---
name: site-analytics
description: Query telemetry, analyze reader retention, inspect scroll funnels, and audit visitor behavior using Plausible and the unified-analytics MCP server.
---

# Site Analytics (Telemetry & Performance Metrics)

This skill governs analytics data retrieval, event instrumentation, reader retention analysis, and conversion diagnostics.

## 1. Unified Analytics MCP Server
The primary interface for site intelligence is the co-located `unified-analytics` MCP server (`src/tools/unified-analytics.ts`). Available tools include:
- `get_page_audit({ path: "/posts/..." })`:
  - Returns organic search rankings, top queries, and click-through rates.
  - Returns reader retention milestones (`scrollFunnel`: 25%, 50%, 75%, 100%) and median scroll depth.
  - Highlights browser/device anomaly warnings.
- `find_seo_opportunities()`:
  - Identifies striking-distance keywords (positions 4–15) with high impressions.
- `find_retention_bottlenecks()`:
  - Detects pages with steep drop-offs before key content or CTAs.
- `get_audience_breakdown()`:
  - Analyzes device categories, screen resolutions, operating systems, and countries.
- `scan_aio_readiness()`:
  - Audits collections for answer-first compliance and knowledge graph extraction density.

## 2. Declarative Event Tracking Contract (`data-track-*`)
All user interaction tracking is declarative:
- **Rule**: Never write ad-hoc imperative JavaScript event listeners purely to log metrics or clicks.
- **Attribute Schema**:
  - `data-track-event="<Event Name>"` (e.g. `data-track-event="High Intent: Copy Email"`, `data-track-event="Filter Selected"`).
  - `data-track-<prop-name>="<value>"`: Parsed into event properties (e.g. `data-track-location="header"` $\rightarrow$ `{ location: "header" }`).
  - `data-track-props='{"key": "value"}'`: Optional JSON payload for structured data.

## 3. Automated Viewport Telemetry
- **Semantic Sections & Headings**: Any `<section id="...">` or content heading (`h2`, `h3` in `.post-body`) is tracked automatically by `telemetry.ts` upon achieving 2.0s dwell time at $\ge 50\%$ viewport visibility (`Section Viewed`).
- **Preview Cards**: Any `<article class="preview-card" data-card-id="..." data-collection="...">` is tracked upon achieving 1.5s dwell time at $\ge 50\%$ viewport visibility (`Card Viewed`). Click delegations emit `Card Clicked`.
- **Slide Decks**: `SlideDeck.astro` and `AudioSyncController.ts` emit co-located events: `Slide Viewed`, `Presentation Completed`, `Audio Played`.

## 4. Analytical Workflow for Content Refactoring
Before modifying an existing article or landing page:
1. Run `get_page_audit` on the target path to inspect historical search queries and median scroll reach.
2. Protect existing high-volume queries in headings and body text.
3. Address detected retention bottlenecks (e.g. split long text blocks, add interactive diagrams, insert early answer-first summaries).
