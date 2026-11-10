import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  buildCanonicalGraphPayload,
  buildGraphAdjacency,
  computeHopDistances,
  isDefaultGraphTuningState,
  resetGraphTuningState,
  setGraphTuningState,
  type CanonicalGraphPayload,
} from '@commons/shared/graph-payload';
import {
  compute2DGeometryTargets,
  compute3DGeometryTargets,
  solve3DForceLayout,
  solveCytoscapeCoseLayout,
  solveD3ForceLayout,
  solveSigmaForceAtlas2Layout,
  solveVisNetworkForceLayout,
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
        walk(fullPath);
      } else if (/\.(md|mdx)$/i.test(item.name)) {
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

function evaluate2DSolverQuality(
  name: string,
  positions: Record<string, Point2D>,
  canonical: CanonicalGraphPayload,
  failures: string[]
): { hubRatio: number; specificMean: number; hubMean: number } {
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

  let specificDistSum = 0;
  let specificCount = 0;
  let hubDistSum = 0;
  let hubCount = 0;

  for (const conn of canonical.connections) {
    const src = conn.source ?? conn.sourceId;
    const tgt = conn.target ?? conn.targetId;
    const p1 = positions[src];
    const p2 = positions[tgt];
    if (!p1 || !p2) continue;
    const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const w = conn.weight ?? 0.5;
    if (w >= 0.45) {
      specificDistSum += d;
      specificCount++;
    } else if (w <= 0.20) {
      hubDistSum += d;
      hubCount++;
    }
  }

  const specificMean = specificCount > 0 ? specificDistSum / specificCount : 1;
  const hubMean = hubCount > 0 ? hubDistSum / hubCount : 0;
  const hubRatio = hubMean / Math.max(1e-6, specificMean);

  assertCondition(
    hubRatio >= 1.9,
    `[Gate 2: ${name}] Hub vs. Specific edge length ratio too low (${hubRatio.toFixed(2)} < 1.90) — risk of hairball ("Knäuel")`,
    failures
  );

  return { hubRatio, specificMean, hubMean };
}

function evaluate3DSolverQuality(
  name: string,
  positions: Record<string, Point3D>,
  canonical: CanonicalGraphPayload,
  failures: string[]
): { hubRatio: number; axisBalance: number; radialSpread: number } {
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
    radialSpread >= 0.25,
    `[Gate 2: ${name}] 3D radial spread too uniform (${radialSpread.toFixed(2)} < 0.25) — risk of uniform sphere ("Kugel")`,
    failures
  );

  let specificDistSum = 0;
  let specificCount = 0;
  let hubDistSum = 0;
  let hubCount = 0;

  for (const conn of canonical.connections) {
    const src = conn.source ?? conn.sourceId;
    const tgt = conn.target ?? conn.targetId;
    const p1 = positions[src];
    const p2 = positions[tgt];
    if (!p1 || !p2) continue;
    const d = Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
    const w = conn.weight ?? 0.5;
    if (w >= 0.45) {
      specificDistSum += d;
      specificCount++;
    } else if (w <= 0.20) {
      hubDistSum += d;
      hubCount++;
    }
  }

  const specificMean = specificCount > 0 ? specificDistSum / specificCount : 1;
  const hubMean = hubCount > 0 ? hubDistSum / hubCount : 0;
  const hubRatio = hubMean / Math.max(1e-6, specificMean);

  assertCondition(
    hubRatio >= 1.9,
    `[Gate 2: ${name}] 3D Hub vs. Specific edge length ratio too low (${hubRatio.toFixed(2)} < 1.90)`,
    failures
  );

  return { hubRatio, axisBalance, radialSpread };
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
    canonical.nodes.length >= 300 && tagNodes.length >= 100 && contentNodes.length >= 200,
    `[Gate 1: Dataset] Unexpected node counts: total=${canonical.nodes.length}, tags=${tagNodes.length}, content=${contentNodes.length}`,
    failures
  );
  assertCondition(
    canonical.connections.length >= 700,
    `[Gate 1: Dataset] Unexpected edge count: ${canonical.connections.length}`,
    failures
  );

  let minWeight = Infinity;
  let maxWeight = -Infinity;
  for (const conn of canonical.connections) {
    const w = conn.weight ?? NaN;
    if (!Number.isFinite(w) || w <= 0 || w > 1) {
      failures.push(`[Gate 1: Dataset] Invalid edge weight ${String(w)} on ${conn.sourceId} -> ${conn.targetId}`);
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
  const cyPos1 = solveCytoscapeCoseLayout(canonical);
  const sigmaPos1 = solveSigmaForceAtlas2Layout(canonical);
  const d3Pos1 = solveD3ForceLayout(canonical);
  const visPos1 = solveVisNetworkForceLayout(canonical);
  const force3DPos1 = solve3DForceLayout(canonical);

  const cyStats = evaluate2DSolverQuality('cytoscape', cyPos1, canonical, failures);
  const sigmaStats = evaluate2DSolverQuality('sigma', sigmaPos1, canonical, failures);
  const d3Stats = evaluate2DSolverQuality('d3', d3Pos1, canonical, failures);
  const visStats = evaluate2DSolverQuality('vis-network', visPos1, canonical, failures);
  const force3DStats = evaluate3DSolverQuality('3d-force-graph', force3DPos1, canonical, failures);

  // =========================================================================
  // GATE 3: Determinism, Parity & Live Tuning Sensitivity
  // =========================================================================
  const d3Pos2 = solveD3ForceLayout(canonical);
  const visPos2 = solveVisNetworkForceLayout(canonical);
  const force3DPos2 = solve3DForceLayout(canonical);

  let maxDeterminismDelta = 0;
  for (const n of canonical.nodes) {
    const dD3 = Math.hypot(d3Pos1[n.id].x - d3Pos2[n.id].x, d3Pos1[n.id].y - d3Pos2[n.id].y);
    const dVis = Math.hypot(visPos1[n.id].x - visPos2[n.id].x, visPos1[n.id].y - visPos2[n.id].y);
    const d3D = Math.hypot(
      force3DPos1[n.id].x - force3DPos2[n.id].x,
      force3DPos1[n.id].y - force3DPos2[n.id].y,
      force3DPos1[n.id].z - force3DPos2[n.id].z
    );
    maxDeterminismDelta = Math.max(maxDeterminismDelta, dD3, dVis, d3D);
  }
  assertCondition(
    maxDeterminismDelta === 0,
    `[Gate 3: Determinism] Force solvers are not 100% deterministic: maxDelta=${maxDeterminismDelta}`,
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
  // Pick a specific cluster tag node (4..7 connected items) for deterministic drag test
  const testNode =
    canonical.nodes.find((n) => {
      const deg = adjacency.get(n.id)?.size ?? 0;
      return n.group === 0 && deg >= 4 && deg <= 7;
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

  const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(2);

  if (failures.length > 0) {
    console.error('\n❌ [validate-visualizations] Validation failed:');
    for (const f of failures) {
      console.error(`  - ${f}`);
    }
    process.exit(1);
  }

  console.log(
    `✅ [validate-visualizations] All 5 visualization physics, cluster-separation (cy=${cyStats.hubRatio.toFixed(2)}x, sigma=${sigmaStats.hubRatio.toFixed(2)}x, d3=${d3Stats.hubRatio.toFixed(2)}x, vis=${visStats.hubRatio.toFixed(2)}x, 3d=${force3DStats.hubRatio.toFixed(2)}x), geometry & drag-reconfiguration gates passed in ${elapsedSec}s (0 errors).`
  );
}

main().catch((err) => {
  console.error('❌ [validate-visualizations] Fatal error:', err);
  process.exit(1);
});
