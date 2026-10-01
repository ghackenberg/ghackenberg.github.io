import { getConfig } from '../config.js';
import { normalizePath } from '../services/normalizer.js';
import type {
  PlausiblePageMetrics,
  ScrollRetentionData,
  ScrollFunnelMilestone,
  PlausibleGoalConversion,
  GoalConversionDetail,
  TechBreakdown,
  TechDimensionMetric,
  GeoDimensionMetric,
  UtmCampaignMetric,
  SectionDwellMetric,
  CardCtrMetric,
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

/**
 * Low-level breakdown query helper.
 */
export async function fetchBreakdown(
  property: string,
  period: string,
  filter?: string,
  metrics: string = 'visitors,bounce_rate,visit_duration',
  limit: number = 30
): Promise<any[]> {
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
  } catch (err: any) {
    console.warn(`Failed to contact Plausible breakdown API (${property}): ${err.message}`);
    return [];
  }
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

    const baseMetrics = {
      visitors: results.visitors?.value ?? 0,
      pageviews: results.pageviews?.value ?? 0,
      bounceRate: results.bounce_rate?.value != null ? Number(results.bounce_rate.value.toFixed(1)) : null,
      visitDuration: results.visit_duration?.value != null ? Math.round(results.visit_duration.value) : null,
    };

    if (!includeDeepMetrics || baseMetrics.visitors === 0) {
      return baseMetrics;
    }

    // Fetch deep metrics concurrently
    const [scrollAndGoals, tech, countries] = await Promise.all([
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
    ]);

    return {
      ...baseMetrics,
      scrollFunnel: scrollAndGoals.scrollFunnel,
      goals: scrollAndGoals.goals,
      tech,
      countries,
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
  } catch (err: any) {
    console.warn(`Failed to contact Plausible breakdown API: ${err.message}`);
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
  } catch (err: any) {
    console.warn(`Failed to contact Plausible aggregate API: ${err.message}`);
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
    return (data.results || []).map((item: any) => ({
      source: item.source || 'Direct / None',
      visitors: item.visitors || 0,
      bounceRate: item.bounce_rate != null ? Number(item.bounce_rate.toFixed(1)) : null,
      visitDuration: item.visit_duration != null ? Math.round(item.visit_duration) : null,
    }));
  } catch (err: any) {
    console.warn(`Failed to contact Plausible breakdown API: ${err.message}`);
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
  'Section Viewed': { propKey: 'event:props:section_id', fieldName: 'section_id' },
  'Slide Viewed': { propKey: 'event:props:slide_number', fieldName: 'slide_number' },
  'High Intent: Copy Email': { propKey: 'event:props:location', fieldName: 'location' },
  'High Intent: Copy BibTeX': { propKey: 'event:props:title', fieldName: 'title' },
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
    const breakdown = await fetchBreakdown(mapping.propKey, period, filter, 'visitors', 10);
    if (breakdown.length > 0) {
      conversion.details = breakdown.map((item: any) => ({
        property: mapping.fieldName,
        value: String(item[mapping.fieldName] ?? item.value ?? '(unknown)'),
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

  const mapToMetric = (items: any[], keyName: string): TechDimensionMetric[] => {
    const sumVisitors = totalVisitors || items.reduce((acc, curr) => acc + (curr.visitors || 0), 0) || 1;
    return items.map((item) => {
      const visitors = item.visitors || 0;
      return {
        name: item[keyName] || '(not set)',
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

  return rawCountries.map((item: any) => ({
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

  return rawCampaigns.map((item: any) => ({
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

