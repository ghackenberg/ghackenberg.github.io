import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer, { type Browser } from 'puppeteer';
import {
  auditSlideDensity,
  type PresentationDensityReport,
  type SlideDensityResult,
} from '@commons/server/slide-density.js';

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

function startServer(initialPort = 4324): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createStaticServer();

    const tryPort = (portToTry: number) => {
      const onError = (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          server.removeListener('error', onError);
          tryPort(portToTry + 1);
        } else {
          reject(err);
        }
      };

      server.once('error', onError);
      server.listen(portToTry, '127.0.0.1', () => {
        server.removeListener('error', onError);
        resolve({ server, port: portToTry });
      });
    };

    tryPort(initialPort);
  });
}

interface CliArgs {
  targetPresentation?: string;
  targetSlide?: string;
  threshold?: number;
  failOnWarning: boolean;
}

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  let targetPresentation: string | undefined;
  let targetSlide: string | undefined;
  let threshold: number | undefined;
  let failOnWarning = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '--presentation' || arg === '--deck') && i + 1 < args.length) {
      targetPresentation = args[++i];
    } else if (arg.startsWith('--presentation=') || arg.startsWith('--deck=')) {
      targetPresentation = arg.split('=')[1];
    } else if (arg === '--slide' && i + 1 < args.length) {
      targetSlide = args[++i];
    } else if (arg.startsWith('--slide=')) {
      targetSlide = arg.split('=')[1];
    } else if (arg === '--threshold' && i + 1 < args.length) {
      const val = parseFloat(args[++i]);
      if (!isNaN(val)) threshold = val;
    } else if (arg.startsWith('--threshold=')) {
      const val = parseFloat(arg.split('=')[1]);
      if (!isNaN(val)) threshold = val;
    } else if (arg === '--fail-on-warning') {
      failOnWarning = true;
    }
  }

  return { targetPresentation, targetSlide, threshold, failOnWarning };
}

function matchesSlide(slide: SlideDensityResult, query: string): boolean {
  const q = query.trim().toLowerCase();
  const sNum = String(slide.slideNumber).trim().toLowerCase();
  const sId = String(slide.slideId).trim().toLowerCase();
  const qNum = parseInt(q, 10);
  const slideNumInt = parseInt(sNum, 10);
  if (!isNaN(qNum) && !isNaN(slideNumInt) && qNum === slideNumInt) {
    return true;
  }
  return sNum === q || sId === q || sId.startsWith(`${q}_`);
}

