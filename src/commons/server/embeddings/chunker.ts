import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { SearchChunk, CitationReference } from './types.ts';
import {
  extractReferencesFromFrontmatter,
  loadGlobalPublications,
  resolveInTextCitations,
  type FrontmatterValue,
} from './citation-resolver.ts';

type DocumentFrontmatter = Record<string, FrontmatterValue>;

/**
 * Estimates token count based on multilingual word boundaries (approx 1.33 tokens per whitespace word).
 */
export function estimateTokenCount(text: string): number {
  if (!text || !text.trim()) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean);
  return Math.max(1, Math.round(words.length * 1.33));
}

/**
 * Strips presentation voiceover cues and inline cue tags.
 */
export function stripCues(text: string): string {
  if (!text) return '';
  return text.replace(/\{cue:[^}]+\}|\{\/cue(?::[^}]+)?\}/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Cleans Markdown and MDX artifacts (JSX components, imports, code fences, HTML tags).
 */
export function cleanMarkdownMdx(rawText: string): string {
  if (!rawText) return '';

  let text = rawText;

  // 1. Remove ESM imports and exports
  text = text.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?/gm, '');
  text = text.replace(/^export\s+(?:default\s+)?[\s\S]*?;?/gm, '');

  // 2. Remove cue tags
  text = stripCues(text);

  // 3. Extract text from JSX attributes like title="..." and desc="..."
  text = text.replace(/<(?:BentoCard|CalloutBox|TitleSlide)[^>]*\btitle=["']([^"']+)["'][^>]*>/gi, '\n### $1\n');
  text = text.replace(/\b(?:title|desc):\s*["']([^"']+)["']/g, '$1. ');

  // 4. Strip JSX / HTML tags
  text = text.replace(/<\/?[A-Za-z][A-Za-z0-9_-]*(?:\s+[^>]*?)?\/?>/g, ' ');

  // 5. Clean Markdown formatting
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1'); // images
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // links
  text = text.replace(/`{3,}[\w-]*\n([\s\S]*?)`{3,}/g, '$1'); // code blocks
  text = text.replace(/`([^`]+)`/g, '$1'); // inline code
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2'); // bold
  text = text.replace(/(\*|_)(.*?)\1/g, '$2'); // italic
  text = text.replace(/^>\s*/gm, ''); // blockquotes
  text = text.replace(/^[*\-+]\s+/gm, '• '); // bullet points

  // 6. Normalize whitespace
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

/**
 * Splits text into paragraphs, respecting code and block structures.
 */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

/**
 * Groups paragraphs into contextual chunks targeting 300-400 tokens.
 */
export function chunkTextContent(
  text: string,
  contextHeader: string,
  targetMaxTokens = 420
): string[] {
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length === 0) return [];

  const chunks: string[] = [];
  let currentParagraphs: string[] = [];
  let currentTokens = estimateTokenCount(contextHeader);

  for (const para of paragraphs) {
    const paraTokens = estimateTokenCount(para);

    if (currentTokens + paraTokens > targetMaxTokens && currentParagraphs.length > 0) {
      // Finalize current chunk
      const chunkBody = currentParagraphs.join('\n\n');
      const fullChunk = contextHeader ? `${contextHeader}\n\n${chunkBody}` : chunkBody;
      chunks.push(fullChunk);

      // Start new chunk with slight paragraph overlap if current paragraph is small
      if (paraTokens < targetMaxTokens) {
        currentParagraphs = [para];
        currentTokens = estimateTokenCount(contextHeader) + paraTokens;
      } else {
        // If single paragraph exceeds max tokens, split on sentence boundaries
        const sentences = para.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [para];
        let subSentenceBatch: string[] = [];
        let subTokens = estimateTokenCount(contextHeader);

        for (const s of sentences) {
          const sTokens = estimateTokenCount(s);
          if (subTokens + sTokens > targetMaxTokens && subSentenceBatch.length > 0) {
            chunks.push(`${contextHeader}\n\n${subSentenceBatch.join(' ').trim()}`);
            subSentenceBatch = [s.trim()];
            subTokens = estimateTokenCount(contextHeader) + sTokens;
          } else {
            subSentenceBatch.push(s.trim());
            subTokens += sTokens;
          }
        }
        if (subSentenceBatch.length > 0) {
          currentParagraphs = [subSentenceBatch.join(' ').trim()];
          currentTokens = subTokens;
        } else {
          currentParagraphs = [];
          currentTokens = estimateTokenCount(contextHeader);
        }
      }
    } else {
      currentParagraphs.push(para);
      currentTokens += paraTokens;
    }
  }

  if (currentParagraphs.length > 0) {
    const chunkBody = currentParagraphs.join('\n\n');
    const fullChunk = contextHeader ? `${contextHeader}\n\n${chunkBody}` : chunkBody;
    chunks.push(fullChunk);
  }

  return chunks;
}

/**
 * Extracts frontmatter and body from a markdown file.
 */
function parseFile(filePath: string): { frontmatter: DocumentFrontmatter; body: string } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  try {
    const frontmatter = (YAML.parse(match[1]) || {}) as DocumentFrontmatter;
    return { frontmatter, body: match[2] };
  } catch {
    return { frontmatter: {}, body: match[2] };
  }
}

// ------------------------------------------------------------------------------------------------
// Collection Chunkers
// ------------------------------------------------------------------------------------------------

/**
 * 1. Posts Chunker
 */
export function chunkPosts(contentDir: string, globalPubs: Map<string, CitationReference>): SearchChunk[] {
  const chunks: SearchChunk[] = [];
  const postsBase = path.resolve(contentDir, 'posts');
  if (!fs.existsSync(postsBase)) return chunks;

  const entries = fs.readdirSync(postsBase, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const postSlug = entry.name;
    const postDir = path.join(postsBase, postSlug);
    const indexFile = ['index.md', 'index.mdx'].map(f => path.join(postDir, f)).find(f => fs.existsSync(f));
    if (!indexFile) continue;

    const { frontmatter, body } = parseFile(indexFile);
    const title = String(frontmatter.title || postSlug);
    const description = typeof frontmatter.description === 'string' ? frontmatter.description : '';
    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [];
    const date = frontmatter.pubDate ? new Date(String(frontmatter.pubDate)).toISOString().split('T')[0] : undefined;
    const lang = typeof frontmatter.lang === 'string' ? frontmatter.lang : 'de';

    const localRefs = extractReferencesFromFrontmatter(frontmatter);
    const citationsList = Array.from(localRefs.values());

    // Resolve citations
    const resolvedDesc = resolveInTextCitations(description, localRefs, globalPubs);
    const resolvedBody = resolveInTextCitations(body, localRefs, globalPubs);
    const cleanBody = cleanMarkdownMdx(resolvedBody);

    const relSourceFile = path.relative(process.cwd(), indexFile).replace(/\\/g, '/');
    const postUrl = `/posts/${postSlug}/`;

    // Split body into sections by markdown headings
    const sectionSplits = cleanBody.split(/(?=^#{1,3}\s+)/m);
    let chunkIndex = 0;

    // Intro chunk: Title + Description + initial section
    const introContext = `[Post] ${title}`;
    const introText = resolvedDesc ? `${resolvedDesc}\n\n${sectionSplits[0] || ''}` : (sectionSplits[0] || '');
    const introChunks = chunkTextContent(introText, introContext);

    for (const text of introChunks) {
      chunkIndex++;
      chunks.push({
        id: `posts/${postSlug}#chunk-${chunkIndex}`,
        sourceId: `posts/${postSlug}`,
        collection: 'posts',
        title,
        heading: 'Introduction',
        url: postUrl,
        text,
        tokenCount: estimateTokenCount(text),
        metadata: {
          collection: 'posts',
          sourceId: `posts/${postSlug}`,
          sourceFile: relSourceFile,
          title,
          url: postUrl,
          heading: 'Introduction',
          tags,
          lang,
          date,
          citations: citationsList.length > 0 ? citationsList : undefined,
        },
      });
    }

    // Process remaining heading sections
    for (let sIdx = 1; sIdx < sectionSplits.length; sIdx++) {
      const sec = sectionSplits[sIdx].trim();
      if (!sec) continue;

      const headingMatch = sec.match(/^#{1,3}\s+(.+)$/m);
      const heading = headingMatch ? headingMatch[1].trim() : `Section ${sIdx}`;
      const secContent = sec.replace(/^#{1,3}\s+.+$/m, '').trim();

      const secContext = `[Post] ${title} | ${heading}`;
      const secChunks = chunkTextContent(secContent, secContext);

      for (const text of secChunks) {
        chunkIndex++;
        chunks.push({
          id: `posts/${postSlug}#chunk-${chunkIndex}`,
          sourceId: `posts/${postSlug}`,
          collection: 'posts',
          title,
          heading,
          url: postUrl,
          text,
          tokenCount: estimateTokenCount(text),
          metadata: {
            collection: 'posts',
            sourceId: `posts/${postSlug}`,
            sourceFile: relSourceFile,
            title,
            url: postUrl,
            heading,
            tags,
            lang,
            date,
            citations: citationsList.length > 0 ? citationsList : undefined,
          },
        });
      }
    }
  }

  return chunks;
}

