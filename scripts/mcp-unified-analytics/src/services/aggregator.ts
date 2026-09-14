import { getGscPagePerformance } from '../clients/gsc.js';
import { getPlausiblePageMetrics } from '../clients/plausible.js';
import { normalizePath, toFullUrl } from './normalizer.js';
import type { UnifiedPageAudit } from '../types.js';

export async function getUnifiedPageAudit(
  urlOrPath: string,
  period: string = 'last_28_days'
): Promise<UnifiedPageAudit> {
  const normPath = normalizePath(urlOrPath);
  const fullUrl = toFullUrl(normPath);

  // Execute both queries concurrently
  const [gscMetrics, plausibleMetrics] = await Promise.all([
    getGscPagePerformance(normPath, period).catch((err) => ({
      page: normPath,
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
      queries: [],
      error: err.message,
    })),
    getPlausiblePageMetrics(normPath, period).catch(() => ({
      visitors: 0,
      pageviews: 0,
      bounceRate: null,
      visitDuration: null,
    })),
  ]);

  const notes: string[] = [];
  let status: UnifiedPageAudit['assessment']['status'] = 'healthy';

  if (gscMetrics.impressions === 0 && plausibleMetrics.visitors === 0) {
    status = 'no_data';
    notes.push('No organic search impressions or analytics visitors recorded in this period.');
  } else {
    // Check CTR & Position
    if (gscMetrics.position >= 4 && gscMetrics.position <= 15 && gscMetrics.impressions >= 50 && gscMetrics.ctr < 0.03) {
      status = 'needs_attention';
      notes.push(
        `Striking distance opportunity: Ranking at avg. pos ${gscMetrics.position} with ${gscMetrics.impressions} impressions, but CTR is only ${(gscMetrics.ctr * 100).toFixed(1)}%. Optimizing title and meta description could yield immediate click gains.`
      );
    }

    // Check Bounce Rate
    if (plausibleMetrics.bounceRate !== null && plausibleMetrics.bounceRate > 75 && plausibleMetrics.visitors >= 10) {
      status = 'needs_attention';
      notes.push(
        `High bounce rate (${plausibleMetrics.bounceRate}%): Visitors leave quickly without engaging. Check content relevance, readability, or initial hook.`
      );
    }

    // Check Duration
    if (plausibleMetrics.visitDuration !== null && plausibleMetrics.visitDuration < 30 && plausibleMetrics.visitors >= 10) {
      notes.push(`Short average visit duration (${plausibleMetrics.visitDuration}s). Content may lack depth or immediate answer clarity.`);
    }

    if (gscMetrics.clicks > 10 && plausibleMetrics.visitors > 15 && (plausibleMetrics.bounceRate ?? 0) < 60) {
      notes.push('Strong engagement and solid search performance.');
    }
  }

  return {
    path: normPath,
    fullUrl,
    period,
    gsc: {
      clicks: gscMetrics.clicks,
      impressions: gscMetrics.impressions,
      ctr: gscMetrics.ctr,
      position: gscMetrics.position,
      topQueries: gscMetrics.queries || [],
    },
    plausible: plausibleMetrics,
    assessment: {
      status,
      notes,
    },
  };
}
