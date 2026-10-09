import fs from 'node:fs';
import path from 'node:path';
import type { SearchChunk, BM25IndexData, SearchIndexManifest } from './types.ts';

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it', 'its',
  'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will', 'with', 'this', 'but', 'they', 'have', 'had',
  'der', 'die', 'das', 'und', 'in', 'den', 'von', 'zu', 'mit', 'ist', 'im', 'fuer', 'für', 'eine',
  'einem', 'einen', 'einer', 'dem', 'des', 'auf', 'aus', 'nicht', 'als', 'auch', 'es', 'an', 'wie',
  'wir', 'sie', 'er', 'hat', 'nach', 'bei', 'oder', 'so', 'über', 'ueber', 'ein', 'zur', 'vom', 'vor'
]);

/**
 * Tokenizes text into normalized keywords for BM25 indexing.
 */
export function tokenizeForBM25(text: string): string[] {
  if (!text) return [];
  const matches = text
    .toLowerCase()
    .replace(/[#@_.:/\\-]/g, ' ')
    .match(/[\p{L}\p{N}]+/gu);

  if (!matches) return [];

  return matches.filter(w => w.length >= 2 && !STOPWORDS.has(w));
}

/**
 * Builds a deterministic BM25 inverted index across all chunks.
 */
export function buildBM25Index(chunks: SearchChunk[], k1 = 1.5, b = 0.75): BM25IndexData {
  const totalDocs = chunks.length;
  const docLengths: number[] = new Array(totalDocs).fill(0);
  const invertedIndex: Record<string, [number, number][]> = {};

  let totalTokens = 0;

  for (let i = 0; i < totalDocs; i++) {
    const chunk = chunks[i];
    const textToTokenize = `${chunk.title} ${chunk.heading || ''} ${chunk.text}`;
    const tokens = tokenizeForBM25(textToTokenize);

    docLengths[i] = tokens.length;
    totalTokens += tokens.length;

    // Count term frequencies within this document
    const termFreqs = new Map<string, number>();
    for (const t of tokens) {
      termFreqs.set(t, (termFreqs.get(t) || 0) + 1);
    }

    // Populate inverted index
    for (const [term, freq] of termFreqs.entries()) {
      if (!invertedIndex[term]) {
        invertedIndex[term] = [];
      }
      invertedIndex[term].push([i, freq]);
    }
  }

  const avgDocLength = totalDocs > 0 ? totalTokens / totalDocs : 0;

  return {
    k1,
    b,
    avgDocLength,
    totalDocs,
    docLengths,
    invertedIndex,
  };
}

/**
 * Exports vectors.bin (Float32Array) and metadata.json (chunks + BM25 index) into public/search/.
 */
export function serializeSearchIndex(
  chunks: SearchChunk[],
  embeddings: number[][],
  outputDir = path.resolve(process.cwd(), 'public/search')
): { vectorsPath: string; metadataPath: string; totalBytes: number } {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const vectorsPath = path.join(outputDir, 'vectors.bin');
  const metadataPath = path.join(outputDir, 'metadata.json');

  const dimension = 384;
  const totalFloats = chunks.length * dimension;
  const flatVectors = new Float32Array(totalFloats);

  for (let i = 0; i < chunks.length; i++) {
    const vec = embeddings[i];
    if (vec && vec.length === dimension) {
      flatVectors.set(vec, i * dimension);
    }
  }

  const vectorsBuffer = Buffer.from(flatVectors.buffer, flatVectors.byteOffset, flatVectors.byteLength);
  fs.writeFileSync(vectorsPath, vectorsBuffer);

  const bm25 = buildBM25Index(chunks);

  const manifest: SearchIndexManifest = {
    version: 1,
    model: 'Xenova/multilingual-e5-small',
    dimension,
    generatedAt: new Date().toISOString(),
    chunkCount: chunks.length,
    chunks,
    bm25,
  };

  const metadataJson = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(metadataPath, metadataJson, 'utf-8');

  return {
    vectorsPath,
    metadataPath,
    totalBytes: vectorsBuffer.byteLength + Buffer.byteLength(metadataJson, 'utf-8'),
  };
}
