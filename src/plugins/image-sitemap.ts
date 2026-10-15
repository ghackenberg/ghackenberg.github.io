import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const SITE_ORIGIN = 'https://hackenberg.tech';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toAbsoluteImageUrl(src: string, pageUrlPath: string): string {
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractSemanticSlug(src: string, title?: string): string {
  let base = '';
  if (src && !src.startsWith('data:')) {
    const rawFilename = path.basename(src.split('?')[0].split('#')[0]);
    const noExt = rawFilename.replace(/\.[a-zA-Z0-9]+$/, '');
    // Strip Astro / Vite hash suffixes:
    // system_architecture.BNv8c83L_Z18dULf.webp -> system_architecture
    // hero-georg-whiteboard-pom.Cfp0wmTc_Z3FF1s.webp -> hero-georg-whiteboard-pom
    // preview-a1b2c3d4.jpg -> preview
    const noHash = noExt
      .replace(/\.[a-zA-Z0-9_-]{6,}(?:_[a-zA-Z0-9_-]+)?$/i, '')
      .replace(/-[a-zA-Z0-9_-]{6,}$/i, '');

    const candidate = slugify(noHash);
    const isPureHash = /^[a-f0-9]{16,}$/i.test(candidate);
    const isGeneric = ['image', 'img', 'preview', 'thumb', 'thumbnail', 'diagram', 'icon', 'asset'].includes(candidate);

    if (candidate && !isPureHash && !isGeneric) {
      base = candidate;
    }
  }

  if (!base && title) {
    base = slugify(title);
  }

  return base || 'image';
}

class PageSlugRegistry {
  private seen = new Set<string>();

  getUniqueSlug(baseSlug: string): string {
    if (!this.seen.has(baseSlug)) {
      this.seen.add(baseSlug);
      return baseSlug;
    }
    let suffix = 1;
    while (this.seen.has(`${baseSlug}-${suffix}`)) {
      suffix++;
    }
    const unique = `${baseSlug}-${suffix}`;
    this.seen.add(unique);
    return unique;
  }
}

function getMimeType(urlOrPath: string): string {
  const clean = urlOrPath.split('?')[0].split('#')[0].toLowerCase();
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  if (clean.endsWith('.svg')) return 'image/svg+xml';
  if (clean.endsWith('.gif')) return 'image/gif';
  if (clean.endsWith('.avif')) return 'image/avif';
  return 'image/jpeg';
}

interface ImageViolation {
  pageUrl: string;
  htmlFile: string;
  src: string;
  problems: string[];
  snippet: string;
}

interface PageImage {
  url: string;
  src: string;
  title: string;
  caption: string;
}

interface PageData {
  htmlFile: string;
  canonicalPageUrl: string;
  images: PageImage[];
}

type JsonLdValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | { [key: string]: JsonLdValue }
  | JsonLdValue[];

interface SchemaEntity {
  '@context'?: string;
  '@type'?: string | string[];
  '@id'?: string;
  url?: string;
  headline?: string;
  name?: string;
  description?: string;
  primaryImageOfPage?: { '@id': string };
  image?: Array<{ '@id': string }> | string | Array<string>;
  '@graph'?: SchemaEntity[];
  [key: string]: JsonLdValue;
}

/**
 * Scans all generated HTML files in dist/, validates every image against zero-fallback criteria,
 * enriches Schema.org ImageObject structured data in every page's JSON-LD script,
 * and enriches all sitemap-*.xml files with standard-compliant <image:image> blocks.
 */
export async function validateAndEnrichImageSitemaps(): Promise<void> {
  const distDir = path.resolve(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    console.warn('[image-enforcer] dist/ directory does not exist, skipping validation.');
    return;
  }

  // 1. Gather all HTML files
  const htmlFiles: string[] = [];
  function walkHtml(dir: string) {
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

  const errors: ImageViolation[] = [];
  const pageImagesMap = new Map<string, PageImage[]>();
  const pageDataList: PageData[] = [];
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
    const imagesForPage: PageImage[] = [];
    const seenImageUrls = new Set<string>();

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
      const missingProps: string[] = [];
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
          src,
          title,
          caption: alt,
        });
      }
    });

    // B. Validate Diagrams <figure class="mermaid-diagram, figure.svg-diagram">
    $('figure.mermaid-diagram, figure.svg-diagram').each((_, el) => {
      totalImagesScanned++;
      const $fig = $(el);
      const diagramTitle = ($fig.attr('data-diagram-title') || $fig.find('meta[itemprop="name"]').attr('content') || '').trim();
      const diagramCaption = ($fig.attr('data-diagram-caption') || $fig.find('meta[itemprop="description"]').attr('content') || '').trim();
      const diagramContentUrl = ($fig.find('meta[itemprop="contentUrl"]').attr('content') || '').trim();

      const missingProps: string[] = [];
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
          src: diagramContentUrl,
          title: diagramTitle,
          caption: diagramCaption,
        });
      }
    });

    // C. Validate SVG <image> tags
    $('svg image').each((_, el) => {
      const $img = $(el);
      // Skip if inside a Mermaid or SVG figure (already handled in Step B)
      if ($img.closest('figure.mermaid-diagram, figure.svg-diagram').length > 0) {
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
      const missingProps: string[] = [];
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
          src,
          title,
          caption,
        });
      }
    });

    if (imagesForPage.length > 0) {
      pageImagesMap.set(canonicalPageUrl, imagesForPage);
      if (canonicalPageUrl.endsWith('/')) {
        pageImagesMap.set(canonicalPageUrl.slice(0, -1), imagesForPage);
      }
      pageDataList.push({
        htmlFile,
        canonicalPageUrl,
        images: imagesForPage,
      });
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

  // 4. Enrich JSON-LD Structured Data in every generated HTML file
  let totalHtmlEnriched = 0;
  let totalImageObjectsCreated = 0;

  const personEntity = {
    '@type': 'Person',
    '@id': 'https://hackenberg.tech/#person',
    name: 'Dr. Georg Hackenberg',
    url: 'https://hackenberg.tech',
  };

  const targetArticleTypes = new Set([
    'Article',
    'BlogPosting',
    'TechArticle',
    'ScholarlyArticle',
    'Course',
    'LearningResource',
    'PresentationDigitalDocument',
    'SoftwareApplication',
    'SoftwareSourceCode',
    'Service',
  ]);

  for (const pageData of pageDataList) {
    const { htmlFile, canonicalPageUrl, images } = pageData;
    const slugRegistry = new PageSlugRegistry();

    let html = fs.readFileSync(htmlFile, 'utf8');
    const $ = cheerio.load(html);
    const $script = $('script[type="application/ld+json"]').first();

    let jsonLdData: SchemaEntity[] = [];
    if ($script.length > 0) {
      const rawText = $script.text().trim();
      if (rawText) {
        try {
          const parsed = JSON.parse(rawText);
          jsonLdData = Array.isArray(parsed) ? parsed : [parsed];
        } catch (err) {
          console.warn(`[image-enforcer] Failed to parse JSON-LD in ${htmlFile}:`, err);
          jsonLdData = [];
        }
      }
    }

    const candidateNodes: SchemaEntity[] = [];
    for (const node of jsonLdData) {
      if (!node || typeof node !== 'object') continue;
      candidateNodes.push(node);
      if (Array.isArray(node['@graph'])) {
        for (const graphNode of node['@graph']) {
          if (graphNode && typeof graphNode === 'object') {
            candidateNodes.push(graphNode as SchemaEntity);
          }
        }
      }
    }

    // Ensure any physical hero/preview image declared on a target schema entity is included as the primary image
    for (const node of candidateNodes) {
      const nodeType = node['@type'];
      const matches = Array.isArray(nodeType)
        ? nodeType.some((t: string) => targetArticleTypes.has(t))
        : typeof nodeType === 'string' && targetArticleTypes.has(nodeType);
      const isCurrentPageEntity = !node.url || node.url === canonicalPageUrl;
      if (matches && isCurrentPageEntity && typeof node.image === 'string' && node.image.startsWith(SITE_ORIGIN)) {
        const heroUrl = node.image.trim();
        const relAssetPath = heroUrl.slice(SITE_ORIGIN.length).replace(/^\/+/, '');
        const physicalHeroPath = path.join(distDir, relAssetPath);
        if (fs.existsSync(physicalHeroPath) && !images.some((img) => img.url === heroUrl)) {
          const heroTitle =
            (typeof node.headline === 'string' && node.headline.trim()) ||
            (typeof node.name === 'string' && node.name.trim()) ||
            'Preview Image';
          const heroCaption =
            (typeof node.description === 'string' && node.description.trim()) ||
            `${heroTitle} – preview image`;
          images.unshift({
            url: heroUrl,
            src: heroUrl,
            title: heroTitle,
            caption: heroCaption,
          });
        }
      }
    }

    // Construct standard-compliant Schema.org ImageObject for each extracted image
    const imageObjects = images.map((img) => {
      const baseSlug = extractSemanticSlug(img.src, img.title);
      const uniqueSlug = slugRegistry.getUniqueSlug(baseSlug);
      const entityId = `${canonicalPageUrl}#image-${uniqueSlug}`;
      const mimeType = getMimeType(img.url);

      return {
        '@context': 'https://schema.org',
        '@type': 'ImageObject',
        '@id': entityId,
        url: entityId,
        contentUrl: img.url,
        name: img.title,
        caption: img.caption,
        description: img.caption,
        encodingFormat: mimeType,
        license: 'https://hackenberg.tech/impressum/#urheberrecht',
        acquireLicensePage: 'https://hackenberg.tech/impressum/#kontakt',
        creditText: 'Dr. Georg Hackenberg',
        copyrightNotice: '© Dr. Georg Hackenberg. All rights reserved.',
        author: { ...personEntity },
        creator: { ...personEntity },
        copyrightHolder: { ...personEntity },
        isPartOf: { '@id': canonicalPageUrl },
      };
    });

    // Link primary image and image collection for all target content schema types
    const primaryImage = imageObjects[0];
    const imageRefs = imageObjects.map((io) => ({ '@id': io['@id'] }));

    for (const node of candidateNodes) {
      const nodeType = node['@type'];
      const matches = Array.isArray(nodeType)
        ? nodeType.some((t: string) => targetArticleTypes.has(t))
        : typeof nodeType === 'string' && targetArticleTypes.has(nodeType);
      const isCurrentPageEntity = !node.url || node.url === canonicalPageUrl;
      if (matches && isCurrentPageEntity) {
        node.primaryImageOfPage = { '@id': primaryImage['@id'] };
        node.image = imageRefs;
      }
    }

    // Filter out existing ImageObjects for this page's namespace to ensure idempotent runs
    const filteredNodes = jsonLdData.filter((node: SchemaEntity) => {
      if (!node || typeof node !== 'object') return true;
      if (node['@type'] === 'ImageObject') {
        const id = typeof node['@id'] === 'string' ? node['@id'] : '';
        if (id.startsWith(`${canonicalPageUrl}#image-`)) {
          return false;
        }
      }
      return true;
    });

    // Append ImageObject nodes to JSON-LD array
    const enrichedJsonLd = [...filteredNodes, ...imageObjects];
    const jsonString = JSON.stringify(enrichedJsonLd, null, 2);

    const scriptRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i;
    if (scriptRegex.test(html)) {
      html = html.replace(scriptRegex, `<script type="application/ld+json">\n${jsonString}\n    </script>`);
    } else if (html.includes('</head>')) {
      html = html.replace('</head>', `    <script type="application/ld+json">\n${jsonString}\n    </script>\n  </head>`);
    } else {
      html += `\n<script type="application/ld+json">\n${jsonString}\n</script>\n`;
    }

    fs.writeFileSync(htmlFile, html, 'utf8');
    totalHtmlEnriched++;
    totalImageObjectsCreated += imageObjects.length;
  }

  console.log(`[image-enforcer] Successfully enriched ${totalHtmlEnriched} HTML files with ${totalImageObjectsCreated} ImageObject JSON-LD entities.`);

  // 5. Enrich existing sitemap-*.xml files with <image:image> blocks
  const sitemapFiles = fs.readdirSync(distDir)
    .filter(f => f.startsWith('sitemap-') && f.endsWith('.xml') && f !== 'sitemap-index.xml')
    .map(f => path.join(distDir, f));

  let totalImagesEnriched = 0;
  for (const sitemapPath of sitemapFiles) {
    let xml = fs.readFileSync(sitemapPath, 'utf8');
    let modified = false;

    xml = xml.replace(/<url>([\s\S]*?)<\/url>/g, (match, inner) => {
      const locMatch = inner.match(/<loc>(.*?)<\/loc>/);
      if (!locMatch) return match;
      const pageLoc = locMatch[1].trim();
      const images = pageImagesMap.get(pageLoc);
      if (!images || images.length === 0) return match;

      if (inner.includes('<image:image>')) return match;

      const imageXmlBlocks = images.map(img => `
  <image:image>
    <image:loc>${escapeXml(img.url)}</image:loc>
    <image:title>${escapeXml(img.title)}</image:title>
    <image:caption>${escapeXml(img.caption)}</image:caption>
  </image:image>`.trim()).join('\n    ');

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
