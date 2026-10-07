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
      customProperties: () => ({
        theme_setting: document.documentElement.getAttribute('data-theme-setting') || 'system',
        theme_resolved: document.documentElement.classList.contains('light') ? 'light' : 'dark',
        screen_bucket: getScreenBucket(window.innerWidth),
        screen_orientation: getScreenOrientation(),
      }),
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

