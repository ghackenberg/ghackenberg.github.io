import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  CLUSTER_PALETTE,
  DEFAULT_TOPIC_CLUSTER_COUNT,
  buildCanonicalGraphPayload,
  buildGraphAdjacency,
  computeClusterCalloutPlacements2D,
  computeHopDistances,
  getCoseEdgeElasticity,
  getCoseEdgeIdealLength,
  getClusterPillDimensions,
  getContentGroupPolygonSides,
  getRegularPolygonUnitVertices,
  getAttenuatedNodeColor,
  getAttenuatedNodeScale,
  getActiveContentFilterGroup,
  getEdgeLinkDistance2D,
  getEdgePhysicsMetrics,
  getNodeBaseColor,
  getNodeRestRadiusScale,
  hydrateEnginePayloads,
  isDefaultGraphTuningState,
  isNodeDimmedByContentFilter,
  mixHexColorsOklab,
  reclusterCanonicalGraphPayload,
  resetContentFilterGroups,
  resetGraphTuningState,
  setGraphTuningState,
  toggleContentFilterGroup,
  type CanonicalGraphPayload,
} from '@commons/shared/graph-payload';
import {
  compute2DGeometryTargets,
  compute3DGeometryTargets,
  computeGraphCommunities,
  solve3DForceLayout,
  solve3DForceLayoutAsync,
  solveCytoscapeCoseLayout,
  solveCytoscapeCoseLayoutAsync,
  solveD3ForceLayout,
  solveD3ForceLayoutAsync,
  solveSigmaForceAtlas2Layout,
  solveSigmaForceAtlas2LayoutAsync,
  solveVisNetworkForceLayout,
  solveVisNetworkForceLayoutAsync,
  type Point2D,
  type Point3D,
  type SolverGraphNode,
} from '@commons/shared/graph-solvers';
import {
  createGraphDragPhysicsController2D,
  createGraphDragPhysicsController3D,
} from '@commons/client/graph-drag-controller';

const ROOT_DIR = process.cwd();
const CONTENT_DIR = path.join(ROOT_DIR, 'src', 'content');

interface ParsedCollectionEntry {
  id: string;
  body: string;
  data: {
    title: string;
    subtitle?: string;
    description?: string;
    pubDate?: string | Date;
    tags?: string[];
    abstract?: string;
    book?: string;
    event?: string;
    location?: string;
  };
}

interface RawFrontmatter {
  title?: string;
  subtitle?: string;
  description?: string;
  pubDate?: string | Date;
  tags?: string[];
  abstract?: string;
  book?: string;
}

function readCollectionEntries(collectionName: string): ParsedCollectionEntry[] {
  const dir = path.join(CONTENT_DIR, collectionName);
  if (!fs.existsSync(dir)) return [];

  const entries: ParsedCollectionEntry[] = [];
  const walk = (currentDir: string) => {
    const items = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(currentDir, item.name);
      if (item.isDirectory()) {
        if (collectionName !== 'tags' && (item.name === 'slides' || item.name === 'modules')) {
          continue;
        }
        walk(fullPath);
      } else if (/\.(md|mdx)$/i.test(item.name)) {
        if (collectionName !== 'tags' && !/^index\.(md|mdx)$/i.test(item.name)) {
          continue;
        }
        const raw = fs.readFileSync(fullPath, 'utf8');
        const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        const frontmatter: RawFrontmatter = match ? (YAML.parse(match[1]) as RawFrontmatter) : {};
        const relPath = path
          .relative(dir, fullPath)
          .replace(/\\/g, '/')
          .replace(/\.(md|mdx)$/i, '')
          .replace(/\/index$/i, '');

        entries.push({
          id: relPath,
          body: raw,
          data: {
            title: typeof frontmatter?.title === 'string' ? frontmatter.title : relPath,
            subtitle: typeof frontmatter?.subtitle === 'string' ? frontmatter.subtitle : undefined,
            description:
              typeof frontmatter?.description === 'string' ? frontmatter.description : undefined,
            pubDate:
              typeof frontmatter?.pubDate === 'string' || frontmatter?.pubDate instanceof Date
                ? frontmatter.pubDate
                : undefined,
            tags: Array.isArray(frontmatter?.tags)
              ? frontmatter.tags.map((t) => String(t))
              : undefined,
            abstract: typeof frontmatter?.abstract === 'string' ? frontmatter.abstract : undefined,
            book: typeof frontmatter?.book === 'string' ? frontmatter.book : undefined,
          },
        });
      }
    }
  };

  walk(dir);
  entries.sort((a, b) => a.id.localeCompare(b.id));
  return entries;
}

async function loadCanonicalGraph(): Promise<CanonicalGraphPayload> {
  const posts = readCollectionEntries('posts');
  const publications = readCollectionEntries('publications');
  const presentations = readCollectionEntries('presentations');
  const projects = readCollectionEntries('projects');
  const courses = readCollectionEntries('courses');
  const services = readCollectionEntries('services');
  const visualizations = readCollectionEntries('visualizations');
  const newsletters = readCollectionEntries('newsletters');
  const tags = readCollectionEntries('tags');

  return buildCanonicalGraphPayload({
    posts,
    publications,
    presentations,
    projects,
    courses,
    services,
    visualizations,
    newsletters,
    tags,
  });
}

function assertCondition(condition: boolean, message: string, failures: string[]): void {
  if (!condition) {
    failures.push(message);
  }
}

function scanPrivacyViolations(failures: string[]): void {
  const dirsToScan = [
    path.join(ROOT_DIR, 'src', 'pages', 'visualizations'),
    path.join(ROOT_DIR, 'src', 'content', 'visualizations'),
  ];
  const explicitFilesToScan = [
    path.join(ROOT_DIR, 'src', 'commons', 'client', 'vis-tooltip.tsx'),
    path.join(ROOT_DIR, 'src', 'commons', 'client', 'graph-drag-controller.ts'),
    path.join(ROOT_DIR, 'src', 'commons', 'shared', 'graph-payload.ts'),
    path.join(ROOT_DIR, 'src', 'commons', 'shared', 'graph-solvers.ts'),
  ];
  const storageRegex = /\b(localStorage|sessionStorage)\b/;

  const checkFile = (fullPath: string) => {
    if (!fs.existsSync(fullPath)) return;
    const content = fs.readFileSync(fullPath, 'utf8');
    if (storageRegex.test(content)) {
      failures.push(
        `[Gate 1: Privacy] Forbidden browser storage API in ${path.relative(ROOT_DIR, fullPath)}`
      );
    }
  };

  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/\.(ts|tsx|astro)$/i.test(entry.name)) {
        checkFile(fullPath);
      }
    }
  };

  for (const d of dirsToScan) {
    walk(d);
  }
  for (const f of explicitFilesToScan) {
    checkFile(f);
  }
}

interface ContentPairSets {
  relatedPairs: [string, string][];
  unrelatedPairs: [string, string][];
}

function buildContentPairSets(canonical: CanonicalGraphPayload): ContentPairSets {
  const allItemClusters = new Map<string, Set<string>>();
  const primaryClusterByItem = new Map<string, { clusterId: string; weight: number }>();

  for (const conn of canonical.connections) {
    const src = conn.source ?? conn.sourceId;
    const tgt = conn.target ?? conn.targetId;
    const w = conn.weight ?? 0.5;
    let uSet = allItemClusters.get(src);
    if (!uSet) {
      uSet = new Set<string>();
      allItemClusters.set(src, uSet);
    }
    uSet.add(tgt);

    const prev = primaryClusterByItem.get(src);
    if (!prev || w > prev.weight || (w === prev.weight && tgt < prev.clusterId)) {
      primaryClusterByItem.set(src, { clusterId: tgt, weight: w });
    }
  }

  const contentIds = canonical.nodes
    .filter((n) => n.group !== 0 && (allItemClusters.get(n.id)?.size ?? 0) > 0)
    .map((n) => n.id);

  const relatedPairs: [string, string][] = [];
  const unrelatedPairs: [string, string][] = [];

  for (let i = 0; i < contentIds.length; i++) {
    const u = contentIds[i];
    const uAll = allItemClusters.get(u)!;
    const uPrim = primaryClusterByItem.get(u);

    for (let j = i + 1; j < contentIds.length; j++) {
      const v = contentIds[j];
      const vAll = allItemClusters.get(v)!;
      const vPrim = primaryClusterByItem.get(v);

      let sharedAll = 0;
      for (const t of uAll) {
        if (vAll.has(t)) sharedAll++;
      }

      if (sharedAll === 0) {
        unrelatedPairs.push([u, v]);
        continue;
      }

      if (
        uPrim &&
        vPrim &&
        uPrim.clusterId === vPrim.clusterId &&
        uPrim.weight >= 0.6 &&
        vPrim.weight >= 0.6
      ) {
        relatedPairs.push([u, v]);
      }
    }
  }

  return { relatedPairs, unrelatedPairs };
}

