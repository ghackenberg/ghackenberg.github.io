import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { getConfig } from '../config.js';
import { normalizePath } from './normalizer.js';
import type { AioEvaluationResult, AioScanSummary, AioDiffResult } from '../types.js';

/**
 * Finds local source content (Markdown or HTML) corresponding to a URL path or file path.
 */
export function resolveLocalContentFile(target: string): { filePath?: string; content?: string } {
  const config = getConfig();
  const root = config.projectRoot;

  // Case 1: Direct file path
  let candidate = path.isAbsolute(target) ? target : path.resolve(root, target);
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return { filePath: candidate, content: fs.readFileSync(candidate, 'utf-8') };
  }

  // Case 2: Normalized URL path (e.g. "/posts/sample-post/")
  const normPath = normalizePath(target);
  const pathSegments = normPath.split('/').filter(Boolean);

  // Check dist/ (compiled HTML) first if available
  const distCandidates = [
    path.join(root, 'dist', ...pathSegments, 'index.html'),
    path.join(root, 'dist', `${pathSegments.join('/')}.html`),
  ];
  for (const p of distCandidates) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return { filePath: p, content: fs.readFileSync(p, 'utf-8') };
    }
  }

  // Check src/content/ collections
  if (pathSegments.length >= 1) {
    const [collection, ...sub] = pathSegments;
    const slug = sub.join('/');
    const contentCandidates = [
      path.join(root, 'src', 'content', collection, slug, 'index.md'),
      path.join(root, 'src', 'content', collection, slug, 'index.mdx'),
      path.join(root, 'src', 'content', collection, `${slug}.md`),
      path.join(root, 'src', 'content', collection, `${slug}.mdx`),
      path.join(root, 'src', 'content', collection, `${slug}.json`),
    ];

    for (const p of contentCandidates) {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        return { filePath: p, content: fs.readFileSync(p, 'utf-8') };
      }
    }
  }

  // Check src/pages/
  const pageCandidates = [
    path.join(root, 'src', 'pages', ...pathSegments, 'index.astro'),
    path.join(root, 'src', 'pages', `${pathSegments.join('/')}.astro`),
    path.join(root, 'src', 'pages', ...pathSegments, 'index.md'),
  ];
  for (const p of pageCandidates) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return { filePath: p, content: fs.readFileSync(p, 'utf-8') };
    }
  }

  return {};
}

/**
 * Evaluates raw markdown or HTML content string for Generative Engine Optimization (GEO)
 * and AI Overviews (AIO) extractability.
 */
