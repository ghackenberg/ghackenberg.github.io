import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import cytoscape from 'cytoscape';
import * as d3 from 'd3';
import {
  forceSimulation as forceSimulation3D,
  forceLink as forceLink3D,
  forceManyBody as forceManyBody3D,
  forceCenter as forceCenter3D,
  type SimNode3D,
  type SimLink3D,
} from 'd3-force-3d';
import {
  GRAPH_GEOMETRY_LAYOUT_CONFIG,
  GRAPH_PHYSICS_CONFIG,
  getCoseEdgeElasticity,
  getCoseEdgeIdealLength,
  getEdgeLinkDistance2D,
  getEdgeLinkDistance3D,
  getEdgeLinkStrength2D,
  getEdgeLinkStrength3D,
  getEdgePhysicsMetrics,
  getGraphStyleTokens,
  getGraphTuningState,
  getSigmaForceAtlas2Settings,
  initialCoords,
} from '@commons/shared/graph-payload';

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface SolverGraphNode {
  id: string;
  group?: number;
  size?: number;
  x?: number;
  y?: number;
  z?: number;
}

export interface SolverGraphEdge {
  source?: string;
  target?: string;
  sourceId?: string;
  targetId?: string;
  weight?: number;
}

export interface SolverGraphInput {
  nodes: readonly SolverGraphNode[];
  connections: readonly SolverGraphEdge[];
}

export interface Geometry2DOptions {
  useCurrentOrder?: boolean;
  width?: number;
  height?: number;
  centerOrigin?: boolean;
  paddedColumns?: boolean;
  scaleMode?: 'viewport' | 'sigma-world';
  isMobile?: boolean;
}

function round2(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round(val * 100) / 100;
}

function resolveEdgeEndpoints(edge: SolverGraphEdge): { src: string; tgt: string; weight: number } {
  const src = String(edge.source ?? edge.sourceId ?? '');
  const tgt = String(edge.target ?? edge.targetId ?? '');
  const weight = typeof edge.weight === 'number' ? edge.weight : 0.5;
  return { src, tgt, weight };
}

export function solveSigmaForceAtlas2Layout(input: SolverGraphInput): Record<string, Point2D> {
  const graph = new Graph();
  const nodes = input.nodes;
  const total = nodes.length;
  const baseRadius = getGraphStyleTokens(false).nodeRadius;

  nodes.forEach((n, i) => {
    const init = initialCoords(i, total);
    graph.addNode(n.id, {
      x: init.x,
      y: init.y,
      size: baseRadius,
    });
  });

  input.connections.forEach((c) => {
    const { src, tgt, weight } = resolveEdgeEndpoints(c);
    if (src && tgt && src !== tgt && graph.hasNode(src) && graph.hasNode(tgt) && !graph.hasEdge(src, tgt)) {
      graph.addUndirectedEdge(src, tgt, {
        weight: getEdgePhysicsMetrics(weight).stiffnessFactor,
      });
    }
  });

  forceAtlas2.assign(graph, {
    iterations: GRAPH_PHYSICS_CONFIG.sigmaIterations,
    settings: getSigmaForceAtlas2Settings(),
  });

  let sumX = 0;
  let sumY = 0;
  let count = 0;
  graph.forEachNode((nodeId) => {
    sumX += Number(graph.getNodeAttribute(nodeId, 'x') || 0);
    sumY += Number(graph.getNodeAttribute(nodeId, 'y') || 0);
    count++;
  });

  const meanX = count > 0 ? sumX / count : 0;
  const meanY = count > 0 ? sumY / count : 0;

  const targets: Record<string, Point2D> = {};
  graph.forEachNode((nodeId) => {
    const x = Number(graph.getNodeAttribute(nodeId, 'x') || 0) - meanX;
    const y = Number(graph.getNodeAttribute(nodeId, 'y') || 0) - meanY;
    targets[nodeId] = { x: round2(x), y: round2(y) };
  });

  return targets;
}

