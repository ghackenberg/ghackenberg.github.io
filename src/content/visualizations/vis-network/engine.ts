import { Network, type Options, type Node as VisNode, type Edge as VisEdge } from 'vis-network';
import { DataSet } from 'vis-data';
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
  solveVisNetworkForceLayoutAsync,
  type SolverGraphNode,
} from '@commons/shared/graph-solvers';
import {
  createGraphDragPhysicsController2D,
  type GraphDragPhysicsController2D,
} from '@commons/client/graph-drag-controller';
import { createGraphTooltipController, type GraphTooltipController, type RawGraphNode } from '@commons/client/vis-tooltip';

interface VisInternalNode {
  x: number;
  y: number;
  options?: {
    size?: number;
    color?: {
      background?: string;
      border?: string;
      highlight?: { background?: string; border?: string };
      hover?: { background?: string; border?: string };
    };
  };
}

interface VisInternalEdge {
  options?: {
    width?: number;
    hoverWidth?: number;
    color?: {
      color?: string;
      highlight?: string;
      hover?: string;
    };
  };
}

interface VisNetworkWithBody extends Network {
  body?: {
    nodeIndices?: (string | number)[];
    edgeIndices?: (string | number)[];
    nodes?: Record<string, VisInternalNode>;
    edges?: Record<string, VisInternalEdge>;
  };
}

function getVisNodeColors(isLight: boolean) {
  const palette = GRAPH_COLORS[isLight ? 'light' : 'dark'];
  return palette.map((color) => ({
    background: color,
    border: color,
    highlight: { background: color, border: color },
    hover: { background: color, border: color }
  }));
}

export interface VisPayloadNode {
  id: string;
  name: string;
  size: number;
  group: number;
  x?: number;
  y?: number;
  image?: string;
  tags?: string[];
  date?: string;
  typeLabel?: string;
  description?: string;
}

export interface VisPayloadConnection {
  sourceId: string;
  targetId: string;
  weight?: number;
}

export interface VisNetworkPayload {
  'vis-network': {
    nodes: VisPayloadNode[];
    connections: VisPayloadConnection[];
  };
}

export interface VisCustomNode extends VisNode {
  rawGroup?: number;
  displayColor?: string;
  displaySize?: number;
}

export interface VisCustomEdge extends VisEdge {
  displayColor?: string;
  displayWidth?: number;
}

