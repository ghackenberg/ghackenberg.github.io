import type { getImage } from "astro:assets";

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
  group: number;
  color: string;
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
    nodes: Array<{ id: string; name: string; size: number; group: number }>;
    connections: GraphConnectionPayload[];
  };
  sigma: {
    nodes: SigmaNode[];
    edges: SigmaEdge[];
  };
  '3d-force': {
    nodes: Array<{ id: string; name: string; size: number; group: number }>;
    connections: GraphConnectionPayload[];
  };
}

export const GRAPH_GROUP_NAMES = [
  'Tag',
  'Post',
  'Publication',
  'Project',
  'Course',
  'Service'
] as const;

export const GRAPH_COLORS = {
  dark: [
    '#0ea5e9', // 0: Tag (Sky)
    '#3b82f6', // 1: Post (Blue)
    '#6366f1', // 2: Publication (Indigo)
    '#10b981', // 3: Project (Green)
    '#f59e0b', // 4: Course (Yellow)
    '#a855f7'  // 5: Service (Purple)
  ],
  light: [
    '#0284c7', // 0: Tag (Sky)
    '#2563eb', // 1: Post (Blue)
    '#4f46e5', // 2: Publication (Indigo)
    '#059669', // 3: Project (Green)
    '#d97706', // 4: Course (Yellow)
    '#9333ea'  // 5: Service (Purple)
  ]
};

export interface TagCounts {
  posts: Record<string, number>;
  publications: Record<string, number>;
  projects: Record<string, number>;
  courses: Record<string, number>;
  services: Record<string, number>;
  allTags: string[];
}

interface RawEntity {
  id: string;
  data: {
    title: string;
    description?: string;
    pubDate?: string | Date;
    tags?: string[];
    icon?: Parameters<typeof getImage>[0]["src"];
    screenshot?: Parameters<typeof getImage>[0]["src"];
    screenshotLight?: Parameters<typeof getImage>[0]["src"];
    previewImage?: Parameters<typeof getImage>[0]["src"];
    abstract?: string;
    book?: string;
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
  projects: RawEntity[];
  courses: RawEntity[];
  services: RawEntity[];
}): TagCounts {
  const tagPosts: Record<string, number> = {};
  options.posts.forEach(p => {
    if (p.data.tags) {
      p.data.tags.forEach(t => {
        tagPosts[t] = (tagPosts[t] || 0) + 1;
      });
    }
  });

  const tagPubs: Record<string, number> = {};
  options.publications.forEach(p => {
    if (p.data.tags) {
      p.data.tags.forEach(t => {
        tagPubs[t] = (tagPubs[t] || 0) + 1;
      });
    }
  });

  const tagProjects: Record<string, number> = {};
  options.projects.forEach(p => {
    if (p.data.tags) {
      p.data.tags.forEach(t => {
        tagProjects[t] = (tagProjects[t] || 0) + 1;
      });
    }
  });

  const tagCourses: Record<string, number> = {};
  options.courses.forEach(c => {
    if (c.data.tags) {
      c.data.tags.forEach(t => {
        tagCourses[t] = (tagCourses[t] || 0) + 1;
      });
    }
  });

  const tagServices: Record<string, number> = {};
  options.services.forEach(s => {
    if (s.data.tags) {
      s.data.tags.forEach(t => {
        tagServices[t] = (tagServices[t] || 0) + 1;
      });
    }
  });

  const allTags = Array.from(new Set([
    ...Object.keys(tagPosts),
    ...Object.keys(tagPubs),
    ...Object.keys(tagProjects),
    ...Object.keys(tagCourses),
    ...Object.keys(tagServices)
  ]));

  return {
    posts: tagPosts,
    publications: tagPubs,
    projects: tagProjects,
    courses: tagCourses,
    services: tagServices,
    allTags
  };
}

