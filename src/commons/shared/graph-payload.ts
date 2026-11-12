import type { getImage } from "astro:assets";
import { DOMAIN_METADATA, getThemeTokens } from "./domain-themes";
import { formatDate } from "./format";

export type VisualizationEngineType =
  | 'cytoscape'
  | 'sigma'
  | 'd3'
  | 'vis-network'
  | '3d-force-graph';

export type GraphLayoutPositions = Record<string, [number, number] | [number, number, number]>;

export interface GraphLayoutPayload {
  engine: VisualizationEngineType;
  topologyHash: string;
  positions: GraphLayoutPositions;
}

export interface GraphNodePayload {
  id: string;
  name: string;
  size: number;
  group: number;
  colorDark?: string;
  colorLight?: string;
  connectionCount?: number;
  x?: number;
  y?: number;
  z?: number;
  typeLabel?: string;
  description?: string;
  date?: string;
  image?: string;
  tags?: string[];
  /** Cluster hubs only: full list of grouped tag slugs (used for Jaccard matching across K changes). */
  memberTags?: string[];
  /** Cluster hubs only: id of the previous cluster this one continues or was split from. */
  originClusterId?: string;
  /** 'match': continues the origin cluster (colour inherited); 'split': new cluster spawned from origin. */
  originKind?: 'match' | 'split';
}

export interface GraphConnectionPayload {
  sourceId: string;
  targetId: string;
  source?: string;
  target?: string;
  weight?: number;
  coverage?: number;
}

export interface RawTagSummary {
  id: string;
  name: string;
  description?: string;
}

export interface CanonicalGraphPayload {
  nodes: GraphNodePayload[];
  connections: GraphConnectionPayload[];
  rawTags?: RawTagSummary[];
  /** Old cluster ids that disappeared during re-clustering -> new cluster id they merge into. */
  mergeTargetByOldClusterId?: Record<string, string>;
}

export interface CytoscapeElement {
  data: {
    id: string;
    name?: string;
    group?: number;
    color?: string;
    colorDark?: string;
    colorLight?: string;
    size?: number;
    rawSize?: number;
    typeLabel?: string;
    description?: string;
    date?: string;
    image?: string;
    tags?: string[];
    source?: string;
    target?: string;
    weight?: number;
    coverage?: number;
  };
  position?: {
    x: number;
    y: number;
  };
}

export interface SigmaNode {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  rawSize?: number;
  group: number;
  color: string;
  colorDark?: string;
  colorLight?: string;
  typeLabel?: string;
  description?: string;
  date?: string;
  image?: string;
  tags?: string[];
  originClusterId?: string;
  originKind?: 'match' | 'split';
}

export interface SigmaEdge {
  id: string;
  source: string;
  target: string;
  size?: number;
  color?: string;
  weight?: number;
  coverage?: number;
}

export interface EnginePayloads {
  canonical?: CanonicalGraphPayload;
  nodes: GraphNodePayload[];
  connections: GraphConnectionPayload[];
  'vis-network': {
    nodes: GraphNodePayload[];
    connections: GraphConnectionPayload[];
  };
  cytoscape: {
    elements: CytoscapeElement[];
  };
  d3: {
    nodes: GraphNodePayload[];
    connections: GraphConnectionPayload[];
  };
  sigma: {
    nodes: SigmaNode[];
    edges: SigmaEdge[];
  };
  '3d-force-graph': { nodes: GraphNodePayload[]; connections: GraphConnectionPayload[] };
  '3d-force': {
    nodes: GraphNodePayload[];
    connections: GraphConnectionPayload[];
  };
}

export const GRAPH_GROUP_NAMES = [
  'Tag',
  'Post',
  'Publication',
  'Presentation',
  'Course',
  'Project',
  'Service',
  'Newsletter',
  'Visualization'
] as const;

export const GRAPH_COLORS = {
  dark: [
    DOMAIN_METADATA.tags.colors.dark,           // 0: Tag
    DOMAIN_METADATA.posts.colors.dark,          // 1: Post
    DOMAIN_METADATA.publications.colors.dark,   // 2: Publication
    DOMAIN_METADATA.presentations.colors.dark,  // 3: Presentation
    DOMAIN_METADATA.courses.colors.dark,        // 4: Course
    DOMAIN_METADATA.projects.colors.dark,       // 5: Project
    DOMAIN_METADATA.services.colors.dark,       // 6: Service
    DOMAIN_METADATA.newsletters.colors.dark,    // 7: Newsletter
    DOMAIN_METADATA.visualizations.colors.dark  // 8: Visualization
  ],
  light: [
    DOMAIN_METADATA.tags.colors.light,           // 0: Tag
    DOMAIN_METADATA.posts.colors.light,          // 1: Post
    DOMAIN_METADATA.publications.colors.light,   // 2: Publication
    DOMAIN_METADATA.presentations.colors.light,  // 3: Presentation
    DOMAIN_METADATA.courses.colors.light,        // 4: Course
    DOMAIN_METADATA.projects.colors.light,       // 5: Project
    DOMAIN_METADATA.services.colors.light,       // 6: Service
    DOMAIN_METADATA.newsletters.colors.light,    // 7: Newsletter
    DOMAIN_METADATA.visualizations.colors.light  // 8: Visualization
  ]
};

export interface GraphStyleTokens {
  edgeColor: string;
  edgeHoverColor: string;
  edgeWidth: number;
  edgeHoverWidth: number;
  nodeRadius: number;
  nodeHoverScale: number;
}

export const DEFAULT_TOPIC_CLUSTER_COUNT = 4;

export interface GraphTuningState {
  // 1. Edge Cohesion & Hubs
  clusterCount: number;        // default: 4    (range 2 .. 18, step 1)
  stiffnessExponent: number;   // default: 2.10 (range -1.0 .. 2.6, step 0.05)
  distanceExponent: number;    // default: 1.35 (range -1.0 .. 2.0, step 0.05)
  // 2. Layout Physics & Geometry
  baseLinkDistance2D: number;  // default: 18   (range 10 .. 64, step 2)
  repulsionScale: number;      // default: 1.0  (range 0.25 .. 2.5, step 0.05)
  degreeRepulsion: number;     // default: 0.48 (range 0.0 .. 1.5, step 0.05)
  gravityScale: number;        // default: 1.0  (range 0.10 .. 2.5, step 0.05)
  radialInnerRatio: number;    // default: 0.22 (range 0.10 .. 0.34, step 0.01)
  radialOuterRatio: number;    // default: 0.44 (range 0.28 .. 0.56, step 0.01)
  // 3. Visuals & Ego-Focus
  nodeRadius: number;          // default: 8    (range 4 .. 14, step 0.5)
  edgeWidth: number;           // default: 1.5  (range 0.5 .. 3.0, step 0.1)
  highlightMaxHops: number;    // default: 1    (range 1 .. 3, step 1)
  backgroundRetention: number; // default: 0.34 (range 0.12 .. 0.65, step 0.02)
}

export const DEFAULT_GRAPH_TUNING_STATE: Readonly<GraphTuningState> = {
  clusterCount: DEFAULT_TOPIC_CLUSTER_COUNT,
  stiffnessExponent: 2.1,
  distanceExponent: 1.35,
  baseLinkDistance2D: 18,
  repulsionScale: 1.0,
  degreeRepulsion: 0.48,
  gravityScale: 1.0,
  radialInnerRatio: 0.22,
  radialOuterRatio: 0.44,
  nodeRadius: 8,
  edgeWidth: 1.5,
  highlightMaxHops: 1,
  backgroundRetention: 0.34,
};

let currentGraphTuningState: GraphTuningState = { ...DEFAULT_GRAPH_TUNING_STATE };

export function getGraphTuningState(): Readonly<GraphTuningState> {
  return currentGraphTuningState;
}

export function setGraphTuningState(patch: Partial<GraphTuningState>): Readonly<GraphTuningState> {
  currentGraphTuningState = {
    ...currentGraphTuningState,
    ...patch,
  };
  return currentGraphTuningState;
}

export function resetGraphTuningState(): Readonly<GraphTuningState> {
  currentGraphTuningState = { ...DEFAULT_GRAPH_TUNING_STATE };
  return currentGraphTuningState;
}

export function isDefaultGraphTuningState(): boolean {
  const keys = Object.keys(DEFAULT_GRAPH_TUNING_STATE) as (keyof GraphTuningState)[];
  return keys.every(
    (k) => Math.abs(currentGraphTuningState[k] - DEFAULT_GRAPH_TUNING_STATE[k]) < 1e-4
  );
}

export function getGraphStyleTokens(isLight: boolean): GraphStyleTokens {
  const themeTokens = getThemeTokens(isLight);
  const tuning = currentGraphTuningState;
  return {
    edgeColor: themeTokens.edgeBase,
    edgeHoverColor: themeTokens.edgeHover,
    edgeWidth: tuning.edgeWidth,
    edgeHoverWidth: Number((tuning.edgeWidth * 1.733).toFixed(2)),
    nodeRadius: tuning.nodeRadius,
    nodeHoverScale: 1.25
  };
}

export function buildGraphAdjacency(
  edges: ReadonlyArray<{ source?: string; target?: string; sourceId?: string; targetId?: string }>
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    const src = edge.source ?? edge.sourceId;
    const tgt = edge.target ?? edge.targetId;
    if (!src || !tgt) continue;
    let srcSet = adjacency.get(src);
    if (!srcSet) {
      srcSet = new Set<string>();
      adjacency.set(src, srcSet);
    }
    srcSet.add(tgt);

    let tgtSet = adjacency.get(tgt);
    if (!tgtSet) {
      tgtSet = new Set<string>();
      adjacency.set(tgt, tgtSet);
    }
    tgtSet.add(src);
  }
  return adjacency;
}

export interface HopCurveParams {
  max: number;
  min: number;
  exponent: number;
  maxHops?: number;
}

export const HOP_ATTENUATION_CONFIG = {
  maxHops: 4,
  focusBudgetNodes: 16,
  directHubSoftThreshold: 8,
  hubDegreeBaseline: 4,
  hubPenaltyWeight: 0.65,
  nodeColor: { max: 1.0, min: 0.34, exponent: 1.35 },
  nodeScale: { max: 2.0, min: 0.68, exponent: 1.25 },
  edgeColor: { max: 1.0, min: 0.32, exponent: 1.20 },
  edgeWidth: { max: 3.0, min: 0.85, exponent: 1.10 }
} as const;

export function computeHopCurve(
  hopDistance: number | undefined,
  params: HopCurveParams
): number {
  const maxHops = params.maxHops ?? HOP_ATTENUATION_CONFIG.maxHops;
  const d = hopDistance ?? Infinity;
  if (d <= 0) return params.max;
  if (!Number.isFinite(d) || d >= maxHops) return params.min;
  const u = Math.max(0, Math.min(1, d / maxHops));
  return params.min + (params.max - params.min) * (1 - Math.pow(u, params.exponent));
}

export function computeHopDistances(
  startNodeId: string,
  adjacency: Map<string, Set<string>>
): Map<string, number> {
  const maxHops = Math.max(1, Math.min(3, Math.round(currentGraphTuningState.highlightMaxHops)));
  const distances = new Map<string, number>();
  distances.set(startNodeId, 0);

  if (maxHops === 1) {
    const neighbors = adjacency.get(startNodeId);
    if (neighbors) {
      for (const u of neighbors) {
        if (u !== startNodeId) {
          distances.set(u, 1);
        }
      }
    }
    return distances;
  }

  const queue: [string, number][] = [[startNodeId, 0]];
  let head = 0;
  while (head < queue.length) {
    const [curr, d] = queue[head++];
    if (d >= maxHops) continue;
    const neighbors = adjacency.get(curr);
    if (!neighbors) continue;
    for (const u of neighbors) {
      if (!distances.has(u)) {
        const nextD = d + 1;
        distances.set(u, nextD);
        if (nextD < maxHops) {
          queue.push([u, nextD]);
        }
      }
    }
  }
  return distances;
}

function parseHexRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace(/^#/, '').trim();
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16) || 0;
    const g = parseInt(cleaned[1] + cleaned[1], 16) || 0;
    const b = parseInt(cleaned[2] + cleaned[2], 16) || 0;
    return [r, g, b];
  }
  const r = parseInt(cleaned.slice(0, 2), 16) || 0;
  const g = parseInt(cleaned.slice(2, 4), 16) || 0;
  const b = parseInt(cleaned.slice(4, 6), 16) || 0;
  return [r, g, b];
}

function rgbTupleToHex(r: number, g: number, b: number): string {
  const hr = Math.max(0, Math.min(255, Math.round(r))).toString(16).padStart(2, '0');
  const hg = Math.max(0, Math.min(255, Math.round(g))).toString(16).padStart(2, '0');
  const hb = Math.max(0, Math.min(255, Math.round(b))).toString(16).padStart(2, '0');
  return `#${hr}${hg}${hb}`;
}

export const CLUSTER_PALETTE = {
  dark: [
    rgbTupleToHex(56, 189, 248),  // 0: Sky / Cyan
    rgbTupleToHex(245, 158, 11),  // 1: Amber / Gold
    rgbTupleToHex(16, 185, 129),  // 2: Emerald / Mint
    rgbTupleToHex(244, 63, 94),   // 3: Rose / Coral
    rgbTupleToHex(168, 85, 247),  // 4: Violet
    rgbTupleToHex(249, 115, 22),  // 5: Orange
    rgbTupleToHex(20, 184, 166),  // 6: Teal
    rgbTupleToHex(99, 102, 241),  // 7: Indigo
    rgbTupleToHex(132, 204, 22),  // 8: Lime
    rgbTupleToHex(236, 72, 153),  // 9: Pink
    rgbTupleToHex(6, 182, 212),   // 10: Cyan
    rgbTupleToHex(234, 179, 8),   // 11: Yellow
    rgbTupleToHex(217, 70, 239),  // 12: Fuchsia
    rgbTupleToHex(59, 130, 246),  // 13: Blue
    rgbTupleToHex(239, 68, 68),   // 14: Red
    rgbTupleToHex(34, 197, 94),   // 15: Green
    rgbTupleToHex(139, 92, 246),  // 16: Purple
    rgbTupleToHex(251, 113, 133), // 17: Warm Coral
  ],
  light: [
    rgbTupleToHex(2, 132, 199),   // 0: Sky / Cyan
    rgbTupleToHex(217, 119, 6),   // 1: Amber / Gold
    rgbTupleToHex(5, 150, 105),   // 2: Emerald / Mint
    rgbTupleToHex(225, 29, 72),   // 3: Rose / Coral
    rgbTupleToHex(147, 51, 234),  // 4: Violet
    rgbTupleToHex(234, 88, 12),   // 5: Orange
    rgbTupleToHex(13, 148, 136),  // 6: Teal
    rgbTupleToHex(79, 70, 229),   // 7: Indigo
    rgbTupleToHex(101, 163, 13),  // 8: Lime
    rgbTupleToHex(219, 39, 119),  // 9: Pink
    rgbTupleToHex(8, 145, 178),   // 10: Cyan
    rgbTupleToHex(202, 138, 4),   // 11: Yellow
    rgbTupleToHex(192, 38, 211),  // 12: Fuchsia
    rgbTupleToHex(37, 99, 235),   // 13: Blue
    rgbTupleToHex(220, 38, 38),   // 14: Red
    rgbTupleToHex(22, 163, 74),   // 15: Green
    rgbTupleToHex(124, 58, 237),  // 16: Purple
    rgbTupleToHex(225, 29, 72),   // 17: Warm Coral
  ],
} as const;

