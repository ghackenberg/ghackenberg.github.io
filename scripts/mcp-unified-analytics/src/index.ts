#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getUnifiedPageAudit } from './services/aggregator.js';
import { findSeoOpportunities } from './services/opportunities.js';
import { inspectUrlIndexStatus } from './clients/gsc.js';
import {
  evaluateAioExtractability,
  scanAllContentAio,
  diffAioAgainstGit,
} from './services/aio-evaluator.js';
import { auditInternalLinking } from './services/internal-links.js';
import { auditSerpSnippets } from './services/serp-snippets.js';
import {
  getSiteOverview,
  getTrafficSourcesReport,
  getTopQueriesReport,
  findRetentionBottlenecks,
} from './services/site-overview.js';

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

// Tool 5: scan_aio_readiness
server.tool(
  'scan_aio_readiness',
  'Batch-scan all markdown content across collections (posts, visualizations, courses) to compute AIO extractability scores. Identifies content with the highest optimization potential, sorting ascending by score.',
  {
    collection: z
      .enum(['all', 'posts', 'visualizations', 'courses'])
      .optional()
      .default('all')
      .describe('Collection directory to scan'),
    maxScore: z
      .number()
      .optional()
      .default(80)
      .describe('Only return pages with an AIO score at or below this threshold'),
    limit: z
      .number()
      .optional()
      .default(15)
      .describe('Maximum number of underperforming pages to return'),
  },
  async ({ collection, maxScore, limit }) => {
    try {
      const summary = scanAllContentAio({ collection, maxScore, limit });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error scanning AIO readiness: ${err.message}`,
          },
        ],
      };
    }
  }
);

// Tool 6: audit_internal_linking
server.tool(
  'audit_internal_linking',
  'Analyze internal linking graph across all markdown content. Detects orphan pages (pages with 0 or 1 incoming links) and automatically suggests backlink opportunities from donor articles for a target article or hidden champion.',
  {
    targetPath: z
      .string()
      .optional()
      .describe('Relative URL or file path of target article to find backlink donor opportunities for (e.g. "/posts/my-post/")'),
    minIncomingLinks: z
      .number()
      .optional()
      .default(1)
      .describe('Threshold below which a page is flagged as an orphan'),
  },
  async ({ targetPath, minIncomingLinks }) => {
    try {
      const audit = auditInternalLinking({ targetPath, minIncomingLinks });
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
            text: `Error auditing internal links: ${err.message}`,
          },
        ],
      };
    }
  }
);

// Tool 7: audit_serp_snippets
server.tool(
  'audit_serp_snippets',
  'Audit frontmatter title and description lengths against Google SERP truncation limits (<60 chars for title, 140-160 for description). Cross-references top queries from Google Search Console to verify keyword inclusion.',
  {
    collection: z
      .enum(['posts', 'visualizations', 'courses', 'all'])
      .optional()
      .default('posts')
      .describe('Content collection to audit'),
    checkGscKeywords: z
      .boolean()
      .optional()
      .default(true)
      .describe('Whether to verify inclusion of the primary GSC ranking query in the page title'),
  },
  async ({ collection, checkGscKeywords }) => {
    try {
      const audit = await auditSerpSnippets({ collection, checkGscKeywords });
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
            text: `Error auditing SERP snippets: ${err.message}`,
          },
        ],
      };
    }
  }
);

// Tool 8: diff_aio_impact
server.tool(
  'diff_aio_impact',
  'Compare current content of a file against a Git revision (default HEAD) to evaluate the exact delta in AIO extractability score, direct answers, tables, headings, and lists.',
  {
    target: z
      .string()
      .describe('Relative URL path or file path (e.g. "src/content/posts/my-post/index.md")'),
    baseRef: z
      .string()
      .optional()
      .default('HEAD')
      .describe('Git base revision to compare against (default: HEAD)'),
  },
  async ({ target, baseRef }) => {
    try {
      const diff = diffAioAgainstGit(target, baseRef);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(diff, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error computing AIO diff: ${err.message}`,
          },
        ],
      };
    }
  }
);

// Tool 9: get_site_overview
server.tool(
  'get_site_overview',
  'Retrieve site-wide consolidated performance and engagement metrics across the entire domain from Google Search Console (clicks, impressions, average CTR, average position) and Plausible Analytics (visitors, pageviews, average bounce rate, visit duration).',
  {
    period: z
      .enum(['last_7_days', 'last_14_days', 'last_28_days', 'last_90_days'])
      .optional()
      .default('last_28_days')
      .describe('Time window for metrics aggregation'),
  },
  async ({ period }) => {
    try {
      const overview = await getSiteOverview(period);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(overview, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error fetching site overview: ${err.message}`,
          },
        ],
      };
    }
  }
);

// Tool 10: get_traffic_sources
server.tool(
  'get_traffic_sources',
  'Retrieve breakdown of traffic channels and referrers (e.g. Google, Direct, LinkedIn, search engines, AI platforms) with visitor counts, bounce rate, and visit duration from Plausible.',
  {
    period: z
      .enum(['last_7_days', 'last_14_days', 'last_28_days', 'last_90_days'])
      .optional()
      .default('last_28_days')
      .describe('Time window for metrics aggregation'),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe('Maximum number of sources to return'),
  },
  async ({ period, limit }) => {
    try {
      const report = await getTrafficSourcesReport(period, limit);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(report, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error fetching traffic sources: ${err.message}`,
          },
        ],
      };
    }
  }
);

// Tool 11: get_top_search_queries
server.tool(
  'get_top_search_queries',
  'Retrieve top search queries across the entire domain from Google Search Console, including clicks, impressions, CTR, and average ranking positions.',
  {
    period: z
      .enum(['last_7_days', 'last_14_days', 'last_28_days', 'last_90_days'])
      .optional()
      .default('last_28_days')
      .describe('Time window for metrics aggregation'),
    limit: z
      .number()
      .optional()
      .default(25)
      .describe('Maximum number of queries to return'),
  },
  async ({ period, limit }) => {
    try {
      const report = await getTopQueriesReport(period, limit);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(report, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error fetching top queries: ${err.message}`,
          },
        ],
      };
    }
  }
);

// Tool 12: find_retention_bottlenecks
server.tool(
  'find_retention_bottlenecks',
  'Detect dead-end pages and retention bottlenecks with high bounce rates (>= 70%) or short visit durations, providing specific content and UX recommendations to keep visitors engaged.',
  {
    period: z
      .enum(['last_7_days', 'last_14_days', 'last_28_days', 'last_90_days'])
      .optional()
      .default('last_28_days')
      .describe('Time window for metrics evaluation'),
    min_visitors: z
      .number()
      .optional()
      .default(2)
      .describe('Minimum visitor count to consider a page'),
  },
  async ({ period, min_visitors }) => {
    try {
      const report = await findRetentionBottlenecks(period, min_visitors);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(report, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error finding retention bottlenecks: ${err.message}`,
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

