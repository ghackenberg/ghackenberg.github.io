import { defineConfig } from 'astro/config';
import type { AstroIntegration } from 'astro';
import type { Plugin as VitePlugin } from 'vite';
import { createLogger } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { unified } from '@astrojs/markdown-remark';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap, { type ChangeFreqEnum } from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import remarkValidateImages from '@plugins/remark-validate-images.js';
import remarkMermaid from '@plugins/remark-mermaid.js';
import remarkSlideCues from '@plugins/remark-slide-cues.js';
import remarkCitations from '@plugins/remark-citations.js';
import rehypeKatex from 'rehype-katex';
import rehypeResponsiveTables from '@plugins/rehype-responsive-tables.js';
import rehypeCallouts from '@plugins/rehype-callouts.js';
import rehypeInlineSvg from '@plugins/rehype-inline-svg.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildSitemapMetadata } from '@plugins/sitemap-config.js';
import { validateAndEnrichImageSitemaps } from '@plugins/image-sitemap.js';
import YAML from 'yaml';
import { generateCitationLabel, type CitationRef } from '@commons/shared/citations.js';

const mimeTypes: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.graphml': 'application/xml',
  '.dot': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.js': 'application/javascript',
  '.css': 'text/css',
};

function copyContentAssets(): AstroIntegration {
  return {
    name: 'copy-content-assets',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use(
          (req: IncomingMessage, res: ServerResponse, next: () => void) => {
            if (req.url === '/styles/graphics.css' || req.url?.startsWith('/styles/graphics.css?')) {
              const graphicsPath = path.resolve('src/styles/graphics.css');
              if (fs.existsSync(graphicsPath)) {
                res.writeHead(200, { 'Content-Type': 'text/css' });
                fs.createReadStream(graphicsPath).pipe(res);
                return;
              }
            }
            const match = req.url?.match(/^\/(posts|publications|visualizations|courses|services|presentations|talks)\/(.+)$/);
            if (match) {
              const [, collection, rest] = match;
              const cleanRest = rest.split('?')[0];
              const filePath = path.resolve('src/content', collection, cleanRest);
              const ext = path.extname(filePath).toLowerCase();
              if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                const contentType = mimeTypes[ext] || 'application/octet-stream';
                res.writeHead(200, { 'Content-Type': contentType });
                fs.createReadStream(filePath).pipe(res);
                return;
              }
              const mermaidCached = path.resolve('.cache/mermaid/exports', collection, cleanRest);
              if (fs.existsSync(mermaidCached) && fs.statSync(mermaidCached).isFile()) {
                res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
                fs.createReadStream(mermaidCached).pipe(res);
                return;
              }
            }
            next();
          }
        );
      },
      'astro:build:done': async ({ dir }) => {
        const outDir = fileURLToPath(dir);
        const collections = ['posts', 'publications', 'visualizations', 'courses', 'services', 'projects', 'interests', 'presentations'];
        const graphicsCssPath = path.resolve('src/styles/graphics.css');
        const graphicsCss = fs.existsSync(graphicsCssPath) ? fs.readFileSync(graphicsCssPath, 'utf8') : '';

        for (const col of collections) {
          const srcDir = path.resolve('src/content', col);
          if (!fs.existsSync(srcDir)) continue;

          const copyFiles = (currentSrc: string, relativePath = '') => {
            const files = fs.readdirSync(currentSrc);
            for (const file of files) {
              const fullSrcPath = path.join(currentSrc, file);
              const stat = fs.statSync(fullSrcPath);
              if (stat.isDirectory()) {
                copyFiles(fullSrcPath, path.join(relativePath, file));
              } else {
                if (
                  file.endsWith('.md') ||
                  file.endsWith('.mdx') ||
                  file.endsWith('.json') ||
                  file.endsWith('.yml') ||
                  file.endsWith('.yaml')
                ) {
                  continue;
                }

                // Stop copying raster images, except presentation thumbnails
                const isRaster = /\.(png|jpe?g|webp|avif|gif)$/i.test(file);
                const isPresThumbnail = col === 'presentations' && relativePath.split(/[/\\]/).includes('thumbnails') && file.endsWith('.webp');
                if (isRaster && !isPresThumbnail) {
                  continue;
                }

                const destPath = path.join(outDir, col, relativePath, file);
                fs.mkdirSync(path.dirname(destPath), { recursive: true });
                if (file.endsWith('.svg') && graphicsCss) {
                  let svgContent = fs.readFileSync(fullSrcPath, 'utf8');
                  const importRegex = /@import\s+(?:url\(['"]?\/styles\/graphics\.css['"]?\)|['"]\/styles\/graphics\.css['"])\s*;?/;
                  if (importRegex.test(svgContent)) {
                    svgContent = svgContent.replace(importRegex, () => graphicsCss);
                  }
                  fs.writeFileSync(destPath, svgContent, 'utf8');
                } else {
                  fs.copyFileSync(fullSrcPath, destPath);
                }
              }
            }
          };
          copyFiles(srcDir);
        }

        const mermaidExportsDir = path.resolve('.cache/mermaid/exports');
        if (fs.existsSync(mermaidExportsDir)) {
          const copyMermaid = (currentSrc: string, relPath = '') => {
            const files = fs.readdirSync(currentSrc, { withFileTypes: true });
            for (const file of files) {
              const fullSrc = path.join(currentSrc, file.name);
              const dest = path.join(outDir, relPath, file.name);
              if (file.isDirectory()) {
                copyMermaid(fullSrc, path.join(relPath, file.name));
              } else if (file.isFile() && file.name.endsWith('.svg')) {
                fs.mkdirSync(path.dirname(dest), { recursive: true });
                fs.copyFileSync(fullSrc, dest);
              }
            }
          };
          copyMermaid(mermaidExportsDir);
        }
      },
    },
  };
}

