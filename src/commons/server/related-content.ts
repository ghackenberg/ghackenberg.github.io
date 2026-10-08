import { getCollection, type CollectionEntry } from "astro:content";

export type ContentCollectionName =
  | "posts"
  | "publications"
  | "presentations"
  | "courses"
  | "projects"
  | "services"
  | "visualizations"
  | "interests";

export interface ScoredItem<T> {
  item: T;
  overlapCount: number;
}

export type UnifiedRelatedItem =
  | { collection: "interests"; item: CollectionEntry<"interests">; overlapCount: number }
  | { collection: "posts"; item: CollectionEntry<"posts">; overlapCount: number }
  | { collection: "publications"; item: CollectionEntry<"publications">; overlapCount: number }
  | { collection: "presentations"; item: CollectionEntry<"presentations">; overlapCount: number }
  | { collection: "courses"; item: CollectionEntry<"courses">; overlapCount: number }
  | { collection: "projects"; item: CollectionEntry<"projects">; overlapCount: number }
  | { collection: "services"; item: CollectionEntry<"services">; overlapCount: number }
  | { collection: "visualizations"; item: CollectionEntry<"visualizations">; overlapCount: number };

export interface RelatedContentResults {
  ranked: UnifiedRelatedItem[];
  interests: CollectionEntry<"interests">[];
  posts: CollectionEntry<"posts">[];
  publications: CollectionEntry<"publications">[];
  presentations: CollectionEntry<"presentations">[];
  courses: CollectionEntry<"courses">[];
  projects: CollectionEntry<"projects">[];
  services: CollectionEntry<"services">[];
  visualizations: CollectionEntry<"visualizations">[];
}

export interface GetRelatedContentOptions {
  currentCollection: ContentCollectionName;
  currentId: string;
  tags?: string[];
  allInterests?: CollectionEntry<"interests">[];
  allPosts?: CollectionEntry<"posts">[];
  allPublications?: CollectionEntry<"publications">[];
  allPresentations?: CollectionEntry<"presentations">[];
  allCourses?: CollectionEntry<"courses">[];
  allProjects?: CollectionEntry<"projects">[];
  allServices?: CollectionEntry<"services">[];
  allVisualizations?: CollectionEntry<"visualizations">[];
  limits?: {
    total?: number;
    interests?: number;
    posts?: number;
    publications?: number;
    presentations?: number;
    courses?: number;
    projects?: number;
    services?: number;
    visualizations?: number;
  };
}

function countTagOverlap(sourceTags: string[], targetTags?: string[]): number {
  if (!targetTags || targetTags.length === 0 || sourceTags.length === 0) return 0;
  return targetTags.filter((tag) => sourceTags.includes(tag)).length;
}

function getItemRecency(entry: UnifiedRelatedItem): number | null {
  if (entry.collection === "posts") {
    return entry.item.data.pubDate.valueOf();
  }
  if (entry.collection === "presentations") {
    const d = entry.item.data.pubDate;
    return d instanceof Date ? d.valueOf() : new Date(d || "").valueOf();
  }
  if (entry.collection === "publications") {
    const match = entry.item.id.match(/^(\d{4})(?:_(\d{2}))?/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = match[2] ? parseInt(match[2], 10) - 1 : 0;
      return new Date(year, month, 1).valueOf();
    }
    const d = new Date(entry.item.data.pubDate);
    if (!isNaN(d.valueOf())) return d.valueOf();
    return null;
  }
  return null;
}

function compareUnifiedItems(a: UnifiedRelatedItem, b: UnifiedRelatedItem): number {
  // 1. Tag overlap count descending
  if (b.overlapCount !== a.overlapCount) {
    return b.overlapCount - a.overlapCount;
  }

  // 2. Date / recency for posts, presentations, publications
  const recA = getItemRecency(a);
  const recB = getItemRecency(b);

  if (recA !== null && recB !== null) {
    if (recB !== recA) return recB - recA;
  }

  // 3. Secondary for ordered collections (interests, projects, services)
  const orderA = "order" in a.item.data ? ((a.item.data as { order?: number }).order ?? 0) : 0;
  const orderB = "order" in b.item.data ? ((b.item.data as { order?: number }).order ?? 0) : 0;
  if (orderA !== orderB) {
    return orderA - orderB;
  }

  // 4. Alphabetical title fallback for deterministic stability
  return a.item.data.title.localeCompare(b.item.data.title);
}

