import * as d3 from 'd3';
import {
  GRAPH_COLORS,
  GRAPH_PHYSICS_CONFIG,
  GRAPH_VIEWPORT_CONFIG,
  HIGHLIGHT_TRANSITION_MS,
  easeHighlightTransition,
  getEdgeLinkDistance2D,
  getEdgeLinkStrength2D,
  getGraphStyleTokens,
  getGraphTuningState,
  compute2DViewportFit,
  buildGraphAdjacency,
  computeHopDistances,
  interpolateHexColor,
  getAttenuatedNodeColor,
  getAttenuatedNodeScale,
  getAttenuatedEdgeStyle,
  getNodeHopZIndex,
  getEdgeHopZIndex,
  type GraphNodePayload
} from '@commons/shared/graph-payload';
import {
  compute2DGeometryTargets,
  solveD3ForceLayout,
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
}

export interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node;
  target: string | D3Node;
  weight?: number;
  displayColor?: string;
  displayWidth?: number;
}

export interface D3Payload {
  d3: {
    nodes: GraphNodePayload[];
    connections: { sourceId: string; targetId: string; weight?: number }[];
  };
}

export interface D3Engine {
  layouts: { id: string; label: string }[];
  width: number;
  height: number;
  nodes: D3Node[] | null;
  links: D3Link[] | null;
  svg: d3.Selection<SVGSVGElement, D3Node, null, undefined> | null;
  svgGroup: d3.Selection<SVGGElement, D3Node, null, undefined> | null;
  zoom: d3.ZoomBehavior<SVGSVGElement, D3Node> | null;
  simulation: d3.Simulation<D3Node, D3Link> | null;
  linkElements: d3.Selection<SVGLineElement, D3Link, SVGGElement, D3Node> | null;
  nodeElements: d3.Selection<SVGGElement, D3Node, SVGGElement, D3Node> | null;
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

    this.links = payload.d3.connections.map((c) => ({
      source: c.sourceId,
      target: c.targetId,
      weight: c.weight
    })).filter((l) => this.nodes!.some(n => n.id === l.source) && this.nodes!.some(n => n.id === l.target));

    const nodeLookup = new Map<string, D3Node>();
    for (const n of this.nodes) {
      nodeLookup.set(n.id, n);
    }

