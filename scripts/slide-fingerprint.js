// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ENGINE_VERSION = 'v1.0';

/**
 * Recursively retrieves all files in a directory matching extensions
 * @param {string} dir
 * @param {string[]} extensions
 * @returns {string[]}
 */
function getFilesRecursively(dir, extensions = ['.astro', '.js', '.ts', '.css']) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  /** @type {string[]} */
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFilesRecursively(fullPath, extensions));
    } else if (entry.isFile() && extensions.includes(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Computes composite SHA-256 hash of all slide-relevant styling and layout templates
 * @returns {string}
 */
export function computeSlideStyleHash() {
  const hash = crypto.createHash('sha256');
  hash.update(`ENGINE:${ENGINE_VERSION}:`);

  const keyFiles = [
    path.resolve('src/styles/theme.css'),
    path.resolve('src/styles/slides.css'),
    path.resolve('src/pages/presentations/[slug]/print.astro'),
    path.resolve('src/utils/slide-cues.js'),
  ];

  for (const file of keyFiles) {
    if (fs.existsSync(file)) {
      hash.update(path.relative(process.cwd(), file).replace(/\\/g, '/'));
      hash.update(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
    }
  }

  // Slide layout and primitive components
  const slideComponentFiles = getFilesRecursively(path.resolve('src/components/slides')).sort();
  for (const file of slideComponentFiles) {
    hash.update(path.relative(process.cwd(), file).replace(/\\/g, '/'));
    hash.update(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
  }

  return hash.digest('hex');
}

/**
 * Extracts visual frontmatter and body from slide MDX content, excluding voiceover/notes
 * @param {string} content
 * @returns {string}
 */
export function extractSlideVisualContent(content) {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  let visualFrontmatter = '';
  let bodyContent = content;

  if (frontmatterMatch) {
    const yamlLines = frontmatterMatch[1].split(/\r?\n/);
    const filteredYaml = [];
    let skippingNarrative = false;

    for (const line of yamlLines) {
      // Check for voiceover or notes start
      if (/^(voiceover|notes)\s*:/.test(line)) {
        skippingNarrative = true;
        continue;
      }

      // Check if a new top-level YAML key begins
      if (/^[a-zA-Z0-9_-]+\s*:/.test(line)) {
        skippingNarrative = false;
      }

      if (!skippingNarrative) {
        filteredYaml.push(line);
      }
    }

    visualFrontmatter = filteredYaml.join('\n').trim();
    bodyContent = content.slice(frontmatterMatch[0].length);
  }

  // Normalize body whitespace and line breaks
  const normalizedBody = bodyContent.replace(/\r\n/g, '\n').trim();

  return `${visualFrontmatter}\n---\n${normalizedBody}`;
}

/**
 * Computes composite visual hash for a single slide file
 * @param {string} slideFilePath
 * @param {string} styleHash
 * @returns {string}
 */
export function computeSlideVisualHash(slideFilePath, styleHash) {
  if (!fs.existsSync(slideFilePath)) return '';
  const content = fs.readFileSync(slideFilePath, 'utf8');
  const visualContent = extractSlideVisualContent(content);

  return crypto
    .createHash('sha256')
    .update(styleHash)
    .update(':SLIDE:')
    .update(visualContent)
    .digest('hex');
}

/**
 * Computes composite deck hash for PDF export and overall deck validation
 * @param {string} presentationFolder Name of presentation directory in src/content/presentations
 * @param {string} styleHash
 * @returns {{ deckHash: string, slideHashes: Record<string, string> }}
 */
export function computePresentationDeckHash(presentationFolder, styleHash) {
  const presDir = path.resolve('src/content/presentations', presentationFolder);
  const slidesDir = path.join(presDir, 'slides');
  /** @type {Record<string, string>} */
  const slideHashes = {};

  const deckHasher = crypto.createHash('sha256');
  deckHasher.update(styleHash);
  deckHasher.update(`:DECK:${presentationFolder}:`);

  if (fs.existsSync(slidesDir)) {
    const slideFiles = fs.readdirSync(slidesDir)
      .filter(f => f.endsWith('.mdx') || f.endsWith('.md'))
      .sort();

    for (const slideFile of slideFiles) {
      const slideId = slideFile.replace(/\.(mdx|md)$/, '');
      const slidePath = path.join(slidesDir, slideFile);
      const sHash = computeSlideVisualHash(slidePath, styleHash);
      slideHashes[slideId] = sHash;
      deckHasher.update(`${slideId}:${sHash};`);
    }
  }

  // Hash local images directory if present
  const imagesDir = path.join(presDir, 'images');
  if (fs.existsSync(imagesDir)) {
    const imgFiles = getFilesRecursively(imagesDir, ['.png', '.jpg', '.jpeg', '.webp', '.svg']).sort();
    for (const imgFile of imgFiles) {
      deckHasher.update(path.relative(presDir, imgFile).replace(/\\/g, '/'));
      deckHasher.update(fs.readFileSync(imgFile));
    }
  }

  // Hash index.md metadata if present
  const indexFile = path.join(presDir, 'index.md');
  if (fs.existsSync(indexFile)) {
    deckHasher.update(fs.readFileSync(indexFile, 'utf8').replace(/\r\n/g, '\n'));
  }

  return {
    deckHash: deckHasher.digest('hex'),
    slideHashes
  };
}

/**
 * @typedef {Object} VisualCache
 * @property {string} version
 * @property {string} styleHash
 * @property {string} deckHash
 * @property {Record<string, string>} slides
 */

/**
 * Loads the visual cache for a presentation
 * @param {string} presentationFolder
 * @returns {VisualCache | null}
 */
export function loadVisualCache(presentationFolder) {
  const cachePath = path.resolve('src/content/presentations', presentationFolder, '.visual-cache.json');
  if (!fs.existsSync(cachePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Saves the visual cache for a presentation
 * @param {string} presentationFolder
 * @param {VisualCache} cache
 */
export function saveVisualCache(presentationFolder, cache) {
  const cachePath = path.resolve('src/content/presentations', presentationFolder, '.visual-cache.json');
  const content = JSON.stringify(cache, null, 2) + '\n';
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      fs.writeFileSync(cachePath, content, 'utf8');
      return;
    } catch (err) {
      if (attempt === 6) throw err;
      const waitMs = 250 * attempt;
      const start = Date.now();
      while (Date.now() - start < waitMs) { /* busy wait for synchronous safety */ }
    }
  }
}
