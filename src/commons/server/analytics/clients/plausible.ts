import { getConfig } from '../config.js';
import { normalizePath } from '../services/normalizer.js';
import type {
  PlausiblePageMetrics,
  PlausibleDailyTrafficPoint,
  ScrollRetentionData,
  ScrollFunnelMilestone,
  PlausibleGoalConversion,
  TechBreakdown,
  TechDimensionMetric,
  GeoDimensionMetric,
  UtmCampaignMetric,
  SectionDwellMetric,
  CardCtrMetric,
  PlausibleVisitorFlow,
  VisitorFlowItem,
  VisitorFlowChain,
} from '../types.js';

export function resolvePlausibleParams(period: string = 'last_28_days'): { period: string; date?: string } {
  if (period === 'last_7_days' || period === '7d') return { period: '7d' };
  if (period === 'last_14_days' || period === '14d') return { period: 'custom', date: getRangeDateString(14) };
  if (period === 'last_28_days' || period === '28d' || period === '30d') return { period: '30d' };
  if (period === 'last_90_days' || period === '90d') return { period: 'custom', date: getRangeDateString(90) };
  return { period: '30d' };
}

function getRangeDateString(days: number): string {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  return `${formatDate(start)},${formatDate(end)}`;
}

export function mapPeriodToPlausible(period: string = 'last_28_days'): string {
  return resolvePlausibleParams(period).period;
}

export interface PlausibleBreakdownRow {
  goal?: string;
  source?: string;
  country?: string;
  utm_campaign?: string;
  device?: string;
  os?: string;
  browser?: string;
  screen_bucket?: string;
  screen_orientation?: string;
  value?: string;
  property?: string;
  page?: string;
  id?: string;
  section_id?: string;
  'event:props:id'?: string;
  visitors?: number;
  events?: number;
  bounce_rate?: number | null;
  visit_duration?: number | null;
  [key: string]: string | number | null | undefined;
}

/**
 * Low-level breakdown query helper.
 */
export async function fetchBreakdown(
  property: string,
  period: string,
  filter?: string,
  metrics: string = 'visitors,bounce_rate,visit_duration',
  limit: number = 30
): Promise<PlausibleBreakdownRow[]> {
  const config = getConfig();
  if (!config.plausible.apiKey) return [];

  const { period: plausiblePeriod, date: plausibleDate } = resolvePlausibleParams(period);
  const url = new URL(`${config.plausible.host}/api/v1/stats/breakdown`);
  url.searchParams.set('site_id', config.plausible.siteId);
  url.searchParams.set('period', plausiblePeriod);
  if (plausibleDate) {
    url.searchParams.set('date', plausibleDate);
  }
  url.searchParams.set('property', property);
  url.searchParams.set('metrics', metrics);
  url.searchParams.set('limit', String(limit));
  if (filter) {
    url.searchParams.set('filters', filter);
  }

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${config.plausible.apiKey}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Plausible breakdown error for ${property}: ${errText}`);
      return [];
    }

    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.warn(`Failed to contact Plausible breakdown API (${property}): ${(err as Error).message}`);
    return [];
  }
}

/**
 * Fetches daily traffic timeseries (visitors & pageviews) for a specific URL path.
 */
export async function getPlausiblePageTimeseries(
  urlOrPath: string,
  period: string = 'last_28_days'
): Promise<PlausibleDailyTrafficPoint[]> {
  const config = getConfig();
  if (!config.plausible.apiKey) return [];

  const canonicalPath = normalizePath(urlOrPath);
  const { period: plausiblePeriod, date: plausibleDate } = resolvePlausibleParams(period);

  const queryPathTimeseries = async (filterPath: string): Promise<PlausibleDailyTrafficPoint[]> => {
    const url = new URL(`${config.plausible.host}/api/v1/stats/timeseries`);
    url.searchParams.set('site_id', config.plausible.siteId);
    url.searchParams.set('period', plausiblePeriod);
    if (plausibleDate) {
      url.searchParams.set('date', plausibleDate);
    }
    url.searchParams.set('metrics', 'visitors,pageviews');
    url.searchParams.set('filters', `event:page==${filterPath}`);

    try {
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${config.plausible.apiKey}`,
        },
      });
      if (!res.ok) return [];
      const data = await res.json();
      const rows = Array.isArray(data.results) ? data.results : [];
      return rows.map((row: { date?: string; visitors?: number | null; pageviews?: number | null }) => ({
        date: String(row.date || ''),
        visitors: Number(row.visitors ?? 0),
        pageviews: Number(row.pageviews ?? row.visitors ?? 0),
      }));
    } catch {
      return [];
    }
  };

  let points = await queryPathTimeseries(canonicalPath);
  const sumViews = points.reduce((acc, p) => acc + p.pageviews, 0);
  if (sumViews === 0 && canonicalPath !== '/') {
    const alternativePath = canonicalPath.endsWith('/')
      ? canonicalPath.slice(0, -1)
      : `${canonicalPath}/`;
    const altPoints = await queryPathTimeseries(alternativePath);
    const altSum = altPoints.reduce((acc, p) => acc + p.pageviews, 0);
    if (altSum > 0) {
      points = altPoints;
    }
  }

  return points;
}

/**
 * Fetches Plausible engagement metrics for a specific URL path.
 */
