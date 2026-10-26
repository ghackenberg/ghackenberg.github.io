import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
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
const OUTFIT_800_WOFF_PATH = path.resolve('node_modules/@fontsource/outfit/files/outfit-latin-800-normal.woff');

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

interface GlyphPoint {
  x: number;
  y: number;
  onCurve: boolean;
}

/**
 * Zero-dependency WOFF1 TrueType glyph outline compiler.
 * Converts the <text> monogram from src/pages/_internal/icon.astro into an exact
 * SVG <path> using the Outfit 800 font tables (head, hhea, cmap, hmtx, loca, glyf).
 * This avoids embedding a 19 KB Base64 @font-face inside favicon.svg, which causes
 * synchronous FOIT (transparent/blank tab icons) in Chromium's blink::WebImage::FromData.
 */
function convertTextToOutfit800SvgPath(
  text: string,
  fontSizePx: number,
  letterSpacingPx: number,
  viewBoxWidth: number,
  viewBoxHeight: number
): string {
  const woff = fs.readFileSync(OUTFIT_800_WOFF_PATH);
  const numTables = woff.readUInt16BE(12);
  const tables: Record<string, Buffer> = {};
  for (let i = 0; i < numTables; i++) {
    const base = 44 + i * 20;
    const tag = woff.toString('ascii', base, base + 4);
    const offset = woff.readUInt32BE(base + 4);
    const compLength = woff.readUInt32BE(base + 8);
    const origLength = woff.readUInt32BE(base + 12);
    const slice = woff.subarray(offset, offset + compLength);
    tables[tag] = compLength < origLength ? zlib.inflateSync(slice) : slice;
  }

  const head = tables['head'];
  const hhea = tables['hhea'];
  const cmap = tables['cmap'];
  const hmtx = tables['hmtx'];
  const loca = tables['loca'];
  const glyf = tables['glyf'];

  const unitsPerEm = head.readUInt16BE(18);
  const indexToLocFormat = head.readInt16BE(50);
  const ascent = hhea.readInt16BE(4);
  const descent = hhea.readInt16BE(6);
  const numOfLongHorMetrics = hhea.readUInt16BE(34);

  const lookupGlyphId = (codePoint: number): number => {
    const numSubtables = cmap.readUInt16BE(2);
    for (let i = 0; i < numSubtables; i++) {
      const subOffset = cmap.readUInt32BE(4 + i * 8 + 4);
      const format = cmap.readUInt16BE(subOffset);
      if (format === 4) {
        const segCount = cmap.readUInt16BE(subOffset + 6) / 2;
        const endCodes = subOffset + 14;
        const startCodes = endCodes + segCount * 2 + 2;
        const idDeltas = startCodes + segCount * 2;
        const idRangeOffsets = idDeltas + segCount * 2;
        for (let s = 0; s < segCount; s++) {
          const end = cmap.readUInt16BE(endCodes + s * 2);
          const start = cmap.readUInt16BE(startCodes + s * 2);
          if (codePoint >= start && codePoint <= end) {
            const delta = cmap.readInt16BE(idDeltas + s * 2);
            const rangeOffset = cmap.readUInt16BE(idRangeOffsets + s * 2);
            if (rangeOffset === 0) return (codePoint + delta) & 0xffff;
            const glyphOffset = idRangeOffsets + s * 2 + rangeOffset + (codePoint - start) * 2;
            return cmap.readUInt16BE(glyphOffset);
          }
        }
      }
    }
    return 0;
  };

  const getAdvanceWidth = (gid: number): number =>
    hmtx.readUInt16BE(Math.min(gid, numOfLongHorMetrics - 1) * 4);

  const getGlyphOffset = (gid: number): number =>
    indexToLocFormat === 0 ? loca.readUInt16BE(gid * 2) * 2 : loca.readUInt32BE(gid * 4);

  const decodeGlyphContours = (gid: number): GlyphPoint[][] => {
    const off = getGlyphOffset(gid);
    const nextOff = getGlyphOffset(gid + 1);
    if (off === nextOff) return [];
    const g = glyf.subarray(off, nextOff);
    const numContours = g.readInt16BE(0);
    if (numContours <= 0) return [];

    const endPtsOfContours: number[] = [];
    for (let i = 0; i < numContours; i++) {
      endPtsOfContours.push(g.readUInt16BE(10 + i * 2));
    }
    const numPoints = endPtsOfContours[endPtsOfContours.length - 1] + 1;
    const instrLen = g.readUInt16BE(10 + numContours * 2);
    let p = 10 + numContours * 2 + 2 + instrLen;

    const flags: number[] = [];
    while (flags.length < numPoints) {
      const f = g[p++];
      flags.push(f);
      if (f & 8) {
        const repeat = g[p++];
        for (let r = 0; r < repeat; r++) flags.push(f);
      }
    }

    const xs: number[] = [];
    let x = 0;
    for (let i = 0; i < numPoints; i++) {
      const f = flags[i];
      if (f & 2) {
        const dx = g[p++];
        x += f & 16 ? dx : -dx;
      } else if (!(f & 16)) {
        x += g.readInt16BE(p);
        p += 2;
      }
      xs.push(x);
    }

    const ys: number[] = [];
    let y = 0;
    for (let i = 0; i < numPoints; i++) {
      const f = flags[i];
      if (f & 4) {
        const dy = g[p++];
        y += f & 32 ? dy : -dy;
      } else if (!(f & 32)) {
        y += g.readInt16BE(p);
        p += 2;
      }
      ys.push(y);
    }

    const contours: GlyphPoint[][] = [];
    let start = 0;
    for (const end of endPtsOfContours) {
      const pts: GlyphPoint[] = [];
      for (let i = start; i <= end; i++) {
        pts.push({ x: xs[i], y: ys[i], onCurve: Boolean(flags[i] & 1) });
      }
      contours.push(pts);
      start = end + 1;
    }
    return contours;
  };

  const contourToSvgSubpath = (pts: GlyphPoint[], scale: number, offsetX: number, baselineY: number): string => {
    const tx = (x: number): number => +(offsetX + x * scale).toFixed(2);
    const ty = (y: number): number => +(baselineY - y * scale).toFixed(2);

    const expanded: GlyphPoint[] = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const curr = pts[i];
      const next = pts[(i + 1) % n];
      expanded.push(curr);
      if (!curr.onCurve && !next.onCurve) {
        expanded.push({
          x: (curr.x + next.x) / 2,
          y: (curr.y + next.y) / 2,
          onCurve: true,
        });
      }
    }

    const startIdx = Math.max(0, expanded.findIndex((pt) => pt.onCurve));
    const ordered = [...expanded.slice(startIdx), ...expanded.slice(0, startIdx)];

    const cmds = [`M${tx(ordered[0].x)} ${ty(ordered[0].y)}`];
    let i = 1;
    while (i < ordered.length) {
      const pt = ordered[i];
      if (pt.onCurve) {
        cmds.push(`L${tx(pt.x)} ${ty(pt.y)}`);
        i++;
      } else {
        const next = ordered[(i + 1) % ordered.length];
        cmds.push(`Q${tx(pt.x)} ${ty(pt.y)} ${tx(next.x)} ${ty(next.y)}`);
        i += 2;
      }
    }
    cmds.push('Z');
    return cmds.join(' ');
  };

  const scale = fontSizePx / unitsPerEm;
  const chars = Array.from(text);
  const glyphIds = chars.map((ch) => lookupGlyphId(ch.codePointAt(0) || 0));
  const advancesPx = glyphIds.map((gid) => getAdvanceWidth(gid) * scale + letterSpacingPx);
  const totalAdvancePx = advancesPx.reduce((sum, adv) => sum + adv, 0);

  let cursorX = viewBoxWidth / 2 - totalAdvancePx / 2;
  const centralBaselineY = viewBoxHeight / 2 + ((ascent + descent) / 2) * scale;

  const subpaths: string[] = [];
  for (let i = 0; i < glyphIds.length; i++) {
    const contours = decodeGlyphContours(glyphIds[i]);
    for (const contour of contours) {
      subpaths.push(contourToSvgSubpath(contour, scale, cursorX, centralBaselineY));
    }
    cursorX += advancesPx[i];
  }

  return subpaths.join(' ');
}

