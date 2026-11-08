import { Sigma } from 'sigma';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import {
  GRAPH_COLORS,
  GRAPH_VIEWPORT_CONFIG,
  HIGHLIGHT_TRANSITION_MS,
  easeHighlightTransition,
  getGraphStyleTokens,
  buildGraphAdjacency,
  computeHopDistances,
  interpolateHexColor,
  getAttenuatedNodeColor,
  getAttenuatedNodeScale,
  getAttenuatedEdgeStyle,
  getNodeHopZIndex,
  getEdgeHopZIndex,
  type SigmaNode,
  type SigmaEdge
} from '@commons/shared/graph-payload';
import { getThemeTokens } from '@commons/shared/domain-themes';
import { createGraphTooltipController, type GraphTooltipController, type RawGraphNode } from '@commons/client/vis-tooltip';

const SIGMA_BASE_NODE_SIZE = 5;

function getNodeColor(group: number, isLight: boolean): string {
  const colors = isLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;
  return colors[group] || colors[0];
}

export type SigmaNodeData = SigmaNode;
export type SigmaEdgeData = SigmaEdge;

export interface SigmaPayload {
  sigma: {
    nodes: SigmaNodeData[];
    edges: SigmaEdgeData[];
  };
}

export interface SigmaEngine {
  layouts: { id: string; label: string }[];
  graph: Graph | null;
  sigma: Sigma | null;
  nodeMap: Map<string, SigmaNodeData> | null;
  tooltipController: GraphTooltipController | null;
  hoveredNodeId?: string | null;
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
  physicsFrameId?: number | null;
  viewportAdaptFrameId?: number | null;
  resizeObserver: ResizeObserver | null;
  animationFrameId: number | null;
  init(container: HTMLElement, payload: SigmaPayload, layout: string, isLight: boolean, extraOptions?: Record<string, string>): Promise<SigmaEngine>;
  stepViewportTowardCloud(alpha: number): void;
  startViewportAdaptLoop(durationMs?: number): void;
  getForcePositions(): Record<string, { x: number; y: number }>;
  computeLayoutTargets(layout: string, useCurrentOrder?: boolean): { targets: Record<string, { x: number; y: number }>; signature: string };
  updateLayout(layout: string, isLight: boolean): void;
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
  mouseMoveHandler: null,
  container: null,
  lastDraggedAt: 0,
  lastOrderSignature: '',
  forcePositions: new Map(),
  physicsFrameId: null,
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
    const nodes = payload.sigma.nodes;
    const edges = payload.sigma.edges;
    this.nodeMap = new Map(nodes.map(n => [n.id, n]));

    const styleTokens = getGraphStyleTokens(isLight);

    nodes.forEach(n => {
      const nx = typeof n.x === 'number' ? n.x : 0;
      const ny = typeof n.y === 'number' ? n.y : 0;
      this.forcePositions.set(n.id, { x: nx, y: ny });
      this.graph?.addNode(n.id, {
        label: '',
        x: nx,
        y: ny,
        size: SIGMA_BASE_NODE_SIZE,
        zIndex: 1,
        group: n.group ?? 0,
        color: getNodeColor(n.group ?? 0, isLight)
      });
    });

    edges.forEach(e => {
      this.graph?.addEdge(e.source, e.target, {
        size: styleTokens.edgeWidth,
        color: styleTokens.edgeColor,
        zIndex: 1
      });
    });