function evaluateArchipelagoCorridors(
  name: string,
  positions: Record<string, { x: number; y: number; z?: number }>,
  canonical: CanonicalGraphPayload,
  communityByNode: Map<string, number>,
  communityCount: number,
  failures: string[]
): {
  islandRatio: number;
  meanMedianRadius: number;
  meanP85Radius: number;
  minCentroidDist: number;
  intraCommunityMean: number;
  interCommunityMean: number;
  overlapOrbitRatio: number;
} {
  const is3D = name === '3d-force-graph';
  const nodeGroupById = new Map<string, number>();
  for (const n of canonical.nodes) {
    nodeGroupById.set(n.id, n.group);
  }
  const edgeWeightLookup = new Map<string, number>();
  const allHubsByNode = new Map<string, { hubId: string; weight: number }[]>();
  for (const conn of canonical.connections) {
    const src = conn.source ?? conn.sourceId;
    const tgt = conn.target ?? conn.targetId;
    const w = conn.weight ?? 0.5;
    edgeWeightLookup.set(`${src}|${tgt}`, w);
    edgeWeightLookup.set(`${tgt}|${src}`, w);
    const srcGrp = nodeGroupById.get(src) ?? 0;
    const tgtGrp = nodeGroupById.get(tgt) ?? 0;
    if (srcGrp !== 0 && tgtGrp === 0) {
      const list = allHubsByNode.get(src) ?? [];
      list.push({ hubId: tgt, weight: w });
      allHubsByNode.set(src, list);
    } else if (tgtGrp !== 0 && srcGrp === 0) {
      const list = allHubsByNode.get(tgt) ?? [];
      list.push({ hubId: src, weight: w });
      allHubsByNode.set(tgt, list);
    }
  }

  const coDominantHubsByNode = new Map<string, { hubId: string; weight: number }[]>();
  const isSingleClusterCoreNode = new Map<string, boolean>();
  for (const [nodeId, list] of allHubsByNode.entries()) {
    let maxW = 0;
    for (const h of list) {
      if (h.weight > maxW) maxW = h.weight;
    }
    const coDom = list.filter((h) => h.weight >= maxW * 0.78);
    coDominantHubsByNode.set(nodeId, coDom);
    const secondW = list
      .filter((h) => h.weight < maxW - 1e-6)
      .reduce((m, h) => Math.max(m, h.weight), 0);
    isSingleClusterCoreNode.set(nodeId, coDom.length <= 1 && secondW <= maxW * 0.55);
  }

  const membersByComm: string[][] = Array.from({ length: communityCount }, () => []);
  const allCommMembers: string[][] = Array.from({ length: communityCount }, () => []);
  const hubIdsByComm: string[][] = Array.from({ length: communityCount }, () => []);
  for (const n of canonical.nodes) {
    const c = communityByNode.get(n.id) ?? 0;
    if (c >= 0 && c < communityCount) {
      allCommMembers[c].push(n.id);
      if (n.group === 0) {
        hubIdsByComm[c].push(n.id);
        membersByComm[c].push(n.id);
      } else if (isSingleClusterCoreNode.get(n.id)) {
        membersByComm[c].push(n.id);
      }
    }
  }

  // Validate Barycentric Multi-Cluster Positioning for co-dominant bridge nodes (coDom.length >= 2)
  let baryDistSum = 0;
  let coDomHubDistSum = 0;
  let coDomNodeCount = 0;
  for (const [nodeId, coDom] of coDominantHubsByNode.entries()) {
    if (coDom.length < 2) continue;
    const p = positions[nodeId];
    if (!p) continue;
    let bx = 0;
    let by = 0;
    let bz = 0;
    let wSum = 0;
    let hubDistLocalSum = 0;
    let validHubs = 0;
    for (const { hubId, weight } of coDom) {
      const hp = positions[hubId];
      if (!hp) continue;
      const stiff = Math.pow(weight, 2.1);
      bx += hp.x * stiff;
      by += hp.y * stiff;
      bz += (hp.z ?? 0) * stiff;
      wSum += stiff;
      hubDistLocalSum += is3D
        ? Math.hypot(p.x - hp.x, p.y - hp.y, (p.z ?? 0) - (hp.z ?? 0))
        : Math.hypot(p.x - hp.x, p.y - hp.y);
      validHubs++;
    }
    if (wSum > 0 && validHubs >= 2) {
      bx /= wSum;
      by /= wSum;
      bz /= wSum;
      const dBary = is3D
        ? Math.hypot(p.x - bx, p.y - by, (p.z ?? 0) - bz)
        : Math.hypot(p.x - bx, p.y - by);
      baryDistSum += dBary;
      coDomHubDistSum += hubDistLocalSum / validHubs;
      coDomNodeCount++;
    }
  }
  if (coDomNodeCount > 0) {
    const meanBaryDist = baryDistSum / coDomNodeCount;
    const meanCoDomHubDist = coDomHubDistSum / coDomNodeCount;
    assertCondition(
      meanBaryDist < meanCoDomHubDist * 0.85,
      `[Gate 2: ${name}] Barycentric multi-cluster positioning failed: meanBaryDist=${meanBaryDist.toFixed(1)} >= 0.85 * meanCoDomHubDist (${(meanCoDomHubDist * 0.85).toFixed(1)})`,
      failures
    );
  }

  let highOverlapDistSum = 0;
  let highOverlapCount = 0;
  let lowOverlapDistSum = 0;
  let lowOverlapCount = 0;

  for (let k = 0; k < communityCount; k++) {
    assertCondition(
      hubIdsByComm[k].length === 1,
      `[Gate 2: ${name}] Community ${k} expected exactly 1 Tag-Cluster Hub (group=0), found ${hubIdsByComm[k].length}`,
      failures
    );
    const hubId = hubIdsByComm[k][0];
    const hubPos = hubId ? positions[hubId] : undefined;
    if (!hubId || !hubPos) continue;

    for (const id of allCommMembers[k]) {
      if ((nodeGroupById.get(id) ?? 0) === 0) continue;
      const p = positions[id];
      if (!p) continue;
      const dHub = is3D
        ? Math.hypot(p.x - hubPos.x, p.y - hubPos.y, (p.z ?? 0) - (hubPos.z ?? 0))
        : Math.hypot(p.x - hubPos.x, p.y - hubPos.y);
      const w = edgeWeightLookup.get(`${id}|${hubId}`) ?? 0.75;
      if (w >= 0.88 && isSingleClusterCoreNode.get(id)) {
        highOverlapDistSum += dHub;
        highOverlapCount++;
      } else if (w >= 0.52 && w <= 0.84) {
        lowOverlapDistSum += dHub;
        lowOverlapCount++;
      }
    }
  }

  const highOverlapRadiusMean = highOverlapCount > 0 ? highOverlapDistSum / highOverlapCount : 1;
  const lowOverlapRadiusMean = lowOverlapCount > 0 ? lowOverlapDistSum / lowOverlapCount : 0;
  const overlapOrbitRatio = lowOverlapRadiusMean / Math.max(1e-6, highOverlapRadiusMean);

  assertCondition(
    highOverlapCount > 0 &&
      lowOverlapCount > 0 &&
      highOverlapRadiusMean < lowOverlapRadiusMean * 0.88,
    `[Gate 2: ${name}] Intra-island overlap-to-distance monotonicity failed: highOverlapRadiusMean=${highOverlapRadiusMean.toFixed(1)}, lowOverlapRadiusMean=${lowOverlapRadiusMean.toFixed(1)}`,
    failures
  );

  const centroids: { x: number; y: number; z: number }[] = [];
  const medianRadii: number[] = [];
  const p85Radii: number[] = [];

  for (let k = 0; k < communityCount; k++) {
    const ids = membersByComm[k];
    if (ids.length === 0) continue;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (const id of ids) {
      const p = positions[id];
      if (!p) continue;
      sx += p.x;
      sy += p.y;
      sz += p.z ?? 0;
    }
    const cx = sx / ids.length;
    const cy = sy / ids.length;
    const cz = sz / ids.length;
    centroids.push({ x: cx, y: cy, z: cz });

    const dists = ids
      .map((id) => {
        const p = positions[id];
        if (!p) return 0;
        return is3D
          ? Math.hypot(p.x - cx, p.y - cy, (p.z ?? 0) - cz)
          : Math.hypot(p.x - cx, p.y - cy);
      })
      .sort((a, b) => a - b);
    const idx50 = Math.min(dists.length - 1, Math.floor(0.5 * (dists.length - 1)));
    const idx85 = Math.min(dists.length - 1, Math.floor(0.85 * (dists.length - 1)));
    medianRadii.push(dists[idx50] ?? 0);
    p85Radii.push(dists[idx85] ?? 0);
  }

  let minCentroidDist = Infinity;
  for (let i = 0; i < centroids.length; i++) {
    for (let j = i + 1; j < centroids.length; j++) {
      const d = is3D
        ? Math.hypot(
            centroids[i].x - centroids[j].x,
            centroids[i].y - centroids[j].y,
            centroids[i].z - centroids[j].z
          )
        : Math.hypot(centroids[i].x - centroids[j].x, centroids[i].y - centroids[j].y);
      if (d < minCentroidDist) minCentroidDist = d;
    }
  }
  if (!Number.isFinite(minCentroidDist)) minCentroidDist = 0;

  const meanMedianRadius =
    medianRadii.reduce((acc, val) => acc + val, 0) / Math.max(1, medianRadii.length);
  const meanP85Radius =
    p85Radii.reduce((acc, val) => acc + val, 0) / Math.max(1, p85Radii.length);

  let intraSum = 0;
  let intraCount = 0;
  let interSum = 0;
  let interCount = 0;

  const nodes = canonical.nodes.filter((n) => {
    if (n.group === 0) return true;
    return Boolean(isSingleClusterCoreNode.get(n.id));
  });
  for (let i = 0; i < nodes.length; i++) {
    const u = nodes[i].id;
    const pu = positions[u];
    if (!pu) continue;
    const cu = communityByNode.get(u) ?? 0;
    for (let j = i + 1; j < nodes.length; j++) {
      const v = nodes[j].id;
      const pv = positions[v];
      if (!pv) continue;
      const cv = communityByNode.get(v) ?? 0;
      const d = is3D
        ? Math.hypot(pu.x - pv.x, pu.y - pv.y, (pu.z ?? 0) - (pv.z ?? 0))
        : Math.hypot(pu.x - pv.x, pu.y - pv.y);
      if (cu === cv) {
        intraSum += d;
        intraCount++;
      } else {
        interSum += d;
        interCount++;
      }
    }
  }

  const intraCommunityMean = intraCount > 0 ? intraSum / intraCount : 1;
  const interCommunityMean = interCount > 0 ? interSum / interCount : 0;
  const islandRatio = interCommunityMean / Math.max(1e-6, intraCommunityMean);

  assertCondition(
    islandRatio >= 3.2,
    `[Gate 2: ${name}] Inter/Intra island distance ratio too low (${islandRatio.toFixed(2)} < 3.20)`,
    failures
  );
  assertCondition(
    meanP85Radius < minCentroidDist * 0.78,
    `[Gate 2: ${name}] Archipelago corridor overlap: meanP85Radius=${meanP85Radius.toFixed(1)} >= 0.78 * minCentroidDist (${(minCentroidDist * 0.78).toFixed(1)})`,
    failures
  );

  return {
    islandRatio,
    meanMedianRadius,
    meanP85Radius,
    minCentroidDist,
    intraCommunityMean,
    interCommunityMean,
    overlapOrbitRatio,
  };
}

