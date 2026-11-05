import { Network, type Options, type Node as VisNode, type Edge as VisEdge } from 'vis-network';
import { DataSet } from 'vis-data';
import {
  GRAPH_COLORS,
  GRAPH_GROUP_NAMES,
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
import { getThemeTokens } from '@commons/shared/domain-themes';
import { renderVisNetworkTooltip } from '@commons/client/vis-tooltip';

interface VisNetworkWithBody extends Network {
  body?: {
    nodeIndices?: (string | number)[];
    edgeIndices?: (string | number)[];
  };
}

function getVisNodeColors(isLight: boolean) {
  const palette = GRAPH_COLORS[isLight ? 'light' : 'dark'];
  return palette.map((color) => ({
    background: color,
    border: color,
    highlight: { background: color, border: color },
    hover: { background: color, border: color }
  }));
}

export interface VisPayloadNode {
  id: string;
  name: string;
  size: number;
  group: number;
  image?: string;
  tags?: string[];
  date?: string;
  typeLabel?: string;
  description?: string;
}

export interface VisPayloadConnection {
  sourceId: string;
  targetId: string;
}

export interface VisNetworkPayload {
  'vis-network': {
    nodes: VisPayloadNode[];
    connections: VisPayloadConnection[];
  };
}

export interface VisCustomNode extends VisNode {
  rawGroup?: number;
  displayColor?: string;
  displaySize?: number;
}

export interface VisCustomEdge extends VisEdge {
  displayColor?: string;
  displayWidth?: number;
}

export interface VisNetworkExtraOptions extends Options {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface VisNetworkEngine {
  layouts: { id: string; label: string }[];
  nodes?: VisPayloadNode[];
  connections?: VisPayloadConnection[];
  visNodes?: DataSet<VisCustomNode> | null;
  visEdges?: DataSet<VisCustomEdge> | null;
  options?: Options;
  network?: Network | null;
  isDragging?: boolean;
  hoveredNodeId?: string | null;
  draggedNodeId?: string | null;
  highlightFrameId?: number | null;
  lastDraggedAt?: number;
  lastOrderSignature?: string;
  dragStabilizeTimeout?: ReturnType<typeof setTimeout> | null;
  currentLayout?: string;
  isLight?: boolean;
  resizeObserver?: ResizeObserver | null;
  intersectionObserver?: IntersectionObserver | null;
  animationFrameId?: number | null;
  applyHighlight?(activeId: string | null, immediate?: boolean): void;
  init(container: HTMLElement, payload: VisNetworkPayload, layout: string, isLight: boolean, extraOptions?: VisNetworkExtraOptions): Promise<VisNetworkEngine>;
  computeLayoutTargets(layout: string, useCurrentOrder?: boolean): { targets: Record<string, { x: number; y: number }>; signature: string };
  updateLayout(layout: string, isLight: boolean): void;
  pause(): void;
  resume(): void;
  animateTo(targets: Record<string, { x: number; y: number }>, duration?: number, excludeNodeId?: string, fitAfter?: boolean): void;
  destroy(): void;
}

const engine: VisNetworkEngine = {
  layouts: [
    { id: 'force', label: 'Force Directed (Organic)' },
    { id: 'radial', label: 'Concentric Rings (Tags → Items)' },
    { id: 'columns', label: 'Structured Columns (Category)' }
  ],

  async init(container: HTMLElement, payload: VisNetworkPayload, layout: string, isLight: boolean, extraOptions: VisNetworkExtraOptions = {}) {
    this.nodes = payload['vis-network'].nodes;
    this.connections = payload['vis-network'].connections;

    const colors = getVisNodeColors(isLight);
    const themeTokens = getThemeTokens(isLight);
    const styleTokens = getGraphStyleTokens(isLight);
    const groupNames = GRAPH_GROUP_NAMES;
    const groupColors = GRAPH_COLORS[isLight ? 'light' : 'dark'];

    // Initialize with randomized coordinates. Avoid Vis.js native group styling issues by omitting group
    // property and explicitly defining color object on each node.
    this.visNodes = new DataSet<VisCustomNode>((this.nodes || []).map((n) => {
      const card = document.createElement('div');
      card.style.fontFamily = 'Outfit, Inter, sans-serif';
      card.style.width = '250px';
      card.style.maxWidth = '270px';
      card.style.boxSizing = 'border-box';
      card.style.whiteSpace = 'normal';
      card.style.overflowWrap = 'break-word';
      card.style.wordBreak = 'break-word';
      
      renderVisNetworkTooltip(card, {
        node: n,
        typeLabel: n.typeLabel || groupNames[n.group] || 'Item',
        accentColor: groupColors[n.group] || themeTokens.nodeDefault,
        tagColor: groupColors[0],
        themeTokens,
      });

      return {
        id: n.id,
        label: '',
        title: card,
        shape: 'dot',
        size: styleTokens.nodeRadius,
        displaySize: styleTokens.nodeRadius,
        displayColor: groupColors[n.group] || groupColors[0],
        x: (Math.random() - 0.5) * 500,
        y: (Math.random() - 0.5) * 500,
        rawGroup: n.group,
        color: colors[n.group],
        chosen: false
      };
    }));

    this.visEdges = new DataSet<VisCustomEdge>((this.connections || []).map((c, idx) => ({
      id: `${c.sourceId}-${c.targetId}-${idx}`,
      from: c.sourceId,
      to: c.targetId,
      width: styleTokens.edgeWidth,
      hoverWidth: styleTokens.edgeWidth,
      displayWidth: styleTokens.edgeWidth,
      displayColor: styleTokens.edgeColor,
      chosen: false,
      color: {
        color: styleTokens.edgeColor,
        highlight: styleTokens.edgeColor,
        hover: styleTokens.edgeColor
      }
    })));

    const data = {
      nodes: this.visNodes || undefined,
      edges: this.visEdges || undefined
    };

    const extraInteraction = extraOptions.interaction || {};
    const interactionOptions = Object.assign({
      hover: true,
      hoverConnectedEdges: false,
      tooltipDelay: 100,
      zoomView: false,
      dragView: false,
      dragNodes: true
    }, extraInteraction);

    const utmSource = String(extraOptions.utmSource || 'vis_network');
    const utmMedium = String(extraOptions.utmMedium || 'interactive_graph');
    const utmCampaign = String(extraOptions.utmCampaign || 'knowledge_network');

    this.options = {
      nodes: {
        shape: 'dot',
        size: styleTokens.nodeRadius,
        chosen: false,
        borderWidth: 1.5,
        borderWidthSelected: 1.5
      },
      edges: {
        width: styleTokens.edgeWidth,
        hoverWidth: styleTokens.edgeWidth,
        chosen: false,
        smooth: {
          enabled: true,
          type: 'continuous',
          forceDirection: 'none',
          roundness: 0.5
        }
      },
      physics: {
        enabled: true,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -50,
          centralGravity: 0.025,
          springLength: 80,
          springConstant: 0.08,
          damping: 0.4
        },
        stabilization: {
          iterations: 100,
          updateInterval: 25
        }
      },
      interaction: interactionOptions
    };

    this.network = new Network(container, data, this.options);

    if (interactionOptions.dragView === false) {
      container.style.touchAction = 'pan-y';
      const canvasEl = container.querySelector('canvas');
      if (canvasEl) {
        canvasEl.style.touchAction = 'pan-y';
      }
      const visWrapper = container.querySelector('.vis-network') as HTMLElement | null;
      if (visWrapper) {
        visWrapper.style.touchAction = 'pan-y';
      }
    }

    await new Promise<void>((resolve) => {
      let isDone = false;
      const finish = () => {
        if (!isDone) {
          isDone = true;
          if (this.network) {
            this.network.setOptions({ physics: { enabled: false } });
            this.network.stopSimulation();
          }
          resolve();
        }
      };
      if (this.network) {
        this.network.once("stabilizationIterationsDone", finish);
        this.network.once("stabilized", finish);
      }
      setTimeout(finish, 1500);
    });

    if (interactionOptions.dragNodes) {
      this.isDragging = false;
      this.hoveredNodeId = null;
      this.draggedNodeId = null;
      this.lastDraggedAt = 0;
      this.lastOrderSignature = '';
      this.dragStabilizeTimeout = null;
    }

    const adjacency = buildGraphAdjacency(this.connections || []);
    let lastHighlightedNodeId: string | null = null;

    this.applyHighlight = (activeId: string | null, immediate = false) => {
      if (!this.visNodes || !this.visEdges) return;
      if (!immediate && activeId === lastHighlightedNodeId) return;
      lastHighlightedNodeId = activeId;

      if (this.highlightFrameId) {
        cancelAnimationFrame(this.highlightFrameId);
        this.highlightFrameId = null;
      }

      const currentIsLight = Boolean(this.isLight);
      const currentTokens = getGraphStyleTokens(currentIsLight);
      const palette = GRAPH_COLORS[currentIsLight ? 'light' : 'dark'];
      const dists = activeId ? computeHopDistances(activeId, adjacency) : null;

      const nodeTrans: {
        id: string | number;
        startColor: string;
        targetColor: string;
        startSize: number;
        targetSize: number;
      }[] = [];

      this.visNodes.forEach((node: VisCustomNode) => {
        const id = String(node.id);
        const grp = node.rawGroup ?? 0;
        const baseColor = palette[grp] || palette[0];
        const startColor = node.displayColor || baseColor;
        const startSize = node.displaySize ?? currentTokens.nodeRadius;
        const hopDist = dists ? dists.get(id) : undefined;
        const targetColor = dists
          ? getAttenuatedNodeColor(baseColor, hopDist, currentIsLight)
          : baseColor;
        const targetSize = dists
          ? currentTokens.nodeRadius * getAttenuatedNodeScale(hopDist)
          : currentTokens.nodeRadius;
        nodeTrans.push({
          id: node.id!,
          startColor,
          targetColor,
          startSize,
          targetSize
        });
      });

      const edgeTrans: {
        id: string | number;
        startColor: string;
        targetColor: string;
        startWidth: number;
        targetWidth: number;
      }[] = [];
      const edgeZMap = new Map<string, number>();

      this.visEdges.forEach((edge: VisCustomEdge) => {
        const edgeId = String(edge.id);
        const dSrc = dists ? dists.get(String(edge.from)) : undefined;
        const dTgt = dists ? dists.get(String(edge.to)) : undefined;
        const startColor = edge.displayColor || currentTokens.edgeColor;
        const startWidth = edge.displayWidth ?? currentTokens.edgeWidth;
        const targetStyle = dists
          ? getAttenuatedEdgeStyle(dSrc, dTgt, currentIsLight)
          : { color: currentTokens.edgeColor, width: currentTokens.edgeWidth };
        if (dists) {
          edgeZMap.set(edgeId, getEdgeHopZIndex(dSrc, dTgt));
        }
        edgeTrans.push({
          id: edge.id!,
          startColor,
          targetColor: targetStyle.color,
          startWidth,
          targetWidth: targetStyle.width
        });
      });

      const applyZOrder = () => {
        if (!dists) return;
        const internalBody = (this.network as VisNetworkWithBody | null | undefined)?.body;
        if (internalBody?.edgeIndices) {
          internalBody.edgeIndices.sort(
            (a, b) => (edgeZMap.get(String(a)) ?? 1) - (edgeZMap.get(String(b)) ?? 1)
          );
        }
        if (internalBody?.nodeIndices) {
          internalBody.nodeIndices.sort(
            (a, b) => getNodeHopZIndex(dists.get(String(a))) - getNodeHopZIndex(dists.get(String(b)))
          );
        }
      };

      const renderStep = (ease: number) => {
        if (!this.visNodes || !this.visEdges) return;
        const nodeUpdates: VisCustomNode[] = nodeTrans.map((nt) => {
          const c = interpolateHexColor(nt.startColor, nt.targetColor, ease);
          const s = nt.startSize + (nt.targetSize - nt.startSize) * ease;
          return {
            id: nt.id,
            size: s,
            displaySize: s,
            displayColor: c,
            color: {
              background: c,
              border: c,
              highlight: { background: c, border: c },
              hover: { background: c, border: c }
            }
          };
        });
        this.visNodes.update(nodeUpdates);

        const edgeUpdates: VisCustomEdge[] = edgeTrans.map((et) => {
          const c = interpolateHexColor(et.startColor, et.targetColor, ease);
          const w = et.startWidth + (et.targetWidth - et.startWidth) * ease;
          return {
            id: et.id,
            width: w,
            hoverWidth: w,
            displayWidth: w,
            displayColor: c,
            color: {
              color: c,
              highlight: c,
              hover: c
            }
          };
        });
        this.visEdges.update(edgeUpdates);
        applyZOrder();
        this.network?.redraw();
      };

      if (immediate) {
        renderStep(1);
        return;
      }

      const startTime = performance.now();
      const step = (now: number) => {
        if (!this.visNodes || !this.visEdges) {
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

    if (interactionOptions.dragNodes) {
      this.network.on("dragStart", (params: { nodes: string[] }) => {
        if (!params.nodes || params.nodes.length === 0) return;
        this.isDragging = true;
        this.lastDraggedAt = performance.now();
        const draggedId = String(params.nodes[0]);
        this.draggedNodeId = draggedId;
        this.applyHighlight?.(draggedId);
        const tip = container.querySelector('.vis-tooltip') as HTMLElement | null;
        if (tip) tip.style.visibility = 'hidden';

        if (this.dragStabilizeTimeout) {
          clearTimeout(this.dragStabilizeTimeout);
          this.dragStabilizeTimeout = null;
        }
        if (this.animationFrameId) {
          cancelAnimationFrame(this.animationFrameId);
          this.animationFrameId = null;
        }

        if (this.currentLayout === 'force') {
          this.network?.setOptions({
            physics: {
              enabled: true,
              stabilization: { enabled: false }
            }
          });
          this.network?.startSimulation();
        } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          const { signature } = this.computeLayoutTargets(this.currentLayout, true);
          this.lastOrderSignature = signature;
        }
      });

      this.network.on("dragging", (params: { nodes: string[] }) => {
        if (!params.nodes || params.nodes.length === 0) return;
        this.lastDraggedAt = performance.now();
        const draggedId = String(params.nodes[0]);
        if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          const { targets, signature } = this.computeLayoutTargets(this.currentLayout, true);
          if (signature !== this.lastOrderSignature) {
            this.lastOrderSignature = signature;
            this.animateTo(targets, 250, draggedId);
          }
        }
      });

      this.network.on("dragEnd", (params: { nodes: string[] }) => {
        if (!this.isDragging && (!params.nodes || params.nodes.length === 0)) return;
        this.isDragging = false;
        this.draggedNodeId = null;
        this.hoveredNodeId = null;
        this.lastDraggedAt = performance.now();
        this.network?.unselectAll();
        container.style.cursor = "default";
        this.applyHighlight?.(null);

        if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          const { targets } = this.computeLayoutTargets(this.currentLayout, true);
          this.animateTo(targets, 400);
          return;
        }

        const stopAfterDrag = () => {
          if (this.network && !this.isDragging) {
            this.network.setOptions({ physics: { enabled: false } });
            this.network.stopSimulation();
          }
          if (this.dragStabilizeTimeout) {
            clearTimeout(this.dragStabilizeTimeout);
            this.dragStabilizeTimeout = null;
          }
        };

        this.network?.once("stabilized", stopAfterDrag);

        if (this.dragStabilizeTimeout) {
          clearTimeout(this.dragStabilizeTimeout);
        }
        this.dragStabilizeTimeout = setTimeout(stopAfterDrag, 800);
      });
    }

    this.network.on("click", (params: { nodes: string[] }) => {
      this.network?.unselectAll();
      this.applyHighlight?.(this.hoveredNodeId ?? null);
      if (this.lastDraggedAt && performance.now() - this.lastDraggedAt < 250) return;
      if (params.nodes.length > 0) {
        const targetPath = params.nodes[0];
        if (
          targetPath.startsWith('/posts') ||
          targetPath.startsWith('/publications') ||
          targetPath.startsWith('/presentations') ||
          targetPath.startsWith('/projects') ||
          targetPath.startsWith('/courses') ||
          targetPath.startsWith('/services') ||
          targetPath.startsWith('/newsletters') ||
          targetPath.startsWith('/visualizations') ||
          targetPath.startsWith('/tags')
        ) {
          const targetUrl = new URL(targetPath, window.location.origin);
          targetUrl.searchParams.set('utm_source', utmSource);
          targetUrl.searchParams.set('utm_medium', utmMedium);
          targetUrl.searchParams.set('utm_campaign', utmCampaign);
          window.location.href = targetUrl.pathname + targetUrl.search;
        }
      }
    });

    this.network.on("hoverNode", (params: { node: string | number }) => {
      this.hoveredNodeId = String(params.node);
      if (!this.isDragging) {
        container.style.cursor = "pointer";
        this.applyHighlight?.(this.hoveredNodeId);
      }
    });

    this.network.on("blurNode", () => {
      this.hoveredNodeId = null;
      if (!this.isDragging) {
        container.style.cursor = "default";
        this.applyHighlight?.(null);
      }
    });

    this.currentLayout = layout;
    this.isLight = isLight;
    if (layout !== 'force') {
      this.updateLayout(layout, isLight);
    }

    // Bind ResizeObserver to handle network container changes dynamically with dimension threshold
    let lastWidth = container.clientWidth;
    let lastHeight = container.clientHeight;
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (Math.abs(width - lastWidth) >= 2 || Math.abs(height - lastHeight) >= 2) {
          lastWidth = width;
          lastHeight = height;
          if (this.network) {
            this.network.redraw();
            this.network.fit();
          }
        }
      }
    });
    this.resizeObserver.observe(container);

    // Automatically pause physics/animation when container is scrolled out of view
    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) {
          this.pause();
        } else {
          this.resume();
        }
      });
    }, { rootMargin: '100px 0px' });
    this.intersectionObserver.observe(container);

    return this;
  },

  computeLayoutTargets(layout: string, useCurrentOrder = false) {
    const targets: Record<string, { x: number; y: number }> = {};
    let signature = '';
    const pos = useCurrentOrder && this.network ? this.network.getPositions() : {};

    if (layout === 'radial') {
      const tags = [...(this.nodes || []).filter(n => n.group === 0)];
      const others = [...(this.nodes || []).filter(n => n.group !== 0)];

      if (useCurrentOrder && this.network) {
        const normAngle = (id: string, count: number) => {
          const p = pos[id] || { x: 0, y: 0 };
          return ((Math.atan2(p.y, p.x) + Math.PI / Math.max(1, count)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        };
        tags.sort((a, b) => normAngle(a.id, tags.length) - normAngle(b.id, tags.length));
        others.sort((a, b) => normAngle(a.id, others.length) - normAngle(b.id, others.length));
      }

      tags.forEach((n, idx) => {
        const theta = (2 * Math.PI * idx) / tags.length;
        targets[n.id] = {
          x: 120 * Math.cos(theta),
          y: 120 * Math.sin(theta)
        };
      });

      others.forEach((n, idx) => {
        const theta = (2 * Math.PI * idx) / others.length;
        targets[n.id] = {
          x: 280 * Math.cos(theta),
          y: 280 * Math.sin(theta)
        };
      });

      signature = `${tags.map(n => n.id).join(',')}|${others.map(n => n.id).join(',')}`;
    } else if (layout === 'columns') {
      const tags = [...(this.nodes || []).filter(n => n.group === 0)];
      const posts = [...(this.nodes || []).filter(n => n.group === 1)];
      const publications = [...(this.nodes || []).filter(n => n.group === 2)];
      const presentations = [...(this.nodes || []).filter(n => n.group === 3)];
      const courses = [...(this.nodes || []).filter(n => n.group === 4)];
      const projects = [...(this.nodes || []).filter(n => n.group === 5)];
      const services = [...(this.nodes || []).filter(n => n.group === 6)];
      const newsletters = [...(this.nodes || []).filter(n => n.group === 7)];
      const visualizations = [...(this.nodes || []).filter(n => n.group === 8)];

      const categories = [posts, publications, presentations, tags, courses, projects, services, newsletters, visualizations];
      const isMobile = window.innerWidth < 768;
      const heightFactor = 45;
      const widthFactor = 45;

      if (useCurrentOrder && this.network) {
        categories.forEach(catNodes => {
          catNodes.sort((a, b) => {
            const pa = pos[a.id] || { x: 0, y: 0 };
            const pb = pos[b.id] || { x: 0, y: 0 };
            return isMobile ? pa.x - pb.x : pa.y - pb.y;
          });
        });
      }

      if (isMobile) {
        categories.forEach((catNodes, catIdx) => {
          const rowY = (catIdx - (categories.length - 1) / 2) * 120;
          catNodes.forEach((n, idx) => {
            targets[n.id] = {
              x: catNodes.length > 1 ? (idx - (catNodes.length - 1) / 2) * widthFactor : 0,
              y: rowY
            };
          });
        });
      } else {
        categories.forEach((catNodes, catIdx) => {
          const colX = (catIdx - (categories.length - 1) / 2) * 200;
          catNodes.forEach((n, idx) => {
            targets[n.id] = {
              x: colX,
              y: catNodes.length > 1 ? (idx - (catNodes.length - 1) / 2) * heightFactor : 0
            };
          });
        });
      }

      signature = categories.map(cat => cat.map(n => n.id).join(',')).join('|');
    }

    return { targets, signature };
  },

  updateLayout(layout: string, isLight: boolean) {
    if (!this.network || !this.visNodes || !this.visEdges) return;
    const layoutChanged = this.currentLayout !== layout;
    this.currentLayout = layout;
    this.isLight = isLight;

    // Apply color update to nodes and edges based on theme (and preserve any active highlight)
    this.applyHighlight?.(this.draggedNodeId ?? this.hoveredNodeId ?? null, true);

    if (!layoutChanged) {
      this.network.setOptions({ physics: { enabled: false } });
      this.network.stopSimulation();
      return;
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (layout === 'radial' || layout === 'columns') {
      const { targets, signature } = this.computeLayoutTargets(layout, false);
      this.lastOrderSignature = signature;
      this.animateTo(targets);
    } else {
      // default: force directed
      this.network.setOptions({
        physics: {
          enabled: true,
          stabilization: { iterations: 100, updateInterval: 25 }
        }
      });
      const stopForce = () => {
        if (this.network) {
          this.network.setOptions({ physics: { enabled: false } });
          this.network.stopSimulation();
        }
      };
      this.network.once("stabilizationIterationsDone", stopForce);
      this.network.once("stabilized", stopForce);
      setTimeout(stopForce, 1500);
    }
  },

  pause() {
    if (this.highlightFrameId) {
      cancelAnimationFrame(this.highlightFrameId);
      this.highlightFrameId = null;
    }
    if (this.dragStabilizeTimeout) {
      clearTimeout(this.dragStabilizeTimeout);
      this.dragStabilizeTimeout = null;
    }
    if (this.network) {
      this.network.setOptions({ physics: { enabled: false } });
      this.network.stopSimulation();
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  },

  resume() {
    if (this.network) {
      this.network.redraw();
    }
  },

  animateTo(targets: Record<string, { x: number; y: number }>, duration = 600, excludeNodeId?: string, fitAfter = false) {
    if (!this.network || !this.visNodes) return;
    this.network.setOptions({ physics: { enabled: false } });
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    const startTime = performance.now();
    const startPositions = this.network.getPositions();

    const step = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const ease = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const updates: (VisNode & { rawGroup?: number })[] = [];
      (this.nodes || []).forEach(n => {
        if (excludeNodeId && n.id === excludeNodeId) return;
        const start = startPositions[n.id] || { x: 0, y: 0 };
        const target = targets[n.id];
        if (target) {
          updates.push({
            id: n.id,
            x: start.x + (target.x - start.x) * ease,
            y: start.y + (target.y - start.y) * ease
          });
        }
      });

      this.visNodes?.update(updates);

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.animationFrameId = null;
        if (fitAfter && this.network) {
          this.network.fit({ animation: { duration: 350, easingFunction: 'easeInOutQuad' } });
        }
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  },

  destroy() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.pause();
    if (this.network) {
      this.network.destroy();
      this.network = null;
    }
    this.visNodes = null;
    this.visEdges = null;
  }
};

export default engine;
