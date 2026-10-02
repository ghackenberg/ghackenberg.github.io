import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer';

const rootDir = process.cwd();
const distDir = path.resolve(rootDir, 'dist');
const publicDir = path.resolve(rootDir, 'public');
const srcImagesDir = path.resolve(rootDir, 'src/assets/images');

const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

/**
 * Serves dist folder statically for Puppeteer
 */
function createStaticServer(): http.Server {
  return http.createServer((req, res) => {
    const urlPath = (req.url || '/').split('?')[0];
    let filePath = path.join(distDir, urlPath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
}

/**
 * Safely writes a file buffer to disk, avoiding git churn if identical
 */
function safeWriteIfChanged(destPath: string, buffer: Buffer): boolean {
  if (fs.existsSync(destPath)) {
    const existing = fs.readFileSync(destPath);
    if (existing.equals(buffer)) {
      return false; // Identical, skip write
    }
  }
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(destPath, buffer);
  return true;
}

async function main(): Promise<void> {
  const ogHtmlPath = path.join(distDir, '_internal/og/index.html');
  const iconHtmlPath = path.join(distDir, '_internal/icon/index.html');

  if (!fs.existsSync(ogHtmlPath) || !fs.existsSync(iconHtmlPath)) {
    console.log('[Asset Generator] dist/_internal pages not found, running build first...');
    execSync('npx astro build', { stdio: 'inherit' });
  }

  const PORT = 9876;
  const server = createStaticServer();

  await new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      console.log(`[Asset Generator] Serving dist/ on http://localhost:${PORT}`);
      resolve();
    });
  });

  try {
    const browser = await puppeteer.launch({
      headless: 'shell',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    async function capture(urlPath: string, width: number, height: number, destPaths: string[]): Promise<void> {
      const page = await browser.newPage();
      await page.setViewport({ width, height, deviceScaleFactor: 1 });

      await page.evaluateOnNewDocument(() => {
        const style = document.createElement('style');
        style.innerHTML = 'html, body { background: transparent !important; }';
        document.head.appendChild(style);
      });

      const fullUrl = `http://localhost:${PORT}${urlPath}`;
      await page.goto(fullUrl, { waitUntil: 'networkidle0' });
      await page.evaluateHandle(() => document.fonts.ready);

      const buffer = (await page.screenshot({ omitBackground: true })) as Buffer;
      await page.close();

      for (const destPath of destPaths) {
        const changed = safeWriteIfChanged(destPath, buffer);
        const status = changed ? '✔ Generated' : '⚡ Unchanged';
        console.log(`[${status}] ${path.basename(destPath)} (${width}x${height})`);
      }
    }

    console.log('[Asset Generator] Starting screenshots compilation from Astro pages...');

    // 1. Generate Favicons (Transparent)
    await capture('/_internal/icon/?mode=transparent', 16, 16, [
      path.join(publicDir, 'favicon-16x16.png'),
      path.join(distDir, 'favicon-16x16.png'),
    ]);
    await capture('/_internal/icon/?mode=transparent', 32, 32, [
      path.join(publicDir, 'favicon-32x32.png'),
      path.join(distDir, 'favicon-32x32.png'),
    ]);

    // 2. Generate Apple Touch Icon & PWA App Icons
    await capture('/_internal/icon/?mode=app', 180, 180, [
      path.join(publicDir, 'apple-touch-icon.png'),
      path.join(distDir, 'apple-touch-icon.png'),
    ]);
    await capture('/_internal/icon/?mode=app', 192, 192, [
      path.join(publicDir, 'icon-192x192.png'),
      path.join(distDir, 'icon-192x192.png'),
    ]);
    await capture('/_internal/icon/?mode=app', 512, 512, [
      path.join(publicDir, 'icon-512x512.png'),
      path.join(distDir, 'icon-512x512.png'),
    ]);

    // 3. Generate Maskable Icon
    await capture('/_internal/icon/?mode=maskable', 512, 512, [
      path.join(publicDir, 'icon-512x512-maskable.png'),
      path.join(distDir, 'icon-512x512-maskable.png'),
    ]);

    // 4. Generate Social Sharing Banner (1200x630)
    await capture('/_internal/og/', 1200, 630, [
      path.join(srcImagesDir, 'og-share-preview.png'),
      path.join(distDir, 'images/og-share-preview.png'),
    ]);

    await browser.close();
    console.log('[Asset Generator] All assets compiled successfully from Astro pages!');
  } finally {
    server.close();
    console.log('[Asset Generator] Static server stopped.');

    // Clean up dist/_internal/ from public build output so it is never deployed
    const distInternalDir = path.join(distDir, '_internal');
    if (fs.existsSync(distInternalDir)) {
      fs.rmSync(distInternalDir, { recursive: true, force: true });
      console.log('[Asset Generator] Cleaned up dist/_internal/ from public build output.');
    }
  }
}

main().catch((err) => {
  console.error('[Asset Generator] Error during generation:', err);
  process.exit(1);
});
