import { init as initPlausible, track as trackPlausible } from '@plausible-analytics/tracker';

/**
 * Telemetry and Semantic Analytics Utility
 * Provides lightweight, privacy-friendly event tracking via official Plausible client tracker.
 */

declare global {
  interface Navigator {
    globalPrivacyControl?: boolean;
  }
}

/**
 * Computes screen orientation (landscape or portrait).
 */
export function getScreenOrientation(): string {
  if (typeof window === 'undefined') return 'landscape';
  return window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait';
}

/**
 * Computes the responsive Tailwind breakpoint bucket for a given viewport width.
 */
export function getScreenBucket(width: number): string {
  if (width < 640) return 'xs (<640px)';
  if (width < 768) return 'sm (640-767px)';
  if (width < 1024) return 'md (768-1023px)';
  if (width < 1280) return 'lg (1024-1279px)';
  if (width < 1536) return 'xl (1280-1535px)';
  return '2xl (>=1536px)';
}

function normalizeInternalPathname(rawPathname: string): string {
  const clean = (rawPathname || '/').split('?')[0].split('#')[0].trim() || '/';
  const withLeading = clean.startsWith('/') ? clean : `/${clean}`;
  if (withLeading === '/') return '/';
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

function hashToSixCharBase36(seed: string): string {
  let h1 = 2166136261;
  let h2 = 16777619;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 16777619);
    h2 = Math.imul(h2 ^ ch, 2166136261);
  }
  const combined = (Math.abs(h1) * 65536 + (Math.abs(h2) & 65535)) >>> 0;
  return combined.toString(36).padStart(6, '0').slice(0, 6).toLowerCase();
}

/**
 * Computes the normalized internal referrer pathname if the visitor navigated
 * from another page on the same origin, or '(none)' for external/direct entries.
 */
export function getInternalReferrerPath(): string {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !document.referrer) {
    return '(none)';
  }
  try {
    const refUrl = new URL(document.referrer);
    if (refUrl.origin !== window.location.origin) {
      return '(none)';
    }
    return normalizeInternalPathname(refUrl.pathname || '/');
  } catch {
    return '(none)';
  }
}

function readSpanFromNavigationApi(
  currentNormPath: string
): { flowId: string; stepInt: number } | null {
  try {
    const nav = window.navigation;
    if (!nav || typeof nav.entries !== 'function') return null;

    const allEntries = nav.entries();
    if (!Array.isArray(allEntries) || allEntries.length === 0) return null;

    const maxIdx =
      typeof nav.currentEntry?.index === 'number'
        ? nav.currentEntry.index
        : allEntries.length - 1;
    const activeSlice = allEntries.slice(0, maxIdx + 1);

    const collapsedPaths: string[] = [];
    let firstOriginEntryKey = '';

    for (const entry of activeSlice) {
      if (!entry?.url) continue;
      try {
        const parsed = new URL(entry.url, window.location.origin);
        if (parsed.origin !== window.location.origin) continue;
        if (!firstOriginEntryKey) {
          firstOriginEntryKey = String(entry.key || entry.id || entry.url);
        }
        const normP = normalizeInternalPathname(parsed.pathname);
        if (
          collapsedPaths.length === 0 ||
          collapsedPaths[collapsedPaths.length - 1] !== normP
        ) {
          collapsedPaths.push(normP);
        }
      } catch {
        // ignore malformed entry URL
      }
    }

    if (!firstOriginEntryKey) return null;

    if (
      collapsedPaths.length === 0 ||
      collapsedPaths[collapsedPaths.length - 1] !== currentNormPath
    ) {
      collapsedPaths.push(currentNormPath);
    }

    const flowId = hashToSixCharBase36(firstOriginEntryKey);
    return {
      flowId,
      stepInt: collapsedPaths.length,
    };
  } catch {
    return null;
  }
}

/**
 * Computes the ephemeral tab navigation span (`flow_id`, `flow_step`)
 * using a monotonic step counter in the browser's ephemeral `window.name`
 * browsing-context property (with read-after-write verification), falling back
 * to `window.navigation.entries()` if `window.name` is blocked, or returning `null`
 * if neither mechanism is available — using zero cookies, zero localStorage, and zero sessionStorage.
 */
