import * as d3 from 'd3';
import {
  DEFAULT_TOPIC_CLUSTER_COUNT,
  GRAPH_COLORS,
  GRAPH_PHYSICS_CONFIG,
  GRAPH_VIEWPORT_CONFIG,
  HIGHLIGHT_TRANSITION_MS,
  blendHexColor,
  buildRegularPolygonSvgPoints,
  easeHighlightTransition,
  formatClusterLabelShort,
  getClusterPillDimensions,
  getEdgeLinkDistance2D,
  getEdgeLinkStrength2D,
  getGraphStyleTokens,
  getGraphTuningState,
  compute2DViewportFit,
  getRadialReferenceBounds2D,
  buildGraphAdjacency,
  computeHopDistances,
  interpolateHexColor,
  getAttenuatedNodeColor,
  getAttenuatedNodeScale,
  getNodeBaseColor,
  getNodeClusterColor,
  getNodeRestRadiusScale,
  getAttenuatedEdgeStyle,
  getRestEdgeStyle,
  getNodeHopZIndex,
  getEdgeHopZIndex,
  reclusterCanonicalGraphPayload,
  resolveClusterPillVisualState,
  createKChangeTransition,
  getKChangeTransitionProgress,
  sampleKChangeClusterLabel,
  sampleKChangeClusterPill,
  sampleKChangeGhostPills,
  sampleKChangeNodeColor,
  sampleKChangeNodePosition,
  type CanonicalGraphPayload,
  type GraphKChangeTransition,
  type GraphNodePayload
} from '@commons/shared/graph-payload';
import { getThemeTokens } from '@commons/shared/domain-themes';
import {
  compute2DGeometryTargets,
  solveD3ForceLayoutAsync,
} from '@commons/shared/graph-solvers';
import {
  createGraphDragPhysicsController2D,
  type GraphDragPhysicsController2D,
} from '@commons/client/graph-drag-controller';
import { createGraphTooltipController, type GraphTooltipController } from '@commons/client/vis-tooltip';

export interface D3Node extends d3.SimulationNodeDatum, GraphNodePayload {
  targetX?: number;
  targetY?: number;
  displayColor?: string;
  displayRadius?: number;
  el?: SVGGElement;
  circleEl?: SVGPolygonElement | SVGCircleElement;
  pillGroupEl?: SVGGElement;
  pillRectEl?: SVGRectElement;
  pillDotEl?: SVGCircleElement;
  pillTextEl?: SVGTextElement;
  pillTitleTspanEl?: SVGTSpanElement;
  pillBadgeGroupEl?: SVGGElement;
  pillBadgeRectEl?: SVGRectElement;
  pillBadgeTextEl?: SVGTextElement;
  activeHopDist?: number;
  activeCoverage?: number;
  pillWidthPx?: number;
  pillGeometryLocked?: boolean;
}

export interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node;
  target: string | D3Node;
  weight?: number;
  coverage?: number;
  displayColor?: string;
  displayWidth?: number;
  el?: SVGLineElement;
  badgeEl?: SVGGElement;
}

export interface D3Payload {
  canonical?: CanonicalGraphPayload;
  d3: {
    nodes: GraphNodePayload[];
    connections: { sourceId: string; targetId: string; weight?: number; coverage?: number }[];
  };
}

export interface D3Engine {
  layouts: { id: string; label: string }[];
  width: number;
  height: number;
  canonicalPayload?: CanonicalGraphPayload | null;
  activeClusterCount?: number;
  nodes: D3Node[] | null;
  links: D3Link[] | null;
  svg: d3.Selection<SVGSVGElement, D3Node, null, undefined> | null;
  svgGroup: d3.Selection<SVGGElement, D3Node, null, undefined> | null;
  zoom: d3.ZoomBehavior<SVGSVGElement, D3Node> | null;
  simulation: d3.Simulation<D3Node, D3Link> | null;
  linkElements: d3.Selection<SVGLineElement, D3Link, SVGGElement, D3Node> | null;
  nodeElements: d3.Selection<SVGGElement, D3Node, SVGGElement, D3Node> | null;
  activeBadgeLinks?: D3Link[];
  rebuildClusterTopology?(targetK: number, opts?: { restoreDefault?: boolean }): void;
  playKTransition?(nextPositions: Map<string, { x: number; y: number }>): boolean;
  finishKTransition?(): void;
  hasPendingKTransition?(): boolean;
  discardPendingKTransition?(): void;
  getWarmSeedPositions?(): ReadonlyMap<string, { x: number; y: number }>;
  tooltipController: GraphTooltipController | null;
  dragController?: GraphDragPhysicsController2D | null;
  hoveredNodeId?: string | null;
  secondaryHoveredNodeId?: string | null;
  draggedNodeId?: string | null;
  focusedNodeIds?: Set<string> | null;
  highlightFrameId?: number | null;
  applyHighlight?(activeId: string | null, immediate?: boolean): void;
  currentLayout?: string;
  isLight?: boolean;
  forcePositions: Map<string, { x: number; y: number }>;
  initialForcePositions: Map<string, { x: number; y: number }>;
  tuningGeneration?: number;
  tuningInFlight?: boolean;
  fitTimeout?: ReturnType<typeof setTimeout>;
  tuningSettleTimeout?: ReturnType<typeof setTimeout>;
  viewportAdaptFrameId?: number | null;
  resizeObserver: ResizeObserver | null;
  init(container: HTMLElement, payload: D3Payload, layout: string, isLight: boolean, extraOptions?: Record<string, string>): Promise<D3Engine>;
  renderPositions(): void;
  applyForceSimulationConfig(): void;
  recomputeSlotTargets(useCurrentOrder?: boolean): void;
  fitToView(duration?: number): void;
  stepViewportTowardCloud(alpha: number): void;
  startViewportAdaptLoop(durationMs?: number, baseAlpha?: number): void;
  updateLayout(layout: string, isLight: boolean, animate?: boolean): void;
  applyTuning(category: 'physics' | 'geometry' | 'visual' | 'reset'): void;
  destroy(): void;
}

const D3_PILL_PAD_X = 9;
const D3_PILL_DOT_R = 3;
const D3_PILL_DOT_GAP = 5;
const D3_PILL_DOT_LEAD_W = D3_PILL_DOT_R * 2 + D3_PILL_DOT_GAP;
const D3_PILL_FONT_FAMILY = 'Inter, system-ui, -apple-system, sans-serif';

interface D3PillDom {
  g: d3.Selection<SVGGElement, undefined, null, undefined>;
  rect: d3.Selection<SVGRectElement, undefined, null, undefined>;
  dot: d3.Selection<SVGCircleElement, undefined, null, undefined>;
  txt: d3.Selection<SVGTextElement, undefined, null, undefined>;
  titleTspan: d3.Selection<SVGTSpanElement, undefined, null, undefined>;
  badgeG: d3.Selection<SVGGElement, undefined, null, undefined>;
  badgeRect: d3.Selection<SVGRectElement, undefined, null, undefined>;
  badgeTxt: d3.Selection<SVGTextElement, undefined, null, undefined>;
}

/** Creates the SVG DOM of a cluster pill (explicit font attributes, geometry synced separately). */
function buildD3ClusterPillDom(
  parentEl: SVGGElement,
  name: string,
  clusterHue: string,
  isLight: boolean,
  canvasBg: string
): D3PillDom {
  const dims = getClusterPillDimensions(name, undefined, false, 1);
  const pillH = dims.pillH;
  const g = d3.select<SVGGElement, undefined>(parentEl).append<SVGGElement>("g")
    .attr("class", "cluster-pill")
    .style("pointer-events", "all")
    .style("opacity", "0.97");
  const rect = g.append<SVGRectElement>("rect")
    .attr("x", -50).attr("y", -pillH / 2).attr("width", 100).attr("height", pillH)
    .attr("rx", 6)
    .style("fill", blendHexColor(clusterHue, canvasBg, 0.13))
    .style("stroke", blendHexColor(clusterHue, canvasBg, 0.72))
    .style("stroke-width", "1.25px");
  const dot = g.append<SVGCircleElement>("circle")
    .attr("cx", 0).attr("cy", 0).attr("r", D3_PILL_DOT_R)
    .style("fill", clusterHue);
  const txt = g.append<SVGTextElement>("text")
    .attr("x", 0)
    .attr("y", 0.5)
    .attr("text-anchor", "start")
    .attr("dominant-baseline", "central")
    .style("font-family", D3_PILL_FONT_FAMILY)
    .style("font-size", "10px")
    .style("font-weight", "600")
    .style("fill", getThemeTokens(isLight).textHeading);
  const titleTspan = txt.append<SVGTSpanElement>("tspan").text(dims.baseLabel);
  const badgeG = g.append<SVGGElement>("g")
    .attr("class", "cluster-pct-badge")
    .attr("transform", `translate(${50 + dims.badgeGap}, 0)`)
    .style("display", "none")
    .style("pointer-events", "none");
  const badgeRect = badgeG.append<SVGRectElement>("rect")
    .attr("x", 0).attr("y", -dims.badgeH / 2).attr("width", 28).attr("height", dims.badgeH)
    .attr("rx", 5)
    .style("fill", blendHexColor(clusterHue, canvasBg, 0.26))
    .style("stroke", clusterHue)
    .style("stroke-width", "1.5px");
  const badgeTxt = badgeG.append<SVGTextElement>("text")
    .attr("x", 14).attr("y", 0.5)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central")
    .style("font-family", D3_PILL_FONT_FAMILY)
    .style("font-size", "10px")
    .style("font-weight", "700")
    .style("fill", clusterHue)
    .text("");
  return { g, rect, dot, txt, titleTspan, badgeG, badgeRect, badgeTxt };
}

