import { render } from 'preact';
import type {
  DevSankeyData,
  DevSankeyPageContext,
  SankeyColumnModel,
  SankeyGraphLink,
  SankeyGraphNode,
  SankeyModelMode,
} from './dev-sankey';

export const COL_BG_CENTER_RGB: readonly [number, number, number] = [113, 113, 122];
export const COL_BG_OUTER_RGB: readonly [number, number, number] = [113, 113, 122];

export function getColumnStripeBg(
  colIndex: number,
  _leftLevels: number,
  _rightLevels: number
): { bg: string; headerColor: string } {
  const [r, g, b] = COL_BG_CENTER_RGB;
  const headerColor = colIndex === 0 ? 'text-white font-extrabold' : 'text-zinc-100 font-bold';
  return { bg: `rgb(${r}, ${g}, ${b})`, headerColor };
}

export function formatVisitorCount(v: number): string {
  if (v <= 0) return '0';
  if (v >= 10 || Number.isInteger(v)) return String(Math.round(v));
  const rounded1 = Math.round(v * 10) / 10;
  return rounded1 >= 1 ? String(rounded1) : '<1';
}

export function formatDurationSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatShortDate(iso: string): string {
  const m = iso.match(/^\d{4}-(\d{2}-\d{2})/);
  return m ? m[1] : iso || '--';
}

function NodeMediaBox({ node, sizeClass }: { node: SankeyGraphNode; sizeClass: string }) {
  const thumbUrl = node.pageMeta?.image;
  if (thumbUrl) {
    return (
      <img
        class={`sankey-node-thumb ${sizeClass} object-cover rounded-lg border border-zinc-400/80 shrink-0`}
        src={thumbUrl}
        alt=""
        loading="eager"
      />
    );
  }
  return (
    <span
      class={`sankey-node-emoji-box ${sizeClass} rounded-lg bg-zinc-700/90 border border-zinc-400/80 flex items-center justify-center shrink-0`}
      data-emoji={node.icon}
    >
      {node.icon}
    </span>
  );
}

