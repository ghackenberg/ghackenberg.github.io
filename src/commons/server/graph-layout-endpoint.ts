import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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
  initialCoords,
  type CanonicalGraphPayload,
  type GraphLayoutPayload,
  type GraphLayoutPositions,
  type VisualizationEngineType,
} from '@commons/shared/graph-payload';
import { getCanonicalGraphPayloadArtifact } from './graph-payload-endpoint';

const SOLVER_VERSION = 'v5';

export const VISUALIZATION_ENGINES: readonly VisualizationEngineType[] = [
  'cytoscape',
  'sigma',
  'd3',
  'vis-network',
  '3d-force-graph',
] as const;

export interface GraphLayoutBundle {
  engine: VisualizationEngineType;
  hash: string;
  topologyHash: string;
  slug: string;
  filename: string;
  url: string;
  json: string;
  payload: GraphLayoutPayload;
}

const memoryLayoutCache = new Map<VisualizationEngineType, GraphLayoutBundle>();

function round2(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round(val * 100) / 100;
}

export function computeTopologyHash(canonical: CanonicalGraphPayload): string {
  const degreeCounts = new Map<string, number>();
  for (const conn of canonical.connections) {
    const src = conn.source ?? conn.sourceId;
    const tgt = conn.target ?? conn.targetId;
    degreeCounts.set(src, (degreeCounts.get(src) || 0) + 1);
    degreeCounts.set(tgt, (degreeCounts.get(tgt) || 0) + 1);
  }

  const nodeTopology = canonical.nodes.map((n) => [
    n.id,
    n.group,
    n.size,
    n.connectionCount ?? degreeCounts.get(n.id) ?? 0,
  ]);

  const edgeTopology = canonical.connections.map((c) => [
    c.source ?? c.sourceId,
    c.target ?? c.targetId,
    c.weight ?? 1,
  ]);

  const seed = JSON.stringify([SOLVER_VERSION, nodeTopology, edgeTopology]);
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 12);
}

