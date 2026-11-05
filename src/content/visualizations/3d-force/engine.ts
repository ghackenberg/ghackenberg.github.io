import ForceGraph3D from '3d-force-graph';
import { GRAPH_COLORS, type GraphNodePayload } from '@commons/shared/graph-payload';
import { getThemeTokens } from '@commons/shared/domain-themes';
import { createGraphTooltipController, type GraphTooltipController } from '@commons/client/vis-tooltip';

export interface Force3DNode extends GraphNodePayload {
  val: number;
  color: string;
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
  mouseMoveHandler: ((e: MouseEvent) => void) | null;
  container: HTMLElement | null;
  isLight?: boolean;
  resizeObserver: ResizeObserver | null;
  initialized: boolean;
  animationFrameId: number | null;
  init(container: HTMLElement, payload: { '3d-force': { nodes: GraphNodePayload[]; connections: { sourceId: string; targetId: string }[] } }, layout: string, isLight: boolean, extraOptions?: Record<string, string>): Promise<Force3DEngine>;
  updateLayout(layout: string, isLight: boolean): void;
  animateTo(targets: Record<string, { x: number; y: number; z: number }>, duration?: number): void;
  destroy(): void;
}

function isLinkConnected(link: Force3DLink, hoveredId: string | null): boolean {
  if (!hoveredId) return false;
  const srcId = typeof link.source === 'object' ? link.source.id : link.source;
  const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
  return srcId === hoveredId || tgtId === hoveredId;
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
  mouseMoveHandler: null,
  container: null,
  resizeObserver: null,
  initialized: false,
  animationFrameId: null,

  async init(container: HTMLElement, payload: { '3d-force': { nodes: GraphNodePayload[]; connections: { sourceId: string; targetId: string }[] } }, layout: string, isLight: boolean, extraOptions: Record<string, string> = {}) {
    this.container = container;
    this.isLight = isLight;
    const colors = isLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;
    
    // Cache nodes and connections with full rich metadata
    this.nodes = payload['3d-force'].nodes.map((n) => ({
      ...n,
      val: n.size * 5 + 3,
      color: colors[n.group] || colors[0]
    }));

    this.links = payload['3d-force'].connections.map((c) => ({
      source: c.sourceId,
      target: c.targetId
    }));

    this.tooltipController = createGraphTooltipController(container);

    let lastMouseX = container.clientWidth / 2;
    let lastMouseY = container.clientHeight / 2;

    this.mouseMoveHandler = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      lastMouseX = e.clientX - rect.left;
      lastMouseY = e.clientY - rect.top;
      if (this.hoveredNodeId) {
        this.tooltipController?.move(lastMouseX, lastMouseY);
      }
    };
    container.addEventListener('mousemove', this.mouseMoveHandler);

    const utmSource = String(extraOptions.utmSource || 'visualizations_demo');
    const utmMedium = String(extraOptions.utmMedium || '3d-force');
    const utmCampaign = String(extraOptions.utmCampaign || 'interactive_visualization');

    const tokens = getThemeTokens(isLight);
    this.graph = ForceGraph3D()(container)
      .graphData({ nodes: this.nodes, links: this.links })
      .backgroundColor(tokens.canvasBg)
      .showNavInfo(false)
      .nodeLabel('')
      .nodeVal('val')
      .nodeColor('color')
      .linkColor((l: Force3DLink) => {
        const currentIsLight = Boolean(this.isLight);
        if (isLinkConnected(l, this.hoveredNodeId)) {
          return currentIsLight ? 'rgba(15, 23, 42, 0.35)' : 'rgba(255, 255, 255, 0.35)';
        }
        return currentIsLight ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255, 255, 255, 0.08)';
      })
      .linkWidth((l: Force3DLink) => isLinkConnected(l, this.hoveredNodeId) ? 2.2 : 1.2)
      .linkDirectionalParticles(2)
      .linkDirectionalParticleWidth(1.5)
      .linkDirectionalParticleSpeed(0.006)
      .onNodeHover((node: Force3DNode | null) => {
        const hovered = node;
        this.hoveredNodeId = hovered ? hovered.id : null;
        container.style.cursor = hovered ? 'pointer' : 'default';

        if (hovered) {
          let x = lastMouseX;
          let y = lastMouseY;
          if (this.graph && typeof hovered.x === 'number' && typeof hovered.y === 'number' && typeof hovered.z === 'number') {
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

        if (this.graph) {
          this.graph
            .linkColor(this.graph.linkColor())
            .linkWidth(this.graph.linkWidth());
        }
      })
      .onNodeClick((node: Force3DNode) => {
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

    this.graph.d3Force('charge').strength(-120);

    const controls = (this.graph.controls?.() as Force3DNavigationControls | undefined);
    if (controls) {
      controls.noZoom = true;
      controls.enableZoom = false;
    }

    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (this.graph) {
          this.graph.width(width).height(height);
        }
      }
    });
    this.resizeObserver.observe(container);

    this.initialized = false;
    this.updateLayout(layout, isLight);
    this.initialized = true;

    return this;
  },

  updateLayout(layout: string, isLight: boolean) {
    if (!this.graph || !this.nodes) return;
    this.isLight = isLight;

    // Apply color update based on theme
    const tokens = getThemeTokens(isLight);
    this.graph.backgroundColor(tokens.canvasBg);
    this.graph.linkColor(this.graph.linkColor());

    const colors = isLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;
    this.nodes.forEach(n => {
      n.color = colors[n.group] || colors[0];
    });
    this.graph.nodeColor('color');

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (layout === 'radial') {
      const targets: Record<string, { x: number; y: number; z: number }> = {};
      const tags = this.nodes.filter(n => n.group === 0);
      const others = this.nodes.filter(n => n.group !== 0);

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

      this.animateTo(targets);

    } else if (layout === 'columns') {
      const targets: Record<string, { x: number; y: number; z: number }> = {};
      const posts = this.nodes.filter(n => n.group === 1);
      const publications = this.nodes.filter(n => n.group === 2);
      const presentations = this.nodes.filter(n => n.group === 3);
      const tags = this.nodes.filter(n => n.group === 0);
      const courses = this.nodes.filter(n => n.group === 4);
      const projects = this.nodes.filter(n => n.group === 5);
      const services = this.nodes.filter(n => n.group === 6);
      const newsletters = this.nodes.filter(n => n.group === 7);
      const visualizations = this.nodes.filter(n => n.group === 8);

      const categories = [posts, publications, presentations, tags, courses, projects, services, newsletters, visualizations];
      const isMobile = window.innerWidth < 768;
      const heightFactor = 25;
      const widthFactor = 25;

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

      this.animateTo(targets);

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
      }
    }
  },

  animateTo(targets: Record<string, { x: number; y: number; z: number }>, duration = 800) {
    if (!this.nodes) return;
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
          }
        } catch {
          // Suppress if the internal engine is not ready
        }
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  },

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
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
    this.hoveredNodeId = null;
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