export async function getPlausiblePageMetrics(
  urlOrPath: string,
  period: string = 'last_28_days',
  includeDeepMetrics: boolean = true
): Promise<PlausiblePageMetrics> {
  const config = getConfig();

  if (!config.plausible.apiKey) {
    return {
      visitors: 0,
      entries: 0,
      pageviews: 0,
      bounceRate: null,
      visitDuration: null,
    };
  }

  const canonicalPath = normalizePath(urlOrPath);
  const { period: plausiblePeriod, date: plausibleDate } = resolvePlausibleParams(period);

  const fetchAggregate = async (filterPath: string) => {
    const url = new URL(`${config.plausible.host}/api/v1/stats/aggregate`);
    url.searchParams.set('site_id', config.plausible.siteId);
    url.searchParams.set('period', plausiblePeriod);
    if (plausibleDate) {
      url.searchParams.set('date', plausibleDate);
    }
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

  const fetchEntries = async (filterPath: string) => {
    const url = new URL(`${config.plausible.host}/api/v1/stats/aggregate`);
    url.searchParams.set('site_id', config.plausible.siteId);
    url.searchParams.set('period', plausiblePeriod);
    if (plausibleDate) {
      url.searchParams.set('date', plausibleDate);
    }
    url.searchParams.set('metrics', 'visitors');
    url.searchParams.set('filters', `visit:entry_page==${filterPath}`);

    try {
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${config.plausible.apiKey}`,
        },
      });

      if (!res.ok) return 0;
      const data = await res.json();
      return data.results?.visitors?.value ?? 0;
    } catch {
      return 0;
    }
  };

  try {
    let [results, entries] = await Promise.all([
      fetchAggregate(canonicalPath),
      fetchEntries(canonicalPath),
    ]);

    // If no pageviews on canonicalPath and path has trailing slash, try without slash (or vice versa)
    if ((!results || results.pageviews?.value === 0) && canonicalPath !== '/') {
      const alternativePath = canonicalPath.endsWith('/') 
        ? canonicalPath.slice(0, -1) 
        : `${canonicalPath}/`;
      const [altResults, altEntries] = await Promise.all([
        fetchAggregate(alternativePath),
        fetchEntries(alternativePath),
      ]);
      if (altResults && (altResults.pageviews?.value ?? 0) > 0) {
        results = altResults;
        entries = altEntries;
      }
    }

    if (!results) {
      return {
        visitors: 0,
        entries: 0,
        pageviews: 0,
        bounceRate: null,
        visitDuration: null,
      };
    }

    const baseMetrics = {
      visitors: results.visitors?.value ?? 0,
      entries: entries ?? 0,
      pageviews: results.pageviews?.value ?? 0,
      bounceRate: results.bounce_rate?.value != null ? Number(results.bounce_rate.value.toFixed(1)) : null,
      visitDuration: results.visit_duration?.value != null ? Math.round(results.visit_duration.value) : null,
    };

    if (!includeDeepMetrics || baseMetrics.visitors === 0) {
      return baseMetrics;
    }

    // Fetch deep metrics concurrently
    const [scrollAndGoals, tech, countries, visitorFlow, timeseries] = await Promise.all([
      getPlausiblePageScrollAndGoals(canonicalPath, period, baseMetrics.visitors).catch(() => ({
        scrollFunnel: { milestones: [], readThroughRate: null, medianScrollDepth: null },
        goals: [],
      })),
      getPlausibleTechBreakdown(canonicalPath, period, baseMetrics.visitors).catch(() => ({
        devices: [],
        operatingSystems: [],
        browsers: [],
      })),
      getPlausibleGeoBreakdown(canonicalPath, period, baseMetrics.visitors, 10).catch(() => []),
      getPlausibleVisitorFlow(
        canonicalPath,
        period,
        baseMetrics.visitors,
        baseMetrics.entries,
        baseMetrics.bounceRate,
        baseMetrics.pageviews
      ).catch(() => undefined),
      getPlausiblePageTimeseries(canonicalPath, period).catch(() => []),
    ]);

    return {
      ...baseMetrics,
      scrollFunnel: scrollAndGoals.scrollFunnel,
      goals: scrollAndGoals.goals,
      tech,
      countries,
      visitorFlow,
      timeseries,
    };
  } catch (err) {
    console.warn(`Failed to contact Plausible API: ${(err as Error).message}`);
    return {
      visitors: 0,
      entries: 0,
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

  const { period: plausiblePeriod, date: plausibleDate } = resolvePlausibleParams(period);
  const url = new URL(`${config.plausible.host}/api/v1/stats/breakdown`);
  url.searchParams.set('site_id', config.plausible.siteId);
  url.searchParams.set('period', plausiblePeriod);
  if (plausibleDate) {
    url.searchParams.set('date', plausibleDate);
  }
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
  } catch (err) {
    console.warn(`Failed to contact Plausible breakdown API: ${(err as Error).message}`);
    return pageMap;
  }
}

/**
 * Fetches site-wide Plausible aggregate metrics.
 */
export async function getPlausibleSiteOverview(
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

  const plausiblePeriod = mapPeriodToPlausible(period);
  const url = new URL(`${config.plausible.host}/api/v1/stats/aggregate`);
  url.searchParams.set('site_id', config.plausible.siteId);
  url.searchParams.set('period', plausiblePeriod);
  url.searchParams.set('metrics', 'visitors,pageviews,bounce_rate,visit_duration');

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${config.plausible.apiKey}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Plausible aggregate API error (${res.status}): ${errText}`);
      return {
        visitors: 0,
        pageviews: 0,
        bounceRate: null,
        visitDuration: null,
      };
    }

    const data = await res.json();
    const results = data.results || {};

    return {
      visitors: results.visitors?.value ?? 0,
      pageviews: results.pageviews?.value ?? 0,
      bounceRate: results.bounce_rate?.value != null ? Number(results.bounce_rate.value.toFixed(1)) : null,
      visitDuration: results.visit_duration?.value != null ? Math.round(results.visit_duration.value) : null,
    };
  } catch (err) {
    console.warn(`Failed to contact Plausible aggregate API: ${(err as Error).message}`);
    return {
      visitors: 0,
      pageviews: 0,
      bounceRate: null,
      visitDuration: null,
    };
  }
}

/**
 * Fetches breakdown of traffic sources (referrers) from Plausible.
 */