export function evaluateContentString(
  content: string,
  target: string,
  filePath?: string
): AioEvaluationResult {
  const config = getConfig();

  // Strip frontmatter if markdown
  let rawBody = content;
  if (content.startsWith('---')) {
    const end = content.indexOf('---', 3);
    if (end !== -1) {
      rawBody = content.slice(end + 3);
    }
  }

  const lines = rawBody.split('\n');

  // 1. Question-oriented headings (H2 / H3)
  const questionHeadingRegex = /^#{2,3}\s+(.*\?|(was|wie|warum|welche|wann|wo|how|what|why|which|when|where)\b.*)/i;
  const allHeadingsRegex = /^#{2,3}\s+(.+)$/;
  const questionHeadings: string[] = [];
  const headingsWithFirstParagraph: Array<{ heading: string; firstPara: string }> = [];

  let currentHeading: string | null = null;
  let currentPara: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(allHeadingsRegex);

    if (headingMatch) {
      if (currentHeading && currentPara.length > 0) {
        headingsWithFirstParagraph.push({
          heading: currentHeading,
          firstPara: currentPara.join(' ').trim(),
        });
      }
      currentHeading = headingMatch[1];
      currentPara = [];

      if (questionHeadingRegex.test(trimmed)) {
        questionHeadings.push(headingMatch[1]);
      }
    } else if (
      currentHeading &&
      trimmed.length > 0 &&
      !trimmed.startsWith('#') &&
      !trimmed.startsWith('|') &&
      !trimmed.startsWith('-') &&
      !trimmed.startsWith('*')
    ) {
      if (currentPara.length < 5) {
        currentPara.push(trimmed);
      }
    }
  }

  if (currentHeading && currentPara.length > 0) {
    headingsWithFirstParagraph.push({
      heading: currentHeading,
      firstPara: currentPara.join(' ').trim(),
    });
  }

  // 2. Direct Answer Snippet Analysis (30-65 words directly following a heading)
  const directAnswerExamples: string[] = [];
  let totalWordsInFirstParas = 0;

  for (const item of headingsWithFirstParagraph) {
    const words = item.firstPara.split(/\s+/).filter(Boolean).length;
    totalWordsInFirstParas += words;
    // Sweet spot for AI Overviews / Featured Snippets: 30-65 words
    if (words >= 30 && words <= 65) {
      directAnswerExamples.push(
        `Under "${item.heading}": "${item.firstPara.slice(0, 100)}..." (${words} words)`
      );
    }
  }

  const avgWords =
    headingsWithFirstParagraph.length > 0
      ? Math.round(totalWordsInFirstParas / headingsWithFirstParagraph.length)
      : 0;

  // 3. Tables count (Markdown or HTML)
  const markdownTableRows = lines.filter((l) => l.trim().startsWith('|') && l.trim().endsWith('|'));
  const htmlTables = (content.match(/<table[\s>]/gi) || []).length;
  const tableCount = htmlTables > 0 ? htmlTables : markdownTableRows.length >= 3 ? 1 : 0;

  // 4. Structured Lists count (ordered or unordered)
  const listItems = lines.filter((l) => /^(\s*[-*+]|\s*\d+\.)\s+/.test(l));
  const listCount = listItems.length;

  // 5. Schema / Structured Data detection
  const schemaRegex = /"@context":\s*"https?:\/\/schema\.org"/i;
  const hasSchema = schemaRegex.test(content) || /itemscope/i.test(content);
  const schemaTypes: string[] = [];
  const typeMatches = content.matchAll(/"@type":\s*"([^"]+)"/g);
  for (const m of typeMatches) {
    if (m[1]) schemaTypes.push(m[1]);
  }

  // Calculate Score (0-100)
  let score = 20; // Base score for published content

  // Question Headings: up to 15 pts
  if (questionHeadings.length >= 2) score += 15;
  else if (questionHeadings.length === 1) score += 8;

  // Direct Answer Snippets: up to 25 pts
  if (directAnswerExamples.length >= 2) score += 25;
  else if (directAnswerExamples.length === 1) score += 15;

  // Tables: up to 20 pts
  if (tableCount >= 1) score += 20;

  // Lists: up to 15 pts
  if (listCount >= 6) score += 15;
  else if (listCount >= 3) score += 8;

  // Schema.org: up to 15 pts
  if (hasSchema || schemaTypes.length > 0) score += 15;

  score = Math.min(100, score);

  // Formulate key findings and recommendations
  const keyFindings: string[] = [];
  const concreteRecommendations: string[] = [];

  if (questionHeadings.length > 0) {
    keyFindings.push(
      `Found ${questionHeadings.length} question-oriented heading(s) matching search intent.`
    );
  } else {
    concreteRecommendations.push(
      'Formulate at least 1-2 H2/H3 headings as direct queries (e.g. "Was ist...", "Wie funktioniert...", "Why use...") to trigger AI Overview query matching.'
    );
  }

  if (directAnswerExamples.length > 0) {
    keyFindings.push(
      `Identified ${directAnswerExamples.length} ideal direct answer snippet(s) (30-65 words).`
    );
  } else {
    concreteRecommendations.push(
      'Add a concise 40-55 word direct answer definition paragraph immediately following your primary H2 heading. Avoid conversational filler at the start.'
    );
  }

  if (tableCount > 0) {
    keyFindings.push(
      `Contains structured comparison table(s), highly favored by LLM crawlers for entity extraction.`
    );
  } else {
    concreteRecommendations.push(
      'Consider adding a structured comparison matrix or summary table. Generative engines disproportionately cite markdown tables for synthesized overviews.'
    );
  }

  if (listCount >= 5) {
    keyFindings.push(`Strong list structure with ${listCount} bullet/numbered items for step-by-step extraction.`);
  } else {
    concreteRecommendations.push(
      'Break down dense prose paragraphs into structured 3-5 item bullet lists or ordered steps.'
    );
  }

  if (hasSchema || schemaTypes.length > 0) {
    keyFindings.push(`Structured data detected (${schemaTypes.join(', ') || 'Schema.org'}).`);
  } else {
    concreteRecommendations.push('Ensure standard JSON-LD Schema (TechArticle, BlogPosting, or FAQPage) is injected.');
  }

  return {
    target,
    sourceFile: filePath ? path.relative(config.projectRoot, filePath) : undefined,
    score,
    breakdown: {
      directAnswerParagraphs: {
        count: directAnswerExamples.length,
        passed: directAnswerExamples.length >= 1,
        examples: directAnswerExamples,
      },
      tables: {
        count: tableCount,
        passed: tableCount >= 1,
      },
      structuredLists: {
        count: listCount,
        passed: listCount >= 4,
      },
      questionHeadings: {
        count: questionHeadings.length,
        passed: questionHeadings.length >= 1,
        headings: questionHeadings,
      },
      schemaStructuredData: {
        detected: hasSchema || schemaTypes.length > 0,
        types: schemaTypes,
      },
      conciseSummaryLength: {
        avgWordsPerFirstParagraph: avgWords,
        passed: avgWords >= 30 && avgWords <= 70,
      },
    },
    keyFindings,
    concreteRecommendations,
  };
}

