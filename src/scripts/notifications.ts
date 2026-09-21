interface NotificationState {
  enabled: boolean;
  firstVisitTime: number;
  lastVisitedSections: Record<string, number>;
  visitedItems: Record<string, number>;
}

interface ManifestItem {
  id: string;
  url: string;
  date: number;
  title?: string;
  description?: string;
  image?: string;
}

interface ContentManifest {
  posts: ManifestItem[];
  presentations: ManifestItem[];
  courses: ManifestItem[];
  projects: ManifestItem[];
  services: ManifestItem[];
  publications: ManifestItem[];
  visualizations: ManifestItem[];
}

interface FeedItem {
  id: string;
  url: string;
  title: string;
  description?: string;
  image?: string;
  section: string;
  date: number;
  isUnread: boolean;
}

const STORAGE_KEY = 'gh_site_notifications_v1';
const MANIFEST_CACHE_KEY = 'gh_content_manifest_cache';
const SECTIONS = ['posts', 'presentations', 'courses', 'projects', 'services', 'publications', 'visualizations'];

const SECTION_CONFIG: Record<string, { label: string; badgeClass: string; icon: string }> = {
  posts: { 
    label: 'Post', 
    badgeClass: 'bg-blue-500/15 text-blue-400 light:text-blue-700 border border-blue-500/25',
    icon: '📝'
  },
  publications: { 
    label: 'Publication', 
    badgeClass: 'bg-purple-500/15 text-purple-400 light:text-purple-700 border border-purple-500/25',
    icon: '📄'
  },
  presentations: { 
    label: 'Presentation', 
    badgeClass: 'bg-blue-500/15 text-blue-400 light:text-blue-700 border border-blue-500/25',
    icon: '📊'
  },
  courses: { 
    label: 'Course', 
    badgeClass: 'bg-amber-500/15 text-amber-400 light:text-amber-700 border border-amber-500/25',
    icon: '🎓'
  },
  projects: { 
    label: 'Project', 
    badgeClass: 'bg-blue-500/15 text-blue-400 light:text-blue-700 border border-blue-500/25',
    icon: '💻'
  },
  services: { 
    label: 'Service', 
    badgeClass: 'bg-purple-500/15 text-purple-400 light:text-purple-700 border border-purple-500/25',
    icon: '⚙️'
  },
  visualizations: { 
    label: 'Visualization', 
    badgeClass: 'bg-emerald-500/15 text-emerald-400 light:text-emerald-700 border border-emerald-500/25',
    icon: '📈'
  }
};

function getStorageState(): NotificationState | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed && parsed.enabled === true) {
        return parsed;
      }
      // If data exists but was not explicitly opted in, clean up legacy unconsented data!
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(MANIFEST_CACHE_KEY);
    }
  } catch (e) {
    console.error('Failed to read notifications state from localStorage', e);
  }
  
  // Default state is null (Strict Opt-In, 0 Bytes written without consent)
  return null;
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
    // Try fallback from cache if available
    try {
      const cached = localStorage.getItem(MANIFEST_CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  }
}

function normalizePath(path: string): string {
  let normalized = path.replace(/\/$/, '');
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  return normalized;
}

function formatItemDate(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = Date.now();
  const diffHours = Math.floor((now - timestamp) / (1000 * 60 * 60));
  if (diffHours >= 0 && diffHours < 24) return 'Today';
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 14) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function hideAllIndicators() {
  const unreadDots = document.querySelectorAll('.unread-dot');
  unreadDots.forEach(dot => dot.classList.add('hidden'));

  const desktopBtn = document.getElementById('whats-new-btn-desktop');
  const mobileBtn = document.getElementById('whats-new-btn-mobile');
  desktopBtn?.classList.remove('whats-new-luminous');
  mobileBtn?.classList.remove('whats-new-luminous');

  const countPill = document.getElementById('whats-new-count-pill');
  countPill?.classList.add('hidden');

  const markReadBtn = document.getElementById('whats-new-mark-read-btn');
  markReadBtn?.classList.add('hidden');

  const hintBanner = document.getElementById('whats-new-tracking-hint');
  hintBanner?.classList.remove('hidden');
}

