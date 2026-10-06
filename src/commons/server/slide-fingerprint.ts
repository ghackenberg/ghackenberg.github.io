import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ENGINE_VERSION = 'v1.0';

/**
 * Recursively retrieves all files in a directory matching extensions
 */
function getFilesRecursively(dir: string, extensions = ['.astro', '.js', '.ts', '.css']): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

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
 */
export function computeSlideStyleHash(): string {
  const hash = crypto.createHash('sha256');
  hash.update(`ENGINE:${ENGINE_VERSION}:`);

  const keyFiles = [
    path.resolve('src/styles/theme.css'),
    path.resolve('src/styles/slides.css'),
    path.resolve('src/pages/presentations/[slug]/print.astro'),
    path.resolve('src/commons/shared/slide-cues.ts'),
  ];

  for (const file of keyFiles) {
    if (fs.existsSync(file)) {
      hash.update(path.relative(process.cwd(), file).replace(/\\/g, '/'));
      let fileContent = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
      if (file.endsWith('theme.css')) {
        fileContent = fileContent
          .replace(/@import\s+["'][^"']*graphics\.css["'];?\n?/g, '')
          .replace(/@import\s+["'][^"']*diagrams\.css["'];?\n?/g, '');
      }
      hash.update(fileContent);
    }
  }

  // Slide layout and primitive components (excluding interactive player runtime)
  const slideComponentFiles = [
    ...getFilesRecursively(path.resolve('src/components/slides/layouts')),
    ...getFilesRecursively(path.resolve('src/components/slides/primitives')),
  ].sort();
  for (const file of slideComponentFiles) {
    hash.update(path.relative(process.cwd(), file).replace(/\\/g, '/'));
    hash.update(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
  }

  return hash.digest('hex');
}

/**
 * Extracts visual frontmatter and body from slide MDX content, excluding voiceover/notes
 */
export function extractSlideVisualContent(content: string): string {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  let visualFrontmatter = '';
  let bodyContent = content;

  if (frontmatterMatch) {
    const yamlLines = frontmatterMatch[1].split(/\r?\n/);
    const filteredYaml: string[] = [];
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
 */
export function computeSlideVisualHash(slideFilePath: string, styleHash: string): string {
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
 */
export function computePresentationDeckHash(
  presentationFolder: string,
  styleHash: string
): { deckHash: string; slideHashes: Record<string, string> } {
  const presDir = path.resolve('src/content/presentations', presentationFolder);
  const slidesDir = path.join(presDir, 'slides');
  const slideHashes: Record<string, string> = {};

  const deckHasher = crypto.createHash('sha256');
  deckHasher.update(styleHash);
  deckHasher.update(`:DECK:${presentationFolder}:`);

  if (fs.existsSync(slidesDir)) {
    const slideFiles = fs.readdirSync(slidesDir)
      .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
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
    slideHashes,
  };
}

export interface VisualCache {
  version: string;
  styleHash: string;
  deckHash: string;
  slides: Record<string, string>;
}

/**
 * Loads the visual cache for a presentation
 */
export function loadVisualCache(presentationFolder: string): VisualCache | null {
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
 */
export function saveVisualCache(presentationFolder: string, cache: VisualCache): void {
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
