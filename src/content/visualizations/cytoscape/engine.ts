import cytoscape, { type Core, type NodeSingular } from 'cytoscape';
import {
  DEFAULT_TOPIC_CLUSTER_COUNT,
  GRAPH_COLORS,
  GRAPH_VIEWPORT_CONFIG,
  HIGHLIGHT_TRANSITION_MS,
  drawClusterCalloutLabels2D,
  drawRegularPolygonNode2D,
  easeHighlightTransition,
  getCytoscapePolygonPoints,
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
  computeKChangeStartPositions,
  resolveKChangeCanonical,
  sampleKChangeClusterLabel,
  sampleKChangeClusterPill,
  sampleKChangeGhostPills,
  sampleKChangeNodeColor,
  sampleKChangeNodePosition,
  type CanonicalGraphPayload,
  type ClusterLabelCrossfade,
  type GraphNodePayload
} from '@commons/shared/graph-payload';
import {
  compute2DGeometryTargets,
  solveCytoscapeCoseLayout,
  solveCytoscapeCoseLayoutAsync,
  type SolverGraphEdge,
  type SolverGraphNode,
} from '@commons/shared/graph-solvers';
import {
  createGraphDragPhysicsController2D,
  type GraphDragPhysicsController2D,
} from '@commons/client/graph-drag-controller';
import { createKChangeController, type KChangeController } from '@commons/client/graph-k-transition';
import { createGraphTooltipController, type GraphTooltipController, type RawGraphNode } from '@commons/client/vis-tooltip';

function getNodeColor(node: NodeSingular, isLight: boolean): string {
  const grp = node.data('group') ?? 0;
  const colors = isLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;
  return (
    getNodeBaseColor(
      {
        group: grp,
        colorDark: node.data('colorDark'),
        colorLight: node.data('colorLight'),
      },
      isLight
    ) ||
    colors[grp] ||
    colors[0]
  );
}

export interface CytoscapeNodeMeta {
  id: string;
  name: string;
  size: number;
  group: number;
  colorDark?: string;
  colorLight?: string;
  typeLabel?: string;
  description?: string;
  date?: string;
  image?: string;
  tags?: string[];
  originClusterId?: string;
  originKind?: 'match' | 'split';
}

export interface CytoscapeEdgeMeta {
  id: string;
  source: string;
  target: string;
  weight: number;
  coverage?: number;
}

export interface CytoscapeEngine {
  layouts: { id: string; label: string }[];
  cy: Core | null;
  canonicalPayload?: CanonicalGraphPayload | null;
  activeClusterCount?: number;
  rebuildClusterTopology?(targetK: number, opts?: { restoreDefault?: boolean }): void;
  kChange?: KChangeController | null;
  playKTransition?(nextPositions: Map<string, { x: number; y: number }>): boolean;
  tooltipController: GraphTooltipController | null;
  fgCanvas?: HTMLCanvasElement | null;
  drawScene?: (() => void) | null;
  syncPositionsToCy?: (() => void) | null;
  nodeMetaList: CytoscapeNodeMeta[];
  edgeMetaList: CytoscapeEdgeMeta[];
  modelPositions: Map<string, { x: number; y: number }>;
  activeHighlightDists?: Map<string, number> | null;
  hoveredNodeId?: string | null;
  secondaryHoveredNodeId?: string | null;
  focusedNodeIds?: Set<string> | null;
  highlightFrameId?: number | null;
  applyHighlight?(activeId: string | null, immediate?: boolean): void;
  currentLayout?: string;
  isLight?: boolean;
  initialized?: boolean;
  lastDraggedAt?: number;
  lastOrderSignature?: string;
  forcePositions: Map<string, { x: number; y: number }>;
  initialForcePositions: Map<string, { x: number; y: number }>;
  tuningGeneration?: number;
  tuningInFlight?: boolean;
  dragController?: GraphDragPhysicsController2D | null;
  calibrateDragEquilibrium?(syncFromCy?: boolean): void;
  solveHeadlessCoseTargets(): Record<string, { x: number; y: number }>;
  animationFrameId?: number | null;
  viewportAdaptFrameId?: number | null;
  resizeObserver: ResizeObserver | null;
  init(container: HTMLElement, payload: { canonical?: CanonicalGraphPayload; cytoscape: { elements: cytoscape.ElementsDefinition } }, layout: string, isLight: boolean, extraOptions?: Record<string, string>): Promise<CytoscapeEngine>;
  stepViewportTowardCloud(alpha: number): void;
  startViewportAdaptLoop(durationMs?: number, baseAlpha?: number): void;
  runLayout(mode: string, animate: boolean): void;
  getOrderSignature(layout: string): string;
  computeLayoutTargets(layout: string, useCurrentOrder?: boolean): Record<string, { x: number; y: number }>;
  animateTo(targets: Record<string, { x: number; y: number }>, duration?: number, excludeNodeId?: string, fitOnStep?: boolean, animateFitAfter?: boolean): void;
  updateLayout(layout: string, isLight: boolean, forceRecompute?: boolean): void;
  applyTuning(category: 'physics' | 'geometry' | 'visual' | 'reset'): void;
  destroy(): void;
}