function internalAssetRoutes(): AstroIntegration {
  return {
    name: 'internal-asset-routes',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        injectRoute({
          pattern: '/_internal/og/',
          entrypoint: './src/pages/_internal/og.astro',
        });
        injectRoute({
          pattern: '/_internal/icon/',
          entrypoint: './src/pages/_internal/icon.astro',
        });
      },
    },
  };
}

function imageSitemapEnforcer(): AstroIntegration {
  return {
    name: 'image-sitemap-enforcer',
    hooks: {
      'astro:build:done': async () => {
        await validateAndEnrichImageSitemaps();
      },
    },
  };
}

const { getMetadataForPath } = buildSitemapMetadata();

function vitePreSlideCues(): VitePlugin {
  return {
    name: 'vite-pre-slide-cues',
    enforce: 'pre',
    transform(code: string, id: string) {
      if (!id.endsWith('.mdx') && !id.endsWith('.md')) return null;
      if (!id.includes('talks') && !id.includes('slides') && !id.includes('presentations')) return null;

      const fmMatch = code.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!fmMatch) return null;

      const frontmatterStr = fmMatch[0];
      const frontmatterContent = fmMatch[1];
      const body = code.slice(frontmatterStr.length);

      let references: CitationRef[] = [];
      try {
        const parsed = YAML.parse(frontmatterContent);
        if (parsed && Array.isArray(parsed.references)) {
          references = parsed.references;
        }
      } catch {
        // frontmatter parse fallback
      }

      // 1. Transform citations: [@refId] into interactive slide citation button badges
      const CITE_REGEX = /\[@([a-zA-Z0-9_\-]+)\]/g;
      const bodyWithCitations = body.replace(CITE_REGEX, (_, refId) => {
        const ref = references.find((r) => r.id === refId) || { id: refId };
        const label = generateCitationLabel(ref);
        return `<button type='button' data-open-reference='${refId}' class='slide-citation-badge inline-flex items-center font-mono text-purple-400 light:text-purple-700 hover:text-purple-300 font-bold align-baseline px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 cursor-pointer transition-colors' title='Referenz ansehen: ${label}'>[${label}]</button>`;
      });

      // 2. Transform slide cues
      const transformedBody = bodyWithCitations.replace(
        /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\{cue:([a-zA-Z0-9_-]+)(?::([a-zA-Z0-9_-]+))?\}([\s\S]*?)\{\/cue(?::[a-zA-Z0-9_-]+)?\}|\{cue:([a-zA-Z0-9_-]+)(?::([a-zA-Z0-9_-]+))?\})/g,
        (match, stringLiteral, _cueBlock, cueId1, color1, content, cueId2, color2) => {
          if (stringLiteral) {
            return stringLiteral;
          }
          if (content !== undefined) {
            const colorAttr = color1 ? ` data-color="${color1}"` : '';
            return `<mark id="${cueId1}" data-cue="${cueId1}"${colorAttr} class="highlight-marker font-semibold rounded-[0.38em]">${content}</mark>`;
          }
          if (cueId2 !== undefined) {
            const colorAttr = color2 ? ` data-color="${color2}"` : '';
            return `<span id="${cueId2}" data-cue="${cueId2}"${colorAttr} class="cue-target"></span>`;
          }
          return match;
        }
      );

      return {
        code: frontmatterStr + transformedBody,
        map: null,
      };
    },
  };
}

