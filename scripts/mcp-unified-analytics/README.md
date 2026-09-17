# Unified Analytics MCP Server

A lightweight, local Model Context Protocol (MCP) server that seamlessly unifies **Google Search Console (GSC)** and **Plausible Analytics** for autonomous SEO, GEO (Generative Engine Optimization), and AIO (AI Overviews) workflows.

## Features

- **Deterministic Joins:** Resolves trailing slash, URL scheme, and domain differences to merge search performance and on-site engagement per URL path deterministically.
- **Token Efficiency:** Pre-aggregates metrics locally before serving structured JSON to the LLM agent, preserving context window budget.
- **12 Specialized Tools:**
  - `get_site_overview`: Domain-wide consolidated search performance (GSC) and visitor engagement (Plausible).
  - `get_traffic_sources`: Breakdown of traffic channels and referrers with visitor counts, bounce rate, and visit duration.
  - `get_top_search_queries`: Domain-wide search query rankings, impressions, clicks, and CTR from GSC.
  - `find_retention_bottlenecks`: Identification of dead-end pages with high bounce rates or low durations.
  - `get_page_audit`: Consolidated GSC + Plausible metrics for any path.
  - `find_seo_opportunities`: Heuristic scanner identifying striking distance rankings, high-bounce top performers, underperforming SERP snippets, and hidden champions.
  - `inspect_url_index_status`: Live GSC URL Inspection API wrapper for indexing state, canonical checks, and crawl timestamps.
  - `evaluate_aio_extractability`: Source content auditor for LLM citability, question-oriented headings, direct answers, tables, and Schema.org metadata.
  - `scan_aio_readiness`: Batch scanner for markdown collections to compute AIO extractability scores.
  - `audit_internal_linking`: Orphan page detector and internal backlink opportunity scanner.
  - `audit_serp_snippets`: SERP snippet length and keyword inclusion auditor.
  - `diff_aio_impact`: Impact evaluation comparing current content against Git revisions.

## Setup & Installation

From the repository root, run:

```powershell
npm run setup:mcp
```

This installs dependencies, builds the TypeScript sources into `dist/`, and globally registers the `mcp-unified-analytics` binary via `npm link`.

### Configuration (`.env`)

Copy `.env.example` to `.env` in this directory:

```env
# Google Search Console
GSC_SITE_URL="sc-domain:hackenberg.tech"
GSC_SERVICE_ACCOUNT_KEY_FILE="./service-account.json"

# Plausible Analytics
PLAUSIBLE_API_KEY="your_api_token"
PLAUSIBLE_SITE_ID="hackenberg.tech"
PLAUSIBLE_HOST="https://analytics.mentawise.com"

# Site Settings
SITE_BASE_URL="https://hackenberg.tech"
```

## Antigravity Integration

The server is registered in `.agents/mcp_config.json`:

```json
{
  "mcpServers": {
    "unified-analytics": {
      "command": "npx",
      "args": ["mcp-unified-analytics"]
    }
  }
}
```

Since it uses `npx mcp-unified-analytics`, it operates identically regardless of absolute path, operating system, or username.