function evaluate2DSolverQuality(
  name: string,
  positions: Record<string, Point2D>,
  canonical: CanonicalGraphPayload,
  pairSets: ContentPairSets,
  communityByNode: Map<string, number>,
  communityCount: number,
  failures: string[]
): {
  bridgeRatio: number;
  interClusterRatio: number;
  islandRatio: number;
  meanMedianRadius: number;
  meanP85Radius: number;
  minCentroidDist: number;
  intraMean: number;
  bridgeMean: number;
  relatedMean: number;
  unrelatedMean: number;
  overlapOrbitRatio: number;
} {
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (const n of canonical.nodes) {
    const pt = positions[n.id];
    if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
      failures.push(`[Gate 2: ${name}] Missing or non-finite 2D coordinate for node ${n.id}`);
      continue;
    }
    sumX += pt.x;
    sumY += pt.y;
    count++;
  }

  const meanX = count > 0 ? sumX / count : 0;
  const meanY = count > 0 ? sumY / count : 0;
  assertCondition(
    Math.abs(meanX) < 1.0 && Math.abs(meanY) < 1.0,
    `[Gate 2: ${name}] Coordinates not mean-centered: mean=(${meanX.toFixed(3)}, ${meanY.toFixed(3)})`,
    failures
  );

  let intraDistSum = 0;
  let intraCount = 0;
  let bridgeDistSum = 0;
  let bridgeCount = 0;

  for (const conn of canonical.connections) {
    const src = conn.source ?? conn.sourceId;
    const tgt = conn.target ?? conn.targetId;
    const p1 = positions[src];
    const p2 = positions[tgt];
    if (!p1 || !p2) continue;
    const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const w = conn.weight ?? 0.5;
    const sameComm = (communityByNode.get(src) ?? -1) === (communityByNode.get(tgt) ?? -2);
    if (sameComm && w >= 0.72) {
      intraDistSum += d;
      intraCount++;
    } else if (!sameComm && w <= 0.55) {
      bridgeDistSum += d;
      bridgeCount++;
    }
  }

  const intraMean = intraCount > 0 ? intraDistSum / intraCount : 1;
  const bridgeMean = bridgeCount > 0 ? bridgeDistSum / bridgeCount : 0;
  const bridgeRatio = bridgeMean / Math.max(1e-6, intraMean);

  assertCondition(
    intraCount > 0 && bridgeCount > 0 && bridgeRatio >= 1.65,
    `[Gate 2: ${name}] Bridge vs. Intra-cluster edge length ratio too low (${bridgeRatio.toFixed(2)} < 1.65) — risk of hairball ("Knäuel")`,
    failures
  );

  let relatedDistSum = 0;
  let relatedCount = 0;
  for (const [u, v] of pairSets.relatedPairs) {
    const p1 = positions[u];
    const p2 = positions[v];
    if (!p1 || !p2) continue;
    relatedDistSum += Math.hypot(p2.x - p1.x, p2.y - p1.y);
    relatedCount++;
  }

  let unrelatedDistSum = 0;
  let unrelatedCount = 0;
  for (const [u, v] of pairSets.unrelatedPairs) {
    const p1 = positions[u];
    const p2 = positions[v];
    if (!p1 || !p2) continue;
    unrelatedDistSum += Math.hypot(p2.x - p1.x, p2.y - p1.y);
    unrelatedCount++;
  }

  const relatedMean = relatedCount > 0 ? relatedDistSum / relatedCount : 1;
  const unrelatedMean = unrelatedCount > 0 ? unrelatedDistSum / unrelatedCount : 0;
  const interClusterRatio = unrelatedMean / Math.max(1e-6, relatedMean);

  assertCondition(
    relatedCount > 0 && unrelatedCount > 0 && interClusterRatio >= 1.85,
    `[Gate 2: ${name}] Topical community separation ratio too low (${interClusterRatio.toFixed(2)} < 1.85)`,
    failures
  );

  const arch = evaluateArchipelagoCorridors(
    name,
    positions,
    canonical,
    communityByNode,
    communityCount,
    failures
  );

  return {
    bridgeRatio,
    interClusterRatio,
    islandRatio: arch.islandRatio,
    meanMedianRadius: arch.meanMedianRadius,
    meanP85Radius: arch.meanP85Radius,
    minCentroidDist: arch.minCentroidDist,
    intraMean,
    bridgeMean,
    relatedMean,
    unrelatedMean,
    overlapOrbitRatio: arch.overlapOrbitRatio,
  };
}

