import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as esbuild from 'esbuild';
import puppeteer from 'puppeteer';
import { getFileContentHash, getHashedFilename } from '@commons/server/content-hash';
import {
  CONTENT_DOMAINS,
  DOMAIN_METADATA,
  getThemeTokens,
} from '@commons/shared/domain-themes';
import {
  DEFAULT_TOPIC_CLUSTER_COUNT,
  getDefaultTopicClusterCount,
  hydrateEnginePayloads,
  reclusterCanonicalGraphPayload,
  type EnginePayloads,
  type VisualizationEngineType,
} from '@commons/shared/graph-payload';

export const VIS_PREVIEW_CACHE_DIR = path.resolve('.cache/vis-previews');

export const VIS_PREVIEW_ENGINES: readonly VisualizationEngineType[] = [
  'cytoscape',
  'sigma',
  'd3',
  'vis-network',
  '3d-force-graph',
] as const;

export interface VisPreviewAssetsResult {
  previews: Record<string, string>;
  cacheHit: boolean;
}

export interface EnsureVisPreviewAssetsOptions {
  force?: boolean;
  verbose?: boolean;
  outDir?: string;
}

const MANIFEST_PATH = path.join(VIS_PREVIEW_CACHE_DIR, '.manifest.json');
const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 720;
const RENDER_VERSION = 'v1_1280x720_dark_settled';

const SHARED_AND_CLIENT_HASH_FILES = [
  path.resolve('src/commons/server/vis-preview-assets.ts'),
  path.resolve('src/commons/shared/graph-payload.ts'),
  path.resolve('src/commons/shared/graph-solvers.ts'),
  path.resolve('src/commons/shared/domain-themes.ts'),
  path.resolve('src/commons/shared/accent-system.ts'),
  path.resolve('src/commons/client/graph-drag-controller.ts'),
  path.resolve('src/commons/client/graph-k-transition.ts'),
  path.resolve('src/commons/client/graph-timeline-controller.ts'),
  path.resolve('src/commons/client/vis-tooltip.tsx'),
];

