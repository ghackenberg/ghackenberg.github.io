import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const ROOT_DIR = process.cwd();
const CONTENT_DIR = path.join(ROOT_DIR, 'src', 'content');

// Content collections covered by centralized SVG graphics standards
const TARGET_COLLECTIONS = [
  'posts',
  'courses',
  'services',
  'projects',
  'presentations',
  'talks',
  'publications',
];

// Explicitly excluded asset/visual directories
const EXCLUDED_DIRS = new Set([
  'characters',
  'environments',
  'objects',
]);

// Explicit list of known migrated SVGs or baseline cutoff
const KNOWN_MIGRATED_SVGS = new Set([
  'simplex_safety_envelope.svg',
]);

const GRAPHICAL_TAGS = new Set([
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'path',
  'text',
]);

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const INLINE_STYLE_HEX_REGEX = /(?:fill|stroke)\s*:\s*#([0-9a-fA-F]{3,8})/i;
const GRAPHICS_IMPORT_REGEX = /@import\s+(?:url\(['"]?\/styles\/graphics\.css['"]?\)|['"]\/styles\/graphics\.css['"])/;

interface Violation {
  file: string;
  tag?: string;
  message: string;
}

let errorCount = 0;
const violations: Violation[] = [];

function recordError(file: string, message: string, tag?: string) {
  errorCount++;
  violations.push({ file, tag, message });
}

/**
 * Recursively retrieves all .svg files from a directory
 */
function findSvgFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const svgs: string[] = [];

  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      svgs.push(...findSvgFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.svg')) {
      svgs.push(fullPath);
    }
  }

  return svgs;
}

/**
 * Collects all SVG files across target content collections
 */
function getAllContentSvgs(): string[] {
  const svgs: string[] = [];
  for (const collection of TARGET_COLLECTIONS) {
    const colDir = path.join(CONTENT_DIR, collection);
    svgs.push(...findSvgFiles(colDir));
  }
  return svgs;
}

/**
 * Determines whether an SVG file is in the scope of the centralized graphics architecture
 */
function isMigratedSvg(filePath: string, content: string): boolean {
  const fileName = path.basename(filePath);
  if (KNOWN_MIGRATED_SVGS.has(fileName)) {
    return true;
  }

  // Any SVG that explicitly references /styles/graphics.css
  if (content.includes('/styles/graphics.css')) {
    return true;
  }

  // Check if SVG is inside posts collection
  const postsDir = path.join(CONTENT_DIR, 'posts');
  const relPostsPath = path.relative(postsDir, filePath).replace(/\\/g, '/');
  const isPost = !relPostsPath.startsWith('..') && !path.isAbsolute(relPostsPath);

  if (isPost) {
    // Also match posts created from 2026_10_06 onwards
    const postFolder = relPostsPath.split('/')[0];
    if (postFolder && postFolder >= '2026_10_06') {
      return true;
    }
    // Older posts are excluded unless in KNOWN_MIGRATED_SVGS or explicitly referencing graphics.css
    return false;
  }

  // All other target content collections (courses, services, projects, presentations, talks, publications)
  // are subject to centralized graphics standards
  return true;
}

function lintSvg(filePath: string): { migrated: boolean; valid: boolean } {
  const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');

  if (!isMigratedSvg(filePath, content)) {
    return { migrated: false, valid: true };
  }

  const $ = cheerio.load(content, { xml: true });
  let hasGraphicsImport = false;

  // 1. Check for @import url('/styles/graphics.css') inside <defs><style> or <style>
  $('style').each((_, el) => {
    const styleContent = $(el).text();
    if (GRAPHICS_IMPORT_REGEX.test(styleContent)) {
      hasGraphicsImport = true;
    }
  });

  if (!hasGraphicsImport) {
    recordError(
      relPath,
      "Migrated SVG must import '/styles/graphics.css' via @import url('/styles/graphics.css'); inside <style>."
    );
  }

  // 2. Prohibit hardcoded hex colors in fill and stroke on graphical elements
  $('*').each((_, el) => {
    if (!('tagName' in el) || typeof el.tagName !== 'string') return;
    const tagName = el.tagName.toLowerCase();

    // Check graphical tags + markers
    if (GRAPHICAL_TAGS.has(tagName) || tagName === 'marker') {
      const fill = $(el).attr('fill')?.trim();
      const stroke = $(el).attr('stroke')?.trim();
      const style = $(el).attr('style')?.trim();

      if (fill && HEX_COLOR_REGEX.test(fill)) {
        recordError(
          relPath,
          `Element <${tagName}> contains hardcoded hex fill "${fill}". Use centralized design tokens (var(--svg-...)) instead.`,
          tagName
        );
      }

      if (stroke && HEX_COLOR_REGEX.test(stroke)) {
        recordError(
          relPath,
          `Element <${tagName}> contains hardcoded hex stroke "${stroke}". Use centralized design tokens (var(--svg-...)) instead.`,
          tagName
        );
      }

      if (style && INLINE_STYLE_HEX_REGEX.test(style)) {
        recordError(
          relPath,
          `Element <${tagName}> contains inline style with hardcoded hex colors: "${style}". Use centralized design tokens instead.`,
          tagName
        );
      }
    }
  });

  return { migrated: true, valid: errorCount === 0 };
}

function run(): void {
  console.log('🔍 [lint:svgs] Scanning SVGs across content collections (posts, courses, services, projects, presentations, talks, publications)...');
  const allSvgs = getAllContentSvgs();

  let migratedCount = 0;

  for (const svgFile of allSvgs) {
    const { migrated } = lintSvg(svgFile);
    if (migrated) {
      migratedCount++;
    }
  }

  if (errorCount > 0) {
    console.error(`\n💥 [lint:svgs] Found ${errorCount} SVG lint violation(s):`);
    for (const v of violations) {
      const tagInfo = v.tag ? ` [${v.tag}]` : '';
      console.error(`  - ${v.file}${tagInfo}: ${v.message}`);
    }
    process.exit(1);
  }

  console.log(`✅ [lint:svgs] Validated ${migratedCount} migrated SVG(s) out of ${allSvgs.length} total SVGs across target collections.`);
  console.log('🎉 [lint:svgs] All migrated SVGs adhere to centralized graphics design tokens (0 errors).');
}

run();