export async function buildGraphPayload(options: {
  posts: RawEntity[];
  publications: RawEntity[];
  projects: RawEntity[];
  courses: RawEntity[];
  services: RawEntity[];
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
      (tagCounts.projects[tag] || 0) +
      (tagCounts.courses[tag] || 0) +
      (tagCounts.services[tag] || 0);

    const tagEntry = tagMap.get(tag);
    const title = tagEntry?.data.title ?? tag;
    visNodes.push({
      id: `/tags/${encodeURIComponent(tag)}/`,
      name: `#${title}`,
      size: Math.log(count) + 1,
      group: 0,
      typeLabel: "Tag",
      description: tagEntry?.data.description || `${count} connected item${count > 1 ? 's' : ''}.`
    });
  });

  // Group 1: Posts
  for (const post of options.posts) {
    const path = `/posts/${post.id}/`;
    let imageSrc: string | undefined = undefined;
    if (post.data.icon && options.getImage) {
      try {
        const opt = await options.getImage({ src: post.data.icon, format: "webp", width: 240, quality: 75 });
        imageSrc = opt.src;
      } catch (e) {
        console.warn("Failed to optimize post icon", e);
      }
    }
    visNodes.push({
      id: path,
      name: post.data.title,
      size: 1.2,
      group: 1,
      typeLabel: "Post",
      description: post.data.description,
      date: post.data.pubDate ? new Date(post.data.pubDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : undefined,
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
      date: typeof pub.data.pubDate === 'string' ? pub.data.pubDate : (pub.data.pubDate ? new Date(pub.data.pubDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : undefined),
      tags: pub.data.tags ? pub.data.tags.slice(0, 3) : []
    });
    if (pub.data.tags) {
      pub.data.tags.forEach(tag => {
        visConnections.push({ sourceId: path, targetId: `/tags/${encodeURIComponent(tag)}/` });
      });
    }
  }

  // Group 3: Projects
  for (const project of options.projects) {
    const path = `/projects/${project.id}/`;
    let imageSrc: string | undefined = undefined;
    const projectImg = project.data.screenshot || project.data.screenshotLight;
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
      size: 1.1,
      group: 3,
      typeLabel: "Project",
      description: project.data.description,
      date: project.data.pubDate ? new Date(project.data.pubDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : undefined,
      image: imageSrc,
      tags: project.data.tags ? project.data.tags.slice(0, 3) : []
    });
    if (project.data.tags) {
      project.data.tags.forEach(tag => {
        visConnections.push({ sourceId: path, targetId: `/tags/${encodeURIComponent(tag)}/` });
      });
    }
  }

  // Group 4: Courses
  for (const course of options.courses) {
    const path = `/courses/${course.id}/`;
    let imageSrc: string | undefined = undefined;
    if (course.data.screenshot && options.getImage) {
      try {
        const opt = await options.getImage({ src: course.data.screenshot, format: "webp", width: 240, quality: 75 });
        imageSrc = opt.src;
      } catch (e) {
        console.warn("Failed to optimize course screenshot", e);
      }
    }
    visNodes.push({
      id: path,
      name: course.data.title,
      size: 1.1,
      group: 4,
      typeLabel: "Course",
      description: course.data.description,
      date: course.data.pubDate ? new Date(course.data.pubDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : undefined,
      image: imageSrc,
      tags: course.data.tags ? course.data.tags.slice(0, 3) : []
    });
    if (course.data.tags) {
      course.data.tags.forEach(tag => {
        visConnections.push({ sourceId: path, targetId: `/tags/${encodeURIComponent(tag)}/` });
      });
    }
  }

  // Group 5: Services
  for (const service of options.services) {
    const path = `/services/${service.id}/`;
    let imageSrc: string | undefined = undefined;
    if (service.data.previewImage && options.getImage) {
      try {
        const opt = await options.getImage({ src: service.data.previewImage, format: "webp", width: 240, quality: 75 });
        imageSrc = opt.src;
      } catch (e) {
        console.warn("Failed to optimize service preview", e);
      }
    }
    visNodes.push({
      id: path,
      name: service.data.title,
      size: 1.15,
      group: 5,
      typeLabel: "Service",
      description: service.data.description,
      date: service.data.pubDate ? new Date(service.data.pubDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : undefined,
      image: imageSrc,
      tags: service.data.tags ? service.data.tags.slice(0, 3) : []
    });
    if (service.data.tags) {
      service.data.tags.forEach(tag => {
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
        size: node.group === 0 ? (node.size * 12 + 10) : (node.size * 10 + 6)
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
  const d3Nodes = visNodes.map(n => ({
    id: n.id,
    name: n.name,
    size: n.size,
    group: n.group
  }));

  // 4. Sigma nodes & edges
  const sigmaNodes: SigmaNode[] = visNodes.map(n => ({
    id: n.id,
    label: n.name,
    x: (Math.random() - 0.5) * 100,
    y: (Math.random() - 0.5) * 100,
    size: n.group === 0 ? Math.max(n.size * 2, 3) : 2,
    group: n.group,
    color: GRAPH_COLORS.dark[n.group] || GRAPH_COLORS.dark[0]
  }));
  const sigmaEdges: SigmaEdge[] = visConnections.map(conn => ({
    id: `${conn.sourceId}--${conn.targetId}`,
    source: conn.sourceId,
    target: conn.targetId,
    size: 1,
    color: "rgba(255,255,255,0.07)"
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
