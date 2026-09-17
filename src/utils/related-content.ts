import { getCollection, type CollectionEntry } from "astro:content";

export type ContentCollectionName =
  | "posts"
  | "courses"
  | "projects"
  | "publications"
  | "services"
  | "visualizations";

export interface ScoredItem<T> {
  item: T;
  overlapCount: number;
}

export interface RelatedContentResults {
  posts: CollectionEntry<"posts">[];
  projects: CollectionEntry<"projects">[];
  courses: CollectionEntry<"courses">[];
  publications: CollectionEntry<"publications">[];
  visualizations: CollectionEntry<"visualizations">[];
  services: CollectionEntry<"services">[];
}

export interface GetRelatedContentOptions {
  currentCollection: ContentCollectionName;
  currentId: string;
  tags?: string[];
  allPosts?: CollectionEntry<"posts">[];
  allProjects?: CollectionEntry<"projects">[];
  allCourses?: CollectionEntry<"courses">[];
  allPublications?: CollectionEntry<"publications">[];
  allVisualizations?: CollectionEntry<"visualizations">[];
  allServices?: CollectionEntry<"services">[];
  limits?: {
    posts?: number;
    projects?: number;
    courses?: number;
    publications?: number;
    visualizations?: number;
    services?: number;
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
  const maxProjects = limits.projects ?? 2;
  const maxCourses = limits.courses ?? 2;
  const maxPubs = limits.publications ?? 3;
  const maxVis = limits.visualizations ?? 3;
  const maxServices = limits.services ?? 2;

  // Load collections concurrently if not passed in
  const [
    postsCol,
    projectsCol,
    coursesCol,
    pubsCol,
    visCol,
    servicesCol,
  ] = await Promise.all([
    options.allPosts ?? getCollection("posts"),
    options.allProjects ?? getCollection("projects"),
    options.allCourses ?? getCollection("courses"),
    options.allPublications ?? getCollection("publications"),
    options.allVisualizations ?? getCollection("visualizations"),
    options.allServices ?? getCollection("services"),
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

  // 2. Projects
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

  // 3. Courses
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

  // 4. Publications
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

  // 5. Visualizations
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

  return {
    posts: relatedPosts,
    projects: relatedProjects,
    courses: relatedCourses,
    publications: relatedPublications,
    visualizations: relatedVisualizations,
    services: relatedServices,
  };
}