function evaluate3DSolverQuality(
  name: string,
  positions: Record<string, Point3D>,
  canonical: CanonicalGraphPayload,
  pairSets: ContentPairSets,
  communityByNode: Map<string, number>,
  communityCount: number,
  failures: string[]
): {
  bridgeRatio: number;
  interClusterRatio: number;
  islandRatio: number;
  meanMedianRadius: number;
  meanP85Radius: number;
  minCentroidDist: number;
  axisBalance: number;
  radialSpread: number;
  relatedMean: number;
  unrelatedMean: number;
  overlapOrbitRatio: number;
} {
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  let count = 0;
  const radii: number[] = [];

  for (const n of canonical.nodes) {
    const pt = positions[n.id];
    if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y) || !Number.isFinite(pt.z)) {
      failures.push(`[Gate 2: ${name}] Missing or non-finite 3D coordinate for node ${n.id}`);
      continue;
    }
    sumX += pt.x;
    sumY += pt.y;
    sumZ += pt.z;
    radii.push(Math.hypot(pt.x, pt.y, pt.z));
    count++;
  }

  const meanX = count > 0 ? sumX / count : 0;
  const meanY = count > 0 ? sumY / count : 0;
  const meanZ = count > 0 ? sumZ / count : 0;
  assertCondition(
    Math.abs(meanX) < 1.0 && Math.abs(meanY) < 1.0 && Math.abs(meanZ) < 1.0,
    `[Gate 2: ${name}] 3D coordinates not mean-centered: mean=(${meanX.toFixed(3)}, ${meanY.toFixed(3)}, ${meanZ.toFixed(3)})`,
    failures
  );

  let varX = 0;
  let varY = 0;
  let varZ = 0;
  for (const n of canonical.nodes) {
    const pt = positions[n.id];
    if (!pt) continue;
    varX += (pt.x - meanX) ** 2;
    varY += (pt.y - meanY) ** 2;
    varZ += (pt.z - meanZ) ** 2;
  }
  const stdX = Math.sqrt(varX / Math.max(1, count));
  const stdY = Math.sqrt(varY / Math.max(1, count));
  const stdZ = Math.sqrt(varZ / Math.max(1, count));
  const axisBalance = Math.min(stdX, stdY, stdZ) / Math.max(1e-6, Math.max(stdX, stdY, stdZ));

  assertCondition(
    axisBalance >= 0.55,
    `[Gate 2: ${name}] 3D axis standard deviations unbalanced (${axisBalance.toFixed(2)} < 0.55)`,
    failures
  );

  const meanR = radii.reduce((a, b) => a + b, 0) / Math.max(1, radii.length);
  const stdR = Math.sqrt(
    radii.reduce((acc, r) => acc + (r - meanR) ** 2, 0) / Math.max(1, radii.length)
  );
  const radialSpread = stdR / Math.max(1e-6, meanR);

  assertCondition(
    radialSpread >= 0.22,
    `[Gate 2: ${name}] 3D radial spread too uniform (${radialSpread.toFixed(2)} < 0.22) — risk of uniform sphere ("Kugel")`,
    failures
  );

  let intraDistSum = 0;
  let intraCount = 0;
  let bridgeDistSum = 0;
  let bridgeCount = 0;

  for (const conn of canonical.connections) {
    const src = conn.source ?? conn.sourceId;
    const tgt = conn.target ?? conn.targetId;
    const p1 = positions[src];
    const p2 = positions[tgt];
    if (!p1 || !p2) continue;
    const d = Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
    const w = conn.weight ?? 0.5;
    const sameComm = (communityByNode.get(src) ?? -1) === (communityByNode.get(tgt) ?? -2);
    if (sameComm && w >= 0.72) {
      intraDistSum += d;
      intraCount++;
    } else if (!sameComm && w <= 0.55) {
      bridgeDistSum += d;
      bridgeCount++;
    }
  }

  const intraMean = intraCount > 0 ? intraDistSum / intraCount : 1;
  const bridgeMean = bridgeCount > 0 ? bridgeDistSum / bridgeCount : 0;
  const bridgeRatio = bridgeMean / Math.max(1e-6, intraMean);

  assertCondition(
    intraCount > 0 && bridgeCount > 0 && bridgeRatio >= 1.65,
    `[Gate 2: ${name}] 3D Bridge vs. Intra-cluster edge length ratio too low (${bridgeRatio.toFixed(2)} < 1.65)`,
    failures
  );

  let relatedDistSum = 0;
  let relatedCount = 0;
  for (const [u, v] of pairSets.relatedPairs) {
    const p1 = positions[u];
    const p2 = positions[v];
    if (!p1 || !p2) continue;
    relatedDistSum += Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
    relatedCount++;
  }

  let unrelatedDistSum = 0;
  let unrelatedCount = 0;
  for (const [u, v] of pairSets.unrelatedPairs) {
    const p1 = positions[u];
    const p2 = positions[v];
    if (!p1 || !p2) continue;
    unrelatedDistSum += Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
    unrelatedCount++;
  }

  const relatedMean = relatedCount > 0 ? relatedDistSum / relatedCount : 1;
  const unrelatedMean = unrelatedCount > 0 ? unrelatedDistSum / unrelatedCount : 0;
  const interClusterRatio = unrelatedMean / Math.max(1e-6, relatedMean);

  assertCondition(
    relatedCount > 0 && unrelatedCount > 0 && interClusterRatio >= 1.85,
    `[Gate 2: ${name}] 3D Topical community separation ratio too low (${interClusterRatio.toFixed(2)} < 1.85)`,
    failures
  );

  const arch = evaluateArchipelagoCorridors(
    name,
    positions,
    canonical,
    communityByNode,
    communityCount,
    failures
  );

  return {
    bridgeRatio,
    interClusterRatio,
    islandRatio: arch.islandRatio,
    meanMedianRadius: arch.meanMedianRadius,
    meanP85Radius: arch.meanP85Radius,
    minCentroidDist: arch.minCentroidDist,
    axisBalance,
    radialSpread,
    relatedMean,
    unrelatedMean,
    overlapOrbitRatio: arch.overlapOrbitRatio,
  };
}

