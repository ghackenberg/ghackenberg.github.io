import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const DEFAULT_PORT = 4329;
const distDir = path.resolve('dist');

const ALL_ENGINES = [
  'cytoscape',
  'sigma',
  'd3',
  'vis-network',
  '3d-force-graph',
] as const;

type EngineSlug = (typeof ALL_ENGINES)[number];
type ScenarioName = 'idle' | 'hover' | 'drag' | 'layout';

interface ScenarioMetrics {
  frames: number;
  avgFps: number;
  p50Fps: number;
  p95Ms: number;
  maxMs: number;
  droppedPct: number;
}

interface EngineBenchmarkReport {
  engine: EngineSlug;
  loadMs: number;
  scenarios: Record<ScenarioName, ScenarioMetrics>;
}

interface BenchWindow extends Window {
  __benchActive?: boolean;
  __benchDts?: number[];
  __startBenchPhase?: () => void;
  __stopBenchPhase?: () => number[];
}

function createStaticServer(): http.Server {
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
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

function computeStats(dts: number[]): ScenarioMetrics {
  const valid = dts.filter((d) => Number.isFinite(d) && d > 0.5 && d < 2000);
  if (valid.length === 0) {
    return { frames: 0, avgFps: 0, p50Fps: 0, p95Ms: 0, maxMs: 0, droppedPct: 0 };
  }
  const sorted = [...valid].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const meanDt = sum / sorted.length;
  const p50Dt = sorted[Math.floor(sorted.length * 0.5)];
  const p95Dt = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const maxDt = sorted[sorted.length - 1];
  const dropped = sorted.filter((d) => d > 20.5).length;

  return {
    frames: sorted.length,
    avgFps: Math.min(60, Math.round((1000 / Math.max(16.667, meanDt)) * 10) / 10),
    p50Fps: Math.min(60, Math.round((1000 / Math.max(16.667, p50Dt)) * 10) / 10),
    p95Ms: Math.round(p95Dt * 10) / 10,
    maxMs: Math.round(maxDt * 10) / 10,
    droppedPct: Math.round((dropped / sorted.length) * 1000) / 10,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBenchmark(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const engineIdx = args.indexOf('--engine');
  const requestedEngine = engineIdx >= 0 ? args[engineIdx + 1] : undefined;
  const urlIdx = args.indexOf('--url');
  const customBaseUrl = urlIdx >= 0 ? args[urlIdx + 1] : undefined;

  const engines: EngineSlug[] = requestedEngine
    ? ALL_ENGINES.filter((e) => e === requestedEngine)
    : [...ALL_ENGINES];

  if (engines.length === 0) {
    console.error(`[Benchmark] Unknown --engine "${requestedEngine}". Valid engines: ${ALL_ENGINES.join(', ')}`);
    process.exit(1);
  }

  let server: http.Server | null = null;
  let baseUrl = customBaseUrl || `http://localhost:${DEFAULT_PORT}`;

  if (!customBaseUrl) {
    if (!fs.existsSync(distDir)) {
      console.error('[Benchmark] dist/ directory not found. Run "npm run build" first.');
      process.exit(1);
    }
    server = createStaticServer();
    await new Promise<void>((resolve, reject) => {
      server!.once('error', reject);
      server!.listen(DEFAULT_PORT, () => resolve());
    });
    baseUrl = `http://localhost:${DEFAULT_PORT}`;
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-gl=angle',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
  });

  const reports: EngineBenchmarkReport[] = [];

  try {
    for (const engine of engines) {
      console.log(`[Benchmark] Measuring ${engine}...`);
      const page = await browser.newPage();
      await page.evaluateOnNewDocument('window.__name = (fn) => fn;');
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

      const navStart = performance.now();
      await page.goto(`${baseUrl}/visualizations/${engine}/`, {
        waitUntil: 'networkidle0',
        timeout: 60000,
      });

      await page.waitForFunction(
        () => {
          const loader = document.getElementById('canvas-loading');
          return !loader || loader.style.display === 'none' || loader.style.opacity === '0';
        },
        { timeout: 30000 }
      );
      const loadMs = Math.round(performance.now() - navStart);

      // Allow initial viewport settle
      await sleep(900);

      await page.evaluate(() => {
        const w = window as BenchWindow;
        w.__benchActive = false;
        w.__benchDts = [];

        w.__startBenchPhase = () => {
          w.__benchDts = [];
          w.__benchActive = true;
          let last = performance.now();
          const tick = (now: number) => {
            if (!w.__benchActive) return;
            const dt = now - last;
            last = now;
            w.__benchDts!.push(dt);
            requestAnimationFrame(tick);
          };
          requestAnimationFrame((now) => {
            last = now;
            requestAnimationFrame(tick);
          });
        };

        w.__stopBenchPhase = () => {
          w.__benchActive = false;
          return w.__benchDts || [];
        };
      });

      const stageBox = await page.evaluate(() => {
        const el = document.querySelector('.visualization-stage');
        if (!el) return { x: 200, y: 200, width: 1000, height: 560 };
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, width: r.width, height: r.height };
      });

      const cx = stageBox.x + stageBox.width * 0.5;
      const cy = stageBox.y + stageBox.height * 0.5;

      // 1. IDLE SCENARIO (800ms)
      await page.evaluate(() => {
        (window as BenchWindow).__startBenchPhase?.();
      });
      await sleep(800);
      const idleDts = await page.evaluate(
        () => (window as BenchWindow).__stopBenchPhase?.() || []
      );

      // 2. HOVER SWEEP SCENARIO (1500ms)
      await page.evaluate(() => {
        (window as BenchWindow).__startBenchPhase?.();
      });
      const hoverSteps = 32;
      for (let i = 0; i < hoverSteps; i++) {
        const angle = (i / hoverSteps) * Math.PI * 2;
        const radiusX = stageBox.width * (0.12 + 0.22 * Math.sin(i * 0.7));
        const radiusY = stageBox.height * (0.12 + 0.22 * Math.cos(i * 0.5));
        const mx = cx + Math.cos(angle) * radiusX;
        const my = cy + Math.sin(angle) * radiusY;
        await page.mouse.move(mx, my);
        await sleep(35);
      }
      // Move outside to fade highlight back
      await page.mouse.move(stageBox.x + 15, stageBox.y + stageBox.height - 15);
      await sleep(380);
      const hoverDts = await page.evaluate(
        () => (window as BenchWindow).__stopBenchPhase?.() || []
      );

      // 3. DRAG & DROP NEIGHBORHOOD RECONFIGURATION SCENARIO (1900ms)
      // Find a point near center where cursor becomes 'pointer' (a node)
      let startX = cx;
      let startY = cy;
      for (let r = 0; r <= 140; r += 14) {
        let found = false;
        const angles = r === 0 ? [0] : [0, 1, 2, 3, 4, 5, 6, 7].map((k) => (k * Math.PI) / 4);
        for (const a of angles) {
          const tx = cx + Math.cos(a) * r;
          const ty = cy + Math.sin(a) * r;
          await page.mouse.move(tx, ty);
          await sleep(12);
          const isPointer = await page.evaluate(() => {
            const st = document.querySelector('.visualization-stage') as HTMLElement | null;
            return st?.style.cursor === 'pointer' || document.body.style.cursor === 'pointer';
          });
          if (isPointer) {
            startX = tx;
            startY = ty;
            found = true;
            break;
          }
        }
        if (found) break;
      }

      await page.evaluate(() => {
        (window as BenchWindow).__startBenchPhase?.();
      });
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      const dragSteps = 30;
      for (let i = 1; i <= dragSteps; i++) {
        const t = i / dragSteps;
        const dx = Math.sin(t * Math.PI * 1.5) * 130;
        const dy = Math.cos(t * Math.PI) * 85 - 40;
        await page.mouse.move(startX + dx, startY + dy);
        await sleep(18);
      }
      await page.mouse.up();
      // Record 1200ms of post-drop neighborhood settling
      await sleep(1200);
      const dragDts = await page.evaluate(
        () => (window as BenchWindow).__stopBenchPhase?.() || []
      );

      // 4. LAYOUT TRANSITIONS SCENARIO (1800ms)
      await page.evaluate(() => {
        (window as BenchWindow).__startBenchPhase?.();
      });
      for (const nextLayout of ['radial', 'columns', 'force'] as const) {
        await page.evaluate((lyt: string) => {
          const sel = document.getElementById('layout-selector') as HTMLSelectElement | null;
          if (sel) {
            sel.value = lyt;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, nextLayout);
        await sleep(600);
      }
      const layoutDts = await page.evaluate(
        () => (window as BenchWindow).__stopBenchPhase?.() || []
      );

      reports.push({
        engine,
        loadMs,
        scenarios: {
          idle: computeStats(idleDts),
          hover: computeStats(hoverDts),
          drag: computeStats(dragDts),
          layout: computeStats(layoutDts),
        },
      });

      await page.close();
    }
  } finally {
    try {
      await browser.close();
    } catch {
      // Ignore transient Windows temp profile lockfile EBUSY on exit
    }
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
  }

  console.log('\n=========================================================================================');
  console.log('                 VISUALIZATION ENGINE FPS & FRAME-TIME BENCHMARK');
  console.log('=========================================================================================');
  console.log(
    '| Engine         | Load (ms) | Scenario | Avg FPS | P50 FPS | P95 (ms) | Max (ms) | Dropped (<50fps) |'
  );
  console.log(
    '|----------------|-----------|----------|---------|---------|----------|----------|------------------|'
  );
  for (const r of reports) {
    for (const sc of ['idle', 'hover', 'drag', 'layout'] as const) {
      const m = r.scenarios[sc];
      console.log(
        `| ${r.engine.padEnd(14)} | ${String(r.loadMs).padStart(9)} | ${sc.padEnd(8)} | ${m.avgFps.toFixed(1).padStart(7)} | ${m.p50Fps.toFixed(1).padStart(7)} | ${m.p95Ms.toFixed(1).padStart(8)} | ${m.maxMs.toFixed(1).padStart(8)} | ${(m.droppedPct.toFixed(1) + '%').padStart(16)} |`
      );
    }
  }
  console.log('=========================================================================================\n');

  if (jsonOutput) {
    console.log(JSON.stringify(reports, null, 2));
  }
}

runBenchmark().catch((err) => {
  console.error('[Benchmark] Fatal error:', err);
  process.exit(1);
});