/**
 * 2. Presentations & Slides Chunker (including voiceovers)
 */
export function chunkPresentations(contentDir: string, globalPubs: Map<string, CitationReference>): SearchChunk[] {
  const chunks: SearchChunk[] = [];
  const presBase = path.resolve(contentDir, 'presentations');
  if (!fs.existsSync(presBase)) return chunks;

  const deckEntries = fs.readdirSync(presBase, { withFileTypes: true });
  for (const deckEntry of deckEntries) {
    if (!deckEntry.isDirectory()) continue;
    const deckSlug = deckEntry.name;
    const deckDir = path.join(presBase, deckSlug);

    // 1. Deck overview from index.{md,mdx}
    const deckIndexFile = ['index.md', 'index.mdx'].map(f => path.join(deckDir, f)).find(f => fs.existsSync(f));
    let deckTitle = deckSlug;
    let deckSubtitle = '';
    let deckTags: string[] = [];
    let deckDate: string | undefined;

    if (deckIndexFile) {
      const { frontmatter, body } = parseFile(deckIndexFile);
      deckTitle = String(frontmatter.title || deckSlug);
      deckSubtitle = typeof frontmatter.subtitle === 'string' ? frontmatter.subtitle : '';
      deckTags = Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [];
      deckDate = frontmatter.pubDate ? new Date(String(frontmatter.pubDate)).toISOString().split('T')[0] : undefined;
      const desc = typeof frontmatter.description === 'string' ? frontmatter.description : '';
      const cleanDeckBody = cleanMarkdownMdx(body);

      const deckOverviewText = `[Presentation Keynote] ${deckTitle}${deckSubtitle ? ' - ' + deckSubtitle : ''}\n\nDescription: ${desc}\n\n${cleanDeckBody}`.trim();
      const relDeckFile = path.relative(process.cwd(), deckIndexFile).replace(/\\/g, '/');
      const deckUrl = `/presentations/${deckSlug}/`;

      chunks.push({
        id: `presentations/${deckSlug}#overview`,
        sourceId: `presentations/${deckSlug}`,
        collection: 'presentations',
        title: deckTitle,
        heading: deckSubtitle || 'Presentation Overview',
        url: deckUrl,
        text: deckOverviewText,
        tokenCount: estimateTokenCount(deckOverviewText),
        metadata: {
          collection: 'presentations',
          sourceId: `presentations/${deckSlug}`,
          sourceFile: relDeckFile,
          title: deckTitle,
          url: deckUrl,
          heading: deckSubtitle || 'Presentation Overview',
          tags: deckTags,
          date: deckDate,
        },
      });
    }

    // 2. Individual Slides (including voiceover narrative)
    const slidesDir = path.join(deckDir, 'slides');
    if (!fs.existsSync(slidesDir)) continue;

    const slideFiles = fs.readdirSync(slidesDir).filter(f => f.endsWith('.md') || f.endsWith('.mdx')).sort();
    for (const slideFile of slideFiles) {
      const slidePath = path.join(slidesDir, slideFile);
      const slideId = slideFile.replace(/\.(md|mdx)$/, '');
      const { frontmatter, body } = parseFile(slidePath);

      const slideTitle = String(frontmatter.title || slideId);
      const slideSubtitle = typeof frontmatter.subtitle === 'string' ? stripCues(frontmatter.subtitle) : '';
      const slideNumber = typeof frontmatter.number === 'string' ? frontmatter.number : slideId.split('_')[0];
      const rawVoiceover = typeof frontmatter.voiceover === 'string' ? frontmatter.voiceover : '';
      const cleanVoiceover = stripCues(rawVoiceover);

      const localRefs = extractReferencesFromFrontmatter(frontmatter);
      const citationsList = Array.from(localRefs.values());

      // Resolve in-text citations in voiceover and slide body
      const resolvedVoiceover = resolveInTextCitations(cleanVoiceover, localRefs, globalPubs);
      const resolvedBody = resolveInTextCitations(body, localRefs, globalPubs);
      const cleanBody = cleanMarkdownMdx(resolvedBody);

      const slideUrl = `/presentations/${deckSlug}/#/${slideNumber || slideId}`;
      const relSlideFile = path.relative(process.cwd(), slidePath).replace(/\\/g, '/');

      // Construct rich contextual presentation chunk incorporating spoken voiceover and visual content
      const slideContext = `[Presentation] ${deckTitle} | Slide ${slideNumber}: ${slideTitle}${slideSubtitle ? ' - ' + slideSubtitle : ''}`;
      const contentParts: string[] = [];
      if (resolvedVoiceover) {
        contentParts.push(`Spoken Narrative (Voiceover):\n${resolvedVoiceover}`);
      }
      if (cleanBody) {
        contentParts.push(`Slide Visual Content:\n${cleanBody}`);
      }
      const fullSlideText = `${slideContext}\n\n${contentParts.join('\n\n')}`.trim();

      const slideChunks = chunkTextContent(fullSlideText, '', 420);
      let sChunkIdx = 0;

      for (const chunkText of slideChunks) {
        sChunkIdx++;
        const chunkId = slideChunks.length > 1
          ? `presentations/${deckSlug}/${slideId}#chunk-${sChunkIdx}`
          : `presentations/${deckSlug}/${slideId}`;

        chunks.push({
          id: chunkId,
          sourceId: `presentations/${deckSlug}/${slideId}`,
          collection: 'presentations',
          title: `${deckTitle} - Slide ${slideNumber}: ${slideTitle}`,
          heading: slideSubtitle || slideTitle,
          url: slideUrl,
          text: chunkText,
          tokenCount: estimateTokenCount(chunkText),
          metadata: {
            collection: 'presentations',
            sourceId: `presentations/${deckSlug}/${slideId}`,
            sourceFile: relSlideFile,
            title: `${deckTitle} - Slide ${slideNumber}: ${slideTitle}`,
            url: slideUrl,
            slideNumber,
            voiceover: cleanVoiceover || undefined,
            tags: deckTags,
            date: deckDate,
            citations: citationsList.length > 0 ? citationsList : undefined,
          },
        });
      }
    }
  }

  return chunks;
}

