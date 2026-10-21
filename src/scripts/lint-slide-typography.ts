import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer, { type Browser } from 'puppeteer';
import {
  auditSlideTypography,
  type PresentationTypographyReport,
  type TypographyAuditResult,
} from '@commons/server/slide-typography.js';
import { auditSlideDensity } from '@commons/server/slide-density.js';
import {
  ENGINE_VERSION,
  computeSlideStyleHash,
  computePresentationDeckHash,
  loadSlideAuditCache,
  saveSlideAuditCache,
} from '@commons/server/slide-fingerprint.js';

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

function parseCliArgs(): {
  targetPresentation?: string;
  targetSlide?: string;
  maxRatio: number;
  minSize: number;
  failOnWarning: boolean;
  force: boolean;
  verbose: boolean;
} {
  const args = process.argv.slice(2);
  let targetPresentation: string | undefined;
  let targetSlide: string | undefined;
  let maxRatio = 0.85;
  let minSize = 18;
  let failOnWarning = false;
  let force = false;
  let verbose = false;

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
    } else if (arg === '--max-ratio' && i + 1 < args.length) {
      maxRatio = parseFloat(args[++i]) || 0.85;
    } else if (arg.startsWith('--max-ratio=')) {
      maxRatio = parseFloat(arg.split('=')[1]) || 0.85;
    } else if (arg === '--min-size' && i + 1 < args.length) {
      minSize = parseFloat(args[++i]) || 18;
    } else if (arg.startsWith('--min-size=')) {
      minSize = parseFloat(arg.split('=')[1]) || 18;
    } else if (arg === '--fail-on-warning') {
      failOnWarning = true;
    } else if (arg === '--force') {
      force = true;
    } else if (arg === '--verbose') {
      verbose = true;
    }
  }

  return { targetPresentation, targetSlide, maxRatio, minSize, failOnWarning, force, verbose };
}

function matchesSlide(slide: TypographyAuditResult, query: string): boolean {
  const parts = query.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
  const sNum = String(slide.slideNumber).trim().toLowerCase();
  const sId = String(slide.slideId).trim().toLowerCase();
  const slideNumInt = parseInt(sNum, 10);

  return parts.some((q) => {
    const qNum = parseInt(q, 10);
    if (!isNaN(qNum) && !isNaN(slideNumInt) && qNum === slideNumInt) {
      return true;
    }
    return sNum === q || sId === q || sId.startsWith(`${q}_`);
  });
}

function printSlideTypographyDetails(
  slide: TypographyAuditResult,
  maxRatio: number,
  minSize: number
): void {
  console.log(
    `   🔎 Detailed Typography Audit for Slide ${slide.slideNumber} (${slide.slideId}) — "${slide.slideTitle}":`
  );
  console.log(`      • Slide Title Font Size:      ${slide.titleFontSize}px`);
  console.log(
    `      • Largest Content Font Size:  ${slide.maxContentFontSize}px (${(slide.ratio * 100).toFixed(1)}% of title, max ${(maxRatio * 100).toFixed(0)}%) in ${slide.largestElement}`
  );
  console.log(
    `      • Smallest Primary Font Size: ${slide.minContentFontSize}px (min ${minSize}px) in ${slide.smallestElement}`
  );
  if (slide.warnings.length === 0) {
    console.log(`      ✅ Healthy typographic hierarchy, readability, and single-line header fit.`);
  } else {
    for (const w of slide.warnings) {
      if (w.type === 'HEADER_OVERFLOW') {
        console.log(
          `      ⚠️  [WARN: HEADER OVERFLOW] ${w.element} exceeds single-line header width (${w.scrollWidth}px > ${w.maxWidth}px)`
        );
        console.log(`               Preview: "${w.previewText}"`);
      } else if (w.type === 'TOO_LARGE') {
        console.log(
          `      ⚠️  [WARN: TOO LARGE] Content text in ${w.element} (${w.fontSize}px) >= ${(maxRatio * 100).toFixed(0)}% of Slide Title (${slide.titleFontSize}px) [Ratio: ${w.ratio}x]`
        );
        console.log(`               Preview: "${w.previewText}"`);
      } else if (w.type === 'TOO_SMALL') {
        console.log(
          `      ⚠️  [WARN: TOO SMALL] Primary text in ${w.element} (${w.fontSize}px) is below readable threshold (${w.threshold}px) after scaling`
        );
        console.log(`               Preview: "${w.previewText}"`);
      }
    }
  }
  console.log('');
}