function renderStandaloneFaviconSvg(): string {
  const raw = fs.readFileSync(ICON_ASTRO_PATH, 'utf8');
  const svgMatch = raw.match(/<svg[\s\S]*?<\/svg>/);
  if (!svgMatch) {
    throw new Error('Could not extract <svg> template from src/pages/_internal/icon.astro');
  }

  const viewBoxMatch = svgMatch[0].match(/viewBox="0\s+0\s+(\d+)\s+(\d+)"/);
  const viewBoxWidth = viewBoxMatch ? Number(viewBoxMatch[1]) : 128;
  const viewBoxHeight = viewBoxMatch ? Number(viewBoxMatch[2]) : 128;

  const textMatch = svgMatch[0].match(/<text[^>]*>([\s\S]*?)<\/text>/);
  const logoText = textMatch ? textMatch[1].trim() : 'GH';

  const fontSizeMatch = raw.match(/\.icon-wrapper\.mode-transparent\s+\.text-logo\s*\{[\s\S]*?font-size:\s*([-\d.]+)px/);
  const letterSpacingMatch = raw.match(/\.icon-wrapper\.mode-transparent\s+\.text-logo\s*\{[\s\S]*?letter-spacing:\s*([-\d.]+)px/);
  const fontSizePx = fontSizeMatch ? Number(fontSizeMatch[1]) : 78;
  const letterSpacingPx = letterSpacingMatch ? Number(letterSpacingMatch[1]) : -3;

  const pathData = convertTextToOutfit800SvgPath(
    logoText,
    fontSizePx,
    letterSpacingPx,
    viewBoxWidth,
    viewBoxHeight
  );

  let svg = svgMatch[0]
    .replace(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}">`,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" width="${viewBoxWidth}" height="${viewBoxHeight}">`
    )
    .replace(/\s*<style>[\s\S]*?<\/style>/, '')
    .replace(
      /<text[^>]*>[\s\S]*?<\/text>/,
      `<path fill="url(#gh-gradient)" d="${pathData}" />`
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
