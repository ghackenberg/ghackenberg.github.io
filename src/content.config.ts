import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const linkedinPosts = defineCollection({
  loader: glob({
    base: './src/content/feeds/linkedin/posts',
    pattern: '**/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: ({ image }) => z.object({
    pubDate: z.coerce.date().optional().nullable().default(() => new Date()),
    likes: z.number().default(0),
    comments: z.number().default(0),
    shares: z.number().default(0),
    image: image().nullable().optional(),
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
  loader: glob({
    base: './src/content/feeds/github/repositories',
    pattern: '**/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: ({ image }) => z.object({
    description: z.string(),
    url: z.string(),
    stars: z.number(),
    language: z.string(),
    image: image().nullable().optional(),
    pubDate: z.coerce.date(),
    pushDate: z.coerce.date(),
  }),
});

const youtubeProfile = defineCollection({
  loader: glob({ base: './src/content/feeds/youtube', pattern: 'profile.json' }),
  schema: z.object({
    subscribers: z.string(),
  }),
});

const youtubeVideos = defineCollection({
  loader: glob({
    base: './src/content/feeds/youtube/videos',
    pattern: '**/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    pubDate: z.coerce.date().optional().nullable().default(() => new Date()),
    image: image().nullable().optional(),
    description: z.string().optional().nullable().default(''),
    views: z.number().default(0),
    likes: z.number().default(0),
  }),
});

const posts = defineCollection({
  loader: glob({
    base: './src/content/posts',
    pattern: '**/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
    icon: image().optional(),
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
    pubDate: z.coerce.date().optional(),
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

const projects = defineCollection({
  loader: glob({
    base: './src/content/projects',
    pattern: '**/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    tagline: z.string(),
    description: z.string(),
    href: z.string().url(),
    tags: z.array(z.string()).default([]),
    accentColor: z.enum(['blue', 'yellow', 'purple', 'green']).default('blue'),
    order: z.number().default(0),
    repoName: z.string().optional(),
    screenshot: image().optional(),
    screenshots: z.array(z.object({
      image: image(),
      title: z.string(),
      description: z.string().optional(),
    })).default([]),
    pubDate: z.coerce.date().optional(),
  }),
});

const courses = defineCollection({
  loader: glob({
    base: './src/content/courses',
    pattern: '**/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string().optional(),
    repoName: z.string(),
    learningGoals: z.array(z.string()).default([]),
    terms: z.array(z.string()).default([]),
    language: z.enum(['de', 'en']).default('de'),
    screenshot: image().optional(),
    pubDate: z.coerce.date().optional(),
  }),
});

const services = defineCollection({
  loader: glob({
    base: './src/content/services',
    pattern: '*/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    category: z.string().optional(),
    tagline: z.string(),
    description: z.string(),
    icon: z.string(),
    color: z.enum(['blue', 'yellow', 'purple', 'green']).default('blue'),
    order: z.number().default(0),
    ctaText: z.string().default('Inquire Now'),
    pubDate: z.coerce.date().optional(),
    previewImage: image().optional(),
  })
});

const modules = defineCollection({
  loader: glob({
    base: './src/content/services',
    pattern: '*/modules/*/index.{md,mdx}',
    generateId: ({ entry }) => {
      return entry.replace(/\/index\.(md|mdx)$/, '').replace('/modules/', '/');
    }
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    serviceId: z.string(),
    badge: z.string().optional(),
    tagline: z.string(),
    description: z.string(),
    ctaText: z.string().default('Inquire about this Module'),
    highlights: z.array(z.string()).default([]),
    inputs: z.array(z.string()).default([]),
    outputs: z.array(z.string()).default([]),
    duration: z.string().optional(),
    delivery: z.string().optional(),
    methodologyDescription: z.string().optional(),
    methodologyPhases: z.array(z.object({
      title: z.string(),
      description: z.string(),
    })).optional(),
    order: z.number().default(0),
    pubDate: z.coerce.date().optional(),
    previewImage: image().optional(),
  })
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
  'projects': projects,
  'courses': courses,
  'services': services,
  'modules': modules,
};


