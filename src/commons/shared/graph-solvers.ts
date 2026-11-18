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
  getNodeDegreeRepulsionFactor,
  getNodeRestRadiusScale,
  getSigmaForceAtlas2Settings,
  isBackboneEdge,
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
  /** Cluster hub node id this (hub) node was split/derived from during re-clustering. */
  originClusterId?: string;
}

export interface SolverSeedPoint {
  x: number;
  y: number;
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
  /** Warm-start seeds (current live positions). Absent => byte-identical cold start. */
  seedPositions?: ReadonlyMap<string, SolverSeedPoint> | Record<string, SolverSeedPoint>;
  /** Timeline anchors: previous settled positions; nodes with an anchor get a weak spring toward it. */
  anchorPositions?: ReadonlyMap<string, SolverSeedPoint> | Record<string, SolverSeedPoint>;
  /** Anchor strength (d3 forceX/forceY-equivalent units); absent/0 disables anchors (cold path unchanged). */
  anchorStrength?: number;
  /** Optional per-node anchor weights in [0, 1]; when provided, omitted/0 nodes receive zero anchor force. */
  anchorWeights?: ReadonlyMap<string, number> | Record<string, number>;
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

export interface AsyncSolverOptions {
  shouldCancel?: () => boolean;
  frameBudgetMs?: number;
}

function yieldToNextFrame(): Promise<void> {
  if (typeof requestAnimationFrame === 'function') {
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
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

export function computeGraphCommunities(
  nodes: readonly SolverGraphNode[],
  connections: readonly SolverGraphEdge[]
): { communityByNode: Map<string, number>; communityCount: number } {
  const nCount = nodes.length;
  const communityByNode = new Map<string, number>();
  if (nCount === 0) {
    return { communityByNode, communityCount: 0 };
  }

  // Direct Tag-Cluster Supernode community assignment when group === 0 represents Tag Clusters (2..24 hubs)
  const tagNodes: { node: SolverGraphNode; idx: number }[] = [];
  nodes.forEach((n, idx) => {
    if ((n.group ?? 0) === 0) {
      tagNodes.push({ node: n, idx });
    }
  });

  if (tagNodes.length >= 2 && tagNodes.length <= 24) {
    const K = tagNodes.length;
    const tagClusterIndexById = new Map<string, number>();
    tagNodes.forEach((entry, cIdx) => {
      tagClusterIndexById.set(entry.node.id, cIdx);
    });

    const bestClusterByContentId = new Map<string, { cIdx: number; weight: number; tagId: string }>();
    for (const c of connections) {
      const { src, tgt, weight } = resolveEdgeEndpoints(c);
      let contentId: string | null = null;
      let tagId: string | null = null;
      let cIdx: number | undefined;

      if (tagClusterIndexById.has(tgt) && !tagClusterIndexById.has(src)) {
        contentId = src;
        tagId = tgt;
        cIdx = tagClusterIndexById.get(tgt);
      } else if (tagClusterIndexById.has(src) && !tagClusterIndexById.has(tgt)) {
        contentId = tgt;
        tagId = src;
        cIdx = tagClusterIndexById.get(src);
      }

      if (contentId !== null && tagId !== null && cIdx !== undefined) {
        const prev = bestClusterByContentId.get(contentId);
        if (
          !prev ||
          weight > prev.weight + 1e-9 ||
          (Math.abs(weight - prev.weight) <= 1e-9 && tagId.localeCompare(prev.tagId) < 0)
        ) {
          bestClusterByContentId.set(contentId, { cIdx, weight, tagId });
        }
      }
    }

    const rawComm = new Array<number>(nCount).fill(0);
    const membersByRawComm: number[][] = Array.from({ length: K }, () => []);
    for (let i = 0; i < nCount; i++) {
      const n = nodes[i];
      const tagC = tagClusterIndexById.get(n.id);
      const assigned = tagC !== undefined ? tagC : (bestClusterByContentId.get(n.id)?.cIdx ?? 0);
      rawComm[i] = assigned;
      membersByRawComm[assigned].push(i);
    }

    const sortedCommOrder = Array.from({ length: K }, (_, c) => c).sort((a, b) => {
      const diff = membersByRawComm[b].length - membersByRawComm[a].length;
      if (diff !== 0) return diff;
      return tagNodes[a].idx - tagNodes[b].idx;
    });

    const rankByRawComm = new Array<number>(K).fill(0);
    sortedCommOrder.forEach((oldC, newRank) => {
      rankByRawComm[oldC] = newRank;
    });

    for (let i = 0; i < nCount; i++) {
      communityByNode.set(nodes[i].id, rankByRawComm[rawComm[i]]);
    }

    return { communityByNode, communityCount: K };
  }

  const nodeIndexById = new Map<string, number>();
  nodes.forEach((n, idx) => nodeIndexById.set(n.id, idx));

  const adj: Map<number, number>[] = Array.from({ length: nCount }, () => new Map<number, number>());
  const rawDegree = new Array<number>(nCount).fill(0);
  let totalWeight2M = 0;

  for (const c of connections) {
    const { src, tgt, weight } = resolveEdgeEndpoints(c);
    const u = nodeIndexById.get(src);
    const v = nodeIndexById.get(tgt);
    if (u === undefined || v === undefined || u === v) continue;
    const affinity = isBackboneEdge(weight) ? weight * 4.0 : weight * 0.12;
    const prevUV = adj[u].get(v) || 0;
    adj[u].set(v, prevUV + affinity);
    adj[v].set(u, prevUV + affinity);
    rawDegree[u] += affinity;
    rawDegree[v] += affinity;
    totalWeight2M += 2 * affinity;
  }

  if (totalWeight2M <= 0) {
    for (const n of nodes) communityByNode.set(n.id, 0);
    return { communityByNode, communityCount: 1 };
  }

  // 1. Deterministic Louvain local moving pass
  const gamma = 1.05;
  const comm = Array.from({ length: nCount }, (_, i) => i);
  const sigmaTot = [...rawDegree];

  for (let pass = 0; pass < 24; pass++) {
    let moved = false;
    for (let i = 0; i < nCount; i++) {
      const ki = rawDegree[i];
      if (ki <= 0) continue;
      const oldC = comm[i];
      sigmaTot[oldC] -= ki;

      const commWeights = new Map<number, number>();
      commWeights.set(oldC, 0);
      for (const [j, w] of adj[i].entries()) {
        const cj = comm[j];
        commWeights.set(cj, (commWeights.get(cj) || 0) + w);
      }

      let bestC = oldC;
      let bestGain = -Infinity;
      for (const [cId, wIC] of commWeights.entries()) {
        const gain = wIC - gamma * ((sigmaTot[cId] * ki) / totalWeight2M);
        if (gain > bestGain + 1e-12 || (Math.abs(gain - bestGain) <= 1e-12 && cId < bestC)) {
          bestGain = gain;
          bestC = cId;
        }
      }

      comm[i] = bestC;
      sigmaTot[bestC] += ki;
      if (bestC !== oldC) moved = true;
    }
    if (!moved) break;
  }

  // Compact initial communities
  let commMap = new Map<number, number>();
  let nextId = 0;
  for (let i = 0; i < nCount; i++) {
    const c = comm[i];
    if (!commMap.has(c)) commMap.set(c, nextId++);
    comm[i] = commMap.get(c)!;
  }

  const buildCommunityLists = (cArr: number[], count: number) => {
    const members: number[][] = Array.from({ length: count }, () => []);
    for (let i = 0; i < nCount; i++) {
      members[cArr[i]].push(i);
    }
    return members;
  };

  const mergeTwoCommunities = (cSmall: number, cTarget: number) => {
    for (let i = 0; i < nCount; i++) {
      if (comm[i] === cSmall) comm[i] = cTarget;
    }
    commMap = new Map<number, number>();
    nextId = 0;
    for (let i = 0; i < nCount; i++) {
      const c = comm[i];
      if (!commMap.has(c)) commMap.set(c, nextId++);
      comm[i] = commMap.get(c)!;
    }
  };

  // 2. Hierarchical greedy modularity merge & small-community (< 14 nodes) consolidation (targeting 8..11 communities)
  while (nextId > 1) {
    const members = buildCommunityLists(comm, nextId);
    // Find smallest community
    let minIdx = -1;
    let minSize = Infinity;
    for (let c = 0; c < nextId; c++) {
      if (members[c].length < minSize) {
        minSize = members[c].length;
        minIdx = c;
      }
    }

    if (minSize >= 14 && nextId <= 11) {
      break;
    }

    // Merge minIdx into the neighbor community with highest affinity (penalizing oversized targets)
    const interWeights = new Array<number>(nextId).fill(0);
    for (const u of members[minIdx]) {
      for (const [v, w] of adj[u].entries()) {
        const cv = comm[v];
        if (cv !== minIdx) {
          interWeights[cv] += w;
        }
      }
    }

    let bestTarget = -1;
    let bestScore = -Infinity;
    for (let c = 0; c < nextId; c++) {
      if (c === minIdx) continue;
      const w = interWeights[c];
      if (w > 0) {
        const sizePenalty = Math.pow(Math.max(10, members[c].length), 0.45);
        const score = w / sizePenalty;
        if (score > bestScore) {
          bestScore = score;
          bestTarget = c;
        }
      }
    }

    if (bestTarget === -1) {
      // Disconnected component: merge into smallest other community
      let fallbackSize = Infinity;
      for (let c = 0; c < nextId; c++) {
        if (c === minIdx) continue;
        if (members[c].length < fallbackSize) {
          fallbackSize = members[c].length;
          bestTarget = c;
        }
      }
    }

    if (bestTarget === -1) break;
    mergeTwoCommunities(minIdx, bestTarget);
  }

  // 3. Sort community IDs 0 .. K-1 descending by node count (tie-break by earliest node index)
  const finalMembers = buildCommunityLists(comm, nextId);
  const sortedCommOrder = Array.from({ length: nextId }, (_, c) => c).sort((a, b) => {
    const diff = finalMembers[b].length - finalMembers[a].length;
    if (diff !== 0) return diff;
    return (finalMembers[a][0] ?? 0) - (finalMembers[b][0] ?? 0);
  });

  const rankByOldComm = new Array<number>(nextId).fill(0);
  sortedCommOrder.forEach((oldC, newRank) => {
    rankByOldComm[oldC] = newRank;
  });

  for (let i = 0; i < nCount; i++) {
    communityByNode.set(nodes[i].id, rankByOldComm[comm[i]]);
  }

  return { communityByNode, communityCount: nextId };
}

interface InitialSpiralPositions {
  init2D: Point2D[];
  init3D: Point3D[];
}

function lookupAnchorWeight(input: SolverGraphInput, id: string): number {
  const weights = input.anchorWeights;
  if (!weights) return 1;
  const w = weights instanceof Map ? weights.get(id) : (weights as Record<string, number>)[id];
  return typeof w === 'number' && Number.isFinite(w) ? Math.max(0, Math.min(1, w)) : 0;
}

function lookupAnchor(input: SolverGraphInput, id: string): SolverSeedPoint | undefined {
  const anchors = input.anchorPositions;
  if (!anchors || !((input.anchorStrength ?? 0) > 0)) return undefined;
  if (!(lookupAnchorWeight(input, id) > 0)) return undefined;
  const raw = anchors instanceof Map ? anchors.get(id) : (anchors as Record<string, SolverSeedPoint>)[id];
  if (!raw || !Number.isFinite(raw.x) || !Number.isFinite(raw.y)) return undefined;
  return raw;
}

/** Damped post-blend helper (retained for reference; CoSE/ForceAtlas2 use pure warm-start + cluster-weighted Procrustes). */
export function anchorBlendLambda(strength: number): number {
  return 1 - 1 / (1 + 10 * Math.max(0, strength));
}

function lookupSeed(
  seeds: NonNullable<SolverGraphInput['seedPositions']>,
  id: string
): SolverSeedPoint | undefined {
  const raw = seeds instanceof Map ? seeds.get(id) : (seeds as Record<string, SolverSeedPoint>)[id];
  if (!raw || !Number.isFinite(raw.x) || !Number.isFinite(raw.y)) return undefined;
  return raw;
}

/**
 * Overlays warm-start seeds onto the deterministic cold spiral layout (mutates the maps).
 * Priority: own seed > seed of originClusterId (siblings offset ~20px) > coverage-weighted
 * centroid of connected content seeds > cold position. Fully deterministic (no RNG, sorted ids).
 */
function applyWarmStartSeeds(
  input: SolverGraphInput,
  hubIds: ReadonlySet<string>,
  primaryHubByNode: ReadonlyMap<string, string>,
  hubEdgesByNode: ReadonlyMap<string, { hubId: string; weight: number }[]>,
  pos2DById: Map<string, Point2D>,
  pos3DById: Map<string, Point3D>
): void {
  const seeds = input.seedPositions!;
  const goldenAngle = 2.3999632297286533;
  const nodes = input.nodes;
  const coldHub2D = new Map<string, Point2D>();
  const coldHub3D = new Map<string, Point3D>();
  for (const id of hubIds) {
    coldHub2D.set(id, { ...pos2DById.get(id)! });
    coldHub3D.set(id, { ...pos3DById.get(id)! });
  }

  const contentSeedByHub = new Map<string, { x: number; y: number; z: number; w: number; hasZ: boolean }>();
  for (const n of nodes) {
    if (hubIds.has(n.id)) continue;
    const s = lookupSeed(seeds, n.id);
    if (!s) continue;
    for (const e of hubEdgesByNode.get(n.id) ?? []) {
      const w = Math.max(0.01, e.weight);
      let acc = contentSeedByHub.get(e.hubId);
      if (!acc) {
        acc = { x: 0, y: 0, z: 0, w: 0, hasZ: false };
        contentSeedByHub.set(e.hubId, acc);
      }
      acc.x += s.x * w;
      acc.y += s.y * w;
      acc.z += (s.z ?? 0) * w;
      acc.w += w;
      if (typeof s.z === 'number') acc.hasZ = true;
    }
  }

  const hubNodes = nodes
    .filter((n) => hubIds.has(n.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const siblingRank = new Map<string, number>();
  const siblingCountByOrigin = new Map<string, number>();
  for (const h of hubNodes) {
    const origin = h.originClusterId;
    if (!origin || lookupSeed(seeds, h.id)) continue;
    const base = siblingCountByOrigin.get(origin) ?? (hubIds.has(origin) ? 1 : 0);
    siblingRank.set(h.id, base);
    siblingCountByOrigin.set(origin, base + 1);
  }

  for (const h of hubNodes) {
    const own = lookupSeed(seeds, h.id);
    const cold3 = coldHub3D.get(h.id)!;
    const cs = contentSeedByHub.get(h.id);
    let p2: Point2D | undefined;
    let p3: Point3D | undefined;
    if (own) {
      p2 = { x: own.x, y: own.y };
      p3 = { x: own.x, y: own.y, z: own.z ?? cold3.z };
    } else {
      const originSeed = h.originClusterId ? lookupSeed(seeds, h.originClusterId) : undefined;
      if (originSeed) {
        const rank = siblingRank.get(h.id) ?? 0;
        let dx2 = Math.cos(rank * goldenAngle);
        let dy2 = Math.sin(rank * goldenAngle);
        if (cs && cs.w > 0) {
          const tx = cs.x / cs.w - originSeed.x;
          const ty = cs.y / cs.w - originSeed.y;
          const len = Math.hypot(tx, ty);
          if (len > 1) {
            dx2 = tx / len;
            dy2 = ty / len;
          }
        }
        const off = rank * 20;
        p2 = { x: originSeed.x + dx2 * off, y: originSeed.y + dy2 * off };
        p3 = {
          x: originSeed.x + dx2 * off,
          y: originSeed.y + dy2 * off,
          z: (originSeed.z ?? cold3.z) + Math.sin(rank * goldenAngle * 0.5) * off * 0.5,
        };
      } else if (cs && cs.w > 0) {
        p2 = { x: cs.x / cs.w, y: cs.y / cs.w };
        p3 = { x: cs.x / cs.w, y: cs.y / cs.w, z: cs.hasZ ? cs.z / cs.w : cold3.z };
      }
    }
    if (p2 && p3) {
      pos2DById.set(h.id, p2);
      pos3DById.set(h.id, p3);
    }
  }

  for (const n of nodes) {
    if (hubIds.has(n.id)) continue;
    const s = lookupSeed(seeds, n.id);
    if (s) {
      pos2DById.set(n.id, { x: s.x, y: s.y });
      const c3 = pos3DById.get(n.id);
      pos3DById.set(n.id, { x: s.x, y: s.y, z: s.z ?? c3?.z ?? 0 });
      continue;
    }
    const hubId = primaryHubByNode.get(n.id);
    const c2 = pos2DById.get(n.id);
    const c3 = pos3DById.get(n.id);
    const ch2 = hubId ? coldHub2D.get(hubId) : undefined;
    const ch3 = hubId ? coldHub3D.get(hubId) : undefined;
    const nh2 = hubId ? pos2DById.get(hubId) : undefined;
    const nh3 = hubId ? pos3DById.get(hubId) : undefined;
    if (c2 && ch2 && nh2) {
      pos2DById.set(n.id, { x: nh2.x + (c2.x - ch2.x), y: nh2.y + (c2.y - ch2.y) });
    }
    if (c3 && ch3 && nh3) {
      pos3DById.set(n.id, {
        x: nh3.x + (c3.x - ch3.x),
        y: nh3.y + (c3.y - ch3.y),
        z: nh3.z + (c3.z - ch3.z),
      });
    }
  }
}

function buildInitialSpiralPositions(input: SolverGraphInput): InitialSpiralPositions {
  const nodes = input.nodes;
  const nCount = nodes.length;
  const hubIdsSet = new Set<string>();
  const primaryHubByNode = new Map<string, string>();
  const primaryWeightByNode = new Map<string, number>();
  const hubEdgesByNode = new Map<string, { hubId: string; weight: number }[]>();

  for (const n of nodes) {
    if ((n.group ?? 0) === 0) {
      hubIdsSet.add(n.id);
      primaryHubByNode.set(n.id, n.id);
      primaryWeightByNode.set(n.id, 1.0);
    }
  }

  for (const c of input.connections) {
    const { src, tgt, weight } = resolveEdgeEndpoints(c);
    const srcIsHub = hubIdsSet.has(src);
    const tgtIsHub = hubIdsSet.has(tgt);
    if (srcIsHub && !tgtIsHub) {
      let list = hubEdgesByNode.get(tgt);
      if (!list) {
        list = [];
        hubEdgesByNode.set(tgt, list);
      }
      list.push({ hubId: src, weight });
      const prev = primaryWeightByNode.get(tgt);
      if (prev === undefined || weight > prev) {
        primaryWeightByNode.set(tgt, weight);
        primaryHubByNode.set(tgt, src);
      }
    } else if (tgtIsHub && !srcIsHub) {
      let list = hubEdgesByNode.get(src);
      if (!list) {
        list = [];
        hubEdgesByNode.set(src, list);
      }
      list.push({ hubId: tgt, weight });
      const prev = primaryWeightByNode.get(src);
      if (prev === undefined || weight > prev) {
        primaryWeightByNode.set(src, weight);
        primaryHubByNode.set(src, tgt);
      }
    }
  }

  const sortedHubIds = Array.from(hubIdsSet).sort((a, b) => a.localeCompare(b));
  const goldenAngle = 2.3999632297286533;
  const hubPos2DById = new Map<string, Point2D>();
  const hubPos3DById = new Map<string, Point3D>();
  const hubCount = sortedHubIds.length;

  sortedHubIds.forEach((hubId, hubRank) => {
    const angle = hubRank * goldenAngle;
    const r2 = 125 * Math.sqrt(hubRank + 1);
    hubPos2DById.set(hubId, {
      x: Math.cos(angle) * r2,
      y: Math.sin(angle) * r2,
    });

    const yNorm = hubCount > 1 ? 1 - (hubRank / (hubCount - 1)) * 2 : 0;
    const radialNorm = Math.sqrt(Math.max(0, 1 - yNorm * yNorm));
    const r3 = 42 * (hubRank + 0.8);
    hubPos3DById.set(hubId, {
      x: Math.cos(angle) * radialNorm * r3,
      y: yNorm * r3,
      z: Math.sin(angle) * radialNorm * r3,
    });
  });

  const membersByHub = new Map<string, SolverGraphNode[]>();
  for (const hubId of sortedHubIds) {
    membersByHub.set(hubId, []);
  }
  const unassignedNodes: SolverGraphNode[] = [];

  for (const n of nodes) {
    if (hubIdsSet.has(n.id)) continue;
    const hubId = primaryHubByNode.get(n.id);
    if (hubId && membersByHub.has(hubId)) {
      membersByHub.get(hubId)!.push(n);
    } else {
      unassignedNodes.push(n);
    }
  }

  const pos2DById = new Map<string, Point2D>(hubPos2DById);
  const pos3DById = new Map<string, Point3D>(hubPos3DById);

  sortedHubIds.forEach((hubId, hubRank) => {
    const fallback2D = hubPos2DById.get(hubId)!;
    const fallback3D = hubPos3DById.get(hubId)!;
    const members = membersByHub.get(hubId) ?? [];
    members.sort((a, b) => {
      const wDiff = (primaryWeightByNode.get(b.id) ?? 0) - (primaryWeightByNode.get(a.id) ?? 0);
      if (Math.abs(wDiff) > 1e-9) return wDiff;
      return a.id.localeCompare(b.id);
    });
    const mCount = members.length;
    const phaseOffset = hubRank * 0.75;
    members.forEach((m, localIdx) => {
      const incident = hubEdgesByNode.get(m.id) ?? [];
      let anchor2DX = 0;
      let anchor2DY = 0;
      let anchor3DX = 0;
      let anchor3DY = 0;
      let anchor3DZ = 0;
      let totalStiff = 0;
      for (const edge of incident) {
        const h2 = hubPos2DById.get(edge.hubId);
        const h3 = hubPos3DById.get(edge.hubId);
        if (!h2 || !h3) continue;
        const wStiff = Math.pow(Math.max(0.05, edge.weight), 2.1);
        anchor2DX += h2.x * wStiff;
        anchor2DY += h2.y * wStiff;
        anchor3DX += h3.x * wStiff;
        anchor3DY += h3.y * wStiff;
        anchor3DZ += h3.z * wStiff;
        totalStiff += wStiff;
      }
      const base2DX = totalStiff > 0 ? anchor2DX / totalStiff : fallback2D.x;
      const base2DY = totalStiff > 0 ? anchor2DY / totalStiff : fallback2D.y;
      const base3DX = totalStiff > 0 ? anchor3DX / totalStiff : fallback3D.x;
      const base3DY = totalStiff > 0 ? anchor3DY / totalStiff : fallback3D.y;
      const base3DZ = totalStiff > 0 ? anchor3DZ / totalStiff : fallback3D.z;

      const localAngle = phaseOffset + (localIdx + 1) * goldenAngle;
      const rLocal2D = 8 * Math.sqrt(localIdx + 1);
      pos2DById.set(m.id, {
        x: base2DX + Math.cos(localAngle) * rLocal2D,
        y: base2DY + Math.sin(localAngle) * rLocal2D,
      });

      const yNorm = mCount > 1 ? 1 - (localIdx / (mCount - 1)) * 2 : 0;
      const radialNorm = Math.sqrt(Math.max(0, 1 - yNorm * yNorm));
      const rLocal3D = 8 * Math.cbrt(localIdx + 1);
      pos3DById.set(m.id, {
        x: base3DX + Math.cos(localAngle) * radialNorm * rLocal3D,
        y: base3DY + yNorm * rLocal3D,
        z: base3DZ + Math.sin(localAngle) * radialNorm * rLocal3D,
      });
    });
  });

  unassignedNodes.sort((a, b) => a.id.localeCompare(b.id));
  unassignedNodes.forEach((n, idx) => {
    const angle = (hubCount + idx) * goldenAngle;
    const r2 = 12 * Math.sqrt(idx + 1);
    pos2DById.set(n.id, {
      x: Math.cos(angle) * r2,
      y: Math.sin(angle) * r2,
    });
    const r3 = 16 * Math.cbrt(idx + 1);
    pos3DById.set(n.id, {
      x: Math.cos(angle) * r3,
      y: 0,
      z: Math.sin(angle) * r3,
    });
  });

  if (input.seedPositions) {
    applyWarmStartSeeds(
      input,
      hubIdsSet,
      primaryHubByNode,
      hubEdgesByNode,
      pos2DById,
      pos3DById
    );
  }

  const init2D: Point2D[] = new Array<Point2D>(nCount);
  const init3D: Point3D[] = new Array<Point3D>(nCount);
  for (let i = 0; i < nCount; i++) {
    const id = nodes[i].id;
    init2D[i] = pos2DById.get(id) ?? { x: 0, y: 0 };
    init3D[i] = pos3DById.get(id) ?? { x: 0, y: 0, z: 0 };
  }

  return { init2D, init3D };
}

function enforceClusterPillClearance2D(
  nodes: readonly SolverGraphNode[],
  rawCoordsById: Map<string, Point2D>
): void {
  const hubs: { id: string; pt: Point2D }[] = [];
  const contentIds: string[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const pt = rawCoordsById.get(n.id);
    if (!pt) continue;
    if ((n.group ?? 0) === 0) {
      hubs.push({ id: n.id, pt });
    } else {
      contentIds.push(n.id);
    }
  }

  if (hubs.length === 0 || contentIds.length === 0) return;

  const boxHalfW = 79.5;
  const boxHalfH = 17.2;

  const isInsideAnyHub = (x: number, y: number): boolean => {
    for (let k = 0; k < hubs.length; k++) {
      const hp = hubs[k].pt;
      if (Math.abs(x - hp.x) < boxHalfW && Math.abs(y - hp.y) < boxHalfH) {
        return true;
      }
    }
    return false;
  };

  for (let i = 0; i < contentIds.length; i++) {
    const pt = rawCoordsById.get(contentIds[i]);
    if (!pt) continue;
    for (let h = 0; h < hubs.length; h++) {
      const hub = hubs[h].pt;
      const dx = pt.x - hub.x;
      const dy = pt.y - hub.y;
      if (Math.abs(dx) < boxHalfW && Math.abs(dy) < boxHalfH) {
        const sy = dy === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dy);
        const sx = dx === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dx);
        const stagger = (i % 5) * 0.85;
        const targetY = boxHalfH + 0.8 + stagger;
        const targetX = boxHalfW + 1.2 + stagger;
        const candidates: Point2D[] = [
          { x: pt.x, y: hub.y + sy * targetY },
          { x: pt.x, y: hub.y - sy * targetY },
          { x: hub.x + sx * targetX, y: pt.y },
          { x: hub.x - sx * targetX, y: pt.y },
          { x: hub.x + sx * targetX, y: hub.y + sy * targetY },
          { x: hub.x - sx * targetX, y: hub.y - sy * targetY },
        ];
        for (const cand of candidates) {
          if (!isInsideAnyHub(cand.x, cand.y)) {
            pt.x = cand.x;
            pt.y = cand.y;
            break;
          }
        }
      }
    }
  }
}

function enforceClusterPillClearance3D(
  nodes: readonly SolverGraphNode[],
  rawCoordsById: Map<string, Point3D>
): void {
  const hubs: { id: string; pt: Point3D }[] = [];
  const contentIds: string[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const pt = rawCoordsById.get(n.id);
    if (!pt) continue;
    if ((n.group ?? 0) === 0) {
      hubs.push({ id: n.id, pt });
    } else {
      contentIds.push(n.id);
    }
  }

  if (hubs.length === 0 || contentIds.length === 0) return;

  const boxHalfW = 79.5;
  const boxHalfH = 17.2;

  const isInsideAnyHub = (x: number, y: number): boolean => {
    for (let k = 0; k < hubs.length; k++) {
      const hp = hubs[k].pt;
      if (Math.abs(x - hp.x) < boxHalfW && Math.abs(y - hp.y) < boxHalfH) {
        return true;
      }
    }
    return false;
  };

  for (let i = 0; i < contentIds.length; i++) {
    const pt = rawCoordsById.get(contentIds[i]);
    if (!pt) continue;
    for (let h = 0; h < hubs.length; h++) {
      const hub = hubs[h].pt;
      const dx = pt.x - hub.x;
      const dy = pt.y - hub.y;
      if (Math.abs(dx) < boxHalfW && Math.abs(dy) < boxHalfH) {
        const sy = dy === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dy);
        const sx = dx === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dx);
        const stagger = (i % 5) * 0.85;
        const targetY = boxHalfH + 0.8 + stagger;
        const targetX = boxHalfW + 1.2 + stagger;
        const candidates: Point2D[] = [
          { x: pt.x, y: hub.y + sy * targetY },
          { x: pt.x, y: hub.y - sy * targetY },
          { x: hub.x + sx * targetX, y: pt.y },
          { x: hub.x - sx * targetX, y: pt.y },
          { x: hub.x + sx * targetX, y: hub.y + sy * targetY },
          { x: hub.x - sx * targetX, y: hub.y - sy * targetY },
        ];
        for (const cand of candidates) {
          if (!isInsideAnyHub(cand.x, cand.y)) {
            pt.x = cand.x;
            pt.y = cand.y;
            break;
          }
        }
      }
    }
  }
}

function centerPositions2D(
  nodes: readonly SolverGraphNode[],
  rawCoordsById: Map<string, Point2D>
): Record<string, Point2D> {
  const nCount = nodes.length;
  if (nCount === 0) return {};

  enforceClusterPillClearance2D(nodes, rawCoordsById);

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < nCount; i++) {
    const pt = rawCoordsById.get(nodes[i].id);
    if (pt) {
      sumX += pt.x;
      sumY += pt.y;
    }
  }
  const meanX = sumX / nCount;
  const meanY = sumY / nCount;

