import { Sigma } from 'sigma';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import { GRAPH_COLORS, getGraphStyleTokens, type SigmaNode, type SigmaEdge } from '@commons/shared/graph-payload';
import { getThemeTokens } from '@commons/shared/domain-themes';
import { createGraphTooltipController, type GraphTooltipController } from '@commons/client/vis-tooltip';

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
  mouseMoveHandler: ((e: MouseEvent) => void) | null;
  container: HTMLElement | null;
  payload?: SigmaPayload;
  currentLayout?: string;
  isLight?: boolean;
  lastDraggedAt?: number;
  lastOrderSignature?: string;
  physicsFrameId?: number | null;
  resizeObserver: ResizeObserver | null;
  animationFrameId: number | null;
  init(container: HTMLElement, payload: SigmaPayload, layout: string, isLight: boolean, extraOptions?: Record<string, string>): Promise<SigmaEngine>;
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
  physicsFrameId: null,
  resizeObserver: null,
  animationFrameId: null,

  async init(container: HTMLElement, payload: SigmaPayload, layout: string, isLight: boolean, extraOptions: Record<string, string> = {}) {
    this.container = container;
    this.graph = new Graph();
    this.payload = payload;
    this.currentLayout = undefined;
    this.lastDraggedAt = 0;
    this.lastOrderSignature = '';
    const nodes = payload.sigma.nodes;
    const edges = payload.sigma.edges;
    this.nodeMap = new Map(nodes.map(n => [n.id, n]));

    const styleTokens = getGraphStyleTokens(isLight);

    nodes.forEach(n => {
      const nx = n.x || Math.random();
      const ny = n.y || Math.random();
      this.graph?.addNode(n.id, {
        label: '',
        x: nx,
        y: ny,
        size: SIGMA_BASE_NODE_SIZE,
        group: n.group ?? 0,
        color: getNodeColor(n.group ?? 0, isLight)
      });
    });

    edges.forEach(e => {
      this.graph?.addEdge(e.source, e.target, {
        size: styleTokens.edgeWidth,
        color: styleTokens.edgeColor
      });
    });

    // Pre-solve initial ForceAtlas2 layout so initial render is immediately organic
    forceAtlas2.assign(this.graph, {
      iterations: 100,
      settings: {
        gravity: 0.8
      }
    });

    const tokens = getThemeTokens(isLight);
    this.sigma = new Sigma(this.graph, container, {
      defaultNodeColor: tokens.nodeDefault,
      defaultEdgeColor: styleTokens.edgeColor,
      renderLabels: false,
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
    let dragStartViewport = { x: 0, y: 0 };
    let wasDragged = false;

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
            slowDown: 6
          }
        });

        this.graph.setNodeAttribute(draggedNode, 'x', pinnedX);
        this.graph.setNodeAttribute(draggedNode, 'y', pinnedY);
        this.sigma.refresh();

        this.physicsFrameId = requestAnimationFrame(stepPhysics);
      };
      this.physicsFrameId = requestAnimationFrame(stepPhysics);
    };

    this.sigma.on('downNode', (e) => {
      draggedNode = e.node;
      dragStartViewport = { x: e.event.x, y: e.event.y };
      wasDragged = false;
      this.tooltipController?.hide();

      if (this.sigma && !this.sigma.getCustomBBox()) {
        this.sigma.setCustomBBox(this.sigma.getBBox());
      }
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      if (this.currentLayout === 'force') {
        startForcePhysicsLoop();
      } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
        const { signature } = this.computeLayoutTargets(this.currentLayout, true);
        this.lastOrderSignature = signature;
      }
    });

    this.sigma.getMouseCaptor().on('mousemovebody', (e) => {
      if (!draggedNode || !this.sigma || !this.graph) return;
      e.preventSigmaDefault();
      e.original.preventDefault();
      e.original.stopPropagation();

      if (Math.hypot(e.x - dragStartViewport.x, e.y - dragStartViewport.y) > 4) {
        wasDragged = true;
        this.lastDraggedAt = performance.now();
        this.tooltipController?.hide();
      }

      const pos = this.sigma.viewportToGraph(e);
      this.graph.setNodeAttribute(draggedNode, 'x', pos.x);
      this.graph.setNodeAttribute(draggedNode, 'y', pos.y);

      if (this.currentLayout === 'force') {
        startForcePhysicsLoop();
      } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
        const { targets, signature } = this.computeLayoutTargets(this.currentLayout, true);
        if (signature !== this.lastOrderSignature) {
          this.lastOrderSignature = signature;
          this.animateTo(targets, 250, draggedNode, false);
        } else {
          this.sigma.refresh();
        }
      }
    });

    this.sigma.getMouseCaptor().on('mouseup', () => {
      if (!draggedNode) return;
      draggedNode = null;
      if (this.physicsFrameId) {
        cancelAnimationFrame(this.physicsFrameId);
        this.physicsFrameId = null;
      }

      if (wasDragged) {
        this.lastDraggedAt = performance.now();
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
              slowDown: 3
            }
          });

          this.graph.forEachNode(node => {
            targets[node] = {
              x: this.graph?.getNodeAttribute(node, 'x') as number,
              y: this.graph?.getNodeAttribute(node, 'y') as number
            };
            this.graph?.setNodeAttribute(node, 'x', startingPos[node].x);
            this.graph?.setNodeAttribute(node, 'y', startingPos[node].y);
          });

          this.sigma?.setCustomBBox(null);
          this.animateTo(targets, 400, undefined, true);
        } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          const { targets } = this.computeLayoutTargets(this.currentLayout, true);
          this.sigma?.setCustomBBox(null);
          this.animateTo(targets, 400, undefined, true);
        }
      } else {
        this.sigma?.setCustomBBox(null);
      }
    });

    this.sigma.on('clickNode', ({ node }: { node: string }) => {
      if (wasDragged || (this.lastDraggedAt && performance.now() - this.lastDraggedAt < 250)) {
        return;
      }
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
      if (draggedNode !== null) return;
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

        const currentTokens = getGraphStyleTokens(currentIsLight);
        const connectedEdges = new Set(this.graph.edges(node));

        this.graph.forEachNode(nId => {
          this.graph?.setNodeAttribute(
            nId,
            'size',
            nId === node ? SIGMA_BASE_NODE_SIZE * currentTokens.nodeHoverScale : SIGMA_BASE_NODE_SIZE
          );
        });

        this.graph.forEachEdge(edge => {
          const isConnected = connectedEdges.has(edge);
          this.graph?.setEdgeAttribute(edge, 'color', isConnected ? currentTokens.edgeHoverColor : currentTokens.edgeColor);
          this.graph?.setEdgeAttribute(edge, 'size', isConnected ? currentTokens.edgeHoverWidth : currentTokens.edgeWidth);
        });
        this.sigma.refresh();
      }
    });

    this.sigma.on('leaveNode', () => {
      hoveredNodeId = null;
      if (draggedNode === null) {
        container.style.cursor = 'default';
      }
      this.tooltipController?.hide();

      if (this.graph && this.sigma) {
        const currentIsLight = Boolean(this.isLight);
        const currentTokens = getGraphStyleTokens(currentIsLight);
        this.graph.forEachNode(nId => {
          this.graph?.setNodeAttribute(nId, 'size', SIGMA_BASE_NODE_SIZE);
        });
        this.graph.forEachEdge(edge => {
          this.graph?.setEdgeAttribute(edge, 'color', currentTokens.edgeColor);
          this.graph?.setEdgeAttribute(edge, 'size', currentTokens.edgeWidth);
        });
        this.sigma.refresh();
      }
    });

    this.mouseMoveHandler = (e: MouseEvent) => {
      if (hoveredNodeId && draggedNode === null) {
        const rect = container.getBoundingClientRect();
        this.tooltipController?.move(e.clientX - rect.left, e.clientY - rect.top);
      }
    };
    container.addEventListener('mousemove', this.mouseMoveHandler);

    this.isLight = isLight;
    if (layout === 'force') {
      this.currentLayout = 'force';
      this.sigma.refresh();
    } else {
      this.updateLayout(layout, isLight);
    }
    
    // Zoom to fit the graph
    setTimeout(() => {
      if (this.sigma) {
        this.sigma.setCustomBBox(null);
        this.sigma.getCamera().animatedReset();
      }
    }, 100);

    // Bind ResizeObserver to handle container size changes dynamically
    let lastWidth = container.clientWidth;
    let lastHeight = container.clientHeight;
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (Math.abs(width - lastWidth) >= 2 || Math.abs(height - lastHeight) >= 2) {
          lastWidth = width;
          lastHeight = height;
          if (this.sigma) {
            this.sigma.setCustomBBox(null);
            this.sigma.refresh();
            this.sigma.getCamera().animatedReset();
          }
        }
      }
    });
    this.resizeObserver.observe(container);

    return this;
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

    // Apply color update to nodes and edges based on theme
    const tokens = getThemeTokens(isLight);
    const styleTokens = getGraphStyleTokens(isLight);

    this.graph.forEachEdge(edge => {
      this.graph?.setEdgeAttribute(edge, 'color', styleTokens.edgeColor);
      this.graph?.setEdgeAttribute(edge, 'size', styleTokens.edgeWidth);
    });

    this.graph.forEachNode(node => {
      const grp = (this.graph?.getNodeAttribute(node, 'group') as number | undefined) ?? 0;
      this.graph?.setNodeAttribute(node, 'color', getNodeColor(grp, isLight));
    });

    this.sigma.setSetting('labelColor', { color: tokens.textHeading });
    this.sigma.setSetting('defaultEdgeColor', styleTokens.edgeColor);

    if (!layoutChanged) {
      this.sigma.refresh();
      return;
    }

    if (layout === 'radial' || layout === 'columns') {
      const { targets, signature } = this.computeLayoutTargets(layout, false);
      this.lastOrderSignature = signature;
      this.animateTo(targets, 600, undefined, true);
    } else {
      // default: force directed
      const targets: Record<string, { x: number; y: number }> = {};
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
          this.sigma.setCustomBBox(null);
          this.sigma.getCamera().animatedReset({ duration: 400 });
        }
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  },

  destroy() {
    if (this.physicsFrameId) {
      cancelAnimationFrame(this.physicsFrameId);
      this.physicsFrameId = null;
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
