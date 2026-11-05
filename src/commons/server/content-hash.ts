import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

interface CachedHashEntry {
  mtimeMs: number;
  size: number;
  hash: string;
}

const hashCache = new Map<string, CachedHashEntry>();

/**
 * Computes an MD5 content hash for a file on disk, with mtime/size-aware in-memory caching
 * so in-place file overwrites during `astro dev` immediately invalidate the cached digest.
 *
 * @param filePath Absolute or relative path to the target file.
 * @param length Desired character length of the truncated hexadecimal hash (default: 8).
 * @returns Truncated hex hash string.
 */
export function getFileContentHash(filePath: string, length = 8): string {
  const resolvedPath = path.resolve(filePath);
  const stat = fs.statSync(resolvedPath);
  const cached = hashCache.get(resolvedPath);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.hash.slice(0, length);
  }

  const buffer = fs.readFileSync(resolvedPath);
  const fullHash = crypto.createHash('md5').update(buffer).digest('hex');
  hashCache.set(resolvedPath, {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    hash: fullHash,
  });
  return fullHash.slice(0, length);
}

/**
 * Formats a filename with a content hash suffix before the extension.
 *
 * @example getHashedFilename('01_titelfolie.webp', 'a1b2c3d4') // '01_titelfolie-a1b2c3d4.webp'
 */
export function getHashedFilename(originalFilename: string, hash: string): string {
  const ext = path.extname(originalFilename);
  const base = path.basename(originalFilename, ext);
  return `${base}-${hash}${ext}`;
}
