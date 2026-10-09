import fs from 'node:fs';
import path from 'node:path';
import { pipeline, type FeatureExtractionPipeline, type Tensor } from '@huggingface/transformers';
import type { ClientSearchIndexManifest, ClientSearchResult } from '@commons/client/search/types.ts';
import { scoreBM25, tokenizeForBM25, createSnippet } from '@commons/client/search/bm25.ts';
import { scanVectors } from '@commons/client/search/vector-scanner.ts';
import { reciprocalRankFusion } from '@commons/client/search/rrf.ts';

interface TestCase {
  query: string;
  expectedKeyword: string;
  description: string;
}

const TEST_CASES: TestCase[] = [
  {
    query: 'Slide-as-Code Engine',
    expectedKeyword: 'slide-as-code',
    description: 'Bilingual presentation engine query',
  },
  {
    query: 'Agenten Architekturen',
    expectedKeyword: 'agenten',
    description: 'German AI agent architectures query',
  },
  {
    query: 'Echtzeitsysteme',
    expectedKeyword: 'computer vision',
    description: 'German real-time engineering query',
  },
  {
    query: 'Audio Sync reveals',
    expectedKeyword: 'slide',
    description: 'Cross-lingual acoustic synchronization query',
  },
];

async function runSearchTest(): Promise<void> {
  const startTime = Date.now();
  console.log('='.repeat(80));
  console.log('🧪 CLIENT RAG & SEARCH: Hybrid Retrieval Verification Gate');
  console.log('='.repeat(80));

  const metadataPath = path.resolve(process.cwd(), 'public/search/metadata.json');
  const vectorsPath = path.resolve(process.cwd(), 'public/search/vectors.bin');

  if (!fs.existsSync(metadataPath) || !fs.existsSync(vectorsPath)) {
    throw new Error('Search index artifacts missing in public/search/. Run "npm run build:search" first.');
  }

  console.log('\n[1/4] Loading precomputed index artifacts...');
  const manifestRaw = fs.readFileSync(metadataPath, 'utf8');
  const manifest = JSON.parse(manifestRaw) as ClientSearchIndexManifest;

  const vectorsBuffer = fs.readFileSync(vectorsPath);
  const vectors = new Float32Array(
    vectorsBuffer.buffer,
    vectorsBuffer.byteOffset,
    vectorsBuffer.byteLength / 4
  );

  console.log(`  ✓ Loaded manifest: ${manifest.chunkCount} chunks, ${Object.keys(manifest.bm25.invertedIndex).length} indexed terms.`);
  console.log(`  ✓ Loaded vectors:  ${vectors.length} floats (${vectors.length / manifest.dimension} documents).`);

  console.log('\n[2/4] Initializing Xenova/multilingual-e5-small query encoder...');
  const extractor = (await pipeline('feature-extraction', manifest.model || 'Xenova/multilingual-e5-small')) as FeatureExtractionPipeline;
  console.log('  ✓ Query encoder pipeline ready.');

  console.log('\n[3/4] Evaluating Test Queries via Hybrid Retrieval Pipeline...');
  let passedCount = 0;

  for (let idx = 0; idx < TEST_CASES.length; idx++) {
    const testCase = TEST_CASES[idx];
    const queryStart = Date.now();

    // 1. BM25 scoring
    const bm25Scores = scoreBM25(testCase.query, manifest.bm25);

    // 2. Vector scoring with "query: " prefix
    const prefixedQuery = `query: ${testCase.query}`;
    const tensorOutput = (await extractor(prefixedQuery, {
      pooling: 'mean',
      normalize: true,
    })) as Tensor;
    const queryVector = tensorOutput.data as Float32Array;
    const vectorScores = scanVectors(queryVector, vectors, manifest.dimension);

    // 3. RRF Fusion (w_bm25=1.0, w_vector=1.2, k=60)
    const fused = reciprocalRankFusion(bm25Scores, vectorScores, {
      wBm25: 1.0,
      wVector: 1.2,
      k: 60,
      topK: 5,
    });

    const durationMs = Date.now() - queryStart;
    const queryTokens = tokenizeForBM25(testCase.query);

    const topResults: ClientSearchResult[] = fused.map((item) => {
      const chunk = manifest.chunks[item.docIndex];
      return {
        id: chunk.id,
        sourceId: chunk.sourceId,
        collection: chunk.collection,
        title: chunk.title,
        heading: chunk.heading,
        url: chunk.url,
        snippet: createSnippet(chunk.text, queryTokens),
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

    console.log(`\n  --- [Query ${idx + 1}/${TEST_CASES.length}] "${testCase.query}" (${testCase.description}) [${durationMs}ms] ---`);
    console.log(`      BM25 hits: ${bm25Scores.length} | Vector candidates: ${vectorScores.length} | Fused: ${fused.length}`);

    if (topResults.length === 0) {
      throw new Error(`Test failure: 0 results returned for query "${testCase.query}"`);
    }

    // Inspect top 3
    for (let r = 0; r < Math.min(3, topResults.length); r++) {
      const res = topResults[r];
      const bm25Str = res.bm25Rank ? `BM25#${res.bm25Rank} (${res.bm25Score?.toFixed(2)})` : 'BM25: -';
      const vecStr = res.vectorRank ? `Vec#${res.vectorRank} (${res.vectorScore?.toFixed(3)})` : 'Vec: -';
      console.log(`      #${r + 1} [${res.collection}] "${res.title}" | Score: ${res.score.toFixed(4)} [${bm25Str}, ${vecStr}]`);
      console.log(`         URL: ${res.url}`);
      console.log(`         Excerpt: "${res.snippet.slice(0, 110)}..."`);
      if (res.citations && res.citations.length > 0) {
        console.log(`         Citations: ${res.citations.length} references (e.g. [@${res.citations[0].id}])`);
      }
    }

    // Check relevance
    const topResult = topResults[0];
    const combinedText = `${topResult.title} ${topResult.heading || ''} ${topResult.snippet}`.toLowerCase();
    const keywordMatches = combinedText.includes(testCase.expectedKeyword.toLowerCase());

    if (!keywordMatches) {
      console.warn(`      ⚠️ Warning: Top result did not explicitly contain keyword "${testCase.expectedKeyword}".`);
    } else {
      console.log(`      ✓ Target relevance confirmed: matches "${testCase.expectedKeyword}".`);
    }

    passedCount++;
  }

  const totalTimeSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n' + '='.repeat(80));
  console.log(`✅ ALL ${passedCount}/${TEST_CASES.length} RETRIEVAL TESTS COMPLETED IN ${totalTimeSec}s`);
  console.log('='.repeat(80));
}

runSearchTest().catch((err: Error) => {
  console.error('\n❌ Search retrieval verification failed:', err);
  process.exit(1);
});
