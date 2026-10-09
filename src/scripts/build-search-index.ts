import fs from 'node:fs';
import path from 'node:path';
import { chunkAllCollections } from '@commons/server/embeddings/chunker.ts';
import { embedChunks } from '@commons/server/embeddings/embedder.ts';
import { serializeSearchIndex } from '@commons/server/embeddings/serializer.ts';

async function main(): Promise<void> {
  const startTime = Date.now();
  console.log('='.repeat(80));
  console.log('🔍 SEARCH INDEX BUILDER: Vector (multilingual-e5-small) + BM25 Hybrid Index');
  console.log('='.repeat(80));

  const contentDir = path.resolve(process.cwd(), 'src/content');
  const outputDir = path.resolve(process.cwd(), 'public/search');

  // Step 1: Chunking
  console.log('\n[Phase 1] Chunking collections across src/content/...');
  const chunks = chunkAllCollections(contentDir);

  const collectionCounts: Record<string, number> = {};
  let totalTokens = 0;
  for (const c of chunks) {
    collectionCounts[c.collection] = (collectionCounts[c.collection] || 0) + 1;
    totalTokens += c.tokenCount;
  }

  console.log(`  Parsed ${chunks.length} total contextual chunks (~${totalTokens.toLocaleString()} tokens):`);
  for (const [col, count] of Object.entries(collectionCounts)) {
    console.log(`    - ${col.padEnd(16)}: ${count} chunks`);
  }

  // Step 2: Embeddings with incremental caching
  console.log('\n[Phase 2] Generating / Loading Vector Embeddings (dim=384, passage: prefix)...');
  const { embeddings, cachedCount, computedCount } = await embedChunks(chunks);

  console.log(`  Embeddings complete: ${cachedCount} cached, ${computedCount} computed.`);

  // Step 3: Serialization
  console.log('\n[Phase 3] Serializing public/search/vectors.bin & metadata.json...');
  const { vectorsPath, metadataPath, totalBytes } = serializeSearchIndex(chunks, embeddings, outputDir);

  // Step 4: Verification
  const vectorsStat = fs.statSync(vectorsPath);
  const metadataStat = fs.statSync(metadataPath);
  const expectedVectorBytes = chunks.length * 384 * 4;

  if (vectorsStat.size !== expectedVectorBytes) {
    throw new Error(`Vector binary size mismatch! Expected ${expectedVectorBytes} bytes, got ${vectorsStat.size} bytes.`);
  }

  const manifest = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  if (manifest.chunkCount !== chunks.length || !manifest.bm25 || !manifest.bm25.invertedIndex) {
    throw new Error('Metadata verification failed: missing chunkCount or valid BM25 index.');
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n' + '='.repeat(80));
  console.log('✅ SEARCH INDEX GENERATED SUCCESSFULLY:');
  console.log(`  - Vectors:  ${vectorsPath} (${(vectorsStat.size / 1024).toFixed(1)} KB, ${chunks.length * 384} floats)`);
  console.log(`  - Metadata: ${metadataPath} (${(metadataStat.size / 1024).toFixed(1)} KB, ${Object.keys(manifest.bm25.invertedIndex).length} indexed terms)`);
  console.log(`  - Total:    ${(totalBytes / 1024).toFixed(1)} KB written in ${durationSec}s`);
  console.log('='.repeat(80));
}

main().catch((err) => {
  console.error('\n❌ Build search index failed:');
  console.error(err);
  process.exit(1);
});
