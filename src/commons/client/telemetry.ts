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

function normalizeInternalPathname(rawPathname: string): string {
  const clean = (rawPathname || '/').split('?')[0].split('#')[0].trim() || '/';
  const withLeading = clean.startsWith('/') ? clean : `/${clean}`;
  if (withLeading === '/') return '/';
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

/**
 * Computes the normalized previous internal page pathname from `document.referrer`
 * if the visitor navigated from another page on the same origin, or `'(entry)'`
 * for direct/external entries and same-page reloads — using zero cookies,
 * zero localStorage/sessionStorage, zero `window.name`, and zero session/user IDs.
 */
export function getPreviousInternalPage(): string {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !document.referrer) {
    return '(entry)';
  }
  try {
    const refUrl = new URL(document.referrer);
    if (refUrl.origin !== window.location.origin) {
      return '(entry)';
    }
    const refNorm = normalizeInternalPathname(refUrl.pathname || '/');
    const curNorm = normalizeInternalPathname(window.location.pathname || '/');
    if (refNorm === curNorm) {
      return '(entry)';
    }
    return refNorm;
  } catch {
    return '(entry)';
  }
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
  'Human Verified': {
    trigger: 'pointer' | 'scroll' | 'keyboard' | 'touch';
  };
  'Filter Content': {
    type: 'dropdown' | 'button' | 'reset';
    key?: string;
    value?: string;
    path?: string;
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
  'High Intent: Sponsor Click': {
    location?: string;
  };
  'High Intent: Subscribe Newsletter': {
    location?: string;
  };
}

export type KnownTelemetryEvent = keyof TelemetryEventMap;

export interface TrackEventOptions {
  interactive?: boolean;
}

export type EnvTrustLevel = 'standard' | 'suspect';

export interface ClientAutomationSignal {
  dropReason: string | null;
  envTrust: EnvTrustLevel;
  reasons: string[];
}

export interface ClientAutomationEnv {
  webdriver: boolean;
  userAgent: string;
  automationGlobals: string[];
  documentKeys: string[];
  outerWidth: number;
  outerHeight: number;
  innerWidth: number;
  languages: readonly string[] | null;
  hasMatchMedia: boolean;
  hardwareConcurrency: number | null;
}

export type AutomationGlobalValue = string | number | boolean | (() => void) | Record<string, never>;

export interface AutomationWindow extends Window {
  doNotTrack?: string;
  _phantom?: AutomationGlobalValue;
  __nightmare?: AutomationGlobalValue;
  Cypress?: AutomationGlobalValue;
  __plausible?: boolean;
  __playwright__binding__?: AutomationGlobalValue;
  __pwInitScripts?: AutomationGlobalValue;
  domAutomation?: AutomationGlobalValue;
  domAutomationController?: AutomationGlobalValue;
  __puppeteer_evaluation_script__?: AutomationGlobalValue;
}

const NON_INTERACTIVE_EVENTS: ReadonlySet<string> = new Set([
  'Section Viewed',
  'Heading Viewed',
  'Card Viewed',
  'Human Verified',
]);

const AUTOMATION_WINDOW_KEYS = [
  '_phantom',
  '__nightmare',
  'Cypress',
  '__playwright__binding__',
  '__pwInitScripts',
  'domAutomation',
  'domAutomationController',
  '__puppeteer_evaluation_script__',
] as const;

const AUTOMATION_UA_REGEX = /HeadlessChrome|PhantomJS|SlimerJS|CasperJS|Playwright|Puppeteer/i;
const DESKTOP_UA_REGEX = /Windows|Macintosh|X11|Linux/i;
const MOBILE_UA_REGEX = /Mobile|Android|iPhone|iPad/i;

function hasTruthyWindowProp(
  win: AutomationWindow,
  key: (typeof AUTOMATION_WINDOW_KEYS)[number]
): boolean {
  switch (key) {
    case '_phantom':
      return Boolean(win._phantom);
    case '__nightmare':
      return Boolean(win.__nightmare);
    case 'Cypress':
      return Boolean(win.Cypress);
    case '__playwright__binding__':
      return Boolean(win.__playwright__binding__);
    case '__pwInitScripts':
      return Boolean(win.__pwInitScripts);
    case 'domAutomation':
      return Boolean(win.domAutomation);
    case 'domAutomationController':
      return Boolean(win.domAutomationController);
    case '__puppeteer_evaluation_script__':
      return Boolean(win.__puppeteer_evaluation_script__);
  }
}

function readBrowserAutomationEnv(): ClientAutomationEnv | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  const win = window as AutomationWindow;
  const automationGlobals: string[] = [];
  for (const key of AUTOMATION_WINDOW_KEYS) {
    if (key in win && hasTruthyWindowProp(win, key)) {
      automationGlobals.push(key);
    }
  }

  let documentKeys: string[] = [];
  try {
    documentKeys = Object.keys(document);
  } catch {
    documentKeys = [];
  }

  return {
    webdriver: navigator.webdriver === true,
    userAgent: typeof navigator.userAgent === 'string' ? navigator.userAgent : '',
    automationGlobals,
    documentKeys,
    outerWidth: typeof win.outerWidth === 'number' ? win.outerWidth : 0,
    outerHeight: typeof win.outerHeight === 'number' ? win.outerHeight : 0,
    innerWidth: typeof win.innerWidth === 'number' ? win.innerWidth : 0,
    languages: Array.isArray(navigator.languages) ? navigator.languages : null,
    hasMatchMedia: typeof win.matchMedia === 'function',
    hardwareConcurrency:
      typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null,
  };
}