export function getNavigationFlowSpan(): {
  flowId: string;
  flowStep: string;
} | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const currentNormPath = normalizeInternalPathname(window.location.pathname || '/');
  const navApiSpan = readSpanFromNavigationApi(currentNormPath);

  // 1. Primary: Monotonic step counter in ephemeral `window.name` (`gh_flow:<6charFlowId>:<stepInt>:<lastNormPath>`)
  // with strict read-after-write verification to detect browsers/extensions blocking `window.name`.
  try {
    const prefix = 'gh_flow:';
    const rawName = typeof window.name === 'string' ? window.name : '';
    if (rawName.startsWith(prefix)) {
      const rest = rawName.slice(prefix.length);
      const firstColon = rest.indexOf(':');
      const secondColon = firstColon > -1 ? rest.indexOf(':', firstColon + 1) : -1;
      if (firstColon === 6 && secondColon > firstColon) {
        const flowId = rest.slice(0, 6);
        const parsedStep = parseInt(rest.slice(firstColon + 1, secondColon), 10);
        const lastNormPath = normalizeInternalPathname(rest.slice(secondColon + 1));
        if (/^[a-z0-9]{6}$/i.test(flowId) && Number.isFinite(parsedStep) && parsedStep >= 1) {
          if (lastNormPath !== currentNormPath) {
            const nextStepInt = parsedStep + 1;
            const nextName = `${prefix}${flowId}:${nextStepInt}:${currentNormPath}`;
            window.name = nextName;
            if (window.name === nextName) {
              return {
                flowId,
                flowStep: String(nextStepInt),
              };
            }
          } else {
            return {
              flowId,
              flowStep: String(parsedStep),
            };
          }
        }
      }
    }

    // Initialize `window.name` from `window.navigation.entries()` (if available)
    // or from a random seed + `getInternalReferrerPath()`, then verify read-after-write.
    let initFlowId = navApiSpan?.flowId || '';
    let initStepInt = navApiSpan?.stepInt || 0;

    if (!initFlowId || initStepInt < 1) {
      const randomSeed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      initFlowId = hashToSixCharBase36(randomSeed);
      const refPath = getInternalReferrerPath();
      initStepInt = refPath !== '(none)' && refPath !== currentNormPath ? 2 : 1;
    }

    const nextName = `${prefix}${initFlowId}:${initStepInt}:${currentNormPath}`;
    window.name = nextName;
    if (window.name === nextName) {
      return {
        flowId: initFlowId,
        flowStep: String(initStepInt),
      };
    }
  } catch {
    // Fall through to Navigation API fallback if window.name throws
  }

  // 2. Fallback: `window.navigation.entries()` when `window.name` is blocked
  if (navApiSpan) {
    return {
      flowId: navApiSpan.flowId,
      flowStep: String(navApiSpan.stepInt),
    };
  }

  // 3. Neither `window.name` nor `window.navigation.entries()` is available/working
  return null;
}

export interface TelemetryEventMap {
  'Section Viewed': {
    id: string;
  };
  'Heading Viewed': {
    id: string;
    level?: string;
  };
  'Card Viewed': {
    id: string;
    collection?: string;
  };
  'Card Clicked': {
    id: string;
    collection?: string;
  };
  'Filter Content': {
    type: 'dropdown' | 'button' | 'reset';
    key?: string;
    value?: string;
    path?: string;
  };
  'Notifications Action': {
    action: 'mark-all-read' | 'dismiss-all' | string;
  };
  'Privacy Action': {
    action: string;
    opted_out?: boolean;
    enabled?: boolean;
    [key: string]: string | number | boolean | undefined;
  };
  'Modal Opened': {
    modal: 'whats-new' | 'privacy' | string;
  };
  'Modal Closed': {
    modal: 'whats-new' | 'privacy' | string;
  };
  'theme-changed': {
    theme_setting: string;
    theme_resolved: string;
    theme_trigger: string;
  };
  'Breakpoint Changed': {
    from: string;
    to: string;
    screen_orientation?: string;
  };
  'Orientation Changed': {
    from: string;
    to: string;
    screen_bucket?: string;
  };
  'Audio Played': {
    presentation: string;
    slide_number: number;
  };
  'Slide Viewed': {
    presentation: string;
    slide_number: number;
    total_slides?: number;
    title?: string;
  };
  'Presentation Completed': {
    presentation: string;
    total_slides?: number;
  };
  'High Intent: Share Presentation': {
    presentation: string;
    slide_number: number;
    cue?: string;
  };
  'High Intent: Copy Email': {
    location?: string;
  };
  'High Intent: Copy BibTeX': {
    id: string;
  };
}