/**
 * 3. Publications Chunker
 */
export function chunkPublications(contentDir: string): SearchChunk[] {
  const chunks: SearchChunk[] = [];
  const pubBase = path.resolve(contentDir, 'publications');
  if (!fs.existsSync(pubBase)) return chunks;

  const entries = fs.readdirSync(pubBase, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pubSlug = entry.name;
    const pubDir = path.join(pubBase, pubSlug);
    const indexFile = ['index.md', 'index.mdx'].map(f => path.join(pubDir, f)).find(f => fs.existsSync(f));
    if (!indexFile) continue;

    const { frontmatter, body } = parseFile(indexFile);
    const title = String(frontmatter.title || pubSlug);
    const author = String(frontmatter.author || 'Dr. Georg Hackenberg');
    const book = typeof frontmatter.book === 'string' ? frontmatter.book : '';
    const pubDate = String(frontmatter.pubDate || '');
    const abstract = typeof frontmatter.abstract === 'string' ? frontmatter.abstract : '';
    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [];
    const cleanBody = cleanMarkdownMdx(body);

    const relSourceFile = path.relative(process.cwd(), indexFile).replace(/\\/g, '/');
    const pubUrl = `/publications/${pubSlug}/`;

    const pubText = [
      `[Academic Publication] ${title}`,
      `Authors: ${author}`,
      book ? `Venue: ${book}` : '',
      pubDate ? `Date: ${pubDate}` : '',
      abstract ? `Abstract: ${abstract}` : '',
      cleanBody ? `Details: ${cleanBody}` : '',
    ].filter(Boolean).join('\n\n');

    const pubChunks = chunkTextContent(pubText, `[Publication] ${title}`, 420);
    let pIdx = 0;

    for (const chunkText of pubChunks) {
      pIdx++;
      const id = pubChunks.length > 1 ? `publications/${pubSlug}#chunk-${pIdx}` : `publications/${pubSlug}`;
      chunks.push({
        id,
        sourceId: `publications/${pubSlug}`,
        collection: 'publications',
        title,
        heading: book || 'Academic Paper',
        url: pubUrl,
        text: chunkText,
        tokenCount: estimateTokenCount(chunkText),
        metadata: {
          collection: 'publications',
          sourceId: `publications/${pubSlug}`,
          sourceFile: relSourceFile,
          title,
          author,
          url: pubUrl,
          tags,
          date: pubDate,
        },
      });
    }
  }

  return chunks;
}