  const targets: Record<string, Point2D> = {};
  for (let i = 0; i < nCount; i++) {
    const id = nodes[i].id;
    const pt = rawCoordsById.get(id) ?? { x: 0, y: 0 };
    targets[id] = {
      x: round2(pt.x - meanX),
      y: round2(pt.y - meanY),
    };
  }
  return targets;
}

function centerPositions3D(
  nodes: readonly SolverGraphNode[],
  rawCoordsById: Map<string, Point3D>
): Record<string, Point3D> {
  const nCount = nodes.length;
  if (nCount === 0) return {};

  enforceClusterPillClearance3D(nodes, rawCoordsById);

  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  for (let i = 0; i < nCount; i++) {
    const pt = rawCoordsById.get(nodes[i].id);
    if (pt) {
      sumX += pt.x;
      sumY += pt.y;
      sumZ += pt.z;
    }
  }
  const meanX = sumX / nCount;
  const meanY = sumY / nCount;
  const meanZ = sumZ / nCount;

  const targets: Record<string, Point3D> = {};
  for (let i = 0; i < nCount; i++) {
    const id = nodes[i].id;
    const pt = rawCoordsById.get(id) ?? { x: 0, y: 0, z: 0 };
    targets[id] = {
      x: round2(pt.x - meanX),
      y: round2(pt.y - meanY),
      z: round2(pt.z - meanZ),
    };
  }
  return targets;
}

