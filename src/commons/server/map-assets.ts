import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { getFileContentHash, getHashedFilename } from '@commons/server/content-hash';

export const MAP_CACHE_DIR = path.resolve('.cache/maps');
const TILES_CACHE_DIR = path.join(MAP_CACHE_DIR, 'tiles');
const MANIFEST_PATH = path.join(MAP_CACHE_DIR, '.manifest.json');

export interface MapLocationConfig {
  id: string;
  name: string;
  lat: number;
  lon: number;
  zoom: number;
  lightFileName: string;
  darkFileName: string;
}

export const MAP_LOCATIONS: Record<'wels' | 'gruenau', MapLocationConfig> = {
  wels: {
    id: 'campus-wels',
    name: 'FH OÖ Campus Wels, Bauteil A (Stelzhamerstraße 23)',
    lat: 48.1614265,
    lon: 14.0277939,
    zoom: 18,
    lightFileName: 'campus-wels-light.png',
    darkFileName: 'campus-wels-dark.png',
  },
  gruenau: {
    id: 'headquarters-gruenau',
    name: 'Business Headquarters (Edthof 13a, Grünau im Almtal)',
    lat: 47.8587572,
    lon: 13.9640378,
    zoom: 18,
    lightFileName: 'headquarters-gruenau-light.png',
    darkFileName: 'headquarters-gruenau-dark.png',
  },
};

export interface MapAssetsResult {
  welsMapLightSrc: string;
  welsMapDarkSrc: string;
  gruenauMapLightSrc: string;
  gruenauMapDarkSrc: string;
  welsMapSrc: string;
  gruenauMapSrc: string;
  width: number;
  height: number;
  cacheHit: boolean;
}

export interface EnsureMapAssetsOptions {
  force?: boolean;
  verbose?: boolean;
  outDir?: string;
}

const TARGET_WIDTH = 560;
const TARGET_HEIGHT = 280;
const USER_AGENT = 'HackenbergTech-StaticMapBuilder/1.0 (georg.hackenberg@fh-wels.at)';

function latLonToTile(lat: number, lon: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );

  const exactX = ((lon + 180) / 360) * n;
  const exactY =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const pixelOffsetX = (exactX - x) * 256;
  const pixelOffsetY = (exactY - y) * 256;

  return { x, y, pixelOffsetX, pixelOffsetY };
}

function computeMapInputHash(): string {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(MAP_LOCATIONS));
  hash.update(`dimensions:${TARGET_WIDTH}x${TARGET_HEIGHT}:v5_560x280_constant_font_scale`);
  return hash.digest('hex');
}

