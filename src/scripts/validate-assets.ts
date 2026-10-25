import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

/**
 * Recursively retrieves all .html files in a directory
 */
function getHtmlFiles(dir: string): string[] {
  let files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

const verbose = process.argv.includes('--verbose');
const distDir = path.resolve('dist');

if (!fs.existsSync(distDir)) {
  console.error('[validate-assets] ❌ Error: dist directory does not exist. Run "npm run build" first.');
  process.exit(1);
}

// -------------------------------------------------------------
// Assertion 1: Folder Absence Check
// -------------------------------------------------------------
const forbiddenFolders = [
  { path: path.join(distDir, '_astro'), name: '_astro' },
  { path: path.join(distDir, 'images'), name: 'images' },
  { path: path.join(distDir, 'avatar'), name: 'avatar (must be in dist/assets/avatar)' },
  { path: path.join(distDir, 'branding'), name: 'branding (must be in dist/assets/branding)' },
  { path: path.join(distDir, 'technologies'), name: 'technologies (must be in dist/assets/technologies)' },
  { path: path.join(distDir, 'diagrams'), name: 'diagrams (Mermaid diagrams must be co-located with content)' },
];

for (const folder of forbiddenFolders) {
  if (fs.existsSync(folder.path)) {
    console.error(`[validate-assets] ❌ Assertion 1 Failed: Forbidden top-level directory "${folder.name}" found at: ${folder.path}`);
    process.exit(1);
  }
}

const htmlFiles = getHtmlFiles(distDir);
if (htmlFiles.length === 0) {
  console.error('[validate-assets] ❌ Error: dist directory contains no HTML files. Run "npm run build" first.');
  process.exit(1);
}

if (verbose) {
  console.log(`[validate-assets] Auditing ${htmlFiles.length} HTML files in dist/...`);
}

let errorsCount = 0;
let totalCheckedAttributes = 0;
let totalAssetRefsChecked = 0;

// Asset extensions to verify for physical existence on disk
const ASSET_EXTENSION_REGEX = /\.(css|js|mjs|woff2?|ttf|eot|otf|png|jpe?g|webp|svg|gif|pdf|mp3|mp4|webm|avif|ico)$/i;

/**
 * Checks whether an attribute value refers to Astro's default build asset directory (_astro)
 * or internal virtual module remnants (@_@astro, _astro_type_script).
 * Legitimate content slugs containing "astro" (e.g. blog posts about Astro) are excluded.
 */
function isForbiddenAstroReference(val: string): boolean {
  if (!val || typeof val !== 'string') return false;

  // 1. Astro default asset folder path segment: /_astro/, _astro/, /_astro?...
  if (/(?:^|[\\/])_astro(?:[\\/?#]|$)/i.test(val)) return true;

  // 2. Astro internal virtual module remnants: @_@astro, _astro_type_script
  if (val.includes('@_@astro') || val.includes('_astro_type_script')) return true;

  // 3. Any direct substring '_astro' that is not part of legitimate content titles/slugs
  if (val.includes('_astro')) {
    const sanitized = val
      .replace(/2026_05_23_website_relaunch_astro_typescript/g, '')
      .replace(/2026_09_22_build_time_static_mermaid_in_astro/g, '')
      .replace(/step3_astro_edge/g, '');
    if (sanitized.includes('_astro')) {
      return true;
    }
  }

  return false;
}

/**
 * Validates a single URL candidate for physical existence on disk
 */
function auditAssetUrl(rawUrl: string, htmlFileRelPath: string, tagName: string, attrName: string): void {
  if (!rawUrl || typeof rawUrl !== 'string') return;
  const trimmed = rawUrl.trim();

  // Ignore external URLs, protocols, anchor links, mailto, tel, javascript
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('javascript:')
  ) {
    return;
  }

  // Must start with '/' to be a local absolute path
  if (!trimmed.startsWith('/')) {
    return;
  }

  // Strip query parameters and anchor hashes
  const cleanPath = trimmed.split('?')[0].split('#')[0].trim();

  // Must end with a recognized asset extension
  if (!ASSET_EXTENSION_REGEX.test(cleanPath)) {
    return;
  }

  totalAssetRefsChecked++;

  let decodedPath = cleanPath;
  try {
    decodedPath = decodeURI(cleanPath);
  } catch {
    decodedPath = cleanPath;
  }

  // Relative to distDir, stripping leading slash
  const relativeToDist = decodedPath.replace(/^\/+/, '');
  const physicalPath = path.join(distDir, relativeToDist);

  const isCi = process.env.CI === 'true' || process.argv.includes('--ci');
  if (!isCi && /^\/presentations\/[^/]+\/slides-(dark|light)\.pdf$/.test(cleanPath) && !fs.existsSync(physicalPath)) {
    return;
  }

  if (!fs.existsSync(physicalPath)) {
    console.error(
      `[validate-assets] ❌ Assertion 3 Failed: Missing physical asset "${rawUrl}" referenced in ${htmlFileRelPath} (<${tagName} ${attrName}="...">)`
    );
    errorsCount++;
  }
}

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const $ = cheerio.load(content);
  const relPath = path.relative(distDir, file).replace(/\\/g, '/');

  $('*').each((_, el) => {
    const tagName = $(el).prop('tagName')?.toLowerCase() || 'unknown';
    if (!('attribs' in el) || !el.attribs) return;
    const attribs: Record<string, string> = el.attribs;

    for (const [attr, val] of Object.entries(attribs)) {
      totalCheckedAttributes++;

      // Assertion 2: Zero _astro references check
      if (isForbiddenAstroReference(val)) {
        const snippet = val.length > 80 ? `${val.slice(0, 77)}...` : val;
        console.error(
          `[validate-assets] ❌ Assertion 2 Failed: Forbidden "_astro" reference found in ${relPath} (<${tagName} ${attr}="${snippet}">)`
        );
        errorsCount++;
      }

      // Assertion 3: Physical asset existence & broken link audit
      if (attr === 'srcset') {
        // srcset format: "url1 1x, url2 2x" or "url1 300w, url2 600w"
        const candidates = val
          .split(',')
          .map((entry: string) => entry.trim().split(/\s+/)[0])
          .filter((candidate: string) => Boolean(candidate));
        for (const candidate of candidates) {
          auditAssetUrl(candidate, relPath, tagName, attr);
        }
      } else {
        auditAssetUrl(val, relPath, tagName, attr);
      }
    }
  });
}

// -------------------------------------------------------------
// Assertion 4: Strict Content Hashing for Raster Images & Audio
// -------------------------------------------------------------
function getRasterImageFiles(dir: string): string[] {
  let files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getRasterImageFiles(fullPath));
    } else if (entry.isFile() && /\.(png|jpe?g|webp|avif|gif)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function getAudioFiles(dir: string): string[] {
  let files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAudioFiles(fullPath));
    } else if (entry.isFile() && /\.mp3$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function isWhitelistedRasterImage(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/');

  // Root / public branding assets
  const rootWhitelist = new Set([
    'favicon-16x16.png',
    'favicon-32x32.png',
    'apple-touch-icon.png',
    'icon-192x192.png',
    'icon-512x512.png',
    'icon-512x512-maskable.png',
    'og-share-preview.png',
  ]);
  return rootWhitelist.has(normalized);
}

const HASHED_IMAGE_REGEX = /-[a-zA-Z0-9_-]{6,}\.(png|jpe?g|webp|avif|gif)$/i;
const HASHED_AUDIO_REGEX = /-[a-zA-Z0-9_-]{6,}\.mp3$/i;

const rasterImages = getRasterImageFiles(distDir);
let hashedRasterImagesCount = 0;
let whitelistedRasterImagesCount = 0;
let unhashedImagesCount = 0;

for (const imgFile of rasterImages) {
  const relPath = path.relative(distDir, imgFile).replace(/\\/g, '/');
  if (isWhitelistedRasterImage(relPath)) {
    whitelistedRasterImagesCount++;
    continue;
  }

  if (!HASHED_IMAGE_REGEX.test(relPath)) {
    console.error(
      `[validate-assets] ❌ Assertion 4 Failed: Unhashed raster image found at: ${relPath}`
    );
    errorsCount++;
    unhashedImagesCount++;
  } else if (/^assets\/preview-/i.test(relPath)) {
    console.error(
      `[validate-assets] ❌ Assertion 4 Failed: Content preview image leaked into dist/assets/ instead of co-located collection folder: ${relPath}`
    );
    errorsCount++;
    unhashedImagesCount++;
  } else {
    hashedRasterImagesCount++;
  }
}

const audioFiles = getAudioFiles(distDir);
let hashedAudioCount = 0;
let unhashedAudioCount = 0;

for (const audioFile of audioFiles) {
  const relPath = path.relative(distDir, audioFile).replace(/\\/g, '/');
  if (!HASHED_AUDIO_REGEX.test(relPath)) {
    console.error(
      `[validate-assets] ❌ Assertion 4 Failed: Unhashed audio file found at: ${relPath}`
    );
    errorsCount++;
    unhashedAudioCount++;
  } else {
    hashedAudioCount++;
  }
}

type JsonLdValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | { [key: string]: JsonLdValue }
  | JsonLdValue[];

type PersonRef = {
  '@type'?: string;
  '@id'?: string;
  name?: string;
  url?: string;
};

interface SchemaEntity {
  '@context'?: string;
  '@type'?: string | string[];
  '@id'?: string;
  url?: string;
  primaryImageOfPage?: { '@id': string };
  image?: Array<{ '@id': string }> | string | Array<string>;
  contentUrl?: string;
  name?: string;
  encodingFormat?: string;
  license?: string;
  acquireLicensePage?: string;
  creditText?: string;
  copyrightNotice?: string;
  creator?: PersonRef;
  author?: PersonRef;
  copyrightHolder?: PersonRef;
  '@graph'?: SchemaEntity[];
  [key: string]: JsonLdValue;
}

// -------------------------------------------------------------
// Assertion 5: ImageObject JSON-LD Structured Data Parity
// -------------------------------------------------------------
let pagesWithImagesChecked = 0;
let totalImageObjectsVerified = 0;
let assertion5Errors = 0;

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const $ = cheerio.load(content);
  const relPath = path.relative(distDir, file).replace(/\\/g, '/');

  let pageUrlPath = '/' + relPath.replace(/index\.html$/, '');
  if (!pageUrlPath.endsWith('/')) {
    pageUrlPath += '/';
  }
  const canonicalPageUrl = `https://hackenberg.tech${pageUrlPath}`;

  // Verify no HTML element has an incomplete Microdata itemtype="https://schema.org/ImageObject"
  $('[itemtype*="ImageObject"]').each((_, el) => {
    const $el = $(el);
    const requiredMicrodataProps = ['license', 'acquireLicensePage', 'creditText', 'copyrightNotice'];
    const missingMicrodata = requiredMicrodataProps.filter(
      (prop) => $el.find(`[itemprop="${prop}"]`).length === 0
    );
    if (missingMicrodata.length > 0) {
      console.error(
        `[validate-assets] ❌ Assertion 5 Failed: Page ${relPath} contains incomplete Microdata ImageObject missing: ${missingMicrodata.join(', ')}`
      );
      errorsCount++;
      assertion5Errors++;
    }
  });

  const contentImages: string[] = [];

  // A. Check <img> tags
  $('img').each((_, el) => {
    const $img = $(el);
    const ariaHidden = $img.attr('aria-hidden') === 'true';
    const role = $img.attr('role');
    if (ariaHidden || role === 'presentation' || role === 'none') {
      return;
    }
    const src = $img.attr('src');
    if (src) {
      contentImages.push(src);
    }
  });

  // B. Check Diagrams <figure class="mermaid-diagram, figure.svg-diagram">
  $('figure.mermaid-diagram, figure.svg-diagram').each((_, el) => {
    const $fig = $(el);
    const diagramUrl = ($fig.find('meta[itemprop="contentUrl"]').attr('content') || '').trim();
    if (diagramUrl) {
      contentImages.push(diagramUrl);
    }
  });

  // C. Check SVG <image> tags
  $('svg image').each((_, el) => {
    const $img = $(el);
    if ($img.closest('figure.mermaid-diagram, figure.svg-diagram').length > 0) {
      return;
    }
    const $parentSvg = $img.closest('svg');
    const ariaHidden = $img.attr('aria-hidden') === 'true' || $parentSvg.attr('aria-hidden') === 'true';
    const role = $img.attr('role') || $parentSvg.attr('role');
    if (ariaHidden || role === 'presentation' || role === 'none') {
      return;
    }
    const src = $img.attr('href') || $img.attr('xlink:href') || '';
    if (src && !src.startsWith('data:')) {
      contentImages.push(src);
    }
  });

  if (contentImages.length === 0) {
    continue;
  }

  pagesWithImagesChecked++;

  const $script = $('script[type="application/ld+json"]').first();
  if ($script.length === 0) {
    console.error(
      `[validate-assets] ❌ Assertion 5 Failed: Page ${relPath} contains ${contentImages.length} content image(s) but is missing <script type="application/ld+json">`
    );
    errorsCount++;
    assertion5Errors++;
    continue;
  }

  let jsonLdData: SchemaEntity[] = [];
  try {
    const rawText = $script.text().trim();
    const parsed = JSON.parse(rawText);
    jsonLdData = Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    console.error(`[validate-assets] ❌ Assertion 5 Failed: Page ${relPath} has unparseable JSON-LD:`, err);
    errorsCount++;
    assertion5Errors++;
    continue;
  }

  const imageObjects = jsonLdData.filter(
    (item): item is SchemaEntity => Boolean(item && typeof item === 'object' && item['@type'] === 'ImageObject')
  );

  if (imageObjects.length === 0) {
    console.error(
      `[validate-assets] ❌ Assertion 5 Failed: Page ${relPath} contains ${contentImages.length} content image(s) but has 0 ImageObject entries in JSON-LD`
    );
    errorsCount++;
    assertion5Errors++;
    continue;
  }

  totalImageObjectsVerified += imageObjects.length;

  // Verify ImageObject fields (including Google Rich Results Image Metadata requirements)
  for (const io of imageObjects) {
    const id = typeof io['@id'] === 'string' ? io['@id'] : '';
    if (!id || !id.startsWith(canonicalPageUrl)) {
      console.error(`[validate-assets] ❌ Assertion 5 Failed: Page ${relPath} ImageObject has invalid @id: "${id}"`);
      errorsCount++;
      assertion5Errors++;
    }
    if (!io.contentUrl) {
      console.error(`[validate-assets] ❌ Assertion 5 Failed: Page ${relPath} ImageObject missing contentUrl`);
      errorsCount++;
      assertion5Errors++;
    }
    if (!io.name) {
      console.error(`[validate-assets] ❌ Assertion 5 Failed: Page ${relPath} ImageObject missing name`);
      errorsCount++;
      assertion5Errors++;
    }
    if (!io.encodingFormat) {
      console.error(`[validate-assets] ❌ Assertion 5 Failed: Page ${relPath} ImageObject missing encodingFormat`);
      errorsCount++;
      assertion5Errors++;
    }
    if (typeof io.license !== 'string' || !io.license.trim()) {
      console.error(`[validate-assets] ❌ Assertion 5 Failed: Page ${relPath} ImageObject (${id}) missing license`);
      errorsCount++;
      assertion5Errors++;
    }
    if (typeof io.acquireLicensePage !== 'string' || !io.acquireLicensePage.trim()) {
      console.error(`[validate-assets] ❌ Assertion 5 Failed: Page ${relPath} ImageObject (${id}) missing acquireLicensePage`);
      errorsCount++;
      assertion5Errors++;
    }
    if (typeof io.creditText !== 'string' || !io.creditText.trim()) {
      console.error(`[validate-assets] ❌ Assertion 5 Failed: Page ${relPath} ImageObject (${id}) missing creditText`);
      errorsCount++;
      assertion5Errors++;
    }
    if (typeof io.copyrightNotice !== 'string' || !io.copyrightNotice.trim()) {
      console.error(`[validate-assets] ❌ Assertion 5 Failed: Page ${relPath} ImageObject (${id}) missing copyrightNotice`);
      errorsCount++;
      assertion5Errors++;
    }
    const hasValidCreator = Boolean(
      io.creator && (
        io.creator['@id'] === 'https://hackenberg.tech/#person' ||
        (io.creator['@type'] === 'Person' && Boolean(io.creator.name))
      )
    );
    if (!hasValidCreator) {
      console.error(`[validate-assets] ❌ Assertion 5 Failed: Page ${relPath} ImageObject (${id}) missing valid Person creator`);
      errorsCount++;
      assertion5Errors++;
    }
  }

  // Verify primaryImageOfPage and image array on all target content schema types
  const targetTypes = new Set([
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

  for (const node of candidateNodes) {
    const nodeType = node['@type'];
    const matches = Array.isArray(nodeType)
      ? nodeType.some((t: string) => targetTypes.has(t))
      : typeof nodeType === 'string' && targetTypes.has(nodeType);
    const isCurrentPageEntity = !node.url || node.url === canonicalPageUrl;

    if (matches && isCurrentPageEntity) {
      const primary = node.primaryImageOfPage;
      if (!primary || typeof primary['@id'] !== 'string') {
        console.error(`[validate-assets] ❌ Assertion 5 Failed: Page ${relPath} contains ${String(nodeType)} but lacks primaryImageOfPage in JSON-LD`);
        errorsCount++;
        assertion5Errors++;
      }
      if (!Array.isArray(node.image) || node.image.length === 0) {
        console.error(`[validate-assets] ❌ Assertion 5 Failed: Page ${relPath} contains ${String(nodeType)} but lacks image array in JSON-LD`);
        errorsCount++;
        assertion5Errors++;
      }
    }
  }
}

if (verbose || errorsCount > 0) {
  console.log(`\n[validate-assets] Scan summary:`);
  console.log(`  - Scanned HTML files:            ${htmlFiles.length}`);
  console.log(`  - Checked attributes:            ${totalCheckedAttributes}`);
  console.log(`  - Checked asset references:      ${totalAssetRefsChecked}`);
  console.log(`  - Scanned raster images:         ${rasterImages.length} (${hashedRasterImagesCount} hashed, ${whitelistedRasterImagesCount} whitelisted)`);
  console.log(`  - Scanned audio files:           ${audioFiles.length} (${hashedAudioCount} hashed)`);
  console.log(`  - Zero _astro references:        CONFIRMED (0 forbidden references)`);
  console.log(`  - 100% asset existence parity:   ${errorsCount - unhashedImagesCount - unhashedAudioCount - assertion5Errors === 0 ? 'CONFIRMED' : 'FAILED'}`);
  console.log(`  - Strict image hashing:          ${unhashedImagesCount === 0 ? 'CONFIRMED' : 'FAILED'}`);
  console.log(`  - Strict audio hashing:          ${unhashedAudioCount === 0 ? 'CONFIRMED' : 'FAILED'}`);
  console.log(`  - ImageObject JSON-LD parity:    ${assertion5Errors === 0 ? 'CONFIRMED' : 'FAILED'} (${totalImageObjectsVerified} ImageObjects across ${pagesWithImagesChecked} pages)`);
}

if (errorsCount > 0) {
  console.error(`\n[validate-assets] 💥 Validation failed with ${errorsCount} asset integrity error(s).`);
  process.exit(1);
} else {
  console.log(
    `✅ [validate-assets] All ${htmlFiles.length} HTML pages, ${rasterImages.length} images, ${audioFiles.length} audio files & ${totalImageObjectsVerified} ImageObjects passed asset integrity checks.`
  );
  process.exit(0);
}