function buildSigmaForceAtlas2Graph(input: SolverGraphInput, init: InitialSpiralPositions): Graph {
  const graph = new Graph();
  const nodes = input.nodes;
  const baseRadius = getGraphStyleTokens(false).nodeRadius;

  nodes.forEach((n, i) => {
    const p = init.init2D[i];
    graph.addNode(n.id, {
      x: p.x,
      y: p.y,
      size: baseRadius * getNodeRestRadiusScale(n.group, n.size),
    });
  });

  input.connections.forEach((c) => {
    const { src, tgt, weight } = resolveEdgeEndpoints(c);
    if (src && tgt && src !== tgt && graph.hasNode(src) && graph.hasNode(tgt) && !graph.hasEdge(src, tgt)) {
      const m = getEdgePhysicsMetrics(weight);
      const fa2Weight = Math.max(
        0.0002,
        Math.min(0.55, 0.075 * (m.stiffnessFactor / Math.pow(m.distanceFactor, 1.2)))
      );
      graph.addUndirectedEdge(src, tgt, {
        weight: fa2Weight,
      });
    }
  });
  return graph;
}

function extractSigmaCenteredTargets(
  graph: Graph,
  nodes: readonly SolverGraphNode[],
  input?: SolverGraphInput
): Record<string, Point2D> {
  const rawMap = new Map<string, Point2D>();
  graph.forEachNode((nodeId) => {
    rawMap.set(nodeId, {
      x: Number(graph.getNodeAttribute(nodeId, 'x') || 0),
      y: Number(graph.getNodeAttribute(nodeId, 'y') || 0),
    });
  });
  void input;
  return centerPositions2D(nodes, rawMap);
}

