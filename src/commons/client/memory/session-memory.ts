/**
 * Short-term Active Session Memory Manager.
 *
 * Utilizes sessionStorage to maintain ephemeral avatar conversation state
 * (active session ID, open/closed drawer state, and draft input) across page transitions.
 * Ensures SSR safety and graceful fallback in restricted browser environments.
 */

export const SESSION_STORAGE_KEYS = {
  ACTIVE_SESSION_ID: 'gh_avatar_active_session_id',
  DRAWER_OPEN: 'gh_avatar_drawer_open',
  INPUT_DRAFT: 'gh_avatar_input_draft',
} as const;

/**
 * Checks if window.sessionStorage is accessible and functional
 */
export function isSessionStorageAvailable(): boolean {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return false;
  }
  try {
    const testKey = '__gh_session_test__';
    window.sessionStorage.setItem(testKey, '1');
    window.sessionStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates a unique episodic session ID
 */
export function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `sess_${timestamp}_${randomPart}`;
}

/**
 * Retrieves the currently active session ID from sessionStorage
 */
export function getActiveSessionId(): string | null {
  if (!isSessionStorageAvailable()) return null;
  try {
    return window.sessionStorage.getItem(SESSION_STORAGE_KEYS.ACTIVE_SESSION_ID);
  } catch {
    return null;
  }
}

/**
 * Sets the active session ID in sessionStorage
 */
export function setActiveSessionId(sessionId: string): void {
  if (!isSessionStorageAvailable()) return;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEYS.ACTIVE_SESSION_ID, sessionId);
  } catch {
    // Graceful degradation when quota exceeded or storage blocked
  }
}

/**
 * Clears the active session ID from sessionStorage
 */
export function clearActiveSessionId(): void {
  if (!isSessionStorageAvailable()) return;
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEYS.ACTIVE_SESSION_ID);
  } catch {
    // Ignore error
  }
}

/**
 * Checks whether the avatar drawer should be open based on sessionStorage
 */
export function isDrawerOpen(): boolean {
  if (!isSessionStorageAvailable()) return false;
  try {
    return window.sessionStorage.getItem(SESSION_STORAGE_KEYS.DRAWER_OPEN) === '1';
  } catch {
    return false;
  }
}

/**
 * Persists the drawer open state in sessionStorage
 */
export function setDrawerOpen(isOpen: boolean): void {
  if (!isSessionStorageAvailable()) return;
  try {
    if (isOpen) {
      window.sessionStorage.setItem(SESSION_STORAGE_KEYS.DRAWER_OPEN, '1');
    } else {
      window.sessionStorage.setItem(SESSION_STORAGE_KEYS.DRAWER_OPEN, '0');
    }
  } catch {
    // Ignore error
  }
}

/**
 * Retrieves unsubmitted input text draft
 */
export function getInputDraft(): string {
  if (!isSessionStorageAvailable()) return '';
  try {
    return window.sessionStorage.getItem(SESSION_STORAGE_KEYS.INPUT_DRAFT) || '';
  } catch {
    return '';
  }
}

/**
 * Persists unsubmitted input text draft
 */
export function setInputDraft(draft: string): void {
  if (!isSessionStorageAvailable()) return;
  try {
    if (!draft) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEYS.INPUT_DRAFT);
    } else {
      window.sessionStorage.setItem(SESSION_STORAGE_KEYS.INPUT_DRAFT, draft);
    }
  } catch {
    // Ignore error
  }
}

/**
 * Clears unsubmitted input text draft
 */
export function clearInputDraft(): void {
  if (!isSessionStorageAvailable()) return;
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEYS.INPUT_DRAFT);
  } catch {
    // Ignore error
  }
}

/**
 * Clears all avatar session memory (active session ID, drawer open status, input draft)
 */
export function clearSessionMemory(): void {
  if (!isSessionStorageAvailable()) return;
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEYS.ACTIVE_SESSION_ID);
    window.sessionStorage.removeItem(SESSION_STORAGE_KEYS.DRAWER_OPEN);
    window.sessionStorage.removeItem(SESSION_STORAGE_KEYS.INPUT_DRAFT);
  } catch {
    // Ignore error
  }
}