const engine: CytoscapeEngine = {
  layouts: [
    { id: 'force', label: 'Force Directed (Organic)' },
    { id: 'radial', label: 'Concentric Rings (Tags → Items)' },
    { id: 'columns', label: 'Structured Columns (Category)' }
  ],
  cy: null,
  tooltipController: null,
  drawScene: null,
  syncPositionsToCy: null,
  nodeMetaList: [],
  edgeMetaList: [],
  modelPositions: new Map(),
  initialized: false,
  lastDraggedAt: 0,
  lastOrderSignature: '',
  forcePositions: new Map(),
  initialForcePositions: new Map(),
  tuningGeneration: 0,
  tuningInFlight: false,
  dragController: null,
  animationFrameId: null,
  viewportAdaptFrameId: null,
  resizeObserver: null,

  async init(container: HTMLElement, payload: { canonical?: CanonicalGraphPayload; cytoscape: { elements: cytoscape.ElementsDefinition } }, layout: string, isLight: boolean, extraOptions: Record<string, string> = {}) {
    const styleTokens = getGraphStyleTokens(isLight);
    const baseDiameter = styleTokens.nodeRadius * 2;

    this.initialized = false;
    this.isLight = isLight;
    this.hoveredNodeId = null;
    this.secondaryHoveredNodeId = null;
    this.activeHighlightDists = null;
    this.lastDraggedAt = 0;
    this.lastOrderSignature = '';
    this.nodeMetaList = [];
    this.edgeMetaList = [];
    this.modelPositions = new Map();
    this.forcePositions = new Map();
    this.initialForcePositions = new Map();
    this.tuningGeneration = (this.tuningGeneration || 0) + 1;
    this.tuningInFlight = false;
    this.canonicalPayload = payload.canonical ?? null;

    this.cy = cytoscape({
      container: container,
      userZoomingEnabled: false,
      userPanningEnabled: false,
      boxSelectionEnabled: false,
      autounselectify: true,
      autoungrabify: true,
      elements: payload.cytoscape.elements,
      style: [
        {
          selector: 'node',
          style: {
            'shape': 'polygon',
            'shape-polygon-points': (node: NodeSingular) =>
              getCytoscapePolygonPoints(node.data('group') ?? 1).join(' '),
            'background-color': (node: NodeSingular) => getNodeColor(node, isLight),
            'label': '',
            'width': baseDiameter,
            'height': baseDiameter,
            'border-width': '1.5px',
            'border-color': (node: NodeSingular) => getNodeColor(node, isLight),
            'overlay-opacity': 0,
            'events': 'no'
          }
        },
        {
          selector: 'node[group = 0]',
          style: {
            'background-opacity': 0,
            'border-width': 0
          }
        },
        {
          selector: 'edge',
          style: {
            'width': styleTokens.edgeWidth,
            'line-color': styleTokens.edgeColor,
            'opacity': 0,
            'line-opacity': 0,
            'curve-style': 'straight',
            'overlay-opacity': 0,
            'events': 'no'
          }
        }
      ],
      layout: { name: 'preset', fit: false }
    });

    // Hide Cytoscape's internal base canvas wrapper so we don't double-rasterize
    // 1,376 elements underneath our hardware-accelerated 2D scene canvas.
    const cyInternalWrapper = container.firstElementChild as HTMLElement | null;
    if (cyInternalWrapper) {
      cyInternalWrapper.style.visibility = 'hidden';
      cyInternalWrapper.style.pointerEvents = 'none';
    }

    let cyNodes = this.cy.nodes().toArray();
    const cyEdges = this.cy.edges().toArray();
    const nodeDisplayColorMap = new Map<string, string>();
    const nodeDisplaySizeMap = new Map<string, number>();
    const edgeDisplayColorMap = new Map<string, string>();
    const edgeDisplayWidthMap = new Map<string, number>();

    const palette = isLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;
    const controllerNodes: { id: string; group: number; x: number; y: number }[] = [];

    for (const n of cyNodes) {
      const id = n.id();
      const data = n.data();
      const group = Number(data.group ?? 0);
      const rawSize = Number(data.rawSize ?? data.size ?? 1);
      const pos = n.position();
      const px = Number.isFinite(pos.x) ? pos.x : 0;
      const py = Number.isFinite(pos.y) ? pos.y : 0;
      const col =
        getNodeBaseColor(
          { group, colorDark: data.colorDark, colorLight: data.colorLight },
          isLight
        ) ||
        palette[group] ||
        palette[0];

      this.modelPositions.set(id, { x: px, y: py });
      this.forcePositions.set(id, { x: px, y: py });
      this.initialForcePositions.set(id, { x: px, y: py });
      nodeDisplayColorMap.set(id, col);
      nodeDisplaySizeMap.set(id, baseDiameter * getNodeRestRadiusScale(group, rawSize));

      this.nodeMetaList.push({
        id,
        name: String(data.name || ''),
        size: rawSize,
        group,
        colorDark: data.colorDark,
        colorLight: data.colorLight,
        typeLabel: data.typeLabel,
        description: data.description,
        date: data.date,
        image: data.image,
        tags: data.tags
      });

      controllerNodes.push({ id, group, x: px, y: py });
    }
    this.activeClusterCount =
      this.nodeMetaList.filter((n) => n.group === 0).length || DEFAULT_TOPIC_CLUSTER_COUNT;

    const rawEdges: { source: string; target: string }[] = [];
    const controllerEdges: { source: string; target: string; weight: number }[] = [];

    for (const e of cyEdges) {
      const id = e.id();
      const source = e.source().id();
      const target = e.target().id();
      const weight = Number(e.data('weight') ?? 0.5);
      const coverage = typeof e.data('coverage') === 'number' ? Number(e.data('coverage')) : undefined;
      rawEdges.push({ source, target });
      controllerEdges.push({ source, target, weight });
      this.edgeMetaList.push({ id, source, target, weight, coverage });
      const restStyle = getRestEdgeStyle(weight, isLight);
      edgeDisplayColorMap.set(id, restStyle.color);
      edgeDisplayWidthMap.set(id, restStyle.width);
    }

    if (!this.canonicalPayload) {
      this.canonicalPayload = {
        nodes: this.nodeMetaList.map((n) => ({ ...n })),
        connections: this.edgeMetaList.map((e) => ({
          sourceId: e.source,
          targetId: e.target,
          weight: e.weight,
          coverage: e.coverage,
        })),
      };
    }

    const adjacency = buildGraphAdjacency(rawEdges);
    let lastHighlightedKey = '';

    const syncPositionsToCy = () => {
      if (!this.cy) return;
      this.cy.batch(() => {
        for (const n of cyNodes) {
          const pos = this.modelPositions.get(n.id());
          if (pos) {
            n.position({ x: pos.x, y: pos.y });
          }
        }
      });
    };
    this.syncPositionsToCy = syncPositionsToCy;

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
      if (!this.fgCanvas || !this.cy) return;
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

      const zoom = this.cy.zoom() || 1;
      const pan = this.cy.pan();
      const panX = pan.x;
      const panY = pan.y;
      const dists = this.activeHighlightDists;
      const secId = this.secondaryHoveredNodeId ?? null;
      const currentIsLight = Boolean(this.isLight);
      const currentTokens = getGraphStyleTokens(currentIsLight);
      const currentBaseDiameter = currentTokens.nodeRadius * 2;
      const currentPalette = currentIsLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;

      type DrawItem = {
        isNode: true;
        z: number;
        x: number;
        y: number;
        radius: number;
        group: number;
        borderWidth: number;
        color: string;
      };

      const fgItems: DrawItem[] = [];

      ctx.save();
      ctx.lineCap = 'round';

      let activeContentCoverageMap: Map<string, number> | null = null;
      let activeClusterContentCoverageMap: Map<string, number> | null = null;
      if (dists) {
        for (const n of this.nodeMetaList) {
          if (dists.get(n.id) === 0) {
            if (n.group !== 0) {
              activeContentCoverageMap = new Map<string, number>();
              for (const e of this.edgeMetaList) {
                if (e.source === n.id) {
                  activeContentCoverageMap.set(e.target, e.coverage ?? e.weight);
                } else if (e.target === n.id) {
                  activeContentCoverageMap.set(e.source, e.coverage ?? e.weight);
                }
              }
            } else {
              activeClusterContentCoverageMap = new Map<string, number>();
              for (const e of this.edgeMetaList) {
                if (e.source === n.id) {
                  activeClusterContentCoverageMap.set(e.target, e.coverage ?? e.weight);
                } else if (e.target === n.id) {
                  activeClusterContentCoverageMap.set(e.source, e.coverage ?? e.weight);
                }
              }
            }
            break;
          }
        }
      }

      // 1. Edges are 100% hidden visually in both rest and hover states.
      // 2. Draw background content nodes (group !== 0, nodeZ < 10) and collect foreground content nodes (nodeZ >= 10)
      const borderW = 1.5 * zoom;
      for (const n of this.nodeMetaList) {
        if (n.group === 0) continue; // Theme-Cluster nodes are rendered as Pill Nodes below
        const id = n.id;
        const p = this.modelPositions.get(id);
        if (!p) continue;
        const rx = p.x * zoom + panX;
        const ry = p.y * zoom + panY;
        const hopDist = dists ? dists.get(id) : undefined;
        const itemCov = activeClusterContentCoverageMap
          ? (activeClusterContentCoverageMap.get(id) ?? 0)
          : undefined;
        const nodeZ =
          secId !== null && id === secId ? 48 : dists ? getNodeHopZIndex(hopDist, itemCov) : 2;
        const modelDiameter = nodeDisplaySizeMap.get(id) ?? (currentBaseDiameter * getNodeRestRadiusScale(n.group, n.size));
        const color = nodeDisplayColorMap.get(id) || getNodeBaseColor(n, currentIsLight) || currentPalette[n.group] || currentPalette[0];
        const radius = (modelDiameter * zoom) / 2;

        if (nodeZ >= 10) {
          fgItems.push({
            isNode: true,
            z: nodeZ,
            x: rx,
            y: ry,
            radius,
            group: n.group,
            borderWidth: borderW,
            color
          });
        } else {
          drawRegularPolygonNode2D(ctx, rx, ry, radius, n.group, color, color, borderW);
        }
      }

      // 3. Draw foreground content nodes sorted by exact Z-order
      if (fgItems.length > 0) {
        fgItems.sort((a, b) => a.z - b.z);
        for (const item of fgItems) {
          drawRegularPolygonNode2D(
            ctx,
            item.x,
            item.y,
            item.radius,
            item.group,
            item.color,
            item.color,
            item.borderWidth
          );
        }
      }

      // 4. Draw Theme-Cluster Pill nodes (group === 0) centered directly at (rx, ry)

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
      for (const n of this.nodeMetaList) {
        const p = this.modelPositions.get(n.id);
        if (!p) continue;
        const rx = p.x * zoom + panX;
        const ry = p.y * zoom + panY;
        const modelDiameter =
          nodeDisplaySizeMap.get(n.id) ??
          currentBaseDiameter * getNodeRestRadiusScale(n.group, n.size);
        const radius = (modelDiameter * zoom) / 2;
        allCalloutNodes.push({ id: n.id, x: rx, y: ry, radiusPx: radius, group: n.group });
        if (n.group === 0) {
          const hopDist = dists ? dists.get(n.id) : undefined;
          const isSecHover = secId !== null && n.id === secId;
          const effectiveHop = isSecHover ? 0 : dists ? (hopDist ?? 99) : undefined;
          const activeCoverage = activeContentCoverageMap
            ? (activeContentCoverageMap.get(n.id) ?? 0)
            : undefined;
          let pillColor = getNodeClusterColor(n, currentIsLight);
          let pillAlpha: number | undefined;
          let pillXf: ClusterLabelCrossfade | null = null;
          if (kAct) {
            const s = sampleKChangeClusterPill(
              kAct.tr,
              n.id,
              { dark: n.colorDark ?? currentPalette[0], light: n.colorLight ?? currentPalette[0] },
              currentIsLight,
              kAct.progress
            );
            if (s) {
              pillColor = s.color;
              pillAlpha = s.alpha;
              pillXf = sampleKChangeClusterLabel(kAct.tr, n.id, n.name, kAct.progress);
            }
          }
          clusterCalloutSpecs.push({
            id: n.id,
            text: n.name,
            x: rx,
            y: ry,
            radiusPx: radius,
            clusterColor: pillColor,
            hopDistance: effectiveHop,
            activeCoverage,
            alphaOverride: pillAlpha,
            crossfadeFrom: pillXf ? { text: pillXf.oldLabel, blend: pillXf.blend } : undefined,
          });
        }
      }

      if (kAct) {
        for (const gp of sampleKChangeGhostPills(kAct.tr, kAct.progress)) {
          clusterCalloutSpecs.push({
            id: `ghost:${gp.id}`,
            text: gp.name,
            x: gp.x * zoom + panX,
            y: gp.y * zoom + panY,
            radiusPx: 0,
            clusterColor: currentIsLight ? gp.colorLight : gp.colorDark,
            alphaOverride: gp.alpha,
          });
        }
      }

      drawClusterCalloutLabels2D(ctx, allCalloutNodes, clusterCalloutSpecs, currentIsLight, {
        width: w,
        height: h,
      });

      ctx.restore();
    };

    this.drawScene = drawForegroundOverlay;
    this.cy.on('viewport', drawForegroundOverlay);

    const applyHighlight = (activeId: string | null, immediate = false) => {
      if (!this.cy) return;
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
      const currentBaseDiameter = currentTokens.nodeRadius * 2;
      const currentPalette = currentIsLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;
      const dists = activeId ? computeHopDistances(activeId, adjacency) : null;
      this.activeHighlightDists = dists;

      const activeNodeMeta = activeId ? this.nodeMetaList.find((nm) => nm.id === activeId) : undefined;
      let activeClusterContentCov: Map<string, number> | null = null;
      if (activeNodeMeta && activeNodeMeta.group === 0) {
        activeClusterContentCov = new Map<string, number>();
        for (const e of this.edgeMetaList) {
          if (e.source === activeId) {
            activeClusterContentCov.set(e.target, e.coverage ?? e.weight);
          } else if (e.target === activeId) {
            activeClusterContentCov.set(e.source, e.coverage ?? e.weight);
          }
        }
      }

      const nodeTrans: {
        id: string;
        startColor: string;
        targetColor: string;
        startSize: number;
        targetSize: number;
        changed: boolean;
      }[] = [];

      for (const n of this.nodeMetaList) {
        const id = n.id;
        const baseColor = getNodeBaseColor(n, currentIsLight) || currentPalette[n.group] || currentPalette[0];
        const startColor = nodeDisplayColorMap.get(id) || baseColor;
        const restScale = getNodeRestRadiusScale(n.group, n.size);
        const startSize = nodeDisplaySizeMap.get(id) ?? (currentBaseDiameter * restScale);
        const hopDist = dists ? dists.get(id) : undefined;
        const isSecHover = secId !== null && id === secId;
        const itemCov =
          activeClusterContentCov && n.group !== 0
            ? (activeClusterContentCov.get(id) ?? 0)
            : undefined;
        const baseScale = dists ? getAttenuatedNodeScale(hopDist, itemCov) : 1;
        const targetScale = isSecHover ? Math.max(baseScale * 1.15, 1.32) : baseScale;
        const targetColor = isSecHover
          ? baseColor
          : dists
            ? getAttenuatedNodeColor(baseColor, hopDist, currentIsLight, itemCov)
            : baseColor;
        const targetSize = currentBaseDiameter * restScale * targetScale;
        nodeTrans.push({
          id,
          startColor,
          targetColor,
          startSize,
          targetSize,
          changed: startColor !== targetColor || Math.abs(startSize - targetSize) > 1e-3
        });
      }

      const edgeTrans: {
        id: string;
        startColor: string;
        targetColor: string;
        startWidth: number;
        targetWidth: number;
        changed: boolean;
      }[] = [];

      for (const e of this.edgeMetaList) {
        const startColor = edgeDisplayColorMap.get(e.id) || currentTokens.edgeColor;
        const startWidth = edgeDisplayWidthMap.get(e.id) ?? currentTokens.edgeWidth;
        const dSrc = dists ? dists.get(e.source) : undefined;
        const dTgt = dists ? dists.get(e.target) : undefined;
        const targetStyle = dists
          ? getAttenuatedEdgeStyle(dSrc, dTgt, currentIsLight, e.weight)
          : getRestEdgeStyle(e.weight, currentIsLight);
        edgeTrans.push({
          id: e.id,
          startColor,
          targetColor: targetStyle.color,
          startWidth,
          targetWidth: targetStyle.width,
          changed: startColor !== targetStyle.color || Math.abs(startWidth - targetStyle.width) > 1e-3
        });
      }

      const renderStep = (ease: number, forceAll: boolean) => {
        for (const nt of nodeTrans) {
          if (!nt.changed && !forceAll) continue;
          const c = ease >= 1 ? nt.targetColor : interpolateHexColor(nt.startColor, nt.targetColor, ease);
          const s = ease >= 1 ? nt.targetSize : nt.startSize + (nt.targetSize - nt.startSize) * ease;
          nodeDisplayColorMap.set(nt.id, c);
          nodeDisplaySizeMap.set(nt.id, s);
        }
        for (const et of edgeTrans) {
          if (!et.changed && !forceAll) continue;
          const c = ease >= 1 ? et.targetColor : interpolateHexColor(et.startColor, et.targetColor, ease);
          const w = ease >= 1 ? et.targetWidth : et.startWidth + (et.targetWidth - et.startWidth) * ease;
          edgeDisplayColorMap.set(et.id, c);
          edgeDisplayWidthMap.set(et.id, w);
        }
        drawForegroundOverlay();
      };

      if (immediate) {
        renderStep(1, true);
        return;
      }

      const startTime = performance.now();
      const step = (now: number) => {
        if (!this.cy) {
          this.highlightFrameId = null;
          return;
        }
        const progress = Math.min(1, (now - startTime) / HIGHLIGHT_TRANSITION_MS);
        const ease = easeHighlightTransition(progress);
        const isFinal = progress >= 1;
        renderStep(ease, isFinal);
        if (!isFinal) {
          this.highlightFrameId = requestAnimationFrame(step);
        } else {
          this.highlightFrameId = null;
        }
      };
      this.highlightFrameId = requestAnimationFrame(step);
    };
    this.applyHighlight = applyHighlight;
    applyHighlight(null, true);

    container.style.touchAction = 'pan-y';
    container.querySelectorAll('canvas, div').forEach((el) => {
      (el as HTMLElement).style.touchAction = 'pan-y';
    });

    this.tooltipController = createGraphTooltipController(container);

    const utmSource = String(extraOptions.utmSource || 'visualizations_demo');
    const utmMedium = String(extraOptions.utmMedium || 'cytoscape');
    const utmCampaign = String(extraOptions.utmCampaign || 'interactive_visualization');

    let grabbedNodeId: string | null = null;

    const rebuildDragController = (
      nodesList: { id: string; group: number; x: number; y: number }[],
      edgesList: { source: string; target: string; weight: number }[]
    ) => {
      if (this.dragController) {
        this.dragController.destroy();
      }
      this.dragController = createGraphDragPhysicsController2D({
        nodes: nodesList,
        edges: edgesList,
        isLight: () => Boolean(this.isLight),
        onTick: (positions, draggedId) => {
          if (!this.cy) return;
          for (const [id, pt] of positions.entries()) {
            if (id === draggedId) continue;
            this.modelPositions.set(id, { x: pt.x, y: pt.y });
            this.forcePositions.set(id, { x: pt.x, y: pt.y });
          }
          drawForegroundOverlay();
        },
        onSettleComplete: (positions) => {
          for (const [id, pt] of positions.entries()) {
            this.modelPositions.set(id, { x: pt.x, y: pt.y });
            this.forcePositions.set(id, { x: pt.x, y: pt.y });
          }
          syncPositionsToCy();
          drawForegroundOverlay();
        },
      });
    };

    rebuildDragController(controllerNodes, controllerEdges);

    this.kChange?.destroy();
    this.kChange = createKChangeController();

    this.rebuildClusterTopology = (targetK: number, opts?: { restoreDefault?: boolean }) => {
      if (!this.canonicalPayload || !this.cy) return;
      this.kChange?.finish();
      const prevPayloadNodes: GraphNodePayload[] = this.nodeMetaList.map((m) => ({ ...m }));
      const prevMetaById = new Map(prevPayloadNodes.map((m) => [m.id, m]));
      const nextCanonical = resolveKChangeCanonical(
        this.canonicalPayload,
        targetK,
        prevPayloadNodes,
        Boolean(opts?.restoreDefault)
      );

      const currentIsLight = Boolean(this.isLight);
      const curTokens = getGraphStyleTokens(currentIsLight);
      const curBaseDiameter = curTokens.nodeRadius * 2;
      const curPalette = currentIsLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;

      const prevPosById = new Map<string, { x: number; y: number }>();
      for (const [id, p] of this.modelPositions.entries()) {
        prevPosById.set(id, { x: p.x, y: p.y });
      }

      const startPos = computeKChangeStartPositions(nextCanonical.nodes, nextCanonical.connections, prevPosById, targetK);

      this.nodeMetaList = [];
      this.edgeMetaList = [];
      this.modelPositions.clear();
      this.forcePositions.clear();
      nodeDisplayColorMap.clear();
      nodeDisplaySizeMap.clear();
      edgeDisplayColorMap.clear();
      edgeDisplayWidthMap.clear();

      const nextCyElements: cytoscape.ElementDefinition[] = [];
      const nextCtrlNodes: { id: string; group: number; x: number; y: number }[] = [];
      const nextCtrlEdges: { source: string; target: string; weight: number }[] = [];
      const nextRawEdges: { source: string; target: string }[] = [];

      nextCanonical.nodes.forEach((n) => {
        const sp = startPos.get(n.id) ?? { x: 0, y: 0 };
        const px = sp.x;
        const py = sp.y;
        const col = getNodeBaseColor(n, currentIsLight) || curPalette[n.group] || curPalette[0];
        this.modelPositions.set(n.id, { x: px, y: py });
        this.forcePositions.set(n.id, { x: px, y: py });
        const prevMeta = prevMetaById.get(n.id);
        const prevCol = n.group !== 0 && prevMeta ? getNodeBaseColor(prevMeta, currentIsLight) : undefined;
        nodeDisplayColorMap.set(n.id, prevCol || col);
        nodeDisplaySizeMap.set(n.id, curBaseDiameter * getNodeRestRadiusScale(n.group, n.size));

        this.nodeMetaList.push({
          id: n.id,
          name: n.name,
          size: n.size,
          group: n.group,
          colorDark: n.colorDark,
          colorLight: n.colorLight,
          typeLabel: n.typeLabel,
          description: n.description,
          date: n.date,
          image: n.image,
          tags: n.tags ? [...n.tags] : undefined,
          originClusterId: n.originClusterId,
          originKind: n.originKind,
        });
        nextCtrlNodes.push({ id: n.id, group: n.group, x: px, y: py });
        nextCyElements.push({
          data: {
            id: n.id,
            name: n.name,
            group: n.group,
            color: col,
            colorDark: n.colorDark,
            colorLight: n.colorLight,
            size: 16 * getNodeRestRadiusScale(n.group, n.size),
            rawSize: n.size,
          },
          position: { x: px, y: py },
        });
      });

      for (const c of nextCanonical.connections) {
        const eid = `${c.sourceId}--${c.targetId}`;
        const weight = c.weight ?? 0.5;
        const restStyle = getRestEdgeStyle(weight, currentIsLight);
        edgeDisplayColorMap.set(eid, restStyle.color);
        edgeDisplayWidthMap.set(eid, restStyle.width);
        this.edgeMetaList.push({
          id: eid,
          source: c.sourceId,
          target: c.targetId,
          weight,
          coverage: c.coverage,
        });
        nextRawEdges.push({ source: c.sourceId, target: c.targetId });
        nextCtrlEdges.push({ source: c.sourceId, target: c.targetId, weight });
        nextCyElements.push({
          data: {
            id: eid,
            source: c.sourceId,
            target: c.targetId,
            weight,
            coverage: c.coverage,
          },
        });
      }

      const freshAdj = buildGraphAdjacency(nextRawEdges);
      adjacency.clear();
      for (const [k, v] of freshAdj.entries()) {
        adjacency.set(k, v);
      }

      this.cy.batch(() => {
        this.cy!.elements().remove();
        this.cy!.add(nextCyElements);
      });
      cyNodes = this.cy.nodes().toArray();

      this.activeClusterCount = targetK;
      this.hoveredNodeId = null;
      this.secondaryHoveredNodeId = null;
      this.activeHighlightDists = null;
      this.focusedNodeIds = null;
      this.tooltipController?.clearFocus();
      rebuildDragController(nextCtrlNodes, nextCtrlEdges);
      this.kChange?.begin({
        prevNodes: prevPayloadNodes,
        prevPositions: prevPosById,
        nextNodes: this.nodeMetaList,
        nextStartPositions: startPos,
        mergeTargetByOldClusterId: nextCanonical.mergeTargetByOldClusterId,
      });
      drawForegroundOverlay();
    };

    this.playKTransition = (nextPositions: Map<string, { x: number; y: number }>) => {
      const isLightNow = Boolean(this.isLight);
      return (
        this.kChange?.play(nextPositions, {
          onFrame: (tr, progress) => {
            for (const meta of this.nodeMetaList) {
              const nextColor = {
                dark: meta.colorDark ?? GRAPH_COLORS.dark[0],
                light: meta.colorLight ?? GRAPH_COLORS.light[0],
              };
              if (meta.group === 0) {
                const s = sampleKChangeClusterPill(tr, meta.id, nextColor, isLightNow, progress);
                if (s) this.modelPositions.set(meta.id, { x: s.x, y: s.y });
              } else {
                const p = sampleKChangeNodePosition(tr, meta.id, progress);
                if (p) this.modelPositions.set(meta.id, { x: p.x, y: p.y });
                nodeDisplayColorMap.set(
                  meta.id,
                  sampleKChangeNodeColor(tr, meta.id, nextColor, isLightNow, progress)
                );
              }
            }
            drawForegroundOverlay();
          },
          onFinish: () => {
            for (const [id, p] of nextPositions) {
              this.modelPositions.set(id, { x: p.x, y: p.y });
              this.forcePositions.set(id, { x: p.x, y: p.y });
            }
            syncPositionsToCy();
            this.applyHighlight?.(null, true);
            this.calibrateDragEquilibrium?.(true);
          },
        }) ?? false
      );
    };

    const calibrateDragEquilibrium = (syncFromCy = false) => {
      if (syncFromCy) {
        for (const [id, p] of this.modelPositions.entries()) {
          this.forcePositions.set(id, { x: p.x, y: p.y });
        }
      }
      this.dragController?.calibrateFromPositions(this.forcePositions);
    };
    this.calibrateDragEquilibrium = calibrateDragEquilibrium;

    const renderedToModel = (sx: number, sy: number) => {
      if (!this.cy) return { x: sx, y: sy };
      const pan = this.cy.pan();
      const zoom = this.cy.zoom() || 1;
      return {
        x: (sx - pan.x) / zoom,
        y: (sy - pan.y) / zoom
      };
    };

    this.tooltipController.bindProximityInteraction({
      getScreenNodes: () => {
        if (!this.cy) return [];
        const zoom = this.cy.zoom() || 1;
        const pan = this.cy.pan();
        const panX = pan.x;
        const panY = pan.y;
        const result: { node: RawGraphNode; x: number; y: number }[] = [];
        for (const meta of this.nodeMetaList) {
          const pos = this.modelPositions.get(meta.id);
          if (!pos) continue;
          result.push({
            node: meta,
            x: pos.x * zoom + panX,
            y: pos.y * zoom + panY
          });
        }
        return result;
      },
      adjacency,
      isLight: () => Boolean(this.isLight),
      isDragging: () => grabbedNodeId !== null,
      getLastDraggedAt: () => this.lastDraggedAt || 0,
      onActiveNodeChange: (nodeId) => {
        this.hoveredNodeId = nodeId;
        if (grabbedNodeId === null) {
          applyHighlight(nodeId);
        }
      },
      onSecondaryHoverNodeChange: (nodeId) => {
        this.secondaryHoveredNodeId = nodeId;
        if (grabbedNodeId === null) {
          applyHighlight(this.hoveredNodeId ?? null);
        }
      },
      onFocusNodeChange: (_nodeId, focusNodeIds) => {
        this.focusedNodeIds = focusNodeIds;
        this.startViewportAdaptLoop(1600, GRAPH_VIEWPORT_CONFIG.focusAlpha);
      },
      onNavigate: (node) => {
        const id = node.id;
        if (
          id.startsWith('/posts/') ||
          id.startsWith('/publications/') ||
          id.startsWith('/presentations/') ||
          id.startsWith('/projects/') ||
          id.startsWith('/courses/') ||
          id.startsWith('/services/') ||
          id.startsWith('/newsletters/') ||
          id.startsWith('/visualizations/') ||
          id.startsWith('/tags/')
        ) {
          const targetUrl = new URL(id, window.location.origin);
          targetUrl.searchParams.set('utm_source', utmSource);
          targetUrl.searchParams.set('utm_medium', utmMedium);
          targetUrl.searchParams.set('utm_campaign', utmCampaign);
          window.location.href = targetUrl.pathname + targetUrl.search;
        }
      },
      onNodeDragStart: (rawNode, sx, sy) => {
        if (!this.cy) return;
        this.kChange?.finish();
        grabbedNodeId = rawNode.id;
        this.hoveredNodeId = grabbedNodeId;
        this.lastDraggedAt = performance.now();
        applyHighlight(grabbedNodeId);

        if (this.animationFrameId) {
          cancelAnimationFrame(this.animationFrameId);
          this.animationFrameId = null;
        }
        if (this.viewportAdaptFrameId) {
          cancelAnimationFrame(this.viewportAdaptFrameId);
          this.viewportAdaptFrameId = null;
        }

        const modelPos = renderedToModel(sx, sy);
        this.modelPositions.set(grabbedNodeId, { x: modelPos.x, y: modelPos.y });

        if (this.currentLayout === 'force') {
          this.forcePositions.set(grabbedNodeId, { x: modelPos.x, y: modelPos.y });
          this.dragController?.startDrag(grabbedNodeId, modelPos);
        } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          this.lastOrderSignature = this.getOrderSignature(this.currentLayout);
        }
        drawForegroundOverlay();
      },
      onNodeDragMove: (rawNode, sx, sy) => {
        if (!this.cy) return;
        this.lastDraggedAt = performance.now();
        const pos = renderedToModel(sx, sy);
        this.modelPositions.set(rawNode.id, { x: pos.x, y: pos.y });

        if (this.currentLayout === 'force') {
          this.forcePositions.set(rawNode.id, { x: pos.x, y: pos.y });
          this.dragController?.moveDrag(rawNode.id, pos);
        } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          const sig = this.getOrderSignature(this.currentLayout);
          if (sig !== this.lastOrderSignature) {
            this.lastOrderSignature = sig;
            const targets = this.computeLayoutTargets(this.currentLayout, true);
            this.animateTo(targets, 250, rawNode.id, false);
          } else {
            drawForegroundOverlay();
          }
        }
      },
      onNodeDragEnd: (rawNode) => {
        if (!this.cy) return;
        const releasedId = rawNode.id;
        const pos = this.modelPositions.get(releasedId) || { x: 0, y: 0 };
        grabbedNodeId = null;
        this.hoveredNodeId = null;
        this.lastDraggedAt = performance.now();
        applyHighlight(null);

        if (this.currentLayout === 'force') {
          this.forcePositions.set(releasedId, { x: pos.x, y: pos.y });
          this.dragController?.endDrag(releasedId, { x: pos.x, y: pos.y });
          this.startViewportAdaptLoop(2400);
        } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          const targets = this.computeLayoutTargets(this.currentLayout, true);
          this.animateTo(targets, 400, undefined, false, false);
          this.startViewportAdaptLoop(2400);
        }
      }
    });

    this.currentLayout = layout;
    this.isLight = isLight;
    this.runLayout(layout, false);
    this.initialized = true;

    // Bind ResizeObserver to handle container size changes dynamically with dimension threshold
    let lastWidth = container.clientWidth;
    let lastHeight = container.clientHeight;
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (Math.abs(width - lastWidth) >= 1 || Math.abs(height - lastHeight) >= 1) {
          lastWidth = width;
          lastHeight = height;
          if (this.cy) {
            this.cy.resize();
            if (this.currentLayout === 'columns' && this.isLight !== undefined) {
              this.updateLayout(this.currentLayout, this.isLight, true);
            } else {
              this.stepViewportTowardCloud(1);
            }
          }
        }
      }
    });
    this.resizeObserver.observe(container);

    return this;
  },

  stepViewportTowardCloud(alpha: number) {
    if (!this.cy) return;
    const width = this.cy.width() || 800;
    const height = this.cy.height() || 500;
    if (width <= 0 || height <= 0) return;

    const isSubgraph = Boolean(this.focusedNodeIds && this.focusedNodeIds.size > 0);
    const r = getGraphStyleTokens(Boolean(this.isLight)).nodeRadius;
    const points: { x: number; y: number }[] = [];
    for (const [id, p] of this.modelPositions.entries()) {
      if (isSubgraph && !this.focusedNodeIds!.has(id)) continue;
      if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
        points.push({ x: p.x, y: p.y });
      }
    }
    if (!isSubgraph && this.currentLayout === 'radial') {
      points.push(...getRadialReferenceBounds2D(width, height, false));
    }

    const fit = compute2DViewportFit(points, width, height, r, isSubgraph);
    if (!fit) return;

    const curZoom = this.cy.zoom() || 1;
    const curPan = this.cy.pan();
    const t = Math.max(0, Math.min(1, alpha));

    const nextZoom = curZoom + (fit.scale - curZoom) * t;
    const nextPanX = curPan.x + (fit.panX - curPan.x) * t;
    const nextPanY = curPan.y + (fit.panY - curPan.y) * t;

    this.cy.viewport({
      zoom: nextZoom,
      pan: { x: nextPanX, y: nextPanY }
    });
    this.drawScene?.();
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
      if (!this.cy) {
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

  getOrderSignature(layout: string): string {
    if (!this.cy) return '';
    const width = this.cy.width() || 800;
    const height = this.cy.height() || 500;
    const solverNodes: SolverGraphNode[] = this.nodeMetaList.map((n) => {
      const p = this.modelPositions.get(n.id) || { x: 0, y: 0 };
      return {
        id: n.id,
        group: n.group,
        x: p.x,
        y: p.y,
      };
    });
    return compute2DGeometryTargets(solverNodes, layout, {
      useCurrentOrder: true,
      width,
      height,
      centerOrigin: false,
    }).signature;
  },

  computeLayoutTargets(layout: string, useCurrentOrder = false): Record<string, { x: number; y: number }> {
    const targets: Record<string, { x: number; y: number }> = {};
    if (!this.cy) return targets;

    if (layout === 'radial' || layout === 'columns') {
      const width = this.cy.width() || 800;
      const height = this.cy.height() || 500;
      const solverNodes: SolverGraphNode[] = this.nodeMetaList.map((n) => {
        const p = this.modelPositions.get(n.id) || { x: 0, y: 0 };
        return {
          id: n.id,
          group: n.group,
          x: p.x,
          y: p.y,
        };
      });
      return compute2DGeometryTargets(solverNodes, layout, {
        useCurrentOrder,
        width,
        height,
        centerOrigin: false,
      }).targets;
    }

    // default: force directed
    if (this.forcePositions.size > 0) {
      for (const [id, pos] of this.forcePositions.entries()) {
        targets[id] = { x: pos.x, y: pos.y };
      }
      return targets;
    }

    return this.solveHeadlessCoseTargets();
  },

  solveHeadlessCoseTargets(): Record<string, { x: number; y: number }> {
    if (!this.cy) return {};
    const nodes: SolverGraphNode[] = this.nodeMetaList.map((n) => ({
      id: n.id,
      group: n.group,
      size: n.size,
    }));
    const connections: SolverGraphEdge[] = this.edgeMetaList.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    }));
    const targets = solveCytoscapeCoseLayout({ nodes, connections });
    for (const [id, pt] of Object.entries(targets)) {
      this.forcePositions.set(id, { x: pt.x, y: pt.y });
    }
    return targets;
  },

  runLayout(mode: string, animate: boolean) {
    if (!this.cy) return;
    if (mode === 'force' && this.forcePositions.size > 0) {
      const targets: Record<string, { x: number; y: number }> = {};
      for (const [id, pos] of this.forcePositions.entries()) {
        targets[id] = { x: pos.x, y: pos.y };
      }
      if (!animate) {
        for (const [id, pt] of Object.entries(targets)) {
          this.modelPositions.set(id, { x: pt.x, y: pt.y });
        }
        this.syncPositionsToCy?.();
        this.stepViewportTowardCloud(1);
        return;
      }
      this.animateTo(targets, 550, undefined, true);
      return;
    }

    const targets = this.computeLayoutTargets(mode, false);
    if (!animate) {
      for (const [id, pt] of Object.entries(targets)) {
        this.modelPositions.set(id, { x: pt.x, y: pt.y });
      }
      this.syncPositionsToCy?.();
      this.stepViewportTowardCloud(1);
    } else {
      this.animateTo(targets, 550, undefined, true);
    }
  },

  animateTo(targets: Record<string, { x: number; y: number }>, duration = 600, excludeNodeId?: string, fitOnStep = true, animateFitAfter = false) {
    if (!this.cy) return;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.viewportAdaptFrameId) {
      cancelAnimationFrame(this.viewportAdaptFrameId);
      this.viewportAdaptFrameId = null;
    }

    const startTime = performance.now();
    const startPositions: Record<string, { x: number; y: number }> = {};
    for (const [id, p] of this.modelPositions.entries()) {
      startPositions[id] = { x: p.x, y: p.y };
    }

    const step = (time: number) => {
      if (!this.cy) return;
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const ease = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      for (const n of this.nodeMetaList) {
        const id = n.id;
        if (excludeNodeId && id === excludeNodeId) continue;
        const start = startPositions[id];
        const target = targets[id];
        if (start && target) {
          this.modelPositions.set(id, {
            x: start.x + (target.x - start.x) * ease,
            y: start.y + (target.y - start.y) * ease
          });
        }
      }

      if (fitOnStep) {
        this.stepViewportTowardCloud(1);
      } else {
        this.drawScene?.();
      }

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.animationFrameId = null;
        this.syncPositionsToCy?.();
        if (this.currentLayout === 'force' && !excludeNodeId) {
          this.calibrateDragEquilibrium?.(true);
        }
        if (animateFitAfter) {
          this.startViewportAdaptLoop(350, 0.25);
        }
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  },

  updateLayout(layout: string, isLight: boolean, forceRecompute = false) {
    if (!this.cy) return;
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
    }

    // Apply color update to nodes and edges based on theme (and preserve any active highlight)
    this.applyHighlight?.(this.hoveredNodeId ?? null, true);

    if (!this.initialized || layoutChanged || forceRecompute) {
      this.runLayout(layout, Boolean(this.initialized));
    }
  },

  applyTuning(category: 'physics' | 'geometry' | 'visual' | 'reset') {
    if (!this.cy) return;
    this.kChange?.finish();
    if (category === 'visual') {
      this.applyHighlight?.(this.hoveredNodeId ?? null, true);
      return;
    }
    if (category === 'geometry') {
      if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
        const targets = this.computeLayoutTargets(this.currentLayout, true);
        this.animateTo(targets, 350, undefined, true, false);
      }
      return;
    }
    if (category === 'physics') {
      if (this.currentLayout === 'force') {
        const gen = (this.tuningGeneration = (this.tuningGeneration || 0) + 1);
        this.dragController?.stop();
        const targetK = getGraphTuningState().clusterCount;
        if (this.activeClusterCount !== targetK) {
          this.rebuildClusterTopology?.(targetK);
        }
        {
          this.tuningInFlight = true;
          const nodes: SolverGraphNode[] = this.nodeMetaList.map((n) => ({
            id: n.id,
            group: n.group,
            size: n.size,
            originClusterId: n.originClusterId,
          }));
          const connections: SolverGraphEdge[] = this.edgeMetaList.map((e) => ({
            source: e.source,
            target: e.target,
            weight: e.weight,
          }));
          const seedPositions = this.kChange?.getSeedPositions() ?? new Map(this.modelPositions);
          void solveCytoscapeCoseLayoutAsync(
            { nodes, connections, seedPositions },
            { shouldCancel: () => this.tuningGeneration !== gen }
          ).then((targets) => {
            if (!targets || this.tuningGeneration !== gen || !this.cy) return;
            this.tuningInFlight = false;
            if (this.currentLayout !== 'force') return;
            this.forcePositions.clear();
            for (const [id, pt] of Object.entries(targets)) {
              this.forcePositions.set(id, { x: pt.x, y: pt.y });
            }
            if (this.kChange?.hasPending()) {
              const solved = new Map<string, { x: number; y: number }>();
              for (const [id, pt] of Object.entries(targets)) solved.set(id, { x: pt.x, y: pt.y });
              if (this.playKTransition?.(solved)) {
                this.startViewportAdaptLoop(1400);
                return;
              }
            }
            this.animateTo(targets, 450, undefined, true, false);
          });
        }
      }
      return;
    }
    if (category === 'reset') {
      this.tuningGeneration = (this.tuningGeneration || 0) + 1;
      this.tuningInFlight = false;
      this.dragController?.stop();
      const targetK = getGraphTuningState().clusterCount;
      if (this.activeClusterCount !== targetK) {
        this.rebuildClusterTopology?.(targetK, { restoreDefault: true });
      }
      this.forcePositions.clear();
      for (const [id, pos] of this.initialForcePositions.entries()) {
        this.forcePositions.set(id, { x: pos.x, y: pos.y });
      }
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
        this.animateTo(targets, 450, undefined, true, false);
      } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
        this.kChange?.discard();
        const targets = this.computeLayoutTargets(this.currentLayout, false);
        this.animateTo(targets, 450, undefined, true, false);
      }
    }
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
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.viewportAdaptFrameId) {
      cancelAnimationFrame(this.viewportAdaptFrameId);
      this.viewportAdaptFrameId = null;
    }
    if (this.dragController) {
      this.dragController.destroy();
      this.dragController = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.tooltipController) {
      this.tooltipController.destroy();
      this.tooltipController = null;
    }
    if (this.fgCanvas) {
      this.fgCanvas.remove();
      this.fgCanvas = null;
    }
    this.drawScene = null;
    this.syncPositionsToCy = null;
    this.nodeMetaList = [];
    this.edgeMetaList = [];
    this.modelPositions.clear();
    this.activeHighlightDists = null;
    if (this.cy) {
      this.cy.destroy();
      this.cy = null;
    }
    this.forcePositions.clear();
  }
};

export default engine;