export function solveSigmaForceAtlas2Layout(input: SolverGraphInput): Record<string, Point2D> {
  const init = buildInitialSpiralPositions(input);
  const graph = buildSigmaForceAtlas2Graph(input, init);
  const settings = getSigmaForceAtlas2Settings();
  const totalIter = GRAPH_PHYSICS_CONFIG.sigmaIterations;
  for (let done = 0; done < totalIter; ) {
    const step = Math.min(20, totalIter - done);
    forceAtlas2.assign(graph, {
      iterations: step,
      settings,
    });
    done += step;
  }
  return extractSigmaCenteredTargets(graph, input.nodes, input);
}

export async function solveSigmaForceAtlas2LayoutAsync(
  input: SolverGraphInput,
  options?: AsyncSolverOptions
): Promise<Record<string, Point2D> | null> {
  const init = buildInitialSpiralPositions(input);
  const graph = buildSigmaForceAtlas2Graph(input, init);
  const settings = getSigmaForceAtlas2Settings();
  const totalIter = GRAPH_PHYSICS_CONFIG.sigmaIterations;
  const budgetMs = options?.frameBudgetMs ?? 8.5;
  let sliceStart = performance.now();

  for (let done = 0; done < totalIter; ) {
    if (options?.shouldCancel?.()) return null;
    const step = Math.min(20, totalIter - done);
    forceAtlas2.assign(graph, {
      iterations: step,
      settings,
    });
    done += step;
    if (done < totalIter && performance.now() - sliceStart >= budgetMs) {
      await yieldToNextFrame();
      if (options?.shouldCancel?.()) return null;
      sliceStart = performance.now();
    }
  }

  return extractSigmaCenteredTargets(graph, input.nodes, input);
}

