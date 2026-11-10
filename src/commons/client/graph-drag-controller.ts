import * as d3 from 'd3';
import {
  forceSimulation as forceSimulation3D,
  forceLink as forceLink3D,
  forceCollide as forceCollide3D,
  type SimNode3D,
  type SimLink3D,
} from 'd3-force-3d';
import {
  buildGraphAdjacency,
  getEdgeLinkStrength2D,
  getEdgeLinkStrength3D,
  getEdgePhysicsMetrics,
  getGraphStyleTokens,
} from '@commons/shared/graph-payload';
import type { Point2D, Point3D } from '@commons/shared/graph-solvers';

export interface SimNode2D extends d3.SimulationNodeDatum {
  id: string;
  group: number;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
}

export interface SimLink2D extends d3.SimulationLinkDatum<SimNode2D> {
  source: string | SimNode2D;
  target: string | SimNode2D;
  weight: number;
  restDistance: number;
  initialRestDistance: number;
  strength: number;
}

export interface GraphDragControllerOptions {
  nodes: readonly { id: string; group?: number; x?: number; y?: number }[];
  edges: readonly { source: string; target: string; weight?: number }[];
  isLight: () => boolean;
  collideRadius?: () => number;
  onTick: (positions: ReadonlyMap<string, Point2D>, draggedNodeId: string | null) => void;
  onSettleComplete?: (positions: ReadonlyMap<string, Point2D>) => void;
}

export interface GraphDragPhysicsController2D {
  calibrateFromPositions(positions: ReadonlyMap<string, Point2D> | Record<string, Point2D>): void;
  startDrag(nodeId: string, pos: Point2D): void;
  moveDrag(nodeId: string, pos: Point2D): void;
  endDrag(nodeId: string, pos?: Point2D): void;
  isDragging(): boolean;
  getGrabbedNodeId(): string | null;
  stop(): void;
  destroy(): void;
}

export interface GraphDragController3DOptions {
  nodes: readonly { id: string; group?: number; x?: number; y?: number; z?: number }[];
  edges: readonly { source: string; target: string; weight?: number }[];
  isLight: () => boolean;
  collideRadius?: () => number;
  onTick: (positions: ReadonlyMap<string, Point3D>, draggedNodeId: string | null) => void;
  onSettleComplete?: (positions: ReadonlyMap<string, Point3D>) => void;
}

export interface GraphDragPhysicsController3D {
  calibrateFromPositions(positions: ReadonlyMap<string, Point3D> | Record<string, Point3D>): void;
  startDrag(nodeId: string, pos: Point3D): void;
  moveDrag(nodeId: string, pos: Point3D): void;
  endDrag(nodeId: string, pos?: Point3D): void;
  isDragging(): boolean;
  getGrabbedNodeId(): string | null;
  stop(): void;
  destroy(): void;
}

function computeDragLinkStrength2D(weight: number): number {
  const base = getEdgeLinkStrength2D(weight);
  const m = getEdgePhysicsMetrics(weight);
  return Math.max(0.18, Math.min(0.48, Math.max(base, 0.16 + m.stiffnessFactor * 0.42)));
}

function computeDragLinkStrength3D(weight: number): number {
  const base = getEdgeLinkStrength3D(weight);
  const m = getEdgePhysicsMetrics(weight);
  return Math.max(0.20, Math.min(0.52, Math.max(base, 0.18 + m.stiffnessFactor * 0.44)));
}

function collectNeighborhoodSets(
  rootId: string,
  adjacency: Map<string, Set<string>>
): { hop1: Set<string>; hop2: Set<string> } {
  const hop1 = new Set<string>();
  const hop2 = new Set<string>();
  const n1 = adjacency.get(rootId);
  if (n1) {
    for (const u of n1) {
      if (u !== rootId) hop1.add(u);
    }
    for (const u of hop1) {
      const n2 = adjacency.get(u);
      if (!n2) continue;
      for (const v of n2) {
        if (v !== rootId && !hop1.has(v)) {
          hop2.add(v);
        }
      }
    }
  }
  return { hop1, hop2 };
}

