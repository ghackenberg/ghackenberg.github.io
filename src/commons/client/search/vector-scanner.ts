export interface VectorDocScore {
  docIndex: number;
  score: number;
}

/**
 * Scans a flat Float32Array of pre-normalized passage vectors using dot-product cosine similarity.
 * Vectors are assumed to be unit-length (L2-normalized).
 */
export function scanVectors(
  queryVector: Float32Array,
  vectors: Float32Array,
  dimension = 384,
  filterDocIndices?: Set<number>,
  topK?: number
): VectorDocScore[] {
  if (vectors.length === 0 || queryVector.length !== dimension) {
    return [];
  }

  const totalDocs = Math.floor(vectors.length / dimension);
  const results: VectorDocScore[] = [];

  for (let i = 0; i < totalDocs; i++) {
    if (filterDocIndices && !filterDocIndices.has(i)) {
      continue;
    }

    const offset = i * dimension;
    let dot = 0;
    for (let j = 0; j < dimension; j++) {
      dot += queryVector[j] * vectors[offset + j];
    }

    results.push({ docIndex: i, score: dot });
  }

  results.sort((a, b) => b.score - a.score);

  if (topK !== undefined && topK > 0) {
    return results.slice(0, topK);
  }

  return results;
}