/**
 * 4. Courses Chunker (courses & course modules)
 */
export function chunkCourses(contentDir: string): SearchChunk[] {
  const chunks: SearchChunk[] = [];
  const coursesBase = path.resolve(contentDir, 'courses');
  if (!fs.existsSync(coursesBase)) return chunks;

  const entries = fs.readdirSync(coursesBase, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const courseSlug = entry.name;
    const courseDir = path.join(coursesBase, courseSlug);

    // Course main
    const indexFile = ['index.md', 'index.mdx'].map(f => path.join(courseDir, f)).find(f => fs.existsSync(f));
    let courseTitle = courseSlug;
    let courseTags: string[] = [];

    if (indexFile) {
      const { frontmatter, body } = parseFile(indexFile);
      courseTitle = String(frontmatter.title || courseSlug);
      const desc = typeof frontmatter.description === 'string' ? frontmatter.description : '';
      const overview = typeof frontmatter.overview === 'string' ? frontmatter.overview : '';
      const targetAudience = typeof frontmatter.targetAudience === 'string' ? frontmatter.targetAudience : '';
      const learningGoals = Array.isArray(frontmatter.learningGoals) ? frontmatter.learningGoals.join('; ') : '';
      const prerequisites = Array.isArray(frontmatter.prerequisites) ? frontmatter.prerequisites.join('; ') : '';
      courseTags = Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [];
      const cleanBody = cleanMarkdownMdx(body);

      const relSourceFile = path.relative(process.cwd(), indexFile).replace(/\\/g, '/');
      const courseUrl = `/courses/${courseSlug}/`;

      const courseText = [
        `[University Course] ${courseTitle}`,
        desc ? `Overview: ${desc}` : '',
        overview ? `Context: ${overview}` : '',
        targetAudience ? `Target Audience: ${targetAudience}` : '',
        prerequisites ? `Prerequisites: ${prerequisites}` : '',
        learningGoals ? `Learning Goals: ${learningGoals}` : '',
        cleanBody ? `Course Content: ${cleanBody}` : '',
      ].filter(Boolean).join('\n\n');

      const courseChunks = chunkTextContent(courseText, `[Course] ${courseTitle}`);
      let cIdx = 0;
      for (const text of courseChunks) {
        cIdx++;
        chunks.push({
          id: `courses/${courseSlug}#chunk-${cIdx}`,
          sourceId: `courses/${courseSlug}`,
          collection: 'courses',
          title: courseTitle,
          heading: 'Course Overview & Curriculum',
          url: courseUrl,
          text,
          tokenCount: estimateTokenCount(text),
          metadata: {
            collection: 'courses',
            sourceId: `courses/${courseSlug}`,
            sourceFile: relSourceFile,
            title: courseTitle,
            url: courseUrl,
            tags: courseTags,
          },
        });
      }
    }

    // Course modules
    const modulesDir = path.join(courseDir, 'modules');
    if (fs.existsSync(modulesDir)) {
      const modEntries = fs.readdirSync(modulesDir, { withFileTypes: true });
      for (const modEntry of modEntries) {
        if (!modEntry.isDirectory()) continue;
        const modSlug = modEntry.name;
        const modFile = ['index.md', 'index.mdx'].map(f => path.join(modulesDir, modSlug, f)).find(f => fs.existsSync(f));
        if (!modFile) continue;

        const { frontmatter, body } = parseFile(modFile);
        const modTitle = String(frontmatter.title || modSlug);
        const modNumber = typeof frontmatter.moduleNumber === 'string' ? frontmatter.moduleNumber : '';
        const modDesc = typeof frontmatter.description === 'string' ? frontmatter.description : '';
        const topics = Array.isArray(frontmatter.topics) ? frontmatter.topics.join(', ') : '';
        const tools = Array.isArray(frontmatter.tools) ? frontmatter.tools.join(', ') : '';
        const cleanBody = cleanMarkdownMdx(body);

        const relSourceFile = path.relative(process.cwd(), modFile).replace(/\\/g, '/');
        const modUrl = `/courses/${courseSlug}/${modSlug}/`;

        const modText = [
          `[Course Module] ${courseTitle} | Module ${modNumber}: ${modTitle}`,
          modDesc ? `Description: ${modDesc}` : '',
          topics ? `Topics: ${topics}` : '',
          tools ? `Tools: ${tools}` : '',
          cleanBody ? `Content: ${cleanBody}` : '',
        ].filter(Boolean).join('\n\n');

        chunks.push({
          id: `courses/${courseSlug}/modules/${modSlug}`,
          sourceId: `courses/${courseSlug}/modules/${modSlug}`,
          collection: 'courses',
          title: `${courseTitle} - Module ${modNumber}: ${modTitle}`,
          heading: modTitle,
          url: modUrl,
          text: modText,
          tokenCount: estimateTokenCount(modText),
          metadata: {
            collection: 'courses',
            sourceId: `courses/${courseSlug}/modules/${modSlug}`,
            sourceFile: relSourceFile,
            title: `${courseTitle} - Module ${modNumber}: ${modTitle}`,
            url: modUrl,
            tags: courseTags,
          },
        });
      }
    }
  }

  return chunks;
}