function CenterInspectorCard({
  node,
  activeFlow,
  period,
  context,
}: {
  node: SankeyGraphNode;
  activeFlow: DevSankeyData;
  period: string;
  context?: DevSankeyPageContext;
}) {
  const totalViews = Math.max(1, activeFlow.totalVisitors);
  const uniqueVisitors = activeFlow.uniqueVisitors ?? activeFlow.totalVisitors;
  const entryVis = node.entryVis;
  const prevVis = activeFlow.internalUpstreamVisitors;
  const nextVis = activeFlow.internalNextVisitors;
  const bounceVis = activeFlow.bounceVisitors ?? 0;
  const exitVis = activeFlow.exitVisitors ?? 0;

  const entryPct = Math.min(100, Math.round((entryVis / totalViews) * 100));
  const prevPct = Math.min(100, Math.round((prevVis / totalViews) * 100));
  const nextPct = Math.min(100, Math.round((nextVis / totalViews) * 100));
  const bouncePct = Math.min(100, Math.round((bounceVis / totalViews) * 100));
  const exitPct = Math.min(100, Math.round((exitVis / totalViews) * 100));

  const filePct = Math.min(100, Math.round((node.fileVis / totalViews) * 100));
  const linkPct = Math.min(100, Math.round((node.linkVis / totalViews) * 100));

  const durationStr = formatDurationSeconds(context?.visitDuration);
  const entrySources = activeFlow.inboundSources.slice(0, 4);
  const queries = (context?.gscQueries ?? []).slice(0, 4);
  const pdfItems = activeFlow.pdfDownloads.slice(0, 3);
  const outboundItems = activeFlow.outboundLinks.slice(0, 3);

  const funnel = context?.scrollFunnel;
  const medStr =
    funnel?.medianScrollDepth !== null && funnel?.medianScrollDepth !== undefined
      ? `${Math.round(funnel.medianScrollDepth)}%`
      : '--';
  const readStr =
    funnel?.readThroughRate !== null && funnel?.readThroughRate !== undefined
      ? `${Math.round(funnel.readThroughRate)}%`
      : '--';
  const rawMilestones = [...(funnel?.milestones ?? [])].sort((a, b) => a.depth - b.depth);

  const getReachPctAtDepth = (targetDepth: number): number => {
    if (rawMilestones.length === 0) return 0;
    if (targetDepth <= 0) return 100;
    const exact = rawMilestones.find((m) => m.depth === targetDepth);
    if (exact) {
      return Math.min(100, Math.max(0, Math.round(exact.percentageOfVisitors)));
    }
    if (targetDepth === 100) {
      const m90 = rawMilestones.find((m) => m.depth === 90);
      return m90 ? Math.min(100, Math.max(0, Math.round(m90.percentageOfVisitors))) : 0;
    }
    const points = [
      { depth: 0, pct: 100 },
      ...rawMilestones.map((m) => ({
        depth: m.depth,
        pct: Math.min(100, Math.max(0, m.percentageOfVisitors)),
      })),
    ];
    let lower = points[0];
    let upper: { depth: number; pct: number } | null = null;
    for (const pt of points) {
      if (pt.depth <= targetDepth) lower = pt;
      if (pt.depth >= targetDepth && !upper) upper = pt;
    }
    if (upper && upper.depth > lower.depth) {
      const t = (targetDepth - lower.depth) / (upper.depth - lower.depth);
      return Math.min(100, Math.max(0, Math.round(lower.pct + t * (upper.pct - lower.pct))));
    }
    return 0;
  };

  const scrollCheckpoints = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const svgPadL = 8;
  const svgPadT = 6;
  const svgPlotW = 304;
  const svgPlotH = 44;
  const scrollPts = scrollCheckpoints.map((d, idx) => {
    const reachPct = getReachPctAtDepth(d);
    const x = svgPadL + (idx / (scrollCheckpoints.length - 1)) * svgPlotW;
    const y = svgPadT + (1 - reachPct / 100) * svgPlotH;
    return { depth: d, reachPct, x, y };
  });

  const scrollLineD = `M ${scrollPts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')}`;
  const scrollAreaD = `${scrollLineD} L ${scrollPts[scrollPts.length - 1].x.toFixed(1)} ${(svgPadT + svgPlotH).toFixed(1)} L ${scrollPts[0].x.toFixed(1)} ${(svgPadT + svgPlotH).toFixed(1)} Z`;
  const gridFractions = [0.25, 0.5, 0.75];

  const rawTrafficSeries = context?.timeseries ?? [];
  const peakViews =
    rawTrafficSeries.length > 0 ? Math.max(...rawTrafficSeries.map((p) => p.pageviews)) : 0;
  const peakVisitors =
    rawTrafficSeries.length > 0 ? Math.max(...rawTrafficSeries.map((p) => p.visitors)) : 0;
  const sumSeriesViews = rawTrafficSeries.reduce((acc, p) => acc + p.pageviews, 0);
  const avgViews =
    rawTrafficSeries.length > 0
      ? String(Math.round((sumSeriesViews / rawTrafficSeries.length) * 10) / 10)
      : '0';
  const maxTrafficY = Math.max(1, peakViews, peakVisitors);

  const trafficSeriesForPlot =
    rawTrafficSeries.length >= 2
      ? rawTrafficSeries
      : rawTrafficSeries.length === 1
        ? [rawTrafficSeries[0], rawTrafficSeries[0]]
        : [
            { date: '--', visitors: 0, pageviews: 0 },
            { date: '--', visitors: 0, pageviews: 0 },
          ];
  const trafficDenom = Math.max(1, trafficSeriesForPlot.length - 1);
  const trafficPts = trafficSeriesForPlot.map((pt, idx) => {
    const x = svgPadL + (idx / trafficDenom) * svgPlotW;
    const yViews =
      svgPadT + (1 - Math.min(1, Math.max(0, pt.pageviews / maxTrafficY))) * svgPlotH;
    const yVis =
      svgPadT + (1 - Math.min(1, Math.max(0, pt.visitors / maxTrafficY))) * svgPlotH;
    return {
      date: pt.date,
      visitors: pt.visitors,
      pageviews: pt.pageviews,
      x,
      yViews,
      yVis,
    };
  });

  const trafficViewsLineD = `M ${trafficPts.map((p) => `${p.x.toFixed(1)} ${p.yViews.toFixed(1)}`).join(' L ')}`;
  const trafficViewsAreaD = `${trafficViewsLineD} L ${trafficPts[trafficPts.length - 1].x.toFixed(1)} ${(svgPadT + svgPlotH).toFixed(1)} L ${trafficPts[0].x.toFixed(1)} ${(svgPadT + svgPlotH).toFixed(1)} Z`;
  const trafficVisLineD = `M ${trafficPts.map((p) => `${p.x.toFixed(1)} ${p.yVis.toFixed(1)}`).join(' L ')}`;
  const dateLabelFracs = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div
      data-sankey-center="true"
      data-node-id={node.id}
      data-node-title={node.title}
      data-node-path={node.path}
      data-node-badge={`100% (${formatVisitorCount(totalViews)})`}
      data-visitors={String(totalViews)}
      class="sankey-node sankey-card relative z-30 overflow-hidden rounded-2xl bg-zinc-600/95 border-2 border-zinc-300 px-3.5 py-3 flex flex-col gap-2 font-mono text-xs shrink-0 shadow-xl transition-opacity"
    >
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2.5 min-w-0">
          <NodeMediaBox node={node} sizeClass="w-9 h-9" />
          <div class="min-w-0 leading-tight">
            <div class="font-bold text-white truncate" title={node.title}>
              {node.title}
            </div>
            <div class="text-xs text-zinc-200 truncate mt-0.5">{node.path}</div>
          </div>
        </div>
        <span
          class="px-2 py-0.5 rounded-md bg-zinc-700 border border-zinc-400 text-white font-bold shrink-0"
          title={`100% (${formatVisitorCount(totalViews)} Views)`}
        >
          100% ({formatVisitorCount(totalViews)})
        </span>
      </div>

      <div class="flex items-center justify-between px-2.5 py-1 rounded-lg bg-zinc-700/80 border border-zinc-400/70 text-zinc-100">
        <span>
          👤 Visitors: <strong class="text-white">{formatVisitorCount(uniqueVisitors)}</strong>
        </span>
        <span>
          ⏱️ <strong class="text-white">{durationStr}</strong>
        </span>
      </div>

      <div class="space-y-2 pt-1.5 border-t border-zinc-400/60">
        {/* 1. INFLOW SPLIT BAR */}
        <div
          class="sankey-ext-block rounded-lg bg-zinc-700/75 border border-zinc-400/60 p-2 space-y-1.5"
          data-ext-header={`🚪 Entry ${entryPct}%`}
          data-ext-metrics={`⬅️ Prev ${prevPct}%`}
        >
          <div class="flex items-center justify-between text-xs">
            <span
              class="text-emerald-300 font-bold"
              title={`Entry: ${entryPct}% (${formatVisitorCount(entryVis)})`}
            >
              🚪 Entry {entryPct}%
            </span>
            <span
              class="text-amber-300 font-bold"
              title={`Prev: ${prevPct}% (${formatVisitorCount(prevVis)})`}
            >
              ⬅️ Prev {prevPct}%
            </span>
          </div>
          <div
            class="sankey-bar-track w-full h-2 rounded-full bg-zinc-800/90 overflow-hidden flex gap-0.5"
            title={`Entry: ${entryPct}% (${formatVisitorCount(entryVis)}) · Prev: ${prevPct}% (${formatVisitorCount(prevVis)})`}
          >
            <div
              class="sankey-bar-fill h-full bg-emerald-400"
              data-bar-rgb="rgb(52, 211, 153)"
              style={{ width: `${entryPct}%` }}
            />
            <div
              class="sankey-bar-fill h-full bg-amber-400"
              data-bar-rgb="rgb(251, 191, 36)"
              style={{ width: `${prevPct}%` }}
            />
          </div>
          {entrySources.length > 0 && (
            <div class="flex flex-wrap gap-1 pt-1 border-t border-zinc-500/70">
              {entrySources.map((s) => {
                const cleanLabel = s.label === 'Direct / None' ? 'Direct' : s.label;
                const srcPct = Math.min(100, Math.round((s.visitors / totalViews) * 100));
                return (
                  <span
                    key={s.id}
                    class="sankey-ext-pill px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-400/50 text-emerald-200"
                    title={`Entry Source: ${cleanLabel} — ${srcPct}% (${formatVisitorCount(s.visitors)} visitors)`}
                  >
                    {cleanLabel}: {srcPct}%
                  </span>
                );
              })}
            </div>
          )}
          <div class="pt-1.5 border-t border-zinc-500/70 space-y-1">
            <div class="text-emerald-300 font-bold">🔍 Google Search Queries:</div>
            {queries.length > 0 ? (
              queries.map((q) => (
                <div
                  key={q.query}
                  class="flex items-center justify-between text-zinc-100 bg-zinc-800/75 px-2 py-0.5 rounded"
                >
                  <span class="truncate pr-2" title={q.query}>
                    "{q.query}"
                  </span>
                  <span class="shrink-0 text-emerald-300">
                    {q.clicks}c · {q.impressions}i ·{' '}
                    <strong class="text-amber-200">#{q.position.toFixed(1)}</strong>
                  </span>
                </div>
              ))
            ) : (
              <div class="text-zinc-300 italic text-[11px]">
                No organic search queries recorded in period
              </div>
            )}
          </div>
        </div>

        {/* 2. OUTFLOW & TERMINATION SPLIT BAR */}
        <div
          class="sankey-ext-block rounded-lg bg-zinc-700/75 border border-zinc-400/60 p-2 space-y-1.5"
          data-ext-header={`➡️ Next ${nextPct}%`}
          data-ext-metrics={`💥 Bounce ${bouncePct}% · ↩️ Exit ${exitPct}%`}
        >
          <div class="flex items-center justify-between gap-1 text-xs">
            <span
              class="text-emerald-300 font-bold"
              title={`Next: ${nextPct}% (${formatVisitorCount(nextVis)})`}
            >
              ➡️ Next {nextPct}%
            </span>
            <span
              class="text-orange-300 font-bold"
              title={`Bounce: ${bouncePct}% (${formatVisitorCount(bounceVis)})`}
            >
              💥 Bounce {bouncePct}%
            </span>
            <span
              class="text-rose-300 font-bold"
              title={`Exit: ${exitPct}% (${formatVisitorCount(exitVis)})`}
            >
              ↩️ Exit {exitPct}%
            </span>
          </div>
          <div
            class="sankey-bar-track w-full h-2 rounded-full bg-zinc-800/90 overflow-hidden flex gap-0.5"
            title={`Next: ${nextPct}% (${formatVisitorCount(nextVis)}) · Bounce: ${bouncePct}% (${formatVisitorCount(bounceVis)}) · Exit: ${exitPct}% (${formatVisitorCount(exitVis)})`}
          >
            <div
              class="sankey-bar-fill h-full bg-emerald-400"
              data-bar-rgb="rgb(52, 211, 153)"
              style={{ width: `${nextPct}%` }}
            />
            <div
              class="sankey-bar-fill h-full bg-orange-400"
              data-bar-rgb="rgb(251, 146, 60)"
              style={{ width: `${bouncePct}%` }}
            />
            <div
              class="sankey-bar-fill h-full bg-rose-500"
              data-bar-rgb="rgb(244, 63, 94)"
              style={{ width: `${exitPct}%` }}
            />
          </div>
        </div>

        {/* 3. DAILY TRAFFIC LINE CHART */}
        <div
          class="sankey-ext-block rounded-lg bg-zinc-700/75 border border-zinc-400/60 p-2 space-y-1.5"
          data-ext-header="📈 Daily Traffic"
          data-ext-metrics={`Peak: ${formatVisitorCount(peakViews)}v / ${formatVisitorCount(peakVisitors)}u · Avg: ${avgViews}v/d`}
        >
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-emerald-300">📈 Daily Traffic</span>
            <span class="text-zinc-100">
              Peak: <strong class="text-emerald-300">{formatVisitorCount(peakViews)}v</strong> /{' '}
              <strong class="text-sky-300">{formatVisitorCount(peakVisitors)}u</strong> · Avg:{' '}
              <strong class="text-white">{avgViews}v/d</strong>
            </span>
          </div>
          <svg
            class="sankey-inline-chart-svg sankey-traffic-line-svg w-full h-14 rounded bg-zinc-800/85 border border-zinc-500/80 overflow-visible"
            viewBox="0 0 320 56"
            preserveAspectRatio="none"
            role="img"
            aria-label="Daily Traffic Line Chart"
          >
            {gridFractions.map((frac) => {
              const gy = (svgPadT + frac * svgPlotH).toFixed(1);
              return (
                <line
                  key={`tg-${frac}`}
                  x1={String(svgPadL)}
                  y1={gy}
                  x2={String(svgPadL + svgPlotW)}
                  y2={gy}
                  stroke="rgba(161, 161, 170, 0.35)"
                  stroke-width="1"
                  stroke-dasharray="2 2"
                />
              );
            })}
            <path
              class="sankey-chart-area"
              d={trafficViewsAreaD}
              fill="rgba(52, 211, 153, 0.22)"
            />
            <path
              class="sankey-chart-line"
              d={trafficVisLineD}
              fill="none"
              stroke="rgb(56, 189, 248)"
              stroke-width="1.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              class="sankey-chart-line"
              d={trafficViewsLineD}
              fill="none"
              stroke="rgb(52, 211, 153)"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            {trafficPts.map((p, idx) => (
              <circle
                key={`td-${idx}`}
                class="sankey-chart-dot"
                cx={p.x.toFixed(1)}
                cy={p.yViews.toFixed(1)}
                r="2"
                fill="rgb(52, 211, 153)"
                stroke="rgb(63, 63, 70)"
                stroke-width="0.8"
              >
                <title>
                  {`${p.date || period}: ${formatVisitorCount(p.pageviews)} Views · ${formatVisitorCount(p.visitors)} Visitors`}
                </title>
              </circle>
            ))}
          </svg>
          <div class="flex items-center justify-between text-[9px] text-zinc-200 px-0.5 leading-none">
            {dateLabelFracs.map((f, idx) => {
              const i = Math.min(
                trafficSeriesForPlot.length - 1,
                Math.round(f * (trafficSeriesForPlot.length - 1))
              );
              return <span key={`dl-${idx}`}>{formatShortDate(trafficSeriesForPlot[i].date)}</span>;
            })}
          </div>
        </div>

        {/* 4. SCROLL DEPTH RETENTION LINE CHART */}
        <div
          class="sankey-ext-block rounded-lg bg-zinc-700/75 border border-zinc-400/60 p-2 space-y-1.5"
          data-ext-header="📜 Scroll Depth"
          data-ext-metrics={`Med: ${medStr} · Read: ${readStr}`}
        >
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-cyan-200">📜 Scroll Depth</span>
            <span class="text-zinc-100">
              ⭐ Med: <strong class="text-amber-300">{medStr}</strong> · Read:{' '}
              <strong class="text-emerald-300">{readStr}</strong>
            </span>
          </div>
          <svg
            class="sankey-inline-chart-svg sankey-scroll-line-svg w-full h-14 rounded bg-zinc-800/85 border border-zinc-500/80 overflow-visible"
            viewBox="0 0 320 56"
            preserveAspectRatio="none"
            role="img"
            aria-label="Scroll Depth Retention Line Chart (0% to 100% in 10% steps)"
          >
            {gridFractions.map((frac) => {
              const gy = (svgPadT + frac * svgPlotH).toFixed(1);
              return (
                <line
                  key={`sg-${frac}`}
                  x1={String(svgPadL)}
                  y1={gy}
                  x2={String(svgPadL + svgPlotW)}
                  y2={gy}
                  stroke="rgba(161, 161, 170, 0.35)"
                  stroke-width="1"
                  stroke-dasharray="2 2"
                />
              );
            })}
            <path
              class="sankey-chart-area sankey-scroll-area-path"
              d={scrollAreaD}
              fill="rgba(34, 211, 238, 0.22)"
            />
            <path
              class="sankey-chart-line sankey-scroll-line-path"
              d={scrollLineD}
              fill="none"
              stroke="rgb(34, 211, 238)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            {scrollPts.map((p) => (
              <circle
                key={`sd-${p.depth}`}
                class="sankey-chart-dot sankey-scroll-dot"
                cx={p.x.toFixed(1)}
                cy={p.y.toFixed(1)}
                r="2.3"
                fill="rgb(52, 211, 153)"
                stroke="rgb(63, 63, 70)"
                stroke-width="1"
              >
                <title>{`Scroll depth ≥ ${p.depth}%: ${p.reachPct}% of readers`}</title>
              </circle>
            ))}
          </svg>
          <div class="flex items-center justify-between text-[9px] text-zinc-200 px-0.5 leading-none">
            <span>0%</span>
            <span>10</span>
            <span>20</span>
            <span>30</span>
            <span>40</span>
            <span>50%</span>
            <span>60</span>
            <span>70</span>
            <span>80</span>
            <span>90</span>
            <span>100%</span>
          </div>
        </div>

        {/* 5. FILE DOWNLOADS BAR */}
        <div
          class="sankey-ext-block rounded-lg bg-zinc-700/75 border border-zinc-400/60 p-2 space-y-1.5"
          data-ext-header="📄 File Downloads"
          data-ext-metrics={`${filePct}%`}
        >
          <div class="flex items-center justify-between font-bold text-sky-200">
            <span>📄 File Downloads</span>
            <span
              class="text-white"
              title={`${filePct}% (${formatVisitorCount(node.fileVis)} visitors)`}
            >
              {filePct}%
            </span>
          </div>
          <div class="sankey-bar-track w-full h-1.5 rounded-full bg-zinc-800/90 overflow-hidden">
            <div
              class="sankey-bar-fill h-full bg-sky-400 rounded-full"
              data-bar-rgb="rgb(56, 189, 248)"
              style={{ width: `${filePct}%` }}
            />
          </div>
          {pdfItems.length > 0 && (
            <div class="text-sky-100 pt-1 border-t border-zinc-500/70 space-y-0.5">
              {pdfItems.map((item) => {
                const hasHref = Boolean(item.href);
                const cls = hasHref ? 'cursor-pointer hover:underline' : '';
                const itemPct = Math.min(100, Math.round((item.visitors / totalViews) * 100));
                return (
                  <div
                    key={item.id}
                    class={`truncate ${cls}`}
                    data-external-href={hasHref ? item.href : undefined}
                    title={`File: ${item.label} — ${itemPct}% (${formatVisitorCount(item.visitors)} visitors)`}
                  >
                    · {item.label} ({itemPct}%)
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 6. OUTBOUND LINKS BAR */}
        <div
          class="sankey-ext-block rounded-lg bg-zinc-700/75 border border-zinc-400/60 p-2 space-y-1.5"
          data-ext-header="↗ Outbound Links"
          data-ext-metrics={`${linkPct}%`}
        >
          <div class="flex items-center justify-between font-bold text-purple-200">
            <span>↗ Outbound Links</span>
            <span
              class="text-white"
              title={`${linkPct}% (${formatVisitorCount(node.linkVis)} visitors)`}
            >
              {linkPct}%
            </span>
          </div>
          <div class="sankey-bar-track w-full h-1.5 rounded-full bg-zinc-800/90 overflow-hidden">
            <div
              class="sankey-bar-fill h-full bg-purple-400 rounded-full"
              data-bar-rgb="rgb(192, 132, 252)"
              style={{ width: `${linkPct}%` }}
            />
          </div>
          {outboundItems.length > 0 && (
            <div class="text-purple-100 pt-1 border-t border-zinc-500/70 space-y-0.5">
              {outboundItems.map((item) => {
                const hasHref = Boolean(item.href);
                const cls = hasHref ? 'cursor-pointer hover:underline' : '';
                const itemPct = Math.min(100, Math.round((item.visitors / totalViews) * 100));
                return (
                  <div
                    key={item.id}
                    class={`truncate ${cls}`}
                    data-external-href={hasHref ? item.href : undefined}
                    title={`Outbound Link: ${item.href || item.label} — ${itemPct}% (${formatVisitorCount(item.visitors)} visitors)`}
                  >
                    ↗ {item.label} ({itemPct}%)
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SideNodeCard({ node, colIndex }: { node: SankeyGraphNode; colIndex: number }) {
  const pctStr = `${Math.round(node.percentage)}% (${formatVisitorCount(node.visitors)})`;
  const isClickable = Boolean(node.isInternalPage && node.href);
  const cursorClass = isClickable ? 'cursor-pointer' : 'cursor-default';
  const totalLocal = Math.max(1, node.visitors);

  const entryLocalPct = Math.min(100, Math.round(((node.entryVis || 0) / totalLocal) * 100));
  const prevLocalPct = Math.max(0, 100 - entryLocalPct);
  const nextLocalPct = Math.min(100, Math.round(((node.nextVis || 0) / totalLocal) * 100));
  const exitLocalPct = Math.max(0, 100 - nextLocalPct);

  return (
    <div
      data-node-id={node.id}
      data-node-title={node.title}
      data-node-path={node.path}
      data-node-badge={pctStr}
      data-col-index={String(colIndex)}
      data-visitors={String(node.visitors)}
      data-internal-href={isClickable ? node.href : ''}
      title={`${node.title} (${node.path}) — ${formatVisitorCount(node.visitors)} Views (${node.percentage}%)`}
      class={`sankey-node sankey-card relative z-30 overflow-hidden rounded-xl bg-zinc-600/95 border border-zinc-400/80 px-3 py-2 flex flex-col gap-1.5 font-mono text-xs shrink-0 shadow-md hover:border-zinc-200 transition-colors ${cursorClass}`}
    >
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <NodeMediaBox node={node} sizeClass="w-7 h-7" />
          <span class="font-bold text-white truncate">{node.title}</span>
        </div>
        <span class="px-1.5 py-0.5 rounded bg-zinc-700 border border-zinc-400/80 text-white font-bold shrink-0">
          {pctStr}
        </span>
      </div>
      {colIndex < 0 ? (
        <div
          class="sankey-bar-track w-full h-1.5 rounded-full bg-zinc-800/90 overflow-hidden flex gap-0.5"
          title={`🚪 Entry ${entryLocalPct}% (${formatVisitorCount(node.entryVis)}) · ⬅️ Prev ${prevLocalPct}% (${formatVisitorCount(node.prevVis)})`}
        >
          <div
            class="sankey-bar-fill h-full bg-emerald-400"
            data-bar-rgb="rgb(52, 211, 153)"
            style={{ width: `${entryLocalPct}%` }}
          />
          <div
            class="sankey-bar-fill h-full bg-amber-400"
            data-bar-rgb="rgb(251, 191, 36)"
            style={{ width: `${prevLocalPct}%` }}
          />
        </div>
      ) : (
        <div
          class="sankey-bar-track w-full h-1.5 rounded-full bg-zinc-800/90 overflow-hidden flex gap-0.5"
          title={`➡️ Next ${nextLocalPct}% (${formatVisitorCount(node.nextVis)}) · ↩️ Exit ${exitLocalPct}% (${formatVisitorCount(node.exitVis)})`}
        >
          <div
            class="sankey-bar-fill h-full bg-emerald-400"
            data-bar-rgb="rgb(52, 211, 153)"
            style={{ width: `${nextLocalPct}%` }}
          />
          <div
            class="sankey-bar-fill h-full bg-rose-500"
            data-bar-rgb="rgb(244, 63, 94)"
            style={{ width: `${exitLocalPct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export interface DevSankeyEmptyStateProps {
  modelMode: SankeyModelMode;
  normCurrent: string;
  period: string;
}

export function renderDevSankeyEmptyState(
  container: HTMLElement,
  { modelMode, normCurrent, period }: DevSankeyEmptyStateProps
): void {
  const emptyHeadline =
    modelMode === 'markov'
      ? 'No Markov Page Traffic Recorded…'
      : 'Waiting for Flow Telemetry…';

  render(null, container);
  render(
    <div
      class="w-full h-full flex items-center justify-center p-8 font-mono text-xs text-zinc-100 select-none"
      style={{
        backgroundColor: `rgb(${COL_BG_OUTER_RGB[0]}, ${COL_BG_OUTER_RGB[1]}, ${COL_BG_OUTER_RGB[2]})`,
      }}
    >
      <div class="p-6 rounded-2xl bg-zinc-700/90 border border-zinc-400/80 text-center max-w-md shadow-xl flex flex-col items-center gap-4">
        <div class="relative flex items-center justify-center w-14 h-14">
          <span class="absolute inset-0 rounded-full bg-emerald-400/25 animate-ping" />
          <span class="absolute inset-2 rounded-full bg-emerald-400/30 animate-pulse" />
          <span class="relative w-8 h-8 rounded-full bg-zinc-800 border border-emerald-400/80 flex items-center justify-center text-sm shadow-md">
            📡
          </span>
        </div>
        <div class="space-y-1.5">
          <div class="text-sm font-bold text-white tracking-wide">{emptyHeadline}</div>
          <div class="text-xs text-zinc-200 leading-relaxed">
            {modelMode === 'markov' ? (
              <>
                No historical pageviews or transitions recorded for{' '}
                <span class="text-white font-bold">{normCurrent}</span> in the selected{' '}
                <span class="text-emerald-300 font-bold">{period}</span> window yet.
              </>
            ) : (
              <>
                No step-traced internal page transitions (
                <code class="px-1 py-0.5 rounded bg-zinc-800 text-emerald-300">prev_page</code>)
                recorded for <span class="text-white font-bold">{normCurrent}</span> in the
                selected <span class="text-emerald-300 font-bold">{period}</span> window yet.
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    container
  );
}

export interface DevSankeyStageViewProps {
  normCurrent: string;
  period: string;
  activeFlow: DevSankeyData;
  context?: DevSankeyPageContext;
  columns: SankeyColumnModel[];
  links: SankeyGraphLink[];
  leftLevels: number;
  rightLevels: number;
}

export function renderDevSankeyStage(
  container: HTMLElement,
  {
    normCurrent,
    period,
    activeFlow,
    context,
    columns,
    links,
    leftLevels,
    rightLevels,
  }: DevSankeyStageViewProps
): void {
  const sideColWidth = 'w-[308px]';

  render(null, container);
  render(
    <>
      <style>
        {`.sankey-no-scrollbar::-webkit-scrollbar, .sankey-col-scroll::-webkit-scrollbar { display: none; }`}
      </style>
      <div
        class="relative w-full h-full overflow-hidden select-none"
        style={{
          backgroundColor: `rgb(${COL_BG_OUTER_RGB[0]}, ${COL_BG_OUTER_RGB[1]}, ${COL_BG_OUTER_RGB[2]})`,
        }}
      >
        {/* LEFT HORIZONTAL SCROLL INDICATOR */}
        <div
          data-horiz-ind="left"
          class="hidden absolute left-0 top-0 bottom-0 w-20 z-40 pointer-events-none flex items-center justify-start pl-3"
        >
          <button
            type="button"
            data-horiz-scroll-dir="-1"
            class="pointer-events-auto px-2.5 py-2 rounded-xl bg-zinc-600/95 hover:bg-zinc-700 border border-zinc-300 text-white font-mono text-xs font-bold shadow-xl flex items-center gap-1.5 cursor-pointer"
          >
            <span>◀</span>
            <span data-horiz-ind-label="left">+1 col</span>
          </button>
        </div>

        {/* RIGHT HORIZONTAL SCROLL INDICATOR */}
        <div
          data-horiz-ind="right"
          class="hidden absolute right-0 top-0 bottom-0 w-20 z-40 pointer-events-none flex items-center justify-end pr-3"
        >
          <button
            type="button"
            data-horiz-scroll-dir="1"
            class="pointer-events-auto px-2.5 py-2 rounded-xl bg-zinc-600/95 hover:bg-zinc-700 border border-zinc-300 text-white font-mono text-xs font-bold shadow-xl flex items-center gap-1.5 cursor-pointer"
          >
            <span data-horiz-ind-label="right">+1 col</span>
            <span>▶</span>
          </button>
        </div>

        {/* Horizontal Scroll Container */}
        <div
          data-sankey-scroll-viewport="true"
          class="sankey-no-scrollbar w-full h-full overflow-x-auto overflow-y-hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          <div class="sankey-stage relative h-full flex items-stretch w-max min-w-full">
            {/* Columns Root */}
            <div class="relative z-10 flex items-stretch h-full">
              {columns.map((col) => {
                const widthClass = col.isCenter ? 'w-[420px]' : sideColWidth;
                const stripe = getColumnStripeBg(col.colIndex, leftLevels, rightLevels);

                return (
                  <div
                    key={`col-${col.colIndex}`}
                    data-sankey-col={String(col.colIndex)}
                    data-col-bg={stripe.bg}
                    style={{ backgroundColor: stripe.bg }}
                    class={`sankey-col relative ${widthClass} h-full px-5 py-3 flex flex-col shrink-0 transition-colors`}
                  >
                    <div class="relative flex-1 min-h-0 flex flex-col overflow-hidden">
                      {/* TOP VERTICAL OVERFLOW INDICATOR */}
                      <div
                        style={{
                          background: `linear-gradient(to bottom, ${stripe.bg} 20%, transparent 100%)`,
                        }}
                        class="vert-ind-top hidden absolute top-0 left-0 right-0 h-11 z-40 pointer-events-none flex items-start justify-center pt-1"
                      >
                        <button
                          type="button"
                          data-col-scroll-dir="-1"
                          class="pointer-events-auto px-2.5 py-0.5 rounded-full bg-zinc-600/95 hover:bg-zinc-700 border border-zinc-300 text-white font-mono text-xs font-bold shadow-lg cursor-pointer"
                        >
                          <span class="vert-ind-top-count">▲ +1 above</span>
                        </button>
                      </div>

                      {/* Scrollbar-Free Vertical Column Lane */}
                      <div
                        class="sankey-col-scroll flex-1 overflow-y-auto flex flex-col gap-2.5 py-1"
                        style={{ scrollbarWidth: 'none' }}
                      >
                        <div class="my-auto flex flex-col gap-2.5 w-full">
                          {col.nodes.length > 0 ? (
                            col.nodes.map((n) =>
                              col.isCenter ? (
                                <CenterInspectorCard
                                  key={n.id}
                                  node={n}
                                  activeFlow={activeFlow}
                                  period={period}
                                  context={context}
                                />
                              ) : (
                                <SideNodeCard key={n.id} node={n} colIndex={col.colIndex} />
                              )
                            )
                          ) : col.colIndex < 0 ? (
                            <div
                              class="sankey-empty-col p-3.5 rounded-xl bg-zinc-600/80 border border-dashed border-zinc-400/80 text-center font-mono text-xs text-zinc-200"
                              data-empty-title={`No recorded upstream steps at level ${col.colIndex}`}
                              data-empty-sub="Session entries are shown inside the page card"
                            >
                              <div class="font-bold text-white mb-1">
                                No recorded upstream steps at level {col.colIndex}
                              </div>
                              <div class="text-[10px] leading-relaxed">
                                Session entries are shown directly inside the page card.
                              </div>
                            </div>
                          ) : (
                            <div
                              class="sankey-empty-col p-3.5 rounded-xl bg-zinc-600/80 border border-dashed border-zinc-400/80 text-center font-mono text-xs text-zinc-200"
                              data-empty-title={`No recorded downstream steps at level +${col.colIndex}`}
                              data-empty-sub="Bounces and exits are shown inside the page card"
                            >
                              <div class="font-bold text-white mb-1">
                                No recorded downstream steps at level +{col.colIndex}
                              </div>
                              <div class="text-[10px] leading-relaxed">
                                Bounces and exits are shown directly inside the page card.
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* BOTTOM VERTICAL OVERFLOW INDICATOR */}
                      <div
                        style={{
                          background: `linear-gradient(to top, ${stripe.bg} 20%, transparent 100%)`,
                        }}
                        class="vert-ind-bot hidden absolute bottom-0 left-0 right-0 h-11 z-40 pointer-events-none flex items-end justify-center pb-1"
                      >
                        <button
                          type="button"
                          data-col-scroll-dir="1"
                          class="pointer-events-auto px-2.5 py-0.5 rounded-full bg-zinc-600/95 hover:bg-zinc-700 border border-zinc-300 text-white font-mono text-xs font-bold shadow-lg cursor-pointer"
                        >
                          <span class="vert-ind-bot-count">▼ +1 more</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* SVG Bézier Ribbons Layer */}
            <svg
              class="sankey-svg-connectors absolute inset-0 w-full h-full pointer-events-none z-20 block select-none"
              role="img"
              aria-label={`Visitor Flow Sankey Diagram for ${normCurrent}`}
            >
              <g class="sankey-ribbons-layer">
                {links.map((link) => (
                  <path
                    key={link.id}
                    class="sankey-ribbon pointer-events-auto transition-opacity duration-200"
                    data-link-id={link.id}
                    data-source-id={link.sourceNodeId}
                    data-target-id={link.targetNodeId}
                    data-visitors={String(link.visitors)}
                    data-default-fill={link.ribbonRgba}
                    data-hover-fill={link.ribbonHoverRgba}
                    d="M 0 0"
                    fill={link.ribbonRgba}
                  >
                    <title>{link.tooltip}</title>
                  </path>
                ))}
              </g>
            </svg>
          </div>
        </div>
      </div>
    </>,
    container
  );
}
