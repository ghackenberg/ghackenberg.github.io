import ForceGraph3D from '3d-force-graph';
import {
  GRAPH_COLORS,
  GRAPH_PHYSICS_CONFIG,
  GRAPH_VIEWPORT_CONFIG,
  HIGHLIGHT_TRANSITION_MS,
  easeHighlightTransition,
  getEdgeLinkDistance3D,
  getEdgeLinkStrength3D,
  getGraphStyleTokens,
  getGraphTuningState,
  buildGraphAdjacency,
  computeHopDistances,
  interpolateHexColor,
  getAttenuatedNodeColor,
  getAttenuatedNodeScale,
  getAttenuatedEdgeStyle,
  isDefaultGraphTuningState,
  type GraphNodePayload
} from '@commons/shared/graph-payload';
import {
  compute3DGeometryTargets,
  solve3DForceLayout,
  solve3DForceLayoutAsync,
} from '@commons/shared/graph-solvers';
import {
  createGraphDragPhysicsController3D,
  type GraphDragPhysicsController3D,
} from '@commons/client/graph-drag-controller';
import { createGraphTooltipController, type GraphTooltipController, type RawGraphNode } from '@commons/client/vis-tooltip';

export interface ThreeColorLike {
  set?: (color: string | number) => void;
}

export interface ThreeMaterialLike {
  color?: ThreeColorLike;
  depthTest?: boolean;
  depthWrite?: boolean;
  transparent?: boolean;
  opacity?: number;
  needsUpdate?: boolean;
  clone?: () => ThreeMaterialLike;
}

export interface ThreeObjectLike {
  renderOrder?: number;
  scale?: Force3DVec3;
  material?: ThreeMaterialLike;
  children?: ThreeObjectLike[];
  __hasOwnMat?: boolean;
}

export interface Force3DNode extends GraphNodePayload {
  val: number;
  color: string;
  displayVal?: number;
  displayColor?: string;
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  fx?: number | null;
  fy?: number | null;
  fz?: number | null;
  __threeObj?: ThreeObjectLike;
}

export interface Force3DLink {
  source: string | Force3DNode;
  target: string | Force3DNode;
  weight?: number;
  displayColor?: string;
  displayWidth?: number;
  __lineObj?: ThreeObjectLike;
  __threeObj?: ThreeObjectLike;
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
  dragController?: GraphDragPhysicsController3D | null;
  hoveredNodeId: string | null;
  secondaryHoveredNodeId?: string | null;
  draggedNodeId: string | null;
  focusedNodeIds?: Set<string> | null;
  adjacency: Map<string, Set<string>> | null;
  activeDistances: Map<string, number> | null;
  mouseMoveHandler: ((e: MouseEvent) => void) | null;
  container: HTMLElement | null;
  currentLayout?: string;
  isLight?: boolean;
  lastOrderSignature?: string;
  lastDraggedAt?: number;
  forcePositions: Map<string, { x: number; y: number; z: number }>;
  initialForcePositions: Map<string, { x: number; y: number; z: number }>;
  tuningGeneration?: number;
  tuningInFlight?: boolean;
  recenterTimeout?: ReturnType<typeof setTimeout> | null;
  resizeObserver: ResizeObserver | null;
  initialized: boolean;
  animationFrameId: number | null;
  cameraAdaptFrameId: number | null;
  cameraAdaptEndTime?: number;
  cameraAdaptAlpha?: number;
  cleanupControlsListeners?: (() => void) | null;
  highlightFrameId: number | null;
  applyHighlight?(immediate?: boolean): void;
  applyForces(initialLoad?: boolean): void;
  stepCameraTowardCloud(alpha: number): void;
  startCameraAdaptLoop(durationMs?: number, baseAlpha?: number): void;
  init(container: HTMLElement, payload: { '3d-force'?: { nodes: GraphNodePayload[]; connections: { sourceId: string; targetId: string; weight?: number }[] }; '3d-force-graph'?: { nodes: GraphNodePayload[]; connections: { sourceId: string; targetId: string; weight?: number }[] } }, layout: string, isLight: boolean, extraOptions?: Record<string, string>): Promise<Force3DEngine>;
  computeLayoutTargets(layout: string, useCurrentOrder?: boolean): { targets: Record<string, { x: number; y: number; z: number }>; signature: string };
  updateLayout(layout: string, isLight: boolean): void;
  applyTuning(category: 'physics' | 'geometry' | 'visual' | 'reset'): void;
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
  dragController: null,
  hoveredNodeId: null,
  draggedNodeId: null,
  adjacency: null,
  activeDistances: null,
  mouseMoveHandler: null,
  container: null,
  lastOrderSignature: '',
  lastDraggedAt: 0,
  forcePositions: new Map(),
  initialForcePositions: new Map(),
  recenterTimeout: null,
  resizeObserver: null,
  initialized: false,
  animationFrameId: null,
  cameraAdaptFrameId: null,
  cameraAdaptEndTime: 0,
  cleanupControlsListeners: null,
  highlightFrameId: null,

