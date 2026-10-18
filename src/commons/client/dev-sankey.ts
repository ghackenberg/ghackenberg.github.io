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

export interface DevSankeyPageContext {
  visitors?: number;
  pageviews?: number;
  visitDuration?: number | null;
  bounceRate?: number | null;
  gscQueries?: DevSankeyGscQuery[];
}

export type SankeyCardDensity = 'compact' | 'detailed';

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
  interests?: ContentManifestItem[];
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
const DENSITY_STORAGE_KEY = 'gh_dev_sankey_density';

const activeResizeObservers = new WeakMap<HTMLElement, ResizeObserver>();
const renderGenerationMap = new WeakMap<HTMLElement, number>();
const pageMetaCache = new Map<string, SankeyPageMetadata>();
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

  if (norm.startsWith('/interests/')) {
    return {
      emoji: '🎯',
      ribbonRgba: 'rgba(244, 63, 94, 0.42)',
      ribbonHoverRgba: 'rgba(244, 63, 94, 0.78)',
    };
  }
  if (norm.startsWith('/posts/')) {
    return {
      emoji: '✍️',
      ribbonRgba: 'rgba(139, 92, 246, 0.42)',
      ribbonHoverRgba: 'rgba(139, 92, 246, 0.78)',
    };
  }
  if (norm.startsWith('/publications/')) {
    return {
      emoji: '📚',
      ribbonRgba: 'rgba(99, 102, 241, 0.42)',
      ribbonHoverRgba: 'rgba(99, 102, 241, 0.78)',
    };
  }
  if (norm.startsWith('/presentations/')) {
    return {
      emoji: '🖥️',
      ribbonRgba: 'rgba(59, 130, 246, 0.42)',
      ribbonHoverRgba: 'rgba(59, 130, 246, 0.78)',
    };
  }
  if (norm.startsWith('/courses/')) {
    return {
      emoji: '🎓',
      ribbonRgba: 'rgba(6, 182, 212, 0.42)',
      ribbonHoverRgba: 'rgba(6, 182, 212, 0.78)',
    };
  }
  if (norm.startsWith('/projects/')) {
    return {
      emoji: '🚀',
      ribbonRgba: 'rgba(20, 184, 166, 0.42)',
      ribbonHoverRgba: 'rgba(20, 184, 166, 0.78)',
    };
  }
  if (norm.startsWith('/services/')) {
    return {
      emoji: '💼',
      ribbonRgba: 'rgba(16, 185, 129, 0.42)',
      ribbonHoverRgba: 'rgba(16, 185, 129, 0.78)',
    };
  }
  if (norm.startsWith('/visualizations/')) {
    return {
      emoji: '🌐',
      ribbonRgba: 'rgba(234, 179, 8, 0.42)',
      ribbonHoverRgba: 'rgba(234, 179, 8, 0.78)',
    };
  }
  if (norm.startsWith('/tags/')) {
    return {
      emoji: '🏷️',
      ribbonRgba: 'rgba(249, 115, 22, 0.42)',
      ribbonHoverRgba: 'rgba(249, 115, 22, 0.78)',
    };
  }
  if (norm === '/datenschutz/' || norm === '/privacy/') {
    return {
      emoji: '🛡️',
      ribbonRgba: 'rgba(168, 85, 247, 0.42)',
      ribbonHoverRgba: 'rgba(168, 85, 247, 0.78)',
    };
  }
  if (norm === '/impressum/' || norm === '/imprint/') {
    return {
      emoji: '⚖️',
      ribbonRgba: 'rgba(59, 130, 246, 0.42)',
      ribbonHoverRgba: 'rgba(59, 130, 246, 0.78)',
    };
  }

  return {
    emoji: '🏠',
    ribbonRgba: 'rgba(59, 130, 246, 0.42)',
    ribbonHoverRgba: 'rgba(59, 130, 246, 0.78)',
  };
}

function getColumnStripeBg(colIndex: number): { bg: string; headerColor: string } {
  const dist = Math.abs(colIndex);
  if (dist === 0) return { bg: 'rgb(52, 52, 58)', headerColor: 'text-white font-extrabold' };
  if (dist === 1) return { bg: 'rgb(36, 36, 41)', headerColor: 'text-zinc-200 font-bold' };
  if (dist === 2) return { bg: 'rgb(24, 24, 28)', headerColor: 'text-zinc-300 font-bold' };
  if (dist === 3) return { bg: 'rgb(15, 15, 18)', headerColor: 'text-zinc-400 font-bold' };
  return { bg: 'rgb(9, 9, 11)', headerColor: 'text-zinc-500 font-bold' };
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
  registerGroup(manifest.interests, '🎯', 'Interest');
  registerGroup(manifest.tags, '🏷️', 'Tag');
  isManifestPopulated = true;
}

function trySeedManifestFromLocalStorage(): void {
  if (isManifestPopulated) return;
  try {
    const raw = localStorage.getItem('gh_content_manifest_cache');
    if (!raw) return;
    const parsed = JSON.parse(raw) as { data?: ContentManifestPayload } | ContentManifestPayload;
    const payload =
      parsed && typeof parsed === 'object' && 'data' in parsed && parsed.data
        ? parsed.data
        : (parsed as ContentManifestPayload);
    ingestManifestPayload(payload);
  } catch {
    // ignore storage read errors
  }
}