export type KnownTelemetryEvent = keyof TelemetryEventMap;

/**
 * Safely dispatches a typed custom event to Plausible.
 */
export function trackEvent<E extends KnownTelemetryEvent>(
  eventName: E,
  props?: TelemetryEventMap[E]
): void;
export function trackEvent(
  eventName: string,
  props?: Record<string, string | number | boolean | undefined>
): void;
export function trackEvent(
  eventName: string,
  props?: Record<string, string | number | boolean | undefined>
): void {
  try {
    const formattedProps: Record<string, string> | undefined = props
      ? Object.fromEntries(
          Object.entries(props)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [k, String(v)])
        )
      : undefined;

    trackPlausible(eventName, formattedProps ? { props: formattedProps } : {});
  } catch (err) {
    // Fail silently in development or if adblocker interferes
    console.debug(`[Telemetry] Failed to track event "${eventName}":`, err);
  }
}

let isAnalyticsInitialized = false;

/**
 * Initializes Plausible Analytics tracker and responsive viewport/theme listeners.
 */
export function initAnalytics(): void {
  if (typeof window === 'undefined' || isAnalyticsInitialized) return;
  isAnalyticsInitialized = true;

  // Respect Global Privacy Control (GPC) and Do-Not-Track (DNT)
  try {
    if (
      navigator.globalPrivacyControl === true ||
      navigator.doNotTrack === '1' ||
      (window as Window & { doNotTrack?: string }).doNotTrack === '1'
    ) {
      localStorage.setItem('plausible_ignore', 'true');
    }
  } catch {
    // Ignore localStorage access restrictions
  }

  try {
    initPlausible({
      domain: 'hackenberg.tech',
      endpoint: 'https://analytics.mentawise.com/api/event',
      outboundLinks: true,
      fileDownloads: true,
      formSubmissions: true,
      bindToWindow: true,
      customProperties: () => {
        const span = getNavigationFlowSpan();
        const baseProps: Record<string, string> = {
          theme_setting: document.documentElement.getAttribute('data-theme-setting') || 'system',
          theme_resolved: document.documentElement.classList.contains('light') ? 'light' : 'dark',
          screen_bucket: getScreenBucket(window.innerWidth),
          screen_orientation: getScreenOrientation(),
        };
        if (span !== null) {
          baseProps.flow_id = span.flowId;
          baseProps.flow_step = span.flowStep;
        }
        return baseProps;
      },
    });
  } catch (err) {
    console.debug('[Telemetry] Failed to initialize Plausible tracker:', err);
  }

  // Track theme toggle event when it changes dynamically
  window.addEventListener('theme-changed', ((e: CustomEvent<{ themeSetting?: string; resolvedTheme?: string; trigger?: string }>) => {
    trackEvent('theme-changed', {
      theme_setting: e.detail?.themeSetting || 'system',
      theme_resolved: e.detail?.resolvedTheme || 'dark',
      theme_trigger: e.detail?.trigger || 'unknown',
    });
  }) as EventListener);

  // Synchronize screen size and track breakpoint/orientation transitions
  let currentBucket = getScreenBucket(window.innerWidth);
  let currentOrientation = getScreenOrientation();
  let resizeTimeout: number | undefined;

  function handleResize() {
    window.clearTimeout(resizeTimeout);
    resizeTimeout = window.setTimeout(() => {
      const newBucket = getScreenBucket(window.innerWidth);
      const newOrientation = getScreenOrientation();
      const bucketChanged = newBucket !== currentBucket;
      const orientationChanged = newOrientation !== currentOrientation;

      if (bucketChanged || orientationChanged) {
        const prevBucket = currentBucket;
        const prevOrientation = currentOrientation;

        currentBucket = newBucket;
        currentOrientation = newOrientation;

        if (bucketChanged) {
          trackEvent('Breakpoint Changed', {
            from: prevBucket,
            to: newBucket,
            screen_orientation: newOrientation,
          });
        }
        if (orientationChanged) {
          trackEvent('Orientation Changed', {
            from: prevOrientation,
            to: newOrientation,
            screen_bucket: newBucket,
          });
        }
      }
    }, 250);
  }

  window.addEventListener('resize', handleResize, { passive: true });
  window.addEventListener('orientationchange', handleResize, { passive: true });
  window.addEventListener('pageshow', (e: PageTransitionEvent) => {
    if (e.persisted) {
      getNavigationFlowSpan();
    }
  });
}

