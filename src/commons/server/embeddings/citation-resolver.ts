import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { CitationReference } from './types.ts';

/**
 * Formats a citation reference into the canonical string: "Author (Year): Title".
 * If year is not available, formats as "Author: Title".
 */
export function formatCitation(ref: CitationReference): string {
  const author = ref.author?.trim() || 'Unknown Author';
  const title = ref.title?.trim() || 'Untitled';
  const yearStr = ref.year ? ` (${ref.year})` : '';
  return `${author}${yearStr}: ${title}`;
}

export type FrontmatterValue =
  | string
  | number
  | boolean
  | string[]
  | Array<Record<string, string | number | boolean | undefined>>
  | Record<string, string | number | boolean | undefined>
  | undefined;

/**
 * Extracts and maps structured references from a document's frontmatter references array.
 */
export function extractReferencesFromFrontmatter(
  frontmatter: Record<string, FrontmatterValue>
): Map<string, CitationReference> {
  const refsMap = new Map<string, CitationReference>();
  const rawRefs = frontmatter.references;
  if (!rawRefs || !Array.isArray(rawRefs)) {
    return refsMap;
  }

  for (const rawRef of rawRefs) {
    if (typeof rawRef === 'object' && rawRef !== null && 'id' in rawRef) {
      const id = String(rawRef.id);
      const refObj: CitationReference = {
        id,
        author: typeof rawRef.author === 'string' ? rawRef.author : 'Unknown Author',
        year: typeof rawRef.year === 'number' || typeof rawRef.year === 'string' ? rawRef.year : undefined,
        title: typeof rawRef.title === 'string' ? rawRef.title : 'Untitled',
        url: typeof rawRef.url === 'string' ? rawRef.url : undefined,
        doi: typeof rawRef.doi === 'string' ? rawRef.doi : undefined,
        booktitle: typeof rawRef.booktitle === 'string' ? rawRef.booktitle : undefined,
        journal: typeof rawRef.journal === 'string' ? rawRef.journal : undefined,
        publisher: typeof rawRef.publisher === 'string' ? rawRef.publisher : undefined,
      };
      refObj.formatted = formatCitation(refObj);
      refsMap.set(id, refObj);
    }
  }

  return refsMap;
}

/**
 * Scans the publications collection to provide a global catalog of cited works.
 */
export function loadGlobalPublications(contentDir: string): Map<string, CitationReference> {
  const pubMap = new Map<string, CitationReference>();
  const pubDir = path.resolve(contentDir, 'publications');
  if (!fs.existsSync(pubDir)) {
    return pubMap;
  }

  const entries = fs.readdirSync(pubDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pubFolder = path.join(pubDir, entry.name);
    const indexFiles = ['index.md', 'index.mdx'];
    let content = '';

    for (const f of indexFiles) {
      const p = path.join(pubFolder, f);
      if (fs.existsSync(p)) {
        content = fs.readFileSync(p, 'utf-8');
        break;
      }
    }

    if (!content) continue;
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) continue;

    try {
      const parsed = YAML.parse(fmMatch[1]) as Record<string, FrontmatterValue>;
      if (parsed && typeof parsed.title === 'string') {
        const yearMatch = typeof parsed.pubDate === 'string' ? parsed.pubDate.match(/\b(19\d\d|20\d\d)\b/) : null;
        const year = yearMatch ? yearMatch[1] : undefined;
        const refObj: CitationReference = {
          id: entry.name,
          author: typeof parsed.author === 'string' ? parsed.author : 'Dr. Georg Hackenberg',
          title: parsed.title,
          year,
          url: `/publications/${entry.name}/`,
          doi: typeof parsed.doi === 'string' ? parsed.doi : undefined,
          booktitle: typeof parsed.book === 'string' ? parsed.book : undefined,
        };
        refObj.formatted = formatCitation(refObj);
        pubMap.set(entry.name, refObj);
      }
    } catch {
      // Ignore parse errors in catalog loading
    }
  }

  return pubMap;
}

/**
 * Resolves all in-text [@id] markers in a text string to their canonical "Author (Year): Title" expansion.
 * First checks local references, then falls back to global publication catalog.
 */
export function resolveInTextCitations(
  text: string,
  localRefs?: Map<string, CitationReference>,
  globalRefs?: Map<string, CitationReference>
): string {
  if (!text) return '';

  return text.replace(/\[@([a-zA-Z0-9_\-]+)\]/g, (match, key) => {
    const local = localRefs?.get(key);
    if (local) {
      return local.formatted || formatCitation(local);
    }
    const global = globalRefs?.get(key);
    if (global) {
      return global.formatted || formatCitation(global);
    }
    return match;
  });
}