async function ensureContentManifestLoaded(): Promise<void> {
  trySeedManifestFromLocalStorage();
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
  trySeedManifestFromLocalStorage();
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

function getStoredDensity(): SankeyCardDensity {
  try {
    const raw = localStorage.getItem(DENSITY_STORAGE_KEY);
    if (raw === 'compact' || raw === 'detailed') return raw;
    return 'detailed';
  } catch {
    return 'detailed';
  }
}

function setStoredDensity(density: SankeyCardDensity): void {
  try {
    localStorage.setItem(DENSITY_STORAGE_KEY, density);
  } catch {
    // ignore storage errors
  }
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
  rightLevels: number
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

  const inboundSum = rootFlow.inboundSources.reduce((sum, s) => sum + s.visitors, 0);
  centerNode.entryVis = rootFlow.directEntries > 0 ? rootFlow.directEntries : inboundSum;
  centerNode.prevVis = rootFlow.internalUpstreamVisitors;
  centerNode.nextVis = rootFlow.internalNextVisitors;
  centerNode.bounceVis = rootFlow.bounceVisitors ?? 0;
  centerNode.exitVis = rootFlow.exitVisitors ?? 0;
  centerNode.fileVis = rootFlow.pdfDownloadVisitors;
  centerNode.linkVis = rootFlow.outboundLinkVisitors;

  // 1. Pure Chain-Driven Multi-Level Traversal (L1..L5 Left & Right; each occurrence of normCurrent is a View)
  const chains = rootFlow.chains ?? [];

  for (const chain of chains) {
    const steps = chain.steps.map((s) => normalizePath(s));
    const vis = Math.max(0.1, Math.round(chain.visitors * 100) / 100);

    for (let centerIdx = 0; centerIdx < steps.length; centerIdx++) {
      if (steps[centerIdx] !== normCurrent) continue;

      // Walk Left (Upstream: offset = -1 down to -leftLevels)
      let currTargetNode = centerNode;
      for (let offset = -1; offset >= -leftLevels; offset--) {
        const stepIdx = centerIdx + offset;
        if (stepIdx < 0) break;

        const stepPath = steps[stepIdx];
        const upNode = upsertNode(offset, `page:${stepPath}`, {
          icon: '⬅️',
          title: stepPath,
          path: stepPath,
          visitors: vis,
          kind: 'upstream_page',
          href: stepPath,
          isInternalPage: true,
        });

        upsertLink(upNode, currTargetNode, vis);

        if (stepIdx === 0) {
          upNode.entryVis = Math.round((upNode.entryVis + vis) * 100) / 100;
        } else {
          upNode.prevVis = Math.round((upNode.prevVis + vis) * 100) / 100;
        }

        currTargetNode = upNode;
      }

      // Walk Right (Downstream: offset = +1 up to +rightLevels)
      let currSourceNode = centerNode;
      for (let offset = 1; offset <= rightLevels; offset++) {
        const stepIdx = centerIdx + offset;
        if (stepIdx >= steps.length) break;

        const stepPath = steps[stepIdx];
        const downNode = upsertNode(offset, `page:${stepPath}`, {
          icon: '➡️',
          title: stepPath,
          path: stepPath,
          visitors: vis,
          kind: 'internal_next',
          href: stepPath,
          isInternalPage: true,
        });

        upsertLink(currSourceNode, downNode, vis);

        if (stepIdx === steps.length - 1) {
          downNode.exitVis = Math.round((downNode.exitVis + vis) * 100) / 100;
        } else {
          downNode.nextVis = Math.round((downNode.nextVis + vis) * 100) / 100;
        }

        currSourceNode = downNode;
      }
    }
  }

  // Attach step-level File Downloads & Outbound Links to side nodes
  const stepActions = rootFlow.stepActions ?? {};
  for (let c = -leftLevels; c <= rightLevels; c++) {
    if (c === 0) continue;
    const colNodes = columnsMap.get(c)!;
    for (const node of colNodes.values()) {
      const act = stepActions[node.path];
      if (act) {
        node.fileVis = Math.min(Math.round(node.visitors), Math.round(act.fileVisitors || 0));
        node.linkVis = Math.min(Math.round(node.visitors), Math.round(act.linkVisitors || 0));
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

  if (!flow || flow.totalVisitors <= 0) {
    container.innerHTML = `
      <div class="w-full h-full flex items-center justify-center p-8 bg-zinc-950 font-mono text-xs text-zinc-300">
        <div class="p-6 rounded-xl bg-zinc-900 border border-zinc-700 text-center max-w-md">
          No visitor flow transitions recorded for <span class="text-white font-bold">${escapeHtml(normCurrent)}</span> in the selected period.
        </div>
      </div>
    `;
    return;
  }

  let leftLevels = getStoredLevel(LEFT_LEVELS_STORAGE_KEY, 2);
  let rightLevels = getStoredLevel(RIGHT_LEVELS_STORAGE_KEY, 2);
  let density: SankeyCardDensity = getStoredDensity();
  let shouldCenterStage = true;
  let userCenterOffsetFromVpMid = 0;
  let lastObservedViewportWidth = 0;

  const controlScope = container.closest<HTMLElement>('#dev-analytics-fullview') ?? container;

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

    const prevViewportEl = container.querySelector<HTMLElement>('[data-sankey-scroll-viewport]');
    const prevCenterColEl = container.querySelector<HTMLElement>('[data-sankey-col="0"]');
    const prevCenterScreenX =
      !shouldCenterStage &&
      prevViewportEl &&
      prevCenterColEl &&
      prevViewportEl.clientWidth > 0
        ? prevCenterColEl.getBoundingClientRect().left -
          prevViewportEl.getBoundingClientRect().left
        : null;
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
      flow,
      leftLevels,
      rightLevels
    );

    // Sync Cockpit Header Bar controls if present in controlScope
    const leftBadgeEl = controlScope.querySelector<HTMLElement>('[data-sankey-left-badge]');
    const rightBadgeEl = controlScope.querySelector<HTMLElement>('[data-sankey-right-badge]');
    if (leftBadgeEl) leftBadgeEl.textContent = `${leftLevels}L`;
    if (rightBadgeEl) rightBadgeEl.textContent = `${rightLevels}R`;

    controlScope
      .querySelectorAll<HTMLButtonElement>('[data-sankey-density]')
      .forEach((btn) => {
        const mode = btn.getAttribute('data-sankey-density');
        const isActive = mode === density;
        btn.className = isActive
          ? 'px-2 py-1 rounded font-bold bg-emerald-500/30 border border-emerald-400 text-emerald-200 transition-colors cursor-pointer'
          : 'px-2 py-1 rounded font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer';
      });

    const renderMediaBox = (
      node: SankeyGraphNode,
      sizeClass: string
    ): string => {
      const thumbUrl = node.pageMeta?.image;
      if (thumbUrl) {
        return `<img class="sankey-node-thumb ${sizeClass} object-cover rounded-lg border border-zinc-700 shrink-0" src="${escapeHtml(thumbUrl)}" alt="" loading="eager" />`;
      }
      return `<span class="sankey-node-emoji-box ${sizeClass} rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0" data-emoji="${escapeHtml(node.icon)}">${escapeHtml(node.icon)}</span>`;
    };

    const renderCenterInspectorCard = (node: SankeyGraphNode): string => {
      const totalViews = Math.max(1, flow.totalVisitors);
      const uniqueVisitors =
        flow.uniqueVisitors ?? context?.visitors ?? flow.totalVisitors;
      const entryVis = node.entryVis;
      const prevVis = flow.internalUpstreamVisitors;
      const nextVis = flow.internalNextVisitors;
      const bounceVis = flow.bounceVisitors ?? 0;
      const exitVis = flow.exitVisitors ?? 0;

      const entryPct = Math.min(100, Math.round((entryVis / totalViews) * 100));
      const prevPct = Math.min(100, Math.round((prevVis / totalViews) * 100));
      const nextPct = Math.min(100, Math.round((nextVis / totalViews) * 100));
      const bouncePct = Math.min(100, Math.round((bounceVis / totalViews) * 100));
      const exitPct = Math.min(100, Math.round((exitVis / totalViews) * 100));

      const filePct = Math.min(100, Math.round((node.fileVis / totalViews) * 100));
      const linkPct = Math.min(100, Math.round((node.linkVis / totalViews) * 100));

      const untrackedVis = flow.untrackedVisitors ?? 0;
      const untrackedPct = Math.min(
        100,
        Math.round(flow.untrackedRate ?? (untrackedVis / totalViews) * 100)
      );

      const durationStr = formatDurationSeconds(context?.visitDuration);

      const entrySources = flow.inboundSources.slice(0, 4);
      const entrySourcesHtml =
        entrySources.length > 0
          ? `<div class="flex flex-wrap gap-1 pt-1 border-t border-zinc-700/70">
              ${entrySources
                .map((s) => {
                  const cleanLabel = s.label === 'Direct / None' ? 'Direct' : s.label;
                  return `<span class="sankey-ext-pill px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/30 text-emerald-200" title="Entry Source: ${escapeHtml(cleanLabel)} (${formatVisitorCount(s.visitors)} visitors)">${escapeHtml(cleanLabel)}: ${formatVisitorCount(s.visitors)}</span>`;
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
                <div class="flex items-center justify-between text-zinc-200 bg-zinc-900/90 px-2 py-0.5 rounded">
                  <span class="truncate pr-2" title="${escapeHtml(q.query)}">"${escapeHtml(q.query)}"</span>
                  <span class="shrink-0 text-emerald-300">${q.clicks}c · ${q.impressions}i · <strong class="text-amber-200">#${q.position.toFixed(1)}</strong></span>
                </div>
              `
              )
              .join('')
          : `<div class="text-zinc-400 italic text-[11px]">No organic search queries recorded in period</div>`;

      const fileItemsHtml =
        flow.pdfDownloads.length > 0
          ? `<div class="text-sky-100 pt-1 border-t border-zinc-700/70 space-y-0.5">
              ${flow.pdfDownloads
                .slice(0, 3)
                .map((item) => {
                  const hasHref = Boolean(item.href);
                  const cls = hasHref ? 'cursor-pointer hover:underline' : '';
                  return `<div class="truncate ${cls}" ${hasHref ? `data-external-href="${escapeHtml(item.href!)}"` : ''} title="File: ${escapeHtml(item.label)} (${formatVisitorCount(item.visitors)} visitors)">· ${escapeHtml(item.label)} (${formatVisitorCount(item.visitors)})</div>`;
                })
                .join('')}
            </div>`
          : '';

      const outboundItemsHtml =
        flow.outboundLinks.length > 0
          ? `<div class="text-purple-100 pt-1 border-t border-zinc-700/70 space-y-0.5">
              ${flow.outboundLinks
                .slice(0, 3)
                .map((item) => {
                  const hasHref = Boolean(item.href);
                  const cls = hasHref ? 'cursor-pointer hover:underline' : '';
                  return `<div class="truncate ${cls}" ${hasHref ? `data-external-href="${escapeHtml(item.href!)}"` : ''} title="Outbound Link: ${escapeHtml(item.href || item.label)} (${formatVisitorCount(item.visitors)} visitors)">↗ ${escapeHtml(item.label)} (${formatVisitorCount(item.visitors)})</div>`;
                })
                .join('')}
            </div>`
          : '';

      return `
        <div
          data-sankey-center="true"
          data-node-id="${escapeHtml(node.id)}"
          data-node-title="${escapeHtml(node.title)}"
          data-node-path="${escapeHtml(node.path)}"
          data-node-badge="100% (${formatVisitorCount(totalViews)})"
          data-visitors="${totalViews}"
          class="sankey-node sankey-card relative z-30 overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-500/90 px-3.5 py-3 flex flex-col gap-2 font-mono text-xs shrink-0 shadow-2xl transition-opacity"
        >
          <!-- Above Divider: Thumbnail/Emoji + Title & Path + 100% Views Badge -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              ${renderMediaBox(node, 'w-9 h-9')}
              <div class="min-w-0 leading-tight">
                <div class="font-bold text-white truncate" title="${escapeHtml(node.title)}">${escapeHtml(node.title)}</div>
                <div class="text-xs text-zinc-400 truncate mt-0.5">${escapeHtml(node.path)}</div>
              </div>
            </div>
            <span class="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-500 text-white font-bold shrink-0" title="100% (${formatVisitorCount(totalViews)} Views)">100% (${formatVisitorCount(totalViews)})</span>
          </div>

          <div class="flex items-center justify-between px-2.5 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700 text-zinc-300">
            <span>👤 Visitors: <strong class="text-white">${formatVisitorCount(uniqueVisitors)}</strong></span>
            <span>⏱️ Avg Duration: <strong class="text-white">${durationStr}</strong></span>
          </div>

          <div class="space-y-2 pt-1.5 border-t border-zinc-700/80">
            <!-- 1. INFLOW SPLIT BAR (Entry vs. Prev) + Entry Sources & Google Search Queries -->
            <div class="sankey-ext-block rounded-lg bg-zinc-800/60 border border-zinc-700/90 p-2 space-y-1.5" data-ext-header="🚪 Entry ${entryPct}% (${formatVisitorCount(entryVis)})" data-ext-metrics="⬅️ Prev ${prevPct}% (${formatVisitorCount(prevVis)})">
              <div class="flex items-center justify-between text-xs">
                <span class="text-emerald-300 font-bold">🚪 Entry ${entryPct}% <span class="text-zinc-400 font-normal">(${formatVisitorCount(entryVis)})</span></span>
                <span class="text-amber-300 font-bold">⬅️ Prev ${prevPct}% <span class="text-zinc-400 font-normal">(${formatVisitorCount(prevVis)})</span></span>
              </div>
              <div class="sankey-bar-track w-full h-2 rounded-full bg-zinc-950 overflow-hidden flex gap-0.5">
                <div class="sankey-bar-fill h-full bg-emerald-400" data-bar-rgb="rgb(52, 211, 153)" style="width: ${entryPct}%"></div>
                <div class="sankey-bar-fill h-full bg-amber-400" data-bar-rgb="rgb(251, 191, 36)" style="width: ${prevPct}%"></div>
              </div>
              ${entrySourcesHtml}
              <div class="pt-1.5 border-t border-zinc-700/70 space-y-1">
                <div class="text-emerald-300 font-bold">🔍 Google Search Queries:</div>
                ${queriesRowsHtml}
              </div>
            </div>

            <!-- 2. OUTFLOW & TERMINATION SPLIT BAR (Next vs. Bounce vs. Exit) -->
            <div class="sankey-ext-block rounded-lg bg-zinc-800/60 border border-zinc-700/90 p-2 space-y-1.5" data-ext-header="➡️ Next ${nextPct}% (${formatVisitorCount(nextVis)})" data-ext-metrics="💥 Bounce ${bouncePct}% (${formatVisitorCount(bounceVis)}) · ↩️ Exit ${exitPct}% (${formatVisitorCount(exitVis)})">
              <div class="flex items-center justify-between gap-1 text-xs">
                <span class="text-emerald-300 font-bold">➡️ Next ${nextPct}% <span class="text-zinc-400 font-normal">(${formatVisitorCount(nextVis)})</span></span>
                <span class="text-orange-300 font-bold">💥 Bounce ${bouncePct}% <span class="text-zinc-400 font-normal">(${formatVisitorCount(bounceVis)})</span></span>
                <span class="text-rose-300 font-bold">↩️ Exit ${exitPct}% <span class="text-zinc-400 font-normal">(${formatVisitorCount(exitVis)})</span></span>
              </div>
              <div class="sankey-bar-track w-full h-2 rounded-full bg-zinc-950 overflow-hidden flex gap-0.5" title="Next: ${nextPct}% (${formatVisitorCount(nextVis)}) · Bounce: ${bouncePct}% (${formatVisitorCount(bounceVis)}) · Exit: ${exitPct}% (${formatVisitorCount(exitVis)})">
                <div class="sankey-bar-fill h-full bg-emerald-400" data-bar-rgb="rgb(52, 211, 153)" style="width: ${nextPct}%"></div>
                <div class="sankey-bar-fill h-full bg-orange-400" data-bar-rgb="rgb(251, 146, 60)" style="width: ${bouncePct}%"></div>
                <div class="sankey-bar-fill h-full bg-rose-500" data-bar-rgb="rgb(244, 63, 94)" style="width: ${exitPct}%"></div>
              </div>
            </div>

            <!-- 3. FILE DOWNLOADS BAR + DETAIL ITEMS -->
            <div class="sankey-ext-block rounded-lg bg-zinc-800/60 border border-zinc-700/90 p-2 space-y-1.5" data-ext-header="📄 File Downloads" data-ext-metrics="${filePct}% (${formatVisitorCount(node.fileVis)})">
              <div class="flex items-center justify-between font-bold text-sky-200">
                <span>📄 File Downloads</span>
                <span class="text-white">${filePct}% <span class="text-zinc-400 font-normal">(${formatVisitorCount(node.fileVis)})</span></span>
              </div>
              <div class="sankey-bar-track w-full h-1.5 rounded-full bg-zinc-950 overflow-hidden">
                <div class="sankey-bar-fill h-full bg-sky-400 rounded-full" data-bar-rgb="rgb(56, 189, 248)" style="width: ${filePct}%"></div>
              </div>
              ${fileItemsHtml}
            </div>

            <!-- 4. OUTBOUND LINKS BAR + DETAIL ITEMS -->
            <div class="sankey-ext-block rounded-lg bg-zinc-800/60 border border-zinc-700/90 p-2 space-y-1.5" data-ext-header="↗ Outbound Links" data-ext-metrics="${linkPct}% (${formatVisitorCount(node.linkVis)})">
              <div class="flex items-center justify-between font-bold text-purple-200">
                <span>↗ Outbound Links</span>
                <span class="text-white">${linkPct}% <span class="text-zinc-400 font-normal">(${formatVisitorCount(node.linkVis)})</span></span>
              </div>
              <div class="sankey-bar-track w-full h-1.5 rounded-full bg-zinc-950 overflow-hidden">
                <div class="sankey-bar-fill h-full bg-purple-400 rounded-full" data-bar-rgb="rgb(192, 132, 252)" style="width: ${linkPct}%"></div>
              </div>
              ${outboundItemsHtml}
            </div>

            <!-- 5. WITHOUT FLOW CONTEXT BAR -->
            <div
              class="sankey-ext-block rounded-lg bg-zinc-800/80 border border-zinc-700 p-2 space-y-1.5"
              data-ext-header="❔ Without Flow Context"
              data-ext-metrics="${untrackedPct}% (${formatVisitorCount(untrackedVis)})"
              title="Pageviews without flow_id / flow_step (e.g. historical events prior to span-tracing rollout or browsers blocking window.name & Navigation API): ${formatVisitorCount(untrackedVis)} Views (${untrackedPct}%)"
            >
              <div class="flex items-center justify-between text-zinc-300">
                <span class="font-bold">❔ Without Flow Context</span>
                <span class="text-zinc-100 font-bold">${untrackedPct}% <span class="text-zinc-400 font-normal">(${formatVisitorCount(untrackedVis)})</span></span>
              </div>
              <div class="sankey-bar-track w-full h-1.5 rounded-full bg-zinc-950 overflow-hidden">
                <div class="sankey-bar-fill h-full bg-zinc-400 rounded-full" data-bar-rgb="rgb(161, 161, 170)" style="width: ${untrackedPct}%"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    };

    const renderSideNodeCard = (node: SankeyGraphNode, colIndex: number): string => {
      const pctStr = `${Math.round(node.percentage)}% (${formatVisitorCount(node.visitors)})`;
      const isClickable = Boolean(node.isInternalPage && node.href);
      const cursorClass = isClickable ? 'cursor-pointer' : 'cursor-default';

      if (density === 'compact') {
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
            class="sankey-node sankey-card relative z-30 overflow-hidden rounded-xl bg-zinc-900/95 border border-zinc-700/90 px-3 h-[52px] flex items-center justify-between gap-2 font-mono text-xs shrink-0 shadow-lg hover:border-zinc-400 transition-colors ${cursorClass}"
          >
            <div class="flex items-center gap-2 min-w-0">
              ${renderMediaBox(node, 'w-7 h-7')}
              <span class="font-bold text-white truncate">${escapeHtml(node.title)}</span>
            </div>
            <span class="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-600 text-zinc-100 font-bold shrink-0">${pctStr}</span>
          </div>
        `;
      }

      const totalLocal = Math.max(1, node.visitors);
      const filePct = Math.min(100, Math.round(((node.fileVis || 0) / totalLocal) * 100));
      const linkPct = Math.min(100, Math.round(((node.linkVis || 0) / totalLocal) * 100));

      let flowSplitBarHtml = '';
      if (colIndex < 0) {
        const entryLocalPct = Math.min(100, Math.round(((node.entryVis || 0) / totalLocal) * 100));
        const prevLocalPct = Math.max(0, 100 - entryLocalPct);
        flowSplitBarHtml = `
          <div
            class="sankey-ext-block space-y-1"
            data-ext-header="🚪 Entry ${entryLocalPct}% (${formatVisitorCount(node.entryVis)})"
            data-ext-metrics="⬅️ Prev ${prevLocalPct}% (${formatVisitorCount(node.prevVis)})"
            title="Of the ${formatVisitorCount(node.visitors)} views passing through ${escapeHtml(node.path)} at this step: ${entryLocalPct}% (${formatVisitorCount(node.entryVis)}) started their session here (Entry), and ${prevLocalPct}% (${formatVisitorCount(node.prevVis)}) came from an earlier internal page (Prev)."
          >
            <div class="flex items-center justify-between text-xs">
              <span class="text-emerald-300 font-semibold">🚪 Entry ${entryLocalPct}% <span class="text-zinc-400 font-normal">(${formatVisitorCount(node.entryVis)})</span></span>
              <span class="text-amber-300 font-semibold">⬅️ Prev ${prevLocalPct}% <span class="text-zinc-400 font-normal">(${formatVisitorCount(node.prevVis)})</span></span>
            </div>
            <div class="sankey-bar-track w-full h-1.5 rounded-full bg-zinc-950 overflow-hidden flex gap-0.5">
              <div class="sankey-bar-fill h-full bg-emerald-400" data-bar-rgb="rgb(52, 211, 153)" style="width: ${entryLocalPct}%"></div>
              <div class="sankey-bar-fill h-full bg-amber-400" data-bar-rgb="rgb(251, 191, 36)" style="width: ${prevLocalPct}%"></div>
            </div>
          </div>
        `;
      } else {
        const nextLocalPct = Math.min(100, Math.round(((node.nextVis || 0) / totalLocal) * 100));
        const exitLocalPct = Math.max(0, 100 - nextLocalPct);
        flowSplitBarHtml = `
          <div
            class="sankey-ext-block space-y-1"
            data-ext-header="➡️ Next ${nextLocalPct}% (${formatVisitorCount(node.nextVis)})"
            data-ext-metrics="↩️ Exit ${exitLocalPct}% (${formatVisitorCount(node.exitVis)})"
            title="Of the ${formatVisitorCount(node.visitors)} views landing on ${escapeHtml(node.path)} at this step: ${nextLocalPct}% (${formatVisitorCount(node.nextVis)}) navigated to a further page (Next), and ${exitLocalPct}% (${formatVisitorCount(node.exitVis)}) exited here (Exit)."
          >
            <div class="flex items-center justify-between text-xs">
              <span class="text-emerald-300 font-semibold">➡️ Next ${nextLocalPct}% <span class="text-zinc-400 font-normal">(${formatVisitorCount(node.nextVis)})</span></span>
              <span class="text-rose-300 font-semibold">↩️ Exit ${exitLocalPct}% <span class="text-zinc-400 font-normal">(${formatVisitorCount(node.exitVis)})</span></span>
            </div>
            <div class="sankey-bar-track w-full h-1.5 rounded-full bg-zinc-950 overflow-hidden flex gap-0.5">
              <div class="sankey-bar-fill h-full bg-emerald-400" data-bar-rgb="rgb(52, 211, 153)" style="width: ${nextLocalPct}%"></div>
              <div class="sankey-bar-fill h-full bg-rose-500" data-bar-rgb="rgb(244, 63, 94)" style="width: ${exitLocalPct}%"></div>
            </div>
          </div>
        `;
      }

      const actionsBarsHtml = `
        <div class="grid grid-cols-2 gap-2 pt-0.5">
          <div
            class="sankey-ext-block space-y-1"
            data-ext-header="📄 Files"
            data-ext-metrics="${filePct}% (${formatVisitorCount(node.fileVis)})"
            title="${filePct}% (${formatVisitorCount(node.fileVis)} of ${formatVisitorCount(node.visitors)}) downloaded at least one file on this page"
          >
            <div class="flex items-center justify-between text-xs">
              <span class="text-sky-200">📄 Files</span>
              <span class="text-white font-semibold">${filePct}% <span class="text-zinc-400 font-normal">(${formatVisitorCount(node.fileVis)})</span></span>
            </div>
            <div class="sankey-bar-track w-full h-1.5 rounded-full bg-zinc-950 overflow-hidden">
              <div class="sankey-bar-fill h-full bg-sky-400 rounded-full" data-bar-rgb="rgb(56, 189, 248)" style="width: ${filePct}%"></div>
            </div>
          </div>

          <div
            class="sankey-ext-block space-y-1"
            data-ext-header="↗ Links"
            data-ext-metrics="${linkPct}% (${formatVisitorCount(node.linkVis)})"
            title="${linkPct}% (${formatVisitorCount(node.linkVis)} of ${formatVisitorCount(node.visitors)}) clicked at least one external link on this page"
          >
            <div class="flex items-center justify-between text-xs">
              <span class="text-purple-200">↗ Links</span>
              <span class="text-white font-semibold">${linkPct}% <span class="text-zinc-400 font-normal">(${formatVisitorCount(node.linkVis)})</span></span>
            </div>
            <div class="sankey-bar-track w-full h-1.5 rounded-full bg-zinc-950 overflow-hidden">
              <div class="sankey-bar-fill h-full bg-purple-400 rounded-full" data-bar-rgb="rgb(192, 132, 252)" style="width: ${linkPct}%"></div>
            </div>
          </div>
        </div>
      `;

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
          class="sankey-node sankey-card relative z-30 overflow-hidden rounded-xl bg-zinc-900/95 border border-zinc-700/90 px-3 py-2.5 flex flex-col font-mono text-xs shrink-0 shadow-lg hover:border-zinc-400 transition-colors ${cursorClass}"
        >
          <!-- Above Divider: Emoji/Thumb + Title & URL Path + Views Badge -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              ${renderMediaBox(node, 'w-8 h-8')}
              <div class="min-w-0 leading-tight">
                <div class="font-bold text-white truncate">${escapeHtml(node.title)}</div>
                <div class="text-zinc-400 truncate mt-0.5">${escapeHtml(node.path)}</div>
              </div>
            </div>
            <span class="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-600 text-white font-bold shrink-0">${pctStr}</span>
          </div>

          <!-- Below Divider: Local 100% Flow Split Bar + File & Link Conversion Bars -->
          <div class="pt-2 mt-2 border-t border-zinc-700/80 space-y-2">
            ${flowSplitBarHtml}
            ${actionsBarsHtml}
          </div>
        </div>
      `;
    };

    const sideColWidth = density === 'compact' ? 'w-[295px]' : 'w-[355px]';

    const columnsHtml = columns
      .map((col) => {
        const widthClass = col.isCenter ? 'w-[420px]' : sideColWidth;
        const stripe = getColumnStripeBg(col.colIndex);

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
                  class="sankey-empty-col p-3.5 rounded-xl bg-zinc-900/60 border border-dashed border-zinc-700 text-center font-mono text-xs text-zinc-400"
                  data-empty-title="No recorded upstream steps at level ${col.colIndex}"
                  data-empty-sub="Session entries are shown inside the page card"
                >
                  <div class="font-bold text-zinc-300 mb-1">No recorded upstream steps at level ${col.colIndex}</div>
                  <div class="text-[10px] leading-relaxed">Session entries are shown directly inside the page card.</div>
                </div>
              `
              : `
                <div
                  class="sankey-empty-col p-3.5 rounded-xl bg-zinc-900/60 border border-dashed border-zinc-700 text-center font-mono text-xs text-zinc-400"
                  data-empty-title="No recorded downstream steps at level +${col.colIndex}"
                  data-empty-sub="Bounces and exits are shown inside the page card"
                >
                  <div class="font-bold text-zinc-300 mb-1">No recorded downstream steps at level +${col.colIndex}</div>
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
            <div
              class="text-xs font-mono uppercase tracking-wider ${stripe.headerColor} mb-2.5 text-center shrink-0 truncate"
              data-sankey-col-header="${escapeHtml(col.header)}"
              title="${escapeHtml(col.header)}"
            >
              ${escapeHtml(col.header)}
            </div>

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
                  class="pointer-events-auto px-2.5 py-0.5 rounded-full bg-zinc-800/95 hover:bg-zinc-700 border border-emerald-400/70 text-emerald-200 font-mono text-xs font-bold shadow-lg cursor-pointer"
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
                  class="pointer-events-auto px-2.5 py-0.5 rounded-full bg-zinc-800/95 hover:bg-zinc-700 border border-emerald-400/70 text-emerald-200 font-mono text-xs font-bold shadow-lg cursor-pointer"
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
      <div class="relative w-full h-full overflow-hidden bg-zinc-950 select-none">
        <!-- LEFT HORIZONTAL SCROLL INDICATOR -->
        <div
          data-horiz-ind="left"
          class="hidden absolute left-0 top-0 bottom-0 w-20 z-40 pointer-events-none flex items-center justify-start pl-3 bg-gradient-to-r from-zinc-950 via-zinc-950/80 to-transparent"
        >
          <button
            type="button"
            data-horiz-scroll-dir="-1"
            class="pointer-events-auto px-2.5 py-2 rounded-xl bg-zinc-800/95 hover:bg-zinc-700 border border-emerald-400/70 text-emerald-200 font-mono text-xs font-bold shadow-xl flex items-center gap-1.5 cursor-pointer"
          >
            <span>◀</span>
            <span data-horiz-ind-label="left">+1 col</span>
          </button>
        </div>

        <!-- RIGHT HORIZONTAL SCROLL INDICATOR -->
        <div
          data-horiz-ind="right"
          class="hidden absolute right-0 top-0 bottom-0 w-20 z-40 pointer-events-none flex items-center justify-end pr-3 bg-gradient-to-l from-zinc-950 via-zinc-950/80 to-transparent"
        >
          <button
            type="button"
            data-horiz-scroll-dir="1"
            class="pointer-events-auto px-2.5 py-2 rounded-xl bg-zinc-800/95 hover:bg-zinc-700 border border-emerald-400/70 text-emerald-200 font-mono text-xs font-bold shadow-xl flex items-center gap-1.5 cursor-pointer"
          >
            <span data-horiz-ind-label="right">+1 col</span>
            <span>▶</span>
          </button>
        </div>

        <!-- Horizontal Scroll Container (Full-bleed borderless column stripes) -->
        <div
          data-sankey-scroll-viewport="true"
          class="sankey-no-scrollbar w-full h-full overflow-x-auto overflow-y-hidden scroll-smooth"
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

    const applyStageHorizontalPadding = (vpW: number): void => {
      if (!stageEl || vpW <= 0) return;
      const centerW = 420;
      const sideW = density === 'compact' ? 295 : 355;
      const leftColsW = leftLevels * sideW;
      const rightColsW = rightLevels * sideW;
      const padLeft = Math.max(0, Math.round(vpW / 2 - leftColsW - centerW / 2));
      const padRight = Math.max(0, Math.round(vpW / 2 - rightColsW - centerW / 2));
      stageEl.style.paddingLeft = `${padLeft}px`;
      stageEl.style.paddingRight = `${padRight}px`;
    };

    const syncUserCenterOffsetFromVpMid = (): void => {
      if (!scrollViewportEl || scrollViewportEl.clientWidth <= 0) return;
      const centerColEl = container.querySelector<HTMLElement>('[data-sankey-col="0"]');
      if (!centerColEl) return;
      const cRect = centerColEl.getBoundingClientRect();
      const vpRect = scrollViewportEl.getBoundingClientRect();
      userCenterOffsetFromVpMid =
        cRect.left + cRect.width / 2 - (vpRect.left + vpRect.width / 2);
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

      colEls.forEach((col) => {
        const r = col.getBoundingClientRect();
        if (r.left < vpRect.left - 20) hiddenLeft++;
        if (r.right > vpRect.right + 20) hiddenRight++;
      });

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

      const totalRootVisitors = Math.max(1, flow.totalVisitors);
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
      'scroll',
      () => {
        syncUserCenterOffsetFromVpMid();
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
          const dir = Number(btn.getAttribute('data-horiz-scroll-dir') || 1);
          scrollViewportEl?.scrollBy({ left: dir * 350, behavior: 'smooth' });
        });
      });

    //Deterministic 2x Canvas PNG Exporter (Taint-Free)
    const copySankeyPngToClipboard = async (): Promise<void> => {
      if (!stageEl) return;
      layoutRibbons();

      const stageW = stageEl.offsetWidth;
      const stageH = stageEl.offsetHeight;
      const stageRect = stageEl.getBoundingClientRect();
      if (stageW <= 0 || stageH <= 0 || stageRect.width <= 0) return;

      const toLocal = (el: Element): { x: number; y: number; w: number; h: number } => {
        const r = el.getBoundingClientRect();
        return {
          x: r.left - stageRect.left,
          y: r.top - stageRect.top,
          w: r.width,
          h: r.height,
        };
      };

      const PAD_X = 24;
      const PAD_TOP = 54;
      const PAD_BOT = 24;
      const logicalW = stageW + PAD_X * 2;
      const logicalH = stageH + PAD_TOP + PAD_BOT;

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(logicalW * 2);
      canvas.height = Math.round(logicalH * 2);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(2, 2);
      const fontStack = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

      // 1. Outer dark background
      drawRoundedRectPath(ctx, 0, 0, logicalW, logicalH, 14);
      ctx.fillStyle = 'rgb(9, 9, 11)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(82, 82, 91, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 2. Title header
      ctx.fillStyle = 'rgb(244, 244, 245)';
      ctx.font = `bold 13px ${fontStack}`;
      ctx.textBaseline = 'middle';
      const uniqueVisCount =
        flow.uniqueVisitors ?? context?.visitors ?? flow.totalVisitors;
      ctx.fillText(
        `Visitor Flow Cockpit — ${normCurrent} (${period} · ${flow.totalVisitors} Views · ${uniqueVisCount} Visitors)`,
        PAD_X,
        26
      );

      ctx.save();
      ctx.translate(PAD_X, PAD_TOP);

      // 3. Draw full-bleed column background stripes
      for (const colEl of colEls) {
        const cb = toLocal(colEl);
        const bg = colEl.getAttribute('data-col-bg') || 'rgb(24, 24, 28)';
        ctx.fillStyle = bg;
        ctx.fillRect(cb.x, cb.y, cb.w, cb.h);
      }

      // 4. Draw column headers
      const colHeaderEls = Array.from(
        stageEl.querySelectorAll<HTMLElement>('[data-sankey-col-header]')
      );
      for (const hEl of colHeaderEls) {
        const box = toLocal(hEl);
        const text = (hEl.getAttribute('data-sankey-col-header') || '').toUpperCase();
        ctx.font = `bold 11px ${fontStack}`;
        ctx.fillStyle = 'rgb(228, 228, 231)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(truncateCanvasText(ctx, text, box.w), box.x + box.w / 2, box.y + box.h / 2);
      }
      ctx.textAlign = 'left';

      // 5. Draw SVG ribbons via Path2D
      if (typeof Path2D !== 'undefined') {
        for (const rEl of ribbonEls) {
          const d = rEl.getAttribute('d') || '';
          const fill = rEl.getAttribute('fill') || 'rgba(16, 185, 129, 0.42)';
          if (d && d !== 'M 0 0') {
            const p2d = new Path2D(d);
            ctx.fillStyle = fill;
            ctx.fill(p2d);
          }
        }
      }

      // 6. Draw Page Cards (Neutral borders, no left-edge stripe)
      for (const nEl of nodeEls) {
        const nb = toLocal(nEl);
        const isCenter = nEl.getAttribute('data-sankey-center') === 'true';
        const title = nEl.getAttribute('data-node-title') || '';
        const pathStr = nEl.getAttribute('data-node-path') || '';
        const badge = nEl.getAttribute('data-node-badge') || '';

        drawRoundedRectPath(ctx, nb.x, nb.y, nb.w, nb.h, isCenter ? 16 : 12);
        ctx.fillStyle = 'rgba(24, 24, 27, 0.96)';
        ctx.fill();
        ctx.strokeStyle = isCenter ? 'rgba(113, 113, 122, 0.9)' : 'rgba(63, 63, 70, 0.9)';
        ctx.lineWidth = 1.25;
        ctx.stroke();

        ctx.font = `bold 11px ${fontStack}`;
        ctx.fillStyle = 'rgb(255, 255, 255)';
        ctx.textBaseline = 'top';
        ctx.fillText(truncateCanvasText(ctx, title, nb.w - 110), nb.x + 48, nb.y + 12);

        if (density === 'detailed' || isCenter) {
          ctx.font = `9.5px ${fontStack}`;
          ctx.fillStyle = 'rgb(161, 161, 170)';
          ctx.fillText(truncateCanvasText(ctx, pathStr, nb.w - 110), nb.x + 48, nb.y + 27);
        }

        ctx.font = `bold 10px ${fontStack}`;
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgb(244, 244, 245)';
        ctx.fillText(badge, nb.x + nb.w - 12, nb.y + 14);
        ctx.textAlign = 'left';

        // Draw progress & split bar tracks and fills inside card
        const tracks = Array.from(nEl.querySelectorAll<HTMLElement>('.sankey-bar-track'));
        for (const trEl of tracks) {
          const tb = toLocal(trEl);
          drawRoundedRectPath(ctx, tb.x, tb.y, tb.w, tb.h, tb.h / 2);
          ctx.fillStyle = 'rgb(9, 9, 11)';
          ctx.fill();
        }

        const fills = Array.from(nEl.querySelectorAll<HTMLElement>('.sankey-bar-fill'));
        for (const flEl of fills) {
          const fb = toLocal(flEl);
          if (fb.w <= 0.5) continue;
          const barRgb = flEl.getAttribute('data-bar-rgb') || 'rgb(52, 211, 153)';
          drawRoundedRectPath(ctx, fb.x, fb.y, fb.w, fb.h, fb.h / 2);
          ctx.fillStyle = barRgb;
          ctx.fill();
        }
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

      const levelBtn = target.closest<HTMLButtonElement>('[data-sankey-level-side]');
      if (levelBtn) {
        e.preventDefault();
        e.stopPropagation();
        const side = levelBtn.getAttribute('data-sankey-level-side');
        const step = Number(levelBtn.getAttribute('data-sankey-level-step') || 0);
        if (side === 'left') {
          const next = clampLevel(leftLevels + step);
          if (next !== leftLevels) {
            leftLevels = next;
            setStoredLevel(LEFT_LEVELS_STORAGE_KEY, leftLevels);
            renderStageDom();
          }
        } else if (side === 'right') {
          const next = clampLevel(rightLevels + step);
          if (next !== rightLevels) {
            rightLevels = next;
            setStoredLevel(RIGHT_LEVELS_STORAGE_KEY, rightLevels);
            renderStageDom();
          }
        }
        return;
      }

      const densityBtn = target.closest<HTMLButtonElement>('[data-sankey-density]');
      if (densityBtn) {
        e.preventDefault();
        e.stopPropagation();
        const nextMode = densityBtn.getAttribute('data-sankey-density') as SankeyCardDensity | null;
        if ((nextMode === 'compact' || nextMode === 'detailed') && nextMode !== density) {
          density = nextMode;
          setStoredDensity(density);
          renderStageDom();
        }
        return;
      }

      const copyBtn = target.closest<HTMLButtonElement>('[data-sankey-copy-png]');
      if (copyBtn) {
        e.preventDefault();
        e.stopPropagation();
        const labelSpan = copyBtn.querySelector<HTMLElement>('[data-copy-png-label]') ?? copyBtn;
        labelSpan.textContent = '⏳ Rendering...';
        void (async () => {
          try {
            await copySankeyPngToClipboard();
            labelSpan.textContent = '✓ PNG Copied!';
            copyBtn.classList.add('text-emerald-300', 'border-emerald-400');
            setTimeout(() => {
              labelSpan.textContent = 'Copy PNG';
              copyBtn.classList.remove('text-emerald-300', 'border-emerald-400');
            }, 2000);
          } catch {
            labelSpan.textContent = '⚠️ Copy Failed';
            setTimeout(() => {
              labelSpan.textContent = 'Copy PNG';
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
      if (!scrollViewportEl) return;
      const vpW = scrollViewportEl.clientWidth;
      if (vpW <= 0) return;

      applyStageHorizontalPadding(vpW);
      lastObservedViewportWidth = vpW;

      const centerColEl = container.querySelector<HTMLElement>('[data-sankey-col="0"]');
      if (!centerColEl) return;

      const prevBehavior = scrollViewportEl.style.scrollBehavior;
      scrollViewportEl.style.scrollBehavior = 'auto';

      if (!shouldCenterStage && prevCenterScreenX !== null) {
        const newCenterScreenX = centerColEl.getBoundingClientRect().left;
        const deltaX = newCenterScreenX - prevCenterScreenX;
        if (Math.abs(deltaX) > 0.5) {
          scrollViewportEl.scrollLeft = Math.max(0, Math.round(scrollViewportEl.scrollLeft + deltaX));
        }
      } else {
        const colLeft = centerColEl.offsetLeft;
        const colW = centerColEl.offsetWidth;
        if (scrollViewportEl.scrollWidth > vpW) {
          scrollViewportEl.scrollLeft = Math.max(0, Math.round(colLeft - (vpW - colW) / 2));
        } else {
          scrollViewportEl.scrollLeft = 0;
        }
        shouldCenterStage = false;
      }

      scrollViewportEl.style.scrollBehavior = prevBehavior;
      syncUserCenterOffsetFromVpMid();
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
            const hadPrevWidth = lastObservedViewportWidth > 0;
            lastObservedViewportWidth = newVpW;
            applyStageHorizontalPadding(newVpW);

            const centerColEl = container.querySelector<HTMLElement>('[data-sankey-col="0"]');
            if (centerColEl) {
              const prevBehavior = scrollViewportEl.style.scrollBehavior;
              scrollViewportEl.style.scrollBehavior = 'auto';
              const colLeft = centerColEl.offsetLeft;
              const colW = centerColEl.offsetWidth;
              const targetOffset = hadPrevWidth ? userCenterOffsetFromVpMid : 0;
              const targetScrollLeft = Math.round(
                colLeft + colW / 2 - (newVpW / 2 + targetOffset)
              );
              scrollViewportEl.scrollLeft = Math.max(0, targetScrollLeft);
              scrollViewportEl.style.scrollBehavior = prevBehavior;
              syncUserCenterOffsetFromVpMid();
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
