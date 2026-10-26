import rss, { type RSSFeedItem } from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

/**
 * Resolves a deterministic Date for any content item, falling back to
 * the YYYY_MM_DD / YYYY_MM folder prefix or a canonical baseline date.
 */
function resolveItemDate(id: string, dateVal?: Date | string): Date {
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    return dateVal;
  }
  if (typeof dateVal === 'string') {
    const parsed = Date.parse(dateVal);
    if (!isNaN(parsed)) {
      return new Date(parsed);
    }
  }
  const match = id.match(/^(\d{4})_(\d{2})(?:_(\d{2}))?/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = match[3] ? parseInt(match[3], 10) : 1;
    return new Date(Date.UTC(year, month, day));
  }
  return new Date(Date.UTC(2026, 8, 14));
}

function formatTagsCustomData(tags?: string[]): string {
  return tags && tags.length > 0 ? `<tags>${tags.join(', ')}</tags>` : '';
}

export async function GET(context: APIContext) {
  const [
    posts,
    presentations,
    publications,
    courses,
    courseModules,
    projects,
    services,
    serviceModules,
    visualizations,
    newsletters,
  ] = await Promise.all([
    getCollection('posts'),
    getCollection('presentations'),
    getCollection('publications'),
    getCollection('courses'),
    getCollection('course-modules'),
    getCollection('projects'),
    getCollection('services'),
    getCollection('service-modules'),
    getCollection('visualizations'),
    getCollection('newsletters'),
  ]);

  const items: (RSSFeedItem & { pubDate: Date })[] = [
    ...posts.map((post) => ({
      title: post.data.title,
      pubDate: resolveItemDate(post.id, post.data.pubDate),
      description: post.data.description || '',
      link: `/posts/${post.id}/`,
      categories: ['Post', ...(post.data.tags || [])],
      customData: formatTagsCustomData(post.data.tags),
    })),
    ...presentations.map((pres) => ({
      title: pres.data.title,
      pubDate: resolveItemDate(pres.id, pres.data.pubDate),
      description: pres.data.description || pres.data.subtitle || '',
      link: `/presentations/${pres.id}/`,
      categories: ['Presentation', ...(pres.data.tags || [])],
      customData: formatTagsCustomData(pres.data.tags),
    })),
    ...publications.map((pub) => ({
      title: pub.data.title,
      pubDate: resolveItemDate(pub.id, pub.data.pubDate),
      description: pub.data.abstract || '',
      link: `/publications/${pub.id}/`,
      categories: ['Publication', ...(pub.data.tags || [])],
      customData: formatTagsCustomData(pub.data.tags),
    })),
    ...courses.map((course) => ({
      title: course.data.title,
      pubDate: resolveItemDate(course.id, course.data.pubDate),
      description: course.data.description || '',
      link: `/courses/${course.id}/`,
      categories: ['Course', ...(course.data.tags || [])],
      customData: formatTagsCustomData(course.data.tags),
    })),
    ...courseModules.map((mod) => ({
      title: mod.data.title,
      pubDate: resolveItemDate(mod.id, mod.data.pubDate),
      description: mod.data.description || '',
      link: `/courses/${mod.data.courseId}/${mod.id.split('/').pop()}/`,
      categories: ['Course Module'],
    })),
    ...projects.map((project) => ({
      title: project.data.title,
      pubDate: resolveItemDate(project.id, project.data.pubDate),
      description: project.data.description || '',
      link: `/projects/${project.id}/`,
      categories: ['Project', ...(project.data.tags || [])],
      customData: formatTagsCustomData(project.data.tags),
    })),
    ...services.map((s) => ({
      title: s.data.title,
      pubDate: resolveItemDate(s.id, s.data.pubDate),
      description: s.data.description || '',
      link: `/services/${s.id}/`,
      categories: ['Service', ...(s.data.tags || [])],
      customData: formatTagsCustomData(s.data.tags),
    })),
    ...serviceModules.map((m) => ({
      title: m.data.title,
      pubDate: resolveItemDate(m.id, m.data.pubDate),
      description: m.data.description || '',
      link: `/services/${m.data.serviceId}/${m.id.split('/').pop()}/`,
      categories: ['Service Module'],
    })),
    ...visualizations.map((viz) => ({
      title: viz.data.title,
      pubDate: resolveItemDate(viz.id, viz.data.pubDate),
      description: viz.data.description || '',
      link: `/visualizations/${viz.id}/`,
      categories: ['Visualization', ...(viz.data.tags || [])],
      customData: formatTagsCustomData(viz.data.tags),
    })),
    ...newsletters.map((n) => ({
      title: n.data.title,
      pubDate: resolveItemDate(n.id, n.data.pubDate),
      description: n.data.description || '',
      link: `/newsletters/${n.id}/`,
      categories: ['Newsletter', ...(n.data.tags || [])],
      customData: formatTagsCustomData(n.data.tags),
    })),
  ];

  items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: 'Dr. Georg Hackenberg | Updates & Publications',
    description:
      'Latest blog posts, keynote presentations, academic publications, university courses, software projects, advisory services, newsletters, and interactive visualizations by Dr. Georg Hackenberg.',
    site: context.site || 'https://hackenberg.tech',
    items,
    customData: `<language>en-us</language>`,
  });
}
