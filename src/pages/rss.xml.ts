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
  const [posts, presentations, publications, courses, projects, visualizations] = await Promise.all([
    getCollection('posts'),
    getCollection('presentations'),
    getCollection('publications'),
    getCollection('courses'),
    getCollection('projects'),
    getCollection('visualizations'),
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
    ...projects.map((project) => ({
      title: project.data.title,
      pubDate: resolveItemDate(project.id, project.data.pubDate),
      description: project.data.description || '',
      link: `/projects/${project.id}/`,
      categories: ['Project', ...(project.data.tags || [])],
      customData: formatTagsCustomData(project.data.tags),
    })),
    ...visualizations.map((viz) => ({
      title: viz.data.title,
      pubDate: resolveItemDate(viz.id, viz.data.pubDate),
      description: viz.data.description || '',
      link: `/visualizations/${viz.id}/`,
      categories: ['Visualization', ...(viz.data.tags || [])],
      customData: formatTagsCustomData(viz.data.tags),
    })),
  ];

  items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: 'Dr. Georg Hackenberg | Updates & Publications',
    description:
      'Latest blog posts, keynote presentations, academic publications, university courses, software projects, and interactive visualizations by Dr. Georg Hackenberg.',
    site: context.site || 'https://hackenberg.tech',
    items,
    customData: `<language>en-us</language>`,
  });
}

