// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const SITE_ORIGIN = 'https://hackenberg.tech';

/**
 * Escapes XML special characters.
 * @param {string} str
 * @returns {string}
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Normalizes an image path to an absolute URL with site origin.
 * @param {string} src
 * @param {string} pageUrlPath
 * @returns {string}
 */
function toAbsoluteImageUrl(src, pageUrlPath) {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  if (src.startsWith('/')) {
    return `${SITE_ORIGIN}${src}`;
  }
  const cleanBase = pageUrlPath.endsWith('/') ? pageUrlPath : `${pageUrlPath}/`;
  return new URL(src, `${SITE_ORIGIN}${cleanBase}`).href;
}

/**
 * Scans all generated HTML files in dist/, validates every image against zero-fallback criteria,
 * and enriches all sitemap-*.xml files with standard-compliant <image:image> blocks.
 */
export async function validateAndEnrichImageSitemaps() {
  const distDir = path.resolve(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    console.warn('[image-enforcer] dist/ directory does not exist, skipping validation.');
    return;
  }

  // 1. Gather all HTML files
  /** @type {string[]} */
  const htmlFiles = [];
  /** @param {string} dir */
  function walkHtml(dir) {
    for (const item of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walkHtml(fullPath);
      } else if (item.endsWith('.html')) {
        htmlFiles.push(fullPath);
      }
    }
  }
  walkHtml(distDir);

  /** @type {Array<{ pageUrl: string, htmlFile: string, src: string, problems: string[], snippet: string }>} */
  const errors = [];
  /** @type {Map<string, Array<{ url: string, title: string, caption: string }>>} */
  const pageImagesMap = new Map();
  let totalImagesScanned = 0;

  // 2. Scan and validate each HTML file
  for (const htmlFile of htmlFiles) {
    const relHtmlPath = path.relative(distDir, htmlFile).replace(/\\/g, '/');
    let pageUrlPath = '/' + relHtmlPath.replace(/index\.html$/, '');
    if (!pageUrlPath.endsWith('/')) {
      pageUrlPath += '/';
    }
    const canonicalPageUrl = `${SITE_ORIGIN}${pageUrlPath}`;

    const html = fs.readFileSync(htmlFile, 'utf8');
    const $ = cheerio.load(html);
    /** @type {Array<{ url: string, title: string, caption: string }>} */
    const imagesForPage = [];
    const seenImageUrls = new Set();

    // A. Validate <img> tags
    $('img').each((_, el) => {
      totalImagesScanned++;
      const $img = $(el);
      const src = $img.attr('src') || '';
      const alt = ($img.attr('alt') || '').trim();
      const title = ($img.attr('title') || '').trim();
      const ariaHidden = $img.attr('aria-hidden') === 'true';
      const role = $img.attr('role');

      // Decorative images marked explicitly are exempt
      if (ariaHidden || role === 'presentation' || role === 'none') {
        return;
      }

      // Strict Zero-Fallback Validation
      const missingProps = [];
      if (!alt || alt.length < 3) {
        missingProps.push('Missing or too short alt attribute (caption/description, min 3 chars)');
      }
      if (!title || title.length < 3) {
        missingProps.push('Missing or too short title attribute (min 3 chars)');
      }
      if (alt && title && alt.toLowerCase() === title.toLowerCase()) {
        missingProps.push('alt and title must be distinct (provide a concise title and a detailed descriptive caption)');
      }

      if (missingProps.length > 0) {
        errors.push({
          htmlFile: relHtmlPath,
          pageUrl: canonicalPageUrl,
          src,
          snippet: $.html(el),
          problems: missingProps,
        });
        return;
      }

      const absUrl = toAbsoluteImageUrl(src, pageUrlPath);
      if (absUrl && !seenImageUrls.has(absUrl)) {
        seenImageUrls.add(absUrl);
        imagesForPage.push({
          url: absUrl,
          title,
          caption: alt,
        });
      }
    });

    // B. Validate Mermaid <figure class="mermaid-diagram">
    $('figure.mermaid-diagram').each((_, el) => {
      totalImagesScanned++;
      const $fig = $(el);
      const diagramTitle = ($fig.attr('data-diagram-title') || $fig.find('meta[itemprop="name"]').attr('content') || '').trim();
      const diagramCaption = ($fig.attr('data-diagram-caption') || $fig.find('meta[itemprop="description"]').attr('content') || '').trim();
      const diagramContentUrl = ($fig.find('meta[itemprop="contentUrl"]').attr('content') || '').trim();

      const missingProps = [];
      if (!diagramTitle || diagramTitle.length < 3) {
        missingProps.push('Missing or too short diagram title (min 3 chars)');
      }
      if (!diagramCaption || diagramCaption.length < 5) {
        missingProps.push('Missing or too short diagram caption (min 5 chars)');
      }
      if (!diagramContentUrl) {
        missingProps.push('Missing contentUrl for exported diagram SVG asset');
      }

      if (missingProps.length > 0) {
        errors.push({
          htmlFile: relHtmlPath,
          pageUrl: canonicalPageUrl,
          src: diagramContentUrl || 'mermaid-diagram',
          snippet: $.html(el).slice(0, 200) + '...',
          problems: missingProps,
        });
        return;
      }

      const absUrl = toAbsoluteImageUrl(diagramContentUrl, pageUrlPath);
      if (absUrl && !seenImageUrls.has(absUrl)) {
        seenImageUrls.add(absUrl);
        imagesForPage.push({
          url: absUrl,
          title: diagramTitle,
          caption: diagramCaption,
        });
      }
    });

    // C. Validate SVG <image> tags
    $('svg image').each((_, el) => {
      const $img = $(el);
      // Skip if inside a Mermaid figure (already handled in Step B)
      if ($img.closest('figure.mermaid-diagram').length > 0) {
        return;
      }

      totalImagesScanned++;
      const src = $img.attr('href') || $img.attr('xlink:href') || '';
      const $parentSvg = $img.closest('svg');

      // Decorative images marked explicitly are exempt
      const ariaHidden = $img.attr('aria-hidden') === 'true' || $parentSvg.attr('aria-hidden') === 'true';
      const role = $img.attr('role') || $parentSvg.attr('role');
      if (ariaHidden || role === 'presentation' || role === 'none') {
        return;
      }

      // Inline data URIs cannot be registered in sitemaps
      if (src.startsWith('data:')) {
        return;
      }

      const title = ($img.attr('title') || '').trim();
      const caption = ($img.attr('aria-label') || $img.attr('alt') || '').trim();

      // Strict Zero-Fallback Validation
      const missingProps = [];
      if (!src) {
        missingProps.push('Missing href or xlink:href attribute on svg image element');
      }
      if (!title || title.length < 3) {
        missingProps.push('Missing or too short title attribute on svg image element (min 3 chars)');
      }
      if (!caption || caption.length < 3) {
        missingProps.push('Missing or too short aria-label / description attribute on svg image element (min 3 chars)');
      }
      if (title && caption && title.toLowerCase() === caption.toLowerCase()) {
        missingProps.push('title and aria-label / description must be distinct (provide a concise title and a detailed descriptive caption)');
      }

      if (missingProps.length > 0) {
        errors.push({
          htmlFile: relHtmlPath,
          pageUrl: canonicalPageUrl,
          src,
          snippet: $.html(el),
          problems: missingProps,
        });
        return;
      }

      const absUrl = toAbsoluteImageUrl(src, pageUrlPath);
      if (absUrl && !seenImageUrls.has(absUrl)) {
        seenImageUrls.add(absUrl);
        imagesForPage.push({
          url: absUrl,
          title,
          caption,
        });
      }
    });

    if (imagesForPage.length > 0) {
      pageImagesMap.set(canonicalPageUrl, imagesForPage);
      // Also register without trailing slash just in case
      if (canonicalPageUrl.endsWith('/')) {
        pageImagesMap.set(canonicalPageUrl.slice(0, -1), imagesForPage);
      }
    }
  }

  // 3. Fail Fast if any image violates strict zero-fallback rules
  if (errors.length > 0) {
    console.error('\n' + '='.repeat(80));
    console.error(`[IMAGE VALIDATION FAILED] Found ${errors.length} image(s) violating strict metadata requirements:\n`);
    for (let i = 0; i < errors.length; i++) {
      const err = errors[i];
      console.error(`--- Error #${i + 1} ---`);
      console.error(`Page URL:     ${err.pageUrl}`);
      console.error(`HTML File:    dist/${err.htmlFile}`);
      console.error(`Image Source: ${err.src}`);
      console.error('Violations:');
      for (const p of err.problems) {
        console.error(`  [X] ${p}`);
      }
      console.error('Snippet:');
      console.error(`  ${err.snippet.slice(0, 150)}`);
      console.error('Action Required:');
      console.error('  1. For Markdown images: Ensure ![caption](url "title") has distinct caption and title.');
      console.error('  2. For .astro components: Pass both alt="..." and title="..." with distinct values.');
      console.error('  3. If purely decorative: Add aria-hidden="true" or role="presentation".\n');
    }
    console.error('='.repeat(80) + '\n');
    throw new Error(`Image validation failed with ${errors.length} error(s). Every image must have distinct title and caption.`);
  }

  console.log(`[image-enforcer] Passed! All ${totalImagesScanned} image instances have valid, distinct title and caption.`);

  // 4. Enrich existing sitemap-*.xml files with <image:image> blocks
  const sitemapFiles = fs.readdirSync(distDir)
    .filter(f => f.startsWith('sitemap-') && f.endsWith('.xml') && f !== 'sitemap-index.xml')
    .map(f => path.join(distDir, f));

  let totalImagesEnriched = 0;
  for (const sitemapPath of sitemapFiles) {
    let xml = fs.readFileSync(sitemapPath, 'utf8');
    let modified = false;

    // Regex to match each <url>...</url> block
    xml = xml.replace(/<url>([\s\S]*?)<\/url>/g, (match, inner) => {
      const locMatch = inner.match(/<loc>(.*?)<\/loc>/);
      if (!locMatch) return match;
      const pageLoc = locMatch[1].trim();
      const images = pageImagesMap.get(pageLoc);
      if (!images || images.length === 0) return match;

      // Don't re-add if already present
      if (inner.includes('<image:image>')) return match;

      const imageXmlBlocks = images.map(img => `
  <image:image>
    <image:loc>${escapeXml(img.url)}<\/image:loc>
    <image:title>${escapeXml(img.title)}<\/image:title>
    <image:caption>${escapeXml(img.caption)}<\/image:caption>
  <\/image:image>`.trim()).join('\n    ');

      totalImagesEnriched += images.length;
      modified = true;

      return `<url>${inner}
    ${imageXmlBlocks}
  </url>`;
    });

    if (modified) {
      fs.writeFileSync(sitemapPath, xml, 'utf8');
    }
  }

  console.log(`[image-enforcer] Successfully enriched sitemaps with ${totalImagesEnriched} <image:image> entries across ${sitemapFiles.length} sitemap files.`);
}
