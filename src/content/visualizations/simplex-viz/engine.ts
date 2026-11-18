import {
  BadgeClusterSvgView,
  createAdaptiveHexMeshStrategy,
  createIncrementalAnchorClusteringStrategy,
  createLocalAdaptiveLayoutStrategy,
  createPaletteColorStrategy,
  createSemanticZoomStrategy,
  createSimplexSvg,
  type BadgeClusterVisual,
  type ClusteringStrategyContext,
  type ClusteringStrategyOutput,
  type SimplexClusteringStrategy,
  type SimplexSvgController,
  type SimplexTheme,
  type SimplexVisualPreset,
  type SimplexZoomStrategy,
  type SvgNodeView,
} from '@simplex-viz/svg';
import type {
  TimelineAdapter,
  TimelinePoint,
  TimelineSnapshot,
} from '@commons/client/graph-timeline-controller';
import { getThemeTokens } from '@commons/shared/domain-themes';
import {
  CLUSTER_PALETTE,
  DEFAULT_TOPIC_CLUSTER_COUNT,
  GRAPH_COLORS,
  getActiveContentFilterGroups,
  type CanonicalGraphPayload,
  type EnginePayloads,
  type GraphNodePayload,
} from '@commons/shared/graph-payload';

export interface SimplexVizInstance {
  layouts: { id: string; label: string }[];
  currentLayout: string;
  isLight: boolean;
  controller: SimplexSvgController<GraphNodePayload> | null;
  timelineAdapter: TimelineAdapter;
  updateLayout(layout: string, isLight: boolean): void;
  applyTuning(category: 'physics' | 'geometry' | 'visual' | 'reset'): void;
  destroy(): void;
}

const LAYOUTS = [
  { id: 'badges', label: 'Simplex Mesh' },
];

const TOUCH_DIRECTION_THRESHOLD_PX = 8;
const DRAG_VS_CLICK_THRESHOLD_PX = 12;
const MAX_CLUSTER_LABEL_CHARS = 20;

const TAG_DISPLAY_ALIASES: Record<string, string> = {
  'human-computer-interaction': 'HCI',
  'software-architecture': 'Architecture',
  'data-visualization': 'Data Viz',
  'systems-engineering': 'Systems Eng.',
  'manufacturing-engineering': 'Manufacturing',
  'transportation-systems': 'Transport',
  'knowledge-graphs': 'Knowledge Graphs',
  'industrial-informatics': 'Ind. Informatics',
  'computer-graphics': 'Graphics',
  'content-engineering': 'Content Eng.',
  'web-development': 'Web Dev',
  'software-engineering': 'Software Eng.',
  'youtube-video': 'YouTube',
  'user-interface': 'UI',
  'systems-analysis': 'Systems',
  'ux-design': 'UX',
  threejs: 'Three.js',
  webgl: 'WebGL',
  aio: 'AIO',
  geo: 'GEO',
  aeo: 'AEO',
  seo: 'SEO',
  ai: 'AI',
  iot: 'IoT',
  llm: 'LLM',
  rag: 'RAG',
  mcp: 'MCP',
  cad: 'CAD',
  gpgpu: 'GPGPU',
  webgpu: 'WebGL/GPU',
  'web-llm': 'WebLLM',
  'local-ai': 'Local AI',
  'agentic-ai': 'Agentic AI',
  'generative-ai': 'Gen AI',
  'enterprise-ai': 'Enterprise AI',
  'artificial-intelligence': 'AI',
  'machine-learning': 'ML',
};

const ACRONYM_WORDS = new Set(['ai', 'ui', 'ux', '3d', '2d', 'api', 'sdk', 'svg', 'iot', 'llm', 'rag', 'mcp', 'seo', 'geo', 'aeo', 'aio', 'cad', 'hci']);

