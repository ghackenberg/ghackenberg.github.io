import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import {
  computeSlideStyleHash,
  computePresentationDeckHash,
  loadVisualCache,
  saveVisualCache,
  type VisualCache,
} from '@commons/server/slide-fingerprint.js';

const PORT = 4323;
const distDir = path.resolve('dist');

/**
 * Serves dist folder statically for Puppeteer
 */
function createStaticServer(): http.Server {
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
  };

  return http.createServer((req, res) => {
    const urlPath = (req.url || '/').split('?')[0];

    // Serve presentation assets directly from src/content/presentations if available
    const presMatch = urlPath.match(/^\/presentations\/(.+)$/);
    if (presMatch) {
      const srcPath = path.resolve('src/content/presentations', presMatch[1]);
      if (fs.existsSync(srcPath) && fs.statSync(srcPath).isFile()) {
        const ext = path.extname(srcPath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(srcPath).pipe(res);
        return;
      }
    }

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
 * Safely writes a file buffer to disk, retrying on transient Windows file lock errors
 */
async function safeWriteFile(filePath: string, buffer: Buffer | Uint8Array, maxRetries = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      fs.writeFileSync(filePath, buffer);
      return;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }
}

/**
 * Compares two image buffers pixel-by-pixel using Chrome's native OffscreenCanvas via Puppeteer
 */
export async function compareImageBuffers(
  page: Page,
  existingBuffer: Buffer | Uint8Array,
  newBuffer: Buffer | Uint8Array,
  pixelThreshold = 5
): Promise<{ diffPixels: number; totalPixels: number; diffPercent: number }> {
  const existingBase64 = Buffer.from(existingBuffer).toString('base64');
  const newBase64 = Buffer.from(newBuffer).toString('base64');

  return await page.evaluate(
    async (b64A: string, b64B: string, threshold: number) => {
      function b64ToBlob(b64: string): Blob {
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], { type: 'image/webp' });
      }

      const [bmpA, bmpB] = await Promise.all([
        createImageBitmap(b64ToBlob(b64A)),
        createImageBitmap(b64ToBlob(b64B)),
      ]);

      if (bmpA.width !== bmpB.width || bmpA.height !== bmpB.height) {
        return { diffPixels: bmpA.width * bmpA.height, totalPixels: bmpA.width * bmpA.height, diffPercent: 100 };
      }

      const width = bmpA.width;
      const height = bmpA.height;
      const canvasA = new OffscreenCanvas(width, height);
      const ctxA = canvasA.getContext('2d', { willReadFrequently: true });
      const canvasB = new OffscreenCanvas(width, height);
      const ctxB = canvasB.getContext('2d', { willReadFrequently: true });

      if (!ctxA || !ctxB) {
        return { diffPixels: width * height, totalPixels: width * height, diffPercent: 100 };
      }

      ctxA.drawImage(bmpA, 0, 0);
      const dataA = ctxA.getImageData(0, 0, width, height).data;

      ctxB.drawImage(bmpB, 0, 0);
      const dataB = ctxB.getImageData(0, 0, width, height).data;

      let diffPixels = 0;
      const totalPixels = width * height;
      for (let i = 0; i < dataA.length; i += 4) {
        const dr = Math.abs(dataA[i] - dataB[i]);
        const dg = Math.abs(dataA[i + 1] - dataB[i + 1]);
        const db = Math.abs(dataA[i + 2] - dataB[i + 2]);
        const da = Math.abs(dataA[i + 3] - dataB[i + 3]);
        if (dr > threshold || dg > threshold || db > threshold || da > threshold) {
          diffPixels++;
        }
      }

      return {
        diffPixels,
        totalPixels,
        diffPercent: (diffPixels / totalPixels) * 100,
      };
    },
    existingBase64,
    newBase64,
    pixelThreshold
  );
}

/**
 * Generates slide thumbnails for a given presentation
 */