/**
 * Evaluates transient, zero-fingerprinting runtime signals to drop obvious headless/automation
 * traffic via `transformRequest` and classify softer anomalies under `env_trust`.
 */
export function evaluateClientAutomationSignal(env?: ClientAutomationEnv): ClientAutomationSignal {
  const resolved = env ?? readBrowserAutomationEnv();
  if (!resolved) {
    return { dropReason: null, envTrust: 'standard', reasons: [] };
  }

  const reasons: string[] = [];
  let dropReason: string | null = null;

  if (resolved.webdriver) {
    dropReason = 'webdriver';
    reasons.push('navigator.webdriver');
  } else if (AUTOMATION_UA_REGEX.test(resolved.userAgent)) {
    dropReason = 'automation_ua';
    reasons.push('automation_user_agent');
  } else if (resolved.automationGlobals.length > 0) {
    dropReason = 'automation_global';
    reasons.push(`globals:${resolved.automationGlobals.join(',')}`);
  } else if (resolved.documentKeys.some((k) => k.startsWith('$cdc_') || k.startsWith('cdc_'))) {
    dropReason = 'chromedriver_cdc';
    reasons.push('chromedriver_cdc_property');
  }

  const isDesktopUa =
    DESKTOP_UA_REGEX.test(resolved.userAgent) && !MOBILE_UA_REGEX.test(resolved.userAgent);
  if (
    isDesktopUa &&
    resolved.outerWidth === 0 &&
    resolved.outerHeight === 0 &&
    resolved.innerWidth > 0
  ) {
    reasons.push('zero_outer_dimensions');
  }

  if (Array.isArray(resolved.languages) && resolved.languages.length === 0) {
    reasons.push('empty_languages');
  }

  if (!resolved.hasMatchMedia) {
    reasons.push('missing_match_media');
  }

  if (resolved.hardwareConcurrency === 0) {
    reasons.push('zero_hardware_concurrency');
  }

  const envTrust: EnvTrustLevel =
    dropReason !== null || reasons.length > 0 ? 'suspect' : 'standard';

  return {
    dropReason,
    envTrust,
    reasons,
  };
}

/**
 * Executes a callback only once the document is in `'visible'` state,
 * preventing passive observers from firing in prerendered or hidden tabs.
 */
export function whenPageVisible(cb: () => void): void {
  if (typeof document === 'undefined') return;
  if (document.visibilityState === 'visible') {
    cb();
    return;
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      cb();
    }
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
}