export function solveCytoscapeCoseLayout(input: SolverGraphInput): Record<string, Point2D> {
  const nodes = input.nodes;
  const total = nodes.length;
  const nodeIds = new Set(nodes.map((n) => n.id));
  const tuning = getGraphTuningState();

  const elements: cytoscape.ElementDefinition[] = [];
  nodes.forEach((n, i) => {
    const init = initialCoords(i, total);
    elements.push({
      data: {
        id: n.id,
        weight: n.size || 1,
      },
      position: {
        x: init.x,
        y: init.y,
      },
    });
  });

  input.connections.forEach((c, idx) => {
    const { src, tgt, weight } = resolveEdgeEndpoints(c);
    if (nodeIds.has(src) && nodeIds.has(tgt)) {
      elements.push({
        data: {
          id: `${src}--${tgt}--${idx}`,
          source: src,
          target: tgt,
          weight,
        },
      });
    }
  });

  const cy = cytoscape({
    headless: true,
    elements,
    style: [
      {
        selector: 'node',
        style: {
          width: 16,
          height: 16,
        },
      },
    ],
  });

  cy.layout({
    name: 'cose',
    animate: false,
    fit: false,
    randomize: false,
    idealEdgeLength: (edge: cytoscape.EdgeSingular) =>
      getCoseEdgeIdealLength(Number(edge.data('weight') || 0.5)),
    nodeOverlap: 20,
    componentSpacing: 100,
    nodeRepulsion: () => Math.round(GRAPH_PHYSICS_CONFIG.coseNodeRepulsion * tuning.repulsionScale),
    edgeElasticity: (edge: cytoscape.EdgeSingular) =>
      getCoseEdgeElasticity(Number(edge.data('weight') || 0.5)),
    nestingFactor: 5,
    gravity: GRAPH_PHYSICS_CONFIG.coseGravity * tuning.gravityScale,
    numIter: GRAPH_PHYSICS_CONFIG.coseIterations,
  } as cytoscape.CoseLayoutOptions).run();

  let sumX = 0;
  let sumY = 0;
  let count = 0;
  cy.nodes().forEach((n) => {
    const pos = n.position();
    sumX += pos.x;
    sumY += pos.y;
    count++;
  });
  const meanX = count > 0 ? sumX / count : 0;
  const meanY = count > 0 ? sumY / count : 0;

  const targets: Record<string, Point2D> = {};
  cy.nodes().forEach((n) => {
    const pos = n.position();
    targets[n.id()] = {
      x: round2(pos.x - meanX),
      y: round2(pos.y - meanY),
    };
  });
  cy.destroy();

  return targets;
}

interface D3HeadlessNode extends d3.SimulationNodeDatum {
  id: string;
  size: number;
  radius: number;
  x: number;
  y: number;
}

interface D3HeadlessLink extends d3.SimulationLinkDatum<D3HeadlessNode> {
  source: string | D3HeadlessNode;
  target: string | D3HeadlessNode;
  weight: number;
}

export function solveD3ForceLayout(input: SolverGraphInput): Record<string, Point2D> {
  const nodes = input.nodes;
  const total = nodes.length;
  const nodeIds = new Set(nodes.map((n) => n.id));
  const tuning = getGraphTuningState();
  const baseRadius = getGraphStyleTokens(false).nodeRadius;
  const collisionRadius = baseRadius + GRAPH_PHYSICS_CONFIG.collisionPadding2D;

  const simNodes: D3HeadlessNode[] = nodes.map((n, i) => {
    const init = initialCoords(i, total);
    return {
      id: n.id,
      size: n.size || 1,
      radius: baseRadius,
      x: init.x,
      y: init.y,
    };
  });

  const simLinks: D3HeadlessLink[] = input.connections
    .map((c) => {
      const { src, tgt, weight } = resolveEdgeEndpoints(c);
      return { source: src, target: tgt, weight };
    })
    .filter((l) => nodeIds.has(String(l.source)) && nodeIds.has(String(l.target)));

  const simulation = d3
    .forceSimulation<D3HeadlessNode>(simNodes)
    .force(
      'link',
      d3
        .forceLink<D3HeadlessNode, D3HeadlessLink>(simLinks)
        .id((d) => d.id)
        .distance((l) => getEdgeLinkDistance2D(l.weight))
        .strength((l) => getEdgeLinkStrength2D(l.weight))
    )
    .force(
      'charge',
      d3
        .forceManyBody<D3HeadlessNode>()
        .strength(GRAPH_PHYSICS_CONFIG.d3ChargeStrength * tuning.repulsionScale)
        .distanceMax(GRAPH_PHYSICS_CONFIG.d3ChargeDistanceMax)
    )
    .force('center', d3.forceCenter<D3HeadlessNode>(0, 0).strength(0.05))
    .force(
      'collide',
      d3
        .forceCollide<D3HeadlessNode>()
        .radius(collisionRadius)
        .iterations(2)
    )
    .force(
      'x',
      d3.forceX<D3HeadlessNode>(0).strength(GRAPH_PHYSICS_CONFIG.d3CenterGravityStrength * tuning.gravityScale)
    )
    .force(
      'y',
      d3.forceY<D3HeadlessNode>(0).strength(GRAPH_PHYSICS_CONFIG.d3CenterGravityStrength * tuning.gravityScale)
    )
    .stop();

  simulation.tick(500);

  const targets: Record<string, Point2D> = {};
  for (const n of simNodes) {
    targets[n.id] = { x: round2(n.x), y: round2(n.y) };
  }
  return targets;
}

