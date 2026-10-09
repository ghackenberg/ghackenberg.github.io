export interface ClientCitationReference {
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

export type ChunkMetadataScalar =
  | string
  | number
  | boolean
  | string[]
  | ClientCitationReference[]
  | undefined;

export interface ClientChunkMetadata {
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
  citations?: ClientCitationReference[];
  [key: string]: ChunkMetadataScalar;
}

export interface ClientSearchChunk {
  id: string;
  sourceId: string;
  collection: string;
  title: string;
  heading?: string;
  url: string;
  text: string;
  tokenCount: number;
  metadata: ClientChunkMetadata;
}

export interface ClientBM25IndexData {
  k1: number;
  b: number;
  avgDocLength: number;
  totalDocs: number;
  docLengths: number[];
  invertedIndex: Record<string, [number, number][]>;
}

export interface ClientSearchIndexManifest {
  version: number;
  model: string;
  dimension: number;
  generatedAt: string;
  chunkCount: number;
  chunks: ClientSearchChunk[];
  bm25: ClientBM25IndexData;
}

export interface SearchOptions {
  topK?: number;
  collections?: string[];
  weights?: {
    bm25?: number;
    vector?: number;
  };
  rrfK?: number;
}

export interface ClientSearchResult {
  id: string;
  sourceId: string;
  collection: string;
  title: string;
  heading?: string;
  url: string;
  snippet: string;
  tags?: string[];
  lang?: string;
  date?: string;
  citations?: ClientCitationReference[];
  score: number;
  bm25Score?: number;
  vectorScore?: number;
  bm25Rank?: number;
  vectorRank?: number;
}

export type SearchClientStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface WorkerInitMessage {
  type: 'init';
  vectorsUrl?: string;
  metadataUrl?: string;
}

export interface WorkerSearchMessage {
  type: 'search';
  id: string;
  query: string;
  options?: SearchOptions;
}

export type WorkerInMessage = WorkerInitMessage | WorkerSearchMessage;

export interface WorkerStatusMessage {
  type: 'status';
  status: SearchClientStatus;
  message?: string;
}

export interface WorkerSearchResultMessage {
  type: 'search_result';
  id: string;
  results: ClientSearchResult[];
  error?: string;
}

export type WorkerOutMessage = WorkerStatusMessage | WorkerSearchResultMessage;