/**
 * 5. Projects Chunker
 */
export function chunkProjects(contentDir: string): SearchChunk[] {
  const chunks: SearchChunk[] = [];
  const projBase = path.resolve(contentDir, 'projects');
  if (!fs.existsSync(projBase)) return chunks;

  const entries = fs.readdirSync(projBase, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const projSlug = entry.name;
    const projDir = path.join(projBase, projSlug);
    const indexFile = ['index.md', 'index.mdx'].map(f => path.join(projDir, f)).find(f => fs.existsSync(f));
    if (!indexFile) continue;

    const { frontmatter, body } = parseFile(indexFile);
    const title = String(frontmatter.title || projSlug);
    const trl = frontmatter.trl ? `TRL ${frontmatter.trl}` : '';
    const desc = typeof frontmatter.description === 'string' ? frontmatter.description : '';
    const challenge = typeof frontmatter.challenge === 'string' ? frontmatter.challenge : '';
    const solution = typeof frontmatter.solution === 'string' ? frontmatter.solution : '';
    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [];
    const cleanBody = cleanMarkdownMdx(body);

    const relSourceFile = path.relative(process.cwd(), indexFile).replace(/\\/g, '/');
    const projUrl = `/projects/${projSlug}/`;

    // Part 1: Architecture & Overview
    const overviewText = [
      `[Software Project] ${title} ${trl ? `(${trl})` : ''}`,
      desc ? `Description: ${desc}` : '',
      challenge ? `Engineering Challenge: ${challenge}` : '',
      solution ? `Architectural Solution: ${solution}` : '',
    ].filter(Boolean).join('\n\n');

    chunks.push({
      id: `projects/${projSlug}#overview`,
      sourceId: `projects/${projSlug}`,
      collection: 'projects',
      title,
      heading: 'Architecture & Overview',
      url: projUrl,
      text: overviewText,
      tokenCount: estimateTokenCount(overviewText),
      metadata: {
        collection: 'projects',
        sourceId: `projects/${projSlug}`,
        sourceFile: relSourceFile,
        title,
        url: projUrl,
        tags,
      },
    });

    // Part 2: Implementation & Outcomes (if body exists)
    if (cleanBody) {
      const detailsChunks = chunkTextContent(cleanBody, `[Project] ${title} | Implementation Details`);
      let dIdx = 0;
      for (const text of detailsChunks) {
        dIdx++;
        chunks.push({
          id: `projects/${projSlug}#details-${dIdx}`,
          sourceId: `projects/${projSlug}`,
          collection: 'projects',
          title,
          heading: 'Technical Implementation',
          url: projUrl,
          text,
          tokenCount: estimateTokenCount(text),
          metadata: {
            collection: 'projects',
            sourceId: `projects/${projSlug}`,
            sourceFile: relSourceFile,
            title,
            url: projUrl,
            tags,
          },
        });
      }
    }
  }

  return chunks;
}

