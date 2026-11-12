import { Sigma } from 'sigma';
import Graph from 'graphology';
import {
  DEFAULT_TOPIC_CLUSTER_COUNT,
  GRAPH_COLORS,
  GRAPH_GEOMETRY_LAYOUT_CONFIG,
  GRAPH_VIEWPORT_CONFIG,
  HIGHLIGHT_TRANSITION_MS,
  drawClusterCalloutLabels2D,
  drawRegularPolygonNode2D,
  easeHighlightTransition,
  getEdgePhysicsMetrics,
  getGraphStyleTokens,
  getGraphTuningState,
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
  isBackboneEdge,
  getNodeHopZIndex,
  getEdgeHopZIndex,
  computeKChangeStartPositions,
  resolveKChangeCanonical,
  sampleKChangeClusterLabel,
  sampleKChangeClusterPill,
  sampleKChangeGhostPills,
  sampleKChangeNodeColor,
  sampleKChangeNodePosition,
  type CanonicalGraphPayload,
  type ClusterLabelCrossfade,
  type GraphNodePayload,
  type SigmaNode,
  type SigmaEdge
} from '@commons/shared/graph-payload';
import {
  compute2DGeometryTargets,
  solveSigmaForceAtlas2Layout,
  solveSigmaForceAtlas2LayoutAsync,
  type SolverGraphNode,
} from '@commons/shared/graph-solvers';
import {
  createGraphDragPhysicsController2D,
  type GraphDragPhysicsController2D,
} from '@commons/client/graph-drag-controller';
import { getThemeTokens } from '@commons/shared/domain-themes';
import { createKChangeController, type KChangeController } from '@commons/client/graph-k-transition';
import { createGraphTooltipController, type GraphTooltipController, type RawGraphNode } from '@commons/client/vis-tooltip';

function getNodeColor(
  node: { group?: number; colorDark?: string; colorLight?: string } | number,
  isLight: boolean
): string {
  const colors = isLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;
  if (typeof node === 'number') {
    return colors[node] || colors[0];
  }
  const grp = node.group ?? 0;
  return getNodeBaseColor(node, isLight) || colors[grp] || colors[0];
}

export type SigmaNodeData = SigmaNode;
export type SigmaEdgeData = SigmaEdge;

export interface SigmaPayload {
  canonical?: CanonicalGraphPayload;
  sigma: {
    nodes: SigmaNodeData[];
    edges: SigmaEdgeData[];
  };
}

export interface SigmaEngine {
  layouts: { id: string; label: string }[];
  graph: Graph | null;
  sigma: Sigma | null;
  canonicalPayload?: CanonicalGraphPayload | null;
  activeClusterCount?: number;
  rebuildClusterTopology?(targetK: number, opts?: { restoreDefault?: boolean }): void;
  kChange?: KChangeController | null;
  playKTransition?(nextPositions: Map<string, { x: number; y: number }>): boolean;
  nodeMap: Map<string, SigmaNodeData> | null;
  tooltipController: GraphTooltipController | null;
  dragController?: GraphDragPhysicsController2D | null;
  fgCanvas?: HTMLCanvasElement | null;
  activeHighlightDists?: Map<string, number> | null;
  hoveredNodeId?: string | null;
  secondaryHoveredNodeId?: string | null;
  focusedNodeIds?: Set<string> | null;
  highlightFrameId?: number | null;
  applyHighlight?(activeNodeId: string | null, immediate?: boolean): void;
  mouseMoveHandler: ((e: MouseEvent) => void) | null;
  container: HTMLElement | null;
  payload?: SigmaPayload;
  currentLayout?: string;
  isLight?: boolean;
  lastDraggedAt?: number;
  lastOrderSignature?: string;
  forcePositions: Map<string, { x: number; y: number }>;
  initialForcePositions: Map<string, { x: number; y: number }>;
  tuningGeneration?: number;
  tuningInFlight?: boolean;
  viewportAdaptFrameId?: number | null;
  resizeObserver: ResizeObserver | null;
  animationFrameId: number | null;
  init(container: HTMLElement, payload: SigmaPayload, layout: string, isLight: boolean, extraOptions?: Record<string, string>): Promise<SigmaEngine>;
  stepViewportTowardCloud(alpha: number): void;
  startViewportAdaptLoop(durationMs?: number, baseAlpha?: number): void;
  getForcePositions(): Record<string, { x: number; y: number }>;
  getLivePositions(): Map<string, { x: number; y: number }>;
  computeLayoutTargets(layout: string, useCurrentOrder?: boolean): { targets: Record<string, { x: number; y: number }>; signature: string };
  updateLayout(layout: string, isLight: boolean): void;
  applyTuning(category: 'physics' | 'geometry' | 'visual' | 'reset'): void;
  animateTo(targets: Record<string, { x: number; y: number }>, duration?: number, excludeNodeId?: string, resetCamera?: boolean): void;
  destroy(): void;
}

