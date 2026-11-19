import {
  createAdaptiveHexMeshStrategy,
  createFinalSeededClusteringStrategy,
  createFinalSeededLayoutStrategy,
  createIncrementalAnchorClusteringStrategy,
  createPaletteColorStrategy,
  createSemanticZoomStrategy,
  createSimplexSvg,
  createWarmStartPbdLayoutStrategy,
  type GeometricShapeSvgViewOptions,
  type SimplexSvgController,
  type SimplexTheme,
  type SimplexVisualPreset,
  type SimplexZoomStrategy,
} from '@simplex-viz/svg';
import type {
  TimelineAdapter,
  TimelinePoint,
  TimelineSnapshot,
} from '@commons/client/graph-timeline-controller';
import {
  createGraphTooltipController,
  type GraphTooltipController,
} from '@commons/client/vis-tooltip';
import { getThemeTokens } from '@commons/shared/domain-themes';
import {
  CLUSTER_PALETTE,
  DEFAULT_TOPIC_CLUSTER_COUNT,
  GRAPH_COLORS,
  HOP_ATTENUATION_CONFIG,
  getActiveContentFilterGroups,
  getAttenuatedNodeScale,
  getContentGroupPolygonSides,
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
const DOMAIN_NODE_RADIUS = 7.5;
const DOMAIN_NODE_STROKE_WIDTH = 1.4;
const DEFER_LAYOUT_FALLBACK_TIMEOUT_MS = 1500;

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

const ACRONYM_WORDS = new Set([
  'ai',
  'ui',
  'ux',
  '3d',
  '2d',
  'api',
  'sdk',
  'svg',
  'iot',
  'llm',
  'rag',
  'mcp',
  'seo',
  'geo',
  'aeo',
  'aio',
  'cad',
  'hci',
]);

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
  return primarySegment.includes('-') && !primarySegment.includes(' ')
    ? formatTagLabel(primarySegment)
    : primarySegment;
}

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

function applyDomainThemeTokens(container: HTMLElement, isLight: boolean): void {
  const domainColors = isLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;
  const visAccent = domainColors[8] ?? domainColors[0];
  container.style.backgroundColor = getThemeTokens(isLight).canvasBg;
  container.style.setProperty('--simplex-domain-accent', visAccent);
}

function resolveShapeOptions(isLight: boolean): GeometricShapeSvgViewOptions {
  const theme = getThemeTokens(isLight);
  const domainColors = isLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;
  const visAccent = domainColors[8] ?? domainColors[0];
  return {
    hoverScale: getAttenuatedNodeScale(1),
    hoverRingColor: visAccent,
    dimmedOpacity: HOP_ATTENUATION_CONFIG.nodeColor.min,
    strokeColor: theme.canvasBg,
    strokeWidth: DOMAIN_NODE_STROKE_WIDTH,
  };
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
    applyDomainThemeTokens(container, currentIsLight);

    const tooltipController: GraphTooltipController = createGraphTooltipController(container);
    let isContentHovered = false;

    const onPointerLeaveContainer = () => {
      isContentHovered = false;
      tooltipController.hide();
    };
    container.addEventListener('pointerleave', onPointerLeaveContainer, { passive: true });

    const onPointerMoveTooltip = (ev: PointerEvent) => {
      if (!isContentHovered) return;
      const rect = container.getBoundingClientRect();
      tooltipController.move(ev.clientX - rect.left, ev.clientY - rect.top);
    };
    container.addEventListener('pointermove', onPointerMoveTooltip, { passive: true });

    const initialTheme: SimplexTheme = currentIsLight ? 'light' : 'dark';
    const initialPreset = resolvePreset();

    let controller: SimplexSvgController<GraphNodePayload> | null =
      createSimplexSvg<GraphNodePayload>(container, {
        items: allItems,
        getId: (item) => item.id,
        getTags: (item) => item.tags ?? [],
        getLabel: (item) => item.name,
        formatTagLabel,
        preset: initialPreset,
        theme: initialTheme,
        badgeOptions: {
          showCode: false,
          maxTitleChars: MAX_CLUSTER_LABEL_CHARS,
          formatTitle: (title) => formatClusterTitle(title),
        },
        getShape: (item) => ({
          sides: getContentGroupPolygonSides(item.group),
          radius: DOMAIN_NODE_RADIUS,
        }),
        shapeOptions: resolveShapeOptions(currentIsLight),
        meshStrategy: createAdaptiveHexMeshStrategy(),
        clusteringStrategy: createFinalSeededClusteringStrategy(
          createIncrementalAnchorClusteringStrategy<GraphNodePayload>(),
          { seedItems: allItems }
        ),
        colorStrategy: createPaletteColorStrategy<GraphNodePayload>(
          getClusterSpectrum(currentIsLight),
          { mode: 'edge-contrast' }
        ),
        layoutStrategy: createFinalSeededLayoutStrategy(
          createWarmStartPbdLayoutStrategy(),
          { scaleMode: 'adaptive' }
        ),
        layoutOptions: {
          itemGapPx: 2.5,
          clusterGapPx: 10,
        },
        emptyClusterBehavior: 'dim',
        relayoutOnFontLoad: true,
        deferInitialLayout: {
          fallbackTimeoutMs: DEFER_LAYOUT_FALLBACK_TIMEOUT_MS,
        },
        touchScrollLockPx: TOUCH_DIRECTION_THRESHOLD_PX,
        clickTolerancePx: DRAG_VS_CLICK_THRESHOLD_PX,
        zoomStrategy: resolveZoomStrategy(),
        showZoomBreadcrumbs: true,
        tooltip: false,
        interactions: {
          onContentHover: (ev) => {
            if (ev) {
              isContentHovered = true;
              tooltipController.show(
                ev.item,
                currentIsLight,
                ev.screenPosition.x,
                ev.screenPosition.y
              );
            } else {
              isContentHovered = false;
              tooltipController.hide();
            }
          },
          onClusterHover: (ev) => {
            if (ev) {
              isContentHovered = false;
              tooltipController.hide();
            }
          },
          onTriangleHover: (ev) => {
            if (ev) {
              isContentHovered = false;
              tooltipController.hide();
            }
          },
          onContentClick: (target) => {
            if (target.item.id.startsWith('/')) {
              window.location.href = buildItemTargetUrl(target.item.id, extraOptions);
              return true;
            }
            return false;
          },
        },
      });

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
          controller.setShapeOptions(resolveShapeOptions(currentIsLight));
          controller.setColorStrategy(
            createPaletteColorStrategy<GraphNodePayload>(
              getClusterSpectrum(currentIsLight),
              { mode: 'edge-contrast' }
            )
          );
        }

        if (layoutChanged) {
          controller.setPreset(resolvePreset(), (item) => item.name);
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
        container.removeEventListener('pointermove', onPointerMoveTooltip);
        container.removeEventListener('pointerleave', onPointerLeaveContainer);
        tooltipController.destroy();
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