/**
 * Initializes semantic section visibility tracking.
 * Uses an IntersectionObserver with a 1.5s dwell-time threshold to avoid
 * capturing accidental fast-scrolls. Each section is only tracked once per pageview.
 */
export function initSectionTracking(): void {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

  const trackedSections = new Set<string>();
  const dwellTimers = new Map<Element, number>();

  // Select sections to track:
  // 1. Explicit macro sections rendered via <Section id="..."> ([data-page-section][id])
  // 2. Content headings (h2, h3, h4 with IDs inside article or main, excluding preview cards)
  const candidateElements: HTMLElement[] = [];

  const sections = document.querySelectorAll<HTMLElement>('[data-page-section][id]');
  sections.forEach((el) => {
    // Exclude slides and elements nested inside the presentation player (handled by dedicated Slide Viewed telemetry)
    if (el.closest('#presentation-player, .slide-deck-container') && el.id !== 'presentation-player') {
      return;
    }

    const id = el.id;
    if (id && !trackedSections.has(id)) {
      candidateElements.push(el);
    }
  });

  // Include article and content headings (h2, h3, h4 with IDs)
  const contentHeadings = document.querySelectorAll<HTMLElement>(
    'article :is(h2, h3, h4)[id], .post-body :is(h2, h3, h4)[id], .prose-custom :is(h2, h3, h4)[id], .prose :is(h2, h3, h4)[id], main :is(h2, h3, h4)[id]'
  );
  contentHeadings.forEach((el) => {
    // Exclude headings inside preview-cards / tag-cards (handled by Card Tracking)
    // and headings inside presentation player / slide deck (handled by SlideDeck)
    if (el.closest('.preview-card, .tag-card, #presentation-player, .slide-deck-container, dialog, [role="dialog"], .modal')) return;

    if (el.id && !trackedSections.has(el.id)) {
      candidateElements.push(el);
    }
  });

  if (candidateElements.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const el = entry.target as HTMLElement;
        const sectionId = el.id;

        if (trackedSections.has(sectionId)) {
          observer.unobserve(el);
          return;
        }

        if (entry.isIntersecting) {
          // Start dwell timer (2.0 seconds threshold)
          if (!dwellTimers.has(el)) {
            const timerId = window.setTimeout(() => {
              if (!trackedSections.has(sectionId)) {
                trackedSections.add(sectionId);
                dwellTimers.delete(el);
                observer.unobserve(el);

                const isHeading = /^H[1-6]$/i.test(el.tagName);
                if (isHeading) {
                  trackEvent('Heading Viewed', {
                    id: sectionId,
                    level: el.tagName.toLowerCase(),
                  });
                } else if (el.hasAttribute('data-page-section')) {
                  trackEvent('Section Viewed', {
                    id: sectionId,
                  });
                }
              }
            }, 2000);

            dwellTimers.set(el, timerId);
          }
        } else {
          // If scrolled away before 2.0s, cancel timer
          if (dwellTimers.has(el)) {
            clearTimeout(dwellTimers.get(el));
            dwellTimers.delete(el);
          }
        }
      });
    },
    {
      threshold: 0.5,
      rootMargin: '0px 0px -5% 0px'
    }
  );

  candidateElements.forEach((el) => observer.observe(el));
}

/**
 * Initializes Preview Card impression and click tracking for catalog / discovery feeds
 * (Homepage, Posts, Courses, Projects, Publications, Visualizations, Services).
 * 
 * - Card Viewed: Fired once per card when visible >= 50% for at least 1.5 seconds.
 * - Card Clicked: Fired when the user clicks or navigates via a teaser card.
 * Enables Click-Through-Rate (CTR = Card Clicked / Card Viewed) telemetry.
 */
