import { glob } from 'astro/loaders';
import type { Loader, LoaderContext } from 'astro/loaders';
import type { FSWatcher } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFileContentHash } from './content-hash.js';

const TRACKED_ASSET_EXT_REGEX = /\.(svg|png|jpe?g|webp|avif|gif)$/i;
const MARKDOWN_EXT_REGEX = /\.(md|mdx)$/i;
const RELATIVE_ASSET_REF_REGEX = /(?:!\[[^\]]*\]\(|src=["']|:\s*["']?)(\.\.?\/[^"'\s)]+\.(?:svg|png|jpe?g|webp|avif|gif))/gi;

/**
 * Computes a deterministic fingerprint string across all tracked visual assets (.svg, .png, .jpg, .webp, etc.)
 * co-located with or referenced by a Markdown/MDX entry.
 */
function computeEntryAssetFingerprint(mdFilePath: string, mdContents: string): string {
  const entryDir = path.dirname(mdFilePath);
  if (!fs.existsSync(entryDir)) return '';

  const assetPaths = new Set<string>();

  const collectAssetsInDir = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isFile() && TRACKED_ASSET_EXT_REGEX.test(entry.name)) {
          assetPaths.add(path.resolve(dir, entry.name));
        }
      }
    } catch {
      // ignore transient directory read errors
    }
  };

  // 1. Co-located assets in the same entry directory
  collectAssetsInDir(entryDir);

  // 2. For slide files inside `slides/`, also include presentation-root SVGs/assets
  if (path.basename(entryDir) === 'slides') {
    collectAssetsInDir(path.dirname(entryDir));
  }

  // 3. Any explicit relative asset references (./... or ../...) inside frontmatter or body
  for (const match of mdContents.matchAll(RELATIVE_ASSET_REF_REGEX)) {
    const relRef = match[1];
    if (relRef) {
      const resolvedRef = path.resolve(entryDir, relRef);
      if (fs.existsSync(resolvedRef)) {
        try {
          if (fs.statSync(resolvedRef).isFile()) {
            assetPaths.add(resolvedRef);
          }
        } catch {
          // ignore
        }
      }
    }
  }

  if (assetPaths.size === 0) return '';

  const sortedPaths = [...assetPaths].sort((a, b) => a.localeCompare(b));
  const parts: string[] = [];
  let hasSvg = false;

  for (const assetPath of sortedPaths) {
    try {
      if (assetPath.toLowerCase().endsWith('.svg')) {
        hasSvg = true;
      }
      const relKey = path.relative(entryDir, assetPath).replace(/\\/g, '/');
      const contentHash = getFileContentHash(assetPath, 16);
      parts.push(`${relKey}:${contentHash}`);
    } catch {
      // ignore unreadable or mid-unlink file
    }
  }

  if (hasSvg) {
    const graphicsCssPath = path.resolve('src/styles/graphics.css');
    if (fs.existsSync(graphicsCssPath)) {
      try {
        parts.push(`graphics.css:${getFileContentHash(graphicsCssPath, 16)}`);
      } catch {
        // ignore
      }
    }
  }

  return parts.join('|');
}

/**
 * Finds co-located Markdown/MDX entry files affected by a modified asset inside `baseDir`.
 */
function findAffectedMarkdownFiles(assetFilePath: string, baseDirNorm: string): string[] {
  const resolvedAsset = path.resolve(assetFilePath);
  const assetDir = path.dirname(resolvedAsset);
  const assetFileName = path.basename(resolvedAsset);
  const candidateDirs: string[] = [assetDir];

  const parentDir = path.dirname(assetDir);
  const parentNorm = parentDir.replace(/\\/g, '/');
  if (parentNorm === baseDirNorm || parentNorm.startsWith(`${baseDirNorm}/`)) {
    candidateDirs.push(parentDir);
  }

  const slidesDir = path.join(assetDir, 'slides');
  if (fs.existsSync(slidesDir)) {
    candidateDirs.push(slidesDir);
  }

  const allMdFiles: string[] = [];
  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isFile() && MARKDOWN_EXT_REGEX.test(entry.name)) {
          allMdFiles.push(path.join(dir, entry.name));
        }
      }
    } catch {
      // ignore
    }
  }

  const referencingMdFiles = allMdFiles.filter((mdFile) => {
    try {
      return fs.readFileSync(mdFile, 'utf8').includes(assetFileName);
    } catch {
      return false;
    }
  });

  return referencingMdFiles.length > 0 ? referencingMdFiles : allMdFiles;
}