  async init(container: HTMLElement, payload: { '3d-force'?: { nodes: GraphNodePayload[]; connections: { sourceId: string; targetId: string; weight?: number }[] }; '3d-force-graph'?: { nodes: GraphNodePayload[]; connections: { sourceId: string; targetId: string; weight?: number }[] } }, layout: string, isLight: boolean, extraOptions: Record<string, string> = {}) {
    this.container = container;
    this.currentLayout = undefined;
    this.isLight = isLight;
    this.hoveredNodeId = null;
    this.secondaryHoveredNodeId = null;
    this.draggedNodeId = null;
    const engineData = payload['3d-force-graph'] || payload['3d-force'] || { nodes: [], connections: [] };
    this.adjacency = buildGraphAdjacency(engineData.connections);
    this.activeDistances = null;
    this.lastOrderSignature = '';
    this.lastDraggedAt = 0;
    this.forcePositions = new Map();
    this.initialForcePositions = new Map();
    const colors = isLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;
    const initialStyleTokens = getGraphStyleTokens(isLight);
    
    // Cache nodes and connections with full rich metadata and pre-computed 3D coordinates.
    // Pin fx/fy/fz initially so tick 1 of three-forcegraph copies (x, y, z) onto __threeObj.position without perturbing equilibrium.
    this.nodes = engineData.nodes.map((n) => {
      const nx = typeof n.x === 'number' ? n.x : 0;
      const ny = typeof n.y === 'number' ? n.y : 0;
      const nz = typeof n.z === 'number' ? n.z : 0;
      this.forcePositions.set(n.id, { x: nx, y: ny, z: nz });
      this.initialForcePositions.set(n.id, { x: nx, y: ny, z: nz });
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
      weight: c.weight,
      displayColor: initialStyleTokens.edgeColor,
      displayWidth: initialStyleTokens.edgeWidth
    }));

    const nodeLookup = new Map<string, Force3DNode>();
    for (const n of this.nodes) {
      nodeLookup.set(n.id, n);
    }

    this.dragController = createGraphDragPhysicsController3D({
      nodes: this.nodes.map((n) => ({
        id: n.id,
        group: n.group,
        x: n.x ?? 0,
        y: n.y ?? 0,
        z: n.z ?? 0,
      })),
      edges: engineData.connections.map((c) => ({
        source: c.sourceId,
        target: c.targetId,
        weight: c.weight ?? 0.5,
      })),
      isLight: () => Boolean(this.isLight),
      onTick: (positions, draggedId) => {
        if (!this.graph || !this.nodes) return;
        for (const [id, pt] of positions.entries()) {
          if (id === draggedId) continue;
          const n = nodeLookup.get(id);
          if (n) {
            n.x = pt.x;
            n.y = pt.y;
            n.z = pt.z;
            n.fx = pt.x;
            n.fy = pt.y;
            n.fz = pt.z;
          }
          this.forcePositions.set(id, { x: pt.x, y: pt.y, z: pt.z });
        }
        try {
          this.graph.cooldownTicks(1);
          this.graph.d3ReheatSimulation();
        } catch {
          // Suppress
        }
      },
    });

    const utmSource = String(extraOptions.utmSource || 'visualizations_demo');
    const utmMedium = String(extraOptions.utmMedium || '3d-force-graph');
    const utmCampaign = String(extraOptions.utmCampaign || 'interactive_visualization');

    let lastHighlightedKey = '';
    const baseCylinderWidth = Math.ceil(initialStyleTokens.edgeWidth * 10) / 10;

