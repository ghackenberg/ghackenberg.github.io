import { getConfig } from '../config.js';
import { normalizePath } from '../services/normalizer.js';
import type { PlausiblePageMetrics } from '../types.js';

export function mapPeriodToPlausible(period: string = 'last_28_days'): string {
  if (period === 'last_7_days') return '7d';
  if (period === 'last_14_days') return 'custom'; // or 30d
  if (period === 'last_28_days') return '30d';
  if (period === 'last_90_days') return '6mo';
  return '30d';
}

/**
 * Fetches Plausible engagement metrics for a specific URL path.
 */
export async function getPlausiblePageMetrics(
  urlOrPath: string,
  period: string = 'last_28_days'
): Promise<PlausiblePageMetrics> {
  const config = getConfig();

  if (!config.plausible.apiKey) {
    return {
      visitors: 0,
      pageviews: 0,
      bounceRate: null,
      visitDuration: null,
    };
  }

  const canonicalPath = normalizePath(urlOrPath);
  const plausiblePeriod = mapPeriodToPlausible(period);

  const fetchAggregate = async (filterPath: string) => {
    const url = new URL(`${config.plausible.host}/api/v1/stats/aggregate`);
    url.searchParams.set('site_id', config.plausible.siteId);
    url.searchParams.set('period', plausiblePeriod);
    url.searchParams.set('metrics', 'visitors,pageviews,bounce_rate,visit_duration');
    url.searchParams.set('filters', `event:page==${filterPath}`);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${config.plausible.apiKey}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Plausible API error (${res.status}): ${errText}`);
      return null;
    }

    const data = await res.json();
    return data.results || {};
  };

  try {
    let results = await fetchAggregate(canonicalPath);
    // If no pageviews on canonicalPath and path has trailing slash, try without slash (or vice versa)
    if ((!results || results.pageviews?.value === 0) && canonicalPath !== '/') {
      const alternativePath = canonicalPath.endsWith('/') 
        ? canonicalPath.slice(0, -1) 
        : `${canonicalPath}/`;
      const altResults = await fetchAggregate(alternativePath);
      if (altResults && (altResults.pageviews?.value ?? 0) > 0) {
        results = altResults;
      }
    }

    if (!results) {
      return {
        visitors: 0,
        pageviews: 0,
        bounceRate: null,
        visitDuration: null,
      };
    }

    return {
      visitors: results.visitors?.value ?? 0,
      pageviews: results.pageviews?.value ?? 0,
      bounceRate: results.bounce_rate?.value != null ? Number(results.bounce_rate.value.toFixed(1)) : null,
      visitDuration: results.visit_duration?.value != null ? Math.round(results.visit_duration.value) : null,
    };
  } catch (err: any) {
    console.warn(`Failed to contact Plausible API: ${err.message}`);
    return {
      visitors: 0,
      pageviews: 0,
      bounceRate: null,
      visitDuration: null,
    };
  }
}

/**
 * Fetches Plausible breakdown metrics for all top pages.
 */
export async function getPlausibleTopPages(
  period: string = 'last_28_days',
  limit: number = 100
): Promise<Map<string, PlausiblePageMetrics>> {
  const config = getConfig();
  const pageMap = new Map<string, PlausiblePageMetrics>();

  if (!config.plausible.apiKey) {
    return pageMap;
  }

  const plausiblePeriod = mapPeriodToPlausible(period);
  const url = new URL(`${config.plausible.host}/api/v1/stats/breakdown`);
  url.searchParams.set('site_id', config.plausible.siteId);
  url.searchParams.set('period', plausiblePeriod);
  url.searchParams.set('property', 'event:page');
  url.searchParams.set('metrics', 'visitors,pageviews,bounce_rate,visit_duration');
  url.searchParams.set('limit', String(limit));

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${config.plausible.apiKey}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Plausible breakdown API error (${res.status}): ${errText}`);
      return pageMap;
    }

    const data = await res.json();
    const items = data.results || [];

    for (const item of items) {
      const normPath = normalizePath(item.page || '');
      const existing = pageMap.get(normPath);

      const metrics: PlausiblePageMetrics = {
        visitors: (existing?.visitors || 0) + (item.visitors || 0),
        pageviews: (existing?.pageviews || 0) + (item.pageviews || 0),
        bounceRate: item.bounce_rate != null ? Number(item.bounce_rate.toFixed(1)) : (existing?.bounceRate ?? null),
        visitDuration: item.visit_duration != null ? Math.round(item.visit_duration) : (existing?.visitDuration ?? null),
      };

      pageMap.set(normPath, metrics);
    }

    return pageMap;
  } catch (err: any) {
    console.warn(`Failed to contact Plausible breakdown API: ${err.message}`);
    return pageMap;
  }
}
