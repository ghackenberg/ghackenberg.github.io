/**
 * Types and interfaces for the Virtual Avatar Episodic Memory and Session Subsystem.
 *
 * Provides SSR-safe types, session representations, message structures, and the MemoryStore contract.
 */

/**
 * Citation reference attached to a conversational message
 */
export interface ChatCitation {
  id?: string;
  label?: string;
  title?: string;
  url?: string;
}

/**
 * Single chat message within an episodic conversation turn
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  citations?: ChatCitation[];
}

/**
 * Complete conversation session representing an episodic thread
 */
export interface ConversationSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  summary?: string;
}

/**
 * Storage statistics for persisted conversation memory
 */
export interface MemoryStorageStats {
  count: number;
  sizeBytes: number;
}

/**
 * Storage contract for persisting and retrieving episodic conversation sessions
 */
export interface MemoryStore {
  saveSession(session: ConversationSession): Promise<void>;
  getSession(id: string): Promise<ConversationSession | null>;
  listSessions(limit?: number): Promise<ConversationSession[]>;
  deleteSession(id: string): Promise<void>;
  clearAllSessions(): Promise<void>;
  getStorageStats(): Promise<MemoryStorageStats>;
}

/**
 * Type guard for ChatMessage
 */
export function isChatMessage<T>(value: T): value is T & ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, string | number | ChatCitation[] | undefined>;
  return (
    typeof candidate.id === 'string' &&
    (candidate.role === 'user' || candidate.role === 'model') &&
    typeof candidate.content === 'string' &&
    typeof candidate.timestamp === 'number'
  );
}

/**
 * Type guard for ConversationSession
 */
export function isConversationSession<T>(value: T): value is T & ConversationSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, string | number | ChatMessage[] | undefined>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.createdAt === 'number' &&
    typeof candidate.updatedAt === 'number' &&
    Array.isArray(candidate.messages) &&
    candidate.messages.every((m) => isChatMessage(m))
  );
}