export function createGraphDragPhysicsController2D(
  options: GraphDragControllerOptions
): GraphDragPhysicsController2D {
  const simNodes: SimNode2D[] = [];
  const simNodeMap = new Map<string, SimNode2D>();
  const positionsMap = new Map<string, Point2D>();
  const adjacency = buildGraphAdjacency(options.edges);

  for (const n of options.nodes) {
    const nx = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : 0;
    const ny = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : 0;
    const sn: SimNode2D = {
      id: n.id,
      group: n.group ?? 0,
      x: nx,
      y: ny,
      homeX: nx,
      homeY: ny,
    };
    simNodes.push(sn);
    simNodeMap.set(sn.id, sn);
    positionsMap.set(sn.id, { x: nx, y: ny });
  }

  const simLinks: SimLink2D[] = [];
  for (const e of options.edges) {
    const s = simNodeMap.get(e.source);
    const t = simNodeMap.get(e.target);
    if (!s || !t || s.id === t.id) continue;
    const w = typeof e.weight === 'number' ? e.weight : 0.5;
    const eqDist = Math.max(1e-2, Math.hypot(t.homeX - s.homeX, t.homeY - s.homeY));
    simLinks.push({
      source: s.id,
      target: t.id,
      weight: w,
      restDistance: eqDist,
      initialRestDistance: eqDist,
      strength: computeDragLinkStrength2D(w),
    });
  }

  let grabbedNodeId: string | null = null;
  let settleHop1 = new Set<string>();
  let settleHop2 = new Set<string>();
  let settleFramesRemaining = 0;
  let frameId: number | null = null;

  const getLinkNode = (endpoint: string | SimNode2D): SimNode2D | undefined =>
    typeof endpoint === 'object' ? endpoint : simNodeMap.get(String(endpoint));

  const linkForce = d3
    .forceLink<SimNode2D, SimLink2D>(simLinks)
    .id((d) => d.id)
    .distance((l) => l.restDistance)
    .strength((l) => l.strength);

  const getCollideRadius =
    options.collideRadius ?? (() => getGraphStyleTokens(options.isLight()).nodeRadius);

  const collideForce = d3
    .forceCollide<SimNode2D>(() => getCollideRadius())
    .strength(0.75);

  const simulation = d3
    .forceSimulation<SimNode2D, SimLink2D>(simNodes)
    .force('link', linkForce)
    .force('collide', collideForce)
    .force('home', (alpha: number) => {
      for (const sn of simNodes) {
        if (sn.id === grabbedNodeId) continue;
        const dx = sn.homeX - (sn.x ?? 0);
        const dy = sn.homeY - (sn.y ?? 0);
        sn.vx = (sn.vx ?? 0) + dx * 0.14 * alpha;
        sn.vy = (sn.vy ?? 0) + dy * 0.14 * alpha;
      }
    })
    .stop();

  const startPhysicsLoop = () => {
    if (frameId !== null) return;
    const step = () => {
      simulation.tick();

      if (grabbedNodeId === null && settleFramesRemaining > 0) {
        for (const sn of simNodes) {
          const relaxRate = settleHop1.has(sn.id)
            ? 0.16
            : settleHop2.has(sn.id)
              ? 0.08
              : 0.02;
          sn.homeX += ((sn.x ?? sn.homeX) - sn.homeX) * relaxRate;
          sn.homeY += ((sn.y ?? sn.homeY) - sn.homeY) * relaxRate;
        }
      }

      for (const sn of simNodes) {
        positionsMap.set(sn.id, { x: sn.x ?? 0, y: sn.y ?? 0 });
      }

      options.onTick(positionsMap, grabbedNodeId);

      if (grabbedNodeId !== null || settleFramesRemaining > 0) {
        if (grabbedNodeId === null) {
          settleFramesRemaining--;
        }
        frameId = requestAnimationFrame(step);
      } else {
        frameId = null;
        settleHop1.clear();
        settleHop2.clear();
        for (const sn of simNodes) {
          sn.homeX = sn.x ?? sn.homeX;
          sn.homeY = sn.y ?? sn.homeY;
          sn.vx = 0;
          sn.vy = 0;
        }
        options.onSettleComplete?.(positionsMap);
      }
    };
    frameId = requestAnimationFrame(step);
  };

  return {
    calibrateFromPositions(positions: ReadonlyMap<string, Point2D> | Record<string, Point2D>) {
      const getPos = (id: string): Point2D | undefined =>
        positions instanceof Map
          ? positions.get(id)
          : (positions as Record<string, Point2D>)[id];

      for (const sn of simNodes) {
        const p = getPos(sn.id);
        if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
          sn.x = p.x;
          sn.y = p.y;
        }
        sn.homeX = sn.x;
        sn.homeY = sn.y;
        sn.vx = 0;
        sn.vy = 0;
        sn.fx = null;
        sn.fy = null;
        positionsMap.set(sn.id, { x: sn.x, y: sn.y });
      }

      for (const l of simLinks) {
        const s = getLinkNode(l.source);
        const t = getLinkNode(l.target);
        if (s && t) {
          const eqDist = Math.max(1e-2, Math.hypot(t.homeX - s.homeX, t.homeY - s.homeY));
          l.initialRestDistance = eqDist;
          l.restDistance = eqDist;
        }
        l.strength = computeDragLinkStrength2D(l.weight);
      }

      linkForce.distance((l) => l.restDistance).strength((l) => l.strength);
      collideForce.initialize(simNodes, () => 0.5);
    },

    startDrag(nodeId: string, pos: Point2D) {
      grabbedNodeId = nodeId;
      settleFramesRemaining = 0;
      const { hop1, hop2 } = collectNeighborhoodSets(nodeId, adjacency);
      settleHop1 = hop1;
      settleHop2 = hop2;
      for (const sn of simNodes) {
        if (sn.id === nodeId) {
          sn.x = pos.x;
          sn.y = pos.y;
          sn.fx = pos.x;
          sn.fy = pos.y;
          sn.vx = 0;
          sn.vy = 0;
          positionsMap.set(sn.id, { x: pos.x, y: pos.y });
        } else {
          sn.fx = null;
          sn.fy = null;
        }
      }
      for (const l of simLinks) {
        l.restDistance = l.initialRestDistance;
        l.strength = computeDragLinkStrength2D(l.weight);
      }
      linkForce.distance((l) => l.restDistance).strength((l) => l.strength);
      simulation.alphaTarget(0.35).alpha(0.45).restart();
      startPhysicsLoop();
    },

    moveDrag(nodeId: string, pos: Point2D) {
      grabbedNodeId = nodeId;
      const sn = simNodeMap.get(nodeId);
      if (sn) {
        sn.fx = pos.x;
        sn.fy = pos.y;
        sn.x = pos.x;
        sn.y = pos.y;
        positionsMap.set(sn.id, { x: pos.x, y: pos.y });
      }
      simulation.alphaTarget(0.35).alpha(0.45);
      startPhysicsLoop();
    },

    endDrag(nodeId: string, pos?: Point2D) {
      grabbedNodeId = null;
      const { hop1, hop2 } = collectNeighborhoodSets(nodeId, adjacency);
      settleHop1 = hop1;
      settleHop2 = hop2;
      for (const sn of simNodes) {
        if (sn.id === nodeId) {
          if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
            sn.x = pos.x;
            sn.y = pos.y;
          }
          sn.homeX = sn.x;
          sn.homeY = sn.y;
          sn.fx = null;
          sn.fy = null;
          positionsMap.set(sn.id, { x: sn.x, y: sn.y });
        } else if (hop1.has(sn.id)) {
          sn.homeX = sn.homeX * 0.25 + (sn.x ?? sn.homeX) * 0.75;
          sn.homeY = sn.homeY * 0.25 + (sn.y ?? sn.homeY) * 0.75;
        } else if (hop2.has(sn.id)) {
          sn.homeX = sn.homeX * 0.55 + (sn.x ?? sn.homeX) * 0.45;
          sn.homeY = sn.homeY * 0.55 + (sn.y ?? sn.homeY) * 0.45;
        }
      }
      for (const l of simLinks) {
        const s = getLinkNode(l.source);
        const t = getLinkNode(l.target);
        l.restDistance = l.initialRestDistance;
        if (s?.id === nodeId || t?.id === nodeId) {
          l.strength = Math.min(0.85, computeDragLinkStrength2D(l.weight) * 2.2);
        } else {
          l.strength = computeDragLinkStrength2D(l.weight);
        }
      }
      linkForce.distance((l) => l.restDistance).strength((l) => l.strength);
      settleFramesRemaining = 90;
      simulation.alpha(0.65).alphaTarget(0).restart();
      startPhysicsLoop();
    },

    isDragging() {
      return grabbedNodeId !== null;
    },

    getGrabbedNodeId() {
      return grabbedNodeId;
    },

    stop() {
      grabbedNodeId = null;
      settleFramesRemaining = 0;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      simulation.stop();
    },

    destroy() {
      this.stop();
      simNodes.length = 0;
      simLinks.length = 0;
      simNodeMap.clear();
      positionsMap.clear();
    },
  };
}

