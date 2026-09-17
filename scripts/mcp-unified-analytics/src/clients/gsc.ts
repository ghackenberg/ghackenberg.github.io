import fs from 'node:fs';
import { google, searchconsole_v1 } from 'googleapis';
import { getConfig } from '../config.js';
import { normalizePath, toFullUrl } from '../services/normalizer.js';
import type { GscMetricSummary, GscPagePerformance, GscQueryMetric, UrlInspectionDetails } from '../types.js';

let cachedAuthClient: InstanceType<typeof google.auth.GoogleAuth> | null = null;

function getAuthClient(): InstanceType<typeof google.auth.GoogleAuth> {
  if (cachedAuthClient) {
    return cachedAuthClient;
  }

  const config = getConfig();
  const scopes = [
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/webmasters',
  ];

  if (config.gsc.credentialsJson) {
    try {
      const credentials = JSON.parse(config.gsc.credentialsJson);
      cachedAuthClient = new google.auth.GoogleAuth({
        credentials,
        scopes,
      });
      return cachedAuthClient;
    } catch (e: any) {
      throw new Error(`Failed to parse GSC_SERVICE_ACCOUNT_JSON: ${e.message}`);
    }
  }

  if (config.gsc.keyFile) {
    if (!fs.existsSync(config.gsc.keyFile)) {
      throw new Error(`GSC Service Account key file not found at: ${config.gsc.keyFile}`);
    }
    cachedAuthClient = new google.auth.GoogleAuth({
      keyFile: config.gsc.keyFile,
      scopes,
    });
    return cachedAuthClient;
  }

  throw new Error(
    'Google Search Console credentials not configured. Please set GSC_SERVICE_ACCOUNT_KEY_FILE or GSC_SERVICE_ACCOUNT_JSON in scripts/mcp-unified-analytics/.env'
  );
}

function getSearchConsole(): searchconsole_v1.Searchconsole {
  const auth = getAuthClient();
  return google.searchconsole({
    version: 'v1',
    auth,
  });
}

/**
 * Calculates date range strings (YYYY-MM-DD) for common presets like "last_28_days", "last_7_days", "last_90_days"
 */
export function resolveDateRange(period: string = 'last_28_days'): { startDate: string; endDate: string } {
  // GSC data usually has a ~2-3 day lag
  const now = new Date();
  const end = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
  let days = 28;

  if (period === 'last_7_days') days = 7;
  else if (period === 'last_14_days') days = 14;
  else if (period === 'last_28_days') days = 28;
  else if (period === 'last_90_days') days = 90;
  else if (period.includes('_to_')) {
    const [startPart, endPart] = period.split('_to_');
    return { startDate: startPart, endDate: endPart };
  }

  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
}

/**
 * Fetches GSC metrics and top queries for a single page.
 */
export async function getGscPagePerformance(
  urlOrPath: string,
  period: string = 'last_28_days'
): Promise<GscPagePerformance> {
  const config = getConfig();
  const sc = getSearchConsole();
  const canonicalPath = normalizePath(urlOrPath);
  const fullUrl = toFullUrl(canonicalPath);
  const { startDate, endDate } = resolveDateRange(period);

  // 1. Fetch aggregate page performance
  const pageRes = await sc.searchanalytics.query({
    siteUrl: config.gsc.siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['page'],
      dimensionFilterGroups: [
        {
          filters: [
            {
              dimension: 'page',
              operator: 'equals',
              expression: fullUrl,
            },
          ],
        },
      ],
    },
  });

  const pageRow = pageRes.data.rows?.[0];
  const pageMetrics: GscMetricSummary = {
    clicks: pageRow?.clicks || 0,
    impressions: pageRow?.impressions || 0,
    ctr: Number((pageRow?.ctr || 0).toFixed(4)),
    position: Number((pageRow?.position || 0).toFixed(1)),
  };

  // 2. Fetch top queries targeting this page
  let queries: GscQueryMetric[] = [];
  try {
    const queryRes = await sc.searchanalytics.query({
      siteUrl: config.gsc.siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query'],
        dimensionFilterGroups: [
          {
            filters: [
              {
                dimension: 'page',
                operator: 'equals',
                expression: fullUrl,
              },
            ],
          },
        ],
        rowLimit: 10,
      },
    });

    queries = (queryRes.data.rows || []).map((row) => ({
      query: row.keys?.[0] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: Number((row.ctr || 0).toFixed(4)),
      position: Number((row.position || 0).toFixed(1)),
    }));
  } catch {
    // If top queries fail, fallback gracefully to empty list
    queries = [];
  }

  return {
    page: canonicalPath,
    ...pageMetrics,
    queries,
  };
}

