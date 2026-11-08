import { getCollection } from 'astro:content';
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import crypto from 'node:crypto';
import { formatAuthorsPlain } from '@commons/shared/authors';
import { calculateTagCounts } from '@commons/shared/graph-payload';

function parseItemDate(id: string, dateVal?: string | Date): number {
  if (!dateVal) {
    // Try to extract from the folder ID (e.g. 2007_07_vldb)
    const match = id.match(/^(\d{4})_(\d{2})(?:_(\d{2}))?/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // 0-based
      const day = match[3] ? parseInt(match[3], 10) : 1;
      return Date.UTC(year, month, day);
    }
    return 0;
  }

  if (dateVal instanceof Date) {
    return dateVal.getTime();
  }

  // If it's a string, prioritize the ID prefix if available because
  // fuzzy date range strings like "23-27 September 2007" parse incorrectly in JS.
  const match = id.match(/^(\d{4})_(\d{2})(?:_(\d{2}))?/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // 0-based
    const day = match[3] ? parseInt(match[3], 10) : 1;
    return Date.UTC(year, month, day);
  }

  const parsed = Date.parse(dateVal);
  return !isNaN(parsed) ? parsed : 0;
}

function formatIsoDate(dateMs: number): string | undefined {
  return dateMs > 0 ? new Date(dateMs).toISOString().slice(0, 10) : undefined;
}

interface CoverImageInput {
  src: ImageMetadata | string;
  title?: string;
  description?: string;
}

type ResolvableImage = ImageMetadata | CoverImageInput | string | null | undefined;

async function resolveImage(rawImage: ResolvableImage): Promise<string | undefined> {
  if (!rawImage) return undefined;
  const imgObj: ImageMetadata | string =
    typeof rawImage === 'object' && 'src' in rawImage ? rawImage.src : rawImage;
  if (!imgObj) return undefined;
  if (typeof imgObj === 'string') return imgObj;

  try {
    const optimized = await getImage({
      src: imgObj,
      width: 480,
      format: 'webp',
      quality: 80,
    });
    return optimized.src;
  } catch {
    if (typeof imgObj === 'object' && 'src' in imgObj && typeof imgObj.src === 'string') {
      return imgObj.src;
    }
    return undefined;
  }
}

export interface ContentManifestTagEntry {
  id: string;
  url: string;
  title: string;
  description?: string;
  postsCount: number;
  presentationsCount: number;
  publicationsCount: number;
  projectsCount: number;
  coursesCount: number;
  servicesCount: number;
  newslettersCount: number;
  visualizationsCount: number;
}

export interface ContentManifestItemEntry {
  id: string;
  url: string;
  title: string;
  subtitle?: string;
  description?: string;
  abstract?: string;
  author?: string;
  book?: string;
  image?: string;
  language?: string;
  trl?: number;
  href?: string;
  issueNumber?: number;
  tags?: string[];
  date: number;
  pubDate?: string;
}

export interface ContentManifest {
  siteUrl: string;
  tags: ContentManifestTagEntry[];
  posts: ContentManifestItemEntry[];
  presentations: ContentManifestItemEntry[];
  courses: ContentManifestItemEntry[];
  projects: ContentManifestItemEntry[];
  publications: ContentManifestItemEntry[];
  visualizations: ContentManifestItemEntry[];
  services: ContentManifestItemEntry[];
  newsletters: ContentManifestItemEntry[];
}

export interface ContentManifestArtifact {
  manifest: ContentManifest;
  json: string;
  hash: string;
  url: string;
}

let cachedManifestPromise: Promise<ContentManifestArtifact> | null = null;