async function main() {
  const startTime = performance.now();
  const failures: string[] = [];

  // =========================================================================
  // GATE 1: Dataset & Privacy Integrity
  // =========================================================================
  const canonical = await loadCanonicalGraph();
  const tagNodes = canonical.nodes.filter((n) => n.group === 0);
  const contentNodes = canonical.nodes.filter((n) => n.group > 0);

  assertCondition(
    tagNodes.length === DEFAULT_TOPIC_CLUSTER_COUNT &&
      contentNodes.length >= 200 &&
      canonical.nodes.length === tagNodes.length + contentNodes.length,
    `[Gate 1: Dataset] Unexpected node counts: total=${canonical.nodes.length}, tagClusters=${tagNodes.length}, content=${contentNodes.length}`,
    failures
  );
  assertCondition(
    tagNodes.every(
      (n) =>
        n.id.startsWith('/tags/') &&
        n.name.startsWith('#') &&
        n.size === 1 &&
        getNodeRestRadiusScale(0, n.size) === 1.0 &&
        typeof n.colorDark === 'string' &&
        typeof n.colorLight === 'string'
    ) &&
      canonical.nodes.every(
        (n) =>
          n.size === 1 &&
          typeof n.colorDark === 'string' &&
          n.colorDark.startsWith('#') &&
          typeof n.colorLight === 'string' &&
          n.colorLight.startsWith('#')
      ),
    '[Gate 1: Dataset] Tag-Cluster supernode schema, uniform node size (1.0), or OKLab cluster colors invalid',
    failures
  );
  const blendedSample = mixHexColorsOklab([
    { color: CLUSTER_PALETTE.dark[0], weight: 0.6 },
    { color: CLUSTER_PALETTE.dark[1], weight: 0.4 },
  ]);
  assertCondition(
    blendedSample.startsWith('#') &&
      blendedSample !== CLUSTER_PALETTE.dark[0] &&
      blendedSample !== CLUSTER_PALETTE.dark[1],
    '[Gate 1: Dataset] mixHexColorsOklab failed to produce distinct intermediate OKLab color',
    failures
  );
  toggleContentFilterGroup(1);
  assertCondition(
    !isNodeDimmedByContentFilter(0) &&
      !isNodeDimmedByContentFilter(1) &&
      isNodeDimmedByContentFilter(2) &&
      getNodeBaseColor({ group: 2, colorDark: CLUSTER_PALETTE.dark[0] }, false) !== CLUSTER_PALETTE.dark[0],
    '[Gate 1: Dataset] Content-Type filter dimming helper failed to dim non-matching content groups',
    failures
  );
  resetContentFilterGroups();
  assertCondition(
    canonical.connections.length >= 250 && canonical.connections.length <= 750,
    `[Gate 1: Dataset] Unexpected edge count: ${canonical.connections.length}`,
    failures
  );

  let minWeight = Infinity;
  let maxWeight = -Infinity;
  for (const conn of canonical.connections) {
    const w = conn.weight ?? NaN;
    const cov = conn.coverage ?? NaN;
    if (!Number.isFinite(w) || w <= 0 || w > 1 || !Number.isFinite(cov) || cov <= 0 || cov > 1) {
      failures.push(
        `[Gate 1: Dataset] Invalid edge weight (${String(w)}) or coverage (${String(cov)}) on ${conn.sourceId} -> ${conn.targetId}`
      );
    } else {
      if (w < minWeight) minWeight = w;
      if (w > maxWeight) maxWeight = w;
    }
  }
  assertCondition(
    maxWeight > minWeight * 3,
    `[Gate 1: Dataset] Edge weights lack degree-inverse spread: min=${minWeight}, max=${maxWeight}`,
    failures
  );

  scanPrivacyViolations(failures);

  // =========================================================================
  // GATE 2: Cluster Quality & Anti-Hairball / Anti-Sphere Gate
  // =========================================================================
  resetGraphTuningState();
  const pairSets = buildContentPairSets(canonical);
  const { communityByNode, communityCount } = computeGraphCommunities(
    canonical.nodes,
    canonical.connections
  );
  assertCondition(
    tagNodes.length === communityCount,
    `[Gate 2: Communities] Expected 1-to-1 match between Tag-Cluster nodes (${tagNodes.length}) and communities (${communityCount})`,
    failures
  );
  const communityCounts = new Array<number>(communityCount).fill(0);
  for (const n of canonical.nodes) {
    const c = communityByNode.get(n.id) ?? 0;
    if (c >= 0 && c < communityCount) communityCounts[c]++;
  }
  const cyPos1 = solveCytoscapeCoseLayout(canonical);
  const sigmaPos1 = solveSigmaForceAtlas2Layout(canonical);
  const d3Pos1 = solveD3ForceLayout(canonical);
  const visPos1 = solveVisNetworkForceLayout(canonical);
  const force3DPos1 = solve3DForceLayout(canonical);

  const cyStats = evaluate2DSolverQuality(
    'cytoscape',
    cyPos1,
    canonical,
    pairSets,
    communityByNode,
    communityCount,
    failures
  );
  const sigmaStats = evaluate2DSolverQuality(
    'sigma',
    sigmaPos1,
    canonical,
    pairSets,
    communityByNode,
    communityCount,
    failures
  );
  const d3Stats = evaluate2DSolverQuality(
    'd3',
    d3Pos1,
    canonical,
    pairSets,
    communityByNode,
    communityCount,
    failures
  );
  const visStats = evaluate2DSolverQuality(
    'vis-network',
    visPos1,
    canonical,
    pairSets,
    communityByNode,
    communityCount,
    failures
  );
  const force3DStats = evaluate3DSolverQuality(
    '3d-force-graph',
    force3DPos1,
    canonical,
    pairSets,
    communityByNode,
    communityCount,
    failures
  );

  // =========================================================================
  // GATE 3: Determinism, Parity & Live Tuning Sensitivity (incl. Negative Exponents)
  // =========================================================================
  const cyPos2 = solveCytoscapeCoseLayout(canonical);
  const sigmaPos2 = solveSigmaForceAtlas2Layout(canonical);
  const d3Pos2 = solveD3ForceLayout(canonical);
  const visPos2 = solveVisNetworkForceLayout(canonical);
  const force3DPos2 = solve3DForceLayout(canonical);

  let maxDeterminismDelta = 0;
  for (const n of canonical.nodes) {
    const dCy = Math.hypot(cyPos1[n.id].x - cyPos2[n.id].x, cyPos1[n.id].y - cyPos2[n.id].y);
    const dSig = Math.hypot(sigmaPos1[n.id].x - sigmaPos2[n.id].x, sigmaPos1[n.id].y - sigmaPos2[n.id].y);
    const dD3 = Math.hypot(d3Pos1[n.id].x - d3Pos2[n.id].x, d3Pos1[n.id].y - d3Pos2[n.id].y);
    const dVis = Math.hypot(visPos1[n.id].x - visPos2[n.id].x, visPos1[n.id].y - visPos2[n.id].y);
    const d3D = Math.hypot(
      force3DPos1[n.id].x - force3DPos2[n.id].x,
      force3DPos1[n.id].y - force3DPos2[n.id].y,
      force3DPos1[n.id].z - force3DPos2[n.id].z
    );
    maxDeterminismDelta = Math.max(maxDeterminismDelta, dCy, dSig, dD3, dVis, d3D);
  }
  assertCondition(
    maxDeterminismDelta === 0,
    `[Gate 3: Determinism] Force solvers are not 100% deterministic across all 5 engines: maxDelta=${maxDeterminismDelta}`,
    failures
  );

  // Sync-vs-Async & Hydrated Client Input Parity Check (0.0000 px across all 5 engines)
  const hydratedClientInput = hydrateEnginePayloads(canonical);
  const cyAsyncPos = await solveCytoscapeCoseLayoutAsync(hydratedClientInput);
  const sigmaAsyncPos = await solveSigmaForceAtlas2LayoutAsync(hydratedClientInput);
  const d3AsyncPos = await solveD3ForceLayoutAsync(hydratedClientInput);
  const visAsyncPos = await solveVisNetworkForceLayoutAsync(hydratedClientInput);
  const force3DAsyncPos = await solve3DForceLayoutAsync(hydratedClientInput);

  let maxAsyncParityDelta = 0;
  for (const n of canonical.nodes) {
    const dCy = cyAsyncPos
      ? Math.hypot(cyPos1[n.id].x - cyAsyncPos[n.id].x, cyPos1[n.id].y - cyAsyncPos[n.id].y)
      : Infinity;
    const dSig = sigmaAsyncPos
      ? Math.hypot(sigmaPos1[n.id].x - sigmaAsyncPos[n.id].x, sigmaPos1[n.id].y - sigmaAsyncPos[n.id].y)
      : Infinity;
    const dD3 = d3AsyncPos
      ? Math.hypot(d3Pos1[n.id].x - d3AsyncPos[n.id].x, d3Pos1[n.id].y - d3AsyncPos[n.id].y)
      : Infinity;
    const dVis = visAsyncPos
      ? Math.hypot(visPos1[n.id].x - visAsyncPos[n.id].x, visPos1[n.id].y - visAsyncPos[n.id].y)
      : Infinity;
    const d3D = force3DAsyncPos
      ? Math.hypot(
          force3DPos1[n.id].x - force3DAsyncPos[n.id].x,
          force3DPos1[n.id].y - force3DAsyncPos[n.id].y,
          force3DPos1[n.id].z - force3DAsyncPos[n.id].z
        )
      : Infinity;
    maxAsyncParityDelta = Math.max(maxAsyncParityDelta, dCy, dSig, dD3, dVis, d3D);
  }
  assertCondition(
    maxAsyncParityDelta === 0,
    `[Gate 3: Sync-vs-Async Parity] Live async solver on hydrated client input diverged from static build solver: maxDelta=${maxAsyncParityDelta}`,
    failures
  );

  // Smooth 1-step slider perturbation check (repulsionScale: 1.00 -> 1.05 must change median cluster radius by < 15%)
  setGraphTuningState({ repulsionScale: 1.05 });
  const cyStepPos = solveCytoscapeCoseLayout(hydratedClientInput);
  const sigmaStepPos = solveSigmaForceAtlas2Layout(hydratedClientInput);
  const d3StepPos = solveD3ForceLayout(hydratedClientInput);
  const visStepPos = solveVisNetworkForceLayout(hydratedClientInput);
  const force3DStepPos = solve3DForceLayout(hydratedClientInput);
  resetGraphTuningState();

  const stepDummyFailures: string[] = [];
  const cyStepArch = evaluateArchipelagoCorridors('cytoscape', cyStepPos, canonical, communityByNode, communityCount, stepDummyFailures);
  const sigmaStepArch = evaluateArchipelagoCorridors('sigma', sigmaStepPos, canonical, communityByNode, communityCount, stepDummyFailures);
  const d3StepArch = evaluateArchipelagoCorridors('d3', d3StepPos, canonical, communityByNode, communityCount, stepDummyFailures);
  const visStepArch = evaluateArchipelagoCorridors('vis-network', visStepPos, canonical, communityByNode, communityCount, stepDummyFailures);
  const force3DStepArch = evaluateArchipelagoCorridors('3d-force-graph', force3DStepPos, canonical, communityByNode, communityCount, stepDummyFailures);

  const stepRadiusChanges = {
    cy: Math.abs(cyStepArch.meanMedianRadius - cyStats.meanMedianRadius) / Math.max(1e-6, cyStats.meanMedianRadius),
    sigma: Math.abs(sigmaStepArch.meanMedianRadius - sigmaStats.meanMedianRadius) / Math.max(1e-6, sigmaStats.meanMedianRadius),
    d3: Math.abs(d3StepArch.meanMedianRadius - d3Stats.meanMedianRadius) / Math.max(1e-6, d3Stats.meanMedianRadius),
    vis: Math.abs(visStepArch.meanMedianRadius - visStats.meanMedianRadius) / Math.max(1e-6, visStats.meanMedianRadius),
    force3D: Math.abs(force3DStepArch.meanMedianRadius - force3DStats.meanMedianRadius) / Math.max(1e-6, force3DStats.meanMedianRadius),
  };
  assertCondition(
    stepRadiusChanges.cy < 0.15 &&
      stepRadiusChanges.sigma < 0.15 &&
      stepRadiusChanges.d3 < 0.15 &&
      stepRadiusChanges.vis < 0.15 &&
      stepRadiusChanges.force3D < 0.15,
    `[Gate 3: Smooth Perturbation] 1-step repulsionScale (1.00->1.05) caused cluster radius jump >=15%: cy=${(stepRadiusChanges.cy * 100).toFixed(1)}%, sigma=${(stepRadiusChanges.sigma * 100).toFixed(1)}%, d3=${(stepRadiusChanges.d3 * 100).toFixed(1)}%, vis=${(stepRadiusChanges.vis * 100).toFixed(1)}%, 3d=${(stepRadiusChanges.force3D * 100).toFixed(1)}%`,
    failures
  );

  setGraphTuningState({ repulsionScale: 1.65, baseLinkDistance2D: 40 });
  const d3Tuned = solveD3ForceLayout(canonical);
  const visTuned = solveVisNetworkForceLayout(canonical);
  resetGraphTuningState();

  assertCondition(
    isDefaultGraphTuningState(),
    '[Gate 3: Tuning] resetGraphTuningState() did not restore default state',
    failures
  );

  let d3TuneDispSum = 0;
  let visTuneDispSum = 0;
  for (const n of canonical.nodes) {
    d3TuneDispSum += Math.hypot(d3Tuned[n.id].x - d3Pos1[n.id].x, d3Tuned[n.id].y - d3Pos1[n.id].y);
    visTuneDispSum += Math.hypot(visTuned[n.id].x - visPos1[n.id].x, visTuned[n.id].y - visPos1[n.id].y);
  }
  const d3MeanTuneDisp = d3TuneDispSum / canonical.nodes.length;
  const visMeanTuneDisp = visTuneDispSum / canonical.nodes.length;

  assertCondition(
    d3MeanTuneDisp > 5.0 && visMeanTuneDisp > 5.0,
    `[Gate 3: Tuning] Solvers insensitive to live tuning state: d3Disp=${d3MeanTuneDisp.toFixed(2)}, visDisp=${visMeanTuneDisp.toFixed(2)}`,
    failures
  );

  // Negative exponent inversion check (distanceExponent < 0 and stiffnessExponent < 0)
  setGraphTuningState({ distanceExponent: -0.5, stiffnessExponent: -0.5, degreeRepulsion: 0.4 });
  const lowMetricsNeg = getEdgePhysicsMetrics(0.15);
  const highMetricsNeg = getEdgePhysicsMetrics(0.85);
  assertCondition(
    lowMetricsNeg.distanceFactor < highMetricsNeg.distanceFactor &&
      getEdgeLinkDistance2D(0.15) < getEdgeLinkDistance2D(0.85) &&
      getCoseEdgeIdealLength(0.15) < getCoseEdgeIdealLength(0.85) &&
      lowMetricsNeg.stiffnessFactor > highMetricsNeg.stiffnessFactor &&
      getCoseEdgeElasticity(0.15) < getCoseEdgeElasticity(0.85),
    '[Gate 3: Negative Exponents] Negative distanceExponent/stiffnessExponent failed to invert low-vs-high edge lengths/stiffness',
    failures
  );

  const d3NegPos = solveD3ForceLayout(canonical);
  const visNegPos = solveVisNetworkForceLayout(canonical);
  const cyNegPos = solveCytoscapeCoseLayout(canonical);
  const sigmaNegPos = solveSigmaForceAtlas2Layout(canonical);
  const force3DNegPos = solve3DForceLayout(canonical);
  for (const n of canonical.nodes) {
    const pD3 = d3NegPos[n.id];
    const pVis = visNegPos[n.id];
    const pCy = cyNegPos[n.id];
    const pSig = sigmaNegPos[n.id];
    const p3D = force3DNegPos[n.id];
    if (
      !pD3 ||
      !Number.isFinite(pD3.x) ||
      !Number.isFinite(pD3.y) ||
      !pVis ||
      !Number.isFinite(pVis.x) ||
      !Number.isFinite(pVis.y) ||
      !pCy ||
      !Number.isFinite(pCy.x) ||
      !Number.isFinite(pCy.y) ||
      !pSig ||
      !Number.isFinite(pSig.x) ||
      !Number.isFinite(pSig.y) ||
      !p3D ||
      !Number.isFinite(p3D.x) ||
      !Number.isFinite(p3D.y) ||
      !Number.isFinite(p3D.z)
    ) {
      failures.push(`[Gate 3: Negative Exponents] Non-finite coordinate for ${n.id} under negative exponents`);
      break;
    }
  }
  resetGraphTuningState();
  const d3AfterNegReset = solveD3ForceLayout(canonical);
  let maxNegResetDelta = 0;
  for (const n of canonical.nodes) {
    maxNegResetDelta = Math.max(
      maxNegResetDelta,
      Math.hypot(d3Pos1[n.id].x - d3AfterNegReset[n.id].x, d3Pos1[n.id].y - d3AfterNegReset[n.id].y)
    );
  }
  assertCondition(
    isDefaultGraphTuningState() && maxNegResetDelta === 0,
    `[Gate 3: Negative Exponents] Reset after negative exponent run was not deterministic (delta=${maxNegResetDelta})`,
    failures
  );

  // Dynamic runtime re-clustering check (K=4, K=6 and K=12)
  const reclustered4 = reclusterCanonicalGraphPayload(canonical, 4);
  const reclustered6 = reclusterCanonicalGraphPayload(canonical, 6);
  const reclustered12 = reclusterCanonicalGraphPayload(canonical, 12);
  const clusters4 = reclustered4.nodes.filter((n) => n.group === 0);
  const clusters6 = reclustered6.nodes.filter((n) => n.group === 0);
  const clusters12 = reclustered12.nodes.filter((n) => n.group === 0);
  assertCondition(
    clusters4.length === 4 &&
      clusters6.length === 6 &&
      clusters12.length === 12 &&
      reclustered4.connections.length > 0 &&
      reclustered6.connections.length > 0 &&
      reclustered12.connections.length > 0,
    `[Gate 3: Dynamic Re-Clustering] Expected 4, 6 and 12 topic clusters, got ${clusters4.length}, ${clusters6.length} and ${clusters12.length}`,
    failures
  );
  const d3PosK6 = solveD3ForceLayout(reclustered6);
  const d3PosK12 = solveD3ForceLayout(reclustered12);
  assertCondition(
    reclustered6.nodes.every((n) => Number.isFinite(d3PosK6[n.id]?.x) && Number.isFinite(d3PosK6[n.id]?.y)) &&
      reclustered12.nodes.every((n) => Number.isFinite(d3PosK12[n.id]?.x) && Number.isFinite(d3PosK12[n.id]?.y)),
    '[Gate 3: Dynamic Re-Clustering] Solver produced non-finite coordinates on re-clustered topologies (K=6 / K=12)',
    failures
  );

  // Verify centered Theme-Cluster Pill placement (no offset, no leader line) & Elliptical Pill Clearance
  const calloutAllNodes = canonical.nodes.map((n) => ({
    id: n.id,
    x: d3Pos1[n.id].x,
    y: d3Pos1[n.id].y,
    radiusPx: 8,
    group: n.group,
  }));
  const calloutSpecs = tagNodes.map((n) => ({
    id: n.id,
    text: n.name,
    x: d3Pos1[n.id].x,
    y: d3Pos1[n.id].y,
    radiusPx: 0,
  }));
  const calloutMap = computeClusterCalloutPlacements2D(calloutAllNodes, calloutSpecs);
  assertCondition(
    calloutMap.size === tagNodes.length &&
      Array.from(calloutMap.values()).every(
        (pl) =>
          pl.px === pl.cx &&
          pl.py === pl.cy &&
          pl.anchorX === pl.startX &&
          pl.anchorY === pl.startY
      ),
    '[Gate 3: Pill Placement] Theme-Cluster pills must be centered directly at (cx, cy) with zero leader-line offset',
    failures
  );

  // Verify zero content nodes overlap inside any Theme-Cluster Pill bounding box (|dx| < 78 && |dy| < 16)
  for (const [solverName, posMap] of [
    ['cytoscape', cyPos1],
    ['sigma', sigmaPos1],
    ['d3', d3Pos1],
    ['vis-network', visPos1],
    ['3d-force-graph', force3DPos1],
  ] as const) {
    let pillOverlaps = 0;
    for (const cNode of contentNodes) {
      const cp = posMap[cNode.id];
      if (!cp) continue;
      for (const hNode of tagNodes) {
        const hp = posMap[hNode.id];
        if (!hp) continue;
        if (Math.abs(cp.x - hp.x) < 78 && Math.abs(cp.y - hp.y) < 16) {
          pillOverlaps++;
        }
      }
    }
    assertCondition(
      pillOverlaps === 0,
      `[Gate 3: Pill Clearance] ${solverName} has ${pillOverlaps} content node(s) overlapping inside a Theme-Cluster Pill box (|dx| < 78 && |dy| < 16)`,
      failures
    );
  }

  // =========================================================================
  // GATE 4: 2D & 3D Geometric Layouts (Radial & Columns) & Reordering
  // =========================================================================
  const solverNodes2D: SolverGraphNode[] = canonical.nodes.map((n) => ({
    id: n.id,
    group: n.group,
    size: n.size,
    x: d3Pos1[n.id].x,
    y: d3Pos1[n.id].y,
  }));

  const radial2D = compute2DGeometryTargets(solverNodes2D, 'radial', {
    useCurrentOrder: false,
    width: 1200,
    height: 800,
    centerOrigin: true,
  });
  let tagRadiusSum = 0;
  let contentRadiusSum = 0;
  for (const n of canonical.nodes) {
    const r = Math.hypot(radial2D.targets[n.id].x, radial2D.targets[n.id].y);
    if (n.group === 0) tagRadiusSum += r;
    else contentRadiusSum += r;
  }
  const meanTagRadius2D = tagRadiusSum / Math.max(1, tagNodes.length);
  const meanContentRadius2D = contentRadiusSum / Math.max(1, contentNodes.length);
  assertCondition(
    meanTagRadius2D < meanContentRadius2D * 0.7,
    `[Gate 4: Geometry 2D] Radial inner tag ring (${meanTagRadius2D.toFixed(1)}) not inside content ring (${meanContentRadius2D.toFixed(1)})`,
    failures
  );

  const cols2DBase = compute2DGeometryTargets(solverNodes2D, 'columns', {
    useCurrentOrder: true,
    width: 1200,
    height: 800,
    centerOrigin: true,
  });
  // Swap Y of two group-1 nodes to verify dynamic drag reordering changes signature
  const group1Nodes = solverNodes2D.filter((n) => n.group === 1);
  if (group1Nodes.length >= 2) {
    group1Nodes[0].y = -99999;
    group1Nodes[1].y = 99999;
  }
  const cols2DSwapped = compute2DGeometryTargets(solverNodes2D, 'columns', {
    useCurrentOrder: true,
    width: 1200,
    height: 800,
    centerOrigin: true,
  });
  assertCondition(
    cols2DBase.signature !== cols2DSwapped.signature,
    '[Gate 4: Geometry 2D] Drag reordering in columns layout did not update order signature',
    failures
  );

  const solverNodes3D: SolverGraphNode[] = canonical.nodes.map((n) => ({
    id: n.id,
    group: n.group,
    size: n.size,
    x: force3DPos1[n.id].x,
    y: force3DPos1[n.id].y,
    z: force3DPos1[n.id].z,
  }));
  const radial3D = compute3DGeometryTargets(solverNodes3D, 'radial', false);
  const cols3D = compute3DGeometryTargets(solverNodes3D, 'columns', false);
  assertCondition(
    Object.keys(radial3D.targets).length === canonical.nodes.length &&
      Object.keys(cols3D.targets).length === canonical.nodes.length,
    '[Gate 4: Geometry 3D] Missing 3D geometry targets',
    failures
  );

  // =========================================================================
  // GATE 5: 2D & 3D Drag-and-Drop Equilibrium & Post-Drop Reconfiguration
  // =========================================================================
  const adjacency = buildGraphAdjacency(canonical.connections);
  // Pick a Tag-Cluster supernode (3..25 connected items) for deterministic drag test
  const testNode =
    canonical.nodes.find((n) => {
      const deg = adjacency.get(n.id)?.size ?? 0;
      return n.group === 0 && deg >= 3 && deg <= 25;
    }) || canonical.nodes[0];
  const hopDists = computeHopDistances(testNode.id, adjacency);
  const hop1Ids = Array.from(adjacency.get(testNode.id) || []);
  const distantIds = canonical.nodes
    .map((n) => n.id)
    .filter((id) => id !== testNode.id && !hopDists.has(id));

  // 5A. 2D Drag Controller Test
  let latest2D = new Map<string, Point2D>();
  let settled2DFired = false;
  const drag2D = createGraphDragPhysicsController2D({
    nodes: canonical.nodes.map((n) => ({
      id: n.id,
      group: n.group,
      x: d3Pos1[n.id].x,
      y: d3Pos1[n.id].y,
    })),
    edges: canonical.connections.map((c) => ({
      source: c.sourceId,
      target: c.targetId,
      weight: c.weight ?? 0.5,
    })),
    isLight: () => false,
    onTick: (pos) => {
      latest2D = new Map(pos);
    },
    onSettleComplete: () => {
      settled2DFired = true;
    },
  });
  drag2D.calibrateFromPositions(d3Pos1);

  const start2D = d3Pos1[testNode.id];
  const draggedTarget2D: Point2D = { x: start2D.x + 120, y: start2D.y + 80 };
  drag2D.startDrag(testNode.id, draggedTarget2D);
  drag2D.moveDrag(testNode.id, draggedTarget2D);
  drag2D.stepTicks(25);

  const mean1HopMove2D =
    hop1Ids.reduce((sum, id) => {
      const cur = latest2D.get(id)!;
      return sum + Math.hypot(cur.x - d3Pos1[id].x, cur.y - d3Pos1[id].y);
    }, 0) / Math.max(1, hop1Ids.length);

  const meanDistantMove2D =
    distantIds.reduce((sum, id) => {
      const cur = latest2D.get(id)!;
      return sum + Math.hypot(cur.x - d3Pos1[id].x, cur.y - d3Pos1[id].y);
    }, 0) / Math.max(1, distantIds.length);

  assertCondition(
    mean1HopMove2D > 2.0,
    `[Gate 5: 2D Drag] 1-hop neighbors did not follow dragged node (meanMove=${mean1HopMove2D.toFixed(2)})`,
    failures
  );
  assertCondition(
    meanDistantMove2D < mean1HopMove2D * 0.35,
    `[Gate 5: 2D Drag] Distant nodes moved excessively during drag (distant=${meanDistantMove2D.toFixed(2)}, 1hop=${mean1HopMove2D.toFixed(2)})`,
    failures
  );

  const preDrop2D = new Map<string, Point2D>();
  for (const [id, pt] of latest2D.entries()) {
    preDrop2D.set(id, { x: pt.x, y: pt.y });
  }

  drag2D.endDrag(testNode.id, draggedTarget2D);
  drag2D.stepTicks(91);

  const postDropNeighborhoodIds = [testNode.id, ...hop1Ids];
  const meanSettleMove2D =
    postDropNeighborhoodIds.reduce((sum, id) => {
      const before = preDrop2D.get(id)!;
      const after = latest2D.get(id)!;
      return sum + Math.hypot(after.x - before.x, after.y - before.y);
    }, 0) / postDropNeighborhoodIds.length;

  assertCondition(
    meanSettleMove2D > 1.0 && settled2DFired,
    `[Gate 5: 2D Drag] Post-drop reconfiguration failed (meanSettleMove=${meanSettleMove2D.toFixed(2)}, settled=${String(settled2DFired)})`,
    failures
  );
  drag2D.destroy();

  // 5B. 3D Drag Controller Test
  let latest3D = new Map<string, Point3D>();
  let settled3DFired = false;
  const drag3D = createGraphDragPhysicsController3D({
    nodes: canonical.nodes.map((n) => ({
      id: n.id,
      group: n.group,
      x: force3DPos1[n.id].x,
      y: force3DPos1[n.id].y,
      z: force3DPos1[n.id].z,
    })),
    edges: canonical.connections.map((c) => ({
      source: c.sourceId,
      target: c.targetId,
      weight: c.weight ?? 0.5,
    })),
    isLight: () => false,
    onTick: (pos) => {
      latest3D = new Map(pos);
    },
    onSettleComplete: () => {
      settled3DFired = true;
    },
  });
  drag3D.calibrateFromPositions(force3DPos1);

  const start3D = force3DPos1[testNode.id];
  const draggedTarget3D: Point3D = {
    x: start3D.x + 80,
    y: start3D.y + 60,
    z: start3D.z + 50,
  };
  drag3D.startDrag(testNode.id, draggedTarget3D);
  drag3D.moveDrag(testNode.id, draggedTarget3D);
  drag3D.stepTicks(25);

  const mean1HopMove3D =
    hop1Ids.reduce((sum, id) => {
      const cur = latest3D.get(id)!;
      return (
        sum +
        Math.hypot(
          cur.x - force3DPos1[id].x,
          cur.y - force3DPos1[id].y,
          cur.z - force3DPos1[id].z
        )
      );
    }, 0) / Math.max(1, hop1Ids.length);

  assertCondition(
    mean1HopMove3D > 1.5,
    `[Gate 5: 3D Drag] 3D 1-hop neighbors did not follow dragged node (meanMove=${mean1HopMove3D.toFixed(2)})`,
    failures
  );

  const preDrop3D = new Map<string, Point3D>();
  for (const [id, pt] of latest3D.entries()) {
    preDrop3D.set(id, { x: pt.x, y: pt.y, z: pt.z });
  }

  drag3D.endDrag(testNode.id, draggedTarget3D);
  drag3D.stepTicks(91);

  const meanSettleMove3D =
    postDropNeighborhoodIds.reduce((sum, id) => {
      const before = preDrop3D.get(id)!;
      const after = latest3D.get(id)!;
      return sum + Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z);
    }, 0) / postDropNeighborhoodIds.length;

  assertCondition(
    meanSettleMove3D > 1.0 && settled3DFired,
    `[Gate 5: 3D Drag] 3D post-drop reconfiguration failed (meanSettleMove=${meanSettleMove3D.toFixed(2)}, settled=${String(settled3DFired)})`,
    failures
  );
  drag3D.destroy();

  // =========================================================================
  // GATE 6: Unified Visual-State, Constant Pill + % Badge, Polygons (3..10) & Exclusive Filter
  // =========================================================================
  // 6A. Constant-size main pill + external % badge
  for (const cn of tagNodes) {
    const restDims = getClusterPillDimensions(cn.name, undefined, false, 1);
    const hoverDims = getClusterPillDimensions(cn.name, 0.38, true, 1);
    assertCondition(
      restDims.pillW === hoverDims.pillW && restDims.pillH === hoverDims.pillH,
      `[Gate 6: Constant Pill] Pill size changed on hover for "${cn.name}": rest=${restDims.pillW}x${restDims.pillH}, hover=${hoverDims.pillW}x${hoverDims.pillH}`,
      failures
    );
    assertCondition(
      restDims.badgeW === 0 && hoverDims.badgeW > 20 && hoverDims.pctText === '38%',
      `[Gate 6: External Badge] External % badge invalid for "${cn.name}": restBadgeW=${restDims.badgeW}, hoverBadgeW=${hoverDims.badgeW}, pctText=${hoverDims.pctText}`,
      failures
    );
  }

  // 6B. Unified cluster dimming when hovering one Theme-Cluster (hopDistance = 0 on one, undefined on others)
  const testClusterPlacements = computeClusterCalloutPlacements2D(
    tagNodes.map((cn, idx) => ({ id: cn.id, x: idx * 200, y: 100, radiusPx: 0, group: 0 })),
    tagNodes.map((cn, idx) => ({
      id: cn.id,
      text: cn.name,
      x: idx * 200,
      y: 100,
      radiusPx: 0,
      hopDistance: idx === 0 ? 0 : undefined,
    }))
  );
  const hoveredPl = testClusterPlacements.get(tagNodes[0].id);
  assertCondition(
    hoveredPl?.isHighlighted === true && hoveredPl?.alpha === 1.0,
    '[Gate 6: Unified Cluster Focus] Hovered cluster pill must have isHighlighted=true and alpha=1.0',
    failures
  );
  for (const [id, pl] of testClusterPlacements.entries()) {
    if (id === tagNodes[0].id) continue;
    assertCondition(
      pl.isHighlighted === false && pl.alpha === 0.14,
      `[Gate 6: Unified Cluster Dimming] Non-hovered cluster pill "${id}" expected alpha=0.14, got ${pl.alpha}`,
      failures
    );
  }

  // 6C. Coverage-proportional content node dimming & scaling when hovering a Theme-Cluster
  const sampleColor = CLUSTER_PALETTE.dark[0];
  const col100 = getAttenuatedNodeColor(sampleColor, 1, false, 1.0);
  const col50 = getAttenuatedNodeColor(sampleColor, 1, false, 0.5);
  const col0 = getAttenuatedNodeColor(sampleColor, undefined, false, 0);
  assertCondition(
    col100.toLowerCase() === sampleColor.toLowerCase() &&
      col50.toLowerCase() !== col100.toLowerCase() &&
      col50.toLowerCase() !== col0.toLowerCase(),
    `[Gate 6: Coverage-Proportional Dimming] Expected distinct colors for 100% (${col100}), 50% (${col50}), and 0% (${col0}) coverage`,
    failures
  );
  assertCondition(
    getAttenuatedNodeScale(1, 1.0) > getAttenuatedNodeScale(1, 0.5) &&
      getAttenuatedNodeScale(1, 0.5) > getAttenuatedNodeScale(undefined, 0),
    '[Gate 6: Coverage-Proportional Scaling] Expected strictly monotonic scale for 100% > 50% > 0% coverage',
    failures
  );

  // 6D. Regular Polygons (3..10 corners for groups 1..8)
  for (let g = 1; g <= 8; g++) {
    const sides = getContentGroupPolygonSides(g);
    const verts = getRegularPolygonUnitVertices(sides);
    assertCondition(
      sides === g + 2 && verts.length === g + 2,
      `[Gate 6: Polygons] Group ${g} expected ${g + 2} corners, got sides=${sides}, verts=${verts.length}`,
      failures
    );
  }

  // 6E. Exclusive Single-Select Content Filter
  resetContentFilterGroups();
  assertCondition(getActiveContentFilterGroup() === null, '[Gate 6: Filter] Expected initial null filter', failures);
  toggleContentFilterGroup(1);
  assertCondition(
    getActiveContentFilterGroup() === 1 && !isNodeDimmedByContentFilter(1) && isNodeDimmedByContentFilter(2),
    '[Gate 6: Filter] Expected group 1 exclusively active after toggleContentFilterGroup(1)',
    failures
  );
  toggleContentFilterGroup(3);
  assertCondition(
    getActiveContentFilterGroup() === 3 && !isNodeDimmedByContentFilter(3) && isNodeDimmedByContentFilter(1),
    '[Gate 6: Filter] Expected group 3 to exclusively replace group 1 after toggleContentFilterGroup(3)',
    failures
  );
  toggleContentFilterGroup(3);
  assertCondition(
    getActiveContentFilterGroup() === null && !isNodeDimmedByContentFilter(1) && !isNodeDimmedByContentFilter(3),
    '[Gate 6: Filter] Expected toggling already-active group 3 to reset back to All (null)',
    failures
  );
  resetContentFilterGroups();

  const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(2);

  console.log(
    `[Gate 1 Summary] Tag-Cluster Supernodes (${tagNodes.length}): ${tagNodes.map((t) => t.name).join(', ')}`
  );
  console.log(
    `[Gate 2 Summary] Communities: K=${communityCount}, sizes=[${communityCounts.join(', ')}]`
  );
  console.log(
    `[Gate 2 Summary] Overlap Orbit Stratification Ratio (Low/High >1.14x): cy=${cyStats.overlapOrbitRatio.toFixed(2)}x, sigma=${sigmaStats.overlapOrbitRatio.toFixed(2)}x, d3=${d3Stats.overlapOrbitRatio.toFixed(2)}x, vis=${visStats.overlapOrbitRatio.toFixed(2)}x, 3d=${force3DStats.overlapOrbitRatio.toFixed(2)}x`
  );
  console.log(
    `[Gate 2 Summary] Bridge/Intra Edge Ratio (>=1.65x): cy=${cyStats.bridgeRatio.toFixed(2)}x, sigma=${sigmaStats.bridgeRatio.toFixed(2)}x, d3=${d3Stats.bridgeRatio.toFixed(2)}x, vis=${visStats.bridgeRatio.toFixed(2)}x, 3d=${force3DStats.bridgeRatio.toFixed(2)}x`
  );
  console.log(
    `[Gate 2 Summary] Topical Separation Ratio (>=1.85x): cy=${cyStats.interClusterRatio.toFixed(2)}x, sigma=${sigmaStats.interClusterRatio.toFixed(2)}x, d3=${d3Stats.interClusterRatio.toFixed(2)}x, vis=${visStats.interClusterRatio.toFixed(2)}x, 3d=${force3DStats.interClusterRatio.toFixed(2)}x`
  );
  console.log(
    `[Gate 2 Summary] Cluster Radius (med/p85 px): cy=${cyStats.meanMedianRadius.toFixed(1)}/${cyStats.meanP85Radius.toFixed(1)}, sigma=${sigmaStats.meanMedianRadius.toFixed(1)}/${sigmaStats.meanP85Radius.toFixed(1)}, d3=${d3Stats.meanMedianRadius.toFixed(1)}/${d3Stats.meanP85Radius.toFixed(1)}, vis=${visStats.meanMedianRadius.toFixed(1)}/${visStats.meanP85Radius.toFixed(1)}, 3d=${force3DStats.meanMedianRadius.toFixed(1)}/${force3DStats.meanP85Radius.toFixed(1)}`
  );
  console.log(
    `[Gate 2 Summary] Inter/Intra Island Ratio (>=3.20x): cy=${cyStats.islandRatio.toFixed(2)}x (p85/minDist=${(cyStats.meanP85Radius / cyStats.minCentroidDist).toFixed(2)}), sigma=${sigmaStats.islandRatio.toFixed(2)}x (p85/minDist=${(sigmaStats.meanP85Radius / sigmaStats.minCentroidDist).toFixed(2)}), d3=${d3Stats.islandRatio.toFixed(2)}x (p85/minDist=${(d3Stats.meanP85Radius / d3Stats.minCentroidDist).toFixed(2)}), vis=${visStats.islandRatio.toFixed(2)}x (p85/minDist=${(visStats.meanP85Radius / visStats.minCentroidDist).toFixed(2)}), 3d=${force3DStats.islandRatio.toFixed(2)}x (p85/minDist=${(force3DStats.meanP85Radius / force3DStats.minCentroidDist).toFixed(2)})`
  );
  console.log(
    `[Gate 3 Summary] Sync-vs-Async Parity maxDelta=${maxAsyncParityDelta.toFixed(4)}px | 1.00->1.05 Radius Shift: cy=${(stepRadiusChanges.cy * 100).toFixed(1)}%, sigma=${(stepRadiusChanges.sigma * 100).toFixed(1)}%, d3=${(stepRadiusChanges.d3 * 100).toFixed(1)}%, vis=${(stepRadiusChanges.vis * 100).toFixed(1)}%, 3d=${(stepRadiusChanges.force3D * 100).toFixed(1)}%`
  );

  if (failures.length > 0) {
    console.error('\n❌ [validate-visualizations] Validation failed:');
    for (const f of failures) {
      console.error(`  - ${f}`);
    }
    process.exit(1);
  }

  console.log(
    `✅ [validate-visualizations] All 5 visualization physics, bridge-vs-intra & topical community separation gates, negative-exponent tuning, geometry & drag-reconfiguration gates passed in ${elapsedSec}s (0 errors).`
  );
}

main().catch((err) => {
  console.error('❌ [validate-visualizations] Fatal error:', err);
  process.exit(1);
});
