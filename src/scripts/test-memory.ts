import {
  isChatMessage,
  isConversationSession,
  type ChatMessage,
  type ConversationSession,
} from '@commons/client/memory/types.ts';
import {
  generateSessionId,
  getActiveSessionId,
  isDrawerOpen,
  getInputDraft,
  clearSessionMemory,
} from '@commons/client/memory/session-memory.ts';
import { getHistoryStore } from '@commons/client/memory/history-store.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    process.exit(1);
  }
}

async function runMemoryTests(): Promise<void> {
  console.log('='.repeat(80));
  console.log('🧠 EPISODIC MEMORY & SESSION SUBSYSTEM VERIFICATION SUITE');
  console.log('='.repeat(80));

  // --- 1. Type Guards & Data Validation ---
  console.log('\n[1/4] Testing Type Guards and Data Structures...');

  const validMsg: ChatMessage = {
    id: 'msg-01',
    role: 'user',
    content: 'What is Slide-as-Code?',
    timestamp: Date.now(),
    citations: [{ id: 'ref-1', title: 'Slide-as-Code Overview' }],
  };

  assert(isChatMessage(validMsg), 'isChatMessage accepts valid message');
  assert(!isChatMessage({ id: 'msg-02', role: 'invalid_role', content: 'test' }), 'isChatMessage rejects invalid role');
  assert(!isChatMessage(null), 'isChatMessage rejects null');

  const validSession: ConversationSession = {
    id: 'session-alpha',
    title: 'What is Slide-as-Code?',
    createdAt: Date.now() - 5000,
    updatedAt: Date.now() - 1000,
    messages: [validMsg],
    summary: 'Discussion about the Slide-as-Code presentation engine',
  };

  assert(isConversationSession(validSession), 'isConversationSession accepts valid session');
  assert(
    !isConversationSession({ id: 'bad-session', title: 'Incomplete' }),
    'isConversationSession rejects incomplete object'
  );
  console.log('   ✅ Type guards and validation schemas verified.');

  // --- 2. Session Memory SSR Safety ---
  console.log('\n[2/4] Testing Session Memory SSR-Safety...');

  const generatedId1 = generateSessionId();
  const generatedId2 = generateSessionId();
  assert(typeof generatedId1 === 'string' && generatedId1.length > 5, 'generateSessionId produces valid string');
  assert(generatedId1 !== generatedId2, 'generateSessionId produces unique identifiers');

  // In Node environment, window and sessionStorage are absent: functions should not throw and return safe fallbacks
  assert(getActiveSessionId() === null, 'getActiveSessionId returns null safely under SSR');
  assert(isDrawerOpen() === false, 'isDrawerOpen returns false safely under SSR');
  assert(getInputDraft() === '', 'getInputDraft returns empty string safely under SSR');
  clearSessionMemory(); // should not throw
  console.log('   ✅ Session memory handles SSR / non-browser runtime gracefully.');

  // --- 3. History Store CRUD & In-Memory Fallback ---
  console.log('\n[3/4] Testing HistoryStore In-Memory Fallback & CRUD Operations...');
  const store = getHistoryStore();

  // Clean slate
  await store.clearAllSessions();
  const initialSessions = await store.listSessions();
  assert(initialSessions.length === 0, 'Store starts empty after clearAllSessions');

  const sampleSession1: ConversationSession = {
    id: 'sess-01',
    title: 'Software Architecture Discussion',
    createdAt: 1000,
    updatedAt: 2000,
    messages: [
      { id: 'm1', role: 'user', content: 'Tell me about CADdrive.', timestamp: 1000 },
      { id: 'm2', role: 'model', content: 'CADdrive is an open CAD architecture.', timestamp: 2000 },
    ],
  };

  const sampleSession2: ConversationSession = {
    id: 'sess-02',
    title: 'Research in Edge AI',
    createdAt: 3000,
    updatedAt: 4000,
    messages: [
      { id: 'm3', role: 'user', content: 'What is WebGPU inference?', timestamp: 3000 },
      { id: 'm4', role: 'model', content: 'WebGPU allows local browser inference.', timestamp: 4000 },
    ],
  };

  // Save sessions
  await store.saveSession(sampleSession1);
  await store.saveSession(sampleSession2);

  // Retrieve single session
  const retrieved1 = await store.getSession('sess-01');
  assert(retrieved1 !== null, 'getSession finds saved session');
  assert(retrieved1?.title === 'Software Architecture Discussion', 'Retrieved session title matches');
  assert(retrieved1?.messages.length === 2, 'Retrieved session contains all messages');

  // List sessions (check sorting: sess-02 updated at 4000 should come first)
  const allSessions = await store.listSessions();
  assert(allSessions.length === 2, 'listSessions returns all saved sessions');
  assert(allSessions[0].id === 'sess-02', 'listSessions orders by updatedAt descending');
  assert(allSessions[1].id === 'sess-01', 'Older updated session comes second');

  // Limit check
  const limitedSessions = await store.listSessions(1);
  assert(limitedSessions.length === 1, 'listSessions with limit=1 returns 1 session');
  assert(limitedSessions[0].id === 'sess-02', 'Limited list returns the most recent session');

  // Delete session
  await store.deleteSession('sess-01');
  const postDeleteSessions = await store.listSessions();
  assert(postDeleteSessions.length === 1, 'Session count decreases after delete');
  assert(postDeleteSessions[0].id === 'sess-02', 'Remaining session is sess-02');
  const deletedFetch = await store.getSession('sess-01');
  assert(deletedFetch === null, 'Deleted session returns null');

  console.log('   ✅ HistoryStore CRUD and chronological sorting verified.');

  // --- 4. Storage Statistics & Mass Purge ---
  console.log('\n[4/4] Testing Storage Statistics and Memory Purge...');

  const stats = await store.getStorageStats();
  assert(stats.count === 1, 'Stats count reflects active sessions');
  assert(stats.sizeBytes > 50, `Stats sizeBytes calculated correctly (got ${stats.sizeBytes} bytes)`);

  await store.clearAllSessions();
  const clearedStats = await store.getStorageStats();
  assert(clearedStats.count === 0, 'Cleared stats count is 0');
  assert(clearedStats.sizeBytes === 0, 'Cleared stats sizeBytes is 0');

  console.log('   ✅ Storage stats calculation and full purge verified.');

  console.log('\n' + '='.repeat(80));
  console.log('🎉 ALL EPISODIC MEMORY GATES PASSED (4/4)');
  console.log('='.repeat(80));
}

runMemoryTests().catch((err) => {
  console.error('Fatal error during memory tests:', err);
  process.exit(1);
});
