import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import puppeteer, { type Page } from 'puppeteer';

const ENGINES = ['cytoscape', 'sigma', 'd3', 'vis-network', '3d-force-graph'] as const;
type EngineId = (typeof ENGINES)[number];

interface ActiveVisInstance {
  currentLayout?: string;
  focusedNodeIds?: Set<string> | null;
  tuningInFlight?: boolean;
  forcePositions?: Map<string, { x: number; y: number; z?: number }>;
  initialForcePositions?: Map<string, { x: number; y: number; z?: number }>;
  modelPositions?: Map<string, { x: number; y: number }>;
  cy?: {
    zoom(): number;
    pan(): { x: number; y: number };
    getElementById(id: string): { data(key: string): number | undefined };
  };
  sigma?: {
    graphToViewport(pt: { x: number; y: number }): { x: number; y: number };
  };
  graph?: {
    forEachNode?: (cb: (id: string) => void) => void;
    getNodeAttribute?: (id: string, attr: string) => number;
    graph2ScreenCoords?: (x: number, y: number, z: number) => { x: number; y: number };
  };
  nodeMap?: Map<string, { group: number }>;
  nodes?: Array<{ id: string; group: number; x?: number; y?: number; z?: number }>;
  network?: {
    body?: { nodes?: Record<string, { x?: number; y?: number }> };
    canvasToDOM(pt: { x: number; y: number }): { x: number; y: number };
  };
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

async function measureRadialScreenRadii(
  page: Page
): Promise<{ innerR: number; outerR: number }> {
  return page.evaluate(() => {
    const inst = window.activeInstance as ActiveVisInstance | null | undefined;
    if (!inst) return { innerR: 0, outerR: 0 };

    const pts: Array<{ group: number; sx: number; sy: number }> = [];

    // 1. Cytoscape
    if (inst.cy && inst.modelPositions) {
      const zoom = inst.cy.zoom() || 1;
      const pan = inst.cy.pan();
      for (const [id, p] of inst.modelPositions.entries()) {
        const grp = inst.cy.getElementById(id).data('group') ?? 0;
        pts.push({
          group: grp,
          sx: p.x * zoom + pan.x,
          sy: p.y * zoom + pan.y,
        });
      }
    }
    // 2. Sigma
    else if (inst.sigma && inst.graph?.forEachNode && inst.graph.getNodeAttribute && inst.nodeMap) {
      const sigmaRef = inst.sigma;
      const getAttr = inst.graph.getNodeAttribute.bind(inst.graph);
      const mapRef = inst.nodeMap;
      inst.graph.forEachNode((id) => {
        const x = Number(getAttr(id, 'x') ?? 0);
        const y = Number(getAttr(id, 'y') ?? 0);
        const vp = sigmaRef.graphToViewport({ x, y });
        const grp = mapRef.get(id)?.group ?? 0;
        pts.push({ group: grp, sx: vp.x, sy: vp.y });
      });
    }
    // 3. Vis-Network
    else if (inst.network && inst.nodes) {
      const bodyNodes = inst.network.body?.nodes ?? {};
      for (const n of inst.nodes) {
        const bn = bodyNodes[n.id];
        if (bn && typeof bn.x === 'number' && typeof bn.y === 'number') {
          const dom = inst.network.canvasToDOM({ x: bn.x, y: bn.y });
          pts.push({ group: n.group, sx: dom.x, sy: dom.y });
        }
      }
    }
    // 4. 3D Force Graph
    else if (inst.graph?.graph2ScreenCoords && inst.nodes) {
      for (const n of inst.nodes) {
        const sc = inst.graph.graph2ScreenCoords(n.x ?? 0, n.y ?? 0, n.z ?? 0);
        pts.push({ group: n.group, sx: sc.x, sy: sc.y });
      }
    }
    // 5. D3 SVG
    else if (inst.nodes) {
      const g = document.querySelector<SVGGElement>('#canvas svg g');
      const ctm = g?.getCTM();
      const scaleX = ctm?.a ?? 1;
      const scaleY = ctm?.d ?? 1;
      const tx = ctm?.e ?? 0;
      const ty = ctm?.f ?? 0;
      for (const n of inst.nodes) {
        pts.push({
          group: n.group,
          sx: (n.x ?? 0) * scaleX + tx,
          sy: (n.y ?? 0) * scaleY + ty,
        });
      }
    }

    if (pts.length === 0) return { innerR: 0, outerR: 0 };

    // Compute center of the inner ring in screen space
    let cx = 0;
    let cy = 0;
    let innerCount = 0;
    for (const p of pts) {
      if (p.group === 0) {
        cx += p.sx;
        cy += p.sy;
        innerCount++;
      }
    }
    if (innerCount === 0) return { innerR: 0, outerR: 0 };
    cx /= innerCount;
    cy /= innerCount;

    let sumInner = 0;
    let sumOuter = 0;
    let outerCount = 0;
    for (const p of pts) {
      const dist = Math.hypot(p.sx - cx, p.sy - cy);
      if (p.group === 0) {
        sumInner += dist;
      } else {
        sumOuter += dist;
        outerCount++;
      }
    }

    return {
      innerR: innerCount > 0 ? sumInner / innerCount : 0,
      outerR: outerCount > 0 ? sumOuter / outerCount : 0,
    };
  });
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
      { timeout: 25000, polling: 50 }
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
    // CHECK 3: Live Parameter Tuning (#tune-hud: visual + geometry + physics) & Reset
    // =========================================================================
    await page.click('#tune-toggle-btn');
    await sleep(100);

    const tuneShift = await page.evaluate(async () => {
      const panel = document.getElementById('tune-panel');
      const dirtyDot = document.getElementById('tune-dirty-dot');
      const forceSections = Array.from(
        document.querySelectorAll<HTMLElement>('[data-tune-layout="force"]')
      );
      const radialSections = Array.from(
        document.querySelectorAll<HTMLElement>('[data-tune-layout="radial"]')
      );
      const forceVisibleInForceMode =
        forceSections.length > 0 && forceSections.every((el) => !el.classList.contains('hidden'));
      const radialHiddenInForceMode =
        radialSections.length > 0 && radialSections.every((el) => el.classList.contains('hidden'));

      const visualSlider = document.querySelector(
        'input[data-tune-key="nodeRadius"]'
      ) as HTMLInputElement | null;
      const physicsSlider = document.querySelector(
        'input[data-tune-key="repulsionScale"]'
      ) as HTMLInputElement | null;
      if (
        !panel ||
        panel.classList.contains('hidden') ||
        !visualSlider ||
        !physicsSlider
      ) {
        return {
          panelOpen: false,
          contextVisInForceOk: false,
          visualOk: false,
        };
      }

      visualSlider.value = '10.5';
      visualSlider.dispatchEvent(new Event('input', { bubbles: true }));
      physicsSlider.value = '1.65';
      physicsSlider.dispatchEvent(new Event('input', { bubbles: true }));
      physicsSlider.dispatchEvent(new Event('change', { bubbles: true }));

      const visualVal = document.querySelector('[data-tune-val="nodeRadius"]')?.textContent?.trim();
      const dotVisible = Boolean(dirtyDot && !dirtyDot.classList.contains('hidden'));
      return {
        panelOpen: true,
        contextVisInForceOk: forceVisibleInForceMode && radialHiddenInForceMode,
        visualOk: visualVal === '10.5' && dotVisible,
      };
    });

    await sleep(120);
    await page.waitForFunction(
      () => !(window.activeInstance as ActiveVisInstance | null | undefined)?.tuningInFlight,
      { timeout: 15000, polling: 50 }
    );
    await sleep(600);

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
    await sleep(650);

    const resetState = await page.evaluate(() => {
      const inst = window.activeInstance as ActiveVisInstance | null | undefined;
      const dirtyDot = document.getElementById('tune-dirty-dot');
      if (!inst?.forcePositions || !inst?.initialForcePositions) {
        return { maxD: Infinity, dotHidden: false };
      }
      let maxD = 0;
      for (const [id, cur] of inst.forcePositions.entries()) {
        const init = inst.initialForcePositions.get(id);
        if (!init) continue;
        const d = Math.hypot(cur.x - init.x, cur.y - init.y, (cur.z ?? 0) - (init.z ?? 0));
        if (d > maxD) maxD = d;
      }
      const dotHidden = Boolean(!dirtyDot || dirtyDot.classList.contains('hidden'));
      return { maxD, dotHidden };
    });

    // Switch to radial layout to test context-sensitive Radial Rings & independent screen-space ring radii
    await page.select('#layout-selector', 'radial');
    await sleep(1100);

    const radialContextOk = await page.evaluate(() => {
      const forceSections = Array.from(
        document.querySelectorAll<HTMLElement>('[data-tune-layout="force"]')
      );
      const radialSections = Array.from(
        document.querySelectorAll<HTMLElement>('[data-tune-layout="radial"]')
      );
      return (
        forceSections.length > 0 &&
        forceSections.every((el) => el.classList.contains('hidden')) &&
        radialSections.length > 0 &&
        radialSections.every((el) => !el.classList.contains('hidden'))
      );
    });

    const baseRadii = await measureRadialScreenRadii(page);

    // 1. Increase Inner Ring (0.22 -> 0.30)
    await page.evaluate(() => {
      const innerSlider = document.querySelector(
        'input[data-tune-key="radialInnerRatio"]'
      ) as HTMLInputElement | null;
      if (innerSlider) {
        innerSlider.value = '0.30';
        innerSlider.dispatchEvent(new Event('input', { bubbles: true }));
        innerSlider.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(650);
    const afterInnerRadii = await measureRadialScreenRadii(page);

    // 2. Decrease Outer Ring (0.44 -> 0.35)
    await page.evaluate(() => {
      const outerSlider = document.querySelector(
        'input[data-tune-key="radialOuterRatio"]'
      ) as HTMLInputElement | null;
      if (outerSlider) {
        outerSlider.value = '0.35';
        outerSlider.dispatchEvent(new Event('input', { bubbles: true }));
        outerSlider.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(650);
    const afterOuterRadii = await measureRadialScreenRadii(page);

    const innerDeltaOnInnerTune = afterInnerRadii.innerR - baseRadii.innerR;
    const outerDriftOnInnerTune = Math.abs(afterInnerRadii.outerR - baseRadii.outerR);
    const outerDeltaOnOuterTune = baseRadii.outerR - afterOuterRadii.outerR;
    const innerDriftOnOuterTune = Math.abs(afterOuterRadii.innerR - afterInnerRadii.innerR);

    const radialRingTuneOk =
      radialContextOk &&
      innerDeltaOnInnerTune > 10 &&
      outerDriftOnInnerTune < 3 &&
      outerDeltaOnOuterTune > 10 &&
      innerDriftOnOuterTune < 3;

    // Reset and return to force layout for Check 4
    await page.click('#tune-reset-btn');
    await sleep(300);
    await page.select('#layout-selector', 'force');
    await sleep(950);

    // Close tuning panel
    await page.click('#tune-toggle-btn');
    await sleep(250);

    if (
      tuneShift.panelOpen &&
      tuneShift.contextVisInForceOk &&
      tuneShift.visualOk &&
      tuneDeltaAfterChange > 1.0 &&
      resetState.maxD < 0.05 &&
      resetState.dotHidden &&
      radialRingTuneOk
    ) {
      liveTuningOk = true;
    } else {
      errors.push(
        `Check 3 failed: panelOpen=${String(tuneShift.panelOpen)}, contextForce=${String(tuneShift.contextVisInForceOk)}, contextRadial=${String(radialContextOk)}, visualOk=${String(tuneShift.visualOk)}, tuneDelta=${tuneDeltaAfterChange.toFixed(2)}, resetDelta=${resetState.maxD.toFixed(4)}, innerDelta=${innerDeltaOnInnerTune.toFixed(1)}px (outerDrift=${outerDriftOnInnerTune.toFixed(1)}px), outerDelta=${outerDeltaOnOuterTune.toFixed(1)}px (innerDrift=${innerDriftOnOuterTune.toFixed(1)}px)`
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