/**
 * Evaluates markdown or HTML content for Generative Engine Optimization (GEO)
 * and AI Overviews (AIO) extractability.
 */
export function evaluateAioExtractability(target: string): AioEvaluationResult {
  const { filePath, content } = resolveLocalContentFile(target);

  if (!content) {
    return {
      target,
      score: 0,
      breakdown: {
        directAnswerParagraphs: { count: 0, passed: false, examples: [] },
        tables: { count: 0, passed: false },
        structuredLists: { count: 0, passed: false },
        questionHeadings: { count: 0, passed: false, headings: [] },
        schemaStructuredData: { detected: false, types: [] },
        conciseSummaryLength: { avgWordsPerFirstParagraph: 0, passed: false },
      },
      keyFindings: [`Could not find local source file for: ${target}`],
      concreteRecommendations: [
        'Ensure the URL path matches an existing markdown file in src/content/ or page in src/pages/, or provide the direct relative file path (e.g. src/content/posts/.../index.md).',
      ],
    };
  }

  return evaluateContentString(content, target, filePath);
}

/**
 * Recursively scans markdown content files in a directory.
 */
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

/**
 * Scans markdown content across collections and scores their AIO readiness.
 */
export function scanAllContentAio(options: {
  collection?: 'all' | 'posts' | 'visualizations' | 'courses';
  maxScore?: number;
  limit?: number;
}): AioScanSummary {
  const config = getConfig();
  const root = config.projectRoot;
  const collection = options.collection || 'all';
  const maxScore = options.maxScore ?? 100;
  const limit = options.limit ?? 25;

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
  for (const dir of targetDirs) {
    allFiles.push(...findMarkdownFiles(dir));
  }

  const rawResults: Array<{
    target: string;
    sourceFile: string;
    score: number;
    tables: number;
    questionHeadings: number;
    directAnswers: number;
    recommendations: string[];
  }> = [];

  let totalScore = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const file of allFiles) {
    const relPath = path.relative(root, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf-8');
    const evalResult = evaluateContentString(content, relPath, file);

    totalScore += evalResult.score;
    if (evalResult.score >= 90) highCount++;
    else if (evalResult.score >= 70) mediumCount++;
    else lowCount++;

    if (evalResult.score <= maxScore) {
      rawResults.push({
        target: relPath,
        sourceFile: relPath,
        score: evalResult.score,
        tables: evalResult.breakdown.tables.count,
        questionHeadings: evalResult.breakdown.questionHeadings.count,
        directAnswers: evalResult.breakdown.directAnswerParagraphs.count,
        recommendations: evalResult.concreteRecommendations,
      });
    }
  }

  // Sort ascending by score (weakest first)
  rawResults.sort((a, b) => a.score - b.score);

  return {
    totalScanned: allFiles.length,
    averageScore: allFiles.length > 0 ? Math.round(totalScore / allFiles.length) : 0,
    highReadinessCount: highCount,
    mediumReadinessCount: mediumCount,
    lowReadinessCount: lowCount,
    results: rawResults.slice(0, limit),
  };
}

/**
 * Compares current content of a target file with a Git revision (e.g. HEAD).
 */
export function diffAioAgainstGit(target: string, baseRef: string = 'HEAD'): AioDiffResult {
  const config = getConfig();
  const { filePath, content: currentContent } = resolveLocalContentFile(target);

  if (!filePath || !currentContent) {
    throw new Error(`Target file could not be resolved: ${target}`);
  }

  const relPath = path.relative(config.projectRoot, filePath).replace(/\\/g, '/');

  // Read base revision via git show
  let baseContent = '';
  try {
    baseContent = execSync(`git show ${baseRef}:${relPath}`, {
      cwd: config.projectRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err: any) {
    throw new Error(`Failed to load ${relPath} at git revision '${baseRef}': ${err.message}`);
  }

  const before = evaluateContentString(baseContent, `${target} (${baseRef})`, filePath);
  const after = evaluateContentString(currentContent, `${target} (current)`, filePath);

  return {
    target: relPath,
    baseRef,
    scoreBefore: before.score,
    scoreAfter: after.score,
    scoreDelta: after.score - before.score,
    directAnswersDelta:
      after.breakdown.directAnswerParagraphs.count - before.breakdown.directAnswerParagraphs.count,
    tablesDelta: after.breakdown.tables.count - before.breakdown.tables.count,
    questionHeadingsDelta:
      after.breakdown.questionHeadings.count - before.breakdown.questionHeadings.count,
    listsDelta: after.breakdown.structuredLists.count - before.breakdown.structuredLists.count,
    before,
    after,
  };
}

