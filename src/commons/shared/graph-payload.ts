import type { getImage } from "astro:assets";
import { DOMAIN_METADATA, getThemeTokens } from "./domain-themes";
import { formatDate } from "./format";

export interface GraphNodePayload {
  id: string;
  name: string;
  size: number;
  group: number;
  typeLabel?: string;
  description?: string;
  date?: string;
  image?: string;
  tags?: string[];
}

export interface GraphConnectionPayload {
  sourceId: string;
  targetId: string;
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

export function getGraphStyleTokens(isLight: boolean): GraphStyleTokens {
  const themeTokens = getThemeTokens(isLight);
  return {
    edgeColor: themeTokens.edgeBase,
    edgeHoverColor: themeTokens.edgeHover,
    edgeWidth: 1.5,
    edgeHoverWidth: 2.5,
    nodeRadius: 8,
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
  nodeColor: { max: 1.0, min: 0.20, exponent: 1.35 },
  nodeScale: { max: 2.10, min: 0.40, exponent: 1.25 },
  edgeColor: { max: 1.0, min: 0.18, exponent: 1.20 },
  edgeWidth: { max: 3.0, min: 0.80, exponent: 1.10 }
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
  adjacency: Map<string, Set<string>>,
  maxHops: number = HOP_ATTENUATION_CONFIG.maxHops
): Map<string, number> {
  const distances = new Map<string, number>();
  distances.set(startNodeId, 0);
  const queue: [string, number][] = [[startNodeId, 0]];
  let head = 0;

  while (head < queue.length) {
    const [current, dist] = queue[head++];
    if (dist >= maxHops) continue;
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      if (!distances.has(neighbor)) {
        const nextDist = dist + 1;
        distances.set(neighbor, nextDist);
        if (nextDist < maxHops) {
          queue.push([neighbor, nextDist]);
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
  return computeHopCurve(hopDistance, HOP_ATTENUATION_CONFIG.nodeScale);
}

export function getAttenuatedNodeColor(
  baseColor: string,
  hopDistance: number | undefined,
  isLight: boolean
): string {
  const retention = computeHopCurve(hopDistance, HOP_ATTENUATION_CONFIG.nodeColor);
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

  if (dSrc === 0 || dTgt === 0) {
    return {
      color: styleTokens.edgeHoverColor,
      width: HOP_ATTENUATION_CONFIG.edgeWidth.max
    };
  }

  const canvasBg = getThemeTokens(isLight).canvasBg;
  const maxDist = Math.max(dSrc, dTgt);
  const edgeHop = Number.isFinite(maxDist) ? Math.max(0, maxDist - 1) : Infinity;
  const edgeMaxHops = Math.max(1, HOP_ATTENUATION_CONFIG.maxHops - 1);
  const retention = computeHopCurve(edgeHop, {
    ...HOP_ATTENUATION_CONFIG.edgeColor,
    maxHops: edgeMaxHops
  });
  const width = computeHopCurve(edgeHop, {
    ...HOP_ATTENUATION_CONFIG.edgeWidth,
    maxHops: edgeMaxHops
  });

  return {
    color: blendHexColor(styleTokens.edgeColor, canvasBg, retention),
    width
  };
}

export function getNodeHopZIndex(hopDistance: number | undefined): number {
  const d = hopDistance ?? Infinity;
  if (d <= 0) return 40;
  if (d === 1) return 30;
  if (d === 2) return 20;
  if (d === 3) return 10;
  return 1;
}

export function getEdgeHopZIndex(
  sourceDistance: number | undefined,
  targetDistance: number | undefined
): number {
  const dSrc = sourceDistance ?? Infinity;
  const dTgt = targetDistance ?? Infinity;
  if (dSrc === 0 || dTgt === 0) return 30;
  const maxDist = Math.max(dSrc, dTgt);
  if (maxDist <= 2) return 20;
  if (maxDist === 3) return 10;
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

export async function buildGraphPayload(options: {
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
}): Promise<EnginePayloads> {
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

  // 1. Vis.js Network payload
  const visNetworkPayload = {
    nodes: visNodes,
    connections: visConnections
  };

  // 2. Cytoscape elements
  const cytoscapeElements: CytoscapeElement[] = [];
  visNodes.forEach(node => {
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
        tags: node.tags
      }
    });
  });
  visConnections.forEach(conn => {
    cytoscapeElements.push({
      data: {
        id: `${conn.sourceId}--${conn.targetId}`,
        source: conn.sourceId,
        target: conn.targetId
      }
    });
  });

  // 3. D3 / 3D-force nodes & connections
  const d3Nodes: GraphNodePayload[] = visNodes.map(n => ({
    id: n.id,
    name: n.name,
    size: n.size,
    group: n.group,
    typeLabel: n.typeLabel,
    description: n.description,
    date: n.date,
    image: n.image,
    tags: n.tags
  }));

  // 4. Sigma nodes & edges
  const defaultStyleTokens = getGraphStyleTokens(false);
  const sigmaNodes: SigmaNode[] = visNodes.map(n => ({
    id: n.id,
    label: n.name,
    x: (Math.random() - 0.5) * 100,
    y: (Math.random() - 0.5) * 100,
    size: 5,
    rawSize: n.size,
    group: n.group,
    color: GRAPH_COLORS.dark[n.group] || GRAPH_COLORS.dark[0],
    typeLabel: n.typeLabel,
    description: n.description,
    date: n.date,
    image: n.image,
    tags: n.tags
  }));
  const sigmaEdges: SigmaEdge[] = visConnections.map(conn => ({
    id: `${conn.sourceId}--${conn.targetId}`,
    source: conn.sourceId,
    target: conn.targetId,
    size: defaultStyleTokens.edgeWidth,
    color: defaultStyleTokens.edgeColor
  }));

  return {
    nodes: visNodes,
    connections: visConnections,
    'vis-network': visNetworkPayload,
    cytoscape: { elements: cytoscapeElements },
    d3: { nodes: d3Nodes, connections: visConnections },
    sigma: { nodes: sigmaNodes, edges: sigmaEdges },
    '3d-force': { nodes: d3Nodes, connections: visConnections }
  };
}
