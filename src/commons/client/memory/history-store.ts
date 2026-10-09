/**
 * Long-term Episodic Memory Store using IndexedDB.
 *
 * Implements the MemoryStore interface with full CRUD capabilities for conversation sessions.
 * Features graceful multi-tier fallbacks (IndexedDB -> localStorage -> in-memory Map)
 * ensuring SSR safety and seamless operation in Node.js test runners and private browsing modes.
 */

import type {
  ConversationSession,
  MemoryStore,
  MemoryStorageStats,
} from './types.ts';

export const DB_CONFIG = {
  NAME: 'gh_avatar_memory_v1',
  STORE_NAME: 'conversations',
  VERSION: 1,
} as const;

const LOCAL_STORAGE_FALLBACK_KEY = 'gh_avatar_history_fallback_v1';

/**
 * Calculates byte size of a UTF-8 serialized string in an environment-agnostic manner
 */
function calculateByteSize<T>(data: T): number {
  try {
    const json = JSON.stringify(data);
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(json).length;
    }
    return json.length * 2;
  } catch {
    return 0;
  }
}

export class HistoryStore implements MemoryStore {
  private static instance: HistoryStore | null = null;
  private memoryFallback = new Map<string, ConversationSession>();
  private isIndexedDBAvailable: boolean | null = null;
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  public static getInstance(): HistoryStore {
    if (!HistoryStore.instance) {
      HistoryStore.instance = new HistoryStore();
    }
    return HistoryStore.instance;
  }

  /**
   * Opens or returns the active IndexedDB connection
   */
  private async getDB(): Promise<IDBDatabase | null> {
    if (this.isIndexedDBAvailable === false) {
      return null;
    }

    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      this.isIndexedDBAvailable = false;
      return null;
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      try {
        const request = indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(DB_CONFIG.STORE_NAME)) {
            const store = db.createObjectStore(DB_CONFIG.STORE_NAME, { keyPath: 'id' });
            store.createIndex('updatedAt', 'updatedAt', { unique: false });
          }
        };

        request.onsuccess = () => {
          this.isIndexedDBAvailable = true;
          resolve(request.result);
        };

