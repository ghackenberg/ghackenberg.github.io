import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as cheerio from 'cheerio';
import { fromHtml } from 'hast-util-from-html';
import type { Root, Element, RootContent, ElementContent } from 'hast';
import type { VFile } from 'vfile';

type HastParent = Root | Element;

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isLocalSvgImg(node: ElementContent): node is Element {
  if (!node || node.type !== 'element' || node.tagName !== 'img') {
    return false;
  }
  const src = node.properties?.src;
  if (typeof src !== 'string') {
    return false;
  }
  const cleanSrc = src.split('?')[0].split('#')[0].toLowerCase();
  return (
    cleanSrc.endsWith('.svg') &&
    !src.startsWith('http://') &&
    !src.startsWith('https://') &&
    !src.startsWith('//') &&
    !src.startsWith('data:')
  );
}

function getSoleSvgImgInParagraph(pNode: Element): Element | null {
  if (pNode.tagName !== 'p' || !Array.isArray(pNode.children)) {
    return null;
  }
  const nonWhitespaceChildren = pNode.children.filter((child) => {
    if (child.type === 'text') {
      return child.value.trim().length > 0;
    }
    return true;
  });
  if (nonWhitespaceChildren.length === 1 && isLocalSvgImg(nonWhitespaceChildren[0])) {
    return nonWhitespaceChildren[0];
  }
  return null;
}

function resolveSvgDiskPath(src: string, mdPath: string): string | null {
  const mdDir = path.dirname(mdPath);
  let resolvedPath: string;

  if (src.startsWith('/')) {
    const publicPath = path.resolve(process.cwd(), 'public', src.slice(1));
    if (fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
      return publicPath;
    }
    resolvedPath = path.resolve(process.cwd(), src.slice(1));
  } else {
    resolvedPath = path.resolve(mdDir, src);
  }

  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
    return resolvedPath;
  }
  return null;
}

function computeContentUrl(src: string, resolvedPath: string): string {
  const contentDir = path.resolve(process.cwd(), 'src/content');
  const publicDir = path.resolve(process.cwd(), 'public');

  if (resolvedPath.startsWith(contentDir)) {
    return '/' + path.relative(contentDir, resolvedPath).replace(/\\/g, '/');
  }
  if (resolvedPath.startsWith(publicDir)) {
    return '/' + path.relative(publicDir, resolvedPath).replace(/\\/g, '/');
  }
  return src;
}

function createFigureElement(imgNode: Element, mdPath: string): Element | null {
  const src = String(imgNode.properties?.src || '');
  const alt = String(imgNode.properties?.alt || '').trim();
  const title = String(imgNode.properties?.title || alt || '').trim();

  const resolvedPath = resolveSvgDiskPath(src, mdPath);
  if (!resolvedPath) {
    return null;
  }

  const svgRaw = fs.readFileSync(resolvedPath, 'utf8');
  const $ = cheerio.load(svgRaw, { xml: true });
  const $svg = $('svg').first();
  if ($svg.length === 0) {
    return null;
  }

  const existingClass = $svg.attr('class') || '';
  const classNames = new Set(existingClass.split(/\s+/).filter(Boolean));
  classNames.add('w-full');
  classNames.add('h-auto');
  classNames.add('max-w-full');
  $svg.attr('class', Array.from(classNames).join(' '));

  $svg.attr('role', 'img');
  const label = alt || title;
  if (label) {
    $svg.attr('aria-label', label);
  }

  if (!$svg.attr('viewBox')) {
    const w = $svg.attr('width');
    const h = $svg.attr('height');
    if (w && h && !w.includes('%') && !h.includes('%')) {
      $svg.attr('viewBox', `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
    }
  }

  // Scope internal SVG IDs to prevent duplicate ID collisions in HTML documents
  const hash = crypto.createHash('md5').update(resolvedPath).digest('hex').slice(0, 8);
  const prefix = `svg-${hash}-`;

  const idMap = new Map<string, string>();
  $svg.find('[id]').each((_, el) => {
    const oldId = $(el).attr('id');
    if (oldId && !oldId.startsWith(prefix)) {
      const newId = `${prefix}${oldId}`;
      idMap.set(oldId, newId);
      $(el).attr('id', newId);
    }
  });

  let svgContent = $.xml($svg);
  for (const [oldId, newId] of idMap.entries()) {
    const urlRegex = new RegExp(`url\\(#${oldId}\\)`, 'g');
    svgContent = svgContent.replace(urlRegex, `url(#${newId})`);
    const hrefRegex = new RegExp(`(href=["']#)${oldId}(["'])`, 'g');
    svgContent = svgContent.replace(hrefRegex, `$1${newId}$2`);
    const cssRegex = new RegExp(`(#)${oldId}(\\b)`, 'g');
    svgContent = svgContent.replace(cssRegex, `$1${newId}$2`);
  }

  const contentUrl = computeContentUrl(src, resolvedPath);

  const figureHtml = `
<figure class="svg-diagram my-8 overflow-hidden rounded-2xl border border-element-border bg-element-bg/50 p-2 sm:p-4" data-diagram-title="${escapeAttr(title)}" data-diagram-caption="${escapeAttr(alt)}">
  <meta itemprop="name" content="${escapeAttr(title)}" />
  <meta itemprop="description" content="${escapeAttr(alt)}" />
  <meta itemprop="contentUrl" content="${escapeAttr(contentUrl)}" />
  <div class="w-full overflow-x-auto flex justify-center">${svgContent}</div>
  <figcaption class="mt-2 text-center text-xs text-slate-400 light:text-slate-600 font-medium">${escapeHtml(alt)}</figcaption>
</figure>`.trim();

  const tree = fromHtml(figureHtml, { fragment: true });
  const figureNode = tree.children.find(
    (c: RootContent): c is Element => c.type === 'element' && c.tagName === 'figure'
  );

  return figureNode || null;
}

/**
 * Rehype plugin to inline local SVG images as accessible, responsive <figure> elements.
 * Transforms <p><img src="./diagram.svg" ...></p> into <figure class="svg-diagram ...">.
 */
export default function rehypeInlineSvg() {
  return function (tree: Root, file?: VFile) {
    const rawPath = file?.path || file?.history?.[0];
    if (!rawPath) {
      return;
    }
    const mdPath: string = rawPath;

    function transformChildren(parent: HastParent) {
      if (!Array.isArray(parent.children)) {
        return;
      }

      for (let i = 0; i < parent.children.length; i++) {
        const child = parent.children[i];
        if (!child || typeof child !== 'object') {
          continue;
        }

        // Case A: <p><img src="local.svg" ... /></p>
        if (child.type === 'element' && child.tagName === 'p') {
          const soleImg = getSoleSvgImgInParagraph(child);
          if (soleImg) {
            const figure = createFigureElement(soleImg, mdPath);
            if (figure) {
              parent.children[i] = figure;
              continue;
            }
          }
        }

        // Case B: Standalone <img> pointing to local SVG
        if (child.type === 'element' && isLocalSvgImg(child)) {
          const figure = createFigureElement(child, mdPath);
          if (figure) {
            parent.children[i] = figure;
            continue;
          }
        }

        // Case C: Recursively process child elements
        if (child.type === 'element' && Array.isArray(child.children)) {
          transformChildren(child);
        }
      }
    }

    transformChildren(tree);
  };
}
