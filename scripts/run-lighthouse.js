import { spawn, execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const port = 45678;
const baseUrl = `http://localhost:${port}`;

const urlsToAudit = [
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isServerReady(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => {
      resolve(false);
    });
  });
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ready = await isServerReady(url);
    if (ready) return true;
    await wait(500);
  }
  return false;
}

async function run() {
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
  const previewProcess = spawn(npmCmd, ['run', 'preview', '--', '--port', port.toString()], {
    cwd: projectRoot,
    stdio: 'pipe',
    shell: true
  });

  // Log preview server output if debug is needed
  previewProcess.stderr.on('data', (data) => {
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
  let chrome;
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

  const resultsSummary = [];
  let thresholdFailed = false;
  const minRequiredScore = process.env.LH_MIN_SCORE ? parseInt(process.env.LH_MIN_SCORE, 10) : 90;

  try {
    for (const page of urlsToAudit) {
      const url = `${baseUrl}${page.path}`;
      console.log(`Auditing: ${url}...`);

      const options = {
        logLevel: 'info',
        output: ['html', 'json'],
        port: chrome.port,
      };

      const runnerResult = await lighthouse(url, options);

      const htmlReport = runnerResult.report[0];
      const jsonReport = runnerResult.report[1];
      const lhr = runnerResult.lhr;

      // Save reports
      fs.writeFileSync(path.join(reportsDir, `${page.name}.html`), htmlReport);
      fs.writeFileSync(path.join(reportsDir, `${page.name}.json`), jsonReport);

      const scores = {
        performance: Math.round((lhr.categories.performance?.score || 0) * 100),
        accessibility: Math.round((lhr.categories.accessibility?.score || 0) * 100),
        bestPractices: Math.round((lhr.categories['best-practices']?.score || 0) * 100),
        seo: Math.round((lhr.categories.seo?.score || 0) * 100),
      };

      resultsSummary.push({
        name: page.name,
        path: page.path,
        scores
      });

      if (
        scores.performance < minRequiredScore ||
        scores.accessibility < minRequiredScore ||
        scores.bestPractices < minRequiredScore ||
        scores.seo < minRequiredScore
      ) {
        thresholdFailed = true;
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
    } catch (err) {
      console.warn('Warning: Failed to cleanly close Chrome or delete temporary directory:', err.message);
    }
    cleanup();
  }

  // Display results summary
  console.log('\n==================================================');
  console.log(' LIGHTHOUSE AUDIT SCORES SUMMARY');
  console.log('==================================================');
  for (const page of resultsSummary) {
    console.log(`\nPage: ${page.name} (${page.path})`);
    console.log(`--------------------------------------------------`);
    console.log(`  Performance:     ${colorScore(page.scores.performance)}`);
    console.log(`  Accessibility:   ${colorScore(page.scores.accessibility)}`);
    console.log(`  Best Practices:  ${colorScore(page.scores.bestPractices)}`);
    console.log(`  SEO:             ${colorScore(page.scores.seo)}`);
  }
  console.log('\n==================================================');
  console.log(`Reports saved in: ${reportsDir}`);

  // Exit with error if threshold failed and we are in CI / assertions are enabled
  if (thresholdFailed && (process.env.CI || process.env.LH_ASSERT)) {
    console.error(`\n[Assertion Failed] One or more scores fell below the required threshold of ${minRequiredScore}.`);
    process.exit(1);
  }

  process.exit(0);
}

function colorScore(score) {
  const reset = '\x1b[0m';
  if (score >= 90) {
    return `\x1b[32m${score}\x1b[0m`; // Green
  } else if (score >= 50) {
    return `\x1b[33m${score}\x1b[0m`; // Yellow
  } else {
    return `\x1b[31m${score}\x1b[0m`; // Red
  }
}

run();
