// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap, { ChangeFreqEnum } from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSitemapMetadata } from './scripts/sitemap-config.js';

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

function copyContentAssets() {
  return {
    name: 'copy-content-assets',
    hooks: {
      /** @param {{ server: import('vite').ViteDevServer }} options */
      'astro:server:setup': ({ server }) => {
        server.middlewares.use(
          /**
           * @param {import('http').IncomingMessage} req
           * @param {import('http').ServerResponse} res
           * @param {() => void} next
           */
          (req, res, next) => {
            const match = req.url?.match(/^\/(posts|publications|visualizations|courses|services)\/(.+)$/);
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
        const collections = ['posts', 'publications', 'visualizations', 'courses', 'services'];
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

const { getMetadataForPath } = buildSitemapMetadata();

// https://astro.build/config
export default defineConfig({
  site: 'https://hackenberg.tech',
  image: {
    dangerouslyProcessSVG: true,
  },
  integrations: [
    sitemap({
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
        }
      }
    }),
    copyContentAssets()
  ],
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});