export function solveVisNetworkForceLayout(input: SolverGraphInput): Record<string, Point2D> {
  const nodes = input.nodes;
  const total = nodes.length;
  const tuning = getGraphTuningState();

  const nodeIndexById = new Map<string, number>();
  nodes.forEach((n, idx) => nodeIndexById.set(n.id, idx));

  const edges: [number, number, number][] = [];
  const connectedEdgeCounts = new Array<number>(total).fill(0);
  for (const c of input.connections) {
    const { src, tgt, weight } = resolveEdgeEndpoints(c);
    const srcIdx = nodeIndexById.get(src);
    const tgtIdx = nodeIndexById.get(tgt);
    if (srcIdx !== undefined && tgtIdx !== undefined) {
      edges.push([srcIdx, tgtIdx, weight]);
      connectedEdgeCounts[srcIdx]++;
      if (srcIdx !== tgtIdx) {
        connectedEdgeCounts[tgtIdx]++;
      }
    }
  }

  interface VisSolverNode {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    fx: number;
    fy: number;
    degree: number;
    mass: number;
  }

  const simNodes: VisSolverNode[] = nodes.map((n, i) => {
    const init = initialCoords(i, total);
    const deg = connectedEdgeCounts[i];
    return {
      id: n.id,
      x: init.x,
      y: init.y,
      vx: 0,
      vy: 0,
      fx: 0,
      fy: 0,
      degree: deg,
      mass: 1 + Math.min(2.5, Math.sqrt(deg) * 0.22),
    };
  });

  const gravitationalConstant = GRAPH_PHYSICS_CONFIG.visRepulsionStrength * tuning.repulsionScale;
  const centralGravity = GRAPH_PHYSICS_CONFIG.visCentralGravity * tuning.gravityScale;
  const springConstant = GRAPH_PHYSICS_CONFIG.visSpringConstantBase;
  const damping = GRAPH_PHYSICS_CONFIG.visDamping;
  const minSeparation = (getGraphStyleTokens(false).nodeRadius + GRAPH_PHYSICS_CONFIG.collisionPadding2D) * 2;
  const maxVelocity = 50;
  const timestep = 0.5;
  const iterations = GRAPH_PHYSICS_CONFIG.visIterations;

  for (let iter = 0; iter < iterations; iter++) {
    const cooling = Math.pow(0.015, iter / iterations);

    for (let i = 0; i < simNodes.length; i++) {
      const n = simNodes[i];
      const gravityForce = centralGravity * n.mass;
      n.fx = -n.x * gravityForce;
      n.fy = -n.y * gravityForce;
    }

    for (let i = 0; i < simNodes.length; i++) {
      const ni = simNodes[i];
      for (let j = i + 1; j < simNodes.length; j++) {
        const nj = simNodes[j];
        const dx = ni.x - nj.x;
        const dy = ni.y - nj.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > 380 * 380) continue;
        const distance = Math.sqrt(distSq) || 0.5;

        let repForce =
          (gravitationalConstant * ni.mass * nj.mass) / (distance * Math.max(14, distance));
        if (distance < minSeparation) {
          repForce -= ((minSeparation - distance) * 1.2) / distance;
        }
        ni.fx -= dx * repForce;
        ni.fy -= dy * repForce;
        nj.fx += dx * repForce;
        nj.fy += dy * repForce;
      }
    }

    for (const [uIdx, vIdx, weight] of edges) {
      if (uIdx === vIdx) continue;
      const u = simNodes[uIdx];
      const v = simNodes[vIdx];
      const dx = u.x - v.x;
      const dy = u.y - v.y;
      const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 0.1);
      const localEdgeLen = getEdgeLinkDistance2D(weight);
      const localSpringK = springConstant * getEdgePhysicsMetrics(weight).stiffnessFactor;
      const springForce = (localSpringK * (localEdgeLen - distance)) / distance;
      const fx = dx * springForce;
      const fy = dy * springForce;
      u.fx += fx;
      u.fy += fy;
      v.fx -= fx;
      v.fy -= fy;
    }

    const effStep = timestep * (0.25 + 0.75 * cooling);
    for (let i = 0; i < simNodes.length; i++) {
      const n = simNodes[i];
      const dx = n.fx - damping * n.vx;
      const ax = dx / n.mass;
      n.vx = (n.vx + ax * effStep) * 0.88;
      if (Math.abs(n.vx) > maxVelocity) {
        n.vx = n.vx > 0 ? maxVelocity : -maxVelocity;
      }
      n.x += n.vx * effStep;

      const dy = n.fy - damping * n.vy;
      const ay = dy / n.mass;
      n.vy = (n.vy + ay * effStep) * 0.88;
      if (Math.abs(n.vy) > maxVelocity) {
        n.vy = n.vy > 0 ? maxVelocity : -maxVelocity;
      }
      n.y += n.vy * effStep;
    }
  }

  let sumX = 0;
  let sumY = 0;
  for (const n of simNodes) {
    sumX += n.x;
    sumY += n.y;
  }
  const meanX = simNodes.length > 0 ? sumX / simNodes.length : 0;
  const meanY = simNodes.length > 0 ? sumY / simNodes.length : 0;

  const targets: Record<string, Point2D> = {};
  for (const n of simNodes) {
    targets[n.id] = { x: round2(n.x - meanX), y: round2(n.y - meanY) };
  }
  return targets;
}

