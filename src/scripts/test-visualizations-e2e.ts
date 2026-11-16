import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import puppeteer, { type Page } from 'puppeteer';

const ENGINES = ['cytoscape', 'sigma', 'd3', 'vis-network', '3d-force-graph'] as const;
type EngineId = (typeof ENGINES)[number];

interface ActiveVisInstance {
  timelineAdapter?: {
    getCurrentNodes(): { group: number }[];
    getLivePositions(): Map<string, { x: number; y: number }>;
  };
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

let waitScale = 1;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.round(ms * waitScale)));
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

interface XfState {
  saw: boolean;
  bad: string;
  stop: boolean;
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
      { timeout: 35000, polling: 50 }
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

    if (bootState.forceSize >= 220 && bootState.initSize >= 220 && bootState.hasRenderSurface) {
      bootOk = true;
    } else {
      errors.push(
        `Check 1 failed: forceSize=${bootState.forceSize}, initSize=${bootState.initSize}, surface=${String(bootState.hasRenderSurface)}`
      );
    }

    // =========================================================================
    // CHECK 1b (D3 only): Theme-Cluster pills frame their text exactly (symmetric padding, no clipping)
    // =========================================================================
    if (engine === 'd3') {
      const pillReport = await page.evaluate(() => {
        const out: { name: string; leftPad: number; rightPad: number; textInside: boolean }[] = [];
        const pills = Array.from(document.querySelectorAll('#canvas .cluster-pill'));
        for (const pill of pills) {
          const rectEl = pill.querySelector('rect');
          const dotEl = pill.querySelector('circle');
          const textEl = pill.querySelector('text');
          if (!rectEl || !dotEl || !textEl) continue;
          const r = rectEl.getBoundingClientRect();
          const d = dotEl.getBoundingClientRect();
          const t = textEl.getBoundingClientRect();
          const modelW = Number(rectEl.getAttribute('width')) || r.width;
          const scale = modelW > 0 ? r.width / modelW : 1;
          const leftPad = (d.left - r.left) / scale;
          const rightPad = (r.right - t.right) / scale;
          out.push({
            name: (textEl.textContent || '').trim(),
            leftPad,
            rightPad,
            textInside: t.left >= r.left && t.right <= r.right,
          });
        }
        return out;
      });
      const badPills = pillReport.filter(
        (p) =>
          !p.textInside ||
          p.rightPad < 4 ||
          p.leftPad < 4 ||
          Math.abs(p.leftPad - p.rightPad) > 4
      );
      if (pillReport.length === 0) {
        errors.push('Check 1b failed: no D3 .cluster-pill elements found');
        bootOk = false;
      } else if (badPills.length > 0) {
        errors.push(
          `Check 1b failed: ${badPills.length}/${pillReport.length} cluster pills do not frame their text: ${badPills
            .map((p) => `${p.name} (L=${p.leftPad.toFixed(1)}, R=${p.rightPad.toFixed(1)})`)
            .join('; ')}`
        );
        bootOk = false;
      }
    }