/**
 * 6. Services Chunker (services & service modules)
 */
export function chunkServices(contentDir: string): SearchChunk[] {
  const chunks: SearchChunk[] = [];
  const servBase = path.resolve(contentDir, 'services');
  if (!fs.existsSync(servBase)) return chunks;

  const entries = fs.readdirSync(servBase, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const servSlug = entry.name;
    const servDir = path.join(servBase, servSlug);

    // Main service
    const indexFile = ['index.md', 'index.mdx'].map(f => path.join(servDir, f)).find(f => fs.existsSync(f));
    let serviceTitle = servSlug;
    let serviceTags: string[] = [];

    if (indexFile) {
      const { frontmatter, body } = parseFile(indexFile);
      serviceTitle = String(frontmatter.title || servSlug);
      const desc = typeof frontmatter.description === 'string' ? frontmatter.description : '';
      serviceTags = Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [];
      const cleanBody = cleanMarkdownMdx(body);

      const relSourceFile = path.relative(process.cwd(), indexFile).replace(/\\/g, '/');
      const servUrl = `/services/${servSlug}/`;

      const servText = [
        `[Professional Service] ${serviceTitle}`,
        desc ? `Description: ${desc}` : '',
        cleanBody ? `Deliverables & Methodology: ${cleanBody}` : '',
      ].filter(Boolean).join('\n\n');

      chunks.push({
        id: `services/${servSlug}#overview`,
        sourceId: `services/${servSlug}`,
        collection: 'services',
        title: serviceTitle,
        heading: 'Service Offering',
        url: servUrl,
        text: servText,
        tokenCount: estimateTokenCount(servText),
        metadata: {
          collection: 'services',
          sourceId: `services/${servSlug}`,
          sourceFile: relSourceFile,
          title: serviceTitle,
          url: servUrl,
          tags: serviceTags,
        },
      });
    }

    // Service modules
    const modulesDir = path.join(servDir, 'modules');
    if (fs.existsSync(modulesDir)) {
      const modEntries = fs.readdirSync(modulesDir, { withFileTypes: true });
      for (const modEntry of modEntries) {
        if (!modEntry.isDirectory()) continue;
        const modSlug = modEntry.name;
        const modFile = ['index.md', 'index.mdx'].map(f => path.join(modulesDir, modSlug, f)).find(f => fs.existsSync(f));
        if (!modFile) continue;

        const { frontmatter, body } = parseFile(modFile);
        const modTitle = String(frontmatter.title || modSlug);
        const modDesc = typeof frontmatter.description === 'string' ? frontmatter.description : '';
        const methodology = typeof frontmatter.methodologyDescription === 'string' ? frontmatter.methodologyDescription : '';
        const cleanBody = cleanMarkdownMdx(body);

        const relSourceFile = path.relative(process.cwd(), modFile).replace(/\\/g, '/');
        const modUrl = `/services/${servSlug}/${modSlug}/`;

        const modText = [
          `[Service Module] ${serviceTitle} | Module: ${modTitle}`,
          modDesc ? `Description: ${modDesc}` : '',
          methodology ? `Methodology: ${methodology}` : '',
          cleanBody ? `Details: ${cleanBody}` : '',
        ].filter(Boolean).join('\n\n');

        chunks.push({
          id: `services/${servSlug}/modules/${modSlug}`,
          sourceId: `services/${servSlug}/modules/${modSlug}`,
          collection: 'services',
          title: `${serviceTitle} - ${modTitle}`,
          heading: modTitle,
          url: modUrl,
          text: modText,
          tokenCount: estimateTokenCount(modText),
          metadata: {
            collection: 'services',
            sourceId: `services/${servSlug}/modules/${modSlug}`,
            sourceFile: relSourceFile,
            title: `${serviceTitle} - ${modTitle}`,
            url: modUrl,
            tags: serviceTags,
          },
        });
      }
    }
  }

  return chunks;
}