    const tokens = getThemeTokens(isLight);
    this.sigma = new Sigma(this.graph, container, {
      defaultNodeColor: tokens.nodeDefault,
      defaultEdgeColor: styleTokens.edgeColor,
      renderLabels: false,
      zIndex: true,
      stagePadding: GRAPH_VIEWPORT_CONFIG.padX + SIGMA_BASE_NODE_SIZE,
      labelColor: { color: tokens.textHeading },
      labelFont: 'Outfit, Inter, sans-serif',
      labelSize: 10,
      defaultDrawNodeHover: () => {},
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

    const startForcePhysicsLoop = () => {
      if (this.physicsFrameId) return;
      const stepPhysics = () => {
        if (!this.sigma || !this.graph || draggedNode === null || this.currentLayout !== 'force') {
          this.physicsFrameId = null;
          return;
        }

        const pinnedX = this.graph.getNodeAttribute(draggedNode, 'x') as number;
        const pinnedY = this.graph.getNodeAttribute(draggedNode, 'y') as number;

        forceAtlas2.assign(this.graph, {
          iterations: 2,
          settings: {
            gravity: 0.8,
            scalingRatio: 1,
            slowDown: 6
          }
        });

        this.graph.setNodeAttribute(draggedNode, 'x', pinnedX);
        this.graph.setNodeAttribute(draggedNode, 'y', pinnedY);

        let sumX = 0;
        let sumY = 0;
        let count = 0;
        this.graph.forEachNode(nId => {
          sumX += (this.graph?.getNodeAttribute(nId, 'x') as number) || 0;
          sumY += (this.graph?.getNodeAttribute(nId, 'y') as number) || 0;
          count++;
        });
        if (count > 0) {
          const shiftX = (sumX / count) * 0.08;
          const shiftY = (sumY / count) * 0.08;
          this.graph.forEachNode(nId => {
            if (nId === draggedNode) return;
            this.graph?.setNodeAttribute(nId, 'x', ((this.graph?.getNodeAttribute(nId, 'x') as number) || 0) - shiftX);
            this.graph?.setNodeAttribute(nId, 'y', ((this.graph?.getNodeAttribute(nId, 'y') as number) || 0) - shiftY);
          });
        }

        this.sigma.refresh();

        this.physicsFrameId = requestAnimationFrame(stepPhysics);
      };
      this.physicsFrameId = requestAnimationFrame(stepPhysics);
    };

    this.hoveredNodeId = null;
    this.isLight = isLight;
    const adjacency = buildGraphAdjacency(edges);
    let lastHighlightedNodeId: string | null = null;

    const applyHighlight = (activeNodeId: string | null, immediate = false) => {
      if (!this.graph || !this.sigma) return;
      if (!immediate && activeNodeId === lastHighlightedNodeId) return;
      lastHighlightedNodeId = activeNodeId;

      if (this.highlightFrameId) {
        cancelAnimationFrame(this.highlightFrameId);
        this.highlightFrameId = null;
      }

      const currentIsLight = Boolean(this.isLight);
      const currentTokens = getGraphStyleTokens(currentIsLight);
      const dists = activeNodeId ? computeHopDistances(activeNodeId, adjacency) : null;

      const nodeTrans: {
        id: string;
        startColor: string;
        targetColor: string;
        startSize: number;
        targetSize: number;
        targetZIndex: number;
      }[] = [];

      this.graph.forEachNode(nId => {
        const grp = (this.graph?.getNodeAttribute(nId, 'group') as number | undefined) ?? 0;
        const baseColor = getNodeColor(grp, currentIsLight);
        const startColor = String(this.graph?.getNodeAttribute(nId, 'color') || baseColor);
        const startSize = Number(this.graph?.getNodeAttribute(nId, 'size') || SIGMA_BASE_NODE_SIZE);
        const hopDist = dists ? dists.get(nId) : undefined;
        const targetColor = dists
          ? getAttenuatedNodeColor(baseColor, hopDist, currentIsLight)
          : baseColor;
        const targetSize = dists
          ? SIGMA_BASE_NODE_SIZE * getAttenuatedNodeScale(hopDist)
          : SIGMA_BASE_NODE_SIZE;
        const targetZIndex = dists ? getNodeHopZIndex(hopDist) : 1;
        nodeTrans.push({ id: nId, startColor, targetColor, startSize, targetSize, targetZIndex });
      });

      const edgeTrans: {
        id: string;
        startColor: string;
        targetColor: string;
        startSize: number;
        targetSize: number;
        targetZIndex: number;
      }[] = [];

      this.graph.forEachEdge(edge => {
        const [src, tgt] = this.graph!.extremities(edge);
        const startColor = String(this.graph?.getEdgeAttribute(edge, 'color') || currentTokens.edgeColor);
        const startSize = Number(this.graph?.getEdgeAttribute(edge, 'size') || currentTokens.edgeWidth);
        const dSrc = dists ? dists.get(src) : undefined;
        const dTgt = dists ? dists.get(tgt) : undefined;
        const targetStyle = dists
          ? getAttenuatedEdgeStyle(dSrc, dTgt, currentIsLight)
          : { color: currentTokens.edgeColor, width: currentTokens.edgeWidth };
        const targetZIndex = dists ? getEdgeHopZIndex(dSrc, dTgt) : 1;
        edgeTrans.push({
          id: edge,
          startColor,
          targetColor: targetStyle.color,
          startSize,
          targetSize: targetStyle.width,
          targetZIndex
        });
      });

      if (dists) {
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
          this.graph.setNodeAttribute(nt.id, 'color', interpolateHexColor(nt.startColor, nt.targetColor, ease));
          this.graph.setNodeAttribute(nt.id, 'size', nt.startSize + (nt.targetSize - nt.startSize) * ease);
          if (applyZIndex) {
            this.graph.setNodeAttribute(nt.id, 'zIndex', nt.targetZIndex);
          }
        }
        for (const et of edgeTrans) {
          this.graph.setEdgeAttribute(et.id, 'color', interpolateHexColor(et.startColor, et.targetColor, ease));
          this.graph.setEdgeAttribute(et.id, 'size', et.startSize + (et.targetSize - et.startSize) * ease);
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
        renderStep(ease, isFinal && !dists);
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
          startForcePhysicsLoop();
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
          startForcePhysicsLoop();
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
      onNodeDragEnd: () => {
        draggedNode = null;
        this.hoveredNodeId = null;
        this.lastDraggedAt = performance.now();
        if (this.physicsFrameId) {
          cancelAnimationFrame(this.physicsFrameId);
          this.physicsFrameId = null;
        }
        applyHighlight(null);

        if (this.currentLayout === 'force' && this.graph) {
          const startingPos: Record<string, { x: number; y: number }> = {};
          const targets: Record<string, { x: number; y: number }> = {};
          this.graph.forEachNode(node => {
            startingPos[node] = {
              x: this.graph?.getNodeAttribute(node, 'x') as number,
              y: this.graph?.getNodeAttribute(node, 'y') as number
            };
          });

          forceAtlas2.assign(this.graph, {
            iterations: 30,
            settings: {
              gravity: 0.8,
              scalingRatio: 1,
              slowDown: 3
            }
          });

          let sumX = 0;
          let sumY = 0;
          let count = 0;
          this.graph.forEachNode(node => {
            const tx = this.graph?.getNodeAttribute(node, 'x') as number;
            const ty = this.graph?.getNodeAttribute(node, 'y') as number;
            targets[node] = { x: tx, y: ty };
            sumX += tx;
            sumY += ty;
            count++;
            this.graph?.setNodeAttribute(node, 'x', startingPos[node].x);
            this.graph?.setNodeAttribute(node, 'y', startingPos[node].y);
          });
          if (count > 0) {
            const meanX = sumX / count;
            const meanY = sumY / count;
            for (const node of Object.keys(targets)) {
              targets[node].x -= meanX;
              targets[node].y -= meanY;
              this.forcePositions.set(node, { x: targets[node].x, y: targets[node].y });
            }
          }

          this.animateTo(targets, 650, undefined, false);
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
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    this.graph.forEachNode((nodeId) => {
      const nx = Number(this.graph?.getNodeAttribute(nodeId, 'x') ?? 0);
      const ny = Number(this.graph?.getNodeAttribute(nodeId, 'y') ?? 0);
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
      if (nx < minX) minX = nx;
      if (nx > maxX) maxX = nx;
      if (ny < minY) minY = ny;
      if (ny > maxY) maxY = ny;
    });

    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return;
    if (maxX - minX < 1e-3) {
      minX -= 1;
      maxX += 1;
    }
    if (maxY - minY < 1e-3) {
      minY -= 1;
      maxY += 1;
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

  startViewportAdaptLoop(durationMs = GRAPH_VIEWPORT_CONFIG.adaptDurationMs) {
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
      const stepAlpha = 1 - Math.pow(1 - GRAPH_VIEWPORT_CONFIG.adaptAlpha, Math.min(50, dt) / 16.67);
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
    const targets: Record<string, { x: number; y: number }> = {};
    let signature = '';
    if (!this.graph) return { targets, signature };

    if (layout === 'radial') {
      const nodes = this.graph.nodes();
      const tags = [...nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') === 0)];
      const others = [...nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') !== 0)];

      if (useCurrentOrder) {
        const normAngle = (nId: string, count: number) => {
          const nx = (this.graph?.getNodeAttribute(nId, 'x') as number) || 0;
          const ny = (this.graph?.getNodeAttribute(nId, 'y') as number) || 0;
          return ((Math.atan2(ny, nx) + Math.PI / Math.max(1, count)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        };
        tags.sort((a, b) => normAngle(a, tags.length) - normAngle(b, tags.length));
        others.sort((a, b) => normAngle(a, others.length) - normAngle(b, others.length));
      }

      tags.forEach((n, idx) => {
        const theta = (2 * Math.PI * idx) / tags.length;
        targets[n] = {
          x: 5 * Math.cos(theta),
          y: 5 * Math.sin(theta)
        };
      });

      others.forEach((n, idx) => {
        const theta = (2 * Math.PI * idx) / others.length;
        targets[n] = {
          x: 12 * Math.cos(theta),
          y: 12 * Math.sin(theta)
        };
      });

      signature = `${tags.join(',')}|${others.join(',')}`;
    } else if (layout === 'columns') {
      const nodes = this.graph.nodes();
      const posts = [...nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') === 1)];
      const publications = [...nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') === 2)];
      const presentations = [...nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') === 3)];
      const tags = [...nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') === 0)];
      const courses = [...nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') === 4)];
      const projects = [...nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') === 5)];
      const services = [...nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') === 6)];
      const newsletters = [...nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') === 7)];
      const visualizations = [...nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') === 8)];

      const categories = [posts, publications, presentations, tags, courses, projects, services, newsletters, visualizations];
      const isMobile = window.innerWidth < 768;

      if (useCurrentOrder) {
        categories.forEach(catNodes => {
          catNodes.sort((a, b) => {
            const ax = (this.graph?.getNodeAttribute(a, 'x') as number) || 0;
            const ay = (this.graph?.getNodeAttribute(a, 'y') as number) || 0;
            const bx = (this.graph?.getNodeAttribute(b, 'x') as number) || 0;
            const by = (this.graph?.getNodeAttribute(b, 'y') as number) || 0;
            return isMobile ? ax - bx : ay - by;
          });
        });
      }

      if (isMobile) {
        categories.forEach((catNodes, catIdx) => {
          const rowY = (catIdx - (categories.length - 1) / 2) * 4;
          catNodes.forEach((n, idx) => {
            targets[n] = {
              x: catNodes.length > 1 ? (idx - (catNodes.length - 1) / 2) * (20 / (catNodes.length - 1)) : 0,
              y: rowY
            };
          });
        });
      } else {
        categories.forEach((catNodes, catIdx) => {
          const colX = (catIdx - (categories.length - 1) / 2) * 5;
          catNodes.forEach((n, idx) => {
            targets[n] = {
              x: colX,
              y: catNodes.length > 1 ? (idx - (catNodes.length - 1) / 2) * (20 / (catNodes.length - 1)) : 0
            };
          });
        });
      }

      signature = categories.map(cat => cat.join(',')).join('|');
    }

    return { targets, signature };
  },

  getForcePositions(): Record<string, { x: number; y: number }> {
    const targets: Record<string, { x: number; y: number }> = {};
    if (this.forcePositions.size > 0) {
      for (const [id, pos] of this.forcePositions.entries()) {
        targets[id] = { x: pos.x, y: pos.y };
      }
      return targets;
    }
    if (!this.graph) return targets;

    const startingPos: Record<string, { x: number; y: number }> = {};
    this.graph.forEachNode(node => {
      startingPos[node] = {
        x: this.graph?.getNodeAttribute(node, 'x') as number,
        y: this.graph?.getNodeAttribute(node, 'y') as number
      };
    });

    forceAtlas2.assign(this.graph, {
      iterations: 100,
      settings: {
        gravity: 0.8,
        scalingRatio: 12,
        strongGravityMode: false,
        slowDown: 2
      }
    });

    let sumX = 0;
    let sumY = 0;
    let count = 0;
    this.graph.forEachNode(node => {
      const tx = this.graph?.getNodeAttribute(node, 'x') as number;
      const ty = this.graph?.getNodeAttribute(node, 'y') as number;
      targets[node] = { x: tx, y: ty };
      sumX += tx;
      sumY += ty;
      count++;
      this.graph?.setNodeAttribute(node, 'x', startingPos[node].x);
      this.graph?.setNodeAttribute(node, 'y', startingPos[node].y);
    });
    if (count > 0) {
      const meanX = sumX / count;
      const meanY = sumY / count;
      for (const node of Object.keys(targets)) {
        targets[node].x -= meanX;
        targets[node].y -= meanY;
        this.forcePositions.set(node, { x: targets[node].x, y: targets[node].y });
      }
    }
    return targets;
  },

  updateLayout(layout: string, isLight: boolean) {
    if (!this.graph || !this.sigma) return;
    const layoutChanged = this.currentLayout !== layout;
    this.currentLayout = layout;
    this.isLight = isLight;

    if (layoutChanged) {
      if (this.physicsFrameId) {
        cancelAnimationFrame(this.physicsFrameId);
        this.physicsFrameId = null;
      }
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
        this.sigma.refresh();
      }

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.animationFrameId = null;
        if (resetCamera && this.sigma) {
          this.stepViewportTowardCloud(1);
        }
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  },

  destroy() {
    if (this.highlightFrameId) {
      cancelAnimationFrame(this.highlightFrameId);
      this.highlightFrameId = null;
    }
    if (this.physicsFrameId) {
      cancelAnimationFrame(this.physicsFrameId);
      this.physicsFrameId = null;
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
    if (this.sigma) {
      this.sigma.kill();
      this.sigma = null;
    }
    this.nodeMap = null;
    this.graph = null;
  }
};

export default engine;
