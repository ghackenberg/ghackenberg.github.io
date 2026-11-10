import cytoscape, { type Core, type NodeSingular } from 'cytoscape';
import {
  GRAPH_COLORS,
  GRAPH_VIEWPORT_CONFIG,
  HIGHLIGHT_TRANSITION_MS,
  easeHighlightTransition,
  getGraphStyleTokens,
  compute2DViewportFit,
  buildGraphAdjacency,
  computeHopDistances,
  interpolateHexColor,
  getAttenuatedNodeColor,
  getAttenuatedNodeScale,
  getAttenuatedEdgeStyle,
  getNodeHopZIndex,
  getEdgeHopZIndex,
  isDefaultGraphTuningState
} from '@commons/shared/graph-payload';
import {
  compute2DGeometryTargets,
  solveCytoscapeCoseLayout,
  type SolverGraphEdge,
  type SolverGraphNode,
} from '@commons/shared/graph-solvers';
import {
  createGraphDragPhysicsController2D,
  type GraphDragPhysicsController2D,
} from '@commons/client/graph-drag-controller';
import { createGraphTooltipController, type GraphTooltipController, type RawGraphNode } from '@commons/client/vis-tooltip';

function getNodeColor(node: NodeSingular, isLight: boolean): string {
  const grp = node.data('group') ?? 0;
  const colors = isLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;
  return colors[grp] || colors[0];
}

export interface CytoscapeNodeMeta {
  id: string;
  name: string;
  size: number;
  group: number;
  typeLabel?: string;
  description?: string;
  date?: string;
  image?: string;
  tags?: string[];
}

export interface CytoscapeEdgeMeta {
  id: string;
  source: string;
  target: string;
  weight: number;
}

export interface CytoscapeEngine {
  layouts: { id: string; label: string }[];
  cy: Core | null;
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
  dragController?: GraphDragPhysicsController2D | null;
  calibrateDragEquilibrium?(syncFromCy?: boolean): void;
  solveHeadlessCoseTargets(): Record<string, { x: number; y: number }>;
  animationFrameId?: number | null;
  viewportAdaptFrameId?: number | null;
  resizeObserver: ResizeObserver | null;
  init(container: HTMLElement, payload: { cytoscape: { elements: cytoscape.ElementsDefinition } }, layout: string, isLight: boolean, extraOptions?: Record<string, string>): Promise<CytoscapeEngine>;
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
  dragController: null,
  animationFrameId: null,
  viewportAdaptFrameId: null,
  resizeObserver: null,

