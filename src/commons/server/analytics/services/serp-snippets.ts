import fs from 'node:fs';
import path from 'node:path';
import { getConfig } from '../config.js';
import { normalizePath } from './normalizer.js';
import { getGscPagePerformance } from '../clients/gsc.js';
import type { SerpSnippetAudit, SerpSnippetPageReport, SerpSnippetIssue } from '../types.js';

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

function parseFrontmatter(content: string): { title: string; description: string } {
  let title = '';
  let description = '';

  if (content.startsWith('---')) {
    const end = content.indexOf('---', 3);
    if (end !== -1) {
      const header = content.slice(3, end);

      const titleMatch = header.match(/^title:\s*(?:["']?)(.*?)(?:["']?)$/m);
      if (titleMatch) title = titleMatch[1].trim();

      const descMatch = header.match(/^description:\s*(?:["']?)(.*?)(?:["']?)$/m);
      if (descMatch) description = descMatch[1].trim();
    }
  }

  return { title, description };
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

export async function auditSerpSnippets(options?: {
  collection?: 'posts' | 'visualizations' | 'courses' | 'all';
  checkGscKeywords?: boolean;
}): Promise<SerpSnippetAudit> {
  const config = getConfig();
  const root = config.projectRoot;
  const collection = options?.collection || 'posts';
  const checkGsc = options?.checkGscKeywords ?? true;
  const hasGsc = Boolean(config.gsc.credentialsJson || config.gsc.keyFile);

  let targetDirs: string[] = [];
  if (collection === 'all') {
    targetDirs = [
      path.join(root, 'src', 'content', 'posts'),
      path.join(root, 'src', 'content', 'visualizations'),
      path.join(root, 'src', 'content', 'courses'),
    ];
  } else {
    targetDirs = [path.join(root, 'src', 'content', collection)];
  }

  const allFiles: string[] = [];
  for (const d of targetDirs) {
    allFiles.push(...findMarkdownFiles(d));
  }

  const pagesWithIssues: SerpSnippetPageReport[] = [];
  let totalIssues = 0;

  for (const absFile of allFiles) {
    const rel = path.relative(root, absFile).replace(/\\/g, '/');
    const content = fs.readFileSync(absFile, 'utf-8');
    const { title, description } = parseFrontmatter(content);
    const urlPath = normalizePath(fileToUrlPath(rel));

    const issues: SerpSnippetIssue[] = [];

    // Title validation (optimal: 30 - 60 chars)
    if (!title) {
      issues.push({
        field: 'title',
        issue: 'empty',
        message: 'Missing title tag in frontmatter.',
        currentLength: 0,
        recommendedRange: '30-60 characters',
      });
    } else if (title.length > 60) {
      issues.push({
        field: 'title',
        issue: 'too_long',
        message: `Title exceeds 60 characters (${title.length} chars) and will truncate on Google SERPs.`,
        currentLength: title.length,
        recommendedRange: '< 60 characters',
      });
    } else if (title.length < 30) {
      issues.push({
        field: 'title',
        issue: 'too_short',
        message: `Title is under 30 characters (${title.length} chars) - underutilized keyword potential.`,
        currentLength: title.length,
        recommendedRange: '30-60 characters',
      });
    }

    // Description validation (optimal: 120 - 160 chars)
    if (!description) {
      issues.push({
        field: 'description',
        issue: 'empty',
        message: 'Missing description meta tag in frontmatter.',
        currentLength: 0,
        recommendedRange: '140-160 characters',
      });
    } else if (description.length > 165) {
      issues.push({
        field: 'description',
        issue: 'too_long',
        message: `Description exceeds 165 characters (${description.length} chars) and will truncate on SERPs.`,
        currentLength: description.length,
        recommendedRange: '140-160 characters',
      });
    } else if (description.length < 110) {
      issues.push({
        field: 'description',
        issue: 'too_short',
        message: `Description is too short (${description.length} chars) to provide rich snippet context.`,
        currentLength: description.length,
        recommendedRange: '140-160 characters',
      });
    }

    // Optional query match via GSC if enabled
    let topGscQuery: string | undefined = undefined;
    let hasTopGscQueryInTitle: boolean | undefined = undefined;

    if (checkGsc && hasGsc && title) {
      try {
        const perf = await getGscPagePerformance(urlPath, 'last_28_days');
        if (perf.queries && perf.queries.length > 0) {
          topGscQuery = perf.queries[0].query;
          hasTopGscQueryInTitle = title.toLowerCase().includes(topGscQuery.toLowerCase());
          if (!hasTopGscQueryInTitle && perf.queries[0].impressions >= 10) {
            issues.push({
              field: 'title',
              issue: 'missing_focus_keyword',
              message: `Primary GSC query "${topGscQuery}" (${perf.queries[0].impressions} impressions) is not present in the title.`,
              currentLength: title.length,
              recommendedRange: `Include "${topGscQuery}" in title`,
            });
          }
        }
      } catch {
        // Continue gracefully if GSC query fails for this URL
      }
    }

    if (issues.length > 0) {
      totalIssues += issues.length;
      pagesWithIssues.push({
        path: urlPath,
        sourceFile: rel,
        title,
        description,
        titleLength: title.length,
        descriptionLength: description.length,
        issues,
        topGscQuery,
        hasTopGscQueryInTitle,
      });
    }
  }

  return {
    totalAudited: allFiles.length,
    issuesCount: totalIssues,
    pagesWithIssues,
  };
}
