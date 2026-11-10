import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import puppeteer, { type Page } from 'puppeteer';

const ENGINES = ['cytoscape', 'sigma', 'd3', 'vis-network', '3d-force-graph'] as const;
type EngineId = (typeof ENGINES)[number];

interface ActiveVisInstance {
  currentLayout?: string;
  focusedNodeIds?: Set<string> | null;
  forcePositions?: Map<string, { x: number; y: number; z?: number }>;
  initialForcePositions?: Map<string, { x: number; y: number; z?: number }>;
}

declare global {
  interface Window {
    __preDragSnapshot?: Record<string, [number, number, number]>;
  }
}

interface E2EResult {
  engine: EngineId;
  bootOk: boolean;
  hoverAndFocusOk: boolean;
  liveTuningOk: boolean;
  dragReconfigOk: boolean;
  layoutSwitchOk: boolean;
  movedNeighbors: number;
  errors: string[];
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

function startStaticServer(distDir: string, preferredPort: number): Promise<{ server: http.Server; port: number }> {
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

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && preferredPort !== 0) {
        server.listen(0, '127.0.0.1');
      } else {
        reject(err);
      }
    });

    server.listen(preferredPort, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : preferredPort;
      resolve({ server, port });
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findClickableScreenNode(
  page: Page,
  centerX: number,
  centerY: number
): Promise<{ x: number; y: number } | null> {
  // Spiral search around stage center with 16px step (proximity radius is 26px)
  const offsets: [number, number][] = [[0, 0]];
  for (let r = 16; r <= 192; r += 16) {
    const steps = Math.max(8, Math.round((2 * Math.PI * r) / 18));
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      offsets.push([Math.round(Math.cos(angle) * r), Math.round(Math.sin(angle) * r)]);
    }
  }

  for (const [dx, dy] of offsets) {
    const x = centerX + dx;
    const y = centerY + dy;
    await page.mouse.move(x, y);
    const isHit = await page.evaluate(() => {
      const stage = document.getElementById('canvas');
      const tooltip = stage?.querySelector('.vis-tooltip') as HTMLElement | null;
      return (
        stage?.style.cursor === 'pointer' ||
        (tooltip !== null && tooltip.style.visibility === 'visible')
      );
    });
    if (isHit) {
      return { x, y };
    }
  }
  return null;
}

