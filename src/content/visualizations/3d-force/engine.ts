import ForceGraph3D from '3d-force-graph';
import {
  GRAPH_COLORS,
  HIGHLIGHT_TRANSITION_MS,
  easeHighlightTransition,
  getGraphStyleTokens,
  buildGraphAdjacency,
  computeHopDistances,
  interpolateHexColor,
  getAttenuatedNodeColor,
  getAttenuatedNodeScale,
  getAttenuatedEdgeStyle,
  type GraphNodePayload
} from '@commons/shared/graph-payload';
import { getThemeTokens } from '@commons/shared/domain-themes';
import { createGraphTooltipController, type GraphTooltipController } from '@commons/client/vis-tooltip';

export interface Force3DNode extends GraphNodePayload {
  val: number;
  color: string;
  displayVal?: number;
  displayColor?: string;
  x?: number;
  y?: number;
  z?: number;
  fx?: number | null;
  fy?: number | null;
  fz?: number | null;
}

export interface Force3DLink {
  source: string | Force3DNode;
  target: string | Force3DNode;
  displayColor?: string;
  displayWidth?: number;
}

export interface Force3DNavigationControls {
  noZoom?: boolean;
  enableZoom?: boolean;
}

export interface Force3DEngine {
  layouts: { id: string; label: string }[];
  nodes: Force3DNode[] | null;
  links: Force3DLink[] | null;
  graph: ReturnType<typeof ForceGraph3D> | null;
  tooltipController: GraphTooltipController | null;
  hoveredNodeId: string | null;
  draggedNodeId: string | null;
  adjacency: Map<string, Set<string>> | null;
  activeDistances: Map<string, number> | null;
  mouseMoveHandler: ((e: MouseEvent) => void) | null;
  container: HTMLElement | null;
  currentLayout?: string;
  isLight?: boolean;
  lastOrderSignature?: string;
  lastDraggedAt?: number;
  recenterTimeout?: ReturnType<typeof setTimeout> | null;
  resizeObserver: ResizeObserver | null;
  initialized: boolean;
  animationFrameId: number | null;
  highlightFrameId: number | null;
  applyHighlight?(immediate?: boolean): void;
  init(container: HTMLElement, payload: { '3d-force': { nodes: GraphNodePayload[]; connections: { sourceId: string; targetId: string }[] } }, layout: string, isLight: boolean, extraOptions?: Record<string, string>): Promise<Force3DEngine>;
  computeLayoutTargets(layout: string, useCurrentOrder?: boolean): { targets: Record<string, { x: number; y: number; z: number }>; signature: string };
  updateLayout(layout: string, isLight: boolean): void;
  animateTo(targets: Record<string, { x: number; y: number; z: number }>, duration?: number, excludeNodeId?: string, zoomToFitAfter?: boolean): void;
  destroy(): void;
}

