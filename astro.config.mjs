// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((req, res, next) => {
          const match = req.url?.match(/^\/(posts|publications|visualizations)\/(.+)$/);
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
        });
      },
      'astro:build:done': async ({ dir }) => {
        const outDir = fileURLToPath(dir);
        const collections = ['posts', 'publications', 'visualizations'];
        for (const col of collections) {
          const srcDir = path.resolve('src/content', col);
          if (!fs.existsSync(srcDir)) continue;

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

// https://astro.build/config
export default defineConfig({
  site: 'https://ghackenberg.github.io',
  integrations: [copyContentAssets()],
  vite: {
    plugins: [tailwindcss()],
  },
});

