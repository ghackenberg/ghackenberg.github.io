# Georg Hackenberg - Personal Website

This repository contains the codebase for the personal website of Dr. Georg Hackenberg, Professor for Industrial Informatics, software engineer, and entrepreneur.

The site is built using **Astro** and **Tailwind CSS v4**, and is hosted at [hackenberg.tech](https://hackenberg.tech/).

## Local Development

To run the project locally, install dependencies and start the development server:

```bash
npm install
npm run dev
```

### Agentic SEO & Analytics Tooling (MCP)

This repository includes a bespoke Model Context Protocol (MCP) server under `scripts/mcp-unified-analytics/` that consolidates Google Search Console (GSC) and Plausible Analytics. It is registered in `.agents/mcp_config.json` for AI coding agents.

To set up and link the MCP server on any new device or checkout:

```powershell
npm run setup:mcp
```

Create `scripts/mcp-unified-analytics/.env` from `.env.example` with your GSC service account and Plausible credentials.

## Deployment

The website is deployed automatically via GitHub Actions (defined in `.github/workflows/deploy.yml`) on every push to the `main` branch.
