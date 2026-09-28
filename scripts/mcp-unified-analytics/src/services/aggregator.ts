import { getGscPagePerformance } from '../clients/gsc.js';
import { getPlausiblePageMetrics } from '../clients/plausible.js';
import { normalizePath, toFullUrl } from './normalizer.js';
import type { UnifiedPageAudit, PlausiblePageMetrics } from '../types.js';

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
    getPlausiblePageMetrics(normPath, period).catch((): PlausiblePageMetrics => ({
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

    // Scroll Funnel Assessment
    if (plausibleMetrics.scrollFunnel) {
      const { readThroughRate, medianScrollDepth, milestones } = plausibleMetrics.scrollFunnel;
      if (readThroughRate !== null && readThroughRate >= 40) {
        notes.push(`High reader retention: ${readThroughRate}% of visitors read through to >= 90% scroll depth.`);
      } else if (readThroughRate !== null && readThroughRate < 15 && plausibleMetrics.visitors >= 15) {
        notes.push(`Low read-through rate (${readThroughRate}%): Most visitors abandon before the end. Consider adding structured sub-headings or reducing wall-of-text fatigue.`);
      }

      // Check early drop-off (10% to 30%)
      const m10 = milestones.find((m) => m.depth === 10);
      const m30 = milestones.find((m) => m.depth === 30);
      if (m10 && m30 && m10.visitors >= 10) {
        const drop10to30 = ((m10.visitors - m30.visitors) / m10.visitors) * 100;
        if (drop10to30 >= 50) {
          status = 'needs_attention';
          notes.push(`Early drop-off alert: ${drop10to30.toFixed(0)}% of readers leave between 10% and 30% scroll depth. Check hero section, search intent alignment, and hook clarity.`);
        }
      }

      if (medianScrollDepth !== null) {
        notes.push(`Median scroll reach: ${medianScrollDepth}% of page content.`);
      }
    }

    // Tech Breakdown & Anomaly Detection
    const browserIssues: string[] = [];
    const deviceDiscrepancies: string[] = [];
    const scrollFatigue: string[] = [];

    if (plausibleMetrics.tech) {
      const { devices, browsers } = plausibleMetrics.tech;
      const desktop = devices.find((d) => d.name === 'Desktop');
      const mobile = devices.find((d) => d.name === 'Mobile');

      if (desktop && mobile && desktop.visitors >= 5 && mobile.visitors >= 5) {
        if (
          mobile.bounceRate !== null &&
          desktop.bounceRate !== null &&
          mobile.bounceRate > desktop.bounceRate + 25
        ) {
          const msg = `Mobile bounce rate (${mobile.bounceRate}%) is significantly higher than desktop (${desktop.bounceRate}%).`;
          deviceDiscrepancies.push(msg);
          notes.push(`Device discrepancy: ${msg}`);
        }
        if (
          mobile.visitDuration !== null &&
          desktop.visitDuration !== null &&
          desktop.visitDuration > 60 &&
          mobile.visitDuration < desktop.visitDuration * 0.4
        ) {
          const msg = `Mobile duration (${mobile.visitDuration}s) is less than half of desktop (${desktop.visitDuration}s).`;
          deviceDiscrepancies.push(msg);
          notes.push(`Device discrepancy: ${msg}`);
        }
      }

      // Browser anomalies
      const avgBounce = plausibleMetrics.bounceRate;
      const avgDuration = plausibleMetrics.visitDuration;
      for (const b of browsers) {
        if (b.visitors >= 5 && avgBounce !== null && b.bounceRate !== null && b.bounceRate > avgBounce + 25) {
          const msg = `Browser anomaly on ${b.name}: bounce rate is ${b.bounceRate}% (site avg: ${avgBounce}%). Check browser-specific CSS/JS errors.`;
          browserIssues.push(msg);
          notes.push(msg);
        }
        if (b.visitors >= 5 && avgDuration !== null && avgDuration > 60 && b.visitDuration !== null && b.visitDuration < avgDuration * 0.4) {
          const msg = `Browser anomaly on ${b.name}: duration is only ${b.visitDuration}s (site avg: ${avgDuration}s).`;
          browserIssues.push(msg);
          notes.push(msg);
        }
      }
    }

    // Goals summary note
    if (plausibleMetrics.goals && plausibleMetrics.goals.length > 0) {
      const summaryList = plausibleMetrics.goals.map((g) => {
        if (g.details && g.details.length > 0) {
          return `${g.goal} (${g.visitors}x: ${g.details.map((d) => d.value).join(', ')})`;
        }
        return `${g.goal} (${g.visitors}x)`;
      });
      notes.push(`Recorded goal conversions: ${summaryList.join('; ')}`);
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