export async function getRelatedContent(
  options: GetRelatedContentOptions
): Promise<RelatedContentResults> {
  const {
    currentCollection,
    currentId,
    tags = [],
    limits = {},
  } = options;

  const maxTotal = limits.total ?? 6;

  const maxInterests = limits.interests ?? 4;
  const maxPosts = limits.posts ?? 3;
  const maxPubs = limits.publications ?? 3;
  const maxPres = limits.presentations ?? 2;
  const maxCourses = limits.courses ?? 2;
  const maxProjects = limits.projects ?? 2;
  const maxServices = limits.services ?? 2;
  const maxVis = limits.visualizations ?? 3;

  // Load collections concurrently if not passed in
  const [
    interestsCol,
    postsCol,
    pubsCol,
    presCol,
    coursesCol,
    projectsCol,
    servicesCol,
    visCol,
  ] = await Promise.all([
    options.allInterests ?? getCollection("interests"),
    options.allPosts ?? getCollection("posts"),
    options.allPublications ?? getCollection("publications"),
    options.allPresentations ?? getCollection("presentations"),
    options.allCourses ?? getCollection("courses"),
    options.allProjects ?? getCollection("projects"),
    options.allServices ?? getCollection("services"),
    options.allVisualizations ?? getCollection("visualizations"),
  ]);

  // 0. Professional Interests
  const isSelfInterests = currentCollection === "interests";
  const scoredInterests: ScoredItem<CollectionEntry<"interests">>[] = interestsCol
    .filter((i) => !(isSelfInterests && i.id === currentId))
    .map((i) => ({
      item: i,
      overlapCount: countTagOverlap(tags, i.data.tags),
    }))
    .filter((scored) => scored.overlapCount > 0)
    .sort(
      (a, b) =>
        b.overlapCount - a.overlapCount ||
        (a.item.data.order ?? 0) - (b.item.data.order ?? 0)
    );
  const relatedInterests = scoredInterests.slice(0, maxInterests).map((s) => s.item);

  // 1. Posts
  const isSelfPosts = currentCollection === "posts";
  const scoredPosts: ScoredItem<CollectionEntry<"posts">>[] = postsCol
    .filter((p) => !(isSelfPosts && p.id === currentId))
    .map((p) => ({
      item: p,
      overlapCount: countTagOverlap(tags, p.data.tags),
    }))
    .filter((scored) => isSelfPosts || scored.overlapCount > 0)
    .sort(
      (a, b) =>
        b.overlapCount - a.overlapCount ||
        b.item.data.pubDate.valueOf() - a.item.data.pubDate.valueOf()
    );
  const relatedPosts = scoredPosts.slice(0, maxPosts).map((s) => s.item);

  // 2. Publications
  const isSelfPubs = currentCollection === "publications";
  const scoredPubs: ScoredItem<CollectionEntry<"publications">>[] = pubsCol
    .filter((pub) => !(isSelfPubs && pub.id === currentId))
    .map((pub) => ({
      item: pub,
      overlapCount: countTagOverlap(tags, pub.data.tags),
    }))
    .filter((scored) => isSelfPubs || scored.overlapCount > 0)
    .sort(
      (a, b) =>
        b.overlapCount - a.overlapCount ||
        b.item.id.localeCompare(a.item.id)
    );
  const relatedPublications = scoredPubs.slice(0, maxPubs).map((s) => s.item);

  // 3. Presentations
  const isSelfPres = currentCollection === "presentations";
  const scoredPres: ScoredItem<CollectionEntry<"presentations">>[] = presCol
    .filter((p) => !(isSelfPres && p.id === currentId))
    .map((p) => ({
      item: p,
      overlapCount: countTagOverlap(tags, p.data.tags),
    }))
    .filter((scored) => isSelfPres || scored.overlapCount > 0)
    .sort((a, b) => {
      const da = a.item.data.pubDate instanceof Date ? a.item.data.pubDate.valueOf() : new Date(a.item.data.pubDate || '').valueOf();
      const db = b.item.data.pubDate instanceof Date ? b.item.data.pubDate.valueOf() : new Date(b.item.data.pubDate || '').valueOf();
      return b.overlapCount - a.overlapCount || db - da;
    });
  const relatedPresentations = scoredPres.slice(0, maxPres).map((s) => s.item);

  // 4. Courses
  const isSelfCourses = currentCollection === "courses";
  const scoredCourses: ScoredItem<CollectionEntry<"courses">>[] = coursesCol
    .filter((c) => !(isSelfCourses && c.id === currentId))
    .map((c) => ({
      item: c,
      overlapCount: countTagOverlap(tags, c.data.tags),
    }))
    .filter((scored) => isSelfCourses || scored.overlapCount > 0)
    .sort(
      (a, b) =>
        b.overlapCount - a.overlapCount ||
        a.item.data.title.localeCompare(b.item.data.title)
    );
  const relatedCourses = scoredCourses.slice(0, maxCourses).map((s) => s.item);

  // 5. Projects
  const isSelfProjects = currentCollection === "projects";
  const scoredProjects: ScoredItem<CollectionEntry<"projects">>[] = projectsCol
    .filter((p) => !(isSelfProjects && p.id === currentId))
    .map((p) => ({
      item: p,
      overlapCount: countTagOverlap(tags, p.data.tags),
    }))
    .filter((scored) => isSelfProjects || scored.overlapCount > 0)
    .sort(
      (a, b) =>
        b.overlapCount - a.overlapCount ||
        (a.item.data.order ?? 0) - (b.item.data.order ?? 0) ||
        a.item.data.title.localeCompare(b.item.data.title)
    );
  const relatedProjects = scoredProjects.slice(0, maxProjects).map((s) => s.item);

  // 6. Services
  const isSelfServices = currentCollection === "services";
  const scoredServices: ScoredItem<CollectionEntry<"services">>[] = servicesCol
    .filter((s) => !(isSelfServices && s.id === currentId))
    .map((s) => ({
      item: s,
      overlapCount: countTagOverlap(tags, s.data.tags),
    }))
    .filter((scored) => isSelfServices || scored.overlapCount > 0)
    .sort(
      (a, b) =>
        b.overlapCount - a.overlapCount ||
        (a.item.data.order ?? 0) - (b.item.data.order ?? 0)
    );
  const relatedServices = scoredServices.slice(0, maxServices).map((s) => s.item);

  // 7. Visualizations
  const isSelfVis = currentCollection === "visualizations";
  const scoredVis: ScoredItem<CollectionEntry<"visualizations">>[] = visCol
    .filter((v) => !(isSelfVis && v.id === currentId))
    .map((v) => ({
      item: v,
      overlapCount: countTagOverlap(tags, v.data.tags),
    }))
    .filter((scored) => isSelfVis || scored.overlapCount > 0)
    .sort(
      (a, b) =>
        b.overlapCount - a.overlapCount ||
        a.item.data.title.localeCompare(b.item.data.title)
    );
  const relatedVisualizations = scoredVis.slice(0, maxVis).map((s) => s.item);

  // 8. Unified cross-collection ranking
  const allScored: UnifiedRelatedItem[] = [
    ...scoredInterests.map((s) => ({ collection: "interests" as const, item: s.item, overlapCount: s.overlapCount })),
    ...scoredPosts.map((s) => ({ collection: "posts" as const, item: s.item, overlapCount: s.overlapCount })),
    ...scoredPubs.map((s) => ({ collection: "publications" as const, item: s.item, overlapCount: s.overlapCount })),
    ...scoredPres.map((s) => ({ collection: "presentations" as const, item: s.item, overlapCount: s.overlapCount })),
    ...scoredCourses.map((s) => ({ collection: "courses" as const, item: s.item, overlapCount: s.overlapCount })),
    ...scoredProjects.map((s) => ({ collection: "projects" as const, item: s.item, overlapCount: s.overlapCount })),
    ...scoredServices.map((s) => ({ collection: "services" as const, item: s.item, overlapCount: s.overlapCount })),
    ...scoredVis.map((s) => ({ collection: "visualizations" as const, item: s.item, overlapCount: s.overlapCount })),
  ]
    .filter((s) => s.overlapCount > 0)
    .sort(compareUnifiedItems);

  const ranked = allScored.slice(0, maxTotal);

  return {
    ranked,
    interests: relatedInterests,
    posts: relatedPosts,
    publications: relatedPublications,
    presentations: relatedPresentations,
    courses: relatedCourses,
    projects: relatedProjects,
    services: relatedServices,
    visualizations: relatedVisualizations,
  };
}