async function testEngineE2E(page: Page, baseUrl: string, engine: EngineId): Promise<E2EResult> {
  const errors: string[] = [];
  const onConsole = (msg: { type(): string; text(): string }) => {
    if (msg.type() === 'error') {
      errors.push(`ConsoleError: ${msg.text()}`);
    }
  };

  page.on('pageerror', (err) => {
    errors.push(`PageError: ${err instanceof Error ? err.message : String(err)}`);
  });
  page.on('console', onConsole);

  let bootOk = false;
  let hoverAndFocusOk = false;
  let liveTuningOk = false;
  let dragReconfigOk = false;
  let layoutSwitchOk = false;
  let movedNeighbors = 0;

  try {
    const url = `${baseUrl}/visualizations/${engine}/`;
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    await page.waitForFunction(
      () => {
        const loader = document.getElementById('canvas-loading');
        return Boolean(
          window.activeInstance &&
            document.getElementById('canvas') &&
            (!loader || loader.style.display === 'none' || loader.style.opacity === '0')
        );
      },
      { timeout: 25000 }
    );
    await sleep(600);

    // =========================================================================
    // CHECK 1: Boot & Render Integrity
    // =========================================================================
    const bootState = await page.evaluate(() => {
      const inst = window.activeInstance as ActiveVisInstance | null | undefined;
      const stage = document.getElementById('canvas');
      const hasRenderSurface = Boolean(stage?.querySelector('canvas, svg'));
      return {
        forceSize: inst?.forcePositions?.size ?? 0,
        initSize: inst?.initialForcePositions?.size ?? 0,
        hasRenderSurface,
      };
    });

    if (bootState.forceSize >= 300 && bootState.initSize >= 300 && bootState.hasRenderSurface) {
      bootOk = true;
    } else {
      errors.push(
        `Check 1 failed: forceSize=${bootState.forceSize}, initSize=${bootState.initSize}, surface=${String(bootState.hasRenderSurface)}`
      );
    }

    const stageBox = (await page.$eval('#canvas', (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    })) as { x: number; y: number; width: number; height: number };

    const centerX = Math.round(stageBox.x + stageBox.width * 0.52);
    const centerY = Math.round(stageBox.y + stageBox.height * 0.52);

    // =========================================================================
    // CHECK 2: Hover Primary Tooltip + Click Ego-Focus + Unpin
    // =========================================================================
    const hoverTarget = await findClickableScreenNode(page, centerX, centerY);
    if (!hoverTarget) {
      errors.push('Check 2 failed: Could not locate a hoverable node near stage center');
    } else {
      await sleep(120);
      const tooltipVisible = await page.evaluate(() => {
        const tooltip = document.querySelector('#canvas .vis-tooltip') as HTMLElement | null;
        return Boolean(tooltip && tooltip.style.visibility === 'visible' && (tooltip.textContent?.trim().length ?? 0) > 0);
      });

      // Single click on node pins its ego-focus subgraph
      await page.mouse.click(hoverTarget.x, hoverTarget.y);
      await sleep(220);

      const focusedCount = await page.evaluate(() => {
        const inst = window.activeInstance as ActiveVisInstance | null | undefined;
        return inst?.focusedNodeIds?.size ?? 0;
      });

      // Press Escape to unpin focus
      await page.keyboard.press('Escape');
      await sleep(180);

      const unpinnedOk = await page.evaluate(() => {
        const inst = window.activeInstance as ActiveVisInstance | null | undefined;
        return inst?.focusedNodeIds == null;
      });

      if (tooltipVisible && focusedCount > 1 && unpinnedOk) {
        hoverAndFocusOk = true;
      } else {
        errors.push(
          `Check 2 failed: tooltipVisible=${String(tooltipVisible)}, focusedCount=${focusedCount}, unpinnedOk=${String(unpinnedOk)}`
        );
      }
    }

    // =========================================================================
    // CHECK 3: Live Parameter Tuning (#tune-hud) & Reset
    // =========================================================================
    await page.click('#tune-toggle-btn');
    await sleep(100);

    const tuneShift = await page.evaluate(async () => {
      const panel = document.getElementById('tune-panel');
      const slider = document.querySelector(
        'input[data-tune-key="repulsionScale"]'
      ) as HTMLInputElement | null;
      if (!panel || panel.classList.contains('hidden') || !slider) {
        return { panelOpen: false, meanTuneDelta: 0 };
      }
      slider.value = '1.65';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
      return { panelOpen: true, meanTuneDelta: 0 };
    });

    await sleep(750);

    const tuneDeltaAfterChange = await page.evaluate(() => {
      const inst = window.activeInstance as ActiveVisInstance | null | undefined;
      if (!inst?.forcePositions || !inst?.initialForcePositions) return 0;
      let sum = 0;
      let count = 0;
      for (const [id, cur] of inst.forcePositions.entries()) {
        const init = inst.initialForcePositions.get(id);
        if (!init) continue;
        sum += Math.hypot(cur.x - init.x, cur.y - init.y, (cur.z ?? 0) - (init.z ?? 0));
        count++;
      }
      return count > 0 ? sum / count : 0;
    });

    await page.click('#tune-reset-btn');
    await sleep(750);

    const resetDelta = await page.evaluate(() => {
      const inst = window.activeInstance as ActiveVisInstance | null | undefined;
      if (!inst?.forcePositions || !inst?.initialForcePositions) return Infinity;
      let maxD = 0;
      for (const [id, cur] of inst.forcePositions.entries()) {
        const init = inst.initialForcePositions.get(id);
        if (!init) continue;
        const d = Math.hypot(cur.x - init.x, cur.y - init.y, (cur.z ?? 0) - (init.z ?? 0));
        if (d > maxD) maxD = d;
      }
      return maxD;
    });

    // Close tuning panel
    await page.click('#tune-toggle-btn');
    await sleep(250);

    if (tuneShift.panelOpen && tuneDeltaAfterChange > 1.0 && resetDelta < 0.05) {
      liveTuningOk = true;
    } else {
      errors.push(
        `Check 3 failed: panelOpen=${String(tuneShift.panelOpen)}, tuneDelta=${tuneDeltaAfterChange.toFixed(2)}, resetDelta=${resetDelta.toFixed(4)}`
      );
    }

    // =========================================================================
    // CHECK 4: Post-Tuning Node Drag-and-Drop Reconfiguration in Browser
    // =========================================================================
    const dragNodeScreen = await findClickableScreenNode(page, centerX, centerY);
    if (!dragNodeScreen) {
      errors.push('Check 4 failed: Could not locate a draggable node on screen');
    } else {
      await page.evaluate(() => {
        const inst = window.activeInstance as ActiveVisInstance | null | undefined;
        const snap: Record<string, [number, number, number]> = {};
        if (inst?.forcePositions) {
          for (const [id, pt] of inst.forcePositions.entries()) {
            snap[id] = [pt.x, pt.y, pt.z ?? 0];
          }
        }
        window.__preDragSnapshot = snap;
      });

      await page.mouse.move(dragNodeScreen.x, dragNodeScreen.y);
      await page.mouse.down();
      const dragSteps = 16;
      for (let s = 1; s <= dragSteps; s++) {
        const ratio = s / dragSteps;
        await page.mouse.move(
          dragNodeScreen.x + Math.round(90 * ratio),
          dragNodeScreen.y + Math.round(60 * ratio)
        );
        await sleep(18);
      }
      await page.mouse.up();
      await sleep(750);

      const dragMetrics = await page.evaluate(() => {
        const inst = window.activeInstance as ActiveVisInstance | null | undefined;
        const snap = window.__preDragSnapshot || {};
        const curMap = inst?.forcePositions;
        if (!curMap) return { movedCount: 0, maxMove: 0 };

        let movedCount = 0;
        let maxMove = 0;
        for (const [id, cur] of curMap.entries()) {
          const prev = snap[id];
          if (!prev) continue;
          const d = Math.hypot(cur.x - prev[0], cur.y - prev[1], (cur.z ?? 0) - prev[2]);
          if (d > 0.5) movedCount++;
          if (d > maxMove) maxMove = d;
        }
        return { movedCount, maxMove };
      });

      movedNeighbors = dragMetrics.movedCount;
      if (dragMetrics.movedCount >= 2 && dragMetrics.maxMove > 5.0) {
        dragReconfigOk = true;
      } else {
        errors.push(
          `Check 4 failed: movedCount=${dragMetrics.movedCount}, maxMove=${dragMetrics.maxMove.toFixed(2)}`
        );
      }
    }

    // =========================================================================
    // CHECK 5: Layout Selector Transitions (force -> radial -> columns -> force)
    // =========================================================================
    const layouts: ('radial' | 'columns' | 'force')[] = ['radial', 'columns', 'force'];
    let allLayoutsSwitched = true;
    for (const nextLayout of layouts) {
      await page.evaluate((mode: string) => {
        const sel = document.getElementById('layout-selector') as HTMLSelectElement | null;
        if (sel) {
          sel.value = mode;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, nextLayout);
      await sleep(320);
      const currentMode = await page.evaluate(() => {
        const inst = window.activeInstance as ActiveVisInstance | null | undefined;
        return inst?.currentLayout ?? '';
      });
      if (currentMode !== nextLayout) {
        allLayoutsSwitched = false;
        errors.push(`Check 5 failed: expected currentLayout=${nextLayout}, got ${currentMode}`);
      }
    }
    layoutSwitchOk = allLayoutsSwitched;
  } finally {
    page.removeAllListeners('pageerror');
    page.off('console', onConsole);
  }

  return {
    engine,
    bootOk,
    hoverAndFocusOk,
    liveTuningOk,
    dragReconfigOk,
    layoutSwitchOk,
    movedNeighbors,
    errors,
  };
}

async function main() {
  const distDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    console.error('❌ [test-visualizations-e2e] dist/ directory not found. Run `npm run build` first.');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const engineArg = args.find((a) => a.startsWith('--engine='))?.split('=')[1] as EngineId | undefined;
  const targetEngines: readonly EngineId[] =
    engineArg && ENGINES.includes(engineArg) ? [engineArg] : ENGINES;

  const { server, port } = await startStaticServer(distDir, 4399);
  const baseUrl = `http://127.0.0.1:${port}`;

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-gpu-rasterization',
      '--enable-zero-copy',
      '--ignore-gpu-blocklist',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument('window.__name = (fn) => fn;');
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

    const results: E2EResult[] = [];
    for (const engine of targetEngines) {
      console.log(`[E2E] Testing ${engine}...`);
      const res = await testEngineE2E(page, baseUrl, engine);
      results.push(res);
    }

    console.log('\n=========================================================================================');
    console.log('                 VISUALIZATION ENGINE BROWSER E2E VERIFICATION SUITE');
    console.log('=========================================================================================');
    console.log(
      '| Engine         | Boot | Hover+Focus | Live Tune | Drag Reconfig | Layouts | Errors |'
    );
    console.log(
      '|----------------|------|-------------|-----------|---------------|---------|--------|'
    );
    for (const r of results) {
      const eng = r.engine.padEnd(14, ' ');
      const boot = (r.bootOk ? 'PASS' : 'FAIL').padEnd(4, ' ');
      const hover = (r.hoverAndFocusOk ? 'PASS' : 'FAIL').padEnd(11, ' ');
      const tune = (r.liveTuningOk ? 'PASS' : 'FAIL').padEnd(9, ' ');
      const drag = (r.dragReconfigOk ? `PASS (${String(r.movedNeighbors).padStart(3, ' ')})` : 'FAIL       ').padEnd(13, ' ');
      const lay = (r.layoutSwitchOk ? 'PASS' : 'FAIL').padEnd(7, ' ');
      const errs = String(r.errors.length).padStart(6, ' ');
      console.log(`| ${eng} | ${boot} | ${hover} | ${tune} | ${drag} | ${lay} | ${errs} |`);
    }
    console.log('=========================================================================================\n');

    const failed = results.filter(
      (r) =>
        !r.bootOk ||
        !r.hoverAndFocusOk ||
        !r.liveTuningOk ||
        !r.dragReconfigOk ||
        !r.layoutSwitchOk ||
        r.errors.length > 0
    );

    if (failed.length > 0) {
      console.error('❌ [test-visualizations-e2e] E2E failures detected:');
      for (const f of failed) {
        console.error(`  [${f.engine}]: ${f.errors.join(' | ')}`);
      }
      process.exitCode = 1;
    } else {
      console.log(`✅ [test-visualizations-e2e] All ${results.length * 5}/${results.length * 5} browser E2E checks passed (0 errors)!`);
    }
  } finally {
    try {
      await browser.close();
    } catch {
      // Ignore transient Windows temp profile lockfile EBUSY
    }
    server.close();
  }
}

main().catch((err) => {
  console.error('❌ [test-visualizations-e2e] Fatal error:', err);
  process.exit(1);
});