export function createGraphDragPhysicsController3D(
  options: GraphDragController3DOptions
): GraphDragPhysicsController3D {
  const simNodes: SimNode3D[] = [];
  const simNodeMap = new Map<string, SimNode3D>();
  const positionsMap = new Map<string, Point3D>();
  const adjacency = buildGraphAdjacency(options.edges);

  for (const n of options.nodes) {
    const nx = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : 0;
    const ny = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : 0;
    const nz = typeof n.z === 'number' && Number.isFinite(n.z) ? n.z : 0;
    const sn: SimNode3D = {
      id: n.id,
      group: n.group ?? 0,
      x: nx,
      y: ny,
      z: nz,
      homeX: nx,
      homeY: ny,
      homeZ: nz,
    };
    simNodes.push(sn);
    simNodeMap.set(sn.id, sn);
    positionsMap.set(sn.id, { x: nx, y: ny, z: nz });
  }

  const simLinks: SimLink3D[] = [];
  for (const e of options.edges) {
    const s = simNodeMap.get(e.source);
    const t = simNodeMap.get(e.target);
    if (!s || !t || s.id === t.id) continue;
    const w = typeof e.weight === 'number' ? e.weight : 0.5;
    const eqDist = Math.max(
      1e-2,
      Math.hypot(
        (t.homeX ?? 0) - (s.homeX ?? 0),
        (t.homeY ?? 0) - (s.homeY ?? 0),
        (t.homeZ ?? 0) - (s.homeZ ?? 0)
      )
    );
    simLinks.push({
      source: s.id,
      target: t.id,
      weight: w,
      restDistance: eqDist,
      initialRestDistance: eqDist,
      strength: computeDragLinkStrength3D(w),
    });
  }

  let grabbedNodeId: string | null = null;
  let settleHop1 = new Set<string>();
  let settleHop2 = new Set<string>();
  let settleFramesRemaining = 0;
  let frameId: number | null = null;

  const getLinkNode = (endpoint: string | SimNode3D): SimNode3D | undefined =>
    typeof endpoint === 'object' ? endpoint : simNodeMap.get(String(endpoint));

  const linkForce = forceLink3D(simLinks)
    .id((d: SimNode3D) => d.id)
    .distance((l: SimLink3D) => l.restDistance ?? 24)
    .strength((l: SimLink3D) => l.strength ?? 0.3);

  const getCollideRadius =
    options.collideRadius ?? (() => getGraphStyleTokens(options.isLight()).nodeRadius * 0.9);

  const collideForce = forceCollide3D((() => getCollideRadius()) as (node: SimNode3D) => number).strength(
    0.75
  );

  const simulation = forceSimulation3D(simNodes, 3)
    .force('link', linkForce)
    .force('collide', collideForce)
    .force('home', (alpha: number) => {
      for (const sn of simNodes) {
        if (sn.id === grabbedNodeId) continue;
        const dx = (sn.homeX ?? 0) - (sn.x ?? 0);
        const dy = (sn.homeY ?? 0) - (sn.y ?? 0);
        const dz = (sn.homeZ ?? 0) - (sn.z ?? 0);
        sn.vx = (sn.vx ?? 0) + dx * 0.14 * alpha;
        sn.vy = (sn.vy ?? 0) + dy * 0.14 * alpha;
        sn.vz = (sn.vz ?? 0) + dz * 0.14 * alpha;
      }
    })
    .stop();

  const startPhysicsLoop = () => {
    if (frameId !== null) return;
    const step = () => {
      simulation.tick(1);

      if (grabbedNodeId === null && settleFramesRemaining > 0) {
        for (const sn of simNodes) {
          const relaxRate = settleHop1.has(sn.id)
            ? 0.16
            : settleHop2.has(sn.id)
              ? 0.08
              : 0.02;
          const hx = sn.homeX ?? sn.x;
          const hy = sn.homeY ?? sn.y;
          const hz = sn.homeZ ?? sn.z;
          sn.homeX = hx + ((sn.x ?? hx) - hx) * relaxRate;
          sn.homeY = hy + ((sn.y ?? hy) - hy) * relaxRate;
          sn.homeZ = hz + ((sn.z ?? hz) - hz) * relaxRate;
        }
      }

      for (const sn of simNodes) {
        positionsMap.set(sn.id, { x: sn.x ?? 0, y: sn.y ?? 0, z: sn.z ?? 0 });
      }

      options.onTick(positionsMap, grabbedNodeId);

      if (grabbedNodeId !== null || settleFramesRemaining > 0) {
        if (grabbedNodeId === null) {
          settleFramesRemaining--;
        }
        frameId = requestAnimationFrame(step);
      } else {
        frameId = null;
        settleHop1.clear();
        settleHop2.clear();
        for (const sn of simNodes) {
          sn.homeX = sn.x ?? sn.homeX ?? 0;
          sn.homeY = sn.y ?? sn.homeY ?? 0;
          sn.homeZ = sn.z ?? sn.homeZ ?? 0;
          sn.vx = 0;
          sn.vy = 0;
          sn.vz = 0;
        }
        options.onSettleComplete?.(positionsMap);
      }
    };
    frameId = requestAnimationFrame(step);
  };

  return {
    calibrateFromPositions(positions: ReadonlyMap<string, Point3D> | Record<string, Point3D>) {
      const getPos = (id: string): Point3D | undefined =>
        positions instanceof Map
          ? positions.get(id)
          : (positions as Record<string, Point3D>)[id];

      for (const sn of simNodes) {
        const p = getPos(sn.id);
        if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) {
          sn.x = p.x;
          sn.y = p.y;
          sn.z = p.z;
        }
        sn.homeX = sn.x;
        sn.homeY = sn.y;
        sn.homeZ = sn.z;
        sn.vx = 0;
        sn.vy = 0;
        sn.vz = 0;
        sn.fx = null;
        sn.fy = null;
        sn.fz = null;
        positionsMap.set(sn.id, { x: sn.x, y: sn.y, z: sn.z });
      }

      for (const l of simLinks) {
        const s = getLinkNode(l.source);
        const t = getLinkNode(l.target);
        if (s && t) {
          const eqDist = Math.max(
            1e-2,
            Math.hypot(
              (t.homeX ?? 0) - (s.homeX ?? 0),
              (t.homeY ?? 0) - (s.homeY ?? 0),
              (t.homeZ ?? 0) - (s.homeZ ?? 0)
            )
          );
          l.initialRestDistance = eqDist;
          l.restDistance = eqDist;
        }
        l.strength = computeDragLinkStrength3D(l.weight ?? 0.5);
      }

      linkForce
        .distance((l: SimLink3D) => l.restDistance ?? 24)
        .strength((l: SimLink3D) => l.strength ?? 0.3);
      collideForce.initialize?.(simNodes, () => 0.5, 3);
    },

    startDrag(nodeId: string, pos: Point3D) {
      grabbedNodeId = nodeId;
      settleFramesRemaining = 0;
      const { hop1, hop2 } = collectNeighborhoodSets(nodeId, adjacency);
      settleHop1 = hop1;
      settleHop2 = hop2;
      for (const sn of simNodes) {
        if (sn.id === nodeId) {
          sn.x = pos.x;
          sn.y = pos.y;
          sn.z = pos.z;
          sn.fx = pos.x;
          sn.fy = pos.y;
          sn.fz = pos.z;
          sn.vx = 0;
          sn.vy = 0;
          sn.vz = 0;
          positionsMap.set(sn.id, { x: pos.x, y: pos.y, z: pos.z });
        } else {
          sn.fx = null;
          sn.fy = null;
          sn.fz = null;
        }
      }
      for (const l of simLinks) {
        l.restDistance = l.initialRestDistance;
        l.strength = computeDragLinkStrength3D(l.weight ?? 0.5);
      }
      linkForce
        .distance((l: SimLink3D) => l.restDistance ?? 24)
        .strength((l: SimLink3D) => l.strength ?? 0.3);
      simulation.alphaTarget(0.35).alpha(0.45).restart();
      startPhysicsLoop();
    },

    moveDrag(nodeId: string, pos: Point3D) {
      grabbedNodeId = nodeId;
      const sn = simNodeMap.get(nodeId);
      if (sn) {
        sn.fx = pos.x;
        sn.fy = pos.y;
        sn.fz = pos.z;
        sn.x = pos.x;
        sn.y = pos.y;
        sn.z = pos.z;
        positionsMap.set(sn.id, { x: pos.x, y: pos.y, z: pos.z });
      }
      simulation.alphaTarget(0.35).alpha(0.45);
      startPhysicsLoop();
    },

    endDrag(nodeId: string, pos?: Point3D) {
      grabbedNodeId = null;
      const { hop1, hop2 } = collectNeighborhoodSets(nodeId, adjacency);
      settleHop1 = hop1;
      settleHop2 = hop2;
      for (const sn of simNodes) {
        if (sn.id === nodeId) {
          if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z)) {
            sn.x = pos.x;
            sn.y = pos.y;
            sn.z = pos.z;
          }
          sn.homeX = sn.x;
          sn.homeY = sn.y;
          sn.homeZ = sn.z;
          sn.fx = null;
          sn.fy = null;
          sn.fz = null;
          positionsMap.set(sn.id, { x: sn.x, y: sn.y, z: sn.z });
        } else if (hop1.has(sn.id)) {
          sn.homeX = (sn.homeX ?? sn.x) * 0.25 + sn.x * 0.75;
          sn.homeY = (sn.homeY ?? sn.y) * 0.25 + sn.y * 0.75;
          sn.homeZ = (sn.homeZ ?? sn.z) * 0.25 + sn.z * 0.75;
        } else if (hop2.has(sn.id)) {
          sn.homeX = (sn.homeX ?? sn.x) * 0.55 + sn.x * 0.45;
          sn.homeY = (sn.homeY ?? sn.y) * 0.55 + sn.y * 0.45;
          sn.homeZ = (sn.homeZ ?? sn.z) * 0.55 + sn.z * 0.45;
        }
      }
      for (const l of simLinks) {
        const s = getLinkNode(l.source);
        const t = getLinkNode(l.target);
        l.restDistance = l.initialRestDistance;
        if (s?.id === nodeId || t?.id === nodeId) {
          l.strength = Math.min(0.85, computeDragLinkStrength3D(l.weight ?? 0.5) * 2.2);
        } else {
          l.strength = computeDragLinkStrength3D(l.weight ?? 0.5);
        }
      }
      linkForce
        .distance((l: SimLink3D) => l.restDistance ?? 24)
        .strength((l: SimLink3D) => l.strength ?? 0.3);
      settleFramesRemaining = 90;
      simulation.alpha(0.65).alphaTarget(0).restart();
      startPhysicsLoop();
    },

    isDragging() {
      return grabbedNodeId !== null;
    },

    getGrabbedNodeId() {
      return grabbedNodeId;
    },

    stop() {
      grabbedNodeId = null;
      settleFramesRemaining = 0;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      simulation.stop();
    },

    destroy() {
      this.stop();
      simNodes.length = 0;
      simLinks.length = 0;
      simNodeMap.clear();
      positionsMap.clear();
    },
  };
}