async function run(): Promise<void> {
  const { targetPresentation, targetSlide, threshold, failOnWarning } = parseCliArgs();

  console.log('\n📊 SLIDE CONTENT DENSITY LINTER: Container Filling Audit');
  console.log('Auditing presentations in: src/content/presentations\n');

  if (!fs.existsSync(distDir)) {
    console.error('❌ dist/ directory not found. Please run "npm run build" first.');
    process.exit(1);
  }

  const presentationsBase = path.resolve('src/content/presentations');
  if (!fs.existsSync(presentationsBase)) {
    console.log('No presentations found in src/content/presentations.');
    process.exit(0);
  }

  let decksToAudit: string[] = [];
  if (targetPresentation) {
    const targetPath = path.join(presentationsBase, targetPresentation);
    if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isDirectory()) {
      console.error(`❌ Presentation "${targetPresentation}" not found at ${targetPath}`);
      process.exit(1);
    }
    decksToAudit = [targetPresentation];
  } else {
    decksToAudit = fs
      .readdirSync(presentationsBase)
      .filter((folder) => {
        const fullPath = path.join(presentationsBase, folder);
        return fs.statSync(fullPath).isDirectory();
      })
      .sort();
  }

  if (decksToAudit.length === 0) {
    console.log('No presentations to audit.');
    process.exit(0);
  }

  const { server, port } = await startServer(4324);

  let browser: Browser | null = null;
  let totalSlidesScanned = 0;
  let totalContainersScanned = 0;
  let totalWarnings = 0;
  const reports: PresentationDensityReport[] = [];

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    for (const deck of decksToAudit) {
      console.log(`📦 Presentation: ${deck}`);
      const printUrl = `http://127.0.0.1:${port}/presentations/${deck}/print/?theme=dark`;
      const page = await browser.newPage();
      await page.evaluateOnNewDocument('window.__name = window.__name || function(f) { return f; };');
      await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

      try {
        const response = await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        if (!response || !response.ok()) {
          console.warn(`   ⚠️ Could not load print page for "${deck}" (status: ${response?.status()}). Skipping.\n`);
          continue;
        }

        await page.waitForSelector('[data-print-ready="true"]', { timeout: 15000 });
        await page.evaluateHandle('document.fonts.ready');

        const report = await auditSlideDensity(page, deck, {
          defaultThreshold: threshold,
        });
        reports.push(report);

        if (targetSlide) {
          const matchedSlides = report.results.filter((s) => matchesSlide(s, targetSlide));
          if (matchedSlides.length === 0) {
            console.log(`   ℹ️  No container-based slide matching "--slide=${targetSlide}" found in ${deck}.\n`);
            continue;
          }

          for (const slide of matchedSlides) {
            totalSlidesScanned += 1;
            totalContainersScanned += slide.containers.length;
            totalWarnings += slide.warnings.length;

            console.log(
              `   🔎 Detailed Audit for Slide ${slide.slideNumber} (${slide.slideId})${slide.slideTitle ? ` — "${slide.slideTitle}"` : ''}:`
            );
            for (const c of slide.containers) {
              const titlePart = c.containerTitle ? ` ("${c.containerTitle}")` : '';
              const statusIcon = c.isWarning ? '⚠️  [WARN]' : '✅ [OK]  ';
              const scaleInfo =
                c.contentScale !== undefined
                  ? ` | --content-scale: ${c.contentScale.toFixed(2)} (~${c.effectiveBodyFontPx}px body)`
                  : '';
              console.log(
                `      ${statusIcon} ${c.containerType}${titlePart}: Fill ${Math.round(c.fillRatio * 100)}% (Used: ${c.usedHeight}px / Avail: ${c.availableHeight}px) [Threshold: ${Math.round(c.threshold * 100)}%]${scaleInfo}`
              );
              if (c.previewSnippet) {
                console.log(`               Preview: "${c.previewSnippet}"`);
              }
              if (c.isWarning && c.remediationHint) {
                console.log(`               💡 Hint: ${c.remediationHint}`);
              }
            }
            console.log('');
          }
        } else {
          totalSlidesScanned += report.totalSlides;
          totalContainersScanned += report.totalContainersScanned;
          totalWarnings += report.warningsCount;

          if (report.warningsCount === 0) {
            console.log('   ✅ All content containers are well-filled.\n');
          } else {
            for (const slide of report.results) {
              if (slide.warnings.length === 0) continue;
              const minFill = Math.min(...slide.warnings.map((w) => Math.round(w.fillRatio * 100)));
              const targetThresh = Math.round(slide.warnings[0].threshold * 100);
              const strategyTag = slide.warnings[0].remediationStrategy
                ? ` [${slide.warnings[0].remediationStrategy}]`
                : '';
              console.log(
                `   ⚠️  Slide ${slide.slideNumber} (${slide.slideId}): ${slide.warnings.length}/${slide.containers.length} container(s) underfilled (min: ${minFill}% < ${targetThresh}%)${strategyTag}`
              );
            }
            console.log(
              `   ℹ️  Run "npm run lint:slide-density -- --presentation=${deck} --slide=<num>" for detailed container metrics & remediation hints.\n`
            );
          }
        }
      } catch (err) {
        console.error(
          `   ❌ Error auditing presentation "${deck}":`,
          err instanceof Error ? err.message : err
        );
      } finally {
        await page.close();
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('==================================================');
  console.log('Audit Summary:');
  console.log(`  Total presentations scanned: ${decksToAudit.length}`);
  console.log(`  Total slides scanned: ${totalSlidesScanned}`);
  console.log(`  Total containers scanned: ${totalContainersScanned}`);
  console.log(`  Total warnings detected: ${totalWarnings}`);
  if (totalWarnings === 0) {
    console.log('✅ All content containers are well-filled.');
  } else {
    console.log(`⚠️  ${totalWarnings} container(s) are underfilled across presentations.`);
  }
  console.log('==================================================\n');

  if (failOnWarning && totalWarnings > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err: Error) => {
  console.error('Fatal error during slide density audit:', err);
  process.exit(1);
});
