import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import puppeteer, { type HTTPRequest, type Page } from 'puppeteer';
import {
  evaluateClientAutomationSignal,
  type ClientAutomationEnv,
} from '@commons/client/telemetry';
import {
  classifyTrafficSource,
  detectTechTrafficAnomalies,
  summarizeAiAssistants,
  type TechBreakdown,
  type TrafficSourceMetric,
} from '@commons/server/analytics/index.js';

interface CapturedPlausiblePayload {
  n: string;
  u: string;
  d: string;
  r?: string | null;
  p?: Record<string, string>;
  i?: boolean;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

function makeBaseClientEnv(overrides: Partial<ClientAutomationEnv> = {}): ClientAutomationEnv {
  return {
    webdriver: false,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    automationGlobals: [],
    documentKeys: ['location'],
    outerWidth: 1280,
    outerHeight: 800,
    innerWidth: 1264,
    languages: ['de-DE', 'en-US'],
    hasMatchMedia: true,
    hardwareConcurrency: 8,
    ...overrides,
  };
}

function runUnitTests(): void {
  console.log('🧪 Running telemetry & analytics unit checks...');

  // 1. classifyTrafficSource
  assert.equal(classifyTrafficSource('chatgpt.com'), 'ai_assistant');
  assert.equal(classifyTrafficSource('chat.openai.com'), 'ai_assistant');
  assert.equal(classifyTrafficSource('perplexity.ai'), 'ai_assistant');
  assert.equal(classifyTrafficSource('labs.perplexity.ai'), 'ai_assistant');
  assert.equal(classifyTrafficSource('claude.ai'), 'ai_assistant');
  assert.equal(classifyTrafficSource('gemini.google.com'), 'ai_assistant');
  assert.equal(classifyTrafficSource('bard.google.com'), 'ai_assistant');
  assert.equal(classifyTrafficSource('aistudio.google.com'), 'ai_assistant');
  assert.equal(classifyTrafficSource('copilot.microsoft.com'), 'ai_assistant');
  assert.equal(classifyTrafficSource('edgeservices.bing.com'), 'ai_assistant');
  assert.equal(classifyTrafficSource('you.com'), 'ai_assistant');
  assert.equal(classifyTrafficSource('phind.com'), 'ai_assistant');
  assert.equal(classifyTrafficSource('kagi.com'), 'ai_assistant');
  assert.equal(classifyTrafficSource('grok.com'), 'ai_assistant');
  assert.equal(classifyTrafficSource('x.ai'), 'ai_assistant');
  assert.equal(classifyTrafficSource('mistral.ai'), 'ai_assistant');
  assert.equal(classifyTrafficSource('chat.mistral.ai'), 'ai_assistant');
  assert.equal(classifyTrafficSource('deepseek.com'), 'ai_assistant');
  assert.equal(classifyTrafficSource('chat.deepseek.com'), 'ai_assistant');
  assert.equal(classifyTrafficSource('poe.com'), 'ai_assistant');

  assert.equal(classifyTrafficSource('Google'), 'search_engine');
  assert.equal(classifyTrafficSource('google.com'), 'search_engine');
  assert.equal(classifyTrafficSource('www.google.de'), 'search_engine');
  assert.equal(classifyTrafficSource('Bing'), 'search_engine');
  assert.equal(classifyTrafficSource('DuckDuckGo'), 'search_engine');
  assert.equal(classifyTrafficSource('Direct / None'), 'direct');
  assert.equal(classifyTrafficSource('(none)'), 'direct');
  assert.equal(classifyTrafficSource(''), 'direct');
  assert.equal(classifyTrafficSource('hackenberg.tech'), 'internal');
  assert.equal(classifyTrafficSource('LinkedIn'), 'social');
  assert.equal(classifyTrafficSource('t.co'), 'social');
  assert.equal(classifyTrafficSource('github.com'), 'referral');

  // 2. summarizeAiAssistants
  const sampleSources: TrafficSourceMetric[] = [
    { source: 'Google', channelCategory: 'search_engine', visitors: 120, bounceRate: 35, visitDuration: 190 },
    { source: 'chatgpt.com', channelCategory: 'ai_assistant', visitors: 18, bounceRate: 23, visitDuration: 182 },
    { source: 'perplexity.ai', channelCategory: 'ai_assistant', visitors: 6, bounceRate: 33, visitDuration: 145 },
  ];
  const aiSummary = summarizeAiAssistants(sampleSources, 240);
  assert.equal(aiSummary.visitors, 24);
  assert.equal(aiSummary.sharePct, 10);
  assert.equal(aiSummary.sources.length, 2);

  // 3. detectTechTrafficAnomalies (reproducing live GNU/Linux 42/93%/0s and (not set) 61/59 patterns)
  const techWithBots: TechBreakdown = {
    devices: [
      { name: 'Desktop', visitors: 180, percentage: 61.4, bounceRate: 30, visitDuration: 210 },
      { name: '(not set)', visitors: 61, percentage: 20.8, bounceRate: 4, visitDuration: 333 },
    ],
    operatingSystems: [
      { name: 'Windows', visitors: 140, percentage: 47.8, bounceRate: 28, visitDuration: 220 },
      { name: 'GNU/Linux', visitors: 42, percentage: 14.3, bounceRate: 93, visitDuration: 0 },
      { name: '(not set)', visitors: 61, percentage: 20.8, bounceRate: 4, visitDuration: 333 },
    ],
    browsers: [
      { name: 'Chrome', visitors: 190, percentage: 64.8, bounceRate: 35, visitDuration: 180 },
      { name: '(not set)', visitors: 61, percentage: 20.8, bounceRate: 4, visitDuration: 333 },
    ],
  };

  const botAnomalies = detectTechTrafficAnomalies(techWithBots, 467, 293);
  assert.ok(
    botAnomalies.some((a) => a.dimension === 'os' && a.segment === 'GNU/Linux' && a.visitors === 42),
    'Expected GNU/Linux 42/93%/0s cluster to be detected'
  );
  assert.ok(
    botAnomalies.some((a) => a.dimension === 'os' && a.segment === '(not set)' && a.visitors === 61),
    'Expected (not set) 61-visitor cluster to be detected'
  );

  // Ghost-session integrity check: Mac/SG pattern (26 visitors > 10 pageviews)
  const ghostAnomalies = detectTechTrafficAnomalies(
    {
      devices: [{ name: 'Desktop', visitors: 26, percentage: 100, bounceRate: 38, visitDuration: 0 }],
      operatingSystems: [{ name: 'Mac', visitors: 26, percentage: 100, bounceRate: 38, visitDuration: 0 }],
      browsers: [{ name: 'Chrome', visitors: 26, percentage: 100, bounceRate: 38, visitDuration: 0 }],
    },
    10,
    26
  );
  assert.ok(
    ghostAnomalies.some((a) => a.dimension === 'page_integrity'),
    'Expected visitors > pageviews * 1.15 anomaly to be detected'
  );

  // Clean human baseline should trigger 0 anomalies
  const cleanAnomalies = detectTechTrafficAnomalies(
    {
      devices: [{ name: 'Desktop', visitors: 100, percentage: 100, bounceRate: 34, visitDuration: 215 }],
      operatingSystems: [{ name: 'Windows', visitors: 100, percentage: 100, bounceRate: 34, visitDuration: 215 }],
      browsers: [{ name: 'Chrome', visitors: 100, percentage: 100, bounceRate: 34, visitDuration: 215 }],
    },
    180,
    100
  );
  assert.equal(cleanAnomalies.length, 0);

  // 4. evaluateClientAutomationSignal
  const normalSignal = evaluateClientAutomationSignal(makeBaseClientEnv());
  assert.equal(normalSignal.dropReason, null);
  assert.equal(normalSignal.envTrust, 'standard');

  const webdriverSignal = evaluateClientAutomationSignal(makeBaseClientEnv({ webdriver: true }));
  assert.equal(webdriverSignal.dropReason, 'webdriver');
  assert.equal(webdriverSignal.envTrust, 'suspect');

  const headlessUaSignal = evaluateClientAutomationSignal(
    makeBaseClientEnv({
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36',
    })
  );
  assert.equal(headlessUaSignal.dropReason, 'automation_ua');

  const playwrightGlobalSignal = evaluateClientAutomationSignal(
    makeBaseClientEnv({ automationGlobals: ['__playwright__binding__'] })
  );
  assert.equal(playwrightGlobalSignal.dropReason, 'automation_global');

  const cdcSignal = evaluateClientAutomationSignal(
    makeBaseClientEnv({ documentKeys: ['$cdc_asdjflasutopfhvcZLmcfl_'] })
  );
  assert.equal(cdcSignal.dropReason, 'chromedriver_cdc');

  const zeroOuterSignal = evaluateClientAutomationSignal(
    makeBaseClientEnv({ outerWidth: 0, outerHeight: 0, innerWidth: 1280 })
  );
  assert.equal(zeroOuterSignal.dropReason, null);
  assert.equal(zeroOuterSignal.envTrust, 'suspect');

  const emptyLangSignal = evaluateClientAutomationSignal(makeBaseClientEnv({ languages: [] }));
  assert.equal(emptyLangSignal.dropReason, null);
  assert.equal(emptyLangSignal.envTrust, 'suspect');

  const noMatchMediaSignal = evaluateClientAutomationSignal(
    makeBaseClientEnv({ hasMatchMedia: false })
  );
  assert.equal(noMatchMediaSignal.dropReason, null);
  assert.equal(noMatchMediaSignal.envTrust, 'suspect');

  console.log('✅ All telemetry & analytics unit checks passed.');
}

function startStaticDistServer(distDir: string): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const rawUrl = req.url || '/';
        const urlPath = decodeURIComponent(rawUrl.split('?')[0]);
        let filePath = path.join(distDir, urlPath);

        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        } else if (!path.extname(filePath) && fs.existsSync(`${filePath}.html`)) {
          filePath = `${filePath}.html`;
        } else if (!fs.existsSync(filePath) && fs.existsSync(path.join(filePath, 'index.html'))) {
          filePath = path.join(filePath, 'index.html');
        }

        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not Found');
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Internal Server Error');
      }
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, port });
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildEnvOverrideScript(options: {
  outerWidth: number;
  outerHeight: number;
  languages: string[];
  hidden?: boolean;
  plausibleBypass?: boolean;
}): string {
  return [
    'Object.defineProperty(Navigator.prototype, "webdriver", { configurable: true, get: function() { return false; } });',
    `Object.defineProperty(Navigator.prototype, "languages", { configurable: true, get: function() { return ${JSON.stringify(options.languages)}; } });`,
    `Object.defineProperty(window, "outerWidth", { configurable: true, get: function() { return ${options.outerWidth}; } });`,
    `Object.defineProperty(window, "outerHeight", { configurable: true, get: function() { return ${options.outerHeight}; } });`,
    options.hidden
      ? 'Object.defineProperty(Document.prototype, "visibilityState", { configurable: true, get: function() { return "hidden"; } }); Object.defineProperty(Document.prototype, "hidden", { configurable: true, get: function() { return true; } });'
      : '',
    options.plausibleBypass ? 'window.__plausible = true;' : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function runE2ETests(): Promise<void> {
  const distDir = path.resolve(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    throw new Error('dist/ directory not found. Run `npm run build` before running --e2e telemetry tests.');
  }

  console.log('🌐 Starting static dist server for Puppeteer telemetry E2E verification...');
  const { server, port } = await startStaticDistServer(distDir);
  const baseUrl = `http://preview.hackenberg.tech:${port}`;
  const humanUa =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--host-resolver-rules=MAP preview.hackenberg.tech 127.0.0.1',
    ],
  });

  try {
    const setupInterception = async (
      page: Page,
      captured: CapturedPlausiblePayload[]
    ) => {
      await page.setRequestInterception(true);
      page.on('request', async (req: HTTPRequest) => {
        const url = req.url();
        if (url.startsWith('https://analytics.mentawise.com/api/event')) {
          const postData = req.hasPostData() ? await req.fetchPostData() : undefined;
          if (postData) {
            captured.push(JSON.parse(postData) as CapturedPlausiblePayload);
          }
          await req.respond({ status: 202, contentType: 'text/plain', body: 'ok' });
          return;
        }
        if (
          url.startsWith(`http://preview.hackenberg.tech:${port}/`) ||
          url.startsWith('data:') ||
          url.startsWith('blob:')
        ) {
          void req.continue();
          return;
        }
        void req.abort();
      });
    };

    // Case 1a: Default Puppeteer (navigator.webdriver === true / HeadlessChrome) -> 0 events
    {
      const page = await browser.newPage();
      const captured: CapturedPlausiblePayload[] = [];
      await setupInterception(page, captured);
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(`${baseUrl}/posts/`, { waitUntil: 'networkidle2' });
      await sleep(2300);
      await page.mouse.wheel({ deltaY: 160 });
      await sleep(300);
      assert.equal(captured.length, 0, `Case 1a failed: expected 0 events, got ${captured.length}`);
      await page.close();
      console.log('  ✅ Case 1a (Default Puppeteer automation block): 0 events');
    }

    // Case 1b: Spoofed webdriver=false + __plausible=true, but HeadlessChrome UA -> transformRequest blocks
    {
      const page = await browser.newPage();
      const captured: CapturedPlausiblePayload[] = [];
      await setupInterception(page, captured);
      await page.setViewport({ width: 1280, height: 800 });
      await page.evaluateOnNewDocument(
        buildEnvOverrideScript({
          outerWidth: 1280,
          outerHeight: 800,
          languages: ['de-DE'],
          plausibleBypass: true,
        })
      );
      await page.goto(`${baseUrl}/posts/`, { waitUntil: 'networkidle2' });
      await sleep(2300);
      await page.mouse.wheel({ deltaY: 160 });
      await sleep(300);
      assert.equal(
        captured.length,
        0,
        `Case 1b failed: expected transformRequest to block HeadlessChrome even with __plausible=true, got ${captured.length}`
      );
      await page.close();
      console.log('  ✅ Case 1b (transformRequest blocks HeadlessChrome despite __plausible=true): 0 events');
    }

    // Case 2: Hidden tab protection (visibilityState === 'hidden') -> 0 pageviews, 0 Card/Section Viewed
    {
      const page = await browser.newPage();
      const captured: CapturedPlausiblePayload[] = [];
      await setupInterception(page, captured);
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent({ userAgent: humanUa });
      await page.evaluateOnNewDocument(
        buildEnvOverrideScript({
          outerWidth: 1280,
          outerHeight: 800,
          languages: ['de-DE', 'de'],
          hidden: true,
        })
      );
      await page.goto(`${baseUrl}/posts/`, { waitUntil: 'networkidle2' });
      await sleep(2500);
      assert.equal(
        captured.length,
        0,
        `Case 2 failed: expected 0 events in hidden tab, got ${JSON.stringify(captured)}`
      );
      await page.close();
      console.log('  ✅ Case 2 (Hidden-tab protection): 0 events after 2.5s');
    }

    // Case 3: Human simulation (visible, outerWidth > 0, languages ['de-DE'])
    {
      const page = await browser.newPage();
      const captured: CapturedPlausiblePayload[] = [];
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(String(err)));
      await setupInterception(page, captured);
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent({ userAgent: humanUa });
      await page.evaluateOnNewDocument(
        buildEnvOverrideScript({
          outerWidth: 1280,
          outerHeight: 800,
          languages: ['de-DE', 'en-US'],
        })
      );
      await page.goto(`${baseUrl}/posts/`, { waitUntil: 'networkidle2' });
      await sleep(2300);

      assert.equal(pageErrors.length, 0, `Case 3 page errors: ${pageErrors.join('; ')}`);

      const pageviews = captured.filter((e) => e.n === 'pageview');
      assert.equal(
        pageviews.length,
        1,
        `Case 3 failed: expected 1 pageview, got ${pageviews.length}`
      );
      assert.equal(pageviews[0].p?.env_trust, 'standard');
      assert.equal(pageviews[0].p?.prev_page, '(entry)');

      const passiveViewed = captured.filter(
        (e) => e.n === 'Card Viewed' || e.n === 'Section Viewed' || e.n === 'Heading Viewed'
      );
      assert.ok(passiveViewed.length >= 1, 'Case 3 failed: expected >= 1 passive Viewed event on /posts/');
      for (const ev of passiveViewed) {
        assert.equal(ev.i, false, `Expected passive event "${ev.n}" to have i: false`);
      }

      // First genuine wheel interaction -> exactly 1 Human Verified
      await page.mouse.wheel({ deltaY: 240 });
      await sleep(400);

      const humanEventsAfterFirst = captured.filter((e) => e.n === 'Human Verified');
      assert.equal(
        humanEventsAfterFirst.length,
        1,
        `Case 3 failed: expected 1 Human Verified event, got ${humanEventsAfterFirst.length}`
      );
      assert.equal(humanEventsAfterFirst[0].p?.trigger, 'scroll');
      assert.equal(humanEventsAfterFirst[0].i, false);
      assert.equal(humanEventsAfterFirst[0].p?.env_trust, 'standard');

      // Second wheel + keypress -> still exactly 1 Human Verified (no duplicate)
      await page.mouse.wheel({ deltaY: 240 });
      await page.keyboard.press('ArrowDown');
      await sleep(400);

      const humanEventsAfterSecond = captured.filter((e) => e.n === 'Human Verified');
      assert.equal(
        humanEventsAfterSecond.length,
        1,
        `Case 3 failed: duplicate Human Verified emitted (${humanEventsAfterSecond.length})`
      );

      await page.close();
      console.log('  ✅ Case 3 (Human simulation: env_trust=standard, passive i=false, 1x Human Verified)');
    }

    // Case 4: Suspect environment (outerWidth=0, languages=[]) -> env_trust === 'suspect'
    {
      const page = await browser.newPage();
      const captured: CapturedPlausiblePayload[] = [];
      await setupInterception(page, captured);
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent({ userAgent: humanUa });
      await page.evaluateOnNewDocument(
        buildEnvOverrideScript({
          outerWidth: 0,
          outerHeight: 0,
          languages: [],
        })
      );
      await page.goto(`${baseUrl}/posts/`, { waitUntil: 'networkidle2' });
      await sleep(300);

      const pageviews = captured.filter((e) => e.n === 'pageview');
      assert.equal(pageviews.length, 1);
      assert.equal(pageviews[0].p?.env_trust, 'suspect');
      await page.close();
      console.log('  ✅ Case 4 (Suspect environment classification): env_trust=suspect');
    }

    console.log('✅ All Puppeteer telemetry E2E tests passed.');
  } finally {
    await browser.close();
    server.close();
  }
}

async function main(): Promise<void> {
  runUnitTests();
  if (process.argv.includes('--e2e')) {
    await runE2ETests();
  }
}

main().catch((err) => {
  console.error('❌ Telemetry test suite failed:', err);
  process.exit(1);
});