function renderPopoverList(items: FeedItem[], isTracking: boolean, unreadCount: number) {
  const listEl = document.getElementById('whats-new-list');
  if (!listEl) return;

  let displayItems: FeedItem[] = [];
  if (isTracking && unreadCount > 0) {
    const unread = items.filter(it => it.isUnread);
    const read = items.filter(it => !it.isUnread);
    displayItems = [...unread, ...read].slice(0, 8);
  } else {
    displayItems = items.slice(0, 6);
  }

  if (displayItems.length === 0) {
    listEl.innerHTML = `
      <div class="py-8 text-center text-gray-400 light:text-slate-500">
        <p class="text-sm font-medium">No updates available at this moment.</p>
      </div>
    `;
    return;
  }

  let html = '';

  if (isTracking && unreadCount === 0) {
    html += `
      <div class="mx-1 mb-2 px-3 py-2 rounded-xl bg-white/5 light:bg-slate-100/70 border border-white/5 light:border-slate-200/60 flex items-center justify-between text-xs text-gray-400 light:text-slate-600">
        <span class="flex items-center gap-1.5 font-medium text-emerald-400 light:text-emerald-600">
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          All caught up!
        </span>
        <span class="text-[11px] text-gray-400 light:text-slate-400">Recent updates:</span>
      </div>
    `;
  }

  html += displayItems.map(item => {
    const config = SECTION_CONFIG[item.section] || { 
      label: item.section, 
      badgeClass: 'bg-blue-500/15 text-blue-400 light:text-blue-700 border border-blue-500/25',
      icon: '📌'
    };
    const dateFormatted = formatItemDate(item.date);

    return `
      <a 
        href="${item.url}" 
        class="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/5 light:hover:bg-slate-100 transition-all border border-transparent hover:border-white/5 light:hover:border-slate-200 cursor-pointer"
      >
        ${item.image ? `
          <div class="w-[116px] h-[74px] rounded-lg overflow-hidden shrink-0 border border-white/10 light:border-slate-200 bg-slate-900/50 light:bg-slate-100 flex items-center justify-center">
            <img 
              src="${item.image}" 
              alt="${escapeHtml(item.title)}" 
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
              loading="lazy"
            />
          </div>
        ` : `
          <div class="w-[116px] h-[74px] rounded-lg overflow-hidden shrink-0 border border-white/10 light:border-slate-200 bg-white/5 light:bg-slate-100 flex items-center justify-center text-gray-400 light:text-slate-500">
            <span class="text-xl">${config.icon}</span>
          </div>
        `}
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-1.5 mb-1">
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.badgeClass}">
              ${config.label}
            </span>
            <div class="flex items-center gap-1.5">
              <span class="text-[11px] text-gray-400 light:text-slate-400">
                ${dateFormatted}
              </span>
              ${item.isUnread ? `
                <span class="w-2 h-2 rounded-full bg-brand-blue shadow-[0_0_8px_rgba(59,130,246,0.8)] shrink-0" title="Unread"></span>
              ` : ''}
            </div>
          </div>
          <h4 class="text-xs font-semibold text-gray-200 light:text-slate-900 group-hover:text-brand-blue light:group-hover:text-brand-blue transition-colors line-clamp-1 leading-snug">
            ${escapeHtml(item.title)}
          </h4>
          ${item.description ? `
            <p class="text-[11px] text-gray-400 light:text-slate-500 line-clamp-2 mt-0.5 leading-snug font-normal">
              ${escapeHtml(item.description)}
            </p>
          ` : ''}
        </div>
      </a>
    `;
  }).join('');

  listEl.innerHTML = html;
}

function setupMarkAllAsRead(manifest: ContentManifest) {
  const markReadBtn = document.getElementById('whats-new-mark-read-btn');
  if (!markReadBtn) return;

  const clone = markReadBtn.cloneNode(true) as HTMLElement;
  markReadBtn.replaceWith(clone);

  clone.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    let state = getStorageState();
    if (!state || state.enabled !== true) return;

    const now = Date.now();
    SECTIONS.forEach(s => {
      state!.lastVisitedSections[s] = now;
    });

    (Object.keys(manifest) as Array<keyof ContentManifest>).forEach(key => {
      const list = manifest[key];
      if (Array.isArray(list)) {
        list.forEach((item: ManifestItem) => {
          if (item && item.url) {
            state!.visitedItems[normalizePath(item.url)] = now;
          }
        });
      }
    });

    saveStorageState(state);
    initNotifications();
  });
}

