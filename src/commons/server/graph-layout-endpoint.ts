import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  type CanonicalGraphPayload,
  type GraphLayoutPayload,
  type GraphLayoutPositions,
  type VisualizationEngineType,
} from '@commons/shared/graph-payload';
import {
  solve3DForceLayout,
  solveCytoscapeCoseLayout,
  solveD3ForceLayout,
  solveSigmaForceAtlas2Layout,
  solveVisNetworkForceLayout,
  type Point2D,
  type Point3D,
} from '@commons/shared/graph-solvers';
import { getCanonicalGraphPayloadArtifact } from './graph-payload-endpoint';

const SOLVER_VERSION = 'v10';

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

function to2DLayoutPositions(map: Record<string, Point2D>): GraphLayoutPositions {
  const positions: GraphLayoutPositions = {};
  for (const [id, pt] of Object.entries(map)) {
    positions[id] = [pt.x, pt.y];
  }
  return positions;
}

function to3DLayoutPositions(map: Record<string, Point3D>): GraphLayoutPositions {
  const positions: GraphLayoutPositions = {};
  for (const [id, pt] of Object.entries(map)) {
    positions[id] = [pt.x, pt.y, pt.z];
  }
  return positions;
}

function computeEnginePositions(
  engine: VisualizationEngineType,
  canonical: CanonicalGraphPayload
): GraphLayoutPositions {
  switch (engine) {
    case 'sigma':
      return to2DLayoutPositions(solveSigmaForceAtlas2Layout(canonical));
    case 'cytoscape':
      return to2DLayoutPositions(solveCytoscapeCoseLayout(canonical));
    case 'd3':
      return to2DLayoutPositions(solveD3ForceLayout(canonical));
    case '3d-force-graph':
      return to3DLayoutPositions(solve3DForceLayout(canonical));
    case 'vis-network':
      return to2DLayoutPositions(solveVisNetworkForceLayout(canonical));
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