function createCytoscapeHeadlessInstance(
  input: SolverGraphInput,
  init: InitialSpiralPositions
): cytoscape.Core {
  const nodes = input.nodes;
  const nodeIds = new Set(nodes.map((n) => n.id));

  const elements: cytoscape.ElementDefinition[] = [];
  nodes.forEach((n, i) => {
    const p = init.init2D[i];
    elements.push({
      data: {
        id: n.id,
        group: n.group ?? 0,
        weight: n.size || 1,
      },
      position: {
        x: p.x,
        y: p.y,
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

  return cytoscape({
    headless: true,
    elements,
    layout: {
      name: 'preset',
      fit: false,
    },
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
}

function buildCytoscapeCoseLayoutOptions(
  animate: boolean
): cytoscape.CoseLayoutOptions & { animationThreshold?: number } {
  const tuning = getGraphTuningState();
  return {
    name: 'cose',
    animate,
    ...(animate ? { refresh: 2, animationThreshold: 1e9 } : {}),
    fit: false,
    randomize: false,
    idealEdgeLength: (edge: cytoscape.EdgeSingular) =>
      getCoseEdgeIdealLength(Number(edge.data('weight') || 0.5)),
    nodeOverlap: 20,
    componentSpacing: 100,
    nodeRepulsion: (node: cytoscape.NodeSingular) => {
      const isHub = Number(node.data('group') ?? 0) === 0;
      const repFactor = isHub
        ? 0.55 * getNodeDegreeRepulsionFactor(2)
        : getNodeDegreeRepulsionFactor(node.degree(false));
      return Math.round(
        GRAPH_PHYSICS_CONFIG.coseNodeRepulsion * tuning.repulsionScale * repFactor
      );
    },
    edgeElasticity: (edge: cytoscape.EdgeSingular) =>
      getCoseEdgeElasticity(Number(edge.data('weight') || 0.5)),
    nestingFactor: 5,
    gravity: GRAPH_PHYSICS_CONFIG.coseGravity * tuning.gravityScale,
    numIter: GRAPH_PHYSICS_CONFIG.coseIterations,
  };
}

/** CoSE uses Math.random for coincident-node jitter; pin it to a fixed PRNG so warm-started solves are deterministic. */
function runCoseDeterministic(cy: cytoscape.Core): void {
  const original = Math.random;
  let state = 0x9e3779b9;
  Math.random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try {
    cy.layout(buildCytoscapeCoseLayoutOptions(false)).run();
  } finally {
    Math.random = original;
  }
}
function extractCytoscapeCenteredTargets(
  cy: cytoscape.Core,
  nodes: readonly SolverGraphNode[],
  input?: SolverGraphInput
): Record<string, Point2D> {
  const rawMap = new Map<string, Point2D>();
  cy.nodes().forEach((n) => {
    const pos = n.position();
    rawMap.set(n.id(), { x: pos.x, y: pos.y });
  });
  void input;
  return centerPositions2D(nodes, rawMap);
}

export function solveCytoscapeCoseLayout(input: SolverGraphInput): Record<string, Point2D> {
  const init = buildInitialSpiralPositions(input);
  const cy = createCytoscapeHeadlessInstance(input, init);
  runCoseDeterministic(cy);
  const targets = extractCytoscapeCenteredTargets(cy, input.nodes, input);
  cy.destroy();
  return targets;
}

export async function solveCytoscapeCoseLayoutAsync(
  input: SolverGraphInput,
  options?: AsyncSolverOptions
): Promise<Record<string, Point2D> | null> {
  if (options?.shouldCancel?.()) {
    return null;
  }

  await yieldToNextFrame();
  if (options?.shouldCancel?.()) {
    return null;
  }

  const init = buildInitialSpiralPositions(input);
  const cy = createCytoscapeHeadlessInstance(input, init);
  await yieldToNextFrame();
  if (options?.shouldCancel?.()) {
    cy.destroy();
    return null;
  }

  runCoseDeterministic(cy);
  const targets = extractCytoscapeCenteredTargets(cy, input.nodes, input);
  cy.destroy();
  return targets;
}

interface D3HeadlessNode extends d3.SimulationNodeDatum {
  id: string;
  group: number;
  size: number;
  radius: number;
  degree: number;
  x: number;
  y: number;
}

interface D3HeadlessLink extends d3.SimulationLinkDatum<D3HeadlessNode> {
  source: string | D3HeadlessNode;
  target: string | D3HeadlessNode;
  weight: number;
}

function createD3HeadlessSimulation(
  input: SolverGraphInput,
  init: InitialSpiralPositions
): {
  simNodes: D3HeadlessNode[];
  simulation: d3.Simulation<D3HeadlessNode, D3HeadlessLink>;
} {
  const nodes = input.nodes;
  const nodeIds = new Set(nodes.map((n) => n.id));
  const tuning = getGraphTuningState();
  const baseRadius = getGraphStyleTokens(false).nodeRadius;
  const collisionRadius = baseRadius + GRAPH_PHYSICS_CONFIG.collisionPadding2D;

  const simLinks: D3HeadlessLink[] = input.connections
    .map((c) => {
      const { src, tgt, weight } = resolveEdgeEndpoints(c);
      return { source: src, target: tgt, weight };
    })
    .filter((l) => nodeIds.has(String(l.source)) && nodeIds.has(String(l.target)));

  const degreeById = new Map<string, number>();
  for (const c of input.connections) {
    const { src, tgt } = resolveEdgeEndpoints(c);
    if (!nodeIds.has(src) || !nodeIds.has(tgt)) continue;
    degreeById.set(src, (degreeById.get(src) || 0) + 1);
    if (src !== tgt) {
      degreeById.set(tgt, (degreeById.get(tgt) || 0) + 1);
    }
  }

  const simNodes: D3HeadlessNode[] = nodes.map((n, i) => {
    const p = init.init2D[i];
    return {
      id: n.id,
      group: n.group ?? 0,
      size: n.size || 1,
      radius: baseRadius,
      degree: degreeById.get(n.id) || 0,
      x: p.x,
      y: p.y,
    };
  });

  const centerStrength = GRAPH_PHYSICS_CONFIG.d3CenterGravityStrength * tuning.gravityScale;
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
        .strength((d) => {
          const repFactor =
            d.group === 0
              ? 0.55 * getNodeDegreeRepulsionFactor(2)
              : getNodeDegreeRepulsionFactor(d.degree);
          return GRAPH_PHYSICS_CONFIG.d3ChargeStrength * tuning.repulsionScale * repFactor;
        })
        .distanceMax(GRAPH_PHYSICS_CONFIG.d3ChargeDistanceMax)
    )
    .force(
      'collide',
      d3
        .forceCollide<D3HeadlessNode>()
        .radius((d) => Math.round(collisionRadius * getNodeRestRadiusScale(d.group, d.size)))
        .iterations(2)
    )
    .force('x', d3.forceX<D3HeadlessNode>(0).strength(centerStrength))
    .force('y', d3.forceY<D3HeadlessNode>(0).strength(centerStrength))
    .stop();
  if (input.seedPositions) simulation.alpha(0.45);
  const anchoredD3 = simNodes
    .map((n) => ({ n, a: lookupAnchor(input, n.id), w: lookupAnchorWeight(input, n.id) }))
    .filter((e) => e.a !== undefined);
  if (anchoredD3.length > 0) {
    const strength = input.anchorStrength ?? 0;
    simulation.force('anchor', (alpha: number) => {
      // per-node weight applied below
      for (const e of anchoredD3) {
        e.n.vx = (e.n.vx || 0) + (e.a!.x - e.n.x) * strength * alpha * e.w;
        e.n.vy = (e.n.vy || 0) + (e.a!.y - e.n.y) * strength * alpha * e.w;
      }
    });
  }

  return { simNodes, simulation };
}

export function solveD3ForceLayout(input: SolverGraphInput): Record<string, Point2D> {
  const init = buildInitialSpiralPositions(input);
  const { simNodes, simulation } = createD3HeadlessSimulation(input, init);
  simulation.tick(500);

  const rawMap = new Map<string, Point2D>();
  for (const n of simNodes) {
    rawMap.set(n.id, { x: n.x, y: n.y });
  }
  return centerPositions2D(input.nodes, rawMap);
}

export async function solveD3ForceLayoutAsync(
  input: SolverGraphInput,
  options?: AsyncSolverOptions
): Promise<Record<string, Point2D> | null> {
  const init = buildInitialSpiralPositions(input);
  const { simNodes, simulation } = createD3HeadlessSimulation(input, init);
  const totalTicks = 500;
  const budgetMs = options?.frameBudgetMs ?? 8.5;
  let sliceStart = performance.now();

  for (let i = 0; i < totalTicks; i++) {
    simulation.tick(1);
    if ((i & 7) === 7) {
      if (options?.shouldCancel?.()) return null;
      if (i + 1 < totalTicks && performance.now() - sliceStart >= budgetMs) {
        await yieldToNextFrame();
        if (options?.shouldCancel?.()) return null;
        sliceStart = performance.now();
      }
    }
  }

  const rawMap = new Map<string, Point2D>();
  for (const n of simNodes) {
    rawMap.set(n.id, { x: n.x, y: n.y });
  }
  return centerPositions2D(input.nodes, rawMap);
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
  isHub: boolean;
  repulsionFactor: number;
  mass: number;
  ax?: number;
  ay?: number;
  aw?: number;
}

function stepVisNetworkIteration(
  simNodes: VisSolverNode[],
  edges: [number, number, number][],
  iter: number,
  iterations: number,
  gravitationalConstant: number,
  centralGravity: number,
  springConstant: number,
  damping: number,
  minSeparation: number,
  maxVelocity: number,
  timestep: number,
  heat = 1,
  anchorK = 0
): void {
  const cooling = Math.pow(0.015, iter / iterations) * heat;

  for (let i = 0; i < simNodes.length; i++) {
    const n = simNodes[i];
    const gravityForce = centralGravity * n.mass;
    n.fx = -n.x * gravityForce;
    n.fy = -n.y * gravityForce;
    if (anchorK > 0 && n.ax !== undefined && n.ay !== undefined) {
      n.fx += (n.ax - n.x) * anchorK * (n.aw ?? 1) * n.mass;
      n.fy += (n.ay - n.y) * anchorK * (n.aw ?? 1) * n.mass;
    }
  }

  for (let i = 0; i < simNodes.length; i++) {
    const ni = simNodes[i];
    for (let j = i + 1; j < simNodes.length; j++) {
      const nj = simNodes[j];
      const dx = ni.x - nj.x;
      const dy = ni.y - nj.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > 480 * 480) continue;
      const distance = Math.sqrt(distSq) || 0.5;

      let repForce =
        (gravitationalConstant * ni.repulsionFactor * nj.repulsionFactor) /
        (distance * Math.max(14, distance) * Math.pow(Math.max(28, distance) / 28, 0.55));
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
    const uShare = u.isHub ? 0.015 : 1.85;
    const vShare = v.isHub ? 0.015 : 1.85;
    u.fx += fx * uShare;
    u.fy += fy * uShare;
    v.fx -= fx * vShare;
    v.fy -= fy * vShare;
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

function createVisNetworkSolverState(input: SolverGraphInput, init: InitialSpiralPositions) {
  const nodes = input.nodes;
  const total = nodes.length;
  const tuning = getGraphTuningState();

  const nodeIndexById = new Map<string, number>();
  nodes.forEach((n, idx) => nodeIndexById.set(n.id, idx));

  const connectedEdgeCounts = new Array<number>(total).fill(0);
  const edges: [number, number, number][] = [];
  for (const c of input.connections) {
    const { src, tgt, weight } = resolveEdgeEndpoints(c);
    const srcIdx = nodeIndexById.get(src);
    const tgtIdx = nodeIndexById.get(tgt);
    if (srcIdx !== undefined && tgtIdx !== undefined) {
      connectedEdgeCounts[srcIdx]++;
      if (srcIdx !== tgtIdx) {
        connectedEdgeCounts[tgtIdx]++;
      }
      edges.push([srcIdx, tgtIdx, weight]);
    }
  }

  const simNodes: VisSolverNode[] = nodes.map((n, i) => {
    const p = init.init2D[i];
    const deg = connectedEdgeCounts[i];
    const isHub = (n.group ?? 0) === 0;
    return {
      id: n.id,
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      fx: 0,
      fy: 0,
      degree: deg,
      isHub,
      repulsionFactor: isHub
        ? 0.55 * getNodeDegreeRepulsionFactor(2)
        : getNodeDegreeRepulsionFactor(deg),
      mass: 1.0,
      ...(lookupAnchor(input, n.id)
        ? { ax: lookupAnchor(input, n.id)!.x, ay: lookupAnchor(input, n.id)!.y, aw: lookupAnchorWeight(input, n.id) }
        : {}),
    };
  });

  return {
    simNodes,
    edges,
    gravitationalConstant: GRAPH_PHYSICS_CONFIG.visRepulsionStrength * tuning.repulsionScale,
    centralGravity: GRAPH_PHYSICS_CONFIG.visCentralGravity * tuning.gravityScale,
    springConstant: GRAPH_PHYSICS_CONFIG.visSpringConstantBase,
    damping: GRAPH_PHYSICS_CONFIG.visDamping,
    minSeparation: (getGraphStyleTokens(false).nodeRadius + GRAPH_PHYSICS_CONFIG.collisionPadding2D) * 2,
    maxVelocity: 50,
    timestep: 0.5,
    iterations: GRAPH_PHYSICS_CONFIG.visIterations,
    heat: input.seedPositions ? 0.45 : 1,
    anchorK: input.anchorStrength ?? 0,
  };
}

function finalizeVisNetworkTargets(
  simNodes: VisSolverNode[],
  nodes: readonly SolverGraphNode[]
): Record<string, Point2D> {
  const rawMap = new Map<string, Point2D>();
  for (const n of simNodes) {
    rawMap.set(n.id, { x: n.x, y: n.y });
  }
  return centerPositions2D(nodes, rawMap);
}

export function solveVisNetworkForceLayout(input: SolverGraphInput): Record<string, Point2D> {
  const init = buildInitialSpiralPositions(input);
  const s = createVisNetworkSolverState(input, init);
  for (let iter = 0; iter < s.iterations; iter++) {
    stepVisNetworkIteration(
      s.simNodes,
      s.edges,
      iter,
      s.iterations,
      s.gravitationalConstant,
      s.centralGravity,
      s.springConstant,
      s.damping,
      s.minSeparation,
      s.maxVelocity,
      s.timestep,
      s.heat,
      s.anchorK
    );
  }
  return finalizeVisNetworkTargets(s.simNodes, input.nodes);
}

export async function solveVisNetworkForceLayoutAsync(
  input: SolverGraphInput,
  options?: AsyncSolverOptions
): Promise<Record<string, Point2D> | null> {
  const init = buildInitialSpiralPositions(input);
  const s = createVisNetworkSolverState(input, init);
  const budgetMs = options?.frameBudgetMs ?? 8.5;
  let sliceStart = performance.now();

  for (let iter = 0; iter < s.iterations; iter++) {
    stepVisNetworkIteration(
      s.simNodes,
      s.edges,
      iter,
      s.iterations,
      s.gravitationalConstant,
      s.centralGravity,
      s.springConstant,
      s.damping,
      s.minSeparation,
      s.maxVelocity,
      s.timestep,
      s.heat,
      s.anchorK
    );
    if ((iter & 7) === 7) {
      if (options?.shouldCancel?.()) return null;
      if (iter + 1 < s.iterations && performance.now() - sliceStart >= budgetMs) {
        await yieldToNextFrame();
        if (options?.shouldCancel?.()) return null;
        sliceStart = performance.now();
      }
    }
  }
  return finalizeVisNetworkTargets(s.simNodes, input.nodes);
}

interface SolverSimNode3D extends SimNode3D {
  group: number;
  degree: number;
}

function create3DForceSimulation(
  input: SolverGraphInput,
  init: InitialSpiralPositions
): {
  simNodes: SolverSimNode3D[];
  simulation: ReturnType<typeof forceSimulation3D>;
} {
  const nodes = input.nodes;
  const nodeIds = new Set(nodes.map((n) => n.id));
  const tuning = getGraphTuningState();

  const simLinks: SimLink3D[] = input.connections
    .map((c) => {
      const { src, tgt, weight } = resolveEdgeEndpoints(c);
      return { source: src, target: tgt, weight };
    })
    .filter((l) => nodeIds.has(String(l.source)) && nodeIds.has(String(l.target)));

  const degreeById = new Map<string, number>();
  for (const c of input.connections) {
    const { src, tgt } = resolveEdgeEndpoints(c);
    if (!nodeIds.has(src) || !nodeIds.has(tgt)) continue;
    degreeById.set(src, (degreeById.get(src) || 0) + 1);
    if (src !== tgt) {
      degreeById.set(tgt, (degreeById.get(tgt) || 0) + 1);
    }
  }

  const simNodes: SolverSimNode3D[] = nodes.map((n, i) => {
    const p = init.init3D[i];
    return {
      id: n.id,
      group: n.group ?? 0,
      val: 6,
      degree: degreeById.get(n.id) || 0,
      x: p.x,
      y: p.y,
      z: p.z,
    };
  });

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
        .strength((d: SimNode3D) => {
          const node3D = d as SolverSimNode3D;
          const repFactor =
            node3D.group === 0
              ? 0.55 * getNodeDegreeRepulsionFactor(2)
              : getNodeDegreeRepulsionFactor(node3D.degree ?? 0);
          return GRAPH_PHYSICS_CONFIG.force3DChargeStrength * tuning.repulsionScale * repFactor;
        })
        .distanceMax(240)
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
  if (input.seedPositions) simulation.alpha(0.45);
  const anchored3D = simNodes
    .map((n) => ({ n, a: lookupAnchor(input, n.id), w: lookupAnchorWeight(input, n.id) }))
    .filter((e) => e.a !== undefined);
  if (anchored3D.length > 0) {
    const strength = input.anchorStrength ?? 0;
    simulation.force('anchor', (alpha: number) => {
      // per-node weight applied below
      for (const e of anchored3D) {
        e.n.vx = (e.n.vx || 0) + (e.a!.x - (e.n.x || 0)) * strength * alpha * e.w;
        e.n.vy = (e.n.vy || 0) + (e.a!.y - (e.n.y || 0)) * strength * alpha * e.w;
        e.n.vz = (e.n.vz || 0) + ((e.a!.z ?? 0) - (e.n.z || 0)) * strength * alpha * e.w;
      }
    });
  }

  return { simNodes, simulation };
}

export function solve3DForceLayout(input: SolverGraphInput): Record<string, Point3D> {
  const init = buildInitialSpiralPositions(input);
  const { simNodes, simulation } = create3DForceSimulation(input, init);
  simulation.tick(GRAPH_PHYSICS_CONFIG.force3DIterations);

  const rawMap = new Map<string, Point3D>();
  for (const n of simNodes) {
    rawMap.set(n.id, { x: n.x, y: n.y, z: n.z });
  }
  return centerPositions3D(input.nodes, rawMap);
}

export async function solve3DForceLayoutAsync(
  input: SolverGraphInput,
  options?: AsyncSolverOptions
): Promise<Record<string, Point3D> | null> {
  const init = buildInitialSpiralPositions(input);
  const { simNodes, simulation } = create3DForceSimulation(input, init);
  const totalTicks = GRAPH_PHYSICS_CONFIG.force3DIterations;
  const budgetMs = options?.frameBudgetMs ?? 8.5;
  let sliceStart = performance.now();

  for (let i = 0; i < totalTicks; i++) {
    simulation.tick(1);
    if ((i & 7) === 7) {
      if (options?.shouldCancel?.()) return null;
      if (i + 1 < totalTicks && performance.now() - sliceStart >= budgetMs) {
        await yieldToNextFrame();
        if (options?.shouldCancel?.()) return null;
        sliceStart = performance.now();
      }
    }
  }

  const rawMap = new Map<string, Point3D>();
  for (const n of simNodes) {
    rawMap.set(n.id, { x: n.x, y: n.y, z: n.z });
  }
  return centerPositions3D(input.nodes, rawMap);
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
