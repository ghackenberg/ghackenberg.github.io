// @ts-check
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const PORT = 4322;
const distDir = path.resolve('dist');

/**
 * Serves dist folder statically for Puppeteer printing
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

async function exportAllTalksToPdf() {
  const talksBase = path.resolve('src/content/talks');
  if (!fs.existsSync(talksBase)) {
    console.log('[PDF Exporter] No talks found.');
    return;
  }

  if (!fs.existsSync(distDir)) {
    console.error('[PDF Exporter] dist/ directory not found. Please run "npm run build" first.');
    process.exit(1);
  }

  const server = createStaticServer();
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(true)));
  console.log(`[PDF Exporter] Local static server listening on http://127.0.0.1:${PORT}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const talkFolders = fs.readdirSync(talksBase);

  try {
    for (const talkFolder of talkFolders) {
      const talkPath = path.join(talksBase, talkFolder);
      if (!fs.statSync(talkPath).isDirectory()) continue;

      const printUrl = `http://127.0.0.1:${PORT}/talks/${talkFolder}/print/`;
      const outPdfPath = path.join(talkPath, 'slides.pdf');

      console.log(`[PDF Exporter] Rendering PDF for talk "${talkFolder}" from ${printUrl}...`);

      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });

      const response = await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 60000 });
      if (!response || !response.ok()) {
        console.warn(`  ⚠️ Could not load print page for ${talkFolder} (status: ${response?.status()}). Skipping.`);
        await page.close();
        continue;
      }

      await page.pdf({
        path: outPdfPath,
        printBackground: true,
        landscape: true,
        format: 'A4',
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      });

      console.log(`  ✓ Successfully generated: ${outPdfPath}`);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log('[PDF Exporter] Complete.');
}

exportAllTalksToPdf().catch((err) => {
  console.error('[PDF Exporter] Fatal error:', err);
  process.exit(1);
});
