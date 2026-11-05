import cytoscape, { type Core, type NodeSingular, type EventObjectNode } from 'cytoscape';
import { GRAPH_COLORS, getGraphStyleTokens } from '@commons/shared/graph-payload';
import { createGraphTooltipController, type GraphTooltipController } from '@commons/client/vis-tooltip';

function getNodeColor(node: NodeSingular, isLight: boolean): string {
  const grp = node.data('group') ?? 0;
  const colors = isLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;
  return colors[grp] || colors[0];
}

export interface CytoscapeEngine {
  layouts: { id: string; label: string }[];
  cy: Core | null;
  tooltipController: GraphTooltipController | null;
  currentLayout?: string;
  isLight?: boolean;
  initialized?: boolean;
  forcePositions?: Record<string, { x: number; y: number }> | null;
  animationFrameId?: number | null;
  resizeObserver: ResizeObserver | null;
  init(container: HTMLElement, payload: { cytoscape: { elements: cytoscape.ElementsDefinition } }, layout: string, isLight: boolean, extraOptions?: Record<string, string>): Promise<CytoscapeEngine>;
  computeLayoutTargets(layout: string): Record<string, { x: number; y: number }>;
  animateTo(targets: Record<string, { x: number; y: number }>, duration?: number): void;
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
  forcePositions: null,
  animationFrameId: null,
  resizeObserver: null,