/**
 * Synchronously frames the pill text: symmetric 9px inner padding, computed from the real glyph
 * advance (max of getComputedTextLength / getBBox) so the pill is correct before first paint.
 * Returns the measured text width (0 when the element is not measurable yet).
 */
function syncD3PillGeometry(
  els: {
    rect?: SVGRectElement;
    dot?: SVGCircleElement;
    txt?: SVGTextElement;
    badgeG?: SVGGElement;
  },
  name: string
): { pillW: number; measured: boolean } {
  const dims = getClusterPillDimensions(name, undefined, false, 1);
  let textW = 0;
  const t = els.txt;
  if (t) {
    try {
      const cl = typeof t.getComputedTextLength === "function" ? t.getComputedTextLength() : 0;
      const bb = typeof t.getBBox === "function" ? t.getBBox().width : 0;
      textW = Math.ceil(Math.max(Number.isFinite(cl) ? cl : 0, Number.isFinite(bb) ? bb : 0));
    } catch {
      textW = 0;
    }
  }
  const measured = textW > 0;
  if (!measured) textW = dims.baseW;
  const pillW = Math.ceil(D3_PILL_DOT_LEAD_W + textW + 2 * D3_PILL_PAD_X);
  const leftContentX = -pillW / 2 + D3_PILL_PAD_X;
  els.rect?.setAttribute("x", String(-pillW / 2));
  els.rect?.setAttribute("width", String(pillW));
  els.rect?.setAttribute("y", String(-dims.pillH / 2));
  els.rect?.setAttribute("height", String(dims.pillH));
  els.dot?.setAttribute("cx", String(leftContentX + D3_PILL_DOT_R));
  els.txt?.setAttribute("x", String(leftContentX + D3_PILL_DOT_LEAD_W));
  els.badgeG?.setAttribute("transform", `translate(${pillW / 2 + dims.badgeGap}, 0)`);
  return { pillW, measured };
}

function syncD3ClusterPillGeometry(n: D3Node): void {
  const res = syncD3PillGeometry(
    { rect: n.pillRectEl, dot: n.pillDotEl, txt: n.pillTextEl, badgeG: n.pillBadgeGroupEl },
    n.name
  );
  n.pillWidthPx = res.pillW;
  if (res.measured) n.pillGeometryLocked = true;
}

