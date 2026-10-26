export interface DevSankeyItem {
  id: string;
  label: string;
  visitors: number;
  percentage: number;
  kind:
    | 'entry_source'
    | 'upstream_page'
    | 'internal_next'
    | 'pdf_download'
    | 'outbound_link'
    | 'bounce_exit';
  href?: string;
  isInternalPage?: boolean;
}

export interface DevSankeyData {
  totalVisitors: number;
  uniqueVisitors?: number;
  directEntries: number;
  directEntryRate: number;
  internalUpstreamVisitors: number;
  internalUpstreamRate: number;
  internalNextVisitors: number;
  internalNextRate: number;
  pdfDownloadVisitors: number;
  pdfDownloadRate: number;
  outboundLinkVisitors: number;
  outboundLinkRate: number;
  bounceOrExitVisitors: number;
  bounceOrExitRate: number;
  bounceVisitors?: number;
  bounceRate?: number;
  exitVisitors?: number;
  exitRate?: number;
  inboundSources: DevSankeyItem[];
  upstreamPages: DevSankeyItem[];
  downstreamPages: DevSankeyItem[];
  pdfDownloads: DevSankeyItem[];
  outboundLinks: DevSankeyItem[];
  chains?: Array<{
    flowId: string;
    visitors: number;
    steps: string[];
  }>;
  stepActions?: Record<string, { fileVisitors: number; linkVisitors: number }>;
  untrackedVisitors?: number;
  untrackedRate?: number;
}

export interface DevSankeyGscQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr?: number;
  position: number;
}

export interface DevSankeyScrollMilestone {
  depth: number;
  visitors: number;
  percentageOfVisitors: number;
  dropOffRateFromPrevious?: number;
}

export interface DevSankeyScrollFunnel {
  milestones?: DevSankeyScrollMilestone[];
  readThroughRate?: number | null;
  medianScrollDepth?: number | null;
}

export interface DevSankeyDailyTrafficPoint {
  date: string;
  visitors: number;
  pageviews: number;
}

export interface DevSankeyPageContext {
  visitors?: number;
  pageviews?: number;
  visitDuration?: number | null;
  bounceRate?: number | null;
  gscQueries?: DevSankeyGscQuery[];
  scrollFunnel?: DevSankeyScrollFunnel | null;
  timeseries?: DevSankeyDailyTrafficPoint[];
  markovFlow?: DevSankeyData | null;
}

export type SankeyModelMode = 'flow' | 'markov';

interface SankeyPageMetadata {
  emoji: string;
  typeLabel: string;
  title: string;
  image?: string;
}

interface ContentManifestItem {
  id?: string;
  url?: string;
  title?: string;
  image?: string;
}

interface ContentManifestPayload {
  posts?: ContentManifestItem[];
  presentations?: ContentManifestItem[];
  courses?: ContentManifestItem[];
  projects?: ContentManifestItem[];
  publications?: ContentManifestItem[];
  visualizations?: ContentManifestItem[];
  services?: ContentManifestItem[];
  newsletters?: ContentManifestItem[];
  tags?: ContentManifestItem[];
}

interface SankeyDomainTheme {
  emoji: string;
  ribbonRgba: string;
  ribbonHoverRgba: string;
}

interface SankeyGraphNode {
  id: string;
  colIndex: number;
  icon: string;
  title: string;
  path: string;
  visitors: number;
  percentage: number;
  kind: DevSankeyItem['kind'];
  href?: string;
  isInternalPage?: boolean;
  isCenter?: boolean;
  pageMeta?: SankeyPageMetadata;
  entryVis: number;
  prevVis: number;
  nextVis: number;
  exitVis: number;
  bounceVis: number;
  fileVis: number;
  linkVis: number;
  ribbonRgba: string;
  ribbonHoverRgba: string;
}

interface SankeyGraphLink {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  visitors: number;
  percentage: number;
  ribbonRgba: string;
  ribbonHoverRgba: string;
  tooltip: string;
}

interface SankeyColumnModel {
  colIndex: number;
  header: string;
  isCenter: boolean;
  nodes: SankeyGraphNode[];
}

const LEFT_LEVELS_STORAGE_KEY = 'gh_dev_sankey_left_levels';
const RIGHT_LEVELS_STORAGE_KEY = 'gh_dev_sankey_right_levels';
const MODEL_MODE_STORAGE_KEY = 'gh_dev_sankey_model_mode';

const STANDARD_RIBBON_RGBA = 'rgba(212, 212, 216, 0.42)';
const STANDARD_RIBBON_HOVER_RGBA = 'rgba(244, 244, 245, 0.80)';

const activeResizeObservers = new WeakMap<HTMLElement, ResizeObserver>();
const renderGenerationMap = new WeakMap<HTMLElement, number>();
const pageMetaCache = new Map<string, SankeyPageMetadata>();
const markovNeighborCache = new Map<string, DevSankeyData | null>();
const inFlightMarkovNeighbors = new Map<string, Promise<DevSankeyData | null>>();
let isManifestPopulated = false;
let inFlightManifestPromise: Promise<void> | null = null;

const STATIC_PAGE_METADATA: Record<string, SankeyPageMetadata> = {
  '/': { emoji: '🏠', typeLabel: 'Homepage', title: 'Homepage (Dr. Georg Hackenberg)' },
  '/posts/': { emoji: '✍️', typeLabel: 'Blog Index', title: 'Technical Blog & Articles' },
  '/presentations/': {
    emoji: '🖥️',
    typeLabel: 'Keynotes Index',
    title: 'Presentations & Keynotes',
  },
  '/courses/': { emoji: '🎓', typeLabel: 'Courses Index', title: 'University Courses (FH OÖ)' },
  '/projects/': { emoji: '🚀', typeLabel: 'Projects Index', title: 'Projects & Case Studies' },
  '/publications/': {
    emoji: '📚',
    typeLabel: 'Publications Index',
    title: 'Academic Publications',
  },
  '/visualizations/': {
    emoji: '🌐',
    typeLabel: 'Visualizations Index',
    title: 'Interactive Visualizations',
  },
  '/services/': { emoji: '💼', typeLabel: 'Services Index', title: 'AI & Engineering Services' },
  '/newsletters/': {
    emoji: '✉️',
    typeLabel: 'Newsletters Index',
    title: 'Technical Newsletters',
  },
  '/tags/': { emoji: '🏷️', typeLabel: 'Tags Index', title: 'Content Topic Tags' },
  '/impressum/': { emoji: '⚖️', typeLabel: 'Legal', title: 'Impressum & Legal Disclosure' },
  '/imprint/': { emoji: '⚖️', typeLabel: 'Legal', title: 'Impressum & Legal Disclosure' },
  '/datenschutz/': { emoji: '🛡️', typeLabel: 'Privacy', title: 'Privacy Policy (DSGVO)' },
  '/privacy/': { emoji: '🛡️', typeLabel: 'Privacy', title: 'Privacy Policy (DSGVO)' },
};

function normalizePath(rawPath: string): string {
  if (!rawPath) return '/';
  const clean = rawPath.split('?')[0].split('#')[0].trim() || '/';
  const withLeading = clean.startsWith('/') ? clean : `/${clean}`;
  if (withLeading === '/') return '/';
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

function resolvePageDomainTheme(rawPath: string): SankeyDomainTheme {
  const norm = normalizePath(rawPath);

  let emoji = '🏠';
  if (norm.startsWith('/posts/')) {
    emoji = '✍️';
  } else if (norm.startsWith('/publications/')) {
    emoji = '📚';
  } else if (norm.startsWith('/presentations/')) {
    emoji = '🖥️';
  } else if (norm.startsWith('/courses/')) {
    emoji = '🎓';
  } else if (norm.startsWith('/projects/')) {
    emoji = '🚀';
  } else if (norm.startsWith('/services/')) {
    emoji = '💼';
  } else if (norm.startsWith('/visualizations/')) {
    emoji = '🌐';
  } else if (norm.startsWith('/newsletters/')) {
    emoji = '✉️';
  } else if (norm.startsWith('/tags/')) {
    emoji = '🏷️';
  } else if (norm === '/datenschutz/' || norm === '/privacy/') {
    emoji = '🛡️';
  } else if (norm === '/impressum/' || norm === '/imprint/') {
    emoji = '⚖️';
  }

  return {
    emoji,
    ribbonRgba: STANDARD_RIBBON_RGBA,
    ribbonHoverRgba: STANDARD_RIBBON_HOVER_RGBA,
  };
}

const COL_BG_CENTER_RGB: readonly [number, number, number] = [113, 113, 122]; // zinc-500 (Uniform stage & column background)
const COL_BG_OUTER_RGB: readonly [number, number, number] = [113, 113, 122]; // zinc-500 (Uniform stage & column background)

function getColumnStripeBg(
  colIndex: number,
  _leftLevels: number,
  _rightLevels: number
): { bg: string; headerColor: string } {
  const [r, g, b] = COL_BG_CENTER_RGB;
  const headerColor = colIndex === 0 ? 'text-white font-extrabold' : 'text-zinc-100 font-bold';
  return { bg: `rgb(${r}, ${g}, ${b})`, headerColor };
}


function humanizeSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();
}

function ingestManifestPayload(manifest: ContentManifestPayload | null | undefined): void {
  if (!manifest || typeof manifest !== 'object') return;

  const registerGroup = (
    items: ContentManifestItem[] | undefined,
    emoji: string,
    typeLabel: string
  ): void => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item?.url || !item?.title) continue;
      const normUrl = normalizePath(item.url);
      pageMetaCache.set(normUrl, {
        emoji,
        typeLabel,
        title: item.title,
        image: typeof item.image === 'string' && item.image.length > 0 ? item.image : undefined,
      });
    }
  };

  registerGroup(manifest.posts, '✍️', 'Blog Post');
  registerGroup(manifest.presentations, '🖥️', 'Presentation');
  registerGroup(manifest.courses, '🎓', 'Course');
  registerGroup(manifest.projects, '🚀', 'Project');
  registerGroup(manifest.publications, '📚', 'Publication');
  registerGroup(manifest.visualizations, '🌐', 'Visualization');
  registerGroup(manifest.services, '💼', 'Service');
  registerGroup(manifest.newsletters, '✉️', 'Newsletter');
  registerGroup(manifest.tags, '🏷️', 'Tag');
  isManifestPopulated = true;
}

async function ensureContentManifestLoaded(): Promise<void> {
  if (isManifestPopulated) return;
  if (inFlightManifestPromise) return inFlightManifestPromise;

  inFlightManifestPromise = (async (): Promise<void> => {
    try {
      const res = await fetch('/content-manifest.json');
      if (!res.ok) return;
      const json = (await res.json()) as ContentManifestPayload;
      ingestManifestPayload(json);
    } catch {
      // ignore fetch errors
    } finally {
      inFlightManifestPromise = null;
    }
  })();

  return inFlightManifestPromise;
}

function resolvePageMetadata(rawPath: string): SankeyPageMetadata {
  const norm = normalizePath(rawPath);

  if (STATIC_PAGE_METADATA[norm]) {
    return STATIC_PAGE_METADATA[norm];
  }

  const exact = pageMetaCache.get(norm);
  if (exact) {
    return exact;
  }

  const segments = norm.split('/').filter(Boolean);
  const domainTheme = resolvePageDomainTheme(norm);
  const emoji = domainTheme.emoji;
  const typeLabel = segments[0] ? humanizeSlug(segments[0]) : 'Page';

  let parentImage: string | undefined;
  let parentTitle: string | undefined;
  if (segments.length >= 2) {
    const parentPath = normalizePath(`/${segments[0]}/${segments[1]}/`);
    const parentMeta = pageMetaCache.get(parentPath);
    if (parentMeta) {
      parentImage = parentMeta.image;
      parentTitle = parentMeta.title;
    }
  }

  const lastSlug = segments[segments.length - 1] || norm;
  const humanized = humanizeSlug(lastSlug);
  const title =
    parentTitle && segments.length > 2 ? `${humanized} · ${parentTitle}` : humanized || norm;

  return {
    emoji,
    typeLabel,
    title,
    image: parentImage,
  };
}

function clampLevel(val: number): number {
  if (!Number.isFinite(val)) return 2;
  return Math.max(1, Math.min(5, Math.round(val)));
}

function getStoredLevel(key: string, fallback: number = 2): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return clampLevel(Number(raw));
  } catch {
    return fallback;
  }
}

function setStoredLevel(key: string, level: number): void {
  try {
    localStorage.setItem(key, String(clampLevel(level)));
  } catch {
    // ignore storage errors
  }
}

function getStoredModelMode(): SankeyModelMode {
  try {
    const raw = localStorage.getItem(MODEL_MODE_STORAGE_KEY);
    if (raw === 'flow' || raw === 'markov') return raw;
    return 'flow';
  } catch {
    return 'flow';
  }
}

