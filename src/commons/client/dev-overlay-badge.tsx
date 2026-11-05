import { render } from 'preact';

export interface HeadingDevBadgeProps {
  hasDwell: boolean;
  visitors: number;
  totalPageVisitors: number;
  retentionRate: number;
  indicatorColor: string;
  dropOffFromPrevious: number | null;
  showDropOff: boolean;
}

export function HeadingDevBadgeContent({
  hasDwell,
  visitors,
  totalPageVisitors,
  retentionRate,
  indicatorColor,
  dropOffFromPrevious,
  showDropOff,
}: HeadingDevBadgeProps) {
  if (!hasDwell || visitors <= 0) {
    return (
      <>
        👁️ <span class="text-zinc-300">0/{totalPageVisitors}</span>{' '}
        <span class="text-zinc-300">(0%)</span>
      </>
    );
  }

  return (
    <>
      👁️ <span class={indicatorColor}>{visitors}</span>
      <span class="text-zinc-300">/{totalPageVisitors}</span>{' '}
      <span class="text-zinc-200">({retentionRate}%)</span>
      {showDropOff && dropOffFromPrevious !== null && (
        <>
          {' '}
          <span class="text-zinc-400">|</span>{' '}
          <span class={dropOffFromPrevious > 30 ? 'text-rose-300 font-bold' : 'text-zinc-300'}>
            {dropOffFromPrevious > 0 ? '🔻-' : '🔼+'}
            {Math.abs(dropOffFromPrevious)}%
          </span>
        </>
      )}
    </>
  );
}

export interface SectionDevBadgeProps {
  id: string;
  hasDwell: boolean;
  visitors: number;
  totalPageVisitors: number;
  retentionRate: number;
  indicatorColor: string;
}

export function SectionDevBadgeContent({
  id,
  hasDwell,
  visitors,
  totalPageVisitors,
  retentionRate,
  indicatorColor,
}: SectionDevBadgeProps) {
  if (!hasDwell || visitors <= 0) {
    return (
      <>
        📍 <span class="text-white font-bold">#{id}</span> <span class="text-zinc-400">|</span> 👁️{' '}
        <span class="text-zinc-300">0/{totalPageVisitors}</span>{' '}
        <span class="text-zinc-300">(0%)</span>
      </>
    );
  }

  return (
    <>
      📍 <span class="text-white font-bold">#{id}</span> <span class="text-zinc-400">|</span> 👁️{' '}
      <span class={indicatorColor}>{visitors}</span>
      <span class="text-zinc-300">/{totalPageVisitors}</span>{' '}
      <span class="text-zinc-200">({retentionRate}%)</span>
    </>
  );
}

export interface CardDevBadgeProps {
  ctr: number;
  clicks: number;
  views: number;
  ctrColor: string;
  targetVisitors: number;
  targetViews: number;
}

export function CardDevBadgeContent({
  ctr,
  clicks,
  views,
  ctrColor,
  targetVisitors,
  targetViews,
}: CardDevBadgeProps) {
  return (
    <>
      🎯 <span class={ctrColor}>{ctr}%</span>{' '}
      <span class="text-zinc-200">
        ({clicks}c/{views}i)
      </span>{' '}
      <span class="text-zinc-400">|</span>{' '}
      <span class="text-sky-200 font-bold">👥 {targetVisitors}</span>{' '}
      <span class="text-zinc-200">({targetViews}v)</span>
    </>
  );
}

export function renderHeadingDevBadge(container: HTMLElement, props: HeadingDevBadgeProps): void {
  render(<HeadingDevBadgeContent {...props} />, container);
}

export function renderSectionDevBadge(container: HTMLElement, props: SectionDevBadgeProps): void {
  render(<SectionDevBadgeContent {...props} />, container);
}

export function renderCardDevBadge(container: HTMLElement, props: CardDevBadgeProps): void {
  render(<CardDevBadgeContent {...props} />, container);
}