function solveSigmaLayout(canonical: CanonicalGraphPayload): GraphLayoutPositions {
  const graph = new Graph();
  const nodes = canonical.nodes;
  const total = nodes.length;

  nodes.forEach((n, i) => {
    const init = initialCoords(i, total);
    graph.addNode(n.id, {
      x: init.x,
      y: init.y,
      size: 5,
    });
  });

  canonical.connections.forEach((c) => {
    const src = c.source ?? c.sourceId;
    const tgt = c.target ?? c.targetId;
    if (src !== tgt && graph.hasNode(src) && graph.hasNode(tgt) && !graph.hasEdge(src, tgt)) {
      graph.addUndirectedEdge(src, tgt);
    }
  });

  forceAtlas2.assign(graph, {
    iterations: 400,
    settings: {
      gravity: 0.8,
      scalingRatio: 1,
      slowDown: 3,
    },
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

  const positions: GraphLayoutPositions = {};
  graph.forEachNode((nodeId) => {
    const x = Number(graph.getNodeAttribute(nodeId, 'x') || 0) - meanX;
    const y = Number(graph.getNodeAttribute(nodeId, 'y') || 0) - meanY;
    positions[nodeId] = [round2(x), round2(y)];
  });

  return positions;
}

function solveCytoscapeLayout(canonical: CanonicalGraphPayload): GraphLayoutPositions {
  const nodes = canonical.nodes;
  const total = nodes.length;
  const nodeIds = new Set(nodes.map((n) => n.id));

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

  canonical.connections.forEach((c, idx) => {
    const src = c.source ?? c.sourceId;
    const tgt = c.target ?? c.targetId;
    if (nodeIds.has(src) && nodeIds.has(tgt)) {
      elements.push({
        data: {
          id: `${src}--${tgt}--${idx}`,
          source: src,
          target: tgt,
          weight: c.weight ?? 1,
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
    idealEdgeLength: () => 100,
    nodeOverlap: 20,
    componentSpacing: 100,
    nodeRepulsion: () => 400000,
    edgeElasticity: () => 100,
    nestingFactor: 5,
    gravity: 80,
    numIter: 1000,
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

  const positions: GraphLayoutPositions = {};
  cy.nodes().forEach((n) => {
    const pos = n.position();
    positions[n.id()] = [round2(pos.x - meanX), round2(pos.y - meanY)];
  });
  cy.destroy();

  return positions;
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

function solveD3Layout(canonical: CanonicalGraphPayload): GraphLayoutPositions {
  const nodes = canonical.nodes;
  const total = nodes.length;
  const nodeIds = new Set(nodes.map((n) => n.id));

  const simNodes: D3HeadlessNode[] = nodes.map((n, i) => {
    const init = initialCoords(i, total);
    const radius = Math.max(5, Math.min(28, Math.sqrt(n.size || 1) * 2.5 + 3));
    return {
      id: n.id,
      size: n.size || 1,
      radius,
      x: init.x,
      y: init.y,
    };
  });

  const simLinks: D3HeadlessLink[] = canonical.connections
    .map((c) => ({
      source: c.source ?? c.sourceId,
      target: c.target ?? c.targetId,
      weight: c.weight ?? 1,
    }))
    .filter((l) => nodeIds.has(String(l.source)) && nodeIds.has(String(l.target)));

  const simulation = d3
    .forceSimulation<D3HeadlessNode>(simNodes)
    .force(
      'link',
      d3
        .forceLink<D3HeadlessNode, D3HeadlessLink>(simLinks)
        .id((d) => d.id)
        .distance(80)
        .strength(0.2)
    )
    .force(
      'charge',
      d3
        .forceManyBody<D3HeadlessNode>()
        .strength((d) => -40 - d.radius * 8)
        .distanceMax(350)
    )
    .force('center', d3.forceCenter<D3HeadlessNode>(0, 0).strength(0.08))
    .force(
      'collide',
      d3
        .forceCollide<D3HeadlessNode>()
        .radius((d) => d.radius + 6)
        .iterations(2)
    )
    .force('x', d3.forceX<D3HeadlessNode>(0).strength(0.06))
    .force('y', d3.forceY<D3HeadlessNode>(0).strength(0.06))
    .stop();

  simulation.tick(400);

  const positions: GraphLayoutPositions = {};
  for (const n of simNodes) {
    positions[n.id] = [round2(n.x), round2(n.y)];
  }
  return positions;
}

function solve3DForceGraphLayout(canonical: CanonicalGraphPayload): GraphLayoutPositions {
  const nodes = canonical.nodes;
  const total = nodes.length;
  const nodeIds = new Set(nodes.map((n) => n.id));
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

  const simLinks: SimLink3D[] = canonical.connections
    .map((c) => ({
      source: c.source ?? c.sourceId,
      target: c.target ?? c.targetId,
    }))
    .filter((l) => nodeIds.has(String(l.source)) && nodeIds.has(String(l.target)));

  const simulation = forceSimulation3D(simNodes, 3)
    .stop()
    .alphaDecay(0.004)
    .force(
      'link',
      forceLink3D(simLinks)
        .id((d: SimNode3D) => d.id)
        .distance(30)
    )
    .force('charge', forceManyBody3D().strength(-120))
    .force('center', forceCenter3D(0, 0, 0));

  simulation.tick(1200);

  const positions: GraphLayoutPositions = {};
  for (const n of simNodes) {
    positions[n.id] = [round2(n.x), round2(n.y), round2(n.z)];
  }
  return positions;
}

function solveVisNetworkLayout(canonical: CanonicalGraphPayload): GraphLayoutPositions {
  const nodes = canonical.nodes;
  const total = nodes.length;

  const nodeIndexById = new Map<string, number>();
  nodes.forEach((n, idx) => nodeIndexById.set(n.id, idx));

  const edges: [number, number][] = [];
  const connectedEdgeCounts = new Array<number>(total).fill(0);
  for (const c of canonical.connections) {
    const srcIdx = nodeIndexById.get(c.source ?? c.sourceId);
    const tgtIdx = nodeIndexById.get(c.target ?? c.targetId);
    if (srcIdx !== undefined && tgtIdx !== undefined) {
      edges.push([srcIdx, tgtIdx]);
      connectedEdgeCounts[srcIdx]++;
      if (srcIdx !== tgtIdx) {
        connectedEdgeCounts[tgtIdx]++;
      }
    }
  }

  interface VisSimNode {
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

  const simNodes: VisSimNode[] = nodes.map((n, i) => {
    const init = initialCoords(i, total);
    return {
      id: n.id,
      x: init.x,
      y: init.y,
      vx: 0,
      vy: 0,
      fx: 0,
      fy: 0,
      degree: connectedEdgeCounts[i],
      mass: 1,
    };
  });

  // Exact vis-network ForceAtlas2Based + SpringSolver + ForceSolver equations (vis-network.esm.js lines 36979-37337)
  const gravitationalConstant = -50;
  const centralGravity = 0.025;
  const springLength = 80;
  const edgeLength = springLength * 1.5; // continuous smooth edge without via node uses springLength * 1.5
  const springConstant = 0.08;
  const damping = 0.4;
  const maxVelocity = 50;
  const minVelocity = 0.75;
  const timestep = 0.5;
  const iterations = 500;

  for (let iter = 0; iter < iterations; iter++) {
    // 1. ForceAtlas2BasedCentralGravitySolver
    for (let i = 0; i < simNodes.length; i++) {
      const n = simNodes[i];
      const dx = -n.x;
      const dy = -n.y;
      const gravityForce = centralGravity * (n.degree + 1) * n.mass;
      n.fx = dx * gravityForce;
      n.fy = dy * gravityForce;
    }

    // 2. ForceAtlas2BasedRepulsionSolver (avoidOverlap = 0)
    for (let i = 0; i < simNodes.length; i++) {
      const ni = simNodes[i];
      for (let j = i + 1; j < simNodes.length; j++) {
        const nj = simNodes[j];
        const dx = ni.x - nj.x;
        const dy = ni.y - nj.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const distSq = distance * distance;

        const gravityForceI = (gravitationalConstant * ni.mass * nj.mass * (ni.degree + 1)) / distSq;
        ni.fx -= dx * gravityForceI;
        ni.fy -= dy * gravityForceI;

        const gravityForceJ = (gravitationalConstant * ni.mass * nj.mass * (nj.degree + 1)) / distSq;
        nj.fx += dx * gravityForceJ;
        nj.fy += dy * gravityForceJ;
      }
    }

    // 3. SpringSolver
    for (const [uIdx, vIdx] of edges) {
      if (uIdx === vIdx) continue;
      const u = simNodes[uIdx];
      const v = simNodes[vIdx];
      const dx = u.x - v.x;
      const dy = u.y - v.y;
      const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
      const springForce = (springConstant * (edgeLength - distance)) / distance;
      const fx = dx * springForce;
      const fy = dy * springForce;
      u.fx += fx;
      u.fy += fy;
      v.fx -= fx;
      v.fy -= fy;
    }

    // 4. ForceSolver (Velocity integration)
    let maxNodeVelocity = 0;
    for (let i = 0; i < simNodes.length; i++) {
      const n = simNodes[i];
      const dx = n.fx - damping * n.vx;
      const ax = dx / n.mass;
      n.vx += ax * timestep;
      if (Math.abs(n.vx) > maxVelocity) {
        n.vx = n.vx > 0 ? maxVelocity : -maxVelocity;
      }
      n.x += n.vx * timestep;

      const dy = n.fy - damping * n.vy;
      const ay = dy / n.mass;
      n.vy += ay * timestep;
      if (Math.abs(n.vy) > maxVelocity) {
        n.vy = n.vy > 0 ? maxVelocity : -maxVelocity;
      }
      n.y += n.vy * timestep;

      const totalVel = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (totalVel > maxNodeVelocity) {
        maxNodeVelocity = totalVel;
      }
    }

    if (iter > 50 && maxNodeVelocity < minVelocity) {
      break;
    }
  }

  const positions: GraphLayoutPositions = {};
  for (const n of simNodes) {
    positions[n.id] = [round2(n.x), round2(n.y)];
  }
  return positions;
}

function computeEnginePositions(
  engine: VisualizationEngineType,
  canonical: CanonicalGraphPayload
): GraphLayoutPositions {
  switch (engine) {
    case 'sigma':
      return solveSigmaLayout(canonical);
    case 'cytoscape':
      return solveCytoscapeLayout(canonical);
    case 'd3':
      return solveD3Layout(canonical);
    case '3d-force-graph':
      return solve3DForceGraphLayout(canonical);
    case 'vis-network':
      return solveVisNetworkLayout(canonical);
  }
}

function writeCacheFileWithRetry(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      return;
    } catch {
      // Retry on transient Windows file indexer lock
    }
  }
}

export async function getGraphLayoutBundle(
  engine: VisualizationEngineType
): Promise<GraphLayoutBundle> {
  const { payload: canonical } = await getCanonicalGraphPayloadArtifact();
  const topologyHash = computeTopologyHash(canonical);

  const memCached = memoryLayoutCache.get(engine);
  if (memCached && memCached.topologyHash === topologyHash) {
    return memCached;
  }

  const cacheDir = path.join(process.cwd(), '.cache', 'graph-layouts');
  const cacheFile = path.join(cacheDir, `${engine}-${topologyHash}.json`);

  let payload: GraphLayoutPayload | null = null;
  let json = '';

  if (fs.existsSync(cacheFile)) {
    try {
      const raw = fs.readFileSync(cacheFile, 'utf8');
      const parsed = JSON.parse(raw) as GraphLayoutPayload;
      if (
        parsed &&
        parsed.engine === engine &&
        parsed.topologyHash === topologyHash &&
        parsed.positions &&
        typeof parsed.positions === 'object'
      ) {
        payload = parsed;
        json = JSON.stringify(parsed);
      }
    } catch {
      payload = null;
    }
  }

  if (!payload) {
    const positions = computeEnginePositions(engine, canonical);
    payload = {
      engine,
      topologyHash,
      positions,
    };
    json = JSON.stringify(payload);
    writeCacheFileWithRetry(cacheFile, json);
  }

  const hash = crypto.createHash('md5').update(json).digest('hex').slice(0, 8);
  const slug = `${engine}-${hash}`;
  const filename = `graph-layout-${slug}.json`;
  const url = `/api/${filename}`;

  const bundle: GraphLayoutBundle = {
    engine,
    hash,
    topologyHash,
    slug,
    filename,
    url,
    json,
    payload,
  };

  memoryLayoutCache.set(engine, bundle);
  return bundle;
}

export async function getGraphLayoutEndpointUrl(
  engine: VisualizationEngineType | string
): Promise<string> {
  const normalizedEngine: VisualizationEngineType =
    engine === '3d-force'
      ? '3d-force-graph'
      : (VISUALIZATION_ENGINES.includes(engine as VisualizationEngineType)
          ? (engine as VisualizationEngineType)
          : 'cytoscape');
  const bundle = await getGraphLayoutBundle(normalizedEngine);
  return bundle.url;
}