  async init(container: HTMLElement, payload: { cytoscape: { elements: cytoscape.ElementsDefinition } }, layout: string, isLight: boolean, extraOptions: Record<string, string> = {}) {
    const styleTokens = getGraphStyleTokens(isLight);
    const baseDiameter = styleTokens.nodeRadius * 2;
    const hoverDiameter = baseDiameter * styleTokens.nodeHoverScale;

    this.initialized = false;
    this.forcePositions = null;

    this.cy = cytoscape({
      container: container,
      userZoomingEnabled: false,
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
        },
        {
          selector: 'node:selected',
          style: {
            'width': hoverDiameter,
            'height': hoverDiameter,
            'border-width': '1.5px',
            'border-color': (node: NodeSingular) => getNodeColor(node, isLight)
          }
        },
        {
          selector: 'node.hovered',
          style: {
            'width': hoverDiameter,
            'height': hoverDiameter,
            'border-width': '1.5px',
            'border-color': (node: NodeSingular) => getNodeColor(node, isLight)
          }
        },
        {
          selector: 'edge.hovered-edge',
          style: {
            'width': styleTokens.edgeHoverWidth,
            'line-color': styleTokens.edgeHoverColor
          }
        }
      ],
      layout: { name: 'null' }
    });

    this.tooltipController = createGraphTooltipController(container);

    const utmSource = String(extraOptions.utmSource || 'visualizations_demo');
    const utmMedium = String(extraOptions.utmMedium || 'cytoscape');
    const utmCampaign = String(extraOptions.utmCampaign || 'interactive_visualization');

    this.cy.on('tap', 'node', function(evt) {
      const node = evt.target;
      const id = node.id();
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
    });

    const getCoords = (evt: EventObjectNode) => {
      if (evt.originalEvent) {
        const rect = container.getBoundingClientRect();
        return {
          x: evt.originalEvent.clientX - rect.left,
          y: evt.originalEvent.clientY - rect.top
        };
      }
      return {
        x: evt.renderedPosition?.x ?? 0,
        y: evt.renderedPosition?.y ?? 0
      };
    };

    this.cy.on('mouseover', 'node', (evt: EventObjectNode) => {
      container.style.cursor = 'pointer';
      const node = evt.target;
      node.addClass('hovered');
      node.connectedEdges().addClass('hovered-edge');

      const data = node.data();
      const coords = getCoords(evt);
      this.tooltipController?.show(
        {
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
        Boolean(this.isLight),
        coords.x,
        coords.y
      );
    });

    this.cy.on('mousemove', 'node', (evt: EventObjectNode) => {
      const coords = getCoords(evt);
      this.tooltipController?.move(coords.x, coords.y);
    });

    this.cy.on('mouseout', 'node', (evt: EventObjectNode) => {
      container.style.cursor = 'default';
      const node = evt.target;
      node.removeClass('hovered');
      node.connectedEdges().removeClass('hovered-edge');
      this.tooltipController?.hide();
    });

    // Solve initial force layout synchronously and cache positions
    this.cy.layout({
      name: 'cose',
      animate: false,
      fit: true,
      padding: 30,
      randomize: true,
      idealEdgeLength: () => 100,
      nodeOverlap: 20,
      componentSpacing: 100,
      nodeRepulsion: () => 400000,
      edgeElasticity: () => 100,
      nestingFactor: 5,
      gravity: 80,
      numIter: 1000
    } as cytoscape.CoseLayoutOptions).run();

    const solvedForce: Record<string, { x: number; y: number }> = {};
    this.cy.nodes().forEach((n: NodeSingular) => {
      const pos = n.position();
      solvedForce[n.id()] = { x: pos.x, y: pos.y };
    });
    this.forcePositions = solvedForce;

    this.currentLayout = layout;
    this.isLight = isLight;

    if (layout !== 'force') {
      const initialTargets = this.computeLayoutTargets(layout);
      this.cy.batch(() => {
        this.cy?.nodes().forEach((n: NodeSingular) => {
          const t = initialTargets[n.id()];
          if (t) n.position(t);
        });
      });
      this.cy.fit(undefined, 30);
    }

    this.initialized = true;

    // Bind ResizeObserver to handle container size changes dynamically with dimension threshold
    let lastWidth = container.clientWidth;
    let lastHeight = container.clientHeight;
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (Math.abs(width - lastWidth) >= 2 || Math.abs(height - lastHeight) >= 2) {
          lastWidth = width;
          lastHeight = height;
          if (this.cy) {
            this.cy.resize();
            if (this.currentLayout === 'columns' && this.isLight !== undefined) {
              this.updateLayout(this.currentLayout, this.isLight, true);
            } else {
              this.cy.fit(undefined, 30);
            }
          }
        }
      }
    });
    this.resizeObserver.observe(container);

    return this;
  },

  computeLayoutTargets(layout: string): Record<string, { x: number; y: number }> {
    const targets: Record<string, { x: number; y: number }> = {};
    if (!this.cy) return targets;

    if (layout === 'radial') {
      const startingPos: Record<string, { x: number; y: number }> = {};
      this.cy.nodes().forEach((n: NodeSingular) => {
        const p = n.position();
        startingPos[n.id()] = { x: p.x, y: p.y };
      });

      this.cy.batch(() => {
        this.cy?.layout({
          name: 'concentric',
          animate: false,
          fit: false,
          concentric: function(node: NodeSingular) {
            return node.data('group') === 0 ? 2 : 1;
          },
          levelWidth: function() { return 1; }
        } as cytoscape.ConcentricLayoutOptions).run();

        this.cy?.nodes().forEach((n: NodeSingular) => {
          const p = n.position();
          targets[n.id()] = { x: p.x, y: p.y };
          const s = startingPos[n.id()];
          if (s) n.position(s);
        });
      });
      return targets;
    }

    if (layout === 'columns') {
      const width = this.cy.width() || 800;
      const height = this.cy.height() || 500;
      const nodes = this.cy.nodes();

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
    if (this.forcePositions) {
      return this.forcePositions;
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
        const s = startingPos[n.id()];
        if (s) n.position(s);
      });
    });

    this.forcePositions = targets;
    return targets;
  },

  animateTo(targets: Record<string, { x: number; y: number }>, duration = 600) {
    if (!this.cy) return;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
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

      this.cy.fit(undefined, 30);

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  },

  updateLayout(layout: string, isLight: boolean, forceRecompute = false) {
    if (!this.cy) return;
    const layoutChanged = this.currentLayout !== layout;
    this.currentLayout = layout;
    this.isLight = isLight;

    // Apply color update to nodes and edges based on theme
    const styleTokens = getGraphStyleTokens(isLight);
    const baseDiameter = styleTokens.nodeRadius * 2;
    const hoverDiameter = baseDiameter * styleTokens.nodeHoverScale;
    this.cy.style()
      .selector('node').style({
        'width': baseDiameter,
        'height': baseDiameter,
        'border-width': '1.5px',
        'border-color': (node: NodeSingular) => getNodeColor(node, isLight),
        'background-color': (node: NodeSingular) => getNodeColor(node, isLight)
      })
      .selector('node:selected').style({
        'width': hoverDiameter,
        'height': hoverDiameter,
        'border-width': '1.5px',
        'border-color': (node: NodeSingular) => getNodeColor(node, isLight)
      })
      .selector('node.hovered').style({
        'width': hoverDiameter,
        'height': hoverDiameter,
        'border-width': '1.5px',
        'border-color': (node: NodeSingular) => getNodeColor(node, isLight)
      })
      .selector('edge').style({
        'width': styleTokens.edgeWidth,
        'line-color': styleTokens.edgeColor
      })
      .selector('edge.hovered-edge').style({
        'width': styleTokens.edgeHoverWidth,
        'line-color': styleTokens.edgeHoverColor
      })
      .update();

    if (!this.initialized || layoutChanged || forceRecompute) {
      const targets = this.computeLayoutTargets(layout);
      this.animateTo(targets);
    }
  },

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.tooltipController) {
      this.tooltipController.destroy();
      this.tooltipController = null;
    }
    if (this.cy) {
      this.cy.destroy();
      this.cy = null;
    }
    this.forcePositions = null;
  }
};

export default engine;