/**
 * Safely dispatches a typed custom event to Plausible.
 */
export function trackEvent<E extends KnownTelemetryEvent>(
  eventName: E,
  props?: TelemetryEventMap[E],
  options?: TrackEventOptions
): void;
export function trackEvent(
  eventName: string,
  props?: Record<string, string | number | boolean | undefined>,
  options?: TrackEventOptions
): void;
export function trackEvent(
  eventName: string,
  props?: Record<string, string | number | boolean | undefined>,
  options?: TrackEventOptions
): void {
  try {
    const formattedProps: Record<string, string> | undefined = props
      ? Object.fromEntries(
          Object.entries(props)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [k, String(v)])
        )
      : undefined;

    const interactive = options?.interactive ?? !NON_INTERACTIVE_EVENTS.has(eventName);
    const plausibleOptions: {
      props?: Record<string, string>;
      interactive?: boolean;
    } = {};

    if (formattedProps && Object.keys(formattedProps).length > 0) {
      plausibleOptions.props = formattedProps;
    }
    if (!interactive) {
      plausibleOptions.interactive = false;
    }

    trackPlausible(eventName, plausibleOptions);
  } catch (err) {
    // Fail silently in development or if adblocker interferes
    console.debug(`[Telemetry] Failed to track event "${eventName}":`, err);
  }
}

let isAnalyticsInitialized = false;

/**
 * Initializes Plausible Analytics tracker with consent-free internal referrer step tracking
 * and zero-fingerprinting automation guards.
 */
export function initAnalytics(): void {
  if (typeof window === 'undefined' || isAnalyticsInitialized) return;
  isAnalyticsInitialized = true;

  // Respect Global Privacy Control (GPC) and Do-Not-Track (DNT)
  try {
    if (
      navigator.globalPrivacyControl === true ||
      navigator.doNotTrack === '1' ||
      (window as AutomationWindow).doNotTrack === '1'
    ) {
      localStorage.setItem('plausible_ignore', 'true');
    }
  } catch {
    // Ignore localStorage access restrictions
  }

  try {
    if (typeof window.name === 'string' && window.name.startsWith('gh_flow:')) {
      window.name = '';
    }
  } catch {
    // Ignore window.name access restrictions
  }

  try {
    initPlausible({
      domain: 'hackenberg.tech',
      endpoint: 'https://analytics.mentawise.com/api/event',
      outboundLinks: true,
      fileDownloads: true,
      bindToWindow: true,
      customProperties: () => ({
        prev_page: getPreviousInternalPage(),
        env_trust: evaluateClientAutomationSignal().envTrust,
      }),
      transformRequest: (payload) =>
        evaluateClientAutomationSignal().dropReason ? null : payload,
    });
  } catch (err) {
    console.debug('[Telemetry] Failed to initialize Plausible tracker:', err);
  }
}

/**
 * Initializes semantic section visibility tracking.
 * Uses an IntersectionObserver with a 2.0s dwell-time threshold to avoid
 * capturing accidental fast-scrolls. Each section is only tracked once per pageview.
 * Delayed until `document.visibilityState === 'visible'` so hidden/prerender tabs never emit events.
 */