  async init(container: HTMLElement, payload: { cytoscape: { elements: cytoscape.ElementsDefinition } }, layout: string, isLight: boolean, extraOptions: Record<string, string> = {}) {
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
          selector: 'edge',
          style: {
            'width': styleTokens.edgeWidth,
            'line-color': styleTokens.edgeColor,
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

    const cyNodes = this.cy.nodes().toArray();
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
      const pos = n.position();
      const px = Number.isFinite(pos.x) ? pos.x : 0;
      const py = Number.isFinite(pos.y) ? pos.y : 0;
      const col = palette[group] || palette[0];

      this.modelPositions.set(id, { x: px, y: py });
      this.forcePositions.set(id, { x: px, y: py });
      this.initialForcePositions.set(id, { x: px, y: py });
      nodeDisplayColorMap.set(id, col);
      nodeDisplaySizeMap.set(id, baseDiameter);

      this.nodeMetaList.push({
        id,
        name: String(data.name || ''),
        size: Number(data.rawSize ?? data.size ?? 1),
        group,
        typeLabel: data.typeLabel,
        description: data.description,
        date: data.date,
        image: data.image,
        tags: data.tags
      });

      controllerNodes.push({ id, group, x: px, y: py });
    }

    const rawEdges: { source: string; target: string }[] = [];
    const controllerEdges: { source: string; target: string; weight: number }[] = [];

    for (const e of cyEdges) {
      const id = e.id();
      const source = e.source().id();
      const target = e.target().id();
      const weight = Number(e.data('weight') ?? 0.5);
      rawEdges.push({ source, target });
      controllerEdges.push({ source, target, weight });
      this.edgeMetaList.push({ id, source, target, weight });
      edgeDisplayColorMap.set(id, styleTokens.edgeColor);
      edgeDisplayWidthMap.set(id, styleTokens.edgeWidth);
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

      type DrawItem =
        | { isNode: false; z: number; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
        | { isNode: true; z: number; x: number; y: number; radius: number; borderWidth: number; color: string };

      const fgItems: DrawItem[] = [];

      ctx.save();
      ctx.lineCap = 'round';

      // 1. Draw background edges batched into a single path
      let bgEdgeColor = currentTokens.edgeColor;
      let bgEdgeWidth = currentTokens.edgeWidth * zoom;
      let hasBgEdges = false;
      ctx.beginPath();

      for (const e of this.edgeMetaList) {
        const p1 = this.modelPositions.get(e.source);
        const p2 = this.modelPositions.get(e.target);
        if (!p1 || !p2) continue;
        const x1 = p1.x * zoom + panX;
        const y1 = p1.y * zoom + panY;
        const x2 = p2.x * zoom + panX;
        const y2 = p2.y * zoom + panY;

        const edgeZ = dists ? getEdgeHopZIndex(dists.get(e.source), dists.get(e.target)) : 1;
        const modelWidth = edgeDisplayWidthMap.get(e.id) ?? currentTokens.edgeWidth;
        const color = edgeDisplayColorMap.get(e.id) || currentTokens.edgeColor;

        if (edgeZ >= 8) {
          fgItems.push({
            isNode: false,
            z: edgeZ,
            x1,
            y1,
            x2,
            y2,
            color,
            width: modelWidth * zoom
          });
        } else {
          bgEdgeColor = color;
          bgEdgeWidth = modelWidth * zoom;
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          hasBgEdges = true;
        }
      }

      if (hasBgEdges) {
        ctx.strokeStyle = bgEdgeColor;
        ctx.lineWidth = bgEdgeWidth;
        ctx.stroke();
      }

      // 2. Draw background nodes (nodeZ < 10) and collect foreground nodes (nodeZ >= 10)
      const borderW = 1.5 * zoom;
      for (const n of this.nodeMetaList) {
        const id = n.id;
        const p = this.modelPositions.get(id);
        if (!p) continue;
        const rx = p.x * zoom + panX;
        const ry = p.y * zoom + panY;
        const hopDist = dists ? dists.get(id) : undefined;
        const nodeZ = secId !== null && id === secId ? 48 : dists ? getNodeHopZIndex(hopDist) : 2;
        const modelDiameter = nodeDisplaySizeMap.get(id) ?? currentBaseDiameter;
        const color = nodeDisplayColorMap.get(id) || currentPalette[n.group] || currentPalette[0];
        const radius = (modelDiameter * zoom) / 2;

        if (nodeZ >= 10) {
          fgItems.push({
            isNode: true,
            z: nodeZ,
            x: rx,
            y: ry,
            radius,
            borderWidth: borderW,
            color
          });
        } else {
          ctx.beginPath();
          ctx.arc(rx, ry, radius, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.lineWidth = borderW;
          ctx.strokeStyle = color;
          ctx.stroke();
        }
      }

      // 3. Draw foreground edges and nodes sorted by exact Z-order
      if (fgItems.length > 0) {
        fgItems.sort((a, b) => a.z - b.z || (a.isNode ? 1 : 0) - (b.isNode ? 1 : 0));
        for (const item of fgItems) {
          if (!item.isNode) {
            ctx.beginPath();
            ctx.strokeStyle = item.color;
            ctx.lineWidth = item.width;
            ctx.moveTo(item.x1, item.y1);
            ctx.lineTo(item.x2, item.y2);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
            ctx.fillStyle = item.color;
            ctx.fill();
            ctx.lineWidth = item.borderWidth;
            ctx.strokeStyle = item.color;
            ctx.stroke();
          }
        }
      }

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
        const baseColor = currentPalette[n.group] || currentPalette[0];
        const startColor = nodeDisplayColorMap.get(id) || baseColor;
        const startSize = nodeDisplaySizeMap.get(id) ?? currentBaseDiameter;
        const hopDist = dists ? dists.get(id) : undefined;
        const isSecHover = secId !== null && id === secId;
        const baseScale = dists ? getAttenuatedNodeScale(hopDist) : 1;
        const targetScale = isSecHover ? Math.max(baseScale * 1.15, 1.32) : baseScale;
        const targetColor = isSecHover
          ? baseColor
          : dists
            ? getAttenuatedNodeColor(baseColor, hopDist, currentIsLight)
            : baseColor;
        const targetSize = currentBaseDiameter * targetScale;
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
          ? getAttenuatedEdgeStyle(dSrc, dTgt, currentIsLight)
          : { color: currentTokens.edgeColor, width: currentTokens.edgeWidth };
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

    this.dragController = createGraphDragPhysicsController2D({
      nodes: controllerNodes,
      edges: controllerEdges,
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
      this.focusedNodeIds = null;
      this.tooltipController?.clearFocus();
      this.dragController?.stop();
    }

    // Apply color update to nodes and edges based on theme (and preserve any active highlight)
    this.applyHighlight?.(this.hoveredNodeId ?? null, true);

    if (!this.initialized || layoutChanged || forceRecompute) {
      this.runLayout(layout, Boolean(this.initialized));
    }
  },

  applyTuning(category: 'physics' | 'geometry' | 'visual' | 'reset') {
    if (!this.cy) return;
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
        this.dragController?.stop();
        if (isDefaultGraphTuningState() && this.initialForcePositions.size > 0) {
          const targets: Record<string, { x: number; y: number }> = {};
          this.forcePositions.clear();
          for (const [id, pos] of this.initialForcePositions.entries()) {
            this.forcePositions.set(id, { x: pos.x, y: pos.y });
            targets[id] = { x: pos.x, y: pos.y };
          }
          this.animateTo(targets, 450, undefined, true, false);
        } else {
          const targets = this.solveHeadlessCoseTargets();
          this.animateTo(targets, 450, undefined, true, false);
        }
      }
      return;
    }
    if (category === 'reset') {
      this.dragController?.stop();
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
        this.animateTo(targets, 450, undefined, true, false);
      } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
        const targets = this.computeLayoutTargets(this.currentLayout, false);
        this.animateTo(targets, 450, undefined, true, false);
      }
    }
  },

  destroy() {
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
