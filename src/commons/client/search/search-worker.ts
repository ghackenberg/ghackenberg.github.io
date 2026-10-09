import { pipeline, type FeatureExtractionPipeline, type Tensor } from '@huggingface/transformers';
import type {
  ClientSearchIndexManifest,
  ClientSearchResult,
  WorkerInMessage,
  WorkerOutMessage,
  SearchOptions,
} from './types.ts';
import { scoreBM25, tokenizeForBM25, createSnippet } from './bm25.ts';
import { scanVectors } from './vector-scanner.ts';
import { reciprocalRankFusion } from './rrf.ts';

const MODEL_ID = 'Xenova/multilingual-e5-small';

let manifest: ClientSearchIndexManifest | null = null;
let vectors: Float32Array | null = null;
let extractor: FeatureExtractionPipeline | null = null;
let initPromise: Promise<void> | null = null;

function postWorkerMessage(message: WorkerOutMessage): void {
  self.postMessage(message);
}

async function loadPipeline(): Promise<FeatureExtractionPipeline> {
  try {
    return (await pipeline('feature-extraction', MODEL_ID, {
      device: 'webgpu',
    })) as FeatureExtractionPipeline;
  } catch {
    return (await pipeline('feature-extraction', MODEL_ID, {
      device: 'wasm',
    })) as FeatureExtractionPipeline;
  }
}

async function initialize(
  vectorsUrl = '/search/vectors.bin',
  metadataUrl = '/search/metadata.json'
): Promise<void> {
  if (manifest && vectors && extractor) {
    return;
  }

  postWorkerMessage({ type: 'status', status: 'loading', message: 'Loading search index and model...' });

  const [metaResp, vecResp, loadedExtractor] = await Promise.all([
    fetch(metadataUrl),
    fetch(vectorsUrl),
    loadPipeline(),
  ]);

  if (!metaResp.ok) {
    throw new Error(`Failed to fetch metadata from ${metadataUrl}: HTTP ${metaResp.status}`);
  }
  if (!vecResp.ok) {
    throw new Error(`Failed to fetch vectors from ${vectorsUrl}: HTTP ${vecResp.status}`);
  }

  manifest = (await metaResp.json()) as ClientSearchIndexManifest;
  const vecBuffer = await vecResp.arrayBuffer();
  vectors = new Float32Array(vecBuffer);
  extractor = loadedExtractor;

  postWorkerMessage({ type: 'status', status: 'ready', message: 'Search worker initialized successfully.' });
}

function ensureInitialized(vectorsUrl?: string, metadataUrl?: string): Promise<void> {
  if (!initPromise) {
    initPromise = initialize(vectorsUrl, metadataUrl).catch((err: Error) => {
      initPromise = null;
      postWorkerMessage({ type: 'status', status: 'error', message: err.message || 'Worker initialization failed' });
      throw err;
    });
  }
  return initPromise;
}

async function performSearch(query: string, options?: SearchOptions): Promise<ClientSearchResult[]> {
  if (!manifest || !vectors || !extractor) {
    throw new Error('Search index or embedding model not initialized.');
  }

  const queryTokens = tokenizeForBM25(query);
  const prefixedQuery = `query: ${query}`;

  const tensorOutput = (await extractor(prefixedQuery, {
    pooling: 'mean',
    normalize: true,
  })) as Tensor;

  const queryVector = tensorOutput.data as Float32Array;

  let filterDocIndices: Set<number> | undefined = undefined;
  if (options?.collections && options.collections.length > 0) {
    const allowed = new Set(options.collections);
    filterDocIndices = new Set<number>();
    for (let i = 0; i < manifest.chunks.length; i++) {
      if (allowed.has(manifest.chunks[i].collection)) {
        filterDocIndices.add(i);
      }
    }
  }

  const bm25Results = scoreBM25(query, manifest.bm25, filterDocIndices);
  const vectorResults = scanVectors(queryVector, vectors, manifest.dimension, filterDocIndices);

  const fused = reciprocalRankFusion(bm25Results, vectorResults, {
    wBm25: options?.weights?.bm25 ?? 1.0,
    wVector: options?.weights?.vector ?? 1.2,
    k: options?.rrfK ?? 60,
    topK: options?.topK ?? 10,
  });

  const results: ClientSearchResult[] = fused.map((item) => {
    const chunk = manifest!.chunks[item.docIndex];
    return {
      id: chunk.id,
      sourceId: chunk.sourceId,
      collection: chunk.collection,
      title: chunk.title,
      heading: chunk.heading,
      url: chunk.url,
      snippet: createSnippet(chunk.text, queryTokens),
      content: chunk.text,
      tags: chunk.metadata.tags,
      lang: chunk.metadata.lang,
      date: chunk.metadata.date,
      citations: chunk.metadata.citations,
      score: item.score,
      bm25Score: item.bm25Score,
      vectorScore: item.vectorScore,
      bm25Rank: item.bm25Rank,
      vectorRank: item.vectorRank,
    };
  });

  return results;
}

self.onmessage = async (event: MessageEvent<WorkerInMessage>): Promise<void> => {
  const msg = event.data;
  if (!msg) return;

  if (msg.type === 'init') {
    try {
      await ensureInitialized(msg.vectorsUrl, msg.metadataUrl);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Worker initialization error';
      postWorkerMessage({ type: 'status', status: 'error', message: errMsg });
    }
  } else if (msg.type === 'search') {
    try {
      await ensureInitialized();
      const results = await performSearch(msg.query, msg.options);
      postWorkerMessage({ type: 'search_result', id: msg.id, results });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Search execution error';
      postWorkerMessage({ type: 'search_result', id: msg.id, results: [], error: errMsg });
    }
  }
};