const engine: SigmaEngine = {
  layouts: [
    { id: 'force', label: 'Force Directed (Organic)' },
    { id: 'radial', label: 'Concentric Rings (Tags → Items)' },
    { id: 'columns', label: 'Structured Columns (Category)' }
  ],
  graph: null,
  sigma: null,
  nodeMap: null,
  tooltipController: null,
  dragController: null,
  mouseMoveHandler: null,
  container: null,
  lastDraggedAt: 0,
  lastOrderSignature: '',
  forcePositions: new Map(),
  initialForcePositions: new Map(),
  viewportAdaptFrameId: null,
  resizeObserver: null,
  animationFrameId: null,

  async init(container: HTMLElement, payload: SigmaPayload, layout: string, isLight: boolean, extraOptions: Record<string, string> = {}) {
    this.container = container;
    this.graph = new Graph();
    this.payload = payload;
    this.currentLayout = undefined;
    this.lastDraggedAt = 0;
    this.lastOrderSignature = '';
    this.forcePositions = new Map();
    this.initialForcePositions = new Map();
    const nodes = payload.sigma.nodes;
    const edges = payload.sigma.edges;
    this.nodeMap = new Map(nodes.map(n => [n.id, n]));
    this.canonicalPayload = payload.canonical ?? {
      nodes: nodes.map((n) => ({
        id: n.id,
        name: n.label,
        size: n.rawSize ?? n.size ?? 1,
        group: n.group ?? 0,
        colorDark: n.colorDark,
        colorLight: n.colorLight,
        typeLabel: n.typeLabel,
        description: n.description,
        date: n.date,
        image: n.image,
        tags: n.tags ? [...n.tags] : undefined,
      })),
      connections: edges.map((e) => ({
        sourceId: e.source,
        targetId: e.target,
        weight: e.weight,
        coverage: e.coverage,
      })),
    };
    this.activeClusterCount =
      nodes.filter((n) => (n.group ?? 0) === 0).length || DEFAULT_TOPIC_CLUSTER_COUNT;

    const styleTokens = getGraphStyleTokens(isLight);

    nodes.forEach(n => {
      const nx = typeof n.x === 'number' ? n.x : 0;
      const ny = typeof n.y === 'number' ? n.y : 0;
      const rawSize = Number(n.rawSize ?? n.size ?? 1);
      const grp = n.group ?? 0;
      this.forcePositions.set(n.id, { x: nx, y: ny });
      this.initialForcePositions.set(n.id, { x: nx, y: ny });
      this.graph?.addNode(n.id, {
        label: '',
        name: n.label,
        x: nx,
        y: ny,
        rawSize,
        size: styleTokens.nodeRadius * getNodeRestRadiusScale(grp, rawSize),
        zIndex: 1,
        group: grp,
        colorDark: n.colorDark,
        colorLight: n.colorLight,
        hidden: grp === 0,
        color: getNodeColor(n, isLight)
      });
    });

    edges.forEach(e => {
      const rawWeight = e.weight ?? 0.5;
      if (e.source !== e.target && this.graph?.hasNode(e.source) && this.graph?.hasNode(e.target) && !this.graph.hasEdge(e.source, e.target)) {
        const restStyle = getRestEdgeStyle(rawWeight, isLight);
        this.graph.addUndirectedEdge(e.source, e.target, {
          size: restStyle.width,
          color: restStyle.color,
          hidden: true,
          rawWeight,
          coverage: e.coverage,
          weight: getEdgePhysicsMetrics(rawWeight).stiffnessFactor,
          zIndex: restStyle.isBackbone ? 2 : 0
        });
      }
    });

    const tokens = getThemeTokens(isLight);
    this.sigma = new Sigma(this.graph, container, {
      defaultNodeColor: tokens.nodeDefault,
      defaultEdgeColor: styleTokens.edgeColor,
      renderLabels: false,
      zIndex: true,
      stagePadding: GRAPH_VIEWPORT_CONFIG.padX + styleTokens.nodeRadius,
      labelColor: { color: tokens.textHeading },
      labelFont: 'Outfit, Inter, sans-serif',
      labelSize: 10,
      defaultDrawNodeHover: () => {},
      nodeReducer: (_node, data) => ({
        ...data,
        size: 0.1,
        color: 'rgba(0,0,0,0)',
        label: '',
      }),
      allowInvalidContainer: true,
      enableCameraZooming: false,
      enableCameraPanning: false,
      enableCameraRotation: false
    });
    this.sigma.getCamera().enabledZooming = false;
    this.sigma.getCamera().enabledPanning = false;
    this.sigma.getCamera().enabledRotation = false;

    container.style.touchAction = 'pan-y';
    container.querySelectorAll('canvas').forEach((c) => {
      c.style.touchAction = 'pan-y';
    });

    this.tooltipController = createGraphTooltipController(container);

    const utmSource = String(extraOptions.utmSource || 'visualizations_demo');
    const utmMedium = String(extraOptions.utmMedium || 'sigma');
    const utmCampaign = String(extraOptions.utmCampaign || 'interactive_visualization');

    let draggedNode: string | null = null;

    const rebuildDragController = (
      nodesList: SigmaNodeData[],
      edgesList: SigmaEdgeData[]
    ) => {
      if (this.dragController) {
        this.dragController.destroy();
      }
      this.dragController = createGraphDragPhysicsController2D({
        nodes: nodesList.map((n) => ({
          id: n.id,
          group: n.group ?? 0,
          x: typeof n.x === 'number' ? n.x : 0,
          y: typeof n.y === 'number' ? n.y : 0,
        })),
        edges: edgesList.map((e) => ({
          source: e.source,
          target: e.target,
          weight: e.weight ?? 0.5,
        })),
        isLight: () => Boolean(this.isLight),
        onTick: (positions, draggedId) => {
          if (!this.sigma || !this.graph) return;
          for (const [id, pt] of positions.entries()) {
            if (id === draggedId) continue;
            if (!this.graph.hasNode(id)) continue;
            this.graph.setNodeAttribute(id, 'x', pt.x);
            this.graph.setNodeAttribute(id, 'y', pt.y);
            this.forcePositions.set(id, { x: pt.x, y: pt.y });
          }
          this.sigma.refresh();
        },
      });
    };

    rebuildDragController(nodes, edges);

    this.hoveredNodeId = null;
    this.secondaryHoveredNodeId = null;
    this.activeHighlightDists = null;
    this.isLight = isLight;
    const adjacency = buildGraphAdjacency(edges);
    let lastHighlightedKey = '';

    this.kChange?.destroy();
    this.kChange = createKChangeController();

    this.rebuildClusterTopology = (targetK: number, opts?: { restoreDefault?: boolean }) => {
      if (!this.canonicalPayload || !this.graph || !this.sigma || !this.payload) return;
      this.kChange?.finish();
      const prevPayloadNodes: GraphNodePayload[] = this.payload.sigma.nodes.map((n) => ({
        id: n.id,
        name: n.label,
        size: n.rawSize ?? 1,
        group: n.group ?? 0,
        colorDark: n.colorDark,
        colorLight: n.colorLight,
      }));
      const prevMetaById = new Map(prevPayloadNodes.map((m) => [m.id, m]));
      const nextCanonical = resolveKChangeCanonical(
        this.canonicalPayload,
        targetK,
        prevPayloadNodes,
        Boolean(opts?.restoreDefault)
      );

      const currentIsLight = Boolean(this.isLight);
      const curTokens = getGraphStyleTokens(currentIsLight);

      const prevPosById = new Map<string, { x: number; y: number }>();
      this.graph.forEachNode((nId) => {
        const nx = Number(this.graph?.getNodeAttribute(nId, 'x') ?? 0);
        const ny = Number(this.graph?.getNodeAttribute(nId, 'y') ?? 0);
        prevPosById.set(nId, { x: nx, y: ny });
      });

      const startPos = computeKChangeStartPositions(nextCanonical.nodes, nextCanonical.connections, prevPosById, targetK, 6);

      this.forcePositions.clear();
      const nextSigmaNodes: SigmaNodeData[] = nextCanonical.nodes.map((n) => {
        const sp = startPos.get(n.id) ?? { x: 0, y: 0 };
        const nx = sp.x;
        const ny = sp.y;
        const prevMeta = prevMetaById.get(n.id);
        const displayColor =
          n.group !== 0 && prevMeta
            ? getNodeColor(prevMeta, currentIsLight)
            : getNodeColor(n, currentIsLight);
        this.forcePositions.set(n.id, { x: nx, y: ny });
        return {
          id: n.id,
          label: n.name,
          x: nx,
          y: ny,
          size: curTokens.nodeRadius * getNodeRestRadiusScale(n.group, n.size),
          rawSize: n.size,
          group: n.group,
          colorDark: n.colorDark,
          colorLight: n.colorLight,
          color: displayColor,
          originClusterId: n.originClusterId,
          originKind: n.originKind,
          typeLabel: n.typeLabel,
          description: n.description,
          date: n.date,
          image: n.image,
          tags: n.tags ? [...n.tags] : undefined,
        };
      });

      const nextSigmaEdges: SigmaEdgeData[] = nextCanonical.connections.map((c) => {
        const rest = getRestEdgeStyle(c.weight, currentIsLight);
        return {
          id: `${c.sourceId}--${c.targetId}`,
          source: c.sourceId,
          target: c.targetId,
          size: rest.width,
          color: rest.color,
          weight: c.weight,
          coverage: c.coverage,
        };
      });

      this.payload.sigma.nodes = nextSigmaNodes;
      this.payload.sigma.edges = nextSigmaEdges;
      this.nodeMap = new Map(nextSigmaNodes.map((n) => [n.id, n]));

      this.graph.clear();
      nextSigmaNodes.forEach((n) => {
        const rawSize = Number(n.rawSize ?? n.size ?? 1);
        const grp = n.group ?? 0;
        this.graph?.addNode(n.id, {
          label: '',
          name: n.label,
          x: n.x,
          y: n.y,
          rawSize,
          size: curTokens.nodeRadius * getNodeRestRadiusScale(grp, rawSize),
          zIndex: 1,
          group: grp,
          colorDark: n.colorDark,
          colorLight: n.colorLight,
          hidden: grp === 0,
          color: n.color,
        });
      });

      nextSigmaEdges.forEach((e) => {
        const rawWeight = e.weight ?? 0.5;
        if (
          e.source !== e.target &&
          this.graph?.hasNode(e.source) &&
          this.graph?.hasNode(e.target) &&
          !this.graph.hasEdge(e.source, e.target)
        ) {
          const restStyle = getRestEdgeStyle(rawWeight, currentIsLight);
          this.graph.addUndirectedEdge(e.source, e.target, {
            size: restStyle.width,
            color: restStyle.color,
            hidden: true,
            rawWeight,
            coverage: e.coverage,
            weight: getEdgePhysicsMetrics(rawWeight).stiffnessFactor,
            zIndex: restStyle.isBackbone ? 2 : 0,
          });
        }
      });

      const freshAdj = buildGraphAdjacency(nextSigmaEdges);
      adjacency.clear();
      for (const [k, v] of freshAdj.entries()) {
        adjacency.set(k, v);
      }

      this.activeClusterCount = targetK;
      this.hoveredNodeId = null;
      this.secondaryHoveredNodeId = null;
      this.activeHighlightDists = null;
      this.focusedNodeIds = null;
      this.tooltipController?.clearFocus();
      rebuildDragController(nextSigmaNodes, nextSigmaEdges);
      this.kChange?.begin({
        prevNodes: prevPayloadNodes,
        prevPositions: prevPosById,
        nextNodes: nextSigmaNodes.map((n) => ({
          id: n.id,
          name: n.label,
          size: n.rawSize ?? 1,
          group: n.group ?? 0,
          colorDark: n.colorDark,
          colorLight: n.colorLight,
          originClusterId: n.originClusterId,
          originKind: n.originKind,
        })),
        nextStartPositions: startPos,
        mergeTargetByOldClusterId: nextCanonical.mergeTargetByOldClusterId,
      });
      this.sigma.refresh();
    };

    this.playKTransition = (nextPositions: Map<string, { x: number; y: number }>) => {
      const isLightNow = Boolean(this.isLight);
      return (
        this.kChange?.play(nextPositions, {
          onFrame: (tr, progress) => {
            if (!this.graph || !this.sigma) return;
            const g = this.graph;
            g.forEachNode((nId) => {
              const grp = (g.getNodeAttribute(nId, 'group') as number | undefined) ?? 0;
              const raw = this.nodeMap?.get(nId);
              const nextColor = {
                dark: raw?.colorDark ?? GRAPH_COLORS.dark[0],
                light: raw?.colorLight ?? GRAPH_COLORS.light[0],
              };
              if (grp === 0) {
                const s = sampleKChangeClusterPill(tr, nId, nextColor, isLightNow, progress);
                if (s) {
                  g.setNodeAttribute(nId, 'x', s.x);
                  g.setNodeAttribute(nId, 'y', s.y);
                }
              } else {
                const p = sampleKChangeNodePosition(tr, nId, progress);
                if (p) {
                  g.setNodeAttribute(nId, 'x', p.x);
                  g.setNodeAttribute(nId, 'y', p.y);
                }
                g.setNodeAttribute(nId, 'color', sampleKChangeNodeColor(tr, nId, nextColor, isLightNow, progress));
              }
            });
            this.sigma.refresh();
          },
          onFinish: () => {
            if (!this.graph || !this.sigma) return;
            for (const [id, p] of nextPositions) {
              if (!this.graph.hasNode(id)) continue;
              this.graph.setNodeAttribute(id, 'x', p.x);
              this.graph.setNodeAttribute(id, 'y', p.y);
              this.forcePositions.set(id, { x: p.x, y: p.y });
            }
            this.applyHighlight?.(null, true);
            this.dragController?.calibrateFromPositions(this.forcePositions);
          },
        }) ?? false
      );
    };

    const fgCanvas = document.createElement('canvas');
    fgCanvas.style.position = 'absolute';
    fgCanvas.style.inset = '0';
    fgCanvas.style.width = '100%';
    fgCanvas.style.height = '100%';
    fgCanvas.style.pointerEvents = 'none';
    fgCanvas.style.zIndex = '5';
    fgCanvas.style.touchAction = 'pan-y';
    container.appendChild(fgCanvas);
    this.fgCanvas = fgCanvas;

    const drawForegroundOverlay = () => {
      if (!this.fgCanvas || !this.sigma || !this.graph) return;
      const w = container.clientWidth || 0;
      const h = container.clientHeight || 0;
      if (w <= 0 || h <= 0) return;
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.round(w * dpr);
      const targetH = Math.round(h * dpr);
      if (this.fgCanvas.width !== targetW || this.fgCanvas.height !== targetH) {
        this.fgCanvas.width = targetW;
        this.fgCanvas.height = targetH;
      }
      const ctx = this.fgCanvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const dists = this.activeHighlightDists;
      const secId = this.secondaryHoveredNodeId ?? null;
      const currentIsLight = Boolean(this.isLight);
      const currentTokens = getGraphStyleTokens(currentIsLight);

      type DrawItem = {
        isNode: true;
        z: number;
        x: number;
        y: number;
        radius: number;
        group: number;
        color: string;
      };

      let activeContentCoverageMap: Map<string, number> | null = null;
      let activeClusterContentCoverageMap: Map<string, number> | null = null;
      if (dists) {
        this.graph.forEachNode(nId => {
          if (!this.graph || activeContentCoverageMap || activeClusterContentCoverageMap) return;
          if (dists.get(nId) === 0) {
            const grp = (this.graph.getNodeAttribute(nId, 'group') as number | undefined) ?? 0;
            if (grp !== 0) {
              activeContentCoverageMap = new Map<string, number>();
              this.graph.forEachEdge(nId, (_edge, attr, src, tgt) => {
                const otherId = src === nId ? tgt : src;
                const cov = (attr.coverage as number | undefined) ?? Number(attr.rawWeight ?? 0.5);
                activeContentCoverageMap!.set(otherId, cov);
              });
            } else {
              activeClusterContentCoverageMap = new Map<string, number>();
              this.graph.forEachEdge(nId, (_edge, attr, src, tgt) => {
                const otherId = src === nId ? tgt : src;
                const cov = (attr.coverage as number | undefined) ?? Number(attr.rawWeight ?? 0.5);
                activeClusterContentCoverageMap!.set(otherId, cov);
              });
            }
          }
        });
      }

      const items: DrawItem[] = [];

      this.graph.forEachNode(nId => {
        if (!this.graph || !this.sigma) return;
        const grp = (this.graph.getNodeAttribute(nId, 'group') as number | undefined) ?? 0;
        if (grp === 0) return;
        const hopDist = dists ? dists.get(nId) : undefined;
        const itemCov = activeClusterContentCoverageMap
          ? ((activeClusterContentCoverageMap as Map<string, number>).get(nId) ?? 0)
          : undefined;
        const nodeZ =
          secId !== null && nId === secId ? 48 : dists ? getNodeHopZIndex(hopDist, itemCov) : 2;
        const nx = Number(this.graph.getNodeAttribute(nId, 'x') || 0);
        const ny = Number(this.graph.getNodeAttribute(nId, 'y') || 0);
        const p = this.sigma.graphToViewport({ x: nx, y: ny });
        const rawSize = Number(this.graph.getNodeAttribute(nId, 'size') || currentTokens.nodeRadius);
        const rawNode = this.nodeMap?.get(nId);
        const color = String(this.graph.getNodeAttribute(nId, 'color') || getNodeColor(rawNode ?? grp, currentIsLight));
        items.push({
          isNode: true,
          z: nodeZ,
          x: p.x,
          y: p.y,
          radius: this.sigma.scaleSize(rawSize),
          group: grp,
          color
        });
      });

      if (items.length > 0) {
        items.sort((a, b) => a.z - b.z);
        ctx.save();
        ctx.lineCap = 'round';
        for (const item of items) {
          drawRegularPolygonNode2D(
            ctx,
            item.x,
            item.y,
            item.radius,
            item.group,
            item.color,
            item.color,
            1.5
          );
        }
        ctx.restore();
      }

      // Always-on Theme-Cluster pill labels (group === 0) centered directly at (p.x, p.y)

      const allCalloutNodes: { id: string; x: number; y: number; radiusPx: number; group?: number }[] = [];
      const clusterCalloutSpecs: {
        id: string;
        text: string;
        x: number;
        y: number;
        radiusPx: number;
        clusterColor?: string;
        hopDistance?: number;
        activeCoverage?: number;
        alphaOverride?: number;
        crossfadeFrom?: { text: string; blend: number };
      }[] = [];
      const kAct = this.kChange?.getActive() ?? null;

      this.graph.forEachNode(nId => {
        if (!this.graph || !this.sigma) return;
        const grp = (this.graph.getNodeAttribute(nId, 'group') as number | undefined) ?? 0;
        const nx = Number(this.graph.getNodeAttribute(nId, 'x') || 0);
        const ny = Number(this.graph.getNodeAttribute(nId, 'y') || 0);
        const p = this.sigma.graphToViewport({ x: nx, y: ny });
        const rawSizeAttr = Number(this.graph.getNodeAttribute(nId, 'size') || currentTokens.nodeRadius);
        const rScreen = this.sigma.scaleSize(rawSizeAttr);
        allCalloutNodes.push({ id: nId, x: p.x, y: p.y, radiusPx: rScreen, group: grp });
        if (grp === 0) {
          const rawNode = this.nodeMap?.get(nId);
          const name = String(this.graph.getNodeAttribute(nId, 'name') || rawNode?.label || nId);
          const hopDist = dists ? dists.get(nId) : undefined;
          const isSecHover = secId !== null && nId === secId;
          const effectiveHop = isSecHover ? 0 : dists ? (hopDist ?? 99) : undefined;
          const activeCoverage = activeContentCoverageMap
            ? ((activeContentCoverageMap as Map<string, number>).get(nId) ?? 0)
            : undefined;
          let pillColor = getNodeClusterColor(rawNode, currentIsLight);
          let pillAlpha: number | undefined;
          let pillXf: ClusterLabelCrossfade | null = null;
          if (kAct) {
            const s = sampleKChangeClusterPill(
              kAct.tr,
              nId,
              { dark: rawNode?.colorDark ?? GRAPH_COLORS.dark[0], light: rawNode?.colorLight ?? GRAPH_COLORS.light[0] },
              currentIsLight,
              kAct.progress
            );
            if (s) {
              pillColor = s.color;
              pillAlpha = s.alpha;
              pillXf = sampleKChangeClusterLabel(kAct.tr, nId, name, kAct.progress);
            }
          }
          clusterCalloutSpecs.push({
            id: nId,
            text: name,
            x: p.x,
            y: p.y,
            radiusPx: rScreen,
            clusterColor: pillColor,
            hopDistance: effectiveHop,
            activeCoverage,
            alphaOverride: pillAlpha,
            crossfadeFrom: pillXf ? { text: pillXf.oldLabel, blend: pillXf.blend } : undefined,
          });
        }
      });

      if (kAct) {
        for (const gp of sampleKChangeGhostPills(kAct.tr, kAct.progress)) {
          const gv = this.sigma.graphToViewport({ x: gp.x, y: gp.y });
          clusterCalloutSpecs.push({
            id: `ghost:${gp.id}`,
            text: gp.name,
            x: gv.x,
            y: gv.y,
            radiusPx: 0,
            clusterColor: currentIsLight ? gp.colorLight : gp.colorDark,
            alphaOverride: gp.alpha,
          });
        }
      }

      const dims = this.sigma.getDimensions();
      drawClusterCalloutLabels2D(ctx, allCalloutNodes, clusterCalloutSpecs, currentIsLight, dims);
    };

    this.sigma.on('afterRender', drawForegroundOverlay);

    const applyHighlight = (activeNodeId: string | null, immediate = false) => {
      if (!this.graph || !this.sigma) return;
      const secId = this.secondaryHoveredNodeId ?? null;
      const highlightKey = `${activeNodeId ?? ''}|${secId ?? ''}`;
      if (!immediate && highlightKey === lastHighlightedKey) return;
      lastHighlightedKey = highlightKey;

      if (this.highlightFrameId) {
        cancelAnimationFrame(this.highlightFrameId);
        this.highlightFrameId = null;
      }

      const currentIsLight = Boolean(this.isLight);
      const currentTokens = getGraphStyleTokens(currentIsLight);
      const dists = activeNodeId ? computeHopDistances(activeNodeId, adjacency) : null;
      this.activeHighlightDists = dists;

      let activeClusterContentCov: Map<string, number> | null = null;
      if (activeNodeId && this.graph.hasNode(activeNodeId)) {
        const activeGrp = (this.graph.getNodeAttribute(activeNodeId, 'group') as number | undefined) ?? 0;
        if (activeGrp === 0) {
          activeClusterContentCov = new Map<string, number>();
          this.graph.forEachEdge(activeNodeId, (_edge, attr, src, tgt) => {
            const otherId = src === activeNodeId ? tgt : src;
            const cov = (attr.coverage as number | undefined) ?? Number(attr.rawWeight ?? 0.5);
            activeClusterContentCov!.set(otherId, cov);
          });
        }
      }

      const nodeTrans: {
        id: string;
        startColor: string;
        targetColor: string;
        startSize: number;
        targetSize: number;
        targetZIndex: number;
        changed: boolean;
      }[] = [];

      this.graph.forEachNode(nId => {
        const grp = (this.graph?.getNodeAttribute(nId, 'group') as number | undefined) ?? 0;
        const rawSize = Number(this.graph?.getNodeAttribute(nId, 'rawSize') ?? 1);
        const rawNode = this.nodeMap?.get(nId);
        const baseColor = getNodeColor(rawNode ?? grp, currentIsLight);
        const startColor = String(this.graph?.getNodeAttribute(nId, 'color') || baseColor);
        const restScale = getNodeRestRadiusScale(grp, rawSize);
        const startSize = Number(this.graph?.getNodeAttribute(nId, 'size') || (currentTokens.nodeRadius * restScale));
        const hopDist = dists ? dists.get(nId) : undefined;
        const isSecHover = secId !== null && nId === secId;
        const itemCov =
          activeClusterContentCov && grp !== 0
            ? (activeClusterContentCov.get(nId) ?? 0)
            : undefined;
        const baseScale = dists ? getAttenuatedNodeScale(hopDist, itemCov) : 1;
        const targetScale = isSecHover ? Math.max(baseScale * 1.15, 1.32) : baseScale;
        const targetColor = isSecHover
          ? baseColor
          : dists
            ? getAttenuatedNodeColor(baseColor, hopDist, currentIsLight, itemCov)
            : baseColor;
        const targetSize = currentTokens.nodeRadius * restScale * targetScale;
        const targetZIndex = dists
          ? (isSecHover ? 45 : getNodeHopZIndex(hopDist, itemCov))
          : 1;
        nodeTrans.push({
          id: nId,
          startColor,
          targetColor,
          startSize,
          targetSize,
          targetZIndex,
          changed: startColor !== targetColor || Math.abs(startSize - targetSize) > 1e-3
        });
      });

      const edgeTrans: {
        id: string;
        startColor: string;
        targetColor: string;
        startSize: number;
        targetSize: number;
        targetZIndex: number;
        changed: boolean;
      }[] = [];

      this.graph.forEachEdge(edge => {
        const [src, tgt] = this.graph!.extremities(edge);
        const rawWeight = Number(this.graph?.getEdgeAttribute(edge, 'rawWeight') ?? 0.5);
        const startColor = String(this.graph?.getEdgeAttribute(edge, 'color') || currentTokens.edgeColor);
        const startSize = Number(this.graph?.getEdgeAttribute(edge, 'size') || currentTokens.edgeWidth);
        const dSrc = dists ? dists.get(src) : undefined;
        const dTgt = dists ? dists.get(tgt) : undefined;
        const targetStyle = dists
          ? getAttenuatedEdgeStyle(dSrc, dTgt, currentIsLight, rawWeight)
          : getRestEdgeStyle(rawWeight, currentIsLight);
        const targetZIndex = dists ? getEdgeHopZIndex(dSrc, dTgt) : (isBackboneEdge(rawWeight) ? 2 : 0);
        edgeTrans.push({
          id: edge,
          startColor,
          targetColor: targetStyle.color,
          startSize,
          targetSize: targetStyle.width,
          targetZIndex,
          changed: startColor !== targetStyle.color || Math.abs(startSize - targetStyle.width) > 1e-3
        });
      });

      if (dists || secId) {
        for (const nt of nodeTrans) {
          this.graph.setNodeAttribute(nt.id, 'zIndex', nt.targetZIndex);
        }
        for (const et of edgeTrans) {
          this.graph.setEdgeAttribute(et.id, 'zIndex', et.targetZIndex);
        }
      }

      const renderStep = (ease: number, applyZIndex: boolean) => {
        if (!this.graph || !this.sigma) return;
        for (const nt of nodeTrans) {
          if (nt.changed || ease >= 1) {
            this.graph.setNodeAttribute(nt.id, 'color', ease >= 1 ? nt.targetColor : interpolateHexColor(nt.startColor, nt.targetColor, ease));
            this.graph.setNodeAttribute(nt.id, 'size', ease >= 1 ? nt.targetSize : nt.startSize + (nt.targetSize - nt.startSize) * ease);
          }
          if (applyZIndex) {
            this.graph.setNodeAttribute(nt.id, 'zIndex', nt.targetZIndex);
          }
        }
        for (const et of edgeTrans) {
          if (et.changed || ease >= 1) {
            this.graph.setEdgeAttribute(et.id, 'color', ease >= 1 ? et.targetColor : interpolateHexColor(et.startColor, et.targetColor, ease));
            this.graph.setEdgeAttribute(et.id, 'size', ease >= 1 ? et.targetSize : et.startSize + (et.targetSize - et.startSize) * ease);
          }
          if (applyZIndex) {
            this.graph.setEdgeAttribute(et.id, 'zIndex', et.targetZIndex);
          }
        }
        this.sigma.refresh();
      };

      if (immediate) {
        renderStep(1, true);
        return;
      }

      const startTime = performance.now();
      const step = (now: number) => {
        if (!this.graph || !this.sigma) {
          this.highlightFrameId = null;
          return;
        }
        const progress = Math.min(1, (now - startTime) / HIGHLIGHT_TRANSITION_MS);
        const ease = easeHighlightTransition(progress);
        const isFinal = progress >= 1;
        renderStep(ease, isFinal && !dists && !secId);
        if (!isFinal) {
          this.highlightFrameId = requestAnimationFrame(step);
        } else {
          this.highlightFrameId = null;
        }
      };
      this.highlightFrameId = requestAnimationFrame(step);
    };
    this.applyHighlight = applyHighlight;

    this.tooltipController.bindProximityInteraction({
      getScreenNodes: () => {
        if (!this.sigma || !this.graph || !this.nodeMap) return [];
        const result: { node: RawGraphNode; x: number; y: number }[] = [];
        for (const [id, rawNode] of this.nodeMap.entries()) {
          if (!this.graph.hasNode(id)) continue;
          const nx = this.graph.getNodeAttribute(id, 'x') as number;
          const ny = this.graph.getNodeAttribute(id, 'y') as number;
          const viewportPos = this.sigma.graphToViewport({ x: nx, y: ny });
          result.push({
            node: {
              id: rawNode.id,
              name: rawNode.label,
              size: rawNode.rawSize ?? rawNode.size,
              group: rawNode.group,
              colorDark: rawNode.colorDark,
              colorLight: rawNode.colorLight,
              typeLabel: rawNode.typeLabel,
              description: rawNode.description,
              date: rawNode.date,
              image: rawNode.image,
              tags: rawNode.tags
            },
            x: viewportPos.x,
            y: viewportPos.y
          });
        }
        return result;
      },
      adjacency,
      isLight: () => Boolean(this.isLight),
      isDragging: () => draggedNode !== null,
      getLastDraggedAt: () => this.lastDraggedAt || 0,
      onActiveNodeChange: (nodeId) => {
        this.hoveredNodeId = nodeId;
        if (draggedNode === null) {
          applyHighlight(nodeId);
        }
      },
      onSecondaryHoverNodeChange: (nodeId) => {
        this.secondaryHoveredNodeId = nodeId;
        if (draggedNode === null) {
          applyHighlight(this.hoveredNodeId ?? null);
        }
      },
      onFocusNodeChange: (_nodeId, focusNodeIds) => {
        this.focusedNodeIds = focusNodeIds;
        this.startViewportAdaptLoop(1600, GRAPH_VIEWPORT_CONFIG.focusAlpha);
      },
      onNavigate: (rawNode) => {
        const node = rawNode.id;
        if (
          node.startsWith('/posts/') ||
          node.startsWith('/publications/') ||
          node.startsWith('/presentations/') ||
          node.startsWith('/projects/') ||
          node.startsWith('/courses/') ||
          node.startsWith('/services/') ||
          node.startsWith('/newsletters/') ||
          node.startsWith('/visualizations/') ||
          node.startsWith('/tags/')
        ) {
          const targetUrl = new URL(node, window.location.origin);
          targetUrl.searchParams.set('utm_source', utmSource);
          targetUrl.searchParams.set('utm_medium', utmMedium);
          targetUrl.searchParams.set('utm_campaign', utmCampaign);
          window.location.href = targetUrl.pathname + targetUrl.search;
        }
      },
      onNodeDragStart: (rawNode, sx, sy) => {
        this.kChange?.finish();
        if (!this.sigma || !this.graph) return;
        draggedNode = rawNode.id;
        this.hoveredNodeId = draggedNode;
        this.lastDraggedAt = performance.now();
        applyHighlight(draggedNode);

        if (this.viewportAdaptFrameId) {
          cancelAnimationFrame(this.viewportAdaptFrameId);
          this.viewportAdaptFrameId = null;
        }
        if (!this.sigma.getCustomBBox()) {
          this.sigma.setCustomBBox(this.sigma.getBBox());
        }
        if (this.animationFrameId) {
          cancelAnimationFrame(this.animationFrameId);
          this.animationFrameId = null;
        }

        const pos = this.sigma.viewportToGraph({ x: sx, y: sy });
        this.graph.setNodeAttribute(draggedNode, 'x', pos.x);
        this.graph.setNodeAttribute(draggedNode, 'y', pos.y);

        if (this.currentLayout === 'force') {
          this.forcePositions.set(draggedNode, { x: pos.x, y: pos.y });
          this.dragController?.startDrag(draggedNode, pos);
          this.sigma.refresh();
        } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          const { signature } = this.computeLayoutTargets(this.currentLayout, true);
          this.lastOrderSignature = signature;
          this.sigma.refresh();
        }
      },
      onNodeDragMove: (rawNode, sx, sy) => {
        if (!this.sigma || !this.graph) return;
        this.lastDraggedAt = performance.now();
        const pos = this.sigma.viewportToGraph({ x: sx, y: sy });
        this.graph.setNodeAttribute(rawNode.id, 'x', pos.x);
        this.graph.setNodeAttribute(rawNode.id, 'y', pos.y);

        if (this.currentLayout === 'force') {
          this.forcePositions.set(rawNode.id, { x: pos.x, y: pos.y });
          this.dragController?.moveDrag(rawNode.id, pos);
          this.sigma.refresh();
        } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          const { targets, signature } = this.computeLayoutTargets(this.currentLayout, true);
          if (signature !== this.lastOrderSignature) {
            this.lastOrderSignature = signature;
            this.animateTo(targets, 250, rawNode.id, false);
          } else {
            this.sigma.refresh();
          }
        }
      },
      onNodeDragEnd: (rawNode) => {
        draggedNode = null;
        this.hoveredNodeId = null;
        this.lastDraggedAt = performance.now();
        applyHighlight(null);

        if (this.currentLayout === 'force' && this.graph) {
          const pos = {
            x: Number(this.graph.getNodeAttribute(rawNode.id, 'x') || 0),
            y: Number(this.graph.getNodeAttribute(rawNode.id, 'y') || 0)
          };
          this.forcePositions.set(rawNode.id, pos);
          this.dragController?.endDrag(rawNode.id, pos);
          this.startViewportAdaptLoop(2400);
        } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          const { targets } = this.computeLayoutTargets(this.currentLayout, true);
          this.animateTo(targets, 650, undefined, false);
          this.startViewportAdaptLoop(2400);
        }
      }
    });

    this.isLight = isLight;
    if (layout === 'force') {
      this.currentLayout = 'force';
      this.stepViewportTowardCloud(1);
    } else {
      this.updateLayout(layout, isLight);
    }

    // Bind ResizeObserver to handle container size changes dynamically
    let lastWidth = container.clientWidth;
    let lastHeight = container.clientHeight;
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (Math.abs(width - lastWidth) >= 1 || Math.abs(height - lastHeight) >= 1) {
          lastWidth = width;
          lastHeight = height;
          if (this.sigma && draggedNode === null) {
            this.stepViewportTowardCloud(1);
          }
        }
      }
    });
    this.resizeObserver.observe(container);

    return this;
  },

  stepViewportTowardCloud(alpha: number) {
    if (!this.sigma || !this.graph) return;
    let fullMinX = Infinity;
    let fullMaxX = -Infinity;
    let fullMinY = Infinity;
    let fullMaxY = -Infinity;

    let subMinX = Infinity;
    let subMaxX = -Infinity;
    let subMinY = Infinity;
    let subMaxY = -Infinity;
    const isSubgraph = Boolean(this.focusedNodeIds && this.focusedNodeIds.size > 0);

    this.graph.forEachNode((nodeId) => {
      const nx = Number(this.graph?.getNodeAttribute(nodeId, 'x') ?? 0);
      const ny = Number(this.graph?.getNodeAttribute(nodeId, 'y') ?? 0);
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
      if (nx < fullMinX) fullMinX = nx;
      if (nx > fullMaxX) fullMaxX = nx;
      if (ny < fullMinY) fullMinY = ny;
      if (ny > fullMaxY) fullMaxY = ny;

      if (isSubgraph && this.focusedNodeIds!.has(nodeId)) {
        if (nx < subMinX) subMinX = nx;
        if (nx > subMaxX) subMaxX = nx;
        if (ny < subMinY) subMinY = ny;
        if (ny > subMaxY) subMaxY = ny;
      }
    });

    if (!Number.isFinite(fullMinX) || !Number.isFinite(fullMaxX)) return;
    if (fullMaxX - fullMinX < 1e-3) {
      fullMinX -= 1;
      fullMaxX += 1;
    }
    if (fullMaxY - fullMinY < 1e-3) {
      fullMinY -= 1;
      fullMaxY += 1;
    }

    let minX = fullMinX;
    let maxX = fullMaxX;
    let minY = fullMinY;
    let maxY = fullMaxY;

    if (!isSubgraph && this.currentLayout === 'radial') {
      const maxR =
        12 *
          (GRAPH_GEOMETRY_LAYOUT_CONFIG.radialMaxOuterRatio /
            GRAPH_GEOMETRY_LAYOUT_CONFIG.radialOuterRatio) +
        1.2;
      minX = -maxR;
      maxX = maxR;
      minY = -maxR;
      maxY = maxR;
    }

    if (isSubgraph && Number.isFinite(subMinX) && Number.isFinite(subMaxX)) {
      const fullSpanX = Math.max(1e-3, fullMaxX - fullMinX);
      const fullSpanY = Math.max(1e-3, fullMaxY - fullMinY);
      const subMidX = (subMinX + subMaxX) / 2;
      const subMidY = (subMinY + subMaxY) / 2;
      const zoomFactor = Math.max(
        0.42,
        Math.min(1, Math.max((subMaxX - subMinX) / fullSpanX, (subMaxY - subMinY) / fullSpanY) * 1.35)
      );
      minX = subMidX - (fullSpanX * zoomFactor) / 2;
      maxX = subMidX + (fullSpanX * zoomFactor) / 2;
      minY = subMidY - (fullSpanY * zoomFactor) / 2;
      maxY = subMidY + (fullSpanY * zoomFactor) / 2;
    }

    const curBBox = this.sigma.getCustomBBox() || {
      x: [minX, maxX] as [number, number],
      y: [minY, maxY] as [number, number]
    };
    const t = Math.max(0, Math.min(1, alpha));

    const nextMinX = curBBox.x[0] + (minX - curBBox.x[0]) * t;
    const nextMaxX = curBBox.x[1] + (maxX - curBBox.x[1]) * t;
    const nextMinY = curBBox.y[0] + (minY - curBBox.y[0]) * t;
    const nextMaxY = curBBox.y[1] + (maxY - curBBox.y[1]) * t;

    this.sigma.setCustomBBox({
      x: [nextMinX, nextMaxX],
      y: [nextMinY, nextMaxY]
    });

    const cam = this.sigma.getCamera();
    const state = cam.getState();
    cam.setState({
      x: state.x + (0.5 - state.x) * t,
      y: state.y + (0.5 - state.y) * t,
      ratio: state.ratio + (1 - state.ratio) * t
    });
    this.sigma.refresh();
  },

  startViewportAdaptLoop(
    durationMs = GRAPH_VIEWPORT_CONFIG.adaptDurationMs,
    baseAlpha: number = GRAPH_VIEWPORT_CONFIG.adaptAlpha
  ) {
    if (this.viewportAdaptFrameId) {
      cancelAnimationFrame(this.viewportAdaptFrameId);
      this.viewportAdaptFrameId = null;
    }
    const startTime = performance.now();
    let lastTime = startTime;
    const tick = (now: number) => {
      if (!this.sigma || !this.graph) {
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
        this.viewportAdaptFrameId = null;
      }
    };
    this.viewportAdaptFrameId = requestAnimationFrame(tick);
  },

  computeLayoutTargets(layout: string, useCurrentOrder = false) {
    if (!this.graph || (layout !== 'radial' && layout !== 'columns')) {
      return { targets: {}, signature: '' };
    }
    const solverNodes: SolverGraphNode[] = this.graph.nodes().map(nId => ({
      id: nId,
      group: Number(this.graph?.getNodeAttribute(nId, 'group') ?? 0),
      x: Number(this.graph?.getNodeAttribute(nId, 'x') ?? 0),
      y: Number(this.graph?.getNodeAttribute(nId, 'y') ?? 0)
    }));
    return compute2DGeometryTargets(solverNodes, layout, {
      useCurrentOrder,
      scaleMode: 'sigma-world',
      isMobile: window.innerWidth < 768
    });
  },

  getLivePositions(): Map<string, { x: number; y: number }> {
    const live = new Map<string, { x: number; y: number }>();
    this.graph?.forEachNode((nId) => {
      live.set(nId, {
        x: Number(this.graph?.getNodeAttribute(nId, 'x') ?? 0),
        y: Number(this.graph?.getNodeAttribute(nId, 'y') ?? 0),
      });
    });
    return live;
  },

  getForcePositions(): Record<string, { x: number; y: number }> {
    const targets: Record<string, { x: number; y: number }> = {};
    if (this.forcePositions.size > 0) {
      for (const [id, pos] of this.forcePositions.entries()) {
        targets[id] = { x: pos.x, y: pos.y };
      }
      return targets;
    }
    if (!this.payload) return targets;

    const solved = solveSigmaForceAtlas2Layout({
      nodes: this.payload.sigma.nodes,
      connections: this.payload.sigma.edges
    });

    for (const [nodeId, pt] of Object.entries(solved)) {
      targets[nodeId] = { x: pt.x, y: pt.y };
      this.forcePositions.set(nodeId, { x: pt.x, y: pt.y });
    }

    return targets;
  },

  updateLayout(layout: string, isLight: boolean) {
    if (!this.graph || !this.sigma) return;
    const layoutChanged = this.currentLayout !== layout;
    this.currentLayout = layout;
    this.isLight = isLight;

    if (layoutChanged) {
      this.tuningGeneration = (this.tuningGeneration || 0) + 1;
      this.tuningInFlight = false;
      this.focusedNodeIds = null;
      this.tooltipController?.clearFocus();
      this.dragController?.stop();
      this.kChange?.discard();
      this.sigma.setCustomBBox(null);
    }

    // Apply color update to nodes and edges based on theme (and preserve any active highlight)
    const tokens = getThemeTokens(isLight);
    const styleTokens = getGraphStyleTokens(isLight);
    this.sigma.setSetting('labelColor', { color: tokens.textHeading });
    this.sigma.setSetting('defaultEdgeColor', styleTokens.edgeColor);
    this.applyHighlight?.(this.hoveredNodeId ?? null, true);

    if (!layoutChanged) {
      this.sigma.refresh();
      return;
    }

    if (layout === 'radial' || layout === 'columns') {
      const { targets, signature } = this.computeLayoutTargets(layout, false);
      this.lastOrderSignature = signature;
      this.animateTo(targets, 600, undefined, true);
    } else {
      const targets = this.getForcePositions();
      this.animateTo(targets, 600, undefined, true);
    }
  },

  applyTuning(category: 'physics' | 'geometry' | 'visual' | 'reset') {
    if (!this.graph || !this.sigma) return;
    if (category === 'visual') {
      const styleTokens = getGraphStyleTokens(Boolean(this.isLight));
      this.sigma.setSetting('defaultEdgeColor', styleTokens.edgeColor);
      this.applyHighlight?.(this.hoveredNodeId ?? null, true);
      return;
    }
    if (category === 'geometry') {
      if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
        const { targets, signature } = this.computeLayoutTargets(this.currentLayout, true);
        this.lastOrderSignature = signature;
        this.animateTo(targets, 350, undefined, true);
      }
      return;
    }
    if (category === 'physics') {
      this.kChange?.finish();
      const targetK = getGraphTuningState().clusterCount;
      if (this.activeClusterCount !== targetK) {
        this.rebuildClusterTopology?.(targetK);
      }
      const gen = (this.tuningGeneration = (this.tuningGeneration || 0) + 1);
      this.dragController?.stop();
      this.graph.forEachEdge(edge => {
        const rawW = Number(this.graph?.getEdgeAttribute(edge, 'rawWeight') ?? 0.5);
        this.graph?.setEdgeAttribute(edge, 'weight', getEdgePhysicsMetrics(rawW).stiffnessFactor);
      });
      if (this.currentLayout === 'force' && this.payload) {
        {
          this.tuningInFlight = true;
          void solveSigmaForceAtlas2LayoutAsync(
            {
              nodes: this.payload.sigma.nodes,
              connections: this.payload.sigma.edges,
              seedPositions: this.kChange?.getSeedPositions() ?? this.getLivePositions(),
            },
            { shouldCancel: () => this.tuningGeneration !== gen }
          ).then((solved) => {
            if (!solved || this.tuningGeneration !== gen || !this.graph || !this.sigma) return;
            this.tuningInFlight = false;
            if (this.currentLayout !== 'force') return;
            this.forcePositions.clear();
            for (const [nodeId, pt] of Object.entries(solved)) {
              this.forcePositions.set(nodeId, { x: pt.x, y: pt.y });
            }
            if (this.kChange?.hasPending()) {
              const solvedMap = new Map<string, { x: number; y: number }>();
              for (const [nodeId, pt] of Object.entries(solved)) solvedMap.set(nodeId, { x: pt.x, y: pt.y });
              if (this.playKTransition?.(solvedMap)) {
                this.startViewportAdaptLoop(1400);
                return;
              }
            }
            this.animateTo(solved, 450, undefined, true);
          });
        }
      } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
        const { targets, signature } = this.computeLayoutTargets(this.currentLayout, true);
        this.lastOrderSignature = signature;
        this.animateTo(targets, 450, undefined, true);
      }
      return;
    }
    if (category === 'reset') {
      this.tuningGeneration = (this.tuningGeneration || 0) + 1;
      this.tuningInFlight = false;
      this.dragController?.stop();
      this.kChange?.finish();
      const resetK = getGraphTuningState().clusterCount;
      if (this.activeClusterCount !== resetK) {
        this.rebuildClusterTopology?.(resetK, { restoreDefault: true });
      }
      this.forcePositions.clear();
      for (const [id, pos] of this.initialForcePositions.entries()) {
        this.forcePositions.set(id, { x: pos.x, y: pos.y });
      }
      this.graph.forEachEdge(edge => {
        const rawW = Number(this.graph?.getEdgeAttribute(edge, 'rawWeight') ?? 0.5);
        this.graph?.setEdgeAttribute(edge, 'weight', getEdgePhysicsMetrics(rawW).stiffnessFactor);
      });
      const styleTokens = getGraphStyleTokens(Boolean(this.isLight));
      this.sigma.setSetting('defaultEdgeColor', styleTokens.edgeColor);
      this.applyHighlight?.(this.hoveredNodeId ?? null, true);
      if (this.currentLayout === 'force') {
        const targets: Record<string, { x: number; y: number }> = {};
        for (const [id, pos] of this.initialForcePositions.entries()) {
          targets[id] = { x: pos.x, y: pos.y };
        }
        if (this.kChange?.hasPending() && this.playKTransition?.(new Map(this.initialForcePositions))) {
          this.startViewportAdaptLoop(1400);
          return;
        }
        this.animateTo(targets, 450, undefined, true);
      } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
        this.kChange?.discard();
        const { targets, signature } = this.computeLayoutTargets(this.currentLayout, false);
        this.lastOrderSignature = signature;
        this.animateTo(targets, 450, undefined, true);
      }
    }
  },

  animateTo(targets: Record<string, { x: number; y: number }>, duration = 600, excludeNodeId?: string, resetCamera = true) {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    const startTime = performance.now();
    const startPositions: Record<string, { x: number; y: number }> = {};
    this.graph?.forEachNode(node => {
      startPositions[node] = {
        x: this.graph?.getNodeAttribute(node, 'x') as number,
        y: this.graph?.getNodeAttribute(node, 'y') as number
      };
    });

    const step = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing: easeInOutCubic
      const ease = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.graph?.forEachNode(node => {
        if (excludeNodeId && node === excludeNodeId) return;
        const start = startPositions[node];
        const target = targets[node];
        if (start && target) {
          const currentX = start.x + (target.x - start.x) * ease;
          const currentY = start.y + (target.y - start.y) * ease;
          this.graph?.setNodeAttribute(node, 'x', currentX);
          this.graph?.setNodeAttribute(node, 'y', currentY);
        }
      });

      if (this.sigma) {
        if (resetCamera) {
          this.stepViewportTowardCloud(progress < 1 ? 0.25 : 1);
        } else {
          this.sigma.refresh();
        }
      }

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.animationFrameId = null;
        if (this.currentLayout === 'force' && !excludeNodeId) {
          for (const [id, pt] of Object.entries(targets)) {
            this.forcePositions.set(id, { x: pt.x, y: pt.y });
          }
          this.dragController?.calibrateFromPositions(this.forcePositions);
        }
        if (resetCamera && this.sigma) {
          this.stepViewportTowardCloud(1);
        }
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  },

  destroy() {
    this.kChange?.destroy();
    this.kChange = null;
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
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.container && this.mouseMoveHandler) {
      this.container.removeEventListener('mousemove', this.mouseMoveHandler);
      this.mouseMoveHandler = null;
      this.container = null;
    }
    if (this.tooltipController) {
      this.tooltipController.destroy();
      this.tooltipController = null;
    }
    if (this.fgCanvas) {
      this.fgCanvas.remove();
      this.fgCanvas = null;
    }
    this.activeHighlightDists = null;
    if (this.sigma) {
      this.sigma.kill();
      this.sigma = null;
    }
    this.nodeMap = null;
    this.graph = null;
  }
};

export default engine;
