import type { ClientBM25IndexData } from './types.ts';

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it', 'its',
  'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will', 'with', 'this', 'but', 'they', 'have', 'had',
  'der', 'die', 'das', 'und', 'in', 'den', 'von', 'zu', 'mit', 'ist', 'im', 'fuer', 'für', 'eine',
  'einem', 'einen', 'einer', 'dem', 'des', 'auf', 'aus', 'nicht', 'als', 'auch', 'es', 'an', 'wie',
  'wir', 'sie', 'er', 'hat', 'nach', 'bei', 'oder', 'so', 'über', 'ueber', 'ein', 'zur', 'vom', 'vor'
]);

/**
 * Tokenizes text into normalized keywords for BM25 matching.
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

export interface BM25DocScore {
  docIndex: number;
  score: number;
}

/**
 * Computes BM25 scores for a given query against precomputed BM25 index data.
 */
export function scoreBM25(
  query: string,
  bm25Index: ClientBM25IndexData,
  filterDocIndices?: Set<number>
): BM25DocScore[] {
  const queryTokens = tokenizeForBM25(query);
  if (queryTokens.length === 0) {
    return [];
  }

  const { k1, b, avgDocLength, totalDocs, docLengths, invertedIndex } = bm25Index;
  const docScores = new Map<number, number>();

  for (const term of queryTokens) {
    const postings = invertedIndex[term];
    if (!postings) continue;

    const docFreq = postings.length;
    // Okapi BM25 / Lucene-style IDF with +1 smoothing to avoid negative scores
    const idf = Math.log(1 + (totalDocs - docFreq + 0.5) / (docFreq + 0.5));

    for (let p = 0; p < postings.length; p++) {
      const [docIdx, freq] = postings[p];

      if (filterDocIndices && !filterDocIndices.has(docIdx)) {
        continue;
      }

      const docLen = docLengths[docIdx] || avgDocLength;
      const lengthNorm = 1 - b + b * (docLen / avgDocLength);
      const tfComponent = (freq * (k1 + 1)) / (freq + k1 * lengthNorm);
      const termScore = idf * tfComponent;

      const currentScore = docScores.get(docIdx) || 0;
      docScores.set(docIdx, currentScore + termScore);
    }
  }

  const results: BM25DocScore[] = [];
  for (const [docIndex, score] of docScores.entries()) {
    results.push({ docIndex, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Generates an excerpt snippet highlighting the relevant region matching query terms.
 */
export function createSnippet(text: string, queryTokens: string[], maxLength = 220): string {
  if (!text) return '';

  const cleanText = text
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/[#*_`>~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanText.length <= maxLength) {
    return cleanText;
  }

  const lowerText = cleanText.toLowerCase();
  let bestPos = -1;

  for (const token of queryTokens) {
    const pos = lowerText.indexOf(token.toLowerCase());
    if (pos !== -1) {
      bestPos = pos;
      break;
    }
  }

  if (bestPos === -1) {
    return cleanText.slice(0, maxLength).trim() + '...';
  }

  const start = Math.max(0, bestPos - 40);
  const end = Math.min(cleanText.length, start + maxLength);
  let snippet = cleanText.slice(start, end).trim();

  if (start > 0) {
    snippet = '...' + snippet;
  }
  if (end < cleanText.length) {
    snippet = snippet + '...';
  }

  return snippet;
}