function setStoredModelMode(mode: SankeyModelMode): void {
  try {
    localStorage.setItem(MODEL_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
}

function fetchNeighbor(
  targetPath: string,
  period: string,
  mode: SankeyModelMode,
  onResolved: () => void
): void {
  const norm = normalizePath(targetPath);
  const key = `${mode}:${period}:${norm}`;
  if (markovNeighborCache.has(key) || inFlightMarkovNeighbors.has(key)) return;

  const p = (async (): Promise<DevSankeyData | null> => {
    try {
      const res = await fetch(
        `/api/dev-analytics.json?path=${encodeURIComponent(norm)}&period=${encodeURIComponent(period)}&scope=${encodeURIComponent(mode)}`
      );
      if (!res.ok) {
        markovNeighborCache.set(key, null);
        return null;
      }
      const data = (await res.json()) as {
        visitorFlow?: DevSankeyData | null;
        markovFlow?: DevSankeyData | null;
      };
      const nf = mode === 'markov' ? (data?.markovFlow ?? null) : (data?.visitorFlow ?? null);
      markovNeighborCache.set(key, nf);
      return nf;
    } catch {
      markovNeighborCache.set(key, null);
      return null;
    } finally {
      inFlightMarkovNeighbors.delete(key);
    }
  })();

  inFlightMarkovNeighbors.set(key, p);
  void p.then((nf) => {
    if (nf) {
      onResolved();
    }
  });
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatVisitorCount(v: number): string {
  if (v <= 0) return '0';
  if (v >= 10 || Number.isInteger(v)) return String(Math.round(v));
  const rounded1 = Math.round(v * 10) / 10;
  return rounded1 >= 1 ? String(rounded1) : '<1';
}

function formatDurationSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function buildRibbonPath(
  x0: number,
  y0Center: number,
  t0: number,
  x1: number,
  y1Center: number,
  t1: number
): string {
  const h0 = t0 / 2;
  const h1 = t1 / 2;
  const y0Top = (y0Center - h0).toFixed(1);
  const y0Bot = (y0Center + h0).toFixed(1);
  const y1Top = (y1Center - h1).toFixed(1);
  const y1Bot = (y1Center + h1).toFixed(1);
  const cx = ((x0 + x1) / 2).toFixed(1);
  const x0Str = x0.toFixed(1);
  const x1Str = x1.toFixed(1);
  return `M ${x0Str} ${y0Top} C ${cx} ${y0Top}, ${cx} ${y1Top}, ${x1Str} ${y1Top} L ${x1Str} ${y1Bot} C ${cx} ${y1Bot}, ${cx} ${y0Bot}, ${x0Str} ${y0Bot} Z`;
}

function buildMultiLevelSankeyGraph(
  currentPath: string,
  rootFlow: DevSankeyData,
  leftLevels: number,
  rightLevels: number,
  _modelMode: SankeyModelMode = 'flow',
  neighborLookup?: (path: string) => DevSankeyData | null | undefined,
  onMissingNeighbor?: (path: string) => void
): { columns: SankeyColumnModel[]; links: SankeyGraphLink[] } {
  const normCurrent = normalizePath(currentPath);
  const totalVisitors = Math.max(1, rootFlow.totalVisitors);

  const columnsMap = new Map<number, Map<string, SankeyGraphNode>>();
  for (let c = -leftLevels; c <= rightLevels; c++) {
    columnsMap.set(c, new Map<string, SankeyGraphNode>());
  }

  const linksMap = new Map<string, SankeyGraphLink>();
  const toPct = (vis: number): number => Math.round((vis / totalVisitors) * 100);

  const upsertNode = (
    colIndex: number,
    key: string,
    spec: {
      icon: string;
      title: string;
      path: string;
      visitors: number;
      kind: DevSankeyItem['kind'];
      href?: string;
      isInternalPage?: boolean;
      isCenter?: boolean;
    }
  ): SankeyGraphNode => {
    const colNodes = columnsMap.get(colIndex)!;
    const nodeId = `col${colIndex}:${key}`;
    const existing = colNodes.get(nodeId);
    if (existing) {
      existing.visitors = Math.round((existing.visitors + spec.visitors) * 100) / 100;
      existing.percentage = toPct(existing.visitors);
      return existing;
    }

    const normHref = spec.href ? normalizePath(spec.href) : normCurrent;
    const domainTheme = resolvePageDomainTheme(normHref);
    const pageMeta =
      spec.isInternalPage && spec.href ? resolvePageMetadata(spec.href) : undefined;

    const created: SankeyGraphNode = {
      id: nodeId,
      colIndex,
      icon: pageMeta ? pageMeta.emoji : domainTheme.emoji || spec.icon,
      title: pageMeta ? pageMeta.title : spec.title,
      path: normHref,
      visitors: Math.round(spec.visitors * 100) / 100,
      percentage: spec.isCenter ? 100 : toPct(spec.visitors),
      kind: spec.kind,
      href: normHref,
      isInternalPage: spec.isInternalPage,
      isCenter: spec.isCenter,
      pageMeta,
      entryVis: 0,
      prevVis: 0,
      nextVis: 0,
      exitVis: 0,
      bounceVis: 0,
      fileVis: 0,
      linkVis: 0,
      ribbonRgba: domainTheme.ribbonRgba,
      ribbonHoverRgba: domainTheme.ribbonHoverRgba,
    };
    colNodes.set(nodeId, created);
    return created;
  };

  const upsertLink = (
    sourceNode: SankeyGraphNode,
    targetNode: SankeyGraphNode,
    visitors: number
  ): void => {
    const safeVisitors = Math.max(0.1, Math.round(visitors * 100) / 100);
    const linkId = `${sourceNode.id}->${targetNode.id}`;
    const existing = linksMap.get(linkId);
    const themeNode = targetNode.colIndex > 0 ? targetNode : sourceNode;
    const ribbonRgba = themeNode.ribbonRgba;
    const ribbonHoverRgba = themeNode.ribbonHoverRgba;
    if (existing) {
      existing.visitors = Math.round((existing.visitors + safeVisitors) * 100) / 100;
      existing.percentage = toPct(existing.visitors);
      existing.tooltip = `${sourceNode.title} → ${targetNode.title}: ${formatVisitorCount(existing.visitors)} Views (${existing.percentage}%)`;
      return;
    }
    const pct = toPct(safeVisitors);
    linksMap.set(linkId, {
      id: linkId,
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
      visitors: safeVisitors,
      percentage: pct,
      ribbonRgba,
      ribbonHoverRgba,
      tooltip: `${sourceNode.title} → ${targetNode.title}: ${formatVisitorCount(safeVisitors)} Views (${pct}%)`,
    });
  };

  // 0. Center Node (Col 0)
  const centerNode = upsertNode(0, 'center', {
    icon: '📍',
    title: normCurrent,
    path: normCurrent,
    visitors: rootFlow.totalVisitors,
    kind: 'entry_source',
    href: normCurrent,
    isInternalPage: true,
    isCenter: true,
  });

  centerNode.entryVis = rootFlow.directEntries;
  centerNode.prevVis = rootFlow.internalUpstreamVisitors;
  centerNode.nextVis = rootFlow.internalNextVisitors;
  centerNode.bounceVis = rootFlow.bounceVisitors ?? 0;
  centerNode.exitVis = rootFlow.exitVisitors ?? 0;
  centerNode.fileVis = rootFlow.pdfDownloadVisitors;
  centerNode.linkVis = rootFlow.outboundLinkVisitors;

  // 1. Multi-Hop Neighbor Folding (Upstream L1..L5 & Downstream L1..L5 for both Flow prev_page and Markov modes)
  for (const u of rootFlow.upstreamPages) {
    if (u.visitors <= 0) continue;
    const uPath = normalizePath(u.href || u.label);
    if (uPath === normCurrent) continue;
    const upNode = upsertNode(-1, `page:${uPath}`, {
      icon: '⬅️',
      title: uPath,
      path: uPath,
      visitors: u.visitors,
      kind: 'upstream_page',
      href: uPath,
      isInternalPage: true,
    });
    upsertLink(upNode, centerNode, u.visitors);
  }

  for (let c = -1; c >= -leftLevels; c--) {
    const colNodes = columnsMap.get(c)!;
    for (const upNode of colNodes.values()) {
      const w = upNode.visitors;
      const p = upNode.path;
      const nb = neighborLookup?.(p);

      if (nb === undefined) {
        onMissingNeighbor?.(p);
        upNode.entryVis = w;
        upNode.prevVis = 0;
        continue;
      }

      if (nb && nb.totalVisitors > 0) {
        const nbTotal = Math.max(1, nb.totalVisitors);
        upNode.fileVis =
          Math.round(w * Math.min(1, Math.max(0, nb.pdfDownloadVisitors / nbTotal)) * 100) / 100;
        upNode.linkVis =
          Math.round(w * Math.min(1, Math.max(0, nb.outboundLinkVisitors / nbTotal)) * 100) / 100;

        const validUpstream = nb.upstreamPages.filter(
          (item) => item.visitors > 0 && normalizePath(item.href || item.label) !== p
        );
        const sumNbUp = validUpstream.reduce((s, item) => s + item.visitors, 0);

        if (sumNbUp <= 0) {
          upNode.entryVis = w;
          upNode.prevVis = 0;
        } else {
          const entryRatio = Math.min(1, Math.max(0, nb.directEntries / nbTotal));
          upNode.entryVis = Math.round(w * entryRatio * 100) / 100;
          upNode.prevVis = Math.max(0, Math.round((w - upNode.entryVis) * 100) / 100);

          if (c > -leftLevels && upNode.prevVis > 0) {
            for (const prevItem of validUpstream) {
              const pPath = normalizePath(prevItem.href || prevItem.label);
              const edgeWeight =
                Math.round(upNode.prevVis * (prevItem.visitors / sumNbUp) * 100) / 100;
              if (edgeWeight >= 0.2) {
                const prevNode = upsertNode(c - 1, `page:${pPath}`, {
                  icon: '⬅️',
                  title: pPath,
                  path: pPath,
                  visitors: edgeWeight,
                  kind: 'upstream_page',
                  href: pPath,
                  isInternalPage: true,
                });
                upsertLink(prevNode, upNode, edgeWeight);
              }
            }
          }
        }
      } else {
        upNode.entryVis = w;
        upNode.prevVis = 0;
      }
    }
  }

  for (const d of rootFlow.downstreamPages) {
    if (d.visitors <= 0) continue;
    const dPath = normalizePath(d.href || d.label);
    if (dPath === normCurrent) continue;
    const downNode = upsertNode(1, `page:${dPath}`, {
      icon: '➡️',
      title: dPath,
      path: dPath,
      visitors: d.visitors,
      kind: 'internal_next',
      href: dPath,
      isInternalPage: true,
    });
    upsertLink(centerNode, downNode, d.visitors);
  }

  for (let c = 1; c <= rightLevels; c++) {
    const colNodes = columnsMap.get(c)!;
    for (const downNode of colNodes.values()) {
      const w = downNode.visitors;
      const p = downNode.path;
      const nb = neighborLookup?.(p);

      if (nb === undefined) {
        onMissingNeighbor?.(p);
        downNode.exitVis = w;
        downNode.nextVis = 0;
        continue;
      }

      if (nb && nb.totalVisitors > 0) {
        const nbTotal = Math.max(1, nb.totalVisitors);
        downNode.fileVis =
          Math.round(w * Math.min(1, Math.max(0, nb.pdfDownloadVisitors / nbTotal)) * 100) / 100;
        downNode.linkVis =
          Math.round(w * Math.min(1, Math.max(0, nb.outboundLinkVisitors / nbTotal)) * 100) / 100;

        const validDownstream = nb.downstreamPages.filter(
          (item) => item.visitors > 0 && normalizePath(item.href || item.label) !== p
        );
        const sumNbDown = validDownstream.reduce((s, item) => s + item.visitors, 0);

        if (sumNbDown <= 0) {
          downNode.exitVis = w;
          downNode.nextVis = 0;
        } else {
          const nextRatio = Math.min(1, Math.max(0, nb.internalNextVisitors / nbTotal));
          downNode.nextVis = Math.round(w * nextRatio * 100) / 100;
          downNode.exitVis = Math.max(0, Math.round((w - downNode.nextVis) * 100) / 100);

          if (c < rightLevels && downNode.nextVis > 0) {
            for (const nextItem of validDownstream) {
              const nPath = normalizePath(nextItem.href || nextItem.label);
              const edgeWeight =
                Math.round(downNode.nextVis * (nextItem.visitors / sumNbDown) * 100) / 100;
              if (edgeWeight >= 0.2) {
                const nextNode = upsertNode(c + 1, `page:${nPath}`, {
                  icon: '➡️',
                  title: nPath,
                  path: nPath,
                  visitors: edgeWeight,
                  kind: 'internal_next',
                  href: nPath,
                  isInternalPage: true,
                });
                upsertLink(downNode, nextNode, edgeWeight);
              }
            }
          }
        }
      } else {
        downNode.exitVis = w;
        downNode.nextVis = 0;
      }
    }
  }

  // Format columns
  const columns: SankeyColumnModel[] = [];
  for (let c = -leftLevels; c <= rightLevels; c++) {
    const rawNodes = Array.from(columnsMap.get(c)!.values());
    rawNodes.sort((a, b) => b.visitors - a.visitors);

    let header = '📍 Current Page';
    if (c < 0) {
      header = `⬅️ Inflow L${Math.abs(c)} (-${Math.abs(c)} ${Math.abs(c) === 1 ? 'Step' : 'Steps'})`;
    } else if (c > 0) {
      header = `➡️ Outflow L${c} (+${c} ${c === 1 ? 'Step' : 'Steps'})`;
    }

    columns.push({
      colIndex: c,
      header,
      isCenter: c === 0,
      nodes: rawNodes,
    });
  }

  return {
    columns,
    links: Array.from(linksMap.values()),
  };
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function truncateCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (maxWidth <= 0) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}…`;
}

/**
 * Renders the Fullscreen Structured Grid Visitor Flow Sankey stage with:
 * - Full-bleed borderless column background stripes stepping darker outward from Center
 * - Scrollbar-free vertical column scrolling with dynamic ▲ +N above / ▼ +N more overflow indicators
 * - Scrollbar-free horizontal stage scrolling with dynamic ◀ +N cols / +N cols ▶ overflow indicators
 * - Center Page Inspector Card with Inflow Split Bar, GSC Search Queries, 3-way Outflow & Termination Split Bar (Next vs. Bounce vs. Exit), File Downloads Bar, Outbound Links Bar, and Without Flow Context Bar
 * - Side Page Cards supporting Compact (1-line) and Detailed (Local 100% Flow & Action Bars) density modes
 */
export function renderVisitorFlowSankey(
  container: HTMLElement,
  currentPath: string,
  flow: DevSankeyData | undefined | null,
  onNavigateInternal?: (targetPath: string) => void,
  period: string = '28d',
  context?: DevSankeyPageContext
): void {
  const prevObserver = activeResizeObservers.get(container);
  if (prevObserver) {
    prevObserver.disconnect();
    activeResizeObservers.delete(container);
  }

  const generation = (renderGenerationMap.get(container) ?? 0) + 1;
  renderGenerationMap.set(container, generation);

  const normCurrent = normalizePath(currentPath);
  const controlScope =
    container.closest<HTMLElement>('#dev-studio-root') ??
    container.closest<HTMLElement>('#dev-analytics-container') ??
    container.closest<HTMLElement>('#dev-analytics-fullview') ??
    container;

  let levels = getStoredLevel(LEFT_LEVELS_STORAGE_KEY, 2);
  let leftLevels = levels;
  let rightLevels = levels;
  let modelMode: SankeyModelMode = getStoredModelMode();

  if (flow) {
    markovNeighborCache.set(`flow:${period}:${normCurrent}`, flow);
  }
  if (context?.markovFlow) {
    markovNeighborCache.set(`markov:${period}:${normCurrent}`, context.markovFlow);
  }

  const syncTopBarButtons = (): void => {
    controlScope
      .querySelectorAll<HTMLButtonElement>('[data-sankey-model]')
      .forEach((btn) => {
        const mode = btn.getAttribute('data-sankey-model');
        const isActive = mode === modelMode;
        btn.className = isActive
          ? 'h-full px-2 flex items-center justify-center rounded-md text-[11px] font-mono leading-none transition-colors bg-zinc-200 text-zinc-900 font-bold shadow-xs border border-zinc-300 cursor-pointer'
          : 'h-full px-2 flex items-center justify-center rounded-md text-[11px] font-mono leading-none transition-colors text-zinc-200 hover:text-white cursor-pointer';
      });
    controlScope
      .querySelectorAll<HTMLElement>('[data-sankey-level-label]')
      .forEach((lbl) => {
        lbl.textContent = `±${levels}`;
      });
    controlScope
      .querySelectorAll<HTMLButtonElement>('[data-sankey-level-delta]')
      .forEach((btn) => {
        const delta = Number(btn.getAttribute('data-sankey-level-delta') || 0);
        btn.disabled = (delta < 0 && levels <= 1) || (delta > 0 && levels >= 5);
      });
  };
  syncTopBarButtons();

  const isSameActivePath =
    container.getAttribute('data-sankey-active-path') === normCurrent &&
    container.getAttribute('data-sankey-centered') === 'true';
  let shouldCenterStage = !isSameActivePath;
  let userCenterOffsetFromVpMid = isSameActivePath
    ? parseFloat(container.getAttribute('data-sankey-user-offset') || '0') || 0
    : 0;
  if (!isSameActivePath) {
    container.setAttribute('data-sankey-active-path', normCurrent);
    container.setAttribute('data-sankey-centered', 'false');
    container.setAttribute('data-sankey-user-offset', '0');
  }
  let lastObservedViewportWidth = 0;
  let isProgrammaticScroll = false;
  let isUserHorizScrollActive = false;
  let userScrollEndTimer: number | null = null;

  const clearUserHorizScrollActive = (): void => {
    isUserHorizScrollActive = false;
    if (userScrollEndTimer !== null) {
      window.clearTimeout(userScrollEndTimer);
      userScrollEndTimer = null;
    }
  };

  const markUserHorizScrollActive = (durationMs: number = 250): void => {
    isUserHorizScrollActive = true;
    if (userScrollEndTimer !== null) {
      window.clearTimeout(userScrollEndTimer);
    }
    userScrollEndTimer = window.setTimeout(() => {
      isUserHorizScrollActive = false;
      userScrollEndTimer = null;
    }, durationMs);
  };

  const ensureMultiHopDataAndRender = async (): Promise<void> => {
    if (renderGenerationMap.get(container) !== generation) return;
    await ensureContentManifestLoaded();
    if (renderGenerationMap.get(container) !== generation) return;
    renderStageDom();
  };

  const renderStageDom = (): void => {
    const prevObs = activeResizeObservers.get(container);
    if (prevObs) {
      prevObs.disconnect();
      activeResizeObservers.delete(container);
    }

    syncTopBarButtons();
    const activeFlow = modelMode === 'markov' ? (context?.markovFlow ?? flow) : flow;

    if (!activeFlow || activeFlow.totalVisitors <= 0) {
      const onEmptyControlClick = (e: Event): void => {
        if (renderGenerationMap.get(container) !== generation) return;
        const target = e.target as HTMLElement | null;
        const modelBtn = target?.closest<HTMLButtonElement>('[data-sankey-model]');
        if (modelBtn) {
          e.preventDefault();
          const nextModel = modelBtn.getAttribute('data-sankey-model') as SankeyModelMode | null;
          if ((nextModel === 'flow' || nextModel === 'markov') && nextModel !== modelMode) {
            modelMode = nextModel;
            setStoredModelMode(modelMode);
            renderStageDom();
          }
          return;
        }
        const levelDeltaBtn = target?.closest<HTMLButtonElement>('[data-sankey-level-delta]');
        if (levelDeltaBtn) {
          e.preventDefault();
          const delta = Number(levelDeltaBtn.getAttribute('data-sankey-level-delta') || 0);
          const next = clampLevel(levels + delta);
          if (next !== levels) {
            levels = next;
            leftLevels = levels;
            rightLevels = levels;
            setStoredLevel(LEFT_LEVELS_STORAGE_KEY, levels);
            setStoredLevel(RIGHT_LEVELS_STORAGE_KEY, levels);
            syncTopBarButtons();
          }
        }
      };
      const prevHandler = (
        controlScope as HTMLElement & { __sankeyControlHandler?: (ev: Event) => void }
      ).__sankeyControlHandler;
      if (prevHandler) {
        controlScope.removeEventListener('click', prevHandler);
      }
      (
        controlScope as HTMLElement & { __sankeyControlHandler?: (ev: Event) => void }
      ).__sankeyControlHandler = onEmptyControlClick;
      controlScope.addEventListener('click', onEmptyControlClick);

      const emptyHeadline =
        modelMode === 'markov'
          ? 'No Markov Page Traffic Recorded…'
          : 'Waiting for Flow Telemetry…';
      const emptySubtext =
        modelMode === 'markov'
          ? `No historical pageviews or transitions recorded for <span class="text-white font-bold">${escapeHtml(normCurrent)}</span> in the selected <span class="text-emerald-300 font-bold">${escapeHtml(period)}</span> window yet.`
          : `No step-traced internal page transitions (<code class="px-1 py-0.5 rounded bg-zinc-800 text-emerald-300">prev_page</code>) recorded for <span class="text-white font-bold">${escapeHtml(normCurrent)}</span> in the selected <span class="text-emerald-300 font-bold">${escapeHtml(period)}</span> window yet.`;

      container.innerHTML = `
        <div
          class="w-full h-full flex items-center justify-center p-8 font-mono text-xs text-zinc-100 select-none"
          style="background-color: rgb(${COL_BG_OUTER_RGB[0]}, ${COL_BG_OUTER_RGB[1]}, ${COL_BG_OUTER_RGB[2]});"
        >
          <div class="p-6 rounded-2xl bg-zinc-700/90 border border-zinc-400/80 text-center max-w-md shadow-xl flex flex-col items-center gap-4">
            <div class="relative flex items-center justify-center w-14 h-14">
              <span class="absolute inset-0 rounded-full bg-emerald-400/25 animate-ping"></span>
              <span class="absolute inset-2 rounded-full bg-emerald-400/30 animate-pulse"></span>
              <span class="relative w-8 h-8 rounded-full bg-zinc-800 border border-emerald-400/80 flex items-center justify-center text-sm shadow-md">📡</span>
            </div>
            <div class="space-y-1.5">
              <div class="text-sm font-bold text-white tracking-wide">${emptyHeadline}</div>
              <div class="text-xs text-zinc-200 leading-relaxed">
                ${emptySubtext}
              </div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const prevScrollTopByCol = new Map<string, number>();
    container.querySelectorAll<HTMLElement>('[data-sankey-col]').forEach((colEl) => {
      const colKey = colEl.getAttribute('data-sankey-col');
      const scroller = colEl.querySelector<HTMLElement>('.sankey-col-scroll');
      if (colKey && scroller && scroller.scrollTop > 0) {
        prevScrollTopByCol.set(colKey, scroller.scrollTop);
      }
    });

    const { columns, links } = buildMultiLevelSankeyGraph(
      normCurrent,
      activeFlow,
      leftLevels,
      rightLevels,
      modelMode,
      (p) => markovNeighborCache.get(`${modelMode}:${period}:${normalizePath(p)}`),
      (p) => {
        fetchNeighbor(p, period, modelMode, () => {
          if (renderGenerationMap.get(container) === generation) {
            renderStageDom();
          }
        });
      }
    );

    const renderMediaBox = (
      node: SankeyGraphNode,
      sizeClass: string
    ): string => {
      const thumbUrl = node.pageMeta?.image;
      if (thumbUrl) {
        return `<img class="sankey-node-thumb ${sizeClass} object-cover rounded-lg border border-zinc-400/80 shrink-0" src="${escapeHtml(thumbUrl)}" alt="" loading="eager" />`;
      }
      return `<span class="sankey-node-emoji-box ${sizeClass} rounded-lg bg-zinc-700/90 border border-zinc-400/80 flex items-center justify-center shrink-0" data-emoji="${escapeHtml(node.icon)}">${escapeHtml(node.icon)}</span>`;
    };

    const renderCenterInspectorCard = (node: SankeyGraphNode): string => {
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
      const entrySourcesHtml =
        entrySources.length > 0
          ? `<div class="flex flex-wrap gap-1 pt-1 border-t border-zinc-500/70">
              ${entrySources
                .map((s) => {
                  const cleanLabel = s.label === 'Direct / None' ? 'Direct' : s.label;
                  const srcPct = Math.min(100, Math.round((s.visitors / totalViews) * 100));
                  return `<span class="sankey-ext-pill px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-400/50 text-emerald-200" title="Entry Source: ${escapeHtml(cleanLabel)} — ${srcPct}% (${formatVisitorCount(s.visitors)} visitors)">${escapeHtml(cleanLabel)}: ${srcPct}%</span>`;
                })
                .join('')}
            </div>`
          : '';

      const queries = (context?.gscQueries ?? []).slice(0, 4);
      const queriesRowsHtml =
        queries.length > 0
          ? queries
              .map(
                (q) => `
                <div class="flex items-center justify-between text-zinc-100 bg-zinc-800/75 px-2 py-0.5 rounded">
                  <span class="truncate pr-2" title="${escapeHtml(q.query)}">"${escapeHtml(q.query)}"</span>
                  <span class="shrink-0 text-emerald-300">${q.clicks}c · ${q.impressions}i · <strong class="text-amber-200">#${q.position.toFixed(1)}</strong></span>
                </div>
              `
              )
              .join('')
          : `<div class="text-zinc-300 italic text-[11px]">No organic search queries recorded in period</div>`;

      const fileItemsHtml =
        activeFlow.pdfDownloads.length > 0
          ? `<div class="text-sky-100 pt-1 border-t border-zinc-500/70 space-y-0.5">
              ${activeFlow.pdfDownloads
                .slice(0, 3)
                .map((item) => {
                  const hasHref = Boolean(item.href);
                  const cls = hasHref ? 'cursor-pointer hover:underline' : '';
                  const itemPct = Math.min(100, Math.round((item.visitors / totalViews) * 100));
                  return `<div class="truncate ${cls}" ${hasHref ? `data-external-href="${escapeHtml(item.href!)}"` : ''} title="File: ${escapeHtml(item.label)} — ${itemPct}% (${formatVisitorCount(item.visitors)} visitors)">· ${escapeHtml(item.label)} (${itemPct}%)</div>`;
                })
                .join('')}
            </div>`
          : '';

      const outboundItemsHtml =
        activeFlow.outboundLinks.length > 0
          ? `<div class="text-purple-100 pt-1 border-t border-zinc-500/70 space-y-0.5">
              ${activeFlow.outboundLinks
                .slice(0, 3)
                .map((item) => {
                  const hasHref = Boolean(item.href);
                  const cls = hasHref ? 'cursor-pointer hover:underline' : '';
                  const itemPct = Math.min(100, Math.round((item.visitors / totalViews) * 100));
                  return `<div class="truncate ${cls}" ${hasHref ? `data-external-href="${escapeHtml(item.href!)}"` : ''} title="Outbound Link: ${escapeHtml(item.href || item.label)} — ${itemPct}% (${formatVisitorCount(item.visitors)} visitors)">↗ ${escapeHtml(item.label)} (${itemPct}%)</div>`;
                })
                .join('')}
            </div>`
          : '';

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
      const scrollGridLinesHtml = [0.25, 0.5, 0.75]
        .map((frac) => {
          const gy = (svgPadT + frac * svgPlotH).toFixed(1);
          return `<line x1="${svgPadL}" y1="${gy}" x2="${svgPadL + svgPlotW}" y2="${gy}" stroke="rgba(161, 161, 170, 0.35)" stroke-width="1" stroke-dasharray="2 2" />`;
        })
        .join('');
      const scrollDotsHtml = scrollPts
        .map(
          (p) =>
            `<circle class="sankey-chart-dot sankey-scroll-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.3" fill="rgb(52, 211, 153)" stroke="rgb(63, 63, 70)" stroke-width="1"><title>Scroll depth ≥ ${p.depth}%: ${p.reachPct}% of readers</title></circle>`
        )
        .join('');

      // Daily Traffic Timeseries Line Chart (Views & Visitors over Period)
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
      const trafficDotsHtml = trafficPts
        .map(
          (p) =>
            `<circle class="sankey-chart-dot" cx="${p.x.toFixed(1)}" cy="${p.yViews.toFixed(1)}" r="2" fill="rgb(52, 211, 153)" stroke="rgb(63, 63, 70)" stroke-width="0.8"><title>${escapeHtml(p.date || period)}: ${formatVisitorCount(p.pageviews)} Views · ${formatVisitorCount(p.visitors)} Visitors</title></circle>`
        )
        .join('');

      const formatShortDate = (iso: string): string => {
        const m = iso.match(/^\d{4}-(\d{2}-\d{2})/);
        return m ? m[1] : iso || '--';
      };
      const trafficDateLabelsHtml = [0, 0.25, 0.5, 0.75, 1]
        .map((f) => {
          const i = Math.min(
            trafficSeriesForPlot.length - 1,
            Math.round(f * (trafficSeriesForPlot.length - 1))
          );
          return `<span>${escapeHtml(formatShortDate(trafficSeriesForPlot[i].date))}</span>`;
        })
        .join('');

      return `
        <div
          data-sankey-center="true"
          data-node-id="${escapeHtml(node.id)}"
          data-node-title="${escapeHtml(node.title)}"
          data-node-path="${escapeHtml(node.path)}"
          data-node-badge="100% (${formatVisitorCount(totalViews)})"
          data-visitors="${totalViews}"
          class="sankey-node sankey-card relative z-30 overflow-hidden rounded-2xl bg-zinc-600/95 border-2 border-zinc-300 px-3.5 py-3 flex flex-col gap-2 font-mono text-xs shrink-0 shadow-xl transition-opacity"
        >
          <!-- Above Divider: Thumbnail/Emoji + Title & Path + 100% Views Badge -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              ${renderMediaBox(node, 'w-9 h-9')}
              <div class="min-w-0 leading-tight">
                <div class="font-bold text-white truncate" title="${escapeHtml(node.title)}">${escapeHtml(node.title)}</div>
                <div class="text-xs text-zinc-200 truncate mt-0.5">${escapeHtml(node.path)}</div>
              </div>
            </div>
            <span class="px-2 py-0.5 rounded-md bg-zinc-700 border border-zinc-400 text-white font-bold shrink-0" title="100% (${formatVisitorCount(totalViews)} Views)">100% (${formatVisitorCount(totalViews)})</span>
          </div>

          <div class="flex items-center justify-between px-2.5 py-1 rounded-lg bg-zinc-700/80 border border-zinc-400/70 text-zinc-100">
            <span>👤 Visitors: <strong class="text-white">${formatVisitorCount(uniqueVisitors)}</strong></span>
            <span>⏱️ <strong class="text-white">${durationStr}</strong></span>
          </div>

          <div class="space-y-2 pt-1.5 border-t border-zinc-400/60">
            <!-- 1. INFLOW SPLIT BAR (Entry vs. Prev) + Entry Sources & Google Search Queries -->
            <div class="sankey-ext-block rounded-lg bg-zinc-700/75 border border-zinc-400/60 p-2 space-y-1.5" data-ext-header="🚪 Entry ${entryPct}%" data-ext-metrics="⬅️ Prev ${prevPct}%">
              <div class="flex items-center justify-between text-xs">
                <span class="text-emerald-300 font-bold" title="Entry: ${entryPct}% (${formatVisitorCount(entryVis)})">🚪 Entry ${entryPct}%</span>
                <span class="text-amber-300 font-bold" title="Prev: ${prevPct}% (${formatVisitorCount(prevVis)})">⬅️ Prev ${prevPct}%</span>
              </div>
              <div class="sankey-bar-track w-full h-2 rounded-full bg-zinc-800/90 overflow-hidden flex gap-0.5" title="Entry: ${entryPct}% (${formatVisitorCount(entryVis)}) · Prev: ${prevPct}% (${formatVisitorCount(prevVis)})">
                <div class="sankey-bar-fill h-full bg-emerald-400" data-bar-rgb="rgb(52, 211, 153)" style="width: ${entryPct}%"></div>
                <div class="sankey-bar-fill h-full bg-amber-400" data-bar-rgb="rgb(251, 191, 36)" style="width: ${prevPct}%"></div>
              </div>
              ${entrySourcesHtml}
              <div class="pt-1.5 border-t border-zinc-500/70 space-y-1">
                <div class="text-emerald-300 font-bold">🔍 Google Search Queries:</div>
                ${queriesRowsHtml}
              </div>
            </div>

            <!-- 2. OUTFLOW & TERMINATION SPLIT BAR (Next vs. Bounce vs. Exit) -->
            <div class="sankey-ext-block rounded-lg bg-zinc-700/75 border border-zinc-400/60 p-2 space-y-1.5" data-ext-header="➡️ Next ${nextPct}%" data-ext-metrics="💥 Bounce ${bouncePct}% · ↩️ Exit ${exitPct}%">
              <div class="flex items-center justify-between gap-1 text-xs">
                <span class="text-emerald-300 font-bold" title="Next: ${nextPct}% (${formatVisitorCount(nextVis)})">➡️ Next ${nextPct}%</span>
                <span class="text-orange-300 font-bold" title="Bounce: ${bouncePct}% (${formatVisitorCount(bounceVis)})">💥 Bounce ${bouncePct}%</span>
                <span class="text-rose-300 font-bold" title="Exit: ${exitPct}% (${formatVisitorCount(exitVis)})">↩️ Exit ${exitPct}%</span>
              </div>
              <div class="sankey-bar-track w-full h-2 rounded-full bg-zinc-800/90 overflow-hidden flex gap-0.5" title="Next: ${nextPct}% (${formatVisitorCount(nextVis)}) · Bounce: ${bouncePct}% (${formatVisitorCount(bounceVis)}) · Exit: ${exitPct}% (${formatVisitorCount(exitVis)})">
                <div class="sankey-bar-fill h-full bg-emerald-400" data-bar-rgb="rgb(52, 211, 153)" style="width: ${nextPct}%"></div>
                <div class="sankey-bar-fill h-full bg-orange-400" data-bar-rgb="rgb(251, 146, 60)" style="width: ${bouncePct}%"></div>
                <div class="sankey-bar-fill h-full bg-rose-500" data-bar-rgb="rgb(244, 63, 94)" style="width: ${exitPct}%"></div>
              </div>
            </div>

            <!-- 3. DAILY TRAFFIC LINE CHART (Views & Visitors over Period) -->
            <div class="sankey-ext-block rounded-lg bg-zinc-700/75 border border-zinc-400/60 p-2 space-y-1.5" data-ext-header="📈 Daily Traffic" data-ext-metrics="Peak: ${formatVisitorCount(peakViews)}v / ${formatVisitorCount(peakVisitors)}u · Avg: ${avgViews}v/d">
              <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-emerald-300">📈 Daily Traffic</span>
                <span class="text-zinc-100">Peak: <strong class="text-emerald-300">${formatVisitorCount(peakViews)}v</strong> / <strong class="text-sky-300">${formatVisitorCount(peakVisitors)}u</strong> · Avg: <strong class="text-white">${avgViews}v/d</strong></span>
              </div>
              <svg
                class="sankey-inline-chart-svg sankey-traffic-line-svg w-full h-14 rounded bg-zinc-800/85 border border-zinc-500/80 overflow-visible"
                viewBox="0 0 320 56"
                preserveAspectRatio="none"
                role="img"
                aria-label="Daily Traffic Line Chart"
              >
                ${scrollGridLinesHtml}
                <path class="sankey-chart-area" d="${trafficViewsAreaD}" fill="rgba(52, 211, 153, 0.22)" />
                <path class="sankey-chart-line" d="${trafficVisLineD}" fill="none" stroke="rgb(56, 189, 248)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
                <path class="sankey-chart-line" d="${trafficViewsLineD}" fill="none" stroke="rgb(52, 211, 153)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                ${trafficDotsHtml}
              </svg>
              <div class="flex items-center justify-between text-[9px] text-zinc-200 px-0.5 leading-none">
                ${trafficDateLabelsHtml}
              </div>
            </div>

            <!-- 4. SCROLL DEPTH RETENTION LINE CHART (0%..100% in 10% steps) -->
            <div class="sankey-ext-block rounded-lg bg-zinc-700/75 border border-zinc-400/60 p-2 space-y-1.5" data-ext-header="📜 Scroll Depth" data-ext-metrics="Med: ${medStr} · Read: ${readStr}">
              <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-cyan-200">📜 Scroll Depth</span>
                <span class="text-zinc-100">⭐ Med: <strong class="text-amber-300">${medStr}</strong> · Read: <strong class="text-emerald-300">${readStr}</strong></span>
              </div>
              <svg
                class="sankey-inline-chart-svg sankey-scroll-line-svg w-full h-14 rounded bg-zinc-800/85 border border-zinc-500/80 overflow-visible"
                viewBox="0 0 320 56"
                preserveAspectRatio="none"
                role="img"
                aria-label="Scroll Depth Retention Line Chart (0% to 100% in 10% steps)"
              >
                ${scrollGridLinesHtml}
                <path class="sankey-chart-area sankey-scroll-area-path" d="${scrollAreaD}" fill="rgba(34, 211, 238, 0.22)" />
                <path class="sankey-chart-line sankey-scroll-line-path" d="${scrollLineD}" fill="none" stroke="rgb(34, 211, 238)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                ${scrollDotsHtml}
              </svg>
              <div class="flex items-center justify-between text-[9px] text-zinc-200 px-0.5 leading-none">
                <span>0%</span><span>10</span><span>20</span><span>30</span><span>40</span><span>50%</span><span>60</span><span>70</span><span>80</span><span>90</span><span>100%</span>
              </div>
            </div>

            <!-- 5. FILE DOWNLOADS BAR + DETAIL ITEMS -->
            <div class="sankey-ext-block rounded-lg bg-zinc-700/75 border border-zinc-400/60 p-2 space-y-1.5" data-ext-header="📄 File Downloads" data-ext-metrics="${filePct}%">
              <div class="flex items-center justify-between font-bold text-sky-200">
                <span>📄 File Downloads</span>
                <span class="text-white" title="${filePct}% (${formatVisitorCount(node.fileVis)} visitors)">${filePct}%</span>
              </div>
              <div class="sankey-bar-track w-full h-1.5 rounded-full bg-zinc-800/90 overflow-hidden">
                <div class="sankey-bar-fill h-full bg-sky-400 rounded-full" data-bar-rgb="rgb(56, 189, 248)" style="width: ${filePct}%"></div>
              </div>
              ${fileItemsHtml}
            </div>

            <!-- 6. OUTBOUND LINKS BAR + DETAIL ITEMS -->
            <div class="sankey-ext-block rounded-lg bg-zinc-700/75 border border-zinc-400/60 p-2 space-y-1.5" data-ext-header="↗ Outbound Links" data-ext-metrics="${linkPct}%">
              <div class="flex items-center justify-between font-bold text-purple-200">
                <span>↗ Outbound Links</span>
                <span class="text-white" title="${linkPct}% (${formatVisitorCount(node.linkVis)} visitors)">${linkPct}%</span>
              </div>
              <div class="sankey-bar-track w-full h-1.5 rounded-full bg-zinc-800/90 overflow-hidden">
                <div class="sankey-bar-fill h-full bg-purple-400 rounded-full" data-bar-rgb="rgb(192, 132, 252)" style="width: ${linkPct}%"></div>
              </div>
              ${outboundItemsHtml}
            </div>
          </div>
        </div>
      `;
    };

    const renderSideNodeCard = (node: SankeyGraphNode, colIndex: number): string => {
      const pctStr = `${Math.round(node.percentage)}% (${formatVisitorCount(node.visitors)})`;
      const isClickable = Boolean(node.isInternalPage && node.href);
      const cursorClass = isClickable ? 'cursor-pointer' : 'cursor-default';
      const totalLocal = Math.max(1, node.visitors);

      let flowSplitBarHtml = '';
      if (colIndex < 0) {
        const entryLocalPct = Math.min(100, Math.round(((node.entryVis || 0) / totalLocal) * 100));
        const prevLocalPct = Math.max(0, 100 - entryLocalPct);
        flowSplitBarHtml = `
          <div
            class="sankey-bar-track w-full h-1.5 rounded-full bg-zinc-800/90 overflow-hidden flex gap-0.5"
            title="🚪 Entry ${entryLocalPct}% (${formatVisitorCount(node.entryVis)}) · ⬅️ Prev ${prevLocalPct}% (${formatVisitorCount(node.prevVis)})"
          >
            <div class="sankey-bar-fill h-full bg-emerald-400" data-bar-rgb="rgb(52, 211, 153)" style="width: ${entryLocalPct}%"></div>
            <div class="sankey-bar-fill h-full bg-amber-400" data-bar-rgb="rgb(251, 191, 36)" style="width: ${prevLocalPct}%"></div>
          </div>
        `;
      } else {
        const nextLocalPct = Math.min(100, Math.round(((node.nextVis || 0) / totalLocal) * 100));
        const exitLocalPct = Math.max(0, 100 - nextLocalPct);
        flowSplitBarHtml = `
          <div
            class="sankey-bar-track w-full h-1.5 rounded-full bg-zinc-800/90 overflow-hidden flex gap-0.5"
            title="➡️ Next ${nextLocalPct}% (${formatVisitorCount(node.nextVis)}) · ↩️ Exit ${exitLocalPct}% (${formatVisitorCount(node.exitVis)})"
          >
            <div class="sankey-bar-fill h-full bg-emerald-400" data-bar-rgb="rgb(52, 211, 153)" style="width: ${nextLocalPct}%"></div>
            <div class="sankey-bar-fill h-full bg-rose-500" data-bar-rgb="rgb(244, 63, 94)" style="width: ${exitLocalPct}%"></div>
          </div>
        `;
      }

      return `
        <div
          data-node-id="${escapeHtml(node.id)}"
          data-node-title="${escapeHtml(node.title)}"
          data-node-path="${escapeHtml(node.path)}"
          data-node-badge="${pctStr}"
          data-col-index="${colIndex}"
          data-visitors="${node.visitors}"
          data-internal-href="${isClickable ? escapeHtml(node.href!) : ''}"
          title="${escapeHtml(node.title)} (${escapeHtml(node.path)}) — ${formatVisitorCount(node.visitors)} Views (${node.percentage}%)"
          class="sankey-node sankey-card relative z-30 overflow-hidden rounded-xl bg-zinc-600/95 border border-zinc-400/80 px-3 py-2 flex flex-col gap-1.5 font-mono text-xs shrink-0 shadow-md hover:border-zinc-200 transition-colors ${cursorClass}"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              ${renderMediaBox(node, 'w-7 h-7')}
              <span class="font-bold text-white truncate">${escapeHtml(node.title)}</span>
            </div>
            <span class="px-1.5 py-0.5 rounded bg-zinc-700 border border-zinc-400/80 text-white font-bold shrink-0">${pctStr}</span>
          </div>
          ${flowSplitBarHtml}
        </div>
      `;
    };

    const sideColWidth = 'w-[308px]';

    const columnsHtml = columns
      .map((col) => {
        const widthClass = col.isCenter ? 'w-[420px]' : sideColWidth;
        const stripe = getColumnStripeBg(col.colIndex, leftLevels, rightLevels);

        const cardsHtml =
          col.nodes.length > 0
            ? col.nodes
                .map((n) =>
                  col.isCenter
                    ? renderCenterInspectorCard(n)
                    : renderSideNodeCard(n, col.colIndex)
                )
                .join('')
            : col.colIndex < 0
              ? `
                <div
                  class="sankey-empty-col p-3.5 rounded-xl bg-zinc-600/80 border border-dashed border-zinc-400/80 text-center font-mono text-xs text-zinc-200"
                  data-empty-title="No recorded upstream steps at level ${col.colIndex}"
                  data-empty-sub="Session entries are shown inside the page card"
                >
                  <div class="font-bold text-white mb-1">No recorded upstream steps at level ${col.colIndex}</div>
                  <div class="text-[10px] leading-relaxed">Session entries are shown directly inside the page card.</div>
                </div>
              `
              : `
                <div
                  class="sankey-empty-col p-3.5 rounded-xl bg-zinc-600/80 border border-dashed border-zinc-400/80 text-center font-mono text-xs text-zinc-200"
                  data-empty-title="No recorded downstream steps at level +${col.colIndex}"
                  data-empty-sub="Bounces and exits are shown inside the page card"
                >
                  <div class="font-bold text-white mb-1">No recorded downstream steps at level +${col.colIndex}</div>
                  <div class="text-[10px] leading-relaxed">Bounces and exits are shown directly inside the page card.</div>
                </div>
              `;

        return `
          <div
            data-sankey-col="${col.colIndex}"
            data-col-bg="${stripe.bg}"
            style="background-color: ${stripe.bg};"
            class="sankey-col relative ${widthClass} h-full px-5 py-3 flex flex-col shrink-0 transition-colors"
          >
            <!-- Column Scroll Wrapper with Top & Bottom Overflow Indicators -->
            <div class="relative flex-1 min-h-0 flex flex-col overflow-hidden">
              <!-- TOP VERTICAL OVERFLOW INDICATOR -->
              <div
                style="background: linear-gradient(to bottom, ${stripe.bg} 20%, transparent 100%);"
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

              <!-- Scrollbar-Free Vertical Column Lane -->
              <div
                class="sankey-col-scroll flex-1 overflow-y-auto flex flex-col gap-2.5 py-1"
                style="scrollbar-width: none; -ms-overflow-style: none;"
              >
                <div class="my-auto flex flex-col gap-2.5 w-full">
                  ${cardsHtml}
                </div>
              </div>

              <!-- BOTTOM VERTICAL OVERFLOW INDICATOR -->
              <div
                style="background: linear-gradient(to top, ${stripe.bg} 20%, transparent 100%);"
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
        `;
      })
      .join('');

    const ribbonsSvgHtml = links
      .map(
        (link) => `
        <path
          class="sankey-ribbon pointer-events-auto transition-opacity duration-200"
          data-link-id="${escapeHtml(link.id)}"
          data-source-id="${escapeHtml(link.sourceNodeId)}"
          data-target-id="${escapeHtml(link.targetNodeId)}"
          data-visitors="${link.visitors}"
          data-default-fill="${link.ribbonRgba}"
          data-hover-fill="${link.ribbonHoverRgba}"
          d="M 0 0"
          fill="${link.ribbonRgba}"
        >
          <title>${escapeHtml(link.tooltip)}</title>
        </path>
      `
      )
      .join('');

    container.innerHTML = `
      <style>
        .sankey-no-scrollbar::-webkit-scrollbar,
        .sankey-col-scroll::-webkit-scrollbar {
          display: none;
        }
      </style>
      <div
        class="relative w-full h-full overflow-hidden select-none"
        style="background-color: rgb(${COL_BG_OUTER_RGB[0]}, ${COL_BG_OUTER_RGB[1]}, ${COL_BG_OUTER_RGB[2]});"
      >
        <!-- LEFT HORIZONTAL SCROLL INDICATOR -->
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

        <!-- RIGHT HORIZONTAL SCROLL INDICATOR -->
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

        <!-- Horizontal Scroll Container (Full-bleed borderless column stripes) -->
        <div
          data-sankey-scroll-viewport="true"
          class="sankey-no-scrollbar w-full h-full overflow-x-auto overflow-y-hidden"
          style="scrollbar-width: none; -ms-overflow-style: none;"
        >
          <div
            class="sankey-stage relative h-full flex items-stretch w-max min-w-full"
          >
            <!-- Columns Root -->
            <div class="relative z-10 flex items-stretch h-full">
              ${columnsHtml}
            </div>

            <!-- SVG Bézier Ribbons Layer -->
            <svg
              class="sankey-svg-connectors absolute inset-0 w-full h-full pointer-events-none z-20 block select-none"
              role="img"
              aria-label="Visitor Flow Sankey Diagram for ${escapeHtml(normCurrent)}"
            >
              <g class="sankey-ribbons-layer">
                ${ribbonsSvgHtml}
              </g>
            </svg>
          </div>
        </div>
      </div>
    `;

    const scrollViewportEl = container.querySelector<HTMLElement>(
      '[data-sankey-scroll-viewport]'
    );
    const stageEl = container.querySelector<HTMLElement>('.sankey-stage');
    const svgEl = container.querySelector<SVGSVGElement>('.sankey-svg-connectors');
    const ribbonEls = Array.from(container.querySelectorAll<SVGPathElement>('.sankey-ribbon'));
    const nodeEls = Array.from(container.querySelectorAll<HTMLElement>('.sankey-node'));
    const colEls = Array.from(container.querySelectorAll<HTMLElement>('.sankey-col'));

    const applyStageHorizontalPadding = (vpW: number): number => {
      if (!stageEl || vpW <= 0) return 0;
      const centerW = 420;
      const sideW = 308;
      const leftColsW = leftLevels * sideW;
      const basePad = Math.max(0, Math.round(vpW / 2 - leftColsW - centerW / 2));
      const extraOffsetPad = Math.ceil(Math.abs(userCenterOffsetFromVpMid));
      const symPad =
        basePad > 0
          ? basePad + extraOffsetPad
          : Math.max(
              0,
              Math.round(vpW / 2 + Math.abs(userCenterOffsetFromVpMid) - leftColsW - centerW / 2)
            );
      stageEl.style.paddingLeft = `${symPad}px`;
      stageEl.style.paddingRight = `${symPad}px`;
      return symPad;
    };

    const syncUserCenterOffsetFromVpMid = (): void => {
      if (!scrollViewportEl || scrollViewportEl.clientWidth <= 0) return;
      const centerColEl = container.querySelector<HTMLElement>('[data-sankey-col="0"]');
      if (!centerColEl) return;
      const cRect = centerColEl.getBoundingClientRect();
      const vpRect = scrollViewportEl.getBoundingClientRect();
      userCenterOffsetFromVpMid =
        cRect.left + cRect.width / 2 - (vpRect.left + vpRect.width / 2);
      container.setAttribute(
        'data-sankey-user-offset',
        String(Math.round(userCenterOffsetFromVpMid))
      );
    };

    const updateColumnVerticalIndicators = (colWrapper: HTMLElement): void => {
      const scroller = colWrapper.querySelector<HTMLElement>('.sankey-col-scroll');
      const topInd = colWrapper.querySelector<HTMLElement>('.vert-ind-top');
      const botInd = colWrapper.querySelector<HTMLElement>('.vert-ind-bot');
      const topCountEl = colWrapper.querySelector<HTMLElement>('.vert-ind-top-count');
      const botCountEl = colWrapper.querySelector<HTMLElement>('.vert-ind-bot-count');
      if (!scroller || !topInd || !botInd) return;

      const cards = Array.from(scroller.querySelectorAll<HTMLElement>('.sankey-card'));
      const scrollerRect = scroller.getBoundingClientRect();

      let hiddenAbove = 0;
      let hiddenBelow = 0;
      cards.forEach((c) => {
        const r = c.getBoundingClientRect();
        if (r.top < scrollerRect.top - 8) hiddenAbove++;
        if (r.bottom > scrollerRect.bottom + 8) hiddenBelow++;
      });

      if (scroller.scrollTop > 6 && hiddenAbove > 0) {
        topInd.classList.remove('hidden');
        if (topCountEl) topCountEl.textContent = `▲ +${hiddenAbove} above`;
      } else {
        topInd.classList.add('hidden');
      }

      if (
        scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 6 &&
        hiddenBelow > 0
      ) {
        botInd.classList.remove('hidden');
        if (botCountEl) botCountEl.textContent = `▼ +${hiddenBelow} more`;
      } else {
        botInd.classList.add('hidden');
      }
    };

    const updateHorizontalIndicators = (): void => {
      const leftInd = container.querySelector<HTMLElement>('[data-horiz-ind="left"]');
      const rightInd = container.querySelector<HTMLElement>('[data-horiz-ind="right"]');
      const leftLbl = container.querySelector<HTMLElement>('[data-horiz-ind-label="left"]');
      const rightLbl = container.querySelector<HTMLElement>('[data-horiz-ind-label="right"]');
      if (!scrollViewportEl || !leftInd || !rightInd) return;

      const vpRect = scrollViewportEl.getBoundingClientRect();
      let hiddenLeft = 0;
      let hiddenRight = 0;
      let leftEdgeBg = `rgb(${COL_BG_OUTER_RGB[0]}, ${COL_BG_OUTER_RGB[1]}, ${COL_BG_OUTER_RGB[2]})`;
      let rightEdgeBg = leftEdgeBg;

      colEls.forEach((col) => {
        const r = col.getBoundingClientRect();
        const bg = col.getAttribute('data-col-bg') || leftEdgeBg;
        if (r.left < vpRect.left - 20) hiddenLeft++;
        if (r.right > vpRect.right + 20) hiddenRight++;
        if (r.left <= vpRect.left + 8 && r.right >= vpRect.left) {
          leftEdgeBg = bg;
        }
        if (r.left <= vpRect.right && r.right >= vpRect.right - 8) {
          rightEdgeBg = bg;
        }
      });

      leftInd.style.background = `linear-gradient(to right, ${leftEdgeBg} 20%, transparent 100%)`;
      rightInd.style.background = `linear-gradient(to left, ${rightEdgeBg} 20%, transparent 100%)`;

      if (scrollViewportEl.scrollLeft > 10 && hiddenLeft > 0) {
        leftInd.classList.remove('hidden');
        if (leftLbl) {
          leftLbl.textContent = `+${hiddenLeft} ${hiddenLeft === 1 ? 'col' : 'cols'}`;
        }
      } else {
        leftInd.classList.add('hidden');
      }

      if (
        scrollViewportEl.scrollLeft + scrollViewportEl.clientWidth <
          scrollViewportEl.scrollWidth - 10 &&
        hiddenRight > 0
      ) {
        rightInd.classList.remove('hidden');
        if (rightLbl) {
          rightLbl.textContent = `+${hiddenRight} ${hiddenRight === 1 ? 'col' : 'cols'}`;
        }
      } else {
        rightInd.classList.add('hidden');
      }
    };

    const layoutRibbons = (): void => {
      if (!stageEl || !svgEl) return;
      const stageW = stageEl.offsetWidth;
      const stageH = stageEl.offsetHeight;
      const stageRect = stageEl.getBoundingClientRect();
      if (stageW <= 0 || stageH <= 0 || stageRect.width <= 0) return;

      svgEl.setAttribute('viewBox', `0 0 ${Math.round(stageW)} ${Math.round(stageH)}`);

      interface LocalNodeBox {
        left: number;
        right: number;
        top: number;
        bottom: number;
        width: number;
        height: number;
      }

      const nodeRectMap = new Map<string, LocalNodeBox>();
      for (const el of nodeEls) {
        const id = el.getAttribute('data-node-id');
        if (id) {
          const r = el.getBoundingClientRect();
          const left = r.left - stageRect.left;
          const top = r.top - stageRect.top;
          const width = r.width;
          const height = r.height;
          nodeRectMap.set(id, {
            left,
            right: left + width,
            top,
            bottom: top + height,
            width,
            height,
          });
        }
      }

      const totalRootVisitors = Math.max(1, activeFlow.totalVisitors);
      const RIBBON_GAP = 2.5;

      const outgoingSlotMap = new Map<string, { yCenter: number; thickness: number }>();
      const incomingSlotMap = new Map<string, { yCenter: number; thickness: number }>();

      for (const [nodeId, nodeRect] of nodeRectMap.entries()) {
        const nodeMidY = nodeRect.top + nodeRect.height / 2;

        const outLinks = links
          .filter((l) => l.sourceNodeId === nodeId && nodeRectMap.has(l.targetNodeId))
          .sort((a, b) => {
            const rA = nodeRectMap.get(a.targetNodeId)!;
            const rB = nodeRectMap.get(b.targetNodeId)!;
            return rA.top + rA.height / 2 - (rB.top + rB.height / 2);
          });

        if (outLinks.length > 0) {
          const maxNodeThickness = Math.max(6, nodeRect.height - 8);
          const measuredOut = outLinks.map((l) => {
            const ratio = Math.max(0.03, Math.min(1, l.visitors / totalRootVisitors));
            const rawT = Math.min(maxNodeThickness, Math.max(5, Math.round(ratio * 52)));
            return { linkId: l.id, thickness: rawT };
          });

          const totalGap = Math.max(0, measuredOut.length - 1) * RIBBON_GAP;
          const rawSum = measuredOut.reduce((s, m) => s + m.thickness, 0);
          const availH = Math.max(16, nodeRect.height - 12 - totalGap);

          if (rawSum > availH && rawSum > 0) {
            const scale = availH / rawSum;
            for (const m of measuredOut) {
              m.thickness = Math.max(3.5, m.thickness * scale);
            }
          }

          const stackH = measuredOut.reduce((s, m) => s + m.thickness, 0) + totalGap;
          let curTopY = nodeMidY - stackH / 2;
          for (const m of measuredOut) {
            outgoingSlotMap.set(m.linkId, {
              yCenter: curTopY + m.thickness / 2,
              thickness: m.thickness,
            });
            curTopY += m.thickness + RIBBON_GAP;
          }
        }

        const inLinks = links
          .filter((l) => l.targetNodeId === nodeId && nodeRectMap.has(l.sourceNodeId))
          .sort((a, b) => {
            const rA = nodeRectMap.get(a.sourceNodeId)!;
            const rB = nodeRectMap.get(b.sourceNodeId)!;
            return rA.top + rA.height / 2 - (rB.top + rB.height / 2);
          });

        if (inLinks.length > 0) {
          const maxNodeThickness = Math.max(6, nodeRect.height - 8);
          const measuredIn = inLinks.map((l) => {
            const ratio = Math.max(0.03, Math.min(1, l.visitors / totalRootVisitors));
            const rawT = Math.min(maxNodeThickness, Math.max(5, Math.round(ratio * 52)));
            return { linkId: l.id, thickness: rawT };
          });

          const totalGap = Math.max(0, measuredIn.length - 1) * RIBBON_GAP;
          const rawSum = measuredIn.reduce((s, m) => s + m.thickness, 0);
          const availH = Math.max(16, nodeRect.height - 12 - totalGap);

          if (rawSum > availH && rawSum > 0) {
            const scale = availH / rawSum;
            for (const m of measuredIn) {
              m.thickness = Math.max(3.5, m.thickness * scale);
            }
          }

          const stackH = measuredIn.reduce((s, m) => s + m.thickness, 0) + totalGap;
          let curTopY = nodeMidY - stackH / 2;
          for (const m of measuredIn) {
            incomingSlotMap.set(m.linkId, {
              yCenter: curTopY + m.thickness / 2,
              thickness: m.thickness,
            });
            curTopY += m.thickness + RIBBON_GAP;
          }
        }
      }

      for (const pathEl of ribbonEls) {
        const linkId = pathEl.getAttribute('data-link-id') || '';
        const sourceId = pathEl.getAttribute('data-source-id') || '';
        const targetId = pathEl.getAttribute('data-target-id') || '';
        const sourceRect = nodeRectMap.get(sourceId);
        const targetRect = nodeRectMap.get(targetId);
        const outSlot = outgoingSlotMap.get(linkId);
        const inSlot = incomingSlotMap.get(linkId);

        if (sourceRect && targetRect && outSlot && inSlot) {
          pathEl.setAttribute(
            'd',
            buildRibbonPath(
              sourceRect.right,
              outSlot.yCenter,
              outSlot.thickness,
              targetRect.left,
              inSlot.yCenter,
              inSlot.thickness
            )
          );
        }
      }
    };

    // Wire column vertical scroll and overflow buttons
    colEls.forEach((colWrapper) => {
      const colKey = colWrapper.getAttribute('data-sankey-col');
      const scroller = colWrapper.querySelector<HTMLElement>('.sankey-col-scroll');
      if (colKey && scroller && prevScrollTopByCol.has(colKey)) {
        scroller.scrollTop = prevScrollTopByCol.get(colKey)!;
      }

      scroller?.addEventListener(
        'scroll',
        () => {
          updateColumnVerticalIndicators(colWrapper);
          requestAnimationFrame(layoutRibbons);
        },
        { passive: true }
      );

      colWrapper
        .querySelectorAll<HTMLButtonElement>('[data-col-scroll-dir]')
        .forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const dir = Number(btn.getAttribute('data-col-scroll-dir') || 1);
            scroller?.scrollBy({ top: dir * 180, behavior: 'smooth' });
          });
        });

      updateColumnVerticalIndicators(colWrapper);
    });

    // Wire horizontal scroll and overflow buttons
    scrollViewportEl?.addEventListener(
      'wheel',
      () => {
        markUserHorizScrollActive(250);
      },
      { passive: true }
    );
    scrollViewportEl?.addEventListener(
      'touchmove',
      () => {
        markUserHorizScrollActive(250);
      },
      { passive: true }
    );
    scrollViewportEl?.addEventListener(
      'pointerdown',
      () => {
        markUserHorizScrollActive(250);
      },
      { passive: true }
    );

    scrollViewportEl?.addEventListener(
      'scroll',
      () => {
        if (
          isUserHorizScrollActive &&
          !isProgrammaticScroll &&
          scrollViewportEl.clientWidth === lastObservedViewportWidth
        ) {
          syncUserCenterOffsetFromVpMid();
        }
        updateHorizontalIndicators();
        requestAnimationFrame(layoutRibbons);
      },
      { passive: true }
    );

    container
      .querySelectorAll<HTMLButtonElement>('[data-horiz-scroll-dir]')
      .forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          markUserHorizScrollActive(450);
          const dir = Number(btn.getAttribute('data-horiz-scroll-dir') || 1);
          scrollViewportEl?.scrollBy({ left: dir * 350, behavior: 'smooth' });
        });
      });

    // Deterministic 2x WYSIWYG Canvas PNG Exporter (Taint-Free, Full DOM Text & Box Fidelity)
    const copySankeyPngToClipboard = async (): Promise<void> => {
      if (!stageEl) return;
      layoutRibbons();

      const stageH = stageEl.offsetHeight;
      const stageRect = stageEl.getBoundingClientRect();
      if (stageH <= 0 || stageRect.width <= 0) return;

      const colRects = colEls.map((c) => c.getBoundingClientRect()).filter((r) => r.width > 0);
      const minColLeft =
        colRects.length > 0 ? Math.min(...colRects.map((r) => r.left)) : stageRect.left;
      const maxColRight =
        colRects.length > 0 ? Math.max(...colRects.map((r) => r.right)) : stageRect.right;

      const contentW = Math.max(320, maxColRight - minColLeft);
      const contentH = stageRect.height;

      const toLocalRect = (r: DOMRect): { x: number; y: number; w: number; h: number } => ({
        x: r.left - minColLeft,
        y: r.top - stageRect.top,
        w: r.width,
        h: r.height,
      });

      const toLocal = (el: Element): { x: number; y: number; w: number; h: number } =>
        toLocalRect(el.getBoundingClientRect());

      const isVisibleInExport = (el: HTMLElement): boolean => {
        if (
          el.closest(
            '.vert-ind-top, .vert-ind-bot, [data-horiz-ind], .sankey-col-stepper, [data-sankey-level-side], .hidden, svg, style'
          )
        ) {
          return false;
        }
        let cur: HTMLElement | null = el;
        while (cur && cur !== stageEl) {
          const st = window.getComputedStyle(cur);
          if (
            st.display === 'none' ||
            st.visibility === 'hidden' ||
            parseFloat(st.opacity || '1') === 0
          ) {
            return false;
          }
          cur = cur.parentElement;
        }
        return true;
      };

      const PAD_X = 24;
      const PAD_TOP = 54;
      const PAD_BOT = 24;
      const logicalW = contentW + PAD_X * 2;
      const logicalH = contentH + PAD_TOP + PAD_BOT;

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(logicalW * 2);
      canvas.height = Math.round(logicalH * 2);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(2, 2);
      const fontStack = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

      const outerBgRgb = `rgb(${COL_BG_OUTER_RGB[0]}, ${COL_BG_OUTER_RGB[1]}, ${COL_BG_OUTER_RGB[2]})`;

      // 1. Outer medium-gray background
      drawRoundedRectPath(ctx, 0, 0, logicalW, logicalH, 14);
      ctx.fillStyle = outerBgRgb;
      ctx.fill();
      ctx.strokeStyle = 'rgba(161, 161, 170, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 2. Title header
      ctx.fillStyle = 'rgb(255, 255, 255)';
      ctx.font = `bold 13px ${fontStack}`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      const uniqueVisCount = activeFlow.uniqueVisitors ?? activeFlow.totalVisitors;
      ctx.fillText(
        `Visitor Flow Cockpit — ${normCurrent} (${period} · ${activeFlow.totalVisitors} Views · ${uniqueVisCount} Visitors)`,
        PAD_X,
        26
      );

      ctx.save();
      ctx.translate(PAD_X, PAD_TOP);

      // 3. Draw full-bleed column background stripes
      for (const colEl of colEls) {
        const cb = toLocal(colEl);
        const bg = colEl.getAttribute('data-col-bg') || outerBgRgb;
        ctx.fillStyle = bg;
        ctx.fillRect(cb.x, cb.y, cb.w, cb.h);
      }

      // 4. Draw SVG ribbons via Path2D (translated from stageRect.left to minColLeft)
      if (typeof Path2D !== 'undefined') {
        ctx.save();
        ctx.translate(stageRect.left - minColLeft, 0);
        for (const rEl of ribbonEls) {
          const d = rEl.getAttribute('d') || '';
          const fill = rEl.getAttribute('fill') || STANDARD_RIBBON_RGBA;
          if (d && d !== 'M 0 0') {
            const p2d = new Path2D(d);
            ctx.fillStyle = fill;
            ctx.fill(p2d);
          }
        }
        ctx.restore();
      }

      // 5. Walk all visible DOM elements inside columns to paint backgrounds, bars, thumbnails, borders, and dividers
      const domElements = Array.from(stageEl.querySelectorAll<HTMLElement>('.sankey-col *'));
      for (const el of domElements) {
        if (!isVisibleInExport(el)) continue;
        const b = toLocal(el);
        if (b.w <= 0.5 || b.h <= 0.5) continue;

        const scrollerEl = el.closest<HTMLElement>('.sankey-col-scroll');
        const scrollerBox = scrollerEl && scrollerEl !== el ? toLocal(scrollerEl) : null;
        if (
          scrollerBox &&
          (b.y + b.h <= scrollerBox.y + 1 || b.y >= scrollerBox.y + scrollerBox.h - 1)
        ) {
          continue;
        }

        const style = window.getComputedStyle(el);
        const bg = style.backgroundColor;
        const hasBg = Boolean(bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)');
        const barRgbAttr = el.getAttribute('data-bar-rgb');
        const bt = parseFloat(style.borderTopWidth) || 0;
        const bb = parseFloat(style.borderBottomWidth) || 0;
        const bl = parseFloat(style.borderLeftWidth) || 0;
        const br = parseFloat(style.borderRightWidth) || 0;
        const isImg =
          el instanceof HTMLImageElement && el.complete && (el.naturalWidth || 0) > 0;

        if (!hasBg && !barRgbAttr && bt <= 0 && bb <= 0 && !isImg) continue;

        ctx.save();
        if (scrollerBox) {
          ctx.beginPath();
          ctx.rect(scrollerBox.x, scrollerBox.y, scrollerBox.w, scrollerBox.h);
          ctx.clip();
        }

        // If this is a bar fill inside a rounded bar track, clip to the parent track pill shape
        const parentTrack = el.parentElement?.classList.contains('sankey-bar-track')
          ? el.parentElement
          : null;
        if (parentTrack) {
          const tb = toLocal(parentTrack);
          drawRoundedRectPath(ctx, tb.x, tb.y, tb.w, tb.h, tb.h / 2);
          ctx.clip();
        }

        const radius = Math.min(b.w / 2, b.h / 2, parseFloat(style.borderTopLeftRadius) || 0);

        if (hasBg || barRgbAttr) {
          drawRoundedRectPath(ctx, b.x, b.y, b.w, b.h, radius);
          ctx.fillStyle = barRgbAttr || bg;
          ctx.fill();
        }

        if (isImg) {
          try {
            drawRoundedRectPath(ctx, b.x, b.y, b.w, b.h, radius);
            ctx.clip();
            ctx.drawImage(el, b.x, b.y, b.w, b.h);
          } catch {
            // Ignore cross-origin or broken image draw errors
          }
        }

        if (bt > 0 && bb > 0 && bl > 0 && br > 0) {
          if (style.borderTopStyle === 'dashed') {
            ctx.setLineDash([4, 4]);
          }
          drawRoundedRectPath(ctx, b.x, b.y, b.w, b.h, radius);
          ctx.strokeStyle = style.borderTopColor || 'rgba(161, 161, 170, 0.9)';
          ctx.lineWidth = bt;
          ctx.stroke();
        } else if (bt > 0 && bb === 0) {
          if (style.borderTopStyle === 'dashed') {
            ctx.setLineDash([4, 4]);
          }
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(b.x + b.w, b.y);
          ctx.strokeStyle = style.borderTopColor || 'rgba(161, 161, 170, 0.8)';
          ctx.lineWidth = bt;
          ctx.stroke();
        } else if (bb > 0 && bt === 0) {
          ctx.beginPath();
          ctx.moveTo(b.x, b.y + b.h);
          ctx.lineTo(b.x + b.w, b.y + b.h);
          ctx.strokeStyle = style.borderBottomColor || 'rgba(161, 161, 170, 0.8)';
          ctx.lineWidth = bb;
          ctx.stroke();
        }

        ctx.restore();
      }

      // 5b. Render inline SVG Line Charts (.sankey-inline-chart-svg: Daily Traffic & Scroll Depth)
      const inlineChartSvgs = Array.from(
        stageEl.querySelectorAll<SVGSVGElement>('.sankey-inline-chart-svg')
      );
      for (const chartSvgEl of inlineChartSvgs) {
        const sb = toLocal(chartSvgEl);
        if (sb.w <= 1 || sb.h <= 1) continue;
        const scrollerEl = chartSvgEl.closest<HTMLElement>('.sankey-col-scroll');
        const scrollerBox = scrollerEl ? toLocal(scrollerEl) : null;
        if (
          scrollerBox &&
          (sb.y + sb.h <= scrollerBox.y + 1 || sb.y >= scrollerBox.y + scrollerBox.h - 1)
        ) {
          continue;
        }

        ctx.save();
        if (scrollerBox) {
          ctx.beginPath();
          ctx.rect(scrollerBox.x, scrollerBox.y, scrollerBox.w, scrollerBox.h);
          ctx.clip();
        }

        drawRoundedRectPath(ctx, sb.x, sb.y, sb.w, sb.h, 4);
        ctx.fillStyle = 'rgb(39, 39, 42)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(113, 113, 122, 0.9)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Gridlines at 25%, 50%, 75%
        ctx.save();
        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = 'rgba(161, 161, 170, 0.35)';
        ctx.lineWidth = 1;
        for (const frac of [0.25, 0.5, 0.75]) {
          const gy = sb.y + ((6 + frac * 44) / 56) * sb.h;
          ctx.beginPath();
          ctx.moveTo(sb.x + (8 / 320) * sb.w, gy);
          ctx.lineTo(sb.x + (312 / 320) * sb.w, gy);
          ctx.stroke();
        }
        ctx.restore();

        if (typeof Path2D !== 'undefined') {
          ctx.save();
          ctx.translate(sb.x, sb.y);
          ctx.scale(sb.w / 320, sb.h / 56);
          const pathEls = Array.from(chartSvgEl.querySelectorAll<SVGPathElement>('path'));
          for (const pathEl of pathEls) {
            const d = pathEl.getAttribute('d') || '';
            if (!d) continue;
            const p2d = new Path2D(d);
            const fill = pathEl.getAttribute('fill');
            const stroke = pathEl.getAttribute('stroke');
            if (fill && fill !== 'none') {
              ctx.fillStyle = fill;
              ctx.fill(p2d);
            }
            if (stroke && stroke !== 'none') {
              ctx.strokeStyle = stroke;
              ctx.lineWidth = parseFloat(pathEl.getAttribute('stroke-width') || '1.8');
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.stroke(p2d);
            }
          }
          ctx.restore();
        }

        const dotEls = Array.from(
          chartSvgEl.querySelectorAll<SVGCircleElement>('.sankey-chart-dot')
        );
        for (const dot of dotEls) {
          const px = sb.x + (parseFloat(dot.getAttribute('cx') || '0') / 320) * sb.w;
          const py = sb.y + (parseFloat(dot.getAttribute('cy') || '0') / 56) * sb.h;
          const r = parseFloat(dot.getAttribute('r') || '2');
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fillStyle = dot.getAttribute('fill') || 'rgb(52, 211, 153)';
          ctx.fill();
          ctx.strokeStyle = dot.getAttribute('stroke') || 'rgb(39, 39, 42)';
          ctx.lineWidth = parseFloat(dot.getAttribute('stroke-width') || '1');
          ctx.stroke();
        }

        ctx.restore();
      }

      // 6. Walk all visible text nodes inside stageEl and draw them at their exact Range bounding rects
      const walker = document.createTreeWalker(stageEl, NodeFilter.SHOW_TEXT);
      let currentNode = walker.nextNode();
      while (currentNode) {
        const textNode = currentNode as Text;
        currentNode = walker.nextNode();

        const rawVal = textNode.nodeValue;
        if (!rawVal || !rawVal.trim()) continue;

        const parentEl = textNode.parentElement;
        if (!parentEl || !isVisibleInExport(parentEl)) continue;

        const range = document.createRange();
        range.selectNodeContents(textNode);
        const clientRects = range.getClientRects();
        if (clientRects.length === 0) continue;

        const rb = toLocalRect(range.getBoundingClientRect());
        if (rb.w <= 0.5 || rb.h <= 0.5) continue;

        const scrollerEl = parentEl.closest<HTMLElement>('.sankey-col-scroll');
        const scrollerBox = scrollerEl ? toLocal(scrollerEl) : null;
        if (
          scrollerBox &&
          (rb.y + rb.h <= scrollerBox.y + 1 || rb.y >= scrollerBox.y + scrollerBox.h - 1)
        ) {
          continue;
        }

        const style = window.getComputedStyle(parentEl);
        let textStr = rawVal.replace(/\s+/g, ' ');
        if (textNode === parentEl.firstChild) textStr = textStr.replace(/^\s+/, '');
        if (textNode === parentEl.lastChild) textStr = textStr.replace(/\s+$/, '');
        if (!textStr) continue;
        if (style.textTransform === 'uppercase') {
          textStr = textStr.toUpperCase();
        }

        ctx.save();
        if (scrollerBox) {
          ctx.beginPath();
          ctx.rect(scrollerBox.x, scrollerBox.y, scrollerBox.w, scrollerBox.h);
          ctx.clip();
        }

        const fontStyle =
          style.fontStyle && style.fontStyle !== 'normal' ? `${style.fontStyle} ` : '';
        const fontWeight = style.fontWeight || '400';
        const fontSize = style.fontSize || '11px';
        ctx.font = `${fontStyle}${fontWeight} ${fontSize} ${fontStack}`;
        ctx.fillStyle = style.color || 'rgb(255, 255, 255)';
        ctx.textBaseline = 'middle';

        const pb = toLocal(parentEl);
        const isTruncated =
          style.textOverflow === 'ellipsis' ||
          style.overflow === 'hidden' ||
          style.overflowX === 'hidden';

        if (isTruncated && pb.w > 0) {
          ctx.beginPath();
          ctx.rect(pb.x, pb.y - 2, pb.w, pb.h + 4);
          ctx.clip();
        }

        if (clientRects.length > 1 && style.whiteSpace !== 'nowrap') {
          // Multi-line wrapped text (e.g. empty column placeholder)
          const words = textStr.trim().split(' ');
          const lines: string[] = [];
          let curLine = '';
          const maxLineW = Math.max(40, rb.w + 8);
          for (const w of words) {
            const test = curLine ? `${curLine} ${w}` : w;
            if (ctx.measureText(test).width > maxLineW && curLine) {
              lines.push(curLine);
              curLine = w;
            } else {
              curLine = test;
            }
          }
          if (curLine) lines.push(curLine);

          const lineH = rb.h / Math.max(1, lines.length);
          const isCentered = style.textAlign === 'center';
          ctx.textAlign = isCentered ? 'center' : 'left';
          const anchorX = isCentered ? rb.x + rb.w / 2 : rb.x;
          lines.forEach((line, idx) => {
            ctx.fillText(line, anchorX, rb.y + lineH * (idx + 0.5));
          });
        } else {
          let drawStr = textStr;
          if (style.textOverflow === 'ellipsis' && pb.w > 0) {
            const maxTextW = Math.max(0, pb.x + pb.w - rb.x);
            drawStr = truncateCanvasText(ctx, textStr, maxTextW);
          }
          ctx.textAlign = 'left';
          ctx.fillText(drawStr, rb.x, rb.y + rb.h / 2);
        }

        ctx.restore();
      }

      ctx.restore();

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        throw new Error('Failed to encode Sankey PNG blob');
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    };

    // Bind Cockpit header controls via delegated listener on controlScope (once per render generation)
    const onControlClick = (e: Event): void => {
      if (renderGenerationMap.get(container) !== generation) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const levelDeltaBtn = target.closest<HTMLButtonElement>('[data-sankey-level-delta]');
      if (levelDeltaBtn) {
        e.preventDefault();
        e.stopPropagation();
        const delta = Number(levelDeltaBtn.getAttribute('data-sankey-level-delta') || 0);
        const next = clampLevel(levels + delta);
        if (next !== levels) {
          levels = next;
          leftLevels = levels;
          rightLevels = levels;
          setStoredLevel(LEFT_LEVELS_STORAGE_KEY, levels);
          setStoredLevel(RIGHT_LEVELS_STORAGE_KEY, levels);
          renderStageDom();
        }
        return;
      }

      const modelBtn = target.closest<HTMLButtonElement>('[data-sankey-model]');
      if (modelBtn) {
        e.preventDefault();
        e.stopPropagation();
        const nextModel = modelBtn.getAttribute('data-sankey-model') as SankeyModelMode | null;
        if ((nextModel === 'flow' || nextModel === 'markov') && nextModel !== modelMode) {
          modelMode = nextModel;
          setStoredModelMode(modelMode);
          renderStageDom();
        }
        return;
      }

      const copyBtn = target.closest<HTMLButtonElement>('[data-sankey-copy-png]');
      if (copyBtn) {
        e.preventDefault();
        e.stopPropagation();
        const labelSpan = copyBtn.querySelector<HTMLElement>('[data-copy-png-label]');
        if (labelSpan) {
          labelSpan.textContent = '⏳ Rendering...';
        } else {
          copyBtn.textContent = '⏳';
        }
        void (async () => {
          try {
            await copySankeyPngToClipboard();
            if (labelSpan) {
              labelSpan.textContent = '✓ PNG Copied!';
            } else {
              copyBtn.textContent = '✓';
            }
            copyBtn.classList.add('text-emerald-300', 'border-emerald-400');
            setTimeout(() => {
              if (labelSpan) {
                labelSpan.textContent = 'Copy PNG';
              } else {
                copyBtn.textContent = '📋';
              }
              copyBtn.classList.remove('text-emerald-300', 'border-emerald-400');
            }, 2000);
          } catch {
            if (labelSpan) {
              labelSpan.textContent = '⚠️ Copy Failed';
            } else {
              copyBtn.textContent = '⚠️';
            }
            setTimeout(() => {
              if (labelSpan) {
                labelSpan.textContent = 'Copy PNG';
              } else {
                copyBtn.textContent = '📋';
              }
            }, 2000);
          }
        })();
      }
    };

    const prevHandler = (
      controlScope as HTMLElement & { __sankeyControlHandler?: (ev: Event) => void }
    ).__sankeyControlHandler;
    if (prevHandler) {
      controlScope.removeEventListener('click', prevHandler);
    }
    (
      controlScope as HTMLElement & { __sankeyControlHandler?: (ev: Event) => void }
    ).__sankeyControlHandler = onControlClick;
    controlScope.addEventListener('click', onControlClick);

    // Connected-path hover highlighting across all columns
    const highlightConnected = (seedNodeId: string | null, seedLinkId: string | null = null) => {
      if (!seedNodeId && !seedLinkId) {
        ribbonEls.forEach((r) => {
          r.setAttribute('fill', r.getAttribute('data-default-fill') || '');
          r.style.opacity = '1';
        });
        nodeEls.forEach((n) => {
          n.style.opacity = '1';
        });
        return;
      }

      const activeNodeIds = new Set<string>();
      const activeLinkIds = new Set<string>();

      if (seedLinkId) {
        const link = links.find((l) => l.id === seedLinkId);
        if (link) {
          activeLinkIds.add(link.id);
          activeNodeIds.add(link.sourceNodeId);
          activeNodeIds.add(link.targetNodeId);
        }
      }

      if (seedNodeId) {
        activeNodeIds.add(seedNodeId);
        const upQueue = [seedNodeId];
        while (upQueue.length > 0) {
          const curr = upQueue.shift()!;
          for (const l of links) {
            if (l.targetNodeId === curr && !activeLinkIds.has(l.id)) {
              activeLinkIds.add(l.id);
              if (!activeNodeIds.has(l.sourceNodeId)) {
                activeNodeIds.add(l.sourceNodeId);
                upQueue.push(l.sourceNodeId);
              }
            }
          }
        }
        const downQueue = [seedNodeId];
        while (downQueue.length > 0) {
          const curr = downQueue.shift()!;
          for (const l of links) {
            if (l.sourceNodeId === curr && !activeLinkIds.has(l.id)) {
              activeLinkIds.add(l.id);
              if (!activeNodeIds.has(l.targetNodeId)) {
                activeNodeIds.add(l.targetNodeId);
                downQueue.push(l.targetNodeId);
              }
            }
          }
        }
      }

      ribbonEls.forEach((r) => {
        const lid = r.getAttribute('data-link-id') || '';
        const defFill = r.getAttribute('data-default-fill') || '';
        const hovFill = r.getAttribute('data-hover-fill') || defFill;
        if (activeLinkIds.has(lid)) {
          r.setAttribute('fill', hovFill);
          r.style.opacity = '1';
        } else {
          r.setAttribute('fill', defFill);
          r.style.opacity = '0.18';
        }
      });

      nodeEls.forEach((n) => {
        const nid = n.getAttribute('data-node-id') || '';
        n.style.opacity = activeNodeIds.has(nid) ? '1' : '0.45';
      });
    };

    const externalActionEls = Array.from(
      container.querySelectorAll<HTMLElement>('[data-external-href]')
    );
    externalActionEls.forEach((extEl) => {
      extEl.addEventListener('click', (e) => {
        const extHref = extEl.getAttribute('data-external-href');
        if (extHref) {
          e.preventDefault();
          e.stopPropagation();
          window.open(extHref, '_blank', 'noopener,noreferrer');
        }
      });
    });

    nodeEls.forEach((nodeEl) => {
      const nodeId = nodeEl.getAttribute('data-node-id');
      const internalHref = nodeEl.getAttribute('data-internal-href');
      const isCenter = nodeEl.getAttribute('data-sankey-center') === 'true';

      nodeEl.addEventListener('mouseenter', () => {
        if (nodeId && !isCenter) highlightConnected(nodeId, null);
      });
      nodeEl.addEventListener('mouseleave', () => {
        highlightConnected(null, null);
      });

      if (!isCenter && internalHref && onNavigateInternal) {
        nodeEl.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          onNavigateInternal(internalHref);
        });
      }
    });

    ribbonEls.forEach((ribbonEl) => {
      const linkId = ribbonEl.getAttribute('data-link-id');
      ribbonEl.addEventListener('mouseenter', () => {
        if (linkId) highlightConnected(null, linkId);
      });
      ribbonEl.addEventListener('mouseleave', () => {
        highlightConnected(null, null);
      });
    });

    const positionHorizontalStage = (): void => {
      if (!scrollViewportEl || !stageEl) return;
      const vpW = scrollViewportEl.clientWidth;
      if (vpW <= 0) return;

      clearUserHorizScrollActive();

      if (shouldCenterStage) {
        userCenterOffsetFromVpMid = 0;
        container.setAttribute('data-sankey-user-offset', '0');
        container.setAttribute('data-sankey-centered', 'true');
        shouldCenterStage = false;
      }

      const symPad = applyStageHorizontalPadding(vpW);
      lastObservedViewportWidth = vpW;

      const centerColEl = container.querySelector<HTMLElement>('[data-sankey-col="0"]');
      if (!centerColEl) return;

      const prevBehavior = scrollViewportEl.style.scrollBehavior;
      scrollViewportEl.style.scrollBehavior = 'auto';
      isProgrammaticScroll = true;

      const centerW = 420;
      const sideW = 308;
      const leftColsW = leftLevels * sideW;
      const colCenterInStage = symPad + leftColsW + centerW / 2;
      const targetViewportCenterX = vpW / 2 + userCenterOffsetFromVpMid;
      const targetScrollLeft = Math.max(0, Math.round(colCenterInStage - targetViewportCenterX));

      scrollViewportEl.scrollLeft = targetScrollLeft;
      scrollViewportEl.style.scrollBehavior = prevBehavior;
      requestAnimationFrame(() => {
        isProgrammaticScroll = false;
      });
    };

    positionHorizontalStage();
    layoutRibbons();
    updateHorizontalIndicators();
    colEls.forEach(updateColumnVerticalIndicators);

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        layoutRibbons();
        updateHorizontalIndicators();
        colEls.forEach(updateColumnVerticalIndicators);
      });
    }

    if (typeof ResizeObserver !== 'undefined' && stageEl) {
      const observer = new ResizeObserver(() => {
        if (scrollViewportEl) {
          const newVpW = scrollViewportEl.clientWidth;
          if (newVpW > 0 && newVpW !== lastObservedViewportWidth) {
            clearUserHorizScrollActive();
            if (shouldCenterStage) {
              userCenterOffsetFromVpMid = 0;
              container.setAttribute('data-sankey-user-offset', '0');
              container.setAttribute('data-sankey-centered', 'true');
              shouldCenterStage = false;
            }
            const hadPrevWidth = lastObservedViewportWidth > 0;
            if (!hadPrevWidth) {
              userCenterOffsetFromVpMid = 0;
            }
            lastObservedViewportWidth = newVpW;
            const symPad = applyStageHorizontalPadding(newVpW);

            const centerColEl = container.querySelector<HTMLElement>('[data-sankey-col="0"]');
            if (centerColEl) {
              const prevBehavior = scrollViewportEl.style.scrollBehavior;
              scrollViewportEl.style.scrollBehavior = 'auto';
              isProgrammaticScroll = true;
              const centerW = 420;
              const sideW = 308;
              const leftColsW = leftLevels * sideW;
              const colCenterInStage = symPad + leftColsW + centerW / 2;
              const targetScrollLeft = Math.max(
                0,
                Math.round(colCenterInStage - (newVpW / 2 + userCenterOffsetFromVpMid))
              );
              scrollViewportEl.scrollLeft = targetScrollLeft;
              scrollViewportEl.style.scrollBehavior = prevBehavior;
              requestAnimationFrame(() => {
                if (scrollViewportEl && scrollViewportEl.clientWidth === newVpW) {
                  const reVerifySymPad = applyStageHorizontalPadding(newVpW);
                  const reVerifyCenter = reVerifySymPad + leftColsW + centerW / 2;
                  const reVerifyScrollLeft = Math.max(
                    0,
                    Math.round(reVerifyCenter - (newVpW / 2 + userCenterOffsetFromVpMid))
                  );
                  if (Math.abs(scrollViewportEl.scrollLeft - reVerifyScrollLeft) > 1) {
                    scrollViewportEl.scrollLeft = reVerifyScrollLeft;
                  }
                }
                isProgrammaticScroll = false;
                layoutRibbons();
                updateHorizontalIndicators();
              });
            }
          }
        }
        layoutRibbons();
        updateHorizontalIndicators();
        colEls.forEach(updateColumnVerticalIndicators);
      });
      observer.observe(stageEl);
      if (scrollViewportEl) observer.observe(scrollViewportEl);
      nodeEls.forEach((el) => observer.observe(el));
      activeResizeObservers.set(container, observer);
    }
  };

  renderStageDom();
  void ensureMultiHopDataAndRender();
}
