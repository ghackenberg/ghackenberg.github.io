import { defineMiddleware } from 'astro:middleware';
import {
  getPlausiblePageMetrics,
  getPlausibleTopPages,
  getGscPagePerformance,
  getSectionDwellBreakdown,
  getCardCtrBreakdown,
  normalizePath,
  type DevOverlayPageData,
} from '@commons/server/analytics/index.js';

interface CacheEntry {
  timestamp: number;
  data: DevOverlayPageData;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 2 * 60 * 1000;

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.url.pathname === '/api/dev-analytics.json' || context.url.pathname === '/api/dev-analytics') {
    if (!import.meta.env.DEV) {
      return next();
    }

    const headerPath = context.request.headers.get('x-analytics-path');
    const headerPeriod = context.request.headers.get('x-analytics-period');

    const path = headerPath || context.url.searchParams.get('path') || '/';
    const period = headerPeriod || context.url.searchParams.get('period') || '28d';
    const force = context.url.searchParams.get('_t');

    try {

      const targetPath = normalizePath(path);
      const cacheKey = `${targetPath}:${period}`;
      const cached = cache.get(cacheKey);

      if (force) {
        cache.delete(cacheKey);
      } else if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return new Response(JSON.stringify(cached.data), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'X-Analytics-Cache': 'HIT',
          },
        });
      }

      function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        return Promise.race([
          promise,
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
        ]);
      }

      const [plausibleRes, gscRes, sectionsRes, cardsRes, pagesRes] = await Promise.allSettled([
        withTimeout(getPlausiblePageMetrics(targetPath, period, true), 5000),
        withTimeout(getGscPagePerformance(targetPath, period), 5000),
        withTimeout(getSectionDwellBreakdown(targetPath, period), 5000),
        withTimeout(getCardCtrBreakdown(targetPath, period), 5000),
        withTimeout(getPlausibleTopPages(period, 500), 5000),
      ]);

      const plausible = plausibleRes.status === 'fulfilled' ? plausibleRes.value : {
        visitors: 0,
        pageviews: 0,
        bounceRate: null,
        visitDuration: null,
      };

      const gsc = gscRes.status === 'fulfilled' ? gscRes.value : {
        page: targetPath,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        queries: [],
      };

      const sections = sectionsRes.status === 'fulfilled' ? sectionsRes.value : {};
      const cards = cardsRes.status === 'fulfilled' ? cardsRes.value : {};

      const pagesMap = pagesRes.status === 'fulfilled' ? pagesRes.value : new Map();
      const pages: Record<string, { visitors: number; pageviews: number; bounceRate: number | null; visitDuration: number | null }> = {};
      for (const [k, v] of pagesMap.entries()) {
        pages[k] = {
          visitors: v.visitors,
          pageviews: v.pageviews,
          bounceRate: v.bounceRate,
          visitDuration: v.visitDuration,
        };
      }

      const payload: DevOverlayPageData = {
        path: targetPath,
        period,
        plausible,
        gsc: {
          clicks: gsc.clicks,
          impressions: gsc.impressions,
          ctr: gsc.ctr,
          position: gsc.position,
          queries: gsc.queries || [],
        },
        sections,
        cards,
        pages,
      };

      cache.set(cacheKey, { timestamp: Date.now(), data: payload });

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Analytics-Cache': 'MISS',
        },
      });
    } catch (err) {
      console.error('[dev-analytics] Middleware error:', err);
      const message = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return next();
});