async function fetchTile(z: number, x: number, y: number): Promise<Buffer> {
  fs.mkdirSync(TILES_CACHE_DIR, { recursive: true });
  const tileFilePath = path.join(TILES_CACHE_DIR, `${z}_${x}_${y}.png`);

  if (fs.existsSync(tileFilePath)) {
    return fs.readFileSync(tileFilePath);
  }

  const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} fetching tile ${url}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(tileFilePath, buffer);
    return buffer;
  } catch {
    // Return a neutral fallback tile on failure so build doesn't crash
    const neutralSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
      <rect width="256" height="256" fill="rgb(30, 41, 59)"/>
      <path d="M0 0 L256 256 M256 0 L0 256" stroke="rgb(51, 65, 85)" stroke-width="1"/>
    </svg>`;
    return await sharp(Buffer.from(neutralSvg)).png().toBuffer();
  }
}

async function generateLocationMap(location: MapLocationConfig, verbose = false): Promise<{ light: Buffer; dark: Buffer }> {
  const { lat, lon, zoom } = location;
  const centerTile = latLonToTile(lat, lon, zoom);

  // We use a 5-wide by 3-high tile grid around the center tile (15 tiles total = 1280x768 canvas)
  const cols = 5;
  const rows = 3;
  const centerCol = 2; // index 2 in [0, 1, 2, 3, 4]
  const centerRow = 1; // index 1 in [0, 1, 2]

  const compositeInputs: Array<{ input: Buffer; left: number; top: number }> = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tileX = centerTile.x + (c - centerCol);
      const tileY = centerTile.y + (r - centerRow);
      const tileBuffer = await fetchTile(zoom, tileX, tileY);
      compositeInputs.push({
        input: tileBuffer,
        left: c * 256,
        top: r * 256,
      });
    }
  }

  // Stitched 1280x768 base image
  const stitched = await sharp({
    create: {
      width: cols * 256,
      height: rows * 256,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 },
    },
  })
    .composite(compositeInputs)
    .png()
    .toBuffer();

  // Exact center coordinate in stitched canvas
  const centerX = centerCol * 256 + centerTile.pixelOffsetX;
  const centerY = centerRow * 256 + centerTile.pixelOffsetY;

  // Crop box around exact center coordinate
  const cropLeft = Math.max(0, Math.min(cols * 256 - TARGET_WIDTH, Math.round(centerX - TARGET_WIDTH / 2)));
  const cropTop = Math.max(0, Math.min(rows * 256 - TARGET_HEIGHT, Math.round(centerY - TARGET_HEIGHT / 2)));

  // Light theme map (natural OpenStreetMap high contrast)
  const light = await sharp(stitched)
    .extract({
      left: cropLeft,
      top: cropTop,
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  // Dark theme map (inverted and hue-rotated 180 to preserve natural water/foliage hues in slate-dark mode)
  const dark = await sharp(light)
    .negate({ alpha: false })
    .modulate({
      hue: 180,
      brightness: 0.72,
      saturation: 0.85,
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  if (verbose) {
    console.log(`[Map Assets] Successfully generated light & dark maps for ${location.name} (${TARGET_WIDTH}x${TARGET_HEIGHT} at zoom ${zoom})`);
  }

  return { light, dark };
}

export function syncMapsToDist(files: Array<{ cachedPath: string; fileName: string }>, targetDistDir?: string) {
  const distDir = targetDistDir || path.resolve('dist');
  if (fs.existsSync(distDir)) {
    const destDir = path.join(distDir, 'assets', 'maps');
    fs.mkdirSync(destDir, { recursive: true });
    for (const file of files) {
      fs.copyFileSync(file.cachedPath, path.join(destDir, file.fileName));
    }
  }
}

let inFlightPromise: Promise<MapAssetsResult> | null = null;

export async function ensureMapAssets(options?: EnsureMapAssetsOptions): Promise<MapAssetsResult> {
  const force = Boolean(options?.force);
  const verbose = Boolean(options?.verbose);
  const inputHash = computeMapInputHash();

  const welsLightCachedPath = path.join(MAP_CACHE_DIR, MAP_LOCATIONS.wels.lightFileName);
  const welsDarkCachedPath = path.join(MAP_CACHE_DIR, MAP_LOCATIONS.wels.darkFileName);
  const gruenauLightCachedPath = path.join(MAP_CACHE_DIR, MAP_LOCATIONS.gruenau.lightFileName);
  const gruenauDarkCachedPath = path.join(MAP_CACHE_DIR, MAP_LOCATIONS.gruenau.darkFileName);

  const allCachedExist =
    fs.existsSync(welsLightCachedPath) &&
    fs.existsSync(welsDarkCachedPath) &&
    fs.existsSync(gruenauLightCachedPath) &&
    fs.existsSync(gruenauDarkCachedPath);

  if (!force && allCachedExist && fs.existsSync(MANIFEST_PATH)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as { inputHash?: string };
      if (manifest.inputHash === inputHash) {
        const welsLightHash = getFileContentHash(welsLightCachedPath);
        const welsDarkHash = getFileContentHash(welsDarkCachedPath);
        const gruenauLightHash = getFileContentHash(gruenauLightCachedPath);
        const gruenauDarkHash = getFileContentHash(gruenauDarkCachedPath);

        const welsLightFileName = getHashedFilename(MAP_LOCATIONS.wels.lightFileName, welsLightHash);
        const welsDarkFileName = getHashedFilename(MAP_LOCATIONS.wels.darkFileName, welsDarkHash);
        const gruenauLightFileName = getHashedFilename(MAP_LOCATIONS.gruenau.lightFileName, gruenauLightHash);
        const gruenauDarkFileName = getHashedFilename(MAP_LOCATIONS.gruenau.darkFileName, gruenauDarkHash);

        syncMapsToDist([
          { cachedPath: welsLightCachedPath, fileName: welsLightFileName },
          { cachedPath: welsDarkCachedPath, fileName: welsDarkFileName },
          { cachedPath: gruenauLightCachedPath, fileName: gruenauLightFileName },
          { cachedPath: gruenauDarkCachedPath, fileName: gruenauDarkFileName },
        ], options?.outDir);

        return {
          welsMapLightSrc: `/assets/maps/${welsLightFileName}`,
          welsMapDarkSrc: `/assets/maps/${welsDarkFileName}`,
          gruenauMapLightSrc: `/assets/maps/${gruenauLightFileName}`,
          gruenauMapDarkSrc: `/assets/maps/${gruenauDarkFileName}`,
          welsMapSrc: `/assets/maps/${welsDarkFileName}`,
          gruenauMapSrc: `/assets/maps/${gruenauDarkFileName}`,
          width: TARGET_WIDTH,
          height: TARGET_HEIGHT,
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

  const run = async (): Promise<MapAssetsResult> => {
    fs.mkdirSync(MAP_CACHE_DIR, { recursive: true });

    const [welsBuffers, gruenauBuffers] = await Promise.all([
      generateLocationMap(MAP_LOCATIONS.wels, verbose),
      generateLocationMap(MAP_LOCATIONS.gruenau, verbose),
    ]);

    fs.writeFileSync(welsLightCachedPath, welsBuffers.light);
    fs.writeFileSync(welsDarkCachedPath, welsBuffers.dark);
    fs.writeFileSync(gruenauLightCachedPath, gruenauBuffers.light);
    fs.writeFileSync(gruenauDarkCachedPath, gruenauBuffers.dark);

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ inputHash, generatedAt: new Date().toISOString() }, null, 2) + '\n', 'utf8');

    const welsLightHash = getFileContentHash(welsLightCachedPath);
    const welsDarkHash = getFileContentHash(welsDarkCachedPath);
    const gruenauLightHash = getFileContentHash(gruenauLightCachedPath);
    const gruenauDarkHash = getFileContentHash(gruenauDarkCachedPath);

    const welsLightFileName = getHashedFilename(MAP_LOCATIONS.wels.lightFileName, welsLightHash);
    const welsDarkFileName = getHashedFilename(MAP_LOCATIONS.wels.darkFileName, welsDarkHash);
    const gruenauLightFileName = getHashedFilename(MAP_LOCATIONS.gruenau.lightFileName, gruenauLightHash);
    const gruenauDarkFileName = getHashedFilename(MAP_LOCATIONS.gruenau.darkFileName, gruenauDarkHash);

    syncMapsToDist([
      { cachedPath: welsLightCachedPath, fileName: welsLightFileName },
      { cachedPath: welsDarkCachedPath, fileName: welsDarkFileName },
      { cachedPath: gruenauLightCachedPath, fileName: gruenauLightFileName },
      { cachedPath: gruenauDarkCachedPath, fileName: gruenauDarkFileName },
    ], options?.outDir);

    return {
      welsMapLightSrc: `/assets/maps/${welsLightFileName}`,
      welsMapDarkSrc: `/assets/maps/${welsDarkFileName}`,
      gruenauMapLightSrc: `/assets/maps/${gruenauLightFileName}`,
      gruenauMapDarkSrc: `/assets/maps/${gruenauDarkFileName}`,
      welsMapSrc: `/assets/maps/${welsDarkFileName}`,
      gruenauMapSrc: `/assets/maps/${gruenauDarkFileName}`,
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      cacheHit: false,
    };
  };

  inFlightPromise = run().finally(() => {
    inFlightPromise = null;
  });

  return inFlightPromise;
}
