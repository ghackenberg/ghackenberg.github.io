#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getUnifiedPageAudit } from './services/aggregator.js';
import { findSeoOpportunities } from './services/opportunities.js';
import { inspectUrlIndexStatus } from './clients/gsc.js';
import { evaluateAioExtractability } from './services/aio-evaluator.js';

const server = new McpServer({
  name: 'unified-analytics',
  version: '1.0.0',
});

// Tool 1: get_page_audit
server.tool(
  'get_page_audit',
  'Retrieve consolidated SEO and engagement metrics (GSC clicks, impressions, CTR, average ranking position, top queries + Plausible visitors, pageviews, bounce rate, visit duration) for a relative path or full URL.',
  {
    path: z
      .string()
      .describe('Relative URL path (e.g. "/posts/my-post/" or "/") or full URL (https://hackenberg.tech/...)'),
    period: z
      .enum(['last_7_days', 'last_14_days', 'last_28_days', 'last_90_days'])
      .optional()
      .default('last_28_days')
      .describe('Time window for metrics aggregation'),
  },
  async ({ path, period }) => {
    try {
      const audit = await getUnifiedPageAudit(path, period);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(audit, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error conducting page audit: ${err.message}`,
          },
        ],
      };
    }
  }
);

// Tool 2: find_seo_opportunities
server.tool(
  'find_seo_opportunities',
  'Identify actionable SEO opportunities by joining GSC rankings/impressions with Plausible bounce rate and duration. Detects striking distance keywords (pos 4-15), high-bounce top performers, underperforming SERP snippets, and hidden champions.',
  {
    period: z
      .enum(['last_7_days', 'last_14_days', 'last_28_days', 'last_90_days'])
      .optional()
      .default('last_28_days')
      .describe('Time window for metrics evaluation'),
    min_impressions: z
      .number()
      .optional()
      .default(30)
      .describe('Minimum search impressions threshold to consider a page'),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe('Maximum number of opportunities to return'),
  },
  async ({ period, min_impressions, limit }) => {
    try {
      const opportunities = await findSeoOpportunities({
        period,
        minImpressions: min_impressions,
        limit,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                period,
                minImpressions: min_impressions,
                totalFound: opportunities.length,
                opportunities,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error finding SEO opportunities: ${err.message}`,
          },
        ],
      };
    }
  }
);

// Tool 3: inspect_url_index_status
server.tool(
  'inspect_url_index_status',
  'Query Google Search Console URL Inspection API to check indexation state, coverage verdict, user-declared vs. Google-selected canonical, mobile usability, and last crawl timestamp.',
  {
    urlOrPath: z
      .string()
      .describe('Full URL or relative path to inspect (e.g. "/posts/my-post/" or "https://hackenberg.tech/posts/my-post/")'),
  },
  async ({ urlOrPath }) => {
    try {
      const inspection = await inspectUrlIndexStatus(urlOrPath);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(inspection, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error inspecting URL: ${err.message}`,
          },
        ],
      };
    }
  }
);

// Tool 4: evaluate_aio_extractability
server.tool(
  'evaluate_aio_extractability',
  'Audit local markdown or HTML content for Generative Engine Optimization (GEO) and AI Overviews (AIO) extractability. Evaluates direct answer density under headings, table/list presence, Schema.org metadata, and outputs a 0-100 score with concrete formatting recommendations.',
  {
    target: z
      .string()
      .describe('Relative URL path (e.g. "/posts/my-post/") or repository file path (e.g. "src/content/posts/my-post/index.md")'),
  },
  async ({ target }) => {
    try {
      const evaluation = evaluateAioExtractability(target);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(evaluation, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error evaluating AIO extractability: ${err.message}`,
          },
        ],
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Unified Analytics MCP Server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error running Unified Analytics MCP Server:', err);
  process.exit(1);
});
