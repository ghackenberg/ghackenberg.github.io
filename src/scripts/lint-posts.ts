import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { CITATION_GROUP_REGEX } from '@commons/shared/citations.js';

interface PostFrontmatter {
  inLanguage?: string;
  image?: {
    src?: string;
    title?: string;
    description?: string;
  };
  title?: string;
  pubDate?: string | Date;
  description?: string;
}

interface MermaidFrontmatter {
  title?: string;
  caption?: string;
}

const ROOT_DIR = process.cwd();
const POSTS_DIR = path.resolve(ROOT_DIR, 'src', 'content', 'posts');
const STRICT_GEO_CUTOFF_DATE = '2026-10-16';
const MODERN_DATE_PREFIX_CUTOFF = '2020-01-01';
const MIN_ANSWER_FIRST_WORDS = 38;
const MAX_ANSWER_FIRST_WORDS = 58;
const MAX_MERMAID_NODES = 5;

type MarkdownBlockType = 'heading' | 'paragraph' | 'table' | 'code' | 'list' | 'image' | 'blockquote';

interface MarkdownBlock {
  type: MarkdownBlockType;
  startLine: number;
  detail: string;
  hasCaption?: boolean;
}

const STRUCTURAL_BLOCKS = new Set<MarkdownBlockType>(['table', 'code', 'list', 'image', 'blockquote']);

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (trimmed === '') {
      i++;
      continue;
    }

    const startLine = i + 1;

    // 1. Fenced code / mermaid block
    if (trimmed.startsWith('```')) {
      const fenceInfo = trimmed.slice(3).trim() || 'code';
      const isMermaid = /^mermaid\b/i.test(fenceInfo);
      const captionMatch = fenceInfo.match(/\bcaption="([^"]+)"/) || fenceInfo.match(/\bcaption='([^']+)'/);
      const hasCaption = isMermaid || Boolean(captionMatch && captionMatch[1].trim().length > 0);
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        i++;
      }
      if (i < lines.length) {
        i++; // consume closing ```
      }
      blocks.push({ type: 'code', startLine, detail: `\`\`\`${fenceInfo}`, hasCaption });
      continue;
    }

    // 2. Heading (# .. ######)
    if (/^#{1,6}\s+/.test(trimmed)) {
      blocks.push({ type: 'heading', startLine, detail: trimmed });
      i++;
      continue;
    }

    // 3a. Markdown Table preceded by <!-- caption: "..." -->
    const tableCaptionMatch = trimmed.match(/^<!--\s*caption:\s*"([^"]+)"\s*-->$/i);
    if (tableCaptionMatch) {
      const hasNonEmptyCaption = tableCaptionMatch[1].trim().length > 0;
      i++;
      while (i < lines.length && lines[i].trim() === '') {
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('|')) {
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          i++;
        }
        blocks.push({ type: 'table', startLine, detail: 'Markdown table', hasCaption: hasNonEmptyCaption });
      }
      continue;
    }

    // 3b. Markdown Table without preceding <!-- caption: "..." -->
    if (trimmed.startsWith('|')) {
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        i++;
      }
      blocks.push({ type: 'table', startLine, detail: 'Markdown table', hasCaption: false });
      continue;
    }

    // 4. Blockquote / Callout
    if (trimmed.startsWith('>')) {
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        i++;
      }
      blocks.push({ type: 'blockquote', startLine, detail: 'blockquote/callout' });
      continue;
    }

    // 5. Standalone Image / SVG
    if (/^!\[[^\]]*\]\([^)]+\)\s*$/.test(trimmed)) {
      blocks.push({ type: 'image', startLine, detail: trimmed.slice(0, 60) });
      i++;
      continue;
    }

    // 6. List (-, *, +, 1.)
    if (/^(?:[-*+]|\d+\.)\s+/.test(trimmed)) {
      i++;
      while (i < lines.length) {
        const curTrim = lines[i].trim();
        if (curTrim === '') {
          // Check if the list continues after blank line
          let k = i + 1;
          while (k < lines.length && lines[k].trim() === '') {
            k++;
          }
          if (
            k < lines.length &&
            (/^(?:[-*+]|\d+\.)\s+/.test(lines[k].trim()) || /^\s{2,}\S/.test(lines[k]))
          ) {
            i = k;
            continue;
          }
          break;
        }
        if (/^(?:[-*+]|\d+\.)\s+/.test(curTrim) || /^\s{2,}\S/.test(lines[i])) {
          i++;
          continue;
        }
        break;
      }
      blocks.push({ type: 'list', startLine, detail: 'list' });
      continue;
    }

    // 7. Prose Paragraph
    while (i < lines.length) {
      const curTrim = lines[i].trim();
      if (
        curTrim === '' ||
        curTrim.startsWith('```') ||
        /^#{1,6}\s+/.test(curTrim) ||
        /^<!--\s*caption:\s*"([^"]+)"\s*-->$/i.test(curTrim) ||
        curTrim.startsWith('|') ||
        curTrim.startsWith('>') ||
        /^!\[[^\]]*\]\([^)]+\)\s*$/.test(curTrim) ||
        /^(?:[-*+]|\d+\.)\s+/.test(curTrim)
      ) {
        break;
      }
      i++;
    }
    blocks.push({ type: 'paragraph', startLine, detail: trimmed.slice(0, 50) });
  }

  return blocks;
}

