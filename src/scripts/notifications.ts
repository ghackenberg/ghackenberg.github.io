interface NotificationState {
  firstVisitTime: number;
  lastVisitedSections: Record<string, number>;
  visitedItems: Record<string, number>;
}

interface ManifestItem {
  id: string;
  url: string;
  date: number;
}

interface ContentManifest {
  posts: ManifestItem[];
  courses: ManifestItem[];
  projects: ManifestItem[];
  services: ManifestItem[];
  publications: ManifestItem[];
  visualizations: ManifestItem[];
}

const STORAGE_KEY = 'gh_site_notifications_v1';
const MANIFEST_CACHE_KEY = 'gh_content_manifest_cache';
const SECTIONS = ['posts', 'courses', 'projects', 'services', 'publications', 'visualizations'];

function getStorageState(): NotificationState {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to read notifications state from localStorage', e);
  }
  
  // Default state if not found
  const defaultState: NotificationState = {
    firstVisitTime: Date.now(),
    lastVisitedSections: {},
    visitedItems: {}
  };
  
  saveStorageState(defaultState);
  return defaultState;
}

function saveStorageState(state: NotificationState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save notifications state to localStorage', e);
  }
}

async function fetchManifest(): Promise<ContentManifest | null> {
  try {
    const res = await fetch('/content-manifest.json');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('Failed to fetch content manifest', e);
    return null;
  }
}

function normalizePath(path: string): string {
  // Strip trailing slashes and normalize base
  let normalized = path.replace(/\/$/, '');
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  return normalized;
}

async function initNotifications() {
  const state = getStorageState();
  const currentPath = normalizePath(window.location.pathname);
  const parts = currentPath.split('/').filter(Boolean);
  
  // 1. Detect and update visit state
  if (parts.length === 1 && SECTIONS.includes(parts[0])) {
    // We are on a section list page (e.g. /posts)
    const section = parts[0];
    state.lastVisitedSections[section] = Date.now();
    saveStorageState(state);
  } else if (parts.length === 2 && SECTIONS.includes(parts[0])) {
    // We are on a detail page (e.g. /posts/some-post-slug)
    // Exclude auxiliary paths like tags or pages if any
    const section = parts[0];
    const subpath = parts[1];
    if (subpath !== 'tags' && subpath !== 'page') {
      state.visitedItems[currentPath] = Date.now();
      saveStorageState(state);
    }
  }

  // 2. Fetch the manifest and update navbar badges
  const manifest = await fetchManifest();
  if (manifest) {
    try {
      localStorage.setItem(MANIFEST_CACHE_KEY, JSON.stringify(manifest));
    } catch (e) {
      console.error('Failed to cache content manifest', e);
    }
    SECTIONS.forEach(section => {
      const items = manifest[section as keyof ContentManifest] || [];
      // If the user has never visited this section, treat lastVisit as 0 (counting all items as new/unread)
      const lastVisit = state.lastVisitedSections[section] !== undefined
        ? state.lastVisitedSections[section]
        : 0;
      
      // Count items added since last visit that the user hasn't visited individually
      const newItemsCount = items.filter(item => {
        const itemUrl = normalizePath(item.url);
        const isNew = lastVisit === 0 ? true : item.date > lastVisit;
        const isUnvisited = !state.visitedItems[itemUrl];
        return isNew && isUnvisited;
      }).length;
      
      // Update badge UI elements
      const badges = document.querySelectorAll(`.nav-badge[data-section="${section}"]`);
      badges.forEach(badge => {
        if (newItemsCount > 0) {
          badge.textContent = String(newItemsCount);
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      });
    });
  }

  // 3. Update unread indicator dots on the page
  const unreadDots = document.querySelectorAll('.unread-dot');
  unreadDots.forEach(dot => {
    const rawUrl = dot.getAttribute('data-item-url');
    if (rawUrl) {
      const itemUrl = normalizePath(rawUrl);
      const isVisited = !!state.visitedItems[itemUrl];
      if (!isVisited) {
        dot.classList.remove('hidden');
      } else {
        dot.classList.add('hidden');
      }
    }
  });
}

// Run when script is loaded
initNotifications();
