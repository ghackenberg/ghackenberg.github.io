/**
 * Model Cache & Storage Quota Management.
 *
 * Manages Cache API and OPFS persistence for client-side Transformers.js models,
 * checking cached status for Qwen2.5 models, monitoring storage quotas,
 * and enabling targeted cache invalidation and purging.
 */

import {
  DEFAULT_MODEL_ID,
  SUPPORTED_MODELS,
  type StorageEstimateInfo,
} from './types.ts';

const TRANSFORMERS_CACHE_NAME = 'transformers-cache';

/**
 * Checks whether the current runtime environment supports Cache API.
 */
export function isCacheApiSupported(): boolean {
  return typeof window !== 'undefined' && 'caches' in window;
}

/**
 * Checks whether the current runtime environment supports StorageManager estimate.
 */
export function isStorageEstimateSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    typeof navigator.storage.estimate === 'function'
  );
}

/**
 * Retrieves storage quota and usage information from the browser.
 */
export async function getStorageQuota(): Promise<StorageEstimateInfo> {
  if (!isStorageEstimateSupported()) {
    return {
      quota: 0,
      usage: 0,
      percentUsed: 0,
      available: 0,
    };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const quota = estimate.quota ?? 0;
    const usage = estimate.usage ?? 0;
    const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;
    const available = Math.max(0, quota - usage);

    return {
      quota,
      usage,
      percentUsed: Math.round(percentUsed * 100) / 100,
      available,
    };
  } catch (err) {
    console.warn('[ModelCache] Failed to estimate storage quota:', err);
    return {
      quota: 0,
      usage: 0,
      percentUsed: 0,
      available: 0,
    };
  }
}

/**
 * Normalizes a model identifier for matching against cache URLs.
 */
function normalizeModelId(modelId: string): string {
  return modelId.replace(/^https?:\/\/[^/]+\//, '').toLowerCase();
}

/**
 * Checks if a specific model (or default Qwen2.5) has key weights cached.
 */
export async function isModelCached(
  modelId: string = DEFAULT_MODEL_ID
): Promise<boolean> {
  if (!isCacheApiSupported()) {
    return false;
  }

  try {
    const cache = await caches.open(TRANSFORMERS_CACHE_NAME);
    const requests = await cache.keys();
    const normalizedTarget = normalizeModelId(modelId);

    // Look for essential artifacts: onnx model files and tokenizer
    let hasModelOnnx = false;
    let hasTokenizer = false;

    for (const req of requests) {
      const url = req.url.toLowerCase();
      if (url.includes(normalizedTarget)) {
        if (url.endsWith('.onnx') || url.includes('.onnx?') || url.includes('onnx/')) {
          hasModelOnnx = true;
        }
        if (url.includes('tokenizer.json') || url.includes('vocab.json')) {
          hasTokenizer = true;
        }
      }
    }

    return hasModelOnnx && hasTokenizer;
  } catch (err) {
    console.warn(`[ModelCache] Error checking cache for ${modelId}:`, err);
    return false;
  }
}

/**
 * Returns a list of supported model IDs currently cached in the browser.
 */
export async function getCachedModelIds(): Promise<string[]> {
  if (!isCacheApiSupported()) {
    return [];
  }

  const cached: string[] = [];
  const modelKeys = Object.values(SUPPORTED_MODELS).map((m) => m.id);

  for (const id of modelKeys) {
    if (await isModelCached(id)) {
      cached.push(id);
    }
  }

  return cached;
}

/**
 * Calculates the total byte size consumed in cache for a given model or all models.
 */
export async function getModelCacheSize(modelId?: string): Promise<number> {
  if (!isCacheApiSupported()) {
    return 0;
  }

  try {
    const cache = await caches.open(TRANSFORMERS_CACHE_NAME);
    const requests = await cache.keys();
    const normalizedTarget = modelId ? normalizeModelId(modelId) : null;
    let totalBytes = 0;

    for (const req of requests) {
      if (!normalizedTarget || req.url.toLowerCase().includes(normalizedTarget)) {
        const res = await cache.match(req);
        if (res) {
          const contentLength = res.headers.get('content-length');
          if (contentLength) {
            totalBytes += parseInt(contentLength, 10) || 0;
          }
        }
      }
    }

    return totalBytes;
  } catch (err) {
    console.warn('[ModelCache] Failed to compute cache size:', err);
    return 0;
  }
}

/**
 * Purges cached model files from Cache API.
 * If modelId is specified, only entries matching that model are deleted.
 * If omitted, the entire transformers-cache is cleared.
 */
export async function purgeModelCache(modelId?: string): Promise<boolean> {
  if (!isCacheApiSupported()) {
    return false;
  }

  try {
    if (!modelId) {
      // Clear entire transformers cache
      return await caches.delete(TRANSFORMERS_CACHE_NAME);
    }

    const cache = await caches.open(TRANSFORMERS_CACHE_NAME);
    const requests = await cache.keys();
    const normalizedTarget = normalizeModelId(modelId);
    let deletedCount = 0;

    for (const req of requests) {
      if (req.url.toLowerCase().includes(normalizedTarget)) {
        const success = await cache.delete(req);
        if (success) {
          deletedCount++;
        }
      }
    }

    return deletedCount > 0;
  } catch (err) {
    console.warn(`[ModelCache] Failed to purge cache for ${modelId ?? 'all'}:`, err);
    return false;
  }
}
