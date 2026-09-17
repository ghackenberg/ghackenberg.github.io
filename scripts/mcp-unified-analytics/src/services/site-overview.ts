import { getGscSiteOverview, getGscSiteTopQueries } from '../clients/gsc.js';
import {
  getPlausibleSiteOverview,
  getPlausibleTrafficSources,
  getPlausibleTopPages,
} from '../clients/plausible.js';
import type {
  SiteOverviewSummary,
  TrafficSourceMetric,
  TopQueriesReport,
  RetentionBottleneck,
} from '../types.js';

export async function getSiteOverview(
  period: string = 'last_28_days'
): Promise<SiteOverviewSummary> {
  const [gscMetrics, plausibleMetrics] = await Promise.all([
    getGscSiteOverview(period).catch((err) => {
      console.warn(`GSC site overview query failed: ${err.message}`);
      return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    }),
    getPlausibleSiteOverview(period).catch((err) => {
      console.warn(`Plausible site overview query failed: ${err.message}`);
      return { visitors: 0, pageviews: 0, bounceRate: null, visitDuration: null };
    }),
  ]);

  const keyRecommendations: string[] = [];
  let trafficHealth: SiteOverviewSummary['assessment']['trafficHealth'] = 'early_stage';

  if (plausibleMetrics.visitors > 500 && gscMetrics.clicks > 100) {
    trafficHealth = 'thriving';
  } else if (plausibleMetrics.visitors > 100 || gscMetrics.clicks > 20) {
    trafficHealth = 'growing';
  } else if (plausibleMetrics.visitors > 20 || gscMetrics.impressions > 50) {
    trafficHealth = 'early_stage';
  } else {
    trafficHealth = 'low_traffic';
  }

  if (gscMetrics.impressions < 300) {
    keyRecommendations.push(
      'Expand non-brand organic search visibility: Target technical topics (Agentic AI, IT Architecture, Simulation) with answer-first sections and keyword-optimized headings.'
    );
  }

  if (plausibleMetrics.bounceRate !== null && plausibleMetrics.bounceRate > 65) {
    keyRecommendations.push(
      `Site-wide bounce rate is high (${plausibleMetrics.bounceRate}%): Introduce cross-content recommendations (related articles, courses, tools) at the bottom of pages.`
    );
  }

  if (plausibleMetrics.visitDuration !== null && plausibleMetrics.visitDuration > 150) {
    keyRecommendations.push(
      `Strong engagement duration (${plausibleMetrics.visitDuration}s avg): Deep readers exist. Guide them toward newsletter/RSS subscriptions or LinkedIn discussions.`
    );
  }

  const summary =
    `Site recorded ${plausibleMetrics.visitors} visitors (${plausibleMetrics.pageviews} pageviews, ` +
    `bounce rate ${plausibleMetrics.bounceRate ?? 'n/a'}%, avg duration ${plausibleMetrics.visitDuration ?? 'n/a'}s) ` +
    `and ${gscMetrics.clicks} Google clicks from ${gscMetrics.impressions} impressions (CTR ${(gscMetrics.ctr * 100).toFixed(1)}%, avg position ${gscMetrics.position.toFixed(1)}).`;

  return {
    period,
    gsc: {
      totalClicks: gscMetrics.clicks,
      totalImpressions: gscMetrics.impressions,
      averageCtr: gscMetrics.ctr,
      averagePosition: gscMetrics.position,
    },
    plausible: {
      totalVisitors: plausibleMetrics.visitors,
      totalPageviews: plausibleMetrics.pageviews,
      averageBounceRate: plausibleMetrics.bounceRate,
      averageVisitDuration: plausibleMetrics.visitDuration,
    },
    assessment: {
      summary,
      trafficHealth,
      keyRecommendations,
    },
  };
}

export async function getTrafficSourcesReport(
  period: string = 'last_28_days',
  limit: number = 20
): Promise<{ period: string; totalSources: number; sources: TrafficSourceMetric[] }> {
  const sources = await getPlausibleTrafficSources(period, limit);
  return {
    period,
    totalSources: sources.length,
    sources,
  };
}

export async function getTopQueriesReport(
  period: string = 'last_28_days',
  limit: number = 25
): Promise<TopQueriesReport> {
  const queries = await getGscSiteTopQueries(period, limit);
  return {
    period,
    totalQueries: queries.length,
    queries,
  };
}

export async function findRetentionBottlenecks(
  period: string = 'last_28_days',
  minVisitors: number = 2
): Promise<{ period: string; bottlenecksFound: number; bottlenecks: RetentionBottleneck[] }> {
  const pagesMap = await getPlausibleTopPages(period, 100);
  const bottlenecks: RetentionBottleneck[] = [];

  for (const [path, metrics] of pagesMap.entries()) {
    if (metrics.visitors < minVisitors) continue;

    const bounceRate = metrics.bounceRate ?? 0;
    const duration = metrics.visitDuration ?? 0;

    // Detect dead ends: bounce rate >= 70% or (duration < 25 and bounce rate >= 50)
    if (bounceRate >= 70 || (duration < 25 && bounceRate >= 50)) {
      let severity: RetentionBottleneck['severity'] = 'moderate';
      if (bounceRate >= 95 && metrics.visitors >= 5) {
        severity = 'critical';
      } else if (bounceRate >= 80 || metrics.visitors >= 5) {
        severity = 'high';
      }

      let issue = `High bounce rate (${bounceRate}%) with ${metrics.visitors} visitors and ${duration}s avg duration.`;
      let recommendation =
        'Add prominent "Next Steps" or related articles/tools at the end of the content to guide visitors to subsequent pages.';

      if (path.startsWith('/services/')) {
        issue = `Service landing page has ${bounceRate}% bounce rate.`;
        recommendation =
          'Add concrete proof points, related case studies/articles, and a friction-free contact widget.';
      } else if (path.startsWith('/posts/')) {
        issue = `Article has ${bounceRate}% bounce rate: Visitors leave immediately after reading.`;
        recommendation =
          'Add related posts/courses teasers, interactive widgets, or an engaging question prompt at the bottom.';
      }

      bottlenecks.push({
        path,
        visitors: metrics.visitors,
        pageviews: metrics.pageviews,
        bounceRate,
        visitDuration: metrics.visitDuration,
        severity,
        issue,
        recommendation,
      });
    }
  }

  // Sort descending by visitors then bounceRate
  bottlenecks.sort((a, b) => b.visitors - a.visitors || b.bounceRate - a.bounceRate);

  return {
    period,
    bottlenecksFound: bottlenecks.length,
    bottlenecks,
  };
}