/**
 * 7. Visualizations Chunker
 */
export function chunkVisualizations(contentDir: string): SearchChunk[] {
  const chunks: SearchChunk[] = [];
  const vizBase = path.resolve(contentDir, 'visualizations');
  if (!fs.existsSync(vizBase)) return chunks;

  const entries = fs.readdirSync(vizBase, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const vizSlug = entry.name;
    const vizDir = path.join(vizBase, vizSlug);
    const indexFile = ['index.md', 'index.mdx'].map(f => path.join(vizDir, f)).find(f => fs.existsSync(f));
    if (!indexFile) continue;

    const { frontmatter, body } = parseFile(indexFile);
    const title = String(frontmatter.title || vizSlug);
    const desc = typeof frontmatter.description === 'string' ? frontmatter.description : '';
    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [];
    const specs = (typeof frontmatter.specs === 'object' && frontmatter.specs !== null ? frontmatter.specs : {}) as Record<string, string>;
    const cleanBody = cleanMarkdownMdx(body);

    const relSourceFile = path.relative(process.cwd(), indexFile).replace(/\\/g, '/');
    const vizUrl = `/visualizations/${vizSlug}/`;

    // Overview & Engine specs
    const specsText = Object.entries(specs)
      .map(([k, v]) => `• ${k}: ${v}`)
      .join('\n');

    const overviewText = [
      `[Interactive Visualization Engine] ${title}`,
      desc ? `Description: ${desc}` : '',
      specsText ? `Engine Specifications:\n${specsText}` : '',
    ].filter(Boolean).join('\n\n');

    chunks.push({
      id: `visualizations/${vizSlug}#specs`,
      sourceId: `visualizations/${vizSlug}`,
      collection: 'visualizations',
      title,
      heading: 'Architecture & Engine Specs',
      url: vizUrl,
      text: overviewText,
      tokenCount: estimateTokenCount(overviewText),
      metadata: {
        collection: 'visualizations',
        sourceId: `visualizations/${vizSlug}`,
        sourceFile: relSourceFile,
        title,
        url: vizUrl,
        tags,
      },
    });

    if (cleanBody) {
      const docChunks = chunkTextContent(cleanBody, `[Visualization] ${title} | Technical Documentation`);
      let vIdx = 0;
      for (const text of docChunks) {
        vIdx++;
        chunks.push({
          id: `visualizations/${vizSlug}#doc-${vIdx}`,
          sourceId: `visualizations/${vizSlug}`,
          collection: 'visualizations',
          title,
          heading: 'Technical Documentation',
          url: vizUrl,
          text,
          tokenCount: estimateTokenCount(text),
          metadata: {
            collection: 'visualizations',
            sourceId: `visualizations/${vizSlug}`,
            sourceFile: relSourceFile,
            title,
            url: vizUrl,
            tags,
          },
        });
      }
    }
  }

  return chunks;
}

/**
 * Parses markdown/MDX across all collections in src/content/ into contextual chunks.
 */
export function chunkAllCollections(contentDir = 'src/content'): SearchChunk[] {
  const globalPubs = loadGlobalPublications(contentDir);

  const postsChunks = chunkPosts(contentDir, globalPubs);
  const presChunks = chunkPresentations(contentDir, globalPubs);
  const pubChunks = chunkPublications(contentDir);
  const courseChunks = chunkCourses(contentDir);
  const projChunks = chunkProjects(contentDir);
  const servChunks = chunkServices(contentDir);
  const vizChunks = chunkVisualizations(contentDir);

  return [
    ...postsChunks,
    ...presChunks,
    ...pubChunks,
    ...courseChunks,
    ...projChunks,
    ...servChunks,
    ...vizChunks,
  ];
}
