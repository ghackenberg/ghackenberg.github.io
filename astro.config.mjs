// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

        // Prefer copying sitemap-0.xml to sitemap.xml for direct urlset compatibility with Google Search Console
        const sitemap0Src = path.join(outDir, 'sitemap-0.xml');
        const sitemapIndexSrc = path.join(outDir, 'sitemap-index.xml');
        const sitemapDest = path.join(outDir, 'sitemap.xml');
        if (fs.existsSync(sitemap0Src)) {
          fs.copyFileSync(sitemap0Src, sitemapDest);
        } else if (fs.existsSync(sitemapIndexSrc)) {
          fs.copyFileSync(sitemapIndexSrc, sitemapDest);
        }
      }
    }
  };
}

// https://astro.build/config
export default defineConfig({
  site: 'https://ghackenberg.github.io',
  image: {
    dangerouslyProcessSVG: true,
  },
  integrations: [sitemap(), copyContentAssets()],
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});

