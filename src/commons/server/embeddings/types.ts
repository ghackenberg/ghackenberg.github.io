export interface CitationReference {
  id: string;
  author: string;
  year?: number | string;
  title: string;
  url?: string;
  doi?: string;
  booktitle?: string;
  journal?: string;
  publisher?: string;
  formatted?: string;
}

export type ChunkMetadataValue =
  | string
  | number
  | boolean
  | string[]
  | CitationReference[]
  | undefined;

export interface ChunkMetadata {
  collection: string;
  sourceId: string;
  sourceFile: string;
  title: string;
  url: string;
  heading?: string;
  section?: string;
  tags?: string[];
  lang?: string;
  date?: string;
  author?: string;
  slideNumber?: string;
  voiceover?: string;
  citations?: CitationReference[];
  [key: string]: ChunkMetadataValue;
}

export interface SearchChunk {
  id: string;
  sourceId: string;
  collection: string;
  title: string;
  heading?: string;
  url: string;
  text: string;
  tokenCount: number;
  metadata: ChunkMetadata;
}

export interface BM25IndexData {
  k1: number;
  b: number;
  avgDocLength: number;
  totalDocs: number;
  docLengths: number[];
  invertedIndex: Record<string, [number, number][]>;
}

export interface SearchIndexManifest {
  version: number;
  model: string;
  dimension: number;
  generatedAt: string;
  chunkCount: number;
  chunks: SearchChunk[];
  bm25: BM25IndexData;
}
