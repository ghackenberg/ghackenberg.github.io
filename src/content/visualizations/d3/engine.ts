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
  getEdgeHopZIndex,
  type GraphNodePayload
} from '@commons/shared/graph-payload';
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
  displayColor?: string;
  displayWidth?: number;
}

export interface D3Payload {
  d3: {
    nodes: GraphNodePayload[];
    connections: { sourceId: string; targetId: string }[];
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
  hoveredNodeId?: string | null;
  draggedNodeId?: string | null;
  highlightFrameId?: number | null;
  applyHighlight?(activeId: string | null, immediate?: boolean): void;
  currentLayout?: string;
  isLight?: boolean;
  forcePositions: Map<string, { x: number; y: number }>;
  fitTimeout?: ReturnType<typeof setTimeout>;
  viewportAdaptFrameId?: number | null;
  resizeObserver: ResizeObserver | null;
  init(container: HTMLElement, payload: D3Payload, layout: string, isLight: boolean, extraOptions?: Record<string, string>): Promise<D3Engine>;
  renderPositions(): void;
  recomputeSlotTargets(useCurrentOrder?: boolean): void;
  fitToView(duration?: number): void;
  stepViewportTowardCloud(alpha: number): void;
  startViewportAdaptLoop(durationMs?: number): void;
  updateLayout(layout: string, isLight: boolean, animate?: boolean): void;
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
  forcePositions: new Map(),
  viewportAdaptFrameId: null,
  resizeObserver: null,

  async init(container: HTMLElement, payload: D3Payload, layout: string, isLight: boolean, extraOptions: Record<string, string> = {}) {
    this.width = container.offsetWidth || 800;
    this.height = container.offsetHeight || 500;
    this.forcePositions = new Map();

    this.nodes = payload.d3.nodes.map((n) => {
      const nx = typeof n.x === 'number' ? n.x : 0;
      const ny = typeof n.y === 'number' ? n.y : 0;
      this.forcePositions.set(n.id, { x: nx, y: ny });
      return {
        ...n,
        x: nx,
        y: ny
      };
    });

    this.links = payload.d3.connections.map((c) => ({
      source: c.sourceId,
      target: c.targetId
    })).filter((l) => this.nodes!.some(n => n.id === l.source) && this.nodes!.some(n => n.id === l.target));

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

    const linkLayer = this.svgGroup.append<SVGGElement>("g");
    const nodeLayer = this.svgGroup.append<SVGGElement>("g");

    this.linkElements = linkLayer.selectAll<SVGLineElement, D3Link>(".link")
      .data(this.links)
      .enter().append("line")
      .style("stroke", styleTokens.edgeColor)
      .style("stroke-width", `${styleTokens.edgeWidth}px`);

    let lastDraggedAt = 0;
    let lastHighlightedNodeId: string | null = null;
    this.hoveredNodeId = null;
    this.draggedNodeId = null;

    const adjacency = buildGraphAdjacency(
      this.links.map(l => ({
        source: typeof l.source === 'object' ? l.source.id : String(l.source),
        target: typeof l.target === 'object' ? l.target.id : String(l.target)
      }))
    );

    const applyHighlight = (activeId: string | null, immediate = false) => {
      if (!immediate && activeId === lastHighlightedNodeId) return;
      lastHighlightedNodeId = activeId;

      if (this.highlightFrameId) {
        cancelAnimationFrame(this.highlightFrameId);
        this.highlightFrameId = null;
      }

      const currentIsLight = Boolean(this.isLight);
      const currentTokens = getGraphStyleTokens(currentIsLight);
      const groupColors = currentIsLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;
      const dists = activeId ? computeHopDistances(activeId, adjacency) : null;

      if (dists) {
        this.linkElements?.sort((a: D3Link, b: D3Link) => {
          const srcA = typeof a.source === 'object' ? a.source.id : String(a.source);
          const tgtA = typeof a.target === 'object' ? a.target.id : String(a.target);
          const srcB = typeof b.source === 'object' ? b.source.id : String(b.source);
          const tgtB = typeof b.target === 'object' ? b.target.id : String(b.target);
          return getEdgeHopZIndex(dists.get(srcA), dists.get(tgtA)) - getEdgeHopZIndex(dists.get(srcB), dists.get(tgtB));
        });
        this.nodeElements?.sort((a: D3Node, b: D3Node) => {
          return getNodeHopZIndex(dists.get(a.id)) - getNodeHopZIndex(dists.get(b.id));
        });
      }

      const nodeTrans = (this.nodes || []).map((n) => {
        const baseColor = groupColors[n.group] || groupColors[0];
        const startColor = n.displayColor || baseColor;
        const startRadius = n.displayRadius ?? currentTokens.nodeRadius;
        const hopDist = dists ? dists.get(n.id) : undefined;
        const targetColor = dists
          ? getAttenuatedNodeColor(baseColor, hopDist, currentIsLight)
          : baseColor;
        const targetRadius = dists
          ? currentTokens.nodeRadius * getAttenuatedNodeScale(hopDist)
          : currentTokens.nodeRadius;
        return { node: n, startColor, targetColor, startRadius, targetRadius };
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
          targetWidth: targetStyle.width
        };
      });

      const renderStep = (ease: number) => {
        for (const nt of nodeTrans) {
          nt.node.displayColor = interpolateHexColor(nt.startColor, nt.targetColor, ease);
          nt.node.displayRadius = nt.startRadius + (nt.targetRadius - nt.startRadius) * ease;
        }
        for (const lt of linkTrans) {
          lt.link.displayColor = interpolateHexColor(lt.startColor, lt.targetColor, ease);
          lt.link.displayWidth = lt.startWidth + (lt.targetWidth - lt.startWidth) * ease;
        }

        this.nodeElements?.selectAll<SVGCircleElement, D3Node>("circle.node-dot")
          .attr("r", (n: D3Node) => n.displayRadius ?? currentTokens.nodeRadius)
          .style("fill", (n: D3Node) => n.displayColor || (groupColors[n.group] || groupColors[0]))
          .style("stroke", (n: D3Node) => n.displayColor || (groupColors[n.group] || groupColors[0]))
          .style("stroke-width", "1.5px");

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

    this.nodeElements = nodeLayer.selectAll<SVGGElement, D3Node>(".node")
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
        this.svg?.interrupt();
        this.draggedNodeId = d.id;
        lastDraggedAt = performance.now();
        applyHighlight(d.id);
        const gp = screenToGraph(sx, sy);
        d.fx = gp.x;
        d.fy = gp.y;
        d.x = gp.x;
        d.y = gp.y;
        this.simulation?.alphaTarget(0.3).restart();
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
        if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
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
          if (this.currentLayout === 'force' && typeof d.x === 'number' && typeof d.y === 'number') {
            this.forcePositions.set(d.id, { x: d.x, y: d.y });
          }
        }
        applyHighlight(null);
        if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          this.recomputeSlotTargets(true);
        }
        this.simulation?.alphaTarget(0).alpha(0.35).restart();
        this.startViewportAdaptLoop(2400);
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

    const r = getGraphStyleTokens(Boolean(this.isLight)).nodeRadius;
    const fit = compute2DViewportFit(
      this.nodes.map(n => ({ x: n.x ?? 0, y: n.y ?? 0 })),
      this.width,
      this.height,
      r
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

    const r = getGraphStyleTokens(Boolean(this.isLight)).nodeRadius;
    const fit = compute2DViewportFit(
      this.nodes.map(n => ({ x: n.x ?? 0, y: n.y ?? 0 })),
      this.width,
      this.height,
      r
    );
    if (!fit) return;

    const curT = d3.zoomTransform(svgNode);
    const t = Math.max(0, Math.min(1, alpha));
    const nextK = curT.k + (fit.scale - curT.k) * t;
    const nextX = curT.x + (fit.panX - curT.x) * t;
    const nextY = curT.y + (fit.panY - curT.y) * t;

    this.svg.call(this.zoom.transform, d3.zoomIdentity.translate(nextX, nextY).scale(nextK));
  },

  startViewportAdaptLoop(durationMs = GRAPH_VIEWPORT_CONFIG.adaptDurationMs) {
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

  recomputeSlotTargets(useCurrentOrder = false) {
    if (!this.nodes || !this.simulation) return;
    const layout = this.currentLayout;

    if (layout === 'radial') {
      const cx = this.width / 2;
      const cy = this.height / 2;

      const minDim = Math.min(this.width, this.height);
      const innerRadius = Math.max(60, minDim * 0.20);
      const outerRadius = Math.max(140, minDim * 0.42);

      const tags = [...this.nodes.filter(n => n.group === 0)];
      const others = [...this.nodes.filter(n => n.group !== 0)];

      if (useCurrentOrder) {
        const normAngle = (n: D3Node, count: number) =>
          ((Math.atan2((n.y ?? cy) - cy, (n.x ?? cx) - cx) + Math.PI / Math.max(1, count)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        tags.sort((a, b) => normAngle(a, tags.length) - normAngle(b, tags.length));
        others.sort((a, b) => normAngle(a, others.length) - normAngle(b, others.length));
      }

      tags.forEach((n, idx) => {
        const theta = (2 * Math.PI * idx) / tags.length;
        n.targetX = cx + innerRadius * Math.cos(theta);
        n.targetY = cy + innerRadius * Math.sin(theta);
      });

      others.forEach((n, idx) => {
        const theta = (2 * Math.PI * idx) / others.length;
        n.targetX = cx + outerRadius * Math.cos(theta);
        n.targetY = cy + outerRadius * Math.sin(theta);
      });

      const fx = this.simulation.force("x") as d3.ForceX<D3Node> | undefined;
      const fy = this.simulation.force("y") as d3.ForceY<D3Node> | undefined;
      fx?.x(d => d.targetX ?? cx);
      fy?.y(d => d.targetY ?? cy);
    } else if (layout === 'columns') {
      const posts = [...this.nodes.filter(n => n.group === 1)];
      const publications = [...this.nodes.filter(n => n.group === 2)];
      const presentations = [...this.nodes.filter(n => n.group === 3)];
      const tags = [...this.nodes.filter(n => n.group === 0)];
      const courses = [...this.nodes.filter(n => n.group === 4)];
      const projects = [...this.nodes.filter(n => n.group === 5)];
      const services = [...this.nodes.filter(n => n.group === 6)];
      const newsletters = [...this.nodes.filter(n => n.group === 7)];
      const visualizations = [...this.nodes.filter(n => n.group === 8)];

      const categories = [posts, publications, presentations, tags, courses, projects, services, newsletters, visualizations];
      const isMobile = this.width < 768 || window.innerWidth < 768;

      if (useCurrentOrder) {
        categories.forEach(catNodes => {
          catNodes.sort((a, b) => isMobile ? ((a.x ?? 0) - (b.x ?? 0)) : ((a.y ?? 0) - (b.y ?? 0)));
        });
      }

      const padX = Math.max(40, this.width * 0.08);
      const padY = Math.max(50, this.height * 0.12);
      const usableW = this.width - padX * 2;
      const usableH = this.height - padY * 2;

      if (isMobile) {
        categories.forEach((catNodes, catIdx) => {
          const rowY = padY + (catIdx + 0.5) * (usableH / categories.length);
          catNodes.forEach((n, idx) => {
            n.targetX = padX + (idx + 0.5) * (usableW / Math.max(1, catNodes.length));
            n.targetY = rowY;
          });
        });
      } else {
        categories.forEach((catNodes, catIdx) => {
          const colX = padX + (catIdx + 0.5) * (usableW / categories.length);
          catNodes.forEach((n, idx) => {
            n.targetX = colX;
            n.targetY = padY + (idx + 0.5) * (usableH / Math.max(1, catNodes.length));
          });
        });
      }

      const fx = this.simulation.force("x") as d3.ForceX<D3Node> | undefined;
      const fy = this.simulation.force("y") as d3.ForceY<D3Node> | undefined;
      fx?.x(d => d.targetX ?? 0);
      fy?.y(d => d.targetY ?? 0);
    }
  },

  updateLayout(layout: string, isLight: boolean, animate = true) {
    if (!this.simulation || !this.nodes || !this.linkElements || !this.nodeElements) return;
    const layoutChanged = this.currentLayout !== layout;
    this.currentLayout = layout;
    this.isLight = isLight;

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
        this.simulation
          .force("link", d3.forceLink<D3Node, D3Link>(this.links || []).id(d => d.id).distance(80).strength(0.2))
          .force("charge", d3.forceManyBody<D3Node>().strength(d => -40 - Math.max(5, Math.min(28, Math.sqrt(d.size || 1) * 2.5 + 3)) * 8).distanceMax(350))
          .force("center", d3.forceCenter(0, 0).strength(0.08))
          .force("collide", d3.forceCollide<D3Node>(d => Math.max(5, Math.min(28, Math.sqrt(d.size || 1) * 2.5 + 3)) + 6).iterations(2))
          .force("x", d3.forceX<D3Node>(0).strength(0.06))
          .force("y", d3.forceY<D3Node>(0).strength(0.06))
          .alpha(0)
          .stop();
        this.renderPositions();
        this.fitToView(0);
        return;
      }

      this.simulation
        .force("link", d3.forceLink<D3Node, D3Link>(this.links || []).id(d => d.id).distance(80).strength(0.2))
        .force("charge", d3.forceManyBody<D3Node>().strength(d => -40 - Math.max(5, Math.min(28, Math.sqrt(d.size || 1) * 2.5 + 3)) * 8).distanceMax(350))
        .force("center", d3.forceCenter(0, 0).strength(0.08))
        .force("collide", d3.forceCollide<D3Node>(d => Math.max(5, Math.min(28, Math.sqrt(d.size || 1) * 2.5 + 3)) + 6).iterations(2))
        .force("x", d3.forceX<D3Node>(0).strength(0.06))
        .force("y", d3.forceY<D3Node>(0).strength(0.06));
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

  destroy() {
    if (this.highlightFrameId) {
      cancelAnimationFrame(this.highlightFrameId);
      this.highlightFrameId = null;
    }
    if (this.viewportAdaptFrameId) {
      cancelAnimationFrame(this.viewportAdaptFrameId);
      this.viewportAdaptFrameId = null;
    }
    if (this.fitTimeout) clearTimeout(this.fitTimeout);
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
