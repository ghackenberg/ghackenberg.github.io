import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { getFileContentHash } from '@commons/server/content-hash';
import type {
  NewsletterFeaturedItem,
  NewsletterIssueEmailProps,
} from './NewsletterIssueEmail';

export interface RawNewsletterImage {
  src?: string;
  image?: string;
  title?: string;
  description?: string;
  caption?: string;
}

export interface RawNewsletterFrontmatter {
  title?: string;
  subtitle?: string;
  description?: string;
  issueNumber?: number;
  pubDate?: string | Date;
  image?: RawNewsletterImage;
  featuredPosts?: string[];
  featuredPresentations?: string[];
  featuredPublications?: string[];
  featuredCourses?: string[];
  featuredProjects?: string[];
  featuredVisualizations?: string[];
}

interface RawContentFrontmatter {
  title?: string;
  description?: string;
  pubDate?: string | Date;
}

export interface ParsedNewsletterIssue extends NewsletterIssueEmailProps {
  pubDateIso: string;
  filePath: string;
}

const DOMAIN_COLLECTION_CONFIG: ReadonlyArray<{
  field: keyof Pick<
    RawNewsletterFrontmatter,
    | 'featuredPosts'
    | 'featuredPresentations'
    | 'featuredPublications'
    | 'featuredCourses'
    | 'featuredProjects'
    | 'featuredVisualizations'
  >;
  collectionDir: string;
  routePrefix: string;
  domainLabel: NewsletterFeaturedItem['domain'];
}> = [
  {
    field: 'featuredPosts',
    collectionDir: 'posts',
    routePrefix: 'posts',
    domainLabel: 'Post',
  },
  {
    field: 'featuredPresentations',
    collectionDir: 'presentations',
    routePrefix: 'presentations',
    domainLabel: 'Presentation',
  },
  {
    field: 'featuredPublications',
    collectionDir: 'publications',
    routePrefix: 'publications',
    domainLabel: 'Publication',
  },
  {
    field: 'featuredCourses',
    collectionDir: 'courses',
    routePrefix: 'courses',
    domainLabel: 'Course',
  },
  {
    field: 'featuredProjects',
    collectionDir: 'projects',
    routePrefix: 'projects',
    domainLabel: 'Project',
  },
  {
    field: 'featuredVisualizations',
    collectionDir: 'visualizations',
    routePrefix: 'visualizations',
    domainLabel: 'Visualization',
  },
];

function splitMarkdownFrontmatter(rawContent: string): {
  yamlBlock: string;
  markdownBody: string;
} {
  const normalized = rawContent.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error('Markdown file is missing a valid YAML frontmatter block.');
  }
  return {
    yamlBlock: match[1],
    markdownBody: match[2].trim(),
  };
}

