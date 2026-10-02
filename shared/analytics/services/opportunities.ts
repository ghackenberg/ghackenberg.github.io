import { getGscTopPages } from '../clients/gsc.js';
import { getPlausibleTopPages } from '../clients/plausible.js';
import type { SeoOpportunity } from '../types.js';

export interface FindOpportunitiesOptions {
  period?: string;
  minImpressions?: number;
  limit?: number;
}

export async function findSeoOpportunities(
  options: FindOpportunitiesOptions = {}
): Promise<SeoOpportunity[]> {
  const period = options.period || 'last_28_days';
  const minImpressions = options.minImpressions ?? 30;
  const limit = options.limit ?? 20;

  // Concurrently fetch GSC and Plausible top pages
  const [gscPages, plausibleMap] = await Promise.all([
    getGscTopPages(period, 150).catch((err) => {
      console.warn(`Failed to fetch GSC top pages: ${err.message}`);
      return [];
    }),
    getPlausibleTopPages(period, 150).catch((err) => {
      console.warn(`Failed to fetch Plausible pages: ${err.message}`);
      return new Map();
    }),
  ]);

  const opportunities: SeoOpportunity[] = [];

  for (const gsc of gscPages) {
    const plausible = plausibleMap.get(gsc.page) || {
      visitors: 0,
      pageviews: 0,
      bounceRate: null,
      visitDuration: null,
    };

    // Heuristic 1: Striking Distance (Position 4-15 with significant impressions but low CTR)
    if (gsc.position >= 4.0 && gsc.position <= 15.0 && gsc.impressions >= minImpressions && gsc.ctr < 0.035) {
      opportunities.push({
        path: gsc.page,
        type: 'striking_distance',
        priority: gsc.impressions > 150 ? 'high' : 'medium',
        title: `Striking Distance: Ranking at pos ${gsc.position} with ${gsc.impressions} impressions`,
        description: `Page ranks on page 1-2 (pos ${gsc.position}) but captures only ${(gsc.ctr * 100).toFixed(1)}% CTR. A title and meta description rewrite could push it into top 3.`,
        gsc,
        plausible,
        suggestedAction: 'Update <title> tag with compelling click hook, ensure meta description has explicit value proposition, and add structured schema.',
      });
      continue;
    }

    // Heuristic 2: High Bounce Performer (Decent search traffic / top ranking, but visitors bounce)
    if (
      (gsc.position <= 5.0 || gsc.clicks >= 10) &&
      plausible.bounceRate !== null &&
      plausible.bounceRate >= 75 &&
      plausible.visitors >= 10
    ) {
      opportunities.push({
        path: gsc.page,
        type: 'high_bounce_performer',
        priority: 'high',
        title: `High Bounce Rate (${plausible.bounceRate}%) on Top Performing Search Page`,
        description: `Receives organic clicks (pos ${gsc.position}, ${gsc.clicks} clicks), but ${plausible.bounceRate}% of visitors leave immediately. Possible intent mismatch or slow time-to-value.`,
        gsc,
        plausible,
        suggestedAction: 'Add a concise executive summary or direct answer snippet right under the H1/H2. Add related internal reading links.',
      });
      continue;
    }

    // Heuristic 3: Low CTR High Impressions (Underperforming SERP snippet)
    if (gsc.impressions >= 100 && gsc.ctr < 0.015) {
      opportunities.push({
        path: gsc.page,
        type: 'low_ctr_high_impression',
        priority: 'medium',
        title: `Low SERP CTR (${(gsc.ctr * 100).toFixed(1)}%) with High Impressions (${gsc.impressions})`,
        description: `High search visibility across Google, but users select competitor results over yours.`,
        gsc,
        plausible,
        suggestedAction: 'Align title with user query intent and add numbers/power words to the title.',
      });
    }
  }

  // Heuristic 4: Hidden Champions (Check pages in Plausible with high duration & low bounce, but low GSC impressions)
  for (const [pagePath, plausible] of plausibleMap.entries()) {
    const hasGsc = gscPages.find((p) => p.page === pagePath);
    const gscMetrics = hasGsc || { clicks: 0, impressions: 0, ctr: 0, position: 0 };

    if (
      plausible.visitDuration !== null &&
      plausible.visitDuration >= 90 &&
      plausible.bounceRate !== null &&
      plausible.bounceRate <= 45 &&
      plausible.visitors >= 10 &&
      gscMetrics.impressions < minImpressions
    ) {
      opportunities.push({
        path: pagePath,
        type: 'hidden_champion',
        priority: 'medium',
        title: `Hidden Champion: High Engagement (${plausible.visitDuration}s avg) with Low Search Visibility`,
        description: `Visitors love this page (duration ${plausible.visitDuration}s, bounce ${plausible.bounceRate}%), but GSC records only ${gscMetrics.impressions} impressions.`,
        gsc: gscMetrics,
        plausible,
        suggestedAction: 'Strengthen internal links to this page from top-ranking pillar articles and verify target keywords in headings.',
      });
    }
  }

  // Sort: High priority first, then by impressions
  const priorityOrder = { high: 1, medium: 2, low: 3 };
  opportunities.sort((a, b) => {
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.gsc.impressions - a.gsc.impressions;
  });

  return opportunities.slice(0, limit);
}
