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
  connectionCount?: number;
  x?: number;
  y?: number;
  z?: number;
  typeLabel?: string;
  description?: string;
  date?: string;
  image?: string;
  tags?: string[];
}

export interface GraphConnectionPayload {
  sourceId: string;
  targetId: string;
  source?: string;
  target?: string;
  weight?: number;
}

export interface CanonicalGraphPayload {
  nodes: GraphNodePayload[];
  connections: GraphConnectionPayload[];
}

export interface CytoscapeElement {
  data: {
    id: string;
    name?: string;
    group?: number;
    color?: string;
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
  typeLabel?: string;
  description?: string;
  date?: string;
  image?: string;
  tags?: string[];
}

export interface SigmaEdge {
  id: string;
  source: string;
  target: string;
  size?: number;
  color?: string;
  weight?: number;
}

export interface EnginePayloads {
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

export interface GraphTuningState {
  // 1. Edge Specificity Weighting
  stiffnessExponent: number;   // default: 1.65 (range 0.0 .. 2.6, step 0.05)
  distanceExponent: number;    // default: 1.15 (range 0.0 .. 2.0, step 0.05)
  // 2. Layout Physics & Geometry
  baseLinkDistance2D: number;  // default: 26   (range 10 .. 64, step 2)
  repulsionScale: number;      // default: 1.0  (range 0.25 .. 2.5, step 0.05)
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
  stiffnessExponent: 1.65,
  distanceExponent: 1.15,
  baseLinkDistance2D: 26,
  repulsionScale: 1.0,
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
  minWeightFloor: 0.10,
  stiffnessExponent: 1.65,
  distanceExponent: 1.15,
  baseLinkDistance2D: 26,
  baseLinkDistance3D: 12,
  collisionPadding2D: 4,
  d3LinkStrengthBase: 0.68,
  d3ChargeStrength: -165,
  d3ChargeDistanceMax: 420,
  d3CenterGravityStrength: 0.018,
  coseIdealEdgeBase: 24,
  coseEdgeElasticityBase: 24,
  coseNodeRepulsion: 400000,
  coseGravity: 80,
  coseIterations: 1000,
  sigmaIterations: 500,
  sigmaGravity: 0.22,
  sigmaScalingRatio: 1.5,
  sigmaSlowDown: 2,
  visIterations: 550,
  visRepulsionStrength: -95,
  visCentralGravity: 0.02,
  visSpringConstantBase: 0.24,
  visDamping: 0.42,
  force3DIterations: 600,
  force3DLinkStrengthBase: 0.75,
  force3DChargeStrength: -180,
  force3DCenterGravityStrength: 0.02,
} as const;

export function getEdgePhysicsMetrics(weight = 0.5): {
  clampedWeight: number;
  stiffnessFactor: number;
  distanceFactor: number;
} {
  const tuning = currentGraphTuningState;
  const clampedWeight = Math.max(
    GRAPH_PHYSICS_CONFIG.minWeightFloor,
    Math.min(1, Number.isFinite(weight) ? weight : 0.5)
  );
  // Specific tags (df=1..4 => w=0.5..1.0) get strong stiffness (0.32..1.0) and short distance (1.0..2.2x)
  // Hub tags (df=36..96 => w=0.10..0.16) get very weak stiffness (0.02..0.05) and long distance (7..14x)
  const stiffnessFactor = Math.pow(clampedWeight, tuning.stiffnessExponent);
  const distanceFactor = 1 / Math.pow(Math.max(0.14, clampedWeight), tuning.distanceExponent);
  return { clampedWeight, stiffnessFactor, distanceFactor };
}

export function getCoseEdgeIdealLength(weight = 0.5): number {
  const tuning = currentGraphTuningState;
  const m = getEdgePhysicsMetrics(weight);
  const baseScale = tuning.baseLinkDistance2D / GRAPH_PHYSICS_CONFIG.baseLinkDistance2D;
  const effectiveWeight = Math.max(
    0.35,
    Math.pow(m.clampedWeight, tuning.distanceExponent / GRAPH_PHYSICS_CONFIG.distanceExponent)
  );
  return Math.max(12, Math.round((GRAPH_PHYSICS_CONFIG.coseIdealEdgeBase * baseScale) / effectiveWeight));
}

export function getCoseEdgeElasticity(weight = 0.5): number {
  const m = getEdgePhysicsMetrics(weight);
  return Math.max(
    4,
    Math.round(GRAPH_PHYSICS_CONFIG.coseEdgeElasticityBase / Math.max(0.015, m.stiffnessFactor))
  );
}

export function getEdgeLinkDistance2D(weight?: number): number {
  return Math.round(
    currentGraphTuningState.baseLinkDistance2D * getEdgePhysicsMetrics(weight).distanceFactor
  );
}

export function getEdgeLinkStrength2D(weight?: number): number {
  return Number(
    (GRAPH_PHYSICS_CONFIG.d3LinkStrengthBase * getEdgePhysicsMetrics(weight).stiffnessFactor).toFixed(4)
  );
}

export function getEdgeLinkDistance3D(weight?: number): number {
  const scaledBase3D =
    GRAPH_PHYSICS_CONFIG.baseLinkDistance3D *
    (currentGraphTuningState.baseLinkDistance2D / GRAPH_PHYSICS_CONFIG.baseLinkDistance2D);
  return Math.round(scaledBase3D * getEdgePhysicsMetrics(weight).distanceFactor);
}

export function getEdgeLinkStrength3D(weight?: number): number {
  return Number(
    (GRAPH_PHYSICS_CONFIG.force3DLinkStrengthBase * getEdgePhysicsMetrics(weight).stiffnessFactor).toFixed(4)
  );
}

export function getSigmaForceAtlas2Settings(slowDownOverride?: number) {
  const tuning = currentGraphTuningState;
  return {
    linLogMode: true,
    outboundAttractionDistribution: false,
    adjustSizes: false,
    edgeWeightInfluence: 1,
    scalingRatio: Number((GRAPH_PHYSICS_CONFIG.sigmaScalingRatio * tuning.repulsionScale).toFixed(3)),
    strongGravityMode: false,
    gravity: Number((GRAPH_PHYSICS_CONFIG.sigmaGravity * tuning.gravityScale).toFixed(4)),
    slowDown: slowDownOverride ?? GRAPH_PHYSICS_CONFIG.sigmaSlowDown,
  };
}

export const GRAPH_GEOMETRY_LAYOUT_CONFIG = {
  radialInnerRatio: 0.22,
  radialOuterRatio: 0.44,
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

export function getAttenuatedNodeScale(hopDistance: number | undefined): number {
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
  isLight: boolean
): string {
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
  const canvasBg = getThemeTokens(isLight).canvasBg;
  return blendHexColor(baseColor, canvasBg, retention);
}

export function getAttenuatedEdgeStyle(
  sourceDistance: number | undefined,
  targetDistance: number | undefined,
  isLight: boolean
): { color: string; width: number } {
  const styleTokens = getGraphStyleTokens(isLight);
  const dSrc = sourceDistance ?? Infinity;
  const dTgt = targetDistance ?? Infinity;
  const canvasBg = getThemeTokens(isLight).canvasBg;
  const bgEdgeRet = Math.max(0.10, currentGraphTuningState.backgroundRetention * 0.76);

  if (dSrc === 0 || dTgt === 0) {
    return {
      color: styleTokens.edgeHoverColor,
      width: Number((styleTokens.edgeWidth * 1.733).toFixed(2))
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

  return {
    color: blendHexColor(styleTokens.edgeColor, canvasBg, bgEdgeRet),
    width: Number((styleTokens.edgeWidth * 0.567).toFixed(2))
  };
}

export function getNodeHopZIndex(hopDistance: number | undefined): number {
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

export async function buildCanonicalGraphPayload(
  options: BuildGraphPayloadOptions
): Promise<CanonicalGraphPayload> {
  const tagCounts = calculateTagCounts(options);
  const tagMap = new Map(options.tags.map(t => [t.id, t]));

  const visNodes: GraphNodePayload[] = [];
  const visConnections: GraphConnectionPayload[] = [];

  // Group 0: Tags
  tagCounts.allTags.forEach(tag => {
    const count = (tagCounts.posts[tag] || 0) +
      (tagCounts.publications[tag] || 0) +
      (tagCounts.presentations[tag] || 0) +
      (tagCounts.courses[tag] || 0) +
      (tagCounts.projects[tag] || 0) +
      (tagCounts.services[tag] || 0) +
      (tagCounts.visualizations[tag] || 0) +
      (tagCounts.newsletters[tag] || 0);

    const tagEntry = tagMap.get(tag);
    const title = tagEntry?.data.title ?? tag;
    visNodes.push({
      id: `/tags/${encodeURIComponent(tag)}/`,
      name: `#${title}`,
      size: 1,
      group: 0,
      typeLabel: "Tag",
      description: tagEntry?.data.description || `${count} connected item${count > 1 ? 's' : ''}.`
    });
  });

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
    visNodes.push({
      id: path,
      name: post.data.title,
      size: 1,
      group: 1,
      typeLabel: "Post",
      description: post.data.description,
      date: post.data.pubDate ? formatDate(post.data.pubDate, 'short') : undefined,
      image: imageSrc,
      tags: post.data.tags ? post.data.tags.slice(0, 3) : []
    });
    if (post.data.tags) {
      post.data.tags.forEach(tag => {
        visConnections.push({ sourceId: path, targetId: `/tags/${encodeURIComponent(tag)}/` });
      });
    }
  }

  // Group 2: Publications
  for (const pub of options.publications) {
    const path = `/publications/${pub.id}/`;
    visNodes.push({
      id: path,
      name: pub.data.title,
      size: 1,
      group: 2,
      typeLabel: "Publication",
      description: pub.data.abstract || pub.data.book,
      date: pub.data.pubDate ? formatDate(pub.data.pubDate, 'short') : undefined,
      tags: pub.data.tags ? pub.data.tags.slice(0, 3) : []
    });
    if (pub.data.tags) {
      pub.data.tags.forEach(tag => {
        visConnections.push({ sourceId: path, targetId: `/tags/${encodeURIComponent(tag)}/` });
      });
    }
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
    visNodes.push({
      id: path,
      name: pres.data.title,
      size: 1,
      group: 3,
      typeLabel: "Presentation",
      description: pres.data.subtitle || pres.data.description,
      date: pres.data.pubDate ? formatDate(pres.data.pubDate, 'short') : undefined,
      image: imageSrc,
      tags: pres.data.tags ? pres.data.tags.slice(0, 3) : []
    });
    if (pres.data.tags) {
      pres.data.tags.forEach(tag => {
        visConnections.push({ sourceId: path, targetId: `/tags/${encodeURIComponent(tag)}/` });
      });
    }
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
    visNodes.push({
      id: path,
      name: course.data.title,
      size: 1,
      group: 4,
      typeLabel: "Course",
      description: course.data.description,
      date: course.data.pubDate ? formatDate(course.data.pubDate, 'short') : undefined,
      image: imageSrc,
      tags: course.data.tags ? course.data.tags.slice(0, 3) : []
    });
    if (course.data.tags) {
      course.data.tags.forEach(tag => {
        visConnections.push({ sourceId: path, targetId: `/tags/${encodeURIComponent(tag)}/` });
      });
    }
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
    visNodes.push({
      id: path,
      name: project.data.title,
      size: 1,
      group: 5,
      typeLabel: "Project",
      description: project.data.description,
      date: project.data.pubDate ? formatDate(project.data.pubDate, 'short') : undefined,
      image: imageSrc,
      tags: project.data.tags ? project.data.tags.slice(0, 3) : []
    });
    if (project.data.tags) {
      project.data.tags.forEach(tag => {
        visConnections.push({ sourceId: path, targetId: `/tags/${encodeURIComponent(tag)}/` });
      });
    }
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
    visNodes.push({
      id: path,
      name: service.data.title,
      size: 1,
      group: 6,
      typeLabel: "Service",
      description: service.data.description,
      date: service.data.pubDate ? formatDate(service.data.pubDate, 'short') : undefined,
      image: imageSrc,
      tags: service.data.tags ? service.data.tags.slice(0, 3) : []
    });
    if (service.data.tags) {
      service.data.tags.forEach(tag => {
        visConnections.push({ sourceId: path, targetId: `/tags/${encodeURIComponent(tag)}/` });
      });
    }
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
    visNodes.push({
      id: path,
      name: nl.data.title,
      size: 1,
      group: 7,
      typeLabel: "Newsletter",
      description: nl.data.description,
      date: nl.data.pubDate ? formatDate(nl.data.pubDate, "short") : undefined,
      image: imageSrc,
      tags: nl.data.tags ? nl.data.tags.slice(0, 3) : []
    });
    if (nl.data.tags) {
      nl.data.tags.forEach(tag => {
        visConnections.push({ sourceId: path, targetId: `/tags/${encodeURIComponent(tag)}/` });
      });
    }
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
    visNodes.push({
      id: path,
      name: vis.data.title,
      size: 1,
      group: 8,
      typeLabel: "Visualization",
      description: vis.data.description,
      image: imageSrc,
      tags: vis.data.tags ? vis.data.tags.slice(0, 3) : []
    });
    if (vis.data.tags) {
      vis.data.tags.forEach(tag => {
        visConnections.push({ sourceId: path, targetId: `/tags/${encodeURIComponent(tag)}/` });
      });
    }
  }

  const degreeCounts = new Map<string, number>();
  for (const conn of visConnections) {
    degreeCounts.set(conn.sourceId, (degreeCounts.get(conn.sourceId) || 0) + 1);
    degreeCounts.set(conn.targetId, (degreeCounts.get(conn.targetId) || 0) + 1);
  }
  for (const conn of visConnections) {
    const df = degreeCounts.get(conn.targetId) || 1;
    conn.weight = Number((1 / Math.sqrt(Math.max(1, df))).toFixed(4));
  }
  for (const node of visNodes) {
    node.connectionCount = degreeCounts.get(node.id) || 0;
  }

  return {
    nodes: visNodes,
    connections: visConnections
  };
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
        color: GRAPH_COLORS.dark[node.group] || GRAPH_COLORS.dark[0],
        size: 16,
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
        weight: conn.weight
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
    weight: c.weight
  }));

  // 3b. 3D Force Graph nodes (includes z if provided in layoutPositions)
  const force3dNodes: GraphNodePayload[] = visNodes.map((n, idx) => {
    const coords = resolveCoords(n.id, idx);
    return {
      id: n.id,
      name: n.name,
      size: n.size,
      group: n.group,
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
      size: defaultStyleTokens.nodeRadius,
      rawSize: n.size,
      group: n.group,
      color: GRAPH_COLORS.dark[n.group] || GRAPH_COLORS.dark[0],
      typeLabel: n.typeLabel,
      description: n.description,
      date: n.date,
      image: n.image,
      tags: n.tags ? [...n.tags] : undefined
    };
  });
  const sigmaEdges: SigmaEdge[] = visConnections.map(conn => ({
    id: `${conn.sourceId}--${conn.targetId}`,
    source: conn.sourceId,
    target: conn.targetId,
    size: defaultStyleTokens.edgeWidth,
    color: defaultStyleTokens.edgeColor,
    weight: conn.weight
  }));

  return {
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
