import { defineMiddleware } from 'astro:middleware';
import {
  getPlausiblePageMetrics,
  getPlausibleMarkovNeighbor,
  getPlausibleTopPages,
  getGscPagePerformance,
  getSectionDwellBreakdown,
  getCardCtrBreakdown,
  normalizePath,
  type DevOverlayPageData,
  type PlausibleVisitorFlow,
} from '@commons/server/analytics/index.js';

interface CacheEntry {
  timestamp: number;
  data: DevOverlayPageData;
}

interface MarkovCacheEntry {
  timestamp: number;
  data: { path: string; period: string; markovFlow: PlausibleVisitorFlow | null };
}

const cache = new Map<string, CacheEntry>();
const markovCache = new Map<string, MarkovCacheEntry>();
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
    const scope = context.url.searchParams.get('scope');

    try {
      const targetPath = normalizePath(path);

      function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        return Promise.race([
          promise,
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
        ]);
      }

      if (scope === 'markov') {
        const markovKey = `${targetPath}:${period}:markov`;
        const cachedMarkov = markovCache.get(markovKey);

        if (force) {
          markovCache.delete(markovKey);
        } else if (cachedMarkov && Date.now() - cachedMarkov.timestamp < CACHE_TTL_MS) {
          return new Response(JSON.stringify(cachedMarkov.data), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
              'X-Analytics-Cache': 'HIT',
            },
          });
        }

        const markovFlow = await withTimeout(
          getPlausibleMarkovNeighbor(targetPath, period),
          5000
        ).catch(() => null);

        const markovPayload = {
          path: targetPath,
          period,
          markovFlow,
        };
        markovCache.set(markovKey, { timestamp: Date.now(), data: markovPayload });

        return new Response(JSON.stringify(markovPayload), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'X-Analytics-Cache': 'MISS',
          },
        });
      }

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

      const [plausibleRes, gscRes, sectionsRes, cardsRes, pagesRes] = await Promise.allSettled([
        withTimeout(getPlausiblePageMetrics(targetPath, period, true), 5000),
        withTimeout(getGscPagePerformance(targetPath, period), 5000),
        withTimeout(getSectionDwellBreakdown(targetPath, period), 5000),
        withTimeout(getCardCtrBreakdown(targetPath, period), 5000),
        withTimeout(getPlausibleTopPages(period, 500), 5000),
      ]);

      const plausible = plausibleRes.status === 'fulfilled' ? plausibleRes.value : {
        visitors: 0,
        entries: 0,
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