const engine: D3Engine = {
  layouts: [
    { id: 'force', label: 'Force Directed (Organic)' },
    { id: 'radial', label: 'Concentric Rings (Tags → Items)' },
    { id: 'columns', label: 'Structured Columns (Category)' }
  ],
  width: 800,
  height: 500,
  nodes: null,
  links: null,
  svg: null,
  svgGroup: null,
  zoom: null,
  simulation: null,
  linkElements: null,
  nodeElements: null,
  tooltipController: null,
  dragController: null,
  forcePositions: new Map(),
  initialForcePositions: new Map(),
  viewportAdaptFrameId: null,
  resizeObserver: null,

  async init(container: HTMLElement, payload: D3Payload, layout: string, isLight: boolean, extraOptions: Record<string, string> = {}) {
    this.width = container.offsetWidth || 800;
    this.height = container.offsetHeight || 500;
    this.forcePositions = new Map();
    this.initialForcePositions = new Map();
    this.canonicalPayload = payload.canonical ?? {
      nodes: payload.d3.nodes.map((n) => ({ ...n })),
      connections: payload.d3.connections.map((c) => ({ ...c })),
    };

    this.nodes = payload.d3.nodes.map((n) => {
      const nx = typeof n.x === 'number' ? n.x : 0;
      const ny = typeof n.y === 'number' ? n.y : 0;
      this.forcePositions.set(n.id, { x: nx, y: ny });
      this.initialForcePositions.set(n.id, { x: nx, y: ny });
      return {
        ...n,
        x: nx,
        y: ny
      };
    });
    this.activeClusterCount =
      this.nodes.filter((n) => n.group === 0).length || DEFAULT_TOPIC_CLUSTER_COUNT;
    this.activeBadgeLinks = [];

    this.links = payload.d3.connections.map((c) => ({
      source: c.sourceId,
      target: c.targetId,
      weight: c.weight,
      coverage: c.coverage
    })).filter((l) => this.nodes!.some(n => n.id === l.source) && this.nodes!.some(n => n.id === l.target));

    const nodeLookup = new Map<string, D3Node>();
    for (const n of this.nodes) {
      nodeLookup.set(n.id, n);
    }

    const rebuildDragController = () => {
      if (this.dragController) {
        this.dragController.destroy();
      }
      this.dragController = createGraphDragPhysicsController2D({
        nodes: (this.nodes || []).map((n) => ({
          id: n.id,
          group: n.group,
          x: n.x ?? 0,
          y: n.y ?? 0,
        })),
        edges: (this.links || []).map((l) => ({
          source: typeof l.source === 'object' ? l.source.id : String(l.source),
          target: typeof l.target === 'object' ? l.target.id : String(l.target),
          weight: l.weight ?? 0.5,
        })),
        isLight: () => Boolean(this.isLight),
        onTick: (positions, draggedId) => {
          if (!this.nodes) return;
          for (const [id, pt] of positions.entries()) {
            if (id === draggedId) continue;
            const n = nodeLookup.get(id);
            if (n) {
              n.x = pt.x;
              n.y = pt.y;
            }
            this.forcePositions.set(id, { x: pt.x, y: pt.y });
          }
          this.renderPositions();
        },
      });
    };
    rebuildDragController();

    container.style.touchAction = 'pan-y';

    this.svg = d3.select<HTMLElement, D3Node>(container).append<SVGSVGElement>("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${this.width} ${this.height}`)
      .style("display", "block")
      .style("touch-action", "pan-y");

    this.svgGroup = this.svg.append<SVGGElement>("g");

    this.zoom = d3.zoom<SVGSVGElement, D3Node>()
      .scaleExtent([0.1, 8])
      .filter(() => false)
      .on("zoom", (event) => {
        this.svgGroup?.attr("transform", event.transform.toString());
      });

    this.svg.call(this.zoom).on('wheel.zoom', null);

    // Create shared floating tooltip controller
    this.tooltipController = createGraphTooltipController(container);

    // Create D3 simulation
    this.simulation = d3.forceSimulation<D3Node>(this.nodes);

    const bgLinkLayer = this.svgGroup.append<SVGGElement>("g");
    const bgNodeLayer = this.svgGroup.append<SVGGElement>("g");
    const fgLayer = this.svgGroup.append<SVGGElement>("g");
    const badgeLayer = this.svgGroup.append<SVGGElement>("g").style("pointer-events", "none");

    let lastDraggedAt = 0;
    let lastHighlightedKey = '';
    this.hoveredNodeId = null;
    this.secondaryHoveredNodeId = null;
    this.draggedNodeId = null;

    const adjacency = buildGraphAdjacency(
      this.links.map(l => ({
        source: typeof l.source === 'object' ? l.source.id : String(l.source),
        target: typeof l.target === 'object' ? l.target.id : String(l.target)
      }))
    );

    const mountSvgElements = () => {
      const currentIsLight = Boolean(this.isLight ?? isLight);
      const curTokens = getGraphStyleTokens(currentIsLight);
      const curColors = currentIsLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;
      const canvasBg = getThemeTokens(currentIsLight).canvasBg;

      bgLinkLayer.selectAll("*").remove();
      bgNodeLayer.selectAll("*").remove();
      fgLayer.selectAll("*").remove();
      badgeLayer.selectAll("*").remove();
      this.activeBadgeLinks = [];

      this.linkElements = bgLinkLayer.selectAll<SVGLineElement, D3Link>(".link")
        .data(this.links || [])
        .enter().append("line")
        .each(function (l) {
          l.el = this;
          const rest = getRestEdgeStyle(l.weight, currentIsLight);
          l.displayColor = rest.color;
          l.displayWidth = rest.width;
          this.style.stroke = rest.color;
          this.style.strokeWidth = `${rest.width}px`;
          this.style.strokeOpacity = "0";
          this.style.display = "none";
        });

      this.nodeElements = bgNodeLayer.selectAll<SVGGElement, D3Node>(".node")
        .data(this.nodes || [])
        .enter().append("g")
        .each(function (n) {
          n.el = this;
        })
        .style("cursor", "pointer");

      this.nodeElements.append("polygon")
        .attr("class", "node-dot")
        .each(function (n) {
          n.circleEl = this;
          n.displayRadius = curTokens.nodeRadius * getNodeRestRadiusScale(n.group, n.size);
          if (n.group === 0) {
            this.style.display = "none";
            this.style.opacity = "0";
          }
        })
        .attr("points", d =>
          d.group === 0
            ? "0,0"
            : buildRegularPolygonSvgPoints(
                curTokens.nodeRadius * getNodeRestRadiusScale(d.group, d.size),
                d.group
              )
        )
        .style("fill", d => getNodeBaseColor(d, currentIsLight) || curColors[d.group] || curColors[0])
        .style("stroke", d => getNodeBaseColor(d, currentIsLight) || curColors[d.group] || curColors[0])
        .style("stroke-linejoin", "round")
        .style("stroke-width", "1.5px");

      this.nodeElements.filter(d => d.group === 0).each(function (n) {
        const clusterHue = getNodeClusterColor(n, currentIsLight) || curColors[0];
        const els = buildD3ClusterPillDom(this, n.name, clusterHue, currentIsLight, canvasBg);
        n.pillGroupEl = els.g.node() || undefined;
        n.pillRectEl = els.rect.node() || undefined;
        n.pillDotEl = els.dot.node() || undefined;
        n.pillTextEl = els.txt.node() || undefined;
        n.pillTitleTspanEl = els.titleTspan.node() || undefined;
        n.pillBadgeGroupEl = els.badgeG.node() || undefined;
        n.pillBadgeRectEl = els.badgeRect.node() || undefined;
        n.pillBadgeTextEl = els.badgeTxt.node() || undefined;
        n.pillGeometryLocked = false;
        syncD3ClusterPillGeometry(n);
      });
    };

    try {
      await Promise.all([
        document.fonts?.load?.("600 10px Inter", "Theme Cluster"),
        document.fonts?.load?.("700 10px Inter", "100%"),
      ]);
      await (document.fonts?.ready ?? Promise.resolve());
    } catch {
      // Font loading API unavailable: fall back to synchronous measurement
    }
    mountSvgElements();

    // Late webfont swaps change glyph advances: re-frame every pill once fonts finish loading.
    document.fonts?.addEventListener?.("loadingdone", () => {
      for (const n of this.nodes || []) {
        if (n.group === 0) {
          n.pillGeometryLocked = false;
          syncD3ClusterPillGeometry(n);
        }
      }
    });

    // ---- K-change transition (shared helper logic lives in graph-payload.ts) ----
    let pendingK: {
      prevNodes: GraphNodePayload[];
      prevPositions: Map<string, { x: number; y: number }>;
      mergeTarget?: Record<string, string>;
    } | null = null;
    let kFrameId: number | null = null;
    const labelSwaps = new Map<string, { oldName: string; oldPillW: number }>();
    const restoreSwappedLabels = () => {
      for (const id of labelSwaps.keys()) {
        const n = nodeLookup.get(id);
        if (!n) continue;
        if (n.pillTitleTspanEl) n.pillTitleTspanEl.textContent = formatClusterLabelShort(n.name);
        n.pillGeometryLocked = false;
        syncD3ClusterPillGeometry(n);
      }
      labelSwaps.clear();
    };
    let kFinish: (() => void) | null = null;
    const ghostLayer = this.svgGroup.append<SVGGElement>("g").style("pointer-events", "none");

    const spawnGhosts = (tr: GraphKChangeTransition) => {
      const isLightNow = Boolean(this.isLight);
      const canvasBg = getThemeTokens(isLightNow).canvasBg;
      ghostLayer.selectAll("*").remove();
      const ghosts = new Map<string, { g: SVGGElement }>();
      for (const gp of sampleKChangeGhostPills(tr, 0)) {
        const hue = isLightNow ? gp.colorLight : gp.colorDark;
        const els = buildD3ClusterPillDom(ghostLayer.node()!, gp.name, hue, isLightNow, canvasBg);
        const gNode = els.g.node();
        if (!gNode) continue;
        syncD3PillGeometry(
          {
            rect: els.rect.node() ?? undefined,
            dot: els.dot.node() ?? undefined,
            txt: els.txt.node() ?? undefined,
            badgeG: els.badgeG.node() ?? undefined,
          },
          gp.name
        );
        gNode.setAttribute("transform", `translate(${gp.x},${gp.y})`);
        gNode.style.opacity = String(gp.alpha);
        ghosts.set(gp.id, { g: gNode });
      }
      return ghosts;
    };

    this.finishKTransition = () => {
      if (kFinish) kFinish();
    };

    this.getWarmSeedPositions = () => {
      if (pendingK) return pendingK.prevPositions;
      return this.forcePositions;
    };

    this.hasPendingKTransition = () => pendingK !== null;
    this.discardPendingKTransition = () => {
      if (!pendingK) return;
      pendingK = null;
      restoreSwappedLabels();
      ghostLayer.selectAll("*").remove();
      for (const n of this.nodes || []) {
        if (n.group === 0) n.pillGroupEl?.style.setProperty("opacity", "0.97");
      }
    };

    this.rebuildClusterTopology = (targetK: number, opts?: { restoreDefault?: boolean }) => {
      if (!this.canonicalPayload || !this.simulation) return;
      this.finishKTransition?.();
      const prevNodes = (this.nodes || []).map((n) => ({
        id: n.id,
        name: n.name,
        size: n.size,
        group: n.group,
        colorDark: n.colorDark,
        colorLight: n.colorLight,
      })) as GraphNodePayload[];
      const stabilized = reclusterCanonicalGraphPayload(this.canonicalPayload, targetK, this.nodes || []);
      let nextCanonical: CanonicalGraphPayload = stabilized;
      if (opts?.restoreDefault && targetK === DEFAULT_TOPIC_CLUSTER_COUNT) {
        const meta = new Map(stabilized.nodes.map((n) => [n.id, n]));
        nextCanonical = {
          ...this.canonicalPayload,
          nodes: this.canonicalPayload.nodes.map((n) => {
            const m = meta.get(n.id);
            return n.group === 0 && m?.originClusterId
              ? { ...n, originClusterId: m.originClusterId, originKind: m.originKind }
              : n;
          }),
          mergeTargetByOldClusterId: stabilized.mergeTargetByOldClusterId,
        };
      }

      const prevPosById = new Map<string, { x: number; y: number }>();
      for (const n of this.nodes || []) {
        prevPosById.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
      }
      pendingK = {
        prevNodes,
        prevPositions: prevPosById,
        mergeTarget: nextCanonical.mergeTargetByOldClusterId,
      };

      const itemCoordsByCluster = new Map<string, { sumX: number; sumY: number; count: number }>();
      for (const c of nextCanonical.connections) {
        const pt = prevPosById.get(c.sourceId);
        if (pt && (c.weight ?? 0) >= 0.4) {
          const cur = itemCoordsByCluster.get(c.targetId) || { sumX: 0, sumY: 0, count: 0 };
          cur.sumX += pt.x;
          cur.sumY += pt.y;
          cur.count += 1;
          itemCoordsByCluster.set(c.targetId, cur);
        }
      }

      this.forcePositions = new Map();
      this.nodes = nextCanonical.nodes.map((n, idx) => {
        const existing =
          n.group === 0 && n.originClusterId
            ? (prevPosById.get(n.originClusterId) ?? prevPosById.get(n.id))
            : prevPosById.get(n.id);
        let nx = existing?.x;
        let ny = existing?.y;
        if (nx === undefined || ny === undefined) {
          const centroid = itemCoordsByCluster.get(n.id);
          if (centroid && centroid.count > 0) {
            nx = centroid.sumX / centroid.count;
            ny = centroid.sumY / centroid.count;
          } else {
            const angle = (idx * 2 * Math.PI) / Math.max(1, targetK);
            nx = Math.cos(angle) * 140;
            ny = Math.sin(angle) * 140;
          }
        }
        this.forcePositions.set(n.id, { x: nx, y: ny });
        return {
          ...n,
          x: nx,
          y: ny,
        };
      });

      nodeLookup.clear();
      for (const n of this.nodes) {
        nodeLookup.set(n.id, n);
      }

      this.links = nextCanonical.connections
        .map((c) => ({
          source: c.sourceId,
          target: c.targetId,
          weight: c.weight,
          coverage: c.coverage,
        }))
        .filter((l) => nodeLookup.has(String(l.source)) && nodeLookup.has(String(l.target)));

      const freshAdj = buildGraphAdjacency(
        this.links.map((l) => ({
          source: typeof l.source === 'object' ? l.source.id : String(l.source),
          target: typeof l.target === 'object' ? l.target.id : String(l.target),
        }))
      );
      adjacency.clear();
      for (const [k, v] of freshAdj.entries()) {
        adjacency.set(k, v);
      }

      this.activeClusterCount = targetK;
      this.hoveredNodeId = null;
      this.secondaryHoveredNodeId = null;
      this.focusedNodeIds = null;
      this.tooltipController?.clearFocus();

      this.simulation.stop();
      this.simulation.nodes(this.nodes);
      this.applyForceSimulationConfig();
      mountSvgElements();
      // Show the previous content colours until the transition starts (no colour pop).
      for (const n of this.nodes) {
        const prevC = n.group !== 0 ? prevNodes.find((p) => p.id === n.id) : undefined;
        if (prevC && n.circleEl) {
          const c = (this.isLight ? prevC.colorLight : prevC.colorDark) ?? undefined;
          if (c) {
            n.circleEl.style.fill = c;
            n.circleEl.style.stroke = c;
          }
        }
      }
      rebuildDragController();
      this.renderPositions();
      // Pre-transition state: split pills hidden, ghost pills of vanishing clusters stay visible.
      const preTr = createKChangeTransition({
        prevNodes,
        prevPositions: prevPosById,
        nextNodes: this.nodes,
        nextPositions: this.forcePositions,
        mergeTargetByOldClusterId: nextCanonical.mergeTargetByOldClusterId,
        now: performance.now(),
      });
      spawnGhosts(preTr);
      // Continuing clusters with a new label keep showing the OLD label until the cross-fade starts.
      labelSwaps.clear();
      for (const n of this.nodes) {
        if (n.group !== 0) continue;
        const xf = sampleKChangeClusterLabel(preTr, n.id, n.name, 0);
        if (!xf || !n.pillTitleTspanEl) continue;
        n.pillTitleTspanEl.textContent = formatClusterLabelShort(xf.oldLabel);
        n.pillGeometryLocked = false;
        syncD3ClusterPillGeometry(n);
        labelSwaps.set(n.id, { oldName: xf.oldLabel, oldPillW: n.pillWidthPx ?? xf.oldPillW });
      }
      for (const n of this.nodes) {
        if (n.group === 0 && !preTr.continuingClusterIds.has(n.id)) {
          n.pillGroupEl?.style.setProperty("opacity", "0");
        }
      }
    };

    this.playKTransition = (nextPositions: Map<string, { x: number; y: number }>) => {
      const pk = pendingK;
      pendingK = null;
      if (!pk || !this.nodes) {
        return false;
      }
      this.finishKTransition?.();
      const nodes = this.nodes;
      const isLightNow = Boolean(this.isLight);
      const canvasBg = getThemeTokens(isLightNow).canvasBg;
      const tr = createKChangeTransition({
        prevNodes: pk.prevNodes,
        prevPositions: pk.prevPositions,
        nextNodes: nodes,
        nextPositions,
        mergeTargetByOldClusterId: pk.mergeTarget,
        now: performance.now(),
      });
      this.simulation?.alpha(0).stop();

      const ghosts = spawnGhosts(tr);
      const swapEls = new Map<string, { newTxt: SVGTextElement; oldTextW: number; newTextW: number; oldPillW: number; newPillW: number }>();
      for (const [id, sw] of labelSwaps) {
        const n = nodeLookup.get(id);
        const oldTxt = n?.pillTextEl;
        if (!n || !oldTxt || !oldTxt.parentNode) continue;
        const newTxt = oldTxt.cloneNode(true) as SVGTextElement;
        newTxt.classList.add("cluster-pill-label-new");
        const tspan = newTxt.querySelector("tspan");
        if (tspan) tspan.textContent = formatClusterLabelShort(n.name);
        oldTxt.parentNode.insertBefore(newTxt, oldTxt.nextSibling);
        let newTextW = 0;
        try {
          newTextW = Math.ceil(Math.max(newTxt.getComputedTextLength(), newTxt.getBBox().width));
        } catch {
          newTextW = 0;
        }
        if (!(newTextW > 0)) newTextW = getClusterPillDimensions(n.name, undefined, false, 1).baseW;
        const newPillW = Math.ceil(D3_PILL_DOT_LEAD_W + newTextW + 2 * D3_PILL_PAD_X);
        swapEls.set(id, { newTxt, oldTextW: sw.oldPillW - D3_PILL_DOT_LEAD_W - 2 * D3_PILL_PAD_X, newTextW, oldPillW: sw.oldPillW, newPillW });
      }

      const finish = () => {
        if (kFrameId !== null) cancelAnimationFrame(kFrameId);
        kFrameId = null;
        kFinish = null;
        ghostLayer.selectAll("*").remove();
        for (const sw of swapEls.values()) sw.newTxt.remove();
        for (const n of nodes) {
          if (n.pillTextEl) n.pillTextEl.style.opacity = "";
        }
        restoreSwappedLabels();
        for (const n of nodes) {
          const p = nextPositions.get(n.id);
          if (p) {
            n.x = p.x;
            n.y = p.y;
            n.vx = 0;
            n.vy = 0;
            this.forcePositions.set(n.id, { x: p.x, y: p.y });
          }
          if (n.group === 0) {
            n.pillGroupEl?.style.setProperty("opacity", "0.97");
          }
        }
        this.renderPositions();
        this.applyHighlight?.(this.draggedNodeId ?? this.hoveredNodeId ?? null, true);
        this.dragController?.calibrateFromPositions(this.forcePositions);
      };
      kFinish = finish;

      const frame = (now: number) => {
        const progress = getKChangeTransitionProgress(tr, now);
        for (const n of nodes) {
          const nextColor = { dark: n.colorDark ?? GRAPH_COLORS.dark[0], light: n.colorLight ?? GRAPH_COLORS.light[0] };
          if (n.group === 0) {
            const s = sampleKChangeClusterPill(tr, n.id, nextColor, isLightNow, progress);
            if (!s) continue;
            const sw = swapEls.get(n.id);
            const xf = sw ? sampleKChangeClusterLabel(tr, n.id, n.name, progress) : null;
            if (sw && xf && n.pillTextEl) {
              const pw = Math.round(sw.oldPillW + (sw.newPillW - sw.oldPillW) * xf.blend);
              const left = -pw / 2 + D3_PILL_PAD_X;
              const regionStart = left + D3_PILL_DOT_LEAD_W;
              const regionW = pw - D3_PILL_DOT_LEAD_W - 2 * D3_PILL_PAD_X;
              n.pillRectEl?.setAttribute("x", String(-pw / 2));
              n.pillRectEl?.setAttribute("width", String(pw));
              n.pillDotEl?.setAttribute("cx", String(left + D3_PILL_DOT_R));
              n.pillTextEl.setAttribute("x", String(regionStart + (regionW - sw.oldTextW) / 2));
              sw.newTxt.setAttribute("x", String(regionStart + (regionW - sw.newTextW) / 2));
              n.pillTextEl.style.opacity = String(xf.oldAlpha);
              sw.newTxt.style.opacity = String(xf.newAlpha);
              n.pillBadgeGroupEl?.setAttribute("transform", `translate(${pw / 2 + 4}, 0)`);
            }
            n.x = s.x;
            n.y = s.y;
            if (n.pillGroupEl) n.pillGroupEl.style.opacity = String(s.alpha);
            n.pillRectEl?.style.setProperty("fill", blendHexColor(s.color, canvasBg, 0.13));
            n.pillRectEl?.style.setProperty("stroke", blendHexColor(s.color, canvasBg, 0.72));
            n.pillDotEl?.style.setProperty("fill", s.color);
          } else {
            const p = sampleKChangeNodePosition(tr, n.id, progress);
            if (p) {
              n.x = p.x;
              n.y = p.y;
            }
            const c = sampleKChangeNodeColor(tr, n.id, nextColor, isLightNow, progress);
            n.displayColor = c;
            n.circleEl?.style.setProperty("fill", c);
            n.circleEl?.style.setProperty("stroke", c);
          }
        }
        for (const gp of sampleKChangeGhostPills(tr, progress)) {
          const el = ghosts.get(gp.id);
          if (!el) continue;
          el.g.setAttribute("transform", `translate(${gp.x},${gp.y})`);
          el.g.style.opacity = String(gp.alpha);
        }
        this.renderPositions();
        if (progress < 1) {
          kFrameId = requestAnimationFrame(frame);
        } else {
          finish();
        }
      };
      frame(performance.now());
      this.startViewportAdaptLoop(1400);
      return true;
    };

    const applyHighlight = (activeId: string | null, immediate = false) => {
      const secId = this.secondaryHoveredNodeId ?? null;
      const highlightKey = `${activeId ?? ''}|${secId ?? ''}`;
      if (!immediate && highlightKey === lastHighlightedKey) return;
      lastHighlightedKey = highlightKey;

      if (this.highlightFrameId) {
        cancelAnimationFrame(this.highlightFrameId);
        this.highlightFrameId = null;
      }

      const currentIsLight = Boolean(this.isLight);
      const currentTokens = getGraphStyleTokens(currentIsLight);
      const groupColors = currentIsLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;
      const dists = activeId ? computeHopDistances(activeId, adjacency) : null;

      // Clear floating edge badges and collect active coverage for cluster pills or cluster-hovered content nodes
      badgeLayer.selectAll("*").remove();
      this.activeBadgeLinks = [];
      const activeClusterCoverage = new Map<string, number>();
      const activeContentCoverage = new Map<string, number>();
      const activeNodeObj = activeId ? nodeLookup.get(activeId) : undefined;
      if (activeNodeObj && this.links) {
        if (activeNodeObj.group !== 0) {
          for (const l of this.links) {
            const sObj = typeof l.source === 'object' ? l.source : nodeLookup.get(String(l.source));
            const tObj = typeof l.target === 'object' ? l.target : nodeLookup.get(String(l.target));
            if (!sObj || !tObj) continue;
            if (sObj.id === activeId && tObj.group === 0) {
              activeClusterCoverage.set(tObj.id, l.coverage ?? l.weight ?? 0.5);
            } else if (tObj.id === activeId && sObj.group === 0) {
              activeClusterCoverage.set(sObj.id, l.coverage ?? l.weight ?? 0.5);
            }
          }
        } else {
          for (const l of this.links) {
            const sObj = typeof l.source === 'object' ? l.source : nodeLookup.get(String(l.source));
            const tObj = typeof l.target === 'object' ? l.target : nodeLookup.get(String(l.target));
            if (!sObj || !tObj) continue;
            if (sObj.id === activeId && tObj.group !== 0) {
              activeContentCoverage.set(tObj.id, l.coverage ?? l.weight ?? 0.5);
            } else if (tObj.id === activeId && sObj.group !== 0) {
              activeContentCoverage.set(sObj.id, l.coverage ?? l.weight ?? 0.5);
            }
          }
        }
      }

      const bgLinkNode = bgLinkLayer.node();
      const bgNodeGroup = bgNodeLayer.node();
      const fgLayerNode = fgLayer.node();

      if (this.linkElements && this.nodeElements && bgLinkNode && bgNodeGroup && fgLayerNode) {
        if (dists || secId) {
          const fgItems: { el: Element; z: number; isNode: boolean }[] = [];

          this.linkElements.each(function (l: D3Link) {
            const srcId = typeof l.source === 'object' ? l.source.id : String(l.source);
            const tgtId = typeof l.target === 'object' ? l.target.id : String(l.target);
            const edgeZ = dists ? getEdgeHopZIndex(dists.get(srcId), dists.get(tgtId)) : 1;
            if (edgeZ >= 8) {
              fgItems.push({ el: this, z: edgeZ, isNode: false });
            } else if (this.parentNode !== bgLinkNode) {
              bgLinkNode.appendChild(this);
            }
          });

          this.nodeElements.each(function (n: D3Node) {
            const hopDist = dists ? dists.get(n.id) : undefined;
            const itemCov =
              activeNodeObj?.group === 0 && n.group !== 0
                ? (activeContentCoverage.get(n.id) ?? 0)
                : undefined;
            const nodeZ =
              secId !== null && n.id === secId
                ? 48
                : dists
                  ? getNodeHopZIndex(hopDist, itemCov)
                  : 2;
            if (nodeZ >= 10) {
              fgItems.push({ el: this, z: nodeZ, isNode: true });
            } else if (this.parentNode !== bgNodeGroup) {
              bgNodeGroup.appendChild(this);
            }
          });

          fgItems.sort((a, b) => a.z - b.z || (a.isNode ? 1 : 0) - (b.isNode ? 1 : 0));
          for (const item of fgItems) {
            fgLayerNode.appendChild(item.el);
          }
        } else {
          this.linkElements.each(function () {
            if (this.parentNode !== bgLinkNode) {
              bgLinkNode.appendChild(this);
            }
          });
          this.nodeElements.each(function () {
            if (this.parentNode !== bgNodeGroup) {
              bgNodeGroup.appendChild(this);
            }
          });
        }
      }

      const anyFocusActive = Boolean(dists || secId);

      const nodeTrans = (this.nodes || []).map((n) => {
        const baseColor = getNodeBaseColor(n, currentIsLight) || groupColors[n.group] || groupColors[0];
        const startColor = n.displayColor || baseColor;
        const restScale = getNodeRestRadiusScale(n.group, n.size);
        const startRadius = n.displayRadius ?? (currentTokens.nodeRadius * restScale);
        const hopDist = dists ? dists.get(n.id) : undefined;
        const isSecHover = secId !== null && n.id === secId;
        const itemCov =
          activeNodeObj?.group === 0 && n.group !== 0
            ? (activeContentCoverage.get(n.id) ?? 0)
            : undefined;
        const targetColor = isSecHover
          ? baseColor
          : dists
            ? getAttenuatedNodeColor(baseColor, hopDist, currentIsLight, itemCov)
            : baseColor;
        const baseScale = dists ? getAttenuatedNodeScale(hopDist, itemCov) : 1;
        const targetScale = isSecHover ? Math.max(baseScale * 1.15, 1.32) : baseScale;
        const targetRadius = currentTokens.nodeRadius * restScale * targetScale;

        if (n.group === 0 && n.pillGroupEl && n.pillRectEl && n.pillTextEl) {
          const canvasBg = getThemeTokens(currentIsLight).canvasBg;
          const clusterHue = getNodeClusterColor(n, currentIsLight) || groupColors[0];
          const cov = activeClusterCoverage.size > 0 ? (activeClusterCoverage.get(n.id) ?? 0) : undefined;
          const effectiveHop = isSecHover ? 0 : dists ? (hopDist ?? 99) : undefined;
          const pillState = resolveClusterPillVisualState(
            { hopDistance: effectiveHop, activeCoverage: cov },
            anyFocusActive
          );
          const dims = getClusterPillDimensions(n.name, cov, pillState.isHighlighted, 1);

          n.activeHopDist = effectiveHop;
          n.activeCoverage = cov;

          n.pillGroupEl.style.opacity = String(pillState.alpha);
          n.pillRectEl.style.fill = blendHexColor(clusterHue, canvasBg, pillState.isHighlighted ? 0.22 : 0.13);
          n.pillRectEl.style.stroke = blendHexColor(clusterHue, canvasBg, pillState.isHighlighted ? 1.0 : 0.72);
          n.pillRectEl.style.strokeWidth = pillState.isHighlighted ? "1.8px" : "1.25px";
          if (n.pillDotEl) {
            n.pillDotEl.style.fill = clusterHue;
          }
          n.pillTextEl.style.fill = getThemeTokens(currentIsLight).textHeading;
          if (n.pillBadgeGroupEl && n.pillBadgeRectEl && n.pillBadgeTextEl) {
            if (pillState.pctText && dims.badgeW > 0) {
              n.pillBadgeGroupEl.style.display = "";
              n.pillBadgeRectEl.setAttribute("width", String(dims.badgeW));
              n.pillBadgeRectEl.setAttribute("height", String(dims.badgeH));
              n.pillBadgeRectEl.setAttribute("y", String(-dims.badgeH / 2));
              n.pillBadgeRectEl.style.fill = blendHexColor(clusterHue, canvasBg, 0.26);
              n.pillBadgeRectEl.style.stroke = clusterHue;
              n.pillBadgeTextEl.setAttribute("x", String(dims.badgeW / 2));
              n.pillBadgeTextEl.style.fill = clusterHue;
              n.pillBadgeTextEl.textContent = pillState.pctText;
            } else {
              n.pillBadgeGroupEl.style.display = "none";
              n.pillBadgeTextEl.textContent = "";
            }
          }
        }

        return {
          node: n,
          startColor,
          targetColor,
          startRadius,
          targetRadius,
          changed: startColor !== targetColor || Math.abs(startRadius - targetRadius) > 1e-3 || immediate
        };
      });

      const linkTrans = (this.links || []).map((l) => {
        const srcId = typeof l.source === 'object' ? l.source.id : String(l.source);
        const tgtId = typeof l.target === 'object' ? l.target.id : String(l.target);
        const startColor = l.displayColor || currentTokens.edgeColor;
        const startWidth = l.displayWidth ?? currentTokens.edgeWidth;
        const targetStyle = dists
          ? getAttenuatedEdgeStyle(dists.get(srcId), dists.get(tgtId), currentIsLight, l.weight)
          : getRestEdgeStyle(l.weight, currentIsLight);
        return {
          link: l,
          startColor,
          targetColor: targetStyle.color,
          startWidth,
          targetWidth: targetStyle.width,
          changed: startColor !== targetStyle.color || Math.abs(startWidth - targetStyle.width) > 1e-3
        };
      });

      const renderStep = (ease: number) => {
        for (const nt of nodeTrans) {
          if (!nt.changed && ease < 1) continue;
          const nextColor = ease >= 1 ? nt.targetColor : interpolateHexColor(nt.startColor, nt.targetColor, ease);
          const nextRadius = ease >= 1 ? nt.targetRadius : nt.startRadius + (nt.targetRadius - nt.startRadius) * ease;
          nt.node.displayColor = nextColor;
          nt.node.displayRadius = nextRadius;
          const circleEl = nt.node.circleEl;
          if (circleEl && nt.node.group !== 0) {
            circleEl.setAttribute("points", buildRegularPolygonSvgPoints(nextRadius, nt.node.group));
            circleEl.style.fill = nextColor;
            circleEl.style.stroke = nextColor;
          }
        }
        for (const lt of linkTrans) {
          const lineEl = lt.link.el;
          if (lineEl) {
            lineEl.style.strokeOpacity = "0";
            lineEl.style.display = "none";
          }
        }
      };

      this.renderPositions();

      if (immediate) {
        renderStep(1);
        return;
      }

      const startTime = performance.now();
      const step = (now: number) => {
        const progress = Math.min(1, (now - startTime) / HIGHLIGHT_TRANSITION_MS);
        const ease = easeHighlightTransition(progress);
        renderStep(ease);
        if (progress < 1) {
          this.highlightFrameId = requestAnimationFrame(step);
        } else {
          this.highlightFrameId = null;
        }
      };
      this.highlightFrameId = requestAnimationFrame(step);
    };
    this.applyHighlight = applyHighlight;

    const utmSource = String(extraOptions.utmSource || 'visualizations_demo');
    const utmMedium = String(extraOptions.utmMedium || 'd3');
    const utmCampaign = String(extraOptions.utmCampaign || 'interactive_visualization');

    const navigateToNode = (d: D3Node) => {
      if (
        d.id.startsWith('/posts') ||
        d.id.startsWith('/publications') ||
        d.id.startsWith('/presentations') ||
        d.id.startsWith('/projects') ||
        d.id.startsWith('/courses') ||
        d.id.startsWith('/services') ||
        d.id.startsWith('/newsletters') ||
        d.id.startsWith('/visualizations') ||
        d.id.startsWith('/tags')
      ) {
        const targetUrl = new URL(d.id, window.location.origin);
        targetUrl.searchParams.set('utm_source', utmSource);
        targetUrl.searchParams.set('utm_medium', utmMedium);
        targetUrl.searchParams.set('utm_campaign', utmCampaign);
        window.location.href = targetUrl.pathname + targetUrl.search;
      }
    };

    const screenToGraph = (sx: number, sy: number) => {
      const svgNode = this.svg?.node();
      const zoomT = svgNode ? d3.zoomTransform(svgNode) : d3.zoomIdentity;
      const [gx, gy] = zoomT.invert([sx, sy]);
      return { x: gx, y: gy };
    };

    this.tooltipController.bindProximityInteraction({
      getScreenNodes: () => {
        const svgNode = this.svg?.node();
        const zoomT = svgNode ? d3.zoomTransform(svgNode) : d3.zoomIdentity;
        return (this.nodes || []).map((n) => {
          const [x, y] = zoomT.apply([n.x ?? 0, n.y ?? 0]);
          return { node: n, x, y };
        });
      },
      adjacency,
      isLight: () => Boolean(this.isLight),
      isDragging: () => Boolean(this.draggedNodeId),
      getLastDraggedAt: () => lastDraggedAt,
      onActiveNodeChange: (nodeId) => {
        this.hoveredNodeId = nodeId;
        if (!this.draggedNodeId) {
          applyHighlight(nodeId);
        }
      },
      onFocusNodeChange: (_nodeId, focusNodeIds) => {
        this.focusedNodeIds = focusNodeIds;
        this.startViewportAdaptLoop(1600, GRAPH_VIEWPORT_CONFIG.focusAlpha);
      },
      onSecondaryHoverNodeChange: (nodeId) => {
        this.secondaryHoveredNodeId = nodeId;
        if (!this.draggedNodeId) {
          applyHighlight(this.hoveredNodeId ?? null);
        }
      },
      onNavigate: (node) => {
        navigateToNode(node as D3Node);
      },
      onNodeDragStart: (rawNode, sx, sy) => {
        this.finishKTransition?.();
        const d = this.nodes?.find(n => n.id === rawNode.id);
        if (!d) return;
        if (this.viewportAdaptFrameId) {
          cancelAnimationFrame(this.viewportAdaptFrameId);
          this.viewportAdaptFrameId = null;
        }
        if (this.tuningSettleTimeout) {
          clearTimeout(this.tuningSettleTimeout);
          this.tuningSettleTimeout = undefined;
        }
        this.svg?.interrupt();
        this.draggedNodeId = d.id;
        lastDraggedAt = performance.now();
        applyHighlight(d.id);
        const gp = screenToGraph(sx, sy);
        d.fx = gp.x;
        d.fy = gp.y;
        d.x = gp.x;
        d.y = gp.y;
        if (this.currentLayout === 'force') {
          this.simulation?.stop();
          this.forcePositions.set(d.id, { x: gp.x, y: gp.y });
          this.dragController?.startDrag(d.id, gp);
          this.renderPositions();
        } else {
          this.simulation?.alphaTarget(0.3).restart();
        }
      },
      onNodeDragMove: (rawNode, sx, sy) => {
        const d = this.nodes?.find(n => n.id === rawNode.id);
        if (!d) return;
        lastDraggedAt = performance.now();
        const gp = screenToGraph(sx, sy);
        d.fx = gp.x;
        d.fy = gp.y;
        d.x = gp.x;
        d.y = gp.y;
        if (this.currentLayout === 'force') {
          this.forcePositions.set(d.id, { x: gp.x, y: gp.y });
          this.dragController?.moveDrag(d.id, gp);
        } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          this.recomputeSlotTargets(true);
          this.simulation?.alphaTarget(0.3).restart();
        }
      },
      onNodeDragEnd: (rawNode) => {
        const d = this.nodes?.find(n => n.id === rawNode.id);
        this.draggedNodeId = null;
        this.hoveredNodeId = null;
        lastDraggedAt = performance.now();
        if (d) {
          d.fx = null;
          d.fy = null;
        }
        applyHighlight(null);
        if (this.currentLayout === 'force') {
          const pos = { x: d?.x ?? 0, y: d?.y ?? 0 };
          if (d) {
            this.forcePositions.set(d.id, pos);
          }
          this.dragController?.endDrag(rawNode.id, pos);
          this.startViewportAdaptLoop(2400);
        } else {
          if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
            this.recomputeSlotTargets(true);
          }
          this.simulation?.alphaTarget(0).alpha(0.35).restart();
          this.startViewportAdaptLoop(2400);
        }
      }
    });

    this.simulation.on("tick", () => {
      this.renderPositions();
      if (this.currentLayout === 'force' && this.draggedNodeId && this.nodes) {
        for (const n of this.nodes) {
          if (typeof n.x === 'number' && typeof n.y === 'number') {
            this.forcePositions.set(n.id, { x: n.x, y: n.y });
          }
        }
      }
    });

    this.currentLayout = layout;
    this.isLight = isLight;
    this.updateLayout(layout, isLight, false);

    // Bind ResizeObserver to handle SVG resizing dynamically
    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width <= 0 || height <= 0) continue;
        if (Math.abs(width - this.width) < 1 && Math.abs(height - this.height) < 1) continue;
        this.width = width;
        this.height = height;
        if (this.svg) {
          this.svg.attr("viewBox", `0 0 ${this.width} ${this.height}`);
          if (
            (this.currentLayout === 'radial' || this.currentLayout === 'columns') &&
            this.isLight !== undefined
          ) {
            this.updateLayout(this.currentLayout, this.isLight, true);
          } else {
            this.fitToView(0);
          }
          if (this.fitTimeout) clearTimeout(this.fitTimeout);
          this.fitTimeout = setTimeout(() => {
            this.fitToView(300);
          }, 300);
        }
      }
    });
    this.resizeObserver.observe(container);

    return this;
  },

  renderPositions() {
    if (this.links) {
      for (const d of this.links) {
        const el = d.el;
        if (!el) continue;
        const s = d.source as D3Node;
        const t = d.target as D3Node;
        el.setAttribute("x1", String(s.x ?? 0));
        el.setAttribute("y1", String(s.y ?? 0));
        el.setAttribute("x2", String(t.x ?? 0));
        el.setAttribute("y2", String(t.y ?? 0));
      }
    }
    if (this.activeBadgeLinks && this.activeBadgeLinks.length > 0) {
      for (const l of this.activeBadgeLinks) {
        if (!l.badgeEl) continue;
        const s = l.source as D3Node;
        const t = l.target as D3Node;
        const mx = ((s.x ?? 0) + (t.x ?? 0)) / 2;
        const my = ((s.y ?? 0) + (t.y ?? 0)) / 2;
        l.badgeEl.setAttribute("transform", `translate(${mx},${my})`);
      }
    }
    if (this.nodes) {
      for (const d of this.nodes) {
        const nx = d.x ?? 0;
        const ny = d.y ?? 0;
        d.el?.setAttribute("transform", `translate(${nx},${ny})`);
        if (d.group === 0 && d.pillGroupEl) {
          if (!d.pillGeometryLocked) syncD3ClusterPillGeometry(d);
          d.pillGroupEl.setAttribute("transform", "translate(0,0)");
        }
      }
    }
  },

  fitToView(duration = 600) {
    if (!this.svg || !this.zoom || !this.nodes || this.nodes.length === 0) return;
    if (this.width <= 0 || this.height <= 0) return;
    if (this.viewportAdaptFrameId) {
      cancelAnimationFrame(this.viewportAdaptFrameId);
      this.viewportAdaptFrameId = null;
    }
    this.svg.interrupt();

    const isSubgraph = Boolean(this.focusedNodeIds && this.focusedNodeIds.size > 0);
    const activeNodes = isSubgraph
      ? this.nodes.filter(n => this.focusedNodeIds!.has(n.id))
      : this.nodes;
    const r = getGraphStyleTokens(Boolean(this.isLight)).nodeRadius;
    const points =
      !isSubgraph && this.currentLayout === 'radial'
        ? getRadialReferenceBounds2D(this.width, this.height, false)
        : activeNodes.map(n => ({ x: n.x ?? 0, y: n.y ?? 0 }));
    const fit = compute2DViewportFit(
      points,
      this.width,
      this.height,
      r,
      isSubgraph
    );
    if (!fit) return;

    const transform = d3.zoomIdentity
      .translate(fit.panX, fit.panY)
      .scale(fit.scale);

    if (duration > 0) {
      this.svg.transition().duration(duration).call(this.zoom.transform, transform);
    } else {
      this.svg.call(this.zoom.transform, transform);
    }
  },

  stepViewportTowardCloud(alpha: number) {
    if (!this.svg || !this.zoom || !this.nodes || this.nodes.length === 0) return;
    if (this.width <= 0 || this.height <= 0) return;
    const svgNode = this.svg.node();
    if (!svgNode) return;

    const isSubgraph = Boolean(this.focusedNodeIds && this.focusedNodeIds.size > 0);
    const activeNodes = isSubgraph
      ? this.nodes.filter(n => this.focusedNodeIds!.has(n.id))
      : this.nodes;
    const r = getGraphStyleTokens(Boolean(this.isLight)).nodeRadius;
    const points =
      !isSubgraph && this.currentLayout === 'radial'
        ? getRadialReferenceBounds2D(this.width, this.height, false)
        : activeNodes.map(n => ({ x: n.x ?? 0, y: n.y ?? 0 }));
    const fit = compute2DViewportFit(
      points,
      this.width,
      this.height,
      r,
      isSubgraph
    );
    if (!fit) return;

    const curT = d3.zoomTransform(svgNode);
    const t = Math.max(0, Math.min(1, alpha));
    const nextK = curT.k + (fit.scale - curT.k) * t;
    const nextX = curT.x + (fit.panX - curT.x) * t;
    const nextY = curT.y + (fit.panY - curT.y) * t;

    this.svg.call(this.zoom.transform, d3.zoomIdentity.translate(nextX, nextY).scale(nextK));
  },

  startViewportAdaptLoop(
    durationMs = GRAPH_VIEWPORT_CONFIG.adaptDurationMs,
    baseAlpha: number = GRAPH_VIEWPORT_CONFIG.adaptAlpha
  ) {
    if (this.fitTimeout) {
      clearTimeout(this.fitTimeout);
      this.fitTimeout = undefined;
    }
    this.svg?.interrupt();
    if (this.viewportAdaptFrameId) {
      cancelAnimationFrame(this.viewportAdaptFrameId);
      this.viewportAdaptFrameId = null;
    }
    const startTime = performance.now();
    let lastTime = startTime;
    const tick = (now: number) => {
      if (!this.svg || !this.nodes || this.draggedNodeId) {
        this.viewportAdaptFrameId = null;
        return;
      }
      const dt = Math.max(1, now - lastTime);
      lastTime = now;
      const stepAlpha = 1 - Math.pow(1 - baseAlpha, Math.min(50, dt) / 16.67);
      this.stepViewportTowardCloud(stepAlpha);
      if (now - startTime < durationMs) {
        this.viewportAdaptFrameId = requestAnimationFrame(tick);
      } else {
        this.stepViewportTowardCloud(1);
        this.viewportAdaptFrameId = null;
      }
    };
    this.viewportAdaptFrameId = requestAnimationFrame(tick);
  },

  applyForceSimulationConfig() {
    if (!this.simulation) return;
    const isLight = Boolean(this.isLight);
    const tuning = getGraphTuningState();
    const collisionRadius =
      getGraphStyleTokens(isLight).nodeRadius + GRAPH_PHYSICS_CONFIG.collisionPadding2D;
    this.simulation
      .force(
        "link",
        d3
          .forceLink<D3Node, D3Link>(this.links || [])
          .id(d => d.id)
          .distance(l => getEdgeLinkDistance2D(l.weight))
          .strength(l => getEdgeLinkStrength2D(l.weight))
      )
      .force(
        "charge",
        d3
          .forceManyBody<D3Node>()
          .strength(GRAPH_PHYSICS_CONFIG.d3ChargeStrength * tuning.repulsionScale)
          .distanceMax(GRAPH_PHYSICS_CONFIG.d3ChargeDistanceMax)
      )
      .force("center", d3.forceCenter(0, 0).strength(0.05))
      .force("collide", d3.forceCollide<D3Node>().radius(collisionRadius).iterations(2))
      .force(
        "x",
        d3.forceX<D3Node>(0).strength(GRAPH_PHYSICS_CONFIG.d3CenterGravityStrength * tuning.gravityScale)
      )
      .force(
        "y",
        d3.forceY<D3Node>(0).strength(GRAPH_PHYSICS_CONFIG.d3CenterGravityStrength * tuning.gravityScale)
      );
  },

  recomputeSlotTargets(useCurrentOrder = false) {
    if (!this.nodes || !this.simulation) return;
    const layout = this.currentLayout;
    if (layout !== 'radial' && layout !== 'columns') return;

    const { targets } = compute2DGeometryTargets(this.nodes, layout, {
      useCurrentOrder,
      width: this.width,
      height: this.height,
      centerOrigin: false,
      paddedColumns: true,
      isMobile: this.width < 768 || window.innerWidth < 768
    });

    for (const n of this.nodes) {
      const target = targets[n.id];
      if (target) {
        n.targetX = target.x;
        n.targetY = target.y;
      }
    }

    const cx = layout === 'radial' ? this.width / 2 : 0;
    const cy = layout === 'radial' ? this.height / 2 : 0;
    const fx = this.simulation.force("x") as d3.ForceX<D3Node> | undefined;
    const fy = this.simulation.force("y") as d3.ForceY<D3Node> | undefined;
    fx?.x(d => d.targetX ?? cx);
    fy?.y(d => d.targetY ?? cy);
  },

  updateLayout(layout: string, isLight: boolean, animate = true) {
    if (!this.simulation || !this.nodes || !this.linkElements || !this.nodeElements) return;
    const layoutChanged = this.currentLayout !== layout;
    this.currentLayout = layout;
    this.isLight = isLight;

    if (layoutChanged) {
      this.tuningGeneration = (this.tuningGeneration || 0) + 1;
      this.tuningInFlight = false;
      this.focusedNodeIds = null;
      this.tooltipController?.clearFocus();
      this.dragController?.stop();
      this.discardPendingKTransition?.();
      if (this.viewportAdaptFrameId) {
        cancelAnimationFrame(this.viewportAdaptFrameId);
        this.viewportAdaptFrameId = null;
      }
      if (this.fitTimeout) {
        clearTimeout(this.fitTimeout);
        this.fitTimeout = undefined;
      }
      if (this.tuningSettleTimeout) {
        clearTimeout(this.tuningSettleTimeout);
        this.tuningSettleTimeout = undefined;
      }
    }

    // Apply color update to D3 circles and links based on theme (and preserve any active highlight)
    this.applyHighlight?.(this.draggedNodeId ?? this.hoveredNodeId ?? null, true);

    if (animate && !layoutChanged) {
      return;
    }

    if (layout === 'radial') {
      const cx = this.width / 2;
      const cy = this.height / 2;

      this.recomputeSlotTargets(false);

      // Apply positional forces
      this.simulation
        .velocityDecay(0.4)
        .force("link", null)
        .force("charge", null)
        .force("center", null)
        .force("collide", null)
        .force("x", d3.forceX<D3Node>(d => d.targetX ?? cx).strength(1.5))
        .force("y", d3.forceY<D3Node>(d => d.targetY ?? cy).strength(1.5));

    } else if (layout === 'columns') {
      this.recomputeSlotTargets(false);

      // Apply columnar forces
      this.simulation
        .velocityDecay(0.4)
        .force("link", null)
        .force("charge", null)
        .force("center", null)
        .force("collide", null)
        .force("x", d3.forceX<D3Node>(d => d.targetX ?? 0).strength(1.5))
        .force("y", d3.forceY<D3Node>(d => d.targetY ?? 0).strength(1.5));

    } else {
      // Force-directed (default)
      if (!animate && this.forcePositions.size > 0) {
        for (const n of this.nodes) {
          const fp = this.forcePositions.get(n.id);
          if (fp) {
            n.x = fp.x;
            n.y = fp.y;
            n.vx = 0;
            n.vy = 0;
          }
        }
        this.applyForceSimulationConfig();
        this.simulation.alpha(0).stop();
        this.dragController?.calibrateFromPositions(this.forcePositions);
        this.renderPositions();
        this.fitToView(0);
        return;
      }

      if (this.forcePositions.size > 0) {
        for (const n of this.nodes) {
          const fp = this.forcePositions.get(n.id);
          if (fp) {
            n.targetX = fp.x;
            n.targetY = fp.y;
          }
        }
        this.simulation
          .force("link", null)
          .force("charge", null)
          .force("center", null)
          .force("collide", null)
          .force("x", d3.forceX<D3Node>(d => d.targetX ?? 0).strength(1.1))
          .force("y", d3.forceY<D3Node>(d => d.targetY ?? 0).strength(1.1));
        this.tuningSettleTimeout = setTimeout(() => {
          this.tuningSettleTimeout = undefined;
          if (this.currentLayout === 'force' && this.simulation && !this.draggedNodeId) {
            this.simulation.stop();
            if (this.nodes) {
              for (const n of this.nodes) {
                const fp = this.forcePositions.get(n.id);
                if (fp) {
                  n.x = fp.x;
                  n.y = fp.y;
                  n.vx = 0;
                  n.vy = 0;
                }
              }
              this.renderPositions();
            }
            this.dragController?.calibrateFromPositions(this.forcePositions);
          }
        }, 520);
      } else {
        this.applyForceSimulationConfig();
      }
    }

    if (!animate) {
      this.simulation.alpha(1).stop();
      this.simulation.tick(70);
      this.renderPositions();
      this.fitToView(0);
      return;
    }

    // Trigger transition
    this.simulation.alpha(0.45).restart();
    if (layout === 'radial' || layout === 'columns') {
      this.tuningSettleTimeout = setTimeout(() => {
        this.tuningSettleTimeout = undefined;
        if ((this.currentLayout === 'radial' || this.currentLayout === 'columns') && this.simulation && !this.draggedNodeId) {
          this.simulation.stop();
          if (this.nodes) {
            for (const n of this.nodes) {
              if (typeof n.targetX === 'number' && typeof n.targetY === 'number') {
                n.x = n.targetX;
                n.y = n.targetY;
                n.vx = 0;
                n.vy = 0;
              }
            }
            this.renderPositions();
          }
        }
      }, 450);
    }

    // Smoothly auto-fit once simulation transitions
    this.startViewportAdaptLoop(750, 0.22);
  },

  applyTuning(category) {
    if (!this.simulation || !this.nodes) return;
    this.finishKTransition?.();
    if (this.tuningSettleTimeout) {
      clearTimeout(this.tuningSettleTimeout);
      this.tuningSettleTimeout = undefined;
    }
    if (category === 'reset') {
      this.tuningGeneration = (this.tuningGeneration || 0) + 1;
      this.tuningInFlight = false;
      this.dragController?.stop();
      const targetK = getGraphTuningState().clusterCount;
      if (this.activeClusterCount !== targetK) {
        this.rebuildClusterTopology?.(targetK, { restoreDefault: true });
      }
      this.forcePositions = new Map();
      for (const [id, pos] of this.initialForcePositions.entries()) {
        this.forcePositions.set(id, { x: pos.x, y: pos.y });
      }
      this.applyHighlight?.(this.draggedNodeId ?? this.hoveredNodeId ?? null, true);
      if (this.currentLayout === 'force') {
        if (this.hasPendingKTransition?.() && this.playKTransition?.(new Map(this.initialForcePositions))) {
          return;
        }
        for (const n of this.nodes) {
          const fp = this.initialForcePositions.get(n.id);
          if (fp) {
            n.targetX = fp.x;
            n.targetY = fp.y;
          }
        }
        this.simulation
          .force("link", null)
          .force("charge", null)
          .force("center", null)
          .force("collide", null)
          .force("x", d3.forceX<D3Node>(d => d.targetX ?? 0).strength(1.1))
          .force("y", d3.forceY<D3Node>(d => d.targetY ?? 0).strength(1.1))
          .alpha(0.45)
          .restart();
        this.tuningSettleTimeout = setTimeout(() => {
          this.tuningSettleTimeout = undefined;
          if (this.currentLayout === 'force' && this.simulation && !this.draggedNodeId) {
            this.simulation.stop();
            if (this.nodes) {
              for (const n of this.nodes) {
                const fp = this.forcePositions.get(n.id);
                if (fp) {
                  n.x = fp.x;
                  n.y = fp.y;
                  n.vx = 0;
                  n.vy = 0;
                }
              }
              this.renderPositions();
            }
            this.dragController?.calibrateFromPositions(this.forcePositions);
          }
        }, 480);
        this.startViewportAdaptLoop(1400);
      } else {
        this.discardPendingKTransition?.();
        this.recomputeSlotTargets(false);
        this.simulation.alpha(0.55).restart();
        this.tuningSettleTimeout = setTimeout(() => {
          this.tuningSettleTimeout = undefined;
          if ((this.currentLayout === 'radial' || this.currentLayout === 'columns') && this.simulation && !this.draggedNodeId) {
            this.simulation.stop();
            if (this.nodes) {
              for (const n of this.nodes) {
                if (typeof n.targetX === 'number' && typeof n.targetY === 'number') {
                  n.x = n.targetX;
                  n.y = n.targetY;
                  n.vx = 0;
                  n.vy = 0;
                }
              }
              this.renderPositions();
            }
          }
        }, 420);
        this.startViewportAdaptLoop(1400);
      }
      return;
    }

    if (category === 'visual') {
      this.applyHighlight?.(this.draggedNodeId ?? this.hoveredNodeId ?? null, true);
      return;
    }

    if (category === 'geometry') {
      if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
        this.recomputeSlotTargets(true);
        this.simulation.velocityDecay(0.4).alpha(0.6).restart();
        this.tuningSettleTimeout = setTimeout(() => {
          this.tuningSettleTimeout = undefined;
          if ((this.currentLayout === 'radial' || this.currentLayout === 'columns') && this.simulation && !this.draggedNodeId) {
            this.simulation.stop();
            if (this.nodes) {
              for (const n of this.nodes) {
                if (typeof n.targetX === 'number' && typeof n.targetY === 'number') {
                  n.x = n.targetX;
                  n.y = n.targetY;
                  n.vx = 0;
                  n.vy = 0;
                }
              }
              this.renderPositions();
            }
          }
        }, 320);
        this.startViewportAdaptLoop(1400);
      }
      return;
    }

    if (category === 'physics' && this.currentLayout === 'force') {
      const gen = (this.tuningGeneration = (this.tuningGeneration || 0) + 1);
      this.dragController?.stop();
      const targetK = getGraphTuningState().clusterCount;
      if (this.activeClusterCount !== targetK) {
        this.rebuildClusterTopology?.(targetK);
      }

      const applySolvedD3Positions = (solved: Record<string, { x: number; y: number }>) => {
        if (!this.simulation || !this.nodes || this.currentLayout !== 'force') return;
        if (this.hasPendingKTransition?.()) {
          const solvedMap = new Map<string, { x: number; y: number }>();
          for (const [nodeId, pt] of Object.entries(solved)) solvedMap.set(nodeId, { x: pt.x, y: pt.y });
          if (this.playKTransition?.(solvedMap)) return;
        }
        for (const [nodeId, pt] of Object.entries(solved)) {
          this.forcePositions.set(nodeId, { x: pt.x, y: pt.y });
        }
        for (const n of this.nodes) {
          const fp = this.forcePositions.get(n.id);
          if (fp) {
            n.targetX = fp.x;
            n.targetY = fp.y;
          }
        }

        this.simulation
          .force("link", null)
          .force("charge", null)
          .force("center", null)
          .force("collide", null)
          .force("x", d3.forceX<D3Node>(d => d.targetX ?? 0).strength(1.1))
          .force("y", d3.forceY<D3Node>(d => d.targetY ?? 0).strength(1.1))
          .alpha(0.45)
          .restart();
        this.tuningSettleTimeout = setTimeout(() => {
          this.tuningSettleTimeout = undefined;
          if (this.currentLayout === 'force' && this.simulation && !this.draggedNodeId) {
            this.simulation.stop();
            if (this.nodes) {
              for (const n of this.nodes) {
                const fp = this.forcePositions.get(n.id);
                if (fp) {
                  n.x = fp.x;
                  n.y = fp.y;
                  n.vx = 0;
                  n.vy = 0;
                }
              }
              this.renderPositions();
            }
            this.dragController?.calibrateFromPositions(this.forcePositions);
          }
        }, 480);
        this.startViewportAdaptLoop(1400);
      };

      {
        this.tuningInFlight = true;
        void solveD3ForceLayoutAsync(
          {
            nodes: this.nodes,
            connections: (this.links || []).map(l => ({
              sourceId: typeof l.source === 'object' ? l.source.id : String(l.source),
              targetId: typeof l.target === 'object' ? l.target.id : String(l.target),
              weight: l.weight ?? 0.5
            })),
            seedPositions: this.getWarmSeedPositions?.() ?? this.forcePositions
          },
          { shouldCancel: () => this.tuningGeneration !== gen }
        ).then((solved) => {
          if (!solved || this.tuningGeneration !== gen) return;
          this.tuningInFlight = false;
          applySolvedD3Positions(solved);
        });
      }
    }
  },

  destroy() {
    this.finishKTransition?.();
    this.tuningGeneration = (this.tuningGeneration || 0) + 1;
    this.tuningInFlight = false;
    if (this.highlightFrameId) {
      cancelAnimationFrame(this.highlightFrameId);
      this.highlightFrameId = null;
    }
    if (this.dragController) {
      this.dragController.destroy();
      this.dragController = null;
    }
    if (this.viewportAdaptFrameId) {
      cancelAnimationFrame(this.viewportAdaptFrameId);
      this.viewportAdaptFrameId = null;
    }
    if (this.fitTimeout) clearTimeout(this.fitTimeout);
    if (this.tuningSettleTimeout) clearTimeout(this.tuningSettleTimeout);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.tooltipController) {
      this.tooltipController.destroy();
      this.tooltipController = null;
    }
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }
    if (this.svg) {
      this.svg.remove();
      this.svg = null;
    }
  }
};

export default engine;