const engine: Force3DEngine = {
  layouts: [
    { id: 'force', label: 'Force Directed (Organic)' },
    { id: 'radial', label: 'Concentric Rings (Tags → Items)' },
    { id: 'columns', label: 'Structured Columns (Category)' }
  ],
  nodes: null,
  links: null,
  graph: null,
  tooltipController: null,
  hoveredNodeId: null,
  draggedNodeId: null,
  adjacency: null,
  activeDistances: null,
  mouseMoveHandler: null,
  container: null,
  lastOrderSignature: '',
  lastDraggedAt: 0,
  recenterTimeout: null,
  resizeObserver: null,
  initialized: false,
  animationFrameId: null,
  highlightFrameId: null,

  async init(container: HTMLElement, payload: { '3d-force': { nodes: GraphNodePayload[]; connections: { sourceId: string; targetId: string }[] } }, layout: string, isLight: boolean, extraOptions: Record<string, string> = {}) {
    this.container = container;
    this.currentLayout = undefined;
    this.isLight = isLight;
    this.hoveredNodeId = null;
    this.draggedNodeId = null;
    this.adjacency = buildGraphAdjacency(payload['3d-force'].connections);
    this.activeDistances = null;
    this.lastOrderSignature = '';
    this.lastDraggedAt = 0;
    const colors = isLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;
    const initialStyleTokens = getGraphStyleTokens(isLight);
    
    // Cache nodes and connections with full rich metadata
    this.nodes = payload['3d-force'].nodes.map((n) => ({
      ...n,
      val: 6,
      displayVal: 6,
      color: colors[n.group] || colors[0],
      displayColor: colors[n.group] || colors[0]
    }));

    this.links = payload['3d-force'].connections.map((c) => ({
      source: c.sourceId,
      target: c.targetId,
      displayColor: initialStyleTokens.edgeColor,
      displayWidth: initialStyleTokens.edgeWidth
    }));

    let hasMousePosition = false;
    let lastMouseX = container.clientWidth / 2;
    let lastMouseY = container.clientHeight / 2;

    this.mouseMoveHandler = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      hasMousePosition = true;
      lastMouseX = e.clientX - rect.left;
      lastMouseY = e.clientY - rect.top;
      if (this.hoveredNodeId) {
        this.tooltipController?.move(lastMouseX, lastMouseY);
      }
    };
    container.addEventListener('pointermove', this.mouseMoveHandler, { capture: true, passive: true });
    container.addEventListener('mousemove', this.mouseMoveHandler, { capture: true, passive: true });

    const utmSource = String(extraOptions.utmSource || 'visualizations_demo');
    const utmMedium = String(extraOptions.utmMedium || '3d-force');
    const utmCampaign = String(extraOptions.utmCampaign || 'interactive_visualization');

    let lastHighlightedNodeId: string | null = null;

    const refreshHighlight = (immediate = false) => {
      const activeNodeId = this.draggedNodeId ?? this.hoveredNodeId;
      if (!immediate && activeNodeId === lastHighlightedNodeId) return;
      lastHighlightedNodeId = activeNodeId;

      if (this.highlightFrameId) {
        cancelAnimationFrame(this.highlightFrameId);
        this.highlightFrameId = null;
      }
      const dists = activeNodeId && this.adjacency
        ? computeHopDistances(activeNodeId, this.adjacency)
        : null;
      this.activeDistances = dists;

      const currentIsLight = Boolean(this.isLight);
      const currentTokens = getGraphStyleTokens(currentIsLight);
      const palette = currentIsLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;

      const nodeTrans = (this.nodes || []).map((n) => {
        const baseColor = palette[n.group] || palette[0];
        const startColor = n.displayColor || baseColor;
        const startVal = n.displayVal ?? n.val;
        const hopDist = dists ? dists.get(n.id) : undefined;
        const targetColor = dists
          ? getAttenuatedNodeColor(baseColor, hopDist, currentIsLight)
          : baseColor;
        const targetVal = dists
          ? n.val * Math.pow(getAttenuatedNodeScale(hopDist), 3)
          : n.val;
        return { node: n, startColor, targetColor, startVal, targetVal };
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
          nt.node.displayVal = nt.startVal + (nt.targetVal - nt.startVal) * ease;
        }
        for (const lt of linkTrans) {
          lt.link.displayColor = interpolateHexColor(lt.startColor, lt.targetColor, ease);
          lt.link.displayWidth = lt.startWidth + (lt.targetWidth - lt.startWidth) * ease;
        }
        if (this.graph) {
          this.graph
            .nodeColor(this.graph.nodeColor())
            .nodeVal(this.graph.nodeVal())
            .linkColor(this.graph.linkColor())
            .linkWidth(this.graph.linkWidth());
        }
      };

      if (immediate) {
        renderStep(1);
        return;
      }

      const startTime = performance.now();
      const step = (now: number) => {
        if (!this.graph) {
          this.highlightFrameId = null;
          return;
        }
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
    this.applyHighlight = refreshHighlight;

    const tokens = getThemeTokens(isLight);
    const initialWidth = container.clientWidth || 800;
    const initialHeight = container.clientHeight || 500;
    this.graph = ForceGraph3D()(container)
      .width(initialWidth)
      .height(initialHeight)
      .graphData({ nodes: this.nodes, links: this.links })
      .backgroundColor(tokens.canvasBg)
      .showNavInfo(false)
      .nodeLabel(() => '')
      .nodeVal((n: Force3DNode) => n.displayVal ?? n.val)
      .nodeColor((n: Force3DNode) => {
        const currentIsLight = Boolean(this.isLight);
        const palette = currentIsLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;
        return n.displayColor || palette[n.group] || palette[0];
      })
      .linkOpacity(1)
      .linkColor((l: Force3DLink) => {
        const currentTokens = getGraphStyleTokens(Boolean(this.isLight));
        return l.displayColor || currentTokens.edgeColor;
      })
      .linkWidth((l: Force3DLink) => {
        const currentTokens = getGraphStyleTokens(Boolean(this.isLight));
        return l.displayWidth ?? currentTokens.edgeWidth;
      })
      .onNodeHover((node: Force3DNode | null) => {
        const hovered = node;
        this.hoveredNodeId = hovered ? hovered.id : null;
        if (this.draggedNodeId) {
          this.tooltipController?.hide();
          return;
        }
        container.style.cursor = hovered ? 'pointer' : 'default';

        if (hovered) {
          let x = lastMouseX;
          let y = lastMouseY;
          if (!hasMousePosition && this.graph && typeof hovered.x === 'number' && typeof hovered.y === 'number' && typeof hovered.z === 'number') {
            try {
              const screenCoords = this.graph.graph2ScreenCoords(hovered.x, hovered.y, hovered.z);
              if (screenCoords && typeof screenCoords.x === 'number' && typeof screenCoords.y === 'number') {
                x = screenCoords.x;
                y = screenCoords.y;
              }
            } catch {
              // Fall back to pointer coordinates
            }
          }
          this.tooltipController?.show(hovered, Boolean(this.isLight), x, y);
        } else {
          this.tooltipController?.hide();
        }

        refreshHighlight();
      })
      .onNodeDrag((node: Force3DNode) => {
        this.lastDraggedAt = performance.now();
        this.tooltipController?.hide();
        if (this.draggedNodeId !== node.id) {
          this.draggedNodeId = node.id;
          refreshHighlight();
        }
        if (this.recenterTimeout) {
          clearTimeout(this.recenterTimeout);
          this.recenterTimeout = null;
        }

        if (this.currentLayout === 'force' && this.nodes) {
          this.nodes.forEach(n => {
            if (n.id !== node.id) {
              n.fx = null;
              n.fy = null;
              n.fz = null;
            }
          });
          try {
            this.graph?.d3ReheatSimulation();
          } catch {
            // Suppress
          }
        } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          const { targets, signature } = this.computeLayoutTargets(this.currentLayout, true);
          if (signature !== this.lastOrderSignature) {
            this.lastOrderSignature = signature;
            this.animateTo(targets, 250, node.id, false);
          }
        }
      })
      .onNodeDragEnd((node: Force3DNode) => {
        this.lastDraggedAt = performance.now();
        this.draggedNodeId = null;
        this.hoveredNodeId = null;
        container.style.cursor = 'default';
        refreshHighlight();
        if (this.currentLayout === 'force') {
          node.fx = null;
          node.fy = null;
          node.fz = null;
          try {
            this.graph?.d3ReheatSimulation();
          } catch {
            // Suppress
          }
        } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          const { targets } = this.computeLayoutTargets(this.currentLayout, true);
          this.animateTo(targets, 400, undefined, false);
        }
      })
      .onNodeClick((node: Force3DNode) => {
        if (this.lastDraggedAt && performance.now() - this.lastDraggedAt < 250) return;
        const clicked = node;
        if (
          clicked.id.startsWith('/posts/') ||
          clicked.id.startsWith('/publications/') ||
          clicked.id.startsWith('/presentations/') ||
          clicked.id.startsWith('/projects/') ||
          clicked.id.startsWith('/courses/') ||
          clicked.id.startsWith('/services/') ||
          clicked.id.startsWith('/newsletters/') ||
          clicked.id.startsWith('/visualizations/') ||
          clicked.id.startsWith('/tags/')
        ) {
          const targetUrl = new URL(clicked.id, window.location.origin);
          targetUrl.searchParams.set('utm_source', utmSource);
          targetUrl.searchParams.set('utm_medium', utmMedium);
          targetUrl.searchParams.set('utm_campaign', utmCampaign);
          window.location.href = targetUrl.pathname + targetUrl.search;
        }
      });

    // Hide any internal 3d-force-graph scene tooltip element and mount our Preact tooltip AFTER ForceGraph3D()(container)
    // so kapsule's container DOM clearing does not detach tooltipEl.
    const internalTooltip = container.querySelector<HTMLElement>('.scene-tooltip, .graph-tooltip');
    if (internalTooltip) {
      internalTooltip.style.display = 'none';
    }
    this.tooltipController = createGraphTooltipController(container);

    this.graph.d3Force('charge').strength(-120);

    const controls = (this.graph.controls?.() as Force3DNavigationControls | undefined);
    if (controls) {
      controls.noZoom = true;
      controls.enableZoom = false;
    }

    let lastWidth = initialWidth;
    let lastHeight = initialHeight;
    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0 && (Math.abs(width - lastWidth) >= 2 || Math.abs(height - lastHeight) >= 2)) {
          lastWidth = width;
          lastHeight = height;
          if (this.graph) {
            this.graph.width(width).height(height);
          }
        }
      }
    });
    this.resizeObserver.observe(container);

    this.initialized = false;
    this.updateLayout(layout, isLight);
    this.initialized = true;

    setTimeout(() => {
      if (this.graph) {
        try {
          this.graph.zoomToFit(400, 40);
        } catch {
          // Suppress if graph is already destroyed
        }
      }
    }, 350);

    return this;
  },

  computeLayoutTargets(layout: string, useCurrentOrder = false) {
    const targets: Record<string, { x: number; y: number; z: number }> = {};
    let signature = '';
    if (!this.nodes) return { targets, signature };

    if (layout === 'radial') {
      const tags = [...this.nodes.filter(n => n.group === 0)];
      const others = [...this.nodes.filter(n => n.group !== 0)];

      if (useCurrentOrder) {
        const normAngle = (n: Force3DNode, count: number) =>
          ((Math.atan2(n.y || 0, n.x || 0) + Math.PI / Math.max(1, count)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        tags.sort((a, b) => normAngle(a, tags.length) - normAngle(b, tags.length));
        others.sort((a, b) => normAngle(a, others.length) - normAngle(b, others.length));
      }

      // Inner ring: tags (Z = 0)
      tags.forEach((n, idx) => {
        const theta = (2 * Math.PI * idx) / tags.length;
        targets[n.id] = {
          x: 70 * Math.cos(theta),
          y: 70 * Math.sin(theta),
          z: 0
        };
      });

      // Outer ring: other items (Z = 0)
      others.forEach((n, idx) => {
        const theta = (2 * Math.PI * idx) / others.length;
        targets[n.id] = {
          x: 160 * Math.cos(theta),
          y: 160 * Math.sin(theta),
          z: 0
        };
      });

      signature = `${tags.map(n => n.id).join(',')}|${others.map(n => n.id).join(',')}`;
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
      const isMobile = window.innerWidth < 768;
      const heightFactor = 25;
      const widthFactor = 25;

      if (useCurrentOrder) {
        categories.forEach(catNodes => {
          catNodes.sort((a, b) => isMobile ? (a.x || 0) - (b.x || 0) : (a.y || 0) - (b.y || 0));
        });
      }

      if (isMobile) {
        categories.forEach((catNodes, catIdx) => {
          const rowY = (catIdx - (categories.length - 1) / 2) * 55;
          catNodes.forEach((n, idx) => {
            targets[n.id] = {
              x: catNodes.length > 1 ? (idx - (catNodes.length - 1) / 2) * widthFactor : 0,
              y: rowY,
              z: 0
            };
          });
        });
      } else {
        categories.forEach((catNodes, catIdx) => {
          const colX = (catIdx - (categories.length - 1) / 2) * 55;
          catNodes.forEach((n, idx) => {
            targets[n.id] = {
              x: colX,
              y: catNodes.length > 1 ? (idx - (catNodes.length - 1) / 2) * heightFactor : 0,
              z: 0
            };
          });
        });
      }

      signature = categories.map(cat => cat.map(n => n.id).join(',')).join('|');
    }

    return { targets, signature };
  },

  updateLayout(layout: string, isLight: boolean) {
    if (!this.graph || !this.nodes) return;
    const layoutChanged = this.currentLayout !== layout;
    this.currentLayout = layout;
    this.isLight = isLight;

    // Apply color update based on theme
    const tokens = getThemeTokens(isLight);
    this.graph.backgroundColor(tokens.canvasBg);

    const colors = isLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;
    this.nodes.forEach(n => {
      n.color = colors[n.group] || colors[0];
    });
    this.applyHighlight?.(true);

    if (this.initialized && !layoutChanged) {
      return;
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (layout === 'radial' || layout === 'columns') {
      const { targets, signature } = this.computeLayoutTargets(layout, false);
      this.lastOrderSignature = signature;
      this.animateTo(targets, 800, undefined, this.initialized);
    } else {
      // default: force directed
      // Release node positions so the force simulation can solve them dynamically
      this.nodes.forEach(n => {
        n.fx = null;
        n.fy = null;
        n.fz = null;
      });
      
      // Only reheat the simulation if we are already initialized and switching layouts.
      if (this.initialized) {
        try {
          this.graph.d3ReheatSimulation();
        } catch {
          // Suppress if the internal engine has not loaded yet
        }
        if (this.recenterTimeout) clearTimeout(this.recenterTimeout);
        this.recenterTimeout = setTimeout(() => {
          try {
            this.graph?.zoomToFit(400, 40);
          } catch {
            // Suppress
          }
        }, 450);
      }
    }
  },

  animateTo(targets: Record<string, { x: number; y: number; z: number }>, duration = 800, excludeNodeId?: string, zoomToFitAfter = false) {
    if (!this.nodes) return;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    const startTime = performance.now();
    const startPositions: Record<string, { x: number; y: number; z: number }> = {};
    
    this.nodes.forEach(n => {
      startPositions[n.id] = {
        x: n.x || 0,
        y: n.y || 0,
        z: n.z || 0
      };
    });

    const step = (time: number) => {
      if (!this.nodes) return;
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing: easeInOutCubic
      const ease = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.nodes.forEach(n => {
        if (excludeNodeId && n.id === excludeNodeId) return;
        const start = startPositions[n.id];
        const target = targets[n.id];
        if (start && target) {
          n.fx = start.x + (target.x - start.x) * ease;
          n.fy = start.y + (target.y - start.y) * ease;
          n.fz = start.z + (target.z - start.z) * ease;
          n.x = n.fx;
          n.y = n.fy;
          n.z = n.fz;
        }
      });

      if (this.graph && this.initialized) {
        try {
          this.graph.d3ReheatSimulation();
        } catch {
          // Suppress
        }
      }

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.animationFrameId = null;
        try {
          if (this.graph && this.initialized) {
            this.graph.d3ReheatSimulation();
            if (zoomToFitAfter) {
              this.graph.zoomToFit(400, 40);
            }
          }
        } catch {
          // Suppress if the internal engine is not ready
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
    if (this.recenterTimeout) {
      clearTimeout(this.recenterTimeout);
      this.recenterTimeout = null;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.container && this.mouseMoveHandler) {
      this.container.removeEventListener('pointermove', this.mouseMoveHandler, { capture: true });
      this.container.removeEventListener('mousemove', this.mouseMoveHandler, { capture: true });
      this.mouseMoveHandler = null;
      this.container = null;
    }
    if (this.tooltipController) {
      this.tooltipController.destroy();
      this.tooltipController = null;
    }
    this.hoveredNodeId = null;
    this.draggedNodeId = null;
    this.adjacency = null;
    this.activeDistances = null;
    if (this.graph) {
      this.graph.pauseAnimation();
      this.graph.graphData({ nodes: [], links: [] });
      this.graph = null;
    }
    this.nodes = null;
    this.links = null;
  }
};

export default engine;
