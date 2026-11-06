import cytoscape, { type Core, type NodeSingular, type EdgeSingular } from 'cytoscape';
import * as d3 from 'd3';
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
  getNodeHopZIndex,
  getEdgeHopZIndex
} from '@commons/shared/graph-payload';
import { createGraphTooltipController, type GraphTooltipController, type RawGraphNode } from '@commons/client/vis-tooltip';

interface CySimNode extends d3.SimulationNodeDatum {
  id: string;
  group: number;
}

interface CySimLink extends d3.SimulationLinkDatum<CySimNode> {
  source: string | CySimNode;
  target: string | CySimNode;
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
  hoveredNodeId?: string | null;
  highlightFrameId?: number | null;
  applyHighlight?(activeId: string | null, immediate?: boolean): void;
  currentLayout?: string;
  isLight?: boolean;
  initialized?: boolean;
  lastDraggedAt?: number;
  lastOrderSignature?: string;
  forcePositions?: Record<string, { x: number; y: number }> | null;
  dragSimulation?: d3.Simulation<CySimNode, CySimLink> | null;
  physicsFrameId?: number | null;
  animationFrameId?: number | null;
  resizeObserver: ResizeObserver | null;
  init(container: HTMLElement, payload: { cytoscape: { elements: cytoscape.ElementsDefinition } }, layout: string, isLight: boolean, extraOptions?: Record<string, string>): Promise<CytoscapeEngine>;
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
  forcePositions: null,
  dragSimulation: null,
  physicsFrameId: null,
  animationFrameId: null,
  resizeObserver: null,