export function initCardTracking(): void {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

  const trackedCards = new Set<string>();
  const dwellTimers = new Map<Element, number>();

  const cards = document.querySelectorAll<HTMLElement>('.preview-card[data-card-id], [data-card-id]');
  if (cards.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const el = entry.target as HTMLElement;
        const cardId = el.getAttribute('data-card-id');
        if (!cardId) return;

        if (trackedCards.has(cardId)) {
          observer.unobserve(el);
          return;
        }

        if (entry.isIntersecting) {
          // 1.5 second dwell time to capture intentional consideration
          if (!dwellTimers.has(el)) {
            const timerId = window.setTimeout(() => {
              if (!trackedCards.has(cardId)) {
                trackedCards.add(cardId);
                dwellTimers.delete(el);
                observer.unobserve(el);

                const collection = el.getAttribute('data-collection') || 'content';

                trackEvent('Card Viewed', {
                  id: cardId,
                  collection
                });
              }
            }, 1500);

            dwellTimers.set(el, timerId);
          }
        } else {
          if (dwellTimers.has(el)) {
            clearTimeout(dwellTimers.get(el));
            dwellTimers.delete(el);
          }
        }
      });
    },
    {
      threshold: 0.5,
      rootMargin: '0px 0px 0px 0px'
    }
  );

  cards.forEach((el) => observer.observe(el));

  // Delegate click tracking for preview cards to compute CTR
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Ignore clicks on inner secondary links (e.g. tag filter badges)
    if (target.closest('a[href*="/tags/"], .tag-badge, [data-prevent-card-click]')) {
      return;
    }

    const card = target.closest<HTMLElement>('.preview-card[data-card-id], [data-card-id]');
    if (!card) return;

    const cardId = card.getAttribute('data-card-id');
    if (!cardId) return;

    const collection = card.getAttribute('data-collection') || 'content';

    trackEvent('Card Clicked', {
      id: cardId,
      collection
    });
  });
}

/**
 * Initializes generic declarative click tracking for any element with `data-track-event`.
 * 
 * Convention:
 * - `data-track-event="Event Name"` (Mandatory)
 * - `data-track-props='{"key": "value"}'` (Optional JSON string)
 * - `data-track-<prop-name>="value"` (Optional individual properties, e.g. data-track-location="footer" -> { location: "footer" })
 */
export function initDeclarativeClickTracking(): void {
  if (typeof document === 'undefined') return;

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const trackEl = target.closest<HTMLElement>('[data-track-event]');
    if (!trackEl) return;

    const eventName = trackEl.getAttribute('data-track-event');
    if (!eventName) return;

    const props: Record<string, string | number | boolean> = {};

    // 1. Parse JSON properties if present
    const rawJsonProps = trackEl.getAttribute('data-track-props');
    if (rawJsonProps) {
      try {
        Object.assign(props, JSON.parse(rawJsonProps));
      } catch (err) {
        console.warn('[Telemetry] Invalid JSON in data-track-props:', rawJsonProps);
      }
    }

    // 2. Extract individual data-track-* attributes
    const attributes = trackEl.attributes;
    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes[i];
      if (attr.name.startsWith('data-track-') && attr.name !== 'data-track-event' && attr.name !== 'data-track-props') {
        const propKey = attr.name.slice('data-track-'.length).replace(/-/g, '_');
        if (!(propKey in props)) {
          props[propKey] = attr.value;
        }
      }
    }

    trackEvent(eventName, props);
  });
}

/**
 * Initializes fallback tracking for high-intent copy interactions (Email, BibTeX, etc.)
 * Only fires if the element does not already declare `data-track-event`.
 */
export function initCopyTracking(): void {
  if (typeof document === 'undefined') return;

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Contact Email Copy buttons
    const emailBtn = target.closest('#copy-email-btn, [data-copy-email], .copy-email-btn');
    if (emailBtn && !emailBtn.hasAttribute('data-track-event')) {
      const location = emailBtn.getAttribute('data-copy-location') || (emailBtn.closest('#contact') ? 'home-contact' : 'page');
      trackEvent('High Intent: Copy Email', { location });
      return;
    }

    // BibTeX copy buttons
    const bibtexBtn = target.closest('[data-copy-bibtex], .copy-bibtex-btn');
    if (bibtexBtn && !bibtexBtn.hasAttribute('data-track-event')) {
      const pubId = bibtexBtn.getAttribute('data-pub-id') || bibtexBtn.getAttribute('data-pub-title') || 'publication';
      trackEvent('High Intent: Copy BibTeX', { id: pubId });
    }
  });
}

/**
 * Auto-initialize when the script loads
 */
if (typeof window !== 'undefined') {
  initAnalytics();

  function onReady(fn: () => void) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onReady(() => {
    initSectionTracking();
    initCardTracking();
    initDeclarativeClickTracking();
    initCopyTracking();
  });
}

