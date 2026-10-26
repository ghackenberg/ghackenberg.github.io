import { getCollection } from "astro:content";
import { formatAuthorsPlain } from "@commons/shared/authors";
import { getImage } from "astro:assets";

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

import type { ImageMetadata } from "astro";

interface CoverImageInput {
  src: ImageMetadata | string;
  title?: string;
  description?: string;
}

type ResolvableImage = ImageMetadata | CoverImageInput | string | null | undefined;

async function resolveImage(rawImage: ResolvableImage): Promise<string | undefined> {
  if (!rawImage) return undefined;
  const imgObj: ImageMetadata | string = typeof rawImage === 'object' && 'src' in rawImage ? rawImage.src : rawImage;
  if (!imgObj) return undefined;
  if (typeof imgObj === 'string') return imgObj;
  
  try {
    const optimized = await getImage({
      src: imgObj,
      width: 480,
      format: 'webp',
      quality: 80
    });
    return optimized.src;
  } catch {
    if (typeof imgObj === 'object' && 'src' in imgObj && typeof imgObj.src === 'string') {
      return imgObj.src;
    }
    return undefined;
  }
}

export async function GET() {
  const posts = await getCollection("posts");
  const presentations = await getCollection("presentations");
  const courses = await getCollection("courses");
  const courseModules = await getCollection("course-modules");
  const projects = await getCollection("projects");
  const publications = await getCollection("publications");
  const visualizations = await getCollection("visualizations");
  const services = await getCollection("services");
  const serviceModules = await getCollection("service-modules");
  const newsletters = await getCollection("newsletters");
  const tags = await getCollection("tags");

  const [
    resolvedPosts,
    resolvedPresentations,
    resolvedCourses,
    resolvedProjects,
    resolvedVisualizations,
    resolvedServices,
    resolvedNewsletters
  ] = await Promise.all([
    Promise.all(posts.map(async p => ({
      id: p.id,
      url: `/posts/${p.id}/`,
      title: p.data.title,
      description: p.data.description || '',
      image: await resolveImage(p.data.image),
      tags: p.data.tags || [],
      date: parseItemDate(p.id, p.data.pubDate)
    }))),
    Promise.all(presentations.map(async p => ({
      id: p.id,
      url: `/presentations/${p.id}/`,
      title: p.data.title,
      subtitle: p.data.subtitle || '',
      description: p.data.description || '',
      image: await resolveImage(p.data.image),
      tags: p.data.tags || [],
      date: parseItemDate(p.id, p.data.pubDate)
    }))),
    Promise.all([
      ...courses.map(async c => ({
        id: c.id,
        url: `/courses/${c.id}/`,
        title: c.data.title,
        description: c.data.description || '',
        image: await resolveImage(c.data.image),
        language: c.data.inLanguage,
        tags: c.data.tags || [],
        date: parseItemDate(c.id, c.data.pubDate)
      })),
      ...courseModules.map(async m => ({
        id: m.id,
        url: `/courses/${m.data.courseId}/${m.id.split('/').pop()}/`,
        title: m.data.title,
        description: m.data.description,
        image: await resolveImage(m.data.image),
        date: parseItemDate(m.id, m.data.pubDate)
      }))
    ]),
    Promise.all(projects.map(async p => ({
      id: p.id,
      url: `/projects/${p.id}/`,
      title: p.data.title,
      trl: p.data.trl,
      description: p.data.description,
      image: await resolveImage(p.data.image),
      href: p.data.href,
      tags: p.data.tags || [],
      date: parseItemDate(p.id, p.data.pubDate)
    }))),
    Promise.all(visualizations.map(async v => ({
      id: v.id,
      url: `/visualizations/${v.id}/`,
      title: v.data.title,
      description: v.data.description,
      image: await resolveImage(v.data.image),
      tags: v.data.tags || [],
      date: parseItemDate(v.id, v.data.pubDate)
    }))),
    Promise.all([
      ...services.map(async s => ({
        id: s.id,
        url: `/services/${s.id}/`,
        title: s.data.title,
        description: s.data.description,
        image: await resolveImage(s.data.image),
        tags: s.data.tags || [],
        date: parseItemDate(s.id, s.data.pubDate)
      })),
      ...serviceModules.map(async m => ({
        id: m.id,
        url: `/services/${m.data.serviceId}/${m.id.split('/').pop()}/`,
        title: m.data.title,
        description: m.data.description,
        date: parseItemDate(m.id, m.data.pubDate)
      }))
    ]),
    Promise.all(newsletters.map(async n => ({
      id: n.id,
      url: `/newsletters/${n.id}/`,
      issueNumber: n.data.issueNumber,
      title: n.data.title,
      subtitle: n.data.subtitle || '',
      description: n.data.description,
      image: await resolveImage(n.data.image),
      tags: n.data.tags || [],
      date: parseItemDate(n.id, n.data.pubDate)
    })))
  ]);

  const manifest = {
    tags: tags.map(t => ({
      id: t.id,
      url: `/tags/${t.id}/`,
      title: t.data.title,
      description: t.data.description,
      postsCount: posts.filter(p => p.data.tags.includes(t.id)).length,
      presentationsCount: presentations.filter(pres => pres.data.tags && pres.data.tags.includes(t.id)).length,
      publicationsCount: publications.filter(pub => pub.data.tags.includes(t.id)).length,
      projectsCount: projects.filter(proj => proj.data.tags && proj.data.tags.includes(t.id)).length,
      coursesCount: courses.filter(c => c.data.tags && c.data.tags.includes(t.id)).length,
      servicesCount: services.filter(s => s.data.tags && s.data.tags.includes(t.id)).length,
      newslettersCount: newsletters.filter(n => n.data.tags && n.data.tags.includes(t.id)).length,
      visualizationsCount: visualizations.filter(v => v.data.tags && v.data.tags.includes(t.id)).length,
    })),
    posts: resolvedPosts,
    presentations: resolvedPresentations,
    courses: resolvedCourses,
    projects: resolvedProjects,
    publications: publications.map(p => ({
      id: p.id,
      url: `/publications/${p.id}/`,
      title: p.data.title,
      author: formatAuthorsPlain(p.data.authors),
      book: p.data.book || '',
      description: p.data.abstract || '',
      abstract: p.data.abstract || '',
      tags: p.data.tags || [],
      date: parseItemDate(p.id, p.data.pubDate)
    })),
    visualizations: resolvedVisualizations,
    services: resolvedServices,
    newsletters: resolvedNewsletters
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