function srgbToLinear(c: number): number {
  const v = Math.max(0, Math.min(1, c / 255));
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v: number): number {
  const clamped = Math.max(0, Math.min(1, v));
  const s = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(s * 255)));
}

export function hexToOklab(hex: string): [number, number, number] {
  const [r8, g8, b8] = parseHexRgb(hex);
  const r = srgbToLinear(r8);
  const g = srgbToLinear(g8);
  const b = srgbToLinear(b8);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(Math.max(0, l));
  const m_ = Math.cbrt(Math.max(0, m));
  const s_ = Math.cbrt(Math.max(0, s));

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bLab = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  return [L, a, bLab];
}

export function oklabToHex(L: number, a: number, bLab: number): string {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * bLab;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bLab;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * bLab;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  return rgbTupleToHex(linearToSrgb(r), linearToSrgb(g), linearToSrgb(b));
}

export function mixHexColorsOklab(
  entries: ReadonlyArray<{ hex?: string; color?: string; weight: number }>
): string {
  const valid = entries
    .map((e) => ({ hex: e.hex || e.color || '', weight: e.weight }))
    .filter((e) => Boolean(e.hex) && Number.isFinite(e.weight) && e.weight > 0);
  if (valid.length === 0) return CLUSTER_PALETTE.dark[0];
  if (valid.length === 1) return valid[0].hex;

  let totalW = 0;
  for (const e of valid) totalW += e.weight;
  if (totalW <= 0) return valid[0].hex;

  let L = 0;
  let a = 0;
  let bLab = 0;
  let weightedMeanChroma = 0;

  for (const e of valid) {
    const p = e.weight / totalW;
    const [li, ai, bi] = hexToOklab(e.hex);
    L += p * li;
    a += p * ai;
    bLab += p * bi;
    weightedMeanChroma += p * Math.hypot(ai, bi);
  }

  const mixedChroma = Math.hypot(a, bLab);
  if (mixedChroma > 1e-4) {
    const targetChroma = 0.30 * mixedChroma + 0.70 * weightedMeanChroma;
    const chromaScale = Math.min(1.45, targetChroma / Math.max(0.02, mixedChroma));
    a *= chromaScale;
    bLab *= chromaScale;
  }

  return oklabToHex(L, a, bLab);
}

let activeContentFilterGroups: Set<number> | null = null;

export function getActiveContentFilterGroups(): ReadonlySet<number> | null {
  return activeContentFilterGroups;
}

export function getActiveContentFilterGroup(): number | null {
  if (!activeContentFilterGroups || activeContentFilterGroups.size === 0) return null;
  const first = activeContentFilterGroups.values().next().value;
  return typeof first === 'number' ? first : null;
}

export function resetContentFilterGroups(): void {
  activeContentFilterGroups = null;
}

export function setActiveContentFilterGroup(group: number | 'all' | null): number | null {
  if (group === null || group === 'all') {
    activeContentFilterGroups = null;
    return null;
  }
  const g = Math.round(group);
  if (g < 1 || g > 8) return getActiveContentFilterGroup();
  activeContentFilterGroups = new Set([g]);
  return g;
}

export function toggleContentFilterGroup(group: number | 'all'): ReadonlySet<number> | null {
  if (group === 'all') {
    activeContentFilterGroups = null;
    return activeContentFilterGroups;
  }
  const g = Math.round(group);
  if (g < 1 || g > 8) return activeContentFilterGroups;
  if (
    activeContentFilterGroups &&
    activeContentFilterGroups.size === 1 &&
    activeContentFilterGroups.has(g)
  ) {
    activeContentFilterGroups = null;
  } else {
    activeContentFilterGroups = new Set([g]);
  }
  return activeContentFilterGroups;
}

const POLYGON_UNIT_VERTICES_CACHE = new Map<number, ReadonlyArray<readonly [number, number]>>();

export function getContentGroupPolygonSides(group?: number): number {
  const g = Math.round(group ?? 1);
  return Math.max(3, Math.min(10, g + 2));
}

export function getPolygonAreaRadiusScale(sides: number): number {
  const n = Math.max(3, Math.min(10, Math.round(sides)));
  const unitPolyArea = 0.5 * n * Math.sin((2 * Math.PI) / n);
  return Number(Math.min(1.26, Math.sqrt(Math.PI / unitPolyArea)).toFixed(4));
}

export function getRegularPolygonUnitVertices(
  sides: number
): ReadonlyArray<readonly [number, number]> {
  const n = Math.max(3, Math.min(10, Math.round(sides)));
  const cached = POLYGON_UNIT_VERTICES_CACHE.get(n);
  if (cached) return cached;
  const startAngle = n === 4 ? -Math.PI / 4 : -Math.PI / 2;
  const step = (2 * Math.PI) / n;
  const verts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const theta = startAngle + i * step;
    verts.push([Math.cos(theta), Math.sin(theta)]);
  }
  POLYGON_UNIT_VERTICES_CACHE.set(n, verts);
  return verts;
}

export function drawRegularPolygonNode2D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  group: number | undefined,
  fillColor: string,
  strokeColor?: string,
  lineWidth = 1.5
): void {
  if (radius <= 0) return;
  const sides = getContentGroupPolygonSides(group);
  const r = radius * getPolygonAreaRadiusScale(sides);
  const verts = getRegularPolygonUnitVertices(sides);
  ctx.beginPath();
  for (let i = 0; i < verts.length; i++) {
    const vx = x + verts[i][0] * r;
    const vy = y + verts[i][1] * r;
    if (i === 0) ctx.moveTo(vx, vy);
    else ctx.lineTo(vx, vy);
  }
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  if (strokeColor && lineWidth > 0) {
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
  }
}

export function buildRegularPolygonSvgPoints(radius: number, group?: number): string {
  if (radius <= 0) return '0,0';
  const sides = getContentGroupPolygonSides(group);
  const r = radius * getPolygonAreaRadiusScale(sides);
  const verts = getRegularPolygonUnitVertices(sides);
  return verts
    .map(([ux, uy]) => `${(ux * r).toFixed(2)},${(uy * r).toFixed(2)}`)
    .join(' ');
}

export function getCytoscapePolygonPoints(group?: number): number[] {
  const sides = getContentGroupPolygonSides(group);
  const verts = getRegularPolygonUnitVertices(sides);
  const flat: number[] = [];
  for (const [ux, uy] of verts) {
    flat.push(Number(ux.toFixed(4)), Number(uy.toFixed(4)));
  }
  return flat;
}

export function isNodeDimmedByContentFilter(group?: number): boolean {
  if (!activeContentFilterGroups || activeContentFilterGroups.size === 0) return false;
  const g = group ?? 0;
  if (g === 0) return false;
  return !activeContentFilterGroups.has(g);
}

export function getNodeClusterColor(
  node: { group?: number; colorDark?: string; colorLight?: string; id?: string } | undefined,
  isLight: boolean
): string {
  const g = node?.group ?? 0;
  return isLight
    ? node?.colorLight || GRAPH_COLORS.light[g] || CLUSTER_PALETTE.light[0]
    : node?.colorDark || GRAPH_COLORS.dark[g] || CLUSTER_PALETTE.dark[0];
}

export function getNodeBaseColor(
  node: { group?: number; colorDark?: string; colorLight?: string; id?: string } | undefined,
  isLight: boolean
): string {
  const raw = getNodeClusterColor(node, isLight);
  if (isNodeDimmedByContentFilter(node?.group)) {
    const canvasBg = getThemeTokens(isLight).canvasBg;
    return blendHexColor(raw, canvasBg, 0.14);
  }
  return raw;
}

export const HIGHLIGHT_TRANSITION_MS = 750;

export const GRAPH_VIEWPORT_CONFIG = {
  padX: 30,
  padY: 30,
  adaptAlpha: 0.035,
  adaptDurationMs: 2400,
  minScale: 0.1,
  maxScale: 2.5,
  focusAlpha: 0.11,
  focusPadX: 64,
  focusPadY: 64,
  focusMaxScale: 2.2
} as const;

export const GRAPH_PHYSICS_CONFIG = {
  minWeightFloor: 0.08,
  stiffnessExponent: 2.1,
  distanceExponent: 1.35,
  baseLinkDistance2D: 18,
  baseLinkDistance3D: 10,
  collisionPadding2D: 4,
  d3LinkStrengthBase: 0.84,
  d3ChargeStrength: -85,
  d3ChargeDistanceMax: 420,
  d3CenterGravityStrength: 0.024,
  coseIdealEdgeBase: 12,
  coseEdgeElasticityBase: 8,
  coseNodeRepulsion: 13500,
  coseGravity: 0.48,
  coseIterations: 1000,
  sigmaIterations: 500,
  sigmaGravity: 0.36,
  sigmaScalingRatio: 1.8,
  sigmaSlowDown: 2,
  visIterations: 550,
  visRepulsionStrength: -58,
  visCentralGravity: 0.022,
  visSpringConstantBase: 0.32,
  visDamping: 0.42,
  force3DIterations: 600,
  force3DLinkStrengthBase: 0.84,
  force3DChargeStrength: -95,
  force3DCenterGravityStrength: 0.008,
} as const;

function clampNumber(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function getNodeDegreeRepulsionFactor(degree: number): number {
  const alpha = currentGraphTuningState.degreeRepulsion;
  if (!Number.isFinite(alpha) || alpha <= 0) return 1;
  const safeDeg = Number.isFinite(degree) ? Math.max(0, Math.min(8, degree)) : 0;
  return Math.pow((safeDeg + 1) / 4, alpha);
}

export function getEdgePhysicsMetrics(weight = 0.5): {
  clampedWeight: number;
  stiffnessFactor: number;
  distanceFactor: number;
} {
  const tuning = currentGraphTuningState;
  const clampedWeight = clampNumber(
    Number.isFinite(weight) ? weight : 0.5,
    GRAPH_PHYSICS_CONFIG.minWeightFloor,
    1
  );
  const stiffnessFactor = clampNumber(
    Math.pow(clampedWeight, tuning.stiffnessExponent),
    0.004,
    4.0
  );
  const distanceFactor = clampNumber(
    Math.pow(clampedWeight, -tuning.distanceExponent),
    0.25,
    14.0
  );
  return { clampedWeight, stiffnessFactor, distanceFactor };
}

export function getCoseEdgeIdealLength(weight = 0.5): number {
  const tuning = currentGraphTuningState;
  const m = getEdgePhysicsMetrics(weight);
  const baseScale = tuning.baseLinkDistance2D / GRAPH_PHYSICS_CONFIG.baseLinkDistance2D;
  const coseDistFactor = Math.pow(m.distanceFactor, 0.78);
  return clampNumber(
    Math.round(GRAPH_PHYSICS_CONFIG.coseIdealEdgeBase * baseScale * coseDistFactor),
    5,
    115
  );
}

export function getCoseEdgeElasticity(weight = 0.5): number {
  const m = getEdgePhysicsMetrics(weight);
  return Math.max(
    1,
    Math.round(GRAPH_PHYSICS_CONFIG.coseEdgeElasticityBase / Math.pow(Math.max(0.004, m.stiffnessFactor), 1.65))
  );
}

export function getEdgeLinkDistance2D(weight?: number): number {
  return Math.max(
    4,
    Math.round(currentGraphTuningState.baseLinkDistance2D * getEdgePhysicsMetrics(weight).distanceFactor)
  );
}

export function getEdgeLinkStrength2D(weight?: number): number {
  const sf = getEdgePhysicsMetrics(weight).stiffnessFactor;
  const base = GRAPH_PHYSICS_CONFIG.d3LinkStrengthBase;
  const strength =
    sf <= 1 ? base * sf : base + (0.96 - base) * clampNumber((sf - 1) / 2.5, 0, 1);
  return Number(strength.toFixed(4));
}

export function getEdgeLinkDistance3D(weight?: number): number {
  const scaledBase3D =
    GRAPH_PHYSICS_CONFIG.baseLinkDistance3D *
    (currentGraphTuningState.baseLinkDistance2D / GRAPH_PHYSICS_CONFIG.baseLinkDistance2D);
  return Math.max(2, Math.round(scaledBase3D * getEdgePhysicsMetrics(weight).distanceFactor));
}

export function getEdgeLinkStrength3D(weight?: number): number {
  const sf = getEdgePhysicsMetrics(weight).stiffnessFactor;
  const base = GRAPH_PHYSICS_CONFIG.force3DLinkStrengthBase;
  const strength =
    sf <= 1 ? base * sf : base + (0.96 - base) * clampNumber((sf - 1) / 2.5, 0, 1);
  return Number(strength.toFixed(4));
}

export function getSigmaForceAtlas2Settings(slowDownOverride?: number) {
  const tuning = currentGraphTuningState;
  const hubScale = 0.52 + 1.0 * Math.max(0, tuning.degreeRepulsion);
  return {
    linLogMode: false,
    outboundAttractionDistribution: false,
    adjustSizes: true,
    edgeWeightInfluence: 1,
    scalingRatio: Number(
      (GRAPH_PHYSICS_CONFIG.sigmaScalingRatio * tuning.repulsionScale * hubScale).toFixed(3)
    ),
    strongGravityMode: false,
    gravity: Number((GRAPH_PHYSICS_CONFIG.sigmaGravity * tuning.gravityScale).toFixed(4)),
    slowDown: slowDownOverride ?? GRAPH_PHYSICS_CONFIG.sigmaSlowDown,
  };
}

export const GRAPH_GEOMETRY_LAYOUT_CONFIG = {
  radialInnerRatio: 0.22,
  radialOuterRatio: 0.44,
  radialMaxOuterRatio: 0.52,
  radialMinInner2D: 90,
  radialMinOuter2D: 200,
  radialInner3D: 120,
  radialOuter3D: 260,
  columnsCategoryOrder: [1, 2, 3, 0, 4, 5, 6, 7, 8] as const,
  columnsPadXRatio: 0.08,
  columnsPadYRatio: 0.12,
  columnsMinPadX: 40,
  columnsMinPadY: 50,
  mobileBreakpoint: 768,
} as const;

export function getRadialReferenceBounds2D(
  width: number,
  height: number,
  centerOrigin = false
): [{ x: number; y: number }, { x: number; y: number }] {
  const minDim = Math.min(width, height);
  const refOuter = Math.max(
    GRAPH_GEOMETRY_LAYOUT_CONFIG.radialMinOuter2D *
      (GRAPH_GEOMETRY_LAYOUT_CONFIG.radialMaxOuterRatio /
        GRAPH_GEOMETRY_LAYOUT_CONFIG.radialOuterRatio),
    minDim * GRAPH_GEOMETRY_LAYOUT_CONFIG.radialMaxOuterRatio
  );
  const cx = centerOrigin ? 0 : width / 2;
  const cy = centerOrigin ? 0 : height / 2;
  return [
    { x: cx - refOuter, y: cy - refOuter },
    { x: cx + refOuter, y: cy + refOuter },
  ];
}

export interface Viewport2DFitResult {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  midX: number;
  midY: number;
  scale: number;
  panX: number;
  panY: number;
}

export function compute2DViewportFit(
  points: Iterable<{ x: number; y: number }>,
  width: number,
  height: number,
  worldNodeRadius = 8,
  isSubgraphFocus = false
): Viewport2DFitResult | null {
  if (width <= 0 || height <= 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const left = p.x - worldNodeRadius;
    const right = p.x + worldNodeRadius;
    const top = p.y - worldNodeRadius;
    const bottom = p.y + worldNodeRadius;
    if (left < minX) minX = left;
    if (right > maxX) maxX = right;
    if (top < minY) minY = top;
    if (bottom > maxY) maxY = bottom;
  }

  let boxW = maxX - minX;
  let boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0 || !Number.isFinite(boxW) || !Number.isFinite(boxH)) return null;

  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  if (isSubgraphFocus) {
    const minSpan = worldNodeRadius * 6;
    if (boxW < minSpan) {
      minX = midX - minSpan / 2;
      maxX = midX + minSpan / 2;
      boxW = minSpan;
    }
    if (boxH < minSpan) {
      minY = midY - minSpan / 2;
      maxY = midY + minSpan / 2;
      boxH = minSpan;
    }
  }

  const padX = isSubgraphFocus
    ? Math.max(GRAPH_VIEWPORT_CONFIG.focusPadX, Math.round(width * 0.12))
    : GRAPH_VIEWPORT_CONFIG.padX;
  const padY = isSubgraphFocus
    ? Math.max(GRAPH_VIEWPORT_CONFIG.focusPadY, Math.round(height * 0.14))
    : GRAPH_VIEWPORT_CONFIG.padY;
  const maxScale = isSubgraphFocus
    ? GRAPH_VIEWPORT_CONFIG.focusMaxScale
    : GRAPH_VIEWPORT_CONFIG.maxScale;

  const availW = Math.max(100, width - padX * 2);
  const availH = Math.max(100, height - padY * 2);
  const scale = Math.max(
    GRAPH_VIEWPORT_CONFIG.minScale,
    Math.min(maxScale, Math.min(availW / boxW, availH / boxH))
  );
  const panX = width / 2 - midX * scale;
  const panY = height / 2 - midY * scale;

  return { minX, maxX, minY, maxY, midX, midY, scale, panX, panY };
}