function lintProseRhythm(relPath: string, bodyWithoutFourTicks: string, violations: string[]): void {
  const blocks = parseMarkdownBlocks(bodyWithoutFourTicks);

  for (let i = 0; i < blocks.length; i++) {
    const cur = blocks[i];
    const next = blocks[i + 1];

    // Caption enforcement on tables and non-Mermaid code blocks
    if (cur.type === 'table' && !cur.hasCaption) {
      violations.push(
        `[${relPath}] Table at body L${cur.startLine} is missing a preceding <!-- caption: "..." --> comment.`
      );
    }
    if (cur.type === 'code' && !cur.hasCaption) {
      violations.push(
        `[${relPath}] Code block (${cur.detail}) at body L${cur.startLine} is missing a mandatory caption="..." attribute on the opening fence.`
      );
    }

    // Rule A: Every heading must be immediately followed by a prose paragraph
    if (cur.type === 'heading') {
      if (!next || next.type !== 'paragraph') {
        const foundDesc = next ? `<${next.type}> (${next.detail}) at L${next.startLine}` : 'end of file';
        violations.push(
          `[${relPath}] Prose rhythm violation: Heading "${cur.detail}" (body L${cur.startLine}) must be followed immediately by a prose paragraph, but found ${foundDesc}.`
        );
      }
    }

    // Rule B: Structural blocks (table, code, list, image, blockquote) must never immediately follow one another without a prose paragraph in between
    if (STRUCTURAL_BLOCKS.has(cur.type) && next && STRUCTURAL_BLOCKS.has(next.type)) {
      violations.push(
        `[${relPath}] Prose rhythm violation: <${cur.type}> block (${cur.detail}, body L${cur.startLine}) is followed directly by <${next.type}> block (${next.detail}, body L${next.startLine}) without an intervening prose paragraph.`
      );
    }
  }
}

function stripFourBacktickBlocks(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const result: string[] = [];
  let inFourTickBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('````')) {
      inFourTickBlock = !inFourTickBlock;
      continue;
    }
    if (!inFourTickBlock) {
      result.push(line);
    }
  }
  return result.join('\n');
}

function stripFencedAndInlineCode(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const result: string[] = [];
  let inFencedBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inFencedBlock = !inFencedBlock;
      continue;
    }
    if (!inFencedBlock) {
      result.push(line.replace(/`[^`]*`/g, ''));
    }
  }
  return result.join('\n');
}

function countAnswerFirstWords(text: string): number {
  const cleaned = text
    .replace(CITATION_GROUP_REGEX, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, (_, label: string) => label)
    .replace(/\$[^$]+\$/g, 'MATH')
    .replace(/`[^`]+`/g, 'CODE')
    .replace(/[*_~]/g, '')
    .trim();
  return cleaned.split(/\s+/).filter(Boolean).length;
}

function countMermaidNodes(mermaidBody: string): number {
  const lines = mermaidBody
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'));

  const firstLine = lines[0] || '';
  if (/^sequenceDiagram\b/.test(firstLine)) {
    const participants = new Set<string>();
    for (const l of lines.slice(1)) {
      const pm = l.match(/^(?:participant|actor)\s+([A-Za-z0-9_]+)/);
      if (pm) {
        participants.add(pm[1]);
      }
    }
    return participants.size;
  }

  const nodes = new Set<string>();
  const reserved = new Set([
    'graph',
    'flowchart',
    'subgraph',
    'end',
    'direction',
    'style',
    'classDef',
    'class',
    'click',
    'linkStyle',
    'TB',
    'TD',
    'BT',
    'RL',
    'LR',
  ]);

  for (const l of lines.slice(1)) {
    if (/^(?:subgraph|end|direction|style|classDef|class|click|linkStyle)\b/.test(l)) {
      continue;
    }
    const withoutLabels = l
      .replace(/\[[^\]]*\]/g, '[]')
      .replace(/\([^)]*\)/g, '()')
      .replace(/\{[^}]*\}/g, '{}')
      .replace(/\|[^|]*\|/g, '')
      .replace(/"[^"]*"/g, '');

    const tokens = [...withoutLabels.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g)].map((m) => m[1]);
    for (const token of tokens) {
      if (!reserved.has(token)) {
        nodes.add(token);
      }
    }
  }
  return nodes.size;
}