export interface VisNetworkExtraOptions extends Options {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface VisNetworkEngine {
  layouts: { id: string; label: string }[];
  container?: HTMLElement | null;
  nodes?: VisPayloadNode[];
  connections?: VisPayloadConnection[];
  visNodes?: DataSet<VisCustomNode> | null;
  visEdges?: DataSet<VisCustomEdge> | null;
  options?: Options;
  network?: Network | null;
  tooltipController?: GraphTooltipController | null;
  dragController?: GraphDragPhysicsController2D | null;
  isDragging?: boolean;
  hoveredNodeId?: string | null;
  secondaryHoveredNodeId?: string | null;
  activeHighlightDists?: Map<string, number> | null;
  draggedNodeId?: string | null;
  focusedNodeIds?: Set<string> | null;
  highlightFrameId?: number | null;
  lastDraggedAt?: number;
  lastOrderSignature?: string;
  forcePositions: Map<string, { x: number; y: number }>;
  initialForcePositions: Map<string, { x: number; y: number }>;
  tuningGeneration?: number;
  tuningInFlight?: boolean;
  dragStabilizeTimeout?: ReturnType<typeof setTimeout> | null;
  currentLayout?: string;
  isLight?: boolean;
  resizeObserver?: ResizeObserver | null;
  intersectionObserver?: IntersectionObserver | null;
  animationFrameId?: number | null;
  viewportAdaptFrameId?: number | null;
  applyHighlight?(activeId: string | null, immediate?: boolean): void;
  init(container: HTMLElement, payload: VisNetworkPayload, layout: string, isLight: boolean, extraOptions?: VisNetworkExtraOptions): Promise<VisNetworkEngine>;
  fitToView(duration?: number): void;
  stepViewportTowardCloud(alpha: number): void;
  startViewportAdaptLoop(durationMs?: number, baseAlpha?: number): void;
  computeLayoutTargets(layout: string, useCurrentOrder?: boolean): { targets: Record<string, { x: number; y: number }>; signature: string };
  updateLayout(layout: string, isLight: boolean): void;
  applyTuning(category: 'physics' | 'geometry' | 'visual' | 'reset'): void;
  pause(): void;
  resume(): void;
  animateTo(targets: Record<string, { x: number; y: number }>, duration?: number, excludeNodeId?: string, fitAfter?: boolean): void;
  destroy(): void;
}

const engine: VisNetworkEngine = {
  layouts: [
    { id: 'force', label: 'Force Directed (Organic)' },
    { id: 'radial', label: 'Concentric Rings (Tags → Items)' },
    { id: 'columns', label: 'Structured Columns (Category)' }
  ],
  forcePositions: new Map(),
  initialForcePositions: new Map(),
  dragController: null,

  async init(container: HTMLElement, payload: VisNetworkPayload, layout: string, isLight: boolean, extraOptions: VisNetworkExtraOptions = {}) {
    this.container = container;
    this.nodes = payload['vis-network'].nodes;
    this.connections = payload['vis-network'].connections;
    this.forcePositions = new Map();
    this.initialForcePositions = new Map();

    const colors = getVisNodeColors(isLight);
    const styleTokens = getGraphStyleTokens(isLight);
    const groupColors = GRAPH_COLORS[isLight ? 'light' : 'dark'];

    // Initialize with pre-computed ForceAtlas2Based coordinates.
    this.visNodes = new DataSet<VisCustomNode>((this.nodes || []).map((n) => {
      const nx = typeof n.x === 'number' ? n.x : 0;
      const ny = typeof n.y === 'number' ? n.y : 0;
      this.forcePositions.set(n.id, { x: nx, y: ny });
      this.initialForcePositions.set(n.id, { x: nx, y: ny });
      return {
        id: n.id,
        label: '',
        shape: 'dot',
        size: styleTokens.nodeRadius,
        displaySize: styleTokens.nodeRadius,
        displayColor: groupColors[n.group] || groupColors[0],
        x: nx,
        y: ny,
        rawGroup: n.group,
        color: colors[n.group],
        chosen: false
      };
    }));

    this.visEdges = new DataSet<VisCustomEdge>((this.connections || []).map((c, idx) => ({
      id: `${c.sourceId}-${c.targetId}-${idx}`,
      from: c.sourceId,
      to: c.targetId,
      width: styleTokens.edgeWidth,
      hoverWidth: styleTokens.edgeWidth,
      displayWidth: styleTokens.edgeWidth,
      displayColor: styleTokens.edgeColor,
      chosen: false,
      color: {
        color: styleTokens.edgeColor,
        highlight: styleTokens.edgeColor,
        hover: styleTokens.edgeColor
      }
    })));

    const data = {
      nodes: this.visNodes || undefined,
      edges: this.visEdges || undefined
    };

    const extraInteraction = extraOptions.interaction || {};
    const interactionOptions = Object.assign({
      hover: false,
      hoverConnectedEdges: false,
      tooltipDelay: 100,
      zoomView: false,
      dragView: false,
      dragNodes: false
    }, extraInteraction);

    const utmSource = String(extraOptions.utmSource || 'vis_network');
    const utmMedium = String(extraOptions.utmMedium || 'interactive_graph');
    const utmCampaign = String(extraOptions.utmCampaign || 'knowledge_network');

    this.options = {
      nodes: {
        shape: 'dot',
        size: styleTokens.nodeRadius,
        chosen: false,
        borderWidth: 1.5,
        borderWidthSelected: 1.5
      },
      edges: {
        width: styleTokens.edgeWidth,
        hoverWidth: styleTokens.edgeWidth,
        chosen: false,
        smooth: {
          enabled: false,
          type: 'continuous',
          forceDirection: 'none',
          roundness: 0.5
        }
      },
      physics: {
        enabled: false,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -50,
          centralGravity: 0.025,
          springLength: 80,
          springConstant: 0.08,
          damping: 0.4
        },
        stabilization: {
          enabled: false
        }
      },
      interaction: interactionOptions
    };

    this.network = new Network(container, data, this.options);
    this.fitToView(0);
    this.tooltipController = createGraphTooltipController(container);

    if (interactionOptions.dragView === false) {
      container.style.touchAction = 'pan-y';
      const canvasEl = container.querySelector('canvas');
      if (canvasEl) {
        canvasEl.style.touchAction = 'pan-y';
      }
      const visWrapper = container.querySelector('.vis-network') as HTMLElement | null;
      if (visWrapper) {
        visWrapper.style.touchAction = 'pan-y';
      }
    }

    this.isDragging = false;
    this.hoveredNodeId = null;
    this.secondaryHoveredNodeId = null;
    this.activeHighlightDists = null;
    this.draggedNodeId = null;
    this.lastDraggedAt = 0;
    this.lastOrderSignature = '';
    this.dragStabilizeTimeout = null;

    const adjacency = buildGraphAdjacency(this.connections || []);
    let lastHighlightedKey = '';

    const nodeDisplayColorMap = new Map<string, string>();
    const nodeDisplaySizeMap = new Map<string, number>();
    const edgeDisplayColorMap = new Map<string, string>();
    const edgeDisplayWidthMap = new Map<string, number>();

    const rawNodesList = (this.nodes || []).map((n) => {
      const col = groupColors[n.group] || groupColors[0];
      nodeDisplayColorMap.set(n.id, col);
      nodeDisplaySizeMap.set(n.id, styleTokens.nodeRadius);
      return { id: n.id, group: n.group };
    });

    const rawEdgesList = (this.connections || []).map((c, idx) => {
      const eid = `${c.sourceId}-${c.targetId}-${idx}`;
      edgeDisplayColorMap.set(eid, styleTokens.edgeColor);
      edgeDisplayWidthMap.set(eid, styleTokens.edgeWidth);
      return { id: eid, from: c.sourceId, to: c.targetId };
    });

    this.network.on('afterDrawing', (ctx: CanvasRenderingContext2D) => {
      const dists = this.activeHighlightDists;
      const secId = this.secondaryHoveredNodeId ?? null;
      if ((!dists && !secId) || !this.network) return;

      const bodyNodes = (this.network as VisNetworkWithBody).body?.nodes;
      const currentTokens = getGraphStyleTokens(Boolean(this.isLight));
      const palette = GRAPH_COLORS[this.isLight ? 'light' : 'dark'];

      type DrawItem =
        | { isNode: false; z: number; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
        | { isNode: true; z: number; x: number; y: number; radius: number; color: string };

      const items: DrawItem[] = [];

      if (dists) {
        for (const edge of rawEdgesList) {
          const edgeZ = getEdgeHopZIndex(dists.get(edge.from), dists.get(edge.to));
          if (edgeZ < 8) continue;
          const p1 = bodyNodes?.[edge.from] || this.forcePositions.get(edge.from);
          const p2 = bodyNodes?.[edge.to] || this.forcePositions.get(edge.to);
          if (!p1 || !p2) continue;
          items.push({
            isNode: false,
            z: edgeZ,
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            color: edgeDisplayColorMap.get(edge.id) || currentTokens.edgeColor,
            width: edgeDisplayWidthMap.get(edge.id) ?? currentTokens.edgeWidth
          });
        }
      }

      for (const node of rawNodesList) {
        const id = node.id;
        const hopDist = dists ? dists.get(id) : undefined;
        const nodeZ = secId !== null && id === secId ? 48 : dists ? getNodeHopZIndex(hopDist) : 2;
        if (nodeZ < 10) continue;
        const p = bodyNodes?.[id] || this.forcePositions.get(id);
        if (!p) continue;
        items.push({
          isNode: true,
          z: nodeZ,
          x: p.x,
          y: p.y,
          radius: nodeDisplaySizeMap.get(id) ?? currentTokens.nodeRadius,
          color: nodeDisplayColorMap.get(id) || palette[node.group] || palette[0]
        });
      }

      if (items.length === 0) return;
      items.sort((a, b) => a.z - b.z || (a.isNode ? 1 : 0) - (b.isNode ? 1 : 0));

      ctx.save();
      ctx.lineCap = 'round';
      for (const item of items) {
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
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = item.color;
          ctx.stroke();
        }
      }
      ctx.restore();
    });

    this.applyHighlight = (activeId: string | null, immediate = false) => {
      if (!this.visNodes || !this.visEdges) return;
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
      const palette = GRAPH_COLORS[currentIsLight ? 'light' : 'dark'];
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

      for (const node of rawNodesList) {
        const id = node.id;
        const baseColor = palette[node.group] || palette[0];
        const startColor = nodeDisplayColorMap.get(id) || baseColor;
        const startSize = nodeDisplaySizeMap.get(id) ?? currentTokens.nodeRadius;
        const hopDist = dists ? dists.get(id) : undefined;
        const isSecHover = secId !== null && id === secId;
        const baseScale = dists ? getAttenuatedNodeScale(hopDist) : 1;
        const targetScale = isSecHover ? Math.max(baseScale * 1.15, 1.32) : baseScale;
        const targetColor = isSecHover
          ? baseColor
          : dists
            ? getAttenuatedNodeColor(baseColor, hopDist, currentIsLight)
            : baseColor;
        const targetSize = currentTokens.nodeRadius * targetScale;
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
      const edgeZMap = new Map<string, number>();

      for (const edge of rawEdgesList) {
        const edgeId = edge.id;
        const dSrc = dists ? dists.get(edge.from) : undefined;
        const dTgt = dists ? dists.get(edge.to) : undefined;
        const startColor = edgeDisplayColorMap.get(edgeId) || currentTokens.edgeColor;
        const startWidth = edgeDisplayWidthMap.get(edgeId) ?? currentTokens.edgeWidth;
        const targetStyle = dists
          ? getAttenuatedEdgeStyle(dSrc, dTgt, currentIsLight)
          : { color: currentTokens.edgeColor, width: currentTokens.edgeWidth };
        if (dists) {
          edgeZMap.set(edgeId, getEdgeHopZIndex(dSrc, dTgt));
        }
        edgeTrans.push({
          id: edgeId,
          startColor,
          targetColor: targetStyle.color,
          startWidth,
          targetWidth: targetStyle.width,
          changed: startColor !== targetStyle.color || Math.abs(startWidth - targetStyle.width) > 1e-3
        });
      }

      if (dists) {
        const internalBody = (this.network as VisNetworkWithBody | null | undefined)?.body;
        if (internalBody?.edgeIndices) {
          internalBody.edgeIndices.sort(
            (a, b) => (edgeZMap.get(String(a)) ?? 1) - (edgeZMap.get(String(b)) ?? 1)
          );
        }
        if (internalBody?.nodeIndices) {
          internalBody.nodeIndices.sort(
            (a, b) => getNodeHopZIndex(dists.get(String(a))) - getNodeHopZIndex(dists.get(String(b)))
          );
        }
      }

      const renderStep = (ease: number, commitDataSet: boolean) => {
        if (!this.visNodes || !this.visEdges || !this.network) return;
        const internalBody = (this.network as VisNetworkWithBody).body;
        const bodyNodes = internalBody?.nodes;
        const bodyEdges = internalBody?.edges;

        const nodeUpdates: VisCustomNode[] = [];
        for (const nt of nodeTrans) {
          if (!nt.changed && !commitDataSet) continue;
          const c = ease >= 1 ? nt.targetColor : interpolateHexColor(nt.startColor, nt.targetColor, ease);
          const s = ease >= 1 ? nt.targetSize : nt.startSize + (nt.targetSize - nt.startSize) * ease;
          nodeDisplayColorMap.set(nt.id, c);
          nodeDisplaySizeMap.set(nt.id, s);

          const bNode = bodyNodes?.[nt.id];
          if (bNode?.options) {
            bNode.options.size = s;
            if (bNode.options.color) {
              bNode.options.color.background = c;
              bNode.options.color.border = c;
              if (bNode.options.color.highlight) {
                bNode.options.color.highlight.background = c;
                bNode.options.color.highlight.border = c;
              }
              if (bNode.options.color.hover) {
                bNode.options.color.hover.background = c;
                bNode.options.color.hover.border = c;
              }
            }
          }

          if (commitDataSet && nt.changed) {
            nodeUpdates.push({
              id: nt.id,
              size: s,
              displaySize: s,
              displayColor: c,
              color: {
                background: c,
                border: c,
                highlight: { background: c, border: c },
                hover: { background: c, border: c }
              }
            });
          }
        }

        const edgeUpdates: VisCustomEdge[] = [];
        for (const et of edgeTrans) {
          if (!et.changed && !commitDataSet) continue;
          const c = ease >= 1 ? et.targetColor : interpolateHexColor(et.startColor, et.targetColor, ease);
          const w = ease >= 1 ? et.targetWidth : et.startWidth + (et.targetWidth - et.startWidth) * ease;
          edgeDisplayColorMap.set(et.id, c);
          edgeDisplayWidthMap.set(et.id, w);

          const bEdge = bodyEdges?.[et.id];
          if (bEdge?.options) {
            bEdge.options.width = w;
            bEdge.options.hoverWidth = w;
            if (bEdge.options.color) {
              bEdge.options.color.color = c;
              bEdge.options.color.highlight = c;
              bEdge.options.color.hover = c;
            }
          }

          if (commitDataSet && et.changed) {
            edgeUpdates.push({
              id: et.id,
              width: w,
              hoverWidth: w,
              displayWidth: w,
              displayColor: c,
              color: {
                color: c,
                highlight: c,
                hover: c
              }
            });
          }
        }

        if (commitDataSet) {
          if (nodeUpdates.length > 0) this.visNodes.update(nodeUpdates);
          if (edgeUpdates.length > 0) this.visEdges.update(edgeUpdates);
        }
        this.network.redraw();
      };

      if (immediate) {
        renderStep(1, true);
        return;
      }

      const startTime = performance.now();
      const step = (now: number) => {
        if (!this.visNodes || !this.visEdges) {
          this.highlightFrameId = null;
          return;
        }
        const progress = Math.min(1, (now - startTime) / HIGHLIGHT_TRANSITION_MS);
        const ease = easeHighlightTransition(progress);
        renderStep(ease, progress >= 1);
        if (progress < 1) {
          this.highlightFrameId = requestAnimationFrame(step);
        } else {
          this.highlightFrameId = null;
        }
      };
      this.highlightFrameId = requestAnimationFrame(step);
    };

    this.dragController = createGraphDragPhysicsController2D({
      nodes: (this.nodes || []).map((n) => ({
        id: n.id,
        group: n.group,
        x: typeof n.x === 'number' ? n.x : 0,
        y: typeof n.y === 'number' ? n.y : 0,
      })),
      edges: (this.connections || []).map((c) => ({
        source: c.sourceId,
        target: c.targetId,
        weight: c.weight ?? 0.5,
      })),
      isLight: () => Boolean(this.isLight),
      onTick: (positions, draggedId) => {
        if (!this.network) return;
        const bodyNodes = (this.network as VisNetworkWithBody).body?.nodes;
        for (const [id, pt] of positions.entries()) {
          if (id === draggedId) continue;
          const bNode = bodyNodes?.[id];
          if (bNode) {
            bNode.x = pt.x;
            bNode.y = pt.y;
          } else {
            this.network.moveNode(id, pt.x, pt.y);
          }
          this.forcePositions.set(id, { x: pt.x, y: pt.y });
        }
        this.network.redraw();
      },
      onSettleComplete: (positions) => {
        if (!this.visNodes) return;
        const updates: VisNode[] = [];
        for (const [id, pt] of positions.entries()) {
          this.forcePositions.set(id, { x: pt.x, y: pt.y });
          updates.push({ id, x: pt.x, y: pt.y });
        }
        this.visNodes.update(updates);
      },
    });

    this.tooltipController?.bindProximityInteraction({
      getScreenNodes: () => {
        if (!this.network || !this.nodes) return [];
        const bodyNodes = (this.network as VisNetworkWithBody).body?.nodes;
        const result: { node: RawGraphNode; x: number; y: number }[] = [];
        for (const n of this.nodes) {
          const canvasPos = bodyNodes?.[n.id] || this.forcePositions.get(n.id);
          if (!canvasPos) continue;
          const domPos = this.network.canvasToDOM({ x: canvasPos.x, y: canvasPos.y });
          result.push({ node: n, x: domPos.x, y: domPos.y });
        }
        return result;
      },
      adjacency,
      isLight: () => Boolean(this.isLight),
      isDragging: () => Boolean(this.isDragging),
      getLastDraggedAt: () => this.lastDraggedAt || 0,
      onActiveNodeChange: (nodeId) => {
        this.hoveredNodeId = nodeId;
        if (!this.isDragging) {
          this.applyHighlight?.(nodeId);
        }
      },
      onSecondaryHoverNodeChange: (nodeId) => {
        this.secondaryHoveredNodeId = nodeId;
        if (!this.isDragging) {
          this.applyHighlight?.(this.hoveredNodeId ?? null);
        }
      },
      onFocusNodeChange: (_nodeId, focusNodeIds) => {
        this.focusedNodeIds = focusNodeIds;
        this.startViewportAdaptLoop(1600, GRAPH_VIEWPORT_CONFIG.focusAlpha);
      },
      onNavigate: (node) => {
        const targetPath = node.id;
        if (
          targetPath.startsWith('/posts') ||
          targetPath.startsWith('/publications') ||
          targetPath.startsWith('/presentations') ||
          targetPath.startsWith('/projects') ||
          targetPath.startsWith('/courses') ||
          targetPath.startsWith('/services') ||
          targetPath.startsWith('/newsletters') ||
          targetPath.startsWith('/visualizations') ||
          targetPath.startsWith('/tags')
        ) {
          const targetUrl = new URL(targetPath, window.location.origin);
          targetUrl.searchParams.set('utm_source', utmSource);
          targetUrl.searchParams.set('utm_medium', utmMedium);
          targetUrl.searchParams.set('utm_campaign', utmCampaign);
          window.location.href = targetUrl.pathname + targetUrl.search;
        }
      },
      onNodeDragStart: (rawNode, sx, sy) => {
        if (!this.network) return;
        this.isDragging = true;
        this.lastDraggedAt = performance.now();
        const draggedId = rawNode.id;
        this.draggedNodeId = draggedId;
        this.applyHighlight?.(draggedId);

        if (this.dragStabilizeTimeout) {
          clearTimeout(this.dragStabilizeTimeout);
          this.dragStabilizeTimeout = null;
        }
        if (this.viewportAdaptFrameId) {
          cancelAnimationFrame(this.viewportAdaptFrameId);
          this.viewportAdaptFrameId = null;
        }
        if (this.animationFrameId) {
          cancelAnimationFrame(this.animationFrameId);
          this.animationFrameId = null;
        }

        const cPos = this.network.DOMtoCanvas({ x: sx, y: sy });
        const bNode = (this.network as VisNetworkWithBody).body?.nodes?.[draggedId];
        if (bNode) {
          bNode.x = cPos.x;
          bNode.y = cPos.y;
          this.network.redraw();
        } else {
          this.network.moveNode(draggedId, cPos.x, cPos.y);
        }

        if (this.currentLayout === 'force') {
          this.forcePositions.set(draggedId, { x: cPos.x, y: cPos.y });
          this.dragController?.startDrag(draggedId, { x: cPos.x, y: cPos.y });
        } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          const { signature } = this.computeLayoutTargets(this.currentLayout, true);
          this.lastOrderSignature = signature;
        }
      },
      onNodeDragMove: (rawNode, sx, sy) => {
        if (!this.network) return;
        this.lastDraggedAt = performance.now();
        const draggedId = rawNode.id;
        const cPos = this.network.DOMtoCanvas({ x: sx, y: sy });
        const bNode = (this.network as VisNetworkWithBody).body?.nodes?.[draggedId];
        if (bNode) {
          bNode.x = cPos.x;
          bNode.y = cPos.y;
          if (this.currentLayout !== 'force') {
            this.network.redraw();
          }
        } else {
          this.network.moveNode(draggedId, cPos.x, cPos.y);
        }

        if (this.currentLayout === 'force') {
          this.forcePositions.set(draggedId, { x: cPos.x, y: cPos.y });
          this.dragController?.moveDrag(draggedId, { x: cPos.x, y: cPos.y });
        } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          const { targets, signature } = this.computeLayoutTargets(this.currentLayout, true);
          if (signature !== this.lastOrderSignature) {
            this.lastOrderSignature = signature;
            this.animateTo(targets, 250, draggedId);
          }
        }
      },
      onNodeDragEnd: (rawNode) => {
        if (!this.network) return;
        const draggedId = rawNode.id;
        this.isDragging = false;
        this.draggedNodeId = null;
        this.hoveredNodeId = null;
        this.lastDraggedAt = performance.now();
        this.visNodes?.update({ id: draggedId, fixed: { x: false, y: false } });
        this.network.unselectAll();
        container.style.cursor = "default";
        this.applyHighlight?.(null);

        if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          const { targets } = this.computeLayoutTargets(this.currentLayout, true);
          this.animateTo(targets, 400);
          this.startViewportAdaptLoop(2400);
          return;
        }

        const currentPos = this.network.getPositions([draggedId])[draggedId] || this.forcePositions.get(draggedId);
        if (currentPos) {
          this.forcePositions.set(draggedId, { x: currentPos.x, y: currentPos.y });
          this.dragController?.endDrag(draggedId, { x: currentPos.x, y: currentPos.y });
        } else {
          this.dragController?.endDrag(draggedId);
        }
        this.startViewportAdaptLoop(2400);
      }
    });

    this.currentLayout = 'force';
    this.isLight = isLight;
    if (layout !== 'force') {
      const { targets, signature } = this.computeLayoutTargets(layout, false);
      this.currentLayout = layout;
      this.lastOrderSignature = signature;
      const initialUpdates: VisNode[] = Object.entries(targets).map(([id, pos]) => ({
        id,
        x: pos.x,
        y: pos.y
      }));
      this.visNodes.update(initialUpdates);
      this.fitToView(0);
    }

    // Bind ResizeObserver to handle network container changes dynamically with dimension threshold
    let lastWidth = container.clientWidth;
    let lastHeight = container.clientHeight;
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (Math.abs(width - lastWidth) >= 1 || Math.abs(height - lastHeight) >= 1) {
          lastWidth = width;
          lastHeight = height;
          if (this.network) {
            if ((this.currentLayout === 'radial' || this.currentLayout === 'columns') && this.visNodes) {
              const { targets, signature } = this.computeLayoutTargets(this.currentLayout, true);
              this.lastOrderSignature = signature;
              const updates: VisNode[] = Object.entries(targets).map(([id, pos]) => ({
                id,
                x: pos.x,
                y: pos.y
              }));
              this.visNodes.update(updates);
            }
            this.network.redraw();
            this.fitToView(0);
          }
        }
      }
    });
    this.resizeObserver.observe(container);

    // Automatically pause physics/animation when container is scrolled out of view
    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) {
          this.pause();
        } else {
          this.resume();
        }
      });
    }, { rootMargin: '100px 0px' });
    this.intersectionObserver.observe(container);

    return this;
  },

  fitToView(duration = 0) {
    if (!this.network || !this.nodes || this.nodes.length === 0) return;
    const width = this.container?.clientWidth || 0;
    const height = this.container?.clientHeight || 0;
    if (width <= 0 || height <= 0) return;

    const isSubgraph = Boolean(this.focusedNodeIds && this.focusedNodeIds.size > 0);
    const bodyNodes = (this.network as VisNetworkWithBody).body?.nodes;
    const r = getGraphStyleTokens(Boolean(this.isLight)).nodeRadius;
    const points: { x: number; y: number }[] = [];
    for (const n of this.nodes) {
      if (isSubgraph && !this.focusedNodeIds!.has(n.id)) continue;
      const p = bodyNodes?.[n.id] || this.forcePositions.get(n.id);
      if (p && typeof p.x === 'number' && typeof p.y === 'number') {
        points.push({ x: p.x, y: p.y });
      }
    }

    const fit = compute2DViewportFit(points, width, height, r, isSubgraph);
    if (!fit) return;

    this.network.moveTo({
      position: { x: fit.midX, y: fit.midY },
      scale: fit.scale,
      animation: duration > 0 ? { duration, easingFunction: 'easeInOutQuad' } : false
    });
  },

  stepViewportTowardCloud(alpha: number) {
    if (!this.network || !this.nodes || this.nodes.length === 0) return;
    const width = this.container?.clientWidth || 0;
    const height = this.container?.clientHeight || 0;
    if (width <= 0 || height <= 0) return;

    const isSubgraph = Boolean(this.focusedNodeIds && this.focusedNodeIds.size > 0);
    const bodyNodes = (this.network as VisNetworkWithBody).body?.nodes;
    const r = getGraphStyleTokens(Boolean(this.isLight)).nodeRadius;
    const points: { x: number; y: number }[] = [];
    for (const n of this.nodes) {
      if (isSubgraph && !this.focusedNodeIds!.has(n.id)) continue;
      const p = bodyNodes?.[n.id] || this.forcePositions.get(n.id);
      if (p && typeof p.x === 'number' && typeof p.y === 'number') {
        points.push({ x: p.x, y: p.y });
      }
    }

    const fit = compute2DViewportFit(points, width, height, r, isSubgraph);
    if (!fit) return;

    const curPos = this.network.getViewPosition();
    const curScale = this.network.getScale() || 1;
    const t = Math.max(0, Math.min(1, alpha));

    const nextX = curPos.x + (fit.midX - curPos.x) * t;
    const nextY = curPos.y + (fit.midY - curPos.y) * t;
    const nextScale = curScale + (fit.scale - curScale) * t;

    this.network.moveTo({
      position: { x: nextX, y: nextY },
      scale: nextScale,
      animation: false
    });
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
      if (!this.network || this.isDragging) {
        this.viewportAdaptFrameId = null;
        return;
      }
      const dt = Math.max(1, now - lastTime);
      lastTime = now;
      const stepAlpha = 1 - Math.pow(1 - baseAlpha, Math.min(50, dt) / 16.67);
      if (this.currentLayout === 'force') {
        const bodyNodes = (this.network as VisNetworkWithBody).body?.nodes;
        if (bodyNodes && this.nodes) {
          for (const n of this.nodes) {
            const p = bodyNodes[n.id];
            if (p) this.forcePositions.set(n.id, { x: p.x, y: p.y });
          }
        }
      }
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
    const pos = useCurrentOrder && this.network ? this.network.getPositions() : {};
    const width = this.container?.clientWidth || 800;
    const height = this.container?.clientHeight || 500;
    const solverNodes: SolverGraphNode[] = (this.nodes || []).map((n) => {
      const p = pos[n.id];
      return {
        id: n.id,
        group: n.group,
        x: p ? p.x : (n.x ?? 0),
        y: p ? p.y : (n.y ?? 0),
      };
    });
    return compute2DGeometryTargets(solverNodes, layout, {
      useCurrentOrder,
      width,
      height,
      centerOrigin: true,
    });
  },

  updateLayout(layout: string, isLight: boolean) {
    if (!this.network || !this.visNodes || !this.visEdges) return;
    const layoutChanged = this.currentLayout !== layout;
    this.currentLayout = layout;
    this.isLight = isLight;

    if (layoutChanged) {
      this.tuningGeneration = (this.tuningGeneration || 0) + 1;
      this.tuningInFlight = false;
      this.focusedNodeIds = null;
      this.tooltipController?.clearFocus();
      this.dragController?.stop();
    }

    // Apply color update to nodes and edges based on theme (and preserve any active highlight)
    this.applyHighlight?.(this.draggedNodeId ?? this.hoveredNodeId ?? null, true);

    if (!layoutChanged) {
      this.network.setOptions({ physics: { enabled: false } });
      this.network.stopSimulation();
      return;
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.viewportAdaptFrameId) {
      cancelAnimationFrame(this.viewportAdaptFrameId);
      this.viewportAdaptFrameId = null;
    }

    if (this.dragStabilizeTimeout) {
      clearTimeout(this.dragStabilizeTimeout);
      this.dragStabilizeTimeout = null;
    }
    this.network.setOptions({ physics: { enabled: false } });
    this.network.stopSimulation();

    if (layout === 'radial' || layout === 'columns') {
      const { targets, signature } = this.computeLayoutTargets(layout, false);
      this.lastOrderSignature = signature;
      this.animateTo(targets, 600, undefined, true);
    } else if (this.forcePositions.size > 0) {
      const targets: Record<string, { x: number; y: number }> = {};
      for (const [id, pos] of this.forcePositions.entries()) {
        targets[id] = { x: pos.x, y: pos.y };
      }
      this.animateTo(targets, 600, undefined, true);
    }
  },

  applyTuning(category: 'physics' | 'geometry' | 'visual' | 'reset') {
    if (!this.network || !this.visNodes || !this.visEdges) return;
    if (category === 'visual') {
      this.applyHighlight?.(this.draggedNodeId ?? this.hoveredNodeId ?? null, true);
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
      const gen = (this.tuningGeneration = (this.tuningGeneration || 0) + 1);
      if (this.currentLayout === 'force' && this.nodes && this.connections) {
        this.dragController?.stop();
        if (isDefaultGraphTuningState() && this.initialForcePositions.size > 0) {
          this.tuningInFlight = false;
          const targets: Record<string, { x: number; y: number }> = {};
          this.forcePositions.clear();
          for (const [id, pos] of this.initialForcePositions.entries()) {
            this.forcePositions.set(id, { x: pos.x, y: pos.y });
            targets[id] = { x: pos.x, y: pos.y };
          }
          this.animateTo(targets, 450, undefined, true);
        } else {
          this.tuningInFlight = true;
          void solveVisNetworkForceLayoutAsync(
            {
              nodes: this.nodes,
              connections: this.connections,
            },
            { shouldCancel: () => this.tuningGeneration !== gen }
          ).then((targets) => {
            if (!targets || this.tuningGeneration !== gen || !this.network) return;
            this.tuningInFlight = false;
            if (this.currentLayout !== 'force') return;
            for (const [id, pt] of Object.entries(targets)) {
              this.forcePositions.set(id, { x: pt.x, y: pt.y });
            }
            this.animateTo(targets, 450, undefined, true);
          });
        }
      }
      return;
    }
    if (category === 'reset') {
      this.tuningGeneration = (this.tuningGeneration || 0) + 1;
      this.tuningInFlight = false;
      this.dragController?.stop();
      this.forcePositions.clear();
      for (const [id, pos] of this.initialForcePositions.entries()) {
        this.forcePositions.set(id, { x: pos.x, y: pos.y });
      }
      this.applyHighlight?.(this.draggedNodeId ?? this.hoveredNodeId ?? null, true);
      if (this.currentLayout === 'force') {
        const targets: Record<string, { x: number; y: number }> = {};
        for (const [id, pos] of this.initialForcePositions.entries()) {
          targets[id] = { x: pos.x, y: pos.y };
        }
        this.animateTo(targets, 450, undefined, true);
      } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
        const { targets, signature } = this.computeLayoutTargets(this.currentLayout, false);
        this.lastOrderSignature = signature;
        this.animateTo(targets, 450, undefined, true);
      }
    }
  },

  pause() {
    this.tuningGeneration = (this.tuningGeneration || 0) + 1;
    this.tuningInFlight = false;
    if (this.highlightFrameId) {
      cancelAnimationFrame(this.highlightFrameId);
      this.highlightFrameId = null;
    }
    if (this.dragStabilizeTimeout) {
      clearTimeout(this.dragStabilizeTimeout);
      this.dragStabilizeTimeout = null;
    }
    this.dragController?.stop();
    if (this.network) {
      this.network.setOptions({ physics: { enabled: false } });
      this.network.stopSimulation();
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.viewportAdaptFrameId) {
      cancelAnimationFrame(this.viewportAdaptFrameId);
      this.viewportAdaptFrameId = null;
    }
  },

  resume() {
    if (this.network) {
      this.network.redraw();
    }
  },

  animateTo(targets: Record<string, { x: number; y: number }>, duration = 600, excludeNodeId?: string, fitAfter = false) {
    if (!this.network || !this.visNodes) return;
    this.network.setOptions({ physics: { enabled: false } });
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.viewportAdaptFrameId) {
      cancelAnimationFrame(this.viewportAdaptFrameId);
      this.viewportAdaptFrameId = null;
    }

    const startTime = performance.now();
    const startPositions = this.network.getPositions();

    const step = (time: number) => {
      if (!this.network || !this.visNodes) return;
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const ease = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const bodyNodes = (this.network as VisNetworkWithBody).body?.nodes;
      const isFinal = progress >= 1;
      const updates: (VisNode & { rawGroup?: number })[] = [];

      for (const n of this.nodes || []) {
        if (excludeNodeId && n.id === excludeNodeId) continue;
        const start = startPositions[n.id] || { x: 0, y: 0 };
        const target = targets[n.id];
        if (target) {
          const nx = start.x + (target.x - start.x) * ease;
          const ny = start.y + (target.y - start.y) * ease;
          const bNode = bodyNodes?.[n.id];
          if (bNode) {
            bNode.x = nx;
            bNode.y = ny;
          }
          if (isFinal || !bNode) {
            updates.push({
              id: n.id,
              x: nx,
              y: ny
            });
          }
        }
      }

      if (updates.length > 0) {
        this.visNodes.update(updates);
      }

      if (fitAfter) {
        this.fitToView(0);
      } else {
        this.network.redraw();
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
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  },

  destroy() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.pause();
    if (this.dragController) {
      this.dragController.destroy();
      this.dragController = null;
    }
    if (this.tooltipController) {
      this.tooltipController.destroy();
      this.tooltipController = null;
    }
    if (this.network) {
      this.network.destroy();
      this.network = null;
    }
    this.container = null;
    this.forcePositions.clear();
    this.visNodes = null;
    this.visEdges = null;
  }
};

export default engine;
