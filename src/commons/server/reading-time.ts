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
 * Computes reading time for a blog post based on word count, code blocks, and images.
 * Words are counted at 200 WPM, code blocks weighted at 0.5 min each, and images at 0.25 min each.
 * All reading time labels are consistently formatted in English (e.g., 'X min read').
 */
export function getPostReadingTime(postId: string, options?: PostReadingTimeOptions): PostReadingTime {
  const cacheKey = `${postId}:${options?.wordsPerMinute ?? 200}`;
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

  if (!rawContent) {
    const fallback: PostReadingTime = {
      minutes: 1,
      words: 0,
      codeBlocks: 0,
      images: 0,
      text: '1 min read',
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

  const text = `${minutes} min read`;

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
 * All presentation duration labels are consistently formatted in English (e.g., 'N slides · ~M min').
 */
export function getPresentationDuration(presentationId: string, _options?: PresentationDurationOptions): PresentationDuration {
  const cacheKey = presentationId;
  const cached = presentationDurationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const presentationDir = path.resolve(process.cwd(), 'src/content/presentations', presentationId);
  const slidesDir = path.join(presentationDir, 'slides');
  const audioDir = path.join(presentationDir, 'audio');

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

  const text = `${slideCount} slides · ~${minutes} min`;

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