function formatTagLabel(rawTag: string): string {
  const normalized = rawTag.trim().toLowerCase();
  if (TAG_DISPLAY_ALIASES[normalized]) {
    return TAG_DISPLAY_ALIASES[normalized];
  }
  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => {
      if (ACRONYM_WORDS.has(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function formatClusterTitle(rawTitle: string): string {
  const trimmed = rawTitle.trim();
  if (!trimmed) return trimmed;
  // Normalize slash/dot/bullet-separated multi-tag cluster labels if present
  const primarySegment = trimmed.split(/\s*[·•|/]\s*/)[0]?.trim() || trimmed;
  const formatted = primarySegment.includes('-') && !primarySegment.includes(' ')
    ? formatTagLabel(primarySegment)
    : primarySegment;
  if (formatted.length <= MAX_CLUSTER_LABEL_CHARS) {
    return formatted;
  }
  const words = formatted.split(/\s+/);
  if (words.length >= 2) {
    const twoWords = `${words[0]} ${words[1]}`;
    if (twoWords.length <= MAX_CLUSTER_LABEL_CHARS) {
      return twoWords;
    }
  }
  return `${formatted.slice(0, MAX_CLUSTER_LABEL_CHARS - 1).trimEnd()}…`;
}

const baseBadgeClusterView = new BadgeClusterSvgView();

const ReadableBadgeClusterSvgView: SvgNodeView<BadgeClusterVisual> = {
  mountOrUpdate(groupEl, visual, state) {
    const cleanTitle = formatClusterTitle(visual.title);
    const cleanParent = visual.parentContextLabel
      ? formatClusterTitle(visual.parentContextLabel)
      : undefined;

    baseBadgeClusterView.mountOrUpdate(
      groupEl,
      {
        ...visual,
        code: '',
        title: cleanTitle,
        parentContextLabel: cleanParent,
      },
      state
    );

    // For primary capsule badges, omit the empty T1-T13 code slot and center the title cleanly
    if (visual.variant !== 'intermediate') {
      const textEls = Array.from(groupEl.querySelectorAll('text'));
      const codeEl = textEls.find((el) => (el.textContent ?? '').trim() === '');
      if (codeEl) {
        codeEl.remove();
      }
      const titleEl = textEls.find((el) => (el.textContent ?? '').trim() === cleanTitle);
      if (titleEl) {
        titleEl.setAttribute('x', '0');
        titleEl.setAttribute('text-anchor', 'middle');
      }
    }
  },
};

function resolvePreset(): SimplexVisualPreset {
  return 'badges';
}

function resolveZoomStrategy(): SimplexZoomStrategy<GraphNodePayload> {
  return createSemanticZoomStrategy({
    clusterZoomMode: 'incident-star',
    fullScaleThreshold: 0.65,
    leafTriangleFocus: true,
  });
}

function getClusterSpectrum(isLight: boolean): readonly string[] {
  return isLight ? CLUSTER_PALETTE.light : CLUSTER_PALETTE.dark;
}

function createFinalSeededClusteringStrategy(
  allItems: readonly GraphNodePayload[]
): SimplexClusteringStrategy<GraphNodePayload> {
  const baseStrategy = createIncrementalAnchorClusteringStrategy<GraphNodePayload>();
  let finalClustering: ClusteringStrategyOutput<GraphNodePayload> | null = null;
  let cachedMeshWidth = 0;
  let cachedMeshHeight = 0;

  const projectForActiveItems = (
    ctx: ClusteringStrategyContext<GraphNodePayload>
  ): ClusteringStrategyOutput<GraphNodePayload> => {
    const meshMatches =
      finalClustering !== null &&
      Math.abs(ctx.mesh.width - cachedMeshWidth) < 1 &&
      Math.abs(ctx.mesh.height - cachedMeshHeight) < 1;

    if (finalClustering && meshMatches && ctx.items.length === allItems.length) {
      return finalClustering;
    }

    if (!finalClustering || !meshMatches) {
      if (ctx.items.length === allItems.length) {
        const computed = baseStrategy.initialize(ctx);
        finalClustering = computed;
        cachedMeshWidth = ctx.mesh.width;
        cachedMeshHeight = ctx.mesh.height;
        return computed;
      }
      return baseStrategy.update ? baseStrategy.update(ctx) : baseStrategy.initialize(ctx);
    }

    const activeIds = new Set(ctx.items.map((item) => item.id));
    const filteredItems = finalClustering.items.filter((item) => activeIds.has(item.id));
    const filteredClusters = finalClustering.clusters.map((cluster) => ({
      ...cluster,
      members: cluster.members.filter((m) => activeIds.has(m.itemId)),
      representativeItems: cluster.representativeItems?.filter((m) => activeIds.has(m.itemId)),
    }));

    return {
      clusters: filteredClusters,
      items: filteredItems,
      uniqueTags: finalClustering.uniqueTags,
      preservedColors: finalClustering.preservedColors,
    };
  };

  return {
    name: `final-seeded(${baseStrategy.name})`,
    requiresTags: baseStrategy.requiresTags,
    estimateClusterCount(ctx) {
      if (finalClustering && ctx.items.length < allItems.length) {
        return finalClustering.clusters.length;
      }
      return baseStrategy.estimateClusterCount?.(ctx);
    },
    initialize(ctx) {
      return projectForActiveItems(ctx);
    },
    update(ctx) {
      return projectForActiveItems(ctx);
    },
  };
}

function applyDomainThemeTokens(container: HTMLElement, isLight: boolean): void {
  const domainColors = isLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;
  const visAccent = domainColors[8] ?? domainColors[0];
  container.style.backgroundColor = getThemeTokens(isLight).canvasBg;
  container.style.setProperty('--simplex-domain-accent', visAccent);
}

function extractContentItems(canonical?: CanonicalGraphPayload): GraphNodePayload[] {
  if (!canonical?.nodes) return [];
  return canonical.nodes.filter(
    (node) => node.group !== 0 && Array.isArray(node.tags) && node.tags.length > 0
  );
}

function buildItemTargetUrl(itemId: string, extraOptions?: Record<string, string>): string {
  const isInternalPath = itemId.startsWith('/');
  if (!isInternalPath || !extraOptions) return itemId;
  const params = new URLSearchParams();
  if (extraOptions.utmSource) params.set('utm_source', extraOptions.utmSource);
  if (extraOptions.utmMedium) params.set('utm_medium', extraOptions.utmMedium);
  if (extraOptions.utmCampaign) params.set('utm_campaign', extraOptions.utmCampaign);
  const query = params.toString();
  if (!query) return itemId;
  return itemId.includes('?') ? `${itemId}&${query}` : `${itemId}?${query}`;
}

export default {
  layouts: LAYOUTS,

  async init(
    container: HTMLElement,
    payload: EnginePayloads,
    layout: string,
    isLight: boolean,
    extraOptions?: Record<string, string>
  ): Promise<SimplexVizInstance> {
    let currentLayout = LAYOUTS.some((l) => l.id === layout) ? layout : LAYOUTS[0].id;
    let currentIsLight = isLight;

    const allItems = extractContentItems(payload.canonical);

    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.touchAction = 'pan-y';
    applyDomainThemeTokens(container, currentIsLight);

    // 12px drag-vs-click disambiguation state
    let pointerDownX = 0;
    let pointerDownY = 0;
    let maxPointerDisplacement = 0;
    let pointerTracking = false;

    const onPointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0 && ev.pointerType === 'mouse') return;
      pointerDownX = ev.clientX;
      pointerDownY = ev.clientY;
      maxPointerDisplacement = 0;
      pointerTracking = true;
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (!pointerTracking) return;
      const dist = Math.hypot(ev.clientX - pointerDownX, ev.clientY - pointerDownY);
      if (dist > maxPointerDisplacement) {
        maxPointerDisplacement = dist;
      }
    };

    const onPointerEnd = () => {
      pointerTracking = false;
    };

    // 8px touch direction-locking contract
    let touchStartX = 0;
    let touchStartY = 0;
    let lockedTouchAxis: 'horizontal' | 'vertical' | null = null;

    const onTouchStart = (ev: TouchEvent) => {
      if (ev.touches.length !== 1) {
        lockedTouchAxis = null;
        return;
      }
      touchStartX = ev.touches[0].clientX;
      touchStartY = ev.touches[0].clientY;
      lockedTouchAxis = null;
    };

    const onTouchMove = (ev: TouchEvent) => {
      if (ev.touches.length !== 1) return;
      const dx = Math.abs(ev.touches[0].clientX - touchStartX);
      const dy = Math.abs(ev.touches[0].clientY - touchStartY);

      if (lockedTouchAxis === null && Math.max(dx, dy) >= TOUCH_DIRECTION_THRESHOLD_PX) {
        lockedTouchAxis = dy > dx ? 'vertical' : 'horizontal';
      }

      if (lockedTouchAxis === 'horizontal' && ev.cancelable) {
        ev.preventDefault();
      }
    };

    const onTouchEnd = () => {
      lockedTouchAxis = null;
    };

    container.addEventListener('pointerdown', onPointerDown, { passive: true });
    container.addEventListener('pointermove', onPointerMove, { passive: true });
    container.addEventListener('pointerup', onPointerEnd, { passive: true });
    container.addEventListener('pointercancel', onPointerEnd, { passive: true });
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchEnd, { passive: true });

    if (typeof document !== 'undefined' && document.fonts) {
      await Promise.race([
        document.fonts.ready,
        new Promise<void>((resolve) => setTimeout(resolve, 800)),
      ]);
    }

    const initialTheme: SimplexTheme = currentIsLight ? 'light' : 'dark';
    const initialPreset = resolvePreset();

    let controller: SimplexSvgController<GraphNodePayload> | null = createSimplexSvg<GraphNodePayload>(container, {
      items: allItems,
      getId: (item) => item.id,
      getTags: (item) => (item.tags ?? []).map(formatTagLabel),
      getLabel: (item) => item.name,
      preset: initialPreset,
      clusterView: initialPreset === 'badges' ? ReadableBadgeClusterSvgView : undefined,
      theme: initialTheme,
      meshStrategy: createAdaptiveHexMeshStrategy(),
      clusteringStrategy: createFinalSeededClusteringStrategy(allItems),
      colorStrategy: createPaletteColorStrategy<GraphNodePayload>(
        getClusterSpectrum(currentIsLight),
        { mode: 'edge-contrast' }
      ),
      layoutStrategy: createLocalAdaptiveLayoutStrategy({ warmStart: true }),
      zoomStrategy: resolveZoomStrategy(),
      showZoomBreadcrumbs: true,
      tooltip: (target) => {
        if (target.kind === 'content') {
          const prefix = target.item.typeLabel ? `${target.item.typeLabel}: ` : '';
          return `${prefix}${target.item.name} (${target.layoutContext.tags.length} tags)`;
        }
        if (target.kind === 'cluster') {
          return `${formatClusterTitle(target.cluster.defaultLabel)}: ${target.cluster.members.length} items`;
        }
        return `Simplex #${target.triangle.index + 1} (${target.triangle.coveredItemCount} items)`;
      },
      interactions: {
        onLeftClick: (target) => {
          if (maxPointerDisplacement > DRAG_VS_CLICK_THRESHOLD_PX) {
            return;
          }
          if (target.kind === 'content') {
            if (target.neighborId) {
              controller?.drillToNeighbor(target.neighborId);
            } else if (target.item.id.startsWith('/')) {
              window.location.href = buildItemTargetUrl(target.item.id, extraOptions);
            }
          } else if (target.kind === 'triangle') {
            if (target.triangle.neighborId) {
              controller?.drillToNeighbor(target.triangle.neighborId);
            } else {
              controller?.drillDownTriangle(target.triangle.index);
            }
          } else if (target.kind === 'cluster') {
            if (target.neighborId) {
              controller?.drillToNeighbor(target.neighborId);
            } else {
              controller?.drillDownCluster(target.cluster.clusterUid);
            }
          } else if (target.kind === 'background') {
            controller?.drillUp();
          }
        },
      },
    });

    let onFontsLoadingDone: (() => void) | null = null;
    if (
      typeof document !== 'undefined' &&
      document.fonts &&
      document.fonts.status !== 'loaded'
    ) {
      let fontsRelayoutDone = false;
      onFontsLoadingDone = () => {
        if (fontsRelayoutDone || !controller) return;
        if (document.fonts.status !== 'loaded') return;
        fontsRelayoutDone = true;
        if (onFontsLoadingDone) {
          document.fonts.removeEventListener('loadingdone', onFontsLoadingDone);
          onFontsLoadingDone = null;
        }
        controller.setLayoutStrategy(createLocalAdaptiveLayoutStrategy({ warmStart: true }));
      };
      document.fonts.addEventListener('loadingdone', onFontsLoadingDone);
    }

    const canonical = payload.canonical ?? null;
    let currentNodes: GraphNodePayload[] = canonical?.nodes ? [...canonical.nodes] : [];
    const restPositions = new Map<string, TimelinePoint>();
    for (const node of currentNodes) {
      restPositions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
    }
    let livePositions = new Map<string, TimelinePoint>(restPositions);
    let activeItemIdsKey = allItems.map((item) => item.id).join('\0');

    const applyFilteredItems = (items: GraphNodePayload[]) => {
      if (!controller) return;
      const activeGroups = getActiveContentFilterGroups();
      const effectiveItems =
        activeGroups && activeGroups.size > 0
          ? items.filter((item) => activeGroups.has(item.group))
          : items;
      const finalItems = effectiveItems.length > 0 ? effectiveItems : items;
      const nextKey = finalItems.map((item) => item.id).join('\0');
      if (nextKey === activeItemIdsKey) return;
      activeItemIdsKey = nextKey;
      controller.setItems(finalItems);
    };

    const timelineAdapter: TimelineAdapter = {
      isForceLayout: () => true,
      is3D: () => false,
      getCanonical: () => canonical,
      getKTarget: () => DEFAULT_TOPIC_CLUSTER_COUNT,
      getPhysicsKey: () => 'simplex-viz',
      isDefaultTuning: () => true,
      getCurrentNodes: () => currentNodes,
      getLivePositions: () => livePositions,
      getRestPositions: () => restPositions,
      applySnapshot(snapshot: TimelineSnapshot) {
        currentNodes = snapshot.nodes;
        const snapshotItems = snapshot.nodes.filter(
          (node) => node.group !== 0 && Array.isArray(node.tags) && node.tags.length > 0
        );
        applyFilteredItems(snapshotItems);
      },
      async solveWarm(
        snapshot: TimelineSnapshot,
        seeds: ReadonlyMap<string, TimelinePoint>,
        shouldCancel: () => boolean
      ) {
        if (shouldCancel()) return null;
        const solved = new Map<string, TimelinePoint>();
        for (const node of snapshot.nodes) {
          const seed = seeds.get(node.id);
          solved.set(node.id, {
            x: seed?.x ?? node.x ?? 0,
            y: seed?.y ?? node.y ?? 0,
          });
        }
        return solved;
      },
      playMorph: () => false,
      setNodeFx: () => {},
      setPositions(positions: ReadonlyMap<string, TimelinePoint>) {
        livePositions = new Map(positions);
      },
      finishMorph: () => {},
    };

    const instance: SimplexVizInstance = {
      layouts: LAYOUTS,
      currentLayout,
      isLight: currentIsLight,
      controller,
      timelineAdapter,

      updateLayout(nextLayout: string, nextIsLight: boolean) {
        if (!controller) return;
        const resolvedLayout = LAYOUTS.some((l) => l.id === nextLayout)
          ? nextLayout
          : LAYOUTS[0].id;
        const layoutChanged = resolvedLayout !== currentLayout;
        const themeChanged = nextIsLight !== currentIsLight;

        currentLayout = resolvedLayout;
        currentIsLight = nextIsLight;
        instance.currentLayout = currentLayout;
        instance.isLight = currentIsLight;

        if (themeChanged) {
          applyDomainThemeTokens(container, currentIsLight);
          controller.setTheme(currentIsLight ? 'light' : 'dark');
          controller.setColorStrategy(
            createPaletteColorStrategy<GraphNodePayload>(
              getClusterSpectrum(currentIsLight),
              { mode: 'edge-contrast' }
            )
          );
        }

        if (layoutChanged) {
          const nextPreset = resolvePreset();
          controller.setPreset(nextPreset, (item) => item.name);
          if (nextPreset === 'badges') {
            controller.setViews({ clusterView: ReadableBadgeClusterSvgView });
          }
          controller.setZoomStrategy(resolveZoomStrategy());
        }
      },

      applyTuning() {
        applyFilteredItems(
          currentNodes.filter(
            (node) => node.group !== 0 && Array.isArray(node.tags) && node.tags.length > 0
          )
        );
      },

      destroy() {
        if (onFontsLoadingDone && typeof document !== 'undefined' && document.fonts) {
          document.fonts.removeEventListener('loadingdone', onFontsLoadingDone);
          onFontsLoadingDone = null;
        }
        container.removeEventListener('pointerdown', onPointerDown);
        container.removeEventListener('pointermove', onPointerMove);
        container.removeEventListener('pointerup', onPointerEnd);
        container.removeEventListener('pointercancel', onPointerEnd);
        container.removeEventListener('touchstart', onTouchStart);
        container.removeEventListener('touchmove', onTouchMove);
        container.removeEventListener('touchend', onTouchEnd);
        container.removeEventListener('touchcancel', onTouchEnd);
        if (controller) {
          controller.destroy();
          controller = null;
          instance.controller = null;
        }
      },
    };

    return instance;
  },
};