export function solve3DForceLayout(input: SolverGraphInput): Record<string, Point3D> {
  const nodes = input.nodes;
  const total = nodes.length;
  const nodeIds = new Set(nodes.map((n) => n.id));
  const tuning = getGraphTuningState();
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  const simNodes: SimNode3D[] = nodes.map((n, i) => {
    const yNorm = total > 1 ? 1 - (i / (total - 1)) * 2 : 0;
    const radialNorm = Math.sqrt(Math.max(0, 1 - yNorm * yNorm));
    const theta = goldenAngle * i;
    const r = Math.sqrt(i + 1) * 18;
    return {
      id: n.id,
      val: 6,
      x: Math.cos(theta) * radialNorm * r,
      y: yNorm * r,
      z: Math.sin(theta) * radialNorm * r,
    };
  });

  const simLinks: SimLink3D[] = input.connections
    .map((c) => {
      const { src, tgt, weight } = resolveEdgeEndpoints(c);
      return { source: src, target: tgt, weight };
    })
    .filter((l) => nodeIds.has(String(l.source)) && nodeIds.has(String(l.target)));

  const radialGravity = GRAPH_PHYSICS_CONFIG.force3DCenterGravityStrength * tuning.gravityScale;
  const simulation = forceSimulation3D(simNodes, 3)
    .stop()
    .alphaDecay(1 - Math.pow(0.001, 1 / GRAPH_PHYSICS_CONFIG.force3DIterations))
    .force(
      'link',
      forceLink3D(simLinks)
        .id((d: SimNode3D) => d.id)
        .distance((l: SimLink3D) => getEdgeLinkDistance3D(l.weight))
        .strength((l: SimLink3D) => getEdgeLinkStrength3D(l.weight))
    )
    .force(
      'charge',
      forceManyBody3D()
        .strength(GRAPH_PHYSICS_CONFIG.force3DChargeStrength * tuning.repulsionScale)
        .distanceMax(320)
    )
    .force('center', forceCenter3D(0, 0, 0))
    .force('radialGravity', (alpha: number) => {
      const k = radialGravity * alpha;
      for (const n of simNodes) {
        n.vx = (n.vx || 0) - (n.x || 0) * k;
        n.vy = (n.vy || 0) - (n.y || 0) * k;
        n.vz = (n.vz || 0) - (n.z || 0) * k;
      }
    });

  simulation.tick(GRAPH_PHYSICS_CONFIG.force3DIterations);

  const targets: Record<string, Point3D> = {};
  for (const n of simNodes) {
    targets[n.id] = { x: round2(n.x), y: round2(n.y), z: round2(n.z) };
  }
  return targets;
}

