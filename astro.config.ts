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
import fs from 'node:fs';
import path from 'node:path';
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
            const match = req.url?.match(/^\/(posts|publications|visualizations|courses|services|presentations|talks)\/(.+)$/);
            if (match) {
              const [, collection, rest] = match;
              const cleanRest = rest.split('?')[0];
              const filePath = path.resolve('src/content', collection, cleanRest);
              if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                const ext = path.extname(filePath).toLowerCase();
                const contentType = mimeTypes[ext] || 'application/octet-stream';
                res.writeHead(200, { 'Content-Type': contentType });
                fs.createReadStream(filePath).pipe(res);
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
                const destPath = path.join(outDir, col, relativePath, file);
                fs.mkdirSync(path.dirname(destPath), { recursive: true });
                fs.copyFileSync(fullSrcPath, destPath);
              }
            }
          };
          copyFiles(srcDir);
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

// https://astro.build/config
export default defineConfig({
  site: 'https://hackenberg.tech',
  trailingSlash: 'always',
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
      rehypePlugins: [rehypeKatex, rehypeResponsiveTables, rehypeCallouts],
    }),
  },
  vite: {
    customLogger: viteLogger,
    plugins: [tailwindcss(), vitePreSlideCues()],
    optimizeDeps: {
      include: ['reveal.js', 'howler'],
    },
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        onwarn(warning) {
          throw new Error(
            `[build:warning-guard] Build terminated due to Rollup warning: ${warning.message || warning}`
          );
        },
      },
    },
  },
});
