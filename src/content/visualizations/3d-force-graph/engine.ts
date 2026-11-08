import ForceGraph3D from '3d-force-graph';
import {
  GRAPH_COLORS,
  GRAPH_VIEWPORT_CONFIG,
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

import { createGraphTooltipController, type GraphTooltipController, type RawGraphNode } from '@commons/client/vis-tooltip';

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

export interface Force3DVec3 {
  x: number;
  y: number;
  z: number;
  set?: (x: number, y: number, z: number) => void;
}

export interface Force3DCamera {
  position: Force3DVec3;
  up?: Force3DVec3;
  fov?: number;
  aspect?: number;
  projectionMatrix?: { elements?: ArrayLike<number> };
  lookAt?: (x: number, y: number, z: number) => void;
  updateProjectionMatrix?: () => void;
}

export interface Force3DNavigationControls {
  enabled?: boolean;
  noZoom?: boolean;
  enableZoom?: boolean;
  target?: Force3DVec3;
  update?: () => void;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
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
  forcePositions: Map<string, { x: number; y: number; z: number }>;
  recenterTimeout?: ReturnType<typeof setTimeout> | null;
  resizeObserver: ResizeObserver | null;
  initialized: boolean;
  animationFrameId: number | null;
  cameraAdaptFrameId: number | null;
  cameraAdaptEndTime?: number;
  cleanupControlsListeners?: (() => void) | null;
  highlightFrameId: number | null;
  applyHighlight?(immediate?: boolean): void;
  applyForces(initialLoad?: boolean): void;
  stepCameraTowardCloud(alpha: number): void;
  startCameraAdaptLoop(durationMs?: number): void;
  init(container: HTMLElement, payload: { '3d-force'?: { nodes: GraphNodePayload[]; connections: { sourceId: string; targetId: string }[] }; '3d-force-graph'?: { nodes: GraphNodePayload[]; connections: { sourceId: string; targetId: string }[] } }, layout: string, isLight: boolean, extraOptions?: Record<string, string>): Promise<Force3DEngine>;
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
  forcePositions: new Map(),
  recenterTimeout: null,
  resizeObserver: null,
  initialized: false,
  animationFrameId: null,
  cameraAdaptFrameId: null,
  cameraAdaptEndTime: 0,
  cleanupControlsListeners: null,
  highlightFrameId: null,

  async init(container: HTMLElement, payload: { '3d-force'?: { nodes: GraphNodePayload[]; connections: { sourceId: string; targetId: string }[] }; '3d-force-graph'?: { nodes: GraphNodePayload[]; connections: { sourceId: string; targetId: string }[] } }, layout: string, isLight: boolean, extraOptions: Record<string, string> = {}) {
    this.container = container;
    this.currentLayout = undefined;
    this.isLight = isLight;
    this.hoveredNodeId = null;
    this.draggedNodeId = null;
    const engineData = payload['3d-force-graph'] || payload['3d-force'] || { nodes: [], connections: [] };
    this.adjacency = buildGraphAdjacency(engineData.connections);
    this.activeDistances = null;
    this.lastOrderSignature = '';
    this.lastDraggedAt = 0;
    this.forcePositions = new Map();
    const colors = isLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;
    const initialStyleTokens = getGraphStyleTokens(isLight);
    
    // Cache nodes and connections with full rich metadata and pre-computed 3D coordinates.
    // Pin fx/fy/fz initially so tick 1 of three-forcegraph copies (x, y, z) onto __threeObj.position without perturbing equilibrium.
    this.nodes = engineData.nodes.map((n) => {
      const nx = typeof n.x === 'number' ? n.x : 0;
      const ny = typeof n.y === 'number' ? n.y : 0;
      const nz = typeof n.z === 'number' ? n.z : 0;
      this.forcePositions.set(n.id, { x: nx, y: ny, z: nz });
      return {
        ...n,
        x: nx,
        y: ny,
        z: nz,
        fx: nx,
        fy: ny,
        fz: nz,
        val: 6,
        displayVal: 6,
        color: colors[n.group] || colors[0],
        displayColor: colors[n.group] || colors[0]
      };
    });

    this.links = engineData.connections.map((c) => ({
      source: c.sourceId,
      target: c.targetId,
      displayColor: initialStyleTokens.edgeColor,
      displayWidth: initialStyleTokens.edgeWidth
    }));

    const utmSource = String(extraOptions.utmSource || 'visualizations_demo');
    const utmMedium = String(extraOptions.utmMedium || '3d-force-graph');
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

    const initialWidth = Math.floor(container.clientWidth) || 800;
    const initialHeight = Math.floor(container.clientHeight) || 500;
    this.graph = ForceGraph3D()(container)
      .width(initialWidth)
      .height(initialHeight)
      .cooldownTicks(1)
      .graphData({ nodes: this.nodes, links: this.links })
      .backgroundColor('rgba(0,0,0,0)')
      .showNavInfo(false)
      .enableNodeDrag(false)
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
      });

    // Hide any internal 3d-force-graph scene tooltip element and mount our Preact tooltip AFTER ForceGraph3D()(container)
    // so kapsule's container DOM clearing does not detach tooltipEl.
    const internalTooltip = container.querySelector<HTMLElement>('.scene-tooltip, .graph-tooltip');
    if (internalTooltip) {
      internalTooltip.style.display = 'none';
    }
    this.tooltipController = createGraphTooltipController(container);

    let dragDepth = 0;

    this.tooltipController.bindProximityInteraction({
      getScreenNodes: () => {
        if (!this.graph || !this.nodes) return [];
        const result: { node: RawGraphNode; x: number; y: number }[] = [];
        for (const n of this.nodes) {
          try {
            const sc = this.graph.graph2ScreenCoords(n.x || 0, n.y || 0, n.z || 0);
            if (sc && typeof sc.x === 'number' && typeof sc.y === 'number') {
              result.push({ node: n, x: sc.x, y: sc.y });
            }
          } catch {
            // Ignore projection errors while scene initializes
          }
        }
        return result;
      },
      adjacency: this.adjacency!,
      isLight: () => Boolean(this.isLight),
      isDragging: () => Boolean(this.draggedNodeId),
      getLastDraggedAt: () => this.lastDraggedAt || 0,
      onActiveNodeChange: (nodeId) => {
        this.hoveredNodeId = nodeId;
        if (!this.draggedNodeId) {
          refreshHighlight();
        }
      },
      onNavigate: (clicked) => {
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
      },
      onNodePointerDown: (candidate) => {
        const controls = this.graph?.controls?.() as Force3DNavigationControls | undefined;
        if (controls) {
          controls.enabled = !candidate;
        }
        if (!candidate && !this.draggedNodeId) {
          this.startCameraAdaptLoop(2400);
        }
      },
      onNodeDragStart: (rawNode, sx, sy) => {
        if (!this.graph || !this.nodes) return;
        const node = this.nodes.find(n => n.id === rawNode.id);
        if (!node) return;
        this.lastDraggedAt = performance.now();
        this.draggedNodeId = node.id;
        this.hoveredNodeId = node.id;
        refreshHighlight();

        const controls = this.graph.controls?.() as Force3DNavigationControls | undefined;
        if (controls) {
          controls.enabled = false;
        }

        if (this.recenterTimeout) {
          clearTimeout(this.recenterTimeout);
          this.recenterTimeout = null;
        }
        if (this.cameraAdaptFrameId) {
          cancelAnimationFrame(this.cameraAdaptFrameId);
          this.cameraAdaptFrameId = null;
        }
        if (this.animationFrameId) {
          cancelAnimationFrame(this.animationFrameId);
          this.animationFrameId = null;
        }

        try {
          const sc = this.graph.graph2ScreenCoords(node.x || 0, node.y || 0, node.z || 0);
          dragDepth = sc && typeof sc.z === 'number' ? sc.z : 200;
          const gc = this.graph.screen2GraphCoords(sx, sy, dragDepth);
          if (gc) {
            node.fx = gc.x;
            node.fy = gc.y;
            node.fz = gc.z;
            node.x = gc.x;
            node.y = gc.y;
            node.z = gc.z;
          }
        } catch {
          // Ignore projection error
        }

        if (this.currentLayout === 'force') {
          this.nodes.forEach(n => {
            if (n.id !== node.id) {
              n.fx = null;
              n.fy = null;
              n.fz = null;
            }
          });
          try {
            this.graph.cooldownTicks(Infinity);
            this.graph.d3ReheatSimulation();
          } catch {
            // Suppress
          }
        } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          const { signature } = this.computeLayoutTargets(this.currentLayout, true);
          this.lastOrderSignature = signature;
        }
      },
      onNodeDragMove: (rawNode, sx, sy) => {
        if (!this.graph || !this.nodes) return;
        const node = this.nodes.find(n => n.id === rawNode.id);
        if (!node) return;
        this.lastDraggedAt = performance.now();

        try {
          const gc = this.graph.screen2GraphCoords(sx, sy, dragDepth);
          if (gc) {
            node.fx = gc.x;
            node.fy = gc.y;
            node.fz = gc.z;
            node.x = gc.x;
            node.y = gc.y;
            node.z = gc.z;
          }
        } catch {
          // Ignore projection error
        }

        if (this.currentLayout === 'force') {
          try {
            this.graph.d3ReheatSimulation();
          } catch {
            // Suppress
          }
        } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          const { targets, signature } = this.computeLayoutTargets(this.currentLayout, true);
          if (signature !== this.lastOrderSignature) {
            this.lastOrderSignature = signature;
            this.animateTo(targets, 250, node.id, false);
          } else {
            try {
              this.graph.d3ReheatSimulation();
            } catch {
              // Suppress
            }
          }
        }
      },
      onNodeDragEnd: (rawNode) => {
        if (!this.graph || !this.nodes) return;
        const node = this.nodes.find(n => n.id === rawNode.id);
        this.lastDraggedAt = performance.now();
        this.draggedNodeId = null;
        this.hoveredNodeId = null;
        container.style.cursor = 'default';
        refreshHighlight();

        const controls = this.graph.controls?.() as Force3DNavigationControls | undefined;
        if (controls) {
          controls.enabled = true;
        }

        if (this.currentLayout === 'force') {
          if (node) {
            node.fx = null;
            node.fy = null;
            node.fz = null;
            this.forcePositions.set(node.id, {
              x: node.x ?? 0,
              y: node.y ?? 0,
              z: node.z ?? 0
            });
          }
          try {
            this.graph.d3ReheatSimulation();
          } catch {
            // Suppress
          }
          this.startCameraAdaptLoop(2400);
        } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
          const { targets } = this.computeLayoutTargets(this.currentLayout, true);
          this.animateTo(targets, 400, undefined, true);
        }
      }
    });

    this.applyForces(true);

    const controls = (this.graph.controls?.() as Force3DNavigationControls | undefined);
    if (controls) {
      controls.noZoom = true;
      controls.enableZoom = false;
      const onControlsRotate = () => {
        if (!this.draggedNodeId && this.initialized) {
          this.startCameraAdaptLoop(2400);
        }
      };
      controls.addEventListener?.('change', onControlsRotate);
      controls.addEventListener?.('end', onControlsRotate);
      this.cleanupControlsListeners = () => {
        controls.removeEventListener?.('change', onControlsRotate);
        controls.removeEventListener?.('end', onControlsRotate);
      };
    }

    let lastWidth = initialWidth;
    let lastHeight = initialHeight;
    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const width = Math.floor(entry.contentRect.width);
        const height = Math.floor(entry.contentRect.height);
        if (width > 0 && height > 0 && (width !== lastWidth || height !== lastHeight)) {
          lastWidth = width;
          lastHeight = height;
          if (this.graph) {
            this.graph.width(width).height(height);
            this.stepCameraTowardCloud(1);
          }
        }
      }
    });
    this.resizeObserver.observe(container);

    this.initialized = false;
    this.updateLayout(layout, isLight);
    this.initialized = true;

    this.stepCameraTowardCloud(1);
    this.startCameraAdaptLoop(500);
    requestAnimationFrame(() => {
      if (this.currentLayout === 'force' && this.nodes && !this.draggedNodeId) {
        this.nodes.forEach((n) => {
          n.fx = null;
          n.fy = null;
          n.fz = null;
        });
        try {
          this.graph?.cooldownTicks(0);
        } catch {
          // Suppress
        }
      }
      this.stepCameraTowardCloud(1);
    });

    return this;
  },

  applyForces(initialLoad = false) {
    if (!this.graph) return;
    try {
      this.graph.d3Force('charge').strength(-120);
      this.graph.cooldownTicks(initialLoad ? 1 : Infinity);
    } catch {
      // Suppress if force is not yet initialized
    }
  },

  stepCameraTowardCloud(alpha: number) {
    if (!this.graph || !this.nodes || this.nodes.length === 0) return;
    try {
      const camera = this.graph.camera?.() as Force3DCamera | undefined;
      const controls = this.graph.controls?.() as Force3DNavigationControls | undefined;
      if (!camera || !camera.position) return;

      const curTargetX = controls?.target ? controls.target.x : 0;
      const curTargetY = controls?.target ? controls.target.y : 0;
      const curTargetZ = controls?.target ? controls.target.z : 0;

      let dirX = camera.position.x - curTargetX;
      let dirY = camera.position.y - curTargetY;
      let dirZ = camera.position.z - curTargetZ;
      let curDist = Math.hypot(dirX, dirY, dirZ);
      if (curDist < 1e-3 || !Number.isFinite(curDist)) {
        dirX = 0;
        dirY = 0;
        dirZ = 1;
        curDist = 350;
      } else {
        dirX /= curDist;
        dirY /= curDist;
        dirZ /= curDist;
      }

      // Orthonormal camera basis (right, up, dir)
      let upRefX = camera.up?.x ?? 0;
      let upRefY = camera.up?.y ?? 1;
      let upRefZ = camera.up?.z ?? 0;
      if (Math.abs(dirX * upRefX + dirY * upRefY + dirZ * upRefZ) > 0.98) {
        upRefX = 0;
        upRefY = 0;
        upRefZ = 1;
      }
      // right = normalize(cross(upRef, dir))
      let rightX = upRefY * dirZ - upRefZ * dirY;
      let rightY = upRefZ * dirX - upRefX * dirZ;
      let rightZ = upRefX * dirY - upRefY * dirX;
      const rightLen = Math.hypot(rightX, rightY, rightZ) || 1;
      rightX /= rightLen;
      rightY /= rightLen;
      rightZ /= rightLen;

      // up = cross(dir, right)
      const upX = dirY * rightZ - dirZ * rightY;
      const upY = dirZ * rightX - dirX * rightZ;
      const upZ = dirX * rightY - dirY * rightX;

      let minR = Infinity;
      let maxR = -Infinity;
      let minU = Infinity;
      let maxU = -Infinity;
      let minW = Infinity;
      let maxW = -Infinity;

      const projectedNodes: { r: number; u: number; w: number; rho: number }[] = [];

      for (const n of this.nodes) {
        const nx = n.x ?? 0;
        const ny = n.y ?? 0;
        const nz = n.z ?? 0;
        if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) continue;
        const rCoord = nx * rightX + ny * rightY + nz * rightZ;
        const uCoord = nx * upX + ny * upY + nz * upZ;
        const wCoord = nx * dirX + ny * dirY + nz * dirZ;
        const val = Math.max(1, n.displayVal ?? n.val ?? 6);
        const rho = 4 * Math.cbrt(val);
        projectedNodes.push({ r: rCoord, u: uCoord, w: wCoord, rho });
        if (rCoord < minR) minR = rCoord;
        if (rCoord > maxR) maxR = rCoord;
        if (uCoord < minU) minU = uCoord;
        if (uCoord > maxU) maxU = uCoord;
        if (wCoord < minW) minW = wCoord;
        if (wCoord > maxW) maxW = wCoord;
      }

      if (projectedNodes.length === 0 || !Number.isFinite(minR) || !Number.isFinite(maxR)) return;

      const cw = (minW + maxW) / 2;

      const width = this.container?.clientWidth || 800;
      const height = this.container?.clientHeight || 500;
      const aspect = width > 0 && height > 0 ? width / height : 1.5;
      const fovDeg = camera.fov || 75;
      const fallbackP5 = 1 / Math.tan(((fovDeg * Math.PI) / 180) * 0.5);
      const fallbackP0 = fallbackP5 / aspect;
      const elems = camera.projectionMatrix?.elements;
      const rawP0 = elems && elems.length > 5 ? Number(elems[0]) : NaN;
      const rawP5 = elems && elems.length > 5 ? Number(elems[5]) : NaN;
      const p0 = Number.isFinite(rawP0) && rawP0 > 0 ? rawP0 : fallbackP0;
      const p5 = Number.isFinite(rawP5) && rawP5 > 0 ? rawP5 : fallbackP5;

      const fx = (width * 0.5) * p0;
      const fy = (height * 0.5) * p5;
      const padX = GRAPH_VIEWPORT_CONFIG.padX;
      const padY = GRAPH_VIEWPORT_CONFIG.padY;
      const halfW = Math.max(60, width * 0.5 - padX);
      const halfH = Math.max(60, height * 0.5 - padY);

      let cr = (minR + maxR) / 2;
      let cu = (minU + maxU) / 2;
      let dist = Math.max(curDist, (maxW - cw) + 60);

      for (let iter = 0; iter < 5; iter++) {
        let minScreenX = Infinity;
        let maxScreenX = -Infinity;
        let minScreenY = Infinity;
        let maxScreenY = -Infinity;
        let idxL = 0;
        let idxR = 0;
        let idxB = 0;
        let idxT = 0;

        for (let i = 0; i < projectedNodes.length; i++) {
          const pn = projectedNodes[i];
          const dw = pn.w - cw;
          const zi = Math.max(20, dist - dw);
          const xLeft = fx * ((pn.r - cr - pn.rho) / zi);
          const xRight = fx * ((pn.r - cr + pn.rho) / zi);
          const yBottom = fy * ((pn.u - cu - pn.rho) / zi);
          const yTop = fy * ((pn.u - cu + pn.rho) / zi);

          if (xLeft < minScreenX) {
            minScreenX = xLeft;
            idxL = i;
          }
          if (xRight > maxScreenX) {
            maxScreenX = xRight;
            idxR = i;
          }
          if (yBottom < minScreenY) {
            minScreenY = yBottom;
            idxB = i;
          }
          if (yTop > maxScreenY) {
            maxScreenY = yTop;
            idxT = i;
          }
        }

        const nL = projectedNodes[idxL];
        const nR = projectedNodes[idxR];
        const nB = projectedNodes[idxB];
        const nT = projectedNodes[idxT];
        const zL = Math.max(20, dist - (nL.w - cw));
        const zR = Math.max(20, dist - (nR.w - cw));
        const zB = Math.max(20, dist - (nB.w - cw));
        const zT = Math.max(20, dist - (nT.w - cw));

        cr = ((nL.r - nL.rho) / zL + (nR.r + nR.rho) / zR) / (1 / zL + 1 / zR);
        cu = ((nB.u - nB.rho) / zB + (nT.u + nT.rho) / zT) / (1 / zB + 1 / zT);

        let dReq = 80;
        for (let i = 0; i < projectedNodes.length; i++) {
          const pn = projectedNodes[i];
          const dw = pn.w - cw;
          const needX = fx * ((Math.abs(pn.r - cr) + pn.rho) / halfW);
          const needY = fy * ((Math.abs(pn.u - cu) + pn.rho) / halfH);
          const needed = dw + Math.max(needX, needY);
          if (needed > dReq) {
            dReq = needed;
          }
        }
        dist = Math.max(80, Math.min(2500, dReq));
      }

      const cx = cr * rightX + cu * upX + cw * dirX;
      const cy = cr * rightY + cu * upY + cw * dirY;
      const cz = cr * rightZ + cu * upZ + cw * dirZ;
      const targetDist = dist;
      const t = Math.max(0, Math.min(1, alpha));

      const nextTargetX = curTargetX + (cx - curTargetX) * t;
      const nextTargetY = curTargetY + (cy - curTargetY) * t;
      const nextTargetZ = curTargetZ + (cz - curTargetZ) * t;
      const nextDist = curDist + (targetDist - curDist) * t;

      if (controls?.target) {
        if (typeof controls.target.set === 'function') {
          controls.target.set(nextTargetX, nextTargetY, nextTargetZ);
        } else {
          controls.target.x = nextTargetX;
          controls.target.y = nextTargetY;
          controls.target.z = nextTargetZ;
        }
      }

      const nextCamX = nextTargetX + dirX * nextDist;
      const nextCamY = nextTargetY + dirY * nextDist;
      const nextCamZ = nextTargetZ + dirZ * nextDist;

      if (typeof camera.position.set === 'function') {
        camera.position.set(nextCamX, nextCamY, nextCamZ);
      } else {
        camera.position.x = nextCamX;
        camera.position.y = nextCamY;
        camera.position.z = nextCamZ;
      }

      if (t >= 0.999) {
        controls?.update?.();
      }
      camera.lookAt?.(nextTargetX, nextTargetY, nextTargetZ);
    } catch {
      // Suppress if scene/camera is not yet ready
    }
  },

  startCameraAdaptLoop(durationMs = GRAPH_VIEWPORT_CONFIG.adaptDurationMs) {
    const nowInit = performance.now();
    this.cameraAdaptEndTime = Math.max(this.cameraAdaptEndTime || 0, nowInit + durationMs);
    if (this.cameraAdaptFrameId) {
      return;
    }
    let lastTime = nowInit;
    const tick = (now: number) => {
      if (!this.graph || !this.nodes || this.draggedNodeId) {
        this.cameraAdaptFrameId = null;
        return;
      }
      const dt = Math.max(1, now - lastTime);
      lastTime = now;
      const stepAlpha = 1 - Math.pow(1 - GRAPH_VIEWPORT_CONFIG.adaptAlpha, Math.min(50, dt) / 16.67);
      if (this.currentLayout === 'force') {
        for (const n of this.nodes) {
          if (typeof n.x === 'number' && typeof n.y === 'number' && typeof n.z === 'number') {
            this.forcePositions.set(n.id, { x: n.x, y: n.y, z: n.z });
          }
        }
      }
      this.stepCameraTowardCloud(stepAlpha);
      if (now < (this.cameraAdaptEndTime || 0)) {
        this.cameraAdaptFrameId = requestAnimationFrame(tick);
      } else {
        this.cameraAdaptFrameId = null;
      }
    };
    this.cameraAdaptFrameId = requestAnimationFrame(tick);
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

    this.graph.backgroundColor('rgba(0,0,0,0)');

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
      this.applyForces(false);
      const { targets, signature } = this.computeLayoutTargets(layout, false);
      this.lastOrderSignature = signature;
      this.animateTo(targets, 800, undefined, true);
    } else {
      // default: force directed
      if (!this.initialized) {
        this.nodes.forEach(n => {
          const fp = this.forcePositions.get(n.id);
          if (fp) {
            n.x = fp.x;
            n.y = fp.y;
            n.z = fp.z;
            n.fx = fp.x;
            n.fy = fp.y;
            n.fz = fp.z;
          }
        });
        return;
      }

      this.applyForces(false);
      if (this.forcePositions.size > 0) {
        const targets: Record<string, { x: number; y: number; z: number }> = {};
        for (const [id, pos] of this.forcePositions.entries()) {
          targets[id] = { x: pos.x, y: pos.y, z: pos.z };
        }
        this.animateTo(targets, 800, undefined, true);
        if (this.recenterTimeout) clearTimeout(this.recenterTimeout);
        this.recenterTimeout = setTimeout(() => {
          this.nodes?.forEach(n => {
            n.fx = null;
            n.fy = null;
            n.fz = null;
          });
          try {
            this.graph?.cooldownTicks(0);
          } catch {
            // Suppress
          }
          this.startCameraAdaptLoop(2400);
        }, 820);
      } else {
        this.nodes.forEach(n => {
          n.fx = null;
          n.fy = null;
          n.fz = null;
        });
        try {
          this.graph.d3ReheatSimulation();
        } catch {
          // Suppress if the internal engine has not loaded yet
        }
        this.startCameraAdaptLoop(2400);
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
          if (zoomToFitAfter && !this.draggedNodeId) {
            this.stepCameraTowardCloud(0.035);
          }
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
            if (zoomToFitAfter && !this.draggedNodeId) {
              this.startCameraAdaptLoop(2400);
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
    if (this.cameraAdaptFrameId) {
      cancelAnimationFrame(this.cameraAdaptFrameId);
      this.cameraAdaptFrameId = null;
    }
    this.cameraAdaptEndTime = 0;
    if (this.cleanupControlsListeners) {
      this.cleanupControlsListeners();
      this.cleanupControlsListeners = null;
    }
    if (this.recenterTimeout) {
      clearTimeout(this.recenterTimeout);
      this.recenterTimeout = null;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
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