async function computeContentManifestArtifact(): Promise<ContentManifestArtifact> {
  const [
    posts,
    presentations,
    courses,
    courseModules,
    projects,
    publications,
    visualizations,
    services,
    serviceModules,
    newsletters,
    tags,
  ] = await Promise.all([
    getCollection('posts'),
    getCollection('presentations'),
    getCollection('courses'),
    getCollection('course-modules'),
    getCollection('projects'),
    getCollection('publications'),
    getCollection('visualizations'),
    getCollection('services'),
    getCollection('service-modules'),
    getCollection('newsletters'),
    getCollection('tags'),
  ]);

  const tagCounts = calculateTagCounts({
    posts,
    publications,
    presentations,
    courses,
    projects,
    services,
    visualizations,
    newsletters,
  });

  const [
    resolvedPosts,
    resolvedPresentations,
    resolvedCourses,
    resolvedProjects,
    resolvedPublications,
    resolvedVisualizations,
    resolvedServices,
    resolvedNewsletters,
  ] = await Promise.all([
    Promise.all(
      posts.map(async (p) => {
        const date = parseItemDate(p.id, p.data.pubDate);
        return {
          id: p.id,
          url: `/posts/${p.id}/`,
          title: p.data.title,
          description: p.data.description || '',
          image: await resolveImage(p.data.image),
          tags: p.data.tags || [],
          date,
          pubDate: formatIsoDate(date),
        };
      })
    ),
    Promise.all(
      presentations.map(async (p) => {
        const date = parseItemDate(p.id, p.data.pubDate);
        return {
          id: p.id,
          url: `/presentations/${p.id}/`,
          title: p.data.title,
          subtitle: p.data.subtitle || '',
          description: p.data.description || '',
          image: await resolveImage(p.data.image),
          tags: p.data.tags || [],
          date,
          pubDate: formatIsoDate(date),
        };
      })
    ),
    Promise.all([
      ...courses.map(async (c) => {
        const date = parseItemDate(c.id, c.data.pubDate);
        return {
          id: c.id,
          url: `/courses/${c.id}/`,
          title: c.data.title,
          description: c.data.description || '',
          image: await resolveImage(c.data.image),
          language: c.data.inLanguage,
          tags: c.data.tags || [],
          date,
          pubDate: formatIsoDate(date),
        };
      }),
      ...courseModules.map(async (m) => {
        const [courseSlug, moduleSlug] = m.id.split('/');
        const parentCourse = courses.find((c) => c.id === courseSlug || c.id === m.data.courseId);
        const date = parseItemDate(m.id, m.data.pubDate);
        return {
          id: m.id,
          url: `/courses/${courseSlug || m.data.courseId}/${moduleSlug || m.id.split('/').pop()}/`,
          title: m.data.title,
          description: m.data.description,
          image: await resolveImage(m.data.image || parentCourse?.data.image),
          date,
          pubDate: formatIsoDate(date),
        };
      }),
    ]),
    Promise.all(
      projects.map(async (p) => {
        const date = parseItemDate(p.id, p.data.pubDate);
        return {
          id: p.id,
          url: `/projects/${p.id}/`,
          title: p.data.title,
          trl: p.data.trl,
          description: p.data.description,
          image: await resolveImage(p.data.image),
          href: p.data.href,
          tags: p.data.tags || [],
          date,
          pubDate: formatIsoDate(date),
        };
      })
    ),
    Promise.all(
      publications.map(async (p) => {
        const date = parseItemDate(p.id, p.data.pubDate);
        return {
          id: p.id,
          url: `/publications/${p.id}/`,
          title: p.data.title,
          author: formatAuthorsPlain(p.data.authors),
          book: p.data.book || '',
          description: p.data.abstract || '',
          abstract: p.data.abstract || '',
          image: await resolveImage(p.data.image),
          tags: p.data.tags || [],
          date,
          pubDate: formatIsoDate(date),
        };
      })
    ),
    Promise.all(
      visualizations.map(async (v) => {
        const date = parseItemDate(v.id, v.data.pubDate);
        return {
          id: v.id,
          url: `/visualizations/${v.id}/`,
          title: v.data.title,
          description: v.data.description,
          image: await resolveImage(v.data.image),
          tags: v.data.tags || [],
          date,
          pubDate: formatIsoDate(date),
        };
      })
    ),
    Promise.all([
      ...services.map(async (s) => {
        const date = parseItemDate(s.id, s.data.pubDate);
        return {
          id: s.id,
          url: `/services/${s.id}/`,
          title: s.data.title,
          description: s.data.description,
          image: await resolveImage(s.data.image),
          tags: s.data.tags || [],
          date,
          pubDate: formatIsoDate(date),
        };
      }),
      ...serviceModules.map(async (m) => {
        const [serviceSlug, moduleSlug] = m.id.split('/');
        const parentService = services.find(
          (s) => s.id === serviceSlug || s.id === m.data.serviceId
        );
        const date = parseItemDate(m.id, m.data.pubDate);
        return {
          id: m.id,
          url: `/services/${serviceSlug || m.data.serviceId}/${moduleSlug || m.id.split('/').pop()}/`,
          title: m.data.title,
          description: m.data.description,
          image: await resolveImage(m.data.image || parentService?.data.image),
          date,
          pubDate: formatIsoDate(date),
        };
      }),
    ]),
    Promise.all(
      newsletters.map(async (n) => {
        const date = parseItemDate(n.id, n.data.pubDate);
        return {
          id: n.id,
          url: `/newsletters/${n.id}/`,
          issueNumber: n.data.issueNumber,
          title: n.data.title,
          subtitle: n.data.subtitle || '',
          description: n.data.description,
          image: await resolveImage(n.data.image),
          tags: n.data.tags || [],
          date,
          pubDate: formatIsoDate(date),
        };
      })
    ),
  ]);

  const manifest = {
    siteUrl: 'https://hackenberg.tech',
    tags: tags.map((t) => ({
      id: t.id,
      url: `/tags/${t.id}/`,
      title: t.data.title,
      description: t.data.description,
      postsCount: tagCounts.posts[t.id] || 0,
      presentationsCount: tagCounts.presentations[t.id] || 0,
      publicationsCount: tagCounts.publications[t.id] || 0,
      projectsCount: tagCounts.projects[t.id] || 0,
      coursesCount: tagCounts.courses[t.id] || 0,
      servicesCount: tagCounts.services[t.id] || 0,
      newslettersCount: tagCounts.newsletters[t.id] || 0,
      visualizationsCount: tagCounts.visualizations[t.id] || 0,
    })),
    posts: resolvedPosts,
    presentations: resolvedPresentations,
    courses: resolvedCourses,
    projects: resolvedProjects,
    publications: resolvedPublications,
    visualizations: resolvedVisualizations,
    services: resolvedServices,
    newsletters: resolvedNewsletters,
  };

  const json = JSON.stringify(manifest, null, 2);
  const hash = crypto.createHash('md5').update(json).digest('hex').slice(0, 8);

  return {
    manifest,
    json,
    hash,
    url: `/api/content-manifest-${hash}.json`,
  };
}

export async function getContentManifestArtifact(): Promise<ContentManifestArtifact> {
  if (import.meta.env.PROD) {
    if (!cachedManifestPromise) {
      cachedManifestPromise = computeContentManifestArtifact();
    }
    return cachedManifestPromise;
  }
  return computeContentManifestArtifact();
}
