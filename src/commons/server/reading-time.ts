import fs from 'node:fs';
import path from 'node:path';
import { getMp3Duration } from '@commons/server/audio-metadata.js';

export interface PostReadingTimeOptions {
  lang?: 'de' | 'en';
  wordsPerMinute?: number;
}

export interface PostReadingTime {
  minutes: number;
  words: number;
  codeBlocks: number;
  images: number;
  text: string;
}

export interface PresentationDurationOptions {
  lang?: 'de' | 'en';
}

export interface PresentationDuration {
  minutes: number;
  seconds: number;
  slideCount: number;
  slidesCount: number;
  text: string;
}

// In-memory caches to avoid redundant file system and parsing operations across pages
const postReadingTimeCache = new Map<string, PostReadingTime>();
const presentationDurationCache = new Map<string, PresentationDuration>();

/**
 * Extracts language from markdown frontmatter if present, fallback to 'de'.
 */
function extractFrontmatterLang(content: string): 'de' | 'en' {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (match) {
    const langMatch = match[1].match(/^\s*lang:\s*["']?(en|de)["']?/m);
    if (langMatch && (langMatch[1] === 'en' || langMatch[1] === 'de')) {
      return langMatch[1];
    }
  }
  return 'de';
}

/**
 * Computes reading time for a blog post based on word count, code blocks, and images.
 * Words are counted at 200 WPM, code blocks weighted at 0.5 min each, and images at 0.25 min each.
 */
export function getPostReadingTime(postId: string, options?: PostReadingTimeOptions): PostReadingTime {
  const cacheKey = `${postId}:${options?.lang ?? 'auto'}:${options?.wordsPerMinute ?? 200}`;
  const cached = postReadingTimeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const postDir = path.resolve(process.cwd(), 'src/content/posts', postId);
  const mdPath = path.join(postDir, 'index.md');
  const mdxPath = path.join(postDir, 'index.mdx');

  let rawContent = '';
  if (fs.existsSync(mdPath)) {
    rawContent = fs.readFileSync(mdPath, 'utf-8');
  } else if (fs.existsSync(mdxPath)) {
    rawContent = fs.readFileSync(mdxPath, 'utf-8');
  }

  const lang = options?.lang ?? (rawContent ? extractFrontmatterLang(rawContent) : 'de');

  if (!rawContent) {
    const fallback: PostReadingTime = {
      minutes: 1,
      words: 0,
      codeBlocks: 0,
      images: 0,
      text: lang === 'en' ? '1 min read' : '1 Min. Lesezeit',
    };
    postReadingTimeCache.set(cacheKey, fallback);
    return fallback;
  }

  // Strip frontmatter
  let cleanContent = rawContent.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n)?/, '');

  // Count & strip fenced code blocks (``` ... ``` or ~~~ ... ~~~)
  const codeBlockRegex = /(?:```[\s\S]*?```|~~~[\s\S]*?~~~)/g;
  const codeBlocksMatch = cleanContent.match(codeBlockRegex);
  const codeBlocks = codeBlocksMatch ? codeBlocksMatch.length : 0;
  cleanContent = cleanContent.replace(codeBlockRegex, ' ');

  // Count & strip images (markdown: ![...](...) and HTML: <img ...>, <Image ...>)
  const imageRegex = /(?:!\[[^\]]*\]\([^)]+\)|<(?:img|Image)\b[^>]*\/?>)/gi;
  const imagesMatch = cleanContent.match(imageRegex);
  const images = imagesMatch ? imagesMatch.length : 0;
  cleanContent = cleanContent.replace(imageRegex, ' ');

  // Strip math blocks & inline math
  cleanContent = cleanContent.replace(/\$\$[\s\S]*?\$\$/g, ' ');
  cleanContent = cleanContent.replace(/\$[^\$\s][^\$]*\$/g, ' ');

  // Strip inline code
  cleanContent = cleanContent.replace(/`([^`]+)`/g, '$1');

  // Strip HTML / JSX tags
  cleanContent = cleanContent.replace(/<[^>]+>/g, ' ');

  // Strip markdown links: [text](url) -> text
  cleanContent = cleanContent.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Strip headers, blockquotes, list markers
  cleanContent = cleanContent.replace(/^#+\s+/gm, ' ');
  cleanContent = cleanContent.replace(/^>\s+/gm, ' ');
  cleanContent = cleanContent.replace(/^[-*+]\s+/gm, ' ');
  cleanContent = cleanContent.replace(/^\d+\.\s+/gm, ' ');

  // Strip formatting asterisks / underscores
  cleanContent = cleanContent.replace(/(\*\*|__)(.*?)\1/g, '$2');
  cleanContent = cleanContent.replace(/(\*|_)(.*?)\1/g, '$2');

  // Count remaining words
  const words = cleanContent.trim().split(/\s+/).filter(Boolean).length;

  const wpm = options?.wordsPerMinute ?? 200;
  const wordMinutes = words / wpm;
  const codeMinutes = codeBlocks * 0.5;
  const imageMinutes = images * 0.25;
  const totalMinutes = wordMinutes + codeMinutes + imageMinutes;
  const minutes = Math.max(1, Math.round(totalMinutes));

  const text = lang === 'en' ? `${minutes} min read` : `${minutes} Min. Lesezeit`;

  const result: PostReadingTime = {
    minutes,
    words,
    codeBlocks,
    images,
    text,
  };

  postReadingTimeCache.set(cacheKey, result);
  return result;
}

/**
 * Computes presentation duration based on MP3 audio files or slide count fallback (45s per slide).
 */
export function getPresentationDuration(presentationId: string, options?: PresentationDurationOptions): PresentationDuration {
  const cacheKey = `${presentationId}:${options?.lang ?? 'auto'}`;
  const cached = presentationDurationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const presentationDir = path.resolve(process.cwd(), 'src/content/presentations', presentationId);
  const slidesDir = path.join(presentationDir, 'slides');
  const audioDir = path.join(presentationDir, 'audio');

  // Determine language
  let lang = options?.lang;
  if (!lang) {
    const mdPath = path.join(presentationDir, 'index.md');
    const mdxPath = path.join(presentationDir, 'index.mdx');
    let rawContent = '';
    if (fs.existsSync(mdPath)) {
      rawContent = fs.readFileSync(mdPath, 'utf-8');
    } else if (fs.existsSync(mdxPath)) {
      rawContent = fs.readFileSync(mdxPath, 'utf-8');
    }
    lang = rawContent ? extractFrontmatterLang(rawContent) : 'de';
  }

  // Count slides
  let slideCount = 0;
  if (fs.existsSync(slidesDir)) {
    try {
      const files = fs.readdirSync(slidesDir);
      slideCount = files.filter((f) => /\.(md|mdx)$/i.test(f)).length;
    } catch {
      slideCount = 0;
    }
  }

  // Calculate audio duration
  let audioDurationSum = 0;
  let hasAudio = false;
  if (fs.existsSync(audioDir)) {
    try {
      const audioFiles = fs.readdirSync(audioDir).filter((f) => f.endsWith('.mp3'));
      if (audioFiles.length > 0) {
        for (const f of audioFiles) {
          const filePath = path.join(audioDir, f);
          audioDurationSum += getMp3Duration(filePath);
        }
        if (audioDurationSum > 0) {
          hasAudio = true;
        }
      }
    } catch {
      hasAudio = false;
    }
  }

  const totalSeconds = hasAudio ? audioDurationSum : slideCount * 45;
  const minutes = Math.max(1, Math.round(totalSeconds / 60));

  const text = lang === 'en'
    ? `${slideCount} slides · ~${minutes} min`
    : `${slideCount} Slides · ~${minutes} Min.`;

  const result: PresentationDuration = {
    minutes,
    seconds: Math.round(totalSeconds),
    slideCount,
    slidesCount: slideCount,
    text,
  };

  presentationDurationCache.set(cacheKey, result);
  return result;
}
