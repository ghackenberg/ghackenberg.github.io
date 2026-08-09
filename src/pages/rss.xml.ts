import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('posts');
  const sortedPosts = posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());

  return rss({
    title: 'Dr. Georg Hackenberg | Posts & Articles',
    description: 'Personal blog, technical articles, and academic insights from Dr. Georg Hackenberg, Full Professor for Industrial Informatics.',
    site: context.site || 'https://ghackenberg.github.io',
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description || '',
      link: `/posts/${post.id}/`,
      customData: post.data.tags ? `<tags>${post.data.tags.join(', ')}</tags>` : '',
    })),
    customData: `<language>en-us</language>`,
  });
}