function computeVisPreviewInputHash(payloadHash: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(`viewport:${VIEWPORT_WIDTH}x${VIEWPORT_HEIGHT}:${RENDER_VERSION}`);
  hash.update(`payloadHash:${payloadHash}`);

  for (const slug of VIS_PREVIEW_ENGINES) {
    const enginePath = path.resolve('src/content/visualizations', slug, 'engine.ts');
    if (fs.existsSync(enginePath)) {
      hash.update(`engine:${slug}:`);
      hash.update(fs.readFileSync(enginePath, 'utf8').replace(/\r\n/g, '\n'));
    }
  }

  for (const filePath of SHARED_AND_CLIENT_HASH_FILES) {
    if (fs.existsSync(filePath)) {
      hash.update(`dep:${path.basename(filePath)}:`);
      hash.update(fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n'));
    }
  }

  return hash.digest('hex');
}

function allCachedPreviewsExist(): boolean {
  for (const slug of VIS_PREVIEW_ENGINES) {
    if (!fs.existsSync(path.join(VIS_PREVIEW_CACHE_DIR, `${slug}.png`))) {
      return false;
    }
  }
  return true;
}

export function syncVisPreviewsToDist(
  files: Array<{ cachedPath: string; fileName: string }>,
  targetDistDir?: string
): void {
  const distDir = targetDistDir || path.resolve('dist');
  if (fs.existsSync(distDir)) {
    const destDir = path.join(distDir, 'assets', 'vis-previews');
    fs.mkdirSync(destDir, { recursive: true });
    for (const file of files) {
      fs.copyFileSync(file.cachedPath, path.join(destDir, file.fileName));
    }
  }
}

function buildPreviewResultFromCache(targetDistDir?: string): Record<string, string> {
  const previews: Record<string, string> = {};
  const filesToSync: Array<{ cachedPath: string; fileName: string }> = [];

  for (const slug of VIS_PREVIEW_ENGINES) {
    const cachedPath = path.join(VIS_PREVIEW_CACHE_DIR, `${slug}.png`);
    const fileHash = getFileContentHash(cachedPath);
    const hashedFileName = getHashedFilename(`${slug}.png`, fileHash);
    previews[slug] = `/assets/vis-previews/${hashedFileName}`;
    filesToSync.push({ cachedPath, fileName: hashedFileName });
  }

  syncVisPreviewsToDist(filesToSync, targetDistDir);
  return previews;
}

export function syncCachedVisPreviewsToDist(targetDistDir?: string): boolean {
  if (!allCachedPreviewsExist()) {
    return false;
  }
  buildPreviewResultFromCache(targetDistDir);
  return true;
}

async function bundleEngineScript(slug: VisualizationEngineType): Promise<string> {
  const engineEntryPath = path.resolve('src/content/visualizations', slug, 'engine.ts').replace(/\\/g, '/');
  const entrySource = `
    import engine from '${engineEntryPath}';
    window.__VIS_ENGINE__ = engine;
  `;

  const result = await esbuild.build({
    stdin: {
      contents: entrySource,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    tsconfig: path.resolve('tsconfig.json'),
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    logLevel: 'silent',
  });

  const output = result.outputFiles?.[0];
  if (!output) {
    throw new Error(`[Vis Preview Assets] esbuild produced no output for ${slug}`);
  }
  return output.text;
}

function buildPreviewHtml(): string {
  const theme = getThemeTokens(false);
  const cssVars = CONTENT_DOMAINS.map((domain) => {
    const meta = DOMAIN_METADATA[domain];
    return `${meta.cssVar}: ${meta.colors.dark};`;
  }).join('\n      ');

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <style>
    :root {
      ${cssVars}
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: ${VIEWPORT_WIDTH}px;
      height: ${VIEWPORT_HEIGHT}px;
      overflow: hidden;
      background-color: ${theme.canvasBg};
      color: ${theme.textHeading};
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #canvas {
      position: relative;
      width: ${VIEWPORT_WIDTH}px;
      height: ${VIEWPORT_HEIGHT}px;
      overflow: hidden;
      background-color: ${theme.canvasBg};
    }
  </style>
</head>
<body>
  <div id="canvas"></div>
</body>
</html>`;
}

let inFlightPromise: Promise<VisPreviewAssetsResult> | null = null;

async function runGeneration(
  inputHash: string,
  options?: EnsureVisPreviewAssetsOptions
): Promise<VisPreviewAssetsResult> {
  const verbose = Boolean(options?.verbose);
  fs.mkdirSync(VIS_PREVIEW_CACHE_DIR, { recursive: true });

  const [{ getCanonicalGraphPayloadArtifact }, { getGraphLayoutBundle }] = await Promise.all([
    import('@commons/server/graph-payload-endpoint'),
    import('@commons/server/graph-layout-endpoint'),
  ]);
  const payloadArtifact = await getCanonicalGraphPayloadArtifact();
  const html = buildPreviewHtml();

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });

  try {
    for (const slug of VIS_PREVIEW_ENGINES) {
      if (verbose) {
        console.log(`[Vis Preview Assets] Rendering ${slug} (${VIEWPORT_WIDTH}x${VIEWPORT_HEIGHT})...`);
      }

      const [bundledJs, layoutBundle] = await Promise.all([
        bundleEngineScript(slug),
        getGraphLayoutBundle(slug),
      ]);

      const targetK = getDefaultTopicClusterCount(slug);
      const effectiveCanonical =
        targetK !== DEFAULT_TOPIC_CLUSTER_COUNT
          ? reclusterCanonicalGraphPayload(payloadArtifact.payload, targetK)
          : payloadArtifact.payload;
      const hydratedPayload = hydrateEnginePayloads(effectiveCanonical, layoutBundle.payload.positions);

      const page = await browser.newPage();
      try {
        await page.setViewport({
          width: VIEWPORT_WIDTH,
          height: VIEWPORT_HEIGHT,
          deviceScaleFactor: 1,
        });

        await page.setContent(html, { waitUntil: 'domcontentloaded' });
        await page.addScriptTag({ content: bundledJs });

        await page.evaluate(
          async (payloadData: EnginePayloads) => {
            const container = document.getElementById('canvas');
            if (!container) {
              throw new Error('Missing #canvas container');
            }
            interface PreviewEngineApi {
              layouts: Array<{ id: string; label: string }>;
              init: (
                container: HTMLElement,
                payload: EnginePayloads,
                layout: string,
                isLight: boolean,
                extraOptions?: Record<string, string>
              ) => Promise<{ destroy?: () => void }>;
            }
            const win = window as Window & { __VIS_ENGINE__?: PreviewEngineApi };
            const engine = win.__VIS_ENGINE__;
            if (!engine) {
              throw new Error('__VIS_ENGINE__ not found on window');
            }
            const defaultLayout = engine.layouts?.[0]?.id || 'force';
            await engine.init(container, payloadData, defaultLayout, false, {
              utmSource: 'preview_capture',
              utmMedium: 'build',
              utmCampaign: 'vis_preview',
            });

            // Wait for initial render frames & camera/viewport fit to settle
            await new Promise<void>((resolve) => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  setTimeout(resolve, 1500);
                });
              });
            });
          },
          hydratedPayload
        );

        const cachedPath = path.join(VIS_PREVIEW_CACHE_DIR, `${slug}.png`);
        const screenshotBuffer = await page.screenshot({ type: 'png' });
        fs.writeFileSync(cachedPath, screenshotBuffer);

        if (verbose) {
          console.log(`[Vis Preview Assets] Saved ${cachedPath} (${screenshotBuffer.length} bytes)`);
        }
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(
    MANIFEST_PATH,
    JSON.stringify({ inputHash, generatedAt: new Date().toISOString() }, null, 2) + '\n',
    'utf8'
  );

  const previews = buildPreviewResultFromCache(options?.outDir);
  return {
    previews,
    cacheHit: false,
  };
}

export async function ensureVisPreviewAssets(
  options?: EnsureVisPreviewAssetsOptions
): Promise<VisPreviewAssetsResult> {
  const force = Boolean(options?.force);
  const { getCanonicalGraphPayloadArtifact } = await import('@commons/server/graph-payload-endpoint');
  const payloadArtifact = await getCanonicalGraphPayloadArtifact();
  const inputHash = computeVisPreviewInputHash(payloadArtifact.hash);

  if (!force && allCachedPreviewsExist() && fs.existsSync(MANIFEST_PATH)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as { inputHash?: string };
      if (manifest.inputHash === inputHash) {
        const previews = buildPreviewResultFromCache(options?.outDir);
        return {
          previews,
          cacheHit: true,
        };
      }
    } catch {
      // Fall through to regenerate on corrupt manifest
    }
  }

  if (inFlightPromise && !force) {
    return inFlightPromise;
  }

  inFlightPromise = runGeneration(inputHash, options).finally(() => {
    inFlightPromise = null;
  });

  return inFlightPromise;
}