function formatDateEn(dateInput?: string | Date): string | undefined {
  if (!dateInput) return undefined;
  const dateObj = dateInput instanceof Date ? dateInput : new Date(String(dateInput));
  if (Number.isNaN(dateObj.getTime())) return undefined;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateLongEn(dateInput: string | Date): string {
  const dateObj = dateInput instanceof Date ? dateInput : new Date(String(dateInput));
  if (Number.isNaN(dateObj.getTime())) {
    return String(dateInput);
  }
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function resolveFeaturedItem(
  contentRootDir: string,
  collectionDir: string,
  routePrefix: string,
  domainLabel: NewsletterFeaturedItem['domain'],
  itemSlug: string
): NewsletterFeaturedItem {
  const itemFilePath = path.join(contentRootDir, collectionDir, itemSlug, 'index.md');
  if (!fs.existsSync(itemFilePath)) {
    throw new Error(
      `Referenced ${collectionDir} item "${itemSlug}" not found at ${itemFilePath}`
    );
  }

  const rawItem = fs.readFileSync(itemFilePath, 'utf-8');
  const { yamlBlock } = splitMarkdownFrontmatter(rawItem);
  const parsed = YAML.parse(yamlBlock) as RawContentFrontmatter;

  return {
    domain: domainLabel,
    title: parsed.title || itemSlug,
    description: parsed.description || '',
    url: `https://hackenberg.tech/${routePrefix}/${itemSlug}/`,
    dateFormatted: formatDateEn(parsed.pubDate),
  };
}

function resolveIssueHeroImageUrl(
  slug: string,
  issueDir: string,
  rootDir: string,
  image?: RawNewsletterImage
): string {
  const relImgPath = image?.src;
  if (!relImgPath) {
    throw new Error(
      `Newsletter issue "${slug}" is missing required frontmatter field "image.src".`
    );
  }

  const absImgPath = path.resolve(issueDir, relImgPath);
  if (!fs.existsSync(absImgPath)) {
    throw new Error(
      `Newsletter issue "${slug}" hero image not found at ${absImgPath}.`
    );
  }

  const distIssueDir = path.resolve(rootDir, 'dist', 'newsletters', slug);
  if (fs.existsSync(distIssueDir)) {
    const matchedFile = fs
      .readdirSync(distIssueDir)
      .find((f) => /^preview-[a-zA-Z0-9_-]+\.jpe?g$/i.test(f));
    if (matchedFile) {
      return `https://hackenberg.tech/newsletters/${slug}/${matchedFile}`;
    }
  }

  const hash = getFileContentHash(absImgPath);
  return `https://hackenberg.tech/newsletters/${slug}/preview-${hash}.jpg`;
}

/**
 * Loads and parses a single newsletter issue by slug from `src/content/newsletters/<slug>/index.md`.
 */
export async function loadNewsletterIssue(
  slug: string,
  rootDir: string = process.cwd()
): Promise<ParsedNewsletterIssue> {
  const contentRootDir = path.resolve(rootDir, 'src', 'content');
  const issueDir = path.join(contentRootDir, 'newsletters', slug);
  const issueFilePath = path.join(issueDir, 'index.md');

  if (!fs.existsSync(issueFilePath)) {
    throw new Error(`Newsletter issue "${slug}" not found at ${issueFilePath}`);
  }

  const rawContent = fs.readFileSync(issueFilePath, 'utf-8');
  const { yamlBlock, markdownBody } = splitMarkdownFrontmatter(rawContent);
  const frontmatter = YAML.parse(yamlBlock) as RawNewsletterFrontmatter;

  const effImage = frontmatter.image;

  if (!frontmatter.title || !frontmatter.description || !frontmatter.issueNumber || !frontmatter.pubDate || !effImage) {
    throw new Error(
      `Newsletter issue "${slug}" is missing required frontmatter fields (title, description, issueNumber, pubDate, image).`
    );
  }

  const featuredItems: NewsletterFeaturedItem[] = [];

  for (const domainCfg of DOMAIN_COLLECTION_CONFIG) {
    const slugs = frontmatter[domainCfg.field] || [];
    for (const itemSlug of slugs) {
      featuredItems.push(
        resolveFeaturedItem(
          contentRootDir,
          domainCfg.collectionDir,
          domainCfg.routePrefix,
          domainCfg.domainLabel,
          itemSlug
        )
      );
    }
  }

  const pubDateObj =
    frontmatter.pubDate instanceof Date
      ? frontmatter.pubDate
      : new Date(String(frontmatter.pubDate));

  const heroImageSrc = resolveIssueHeroImageUrl(
    slug,
    issueDir,
    rootDir,
    effImage
  );
  const heroImageTitle = effImage.title || frontmatter.title;
  const heroImageAlt =
    effImage.description ||
    effImage.caption ||
    frontmatter.description;

  return {
    slug,
    issueNumber: frontmatter.issueNumber,
    title: frontmatter.title,
    subtitle: frontmatter.subtitle,
    description: frontmatter.description,
    dateFormatted: formatDateLongEn(pubDateObj),
    pubDateIso: pubDateObj.toISOString(),
    markdownBody,
    featuredItems,
    heroImageSrc,
    heroImageAlt,
    heroImageTitle,
    filePath: issueFilePath,
  };
}

/**
 * Discovers and loads all newsletter issues in `src/content/newsletters/` sorted by issueNumber ascending.
 */
export async function loadAllNewsletterIssues(
  rootDir: string = process.cwd()
): Promise<ParsedNewsletterIssue[]> {
  const newslettersDir = path.resolve(rootDir, 'src', 'content', 'newsletters');
  if (!fs.existsSync(newslettersDir)) {
    return [];
  }

  const entries = fs.readdirSync(newslettersDir, { withFileTypes: true });
  const issues: ParsedNewsletterIssue[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const indexMdPath = path.join(newslettersDir, entry.name, 'index.md');
    if (fs.existsSync(indexMdPath)) {
      issues.push(await loadNewsletterIssue(entry.name, rootDir));
    }
  }

  return issues.sort((a, b) => a.issueNumber - b.issueNumber);
}
