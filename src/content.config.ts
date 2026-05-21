import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const linkedinPosts = defineCollection({
  loader: glob({ base: './src/content/linkedin-posts', pattern: '**/*.{md,mdx}' }),
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
  loader: glob({ base: './src/content/linkedin-profile', pattern: '**/*.json' }),
  schema: z.object({
    followers: z.string().optional(),
    posts: z.string().optional(),
    postUrls: z.array(z.string()).optional(),
  }),
});

const githubProfile = defineCollection({
  loader: glob({ base: './src/content/github-profile', pattern: '**/*.json' }),
  schema: z.object({
    public_repos: z.number(),
    followers: z.number(),
  }),
});

const githubRepos = defineCollection({
  loader: glob({ base: './src/content/github-repos', pattern: '**/*.json' }),
  schema: z.object({
    name: z.string(),
    description: z.string(),
    html_url: z.string(),
    stargazers_count: z.number(),
    language: z.string(),
    social_preview: z.string().optional(),
  }),
});

const youtubeProfile = defineCollection({
  loader: glob({ base: './src/content/youtube-profile', pattern: '**/*.json' }),
  schema: z.object({
    subscribers: z.string(),
    videos: z.string(),
  }),
});

const youtubeVideos = defineCollection({
  loader: glob({ base: './src/content/youtube-videos', pattern: '**/*.json' }),
  schema: z.object({
    title: z.string(),
    id: z.string(),
    published: z.string(),
    thumbnail: z.string().optional(),
    description: z.string(),
    views: z.string(),
    likes: z.string(),
  }),
});

export const collections = {
  'linkedin-posts': linkedinPosts,
  'linkedin-profile': linkedinProfile,
  'github-profile': githubProfile,
  'github-repos': githubRepos,
  'youtube-profile': youtubeProfile,
  'youtube-videos': youtubeVideos,
};
