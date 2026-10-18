/**
 * Shared, side-effect-free unread computation.
 *
 * Mirrors the rule used by the navbar badges (Layout.astro) and notifications.ts:
 * an item is unread when it is "new" (published after the last visit of its collection,
 * or the collection was never visited) AND its URL has not been visited yet.
 *
 * Only reads data when the visitor opted in (`enabled === true`); otherwise returns null.
 */

const NOTIFICATIONS_STORAGE_KEY = 'gh_site_notifications_v1';
const MANIFEST_CACHE_KEY = 'gh_content_manifest_cache';

export const UNREAD_COLLECTIONS = [
  'posts',
  'presentations',
  'courses',
  'projects',
  'services',
  'publications',
  'visualizations',
  'interests'
] as const;

export interface UnreadState {
  enabled: boolean;
  lastVisitedSections?: Record<string, number>;
  visitedItems?: Record<string, number>;
}

export interface UnreadManifestItem {
  url: string;
  date?: number;
}

export type UnreadManifest = Record<string, UnreadManifestItem[] | undefined>;

function normalizePath(path: string): string {
  const normalized = path.replace(/\/$/, '');
  return normalized.startsWith('/') ? normalized : '/' + normalized;
}

/**
 * Counts unread items per collection.
 */
export function countUnreadBySection(state: UnreadState, manifest: UnreadManifest): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const section of UNREAD_COLLECTIONS) {
    const items = manifest[section];
    if (!Array.isArray(items)) {
      counts[section] = 0;
      continue;
    }
    const lastVisit = state.lastVisitedSections?.[section] ?? 0;
    let count = 0;
    for (const item of items) {
      if (!item || !item.url) continue;
      const isNew = lastVisit === 0 ? true : (item.date ?? 0) > lastVisit;
      const isUnvisited = !state.visitedItems?.[normalizePath(item.url)];
      if (isNew && isUnvisited) count++;
    }
    counts[section] = count;
  }
  return counts;
}

/**
 * Reads the opt-in notification state and cached manifest from localStorage.
 * Returns null without consent or without a cached manifest (nothing is ever written here).
 */
export function readUnreadCounts(): Record<string, number> | null {
  try {
    const rawState = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!rawState) return null;
    const state = JSON.parse(rawState) as UnreadState | null;
    if (!state || state.enabled !== true) return null;
    const rawManifest = localStorage.getItem(MANIFEST_CACHE_KEY);
    if (!rawManifest) return null;
    const manifest = JSON.parse(rawManifest) as UnreadManifest | null;
    if (!manifest) return null;
    return countUnreadBySection(state, manifest);
  } catch {
    return null;
  }
}
