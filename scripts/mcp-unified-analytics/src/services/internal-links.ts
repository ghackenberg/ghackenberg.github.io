import fs from 'node:fs';
import path from 'node:path';
import { getConfig } from '../config.js';
import { normalizePath } from './normalizer.js';
import type { InternalLinkAudit, InternalLinkItem } from '../types.js';

interface PageMeta {
  relPath: string;
  absPath: string;
  urlPath: string;
  title: string;
  tags: string[];
  content: string;
  body: string;
}

function findMarkdownFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findMarkdownFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
      results.push(fullPath);
    }
  }
  return results;
}

function parseFrontmatter(content: string): { title: string; tags: string[]; body: string } {
  let title = '';
  let tags: string[] = [];
  let body = content;

  if (content.startsWith('---')) {
    const end = content.indexOf('---', 3);
    if (end !== -1) {
      const header = content.slice(3, end);
      body = content.slice(end + 3);

      const titleMatch = header.match(/^title:\s*(?:["']?)(.*?)(?:["']?)$/m);
      if (titleMatch) title = titleMatch[1].trim();

      const tagsMatch = header.match(/^tags:\s*\[(.*?)\]/m);
      if (tagsMatch) {
        tags = tagsMatch[1]
          .split(',')
          .map((t) => t.trim().replace(/["']/g, ''))
          .filter(Boolean);
      } else {
        const tagLines = header.match(/^tags:\s*\n((\s+-\s+.*?\n)+)/m);
        if (tagLines) {
          tags = tagLines[1]
            .split('\n')
            .map((l) => l.replace(/^\s+-\s+/, '').trim().replace(/["']/g, ''))
            .filter(Boolean);
        }
      }
    }
  }

  return { title, tags, body };
}

function fileToUrlPath(relPath: string): string {
  const norm = relPath.replace(/\\/g, '/');
  const m = norm.match(/^src\/content\/(posts|visualizations|courses)\/(.*?)(?:\/index)?\.(?:md|mdx)$/);
  if (m) {
    const section = m[1];
    const slug = m[2];
    return `/${section}/${slug}/`;
  }
  return `/${norm}/`;
}

function extractMarkdownLinks(body: string, sourceUrlPath: string): InternalLinkItem[] {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links: InternalLinkItem[] = [];
  let match;

  while ((match = linkRegex.exec(body)) !== null) {
    const anchorText = match[1].trim();
    let target = match[2].trim();

    if (
      target.startsWith('#') ||
      target.startsWith('http://') ||
      target.startsWith('https://') ||
      target.startsWith('mailto:') ||
      target.startsWith('file://')
    ) {
      continue;
    }

    if (/\.(png|jpe?g|svg|webp|gif|pdf|zip)$/i.test(target)) {
      continue;
    }

    const cleanTarget = target.split('?')[0].split('#')[0];
    const isRelative = !cleanTarget.startsWith('/');

    let resolvedTarget = cleanTarget;
    if (isRelative) {
      resolvedTarget = path.posix.join(sourceUrlPath, cleanTarget);
    }
    resolvedTarget = normalizePath(resolvedTarget);

    links.push({
      sourcePath: sourceUrlPath,
      targetPath: resolvedTarget,
      anchorText,
      isRelative,
    });
  }

  return links;
}

export function auditInternalLinking(options?: {
  targetPath?: string;
  minIncomingLinks?: number;
}): InternalLinkAudit {
  const config = getConfig();
  const root = config.projectRoot;
  const minIncoming = options?.minIncomingLinks ?? 1;
  const targetFilter = options?.targetPath ? normalizePath(options.targetPath) : undefined;

  const contentDirs = [
    path.join(root, 'src', 'content', 'posts'),
    path.join(root, 'src', 'content', 'visualizations'),
    path.join(root, 'src', 'content', 'courses'),
  ];

  const allFiles: string[] = [];
  for (const d of contentDirs) {
    allFiles.push(...findMarkdownFiles(d));
  }

  const pages: PageMeta[] = [];
  const incomingLinksMap = new Map<string, number>();

  for (const absFile of allFiles) {
    const rel = path.relative(root, absFile).replace(/\\/g, '/');
    const content = fs.readFileSync(absFile, 'utf-8');
    const { title, tags, body } = parseFrontmatter(content);
    const urlPath = normalizePath(fileToUrlPath(rel));

    pages.push({
      relPath: rel,
      absPath: absFile,
      urlPath,
      title,
      tags,
      content,
      body,
    });

    incomingLinksMap.set(urlPath, 0);
  }

  const allInternalLinks: InternalLinkItem[] = [];

  for (const page of pages) {
    const links = extractMarkdownLinks(page.body, page.urlPath);
    for (const link of links) {
      allInternalLinks.push(link);
      const current = incomingLinksMap.get(link.targetPath) ?? 0;
      incomingLinksMap.set(link.targetPath, current + 1);
    }
  }

  const orphanPages: Array<{
    path: string;
    sourceFile: string;
    incomingLinksCount: number;
  }> = [];

  for (const page of pages) {
    const incoming = incomingLinksMap.get(page.urlPath) ?? 0;
    if (incoming <= minIncoming) {
      orphanPages.push({
        path: page.urlPath,
        sourceFile: page.relPath,
        incomingLinksCount: incoming,
      });
    }
  }

  const linkingOpportunities: Array<{
    targetPath: string;
    donorPath: string;
    donorFile: string;
    matchedKeywords: string[];
    snippetContext: string;
  }> = [];

  if (targetFilter) {
    const targetPage = pages.find(
      (p) => p.urlPath === targetFilter || p.relPath === targetFilter
    );

    if (targetPage) {
      const keywords = new Set<string>();
      for (const t of targetPage.tags) {
        if (t.length > 2) keywords.add(t.toLowerCase());
      }
      for (const word of targetPage.title.split(/[\s\-:,]+/)) {
        if (word.length > 4 && !/^(about|using|their|there|which|these|those|first)$/i.test(word)) {
          keywords.add(word.toLowerCase());
        }
      }

      for (const donor of pages) {
        if (donor.urlPath === targetPage.urlPath) continue;

        const alreadyLinks = allInternalLinks.some(
          (l) => l.sourcePath === donor.urlPath && l.targetPath === targetPage.urlPath
        );
        if (alreadyLinks) continue;

        const matched: string[] = [];
        let snippetContext = '';

        for (const kw of keywords) {
          const kwRegex = new RegExp(`\\b(${kw})\\b`, 'i');
          const m = donor.body.match(kwRegex);
          if (m && m.index !== undefined) {
            matched.push(kw);
            if (!snippetContext) {
              const start = Math.max(0, m.index - 50);
              const end = Math.min(donor.body.length, m.index + 70);
              snippetContext = donor.body.slice(start, end).replace(/\s+/g, ' ').trim();
            }
          }
        }

        if (matched.length >= 1) {
          linkingOpportunities.push({
            targetPath: targetPage.urlPath,
            donorPath: donor.urlPath,
            donorFile: donor.relPath,
            matchedKeywords: matched,
            snippetContext: snippetContext ? `"...${snippetContext}..."` : '',
          });
        }
      }
    }
  }

  return {
    totalInternalLinks: allInternalLinks.length,
    totalUniquePages: pages.length,
    orphanPages: orphanPages.sort((a, b) => a.incomingLinksCount - b.incomingLinksCount),
    linkingOpportunities: linkingOpportunities.slice(0, 10),
  };
}
