import { execSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
// @ts-ignore - lighthouse types are resolved at runtime
import lighthouse, { desktopConfig } from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const rootDir = process.cwd();
const distDir = path.resolve(rootDir, 'dist');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const port = 45678;
const baseUrl = `http://localhost:${port}`;

interface AuditTarget {
  path: string;
  name: string;
}

interface AuditScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

interface LighthouseCategory {
  score?: number | null;
}

interface AuditIssue {
  id: string;
  title: string;
  score: number | null;
  displayValue?: string;
  category: string;
}

interface LighthouseResult {
  report: string[];
  lhr: {
    categories: {
      performance?: LighthouseCategory;
      accessibility?: LighthouseCategory;
      'best-practices'?: LighthouseCategory;
      seo?: LighthouseCategory;
    };
    audits: Record<
      string,
      {
        id: string;
        title: string;
        score: number | null;
        scoreDisplayMode?: string;
        displayValue?: string;
        explanation?: string;
        description?: string;
      }
    >;
  };
}

interface AuditResult {
  name: string;
  path: string;
  theme: 'dark' | 'light';
  scores: AuditScores;
  issues: AuditIssue[];
}

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
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
};

const urlsToAudit: AuditTarget[] = [
  // Overview Pages
  { path: '/', name: 'homepage' },
  { path: '/services/', name: 'services' },
  { path: '/courses/', name: 'courses' },
  { path: '/posts/', name: 'blog_listing' },
  { path: '/projects/', name: 'projects' },
  { path: '/publications/', name: 'publications' },
  { path: '/visualizations/', name: 'visualizations' },
  { path: '/presentations/', name: 'presentations' },

  // Detail Pages
  { path: '/services/content-engineering/', name: 'services_detail' },
  { path: '/services/content-engineering/pipelines/', name: 'services_module_detail' },
  { path: '/courses/course-python-programming/', name: 'course_detail' },
  { path: '/posts/2026_05_23_website_relaunch_astro_typescript/', name: 'blog_post' },
  { path: '/projects/delta-dynamics/', name: 'project_detail' },
  { path: '/publications/2025_01_modelsward/', name: 'publication_detail' },
  { path: '/visualizations/sigma/', name: 'visualization_detail' },
  { path: '/presentations/2026_09_23_slide_as_code_presentation_engine/', name: 'presentation_detail' },
];

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

function formatScoreCell(score?: number | null): string {
  if (score === undefined || score === null) return 'N/A';
  const scoreStr = String(score).padEnd(3);
  if (score >= 90) {
    return `\x1b[32m${scoreStr}\x1b[0m`; // Green
  } else if (score >= 50) {
    return `\x1b[33m${scoreStr}\x1b[0m`; // Yellow
  } else {
    return `\x1b[31m${scoreStr}\x1b[0m`; // Red
  }
}

