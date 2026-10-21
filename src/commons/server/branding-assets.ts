import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import puppeteer from 'puppeteer';

export const BRANDING_CACHE_DIR = path.resolve('.cache/branding');

export const PUBLIC_ICON_FILES = [
  'favicon.svg',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'apple-touch-icon.png',
  'icon-192x192.png',
  'icon-512x512.png',
  'icon-512x512-maskable.png',
] as const;

export interface BrandingAssetsResult {
  cacheDir: string;
  ogImagePath: string;
  iconFiles: readonly string[];
  cacheHit: boolean;
}

export interface EnsureBrandingAssetsOptions {
  force?: boolean;
  verbose?: boolean;
}

const MANIFEST_PATH = path.join(BRANDING_CACHE_DIR, '.manifest.json');
const OG_ASTRO_PATH = path.resolve('src/pages/_internal/og.astro');
const ICON_ASTRO_PATH = path.resolve('src/pages/_internal/icon.astro');
const SELF_PATH = path.resolve('src/commons/server/branding-assets.ts');

const FONT_ROUTES: Record<string, string> = {
  '/fonts/outfit-700.woff2': path.resolve('node_modules/@fontsource/outfit/files/outfit-latin-700-normal.woff2'),
  '/fonts/outfit-800.woff2': path.resolve('node_modules/@fontsource/outfit/files/outfit-latin-800-normal.woff2'),
  '/fonts/inter-400.woff2': path.resolve('node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2'),
};

const FONT_FACE_CSS = `
  @font-face {
    font-family: 'Outfit';
    font-style: normal;
    font-display: block;
    font-weight: 700;
    src: url('/fonts/outfit-700.woff2') format('woff2');
  }
  @font-face {
    font-family: 'Outfit';
    font-style: normal;
    font-display: block;
    font-weight: 800;
    src: url('/fonts/outfit-800.woff2') format('woff2');
  }
  @font-face {
    font-family: 'Inter';
    font-style: normal;
    font-display: block;
    font-weight: 400;
    src: url('/fonts/inter-400.woff2') format('woff2');
  }
`;

let inFlightPromise: Promise<BrandingAssetsResult> | null = null;