export function compute2DGeometryTargets(
  nodes: readonly SolverGraphNode[],
  layout: string,
  options: Geometry2DOptions = {}
): { targets: Record<string, Point2D>; signature: string } {
  const targets: Record<string, Point2D> = {};
  let signature = '';
  if (nodes.length === 0) return { targets, signature };

  const useCurrentOrder = Boolean(options.useCurrentOrder);
  const width = options.width || 800;
  const height = options.height || 500;
  const centerOrigin = Boolean(options.centerOrigin);
  const paddedColumns = Boolean(options.paddedColumns);
  const scaleMode = options.scaleMode || 'viewport';
  const isMobile =
    options.isMobile !== undefined
      ? options.isMobile
      : width < GRAPH_GEOMETRY_LAYOUT_CONFIG.mobileBreakpoint ||
        (typeof window !== 'undefined' && window.innerWidth < GRAPH_GEOMETRY_LAYOUT_CONFIG.mobileBreakpoint);

  const cx = centerOrigin || scaleMode === 'sigma-world' ? 0 : width / 2;
  const cy = centerOrigin || scaleMode === 'sigma-world' ? 0 : height / 2;
  const tuning = getGraphTuningState();

  if (layout === 'radial') {
    const tags = [...nodes.filter((n) => (n.group ?? 0) === 0)];
    const others = [...nodes.filter((n) => (n.group ?? 0) !== 0)];

    if (useCurrentOrder) {
      const normAngle = (n: SolverGraphNode, count: number) =>
        (((Math.atan2((n.y ?? cy) - cy, (n.x ?? cx) - cx) + Math.PI / Math.max(1, count)) % (2 * Math.PI)) +
          2 * Math.PI) %
        (2 * Math.PI);
      tags.sort((a, b) => normAngle(a, tags.length) - normAngle(b, tags.length));
      others.sort((a, b) => normAngle(a, others.length) - normAngle(b, others.length));
    }

    let innerRadius: number;
    let outerRadius: number;
    if (scaleMode === 'sigma-world') {
      innerRadius = 5 * (tuning.radialInnerRatio / GRAPH_GEOMETRY_LAYOUT_CONFIG.radialInnerRatio);
      outerRadius = 12 * (tuning.radialOuterRatio / GRAPH_GEOMETRY_LAYOUT_CONFIG.radialOuterRatio);
    } else {
      const minDim = Math.min(width, height);
      innerRadius = Math.max(
        GRAPH_GEOMETRY_LAYOUT_CONFIG.radialMinInner2D *
          (tuning.radialInnerRatio / GRAPH_GEOMETRY_LAYOUT_CONFIG.radialInnerRatio),
        minDim * tuning.radialInnerRatio
      );
      outerRadius = Math.max(
        GRAPH_GEOMETRY_LAYOUT_CONFIG.radialMinOuter2D *
          (tuning.radialOuterRatio / GRAPH_GEOMETRY_LAYOUT_CONFIG.radialOuterRatio),
        minDim * tuning.radialOuterRatio
      );
    }

    tags.forEach((n, idx) => {
      const theta = (2 * Math.PI * idx) / Math.max(1, tags.length);
      targets[n.id] = {
        x: cx + innerRadius * Math.cos(theta),
        y: cy + innerRadius * Math.sin(theta),
      };
    });

    others.forEach((n, idx) => {
      const theta = (2 * Math.PI * idx) / Math.max(1, others.length);
      targets[n.id] = {
        x: cx + outerRadius * Math.cos(theta),
        y: cy + outerRadius * Math.sin(theta),
      };
    });

    signature = `${tags.map((n) => n.id).join(',')}|${others.map((n) => n.id).join(',')}`;
    return { targets, signature };
  }

  if (layout === 'columns') {
    const categories = GRAPH_GEOMETRY_LAYOUT_CONFIG.columnsCategoryOrder.map((grp) => [
      ...nodes.filter((n) => (n.group ?? 0) === grp),
    ]);

    if (useCurrentOrder) {
      categories.forEach((catNodes) => {
        catNodes.sort((a, b) => (isMobile ? (a.x ?? 0) - (b.x ?? 0) : (a.y ?? 0) - (b.y ?? 0)));
      });
    }

    if (scaleMode === 'sigma-world') {
      if (isMobile) {
        categories.forEach((catNodes, catIdx) => {
          const rowY = (catIdx - (categories.length - 1) / 2) * 4;
          catNodes.forEach((n, idx) => {
            targets[n.id] = {
              x: catNodes.length > 1 ? (idx - (catNodes.length - 1) / 2) * (20 / (catNodes.length - 1)) : 0,
              y: rowY,
            };
          });
        });
      } else {
        categories.forEach((catNodes, catIdx) => {
          const colX = (catIdx - (categories.length - 1) / 2) * 5;
          catNodes.forEach((n, idx) => {
            targets[n.id] = {
              x: colX,
              y: catNodes.length > 1 ? (idx - (catNodes.length - 1) / 2) * (20 / (catNodes.length - 1)) : 0,
            };
          });
        });
      }
    } else if (paddedColumns) {
      const padX = Math.max(
        GRAPH_GEOMETRY_LAYOUT_CONFIG.columnsMinPadX,
        width * GRAPH_GEOMETRY_LAYOUT_CONFIG.columnsPadXRatio
      );
      const padY = Math.max(
        GRAPH_GEOMETRY_LAYOUT_CONFIG.columnsMinPadY,
        height * GRAPH_GEOMETRY_LAYOUT_CONFIG.columnsPadYRatio
      );
      const usableW = width - padX * 2;
      const usableH = height - padY * 2;

      if (isMobile) {
        categories.forEach((catNodes, catIdx) => {
          const rowY = padY + (catIdx + 0.5) * (usableH / categories.length);
          catNodes.forEach((n, idx) => {
            targets[n.id] = {
              x: padX + (idx + 0.5) * (usableW / Math.max(1, catNodes.length)),
              y: rowY,
            };
          });
        });
      } else {
        categories.forEach((catNodes, catIdx) => {
          const colX = padX + (catIdx + 0.5) * (usableW / categories.length);
          catNodes.forEach((n, idx) => {
            targets[n.id] = {
              x: colX,
              y: padY + (idx + 0.5) * (usableH / Math.max(1, catNodes.length)),
            };
          });
        });
      }
    } else if (centerOrigin) {
      if (isMobile) {
        categories.forEach((catNodes, catIdx) => {
          const rowY = ((catIdx + 1) / (categories.length + 1) - 0.5) * height;
          catNodes.forEach((n, idx) => {
            targets[n.id] = {
              x: ((idx + 1) / (catNodes.length + 1) - 0.5) * width,
              y: rowY,
            };
          });
        });
      } else {
        categories.forEach((catNodes, catIdx) => {
          const colX = ((catIdx + 1) / (categories.length + 1) - 0.5) * width;
          catNodes.forEach((n, idx) => {
            targets[n.id] = {
              x: colX,
              y: ((idx + 1) / (catNodes.length + 1) - 0.5) * height,
            };
          });
        });
      }
    } else {
      if (isMobile) {
        categories.forEach((catNodes, catIdx) => {
          const rowY = (catIdx + 1) * (height / (categories.length + 1));
          catNodes.forEach((n, idx) => {
            targets[n.id] = {
              x: (idx + 1) * (width / (catNodes.length + 1)),
              y: rowY,
            };
          });
        });
      } else {
        categories.forEach((catNodes, catIdx) => {
          const colX = (catIdx + 1) * (width / (categories.length + 1));
          catNodes.forEach((n, idx) => {
            targets[n.id] = {
              x: colX,
              y: (idx + 1) * (height / (catNodes.length + 1)),
            };
          });
        });
      }
    }

    signature = categories.map((cat) => cat.map((n) => n.id).join(',')).join('|');
    return { targets, signature };
  }

  return { targets, signature };
}