function run(): void {
  const verbose = process.argv.includes('--verbose');
  if (verbose) {
    console.log('🔍 [lint:posts] Auditing blog posts for structural, asset, Mermaid, and GEO/AIO compliance...\n');
  }

  if (!fs.existsSync(POSTS_DIR)) {
    console.error(`❌ [lint:posts] Posts directory not found at ${POSTS_DIR}`);
    process.exit(1);
  }

  const cliArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const targetSlugFilter = cliArgs.length > 0 ? cliArgs[0] : null;

  const postDirs = fs
    .readdirSync(POSTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const violations: string[] = [];
  const imageHashes = new Map<string, string>();
  const seenPubDates = new Map<string, string>();
  let universalChecked = 0;
  let strictGeoChecked = 0;

  for (const dirName of postDirs) {
    const dirPrefixMatch = dirName.match(/^(\d{4})_(\d{2})_(\d{2})_/);
    if (dirPrefixMatch && targetSlugFilter && !dirName.includes(targetSlugFilter)) {
      const dirDate = `${dirPrefixMatch[1]}-${dirPrefixMatch[2]}-${dirPrefixMatch[3]}`;
      if (dirDate >= MODERN_DATE_PREFIX_CUTOFF && !seenPubDates.has(dirDate)) {
        seenPubDates.set(dirDate, dirName);
      }
    }
  }

  for (const dirName of postDirs) {
    if (targetSlugFilter && !dirName.includes(targetSlugFilter)) {
      continue;
    }

    const mdPath = path.join(POSTS_DIR, dirName, 'index.md');
    const mdxPath = path.join(POSTS_DIR, dirName, 'index.mdx');
    const postFile = fs.existsSync(mdPath) ? mdPath : fs.existsSync(mdxPath) ? mdxPath : null;

    if (!postFile) {
      violations.push(`[${dirName}] Missing index.md or index.mdx.`);
      continue;
    }

    universalChecked++;
    const relPath = path.relative(ROOT_DIR, postFile).replace(/\\/g, '/');
    const rawContent = fs.readFileSync(postFile, 'utf8');
    const fmMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

    if (!fmMatch) {
      violations.push(`[${relPath}] Missing or malformed YAML frontmatter block.`);
      continue;
    }

    let fm: PostFrontmatter = {};
    try {
      fm = (YAML.parse(fmMatch[1]) || {}) as PostFrontmatter;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      violations.push(`[${relPath}] YAML frontmatter parse error: ${msg}`);
      continue;
    }

    const body = fmMatch[2];
    const bodyWithoutFourTicks = stripFourBacktickBlocks(body);

    // 1a(i) Directory name starts with YYYY_MM_DD_ matching frontmatter pubDate
    const rawDateMatch = fmMatch[1].match(/^pubDate:\s*["']?(\d{4}-\d{2}-\d{2})["']?\s*$/m);
    const pubDateStr = rawDateMatch
      ? rawDateMatch[1]
      : fm.pubDate instanceof Date
        ? fm.pubDate.toISOString().slice(0, 10)
        : String(fm.pubDate || '');

    if (!/^\d{4}_\d{2}_\d{2}_/.test(dirName)) {
      violations.push(`[${relPath}] Directory "${dirName}" must start with YYYY_MM_DD_ prefix.`);
    } else if (pubDateStr >= MODERN_DATE_PREFIX_CUTOFF) {
      const expectedPrefix = `${pubDateStr.replace(/-/g, '_')}_`;
      if (!dirName.startsWith(expectedPrefix)) {
        violations.push(
          `[${relPath}] Directory "${dirName}" does not match frontmatter pubDate "${pubDateStr}" (expected prefix "${expectedPrefix}").`
        );
      }
      const existingDateOwner = seenPubDates.get(pubDateStr);
      if (existingDateOwner && existingDateOwner !== dirName) {
        violations.push(
          `[${relPath}] Duplicate pubDate "${pubDateStr}" shared with "${existingDateOwner}". Modern posts must have a unique chronological pubDate (use max(today, latest_post_pubDate + 1 day)).`
        );
      } else {
        seenPubDates.set(pubDateStr, dirName);
      }
    }

    // 1a(ii) Unique Cover Image Hash (SHA-256 of icon.src)
    const postImg = fm.image;
    if (!postImg?.src) {
      violations.push(`[${relPath}] Missing frontmatter image.src.`);
    } else {
      const imgPath = path.resolve(path.dirname(postFile), postImg.src);
      if (!fs.existsSync(imgPath)) {
        violations.push(`[${relPath}] Cover image "${postImg.src}" does not exist on disk.`);
      } else {
        const imgBuffer = fs.readFileSync(imgPath);
        const hash = crypto.createHash('sha256').update(imgBuffer).digest('hex');
        const existingOwner = imageHashes.get(hash);
        if (existingOwner && existingOwner !== dirName) {
          violations.push(
            `[${relPath}] Duplicate cover image SHA-256 hash (${hash.slice(0, 12)}...) shared with "${existingOwner}". Every post must have a unique generated hero image.`
          );
        } else {
          imageHashes.set(hash, dirName);
        }
      }
    }

    // 1a(iii) Zero file:/// URLs or relative markdown links to repo code (src/, .agents/), and verify canonical GitHub main paths exist on disk
    if (/file:\/\/\//i.test(bodyWithoutFourTicks)) {
      violations.push(`[${relPath}] Contains forbidden "file:///" URL. Use canonical GitHub URLs on main.`);
    }
    if (/\]\((?:\.\.?\/)*(?:src|\.agents)\//.test(bodyWithoutFourTicks)) {
      violations.push(
        `[${relPath}] Contains relative markdown link to repository source ("src/" or ".agents/"). Use canonical GitHub URLs on main.`
      );
    }

    const githubLinkRegex =
      /https:\/\/github\.com\/ghackenberg\/ghackenberg\.github\.io\/(?:blob|tree)\/main\/([^)#?\s"'>]+)/g;
    for (const match of bodyWithoutFourTicks.matchAll(githubLinkRegex)) {
      const rawSubPath = match[1].replace(/[.,;:]+$/, '');
      let repoSubPath = rawSubPath;
      try {
        repoSubPath = decodeURIComponent(rawSubPath);
      } catch {
        // Keep rawSubPath if decodeURIComponent fails
      }
      const resolvedRepoPath = path.resolve(ROOT_DIR, repoSubPath);
      if (!fs.existsSync(resolvedRepoPath)) {
        violations.push(
          `[${relPath}] Canonical GitHub link points to non-existent repository path "${repoSubPath}" (${match[0]}).`
        );
      }
    }

    // 1a(iv) No --- horizontal rule immediately before ## References or ## Referenzen, no inline <svg>, and no manual ## References / ## Referenzen heading
    if (/^---\s*\r?\n+#+\s*(?:References|Referenzen)\b/im.test(bodyWithoutFourTicks)) {
      violations.push(`[${relPath}] Contains forbidden "---" horizontal divider immediately before References section.`);
    }

    const proseWithoutCode = stripFencedAndInlineCode(bodyWithoutFourTicks);
    if (/<svg\b/i.test(proseWithoutCode)) {
      violations.push(
        `[${relPath}] Contains forbidden inline <svg> element. Extract SVG diagrams into standalone .svg files in the post directory and embed via ![caption](./diagram.svg "title").`
      );
    }
    if (/^##\s+(?:References|Referenzen)\b/im.test(proseWithoutCode)) {
      violations.push(
        `[${relPath}] Contains redundant manual "## References" / "## Referenzen" heading. src/pages/posts/[slug].astro renders <h2 id="references"> automatically from frontmatter references.`
      );
    }

    // 1a(v) Every ```mermaid block has valid YAML frontmatter with distinct title and caption and zero raw HTML tags
    const mermaidRegex = /```mermaid\r?\n([\s\S]*?)```/g;
    const mermaidBlocks = [...bodyWithoutFourTicks.matchAll(mermaidRegex)];
    for (let i = 0; i < mermaidBlocks.length; i++) {
      const blockContent = mermaidBlocks[i][1];
      const mfmMatch = blockContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
      if (!mfmMatch) {
        violations.push(`[${relPath}] Mermaid block #${i + 1} is missing mandatory YAML frontmatter (title & caption).`);
        continue;
      }

      let mfm: MermaidFrontmatter = {};
      try {
        mfm = (YAML.parse(mfmMatch[1]) || {}) as MermaidFrontmatter;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        violations.push(`[${relPath}] Mermaid block #${i + 1} YAML frontmatter error: ${msg}`);
        continue;
      }

      const mTitle = (mfm.title || '').trim();
      const mCaption = (mfm.caption || '').trim();
      if (!mTitle || !mCaption) {
        violations.push(`[${relPath}] Mermaid block #${i + 1} must define non-empty "title" and "caption".`);
      } else if (mTitle === mCaption) {
        violations.push(`[${relPath}] Mermaid block #${i + 1} "title" and "caption" must be distinct.`);
      }

      const diagramBody = mfmMatch[2];
      if (/<(?:br|span|div)\b/i.test(diagramBody)) {
        violations.push(
          `[${relPath}] Mermaid block #${i + 1} contains forbidden raw HTML tag (<br>, <span>, or <div>).`
        );
      }

      // 1b(iv) Strict Mermaid node count (<= 5 distinct nodes) on modern posts (or with --strict)
      const enforceStrict = pubDateStr >= STRICT_GEO_CUTOFF_DATE || process.argv.includes('--strict');
      if (enforceStrict) {
        const nodeCount = countMermaidNodes(diagramBody);
        if (nodeCount > MAX_MERMAID_NODES) {
          violations.push(
            `[${relPath}] Mermaid block #${i + 1} ("${mTitle}") has ${nodeCount} distinct nodes, exceeding the maximum of ${MAX_MERMAID_NODES}. Escalate complex topologies to standalone SVG.`
          );
        }
      }
    }

    // 1a(vi) Editorial Prose Rhythm (universal across all posts): Every heading followed by a prose paragraph; no two structural blocks back-to-back without intervening prose
    lintProseRhythm(relPath, bodyWithoutFourTicks, violations);

    // 1b Strict GEO/AIO Gate (enforced on posts with pubDate >= '2026-10-16' or with --strict)
    const enforceStrictGeo = pubDateStr >= STRICT_GEO_CUTOFF_DATE || process.argv.includes('--strict');
    if (enforceStrictGeo) {
      strictGeoChecked++;
      const lines = bodyWithoutFourTicks.trim().split(/\r?\n/);

      // (i) Top Answer-First paragraph immediately at start of Markdown body (38-58 words), followed by Markdown table before first ##
      let lineIdx = 0;
      while (lineIdx < lines.length && lines[lineIdx].trim() === '') {
        lineIdx++;
      }

      const topParaLines: string[] = [];
      while (
        lineIdx < lines.length &&
        lines[lineIdx].trim() !== '' &&
        !lines[lineIdx].startsWith('#') &&
        !lines[lineIdx].trim().startsWith('<!--') &&
        !lines[lineIdx].startsWith('|') &&
        !lines[lineIdx].startsWith('>') &&
        !lines[lineIdx].startsWith('```')
      ) {
        topParaLines.push(lines[lineIdx]);
        lineIdx++;
      }

      if (topParaLines.length === 0) {
        violations.push(
          `[${relPath}] Missing top Answer-First definition paragraph at the start of the Markdown body.`
        );
      } else {
        const topWords = countAnswerFirstWords(topParaLines.join(' '));
        if (topWords < MIN_ANSWER_FIRST_WORDS || topWords > MAX_ANSWER_FIRST_WORDS) {
          violations.push(
            `[${relPath}] Top Answer-First paragraph has ${topWords} words (must be within ${MIN_ANSWER_FIRST_WORDS}–${MAX_ANSWER_FIRST_WORDS} words).`
          );
        }
      }

      const firstH2Idx = lines.findIndex((l) => /^##\s+/.test(l));
      const introSlice = firstH2Idx !== -1 ? lines.slice(0, firstH2Idx).join('\n') : lines.join('\n');
      if (!/^\|.+\|\s*\r?\n\|[\s:|-]+\|/m.test(introSlice)) {
        violations.push(
          `[${relPath}] Missing structured Markdown synthesis table in the introduction before the first "## " heading.`
        );
      }

      // (ii) Answer-First paragraph (38-58 words) immediately below every ## heading & (iii) Question-framed ## heading
      let questionHeadingCount = 0;
      let inCodeFence = false;

      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('```')) {
          inCodeFence = !inCodeFence;
          continue;
        }
        if (inCodeFence) continue;

        const h2Match = lines[i].match(/^##\s+(.+)$/);
        if (!h2Match) continue;

        const headingTitle = h2Match[1].trim();
        if (/^(?:References|Referenzen)$/i.test(headingTitle)) {
          continue;
        }

        if (headingTitle.endsWith('?')) {
          questionHeadingCount++;
        }

        let j = i + 1;
        while (j < lines.length && lines[j].trim() === '') {
          j++;
        }

        const sectionParaLines: string[] = [];
        while (
          j < lines.length &&
          lines[j].trim() !== '' &&
          !lines[j].startsWith('#') &&
          !lines[j].trim().startsWith('<!--') &&
          !lines[j].startsWith('|') &&
          !lines[j].startsWith('>') &&
          !lines[j].startsWith('```') &&
          !/^(?:[-*+]|\d+\.)\s+/.test(lines[j].trim())
        ) {
          sectionParaLines.push(lines[j]);
          j++;
        }

        if (sectionParaLines.length === 0) {
          violations.push(
            `[${relPath}] Section "## ${headingTitle}" must begin immediately with a concise Answer-First paragraph (${MIN_ANSWER_FIRST_WORDS}–${MAX_ANSWER_FIRST_WORDS} words).`
          );
        } else {
          const wordCount = countAnswerFirstWords(sectionParaLines.join(' '));
          if (wordCount < MIN_ANSWER_FIRST_WORDS || wordCount > MAX_ANSWER_FIRST_WORDS) {
            violations.push(
              `[${relPath}] Answer-First paragraph under "## ${headingTitle}" has ${wordCount} words (must be within ${MIN_ANSWER_FIRST_WORDS}–${MAX_ANSWER_FIRST_WORDS} words).`
            );
          }
        }
      }

      if (questionHeadingCount < 1) {
        violations.push(
          `[${relPath}] Must include at least 1 question-framed "## " heading ending with "?" for GEO/AIO extractability.`
        );
      }
    }
  }

  // 2. Multi-Collection Prose Rhythm Sweep (projects, services, courses, publications, visualizations)
  const OTHER_COLLECTIONS = ['projects', 'services', 'courses', 'publications', 'visualizations'];
  let otherCollectionChecked = 0;

  function collectCollectionMarkdownFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'slides') continue;
        results.push(...collectCollectionMarkdownFiles(fullPath));
      } else if (entry.isFile() && /\.(?:md|mdx)$/i.test(entry.name)) {
        results.push(fullPath);
      }
    }
    return results.sort();
  }

  for (const colName of OTHER_COLLECTIONS) {
    const colDir = path.resolve(ROOT_DIR, 'src', 'content', colName);
    const mdFiles = collectCollectionMarkdownFiles(colDir);
    for (const filePath of mdFiles) {
      const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
      if (targetSlugFilter && !relPath.includes(targetSlugFilter)) {
        continue;
      }
      otherCollectionChecked++;
      const rawContent = fs.readFileSync(filePath, 'utf8');
      const fmMatch = rawContent.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
      const body = fmMatch ? fmMatch[1] : rawContent;
      const bodyWithoutFourTicks = stripFourBacktickBlocks(body);
      lintProseRhythm(relPath, bodyWithoutFourTicks, violations);
    }
  }

  if (violations.length > 0) {
    console.error(`❌ [lint:posts] Found ${violations.length} violation(s):\n`);
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    console.error('');
    process.exit(1);
  }

  console.log(
    `✅ [lint:posts] Validated ${universalChecked} post(s) (universal rules + prose rhythm + unique SHA-256 hero image hashes), ${strictGeoChecked} post(s) (strict GEO/AIO & <=5-node Mermaid gate), and ${otherCollectionChecked} multi-collection document(s) (prose rhythm) with 0 errors!`
  );
}

run();
