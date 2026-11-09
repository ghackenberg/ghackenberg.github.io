import cytoscape, { type Core, type NodeSingular, type EdgeSingular } from 'cytoscape';
import * as d3 from 'd3';
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
  getEdgeHopZIndex
} from '@commons/shared/graph-payload';
import { createGraphTooltipController, type GraphTooltipController, type RawGraphNode } from '@commons/client/vis-tooltip';

interface CySimNode extends d3.SimulationNodeDatum {
  id: string;
  group: number;
  homeX: number;
  homeY: number;
}

interface CySimLink extends d3.SimulationLinkDatum<CySimNode> {
  source: string | CySimNode;
  target: string | CySimNode;
  restDistance: number;
}

function getNodeColor(node: NodeSingular, isLight: boolean): string {
  const grp = node.data('group') ?? 0;
  const colors = isLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;
  return colors[grp] || colors[0];
}

export interface CytoscapeEngine {
  layouts: { id: string; label: string }[];
  cy: Core | null;
  tooltipController: GraphTooltipController | null;
  fgCanvas?: HTMLCanvasElement | null;
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
  dragSimulation?: d3.Simulation<CySimNode, CySimLink> | null;
  physicsFrameId?: number | null;
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
  initialized: false,
  lastDraggedAt: 0,
  lastOrderSignature: '',
  forcePositions: new Map(),
  dragSimulation: null,
  physicsFrameId: null,
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
    this.forcePositions = new Map();

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
            'overlay-opacity': 0
          }
        },
        {
          selector: 'edge',
          style: {
            'width': styleTokens.edgeWidth,
            'line-color': styleTokens.edgeColor,
            'curve-style': 'straight'
          }
        }
      ],
      layout: { name: 'preset', fit: false }
    });

    const rawEdges: { source: string; target: string }[] = [];
    this.cy.edges().forEach((e: EdgeSingular) => {
      rawEdges.push({ source: e.source().id(), target: e.target().id() });
    });
    const adjacency = buildGraphAdjacency(rawEdges);
    let lastHighlightedKey = '';

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

      const dists = this.activeHighlightDists;
      const secId = this.secondaryHoveredNodeId ?? null;
      if (!dists && !secId) return;

      const zoom = this.cy.zoom() || 1;
      const currentIsLight = Boolean(this.isLight);
      const currentTokens = getGraphStyleTokens(currentIsLight);
      const currentBaseDiameter = currentTokens.nodeRadius * 2;

      type DrawItem =
        | { isNode: false; z: number; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
        | { isNode: true; z: number; x: number; y: number; radius: number; borderWidth: number; color: string };

      const items: DrawItem[] = [];

      if (dists) {
        this.cy.edges().forEach((e: EdgeSingular) => {
          const srcNode = e.source();
          const tgtNode = e.target();
          const edgeZ = getEdgeHopZIndex(dists.get(srcNode.id()), dists.get(tgtNode.id()));
          if (edgeZ < 8) return;
          const p1 = srcNode.renderedPosition();
          const p2 = tgtNode.renderedPosition();
          if (!p1 || !p2) return;
          const modelWidth = Number(e.data('displayWidth') || currentTokens.edgeWidth);
          const color = String(e.data('displayColor') || currentTokens.edgeColor);
          items.push({
            isNode: false,
            z: edgeZ,
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            color,
            width: modelWidth * zoom
          });
        });
      }

      this.cy.nodes().forEach((n: NodeSingular) => {
        const id = n.id();
        const hopDist = dists ? dists.get(id) : undefined;
        const nodeZ = secId !== null && id === secId ? 48 : dists ? getNodeHopZIndex(hopDist) : 2;
        if (nodeZ < 10) return;
        const p = n.renderedPosition();
        if (!p) return;
        const modelDiameter = Number(n.data('displaySize') || currentBaseDiameter);
        const color = String(n.data('displayColor') || getNodeColor(n, currentIsLight));
        items.push({
          isNode: true,
          z: nodeZ,
          x: p.x,
          y: p.y,
          radius: (modelDiameter * zoom) / 2,
          borderWidth: 1.5 * zoom,
          color
        });
      });

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
          ctx.lineWidth = item.borderWidth;
          ctx.strokeStyle = item.color;
          ctx.stroke();
        }
      }
      ctx.restore();
    };

    this.cy.on('render viewport', drawForegroundOverlay);

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
      const dists = activeId ? computeHopDistances(activeId, adjacency) : null;
      this.activeHighlightDists = dists;

      const nodeTrans: {
        node: NodeSingular;
        startColor: string;
        targetColor: string;
        startSize: number;
        targetSize: number;
        targetZIndex: number;
      }[] = [];

      this.cy.nodes().forEach((n: NodeSingular) => {
        const id = n.id();
        const baseColor = getNodeColor(n, currentIsLight);
        const startColor = String(n.data('displayColor') || baseColor);
        const startSize = Number(n.data('displaySize') || currentBaseDiameter);
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
        const targetZIndex = dists
          ? (isSecHover ? 45 : getNodeHopZIndex(hopDist))
          : 10;
        nodeTrans.push({
          node: n,
          startColor,
          targetColor,
          startSize,
          targetSize,
          targetZIndex
        });
      });

      const edgeTrans: {
        edge: EdgeSingular;
        startColor: string;
        targetColor: string;
        startWidth: number;
        targetWidth: number;
        targetZIndex: number;
      }[] = [];

      this.cy.edges().forEach((e: EdgeSingular) => {
        const srcId = e.source().id();
        const tgtId = e.target().id();
        const startColor = String(e.data('displayColor') || currentTokens.edgeColor);
        const startWidth = Number(e.data('displayWidth') || currentTokens.edgeWidth);
        const dSrc = dists ? dists.get(srcId) : undefined;
        const dTgt = dists ? dists.get(tgtId) : undefined;
        const targetStyle = dists
          ? getAttenuatedEdgeStyle(dSrc, dTgt, currentIsLight)
          : { color: currentTokens.edgeColor, width: currentTokens.edgeWidth };
        const targetZIndex = dists ? getEdgeHopZIndex(dSrc, dTgt) : 1;
        edgeTrans.push({
          edge: e,
          startColor,
          targetColor: targetStyle.color,
          startWidth,
          targetWidth: targetStyle.width,
          targetZIndex
        });
      });

      if (dists || secId) {
        this.cy.batch(() => {
          for (const nt of nodeTrans) {
            nt.node.data('displayZIndex', nt.targetZIndex);
          }
          for (const et of edgeTrans) {
            et.edge.data('displayZIndex', et.targetZIndex);
          }
        });
      }

      const renderStep = (ease: number, applyZIndex: boolean) => {
        this.cy?.batch(() => {
          for (const nt of nodeTrans) {
            const nextData: Record<string, string | number> = {
              displayColor: interpolateHexColor(nt.startColor, nt.targetColor, ease),
              displaySize: nt.startSize + (nt.targetSize - nt.startSize) * ease
            };
            if (applyZIndex) {
              nextData.displayZIndex = nt.targetZIndex;
            }
            nt.node.data(nextData);
          }
          for (const et of edgeTrans) {
            const nextData: Record<string, string | number> = {
              displayColor: interpolateHexColor(et.startColor, et.targetColor, ease),
              displayWidth: et.startWidth + (et.targetWidth - et.startWidth) * ease
            };
            if (applyZIndex) {
              nextData.displayZIndex = et.targetZIndex;
            }
            et.edge.data(nextData);
          }
        });
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
    applyHighlight(null, true);

    this.cy.style()
      .selector('node').style({
        'background-color': 'data(displayColor)',
        'border-color': 'data(displayColor)',
        'width': 'data(displaySize)',
        'height': 'data(displaySize)',
        'z-index': (node: NodeSingular) => Number(node.data('displayZIndex') ?? 10),
        'border-width': '1.5px',
        'label': '',
        'overlay-opacity': 0
      })
      .selector('edge').style({
        'line-color': 'data(displayColor)',
        'width': 'data(displayWidth)',
        'z-index': (edge: EdgeSingular) => Number(edge.data('displayZIndex') ?? 1),
        'curve-style': 'straight'
      })
      .update();

    container.style.touchAction = 'pan-y';
    container.querySelectorAll('canvas, div').forEach((el) => {
      (el as HTMLElement).style.touchAction = 'pan-y';
    });

    this.tooltipController = createGraphTooltipController(container);

    const utmSource = String(extraOptions.utmSource || 'visualizations_demo');
    const utmMedium = String(extraOptions.utmMedium || 'cytoscape');
    const utmCampaign = String(extraOptions.utmCampaign || 'interactive_visualization');

    const simNodes: CySimNode[] = [];
    const simNodeMap = new Map<string, CySimNode>();

    this.cy.nodes().forEach((n: NodeSingular) => {
      const pos = n.position();
      this.forcePositions.set(n.id(), { x: pos.x, y: pos.y });
      const sn: CySimNode = {
        id: n.id(),
        group: Number(n.data('group') ?? 0),
        x: pos.x,
        y: pos.y,
        homeX: pos.x,
        homeY: pos.y
      };
      simNodes.push(sn);
      simNodeMap.set(sn.id, sn);
    });

    const simLinks: CySimLink[] = [];
    this.cy.edges().forEach((e: EdgeSingular) => {
      const src = e.source().id();
      const tgt = e.target().id();
      const srcNode = simNodeMap.get(src);
      const tgtNode = simNodeMap.get(tgt);
      if (srcNode && tgtNode) {
        const dist = Math.max(1, Math.hypot((tgtNode.x ?? 0) - (srcNode.x ?? 0), (tgtNode.y ?? 0) - (srcNode.y ?? 0)));
        simLinks.push({ source: src, target: tgt, restDistance: dist });
      }
    });

    let grabbedNodeId: string | null = null;
    let settleFramesRemaining = 0;

    const linkForce = d3
      .forceLink<CySimNode, CySimLink>(simLinks)
      .id(d => d.id)
      .distance(l => l.restDistance)
      .strength(0.28);
    const collideForce = d3.forceCollide<CySimNode>(14).strength(0.85);

    this.dragSimulation = d3.forceSimulation<CySimNode, CySimLink>(simNodes)
      .force('link', linkForce)
      .force('collide', collideForce)
      .force('home', (alpha: number) => {
        for (const sn of simNodes) {
          if (sn.id === grabbedNodeId) continue;
          const dx = sn.homeX - (sn.x ?? 0);
          const dy = sn.homeY - (sn.y ?? 0);
          sn.vx = (sn.vx ?? 0) + dx * 0.12 * alpha;
          sn.vy = (sn.vy ?? 0) + dy * 0.12 * alpha;
        }
      })
      .stop();

    const getLinkNode = (endpoint: string | CySimNode): CySimNode | undefined =>
      typeof endpoint === 'object' ? endpoint : simNodeMap.get(String(endpoint));

    const calibrateDragEquilibrium = (syncFromCy = false) => {
      if (syncFromCy && this.cy) {
        this.cy.nodes().forEach((n: NodeSingular) => {
          const p = n.position();
          const sn = simNodeMap.get(n.id());
          if (sn) {
            sn.x = p.x;
            sn.y = p.y;
          }
        });
      }
      for (const sn of simNodes) {
        sn.homeX = sn.x ?? 0;
        sn.homeY = sn.y ?? 0;
        sn.vx = 0;
        sn.vy = 0;
      }
      for (const l of simLinks) {
        const s = getLinkNode(l.source);
        const t = getLinkNode(l.target);
        if (s && t) {
          l.restDistance = Math.max(1, Math.hypot(t.homeX - s.homeX, t.homeY - s.homeY));
        }
      }
      linkForce.distance(l => l.restDistance);
    };

    calibrateDragEquilibrium(false);

    const startForcePhysicsLoop = () => {
      if (this.physicsFrameId) return;
      const stepPhysics = () => {
        if (!this.cy || !this.dragSimulation) {
          this.physicsFrameId = null;
          return;
        }
        this.dragSimulation.tick();

        this.cy.batch(() => {
          for (const sn of simNodes) {
            if (sn.id === grabbedNodeId) continue;
            const nx = sn.x ?? 0;
            const ny = sn.y ?? 0;
            this.cy?.getElementById(sn.id).position({ x: nx, y: ny });
            this.forcePositions.set(sn.id, { x: nx, y: ny });
          }
        });

        if (grabbedNodeId !== null || settleFramesRemaining > 0) {
          if (grabbedNodeId === null) settleFramesRemaining--;
          this.physicsFrameId = requestAnimationFrame(stepPhysics);
        } else {
          this.physicsFrameId = null;
          calibrateDragEquilibrium(false);
        }
      };
      this.physicsFrameId = requestAnimationFrame(stepPhysics);
    };

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
        const result: { node: RawGraphNode; x: number; y: number }[] = [];
        this.cy.nodes().forEach((n: NodeSingular) => {
          const pos = n.renderedPosition();
          if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return;
          const data = n.data();
          result.push({
            node: {
              id: String(data.id),
              name: String(data.name || ''),
              size: Number(data.rawSize ?? data.size ?? 1),
              group: Number(data.group ?? 0),
              typeLabel: data.typeLabel,
              description: data.description,
              date: data.date,
              image: data.image,
              tags: data.tags
            },
            x: pos.x,
            y: pos.y
          });
        });
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

        if (this.currentLayout === 'force' && this.dragSimulation) {
          if (settleFramesRemaining === 0) {
            calibrateDragEquilibrium(true);
          }
          settleFramesRemaining = 0;
          this.cy.getElementById(grabbedNodeId).position(modelPos);
          for (const sn of simNodes) {
            if (sn.id === grabbedNodeId) {
              sn.x = modelPos.x;
              sn.y = modelPos.y;
              sn.homeX = modelPos.x;
              sn.homeY = modelPos.y;
              sn.fx = modelPos.x;
              sn.fy = modelPos.y;
              sn.vx = 0;
              sn.vy = 0;
            } else {
              sn.fx = null;
              sn.fy = null;
            }
          }
          this.dragSimulation
            .alphaTarget(0.3)
            .alpha(0.35);
          startForcePhysicsLoop();
        } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          this.cy.getElementById(grabbedNodeId).position(modelPos);
          this.lastOrderSignature = this.getOrderSignature(this.currentLayout);
        }
      },
      onNodeDragMove: (rawNode, sx, sy) => {
        if (!this.cy) return;
        this.lastDraggedAt = performance.now();
        const pos = renderedToModel(sx, sy);
        const node = this.cy.getElementById(rawNode.id);
        node.position(pos);

        if (this.currentLayout === 'force' && this.dragSimulation) {
          const sn = simNodeMap.get(rawNode.id);
          if (sn) {
            sn.fx = pos.x;
            sn.fy = pos.y;
            sn.x = pos.x;
            sn.y = pos.y;
            sn.homeX = pos.x;
            sn.homeY = pos.y;
          }
          this.forcePositions.set(rawNode.id, { x: pos.x, y: pos.y });
          this.dragSimulation.alphaTarget(0.3).alpha(0.35);
          startForcePhysicsLoop();
        } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          const sig = this.getOrderSignature(this.currentLayout);
          if (sig !== this.lastOrderSignature) {
            this.lastOrderSignature = sig;
            const targets = this.computeLayoutTargets(this.currentLayout, true);
            this.animateTo(targets, 250, rawNode.id, false);
          }
        }
      },
      onNodeDragEnd: (rawNode) => {
        if (!this.cy) return;
        const node = this.cy.getElementById(rawNode.id);
        const pos = node.position();
        const releasedId = rawNode.id;
        grabbedNodeId = null;
        this.hoveredNodeId = null;
        this.lastDraggedAt = performance.now();
        applyHighlight(null);

        if (this.currentLayout === 'force' && this.dragSimulation) {
          const sn = simNodeMap.get(releasedId);
          if (sn) {
            sn.x = pos.x;
            sn.y = pos.y;
            sn.homeX = pos.x;
            sn.homeY = pos.y;
            sn.fx = null;
            sn.fy = null;
          }
          for (const l of simLinks) {
            const s = getLinkNode(l.source);
            const t = getLinkNode(l.target);
            if (s && t && (s.id === releasedId || t.id === releasedId)) {
              const curDist = Math.hypot((t.x ?? 0) - (s.x ?? 0), (t.y ?? 0) - (s.y ?? 0));
              l.restDistance = Math.max(45, Math.min(140, curDist * 0.65 + 100 * 0.35));
            }
          }
          linkForce.distance(l => l.restDistance);
          this.forcePositions.set(releasedId, { x: pos.x, y: pos.y });
          this.dragSimulation
            .alphaTarget(0)
            .alpha(0.35);
          settleFramesRemaining = 90;
          startForcePhysicsLoop();
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
    this.cy.nodes().forEach((n: NodeSingular) => {
      if (isSubgraph && !this.focusedNodeIds!.has(n.id())) return;
      const p = n.position();
      if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
        points.push({ x: p.x, y: p.y });
      }
    });

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
    const nodes: NodeSingular[] = this.cy.nodes().toArray();

    if (layout === 'radial') {
      const cx = width / 2;
      const cy = height / 2;
      const tags = nodes.filter((n: NodeSingular) => n.data('group') === 0);
      const others = nodes.filter((n: NodeSingular) => n.data('group') !== 0);
      const normAngle = (n: NodeSingular, count: number) =>
        ((Math.atan2(n.position('y') - cy, n.position('x') - cx) + Math.PI / Math.max(1, count)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      tags.sort((a, b) => normAngle(a, tags.length) - normAngle(b, tags.length));
      others.sort((a, b) => normAngle(a, others.length) - normAngle(b, others.length));
      return `${tags.map(n => n.id()).join(',')}|${others.map(n => n.id()).join(',')}`;
    }

    if (layout === 'columns') {
      const isMobile = width < 768 || window.innerWidth < 768;
      const groups = [1, 2, 3, 0, 4, 5, 6, 7, 8];
      return groups.map(g => {
        const catNodes = nodes.filter((n: NodeSingular) => n.data('group') === g);
        catNodes.sort((a, b) => isMobile ? (a.position('x') - b.position('x')) : (a.position('y') - b.position('y')));
        return catNodes.map(n => n.id()).join(',');
      }).join('|');
    }

    return '';
  },

  computeLayoutTargets(layout: string, useCurrentOrder = false): Record<string, { x: number; y: number }> {
    const targets: Record<string, { x: number; y: number }> = {};
    if (!this.cy) return targets;

    const width = this.cy.width() || 800;
    const height = this.cy.height() || 500;

    if (layout === 'radial') {
      const cx = width / 2;
      const cy = height / 2;
      const minDim = Math.min(width, height);
      const innerRadius = Math.max(90, minDim * 0.22);
      const outerRadius = Math.max(200, minDim * 0.44);

      const nodes: NodeSingular[] = this.cy.nodes().toArray();
      const tags = nodes.filter((n: NodeSingular) => n.data('group') === 0);
      const others = nodes.filter((n: NodeSingular) => n.data('group') !== 0);

      if (useCurrentOrder) {
        const normAngle = (n: NodeSingular, count: number) =>
          ((Math.atan2(n.position('y') - cy, n.position('x') - cx) + Math.PI / Math.max(1, count)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        tags.sort((a, b) => normAngle(a, tags.length) - normAngle(b, tags.length));
        others.sort((a, b) => normAngle(a, others.length) - normAngle(b, others.length));
      }

      tags.forEach((n: NodeSingular, idx: number) => {
        const theta = (2 * Math.PI * idx) / tags.length;
        targets[n.id()] = {
          x: cx + innerRadius * Math.cos(theta),
          y: cy + innerRadius * Math.sin(theta)
        };
      });

      others.forEach((n: NodeSingular, idx: number) => {
        const theta = (2 * Math.PI * idx) / others.length;
        targets[n.id()] = {
          x: cx + outerRadius * Math.cos(theta),
          y: cy + outerRadius * Math.sin(theta)
        };
      });

      return targets;
    }

    if (layout === 'columns') {
      const nodes: NodeSingular[] = this.cy.nodes().toArray();

      const posts = nodes.filter((n: NodeSingular) => n.data('group') === 1);
      const publications = nodes.filter((n: NodeSingular) => n.data('group') === 2);
      const presentations = nodes.filter((n: NodeSingular) => n.data('group') === 3);
      const tags = nodes.filter((n: NodeSingular) => n.data('group') === 0);
      const courses = nodes.filter((n: NodeSingular) => n.data('group') === 4);
      const projects = nodes.filter((n: NodeSingular) => n.data('group') === 5);
      const services = nodes.filter((n: NodeSingular) => n.data('group') === 6);
      const newsletters = nodes.filter((n: NodeSingular) => n.data('group') === 7);
      const visualizations = nodes.filter((n: NodeSingular) => n.data('group') === 8);

      const categories = [posts, publications, presentations, tags, courses, projects, services, newsletters, visualizations];
      const isMobile = width < 768 || window.innerWidth < 768;

      if (useCurrentOrder) {
        categories.forEach(catNodes => {
          catNodes.sort((a, b) => isMobile ? (a.position('x') - b.position('x')) : (a.position('y') - b.position('y')));
        });
      }

      if (isMobile) {
        categories.forEach((catNodes, catIdx) => {
          const rowY = (catIdx + 1) * (height / (categories.length + 1));
          catNodes.forEach((n: NodeSingular, idx: number) => {
            targets[n.id()] = {
              x: (idx + 1) * (width / (catNodes.length + 1)),
              y: rowY
            };
          });
        });
      } else {
        categories.forEach((catNodes, catIdx) => {
          const colX = (catIdx + 1) * (width / (categories.length + 1));
          catNodes.forEach((n: NodeSingular, idx: number) => {
            targets[n.id()] = {
              x: colX,
              y: (idx + 1) * (height / (catNodes.length + 1))
            };
          });
        });
      }
      return targets;
    }

    // default: force directed
    if (this.forcePositions.size > 0) {
      for (const [id, pos] of this.forcePositions.entries()) {
        targets[id] = { x: pos.x, y: pos.y };
      }
      return targets;
    }

    const startingPos: Record<string, { x: number; y: number }> = {};
    this.cy.nodes().forEach((n: NodeSingular) => {
      const p = n.position();
      startingPos[n.id()] = { x: p.x, y: p.y };
    });

    this.cy.batch(() => {
      this.cy?.layout({
        name: 'cose',
        animate: false,
        fit: false,
        randomize: false,
        idealEdgeLength: () => 100,
        nodeOverlap: 20,
        componentSpacing: 100,
        nodeRepulsion: () => 400000,
        edgeElasticity: () => 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000
      } as cytoscape.CoseLayoutOptions).run();

      this.cy?.nodes().forEach((n: NodeSingular) => {
        const p = n.position();
        targets[n.id()] = { x: p.x, y: p.y };
        this.forcePositions.set(n.id(), { x: p.x, y: p.y });
        const s = startingPos[n.id()];
        if (s) n.position(s);
      });
    });

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
        this.cy.layout({
          name: 'preset',
          positions: targets,
          animate: false,
          fit: false
        }).run();
        this.stepViewportTowardCloud(1);
        return;
      }
      this.animateTo(targets, 550, undefined, true);
      return;
    }

    const targets = this.computeLayoutTargets(mode, false);
    if (!animate) {
      this.cy.batch(() => {
        this.cy?.nodes().forEach((n: NodeSingular) => {
          const t = targets[n.id()];
          if (t) n.position(t);
        });
      });
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
    this.cy.nodes().forEach((n: NodeSingular) => {
      const p = n.position();
      startPositions[n.id()] = { x: p.x, y: p.y };
    });

    const step = (time: number) => {
      if (!this.cy) return;
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const ease = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.cy.batch(() => {
        this.cy?.nodes().forEach((n: NodeSingular) => {
          const id = n.id();
          if (excludeNodeId && id === excludeNodeId) return;
          const start = startPositions[id];
          const target = targets[id];
          if (start && target) {
            n.position({
              x: start.x + (target.x - start.x) * ease,
              y: start.y + (target.y - start.y) * ease
            });
          }
        });
      });

      if (fitOnStep) {
        this.stepViewportTowardCloud(1);
      }

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.animationFrameId = null;
        if (animateFitAfter && this.cy) {
          this.cy.animate({
            fit: { eles: this.cy.elements(), padding: 30 },
            duration: 350,
            easing: 'ease-in-out-cubic'
          });
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
      if (this.physicsFrameId) {
        cancelAnimationFrame(this.physicsFrameId);
        this.physicsFrameId = null;
      }
    }

    // Apply color update to nodes and edges based on theme (and preserve any active highlight)
    this.applyHighlight?.(this.hoveredNodeId ?? null, true);

    if (!this.initialized || layoutChanged || forceRecompute) {
      this.runLayout(layout, Boolean(this.initialized));
    }
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
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.viewportAdaptFrameId) {
      cancelAnimationFrame(this.viewportAdaptFrameId);
      this.viewportAdaptFrameId = null;
    }
    if (this.dragSimulation) {
      this.dragSimulation.stop();
      this.dragSimulation = null;
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
    this.activeHighlightDists = null;
    if (this.cy) {
      this.cy.destroy();
      this.cy = null;
    }
    this.forcePositions.clear();
  }
};

export default engine;
