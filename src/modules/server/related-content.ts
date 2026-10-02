import { getCollection, type CollectionEntry } from "astro:content";

export type ContentCollectionName =
  | "posts"
  | "publications"
  | "presentations"
  | "courses"
  | "projects"
  | "services"
  | "visualizations";

export interface ScoredItem<T> {
  item: T;
  overlapCount: number;
}

export interface RelatedContentResults {
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
  allPosts?: CollectionEntry<"posts">[];
  allPublications?: CollectionEntry<"publications">[];
  allPresentations?: CollectionEntry<"presentations">[];
  allCourses?: CollectionEntry<"courses">[];
  allProjects?: CollectionEntry<"projects">[];
  allServices?: CollectionEntry<"services">[];
  allVisualizations?: CollectionEntry<"visualizations">[];
  limits?: {
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

export async function getRelatedContent(
  options: GetRelatedContentOptions
): Promise<RelatedContentResults> {
  const {
    currentCollection,
    currentId,
    tags = [],
    limits = {},
  } = options;

  const maxPosts = limits.posts ?? 3;
  const maxPubs = limits.publications ?? 3;
  const maxPres = limits.presentations ?? 2;
  const maxCourses = limits.courses ?? 2;
  const maxProjects = limits.projects ?? 2;
  const maxServices = limits.services ?? 2;
  const maxVis = limits.visualizations ?? 3;

  // Load collections concurrently if not passed in
  const [
    postsCol,
    pubsCol,
    presCol,
    coursesCol,
    projectsCol,
    servicesCol,
    visCol,
  ] = await Promise.all([
    options.allPosts ?? getCollection("posts"),
    options.allPublications ?? getCollection("publications"),
    options.allPresentations ?? getCollection("presentations"),
    options.allCourses ?? getCollection("courses"),
    options.allProjects ?? getCollection("projects"),
    options.allServices ?? getCollection("services"),
    options.allVisualizations ?? getCollection("visualizations"),
  ]);

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

  return {
    posts: relatedPosts,
    publications: relatedPublications,
    presentations: relatedPresentations,
    courses: relatedCourses,
    projects: relatedProjects,
    services: relatedServices,
    visualizations: relatedVisualizations,
  };
}
