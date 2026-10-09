import type { BM25DocScore } from './bm25.ts';
import type { VectorDocScore } from './vector-scanner.ts';

export interface FusedDocResult {
  docIndex: number;
  score: number;
  bm25Rank?: number;
  vectorRank?: number;
  bm25Score?: number;
  vectorScore?: number;
}

export interface RRFOptions {
  wBm25?: number;
  wVector?: number;
  k?: number;
  topK?: number;
}

/**
 * Merges BM25 rankings and Vector similarity rankings using Reciprocal Rank Fusion (RRF).
 * Default hyperparameters: w_bm25 = 1.0, w_vector = 1.2, k = 60.
 */
export function reciprocalRankFusion(
  bm25Results: BM25DocScore[],
  vectorResults: VectorDocScore[],
  options: RRFOptions = {}
): FusedDocResult[] {
  const wBm25 = options.wBm25 ?? 1.0;
  const wVector = options.wVector ?? 1.2;
  const k = options.k ?? 60;

  const docMap = new Map<number, FusedDocResult>();

  // Process BM25 rankings (1-indexed ranks)
  for (let i = 0; i < bm25Results.length; i++) {
    const rank = i + 1;
    const item = bm25Results[i];
    const rrfScore = wBm25 * (1 / (k + rank));

    const existing = docMap.get(item.docIndex);
    if (existing) {
      existing.score += rrfScore;
      existing.bm25Rank = rank;
      existing.bm25Score = item.score;
    } else {
      docMap.set(item.docIndex, {
        docIndex: item.docIndex,
        score: rrfScore,
        bm25Rank: rank,
        bm25Score: item.score,
      });
    }
  }

  // Process Vector rankings (1-indexed ranks)
  for (let i = 0; i < vectorResults.length; i++) {
    const rank = i + 1;
    const item = vectorResults[i];
    const rrfScore = wVector * (1 / (k + rank));

    const existing = docMap.get(item.docIndex);
    if (existing) {
      existing.score += rrfScore;
      existing.vectorRank = rank;
      existing.vectorScore = item.score;
    } else {
      docMap.set(item.docIndex, {
        docIndex: item.docIndex,
        score: rrfScore,
        vectorRank: rank,
        vectorScore: item.score,
      });
    }
  }

  const fused = Array.from(docMap.values());
  fused.sort((a, b) => b.score - a.score);

  if (options.topK !== undefined && options.topK > 0) {
    return fused.slice(0, options.topK);
  }

  return fused;
}