    this.dragController = createGraphDragPhysicsController2D({
      nodes: this.nodes.map((n) => ({
        id: n.id,
        group: n.group,
        x: n.x ?? 0,
        y: n.y ?? 0,
      })),
      edges: this.links.map((l) => ({
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

    const styleTokens = getGraphStyleTokens(isLight);

    const bgLinkLayer = this.svgGroup.append<SVGGElement>("g");
    const bgNodeLayer = this.svgGroup.append<SVGGElement>("g");
    const fgLayer = this.svgGroup.append<SVGGElement>("g");

    this.linkElements = bgLinkLayer.selectAll<SVGLineElement, D3Link>(".link")
      .data(this.links)
      .enter().append("line")
      .style("stroke", styleTokens.edgeColor)
      .style("stroke-width", `${styleTokens.edgeWidth}px`);

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
            const nodeZ = secId !== null && n.id === secId ? 48 : dists ? getNodeHopZIndex(hopDist) : 2;
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

      const nodeTrans = (this.nodes || []).map((n) => {
        const baseColor = groupColors[n.group] || groupColors[0];
        const startColor = n.displayColor || baseColor;
        const startRadius = n.displayRadius ?? currentTokens.nodeRadius;
        const hopDist = dists ? dists.get(n.id) : undefined;
        const isSecHover = secId !== null && n.id === secId;
        const targetColor = isSecHover
          ? baseColor
          : dists
            ? getAttenuatedNodeColor(baseColor, hopDist, currentIsLight)
            : baseColor;
        const baseScale = dists ? getAttenuatedNodeScale(hopDist) : 1;
        const targetScale = isSecHover ? Math.max(baseScale * 1.15, 1.32) : baseScale;
        const targetRadius = currentTokens.nodeRadius * targetScale;
        return {
          node: n,
          startColor,
          targetColor,
          startRadius,
          targetRadius,
          changed: startColor !== targetColor || Math.abs(startRadius - targetRadius) > 1e-3
        };
      });

      const linkTrans = (this.links || []).map((l) => {
        const srcId = typeof l.source === 'object' ? l.source.id : String(l.source);
        const tgtId = typeof l.target === 'object' ? l.target.id : String(l.target);
        const startColor = l.displayColor || currentTokens.edgeColor;
        const startWidth = l.displayWidth ?? currentTokens.edgeWidth;
        const targetStyle = dists
          ? getAttenuatedEdgeStyle(dists.get(srcId), dists.get(tgtId), currentIsLight)
          : { color: currentTokens.edgeColor, width: currentTokens.edgeWidth };
        return {
          link: l,
          startColor,
          targetColor: targetStyle.color,
          startWidth,
          targetWidth: targetStyle.width,
          changed: startColor !== targetStyle.color || Math.abs(startWidth - targetStyle.width) > 1e-3
        };
      });

      const circleElements = this.nodeElements?.selectAll<SVGCircleElement, D3Node>("circle.node-dot");

      const renderStep = (ease: number) => {
        for (const nt of nodeTrans) {
          if (!nt.changed && ease < 1) continue;
          nt.node.displayColor = ease >= 1 ? nt.targetColor : interpolateHexColor(nt.startColor, nt.targetColor, ease);
          nt.node.displayRadius = ease >= 1 ? nt.targetRadius : nt.startRadius + (nt.targetRadius - nt.startRadius) * ease;
        }
        for (const lt of linkTrans) {
          if (!lt.changed && ease < 1) continue;
          lt.link.displayColor = ease >= 1 ? lt.targetColor : interpolateHexColor(lt.startColor, lt.targetColor, ease);
          lt.link.displayWidth = ease >= 1 ? lt.targetWidth : lt.startWidth + (lt.targetWidth - lt.startWidth) * ease;
        }

        circleElements
          ?.attr("r", (n: D3Node) => n.displayRadius ?? currentTokens.nodeRadius)
          ?.style("fill", (n: D3Node) => n.displayColor || (groupColors[n.group] || groupColors[0]))
          ?.style("stroke", (n: D3Node) => n.displayColor || (groupColors[n.group] || groupColors[0]))
          ?.style("stroke-width", "1.5px");

        this.linkElements
          ?.style("stroke", (l: D3Link) => l.displayColor || currentTokens.edgeColor)
          ?.style("stroke-width", (l: D3Link) => `${l.displayWidth ?? currentTokens.edgeWidth}px`);
      };

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

    this.nodeElements = bgNodeLayer.selectAll<SVGGElement, D3Node>(".node")
      .data(this.nodes)
      .enter().append("g")
      .style("cursor", "pointer");

    const colors = isLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;

    this.nodeElements.append("circle")
      .attr("class", "node-dot")
      .attr("r", styleTokens.nodeRadius)
      .style("fill", d => colors[d.group] || colors[0])
      .style("stroke", d => colors[d.group] || colors[0])
      .style("stroke-width", "1.5px");

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
    this.linkElements
      ?.attr("x1", d => (d.source as D3Node).x ?? 0)
      ?.attr("y1", d => (d.source as D3Node).y ?? 0)
      ?.attr("x2", d => (d.target as D3Node).x ?? 0)
      ?.attr("y2", d => (d.target as D3Node).y ?? 0);

    this.nodeElements?.attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`);
  },

  fitToView(duration = 600) {
    if (!this.svg || !this.zoom || !this.nodes || this.nodes.length === 0) return;
    if (this.width <= 0 || this.height <= 0) return;

    const isSubgraph = Boolean(this.focusedNodeIds && this.focusedNodeIds.size > 0);
    const activeNodes = isSubgraph
      ? this.nodes.filter(n => this.focusedNodeIds!.has(n.id))
      : this.nodes;
    const r = getGraphStyleTokens(Boolean(this.isLight)).nodeRadius;
    const fit = compute2DViewportFit(
      activeNodes.map(n => ({ x: n.x ?? 0, y: n.y ?? 0 })),
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
    const fit = compute2DViewportFit(
      activeNodes.map(n => ({ x: n.x ?? 0, y: n.y ?? 0 })),
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
      if (this.currentLayout === 'force') {
        for (const n of this.nodes) {
          if (typeof n.x === 'number' && typeof n.y === 'number') {
            this.forcePositions.set(n.id, { x: n.x, y: n.y });
          }
        }
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
      this.focusedNodeIds = null;
      this.tooltipController?.clearFocus();
      this.dragController?.stop();
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
        .force("link", d3.forceLink<D3Node, D3Link>(this.links || []).id(d => d.id).distance(30).strength(0.08))
        .force("charge", d3.forceManyBody().strength(-30))
        .force("center", null)
        .force("x", d3.forceX<D3Node>(d => d.targetX ?? cx).strength(1.2))
        .force("y", d3.forceY<D3Node>(d => d.targetY ?? cy).strength(1.2))
        .force("collide", d3.forceCollide<D3Node>(d => d.size * 6 + 10).strength(0.8));

    } else if (layout === 'columns') {
      this.recomputeSlotTargets(false);

      // Apply columnar forces
      this.simulation
        .force("link", d3.forceLink<D3Node, D3Link>(this.links || []).id(d => d.id).distance(30).strength(0.02))
        .force("charge", d3.forceManyBody().strength(-20))
        .force("center", null)
        .force("x", d3.forceX<D3Node>(d => d.targetX ?? 0).strength(1.5))
        .force("y", d3.forceY<D3Node>(d => d.targetY ?? 0).strength(1.5))
        .force("collide", d3.forceCollide<D3Node>(d => d.size * 6 + 8).strength(0.8));

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
    this.simulation.alpha(0.3).restart();

    // Smoothly auto-fit once simulation transitions
    if (this.fitTimeout) clearTimeout(this.fitTimeout);
    this.fitTimeout = setTimeout(() => {
      this.fitToView(600);
    }, 350);
  },

  applyTuning(category) {
    if (!this.simulation || !this.nodes) return;
    if (this.tuningSettleTimeout) {
      clearTimeout(this.tuningSettleTimeout);
      this.tuningSettleTimeout = undefined;
    }
    if (category === 'reset') {
      this.dragController?.stop();
      this.forcePositions = new Map();
      for (const [id, pos] of this.initialForcePositions.entries()) {
        this.forcePositions.set(id, { x: pos.x, y: pos.y });
      }
      this.applyHighlight?.(this.draggedNodeId ?? this.hoveredNodeId ?? null, true);
      if (this.currentLayout === 'force') {
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
            this.dragController?.calibrateFromPositions(this.forcePositions);
          }
        }, 480);
        this.startViewportAdaptLoop(1400);
      } else {
        this.recomputeSlotTargets(false);
        this.simulation.alpha(0.4).restart();
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
        this.simulation.alpha(0.4).restart();
        this.startViewportAdaptLoop(1400);
      }
      return;
    }

    if (category === 'physics' && this.currentLayout === 'force') {
      this.dragController?.stop();
      const solved = solveD3ForceLayout({
        nodes: this.nodes,
        connections: (this.links || []).map(l => ({
          sourceId: typeof l.source === 'object' ? l.source.id : String(l.source),
          targetId: typeof l.target === 'object' ? l.target.id : String(l.target),
          weight: l.weight ?? 0.5
        }))
      });

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
          this.dragController?.calibrateFromPositions(this.forcePositions);
        }
      }, 480);
      this.startViewportAdaptLoop(1400);
    }
  },

  destroy() {
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
