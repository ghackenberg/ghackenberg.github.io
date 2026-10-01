import { spawn, execSync, type ChildProcess } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// @ts-ignore - lighthouse types may not be installed
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

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

interface AuditResult {
  name: string;
  path: string;
  theme: 'dark' | 'light';
  scores: AuditScores;
}

const urlsToAudit: AuditTarget[] = [
  // Overview Pages
  { path: '/', name: 'homepage' },
  { path: '/services/', name: 'services' },
  { path: '/courses/', name: 'courses' },
  { path: '/posts/', name: 'blog_listing' },
  { path: '/projects/', name: 'projects' },
  { path: '/publications/', name: 'publications' },
  { path: '/visualizations/', name: 'visualizations' },

  // Detail Pages
  { path: '/services/rd-prototyping/', name: 'services_rd_prototyping' },
  { path: '/services/rd-prototyping/algorithm-translation/', name: 'services_module_detail' },
  { path: '/courses/course-python-programming/', name: 'course_detail' },
  { path: '/posts/2026_05_23_website_relaunch_astro_typescript/', name: 'blog_post' },
  { path: '/projects/delta-dynamics/', name: 'project_detail' },
  { path: '/publications/2025_01_modelsward/', name: 'publication_detail' },
  { path: '/visualizations/sigma/', name: 'visualization_detail' }
];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isServerReady(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => {
      resolve(false);
    });
  });
}

async function waitForServer(url: string, timeoutMs: number = 20000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ready = await isServerReady(url);
    if (ready) return true;
    await wait(500);
  }
  return false;
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

async function run(): Promise<void> {
  // 1. Build the site
  console.log('Building website for production...');
  try {
    execSync(`${npmCmd} run build`, { stdio: 'inherit', cwd: projectRoot });
  } catch (error) {
    console.error('Failed to build website:', error);
    process.exit(1);
  }

  // 2. Start the preview server
  console.log(`Starting preview server on port ${port}...`);
  const previewProcess: ChildProcess = spawn(npmCmd, ['run', 'preview', '--', '--port', port.toString()], {
    cwd: projectRoot,
    stdio: 'pipe',
    shell: true
  });

  // Log preview server output if debug is needed
  previewProcess.stderr?.on('data', (data) => {
    console.error(`Preview Server Error: ${data}`);
  });

  // Ensure preview server is closed when this process exits
  let previewKilled = false;
  const cleanup = () => {
    if (previewKilled) return;
    previewKilled = true;
    console.log('Stopping preview server...');
    previewProcess.kill();
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });

  // Wait for server to start
  const ready = await waitForServer(baseUrl);
  if (!ready) {
    console.error('Preview server failed to start or respond on port', port);
    cleanup();
    process.exit(1);
  }
  console.log('Preview server is ready.');

  // 3. Launch headless Chrome
  console.log('Launching headless Chrome...');
  let chrome: chromeLauncher.LaunchedChrome | undefined;
  try {
    chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu']
    });
    console.log(`Chrome launched on port ${chrome.port}`);
  } catch (err) {
    console.error('Failed to launch Chrome:', err);
    cleanup();
    process.exit(1);
  }

  const reportsDir = path.join(projectRoot, 'lighthouse-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir);
  }

  const resultsSummary: AuditResult[] = [];
  let thresholdFailed = false;
  const minRequiredScore = process.env.LH_MIN_SCORE ? parseInt(process.env.LH_MIN_SCORE, 10) : 90;
  const minA11yScore = process.env.LH_MIN_A11Y_SCORE ? parseInt(process.env.LH_MIN_A11Y_SCORE, 10) : 98;

  try {
    for (const page of urlsToAudit) {
      for (const theme of ['dark', 'light'] as const) {
        const suffix = theme === 'light' ? '?theme=light' : '?theme=dark';
        const url = `${baseUrl}${page.path}${suffix}`;
        console.log(`Auditing (${theme} mode): ${url}...`);

        const options = {
          logLevel: 'info',
          output: ['html', 'json'],
          port: chrome.port,
        };

        const runnerResult: any = await lighthouse(url, options);

        const htmlReport = runnerResult.report[0];
        const jsonReport = runnerResult.report[1];
        const lhr = runnerResult.lhr;

        // Save reports
        fs.writeFileSync(path.join(reportsDir, `${page.name}_${theme}.html`), htmlReport);
        fs.writeFileSync(path.join(reportsDir, `${page.name}_${theme}.json`), jsonReport);

        const scores: AuditScores = {
          performance: Math.round((lhr.categories.performance?.score || 0) * 100),
          accessibility: Math.round((lhr.categories.accessibility?.score || 0) * 100),
          bestPractices: Math.round((lhr.categories['best-practices']?.score || 0) * 100),
          seo: Math.round((lhr.categories.seo?.score || 0) * 100),
        };

        resultsSummary.push({
          name: page.name,
          path: page.path,
          theme,
          scores
        });

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
    console.error('Error running audits:', err);
  } finally {
    console.log('Closing Chrome...');
    try {
      if (chrome) {
        await chrome.kill();
      }
    } catch (err: any) {
      console.warn('Warning: Failed to cleanly close Chrome or delete temporary directory:', err.message);
    }
    cleanup();
  }

  // Display results summary
  console.log('\n========================================================================');
  console.log(' LIGHTHOUSE AUDIT SCORES SUMMARY (DARK vs LIGHT)');
  console.log('========================================================================');
  
  // Group results by page path/name
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

  // Exit with error if threshold failed and we are in CI / assertions are enabled
  if (thresholdFailed && (process.env.CI || process.env.LH_ASSERT)) {
    console.error(`\n[Assertion Failed] One or more scores fell below thresholds (General: ${minRequiredScore}, A11y: ${minA11yScore}).`);
    process.exit(1);
  }

  process.exit(0);
}

run();