  async init(container: HTMLElement, payload: { cytoscape: { elements: cytoscape.ElementsDefinition } }, layout: string, isLight: boolean, extraOptions: Record<string, string> = {}) {
    const styleTokens = getGraphStyleTokens(isLight);
    const baseDiameter = styleTokens.nodeRadius * 2;

    this.initialized = false;
    this.isLight = isLight;
    this.hoveredNodeId = null;
    this.lastDraggedAt = 0;
    this.lastOrderSignature = '';
    this.forcePositions = null;

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
      layout: { name: 'null' }
    });

    const rawEdges: { source: string; target: string }[] = [];
    this.cy.edges().forEach((e: EdgeSingular) => {
      rawEdges.push({ source: e.source().id(), target: e.target().id() });
    });
    const adjacency = buildGraphAdjacency(rawEdges);
    let lastHighlightedNodeId: string | null = null;

    const applyHighlight = (activeId: string | null, immediate = false) => {
      if (!this.cy) return;
      if (!immediate && activeId === lastHighlightedNodeId) return;
      lastHighlightedNodeId = activeId;

      if (this.highlightFrameId) {
        cancelAnimationFrame(this.highlightFrameId);
        this.highlightFrameId = null;
      }

      const currentIsLight = Boolean(this.isLight);
      const currentTokens = getGraphStyleTokens(currentIsLight);
      const currentBaseDiameter = currentTokens.nodeRadius * 2;
      const dists = activeId ? computeHopDistances(activeId, adjacency) : null;

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
        const targetColor = dists
          ? getAttenuatedNodeColor(baseColor, hopDist, currentIsLight)
          : baseColor;
        const targetSize = dists
          ? currentBaseDiameter * getAttenuatedNodeScale(hopDist)
          : currentBaseDiameter;
        const targetZIndex = dists ? getNodeHopZIndex(hopDist) : 10;
        nodeTrans.push({ node: n, startColor, targetColor, startSize, targetSize, targetZIndex });
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

      if (dists) {
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
    const simNodes: CySimNode[] = [];
    const simNodeMap = new Map<string, CySimNode>();
    let initSumX = 0;
    let initSumY = 0;
    let initCount = 0;

    this.cy.nodes().forEach((n: NodeSingular) => {
      const pos = n.position();
      solvedForce[n.id()] = { x: pos.x, y: pos.y };
      initSumX += pos.x;
      initSumY += pos.y;
      initCount++;
      const sn: CySimNode = {
        id: n.id(),
        group: Number(n.data('group') ?? 0),
        x: pos.x,
        y: pos.y
      };
      simNodes.push(sn);
      simNodeMap.set(sn.id, sn);
    });
    this.forcePositions = solvedForce;
    const initCx = initSumX / Math.max(1, initCount);
    const initCy = initSumY / Math.max(1, initCount);

    const simLinks: CySimLink[] = [];
    this.cy.edges().forEach((e: EdgeSingular) => {
      const src = e.source().id();
      const tgt = e.target().id();
      if (simNodeMap.has(src) && simNodeMap.has(tgt)) {
        simLinks.push({ source: src, target: tgt });
      }
    });

    this.dragSimulation = d3.forceSimulation<CySimNode, CySimLink>(simNodes)
      .force('link', d3.forceLink<CySimNode, CySimLink>(simLinks).id(d => d.id).distance(95).strength(0.28))
      .force('charge', d3.forceManyBody<CySimNode>().strength(-220))
      .force('collide', d3.forceCollide<CySimNode>(22).strength(0.8))
      .stop();

    let grabbedNodeId: string | null = null;
    let settleFramesRemaining = 0;

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
            if (this.forcePositions) {
              this.forcePositions[sn.id] = { x: nx, y: ny };
            }
          }
        });

        if (grabbedNodeId !== null || settleFramesRemaining > 0) {
          if (grabbedNodeId === null) settleFramesRemaining--;
          this.physicsFrameId = requestAnimationFrame(stepPhysics);
        } else {
          this.physicsFrameId = null;
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

        const modelPos = renderedToModel(sx, sy);
        this.cy.getElementById(grabbedNodeId).position(modelPos);

        if (this.currentLayout === 'force' && this.dragSimulation) {
          const allNodes = this.cy.nodes();
          allNodes.forEach((n: NodeSingular) => {
            const p = n.position();
            const sn = simNodeMap.get(n.id());
            if (sn) {
              sn.x = p.x;
              sn.y = p.y;
              sn.vx = 0;
              sn.vy = 0;
              sn.fx = n.id() === grabbedNodeId ? p.x : null;
              sn.fy = n.id() === grabbedNodeId ? p.y : null;
            }
          });
          this.dragSimulation
            .force('center', null)
            .force('x', d3.forceX<CySimNode>(initCx).strength(0.06))
            .force('y', d3.forceY<CySimNode>(initCy).strength(0.06))
            .alphaTarget(0.3)
            .alpha(0.35);
          startForcePhysicsLoop();
        } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
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
          }
          if (this.forcePositions) {
            this.forcePositions[rawNode.id] = { x: pos.x, y: pos.y };
          }
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
        grabbedNodeId = null;
        this.hoveredNodeId = null;
        this.lastDraggedAt = performance.now();
        applyHighlight(null);

        if (this.currentLayout === 'force' && this.dragSimulation) {
          const sn = simNodeMap.get(rawNode.id);
          if (sn) {
            sn.x = pos.x;
            sn.y = pos.y;
            sn.fx = null;
            sn.fy = null;
          }
          if (this.forcePositions) {
            this.forcePositions[rawNode.id] = { x: pos.x, y: pos.y };
          }
          this.dragSimulation
            .force('center', d3.forceCenter<CySimNode>(initCx, initCy).strength(0.12))
            .force('x', d3.forceX<CySimNode>(initCx).strength(0.08))
            .force('y', d3.forceY<CySimNode>(initCy).strength(0.08))
            .alphaTarget(0)
            .alpha(0.35);
          settleFramesRemaining = 45;
          startForcePhysicsLoop();
        } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          const targets = this.computeLayoutTargets(this.currentLayout, true);
          this.animateTo(targets, 400, undefined, false, false);
        }
      }
    });

    this.currentLayout = layout;
    this.isLight = isLight;

    if (layout !== 'force') {
      const initialTargets = this.computeLayoutTargets(layout, false);
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

  animateTo(targets: Record<string, { x: number; y: number }>, duration = 600, excludeNodeId?: string, fitOnStep = true, animateFitAfter = false) {
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
        this.cy.fit(undefined, 30);
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

    if (layoutChanged && this.physicsFrameId) {
      cancelAnimationFrame(this.physicsFrameId);
      this.physicsFrameId = null;
    }

    // Apply color update to nodes and edges based on theme (and preserve any active highlight)
    this.applyHighlight?.(this.hoveredNodeId ?? null, true);

    if (!this.initialized || layoutChanged || forceRecompute) {
      const targets = this.computeLayoutTargets(layout, false);
      this.animateTo(targets, 600, undefined, true);
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
    if (this.cy) {
      this.cy.destroy();
      this.cy = null;
    }
    this.forcePositions = null;
  }
};

export default engine;
