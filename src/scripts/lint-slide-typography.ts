import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer, { type Browser } from 'puppeteer';
import {
  auditSlideTypography,
  type PresentationTypographyReport,
  type TypographyAuditResult,
} from '@commons/server/slide-typography.js';

const PORT = 4324;
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

function parseCliArgs(): {
  targetPresentation?: string;
  targetSlide?: string;
  maxRatio: number;
  minSize: number;
  failOnWarning: boolean;
} {
  const args = process.argv.slice(2);
  let targetPresentation: string | undefined;
  let targetSlide: string | undefined;
  let maxRatio = 0.85;
  let minSize = 18;
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
    }
  }

  return { targetPresentation, targetSlide, maxRatio, minSize, failOnWarning };
}

function matchesSlide(slide: TypographyAuditResult, query: string): boolean {
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
  const { targetPresentation, targetSlide, maxRatio, minSize, failOnWarning } = parseCliArgs();

  console.log('\n🔍 SLIDE TYPOGRAPHY LINTER: Visual Hierarchy & Readability Audit');
  console.log(`Thresholds: Max Ratio = ${(maxRatio * 100).toFixed(0)}% of Slide Title | Min Primary Font Size = ${minSize}px`);
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

  const server = createStaticServer();
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(true)));

  let browser: Browser | null = null;
  let totalSlidesScanned = 0;
  let totalWarnings = 0;
  let totalTooLarge = 0;
  let totalTooSmall = 0;
  const reports: PresentationTypographyReport[] = [];

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    for (const deck of decksToAudit) {
      console.log(`📦 Presentation: ${deck}`);
      const printUrl = `http://127.0.0.1:${PORT}/presentations/${deck}/print/?theme=dark`;
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

        const report = await auditSlideTypography(page, deck, {
          maxRatioThreshold: maxRatio,
          minFontSizeThreshold: minSize,
        });
        reports.push(report);

        if (targetSlide) {
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
              console.log(`      ✅ Healthy typographic hierarchy and readability.`);
            } else {
              for (const w of slide.warnings) {
                if (w.type === 'TOO_LARGE') {
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
        } else {
          totalSlidesScanned += report.totalSlides;
          totalWarnings += report.warningsCount;
          totalTooLarge += report.tooLargeCount;
          totalTooSmall += report.tooSmallCount;

          if (report.warningsCount === 0) {
            console.log(
              `   ✅ All ${report.results.length} slides with titles (${report.totalSlides} total) maintain healthy typography.\n`
            );
          } else {
            for (const warning of report.results.filter((r) => r.isWarning)) {
              const types = warning.warnings.map((w) => w.type).join(', ');
              console.log(
                `   ⚠️  Slide ${warning.slideNumber} (${warning.slideId}): ${warning.warnings.length} warning(s) [${types}] (Title: ${warning.titleFontSize}px | Max: ${warning.maxContentFontSize}px | Min: ${warning.minContentFontSize}px)`
              );
            }
            console.log(
              `   ℹ️  Run "npm run lint:slide-typography -- --presentation=${deck} --slide=<num>" for detailed element paths & previews.\n`
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
  console.log(`  Total warnings detected: ${totalWarnings} (Too Large: ${totalTooLarge}, Too Small: ${totalTooSmall})`);
  if (totalWarnings === 0) {
    console.log('✅ All slides maintain healthy typographic hierarchy and comfortable reading size.');
  } else {
    console.log('⚠️  Some slides violated typographic hierarchy or minimum font size constraints.');
  }
  console.log('==================================================\n');

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
