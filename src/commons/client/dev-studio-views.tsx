import { render } from 'preact';

export interface DevGradientStop {
  offset: number;
  r: number;
  g: number;
  b: number;
  opacity: number;
}

export interface DevScrollMilestone {
  depth: number;
  visitors: number;
  percentageOfVisitors: number;
}

export function renderFunnelGradientStops(
  gradientEl: Element,
  stops: DevGradientStop[]
): void {
  render(null, gradientEl);
  gradientEl.replaceChildren();
  render(
    <>
      {stops.map((s, idx) => (
        <stop
          key={idx}
          offset={`${s.offset.toFixed(1)}%`}
          stop-color={`rgb(${s.r},${s.g},${s.b})`}
          stop-opacity={s.opacity.toFixed(2)}
        />
      ))}
    </>,
    gradientEl
  );
}

export function renderMinimapMilestones(
  milestonesEl: HTMLElement,
  milestones: DevScrollMilestone[]
): void {
  const filtered = milestones.filter((m) => m.depth % 25 === 0);
  render(null, milestonesEl);
  milestonesEl.replaceChildren();
  if (filtered.length === 0) return;
  render(
    <>
      {filtered.map((m) => (
        <div
          key={m.depth}
          class="absolute w-full flex items-center justify-between px-1 pointer-events-none"
          style={{ top: `${m.depth}%` }}
          title={`Reach at ${m.depth}% depth: ${Math.round(m.percentageOfVisitors)}%`}
        >
          <div class="h-px bg-zinc-300 w-1.5" />
          <div class="h-px bg-zinc-300 w-1.5" />
        </div>
      ))}
    </>,
    milestonesEl
  );
}

export function renderSankeyLoadingState(sankeyEl: HTMLElement): void {
  render(null, sankeyEl);
  sankeyEl.replaceChildren();
  render(
    <div class="w-full h-full flex items-center justify-center gap-2 text-zinc-100 italic font-mono text-xs animate-pulse">
      <svg
        class="w-4 h-4 animate-spin text-emerald-300 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
      <span>Loading Plausible visitor flow stage...</span>
    </div>,
    sankeyEl
  );
}