    const applyMeshVisualState = (
      obj: ThreeObjectLike | undefined,
      colorHex: string,
      order: number,
      depthTest: boolean,
      depthWrite: boolean,
      opacity: number
    ) => {
      if (!obj) return;
      const targetMesh = obj.children && obj.children.length > 0 ? obj.children[0] : obj;
      obj.renderOrder = order;
      targetMesh.renderOrder = order;
      if (targetMesh.material) {
        if (!targetMesh.__hasOwnMat && typeof targetMesh.material.clone === 'function') {
          targetMesh.material = targetMesh.material.clone();
          targetMesh.__hasOwnMat = true;
        }
        const mat = targetMesh.material;
        mat.color?.set?.(colorHex);
        if (mat.transparent !== true || mat.depthTest !== depthTest || mat.depthWrite !== depthWrite) {
          mat.transparent = true;
          mat.depthTest = depthTest;
          mat.depthWrite = depthWrite;
          mat.needsUpdate = true;
        }
        mat.opacity = opacity;
      }
    };

    const refreshHighlight = (immediate = false) => {
      const activeNodeId = this.draggedNodeId ?? this.hoveredNodeId;
      const secId = this.secondaryHoveredNodeId ?? null;
      const highlightKey = `${activeNodeId ?? ''}|${secId ?? ''}`;
      if (!immediate && highlightKey === lastHighlightedKey) return;
      lastHighlightedKey = highlightKey;

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
      const radiusRatio = currentTokens.nodeRadius / 8;
      const palette = currentIsLight ? GRAPH_COLORS.light : GRAPH_COLORS.dark;

      const nodeTrans = (this.nodes || []).map((n) => {
        const baseColor = palette[n.group] || palette[0];
        const startColor = n.displayColor || baseColor;
        const startVal = n.displayVal ?? n.val;
        const hopDist = dists ? dists.get(n.id) : undefined;
        const isSecHover = secId !== null && n.id === secId;
        const targetColor = isSecHover
          ? baseColor
          : dists
            ? getAttenuatedNodeColor(baseColor, hopDist, currentIsLight)
            : baseColor;
        const baseScale = dists ? getAttenuatedNodeScale(hopDist) : 1;
        const targetScale = (isSecHover ? Math.max(baseScale * 1.15, 1.32) : baseScale) * radiusRatio;
        const targetVal = n.val * Math.pow(targetScale, 3);
        const isForeground = Boolean((hopDist !== undefined && hopDist < 1.8) || isSecHover);
        const changed = startColor !== targetColor || Math.abs(startVal - targetVal) > 1e-3;
        return { node: n, startColor, targetColor, startVal, targetVal, isForeground, changed };
      });

      const linkTrans = (this.links || []).map((l) => {
        const srcId = typeof l.source === 'object' ? l.source.id : String(l.source);
        const tgtId = typeof l.target === 'object' ? l.target.id : String(l.target);
        const dSrc = dists ? dists.get(srcId) : undefined;
        const dTgt = dists ? dists.get(tgtId) : undefined;
        const startColor = l.displayColor || currentTokens.edgeColor;
        const startWidth = l.displayWidth ?? currentTokens.edgeWidth;
        const targetStyle = dists
          ? getAttenuatedEdgeStyle(dSrc, dTgt, currentIsLight)
          : { color: currentTokens.edgeColor, width: currentTokens.edgeWidth };
        const isForeground = Boolean(dists && (dSrc === 0 || dTgt === 0));
        const changed = startColor !== targetStyle.color || Math.abs(startWidth - targetStyle.width) > 1e-3;
        return {
          link: l,
          startColor,
          targetColor: targetStyle.color,
          startWidth,
          targetWidth: targetStyle.width,
          isForeground,
          changed
        };
      });

      const renderStep = (ease: number) => {
        for (const nt of nodeTrans) {
          if (!nt.changed && ease < 1) continue;
          const nextColor = ease >= 1 ? nt.targetColor : interpolateHexColor(nt.startColor, nt.targetColor, ease);
          const nextVal = ease >= 1 ? nt.targetVal : nt.startVal + (nt.targetVal - nt.startVal) * ease;
          nt.node.displayColor = nextColor;
          nt.node.displayVal = nextVal;

          const nodeObj = nt.node.__threeObj;
          if (nodeObj) {
            const scaleRatio = Math.cbrt(Math.max(0.01, nextVal / nt.node.val));
            nodeObj.scale?.set?.(scaleRatio, scaleRatio, scaleRatio);
            if (dists) {
              if (nt.isForeground) {
                applyMeshVisualState(nodeObj, nextColor, 15, true, true, 1);
              } else {
                applyMeshVisualState(nodeObj, nextColor, 2, true, false, 1);
              }
            } else {
              applyMeshVisualState(nodeObj, nextColor, 10, true, true, 1);
            }
          }
        }

        for (const lt of linkTrans) {
          if (!lt.changed && ease < 1) continue;
          const nextColor = ease >= 1 ? lt.targetColor : interpolateHexColor(lt.startColor, lt.targetColor, ease);
          const nextWidth = ease >= 1 ? lt.targetWidth : lt.startWidth + (lt.targetWidth - lt.startWidth) * ease;
          lt.link.displayColor = nextColor;
          lt.link.displayWidth = nextWidth;

          const lineObj = lt.link.__lineObj || lt.link.__threeObj;
          if (lineObj) {
            const lineMesh = lineObj.children && lineObj.children.length > 0 ? lineObj.children[0] : lineObj;
            const widthRatio = Math.max(0.1, nextWidth / baseCylinderWidth);
            if (lineMesh.scale) {
              lineMesh.scale.x = widthRatio;
              lineMesh.scale.y = widthRatio;
            }
            if (dists) {
              if (lt.isForeground) {
                applyMeshVisualState(lineObj, nextColor, 20, true, true, 1);
              } else {
                applyMeshVisualState(lineObj, nextColor, 1, true, false, 1);
              }
            } else {
              applyMeshVisualState(lineObj, nextColor, 5, true, true, 1);
            }
          }
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

    let materialsInitialized = false;
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
      .nodeVal((n: Force3DNode) => n.val)
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
      .linkWidth(initialStyleTokens.edgeWidth)
      .onEngineTick(() => {
        if (!materialsInitialized) {
          materialsInitialized = true;
          refreshHighlight(true);
        }
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
      onFocusNodeChange: (_nodeId, focusNodeIds) => {
        this.focusedNodeIds = focusNodeIds;
        this.startCameraAdaptLoop(1600, GRAPH_VIEWPORT_CONFIG.focusAlpha);
      },
      onSecondaryHoverNodeChange: (nodeId) => {
        this.secondaryHoveredNodeId = nodeId;
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
          const pos = { x: node.x ?? 0, y: node.y ?? 0, z: node.z ?? 0 };
          this.forcePositions.set(node.id, pos);
          this.dragController?.startDrag(node.id, pos);
          try {
            this.graph.cooldownTicks(1);
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
          const pos = { x: node.x ?? 0, y: node.y ?? 0, z: node.z ?? 0 };
          this.forcePositions.set(node.id, pos);
          this.dragController?.moveDrag(node.id, pos);
          try {
            this.graph.cooldownTicks(1);
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
              this.graph.cooldownTicks(1);
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
          const pos = {
            x: node?.x ?? 0,
            y: node?.y ?? 0,
            z: node?.z ?? 0
          };
          if (node) {
            node.fx = pos.x;
            node.fy = pos.y;
            node.fz = pos.z;
            this.forcePositions.set(node.id, pos);
          }
          this.dragController?.endDrag(rawNode.id, pos);
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
      const tuning = getGraphTuningState();
      this.graph.d3Force('charge').strength(GRAPH_PHYSICS_CONFIG.force3DChargeStrength * tuning.repulsionScale);
      const linkForce = this.graph.d3Force('link') as
        | {
            distance?: (fn: (l: Force3DLink) => number) => void;
            strength?: (fn: (l: Force3DLink) => number) => void;
          }
        | undefined;
      linkForce?.distance?.((l: Force3DLink) => getEdgeLinkDistance3D(l.weight));
      linkForce?.strength?.((l: Force3DLink) => getEdgeLinkStrength3D(l.weight));
      const radialGravity = GRAPH_PHYSICS_CONFIG.force3DCenterGravityStrength * tuning.gravityScale;
      (this.graph.d3Force as (name: string, fn?: () => void) => void)('radialGravity', () => {
        if (!this.nodes) return;
        for (const n of this.nodes) {
          if (n.fx !== null && n.fx !== undefined) continue;
          n.vx = (n.vx || 0) - (n.x || 0) * radialGravity;
          n.vy = (n.vy || 0) - (n.y || 0) * radialGravity;
          n.vz = (n.vz || 0) - (n.z || 0) * radialGravity;
        }
      });
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

      const isSubgraph = Boolean(this.focusedNodeIds && this.focusedNodeIds.size > 0);
      const projectedNodes: { r: number; u: number; w: number; rho: number }[] = [];

      for (const n of this.nodes) {
        if (isSubgraph && !this.focusedNodeIds!.has(n.id)) continue;
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
      const padX = isSubgraph
        ? Math.max(GRAPH_VIEWPORT_CONFIG.focusPadX, Math.round(width * 0.12))
        : GRAPH_VIEWPORT_CONFIG.padX;
      const padY = isSubgraph
        ? Math.max(GRAPH_VIEWPORT_CONFIG.focusPadY, Math.round(height * 0.14))
        : GRAPH_VIEWPORT_CONFIG.padY;
      const halfW = Math.max(60, width * 0.5 - padX);
      const halfH = Math.max(60, height * 0.5 - padY);
      const minAllowedDist = isSubgraph ? 140 : 80;

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

        let dReq = minAllowedDist;
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
        dist = Math.max(minAllowedDist, Math.min(2500, dReq));
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

  startCameraAdaptLoop(
    durationMs = GRAPH_VIEWPORT_CONFIG.adaptDurationMs,
    baseAlpha: number = GRAPH_VIEWPORT_CONFIG.adaptAlpha
  ) {
    const nowInit = performance.now();
    this.cameraAdaptEndTime = Math.max(this.cameraAdaptEndTime || 0, nowInit + durationMs);
    this.cameraAdaptAlpha = this.cameraAdaptFrameId
      ? Math.max(this.cameraAdaptAlpha || GRAPH_VIEWPORT_CONFIG.adaptAlpha, baseAlpha)
      : baseAlpha;
    if (this.cameraAdaptFrameId) {
      return;
    }
    let lastTime = nowInit;
    const tick = (now: number) => {
      if (!this.graph || !this.nodes || this.draggedNodeId) {
        this.cameraAdaptFrameId = null;
        this.cameraAdaptAlpha = GRAPH_VIEWPORT_CONFIG.adaptAlpha;
        return;
      }
      const dt = Math.max(1, now - lastTime);
      lastTime = now;
      const activeAlpha = this.cameraAdaptAlpha || GRAPH_VIEWPORT_CONFIG.adaptAlpha;
      const stepAlpha = 1 - Math.pow(1 - activeAlpha, Math.min(50, dt) / 16.67);
      this.stepCameraTowardCloud(stepAlpha);
      if (now < (this.cameraAdaptEndTime || 0)) {
        this.cameraAdaptFrameId = requestAnimationFrame(tick);
      } else {
        this.cameraAdaptFrameId = null;
        this.cameraAdaptAlpha = GRAPH_VIEWPORT_CONFIG.adaptAlpha;
      }
    };
    this.cameraAdaptFrameId = requestAnimationFrame(tick);
  },

  computeLayoutTargets(layout: string, useCurrentOrder = false) {
    if (!this.nodes || (layout !== 'radial' && layout !== 'columns')) {
      return { targets: {}, signature: '' };
    }
    return compute3DGeometryTargets(this.nodes, layout, useCurrentOrder, window.innerWidth < 768);
  },

  updateLayout(layout: string, isLight: boolean) {
    if (!this.graph || !this.nodes) return;
    const layoutChanged = this.currentLayout !== layout;
    this.currentLayout = layout;
    this.isLight = isLight;

    if (layoutChanged) {
      this.tuningGeneration = (this.tuningGeneration || 0) + 1;
      this.tuningInFlight = false;
      this.focusedNodeIds = null;
      this.tooltipController?.clearFocus();
      this.dragController?.stop();
    }

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
      } else {
        const solved = solve3DForceLayout({
          nodes: this.nodes,
          connections: (this.links || []).map(l => ({
            sourceId: typeof l.source === 'object' ? l.source.id : String(l.source),
            targetId: typeof l.target === 'object' ? l.target.id : String(l.target),
            weight: l.weight ?? 0.5
          }))
        });
        for (const [id, pt] of Object.entries(solved)) {
          this.forcePositions.set(id, { x: pt.x, y: pt.y, z: pt.z });
        }
        this.animateTo(solved, 800, undefined, true);
      }
    }
  },

  applyTuning(category: 'physics' | 'geometry' | 'visual' | 'reset') {
    if (!this.graph || !this.nodes) return;
    if (category === 'visual') {
      this.applyHighlight?.(true);
      return;
    }
    if (category === 'geometry') {
      if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
        const { targets, signature } = this.computeLayoutTargets(this.currentLayout, true);
        this.lastOrderSignature = signature;
        this.animateTo(targets, 400, undefined, true);
      }
      return;
    }
    if (category === 'physics') {
      const gen = (this.tuningGeneration = (this.tuningGeneration || 0) + 1);
      this.dragController?.stop();
      this.applyForces(false);
      if (this.currentLayout === 'force') {
        if (isDefaultGraphTuningState() && this.initialForcePositions.size > 0) {
          this.tuningInFlight = false;
          this.forcePositions.clear();
          const targets: Record<string, { x: number; y: number; z: number }> = {};
          for (const [id, pos] of this.initialForcePositions.entries()) {
            this.forcePositions.set(id, { x: pos.x, y: pos.y, z: pos.z });
            targets[id] = { x: pos.x, y: pos.y, z: pos.z };
          }
          this.animateTo(targets, 450, undefined, true);
        } else {
          this.tuningInFlight = true;
          void solve3DForceLayoutAsync(
            {
              nodes: this.nodes,
              connections: (this.links || []).map(l => ({
                sourceId: typeof l.source === 'object' ? l.source.id : String(l.source),
                targetId: typeof l.target === 'object' ? l.target.id : String(l.target),
                weight: l.weight ?? 0.5
              }))
            },
            { shouldCancel: () => this.tuningGeneration !== gen }
          ).then((solved) => {
            if (!solved || this.tuningGeneration !== gen || !this.graph || !this.nodes) return;
            this.tuningInFlight = false;
            if (this.currentLayout !== 'force') return;
            this.forcePositions.clear();
            for (const [id, pt] of Object.entries(solved)) {
              this.forcePositions.set(id, { x: pt.x, y: pt.y, z: pt.z });
            }
            this.animateTo(solved, 450, undefined, true);
          });
        }
      }
      return;
    }
    if (category === 'reset') {
      this.tuningGeneration = (this.tuningGeneration || 0) + 1;
      this.tuningInFlight = false;
      this.dragController?.stop();
      this.forcePositions.clear();
      for (const [id, pos] of this.initialForcePositions.entries()) {
        this.forcePositions.set(id, { x: pos.x, y: pos.y, z: pos.z });
      }
      this.applyForces(false);
      this.applyHighlight?.(true);
      if (this.currentLayout === 'force') {
        const targets: Record<string, { x: number; y: number; z: number }> = {};
        for (const [id, pos] of this.initialForcePositions.entries()) {
          targets[id] = { x: pos.x, y: pos.y, z: pos.z };
        }
        this.animateTo(targets, 450, undefined, true);
      } else if (this.currentLayout === 'radial' || this.currentLayout === 'columns') {
        const { targets, signature } = this.computeLayoutTargets(this.currentLayout, false);
        this.lastOrderSignature = signature;
        this.animateTo(targets, 450, undefined, true);
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
      const elapsed = Math.max(0, time - startTime);
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
          this.graph.cooldownTicks(1);
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
        if (this.currentLayout === 'force' && !excludeNodeId) {
          for (const [id, pt] of Object.entries(targets)) {
            this.forcePositions.set(id, { x: pt.x, y: pt.y, z: pt.z });
          }
          this.dragController?.calibrateFromPositions(this.forcePositions);
        }
        try {
          if (this.graph && this.initialized) {
            this.graph.cooldownTicks(1);
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
    this.tuningGeneration = (this.tuningGeneration || 0) + 1;
    this.tuningInFlight = false;
    if (this.highlightFrameId) {
      cancelAnimationFrame(this.highlightFrameId);
      this.highlightFrameId = null;
    }
    if (this.dragController) {
      this.dragController.destroy();
      this.dragController = null;
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
    this.secondaryHoveredNodeId = null;
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