async function run(): Promise<void> {
  const { targetPresentation, targetSlide, maxRatio, minSize, failOnWarning, force, verbose } =
    parseCliArgs();

  if (verbose || targetSlide) {
    console.log('\n🔍 SLIDE TYPOGRAPHY LINTER: Visual Hierarchy, Readability & Single-Line Header Audit');
    console.log(
      `Thresholds: Max Ratio = ${(maxRatio * 100).toFixed(0)}% of Slide Title | Min Primary Font Size = ${minSize}px | Max Header Width = 1600px (title) / 1824px (subtitle)`
    );
    console.log('Auditing presentations in: src/content/presentations\n');
  }

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

  const styleHash = computeSlideStyleHash();
  let server: http.Server | null = null;
  let port = 4324;
  let browser: Browser | null = null;

  let totalSlidesScanned = 0;
  let totalWarnings = 0;
  let totalTooLarge = 0;
  let totalTooSmall = 0;
  let totalHeaderOverflow = 0;
  const reports: PresentationTypographyReport[] = [];

  try {
    for (const deck of decksToAudit) {
      const { deckHash } = computePresentationDeckHash(deck, styleHash);
      const existingCache = !force && !targetSlide ? loadSlideAuditCache(deck) : null;

      let report: PresentationTypographyReport | undefined;
      if (
        existingCache &&
        existingCache.deckHash === deckHash &&
        existingCache.typography &&
        existingCache.typography.maxRatio === maxRatio &&
        existingCache.typography.minSize === minSize
      ) {
        report = existingCache.typography.report;
      } else {
        if (!server) {
          const started = await startServer(4324);
          server = started.server;
          port = started.port;
        }
        if (!browser) {
          browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
          });
        }

        const printUrl = `http://127.0.0.1:${port}/presentations/${deck}/print/?theme=dark`;
        const page = await browser.newPage();
        await page.evaluateOnNewDocument(
          'window.__name = window.__name || function(f) { return f; };'
        );
        await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

        try {
          const response = await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 60000 });
          if (!response || !response.ok()) {
            console.warn(
              `   ⚠️ Could not load print page for "${deck}" (status: ${response?.status()}). Skipping.\n`
            );
            continue;
          }

          await page.waitForSelector('[data-print-ready="true"]', { timeout: 15000 });
          await page.evaluateHandle('document.fonts.ready');

          report = await auditSlideTypography(page, deck, {
            maxRatioThreshold: maxRatio,
            minFontSizeThreshold: minSize,
          });

          const densityReport = await auditSlideDensity(page, deck);

          saveSlideAuditCache(deck, {
            version: ENGINE_VERSION,
            platform: process.platform,
            styleHash,
            deckHash,
            typography: {
              maxRatio,
              minSize,
              report,
            },
            density: {
              threshold: 0,
              report: densityReport,
            },
          });
        } catch (err) {
          console.error(
            `   ❌ Error auditing presentation "${deck}":`,
            err instanceof Error ? err.message : err
          );
          continue;
        } finally {
          await page.close();
        }
      }

      if (!report) continue;
      reports.push(report);

      if (targetSlide) {
        console.log(`📦 Presentation: ${deck}`);
        const matchedSlides = report.results.filter((s) => matchesSlide(s, targetSlide));
        if (matchedSlides.length === 0) {
          console.log(`   ℹ️  No titled slide matching "--slide=${targetSlide}" found in ${deck}.\n`);
          continue;
        }

        for (const slide of matchedSlides) {
          totalSlidesScanned += 1;
          totalWarnings += slide.warnings.length;
          if (slide.isTooLargeWarning) totalTooLarge += 1;
          if (slide.isTooSmallWarning) totalTooSmall += 1;
          if (slide.isHeaderOverflowWarning) totalHeaderOverflow += 1;
          printSlideTypographyDetails(slide, maxRatio, minSize);
        }
      } else {
        totalSlidesScanned += report.totalSlides;
        totalWarnings += report.warningsCount;
        totalTooLarge += report.tooLargeCount;
        totalTooSmall += report.tooSmallCount;
        totalHeaderOverflow += report.headerOverflowCount;

        if (report.warningsCount > 0 || verbose) {
          console.log(`📦 Presentation: ${deck}`);
          if (report.warningsCount === 0) {
            console.log(
              `   ✅ All ${report.results.length} slides with titles (${report.totalSlides} total) maintain healthy typography & single-line headers.\n`
            );
          } else {
            for (const warningSlide of report.results.filter((r) => r.isWarning)) {
              printSlideTypographyDetails(warningSlide, maxRatio, minSize);
            }
          }
        }
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    if (server) {
      const s = server;
      await new Promise((resolve) => s.close(resolve));
    }
  }

  if (totalWarnings === 0 && !verbose && !targetSlide) {
    console.log(
      `✅ [Slide Typography] All ${totalSlidesScanned} slides across ${reports.length} presentations passed hierarchy, readability & single-line header checks.`
    );
  } else {
    console.log('==================================================');
    console.log('Audit Summary:');
    console.log(`  Total presentations scanned: ${decksToAudit.length}`);
    console.log(`  Total slides scanned: ${totalSlidesScanned}`);
    console.log(
      `  Total warnings detected: ${totalWarnings} (Header Overflow: ${totalHeaderOverflow}, Too Large: ${totalTooLarge}, Too Small: ${totalTooSmall})`
    );
    if (totalWarnings === 0) {
      console.log(
        '✅ All slides maintain healthy typographic hierarchy, single-line headers, and comfortable reading size.'
      );
    } else {
      console.log(
        '⚠️  Some slides violated typographic hierarchy, header single-line fit, or minimum font size constraints.'
      );
    }
    console.log('==================================================\n');
  }

  if (failOnWarning && totalWarnings > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err: Error) => {
  console.error('Fatal error during slide typography audit:', err);
  process.exit(1);
});
