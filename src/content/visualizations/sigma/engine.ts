import { Sigma } from 'sigma';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

const colorsDark = ['#0ea5e9', '#3b82f6', '#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#a855f7', '#f43f5e'];
const colorsLight = ['#0284c7', '#2563eb', '#4f46e5', '#0891b2', '#d97706', '#059669', '#9333ea', '#e11d48'];

function getNodeColor(group: number, isLight: boolean): string {
  return isLight ? (colorsLight[group] || colorsLight[0]) : (colorsDark[group] || colorsDark[0]);
}

export interface SigmaNodeData {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  group: number;
  color: string;
}

export interface SigmaEdgeData {
  id: string;
  source: string;
  target: string;
  color?: string;
}

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
  payload?: SigmaPayload;
  currentLayout?: string;
  isLight?: boolean;
  resizeObserver: ResizeObserver | null;
  animationFrameId: number | null;
  init(container: HTMLElement, payload: SigmaPayload, layout: string, isLight: boolean): Promise<SigmaEngine>;
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
  resizeObserver: null,
  animationFrameId: null,

  async init(container: HTMLElement, payload: SigmaPayload, layout: string, isLight: boolean) {
    this.graph = new Graph();
    this.payload = payload;
    const nodes = payload.sigma.nodes;
    const edges = payload.sigma.edges;

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

    this.sigma = new Sigma(this.graph, container, {
      defaultNodeColor: '#3b82f6',
      defaultEdgeColor: edgeColor,
      labelColor: { color: isLight ? '#0f172a' : '#f3f4f6' },
      labelFont: 'Outfit, Inter, sans-serif',
      labelSize: 10,
      allowInvalidContainer: true,
      enableCameraZooming: false
    });
    this.sigma.getCamera().enabledZooming = false;

    this.sigma.on('clickNode', ({ node }: { node: string }) => {
      if (
        node.startsWith('/posts/') ||
        node.startsWith('/publications/') ||
        node.startsWith('/projects/') ||
        node.startsWith('/courses/') ||
        node.startsWith('/services/') ||
        node.startsWith('/interests/') ||
        node.startsWith('/tags/')
      ) {
        window.location.href = node;
      }
    });

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
    const edgeColor = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)';
    const labelColor = isLight ? '#0f172a' : '#f3f4f6';

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
      const interests = nodes.filter(n => this.graph?.getNodeAttribute(n, 'group') === 7);

      const categories = [posts, publications, presentations, tags, courses, projects, services, interests];
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
    if (this.sigma) {
      this.sigma.kill();
      this.sigma = null;
    }
    this.graph = null;
  }
};

export default engine;