/**
 * Fetches GSC performance for top pages of the site.
 */
export async function getGscTopPages(
  period: string = 'last_28_days',
  rowLimit: number = 100
): Promise<GscPagePerformance[]> {
  const config = getConfig();
  const sc = getSearchConsole();
  const { startDate, endDate } = resolveDateRange(period);

  const res = await sc.searchanalytics.query({
    siteUrl: config.gsc.siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit,
    },
  });

  return (res.data.rows || []).map((row) => {
    const rawUrl = row.keys?.[0] || '';
    const normPath = normalizePath(rawUrl);
    return {
      page: normPath,
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: Number((row.ctr || 0).toFixed(4)),
      position: Number((row.position || 0).toFixed(1)),
    };
  });
}

/**
 * Inspects URL indexation status via GSC URL Inspection API.
 */
export async function inspectUrlIndexStatus(urlOrPath: string): Promise<UrlInspectionDetails> {
  const config = getConfig();
  const sc = getSearchConsole();
  const canonicalPath = normalizePath(urlOrPath);
  const fullUrl = toFullUrl(canonicalPath);

  const res = await sc.urlInspection.index.inspect({
    requestBody: {
      inspectionUrl: fullUrl,
      siteUrl: config.gsc.siteUrl,
    },
  });

  const result = res.data.inspectionResult;
  const indexStatus = result?.indexStatusResult;
  const mobile = result?.mobileUsabilityResult;

  const rawIssues: string[] = [];
  if (mobile?.issues) {
    for (const issue of mobile.issues) {
      if (issue.issueType) rawIssues.push(issue.issueType);
    }
  }

  return {
    url: fullUrl,
    inspectionVerdict: indexStatus?.verdict || 'VERDICT_UNSPECIFIED',
    coverageState: indexStatus?.coverageState || 'UNKNOWN',
    indexingState: indexStatus?.indexingState || 'UNKNOWN',
    robotsTxtState: indexStatus?.robotsTxtState || 'UNKNOWN',
    pageFetchState: indexStatus?.pageFetchState || 'UNKNOWN',
    googleCanonical: indexStatus?.googleCanonical || undefined,
    userCanonical: indexStatus?.userCanonical || undefined,
    sitemap: indexStatus?.sitemap || [],
    referringUrls: indexStatus?.referringUrls || [],
    lastCrawlTime: indexStatus?.lastCrawlTime || undefined,
    mobileUsabilityVerdict: mobile?.verdict || 'VERDICT_UNSPECIFIED',
    rawIssues: rawIssues.length > 0 ? rawIssues : undefined,
  };
}

/**
 * Fetches GSC aggregate metrics for the entire site/property.
 */
export async function getGscSiteOverview(
  period: string = 'last_28_days'
): Promise<GscMetricSummary> {
  const config = getConfig();
  const sc = getSearchConsole();
  const { startDate, endDate } = resolveDateRange(period);

  const res = await sc.searchanalytics.query({
    siteUrl: config.gsc.siteUrl,
    requestBody: {
      startDate,
      endDate,
    },
  });

  const row = res.data.rows?.[0];
  return {
    clicks: row?.clicks || 0,
    impressions: row?.impressions || 0,
    ctr: Number((row?.ctr || 0).toFixed(4)),
    position: Number((row?.position || 0).toFixed(1)),
  };
}

/**
 * Fetches top search queries across the entire site.
 */
export async function getGscSiteTopQueries(
  period: string = 'last_28_days',
  rowLimit: number = 25
): Promise<GscQueryMetric[]> {
  const config = getConfig();
  const sc = getSearchConsole();
  const { startDate, endDate } = resolveDateRange(period);

  const res = await sc.searchanalytics.query({
    siteUrl: config.gsc.siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit,
    },
  });

  return (res.data.rows || []).map((row) => ({
    query: row.keys?.[0] || '',
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: Number((row.ctr || 0).toFixed(4)),
    position: Number((row.position || 0).toFixed(1)),
  }));
}
