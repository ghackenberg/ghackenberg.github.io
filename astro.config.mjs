// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap, { ChangeFreqEnum } from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import remarkValidateImages from './src/plugins/remark-validate-images.js';
import remarkMermaid from './src/plugins/remark-mermaid.js';
import remarkSlideCues from './src/plugins/remark-slide-cues.js';
import rehypeKatex from 'rehype-katex';
import rehypeResponsiveTables from './src/plugins/rehype-responsive-tables.js';
import rehypeCallouts from './src/plugins/rehype-callouts.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSitemapMetadata } from './scripts/sitemap-config.js';
import { validateAndEnrichImageSitemaps } from './scripts/validate-and-generate-image-sitemap.js';

/** @type {Record<string, string>} */
const mimeTypes = {
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
  '.css': 'text/css'
};

/** @returns {import('astro').AstroIntegration} */
function copyContentAssets() {
  return {
    name: 'copy-content-assets',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use(
          /**
           * @param {import('http').IncomingMessage} req
           * @param {import('http').ServerResponse} res
           * @param {() => void} next
           */
          (req, res, next) => {
            const match = req.url?.match(/^\/(posts|publications|visualizations|courses|services|presentations|talks)\/(.+)$/);
            if (match) {
              const [_, collection, rest] = match;
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
      /** @param {{ dir: URL }} options */
      'astro:build:done': async ({ dir }) => {
        const outDir = fileURLToPath(dir);
        const collections = ['posts', 'publications', 'visualizations', 'courses', 'services', 'projects', 'interests', 'presentations'];
        for (const col of collections) {
          const srcDir = path.resolve('src/content', col);
          if (!fs.existsSync(srcDir)) continue;

          /**
           * @param {string} currentSrc
           * @param {string} relativePath
           */
          const copyFiles = (currentSrc, relativePath = '') => {
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
      }
    }
  };
}

/** @returns {import('astro').AstroIntegration} */
function imageSitemapEnforcer() {
  return {
    name: 'image-sitemap-enforcer',
    hooks: {
      'astro:build:done': async () => {
        await validateAndEnrichImageSitemaps();
      }
    }
  };
}

const { getMetadataForPath } = buildSitemapMetadata();

/** @returns {import('vite').Plugin} */
function vitePreSlideCues() {
  return {
    name: 'vite-pre-slide-cues',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.mdx') && !id.endsWith('.md')) return null;
      if (!id.includes('talks') && !id.includes('slides')) return null;

      const fmMatch = code.match(/^---\r?\n[\s\S]*?\r?\n---/);
      if (!fmMatch) return null;

      const frontmatter = fmMatch[0];
      const body = code.slice(frontmatter.length);

      const transformedBody = body.replace(
        /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\{cue:([a-zA-Z0-9_-]+)(?::([a-zA-Z0-9_-]+))?\}([\s\S]*?)\{\/cue(?::[a-zA-Z0-9_-]+)?\}|\{cue:([a-zA-Z0-9_-]+)(?::([a-zA-Z0-9_-]+))?\})/g,
        (match, stringLiteral, _cueBlock, cueId1, color1, content, cueId2, color2) => {
          if (stringLiteral) {
            return stringLiteral;
          }
          if (content !== undefined) {
            const colorAttr = color1 ? ` data-color="${color1}"` : '';
            return `<mark id="${cueId1}" data-cue="${cueId1}"${colorAttr} class="highlight-marker font-semibold rounded-md">${content}</mark>`;
          }
          if (cueId2 !== undefined) {
            const colorAttr = color2 ? ` data-color="${color2}"` : '';
            return `<span id="${cueId2}" data-cue="${cueId2}"${colorAttr} class="cue-target"></span>`;
          }
          return match;
        }
      );

      return {
        code: frontmatter + transformedBody,
        map: null
      };
    }
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
      filter: (page) => !page.includes('/print/'),
      serialize(item) {
        try {
          const urlObj = new URL(item.url);
          const meta = getMetadataForPath(urlObj.pathname);
          return {
            ...item,
            lastmod: meta.lastmod ? meta.lastmod.toISOString() : item.lastmod,
            changefreq: /** @type {ChangeFreqEnum} */ (meta.changefreq),
            priority: meta.priority
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
        }
      }
    }),
    mdx(),
    copyContentAssets(),
    imageSitemapEnforcer()
  ],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath, remarkValidateImages, remarkMermaid, remarkSlideCues],
      rehypePlugins: [rehypeKatex, rehypeResponsiveTables, rehypeCallouts],
    }),
  },
  vite: {
    plugins: [tailwindcss(), vitePreSlideCues()],
  },
});


