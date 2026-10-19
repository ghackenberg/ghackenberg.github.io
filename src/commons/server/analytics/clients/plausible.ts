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
    const [scrollAndGoals, tech, countries, visitorFlow, markovFlow, timeseries] = await Promise.all([
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
      getPlausibleMarkovFlow(
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
      markovFlow,
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

  const [rawDevices, rawOs, rawBrowsers] = await Promise.all([
    fetchBreakdown('visit:device', period, filter, 'visitors,bounce_rate,visit_duration', 10),
    fetchBreakdown('visit:os', period, filter, 'visitors,bounce_rate,visit_duration', 10),
    fetchBreakdown('visit:browser', period, filter, 'visitors,bounce_rate,visit_duration', 10),
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
 * Fetches inbound/outbound visitor flow and action rates for a specific URL path
 * using consent-free `prev_page` step transitions (`event:props:prev_page!=(none)`).
 */
export async function getPlausibleVisitorFlow(
  urlOrPath: string,
  period: string = 'last_28_days',
  _baseVisitors: number = 0,
  _baseEntries: number = 0,
  baseBounceRate: number | null = null,
  _basePageviews: number = 0
): Promise<PlausibleVisitorFlow> {
  const normPath = normalizePath(urlOrPath);
  const altPath =
    normPath !== '/' ? (normPath.endsWith('/') ? normPath.slice(0, -1) : `${normPath}/`) : null;

  const fetchWithAlt = async (
    property: string,
    buildFilter: (p: string) => string,
    limit: number = 15,
    metrics: string = 'visitors'
  ): Promise<PlausibleBreakdownRow[]> => {
    let rows = await fetchBreakdown(property, period, buildFilter(normPath), metrics, limit).catch(
      () => []
    );
    if (rows.length === 0 && altPath) {
      rows = await fetchBreakdown(property, period, buildFilter(altPath), metrics, limit).catch(
        () => []
      );
    }
    return rows;
  };

  const [
    prevPagesRaw,
    nextPagesRaw,
    inboundSourcesRaw,
    fileDownloadUrlsRaw,
    highIntentPdfNamesRaw,
    outboundLinkUrlsRaw,
  ] = await Promise.all([
    fetchWithAlt('event:props:prev_page', (p) => `event:page==${p}`, 25, 'visitors,events'),
    fetchWithAlt('event:page', (p) => `event:props:prev_page==${p}`, 25, 'visitors,events'),
    fetchWithAlt(
      'visit:source',
      (p) => `event:page==${p};event:props:prev_page!=(none)`,
      12
    ),
    fetchWithAlt(
      'event:props:url',
      (p) => `event:name==File Download;event:page==${p};event:props:prev_page!=(none)`,
      15
    ),
    fetchWithAlt(
      'event:props:file',
      (p) => `event:name==High Intent: PDF Download;event:page==${p};event:props:prev_page!=(none)`,
      15
    ),
    fetchWithAlt(
      'event:props:url',
      (p) => `event:name==Outbound Link: Click;event:page==${p};event:props:prev_page!=(none)`,
      15
    ),
  ]);

  let directEntries = 0;
  let trackedUniqueVisitorsSum = 0;
  let untrackedFromRows = 0;
  const upstreamMap = new Map<string, number>();

  for (const row of prevPagesRaw) {
    const rawVal = String(
      row.prev_page ?? row['event:props:prev_page'] ?? row.value ?? ''
    ).trim();
    const views = row.events || row.visitors || 0;
    const uVis = row.visitors || 0;
    if (views <= 0) continue;

    if (
      !rawVal ||
      rawVal === '(none)' ||
      rawVal === '(not set)' ||
      rawVal === '(unknown)'
    ) {
      untrackedFromRows += views;
      continue;
    }

    trackedUniqueVisitorsSum += Math.max(1, uVis);

    if (rawVal === '(entry)') {
      directEntries += views;
      continue;
    }

    if (
      rawVal.startsWith('/') ||
      rawVal.startsWith('http://') ||
      rawVal.startsWith('https://')
    ) {
      const pNorm = normalizePath(rawVal);
      if (!pNorm || pNorm === normPath) {
        directEntries += views;
      } else {
        upstreamMap.set(pNorm, (upstreamMap.get(pNorm) || 0) + views);
      }
    } else {
      directEntries += views;
    }
  }

  const upstreamPages: VisitorFlowItem[] = Array.from(upstreamMap.entries())
    .map(([pathKey, visitors]) => ({
      id: `upstream:${pathKey}`,
      label: pathKey,
      visitors,
      percentage: 0,
      kind: 'upstream_page' as const,
      href: pathKey,
      isInternalPage: true,
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 10);

  const internalUpstreamVisitors = upstreamPages.reduce((acc, item) => acc + item.visitors, 0);
  const totalViews = directEntries + internalUpstreamVisitors;

  if (totalViews <= 0) {
    return {
      totalVisitors: 0,
      uniqueVisitors: 0,
      directEntries: 0,
      directEntryRate: 0,
      internalUpstreamVisitors: 0,
      internalUpstreamRate: 0,
      internalNextVisitors: 0,
      internalNextRate: 0,
      pdfDownloadVisitors: 0,
      pdfDownloadRate: 0,
      outboundLinkVisitors: 0,
      outboundLinkRate: 0,
      bounceOrExitVisitors: 0,
      bounceOrExitRate: 0,
      bounceVisitors: 0,
      bounceRate: 0,
      exitVisitors: 0,
      exitRate: 0,
      inboundSources: [],
      upstreamPages: [],
      downstreamPages: [],
      pdfDownloads: [],
      outboundLinks: [],
      chains: [],
      stepActions: {},
      untrackedVisitors: untrackedFromRows,
      untrackedRate: 0,
    };
  }

  const denom = Math.max(1, totalViews);
  for (const u of upstreamPages) {
    u.percentage = Number(((u.visitors / denom) * 100).toFixed(1));
  }

  const directEntryRate = Number(((directEntries / denom) * 100).toFixed(1));
  const internalUpstreamRate = Number(((internalUpstreamVisitors / denom) * 100).toFixed(1));

  // Downstream internal pages (`event:props:prev_page == normPath`)
  const downstreamMap = new Map<string, number>();
  for (const row of nextPagesRaw) {
    const rawPage = String(row.page ?? row['event:page'] ?? row.value ?? '').trim();
    const views = row.events || row.visitors || 0;
    if (!rawPage || rawPage === '(none)' || rawPage === '(not set)' || views <= 0) continue;
    if (
      !rawPage.startsWith('/') &&
      !rawPage.startsWith('http://') &&
      !rawPage.startsWith('https://')
    ) {
      continue;
    }
    const pNorm = normalizePath(rawPage);
    if (!pNorm || pNorm === normPath) continue;
    downstreamMap.set(pNorm, (downstreamMap.get(pNorm) || 0) + views);
  }

  let downstreamPages: VisitorFlowItem[] = Array.from(downstreamMap.entries())
    .map(([pathKey, visitors]) => ({
      id: `next:${pathKey}`,
      label: pathKey,
      visitors,
      percentage: Number(((visitors / denom) * 100).toFixed(1)),
      kind: 'internal_next' as const,
      href: pathKey,
      isInternalPage: true,
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 10);

  const rawDownstreamSum = downstreamPages.reduce((acc, item) => acc + item.visitors, 0);
  if (rawDownstreamSum > totalViews && downstreamPages.length > 0) {
    const exactQuotas = downstreamPages.map((item, idx) => {
      const exact = (item.visitors / rawDownstreamSum) * totalViews;
      const floored = Math.floor(exact);
      return { idx, item, exact, floored, remainder: exact - floored };
    });
    const currentSum = exactQuotas.reduce((s, q) => s + q.floored, 0);
    let deficit = Math.max(0, Math.round(totalViews - currentSum));
    const sortedByRemainder = [...exactQuotas].sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < sortedByRemainder.length && deficit > 0; i++) {
      sortedByRemainder[i].floored += 1;
      deficit -= 1;
    }
    downstreamPages = exactQuotas
      .map((q) => ({
        ...q.item,
        visitors: q.floored,
        percentage: Number(((q.floored / denom) * 100).toFixed(1)),
      }))
      .filter((x) => x.visitors > 0);
  }

  const internalNextVisitors = downstreamPages.reduce((acc, item) => acc + item.visitors, 0);
  const internalNextRate = Number(((internalNextVisitors / denom) * 100).toFixed(1));

  const remainingTerminations = Math.max(0, totalViews - internalNextVisitors);
  let bounceVisitors = 0;
  if (remainingTerminations > 0 && directEntries > 0) {
    if (baseBounceRate !== null) {
      bounceVisitors = Math.min(
        remainingTerminations,
        Math.min(directEntries, Math.round((baseBounceRate / 100) * directEntries))
      );
    } else {
      bounceVisitors = Math.min(
        remainingTerminations,
        Math.round(remainingTerminations * (directEntries / denom))
      );
    }
  }
  const exitVisitors = Math.max(0, remainingTerminations - bounceVisitors);
  const bounceOrExitVisitors = bounceVisitors + exitVisitors;

  const bounceOrExitRate = Number(((bounceOrExitVisitors / denom) * 100).toFixed(1));
  const bounceRate = Number(((bounceVisitors / denom) * 100).toFixed(1));
  const exitRate = Number(((exitVisitors / denom) * 100).toFixed(1));

  // Inbound External Sources (`visit:source` on `normPath` with `prev_page != (none)`)
  const inboundSources: VisitorFlowItem[] = [];
  if (directEntries > 0) {
    for (const row of inboundSourcesRaw) {
      const rawSource = String(row.source ?? row['visit:source'] ?? row.value ?? 'Direct').trim();
      const visitors = Math.min(directEntries, row.visitors || 0);
      if (visitors <= 0) continue;
      const label =
        !rawSource ||
        rawSource === '(none)' ||
        rawSource === '(not set)' ||
        rawSource === 'Direct / None'
          ? 'Direct'
          : rawSource;
      const existing = inboundSources.find((s) => s.label === label);
      if (existing) {
        existing.visitors = Math.min(directEntries, existing.visitors + visitors);
        existing.percentage = Number(((existing.visitors / denom) * 100).toFixed(1));
      } else {
        inboundSources.push({
          id: `source:${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          label,
          visitors,
          percentage: Number(((visitors / denom) * 100).toFixed(1)),
          kind: 'entry_source',
          isInternalPage: false,
        });
      }
    }
    inboundSources.sort((a, b) => b.visitors - a.visitors);
  }

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

  // PDF & File Downloads on Current Page (`prev_page != (none)`)
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

  for (const row of [...fileDownloadUrlsRaw, ...highIntentPdfNamesRaw]) {
    const rawUrl = String(
      row.url ??
        row['event:props:url'] ??
        row.file ??
        row['event:props:file'] ??
        row.value ??
        ''
    ).trim();
    const vis = Math.min(totalViews, row.visitors || 0);
    if (!rawUrl || rawUrl === '(none)' || rawUrl === '(not set)' || vis <= 0) continue;
    const { key, label, href } = formatFileLabel(rawUrl);
    const prev = pdfMap.get(key);
    if (!prev || vis > prev.visitors) {
      pdfMap.set(key, { label, visitors: vis, href });
    }
  }

  const pdfDownloads: VisitorFlowItem[] = Array.from(pdfMap.entries())
    .map(([key, item]) => ({
      id: `pdf:${key}`,
      label: item.label,
      visitors: item.visitors,
      percentage: Number(((item.visitors / denom) * 100).toFixed(1)),
      kind: 'pdf_download' as const,
      href: item.href,
      isInternalPage: false,
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 8);

  const pdfDownloadVisitors = Math.min(
    totalViews,
    pdfDownloads.reduce((acc, item) => acc + item.visitors, 0)
  );
  const pdfDownloadRate = Number(((pdfDownloadVisitors / denom) * 100).toFixed(1));

  // Outbound Links on Current Page (`prev_page != (none)`)
  const outboundMap = new Map<string, { label: string; visitors: number; href: string }>();
  for (const row of outboundLinkUrlsRaw) {
    const rawUrl = String(row.url ?? row['event:props:url'] ?? row.value ?? '').trim();
    const vis = Math.min(totalViews, row.visitors || 0);
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
      percentage: Number(((item.visitors / denom) * 100).toFixed(1)),
      kind: 'outbound_link' as const,
      href: item.href,
      isInternalPage: false,
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 8);

  const outboundLinkVisitors = Math.min(
    totalViews,
    outboundLinks.reduce((acc, item) => acc + item.visitors, 0)
  );
  const outboundLinkRate = Number(((outboundLinkVisitors / denom) * 100).toFixed(1));

  const stepActions: Record<string, { fileVisitors: number; linkVisitors: number }> = {};
  if (pdfDownloadVisitors > 0 || outboundLinkVisitors > 0) {
    stepActions[normPath] = {
      fileVisitors: pdfDownloadVisitors,
      linkVisitors: outboundLinkVisitors,
    };
  }

  const trackedUniqueVisitors = Math.min(totalViews, Math.max(1, trackedUniqueVisitorsSum));

  return {
    totalVisitors: totalViews,
    uniqueVisitors: trackedUniqueVisitors,
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
    chains: [],
    stepActions,
    untrackedVisitors: untrackedFromRows,
    untrackedRate: 0,
  };
}

/**
 * Fetches 1st-order Markov transition flow and full historical page aggregates (no `prev_page` filter)
 * for a specific URL path.
 */
export async function getPlausibleMarkovFlow(
  urlOrPath: string,
  period: string = 'last_28_days',
  baseVisitors: number = 0,
  baseEntries: number | null = null,
  baseBounceRate: number | null = null,
  basePageviews: number = 0
): Promise<PlausibleVisitorFlow> {
  const normPath = normalizePath(urlOrPath);
  const altPath =
    normPath !== '/' ? (normPath.endsWith('/') ? normPath.slice(0, -1) : `${normPath}/`) : null;

  const fetchWithAlt = async (
    property: string,
    buildFilter: (p: string) => string,
    limit: number = 15,
    metrics: string = 'visitors'
  ): Promise<PlausibleBreakdownRow[]> => {
    let rows = await fetchBreakdown(property, period, buildFilter(normPath), metrics, limit).catch(
      () => []
    );
    if (rows.length === 0 && altPath) {
      rows = await fetchBreakdown(property, period, buildFilter(altPath), metrics, limit).catch(
        () => []
      );
    }
    return rows;
  };

  const [
    inboundSourcesRaw,
    entryPagesForCurrentRaw,
    exitPagesForCurrentRaw,
    fileDownloadUrlsRaw,
    highIntentPdfNamesRaw,
    outboundLinkUrlsRaw,
  ] = await Promise.all([
    fetchWithAlt('visit:source', (p) => `event:page==${p}`, 12),
    fetchWithAlt('visit:entry_page', (p) => `event:page==${p}`, 15),
    fetchWithAlt('visit:exit_page', (p) => `event:page==${p}`, 20),
    fetchWithAlt('event:props:url', (p) => `event:name==File Download;event:page==${p}`, 15),
    fetchWithAlt(
      'event:props:file',
      (p) => `event:name==High Intent: PDF Download;event:page==${p}`,
      15
    ),
    fetchWithAlt('event:props:url', (p) => `event:name==Outbound Link: Click;event:page==${p}`, 15),
  ]);

  const totalViews = Math.max(basePageviews || baseVisitors, baseVisitors);
  const denom = Math.max(1, totalViews);

  const extractInternalPages = (
    rows: PlausibleBreakdownRow[],
    fieldKeys: string[]
  ): Map<string, number> => {
    const map = new Map<string, number>();
    for (const row of rows) {
      let rawVal = '';
      for (const k of fieldKeys) {
        if (row[k] != null && String(row[k]).trim() !== '') {
          rawVal = String(row[k]).trim();
          break;
        }
      }
      if (!rawVal && row.value != null) {
        rawVal = String(row.value).trim();
      }
      const vis = row.visitors || row.events || 0;
      if (
        !rawVal ||
        rawVal === '(none)' ||
        rawVal === '(not set)' ||
        rawVal === '(unknown)' ||
        vis <= 0
      ) {
        continue;
      }
      if (
        !rawVal.startsWith('/') &&
        !rawVal.startsWith('http://') &&
        !rawVal.startsWith('https://')
      ) {
        continue;
      }
      const pNorm = normalizePath(rawVal);
      if (!pNorm || pNorm === normPath) continue;
      map.set(pNorm, (map.get(pNorm) || 0) + vis);
    }
    return map;
  };

  const scaleItemsToTargetTotal = (
    items: VisitorFlowItem[],
    targetTotal: number,
    denomVal: number
  ): VisitorFlowItem[] => {
    if (items.length === 0 || targetTotal <= 0) return [];
    const sumRaw = items.reduce((s, x) => s + x.visitors, 0);
    if (sumRaw <= 0) return [];
    if (sumRaw === targetTotal) {
      return items.map((item) => ({
        ...item,
        percentage: Number(((item.visitors / denomVal) * 100).toFixed(1)),
      }));
    }

    const exactQuotas = items.map((item, idx) => {
      const exact = (item.visitors / sumRaw) * targetTotal;
      const floored = Math.floor(exact);
      return { idx, item, exact, floored, remainder: exact - floored };
    });

    const currentSum = exactQuotas.reduce((s, q) => s + q.floored, 0);
    let deficit = Math.max(0, Math.round(targetTotal - currentSum));

    const sortedByRemainder = [...exactQuotas].sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < sortedByRemainder.length && deficit > 0; i++) {
      sortedByRemainder[i].floored += 1;
      deficit -= 1;
    }

    return exactQuotas
      .map((q) => ({
        ...q.item,
        visitors: q.floored,
        percentage: Number(((q.floored / denomVal) * 100).toFixed(1)),
      }))
      .filter((x) => x.visitors > 0);
  };

  const upstreamMap = extractInternalPages(entryPagesForCurrentRaw, [
    'entry_page',
    'visit:entry_page',
  ]);
  const downstreamMap = extractInternalPages(exitPagesForCurrentRaw, [
    'exit_page',
    'visit:exit_page',
  ]);

  let upstreamPages: VisitorFlowItem[] = Array.from(upstreamMap.entries())
    .map(([pathKey, visitors]) => ({
      id: `upstream:${pathKey}`,
      label: pathKey,
      visitors,
      percentage: Number(((visitors / denom) * 100).toFixed(1)),
      kind: 'upstream_page' as const,
      href: pathKey,
      isInternalPage: true,
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 8);

  let downstreamPages: VisitorFlowItem[] = Array.from(downstreamMap.entries())
    .map(([pathKey, visitors]) => ({
      id: `next:${pathKey}`,
      label: pathKey,
      visitors,
      percentage: Number(((visitors / denom) * 100).toFixed(1)),
      kind: 'internal_next' as const,
      href: pathKey,
      isInternalPage: true,
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 8);

  const sumUpstream = upstreamPages.reduce((acc, item) => acc + item.visitors, 0);
  const sumDownstream = downstreamPages.reduce((acc, item) => acc + item.visitors, 0);

  let directEntries: number;
  let internalUpstreamVisitors: number;
  if (upstreamPages.length === 0 || sumUpstream <= 0) {
    directEntries = totalViews;
    internalUpstreamVisitors = 0;
    upstreamPages = [];
  } else {
    directEntries =
      baseEntries !== null
        ? Math.min(totalViews, Math.max(0, baseEntries))
        : Math.max(0, totalViews - sumUpstream);
    internalUpstreamVisitors = Math.max(0, totalViews - directEntries);
    upstreamPages = scaleItemsToTargetTotal(upstreamPages, internalUpstreamVisitors, denom);
  }

  const directEntryRate =
    totalViews > 0 ? Number(((directEntries / denom) * 100).toFixed(1)) : 0;
  const internalUpstreamRate =
    totalViews > 0 ? Number(((internalUpstreamVisitors / denom) * 100).toFixed(1)) : 0;

  const bounceVisitors =
    baseBounceRate !== null
      ? Math.min(directEntries, Math.round((baseBounceRate / 100) * directEntries))
      : 0;

  let internalNextVisitors: number;
  if (downstreamPages.length === 0 || sumDownstream <= 0) {
    internalNextVisitors = 0;
    downstreamPages = [];
  } else {
    internalNextVisitors = Math.min(Math.max(0, totalViews - bounceVisitors), sumDownstream);
    downstreamPages = scaleItemsToTargetTotal(downstreamPages, internalNextVisitors, denom);
  }

  const internalNextRate =
    totalViews > 0 ? Number(((internalNextVisitors / denom) * 100).toFixed(1)) : 0;

  const exitVisitors = Math.max(0, totalViews - bounceVisitors - internalNextVisitors);
  const bounceOrExitVisitors = bounceVisitors + exitVisitors;
  const effectiveBounceRate =
    totalViews > 0
      ? Math.round((bounceOrExitVisitors / totalViews) * 100)
      : (baseBounceRate ?? 0);
  const bounceRate =
    totalViews > 0 ? Number(((bounceVisitors / denom) * 100).toFixed(1)) : 0;
  const exitRate =
    totalViews > 0 ? Number(((exitVisitors / denom) * 100).toFixed(1)) : 0;

  // Inbound External Sources
  const inboundSources: VisitorFlowItem[] = [];
  if (totalViews > 0) {
    for (const row of inboundSourcesRaw) {
      const rawSource = String(row.source ?? row['visit:source'] ?? row.value ?? 'Direct').trim();
      const visitors = Math.min(totalViews, row.visitors || 0);
      if (visitors <= 0) continue;
      const label =
        !rawSource ||
        rawSource === '(none)' ||
        rawSource === '(not set)' ||
        rawSource === 'Direct / None'
          ? 'Direct'
          : rawSource;
      const existing = inboundSources.find((s) => s.label === label);
      if (existing) {
        existing.visitors = Math.min(totalViews, existing.visitors + visitors);
        existing.percentage = Number(((existing.visitors / denom) * 100).toFixed(1));
      } else {
        inboundSources.push({
          id: `source:${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          label,
          visitors,
          percentage: Number(((visitors / denom) * 100).toFixed(1)),
          kind: 'entry_source',
          isInternalPage: false,
        });
      }
    }
    inboundSources.sort((a, b) => b.visitors - a.visitors);
  }

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

  // PDF & File Downloads
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

  if (totalViews > 0) {
    for (const row of [...fileDownloadUrlsRaw, ...highIntentPdfNamesRaw]) {
      const rawUrl = String(
        row.url ??
          row['event:props:url'] ??
          row.file ??
          row['event:props:file'] ??
          row.value ??
          ''
      ).trim();
      const vis = Math.min(totalViews, row.visitors || 0);
      if (!rawUrl || rawUrl === '(none)' || rawUrl === '(not set)' || vis <= 0) continue;
      const { key, label, href } = formatFileLabel(rawUrl);
      const prev = pdfMap.get(key);
      if (!prev || vis > prev.visitors) {
        pdfMap.set(key, { label, visitors: vis, href });
      }
    }
  }

  const pdfDownloads: VisitorFlowItem[] = Array.from(pdfMap.entries())
    .map(([key, item]) => ({
      id: `pdf:${key}`,
      label: item.label,
      visitors: item.visitors,
      percentage: Number(((item.visitors / denom) * 100).toFixed(1)),
      kind: 'pdf_download' as const,
      href: item.href,
      isInternalPage: false,
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 8);

  const pdfDownloadVisitors =
    totalViews > 0
      ? Math.min(
          totalViews,
          pdfDownloads.reduce((acc, item) => acc + item.visitors, 0)
        )
      : 0;
  const pdfDownloadRate =
    totalViews > 0 ? Number(((pdfDownloadVisitors / denom) * 100).toFixed(1)) : 0;

  // Outbound Links
  const outboundMap = new Map<string, { label: string; visitors: number; href: string }>();
  if (totalViews > 0) {
    for (const row of outboundLinkUrlsRaw) {
      const rawUrl = String(row.url ?? row['event:props:url'] ?? row.value ?? '').trim();
      const vis = Math.min(totalViews, row.visitors || 0);
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
  }

  const outboundLinks: VisitorFlowItem[] = Array.from(outboundMap.entries())
    .map(([key, item]) => ({
      id: `outbound:${key}`,
      label: item.label,
      visitors: item.visitors,
      percentage: Number(((item.visitors / denom) * 100).toFixed(1)),
      kind: 'outbound_link' as const,
      href: item.href,
      isInternalPage: false,
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 8);

  const outboundLinkVisitors =
    totalViews > 0
      ? Math.min(
          totalViews,
          outboundLinks.reduce((acc, item) => acc + item.visitors, 0)
        )
      : 0;
  const outboundLinkRate =
    totalViews > 0 ? Number(((outboundLinkVisitors / denom) * 100).toFixed(1)) : 0;

  const stepActions: Record<string, { fileVisitors: number; linkVisitors: number }> = {};
  if (pdfDownloadVisitors > 0 || outboundLinkVisitors > 0) {
    stepActions[normPath] = {
      fileVisitors: pdfDownloadVisitors,
      linkVisitors: outboundLinkVisitors,
    };
  }

  return {
    totalVisitors: totalViews,
    uniqueVisitors: Math.max(0, baseVisitors),
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
    bounceOrExitRate: effectiveBounceRate,
    bounceVisitors,
    bounceRate,
    exitVisitors,
    exitRate,
    inboundSources,
    upstreamPages,
    downstreamPages,
    pdfDownloads,
    outboundLinks,
    chains: [],
    stepActions,
    untrackedVisitors: 0,
    untrackedRate: 0,
  };
}

/**
 * Fast-path helper for `?scope=markov`: fetches basic page aggregate (`visitors,pageviews,bounce_rate,entries`)
 * and `getPlausibleMarkovFlow` for a single neighbor page.
 */
export async function getPlausibleMarkovNeighbor(
  urlOrPath: string,
  period: string = 'last_28_days'
): Promise<PlausibleVisitorFlow | null> {
  const config = getConfig();
  if (!config.plausible.apiKey) return null;

  const canonicalPath = normalizePath(urlOrPath);
  const { period: plausiblePeriod, date: plausibleDate } = resolvePlausibleParams(period);

  const fetchAggregate = async (filterPath: string) => {
    const url = new URL(`${config.plausible.host}/api/v1/stats/aggregate`);
    url.searchParams.set('site_id', config.plausible.siteId);
    url.searchParams.set('period', plausiblePeriod);
    if (plausibleDate) {
      url.searchParams.set('date', plausibleDate);
    }
    url.searchParams.set('metrics', 'visitors,pageviews,bounce_rate');
    url.searchParams.set('filters', `event:page==${filterPath}`);

    try {
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${config.plausible.apiKey}`,
        },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.results || {};
    } catch {
      return null;
    }
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

  let [results, entries] = await Promise.all([
    fetchAggregate(canonicalPath),
    fetchEntries(canonicalPath),
  ]);

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

  const visitors = results?.visitors?.value ?? 0;
  const pageviews = results?.pageviews?.value ?? 0;
  const bounceRate =
    results?.bounce_rate?.value != null ? Number(results.bounce_rate.value.toFixed(1)) : null;

  return getPlausibleMarkovFlow(canonicalPath, period, visitors, entries ?? 0, bounceRate, pageviews);
}

/**
 * Fast-path helper for `?scope=flow`: fetches `prev_page` step transition flow
 * (`getPlausibleVisitorFlow`) for a single neighbor page.
 */
export async function getPlausibleFlowNeighbor(
  urlOrPath: string,
  period: string = 'last_28_days'
): Promise<PlausibleVisitorFlow | null> {
  const config = getConfig();
  if (!config.plausible.apiKey) return null;
  const canonicalPath = normalizePath(urlOrPath);
  return getPlausibleVisitorFlow(canonicalPath, period);
}



