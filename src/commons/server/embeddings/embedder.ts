import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline, type FeatureExtractionPipeline, type Tensor } from '@huggingface/transformers';
import { getFileContentHash } from '@commons/server/content-hash.ts';
import type { SearchChunk } from './types.ts';

const MODEL_ID = 'Xenova/multilingual-e5-small';
const EMBEDDING_DIM = 384;
const BATCH_SIZE = 16;
const CACHE_DIR = path.resolve(process.cwd(), '.cache/embeddings');
const CACHE_FILE = path.join(CACHE_DIR, 'vectors-cache.json');

/**
 * Computes a unique cache key for a chunk based on its source file hash, chunk ID, and passage text.
 */
function getChunkCacheKey(chunk: SearchChunk): string {
  let fileHash = 'nofile';
  if (chunk.metadata.sourceFile && fs.existsSync(chunk.metadata.sourceFile)) {
    try {
      fileHash = getFileContentHash(chunk.metadata.sourceFile, 16);
    } catch {
      fileHash = 'error';
    }
  }

  return crypto
    .createHash('sha256')
    .update(`${fileHash}:${chunk.id}:${chunk.text}`)
    .digest('hex');
}

/**
 * Loads the persistent embedding cache from disk.
 */
function loadEmbeddingsCache(): Record<string, number[]> {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  if (fs.existsSync(CACHE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    } catch {
      return {};
    }
  }

  return {};
}

/**
 * Saves the persistent embedding cache to disk.
 */
function saveEmbeddingsCache(cache: Record<string, number[]>): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf-8');
  } catch (err) {
    console.error('Failed to save embeddings cache:', err);
  }
}

/**
 * Embeds an array of SearchChunk objects using multilingual-e5-small (passage: prefix).
 * Uses incremental caching in .cache/embeddings/ via content-hash.ts.
 */
export async function embedChunks(
  chunks: SearchChunk[],
  options: { onProgress?: (completed: number, total: number) => void } = {}
): Promise<{ embeddings: number[][]; cachedCount: number; computedCount: number }> {
  const cache = loadEmbeddingsCache();
  const keys = chunks.map(chunk => getChunkCacheKey(chunk));

  const toComputeIndices: number[] = [];
  const embeddings: (number[] | null)[] = new Array(chunks.length).fill(null);

  let cachedCount = 0;
  for (let i = 0; i < chunks.length; i++) {
    const key = keys[i];
    const cachedVector = cache[key];
    if (cachedVector && cachedVector.length === EMBEDDING_DIM) {
      embeddings[i] = cachedVector;
      cachedCount++;
    } else {
      toComputeIndices.push(i);
    }
  }

  const computedCount = toComputeIndices.length;

  if (computedCount === 0) {
    console.log(`[Embedder] ⚡ 100% cache hit: loaded all ${chunks.length} embeddings from .cache/embeddings/. Skipping inference.`);
    return {
      embeddings: embeddings as number[][],
      cachedCount,
      computedCount: 0,
    };
  }

  console.log(`[Embedder] Loading ${MODEL_ID}... (${cachedCount} cached, ${computedCount} to compute)`);
  const extractor = (await pipeline('feature-extraction', MODEL_ID)) as FeatureExtractionPipeline;

  let completedBatches = 0;
  const totalBatches = Math.ceil(computedCount / BATCH_SIZE);

  for (let b = 0; b < computedCount; b += BATCH_SIZE) {
    const batchIndices = toComputeIndices.slice(b, b + BATCH_SIZE);
    const batchPassages = batchIndices.map(idx => `passage: ${chunks[idx].text}`);

    const output = (await extractor(batchPassages, {
      pooling: 'mean',
      normalize: true,
    })) as Tensor;

    const flatData = output.data as Float32Array;

    for (let i = 0; i < batchIndices.length; i++) {
      const chunkIdx = batchIndices[i];
      const key = keys[chunkIdx];
      const vector = Array.from(flatData.subarray(i * EMBEDDING_DIM, (i + 1) * EMBEDDING_DIM));

      embeddings[chunkIdx] = vector;
      cache[key] = vector;
    }

    completedBatches++;
    if (options.onProgress) {
      options.onProgress(Math.min(b + BATCH_SIZE, computedCount), computedCount);
    } else {
      process.stdout.write(`\r[Embedder] Progress: Batch ${completedBatches}/${totalBatches} (${Math.round((completedBatches / totalBatches) * 100)}%)`);
    }
  }

  process.stdout.write('\n');
  saveEmbeddingsCache(cache);

  return {
    embeddings: embeddings as number[][],
    cachedCount,
    computedCount,
  };
}