export function computeBrandingInputHash(): string {
  const hash = crypto.createHash('sha256');
  for (const file of [OG_ASTRO_PATH, ICON_ASTRO_PATH, SELF_PATH]) {
    if (fs.existsSync(file)) {
      hash.update(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
    }
  }
  return hash.digest('hex');
}

function allCachedAssetsExist(): boolean {
  if (!fs.existsSync(path.join(BRANDING_CACHE_DIR, 'og-share-preview.png'))) {
    return false;
  }
  for (const iconFile of PUBLIC_ICON_FILES) {
    if (!fs.existsSync(path.join(BRANDING_CACHE_DIR, iconFile))) {
      return false;
    }
  }
  return true;
}

function generateDeterministicStarsSvgMarkup(starFill: string): string {
  let seed = 42;
  const random = (): number => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const parts: string[] = [];
  const numStars = 140;
  for (let i = 0; i < numStars; i++) {
    const x = random() * 1200;
    const y = random() * 630;
    const opacity = random() * 0.45 + 0.35;
    const isHero = i % 14 === 0;

    if (isHero) {
      const size = random() * 4.5 + 4;
      const heroOpacity = random() * 0.3 + 0.55;
      const s = size.toFixed(1);
      parts.push(
        `<g transform="translate(${x.toFixed(1)}, ${y.toFixed(1)})"><path d="M 0 -${s} Q 0 0 ${s} 0 Q 0 0 0 ${s} Q 0 0 -${s} 0 Q 0 0 0 -${s} Z" fill="${starFill}" opacity="${heroOpacity.toFixed(2)}" /></g>`
      );
    } else {
      const r = random() * 0.8 + 0.5;
      parts.push(
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${starFill}" opacity="${opacity.toFixed(2)}" />`
      );
    }
  }
  return parts.join('\n        ');
}

function renderOgTemplateHtml(): string {
  const raw = fs.readFileSync(OG_ASTRO_PATH, 'utf8');
  const starFillMatch = raw.match(/fill="(#[0-9a-fA-F]{6})"/);
  const starFill = starFillMatch ? starFillMatch[1] : 'currentColor';
  const withoutFrontmatter = raw.replace(/^---[\s\S]*?---\s*/, '');
  const withFonts = withoutFrontmatter.replace('<style>', `<style>${FONT_FACE_CSS}`);
  const starsMarkup = generateDeterministicStarsSvgMarkup(starFill);
  return withFonts.replace(
    /<svg class="stars-svg"([^>]*)>[\s\S]*?<\/svg>/,
    `<svg class="stars-svg"$1>\n        ${starsMarkup}\n      </svg>`
  );
}

function renderIconTemplateHtml(): string {
  const raw = fs.readFileSync(ICON_ASTRO_PATH, 'utf8');
  const withoutFrontmatter = raw.replace(/^---[\s\S]*?---\s*/, '');
  const withFonts = withoutFrontmatter.replace('<style>', `<style>${FONT_FACE_CSS}`);
  return withFonts
    .replace('class={`icon-wrapper mode-${mode}`}', 'class="icon-wrapper mode-transparent"')
    .replace('<script is:inline>', '<script>');
}

function renderStandaloneFaviconSvg(): string {
  const raw = fs.readFileSync(ICON_ASTRO_PATH, 'utf8');
  const svgMatch = raw.match(/<svg[\s\S]*?<\/svg>/);
  if (!svgMatch) {
    throw new Error('Could not extract <svg> template from src/pages/_internal/icon.astro');
  }

  const outfit800Path = FONT_ROUTES['/fonts/outfit-800.woff2'];
  const outfit800Base64 = fs.readFileSync(outfit800Path).toString('base64');
  const inlineFontFace = `@font-face {
      font-family: 'Outfit';
      font-style: normal;
      font-weight: 800;
      src: url('data:font/woff2;base64,${outfit800Base64}') format('woff2');
    }`;

  let svg = svgMatch[0]
    .replace(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">'
    )
    .replace(
      /<style>[\s\S]*?<\/style>/,
      `<style>
      ${inlineFontFace}
      .text-logo {
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-weight: 800;
        font-size: 78px;
        letter-spacing: -3px;
        fill: url(#gh-gradient);
      }
    </style>`
    );

  // Dedent 6 leading spaces from icon.astro indentation
  svg = svg
    .split(/\r?\n/)
    .map((line) => (line.startsWith('      ') ? line.slice(6) : line))
    .join('\n');

  return svg + '\n';
}

function safeWriteIfChanged(destPath: string, buffer: Buffer): boolean {
  if (fs.existsSync(destPath)) {
    const existing = fs.readFileSync(destPath);
    if (existing.equals(buffer)) {
      return false;
    }
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buffer);
  return true;
}

async function runGeneration(
  inputHash: string,
  options?: EnsureBrandingAssetsOptions
): Promise<BrandingAssetsResult> {
  const verbose = Boolean(options?.verbose);
  const ogHtml = renderOgTemplateHtml();
  const iconHtml = renderIconTemplateHtml();
  const faviconSvg = renderStandaloneFaviconSvg();

  const faviconSvgPath = path.join(BRANDING_CACHE_DIR, 'favicon.svg');
  const svgChanged = safeWriteIfChanged(faviconSvgPath, Buffer.from(faviconSvg, 'utf8'));
  if (verbose) {
    console.log(`[Branding Assets] ${svgChanged ? 'Generated' : 'Unchanged'}: favicon.svg (128x128)`);
  }

  const server = http.createServer((req, res) => {
    const urlPath = (req.url || '/').split('?')[0];
    if (urlPath === '/_internal/og/' || urlPath === '/_internal/og') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(ogHtml);
      return;
    }
    if (urlPath === '/_internal/icon/' || urlPath === '/_internal/icon') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(iconHtml);
      return;
    }
    const fontFile = FONT_ROUTES[urlPath];
    if (fontFile && fs.existsSync(fontFile)) {
      res.writeHead(200, { 'Content-Type': 'font/woff2' });
      res.end(fs.readFileSync(fontFile));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const port = address.port;

  try {
    const browser = await puppeteer.launch({
      headless: 'shell',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const capture = async (
        urlPath: string,
        width: number,
        height: number,
        filename: string
      ): Promise<void> => {
        const page = await browser.newPage();
        await page.setViewport({ width, height, deviceScaleFactor: 1 });

        await page.evaluateOnNewDocument(() => {
          const style = document.createElement('style');
          style.innerHTML = 'html, body { background: transparent !important; }';
          document.head.appendChild(style);
        });

        const fullUrl = `http://127.0.0.1:${port}${urlPath}`;
        await page.goto(fullUrl, { waitUntil: 'networkidle0' });
        await page.evaluateHandle(() => document.fonts.ready);

        const buffer = (await page.screenshot({ omitBackground: true })) as Buffer;
        await page.close();

        const destPath = path.join(BRANDING_CACHE_DIR, filename);
        const changed = safeWriteIfChanged(destPath, buffer);
        if (verbose) {
          const status = changed ? 'Generated' : 'Unchanged';
          console.log(`[Branding Assets] ${status}: ${filename} (${width}x${height})`);
        }
      };

      await capture('/_internal/icon/?mode=transparent', 16, 16, 'favicon-16x16.png');
      await capture('/_internal/icon/?mode=transparent', 32, 32, 'favicon-32x32.png');
      await capture('/_internal/icon/?mode=app', 180, 180, 'apple-touch-icon.png');
      await capture('/_internal/icon/?mode=app', 192, 192, 'icon-192x192.png');
      await capture('/_internal/icon/?mode=app', 512, 512, 'icon-512x512.png');
      await capture('/_internal/icon/?mode=maskable', 512, 512, 'icon-512x512-maskable.png');
      await capture('/_internal/og/', 1200, 630, 'og-share-preview.png');
    } finally {
      await browser.close();
    }

    fs.mkdirSync(BRANDING_CACHE_DIR, { recursive: true });
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ inputHash }, null, 2) + '\n', 'utf8');

    return {
      cacheDir: BRANDING_CACHE_DIR,
      ogImagePath: path.join(BRANDING_CACHE_DIR, 'og-share-preview.png'),
      iconFiles: PUBLIC_ICON_FILES,
      cacheHit: false,
    };
  } finally {
    server.close();
  }
}

export async function ensureBrandingAssets(
  options?: EnsureBrandingAssetsOptions
): Promise<BrandingAssetsResult> {
  const force = Boolean(options?.force);
  const inputHash = computeBrandingInputHash();

  if (!force && allCachedAssetsExist() && fs.existsSync(MANIFEST_PATH)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as { inputHash?: string };
      if (manifest.inputHash === inputHash) {
        return {
          cacheDir: BRANDING_CACHE_DIR,
          ogImagePath: path.join(BRANDING_CACHE_DIR, 'og-share-preview.png'),
          iconFiles: PUBLIC_ICON_FILES,
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

  const promise = runGeneration(inputHash, options).finally(() => {
    inFlightPromise = null;
  });
  inFlightPromise = promise;
  return promise;
}
