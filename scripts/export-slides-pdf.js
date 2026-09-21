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

async function exportAllPresentationsToPdf() {
  const presentationsBase = path.resolve('src/content/presentations');
  if (!fs.existsSync(presentationsBase)) {
    console.log('[PDF Exporter] No presentations found.');
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

  const presentationFolders = fs.readdirSync(presentationsBase);

  try {
    for (const presentationFolder of presentationFolders) {
      const presentationPath = path.join(presentationsBase, presentationFolder);
      if (!fs.statSync(presentationPath).isDirectory()) continue;

      // 1. Dark Mode PDF
      const darkPrintUrl = `http://127.0.0.1:${PORT}/presentations/${presentationFolder}/print/?theme=dark`;
      const darkOutPdfPath = path.join(presentationPath, 'slides-dark.pdf');

      console.log(`[PDF Exporter] Rendering Dark Mode PDF for "${presentationFolder}"...`);
      const darkPage = await browser.newPage();
      await darkPage.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });

      const darkResponse = await darkPage.goto(darkPrintUrl, { waitUntil: 'networkidle0', timeout: 60000 });
      if (!darkResponse || !darkResponse.ok()) {
        console.warn(`  ⚠️ Could not load dark print page for ${presentationFolder} (status: ${darkResponse?.status()}). Skipping.`);
      } else {
        await darkPage.waitForSelector('[data-print-ready="true"]', { timeout: 15000 });
        await darkPage.evaluateHandle('document.fonts.ready');
        await darkPage.pdf({
          path: darkOutPdfPath,
          printBackground: true,
          preferCSSPageSize: true,
          width: '1920px',
          height: '1080px',
          margin: { top: 0, right: 0, bottom: 0, left: 0 }
        });

        const distPresentationPath = path.join(distDir, 'presentations', presentationFolder);
        if (fs.existsSync(distPresentationPath)) {
          fs.copyFileSync(darkOutPdfPath, path.join(distPresentationPath, 'slides-dark.pdf'));
        }

        console.log(`  ✓ Successfully generated Dark Mode PDF: ${darkOutPdfPath}`);
      }
      await darkPage.close();

      // 2. Light Mode PDF
      const lightPrintUrl = `http://127.0.0.1:${PORT}/presentations/${presentationFolder}/print/?theme=light`;
      const lightOutPdfPath = path.join(presentationPath, 'slides-light.pdf');

      console.log(`[PDF Exporter] Rendering Light Mode PDF for "${presentationFolder}"...`);
      const lightPage = await browser.newPage();
      await lightPage.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });

      const lightResponse = await lightPage.goto(lightPrintUrl, { waitUntil: 'networkidle0', timeout: 60000 });
      if (!lightResponse || !lightResponse.ok()) {
        console.warn(`  ⚠️ Could not load light print page for ${presentationFolder} (status: ${lightResponse?.status()}). Skipping.`);
      } else {
        await lightPage.waitForSelector('[data-print-ready="true"]', { timeout: 15000 });
        await lightPage.evaluateHandle('document.fonts.ready');
        await lightPage.pdf({
          path: lightOutPdfPath,
          printBackground: true,
          preferCSSPageSize: true,
          width: '1920px',
          height: '1080px',
          margin: { top: 0, right: 0, bottom: 0, left: 0 }
        });

        const distPresentationPath = path.join(distDir, 'presentations', presentationFolder);
        if (fs.existsSync(distPresentationPath)) {
          fs.copyFileSync(lightOutPdfPath, path.join(distPresentationPath, 'slides-light.pdf'));
        }

        console.log(`  ✓ Successfully generated Light Mode PDF: ${lightOutPdfPath}`);
      }
      await lightPage.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log('[PDF Exporter] Complete.');
}

exportAllPresentationsToPdf().catch((err) => {
  console.error('[PDF Exporter] Fatal error:', err);
  process.exit(1);
});