export function easeHighlightTransition(progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  return -(Math.cos(Math.PI * clamped) - 1) / 2;
}

export function blendHexColor(fgHex: string, bgHex: string, retention: number): string {
  const clamped = Math.max(0, Math.min(1, retention));
  if (clamped >= 1) return fgHex;
  const [fgR, fgG, fgB] = parseHexRgb(fgHex);
  const [bgR, bgG, bgB] = parseHexRgb(bgHex);
  const r = Math.round(bgR + (fgR - bgR) * clamped).toString(16).padStart(2, '0');
  const g = Math.round(bgG + (fgG - bgG) * clamped).toString(16).padStart(2, '0');
  const b = Math.round(bgB + (fgB - bgB) * clamped).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

export function interpolateHexColor(fromHex: string, toHex: string, t: number): string {
  if (t <= 0) return fromHex;
  if (t >= 1) return toHex;
  return blendHexColor(toHex, fromHex, t);
}

// ---------------------------------------------------------------------------
// K-change / timeline transition helpers (shared by all five engines, SYSTEM-014)
// ---------------------------------------------------------------------------

export const CLUSTER_TRANSITION_MS = 520;
export const CLUSTER_PILL_REST_ALPHA = 0.97;

export function interpolateHexColorOklab(fromHex: string, toHex: string, t: number): string {
  if (t <= 0 || fromHex === toHex) return fromHex;
  if (t >= 1) return toHex;
  const [l0, a0, b0] = hexToOklab(fromHex);
  const [l1, a1, b1] = hexToOklab(toHex);
  return oklabToHex(l0 + (l1 - l0) * t, a0 + (a1 - a0) * t, b0 + (b1 - b0) * t);
}

export interface TransitionPoint {
  x: number;
  y: number;
  z?: number;
}

export interface TransitionClusterInfo {
  id: string;
  name: string;
  colorDark: string;
  colorLight: string;
}

export interface GraphKChangeTransition {
  startedAt: number;
  durationMs: number;
  prevPositions: Map<string, TransitionPoint>;
  nextPositions: Map<string, TransitionPoint>;
  prevColors: Map<string, { dark: string; light: string }>;
  prevClusters: Map<string, TransitionClusterInfo>;
  /** New cluster id -> previous cluster id it continues or splits from. */
  originByNewClusterId: Map<string, string>;
  /** New clusters that visually continue an old one (same inherited colour). */
  continuingClusterIds: Set<string>;
  /** Old clusters that vanish: id -> new cluster id they merge into. */
  ghostTargetByOldId: Map<string, string>;
}

export interface GhostClusterPill extends TransitionClusterInfo {
  x: number;
  y: number;
  z?: number;
  alpha: number;
}

export interface CreateKChangeTransitionOptions {
  prevNodes: ReadonlyArray<GraphNodePayload>;
  prevPositions: ReadonlyMap<string, TransitionPoint>;
  nextNodes: ReadonlyArray<GraphNodePayload>;
  nextPositions: ReadonlyMap<string, TransitionPoint>;
  mergeTargetByOldClusterId?: Readonly<Record<string, string>>;
  now: number;
  durationMs?: number;
}

export function createKChangeTransition(opts: CreateKChangeTransitionOptions): GraphKChangeTransition {
  const prevPositions = new Map<string, TransitionPoint>();
  for (const [id, p] of opts.prevPositions) prevPositions.set(id, { x: p.x, y: p.y, z: p.z });
  const nextPositions = new Map<string, TransitionPoint>();
  for (const [id, p] of opts.nextPositions) nextPositions.set(id, { x: p.x, y: p.y, z: p.z });
  const prevColors = new Map<string, { dark: string; light: string }>();
  const prevClusters = new Map<string, TransitionClusterInfo>();
  for (const n of opts.prevNodes) {
    if (n.colorDark && n.colorLight) prevColors.set(n.id, { dark: n.colorDark, light: n.colorLight });
    if (n.group === 0) {
      prevClusters.set(n.id, {
        id: n.id,
        name: n.name,
        colorDark: n.colorDark ?? CLUSTER_PALETTE.dark[0],
        colorLight: n.colorLight ?? CLUSTER_PALETTE.light[0],
      });
    }
  }
  const originByNewClusterId = new Map<string, string>();
  const continuingClusterIds = new Set<string>();
  const nextClusterIds = new Set<string>();
  for (const n of opts.nextNodes) {
    if (n.group !== 0) continue;
    nextClusterIds.add(n.id);
    const originId = n.originClusterId ?? (prevClusters.has(n.id) ? n.id : undefined);
    if (!originId) continue;
    originByNewClusterId.set(n.id, originId);
    const old = prevClusters.get(originId);
    if (old && (n.originKind ? n.originKind === 'match' : old.colorDark === n.colorDark)) {
      continuingClusterIds.add(n.id);
    }
  }
  const claimedOld = new Set<string>();
  for (const id of continuingClusterIds) claimedOld.add(originByNewClusterId.get(id)!);
  const ghostTargetByOldId = new Map<string, string>();
  for (const oldId of prevClusters.keys()) {
    if (claimedOld.has(oldId)) continue;
    const target = opts.mergeTargetByOldClusterId?.[oldId];
    if (target && nextClusterIds.has(target)) ghostTargetByOldId.set(oldId, target);
  }
  return {
    startedAt: opts.now,
    durationMs: opts.durationMs ?? CLUSTER_TRANSITION_MS,
    prevPositions,
    nextPositions,
    prevColors,
    prevClusters,
    originByNewClusterId,
    continuingClusterIds,
    ghostTargetByOldId,
  };
}

/** Raw (linear) progress 0..1 for the given wall-clock time. */
export function getKChangeTransitionProgress(tr: GraphKChangeTransition, now: number): number {
  if (tr.durationMs <= 0) return 1;
  return Math.max(0, Math.min(1, (now - tr.startedAt) / tr.durationMs));
}

function lerpTransitionPoint(a: TransitionPoint, b: TransitionPoint, e: number): TransitionPoint {
  return {
    x: a.x + (b.x - a.x) * e,
    y: a.y + (b.y - a.y) * e,
    z: a.z !== undefined || b.z !== undefined ? (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * e : undefined,
  };
}

/** Interpolated (eased) node position. Nodes without a previous position start at their target. */
export function sampleKChangeNodePosition(
  tr: GraphKChangeTransition,
  nodeId: string,
  progress: number
): TransitionPoint | null {
  const to = tr.nextPositions.get(nodeId);
  if (!to) return null;
  const from = tr.prevPositions.get(nodeId);
  if (!from) return to;
  return lerpTransitionPoint(from, to, easeHighlightTransition(progress));
}

export function sampleKChangeNodeColor(
  tr: GraphKChangeTransition,
  nodeId: string,
  nextColor: { dark: string; light: string },
  isLight: boolean,
  progress: number
): string {
  const prev = tr.prevColors.get(nodeId);
  const to = isLight ? nextColor.light : nextColor.dark;
  if (!prev) return to;
  return interpolateHexColorOklab(isLight ? prev.light : prev.dark, to, easeHighlightTransition(progress));
}

/** Continuing / newly split cluster pill: position, alpha and colour while transitioning. */
export function sampleKChangeClusterPill(
  tr: GraphKChangeTransition,
  clusterId: string,
  nextColor: { dark: string; light: string },
  isLight: boolean,
  progress: number
): { x: number; y: number; z?: number; alpha: number; color: string } | null {
  const to = tr.nextPositions.get(clusterId);
  if (!to) return null;
  const e = easeHighlightTransition(progress);
  const originId = tr.originByNewClusterId.get(clusterId);
  const from = originId ? tr.prevPositions.get(originId) : undefined;
  const pos = from ? lerpTransitionPoint(from, to, e) : to;
  const continuing = tr.continuingClusterIds.has(clusterId);
  // New (split/born) pills fade in with a slightly delayed, eased start: alpha 0 -> 0.97
  const fade = easeHighlightTransition((progress - 0.12) / 0.88);
  const alpha = continuing ? CLUSTER_PILL_REST_ALPHA : CLUSTER_PILL_REST_ALPHA * fade;
  const prevInfo = originId ? tr.prevClusters.get(originId) : undefined;
  const target = isLight ? nextColor.light : nextColor.dark;
  const color =
    prevInfo && continuing
      ? interpolateHexColorOklab(isLight ? prevInfo.colorLight : prevInfo.colorDark, target, e)
      : target;
  return { x: pos.x, y: pos.y, z: pos.z, alpha, color };
}

export interface ClusterLabelCrossfade {
  oldLabel: string;
  newLabel: string;
  /** Eased blend 0..1: new label alpha = blend, old label alpha = 1 - blend. */
  blend: number;
  oldAlpha: number;
  newAlpha: number;
  oldPillW: number;
  newPillW: number;
  /** Interpolated frame width (symmetric inner padding at every frame). */
  pillW: number;
}

/** Label cross-fade state for a continuing cluster whose label changed; null when unchanged. */
export function sampleKChangeClusterLabel(
  tr: GraphKChangeTransition,
  clusterId: string,
  newName: string,
  progress: number
): ClusterLabelCrossfade | null {
  if (!tr.continuingClusterIds.has(clusterId)) return null;
  const originId = tr.originByNewClusterId.get(clusterId);
  const old = originId ? tr.prevClusters.get(originId) : undefined;
  if (!old || old.name === newName) return null;
  const blend = easeHighlightTransition(progress);
  const oldPillW = getClusterPillDimensions(old.name).pillW;
  const newPillW = getClusterPillDimensions(newName).pillW;
  return {
    oldLabel: old.name,
    newLabel: newName,
    blend,
    oldAlpha: 1 - blend,
    newAlpha: blend,
    oldPillW,
    newPillW,
    pillW: Math.round(oldPillW + (newPillW - oldPillW) * blend),
  };
}

/** Ghost pills of vanishing clusters gliding to their merge target while fading out. */
export function sampleKChangeGhostPills(tr: GraphKChangeTransition, progress: number): GhostClusterPill[] {
  const e = easeHighlightTransition(progress);
  const out: GhostClusterPill[] = [];
  for (const [oldId, targetId] of tr.ghostTargetByOldId) {
    const info = tr.prevClusters.get(oldId);
    const from = tr.prevPositions.get(oldId);
    const to = tr.nextPositions.get(targetId);
    if (!info || !from || !to) continue;
    const pos = lerpTransitionPoint(from, to, e);
    out.push({ ...info, x: pos.x, y: pos.y, z: pos.z, alpha: CLUSTER_PILL_REST_ALPHA * (1 - e) });
  }
  return out;
}

export function getAttenuatedNodeScale(
  hopDistance: number | undefined,
  activeClusterCoverage?: number
): number {
  if (activeClusterCoverage !== undefined) {
    const cov = Math.max(
      0,
      Math.min(1, Number.isFinite(activeClusterCoverage) ? activeClusterCoverage : 0)
    );
    if (cov <= 0) return HOP_ATTENUATION_CONFIG.nodeScale.min;
    return Number((0.95 + 0.47 * cov).toFixed(4));
  }
  if (hopDistance === undefined || !Number.isFinite(hopDistance)) {
    return HOP_ATTENUATION_CONFIG.nodeScale.min;
  }
  if (hopDistance <= 0) {
    return HOP_ATTENUATION_CONFIG.nodeScale.max;
  }
  if (hopDistance === 1) {
    return 1.42;
  }
  if (hopDistance === 2) {
    return 1.15;
  }
  if (hopDistance === 3) {
    return 0.96;
  }
  return computeHopCurve(hopDistance, HOP_ATTENUATION_CONFIG.nodeScale);
}

export function getAttenuatedNodeColor(
  baseColor: string,
  hopDistance: number | undefined,
  isLight: boolean,
  activeClusterCoverage?: number
): string {
  const canvasBg = getThemeTokens(isLight).canvasBg;
  if (activeClusterCoverage !== undefined) {
    const cov = Math.max(
      0,
      Math.min(1, Number.isFinite(activeClusterCoverage) ? activeClusterCoverage : 0)
    );
    if (cov <= 0) {
      return blendHexColor(baseColor, canvasBg, 0.12);
    }
    if (cov >= 0.999) {
      return baseColor;
    }
    const covRetention = 0.18 + 0.82 * cov;
    return blendHexColor(baseColor, canvasBg, covRetention);
  }
  const bgRet = currentGraphTuningState.backgroundRetention;
  let retention: number;
  if (hopDistance === undefined || !Number.isFinite(hopDistance)) {
    retention = bgRet;
  } else if (hopDistance <= 0) {
    return baseColor;
  } else if (hopDistance === 1) {
    retention = 0.92;
  } else if (hopDistance === 2) {
    retention = Math.max(bgRet + 0.12, 0.68);
  } else if (hopDistance === 3) {
    retention = Math.max(bgRet + 0.05, 0.52);
  } else {
    retention = bgRet;
  }
  if (retention >= 1) return baseColor;
  return blendHexColor(baseColor, canvasBg, retention);
}

export const BACKBONE_WEIGHT_THRESHOLD = 0.18;

export const TAG_CLUSTER_HUB_SCALE = 1.0;

export function getNodeRestRadiusScale(_group?: number, _nodeSize?: number): number {
  return 1.0;
}

export function isBackboneEdge(weight?: number): boolean {
  return (weight ?? 0.5) >= BACKBONE_WEIGHT_THRESHOLD;
}

export function getRestEdgeStyle(
  weight: number | undefined,
  isLight: boolean
): { color: string; width: number; opacity: number; isBackbone: boolean } {
  const styleTokens = getGraphStyleTokens(isLight);
  const canvasBg = getThemeTokens(isLight).canvasBg;
  const clusterHue = (isLight ? GRAPH_COLORS.light[0] : GRAPH_COLORS.dark[0]) || styleTokens.edgeHoverColor;
  const w = weight ?? 0.75;
  const t = clampNumber((w - 0.20) / 0.76, 0, 1);
  const opacity = Number((0.16 + 0.46 * Math.pow(t, 1.15)).toFixed(3));
  const width = Number((styleTokens.edgeWidth * (0.42 + 1.08 * Math.pow(t, 1.20))).toFixed(2));
  const baseHue = blendHexColor(clusterHue, styleTokens.edgeColor, 0.16 + 0.54 * t);
  return {
    color: blendHexColor(baseHue, canvasBg, opacity),
    width,
    opacity,
    isBackbone: isBackboneEdge(w),
  };
}

export function getAttenuatedEdgeStyle(
  sourceDistance: number | undefined,
  targetDistance: number | undefined,
  isLight: boolean,
  weight?: number
): { color: string; width: number } {
  const styleTokens = getGraphStyleTokens(isLight);
  const dSrc = sourceDistance ?? Infinity;
  const dTgt = targetDistance ?? Infinity;
  const canvasBg = getThemeTokens(isLight).canvasBg;
  const bgEdgeRet = Math.max(0.10, currentGraphTuningState.backgroundRetention * 0.76);

  if (dSrc === 0 || dTgt === 0) {
    const w = weight ?? 0.75;
    const t = clampNumber((w - 0.20) / 0.76, 0, 1);
    return {
      color: styleTokens.edgeHoverColor,
      width: Number((styleTokens.edgeWidth * (1.05 + 1.05 * t)).toFixed(2))
    };
  }

  const maxHops = Math.max(1, Math.min(3, Math.round(currentGraphTuningState.highlightMaxHops)));
  if (maxHops > 1 && Number.isFinite(dSrc) && Number.isFinite(dTgt) && Math.abs(dSrc - dTgt) === 1) {
    const outerHop = Math.max(dSrc, dTgt);
    if (outerHop <= maxHops) {
      const hopRet = outerHop === 2 ? Math.max(bgEdgeRet + 0.18, 0.58) : Math.max(bgEdgeRet + 0.08, 0.42);
      const hopWidth = outerHop === 2 ? styleTokens.edgeWidth * 1.25 : styleTokens.edgeWidth * 0.95;
      return {
        color: blendHexColor(styleTokens.edgeHoverColor, canvasBg, hopRet),
        width: Number(hopWidth.toFixed(2))
      };
    }
  }

  const wBg = weight ?? 0.55;
  const tBg = clampNumber((wBg - 0.20) / 0.76, 0, 1);
  return {
    color: blendHexColor(styleTokens.edgeColor, canvasBg, bgEdgeRet * (0.55 + 0.45 * tBg)),
    width: Number((styleTokens.edgeWidth * (0.36 + 0.32 * tBg)).toFixed(2))
  };
}

export function formatClusterLabelShort(name: string): string {
  return name.length > 44 ? `${name.slice(0, 42)}…` : name;
}

export interface ClusterPillVisualState {
  hasCoverage: boolean;
  isSelfActive: boolean;
  isHighlighted: boolean;
  alpha: number;
  pctText: string | null;
}

export function resolveClusterPillVisualState(
  c: { hopDistance?: number; activeCoverage?: number },
  anyFocusActive: boolean
): ClusterPillVisualState {
  const hasCoverage =
    typeof c.activeCoverage === 'number' &&
    Number.isFinite(c.activeCoverage) &&
    c.activeCoverage > 0;
  const isSelfActive = c.hopDistance === 0 && !hasCoverage;
  const isHighlighted = hasCoverage || isSelfActive;
  const alpha = !anyFocusActive ? 0.97 : isHighlighted ? 1.0 : 0.14;
  const pctText = hasCoverage
    ? `${Math.max(1, Math.min(100, Math.round(c.activeCoverage! * 100)))}%`
    : null;
  return {
    hasCoverage,
    isSelfActive,
    isHighlighted,
    alpha,
    pctText,
  };
}

export interface ClusterPillDimensions {
  baseLabel: string;
  pctText: string | null;
  dotLeadW: number;
  baseW: number;
  sepW: number;
  pctW: number;
  totalTextW: number;
  pillW: number;
  pillH: number;
  badgeGap: number;
  badgeW: number;
  badgeH: number;
}

let sharedTextMeasureCtx: CanvasRenderingContext2D | null | undefined;

export function measureTextWidthPx(text: string, font: string): number {
  if (!text) return 0;
  if (typeof document !== 'undefined') {
    if (sharedTextMeasureCtx === undefined) {
      try {
        const canvas = document.createElement('canvas');
        sharedTextMeasureCtx = canvas.getContext('2d');
      } catch {
        sharedTextMeasureCtx = null;
      }
    }
    if (sharedTextMeasureCtx) {
      sharedTextMeasureCtx.font = font;
      const w = sharedTextMeasureCtx.measureText(text).width;
      if (Number.isFinite(w) && w > 0) {
        return Math.ceil(w) + 4;
      }
    }
  }
  return Math.ceil(text.length * 6.35) + 4;
}

export function getClusterPillDimensions(
  text: string,
  activeCoverage?: number,
  _isHighlighted = false,
  scaleFactor = 1,
  measured?: { baseW?: number; sepW?: number; pctW?: number }
): ClusterPillDimensions {
  const s = Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;
  const baseLabel = formatClusterLabelShort(text);
  const hasCoverage =
    typeof activeCoverage === 'number' && Number.isFinite(activeCoverage) && activeCoverage > 0;
  const pctText = hasCoverage
    ? `${Math.max(1, Math.min(100, Math.round(activeCoverage! * 100)))}%`
    : null;
  const dotLeadW = 10.5 * s;
  const rawBaseW =
    measured?.baseW ??
    measureTextWidthPx(baseLabel, '600 10px Inter, system-ui, -apple-system, sans-serif');
  const baseW = Math.ceil(rawBaseW) * s;
  const sepW = 0;
  const rawPctW = pctText
    ? (measured?.pctW ??
      measureTextWidthPx(pctText, '700 10px Inter, system-ui, -apple-system, sans-serif'))
    : 0;
  const pctW = pctText ? Math.ceil(rawPctW) * s : 0;
  // Main pill dimensions depend ONLY on text and scaleFactor (never on activeCoverage or isHighlighted)
  const totalTextW = dotLeadW + baseW;
  const padX = 8 * s;
  const pillW = Math.ceil(totalTextW + padX * 2);
  const pillH = 20 * s;
  // External right-docked coverage badge dimensions
  const badgeGap = 4 * s;
  const badgePadX = 6 * s;
  const badgeW = pctText ? Math.ceil(pctW + badgePadX * 2) : 0;
  const badgeH = 18 * s;
  return {
    baseLabel,
    pctText,
    dotLeadW,
    baseW,
    sepW,
    pctW,
    totalTextW,
    pillW,
    pillH,
    badgeGap,
    badgeW,
    badgeH,
  };
}

export interface ClusterCalloutNodeInput {
  id: string;
  x: number;
  y: number;
  radiusPx: number;
  group?: number;
}

export interface ClusterCalloutSpecInput {
  id: string;
  text: string;
  x: number;
  y: number;
  radiusPx: number;
  clusterColor?: string;
  hopDistance?: number;
  activeCoverage?: number;
  measuredBaseW?: number;
  measuredSepW?: number;
  measuredPctW?: number;
  /** Transition alpha (0..0.97): scales the resolved pill alpha (split fade-in / merge fade-out). */
  alphaOverride?: number;
  /** Label cross-fade: previous label text + eased blend 0..1 (old fades out, new fades in). */
  crossfadeFrom?: { text: string; blend: number };
  measuredOldBaseW?: number;
}

export interface ClusterCalloutPlacement {
  id: string;
  cx: number;
  cy: number;
  px: number;
  py: number;
  pillW: number;
  pillH: number;
  dotLeadW: number;
  baseW: number;
  sepW: number;
  pctW: number;
  totalTextW: number;
  badgeGap: number;
  badgeW: number;
  badgeH: number;
  startX: number;
  startY: number;
  anchorX: number;
  anchorY: number;
  baseLabel: string;
  pctText: string | null;
  clusterColor?: string;
  alpha: number;
  isHighlighted: boolean;
  crossfade?: { oldLabel: string; oldBaseW: number; newBaseW: number; blend: number };
}

export function computeClusterCalloutPlacements2D(
  _allNodes: ReadonlyArray<ClusterCalloutNodeInput>,
  clusterSpecs: ReadonlyArray<ClusterCalloutSpecInput>,
  _viewport?: { width: number; height: number },
  scaleFactor = 1
): Map<string, ClusterCalloutPlacement> {
  const result = new Map<string, ClusterCalloutPlacement>();
  if (clusterSpecs.length === 0) return result;

  const s = Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;
  const anyFocusActive = clusterSpecs.some(
    (c) => c.hopDistance !== undefined || c.activeCoverage !== undefined
  );

  for (const c of clusterSpecs) {
    const pillState = resolveClusterPillVisualState(c, anyFocusActive);
    let dims = getClusterPillDimensions(c.text, c.activeCoverage, pillState.isHighlighted, s, {
      baseW: c.measuredBaseW,
      sepW: c.measuredSepW,
      pctW: c.measuredPctW,
    });
    let crossfade: ClusterCalloutPlacement['crossfade'];
    if (c.crossfadeFrom) {
      const oldDims = getClusterPillDimensions(c.crossfadeFrom.text, undefined, false, s, {
        baseW: c.measuredOldBaseW,
      });
      const b = Math.max(0, Math.min(1, c.crossfadeFrom.blend));
      const pw = Math.round(oldDims.pillW + (dims.pillW - oldDims.pillW) * b);
      crossfade = {
        oldLabel: oldDims.baseLabel,
        oldBaseW: oldDims.baseW,
        newBaseW: dims.baseW,
        blend: b,
      };
      dims = { ...dims, pillW: pw, totalTextW: pw - 16 * s };
    }

    result.set(c.id, {
      id: c.id,
      cx: c.x,
      cy: c.y,
      px: c.x,
      py: c.y,
      pillW: dims.pillW,
      pillH: dims.pillH,
      dotLeadW: dims.dotLeadW,
      baseW: dims.baseW,
      sepW: dims.sepW,
      pctW: dims.pctW,
      totalTextW: dims.totalTextW,
      badgeGap: dims.badgeGap,
      badgeW: dims.badgeW,
      badgeH: dims.badgeH,
      startX: c.x,
      startY: c.y,
      anchorX: c.x,
      anchorY: c.y,
      baseLabel: dims.baseLabel,
      pctText: dims.pctText,
      clusterColor: c.clusterColor,
      crossfade,
      alpha:
        c.alphaOverride !== undefined
          ? pillState.alpha * Math.max(0, Math.min(1, c.alphaOverride / CLUSTER_PILL_REST_ALPHA))
          : pillState.alpha,
      isHighlighted: pillState.isHighlighted,
    });
  }

  return result;
}

export function drawClusterCalloutLabels2D(
  ctx: CanvasRenderingContext2D,
  allNodes: ReadonlyArray<ClusterCalloutNodeInput>,
  clusterSpecs: ReadonlyArray<ClusterCalloutSpecInput>,
  isLight: boolean,
  viewport?: { width: number; height: number }
): void {
  if (clusterSpecs.length === 0) return;
  const baseFont = '600 10px Inter, system-ui, -apple-system, sans-serif';
  const boldFont = '700 10px Inter, system-ui, -apple-system, sans-serif';
  const canvasBg = getThemeTokens(isLight).canvasBg;

  ctx.save();
  ctx.font = baseFont;
  const measuredSpecs: ClusterCalloutSpecInput[] = clusterSpecs.map((c) => {
    const baseLabel = formatClusterLabelShort(c.text);
    const hasCoverage =
      typeof c.activeCoverage === 'number' &&
      Number.isFinite(c.activeCoverage) &&
      c.activeCoverage > 0;
    const pctText = hasCoverage
      ? `${Math.max(1, Math.min(100, Math.round(c.activeCoverage! * 100)))}%`
      : null;
    ctx.font = baseFont;
    const measuredBaseW = ctx.measureText(baseLabel).width;
    let measuredPctW = 0;
    if (pctText) {
      ctx.font = boldFont;
      measuredPctW = ctx.measureText(pctText).width;
    }
    let measuredOldBaseW: number | undefined;
    if (c.crossfadeFrom) {
      ctx.font = baseFont;
      measuredOldBaseW = ctx.measureText(formatClusterLabelShort(c.crossfadeFrom.text)).width;
    }
    return {
      ...c,
      measuredBaseW,
      measuredOldBaseW,
      measuredSepW: 0,
      measuredPctW,
    };
  });
  ctx.restore();

  const placements = computeClusterCalloutPlacements2D(allNodes, measuredSpecs, viewport, 1);

  for (let idx = 0; idx < measuredSpecs.length; idx++) {
    const c = measuredSpecs[idx];
    const pl = placements.get(c.id);
    if (!pl || pl.alpha < 0.05) continue;

    const fallbackPalette = isLight ? CLUSTER_PALETTE.light : CLUSTER_PALETTE.dark;
    const clusterHue =
      pl.clusterColor || fallbackPalette[idx % fallbackPalette.length] || fallbackPalette[0];

    ctx.save();
    ctx.globalAlpha = pl.alpha;

    const rx = pl.px - pl.pillW / 2;
    const ry = pl.py - pl.pillH / 2;
    const bgFill = blendHexColor(clusterHue, canvasBg, pl.isHighlighted ? 0.22 : 0.13);
    const borderStroke = blendHexColor(clusterHue, canvasBg, pl.isHighlighted ? 1.0 : 0.72);

    ctx.fillStyle = bgFill;
    ctx.strokeStyle = borderStroke;
    ctx.lineWidth = pl.isHighlighted ? 1.8 : 1.25;

    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(rx, ry, pl.pillW, pl.pillH, 6);
    } else {
      ctx.rect(rx, ry, pl.pillW, pl.pillH);
    }
    ctx.fill();
    ctx.stroke();

    const contentStartX = pl.px - pl.totalTextW / 2;
    const dotCenterX = contentStartX + 3;
    const dotCenterY = pl.py;

    // 6px filled dot in the cluster's pure color
    ctx.beginPath();
    ctx.arc(dotCenterX, dotCenterY, 3, 0, Math.PI * 2);
    ctx.fillStyle = clusterHue;
    ctx.fill();

    // Cluster title inside the constant-size main pill
    const textStartX = contentStartX + pl.dotLeadW;
    const textColor = isLight ? rgbTupleToHex(15, 23, 42) : rgbTupleToHex(248, 250, 252);
    ctx.font = baseFont;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = textColor;
    if (pl.crossfade) {
      const regionW = pl.totalTextW - pl.dotLeadW;
      const xf = pl.crossfade;
      const baseAlpha = ctx.globalAlpha;
      ctx.globalAlpha = baseAlpha * (1 - xf.blend);
      ctx.fillText(xf.oldLabel, textStartX + (regionW - xf.oldBaseW) / 2, pl.py + 0.5);
      ctx.globalAlpha = baseAlpha * xf.blend;
      ctx.fillText(pl.baseLabel, textStartX + (regionW - xf.newBaseW) / 2, pl.py + 0.5);
      ctx.globalAlpha = baseAlpha;
    } else {
      ctx.fillText(pl.baseLabel, textStartX, pl.py + 0.5);
    }

    // External right-docked coverage percentage satellite badge (zero main pill resize)
    if (pl.pctText && pl.badgeW > 0) {
      const badgeX = rx + pl.pillW + pl.badgeGap;
      const badgeY = pl.py - pl.badgeH / 2;
      ctx.fillStyle = blendHexColor(clusterHue, canvasBg, 0.26);
      ctx.strokeStyle = clusterHue;
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(badgeX, badgeY, pl.badgeW, pl.badgeH, 5);
      } else {
        ctx.rect(badgeX, badgeY, pl.badgeW, pl.badgeH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.font = boldFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = clusterHue;
      ctx.fillText(pl.pctText, badgeX + pl.badgeW / 2, pl.py + 0.5);
    }

    ctx.restore();
  }
}

export function drawClusterNodeLabel2D(
  ctx: CanvasRenderingContext2D,
  text: string,
  screenX: number,
  screenY: number,
  screenRadiusPx: number,
  isLight: boolean,
  hopDistance?: number,
  activeCoverage?: number,
  clusterColor?: string
): void {
  drawClusterCalloutLabels2D(
    ctx,
    [{ id: '__self__', x: screenX, y: screenY, radiusPx: screenRadiusPx, group: 0 }],
    [
      {
        id: '__self__',
        text,
        x: screenX,
        y: screenY,
        radiusPx: screenRadiusPx,
        clusterColor,
        hopDistance,
        activeCoverage,
      },
    ],
    isLight
  );
}

export function getNodeHopZIndex(
  hopDistance: number | undefined,
  activeClusterCoverage?: number
): number {
  if (activeClusterCoverage !== undefined && Number.isFinite(activeClusterCoverage)) {
    const cov = clampNumber(activeClusterCoverage, 0, 1);
    if (cov <= 0) return 2;
    return Math.round(12 + 36 * cov);
  }
  if (
    hopDistance === undefined ||
    !Number.isFinite(hopDistance) ||
    hopDistance >= HOP_ATTENUATION_CONFIG.maxHops
  ) {
    return 2;
  }
  if (hopDistance <= 0) return 50;
  return Math.max(10, Math.round(50 - hopDistance * 10));
}

export function getEdgeHopZIndex(
  sourceDistance: number | undefined,
  targetDistance: number | undefined
): number {
  const dSrc = sourceDistance ?? Infinity;
  const dTgt = targetDistance ?? Infinity;
  if (dSrc === 0 || dTgt === 0) {
    return 38;
  }
  const maxHops = Math.max(1, Math.min(3, Math.round(currentGraphTuningState.highlightMaxHops)));
  if (maxHops > 1 && Number.isFinite(dSrc) && Number.isFinite(dTgt) && Math.abs(dSrc - dTgt) === 1) {
    const outerHop = Math.max(dSrc, dTgt);
    if (outerHop <= maxHops) {
      return Math.max(10, Math.round(50 - outerHop * 10) - 2);
    }
  }
  return 1;
}

export interface TagCounts {
  posts: Record<string, number>;
  publications: Record<string, number>;
  presentations: Record<string, number>;
  courses: Record<string, number>;
  projects: Record<string, number>;
  services: Record<string, number>;
  newsletters: Record<string, number>;
  visualizations: Record<string, number>;
  allTags: string[];
}

type ImageSource =
  | Parameters<typeof getImage>[0]["src"]
  | {
      src?: Parameters<typeof getImage>[0]["src"];
      image?: Parameters<typeof getImage>[0]["src"];
      title?: string;
      description?: string;
      caption?: string;
    };

function extractImageSrc(img: ImageSource | undefined): Parameters<typeof getImage>[0]["src"] | undefined {
  if (!img) return undefined;
  if (typeof img === "object" && img !== null) {
    if ("src" in img && img.src) {
      return img.src as Parameters<typeof getImage>[0]["src"];
    }
    if ("image" in img && img.image) {
      return img.image as Parameters<typeof getImage>[0]["src"];
    }
  }
  return img as Parameters<typeof getImage>[0]["src"];
}

interface RawEntity {
  id: string;
  body?: string;
  data: {
    title: string;
    subtitle?: string;
    description?: string;
    pubDate?: string | Date;
    tags?: string[];
    image?: ImageSource;
    abstract?: string;
    book?: string;
    event?: string;
    location?: string;
  };
}

interface RawTag {
  id: string;
  data: {
    title?: string;
    description?: string;
  };
}

export function calculateTagCounts(options: {
  posts: RawEntity[];
  publications: RawEntity[];
  presentations?: RawEntity[];
  courses: RawEntity[];
  projects: RawEntity[];
  services: RawEntity[];
  visualizations?: RawEntity[];
  newsletters?: RawEntity[];
}): TagCounts {
  const tagPosts: Record<string, number> = {};
  options.posts.forEach(p => {
    if (p.data.tags) {
      new Set(p.data.tags).forEach(t => {
        tagPosts[t] = (tagPosts[t] || 0) + 1;
      });
    }
  });

  const tagPubs: Record<string, number> = {};
  options.publications.forEach(p => {
    if (p.data.tags) {
      new Set(p.data.tags).forEach(t => {
        tagPubs[t] = (tagPubs[t] || 0) + 1;
      });
    }
  });

  const tagPres: Record<string, number> = {};
  (options.presentations || []).forEach(p => {
    if (p.data.tags) {
      new Set(p.data.tags).forEach(t => {
        tagPres[t] = (tagPres[t] || 0) + 1;
      });
    }
  });

  const tagCourses: Record<string, number> = {};
  options.courses.forEach(c => {
    if (c.data.tags) {
      new Set(c.data.tags).forEach(t => {
        tagCourses[t] = (tagCourses[t] || 0) + 1;
      });
    }
  });

  const tagProjects: Record<string, number> = {};
  options.projects.forEach(p => {
    if (p.data.tags) {
      new Set(p.data.tags).forEach(t => {
        tagProjects[t] = (tagProjects[t] || 0) + 1;
      });
    }
  });

  const tagServices: Record<string, number> = {};
  options.services.forEach(s => {
    if (s.data.tags) {
      new Set(s.data.tags).forEach(t => {
        tagServices[t] = (tagServices[t] || 0) + 1;
      });
    }
  });

  const tagVis: Record<string, number> = {};
  (options.visualizations || []).forEach(v => {
    if (v.data.tags) {
      new Set(v.data.tags).forEach(t => {
        tagVis[t] = (tagVis[t] || 0) + 1;
      });
    }
  });

  const tagNewsletters: Record<string, number> = {};
  (options.newsletters || []).forEach(n => {
    if (n.data.tags) {
      new Set(n.data.tags).forEach(t => {
        tagNewsletters[t] = (tagNewsletters[t] || 0) + 1;
      });
    }
  });

  const allTags = Array.from(new Set([
    ...Object.keys(tagPosts),
    ...Object.keys(tagPubs),
    ...Object.keys(tagPres),
    ...Object.keys(tagCourses),
    ...Object.keys(tagProjects),
    ...Object.keys(tagServices),
    ...Object.keys(tagNewsletters),
    ...Object.keys(tagVis)
  ]));

  return {
    posts: tagPosts,
    publications: tagPubs,
    presentations: tagPres,
    courses: tagCourses,
    projects: tagProjects,
    services: tagServices,
    newsletters: tagNewsletters,
    visualizations: tagVis,
    allTags
  };
}

export interface BuildGraphPayloadOptions {
  posts: RawEntity[];
  publications: RawEntity[];
  presentations?: RawEntity[];
  courses: RawEntity[];
  projects: RawEntity[];
  services: RawEntity[];
  newsletters?: RawEntity[];
  visualizations?: RawEntity[];
  tags: RawTag[];
  getImage?: typeof getImage;
}

export interface TagClusterMemberInfo {
  slug: string;
  title: string;
  itemCount: number;
}

export interface TagClusterDescriptor {
  nodeId: string;
  lead: TagClusterMemberInfo;
  members: TagClusterMemberInfo[];
  coveredItemIds: string[];
}

interface InternalTagEntry {
  slug: string;
  title: string;
  items: Set<string>;
}

interface InternalTagCluster {
  lead: InternalTagEntry;
  members: InternalTagEntry[];
}

function partitionTagsIntoTopicClusters(
  tags: InternalTagEntry[],
  nItems: number,
  targetClusterCount?: number
): TagClusterDescriptor[] {
  if (tags.length === 0) return [];
  const N_ITEMS = Math.max(1, nItems);

  const overlapCache = new Map<string, { shared: number; ochiai: number; minOverlap: number; score: number }>();

  const overlapInfo = (a: InternalTagEntry, b: InternalTagEntry) => {
    if (a.slug === b.slug) {
      return { shared: a.items.size, ochiai: 1, minOverlap: 1, score: 1 };
    }
    const key = a.slug < b.slug ? `${a.slug}\0${b.slug}` : `${b.slug}\0${a.slug}`;
    const cached = overlapCache.get(key);
    if (cached) return cached;

    let shared = 0;
    const [smaller, larger] = a.items.size <= b.items.size ? [a.items, b.items] : [b.items, a.items];
    for (const id of smaller) {
      if (larger.has(id)) shared++;
    }
    if (shared === 0) {
      const zero = { shared: 0, ochiai: 0, minOverlap: 0, score: 0 };
      overlapCache.set(key, zero);
      return zero;
    }

    const ochiai = shared / Math.sqrt(a.items.size * b.items.size);
    const minOverlap = shared / Math.min(a.items.size, b.items.size);
    const lift = (shared * N_ITEMS) / (a.items.size * b.items.size);
    const pmiNorm = Math.max(0, Math.log2(Math.max(1, lift)) / 4.5);
    const hubPenalty = a.items.size > 32 && b.items.size > 32 ? 0.65 : 1.0;
    const score = (0.48 * ochiai + 0.32 * minOverlap + 0.20 * pmiNorm) * hubPenalty;
    const res = { shared, ochiai, minOverlap, score };
    overlapCache.set(key, res);
    return res;
  };

  const tagSpecificNeighborStrength = new Map<string, number>();
  for (const a of tags) {
    const scores: number[] = [];
    for (const b of tags) {
      if (a.slug === b.slug) continue;
      const sc = overlapInfo(a, b).score;
      if (sc > 0) scores.push(sc);
    }
    scores.sort((x, y) => y - x);
    const top6 = scores.slice(0, Math.min(6, scores.length));
    const meanTop6 = top6.length > 0 ? top6.reduce((s, v) => s + v, 0) / top6.length : 0;
    tagSpecificNeighborStrength.set(a.slug, meanTop6);
  }

  const defaultK = Math.min(10, Math.max(1, Math.round(Math.sqrt(tags.length * 0.8))));
  const TARGET_K = Math.min(
    tags.length,
    targetClusterCount !== undefined && Number.isFinite(targetClusterCount)
      ? Math.max(2, Math.min(24, Math.round(targetClusterCount)))
      : defaultK
  );

  const chosenSeeds: InternalTagEntry[] = [];
  const chosenSet = new Set<string>();
  const minSeedItemThreshold = TARGET_K <= 12 ? 11 : TARGET_K <= 16 ? 7 : 4;

  while (chosenSeeds.length < TARGET_K) {
    let candidates = tags.filter((t) => !chosenSet.has(t.slug) && t.items.size >= minSeedItemThreshold);
    if (candidates.length === 0) {
      candidates = tags.filter((t) => !chosenSet.has(t.slug));
    }
    if (candidates.length === 0) break;

    let bestCand: InternalTagEntry | null = null;
    let bestUtility = -Infinity;

    for (const cand of candidates) {
      let maxSimToSeed = 0;
      let meanSimToSeeds = 0;
      if (chosenSeeds.length > 0) {
        const sims = chosenSeeds.map((s) => overlapInfo(cand, s).ochiai);
        maxSimToSeed = Math.max(...sims);
        meanSimToSeeds = sims.reduce((a, b) => a + b, 0) / sims.length;
      }

      let coverageGain = 0;
      for (const other of tags) {
        const currentCov =
          chosenSeeds.length === 0
            ? 0
            : Math.max(...chosenSeeds.map((s) => overlapInfo(s, other).score));
        const candScore = overlapInfo(cand, other).score;
        if (candScore > currentCov) {
          coverageGain += (candScore - currentCov) * Math.pow(other.items.size, 0.35);
        }
      }

      const neighborCohesion = Math.pow(tagSpecificNeighborStrength.get(cand.slug) ?? 0.2, 1.35);
      const diversityFactor = Math.pow(
        Math.max(0.04, 1 - maxSimToSeed * 1.05 - meanSimToSeeds * 0.35),
        2.1
      );
      const sizeFactor = Math.pow(cand.items.size, 0.65);
      const utility = coverageGain * diversityFactor * sizeFactor * neighborCohesion;

      if (utility > bestUtility) {
        bestUtility = utility;
        bestCand = cand;
      }
    }

    if (!bestCand) break;
    chosenSeeds.push(bestCand);
    chosenSet.add(bestCand.slug);
  }

  const clusters: InternalTagCluster[] = chosenSeeds.map((lead) => ({
    lead,
    members: [lead],
  }));

  const avgClusterSize = Math.max(4, tags.length / Math.max(1, TARGET_K));
  const softCap1 = Math.max(5, Math.round(avgClusterSize * 1.03));
  const softCap2 = Math.max(7, Math.round(avgClusterSize * 1.27));
  const minClusterFloor = Math.max(3, Math.round(avgClusterSize * 0.63));

  const computeClusterAffinity = (t: InternalTagEntry, candCl: InternalTagCluster): number => {
    const leadScore = overlapInfo(t, candCl.lead).score;
    const others = candCl.members.filter((m) => m.slug !== t.slug);
    const memberScores = others.map((m) => overlapInfo(t, m).score).sort((a, b) => b - a);
    const topK = memberScores.slice(0, Math.min(4, memberScores.length));
    const topAvg = topK.length > 0 ? topK.reduce((a, b) => a + b, 0) / topK.length : leadScore;
    const len = others.length;
    const sizePenalty =
      len * 0.010 + Math.max(0, len - softCap1) * 0.028 + Math.max(0, len - softCap2) * 0.065;
    const smallBonus = len < minClusterFloor ? (minClusterFloor - len) * 0.018 : 0;
    return 0.52 * leadScore + 0.48 * topAvg - sizePenalty + smallBonus;
  };

  for (const t of tags) {
    if (chosenSet.has(t.slug)) continue;
    let bestCluster = clusters[0];
    let bestAffinity = -Infinity;
    for (const cl of clusters) {
      const aff = computeClusterAffinity(t, cl);
      if (aff > bestAffinity) {
        bestAffinity = aff;
        bestCluster = cl;
      }
    }
    bestCluster.members.push(t);
  }

  const minRetainSize = Math.max(2, Math.round(avgClusterSize * 0.48));
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const cl of clusters) {
      for (let i = cl.members.length - 1; i >= 1; i--) {
        if (cl.members.length <= minRetainSize) continue;
        const t = cl.members[i];
        let bestCl = cl;
        let bestScore = computeClusterAffinity(t, cl);
        for (const candCl of clusters) {
          if (candCl === cl) continue;
          const sc = computeClusterAffinity(t, candCl);
          if (sc > bestScore + 1e-6) {
            bestScore = sc;
            bestCl = candCl;
          }
        }
        if (bestCl !== cl) {
          cl.members.splice(i, 1);
          bestCl.members.push(t);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  return clusters.map((cl) => {
    const restMembers = cl.members
      .slice(1)
      .sort((a, b) => b.items.size - a.items.size || a.slug.localeCompare(b.slug));
    const orderedMembers = [cl.lead, ...restMembers];
    const coveredSet = new Set<string>();
    for (const m of orderedMembers) {
      for (const itemId of m.items) {
        coveredSet.add(itemId);
      }
    }
    return {
      nodeId: `/tags/${encodeURIComponent(cl.lead.slug)}/`,
      lead: {
        slug: cl.lead.slug,
        title: cl.lead.title,
        itemCount: cl.lead.items.size,
      },
      members: orderedMembers.map((m) => ({
        slug: m.slug,
        title: m.title,
        itemCount: m.items.size,
      })),
      coveredItemIds: Array.from(coveredSet).sort(),
    };
  });
}

export function buildAutomaticTagClusters(
  options: BuildGraphPayloadOptions,
  targetClusterCount?: number
): TagClusterDescriptor[] {
  const tagCounts = calculateTagCounts(options);
  const tagMap = new Map(options.tags.map((t) => [t.id, t]));

  const tagItemsMap = new Map<string, Set<string>>();
  for (const slug of tagCounts.allTags) {
    tagItemsMap.set(slug, new Set<string>());
  }

  const recordEntityTags = (prefix: string, entities: ReadonlyArray<RawEntity> | undefined) => {
    for (const ent of entities || []) {
      const itemPath = `/${prefix}/${ent.id}/`;
      for (const rawTag of ent.data.tags || []) {
        let s = tagItemsMap.get(rawTag);
        if (!s) {
          s = new Set<string>();
          tagItemsMap.set(rawTag, s);
        }
        s.add(itemPath);
      }
    }
  };

  recordEntityTags('posts', options.posts);
  recordEntityTags('publications', options.publications);
  recordEntityTags('presentations', options.presentations);
  recordEntityTags('courses', options.courses);
  recordEntityTags('projects', options.projects);
  recordEntityTags('services', options.services);
  recordEntityTags('newsletters', options.newsletters);
  recordEntityTags('visualizations', options.visualizations);

  const N_ITEMS = Math.max(
    1,
    options.posts.length +
      options.publications.length +
      (options.presentations?.length || 0) +
      options.courses.length +
      options.projects.length +
      options.services.length +
      (options.newsletters?.length || 0) +
      (options.visualizations?.length || 0)
  );

  const tags: InternalTagEntry[] = Array.from(tagItemsMap.entries())
    .filter(([, items]) => items.size > 0)
    .map(([slug, items]) => ({
      slug,
      title: tagMap.get(slug)?.data.title ?? slug,
      items,
    }))
    .sort((a, b) => b.items.size - a.items.size || a.slug.localeCompare(b.slug));

  return partitionTagsIntoTopicClusters(tags, N_ITEMS, targetClusterCount);
}

interface ClusterIdentityStabilization {
  colorByNewId: Map<string, { dark: string; light: string }>;
  originByNewId: Map<string, string>;
  kindByNewId: Map<string, 'match' | 'split'>;
  mergeTargetByOldId: Record<string, string>;
}

/**
 * Matches new clusters to previous clusters by tag-set Jaccard similarity (greedy, highest first,
 * sim > 0). Matched clusters inherit the exact colour pair; unmatched (split) clusters take the
 * first unused palette pair and point to the previous cluster with the largest tag overlap.
 * Previous clusters left unmatched (merged away) are mapped to their best-overlapping new cluster.
 */
function stabilizeClusterIdentity(
  tagClusters: ReadonlyArray<TagClusterDescriptor>,
  previousNodes: ReadonlyArray<GraphNodePayload>
): ClusterIdentityStabilization {
  const prev = previousNodes
    .filter((n) => n.group === 0)
    .map((n) => ({ node: n, tags: new Set<string>(n.memberTags ?? n.tags ?? []) }))
    .sort((a, b) => a.node.id.localeCompare(b.node.id));
  const next = tagClusters
    .map((cl) => ({ cl, tags: new Set<string>(cl.members.map((m) => m.slug)) }))
    .sort((a, b) => a.cl.nodeId.localeCompare(b.cl.nodeId));
  const inter = (a: Set<string>, b: Set<string>): number => {
    let c = 0;
    for (const s of a) if (b.has(s)) c++;
    return c;
  };
  const pairs: { oi: number; ni: number; sim: number }[] = [];
  prev.forEach((p, oi) => {
    next.forEach((n, ni) => {
      const shared = inter(p.tags, n.tags);
      if (shared === 0) return;
      pairs.push({ oi, ni, sim: shared / (p.tags.size + n.tags.size - shared) });
    });
  });
  pairs.sort((a, b) => b.sim - a.sim || a.oi - b.oi || a.ni - b.ni);

  const matchedOld = new Set<number>();
  const matchedNew = new Map<number, number>();
  for (const pr of pairs) {
    if (pr.sim <= 0 || matchedOld.has(pr.oi) || matchedNew.has(pr.ni)) continue;
    matchedOld.add(pr.oi);
    matchedNew.set(pr.ni, pr.oi);
  }

  const colorByNewId = new Map<string, { dark: string; light: string }>();
  const originByNewId = new Map<string, string>();
  const kindByNewId = new Map<string, 'match' | 'split'>();
  const usedDark = new Set<string>();
  const palDark = CLUSTER_PALETTE.dark as readonly string[];
  const palLight = CLUSTER_PALETTE.light as readonly string[];

  for (const [ni, oi] of matchedNew) {
    const old = prev[oi].node;
    const dark = old.colorDark ?? palDark[ni % palDark.length];
    const light = old.colorLight ?? palLight[ni % palLight.length];
    colorByNewId.set(next[ni].cl.nodeId, { dark, light });
    originByNewId.set(next[ni].cl.nodeId, old.id);
    kindByNewId.set(next[ni].cl.nodeId, 'match');
    usedDark.add(dark.toLowerCase());
  }
  // Colours still carried by unmatched old clusters stay reserved until they have faded out.
  const reserved = new Set(
    prev
      .filter((_, oi) => !matchedOld.has(oi))
      .map((p) => (p.node.colorDark ?? '').toLowerCase())
  );
  next.forEach((n, ni) => {
    if (matchedNew.has(ni)) return;
    let idx = palDark.findIndex(
      (d) => !usedDark.has(d.toLowerCase()) && !reserved.has(d.toLowerCase())
    );
    if (idx < 0) idx = palDark.findIndex((d) => !usedDark.has(d.toLowerCase()));
    if (idx < 0) idx = ni % palDark.length;
    usedDark.add(palDark[idx].toLowerCase());
    colorByNewId.set(n.cl.nodeId, { dark: palDark[idx], light: palLight[idx] });
    let best = -1;
    let bestShared = 0;
    prev.forEach((p, oi) => {
      const shared = inter(p.tags, n.tags);
      if (shared > bestShared) {
        bestShared = shared;
        best = oi;
      }
    });
    if (best >= 0) {
      originByNewId.set(n.cl.nodeId, prev[best].node.id);
      kindByNewId.set(n.cl.nodeId, 'split');
    }
  });
  const mergeTargetByOldId: Record<string, string> = {};
  prev.forEach((p, oi) => {
    if (matchedOld.has(oi)) return;
    let best = -1;
    let bestShared = 0;
    next.forEach((n, ni) => {
      const shared = inter(p.tags, n.tags);
      if (shared > bestShared) {
        bestShared = shared;
        best = ni;
      }
    });
    if (best < 0 && next.length > 0) best = 0;
    if (best >= 0) mergeTargetByOldId[p.node.id] = next[best].cl.nodeId;
  });

  return { colorByNewId, originByNewId, kindByNewId, mergeTargetByOldId };
}

function buildClusteredGraphFromItemsAndTags(
  contentNodes: ReadonlyArray<GraphNodePayload>,
  rawTags: ReadonlyArray<RawTagSummary>,
  targetClusterCount: number = DEFAULT_TOPIC_CLUSTER_COUNT,
  previousNodes?: ReadonlyArray<GraphNodePayload>
): CanonicalGraphPayload {
  const tagTitleMap = new Map<string, string>();
  const tagItemsMap = new Map<string, Set<string>>();
  for (const rt of rawTags) {
    tagTitleMap.set(rt.id, rt.name);
    tagItemsMap.set(rt.id, new Set<string>());
  }

  for (const node of contentNodes) {
    for (const slug of node.tags || []) {
      let s = tagItemsMap.get(slug);
      if (!s) {
        s = new Set<string>();
        tagItemsMap.set(slug, s);
      }
      s.add(node.id);
    }
  }

  const N_ITEMS = Math.max(1, contentNodes.length);
  const tags: InternalTagEntry[] = Array.from(tagItemsMap.entries())
    .filter(([, items]) => items.size > 0)
    .map(([slug, items]) => ({
      slug,
      title: tagTitleMap.get(slug) ?? slug,
      items,
    }))
    .sort((a, b) => b.items.size - a.items.size || a.slug.localeCompare(b.slug));

  const tagClusters = partitionTagsIntoTopicClusters(tags, N_ITEMS, targetClusterCount);

  const clusterByTagSlug = new Map<string, TagClusterDescriptor>();
  const tagItemCountBySlug = new Map<string, number>();
  for (const cl of tagClusters) {
    for (const m of cl.members) {
      clusterByTagSlug.set(m.slug, cl);
      tagItemCountBySlug.set(m.slug, m.itemCount);
    }
  }

  const getTagIdf = (slug: string): number => {
    const dt = tagItemCountBySlug.get(slug) ?? 1;
    return Math.log(1 + N_ITEMS / Math.max(1, dt));
  };

  const visConnections: GraphConnectionPayload[] = [];
  const cumulativeOverlapByCluster = new Map<string, number>();
  const linkedItemCountByCluster = new Map<string, number>();
  const clusterColorByNodeId = new Map<string, { dark: string; light: string }>();
  tagClusters.forEach((cl, cIdx) => {
    cumulativeOverlapByCluster.set(cl.nodeId, 0);
    linkedItemCountByCluster.set(cl.nodeId, 0);
    clusterColorByNodeId.set(cl.nodeId, {
      dark: CLUSTER_PALETTE.dark[cIdx % CLUSTER_PALETTE.dark.length],
      light: CLUSTER_PALETTE.light[cIdx % CLUSTER_PALETTE.light.length],
    });
  });
  const stabilized = previousNodes ? stabilizeClusterIdentity(tagClusters, previousNodes) : null;
  if (stabilized) {
    for (const [nodeId, colors] of stabilized.colorByNewId) clusterColorByNodeId.set(nodeId, colors);
  }

  const itemColorMap = new Map<string, { dark: string; light: string }>();

  for (const item of contentNodes) {
    const itemTags = item.tags || [];
    if (itemTags.length === 0) continue;
    let totalItemIdfSum = 0;
    const byCluster = new Map<string, { cl: TagClusterDescriptor; matchCount: number; clusterIdfSum: number }>();

    for (const tagSlug of itemTags) {
      const cl = clusterByTagSlug.get(tagSlug);
      if (!cl) continue;
      const idfVal = getTagIdf(tagSlug);
      totalItemIdfSum += idfVal;
      let entry = byCluster.get(cl.nodeId);
      if (!entry) {
        entry = { cl, matchCount: 0, clusterIdfSum: 0 };
        byCluster.set(cl.nodeId, entry);
      }
      entry.matchCount += 1;
      entry.clusterIdfSum += idfVal;
    }

    if (totalItemIdfSum <= 0 || byCluster.size === 0) continue;

    const scoredClusters = Array.from(byCluster.values()).map((entry) => {
      const overlapRatio = entry.clusterIdfSum / totalItemIdfSum;
      const coverage = 0.78 * overlapRatio + 0.22 * Math.min(1, entry.matchCount / 3);
      return {
        nodeId: entry.cl.nodeId,
        matchCount: entry.matchCount,
        overlapRatio,
        coverage,
      };
    });

    scoredClusters.sort((a, b) => {
      const diff = b.overlapRatio - a.overlapRatio;
      if (Math.abs(diff) > 1e-9) return diff;
      if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
      return a.nodeId.localeCompare(b.nodeId);
    });

    const darkMix = mixHexColorsOklab(
      scoredClusters.map((sc) => ({
        hex: clusterColorByNodeId.get(sc.nodeId)?.dark || CLUSTER_PALETTE.dark[0],
        weight: sc.overlapRatio,
      }))
    );
    const lightMix = mixHexColorsOklab(
      scoredClusters.map((sc) => ({
        hex: clusterColorByNodeId.get(sc.nodeId)?.light || CLUSTER_PALETTE.light[0],
        weight: sc.overlapRatio,
      }))
    );
    itemColorMap.set(item.id, { dark: darkMix, light: lightMix });

    const maxOverlap = scoredClusters[0]?.overlapRatio ?? 1;
    const baseMaxWeight = 0.52 + 0.44 * Math.pow(maxOverlap, 0.85);

    scoredClusters.forEach((sc) => {
      const relToMax = maxOverlap > 0 ? sc.overlapRatio / maxOverlap : 1;
      const weight = Number(
        clampNumber(baseMaxWeight * Math.pow(relToMax, 1 / 2.1), 0.20, 0.96).toFixed(4)
      );
      cumulativeOverlapByCluster.set(
        sc.nodeId,
        (cumulativeOverlapByCluster.get(sc.nodeId) || 0) + sc.overlapRatio
      );
      linkedItemCountByCluster.set(
        sc.nodeId,
        (linkedItemCountByCluster.get(sc.nodeId) || 0) + 1
      );
      visConnections.push({
        sourceId: item.id,
        targetId: sc.nodeId,
        weight,
        coverage: Number(sc.overlapRatio.toFixed(3)),
      });
    });
  }

  const clusterNodes: GraphNodePayload[] = tagClusters.map((cl, cIdx) => {
    const covSum = cumulativeOverlapByCluster.get(cl.nodeId) || 0;
    const linkedItemsCount = linkedItemCountByCluster.get(cl.nodeId) || cl.coveredItemIds.length;
    const clColors = clusterColorByNodeId.get(cl.nodeId) || {
      dark: CLUSTER_PALETTE.dark[cIdx % CLUSTER_PALETTE.dark.length],
      light: CLUSTER_PALETTE.light[cIdx % CLUSTER_PALETTE.light.length],
    };

    const topTwoNames = cl.members
      .slice(0, 2)
      .map((m) => m.title)
      .join(' · ');
    const conciseName = cl.members.length >= 2 ? `#${topTwoNames}` : `#${cl.lead.title}`;

    const memberPreview = cl.members
      .slice(0, 8)
      .map((m) => m.title)
      .join(', ');
    const suffix = cl.members.length > 8 ? ', …' : '';

    return {
      id: cl.nodeId,
      name: conciseName,
      size: 1,
      group: 0,
      colorDark: clColors.dark,
      colorLight: clColors.light,
      typeLabel: 'Tag',
      description: `${linkedItemsCount} linked content items (cumulative overlap: ${covSum.toFixed(1)}) across ${cl.members.length} grouped tags: ${memberPreview}${suffix}.`,
      tags: cl.members.slice(0, 6).map((m) => m.slug),
      memberTags: cl.members.map((m) => m.slug),
      ...(stabilized?.originByNewId.has(cl.nodeId)
        ? {
            originClusterId: stabilized.originByNewId.get(cl.nodeId),
            originKind: stabilized.kindByNewId.get(cl.nodeId),
          }
        : {}),
    };
  });

  const visNodes: GraphNodePayload[] = [
    ...clusterNodes,
    ...contentNodes.map((n) => {
      const itemColors = itemColorMap.get(n.id);
      return {
        ...n,
        colorDark: itemColors?.dark || CLUSTER_PALETTE.dark[0],
        colorLight: itemColors?.light || CLUSTER_PALETTE.light[0],
        tags: n.tags ? [...n.tags] : undefined,
      };
    }),
  ];

  const degreeCounts = new Map<string, number>();
  for (const conn of visConnections) {
    degreeCounts.set(conn.sourceId, (degreeCounts.get(conn.sourceId) || 0) + 1);
    degreeCounts.set(conn.targetId, (degreeCounts.get(conn.targetId) || 0) + 1);
  }
  for (const node of visNodes) {
    node.connectionCount = degreeCounts.get(node.id) || 0;
  }

  return {
    nodes: visNodes,
    connections: visConnections,
    rawTags: rawTags.map((rt) => ({ ...rt })),
    ...(stabilized ? { mergeTargetByOldClusterId: stabilized.mergeTargetByOldId } : {}),
  };
}

export function reclusterCanonicalGraphPayload(
  canonical: CanonicalGraphPayload,
  targetClusterCount: number,
  previousNodes?: ReadonlyArray<GraphNodePayload>
): CanonicalGraphPayload {
  const clampedK = Math.max(2, Math.min(18, Math.round(targetClusterCount)));
  const contentNodes = canonical.nodes.filter((n) => n.group !== 0);
  let rawTags: RawTagSummary[] = canonical.rawTags ? [...canonical.rawTags] : [];
  if (rawTags.length === 0) {
    const slugSet = new Set<string>();
    for (const n of contentNodes) {
      for (const s of n.tags || []) slugSet.add(s);
    }
    rawTags = Array.from(slugSet).map((slug) => ({ id: slug, name: slug }));
  }
  return buildClusteredGraphFromItemsAndTags(contentNodes, rawTags, clampedK, previousNodes);
}

export async function buildCanonicalGraphPayload(
  options: BuildGraphPayloadOptions
): Promise<CanonicalGraphPayload> {
  const tagCounts = calculateTagCounts(options);
  const tagMap = new Map(options.tags.map((t) => [t.id, t]));
  const rawTags: RawTagSummary[] = tagCounts.allTags.map((slug) => ({
    id: slug,
    name: tagMap.get(slug)?.data.title ?? slug,
  }));

  const contentNodes: GraphNodePayload[] = [];
  const dedupTags = (tags: string[] | undefined): string[] =>
    tags ? Array.from(new Set(tags)) : [];

  // Group 1: Posts
  for (const post of options.posts) {
    const path = `/posts/${post.id}/`;
    let imageSrc: string | undefined = undefined;
    const postImg = extractImageSrc(post.data.image);
    if (postImg && options.getImage) {
      try {
        const opt = await options.getImage({ src: postImg, format: "webp", width: 240, quality: 75 });
        imageSrc = opt.src;
      } catch (e) {
        console.warn("Failed to optimize post icon", e);
      }
    }
    contentNodes.push({
      id: path,
      name: post.data.title,
      size: 1,
      group: 1,
      typeLabel: "Post",
      description: post.data.description,
      date: post.data.pubDate ? formatDate(post.data.pubDate, 'short') : undefined,
      image: imageSrc,
      tags: dedupTags(post.data.tags)
    });
  }

  // Group 2: Publications
  for (const pub of options.publications) {
    const path = `/publications/${pub.id}/`;
    contentNodes.push({
      id: path,
      name: pub.data.title,
      size: 1,
      group: 2,
      typeLabel: "Publication",
      description: pub.data.abstract || pub.data.book,
      date: pub.data.pubDate ? formatDate(pub.data.pubDate, 'short') : undefined,
      tags: dedupTags(pub.data.tags)
    });
  }

  // Group 3: Presentations
  for (const pres of options.presentations || []) {
    const path = `/presentations/${pres.id}/`;
    let imageSrc: string | undefined = undefined;
    const presImg = extractImageSrc(pres.data.image);
    if (presImg && options.getImage) {
      try {
        const opt = await options.getImage({ src: presImg, format: "webp", width: 240, quality: 75 });
        imageSrc = opt.src;
      } catch (e) {
        console.warn("Failed to optimize presentation preview", e);
      }
    }
    contentNodes.push({
      id: path,
      name: pres.data.title,
      size: 1,
      group: 3,
      typeLabel: "Presentation",
      description: pres.data.subtitle || pres.data.description,
      date: pres.data.pubDate ? formatDate(pres.data.pubDate, 'short') : undefined,
      image: imageSrc,
      tags: dedupTags(pres.data.tags)
    });
  }

  // Group 4: Courses
  for (const course of options.courses) {
    const path = `/courses/${course.id}/`;
    let imageSrc: string | undefined = undefined;
    const courseImg = extractImageSrc(course.data.image);
    if (courseImg && options.getImage) {
      try {
        const opt = await options.getImage({ src: courseImg, format: "webp", width: 240, quality: 75 });
        imageSrc = opt.src;
      } catch (e) {
        console.warn("Failed to optimize course screenshot", e);
      }
    }
    contentNodes.push({
      id: path,
      name: course.data.title,
      size: 1,
      group: 4,
      typeLabel: "Course",
      description: course.data.description,
      date: course.data.pubDate ? formatDate(course.data.pubDate, 'short') : undefined,
      image: imageSrc,
      tags: dedupTags(course.data.tags)
    });
  }

  // Group 5: Projects
  for (const project of options.projects) {
    const path = `/projects/${project.id}/`;
    let imageSrc: string | undefined = undefined;
    const projectImg = extractImageSrc(project.data.image);
    if (projectImg && options.getImage) {
      try {
        const opt = await options.getImage({ src: projectImg, format: "webp", width: 240, quality: 75 });
        imageSrc = opt.src;
      } catch (e) {
        console.warn("Failed to optimize project screenshot", e);
      }
    }
    contentNodes.push({
      id: path,
      name: project.data.title,
      size: 1,
      group: 5,
      typeLabel: "Project",
      description: project.data.description,
      date: project.data.pubDate ? formatDate(project.data.pubDate, 'short') : undefined,
      image: imageSrc,
      tags: dedupTags(project.data.tags)
    });
  }

  // Group 6: Services
  for (const service of options.services) {
    const path = `/services/${service.id}/`;
    let imageSrc: string | undefined = undefined;
    const serviceImg = extractImageSrc(service.data.image);
    if (serviceImg && options.getImage) {
      try {
        const opt = await options.getImage({ src: serviceImg, format: "webp", width: 240, quality: 75 });
        imageSrc = opt.src;
      } catch (e) {
        console.warn("Failed to optimize service preview", e);
      }
    }
    contentNodes.push({
      id: path,
      name: service.data.title,
      size: 1,
      group: 6,
      typeLabel: "Service",
      description: service.data.description,
      date: service.data.pubDate ? formatDate(service.data.pubDate, 'short') : undefined,
      image: imageSrc,
      tags: dedupTags(service.data.tags)
    });
  }

  // Group 7: Newsletters
  for (const nl of options.newsletters || []) {
    const path = `/newsletters/${nl.id}/`;
    let imageSrc: string | undefined = undefined;
    const nlImg = extractImageSrc(nl.data.image);
    if (nlImg && options.getImage) {
      try {
        const opt = await options.getImage({ src: nlImg, format: "webp", width: 240, quality: 75 });
        imageSrc = opt.src;
      } catch (e) { 
        console.warn("Failed to optimize newsletter icon", e);
      }
    }
    contentNodes.push({
      id: path,
      name: nl.data.title,
      size: 1,
      group: 7,
      typeLabel: "Newsletter",
      description: nl.data.description,
      date: nl.data.pubDate ? formatDate(nl.data.pubDate, "short") : undefined,
      image: imageSrc,
      tags: dedupTags(nl.data.tags)
    });
  }

  // Group 8: Visualizations
  for (const vis of options.visualizations || []) {
    const path = `/visualizations/${vis.id}/`;
    let imageSrc: string | undefined = undefined;
    const visImg = extractImageSrc(vis.data.image);
    if (visImg && options.getImage) {
      try {
        const opt = await options.getImage({ src: visImg, format: "webp", width: 240, quality: 75 });
        imageSrc = opt.src;
      } catch (e) { 
        console.warn("Failed to optimize visualization screenshot", e);
      }
    }
    contentNodes.push({
      id: path,
      name: vis.data.title,
      size: 1,
      group: 8,
      typeLabel: "Visualization",
      description: vis.data.description,
      image: imageSrc,
      tags: dedupTags(vis.data.tags)
    });
  }

  return buildClusteredGraphFromItemsAndTags(contentNodes, rawTags, DEFAULT_TOPIC_CLUSTER_COUNT);
}

/**
 * Re-clusters the canonical payload to K clusters with colour/identity stabilization against the
 * currently displayed nodes. With `restoreDefault` (tuning reset) and K == default, the pristine
 * canonical colours are kept while still carrying origin/merge metadata for the transition.
 */
export function resolveKChangeCanonical(
  canonical: CanonicalGraphPayload,
  targetK: number,
  currentNodes: ReadonlyArray<GraphNodePayload>,
  restoreDefault = false
): CanonicalGraphPayload {
  const stabilized = reclusterCanonicalGraphPayload(canonical, targetK, currentNodes);
  if (!restoreDefault || targetK !== DEFAULT_TOPIC_CLUSTER_COUNT) return stabilized;
  const meta = new Map(stabilized.nodes.map((n) => [n.id, n]));
  return {
    ...canonical,
    nodes: canonical.nodes.map((n) => {
      const m = meta.get(n.id);
      return n.group === 0 && m?.originClusterId
        ? { ...n, originClusterId: m.originClusterId, originKind: m.originKind }
        : n;
    }),
    mergeTargetByOldClusterId: stabilized.mergeTargetByOldClusterId,
  };
}

/**
 * Start positions for the new node set right after a K change: content nodes keep their previous
 * position, clusters start at their origin cluster (or the centroid of their strongest items).
 */
export function computeKChangeStartPositions(
  nextNodes: ReadonlyArray<GraphNodePayload>,
  connections: ReadonlyArray<GraphConnectionPayload>,
  prev: ReadonlyMap<string, TransitionPoint>,
  targetK: number,
  fallbackRadius = 140
): Map<string, TransitionPoint> {
  const sums = new Map<string, { x: number; y: number; z: number; count: number }>();
  for (const c of connections) {
    const pt = prev.get(c.sourceId);
    if (pt && (c.weight ?? 0) >= 0.4) {
      const cur = sums.get(c.targetId) || { x: 0, y: 0, z: 0, count: 0 };
      cur.x += pt.x;
      cur.y += pt.y;
      cur.z += pt.z ?? 0;
      cur.count += 1;
      sums.set(c.targetId, cur);
    }
  }
  const out = new Map<string, TransitionPoint>();
  nextNodes.forEach((n, idx) => {
    const existing =
      n.group === 0 && n.originClusterId
        ? (prev.get(n.originClusterId) ?? prev.get(n.id))
        : prev.get(n.id);
    if (existing) {
      out.set(n.id, { x: existing.x, y: existing.y, z: existing.z });
      return;
    }
    const cen = sums.get(n.id);
    if (cen && cen.count > 0) {
      out.set(n.id, { x: cen.x / cen.count, y: cen.y / cen.count, z: cen.z / cen.count });
      return;
    }
    const angle = (idx * 2 * Math.PI) / Math.max(1, targetK);
    out.set(n.id, { x: Math.cos(angle) * fallbackRadius, y: Math.sin(angle) * fallbackRadius, z: 0 });
  });
  return out;
}

export function computeBipartiteEdgeCohesionWeights(
  connections: ReadonlyArray<{ sourceId: string; targetId: string }>,
  totalContentItems?: number
): number[] {
  const itemTags = new Map<string, Set<string>>();
  const tagItems = new Map<string, Set<string>>();

  for (const conn of connections) {
    const u = conn.sourceId;
    const t = conn.targetId;
    let uSet = itemTags.get(u);
    if (!uSet) {
      uSet = new Set<string>();
      itemTags.set(u, uSet);
    }
    uSet.add(t);

    let tSet = tagItems.get(t);
    if (!tSet) {
      tSet = new Set<string>();
      tagItems.set(t, tSet);
    }
    tSet.add(u);
  }

  const nItems = Math.max(
    1,
    totalContentItems !== undefined && totalContentItems > 0 ? totalContentItems : itemTags.size
  );

  const tagIdf = new Map<string, number>();
  const tagUmbrella = new Map<string, number>();
  for (const [t, items] of tagItems.entries()) {
    const dt = items.size;
    tagIdf.set(t, Math.log(1 + nItems / Math.max(1, dt)));
    tagUmbrella.set(t, Math.pow(1 + Math.pow(dt / 22, 2), -0.45));
  }

  const rawCohesions = connections.map((conn) => {
    const u = conn.sourceId;
    const t = conn.targetId;
    const uTags = itemTags.get(u);
    const tItems = tagItems.get(t);
    const du = uTags?.size ?? 1;
    const dt = tItems?.size ?? 1;
    const umbrella = tagUmbrella.get(t) ?? 1;

    let cohesion: number;
    if (dt <= 1) {
      cohesion = 0.94;
    } else if (du <= 1 || !uTags || !tItems) {
      cohesion = clampNumber(0.88 * umbrella, 0.42, 0.92);
    } else {
      const otherUTags: { tag: string; idf: number }[] = [];
      let denom = 0;
      for (const s of uTags) {
        if (s === t) continue;
        const idfVal = tagIdf.get(s) ?? 1;
        otherUTags.push({ tag: s, idf: idfVal });
        denom += idfVal;
      }

      const peerSims: number[] = [];
      for (const v of tItems) {
        if (v === u) continue;
        const vTags = itemTags.get(v);
        if (!vTags || denom <= 0) {
          peerSims.push(0);
          continue;
        }
        let sharedIdf = 0;
        for (const entry of otherUTags) {
          if (vTags.has(entry.tag)) {
            sharedIdf += entry.idf;
          }
        }
        peerSims.push(sharedIdf / denom);
      }

      if (peerSims.length === 0) {
        cohesion = 0.94;
      } else {
        peerSims.sort((a, b) => b - a);
        let sumAll = 0;
        for (const val of peerSims) sumAll += val;
        const peerMean = sumAll / peerSims.length;

        const k = Math.min(6, peerSims.length);
        let sumTop = 0;
        for (let i = 0; i < k; i++) sumTop += peerSims[i];
        const topPeerMean = sumTop / k;

        const rawCohesion = (0.55 * peerMean + 0.45 * topPeerMean) * umbrella;
        cohesion = clampNumber(0.12 + 0.86 * Math.pow(Math.max(0, rawCohesion), 0.72), 0.12, 0.95);
      }
    }

    return Number(cohesion.toFixed(4));
  });

  const isBackbone = new Array<boolean>(connections.length).fill(false);
  const edgesByItem = new Map<string, number[]>();
  const edgesByTag = new Map<string, number[]>();

  connections.forEach((conn, idx) => {
    let uList = edgesByItem.get(conn.sourceId);
    if (!uList) {
      uList = [];
      edgesByItem.set(conn.sourceId, uList);
    }
    uList.push(idx);

    let tList = edgesByTag.get(conn.targetId);
    if (!tList) {
      tList = [];
      edgesByTag.set(conn.targetId, tList);
    }
    tList.push(idx);
  });

  // (a) For each Content item u, mark its #1 best edge as backbone, and #2 edge ONLY if c(e2) >= 0.72 * c(e1) and d_{t2} <= 26
  for (const [, edgeIndices] of edgesByItem.entries()) {
    edgeIndices.sort((i, j) => {
      const diff = rawCohesions[j] - rawCohesions[i];
      if (Math.abs(diff) > 1e-9) return diff;
      const dtI = tagItems.get(connections[i].targetId)?.size ?? 0;
      const dtJ = tagItems.get(connections[j].targetId)?.size ?? 0;
      if (dtI !== dtJ) return dtI - dtJ;
      return connections[i].targetId.localeCompare(connections[j].targetId);
    });
    if (edgeIndices.length >= 1) {
      const idx1 = edgeIndices[0];
      isBackbone[idx1] = true;
      if (edgeIndices.length >= 2) {
        const idx2 = edgeIndices[1];
        const c1 = rawCohesions[idx1];
        const c2 = rawCohesions[idx2];
        const dt2 = tagItems.get(connections[idx2].targetId)?.size ?? 0;
        if (c2 >= 0.72 * c1 && dt2 <= 26) {
          isBackbone[idx2] = true;
        }
      }
    }
  }

  // (b) For each Tag node t, mark its top Math.min(2, d_t) highest-cohesion edges as backbone so no tag is orphaned
  for (const [t, edgeIndices] of edgesByTag.entries()) {
    edgeIndices.sort((i, j) => {
      const diff = rawCohesions[j] - rawCohesions[i];
      if (Math.abs(diff) > 1e-9) return diff;
      return connections[i].sourceId.localeCompare(connections[j].sourceId);
    });
    const dt = tagItems.get(t)?.size ?? edgeIndices.length;
    const topK = Math.min(2, dt, edgeIndices.length);
    for (let k = 0; k < topK; k++) {
      isBackbone[edgeIndices[k]] = true;
    }
  }

  // (c) Deterministic Maximum-Weight Spanning Forest (Kruskal's algorithm with Union-Find)
  const parent = new Map<string, string>();
  const rank = new Map<string, number>();
  const find = (x: string): string => {
    let root = x;
    while (parent.has(root) && parent.get(root)! !== root) {
      root = parent.get(root)!;
    }
    let curr = x;
    while (curr !== root) {
      const nxt = parent.get(curr)!;
      parent.set(curr, root);
      curr = nxt;
    }
    if (!parent.has(x)) parent.set(x, x);
    return root;
  };
  const union = (a: string, b: string): boolean => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return false;
    const rka = rank.get(ra) ?? 0;
    const rkb = rank.get(rb) ?? 0;
    if (rka < rkb) {
      parent.set(ra, rb);
    } else if (rka > rkb) {
      parent.set(rb, ra);
    } else {
      parent.set(rb, ra);
      rank.set(ra, rka + 1);
    }
    return true;
  };

  const sortedAllEdgeIndices = connections.map((_, idx) => idx);
  sortedAllEdgeIndices.sort((i, j) => {
    const diff = rawCohesions[j] - rawCohesions[i];
    if (Math.abs(diff) > 1e-9) return diff;
    const dtI = tagItems.get(connections[i].targetId)?.size ?? 0;
    const dtJ = tagItems.get(connections[j].targetId)?.size ?? 0;
    if (dtI !== dtJ) return dtI - dtJ;
    const srcCmp = connections[i].sourceId.localeCompare(connections[j].sourceId);
    if (srcCmp !== 0) return srcCmp;
    return connections[i].targetId.localeCompare(connections[j].targetId);
  });

  for (const idx of sortedAllEdgeIndices) {
    const conn = connections[idx];
    if (union(conn.sourceId, conn.targetId)) {
      isBackbone[idx] = true;
    }
  }

  return rawCohesions.map((c, idx) => {
    if (isBackbone[idx]) {
      return Number(clampNumber(0.58 + 0.38 * c, 0.58, 0.96).toFixed(4));
    }
    return Number(clampNumber(0.08 + 0.14 * c, 0.08, 0.22).toFixed(4));
  });
}

export function initialCoords(index: number, _total?: number): { x: number; y: number } {
  const angle = index * 2.3999632297286533;
  const radius = 8 * Math.sqrt(index + 1);
  return {
    x: Number((Math.cos(angle) * radius).toFixed(4)),
    y: Number((Math.sin(angle) * radius).toFixed(4))
  };
}

export function hydrateEnginePayloads(
  canonical: CanonicalGraphPayload,
  layoutPositions?: GraphLayoutPositions
): EnginePayloads {
  const visNodes = canonical.nodes;
  const visConnections = canonical.connections;
  const totalNodes = visNodes.length;

  const resolveCoords = (id: string, idx: number): { x: number; y: number; z?: number } => {
    const pos = layoutPositions?.[id];
    if (pos) {
      return {
        x: pos[0],
        y: pos[1],
        ...(pos.length >= 3 ? { z: pos[2] } : {})
      };
    }
    return initialCoords(idx, totalNodes);
  };

  // 1. Vis.js Network payload
  const visNetworkPayload = {
    nodes: visNodes.map((n, idx) => {
      const coords = resolveCoords(n.id, idx);
      return {
        ...n,
        x: coords.x,
        y: coords.y
      };
    }),
    connections: visConnections.map(c => ({ ...c }))
  };

  // 2. Cytoscape elements
  const cytoscapeElements: CytoscapeElement[] = [];
  visNodes.forEach((node, idx) => {
    const coords = resolveCoords(node.id, idx);
    cytoscapeElements.push({
      data: {
        id: node.id,
        name: node.name,
        group: node.group,
        color: getNodeBaseColor(node, false),
        colorDark: node.colorDark,
        colorLight: node.colorLight,
        size: 16 * getNodeRestRadiusScale(node.group, node.size),
        rawSize: node.size,
        typeLabel: node.typeLabel,
        description: node.description,
        date: node.date,
        image: node.image,
        tags: node.tags ? [...node.tags] : undefined
      },
      position: {
        x: coords.x,
        y: coords.y
      }
    });
  });
  visConnections.forEach(conn => {
    cytoscapeElements.push({
      data: {
        id: `${conn.sourceId}--${conn.targetId}`,
        source: conn.sourceId,
        target: conn.targetId,
        weight: conn.weight,
        coverage: conn.coverage
      }
    });
  });

  // 3. D3 / 3D-force nodes & connections
  const d3Nodes: GraphNodePayload[] = visNodes.map((n, idx) => {
    const coords = resolveCoords(n.id, idx);
    return {
      id: n.id,
      name: n.name,
      size: n.size,
      group: n.group,
      colorDark: n.colorDark,
      colorLight: n.colorLight,
      connectionCount: n.connectionCount,
      x: coords.x,
      y: coords.y,
      typeLabel: n.typeLabel,
      description: n.description,
      date: n.date,
      image: n.image,
      tags: n.tags ? [...n.tags] : undefined
    };
  });
  const d3Connections: GraphConnectionPayload[] = visConnections.map(c => ({
    sourceId: c.sourceId,
    targetId: c.targetId,
    weight: c.weight,
    coverage: c.coverage
  }));

  // 3b. 3D Force Graph nodes (includes z if provided in layoutPositions)
  const force3dNodes: GraphNodePayload[] = visNodes.map((n, idx) => {
    const coords = resolveCoords(n.id, idx);
    return {
      id: n.id,
      name: n.name,
      size: n.size,
      group: n.group,
      colorDark: n.colorDark,
      colorLight: n.colorLight,
      connectionCount: n.connectionCount,
      x: coords.x,
      y: coords.y,
      ...(coords.z !== undefined ? { z: coords.z } : {}),
      typeLabel: n.typeLabel,
      description: n.description,
      date: n.date,
      image: n.image,
      tags: n.tags ? [...n.tags] : undefined
    };
  });

  // 4. Sigma nodes & edges (pre-computed or deterministic Golden-Angle spiral)
  const defaultStyleTokens = getGraphStyleTokens(false);
  const sigmaNodes: SigmaNode[] = visNodes.map((n, idx) => {
    const coords = resolveCoords(n.id, idx);
    return {
      id: n.id,
      label: n.name,
      x: coords.x,
      y: coords.y,
      size: defaultStyleTokens.nodeRadius * getNodeRestRadiusScale(n.group, n.size),
      rawSize: n.size,
      group: n.group,
      color: getNodeBaseColor(n, false),
      colorDark: n.colorDark,
      colorLight: n.colorLight,
      typeLabel: n.typeLabel,
      description: n.description,
      date: n.date,
      image: n.image,
      tags: n.tags ? [...n.tags] : undefined
    };
  });
  const sigmaEdges: SigmaEdge[] = visConnections.map(conn => {
    const rest = getRestEdgeStyle(conn.weight, false);
    return {
      id: `${conn.sourceId}--${conn.targetId}`,
      source: conn.sourceId,
      target: conn.targetId,
      size: rest.width,
      color: rest.color,
      weight: conn.weight,
      coverage: conn.coverage
    };
  });

  return {
    canonical,
    nodes: visNodes,
    connections: visConnections,
    'vis-network': visNetworkPayload,
    cytoscape: { elements: cytoscapeElements },
    d3: { nodes: d3Nodes, connections: d3Connections },
    sigma: { nodes: sigmaNodes, edges: sigmaEdges },
    '3d-force': { nodes: force3dNodes.map(n => ({ ...n })), connections: d3Connections.map(c => ({ ...c })) },
    '3d-force-graph': { nodes: force3dNodes.map(n => ({ ...n })), connections: d3Connections.map(c => ({ ...c })) }
  };
}

export async function buildGraphPayload(
  options: BuildGraphPayloadOptions
): Promise<EnginePayloads> {
  const canonical = await buildCanonicalGraphPayload(options);
  return hydrateEnginePayloads(canonical);
}