export async function getPlausibleTrafficSources(
  period: string = 'last_28_days',
  limit: number = 20
): Promise<Array<{ source: string; visitors: number; bounceRate: number | null; visitDuration: number | null }>> {
  const config = getConfig();

  if (!config.plausible.apiKey) {
    return [];
  }

  const plausiblePeriod = mapPeriodToPlausible(period);
  const url = new URL(`${config.plausible.host}/api/v1/stats/breakdown`);
  url.searchParams.set('site_id', config.plausible.siteId);
  url.searchParams.set('period', plausiblePeriod);
  url.searchParams.set('property', 'visit:source');
  url.searchParams.set('metrics', 'visitors,bounce_rate,visit_duration');
  url.searchParams.set('limit', String(limit));

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${config.plausible.apiKey}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Plausible sources breakdown API error (${res.status}): ${errText}`);
      return [];
    }

    const data = await res.json();
    return (data.results || []).map((item: PlausibleBreakdownRow) => ({
      source: item.source || 'Direct / None',
      visitors: item.visitors || 0,
      bounceRate: item.bounce_rate != null ? Number(item.bounce_rate.toFixed(1)) : null,
      visitDuration: item.visit_duration != null ? Math.round(item.visit_duration) : null,
    }));
  } catch (err) {
    console.warn(`Failed to contact Plausible breakdown API: ${(err as Error).message}`);
    return [];
  }
}

/**
 * Fetches and aggregates scroll retention funnel and goal conversions for a page.
 */
export async function getPlausiblePageScrollAndGoals(
  urlOrPath: string,
  period: string = 'last_28_days',
  pageVisitors: number = 0
): Promise<{ scrollFunnel: ScrollRetentionData; goals: PlausibleGoalConversion[] }> {
  const normPath = normalizePath(urlOrPath);
  const filter = `event:page==${normPath}`;
  let rawGoals = await fetchBreakdown('event:goal', period, filter, 'visitors', 50);

  // If no goals found and path has trailing slash, try alternative slash
  if (rawGoals.length === 0 && normPath !== '/') {
    const altPath = normPath.endsWith('/') ? normPath.slice(0, -1) : `${normPath}/`;
    rawGoals = await fetchBreakdown('event:goal', period, `event:page==${altPath}`, 'visitors', 50);
  }

  const milestones: ScrollFunnelMilestone[] = [];
  const goals: PlausibleGoalConversion[] = [];

  for (const item of rawGoals) {
    const goalName: string = item.goal || '';
    const visitors: number = item.visitors || 0;

    const scrollMatch = goalName.match(/^Overall Scroll Depth >= (\d+)%$/);
    if (scrollMatch) {
      const depth = parseInt(scrollMatch[1], 10);
      milestones.push({
        depth,
        visitors,
        percentageOfVisitors: pageVisitors > 0 ? Number(((visitors / pageVisitors) * 100).toFixed(1)) : 0,
      });
    } else {
      goals.push({
        goal: goalName,
        visitors,
        conversionRate: pageVisitors > 0 ? Number(((visitors / pageVisitors) * 100).toFixed(1)) : null,
      });
    }
  }

  // Sort scroll milestones 10 -> 90
  milestones.sort((a, b) => a.depth - b.depth);

  // Compute drop-off from previous milestone
  for (let i = 0; i < milestones.length; i++) {
    if (i === 0) {
      if (pageVisitors > 0) {
        milestones[i].dropOffRateFromPrevious = Number((((pageVisitors - milestones[i].visitors) / pageVisitors) * 100).toFixed(1));
      }
    } else {
      const prev = milestones[i - 1].visitors;
      if (prev > 0) {
        milestones[i].dropOffRateFromPrevious = Number((((prev - milestones[i].visitors) / prev) * 100).toFixed(1));
      } else {
        milestones[i].dropOffRateFromPrevious = 0;
      }
    }
  }

  const p90 = milestones.find((m) => m.depth === 90);
  const readThroughRate = p90 && pageVisitors > 0 ? Number(((p90.visitors / pageVisitors) * 100).toFixed(1)) : null;

  // Median scroll depth: depth where reach crosses 50% of visitors (with linear interpolation)
  let medianScrollDepth: number | null = null;
  if (milestones.length > 0 && pageVisitors > 0) {
    let prev = { depth: 0, percentage: 100 };
    for (const m of milestones) {
      const pct = m.percentageOfVisitors;
      if (pct <= 50) {
        // Crossed 50% between prev and m
        const range = prev.percentage - pct;
        const factor = range > 0 ? (prev.percentage - 50) / range : 0;
        medianScrollDepth = Math.round(prev.depth + factor * (m.depth - prev.depth));
        break;
      }
      prev = { depth: m.depth, percentage: pct };
    }
    // If even the deepest milestone has >= 50% reach
    if (medianScrollDepth === null && prev.percentage >= 50) {
      medianScrollDepth = prev.depth;
    }
  }

  // Fetch properties for goals (File Download, Section Viewed, Slide Viewed, High Intent, Filter, etc.)
  const pageFilter = `event:page==${normPath}`;
  await Promise.all(goals.map((g) => enrichGoalWithDetails(g, period, pageFilter)));

  return {
    scrollFunnel: {
      milestones,
      readThroughRate,
      medianScrollDepth,
    },
    goals,
  };
}

const GOAL_DETAIL_PROPERTIES: Record<string, { propKey: string; fieldName: string }> = {
  'File Download': { propKey: 'event:props:url', fieldName: 'url' },
  'Outbound Link: Click': { propKey: 'event:props:url', fieldName: 'url' },
  'Section Viewed': { propKey: 'event:props:id', fieldName: 'id' },
  'Heading Viewed': { propKey: 'event:props:id', fieldName: 'id' },
  'Card Viewed': { propKey: 'event:props:id', fieldName: 'id' },
  'Card Clicked': { propKey: 'event:props:id', fieldName: 'id' },
  'Slide Viewed': { propKey: 'event:props:slide_number', fieldName: 'slide_number' },
  'High Intent: Copy Email': { propKey: 'event:props:location', fieldName: 'location' },
  'High Intent: Copy BibTeX': { propKey: 'event:props:id', fieldName: 'id' },
  'High Intent: Share Presentation': { propKey: 'event:props:slide_number', fieldName: 'slide_number' },
  'Filter Content': { propKey: 'event:props:value', fieldName: 'value' },
  'Notifications Action': { propKey: 'event:props:action', fieldName: 'action' },
  'Privacy Action': { propKey: 'event:props:action', fieldName: 'action' },
  'Modal Opened': { propKey: 'event:props:modal', fieldName: 'modal' },
  'Modal Closed': { propKey: 'event:props:modal', fieldName: 'modal' },
  'Breakpoint Changed': { propKey: 'event:props:to', fieldName: 'to' },
  'Orientation Changed': { propKey: 'event:props:to', fieldName: 'to' },
};

async function enrichGoalWithDetails(
  conversion: PlausibleGoalConversion,
  period: string,
  pageFilter?: string
): Promise<void> {
  const mapping = GOAL_DETAIL_PROPERTIES[conversion.goal];
  if (!mapping) return;

  const filter = pageFilter
    ? `event:goal==${conversion.goal};${pageFilter}`
    : `event:goal==${conversion.goal}`;

  try {
    let breakdown = await fetchBreakdown(mapping.propKey, period, filter, 'visitors', 10);
    let fieldName = mapping.fieldName;

    if (breakdown.length === 0 && conversion.goal === 'Section Viewed') {
      breakdown = await fetchBreakdown('event:props:section_id', period, filter, 'visitors', 10);
      if (breakdown.length > 0) {
        fieldName = 'section_id';
      }
    }

    if (breakdown.length > 0) {
      conversion.details = breakdown.map((item: PlausibleBreakdownRow) => ({
        property: mapping.fieldName,
        value: String(item[fieldName] ?? item[mapping.fieldName] ?? item.value ?? '(unknown)'),
        visitors: item.visitors || 0,
      }));
    }
  } catch {
    // Non-fatal if property has not been collected yet
  }
}

/**
 * Fetches breakdown of devices, operating systems, and browsers for a page or domain.
 */
export async function getPlausibleTechBreakdown(
  urlOrPath?: string,
  period: string = 'last_28_days',
  totalVisitors?: number
): Promise<TechBreakdown> {
  const normPath = urlOrPath ? normalizePath(urlOrPath) : undefined;
  const filter = normPath ? `event:page==${normPath}` : undefined;

  const [rawDevices, rawOs, rawBrowsers, rawScreenBuckets, rawOrientations] = await Promise.all([
    fetchBreakdown('visit:device', period, filter, 'visitors,bounce_rate,visit_duration', 10),
    fetchBreakdown('visit:os', period, filter, 'visitors,bounce_rate,visit_duration', 10),
    fetchBreakdown('visit:browser', period, filter, 'visitors,bounce_rate,visit_duration', 10),
    fetchBreakdown('event:props:screen_bucket', period, filter, 'visitors', 10).catch(() => []),
    fetchBreakdown('event:props:screen_orientation', period, filter, 'visitors', 5).catch(() => []),
  ]);

  const mapToMetric = (items: PlausibleBreakdownRow[], keyName: string): TechDimensionMetric[] => {
    const sumVisitors = totalVisitors || items.reduce((acc, curr) => acc + (curr.visitors || 0), 0) || 1;
    return items.map((item) => {
      const visitors = item.visitors || 0;
      return {
        name: String(item[keyName] || '(not set)'),
        visitors,
        percentage: Number(((visitors / sumVisitors) * 100).toFixed(1)),
        bounceRate: item.bounce_rate != null ? Number(item.bounce_rate.toFixed(1)) : null,
        visitDuration: item.visit_duration != null ? Math.round(item.visit_duration) : null,
      };
    });
  };

  return {
    devices: mapToMetric(rawDevices, 'device'),
    operatingSystems: mapToMetric(rawOs, 'os'),
    browsers: mapToMetric(rawBrowsers, 'browser'),
    screenBuckets: rawScreenBuckets.length > 0 ? mapToMetric(rawScreenBuckets, 'screen_bucket') : undefined,
    orientations: rawOrientations.length > 0 ? mapToMetric(rawOrientations, 'screen_orientation') : undefined,
  };
}

/**
 * Fetches breakdown of countries for a page or domain.
 */
export async function getPlausibleGeoBreakdown(
  urlOrPath?: string,
  period: string = 'last_28_days',
  totalVisitors?: number,
  limit: number = 20
): Promise<GeoDimensionMetric[]> {
  const normPath = urlOrPath ? normalizePath(urlOrPath) : undefined;
  const filter = normPath ? `event:page==${normPath}` : undefined;

  const rawCountries = await fetchBreakdown('visit:country', period, filter, 'visitors,bounce_rate,visit_duration', limit);
  const sumVisitors = totalVisitors || rawCountries.reduce((acc, curr) => acc + (curr.visitors || 0), 0) || 1;

  return rawCountries.map((item: PlausibleBreakdownRow) => ({
    country: item.country || '(unknown)',
    visitors: item.visitors || 0,
    percentage: Number((((item.visitors || 0) / sumVisitors) * 100).toFixed(1)),
    bounceRate: item.bounce_rate != null ? Number(item.bounce_rate.toFixed(1)) : null,
    visitDuration: item.visit_duration != null ? Math.round(item.visit_duration) : null,
  }));
}

/**
 * Fetches breakdown of UTM campaign tracking parameters.
 */
export async function getPlausibleUtmBreakdown(
  period: string = 'last_28_days',
  urlOrPath?: string,
  limit: number = 20
): Promise<UtmCampaignMetric[]> {
  const normPath = urlOrPath ? normalizePath(urlOrPath) : undefined;
  const filter = normPath ? `event:page==${normPath}` : undefined;

  const rawCampaigns = await fetchBreakdown('visit:utm_campaign', period, filter, 'visitors,bounce_rate,visit_duration', limit);

  return rawCampaigns.map((item: PlausibleBreakdownRow) => ({
    campaign: item.utm_campaign || '(not set)',
    visitors: item.visitors || 0,
    bounceRate: item.bounce_rate != null ? Number(item.bounce_rate.toFixed(1)) : null,
    visitDuration: item.visit_duration != null ? Math.round(item.visit_duration) : null,
  }));
}

/**
 * Fetches domain-wide goal conversions and top download / outbound link targets.
 */
export async function getPlausibleSiteGoals(
  period: string = 'last_28_days'
): Promise<PlausibleGoalConversion[]> {
  const rawGoals = await fetchBreakdown('event:goal', period, undefined, 'visitors', 30);
  const result: PlausibleGoalConversion[] = [];

  for (const item of rawGoals) {
    const goalName = item.goal || '';
    const visitors = item.visitors || 0;

    // Skip individual scroll percentage lines in top-level goal overview
    if (goalName.startsWith('Overall Scroll Depth >=')) continue;

    const conversion: PlausibleGoalConversion = {
      goal: goalName,
      visitors,
    };
    result.push(conversion);
  }

  await Promise.all(result.map((conversion) => enrichGoalWithDetails(conversion, period)));

  return result;
}

/**
 * Fetches section/heading dwell breakdown for a page.
 */
export async function getSectionDwellBreakdown(
  urlOrPath: string,
  period: string = 'last_28_days',
  limit: number = 100
): Promise<Record<string, SectionDwellMetric>> {
  const normPath = normalizePath(urlOrPath);
  const filter = `event:name==Section Viewed;event:page==${normPath}`;
  let raw = await fetchBreakdown('event:props:id', period, filter, 'visitors,events', limit);

  // If no results and path has trailing slash, try alternative slash
  if (raw.length === 0 && normPath !== '/') {
    const altPath = normPath.endsWith('/') ? normPath.slice(0, -1) : `${normPath}/`;
    raw = await fetchBreakdown('event:props:id', period, `event:name==Section Viewed;event:page==${altPath}`, 'visitors,events', limit);
  }

  // Fallback: check legacy custom event "Section Viewed" with property "section_id"
  if (raw.length === 0) {
    let legacyRaw = await fetchBreakdown('event:props:section_id', period, `event:name==Section Viewed;event:page==${normPath}`, 'visitors', limit);
    if (legacyRaw.length === 0 && normPath !== '/') {
      const altPath = normPath.endsWith('/') ? normPath.slice(0, -1) : `${normPath}/`;
      legacyRaw = await fetchBreakdown('event:props:section_id', period, `event:name==Section Viewed;event:page==${altPath}`, 'visitors', limit);
    }
    for (const item of legacyRaw) {
      const id = String(item.section_id ?? item.id ?? item.value ?? '');
      if (id) {
        raw.push({ id, visitors: item.visitors || 0, events: item.events || item.visitors || 0 });
      }
    }
  }

  const result: Record<string, SectionDwellMetric> = {};
  for (const item of raw) {
    const id = String(item.id ?? item['event:props:id'] ?? item.value ?? '');
    if (!id || id === '(not set)' || id === '(unknown)') continue;
    result[id] = {
      id,
      visitors: item.visitors || 0,
      events: item.events || item.visitors || 0,
    };
  }
  return result;
}

/**
 * Fetches preview card impressions, clicks, and CTR breakdown for a page.
 */
export async function getCardCtrBreakdown(
  urlOrPath: string,
  period: string = 'last_28_days',
  limit: number = 100
): Promise<Record<string, CardCtrMetric>> {
  const normPath = normalizePath(urlOrPath);

  const fetchWithAlt = async (eventName: string) => {
    let raw = await fetchBreakdown('event:props:id', period, `event:name==${eventName};event:page==${normPath}`, 'visitors,events', limit);
    if (raw.length === 0 && normPath !== '/') {
      const altPath = normPath.endsWith('/') ? normPath.slice(0, -1) : `${normPath}/`;
      raw = await fetchBreakdown('event:props:id', period, `event:name==${eventName};event:page==${altPath}`, 'visitors,events', limit);
    }
    return raw;
  };

  const [viewsRaw, clicksRaw] = await Promise.all([
    fetchWithAlt('Card Viewed'),
    fetchWithAlt('Card Clicked'),
  ]);

  const map = new Map<string, { views: number; clicks: number }>();

  for (const item of viewsRaw) {
    const id = String(item.id ?? item['event:props:id'] ?? item.value ?? '');
    if (!id || id === '(not set)' || id === '(unknown)') continue;
    const entry = map.get(id) || { views: 0, clicks: 0 };
    entry.views = item.visitors || item.events || 0;
    map.set(id, entry);
  }

  for (const item of clicksRaw) {
    const id = String(item.id ?? item['event:props:id'] ?? item.value ?? '');
    if (!id || id === '(not set)' || id === '(unknown)') continue;
    const entry = map.get(id) || { views: 0, clicks: 0 };
    entry.clicks = item.visitors || item.events || 0;
    map.set(id, entry);
  }

  const result: Record<string, CardCtrMetric> = {};
  for (const [id, data] of map.entries()) {
    const ctr = data.views > 0 ? Number(((data.clicks / data.views) * 100).toFixed(1)) : 0;
    result[id] = {
      id,
      views: data.views,
      clicks: data.clicks,
      ctr,
    };
  }

  return result;
}

/**
 * Fetches comprehensive inbound/outbound visitor flow and action rates for a specific URL path
 * using exact ephemeral `flow_id` + `flow_step` span-tracing chains.
 */
export async function getPlausibleVisitorFlow(
  urlOrPath: string,
  period: string = 'last_28_days',
  baseVisitors: number = 0,
  baseEntries: number = 0,
  _baseBounceRate: number | null = null,
  basePageviews: number = 0
): Promise<PlausibleVisitorFlow> {
  const normPath = normalizePath(urlOrPath);
  const altPath = normPath !== '/' ? (normPath.endsWith('/') ? normPath.slice(0, -1) : `${normPath}/`) : null;
  const totalViews = Math.max(basePageviews || baseVisitors, baseVisitors);
  const totalVisitors = Math.max(1, totalViews);

  const fetchWithAlt = async (
    property: string,
    buildFilter: (p: string) => string,
    limit: number = 15,
    metrics: string = 'visitors'
  ): Promise<PlausibleBreakdownRow[]> => {
    let rows = await fetchBreakdown(property, period, buildFilter(normPath), metrics, limit).catch(() => []);
    if (rows.length === 0 && altPath) {
      rows = await fetchBreakdown(property, period, buildFilter(altPath), metrics, limit).catch(() => []);
    }
    return rows;
  };

  const [
    entrySourcesRaw,
    pageSourcesRaw,
    flowIdsOnPageRaw,
    fileDownloadsRaw,
    highIntentPdfUrlRaw,
    highIntentPdfDeckRaw,
    outboundLinksRaw,
  ] = await Promise.all([
    fetchWithAlt('visit:source', (p) => `visit:entry_page==${p}`, 12),
    fetchWithAlt('visit:source', (p) => `event:page==${p}`, 12),
    fetchWithAlt('event:props:flow_id', (p) => `event:page==${p}`, 200, 'visitors,events'),
    fetchWithAlt('event:props:url', (p) => `event:goal==File Download;event:page==${p}`, 12),
    fetchWithAlt('event:props:url', (p) => `event:name==High Intent: PDF Download;event:page==${p}`, 12),
    fetchWithAlt('event:props:deck_id', (p) => `event:name==High Intent: PDF Download;event:page==${p}`, 12),
    fetchWithAlt('event:props:url', (p) => `event:goal==Outbound Link: Click;event:page==${p}`, 15),
  ]);

  // 1. Exact Span-Tracing Chain Reconstruction (`flow_id` -> `flow_step`, using `events` / Views)
  const flowIdVisitorsMap = new Map<string, number>();
  let untrackedFromRows = 0;
  for (const row of flowIdsOnPageRaw) {
    const rawId = String(row.flow_id ?? row['event:props:flow_id'] ?? row.value ?? '').trim();
    const vis = row.events || row.visitors || 0;
    if (vis <= 0) continue;
    if (
      !rawId ||
      rawId === '(none)' ||
      rawId === '(not set)' ||
      rawId === '(unknown)' ||
      rawId === '000000'
    ) {
      untrackedFromRows += vis;
      continue;
    }
    flowIdVisitorsMap.set(rawId, Math.max(flowIdVisitorsMap.get(rawId) || 0, vis));
  }

  const validFlowIds = Array.from(flowIdVisitorsMap.keys());
  const chains: VisitorFlowChain[] = [];
  const stepActions: Record<string, { fileVisitors: number; linkVisitors: number }> = {};

  if (validFlowIds.length > 0) {
    const config = getConfig();
    const { period: plausiblePeriod, date: plausibleDate } = resolvePlausibleParams(period);
    const v2DateRange = plausibleDate ? plausibleDate.split(',') : plausiblePeriod;

    interface PlausibleV2ResultRow {
      dimensions?: Array<string | number | null>;
      metrics?: Array<number | null>;
    }

    let v2Results: PlausibleV2ResultRow[] = [];
    let v2ActionResults: PlausibleV2ResultRow[] = [];
    if (config.plausible.apiKey) {
      const headers = {
        Authorization: `Bearer ${config.plausible.apiKey}`,
        'Content-Type': 'application/json',
      };
      const v2Endpoint = `${config.plausible.host}/api/v2/query`;

      const [chainsRes, actionsRes] = await Promise.all([
        fetch(v2Endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            site_id: config.plausible.siteId,
            metrics: ['events', 'visitors'],
            date_range: v2DateRange,
            dimensions: ['event:props:flow_id', 'event:props:flow_step', 'event:page'],
            filters: [['is', 'event:props:flow_id', validFlowIds]],
            pagination: { limit: 1000, offset: 0 },
          }),
        }).catch(() => null),
        fetch(v2Endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            site_id: config.plausible.siteId,
            metrics: ['visitors'],
            date_range: v2DateRange,
            dimensions: ['event:page', 'event:name'],
            filters: [
              ['is', 'event:props:flow_id', validFlowIds],
              [
                'is',
                'event:name',
                [
                  'File Download',
                  'High-Intent: PDF Download',
                  'High Intent: PDF Download',
                  'Outbound Link: Click',
                ],
              ],
            ],
            pagination: { limit: 1000, offset: 0 },
          }),
        }).catch(() => null),
      ]);

      if (chainsRes && chainsRes.ok) {
        try {
          const data = (await chainsRes.json()) as { results?: PlausibleV2ResultRow[] };
          v2Results = data.results || [];
        } catch {
          // ignore parse error
        }
      }

      if (actionsRes && actionsRes.ok) {
        try {
          const data = (await actionsRes.json()) as { results?: PlausibleV2ResultRow[] };
          v2ActionResults = data.results || [];
        } catch {
          // ignore parse error
        }
      }
    }

    for (const row of v2ActionResults) {
      const dims = row.dimensions || [];
      const mets = row.metrics || [];
      const rawPage = String(dims[0] ?? '').trim();
      const rawEvent = String(dims[1] ?? '').trim();
      const vis = Number(mets[0] ?? 0);
      if (!rawPage || !rawEvent || vis <= 0) continue;

      const pageKey = normalizePath(rawPage);
      const entry = stepActions[pageKey] || { fileVisitors: 0, linkVisitors: 0 };
      if (rawEvent === 'Outbound Link: Click') {
        entry.linkVisitors = Math.max(entry.linkVisitors, vis);
      } else {
        entry.fileVisitors = Math.max(entry.fileVisitors, vis);
      }
      stepActions[pageKey] = entry;
    }

    const stepsByFlowId = new Map<
      string,
      Array<{ stepNum: number; path: string; visitors: number }>
    >();

    for (const row of v2Results) {
      const dims = row.dimensions || [];
      const mets = row.metrics || [];
      const rawFlowId = String(dims[0] ?? '').trim().toLowerCase();
      const rawFlowStep = String(dims[1] ?? '').trim();
      const rawPage = String(dims[2] ?? '').trim();
      const evCount = Number(mets[0] ?? 0);
      const visCount = Number(mets[1] ?? 0);
      const vis = evCount > 0 ? evCount : visCount;

      if (!rawFlowId || !rawFlowStep || !rawPage || vis <= 0) continue;

      const stepNum = parseInt(rawFlowStep, 10);
      const stepPath = normalizePath(rawPage);
      if (!Number.isFinite(stepNum)) continue;

      const list = stepsByFlowId.get(rawFlowId) || [];
      list.push({ stepNum, path: stepPath, visitors: vis });
      stepsByFlowId.set(rawFlowId, list);
    }

    for (const [flowId, rawSteps] of stepsByFlowId.entries()) {
      rawSteps.sort((a, b) => a.stepNum - b.stepNum);
      const collapsedSteps: string[] = [];
      let maxStepVis = 1;

      for (const st of rawSteps) {
        if (st.visitors > maxStepVis) maxStepVis = st.visitors;
        if (
          collapsedSteps.length === 0 ||
          collapsedSteps[collapsedSteps.length - 1] !== st.path
        ) {
          collapsedSteps.push(st.path);
        }
      }

      const occurrences = collapsedSteps.filter((p) => p === normPath).length;
      if (occurrences > 0) {
        const flowEvents = flowIdVisitorsMap.get(flowId) || occurrences * maxStepVis;
        const stepWeight = Math.max(1, Math.round(flowEvents / occurrences));
        chains.push({
          flowId,
          visitors: stepWeight,
          steps: collapsedSteps,
        });
      }
    }
  }

  // 2. Derive Upstream & Downstream Pages strictly from `chains` (each occurrence of `normPath` in a chain represents a View)
  const upstreamMap = new Map<string, number>();
  const downstreamMap = new Map<string, number>();
  let chainUpstreamTotalVisitors = 0;
  let chainDownstreamTotalVisitors = 0;
  let chainExitOnCurrentVisitors = 0;
  let chainBounceOnCurrentVisitors = 0;
  let chainExitAfterPrevOnCurrentVisitors = 0;

  for (const chain of chains) {
    for (let idx = 0; idx < chain.steps.length; idx++) {
      if (chain.steps[idx] !== normPath) continue;

      if (idx > 0) {
        const prevPath = chain.steps[idx - 1];
        if (prevPath && prevPath !== normPath) {
          upstreamMap.set(prevPath, (upstreamMap.get(prevPath) || 0) + chain.visitors);
          chainUpstreamTotalVisitors += chain.visitors;
        }
      }

      if (idx < chain.steps.length - 1) {
        const nextPath = chain.steps[idx + 1];
        if (nextPath && nextPath !== normPath) {
          downstreamMap.set(nextPath, (downstreamMap.get(nextPath) || 0) + chain.visitors);
          chainDownstreamTotalVisitors += chain.visitors;
        }
      } else {
        chainExitOnCurrentVisitors += chain.visitors;
        if (chain.steps.length === 1 && chain.steps[0] === normPath) {
          chainBounceOnCurrentVisitors += chain.visitors;
        } else if (idx > 0) {
          chainExitAfterPrevOnCurrentVisitors += chain.visitors;
        }
      }
    }
  }

  const upstreamPages: VisitorFlowItem[] = Array.from(upstreamMap.entries())
    .map(([pathKey, visitors]) => ({
      id: `upstream:${pathKey}`,
      label: pathKey,
      visitors,
      percentage: Number(((visitors / totalVisitors) * 100).toFixed(1)),
      kind: 'upstream_page' as const,
      href: pathKey,
      isInternalPage: true,
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 10);

  const downstreamPages: VisitorFlowItem[] = Array.from(downstreamMap.entries())
    .map(([pathKey, visitors]) => ({
      id: `next:${pathKey}`,
      label: pathKey,
      visitors,
      percentage: Number(((visitors / totalVisitors) * 100).toFixed(1)),
      kind: 'internal_next' as const,
      href: pathKey,
      isInternalPage: true,
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 10);

  // 3. Inbound External Sources (`visit:source` on `normPath`)
  const activeSourceRows = entrySourcesRaw.length > 0 ? entrySourcesRaw : pageSourcesRaw;
  const inboundSources: VisitorFlowItem[] = [];
  for (const row of activeSourceRows) {
    const rawSource = String(row.source ?? row['visit:source'] ?? row.value ?? 'Direct').trim();
    const visitors = row.visitors || 0;
    if (visitors <= 0) continue;
    const label = !rawSource || rawSource === '(none)' || rawSource === '(not set)' || rawSource === 'Direct / None' ? 'Direct' : rawSource;
    const existing = inboundSources.find((s) => s.label === label);
    if (existing) {
      existing.visitors += visitors;
      existing.percentage = Number(((existing.visitors / totalVisitors) * 100).toFixed(1));
    } else {
      inboundSources.push({
        id: `source:${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        label,
        visitors,
        percentage: Number(((visitors / totalVisitors) * 100).toFixed(1)),
        kind: 'entry_source',
        isInternalPage: false,
      });
    }
  }
  inboundSources.sort((a, b) => b.visitors - a.visitors);

  // 4. PDF & File Downloads on Current Page
  const pdfMap = new Map<string, { label: string; visitors: number; href?: string }>();
  const formatFileLabel = (rawUrl: string): { key: string; label: string; href?: string } => {
    const cleaned = rawUrl.trim();
    try {
      const parsed = new URL(cleaned, 'https://hackenberg.tech');
      const parts = parsed.pathname.split('/').filter(Boolean);
      const fileName = parts[parts.length - 1] || parsed.pathname;
      return {
        key: parsed.pathname.toLowerCase(),
        label: decodeURIComponent(fileName),
        href: parsed.pathname,
      };
    } catch {
      const parts = cleaned.split('/').filter(Boolean);
      const fileName = parts[parts.length - 1] || cleaned;
      return { key: cleaned.toLowerCase(), label: fileName };
    }
  };

  for (const row of [...fileDownloadsRaw, ...highIntentPdfUrlRaw]) {
    const rawUrl = String(row.url ?? row['event:props:url'] ?? row.value ?? '').trim();
    const vis = row.visitors || 0;
    if (!rawUrl || rawUrl === '(none)' || rawUrl === '(not set)' || vis <= 0) continue;
    const { key, label, href } = formatFileLabel(rawUrl);
    const prev = pdfMap.get(key);
    if (!prev || vis > prev.visitors) {
      pdfMap.set(key, { label, visitors: vis, href });
    }
  }

  if (pdfMap.size === 0 && highIntentPdfDeckRaw.length > 0) {
    for (const row of highIntentPdfDeckRaw) {
      const deckId = String(row.deck_id ?? row['event:props:deck_id'] ?? row.value ?? '').trim();
      const vis = row.visitors || 0;
      if (!deckId || deckId === '(none)' || deckId === '(not set)' || vis <= 0) continue;
      const key = `${deckId.toLowerCase()}.pdf`;
      const prev = pdfMap.get(key);
      if (!prev || vis > prev.visitors) {
        pdfMap.set(key, { label: `${deckId}.pdf`, visitors: vis });
      }
    }
  }

  const pdfDownloads: VisitorFlowItem[] = Array.from(pdfMap.entries())
    .map(([key, item]) => ({
      id: `pdf:${key}`,
      label: item.label,
      visitors: item.visitors,
      percentage: Number(((item.visitors / totalVisitors) * 100).toFixed(1)),
      kind: 'pdf_download' as const,
      href: item.href,
      isInternalPage: false,
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 8);

  // 5. Outbound Links on Current Page
  const outboundMap = new Map<string, { label: string; visitors: number; href: string }>();
  for (const row of outboundLinksRaw) {
    const rawUrl = String(row.url ?? row['event:props:url'] ?? row.value ?? '').trim();
    const vis = row.visitors || 0;
    if (!rawUrl || rawUrl === '(none)' || rawUrl === '(not set)' || vis <= 0) continue;
    let label = rawUrl;
    try {
      const parsed = new URL(rawUrl);
      const shortPath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
      label = `${parsed.hostname.replace(/^www\./, '')}${shortPath}`;
      if (label.length > 38) {
        label = `${label.slice(0, 35)}...`;
      }
    } catch {
      // keep rawUrl
    }
    const prev = outboundMap.get(rawUrl);
    if (!prev || vis > prev.visitors) {
      outboundMap.set(rawUrl, { label, visitors: vis, href: rawUrl });
    }
  }

  const outboundLinks: VisitorFlowItem[] = Array.from(outboundMap.entries())
    .map(([key, item]) => ({
      id: `outbound:${key}`,
      label: item.label,
      visitors: item.visitors,
      percentage: Number(((item.visitors / totalVisitors) * 100).toFixed(1)),
      kind: 'outbound_link' as const,
      href: item.href,
      isInternalPage: false,
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 8);

  // 6. Compute Summary Totals & Rates relative to `totalViews` (`100% = Views`)
  const directEntries = totalViews > 0 ? Math.min(totalViews, Math.max(0, baseEntries || 0)) : 0;
  const directEntryRate = totalViews > 0 ? Number(((directEntries / totalVisitors) * 100).toFixed(1)) : 0;

  if (directEntries > 0 && inboundSources.length === 0) {
    inboundSources.push({
      id: 'source:direct',
      label: 'Direct',
      visitors: directEntries,
      percentage: directEntryRate,
      kind: 'entry_source',
      isInternalPage: false,
    });
  }

  const internalUpstreamVisitors =
    totalViews > 0 ? Math.min(totalViews, chainUpstreamTotalVisitors) : 0;
  const internalUpstreamRate =
    totalViews > 0 ? Number(((internalUpstreamVisitors / totalVisitors) * 100).toFixed(1)) : 0;

  const internalNextVisitors =
    totalViews > 0 ? Math.min(totalViews, chainDownstreamTotalVisitors) : 0;
  const internalNextRate =
    totalViews > 0 ? Number(((internalNextVisitors / totalVisitors) * 100).toFixed(1)) : 0;

  const pdfDownloadVisitors =
    totalViews > 0 ? Math.min(totalViews, pdfDownloads.reduce((acc, item) => acc + item.visitors, 0)) : 0;
  const pdfDownloadRate = totalViews > 0 ? Number(((pdfDownloadVisitors / totalVisitors) * 100).toFixed(1)) : 0;

  const outboundLinkVisitors =
    totalViews > 0 ? Math.min(totalViews, outboundLinks.reduce((acc, item) => acc + item.visitors, 0)) : 0;
  const outboundLinkRate = totalViews > 0 ? Number(((outboundLinkVisitors / totalVisitors) * 100).toFixed(1)) : 0;

  if (pdfDownloadVisitors > 0 || outboundLinkVisitors > 0) {
    const currAct = stepActions[normPath] || { fileVisitors: 0, linkVisitors: 0 };
    currAct.fileVisitors = Math.max(currAct.fileVisitors, pdfDownloadVisitors);
    currAct.linkVisitors = Math.max(currAct.linkVisitors, outboundLinkVisitors);
    stepActions[normPath] = currAct;
  }

  const bounceVisitors =
    totalViews > 0 ? Math.min(totalViews, chainBounceOnCurrentVisitors) : 0;
  const exitVisitors =
    totalViews > 0
      ? Math.min(Math.max(0, totalViews - bounceVisitors), chainExitAfterPrevOnCurrentVisitors)
      : 0;
  const bounceOrExitVisitors =
    totalViews > 0 ? Math.min(totalViews, bounceVisitors + exitVisitors) : 0;

  const bounceOrExitRate =
    totalViews > 0 ? Number(((bounceOrExitVisitors / totalVisitors) * 100).toFixed(1)) : 0;
  const bounceRate =
    totalViews > 0 ? Number(((bounceVisitors / totalVisitors) * 100).toFixed(1)) : 0;
  const exitRate =
    totalViews > 0 ? Number(((exitVisitors / totalVisitors) * 100).toFixed(1)) : 0;

  let trackedFlowViews = 0;
  for (const vis of flowIdVisitorsMap.values()) {
    trackedFlowViews += vis;
  }
  const rawUntracked =
    untrackedFromRows > 0 ? untrackedFromRows : Math.max(0, totalViews - trackedFlowViews);
  const untrackedVisitors = totalViews > 0 ? Math.min(totalViews, rawUntracked) : 0;
  const untrackedRate =
    totalViews > 0 ? Number(((untrackedVisitors / totalViews) * 100).toFixed(1)) : 0;

  return {
    totalVisitors: totalViews,
    uniqueVisitors: baseVisitors,
    directEntries,
    directEntryRate,
    internalUpstreamVisitors,
    internalUpstreamRate,
    internalNextVisitors,
    internalNextRate,
    pdfDownloadVisitors,
    pdfDownloadRate,
    outboundLinkVisitors,
    outboundLinkRate,
    bounceOrExitVisitors,
    bounceOrExitRate,
    bounceVisitors,
    bounceRate,
    exitVisitors,
    exitRate,
    inboundSources,
    upstreamPages,
    downstreamPages,
    pdfDownloads,
    outboundLinks,
    chains,
    stepActions,
    untrackedVisitors,
    untrackedRate,
  };
}


