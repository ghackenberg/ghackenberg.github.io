import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

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

const NARROW_GLYPHS = new Set('iIjl1!|.,:;\'()[]{} '.split(''));
const WIDE_GLYPHS = new Set('MW@#%&QGO'.split(''));
const MEDIUM_WIDE_GLYPHS = new Set('ABCDHKNPRSTUVXYZ<>+~^=—→↔•'.split(''));

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

function getInheritedAttr($: cheerio.CheerioAPI, el: Element, attrName: string): string | undefined {
  let current: AnyNode | null = el;
  while (current && 'tagName' in current) {
    const val = $(current as Element).attr(attrName)?.trim();
    if (val) return val;
    current = current.parent;
  }
  return undefined;
}

function isInsideSkippedContainer(el: Element): boolean {
  let current: AnyNode | null = el.parent;
  while (current && 'tagName' in current) {
    const tag = (current as Element).tagName.toLowerCase();
    if (tag === 'defs' || tag === 'clippath' || tag === 'mask' || tag === 'symbol') {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function hasRotationTransform($: cheerio.CheerioAPI, el: Element): boolean {
  let current: AnyNode | null = el;
  while (current && 'tagName' in current) {
    const transform = $(current as Element).attr('transform') || '';
    if (/rotate\s*\(/i.test(transform)) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/**
 * Estimates horizontal pixel width of a single-line SVG <text> string in Outfit / Inter.
 */
function estimateTextWidthPx(
  text: string,
  fontSize: number,
  fontWeight?: string,
  letterSpacing?: string
): number {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) return 0;

  let width = 0;
  for (const ch of normalized) {
    if (NARROW_GLYPHS.has(ch)) {
      width += 0.29 * fontSize;
    } else if (WIDE_GLYPHS.has(ch)) {
      width += 0.71 * fontSize;
    } else if (MEDIUM_WIDE_GLYPHS.has(ch)) {
      width += 0.59 * fontSize;
    } else {
      width += 0.49 * fontSize;
    }
  }

  const isBold =
    fontWeight === 'bold' ||
    fontWeight === 'bolder' ||
    (fontWeight !== undefined && Number(fontWeight) >= 600);
  if (isBold) {
    width *= 1.05;
  }

  if (letterSpacing) {
    const lsTrimmed = letterSpacing.trim();
    let lsPx = 0;
    if (lsTrimmed.endsWith('em')) {
      lsPx = (parseFloat(lsTrimmed) || 0) * fontSize;
    } else if (lsTrimmed.endsWith('px') || /^-?\d+(\.\d+)?$/.test(lsTrimmed)) {
      lsPx = parseFloat(lsTrimmed) || 0;
    }
    if (lsPx > 0 && normalized.length > 1) {
      width += (normalized.length - 1) * lsPx;
    }
  }

  return width;
}

function parseTransformOffset(transformAttr?: string): { tx: number; ty: number; sx: number } {
  let tx = 0;
  let ty = 0;
  let sx = 1;
  if (!transformAttr) return { tx, ty, sx };

  const translateMatch = transformAttr.match(/translate\(\s*([+-]?\d+(?:\.\d+)?)(?:[\s,]+([+-]?\d+(?:\.\d+)?))?\s*\)/i);
  if (translateMatch) {
    tx = parseFloat(translateMatch[1]) || 0;
    ty = translateMatch[2] !== undefined ? parseFloat(translateMatch[2]) || 0 : 0;
  }

  const scaleMatch = transformAttr.match(/scale\(\s*([+-]?\d+(?:\.\d+)?)/i);
  if (scaleMatch) {
    sx = parseFloat(scaleMatch[1]) || 1;
  }

  return { tx, ty, sx };
}

function computeGlobalHorizontalSpan(
  $: cheerio.CheerioAPI,
  el: Element,
  localLeft: number,
  localRight: number
): { absLeft: number; absRight: number } {
  let left = localLeft;
  let right = localRight;
  let current: AnyNode | null = el;

  while (current && 'tagName' in current) {
    const tag = (current as Element).tagName.toLowerCase();
    if (tag === 'svg') break;
    const transformAttr = $(current as Element).attr('transform');
    if (transformAttr) {
      const { tx, sx } = parseTransformOffset(transformAttr);
      left = left * sx + tx;
      right = right * sx + tx;
    }
    current = current.parent;
  }

  return { absLeft: Math.min(left, right), absRight: Math.max(left, right) };
}

function lintSvgTextOverflow(relPath: string, $: cheerio.CheerioAPI): void {
  const $svg = $('svg').first();
  if ($svg.length === 0) return;

  let viewBoxMinX = 0;
  let viewBoxWidth = 0;
  const viewBoxAttr = $svg.attr('viewBox')?.trim();
  if (viewBoxAttr) {
    const parts = viewBoxAttr.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
      viewBoxMinX = parts[0];
      viewBoxWidth = parts[2];
    }
  }

  $('text').each((_, el) => {
    if (!('tagName' in el)) return;
    const textEl = el as Element;
    if (isInsideSkippedContainer(textEl) || hasRotationTransform($, textEl)) {
      return;
    }

    const $text = $(textEl);
    // If <text> has multiple <tspan> children with their own x attributes, skip combined single-line check
    const tspansWithX = $text.find('tspan[x]');
    if (tspansWithX.length > 1) {
      return;
    }

    const rawText = $text.text().replace(/\s+/g, ' ').trim();
    if (!rawText) return;

    const xAttr = $text.attr('x') ?? $text.find('tspan[x]').first().attr('x');
    const yAttr = $text.attr('y') ?? $text.find('tspan[y]').first().attr('y');
    if (xAttr === undefined || xAttr.includes('%')) return;

    const x = parseFloat(xAttr);
    const y = yAttr !== undefined && !yAttr.includes('%') ? parseFloat(yAttr) : NaN;
    if (Number.isNaN(x)) return;

    const fontSizeStr = getInheritedAttr($, textEl, 'font-size') || '12';
    const fontSize = parseFloat(fontSizeStr) || 12;
    const fontWeight = getInheritedAttr($, textEl, 'font-weight');
    const letterSpacing = getInheritedAttr($, textEl, 'letter-spacing');
    const textAnchor = (getInheritedAttr($, textEl, 'text-anchor') || 'start').toLowerCase();

    const estWidth = estimateTextWidthPx(rawText, fontSize, fontWeight, letterSpacing);

    let localLeft = x;
    let localRight = x + estWidth;
    if (textAnchor === 'middle') {
      localLeft = x - estWidth / 2;
      localRight = x + estWidth / 2;
    } else if (textAnchor === 'end') {
      localLeft = x - estWidth;
      localRight = x;
    }

    // Check 1: Direct parent <g> card <rect> boundary check
    const parent = textEl.parent;
    if (parent && 'tagName' in parent && (parent as Element).tagName.toLowerCase() === 'g') {
      const $parentG = $(parent as Element);
      const directRects = $parentG.children('rect').toArray() as Element[];

      // Filter to card-sized background rects (width >= 100, height >= 36)
      const cardRects = directRects
        .map((r) => {
          const $r = $(r);
          const rx = parseFloat($r.attr('x') || '0');
          const ry = parseFloat($r.attr('y') || '0');
          const rw = parseFloat($r.attr('width') || '0');
          const rh = parseFloat($r.attr('height') || '0');
          return { rx, ry, rw, rh };
        })
        .filter((r) => !Number.isNaN(r.rw) && !Number.isNaN(r.rh) && r.rw >= 100 && r.rh >= 36);

      // Only enforce card rect bound when the parent <g> has a single primary card frame containing (x, y)
      if (cardRects.length === 1) {
        const card = cardRects[0];
        const insideX = x >= card.rx && x <= card.rx + card.rw;
        const insideY = Number.isNaN(y) || (y >= card.ry && y <= card.ry + card.rh);
        if (insideX && insideY) {
          const cardLeft = card.rx;
          const cardRight = card.rx + card.rw;
          if (localLeft < cardLeft - 2 || localRight > cardRight + 2) {
            recordError(
              relPath,
              `<text> "${rawText}" (estimated span [${localLeft.toFixed(1)}, ${localRight.toFixed(1)}], width ~${estWidth.toFixed(1)}px at font-size=${fontSize}) overflows enclosing card <rect> [${cardLeft}, ${cardRight}]. Shorten text, adjust x, or reduce font-size.`,
              'text'
            );
            return;
          }
        }
      }
    }

    // Check 2: Root <svg viewBox> horizontal boundary check
    if (viewBoxWidth > 0) {
      const { absLeft, absRight } = computeGlobalHorizontalSpan($, textEl, localLeft, localRight);
      const vbLeft = viewBoxMinX;
      const vbRight = viewBoxMinX + viewBoxWidth;
      if (absLeft < vbLeft - 4 || absRight > vbRight + 4) {
        recordError(
          relPath,
          `<text> "${rawText}" (global span [${absLeft.toFixed(1)}, ${absRight.toFixed(1)}]) overflows root <svg viewBox> horizontal bounds [${vbLeft}, ${vbRight}].`,
          'text'
        );
      }
    }
  });
}

function lintSvg(filePath: string): boolean {
  const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');

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

  // 3. Check horizontal <text> overflow against enclosing card <rect> and root <svg viewBox>
  lintSvgTextOverflow(relPath, $);

  return errorCount === 0;
}

function run(): void {
  console.log('🔍 [lint:svgs] Scanning SVGs across content collections (posts, courses, services, projects, presentations, talks, publications)...');
  const allSvgs = getAllContentSvgs();

  for (const svgFile of allSvgs) {
    lintSvg(svgFile);
  }

  if (errorCount > 0) {
    console.error(`\n💥 [lint:svgs] Found ${errorCount} SVG lint violation(s):`);
    for (const v of violations) {
      const tagInfo = v.tag ? ` [${v.tag}]` : '';
      console.error(`  - ${v.file}${tagInfo}: ${v.message}`);
    }
    process.exit(1);
  }

  console.log(`✅ [lint:svgs] Validated ${allSvgs.length} SVG(s) across target collections (design tokens + horizontal <text> bounds).`);
  console.log('🎉 [lint:svgs] All SVGs adhere to centralized graphics design tokens and text bounding boxes (0 errors).');
}

run();