/**
 * Wraps Astro's built-in `glob()` loader with:
 * 1. Composite content+asset digest calculation (`generateDigest`), combining the Markdown text digest
 *    with the binary content hashes of co-located/referenced `.svg` and raster image files.
 * 2. Native single-entry Content Layer watcher invalidation when co-located `.svg` or raster image assets
 *    are added, modified, or unlinked in `astro dev` (without touching `.md` mtimes or wiping `.astro/data-store.json`).
 */
export function assetAwareGlob(options: Parameters<typeof glob>[0]): Loader {
  const baseLoader = glob(options);

  return {
    name: 'asset-aware-glob-loader',
    load: async (context: LoaderContext) => {
      const rootDir = fileURLToPath(context.config.root);
      const baseDir = options.base
        ? path.resolve(
            rootDir,
            typeof options.base === 'string' ? options.base : fileURLToPath(options.base)
          )
        : rootDir;
      const baseDirNorm = baseDir.replace(/\\/g, '/');
      const originalGenerateDigest = context.generateDigest.bind(context);

      // Map from base Markdown digest -> absolute Markdown file path
      const mdFileByBaseDigest = new Map<string, string>();

      const indexMarkdownFile = (mdPath: string) => {
        try {
          if (fs.existsSync(mdPath)) {
            const raw = fs.readFileSync(mdPath, 'utf8');
            const baseDigest = String(originalGenerateDigest(raw));
            mdFileByBaseDigest.set(baseDigest, mdPath);
          }
        } catch {
          // ignore transient file read errors
        }
      };

      const scanMarkdownFiles = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        try {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              scanMarkdownFiles(fullPath);
            } else if (entry.isFile() && MARKDOWN_EXT_REGEX.test(entry.name)) {
              indexMarkdownFile(fullPath);
            }
          }
        } catch {
          // ignore
        }
      };

      scanMarkdownFiles(baseDir);

      let globChangeHandler: ((changedPath: string) => Promise<void> | void) | undefined;

      const wrappedWatcher: FSWatcher | undefined = context.watcher
        ? new Proxy(context.watcher, {
            get(target, prop, receiver) {
              if (prop === 'on') {
                return (event: string, listener: (changedPath: string) => void) => {
                  if (event === 'change' && !globChangeHandler) {
                    globChangeHandler = listener;
                  }
                  return Reflect.get(target, prop, receiver).call(target, event, listener);
                };
              }
              return Reflect.get(target, prop, receiver);
            },
          })
        : undefined;

      const enhancedContext: LoaderContext = {
        ...context,
        watcher: wrappedWatcher,
        generateDigest: (data: Parameters<LoaderContext['generateDigest']>[0]) => {
          const baseDigest = String(originalGenerateDigest(data));
          if (typeof data === 'string') {
            const mdFilePath = mdFileByBaseDigest.get(baseDigest);
            if (mdFilePath) {
              const assetFingerprint = computeEntryAssetFingerprint(mdFilePath, data);
              if (assetFingerprint) {
                return String(originalGenerateDigest(`${baseDigest}:${assetFingerprint}`));
              }
            }
          }
          return baseDigest;
        },
      };

      await baseLoader.load(enhancedContext);

      if (context.watcher) {
        const pendingAssetPaths = new Set<string>();
        let debounceTimer: ReturnType<typeof setTimeout> | undefined;

        const onFsEvent = (changedPath: string) => {
          const resolved = path.resolve(changedPath);
          const norm = resolved.replace(/\\/g, '/');
          if (norm !== baseDirNorm && !norm.startsWith(`${baseDirNorm}/`)) {
            return;
          }

          if (MARKDOWN_EXT_REGEX.test(norm)) {
            indexMarkdownFile(resolved);
            return;
          }

          if (TRACKED_ASSET_EXT_REGEX.test(norm) && globChangeHandler) {
            pendingAssetPaths.add(resolved);
            if (debounceTimer) {
              clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(() => {
              debounceTimer = undefined;
              const affectedMdFiles = new Set<string>();
              for (const assetPath of pendingAssetPaths) {
                for (const mdFile of findAffectedMarkdownFiles(assetPath, baseDirNorm)) {
                  affectedMdFiles.add(mdFile);
                }
              }
              pendingAssetPaths.clear();

              for (const mdFile of affectedMdFiles) {
                indexMarkdownFile(mdFile);
                void globChangeHandler?.(mdFile);
              }
            }, 100);
          }
        };

        context.watcher.on('change', onFsEvent);
        context.watcher.on('add', onFsEvent);
        context.watcher.on('unlink', onFsEvent);
      }
    },
  };
}