export function compute3DGeometryTargets(
  nodes: readonly SolverGraphNode[],
  layout: string,
  useCurrentOrder = false,
  isMobile = typeof window !== 'undefined' && window.innerWidth < GRAPH_GEOMETRY_LAYOUT_CONFIG.mobileBreakpoint
): { targets: Record<string, Point3D>; signature: string } {
  const targets: Record<string, Point3D> = {};
  let signature = '';
  if (nodes.length === 0) return { targets, signature };

  if (layout === 'radial') {
    const tags = [...nodes.filter((n) => (n.group ?? 0) === 0)];
    const others = [...nodes.filter((n) => (n.group ?? 0) !== 0)];

    if (useCurrentOrder) {
      const normAngle = (n: SolverGraphNode, count: number) =>
        (((Math.atan2(n.y || 0, n.x || 0) + Math.PI / Math.max(1, count)) % (2 * Math.PI)) + 2 * Math.PI) %
        (2 * Math.PI);
      tags.sort((a, b) => normAngle(a, tags.length) - normAngle(b, tags.length));
      others.sort((a, b) => normAngle(a, others.length) - normAngle(b, others.length));
    }

    const tuning = getGraphTuningState();
    const innerR =
      GRAPH_GEOMETRY_LAYOUT_CONFIG.radialInner3D *
      (tuning.radialInnerRatio / GRAPH_GEOMETRY_LAYOUT_CONFIG.radialInnerRatio);
    const outerR =
      GRAPH_GEOMETRY_LAYOUT_CONFIG.radialOuter3D *
      (tuning.radialOuterRatio / GRAPH_GEOMETRY_LAYOUT_CONFIG.radialOuterRatio);

    tags.forEach((n, idx) => {
      const theta = (2 * Math.PI * idx) / Math.max(1, tags.length);
      targets[n.id] = {
        x: innerR * Math.cos(theta),
        y: innerR * Math.sin(theta),
        z: 0,
      };
    });

    others.forEach((n, idx) => {
      const theta = (2 * Math.PI * idx) / Math.max(1, others.length);
      targets[n.id] = {
        x: outerR * Math.cos(theta),
        y: outerR * Math.sin(theta),
        z: 0,
      };
    });

    signature = `${tags.map((n) => n.id).join(',')}|${others.map((n) => n.id).join(',')}`;
    return { targets, signature };
  }

  if (layout === 'columns') {
    const categories = GRAPH_GEOMETRY_LAYOUT_CONFIG.columnsCategoryOrder.map((grp) => [
      ...nodes.filter((n) => (n.group ?? 0) === grp),
    ]);
    const heightFactor = 25;
    const widthFactor = 25;

    if (useCurrentOrder) {
      categories.forEach((catNodes) => {
        catNodes.sort((a, b) => (isMobile ? (a.x || 0) - (b.x || 0) : (a.y || 0) - (b.y || 0)));
      });
    }

    if (isMobile) {
      categories.forEach((catNodes, catIdx) => {
        const rowY = (catIdx - (categories.length - 1) / 2) * 55;
        catNodes.forEach((n, idx) => {
          targets[n.id] = {
            x: catNodes.length > 1 ? (idx - (catNodes.length - 1) / 2) * widthFactor : 0,
            y: rowY,
            z: 0,
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
            z: 0,
          };
        });
      });
    }

    signature = categories.map((cat) => cat.map((n) => n.id).join(',')).join('|');
    return { targets, signature };
  }

  return { targets, signature };
}
