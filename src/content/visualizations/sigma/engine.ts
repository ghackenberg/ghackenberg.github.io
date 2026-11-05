import { Sigma } from 'sigma';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import { GRAPH_COLORS, type SigmaNode, type SigmaEdge } from '@commons/shared/graph-payload';
import { getThemeTokens } from '@commons/shared/domain-themes';
import { createGraphTooltipController, type GraphTooltipController } from '@commons/client/vis-tooltip';

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
  mouseMoveHandler: ((e: MouseEvent) => void) | null;
  container: HTMLElement | null;
  payload?: SigmaPayload;
  currentLayout?: string;
  isLight?: boolean;
  resizeObserver: ResizeObserver | null;
  animationFrameId: number | null;
  init(container: HTMLElement, payload: SigmaPayload, layout: string, isLight: boolean, extraOptions?: Record<string, string>): Promise<SigmaEngine>;
  updateLayout(layout: string, isLight: boolean): void;
  animateTo(targets: Record<string, { x: number; y: number }>, duration?: number): void;
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
  resizeObserver: null,
  animationFrameId: null,

  async init(container: HTMLElement, payload: SigmaPayload, layout: string, isLight: boolean, extraOptions: Record<string, string> = {}) {
    this.container = container;
    this.graph = new Graph();
    this.payload = payload;
    const nodes = payload.sigma.nodes;
    const edges = payload.sigma.edges;
    this.nodeMap = new Map(nodes.map(n => [n.id, n]));

    nodes.forEach(n => {
      this.graph?.addNode(n.id, {
        label: n.label,
        x: n.x || Math.random(),
        y: n.y || Math.random(),
        size: n.size * 3 + 2,
        group: n.group ?? 0,
        color: getNodeColor(n.group ?? 0, isLight)
      });
    });

    const edgeColor = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)';
    edges.forEach(e => {
      this.graph?.addEdge(e.source, e.target, {
        size: 1,
        color: edgeColor
      });
    });

    this.tooltipController = createGraphTooltipController(container);

    const tokens = getThemeTokens(isLight);
    this.sigma = new Sigma(this.graph, container, {
      defaultNodeColor: tokens.nodeDefault,
      defaultEdgeColor: edgeColor,
      labelColor: { color: tokens.textHeading },
      labelFont: 'Outfit, Inter, sans-serif',
      labelSize: 10,
      defaultDrawNodeHover: () => {},
      allowInvalidContainer: true,
      enableCameraZooming: false
    });
    this.sigma.getCamera().enabledZooming = false;

    const utmSource = String(extraOptions.utmSource || 'visualizations_demo');
    const utmMedium = String(extraOptions.utmMedium || 'sigma');
    const utmCampaign = String(extraOptions.utmCampaign || 'interactive_visualization');

    this.sigma.on('clickNode', ({ node }: { node: string }) => {
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
    });

    let hoveredNodeId: string | null = null;

    this.sigma.on('enterNode', ({ node }: { node: string }) => {
      hoveredNodeId = node;
      container.style.cursor = 'pointer';

      const currentIsLight = Boolean(this.isLight);
      const rawNode = this.nodeMap?.get(node);
      if (rawNode && this.sigma && this.graph) {
        const nx = this.graph.getNodeAttribute(node, 'x') as number;
        const ny = this.graph.getNodeAttribute(node, 'y') as number;
        const viewportPos = this.sigma.graphToViewport({ x: nx, y: ny });

        this.tooltipController?.show(
          {
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
          currentIsLight,
          viewportPos.x,
          viewportPos.y
        );

        const highlightEdgeColor = currentIsLight ? 'rgba(15, 23, 42, 0.35)' : 'rgba(255, 255, 255, 0.35)';
        const baseEdgeColor = currentIsLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)';
        const connectedEdges = new Set(this.graph.edges(node));

        this.graph.forEachEdge(edge => {
          const isConnected = connectedEdges.has(edge);
          this.graph?.setEdgeAttribute(edge, 'color', isConnected ? highlightEdgeColor : baseEdgeColor);
          this.graph?.setEdgeAttribute(edge, 'size', isConnected ? 1.8 : 1);
        });
        this.sigma.refresh();
      }
    });

    this.sigma.on('leaveNode', () => {
      hoveredNodeId = null;
      container.style.cursor = 'default';
      this.tooltipController?.hide();

      if (this.graph && this.sigma) {
        const currentIsLight = Boolean(this.isLight);
        const baseEdgeColor = currentIsLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)';
        this.graph.forEachEdge(edge => {
          this.graph?.setEdgeAttribute(edge, 'color', baseEdgeColor);
          this.graph?.setEdgeAttribute(edge, 'size', 1);
        });
        this.sigma.refresh();
      }
    });

    this.mouseMoveHandler = (e: MouseEvent) => {
      if (hoveredNodeId) {
        const rect = container.getBoundingClientRect();
        this.tooltipController?.move(e.clientX - rect.left, e.clientY - rect.top);
      }
    };
    container.addEventListener('mousemove', this.mouseMoveHandler);

    this.currentLayout = layout;
    this.isLight = isLight;
    this.updateLayout(layout, isLight);
    
    // Zoom to fit the graph
    setTimeout(() => {
      if (this.sigma) {
        this.sigma.getCamera().animatedReset();
      }
    }, 100);

    // Bind ResizeObserver to handle container size changes dynamically
    this.resizeObserver = new ResizeObserver(() => {
      if (this.sigma) {
        this.sigma.refresh();
        this.sigma.getCamera().animatedReset();
      }
    });
    this.resizeObserver.observe(container);

    return this;
  },

  updateLayout(layout: string, isLight: boolean) {
    if (!this.graph || !this.sigma) return;
    this.currentLayout = layout;
    this.isLight = isLight;

    // Apply color update to node labels and edges based on theme
    const tokens = getThemeTokens(isLight);
    const edgeColor = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)';
    const labelColor = tokens.textHeading;

    this.graph.forEachEdge(edge => {
      this.graph?.setEdgeAttribute(edge, 'color', edgeColor);
    });

    this.graph.forEachNode(node => {
      const grp = (this.graph?.getNodeAttribute(node, 'group') as number | undefined) ?? 0;
      this.graph?.setNodeAttribute(node, 'color', getNodeColor(grp, isLight));
    });

    this.sigma.setSetting('labelColor', { color: labelColor });
    this.sigma.setSetting('defaultEdgeColor', edgeColor);

    const targets: Record<string, { x: number; y: number }> = {};

    if (layout === 'radial') {
      const nodes = this.graph.nodes();
      const tags = nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') === 0);
      const others = nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') !== 0);

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

      this.animateTo(targets);

    } else if (layout === 'columns') {
      const nodes = this.graph.nodes();
      const posts = nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') === 1);
      const publications = nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') === 2);
      const presentations = nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') === 3);
      const tags = nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') === 0);
      const courses = nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') === 4);
      const projects = nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') === 5);
      const services = nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') === 6);
      const newsletters = nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') === 7);
      const visualizations = nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') === 8);

      const categories = [posts, publications, presentations, tags, courses, projects, services, newsletters, visualizations];
      const isMobile = window.innerWidth < 768;

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

      this.animateTo(targets);

    } else {
      // default: force directed
      const startingPos: Record<string, { x: number; y: number }> = {};
      this.graph.forEachNode(node => {
        startingPos[node] = {
          x: this.graph?.getNodeAttribute(node, 'x') as number,
          y: this.graph?.getNodeAttribute(node, 'y') as number
        };
      });

      // Run ForceAtlas2 (which will change coordinates in graph)
      forceAtlas2.assign(this.graph, {
        iterations: 100,
        settings: {
          gravity: 0.8
        }
      });

      // Read resulting targets and reset graph to starting positions
      this.graph.forEachNode(node => {
        targets[node] = {
          x: this.graph?.getNodeAttribute(node, 'x') as number,
          y: this.graph?.getNodeAttribute(node, 'y') as number
        };
        this.graph?.setNodeAttribute(node, 'x', startingPos[node].x);
        this.graph?.setNodeAttribute(node, 'y', startingPos[node].y);
      });

      this.animateTo(targets);
    }
  },

  animateTo(targets: Record<string, { x: number; y: number }>, duration = 600) {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
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
        if (this.sigma) {
          this.sigma.getCamera().animatedReset();
        }
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  },

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
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