    // =========================================================================
    // CHECK 1c (D3 only): a newly split cluster pill must start invisible (fade-in, no pop-in)
    // =========================================================================
    if (engine === 'd3') {
      const setK = async (k: number) => {
        await page.evaluate((val: number) => {
          const slider = document.querySelector('input[data-tune-key="clusterCount"]') as HTMLInputElement | null;
          if (!slider) return;
          slider.value = String(val);
          slider.dispatchEvent(new Event('input', { bubbles: true }));
          slider.dispatchEvent(new Event('change', { bubbles: true }));
        }, k);
      };
      const readPills = () =>
        page.evaluate(() =>
          Array.from(document.querySelectorAll('#canvas .cluster-pill')).map((p) =>
            Number.parseFloat((p as SVGGElement).style.opacity || '1')
          )
        );
      await setK(4);
      await page.waitForFunction(() => document.querySelectorAll('#canvas .cluster-pill').length >= 4, {
        timeout: 8000,
        polling: 'raf',
      });
      const atT0 = await readPills();
      const hasInvisibleNewPill = atT0.length >= 4 && atT0.some((o) => o < 0.1);
      const noPopIn = atT0.filter((o) => o > 0.9).length <= 3;
      if (!hasInvisibleNewPill || !noPopIn) {
        errors.push(
          `Check 1c failed: new cluster pill must start at alpha~0 after K 3->4, got opacities=[${atT0.map((o) => o.toFixed(2)).join(', ')}]`
        );
        bootOk = false;
      }
      await sleep(200);
      await page.waitForFunction(
        () => !(window.activeInstance as ActiveVisInstance | null | undefined)?.tuningInFlight,
        { timeout: 25000, polling: 50 }
      );
      await sleep(900);
      const settled = await readPills();
      if (!settled.every((o) => o > 0.9)) {
        errors.push(
          `Check 1c failed: pills must settle at ~0.97 after the transition, got [${settled.map((o) => o.toFixed(2)).join(', ')}]`
        );
        bootOk = false;
      }
      // Label cross-fade: while a continuing cluster changes its label, both texts coexist with alpha in (0,1);
      // after the transition only the new text remains.
      let sawCrossfade = false;
      let crossfadeBad = '';
      for (const k of [6, 7, 8]) {
        await page.evaluate(() => {
          const w = window as Window & { __xf?: XfState };
          w.__xf = { saw: false, bad: '', stop: false };
          const loop = () => {
            const st = w.__xf;
            if (!st || st.stop) return;
            for (const pill of Array.from(document.querySelectorAll('#canvas .cluster-pill'))) {
              const texts = Array.from(pill.children).filter((c) => c.tagName.toLowerCase() === 'text') as SVGTextElement[];
              if (texts.length >= 2) {
                const alphas = texts.map((t) => Number.parseFloat(t.style.opacity || '1'));
                st.saw = true;
                if (alphas.some((a) => !(a >= 0 && a <= 1))) st.bad = `alphas=${alphas.join(',')}`;
              }
            }
            requestAnimationFrame(loop);
          };
          requestAnimationFrame(loop);
        });
        await setK(k);
        await sleep(250);
        await page.waitForFunction(
          () => !(window.activeInstance as ActiveVisInstance | null | undefined)?.tuningInFlight,
          { timeout: 25000, polling: 50 }
        );
        await sleep(900);
        const res = await page.evaluate(() => {
          const w = window as Window & { __xf?: XfState };
          if (w.__xf) w.__xf.stop = true;
          const multi = Array.from(document.querySelectorAll('#canvas .cluster-pill')).filter(
            (pill) => Array.from(pill.children).filter((c) => c.tagName.toLowerCase() === 'text').length !== 1
          ).length;
          return { saw: Boolean(w.__xf?.saw), bad: w.__xf?.bad || '', multi };
        });
        sawCrossfade = sawCrossfade || res.saw;
        if (res.bad) crossfadeBad = res.bad;
        if (res.multi > 0) crossfadeBad = `${res.multi} pills still show multiple label texts after the transition`;
      }
      if (!sawCrossfade || crossfadeBad) {
        errors.push(
          `Check 1d failed: label cross-fade (sawBothTexts=${String(sawCrossfade)}) ${crossfadeBad}`
        );
        bootOk = false;
      }
      await setK(3);
      await sleep(200);
      await page.waitForFunction(
        () => !(window.activeInstance as ActiveVisInstance | null | undefined)?.tuningInFlight,
        { timeout: 25000, polling: 50 }
      );
      await sleep(900);
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
    const expectedDefaultK = engine === '3d-force-graph' ? 4 : 3;
    const initialTuneOk = await page.evaluate((expK: number) => {
      const dirtyDot = document.getElementById('tune-dirty-dot');
      const kSlider = document.querySelector('input[data-tune-key="clusterCount"]') as HTMLInputElement | null;
      const kVal = document.querySelector('[data-tune-val="clusterCount"]')?.textContent?.trim();
      return {
        dotHidden: Boolean(!dirtyDot || dirtyDot.classList.contains('hidden')),
        kSliderVal: kSlider?.value,
        kLabelVal: kVal,
        ok:
          Boolean(!dirtyDot || dirtyDot.classList.contains('hidden')) &&
          kSlider?.value === String(expK) &&
          kVal === String(expK),
      };
    }, expectedDefaultK);
    if (!initialTuneOk.ok) {
      errors.push(
        `Check 3 initial state failed: expected K=${expectedDefaultK} and hidden dirty dot, got ${JSON.stringify(initialTuneOk)}`
      );
    }

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
      { timeout: 25000, polling: 50 }
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

    // Close tuning panel via #tune-close-btn (left sidebar overlays #tune-toggle-btn)
    await page.click('#tune-close-btn');
    await sleep(250);
    const panelClosed = await page.evaluate(() =>
      Boolean(document.getElementById('tune-panel')?.classList.contains('hidden'))
    );

    if (
      tuneShift.panelOpen &&
      tuneShift.contextVisInForceOk &&
      tuneShift.visualOk &&
      tuneDeltaAfterChange > 1.0 &&
      resetState.maxD < 0.05 &&
      resetState.dotHidden &&
      radialRingTuneOk &&
      panelClosed
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
        await new Promise((resolve) => setTimeout(resolve, 18));
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

    // =========================================================================
    // CHECK 6: Timeline player (SYSTEM-014 Etappe 2): play / pause / scrub / speed / end-state parity
    // =========================================================================
    {
      type TlState = {
        step: number;
        lastStep: number;
        total: number;
        playing: boolean;
        speed: number;
        itemCount: number;
        clusterCount: number;
        busy: boolean;
      };
      const tlState = (): Promise<TlState | null> =>
        page.evaluate(() => (window.activeTimeline ? window.activeTimeline.getState() : null)) as Promise<TlState | null>;
      const contentCount = (): Promise<number> =>
        page.evaluate(() => {
          const inst = window.activeInstance as ActiveVisInstance | null | undefined;
          const nodes = inst?.timelineAdapter?.getCurrentNodes() ?? [];
          return nodes.filter((n) => n.group !== 0).length;
        });
      const waitForStep = async (target: number) => {
        await page.waitForFunction(
          (t: number) => {
            const s = window.activeTimeline?.getState();
            return Boolean(s && s.step === t && !s.busy);
          },
          { timeout: 25000, polling: 100 },
          target
        );
        await sleep(150);
      };
      const waitSettled = () =>
        page.waitForFunction(() => Boolean(window.activeTimeline?.getState().settled), {
          timeout: 40000,
          polling: 100,
        });
      const positionDelta = (): Promise<number> =>
        page.evaluate(async () => {
          const inst = window.activeInstance as ActiveVisInstance | null | undefined;
          const sample = () => inst?.timelineAdapter?.getLivePositions() ?? new Map<string, { x: number; y: number }>();
          const a = sample();
          await new Promise<void>((resolve) => setTimeout(resolve, 600));
          const b = sample();
          let maxD = 0;
          for (const [id, p] of a) {
            const q = b.get(id);
            if (q) maxD = Math.max(maxD, Math.hypot(p.x - q.x, p.y - q.y));
          }
          return maxD;
        });
      const clickId = (id: string) =>
        page.evaluate((elId: string) => (document.getElementById(elId) as HTMLButtonElement | null)?.click(), id);
      const scrubTo = (value: number) =>
        page.evaluate((v: number) => {
          const el = document.getElementById('timeline-scrubber') as HTMLInputElement | null;
          if (!el) return;
          el.value = String(v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }, value);

      const errCount0 = errors.length;
      const s0 = await tlState();
      if (!s0 || s0.total < 100 || s0.step !== s0.lastStep || s0.playing || s0.clusterCount !== expectedDefaultK) {
        errors.push(`Check 6a failed: timeline must start at the end state with K=${expectedDefaultK}, got ${JSON.stringify(s0)}`);
      } else {
        const barCheck = await page.evaluate(() => ({
          hasDate: Boolean(document.getElementById('timeline-date')),
          hasCounter: Boolean(document.getElementById('timeline-counter')),
          hasSpeed: Boolean(document.getElementById('timeline-speed')),
          scrubberVal: (document.getElementById('timeline-scrubber') as HTMLInputElement | null)?.value,
        }));
        if (barCheck.hasDate || barCheck.hasCounter || barCheck.hasSpeed || barCheck.scrubberVal !== String(s0.lastStep)) {
          errors.push(`Check 6a failed: streamlined timeline bar check failed (${JSON.stringify(barCheck)})`);
        }

        // 6b: Play restarts from the beginning and advances; measure frame rate
        await page.evaluate(() => {
          window.activeTimeline?.setSpeed(2);
        });
        await clickId('timeline-play');
        await sleep(400);
        const sA = await tlState();
        const fps = await page.evaluate(
          () =>
            new Promise<{ avg: number; p95: number; frames: number }>((resolve) => {
              const times: number[] = [];
              let last = performance.now();
              const end = last + 3000;
              const frame = (now: number) => {
                times.push(now - last);
                last = now;
                if (now < end) requestAnimationFrame(frame);
                else {
                  const sorted = [...times].sort((a, b) => a - b);
                  const avg = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);
                  resolve({ avg, p95: sorted[Math.floor(sorted.length * 0.95)] ?? avg, frames: times.length });
                }
              };
              requestAnimationFrame(frame);
            })
        );
        const sB = await tlState();
        if (!sA || !sB || !sB.playing || sB.step < sA.step + 1 || sA.step >= s0.lastStep) {
          errors.push(
            `Check 6b failed: playback must restart from the beginning and advance (A=${JSON.stringify(sA)}, B=${JSON.stringify(sB)})`
          );
        }
        if (sB && sB.speed !== 2) errors.push(`Check 6b failed: speed 2x not applied (speed=${sB.speed})`);
        console.log(
          `[E2E][${engine}] timeline playback 2x: ${sA?.step ?? '?'} -> ${sB?.step ?? '?'} steps in 3s, avg frame ${fps.avg.toFixed(1)}ms (${(1000 / fps.avg).toFixed(0)} fps), p95 ${fps.p95.toFixed(1)}ms`
        );
        if (1000 / fps.avg < 8) errors.push(`Check 6b failed: playback frame rate collapsed (${(1000 / fps.avg).toFixed(1)} fps)`);

        // 6b2: playback is gated by convergence: every playback-driven step starts only after the previous one settled
        await clickId('timeline-play');
        await waitSettled();
        const gate = await page.evaluate(() => {
          const st = window.activeTimeline?.getStats();
          const log = st?.stepLog ?? [];
          let ungated = 0;
          let unsettled = 0;
          const playback = log.filter((l) => l.viaPlayback);
          for (let i = 0; i < playback.length - 1; i++) {
            const cur = playback[i];
            const nxt = playback[i + 1];
            if (nxt.step !== cur.step + 1) continue;
            if (cur.settledAt === null) unsettled++;
            else if (cur.settledAt > nxt.startedAt) ungated++;
          }
          return {
            violations: st?.playbackViolations ?? -1,
            ungated,
            unsettled,
            steps: playback.length,
            relaxRounds: st?.relaxRounds ?? 0,
          };
        });
        if (gate.violations !== 0 || gate.ungated > 0 || gate.unsettled > 0 || gate.steps < 2) {
          errors.push(`Check 6b2 failed: playback must be gated by convergence (${JSON.stringify(gate)})`);
        }
        console.log(`[E2E][${engine}] playback convergence gating: ${JSON.stringify(gate)}`);
        await clickId('timeline-play');
        await sleep(150);
        // 6b3: Scrubbing while playing keeps playback active and advances from the jumped step
        await scrubTo(20);
        const sJump = await tlState();
        if (!sJump || !sJump.playing) {
          errors.push(`Check 6b3 failed: seeking while playing must keep playing=true (${JSON.stringify(sJump)})`);
        } else {
          await page
            .waitForFunction(
              () => {
                const s = window.activeTimeline?.getState();
                return Boolean(s && s.playing && s.step > 20);
              },
              { timeout: 8000, polling: 50 }
            )
            .catch(() => null);
          const sAfterJump = await tlState();
          if (!sAfterJump || !sAfterJump.playing || sAfterJump.step <= 20) {
            errors.push(
              `Check 6b3 failed: playback must continue advancing after jumping to step 20 (${JSON.stringify(sAfterJump)})`
            );
          }
        }
        // 6c: Pause stops advancing
        await clickId('timeline-play');
        await sleep(250);
        const sP1 = await tlState();
        await sleep(900);
        const sP2 = await tlState();
        if (!sP1 || !sP2 || sP1.playing || sP2.playing || sP1.step !== sP2.step) {
          errors.push(`Check 6c failed: pause must stop the timeline (${JSON.stringify(sP1)} vs ${JSON.stringify(sP2)})`);
        }
        await waitSettled();
        const pauseDelta = await positionDelta();
        if (pauseDelta > 0.05) {
          errors.push(`Check 6c failed: layout must be stable after Pause (maxDelta=${pauseDelta.toFixed(3)}px)`);
        }

        // 6d: scrub to step 0 (single item) and to the middle
        await scrubTo(0);
        await waitForStep(0);
        const c0 = await contentCount();
        const sZero = await tlState();
        if (c0 !== 1 || !sZero || sZero.itemCount !== 1) {
          errors.push(`Check 6d failed: step 0 must show exactly 1 item (engine=${c0}, state=${JSON.stringify(sZero)})`);
        }
        const mid = Math.floor(s0.lastStep / 2);
        await scrubTo(mid);
        await waitForStep(mid);
        const cMid = await contentCount();
        const sMid = await tlState();
        if (cMid !== mid + 1 || !sMid || sMid.itemCount !== mid + 1 || sMid.clusterCount < 2) {
          errors.push(`Check 6d failed: mid step must show ${mid + 1} items (engine=${cMid}, state=${JSON.stringify(sMid)})`);
        }

        await waitSettled();
        const midDelta = await positionDelta();
        if (midDelta > 0.05) {
          errors.push(`Check 6d failed: layout must settle after a step change (maxDelta=${midDelta.toFixed(3)}px)`);
        }
        const relaxStats = await page.evaluate(() => window.activeTimeline?.getStats().relaxRounds ?? 0);
        console.log(`[E2E][${engine}] timeline relaxation rounds so far: ${relaxStats}`);

        // 6e: step forward / back buttons
        await clickId('timeline-next');
        await waitForStep(mid + 1);
        await clickId('timeline-prev');
        await waitForStep(mid);

        // 6f: scrub back to the end -> identical to the static graph (0.00 px parity)
        await scrubTo(s0.lastStep);
        await waitForStep(s0.lastStep);
        await sleep(700);
        const parity = await page.evaluate(() => {
          const inst = window.activeInstance as ActiveVisInstance | null | undefined;
          const live = inst?.timelineAdapter?.getLivePositions();
          const rest = inst?.initialForcePositions;
          const nodes = inst?.timelineAdapter?.getCurrentNodes() ?? [];
          if (!live || !rest) return { maxD: Infinity, missing: -1, content: nodes.length };
          let maxD = 0;
          let missing = 0;
          for (const [id, r] of rest.entries()) {
            const l = live.get(id);
            if (!l) {
              missing++;
              continue;
            }
            maxD = Math.max(maxD, Math.hypot(l.x - r.x, l.y - r.y));
          }
          return { maxD, missing, content: nodes.length };
        });
        const sEnd = await tlState();
        const scrubberEnd = await page.$eval('#timeline-scrubber', (el) => (el as HTMLInputElement).value);
        if (parity.missing !== 0 || parity.maxD > 0.01 || !sEnd || sEnd.itemCount !== s0.total || scrubberEnd !== String(s0.lastStep)) {
          errors.push(
            `Check 6f failed: end state must equal the static graph (maxDelta=${parity.maxD.toFixed(4)}px, missing=${parity.missing}, scrubber=${scrubberEnd}, state=${JSON.stringify(sEnd)})`
          );
        }

        // 6g: a step is solved completely in the background (no visible iterations), then animates monotonically
        const probeTarget = Math.max(1, s0.lastStep - 7);
        const probe = await page.evaluate(async (targetStep: number) => {
          const inst = window.activeInstance as ActiveVisInstance | null | undefined;
          const tl = window.activeTimeline;
          if (!inst?.timelineAdapter || !tl) return null;
          const frames: { t: number; pos: [string, number, number][] }[] = [];
          const sample = (): [string, number, number][] =>
            Array.from(inst.timelineAdapter!.getLivePositions(), ([id, p]) => [id, p.x, p.y] as [string, number, number]);
          const el = document.getElementById('timeline-scrubber') as HTMLInputElement | null;
          if (!el) return null;
          el.value = String(targetStep);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          const t0 = performance.now();
          await new Promise<void>((resolve) => {
            const loop = () => {
              frames.push({ t: performance.now(), pos: sample() });
              const s = tl.getState();
              const elapsed = performance.now() - t0;
              if ((!s.busy && elapsed > 250) || elapsed > 25000) resolve();
              else requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
          });
          const st = tl.getStats();
          const entry = st.stepLog[st.stepLog.length - 1];
          return { frames, animStartedAt: entry?.animStartedAt ?? null, step: entry?.step ?? -1 };
        }, probeTarget);
        if (!probe || probe.step !== probeTarget) {
          errors.push(`Check 6g failed: probe step did not run (${JSON.stringify(probe && { step: probe.step })})`);
        } else {
          const pre = probe.frames.filter((f) => probe.animStartedAt === null || f.t < probe.animStartedAt);
          const post = probe.frames.filter((f) => probe.animStartedAt !== null && f.t >= probe.animStartedAt);
          let preDelta = 0;
          if (pre.length > 1) {
            const first = new Map(pre[0].pos.map(([id, x, y]) => [id, { x, y }]));
            for (const f of pre) {
              for (const [id, x, y] of f.pos) {
                const q = first.get(id);
                if (q) preDelta = Math.max(preDelta, Math.hypot(x - q.x, y - q.y));
                else preDelta = Math.max(preDelta, Infinity);
              }
            }
          }
          let monotonic = true;
          let worstRise = 0;
          if (post.length > 3) {
            const final = new Map(post[post.length - 1].pos.map(([id, x, y]) => [id, { x, y }]));
            let prevDist = Infinity;
            for (const f of post) {
              let d = 0;
              for (const [id, x, y] of f.pos) {
                const q = final.get(id);
                if (q) d += Math.hypot(x - q.x, y - q.y);
              }
              if (d > prevDist * 1.02 + 0.5) {
                monotonic = false;
                worstRise = Math.max(worstRise, d - prevDist);
              }
              prevDist = Math.min(prevDist, d);
            }
          }
          if (preDelta > 1e-6 || !monotonic) {
            errors.push(
              `Check 6g failed: no visible iterations before the animation and a monotonic glide afterwards expected (preFrames=${pre.length}, preDelta=${preDelta.toFixed(4)}px, postFrames=${post.length}, monotonic=${String(monotonic)}, worstRise=${worstRise.toFixed(2)})`
            );
          }
          console.log(
            `[E2E][${engine}] step solve in background: ${pre.length} static frames before animation, ${post.length} animation frames, preDelta=${preDelta.toFixed(4)}px`
          );
        }
        await waitSettled();
        const afterProbeDelta = await positionDelta();
        if (afterProbeDelta > 0.05) errors.push(`Check 6g failed: layout must stay stable after the animation (${afterProbeDelta.toFixed(3)}px)`);
      }
      if (errors.length > errCount0) {
        liveTuningOk = false;
      }
    }

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
  const isCi = process.env.CI === 'true' || args.includes('--ci');
  waitScale = isCi ? 1.5 : 1;
  const engineArg = args.find((a) => a.startsWith('--engine='))?.split('=')[1] as EngineId | undefined;
  const targetEngines: readonly EngineId[] =
    engineArg && ENGINES.includes(engineArg) ? [engineArg] : ENGINES;

  const { server, port } = await startStaticServer(distDir, 4399);
  const baseUrl = `http://127.0.0.1:${port}`;

  const launchArgs = isCi
    ? [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-webgl',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
      ]
    : [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--enable-gpu-rasterization',
        '--enable-zero-copy',
        '--ignore-gpu-blocklist',
        '--enable-unsafe-swiftshader',
      ];

  const browser = await puppeteer.launch({
    headless: true,
    args: launchArgs,
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