const isBuild = process.argv.includes('build');
const viteLogger = createLogger();
if (isBuild) {
  const originalWarn = viteLogger.warn.bind(viteLogger);
  viteLogger.warn = (msg, options) => {
    originalWarn(msg, options);
    throw new Error(`[build:warning-guard] Build terminated due to Vite warning: ${msg}`);
  };
  viteLogger.warnOnce = (msg, options) => {
    viteLogger.warn(msg, options);
  };
}

function getSemanticScriptPath(chunkInfo: { name: string; facadeModuleId?: string | null }): string {
  const facade = (chunkInfo.facadeModuleId || '').replace(/\\/g, '/');
  const cleanFacade = facade.replace(/\?.*$/, '');
  const rawName = chunkInfo.name || '';
  const cleanName = rawName
    .replace(/\?.*$/, '')
    .replace(/\.astro_astro_type_script_index_\d+_lang/, '')
    .replace(/@_@astro/, '')
    .replace(/^_/, '')
    .replace(/[<>:"/\\|?*]/g, '_');

  // 1. Astro page scripts (from src/pages/) -> scripts/pages/
  if (
    cleanFacade.includes('src/pages/') ||
    rawName.startsWith('pages/') ||
    rawName.startsWith('pages_') ||
    cleanName.startsWith('index') ||
    cleanName.startsWith('print') ||
    cleanName.startsWith('_slug_')
  ) {
    const pageMatch = cleanFacade.match(/src\/pages\/(.+?)(?:\/index)?\.astro/);
    let pageSlug = pageMatch ? pageMatch[1] : cleanName;
    pageSlug = pageSlug.replace(/\[\.\.\..+\]|\[.+\]/, 'dynamic').replace(/\//g, '_').replace(/[<>:"/\\|?*]/g, '_');
    return `scripts/pages/${pageSlug}-[hash].js`;
  }

  // 2. Astro component scripts (from src/components/) -> scripts/components/
  if (cleanFacade.includes('src/components/') || rawName.includes('.astro_astro_type_script')) {
    const compMatch = cleanFacade.match(/src\/components\/(?:.+?\/)?([^/]+)\.astro/);
    const compName = (compMatch ? compMatch[1] : cleanName).replace(/[<>:"/\\|?*]/g, '_');
    return `scripts/components/${compName}-[hash].js`;
  }

  // 3. Code-split visualization engines -> scripts/visualizations/
  const visEngines = ['3d-force', 'cytoscape', 'd3', 'sigma', 'vis-network', 'vis-data', 'graphology'];
  const isVisEngine = visEngines.some((eng) => cleanName.toLowerCase().includes(eng) || cleanFacade.toLowerCase().includes(eng));
  if (isVisEngine || cleanFacade.includes('commons/visualizations') || cleanFacade.includes('components/visualizations/engines')) {
    const matchedEngine = visEngines.find((eng) => cleanName.toLowerCase().includes(eng) || cleanFacade.toLowerCase().includes(eng));
    const engineName = matchedEngine || cleanName || 'engine';
    return `scripts/visualizations/${engineName}-[hash].js`;
  }

  // 4. Global / top-level scripts (e.g. page, telemetry, theme, analytics) -> scripts/
  if (cleanName === 'page' || cleanName === 'telemetry' || cleanFacade.includes('src/scripts/') || cleanFacade.includes('src/commons/')) {
    return `scripts/${cleanName}-[hash].js`;
  }

  // 5. Code-split vendor/library chunks -> scripts/chunks/
  return `scripts/chunks/${cleanName}-[hash].js`;
}

interface ImageLocation {
  targetDir: string;
  sourcePath: string;
}

const imageHashMap = new Map<string, ImageLocation>();
const imageNameMap = new Map<string, ImageLocation[]>();

function buildImageIndex(): void {
  imageHashMap.clear();
  imageNameMap.clear();

  const scanDirs = [
    path.resolve('src/content'),
    path.resolve('src/assets'),
    path.resolve('public/images'),
  ];

  for (const root of scanDirs) {
    if (!fs.existsSync(root)) continue;

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(entry.name)) {
          const norm = fullPath.replaceAll(path.sep, '/');
          let targetDir = 'images/branding';

          if (norm.includes('src/content/posts/')) {
            const match = norm.match(/src\/content\/posts\/([^/]+)/);
            targetDir = match ? `posts/${match[1].replace(/[<>:"/\\|?*]/g, '_')}` : 'posts';
          } else if (norm.includes('src/content/presentations/')) {
            const match = norm.match(/src\/content\/presentations\/([^/]+)/);
            targetDir = match ? `presentations/${match[1].replace(/[<>:"/\\|?*]/g, '_')}` : 'presentations';
          } else if (norm.includes('src/content/courses/')) {
            const match = norm.match(/src\/content\/courses\/([^/]+)/);
            targetDir = match ? `courses/${match[1].replace(/[<>:"/\\|?*]/g, '_')}` : 'courses';
          } else if (norm.includes('src/content/projects/')) {
            const match = norm.match(/src\/content\/projects\/([^/]+)/);
            targetDir = match ? `projects/${match[1].replace(/[<>:"/\\|?*]/g, '_')}` : 'projects';
          } else if (norm.includes('src/content/services/')) {
            const match = norm.match(/src\/content\/services\/([^/]+)/);
            targetDir = match ? `services/${match[1].replace(/[<>:"/\\|?*]/g, '_')}` : 'services';
          } else if (norm.includes('src/content/publications/')) {
            const match = norm.match(/src\/content\/publications\/([^/]+)/);
            targetDir = match ? `publications/${match[1].replace(/[<>:"/\\|?*]/g, '_')}` : 'publications';
          } else if (norm.includes('src/content/visualizations/')) {
            const match = norm.match(/src\/content\/visualizations\/([^/]+)/);
            targetDir = match ? `visualizations/${match[1].replace(/[<>:"/\\|?*]/g, '_')}` : 'visualizations';
          } else if (norm.includes('src/content/objects/')) {
            const match = norm.match(/src\/content\/objects\/([^/]+)/);
            targetDir = match ? `images/objects/${match[1].replace(/[<>:"/\\|?*]/g, '_')}` : 'images/objects';
          } else if (norm.includes('src/content/interests/')) {
            const match = norm.match(/src\/content\/interests\/([^/]+)/);
            targetDir = match ? `images/interests/${match[1].replace(/[<>:"/\\|?*]/g, '_')}` : 'images/interests';
          } else if (norm.includes('src/content/environments/')) {
            const match = norm.match(/src\/content\/environments\/([^/]+)/);
            targetDir = match ? `images/environments/${match[1].replace(/[<>:"/\\|?*]/g, '_')}` : 'images/environments';
          } else if (norm.includes('src/content/characters/')) {
            const match = norm.match(/src\/content\/characters\/([^/]+)/);
            targetDir = match ? `images/characters/${match[1].replace(/[<>:"/\\|?*]/g, '_')}` : 'images/characters';
          } else if (norm.includes('src/content/feeds/')) {
            const match = norm.match(/src\/content\/feeds\/(linkedin|youtube|github)\/(.+)\/[^/]+$/);
            if (match) {
              const platform = match[1];
              const subpath = match[2].replace(/[<>:"/\\|?*]/g, '_');
              targetDir = `images/feeds/${platform}/${subpath}`;
            } else {
              const simpleMatch = norm.match(/src\/content\/feeds\/([^/]+)/);
              targetDir = simpleMatch ? `images/feeds/${simpleMatch[1]}` : 'images/feeds';
            }
          } else if (norm.includes('src/assets/images/')) {
            if (entry.name.includes('comic-profile') || entry.name.includes('avatar')) {
              targetDir = 'images/avatar';
            } else if (entry.name.includes('og-share')) {
              targetDir = 'images/og';
            } else {
              targetDir = 'images/branding';
            }
          } else if (norm.includes('public/images/')) {
            targetDir = 'images/technologies';
          }

          try {
            const buf = fs.readFileSync(fullPath);
            const md5 = crypto.createHash('md5').update(buf).digest('hex');
            imageHashMap.set(md5, { targetDir, sourcePath: norm });
          } catch {
            // ignore unreadable
          }

          const list = imageNameMap.get(entry.name) || [];
          list.push({ targetDir, sourcePath: norm });
          imageNameMap.set(entry.name, list);
        }
      }
    };
    walk(root);
  }
}
buildImageIndex();

function getSemanticAssetPath(assetInfo: { names?: string[]; originalFileName?: string | null; originalFileNames?: string[]; source?: string | Uint8Array }): string {
  const rawName = assetInfo.names?.[0] || '';
  const cleanName = rawName
    .replace(/\?.*$/, '')
    .replace(/@_@astro/g, '')
    .replace(/\.astro.*$/, '')
    .replace(/[<>:"/\\|?*]/g, '_');
  const baseName = path.basename(cleanName, path.extname(cleanName)).replace(/^_/, '') || 'style';
  const orig = (assetInfo.originalFileName || assetInfo.originalFileNames?.[0] || '').replace(/\\/g, '/').replace(/\?.*$/, '');

  if (cleanName.endsWith('.css') || rawName.endsWith('.css')) {
    if (orig.includes('pages/')) {
      const match = orig.match(/pages\/(.+?)\//);
      if (match) {
        const pageFolder = match[1].replace(/\[\.\.\..+\]|\[.+\]/, 'dynamic').replace(/[<>:"/\\|?*]/g, '_');
        return `styles/pages/${pageFolder}/${baseName}-[hash][extname]`;
      }
    }
    return `styles/${baseName}-[hash][extname]`;
  }

  if (/\.(woff2?|ttf|eot|otf)$/.test(cleanName)) {
    const lower = cleanName.toLowerCase();
    if (lower.includes('outfit')) return 'fonts/outfit/[name]-[hash][extname]';
    if (lower.includes('inter')) return 'fonts/inter/[name]-[hash][extname]';
    if (lower.includes('caveat')) return 'fonts/caveat/[name]-[hash][extname]';
    return 'fonts/[name]-[hash][extname]';
  }

  if (/\.(png|jpe?g|webp|gif|svg|avif)$/.test(cleanName)) {
    // 1. Precise MD5 match on asset content
    if (assetInfo.source) {
      try {
        const buf = Buffer.isBuffer(assetInfo.source)
          ? assetInfo.source
          : typeof assetInfo.source === 'string'
          ? Buffer.from(assetInfo.source)
          : Buffer.from(assetInfo.source as Uint8Array);
        const md5 = crypto.createHash('md5').update(buf).digest('hex');
        const match = imageHashMap.get(md5);
        if (match) {
          return `${match.targetDir}/[name]-[hash][extname]`;
        }
      } catch {
        // ignore
      }
    }

    // 2. Disambiguate using path if available
    const searchPath = `${orig}/${cleanName}`;

    if (searchPath.includes('src/content/posts/') || searchPath.includes('/posts/')) {
      const match = searchPath.match(/(?:src\/content\/)?posts\/([^/]+)/);
      const postSlug = match ? match[1].replace(/[<>:"/\\|?*]/g, '_') : '';
      return postSlug ? `posts/${postSlug}/[name]-[hash][extname]` : `posts/[name]-[hash][extname]`;
    }
    if (searchPath.includes('src/content/presentations/') || searchPath.includes('/presentations/')) {
      const match = searchPath.match(/(?:src\/content\/)?presentations\/([^/]+)/);
      const presSlug = match ? match[1].replace(/[<>:"/\\|?*]/g, '_') : '';
      return presSlug ? `presentations/${presSlug}/[name]-[hash][extname]` : `presentations/[name]-[hash][extname]`;
    }
    if (searchPath.includes('src/content/courses/') || searchPath.includes('/courses/')) {
      const match = searchPath.match(/(?:src\/content\/)?courses\/([^/]+)/);
      const courseSlug = match ? match[1].replace(/[<>:"/\\|?*]/g, '_') : '';
      return courseSlug ? `courses/${courseSlug}/[name]-[hash][extname]` : `courses/[name]-[hash][extname]`;
    }
    if (searchPath.includes('src/content/projects/') || searchPath.includes('/projects/')) {
      const match = searchPath.match(/(?:src\/content\/)?projects\/([^/]+)/);
      const projSlug = match ? match[1].replace(/[<>:"/\\|?*]/g, '_') : '';
      return projSlug ? `projects/${projSlug}/[name]-[hash][extname]` : `projects/[name]-[hash][extname]`;
    }
    if (searchPath.includes('src/content/services/') || searchPath.includes('/services/')) {
      const match = searchPath.match(/(?:src\/content\/)?services\/([^/]+)/);
      const servSlug = match ? match[1].replace(/[<>:"/\\|?*]/g, '_') : '';
      return servSlug ? `services/${servSlug}/[name]-[hash][extname]` : `services/[name]-[hash][extname]`;
    }
    if (searchPath.includes('src/content/publications/') || searchPath.includes('/publications/')) {
      const match = searchPath.match(/(?:src\/content\/)?publications\/([^/]+)/);
      const pubSlug = match ? match[1].replace(/[<>:"/\\|?*]/g, '_') : '';
      return pubSlug ? `publications/${pubSlug}/[name]-[hash][extname]` : `publications/[name]-[hash][extname]`;
    }
    if (searchPath.includes('src/content/visualizations/') || searchPath.includes('/visualizations/')) {
      const match = searchPath.match(/(?:src\/content\/)?visualizations\/([^/]+)/);
      const visSlug = match ? match[1].replace(/[<>:"/\\|?*]/g, '_') : '';
      return visSlug ? `visualizations/${visSlug}/[name]-[hash][extname]` : `visualizations/[name]-[hash][extname]`;
    }
    if (searchPath.includes('src/content/objects/') || searchPath.includes('/objects/')) {
      const match = searchPath.match(/(?:src\/content\/)?objects\/([^/]+)/);
      const objSlug = match ? match[1].replace(/[<>:"/\\|?*]/g, '_') : '';
      return objSlug ? `images/objects/${objSlug}/[name]-[hash][extname]` : `images/objects/[name]-[hash][extname]`;
    }
    if (searchPath.includes('src/content/interests/') || searchPath.includes('/interests/')) {
      const match = searchPath.match(/(?:src\/content\/)?interests\/([^/]+)/);
      const intSlug = match ? match[1].replace(/[<>:"/\\|?*]/g, '_') : '';
      return intSlug ? `images/interests/${intSlug}/[name]-[hash][extname]` : `images/interests/[name]-[hash][extname]`;
    }
    if (searchPath.includes('src/content/environments/') || searchPath.includes('/environments/')) {
      const match = searchPath.match(/(?:src\/content\/)?environments\/([^/]+)/);
      const envSlug = match ? match[1].replace(/[<>:"/\\|?*]/g, '_') : '';
      return envSlug ? `images/environments/${envSlug}/[name]-[hash][extname]` : `images/environments/[name]-[hash][extname]`;
    }
    if (searchPath.includes('src/content/characters/') || searchPath.includes('/characters/')) {
      const match = searchPath.match(/(?:src\/content\/)?characters\/([^/]+)/);
      const charSlug = match ? match[1].replace(/[<>:"/\\|?*]/g, '_') : '';
      return charSlug ? `images/characters/${charSlug}/[name]-[hash][extname]` : `images/characters/[name]-[hash][extname]`;
    }
    if (searchPath.includes('src/content/feeds/') || searchPath.includes('/feeds/')) {
      const match = searchPath.match(/(?:src\/content\/)?feeds\/(linkedin|youtube|github)\/(.+)\/[^/]+$/);
      if (match) {
        return `images/feeds/${match[1]}/${match[2].replace(/[<>:"/\\|?*]/g, '_')}/[name]-[hash][extname]`;
      }
      const simpleMatch = searchPath.match(/(?:src\/content\/)?feeds\/([^/]+)/);
      return simpleMatch ? `images/feeds/${simpleMatch[1]}/[name]-[hash][extname]` : `images/feeds/[name]-[hash][extname]`;
    }
    if (searchPath.includes('src/assets/') || searchPath.includes('assets/images/')) {
      if (cleanName.includes('comic-profile') || cleanName.includes('avatar')) {
        return `images/avatar/[name]-[hash][extname]`;
      }
      if (cleanName.includes('og-share')) {
        return `images/og/[name]-[hash][extname]`;
      }
      return `images/branding/[name]-[hash][extname]`;
    }

    // 3. Fallback to image name mapping if unique
    const nameMatches = imageNameMap.get(rawName) || imageNameMap.get(cleanName);
    if (nameMatches && nameMatches.length > 0) {
      return `${nameMatches[0].targetDir}/[name]-[hash][extname]`;
    }

    if (searchPath.includes('components/')) {
      return `images/components/[name]-[hash][extname]`;
    }
    return 'images/branding/[name]-[hash][extname]';
  }

  return 'assets/[name]-[hash][extname]';
}

// https://astro.build/config
export default defineConfig({
  site: 'https://hackenberg.tech',
  trailingSlash: 'always',
  build: {
    assets: 'assets',
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  image: {
    dangerouslyProcessSVG: true,
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/print/') && !page.includes('/_internal/'),
      serialize(item) {
        try {
          const urlObj = new URL(item.url);
          const meta = getMetadataForPath(urlObj.pathname);
          return {
            ...item,
            lastmod: meta.lastmod ? meta.lastmod.toISOString() : item.lastmod,
            changefreq: meta.changefreq as ChangeFreqEnum,
            priority: meta.priority,
          };
        } catch {
          return item;
        }
      },

      chunks: {
        posts: (item) => {
          const pathname = new URL(item.url).pathname;
          return pathname.startsWith('/posts/') || pathname === '/posts' ? item : undefined;
        },
        courses: (item) => {
          const pathname = new URL(item.url).pathname;
          return pathname.startsWith('/courses/') || pathname === '/courses' ? item : undefined;
        },
        publications: (item) => {
          const pathname = new URL(item.url).pathname;
          return pathname.startsWith('/publications/') || pathname === '/publications' ? item : undefined;
        },
        projects: (item) => {
          const pathname = new URL(item.url).pathname;
          return pathname.startsWith('/projects/') || pathname === '/projects' ? item : undefined;
        },
        services: (item) => {
          const pathname = new URL(item.url).pathname;
          return pathname.startsWith('/services/') || pathname === '/services' ? item : undefined;
        },
        visualizations: (item) => {
          const pathname = new URL(item.url).pathname;
          return pathname.startsWith('/visualizations/') || pathname === '/visualizations' ? item : undefined;
        },
        presentations: (item) => {
          const pathname = new URL(item.url).pathname;
          return pathname.startsWith('/presentations/') || pathname === '/presentations' ? item : undefined;
        },
      },
    }),
    mdx(),
    copyContentAssets(),
    internalAssetRoutes(),
    imageSitemapEnforcer(),
  ],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath, remarkValidateImages, remarkMermaid, remarkSlideCues, remarkCitations],
      rehypePlugins: [rehypeKatex, rehypeResponsiveTables, rehypeCallouts, rehypeInlineSvg],
    }),
  },
  vite: {
    customLogger: viteLogger,
    plugins: [tailwindcss(), vitePreSlideCues()],
    optimizeDeps: {
      include: [
        'reveal.js',
        'howler',
        'cytoscape',
        'd3',
        'sigma',
        'graphology',
        'graphology-layout-forceatlas2',
        '3d-force-graph',
        'vis-network',
        'vis-data',
        '@plausible-analytics/tracker',
      ],
    },
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        onwarn(warning) {
          throw new Error(
            `[build:warning-guard] Build terminated due to Rollup warning: ${warning.message || warning}`
          );
        },
        output: {
          entryFileNames: (chunkInfo) => getSemanticScriptPath(chunkInfo),
          chunkFileNames: (chunkInfo) => getSemanticScriptPath(chunkInfo),
          assetFileNames: (assetInfo) => getSemanticAssetPath(assetInfo),
        },
      },
    },
    environments: {
      client: {
        build: {
          rolldownOptions: {
            output: {
              entryFileNames: (chunkInfo) => getSemanticScriptPath(chunkInfo),
              chunkFileNames: (chunkInfo: { name: string; facadeModuleId?: string | null }) => getSemanticScriptPath(chunkInfo),
              assetFileNames: (assetInfo: { names?: string[]; originalFileName?: string | null; originalFileNames?: string[] }) => getSemanticAssetPath(assetInfo),
            },
          },
        },
      },
    },
  },
});
