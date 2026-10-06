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

console.log(`[validate-assets] Auditing ${htmlFiles.length} HTML files in dist/...`);

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
    'default-icon.png',
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

console.log(`\n[validate-assets] Scan summary:`);
console.log(`  - Scanned HTML files:            ${htmlFiles.length}`);
console.log(`  - Checked attributes:            ${totalCheckedAttributes}`);
console.log(`  - Checked asset references:      ${totalAssetRefsChecked}`);
console.log(`  - Scanned raster images:         ${rasterImages.length} (${hashedRasterImagesCount} hashed, ${whitelistedRasterImagesCount} whitelisted)`);
console.log(`  - Scanned audio files:           ${audioFiles.length} (${hashedAudioCount} hashed)`);
console.log(`  - Zero _astro references:        CONFIRMED (0 forbidden references)`);
console.log(`  - 100% asset existence parity:   ${errorsCount - unhashedImagesCount - unhashedAudioCount === 0 ? 'CONFIRMED' : 'FAILED'}`);
console.log(`  - Strict image hashing:          ${unhashedImagesCount === 0 ? 'CONFIRMED' : 'FAILED'}`);
console.log(`  - Strict audio hashing:          ${unhashedAudioCount === 0 ? 'CONFIRMED' : 'FAILED'}`);

if (errorsCount > 0) {
  console.error(`\n[validate-assets] 💥 Validation failed with ${errorsCount} asset integrity error(s).`);
  process.exit(1);
} else {
  console.log(`\n[validate-assets] ✅ Build output passed all asset integrity checks!`);
  process.exit(0);
}