export function initSectionTracking(): void {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

  const trackedSections = new Set<string>();
  const dwellTimers = new Map<Element, number>();

  whenPageVisible(() => {
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

          if (entry.isIntersecting && document.visibilityState === 'visible') {
            // Start dwell timer (2.0 seconds threshold)
            if (!dwellTimers.has(el)) {
              const timerId = window.setTimeout(() => {
                if (document.visibilityState !== 'visible') {
                  dwellTimers.delete(el);
                  return;
                }
                if (!trackedSections.has(sectionId)) {
                  trackedSections.add(sectionId);
                  dwellTimers.delete(el);
                  observer.unobserve(el);

                  const isHeading = /^H[1-6]$/i.test(el.tagName);
                  if (isHeading) {
                    trackEvent(
                      'Heading Viewed',
                      {
                        id: sectionId,
                        level: el.tagName.toLowerCase(),
                      },
                      { interactive: false }
                    );
                  } else if (el.hasAttribute('data-page-section')) {
                    trackEvent(
                      'Section Viewed',
                      {
                        id: sectionId,
                      },
                      { interactive: false }
                    );
                  }
                }
              }, 2000);

              dwellTimers.set(el, timerId);
            }
          } else {
            // If scrolled away or tab became hidden before 2.0s, cancel timer
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
  });
}

/**
 * Initializes Preview Card impression and click tracking for catalog / discovery feeds
 * (Homepage, Posts, Courses, Projects, Publications, Visualizations, Services).
 *
 * - Card Viewed: Fired once per card when visible >= 50% for at least 1.5 seconds (non-interactive).
 * - Card Clicked: Fired when the user clicks or navigates via a teaser card (interactive).
 * Enables Click-Through-Rate (CTR = Card Clicked / Card Viewed) telemetry.
 */
export function initCardTracking(): void {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

  const trackedCards = new Set<string>();
  const dwellTimers = new Map<Element, number>();

  whenPageVisible(() => {
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

          if (entry.isIntersecting && document.visibilityState === 'visible') {
            // 1.5 second dwell time to capture intentional consideration
            if (!dwellTimers.has(el)) {
              const timerId = window.setTimeout(() => {
                if (document.visibilityState !== 'visible') {
                  dwellTimers.delete(el);
                  return;
                }
                if (!trackedCards.has(cardId)) {
                  trackedCards.add(cardId);
                  dwellTimers.delete(el);
                  observer.unobserve(el);

                  const collection = el.getAttribute('data-collection') || 'content';

                  trackEvent(
                    'Card Viewed',
                    {
                      id: cardId,
                      collection
                    },
                    { interactive: false }
                  );
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
  });

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

let humanVerifiedSentForPage = false;
let cleanupHumanListeners: (() => void) | null = null;

/**
 * Resets transient in-memory human verification state (for SPA / View Transitions).
 */
export function resetHumanInteractionTracking(): void {
  humanVerifiedSentForPage = false;
  if (cleanupHumanListeners) {
    cleanupHumanListeners();
    cleanupHumanListeners = null;
  }
}

/**
 * Emits a single non-interactive `'Human Verified'` event per pageview upon the first
 * trusted user input (`event.isTrusted === true`) while the page is visible.
 * Uses strictly transient RAM state (zero storage, zero fingerprinting).
 */
export function initHumanInteractionTracking(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (humanVerifiedSentForPage) return;

  if (cleanupHumanListeners) {
    cleanupHumanListeners();
    cleanupHumanListeners = null;
  }

  const triggerOnce = (
    event: Event,
    trigger: TelemetryEventMap['Human Verified']['trigger']
  ) => {
    if (humanVerifiedSentForPage) return;
    if (event.isTrusted !== true) return;
    if (document.visibilityState !== 'visible') return;

    humanVerifiedSentForPage = true;
    if (cleanupHumanListeners) {
      cleanupHumanListeners();
      cleanupHumanListeners = null;
    }

    trackEvent('Human Verified', { trigger }, { interactive: false });
  };

  const onPointerDown = (e: Event) => triggerOnce(e, 'pointer');
  const onWheel = (e: Event) => triggerOnce(e, 'scroll');
  const onTouchStart = (e: Event) => triggerOnce(e, 'touch');
  const onKeyDown = (e: Event) => triggerOnce(e, 'keyboard');
  const onScroll = (e: Event) => {
    if (window.scrollY > 24) {
      triggerOnce(e, 'scroll');
    }
  };

  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('keydown', onKeyDown, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });

  cleanupHumanListeners = () => {
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('scroll', onScroll);
  };
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
    initHumanInteractionTracking();
  });

  document.addEventListener('astro:after-swap', () => {
    resetHumanInteractionTracking();
    initHumanInteractionTracking();
  });
}

