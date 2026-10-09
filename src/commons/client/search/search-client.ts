import type {
  ClientSearchResult,
  SearchOptions,
  SearchClientStatus,
  WorkerInMessage,
  WorkerOutMessage,
  ClientSearchIndexManifest,
} from './types.ts';
import { scoreBM25, tokenizeForBM25, createSnippet } from './bm25.ts';

type StatusListener = (status: SearchClientStatus, message?: string) => void;

interface PendingRequest {
  resolve: (results: ClientSearchResult[]) => void;
  reject: (err: Error) => void;
}

export class SearchClient {
  private static instance: SearchClient | null = null;
  private worker: Worker | null = null;
  private status: SearchClientStatus = 'idle';
  private statusMessage?: string;
  private statusListeners: StatusListener[] = [];
  private pendingRequests = new Map<string, PendingRequest>();
  private requestCounter = 0;
  private fallbackManifest: ClientSearchIndexManifest | null = null;
  private fallbackPromise: Promise<ClientSearchIndexManifest> | null = null;
  private isFallbackMode = false;
  private initPromise: Promise<void> | null = null;

  public static getInstance(): SearchClient {
    if (!SearchClient.instance) {
      SearchClient.instance = new SearchClient();
    }
    return SearchClient.instance;
  }

  public getStatus(): SearchClientStatus {
    return this.status;
  }

  public getStatusMessage(): string | undefined {
    return this.statusMessage;
  }

  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.push(listener);
    listener(this.status, this.statusMessage);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private setStatus(status: SearchClientStatus, message?: string): void {
    this.status = status;
    this.statusMessage = message;
    for (const listener of this.statusListeners) {
      listener(status, message);
    }
  }

  public async initialize(vectorsUrl?: string, metadataUrl?: string): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      if (typeof Worker === 'undefined') {
        await this.enableFallbackMode('Web Workers are not supported in this environment.', metadataUrl);
        return;
      }

      this.setStatus('loading', 'Initializing hybrid search worker...');

      try {
        const workerUrl = new URL('./search-worker.ts', import.meta.url);
        this.worker = new Worker(workerUrl, { type: 'module' });

        this.worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
          this.handleWorkerMessage(event.data);
        };

        this.worker.onerror = async (err: ErrorEvent) => {
          console.warn('[SearchClient] Worker runtime error, falling back to pure BM25 search:', err.message);
          await this.enableFallbackMode(err.message, metadataUrl);
        };

        const initMsg: WorkerInMessage = {
          type: 'init',
          vectorsUrl,
          metadataUrl,
        };
        this.worker.postMessage(initMsg);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to instantiate search worker';
        console.warn(`[SearchClient] Failed to create Worker (${msg}), falling back to pure BM25 search.`);
        await this.enableFallbackMode(msg, metadataUrl);
      }
    })();

    return this.initPromise;
  }

  private handleWorkerMessage(msg: WorkerOutMessage): void {
    if (msg.type === 'status') {
      if (msg.status === 'error') {
        console.warn('[SearchClient] Worker reported error status, switching to fallback BM25 mode:', msg.message);
        void this.enableFallbackMode(msg.message);
      } else {
        this.setStatus(msg.status, msg.message);
      }
    } else if (msg.type === 'search_result') {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg.results);
        }
      }
    }
  }

  private async enableFallbackMode(reason?: string, metadataUrl = '/search/metadata.json'): Promise<void> {
    this.isFallbackMode = true;
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {
        // ignore
      }
      this.worker = null;
    }

    try {
      this.setStatus('loading', `Loading BM25 fallback index (${reason || 'fallback'})...`);
      if (!this.fallbackPromise) {
        this.fallbackPromise = fetch(metadataUrl).then(async (res) => {
          if (!res.ok) {
            throw new Error(`Failed to load search metadata: HTTP ${res.status}`);
          }
          return (await res.json()) as ClientSearchIndexManifest;
        });
      }
      this.fallbackManifest = await this.fallbackPromise;
      this.setStatus('ready', 'BM25 fallback search is ready.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fallback index load failed';
      this.setStatus('error', msg);
      throw err;
    }
  }

  public async search(query: string, options?: SearchOptions): Promise<ClientSearchResult[]> {
    if (this.status === 'idle') {
      await this.initialize();
    }

    if (this.isFallbackMode || !this.worker) {
      return this.searchFallback(query, options);
    }

    return new Promise<ClientSearchResult[]>((resolve, reject) => {
      this.requestCounter++;
      const id = `req_${Date.now()}_${this.requestCounter}`;
      this.pendingRequests.set(id, { resolve, reject });

      const msg: WorkerInMessage = {
        type: 'search',
        id,
        query,
        options,
      };

      this.worker?.postMessage(msg);
    });
  }

  private async searchFallback(query: string, options?: SearchOptions): Promise<ClientSearchResult[]> {
    if (!this.fallbackManifest) {
      if (!this.fallbackPromise) {
        await this.enableFallbackMode();
      } else {
        this.fallbackManifest = await this.fallbackPromise;
      }
    }

    const manifest = this.fallbackManifest;
    if (!manifest) {
      throw new Error('BM25 fallback manifest not available');
    }

    const queryTokens = tokenizeForBM25(query);

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
    const topK = options?.topK ?? 10;
    const sliced = bm25Results.slice(0, topK);

    return sliced.map((item, index) => {
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
        bm25Score: item.score,
        bm25Rank: index + 1,
      };
    });
  }
}

export function getSearchClient(): SearchClient {
  return SearchClient.getInstance();
}