        request.onerror = (err) => {
          console.warn('[HistoryStore] IndexedDB open error, falling back to local/memory store:', err);
          this.isIndexedDBAvailable = false;
          resolve(null);
        };
      } catch (err) {
        console.warn('[HistoryStore] IndexedDB initialization failed:', err);
        this.isIndexedDBAvailable = false;
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  /**
   * Persists or updates a conversation session
   */
  public async saveSession(session: ConversationSession): Promise<void> {
    const db = await this.getDB();

    if (db) {
      return new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction(DB_CONFIG.STORE_NAME, 'readwrite');
          const store = tx.objectStore(DB_CONFIG.STORE_NAME);
          const request = store.put(session);

          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        } catch (err) {
          // If transaction fails, update fallback
          this.saveFallback(session);
          resolve();
        }
      });
    }

    this.saveFallback(session);
  }

  /**
   * Retrieves a single conversation session by ID
   */
  public async getSession(id: string): Promise<ConversationSession | null> {
    const db = await this.getDB();

    if (db) {
      return new Promise<ConversationSession | null>((resolve) => {
        try {
          const tx = db.transaction(DB_CONFIG.STORE_NAME, 'readonly');
          const store = tx.objectStore(DB_CONFIG.STORE_NAME);
          const request = store.get(id);

          request.onsuccess = () => {
            const result = (request.result as ConversationSession) || null;
            resolve(result);
          };
          request.onerror = () => {
            resolve(this.getFallback(id));
          };
        } catch {
          resolve(this.getFallback(id));
        }
      });
    }

    return this.getFallback(id);
  }

  /**
   * Lists all sessions, ordered by most recently updated first
   */
  public async listSessions(limit?: number): Promise<ConversationSession[]> {
    const db = await this.getDB();

    if (db) {
      return new Promise<ConversationSession[]>((resolve) => {
        try {
          const tx = db.transaction(DB_CONFIG.STORE_NAME, 'readonly');
          const store = tx.objectStore(DB_CONFIG.STORE_NAME);
          const request = store.getAll();

          request.onsuccess = () => {
            const sessions = (request.result as ConversationSession[]) || [];
            // Sort by updatedAt descending
            sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            if (typeof limit === 'number' && limit > 0) {
              resolve(sessions.slice(0, limit));
            } else {
              resolve(sessions);
            }
          };
          request.onerror = () => {
            resolve(this.listFallback(limit));
          };
        } catch {
          resolve(this.listFallback(limit));
        }
      });
    }

    return this.listFallback(limit);
  }

  /**
   * Deletes a single conversation session by ID
   */
  public async deleteSession(id: string): Promise<void> {
    const db = await this.getDB();

    if (db) {
      return new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction(DB_CONFIG.STORE_NAME, 'readwrite');
          const store = tx.objectStore(DB_CONFIG.STORE_NAME);
          const request = store.delete(id);

          request.onsuccess = () => {
            this.deleteFallback(id);
            resolve();
          };
          request.onerror = () => reject(request.error);
        } catch (err) {
          this.deleteFallback(id);
          resolve();
        }
      });
    }

    this.deleteFallback(id);
  }

  /**
   * Clears all saved conversation sessions
   */
  public async clearAllSessions(): Promise<void> {
    const db = await this.getDB();

    if (db) {
      await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction(DB_CONFIG.STORE_NAME, 'readwrite');
          const store = tx.objectStore(DB_CONFIG.STORE_NAME);
          const request = store.clear();

          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        } catch (err) {
          resolve();
        }
      });
    }

    this.clearFallback();
  }

  /**
   * Calculates overall memory storage metrics (count and estimated byte size)
   */
  public async getStorageStats(): Promise<MemoryStorageStats> {
    const sessions = await this.listSessions();
    const count = sessions.length;
    let sizeBytes = 0;
    for (const s of sessions) {
      sizeBytes += calculateByteSize(s);
    }
    return { count, sizeBytes };
  }

  // --------------------------------------------------------------------------
  // Multi-tier Fallback Implementations (localStorage -> In-Memory)
  // --------------------------------------------------------------------------

  private saveFallback(session: ConversationSession): void {
    this.memoryFallback.set(session.id, session);
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      try {
        const existing = this.loadLocalStorageFallback();
        existing[session.id] = session;
        window.localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, JSON.stringify(existing));
      } catch {
        // Ignore fallback write errors
      }
    }
  }

  private getFallback(id: string): ConversationSession | null {
    if (this.memoryFallback.has(id)) {
      return this.memoryFallback.get(id) || null;
    }
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      try {
        const existing = this.loadLocalStorageFallback();
        return existing[id] || null;
      } catch {
        return null;
      }
    }
    return null;
  }

  private listFallback(limit?: number): ConversationSession[] {
    const map = new Map<string, ConversationSession>(this.memoryFallback);

    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      try {
        const stored = this.loadLocalStorageFallback();
        for (const [key, val] of Object.entries(stored)) {
          if (!map.has(key)) {
            map.set(key, val);
          }
        }
      } catch {
        // Ignore
      }
    }

    const sessions = Array.from(map.values());
    sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (typeof limit === 'number' && limit > 0) {
      return sessions.slice(0, limit);
    }
    return sessions;
  }

  private deleteFallback(id: string): void {
    this.memoryFallback.delete(id);
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      try {
        const existing = this.loadLocalStorageFallback();
        delete existing[id];
        window.localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, JSON.stringify(existing));
      } catch {
        // Ignore
      }
    }
  }

  private clearFallback(): void {
    this.memoryFallback.clear();
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      try {
        window.localStorage.removeItem(LOCAL_STORAGE_FALLBACK_KEY);
      } catch {
        // Ignore
      }
    }
  }

  private loadLocalStorageFallback(): Record<string, ConversationSession> {
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // Ignore
    }
    return {};
  }
}

export function getHistoryStore(): HistoryStore {
  return HistoryStore.getInstance();
}