export async function generateSlideThumbnailsForPresentation(
  browser: Browser,
  port: number,
  presentationFolder: string,
  force = false
): Promise<void> {
  const presentationsBase = path.resolve('src/content/presentations');
  const presentationPath = path.join(presentationsBase, presentationFolder);
  const thumbnailsDir = path.join(presentationPath, 'thumbnails');
  fs.mkdirSync(thumbnailsDir, { recursive: true });

  const styleHash = computeSlideStyleHash();
  const { deckHash, slideHashes } = computePresentationDeckHash(presentationFolder, styleHash);
  let cache: VisualCache | null = loadVisualCache(presentationFolder);
  if (!cache) {
    cache = { version: 'v1.0', styleHash: '', deckHash: '', slides: {} };
  }

  const slideIds = Object.keys(slideHashes);
  const slidesNeedingUpdate = new Set<string>();

  for (const slideId of slideIds) {
    const thumbPath = path.join(thumbnailsDir, `${slideId}.webp`);
    if (force || !fs.existsSync(thumbPath) || cache.slides[slideId] !== slideHashes[slideId]) {
      slidesNeedingUpdate.add(slideId);
    }
  }

  if (slidesNeedingUpdate.size === 0) {
    console.log(`  ✓ All ${slideIds.length} thumbnails for "${presentationFolder}" are up to date (fingerprint cache hit).`);
    if (cache.deckHash !== deckHash) {
      cache.deckHash = deckHash;
      cache.styleHash = styleHash;
      saveVisualCache(presentationFolder, cache);
    }
    return;
  }

  console.log(`[Thumbnail Generator] Capturing ${slidesNeedingUpdate.size} of ${slideIds.length} thumbnails for "${presentationFolder}"...`);

  const printUrl = `http://127.0.0.1:${port}/presentations/${presentationFolder}/print/?theme=dark`;
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  try {
    const response = await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 60000 });
    if (!response || !response.ok()) {
      console.warn(`  ⚠️ Could not load print page for ${presentationFolder} (status: ${response?.status()}). Skipping.`);
      return;
    }

    await page.waitForSelector('[data-print-ready="true"]', { timeout: 15000 });
    await page.evaluateHandle('document.fonts.ready');

    const slideElements = await page.$$('.print-slide-page');
    const distThumbDir = path.join(distDir, 'presentations', presentationFolder, 'thumbnails');
    if (fs.existsSync(path.dirname(distThumbDir))) {
      fs.mkdirSync(distThumbDir, { recursive: true });
    }

    let writtenCount = 0;
    let preservedCount = 0;

    for (const el of slideElements) {
      const slideId = await el.evaluate((node) => node.getAttribute('data-slide-id'));
      if (!slideId) continue;
      if (!slidesNeedingUpdate.has(slideId)) continue;

      const outPath = path.join(thumbnailsDir, `${slideId}.webp`);
      const newBuffer = await el.screenshot({
        type: 'webp',
        quality: 82,
      });

      let shouldWrite = true;
      if (fs.existsSync(outPath) && !force) {
        try {
          const existingBuffer = fs.readFileSync(outPath);
          const diffResult = await compareImageBuffers(page, existingBuffer, newBuffer);
          if (diffResult.diffPixels === 0) {
            shouldWrite = false;
            preservedCount++;
          }
        } catch {
          shouldWrite = true;
        }
      }

      if (shouldWrite) {
        await safeWriteFile(outPath, newBuffer);
        if (fs.existsSync(distThumbDir)) {
          const hash = crypto.createHash('md5').update(newBuffer).digest('hex').slice(0, 8);
          await safeWriteFile(path.join(distThumbDir, `${slideId}-${hash}.webp`), newBuffer);
        }
        writtenCount++;
      }

      cache.slides[slideId] = slideHashes[slideId];
    }

    cache.styleHash = styleHash;
    cache.deckHash = deckHash;
    saveVisualCache(presentationFolder, cache);

    console.log(`  ✓ Thumbnails for "${presentationFolder}": ${writtenCount} written, ${preservedCount} preserved (0 pixel diff).`);
  } finally {
    await page.close();
  }
}

async function main() {
  const presentationsBase = path.resolve('src/content/presentations');
  if (!fs.existsSync(presentationsBase)) {
    console.log('[Thumbnail Generator] No presentations found.');
    return;
  }

  if (!fs.existsSync(distDir)) {
    console.error('[Thumbnail Generator] dist/ directory not found. Please run "npm run build" first.');
    process.exit(1);
  }

  const force = process.argv.includes('--force');

  const server = createStaticServer();
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(true)));
  console.log(`[Thumbnail Generator] Local static server listening on http://127.0.0.1:${PORT}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const presentationFolders = fs.readdirSync(presentationsBase);

  try {
    for (const folder of presentationFolders) {
      const pPath = path.join(presentationsBase, folder);
      if (!fs.statSync(pPath).isDirectory()) continue;
      await generateSlideThumbnailsForPresentation(browser, PORT, folder, force);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

if (process.argv[1] && /generate-slide-thumbnails\.(js|ts)$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error('[Thumbnail Generator] Error:', err);
    process.exit(1);
  });
}
