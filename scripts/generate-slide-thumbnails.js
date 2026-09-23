// @ts-check
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const PORT = 4323;
const distDir = path.resolve('dist');

/**
 * Serves dist folder statically for Puppeteer
 */
function createStaticServer() {
  /** @type {Record<string, string>} */
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2'
  };

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
 * Generates slide thumbnails for a given presentation
 * @param {import('puppeteer').Browser} browser
 * @param {number} port
 * @param {string} presentationFolder
 */
export async function generateSlideThumbnailsForPresentation(browser, port, presentationFolder) {
  const presentationsBase = path.resolve('src/content/presentations');
  const presentationPath = path.join(presentationsBase, presentationFolder);
  const thumbnailsDir = path.join(presentationPath, 'thumbnails');
  fs.mkdirSync(thumbnailsDir, { recursive: true });

  const printUrl = `http://127.0.0.1:${port}/presentations/${presentationFolder}/print/?theme=dark`;
  console.log(`[Thumbnail Generator] Capturing thumbnails for "${presentationFolder}"...`);

  const page = await browser.newPage();
  // Standard 16:9 1920x1080 canvas
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  try {
    const response = await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 60000 });
    if (!response || !response.ok()) {
      console.warn(`  ⚠️ Could not load print page for ${presentationFolder} (status: ${response?.status()}). Skipping.`);
      await page.close();
      return;
    }

    await page.waitForSelector('[data-print-ready="true"]', { timeout: 15000 });
    await page.evaluateHandle('document.fonts.ready');

    const slideElements = await page.$$('.print-slide-page');
    console.log(`  Found ${slideElements.length} slides to capture.`);

    const distThumbDir = path.join(distDir, 'presentations', presentationFolder, 'thumbnails');
    if (fs.existsSync(path.dirname(distThumbDir))) {
      fs.mkdirSync(distThumbDir, { recursive: true });
    }

/**
 * Safely writes a file buffer to disk, retrying on transient Windows file lock errors
 * @param {string} filePath
 * @param {Buffer | Uint8Array} buffer
 * @param {number} [maxRetries=5]
 */
async function safeWriteFile(filePath, buffer, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      fs.writeFileSync(filePath, buffer);
      return;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 200 * attempt));
    }
  }
}

    let count = 0;
    for (const el of slideElements) {
      const slideId = await el.evaluate(node => node.getAttribute('data-slide-id'));
      if (!slideId) continue;

      const outPath = path.join(thumbnailsDir, `${slideId}.webp`);
      const buffer = await el.screenshot({
        type: 'webp',
        quality: 82
      });
      await safeWriteFile(outPath, buffer);

      if (fs.existsSync(distThumbDir)) {
        await safeWriteFile(path.join(distThumbDir, `${slideId}.webp`), buffer);
      }
      count++;
    }

    console.log(`  ✓ Successfully generated ${count} WebP thumbnails in ${thumbnailsDir}`);
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

  const server = createStaticServer();
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(true)));
  console.log(`[Thumbnail Generator] Local static server listening on http://127.0.0.1:${PORT}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const presentationFolders = fs.readdirSync(presentationsBase);

  try {
    for (const folder of presentationFolders) {
      const pPath = path.join(presentationsBase, folder);
      if (!fs.statSync(pPath).isDirectory()) continue;
      await generateSlideThumbnailsForPresentation(browser, PORT, folder);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

if (process.argv[1] && process.argv[1].endsWith('generate-slide-thumbnails.js')) {
  main().catch((err) => {
    console.error('[Thumbnail Generator] Error:', err);
    process.exit(1);
  });
}
