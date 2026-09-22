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

const SECTION_CONFIG: Record<string, { label: string; badgeClass: string; icon: string; actionText: string }> = {
  posts: { 
    label: 'Post', 
    badgeClass: 'bg-blue-500/15 text-blue-400 light:text-blue-700 border border-blue-500/25',
    icon: '📝',
    actionText: 'Read Post'
  },
  publications: { 
    label: 'Publication', 
    badgeClass: 'bg-purple-500/15 text-purple-400 light:text-purple-700 border border-purple-500/25',
    icon: '📄',
    actionText: 'View Publication'
  },
  presentations: { 
    label: 'Presentation', 
    badgeClass: 'bg-blue-500/15 text-blue-400 light:text-blue-700 border border-blue-500/25',
    icon: '📊',
    actionText: 'View Presentation'
  },
  courses: { 
    label: 'Course', 
    badgeClass: 'bg-amber-500/15 text-amber-400 light:text-amber-700 border border-amber-500/25',
    icon: '🎓',
    actionText: 'Explore Course'
  },
  projects: { 
    label: 'Project', 
    badgeClass: 'bg-blue-500/15 text-blue-400 light:text-blue-700 border border-blue-500/25',
    icon: '💻',
    actionText: 'Open Project'
  },
  services: { 
    label: 'Service', 
    badgeClass: 'bg-purple-500/15 text-purple-400 light:text-purple-700 border border-purple-500/25',
    icon: '⚙️',
    actionText: 'View Service'
  },
  visualizations: { 
    label: 'Visualization', 
    badgeClass: 'bg-emerald-500/15 text-emerald-400 light:text-emerald-700 border border-emerald-500/25',
    icon: '📈',
    actionText: 'Open Tool'
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
  document.documentElement.classList.remove('has-unread-notifications');

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

  renderActivityFeed([], false, 0);
}

function getUnreadBadgeClass(section: string): string {
  if (section === 'courses') return 'badge-new-yellow';
  if (section === 'services' || section === 'publications') return 'badge-new-purple';
  if (section === 'visualizations') return 'badge-new-green';
  return 'badge-new-blue';
}

function renderActivityFeed(items: FeedItem[], isTracking: boolean, unreadCount: number) {
  const listEl = document.getElementById('whats-new-list');
  if (!listEl) return;

  // Case 1: Read tracking is disabled -> show no items, show clean prompt to activate tracking
  if (!isTracking) {
    listEl.innerHTML = `
      <div class="py-16 px-6 text-center glass-card rounded-3xl border border-white/10 light:border-slate-200/80 p-8 max-w-lg mx-auto shadow-xl">
        <div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-brand-blue/15 text-brand-blue flex items-center justify-center border border-brand-blue/30 shadow-inner">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <h3 class="text-lg font-bold text-gray-100 light:text-slate-900 mb-2">Read Tracking is Disabled</h3>
        <p class="text-xs sm:text-sm text-gray-400 light:text-slate-600 leading-relaxed mb-6">
          To highlight new articles, presentations, and courses since your last visit, please enable read tracking in your Privacy Settings. 100% private, stored only in your browser.
        </p>
        <button 
          type="button" 
          data-open-privacy-modal 
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-blue text-white font-semibold text-xs sm:text-sm hover:bg-brand-blue/90 transition-all shadow-lg shadow-brand-blue/25 cursor-pointer active:scale-95"
        >
          <span>Open Privacy Settings</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    `;
    return;
  }

  // Case 2: Tracking enabled, but all items are read -> show no items, show "All caught up"
  if (unreadCount === 0) {
    listEl.innerHTML = `
      <div class="py-16 px-6 text-center glass-card rounded-3xl border border-white/10 light:border-slate-200/80 p-8 max-w-lg mx-auto shadow-xl">
        <div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-500/15 text-emerald-400 light:text-emerald-600 flex items-center justify-center border border-emerald-500/30 shadow-inner">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="text-lg font-bold text-gray-100 light:text-slate-900 mb-2">You're all caught up!</h3>
        <p class="text-xs sm:text-sm text-gray-400 light:text-slate-600 leading-relaxed">
          There are currently no unread updates. New blog posts, research publications, presentations, courses, and tools will appear here as soon as they are published.
        </p>
      </div>
    `;
    return;
  }

  // Case 3: Tracking enabled and there are unread items -> Show ONLY unread items
  const unreadItems = items.filter(it => it.isUnread);
  const displayItems = unreadItems.slice(0, 30);

  const html = displayItems.map(item => {
    const config = SECTION_CONFIG[item.section] || { 
      label: item.section, 
      badgeClass: 'bg-blue-500/15 text-blue-400 light:text-blue-700 border border-blue-500/25',
      icon: '📌',
      actionText: 'Open'
    };
    const dateFormatted = formatItemDate(item.date);

    return `
      <a 
        href="${item.url}" 
        class="group block p-4 sm:p-5 rounded-2xl border transition-all duration-300 cursor-pointer border-brand-blue/50 bg-brand-blue/[0.04] shadow-lg shadow-brand-blue/5 hover:border-brand-blue/80 light:bg-blue-50/40 light:border-brand-blue/30"
      >
        <div class="flex flex-col sm:flex-row items-stretch gap-4 sm:gap-5">
          <!-- Preview Image: 16:9 on mobile, Compact Square (matching text height) on Desktop -->
          <div class="w-full aspect-video sm:w-36 sm:h-36 md:w-40 md:h-40 sm:aspect-square rounded-xl overflow-hidden shrink-0 border border-white/10 light:border-slate-200 bg-slate-900/60 light:bg-slate-100 flex items-center justify-center relative shadow-sm">
            ${item.image ? `
              <img 
                src="${item.image}" 
                alt="${escapeHtml(item.title)}" 
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                loading="lazy"
              />
            ` : `
              <span class="text-3xl">${config.icon}</span>
            `}
            <span class="badge-new ${getUnreadBadgeClass(item.section)} badge-corner-tr">UNREAD</span>
          </div>

          <!-- Content Details: Fixed height perfectly matching the square image -->
          <div class="flex-1 min-w-0 flex flex-col justify-between py-0.5 sm:h-36 md:h-40">
            <div>
              <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full ${config.badgeClass}">
                  ${config.label}
                </span>
                <span class="text-xs text-gray-400 light:text-slate-400 font-medium">
                  ${dateFormatted}
                </span>
              </div>

              <h3 class="text-base font-bold text-gray-100 light:text-slate-900 group-hover:text-brand-blue light:group-hover:text-brand-blue transition-colors line-clamp-2 leading-snug">
                ${escapeHtml(item.title)}
              </h3>

              ${item.description ? `
                <p class="text-xs text-gray-400 light:text-slate-600 line-clamp-2 mt-1 leading-relaxed font-normal">
                  ${escapeHtml(item.description)}
                </p>
              ` : ''}
            </div>

            <div class="mt-2 flex items-center text-xs font-semibold text-brand-blue group-hover:translate-x-1 transition-transform">
              <span>${config.actionText}</span>
              <svg class="w-3.5 h-3.5 ml-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </div>
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
    const hintBanner = document.getElementById('whats-new-tracking-hint');
    const markReadBtn = document.getElementById('whats-new-mark-read-btn');

    if (isTracking && unreadCount > 0) {
      document.documentElement.classList.add('has-unread-notifications');
      desktopBtn?.classList.add('whats-new-luminous');
      mobileBtn?.classList.add('whats-new-luminous');
      const titleText = `Content Updates (${unreadCount} unread)`;
      desktopBtn?.setAttribute('title', titleText);
      desktopBtn?.setAttribute('aria-label', titleText);
      mobileBtn?.setAttribute('title', titleText);
      mobileBtn?.setAttribute('aria-label', titleText);

      markReadBtn?.classList.remove('hidden');
    } else {
      document.documentElement.classList.remove('has-unread-notifications');
      desktopBtn?.classList.remove('whats-new-luminous');
      mobileBtn?.classList.remove('whats-new-luminous');
      const titleText = "Content Updates";
      desktopBtn?.setAttribute('title', titleText);
      desktopBtn?.setAttribute('aria-label', titleText);
      mobileBtn?.setAttribute('title', titleText);
      mobileBtn?.setAttribute('aria-label', titleText);

      markReadBtn?.classList.add('hidden');
    }

    if (!isTracking) {
      hintBanner?.classList.remove('hidden');
    } else {
      hintBanner?.classList.add('hidden');
    }

    renderActivityFeed(allFeedItems, isTracking, unreadCount);
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