async function initNotifications() {
  const state = getStorageState();
  const isTracking = !!(state && state.enabled === true);

  if (!isTracking) {
    hideAllIndicators();
  }

  const currentPath = normalizePath(window.location.pathname);
  const parts = currentPath.split('/').filter(Boolean);
  
  // 1. Detect and update visit state (only when opted in)
  if (isTracking) {
    if (parts.length === 1 && SECTIONS.includes(parts[0])) {
      state!.lastVisitedSections[parts[0]] = Date.now();
      saveStorageState(state!);
    } else if (
      (parts.length === 2 && SECTIONS.includes(parts[0])) ||
      (parts.length === 3 && parts[0] === 'services')
    ) {
      const subpath = parts[1];
      if (subpath !== 'tags' && subpath !== 'page') {
        state!.visitedItems[currentPath] = Date.now();
        saveStorageState(state!);
      }
    }
  }

  // 2. Fetch the manifest and compute unread state
  const manifest = await fetchManifest();
  if (manifest) {
    if (isTracking) {
      try {
        localStorage.setItem(MANIFEST_CACHE_KEY, JSON.stringify(manifest));
      } catch (e) {
        console.error('Failed to cache content manifest', e);
      }
    }

    const allFeedItems: FeedItem[] = [];
    let unreadCount = 0;

    SECTIONS.forEach(section => {
      const items = manifest[section as keyof ContentManifest] || [];
      const lastVisit = isTracking && state!.lastVisitedSections[section] !== undefined
        ? state!.lastVisitedSections[section]
        : 0;

      items.forEach(item => {
        const itemUrl = normalizePath(item.url);
        const isNew = isTracking ? (lastVisit === 0 ? true : item.date > lastVisit) : false;
        const isUnvisited = isTracking ? !state!.visitedItems[itemUrl] : false;
        const isUnread = isTracking && isNew && isUnvisited;

        if (isUnread) {
          unreadCount++;
        }

        allFeedItems.push({
          id: item.id,
          url: item.url,
          title: item.title || item.id,
          description: item.description || '',
          image: item.image,
          section,
          date: item.date || 0,
          isUnread
        });
      });
    });

    allFeedItems.sort((a, b) => b.date - a.date);

    // Update Sparkle buttons & UI states
    const desktopBtn = document.getElementById('whats-new-btn-desktop');
    const mobileBtn = document.getElementById('whats-new-btn-mobile');
    const countPill = document.getElementById('whats-new-count-pill');
    const hintBanner = document.getElementById('whats-new-tracking-hint');
    const markReadBtn = document.getElementById('whats-new-mark-read-btn');

    if (isTracking && unreadCount > 0) {
      desktopBtn?.classList.add('whats-new-luminous');
      mobileBtn?.classList.add('whats-new-luminous');
      const titleText = `What's New (${unreadCount} unread)`;
      desktopBtn?.setAttribute('title', titleText);
      desktopBtn?.setAttribute('aria-label', titleText);
      mobileBtn?.setAttribute('title', titleText);
      mobileBtn?.setAttribute('aria-label', titleText);

      if (countPill) {
        countPill.textContent = `${unreadCount} new`;
        countPill.classList.remove('hidden');
      }
      markReadBtn?.classList.remove('hidden');
    } else {
      desktopBtn?.classList.remove('whats-new-luminous');
      mobileBtn?.classList.remove('whats-new-luminous');
      const titleText = "What's New";
      desktopBtn?.setAttribute('title', titleText);
      desktopBtn?.setAttribute('aria-label', titleText);
      mobileBtn?.setAttribute('title', titleText);
      mobileBtn?.setAttribute('aria-label', titleText);

      countPill?.classList.add('hidden');
      markReadBtn?.classList.add('hidden');
    }

    if (!isTracking) {
      hintBanner?.classList.remove('hidden');
    } else {
      hintBanner?.classList.add('hidden');
    }

    renderPopoverList(allFeedItems, isTracking, unreadCount);
    setupMarkAllAsRead(manifest);
  }

  // 3. Update unread indicator dots on individual page cards
  const unreadDots = document.querySelectorAll('.unread-dot');
  unreadDots.forEach(dot => {
    if (!isTracking) {
      dot.classList.add('hidden');
      return;
    }
    const rawUrl = dot.getAttribute('data-item-url');
    if (rawUrl) {
      const itemUrl = normalizePath(rawUrl);
      const isVisited = !!state!.visitedItems[itemUrl];
      if (!isVisited) {
        dot.classList.remove('hidden');
      } else {
        dot.classList.add('hidden');
      }
    }
  });
}

// Run when script is loaded and on Astro view transitions
initNotifications();
document.addEventListener('astro:page-load', initNotifications);

// Listen to live toggles from Privacy Modal
window.addEventListener('gh-notifications-toggle', () => {
  initNotifications();
});