async function safeCleanDir(dirPath: string, retries = 5, delayMs = 300): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const skipBuild = args.includes('--skip-build');
  const isDesktop = args.includes('--desktop');
  const pageArg = args.find((a) => a.startsWith('--page='))?.split('=')[1];
  const themeArg = args.find((a) => a.startsWith('--theme='))?.split('=')[1] as 'dark' | 'light' | undefined;

  // 1. Build site if requested or dist is missing
  if (!skipBuild || !fs.existsSync(distDir)) {
    console.log('[Lighthouse] Building website for production...');
    try {
      execSync(`${npmCmd} run build`, { stdio: 'inherit', cwd: rootDir });
    } catch (error) {
      console.error('[Lighthouse] Failed to build website:', error);
      process.exit(1);
    }
  } else {
    console.log('[Lighthouse] Skipping build (--skip-build specified). Using existing dist/...');
  }

  // 2. Start internal static server
  console.log(`[Lighthouse] Starting internal server on port ${port}...`);
  const server = createStaticServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve());
  });
  console.log(`[Lighthouse] Internal server is ready at ${baseUrl}`);

  // 3. Launch headless Chrome
  console.log('[Lighthouse] Launching headless Chrome...');
  const tmpUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-chrome-profile-'));
  let chrome: chromeLauncher.LaunchedChrome | undefined;
  try {
    chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
      userDataDir: tmpUserDataDir,
    });
    console.log(`[Lighthouse] Chrome launched on port ${chrome.port}`);
  } catch (err) {
    console.error('[Lighthouse] Failed to launch Chrome:', err);
    server.close();
    await safeCleanDir(tmpUserDataDir);
    process.exit(1);
  }

  const reportsDir = path.join(rootDir, 'lighthouse-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const resultsSummary: AuditResult[] = [];
  let thresholdFailed = false;
  const minRequiredScore = process.env.LH_MIN_SCORE ? parseInt(process.env.LH_MIN_SCORE, 10) : 90;
  const minA11yScore = process.env.LH_MIN_A11Y_SCORE ? parseInt(process.env.LH_MIN_A11Y_SCORE, 10) : 98;

  const targetPages = pageArg
    ? urlsToAudit.filter((p) => p.name === pageArg || p.path === pageArg || p.path.includes(pageArg))
    : urlsToAudit;

  if (targetPages.length === 0) {
    console.error(`[Lighthouse] No pages matched --page=${pageArg}`);
    chrome.kill();
    server.close();
    await safeCleanDir(tmpUserDataDir);
    process.exit(1);
  }

  const targetThemes: Array<'dark' | 'light'> = themeArg ? [themeArg] : ['dark', 'light'];

  try {
    for (const page of targetPages) {
      for (const theme of targetThemes) {
        const suffix = theme === 'light' ? '?theme=light' : '?theme=dark';
        const url = `${baseUrl}${page.path}${suffix}`;
        console.log(`\n[Lighthouse] Auditing (${theme} mode, ${isDesktop ? 'desktop' : 'mobile'}): ${url}...`);

        const flags = {
          logLevel: 'error' as const,
          output: ['html', 'json'] as Array<'html' | 'json'>,
          port: chrome.port,
        };

        const config = isDesktop ? desktopConfig : undefined;
        const runnerResult = (await lighthouse(url, flags, config)) as LighthouseResult;

        if (!runnerResult) {
          console.warn(`[Lighthouse] Warning: No result returned for ${url}`);
          continue;
        }

        const htmlReport = runnerResult.report[0];
        const jsonReport = runnerResult.report[1];
        const lhr = runnerResult.lhr;

        // Save report artifacts
        fs.writeFileSync(path.join(reportsDir, `${page.name}_${theme}.html`), htmlReport);
        fs.writeFileSync(path.join(reportsDir, `${page.name}_${theme}.json`), jsonReport);

        const scores: AuditScores = {
          performance: Math.round((lhr.categories.performance?.score || 0) * 100),
          accessibility: Math.round((lhr.categories.accessibility?.score || 0) * 100),
          bestPractices: Math.round((lhr.categories['best-practices']?.score || 0) * 100),
          seo: Math.round((lhr.categories.seo?.score || 0) * 100),
        };

        // Extract failing audit issues
        const issues: AuditIssue[] = [];
        for (const [auditKey, auditVal] of Object.entries(lhr.audits)) {
          if (auditVal.score !== null && auditVal.score < 0.9 && auditVal.scoreDisplayMode !== 'notApplicable') {
            issues.push({
              id: auditKey,
              title: auditVal.title,
              score: auditVal.score,
              displayValue: auditVal.displayValue,
              category: auditKey,
            });
          }
        }

        resultsSummary.push({
          name: page.name,
          path: page.path,
          theme,
          scores,
          issues,
        });

        console.log(
          `  -> Perf: ${formatScoreCell(scores.performance)} | A11y: ${formatScoreCell(scores.accessibility)} | Best: ${formatScoreCell(scores.bestPractices)} | SEO: ${formatScoreCell(scores.seo)}`
        );

        if (
          scores.performance < minRequiredScore ||
          scores.accessibility < minA11yScore ||
          scores.bestPractices < minRequiredScore ||
          scores.seo < minRequiredScore
        ) {
          thresholdFailed = true;
        }
      }
    }
  } catch (err) {
    console.error('[Lighthouse] Error during audit run:', err);
  } finally {
    console.log('\n[Lighthouse] Cleaning up Chrome and server...');
    try {
      chrome.kill();
    } catch {}
    server.close();
    await safeCleanDir(tmpUserDataDir);
  }

  // Display summary table
  console.log('\n========================================================================');
  console.log(` LIGHTHOUSE AUDIT SCORES SUMMARY (${isDesktop ? 'DESKTOP' : 'MOBILE'})`);
  console.log('========================================================================');

  const groupedResults: Record<string, { path: string; dark: AuditScores | null; light: AuditScores | null }> = {};
  for (const r of resultsSummary) {
    if (!groupedResults[r.name]) {
      groupedResults[r.name] = { path: r.path, dark: null, light: null };
    }
    groupedResults[r.name][r.theme] = r.scores;
  }

  for (const [name, data] of Object.entries(groupedResults)) {
    console.log(`\nPage: ${name} (${data.path})`);
    console.log(`------------------------------------------------------------------------`);
    console.log(`  Metric           | Dark Mode          | Light Mode`);
    console.log(`-------------------|--------------------|-------------------`);
    console.log(`  Performance      | ${formatScoreCell(data.dark?.performance)}                | ${formatScoreCell(data.light?.performance)}`);
    console.log(`  Accessibility    | ${formatScoreCell(data.dark?.accessibility)}                | ${formatScoreCell(data.light?.accessibility)}`);
    console.log(`  Best Practices   | ${formatScoreCell(data.dark?.bestPractices)}                | ${formatScoreCell(data.light?.bestPractices)}`);
    console.log(`  SEO              | ${formatScoreCell(data.dark?.seo)}                | ${formatScoreCell(data.light?.seo)}`);
  }
  console.log('\n========================================================================');
  console.log(`Reports saved in: ${reportsDir}`);

  // Exit with error if threshold failed and assertions are enabled
  if (thresholdFailed && (process.env.CI || process.env.LH_ASSERT)) {
    console.error(`\n[Assertion Failed] Scores fell below required thresholds (General: ${minRequiredScore}, A11y: ${minA11yScore}).`);
    process.exit(1);
  }

  process.exit(0);
}

run();
