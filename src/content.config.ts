import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const linkedinPosts = defineCollection({
  loader: glob({ base: './src/content/feeds/linkedin/posts', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    pubDate: z.coerce.date(),
    likes: z.number().default(0),
    comments: z.number().default(0),
    shares: z.number().default(0),
    image: z.string().optional(),
    url: z.string().optional(),
  }),
});

const linkedinProfile = defineCollection({
  loader: glob({ base: './src/content/feeds/linkedin', pattern: 'profile.json' }),
  schema: z.object({
    followers: z.string().optional(),
    postIds: z.array(z.string()).optional(),
  }),
});

const githubProfile = defineCollection({
  loader: glob({ base: './src/content/feeds/github', pattern: 'profile.json' }),
  schema: z.object({
    followers: z.number(),
  }),
});

const githubRepos = defineCollection({
  loader: glob({ base: './src/content/feeds/github/repositories', pattern: '**/*.json' }),
  schema: z.object({
    name: z.string(),
    description: z.string(),
    html_url: z.string(),
    stargazers_count: z.number(),
    language: z.string(),
    social_preview: z.string().optional(),
    updatedAt: z.string().optional(),
    pushedAt: z.string().optional(),
  }),
});

const youtubeProfile = defineCollection({
  loader: glob({ base: './src/content/feeds/youtube', pattern: 'profile.json' }),
  schema: z.object({
    subscribers: z.string(),
  }),
});

const youtubeVideos = defineCollection({
  loader: glob({ base: './src/content/feeds/youtube/videos', pattern: '**/*.json' }),
  schema: z.object({
    title: z.string(),
    id: z.string(),
    published: z.string(),
    publishedAt: z.string().optional(),
    thumbnail: z.string().optional(),
    description: z.string(),
    views: z.string(),
    likes: z.string(),
  }),
});

const posts = defineCollection({
  loader: glob({
    base: './src/content/posts',
    pattern: '**/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
    icon: z.string().optional(),
  }),
});

const publications = defineCollection({
  loader: glob({
    base: './src/content/publications',
    pattern: '**/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: z.object({
    title: z.string(),
    pubDate: z.string(),
    book: z.string().optional(),
    author: z.string(),
    abstract: z.string().optional(),
    tags: z.array(z.string()).default([]),
    bibtex: z.string().optional(),
    slides: z.string().optional(),
    icon: z.string().optional(),
    publisherUrl: z.string().optional(),
  }),
});

const visualizations = defineCollection({
  loader: glob({
    base: './src/content/visualizations',
    pattern: '**/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    screenshot: image().optional(),
    colorClass: z.string(),
    badgeColor: z.string(),
  }),
});

const experiences = defineCollection({
  loader: glob({ base: './src/content/experiences', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    company: z.string(),
    employmentType: z.string().optional(),
    startMonth: z.number(),
    startYear: z.number(),
    endMonth: z.number().nullable().optional(),
    endYear: z.number().nullable().optional(),
    location: z.string().optional(),
    color: z.enum(['blue', 'yellow', 'purple', 'green']).default('blue'),
    order: z.number().optional(),
  }),
});

const products = defineCollection({
  loader: glob({ base: './src/content/products', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    tagline: z.string(),
    description: z.string(),
    href: z.string().url(),
    tags: z.array(z.string()).default([]),
    accentColor: z.enum(['blue', 'yellow', 'purple', 'green']).default('blue'),
    order: z.number().default(0),
  }),
});

const courses = defineCollection({
  loader: glob({ base: './src/content/courses', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    repoName: z.string(),
    learningGoals: z.array(z.string()).default([]),
    terms: z.array(z.string()).default([]),
    language: z.enum(['de', 'en']).default('de'),
  }),
});

export const collections = {
  'linkedin-posts': linkedinPosts,
  'linkedin-profile': linkedinProfile,
  'github-profile': githubProfile,
  'github-repos': githubRepos,
  'youtube-profile': youtubeProfile,
  'youtube-videos': youtubeVideos,
  'posts': posts,
  'publications': publications,
  'visualizations': visualizations,
  'experiences': experiences,
  'products': products,
  'courses': courses,
};

