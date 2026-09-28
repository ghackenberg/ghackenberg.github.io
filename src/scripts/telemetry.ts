/**
 * Telemetry and Semantic Analytics Utility
 * Provides lightweight, privacy-friendly event tracking via Plausible.
 */

declare global {
  interface Window {
    plausible?: (eventName: string, options?: { props?: Record<string, any>; callback?: () => void }) => void;
  }
}

/**
 * Safely dispatches a custom event to Plausible.
 */
export function trackEvent(eventName: string, props?: Record<string, any>): void {
  try {
    if (typeof window !== 'undefined' && typeof window.plausible === 'function') {
      window.plausible(eventName, props ? { props } : undefined);
    }
  } catch (err) {
    // Fail silently in development or if adblocker interferes
    console.debug(`[Telemetry] Failed to track event "${eventName}":`, err);
  }
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
  // 1. Explicit sections on homepage or landing pages (<section id="...">)
  // 2. Article sub-sections (h2 with id inside article or main)
  const candidateElements: HTMLElement[] = [];

  const sections = document.querySelectorAll<HTMLElement>('main section[id], article section[id], #home, #about, #site-navigation, #latest-posts, #content-tags, #posts-network, #projects, #activity, #experience, #contact');
  sections.forEach((el) => {
    if (el.id && !trackedSections.has(el.id)) {
      candidateElements.push(el);
    }
  });

  // Also include major article headings (h2 with IDs)
  const articleHeadings = document.querySelectorAll<HTMLElement>('article h2[id], .prose h2[id]');
  articleHeadings.forEach((el) => {
    if (el.id && !trackedSections.has(el.id)) {
      candidateElements.push(el);
    }
  });

  if (candidateElements.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const el = entry.target as HTMLElement;
        const sectionId = el.id || el.getAttribute('data-section-id') || 'unnamed-section';

        if (trackedSections.has(sectionId)) {
          observer.unobserve(el);
          return;
        }

        if (entry.isIntersecting) {
          // Start dwell timer (1.5 seconds)
          if (!dwellTimers.has(el)) {
            const timerId = window.setTimeout(() => {
              if (!trackedSections.has(sectionId)) {
                trackedSections.add(sectionId);
                dwellTimers.delete(el);
                observer.unobserve(el);

                // Derive human-readable title
                let title = el.getAttribute('aria-label') || el.getAttribute('title') || '';
                if (!title) {
                  const heading = el.querySelector('h1, h2, h3') || (el.tagName.match(/^H[1-6]$/i) ? el : null);
                  if (heading) {
                    title = heading.textContent?.trim().replace(/\s+/g, ' ') || '';
                  }
                }
                if (!title) {
                  title = sectionId;
                }

                trackEvent('Section Viewed', {
                  section_id: sectionId,
                  section_title: title.slice(0, 80),
                  page_path: window.location.pathname
                });
              }
            }, 1500);

            dwellTimers.set(el, timerId);
          }
        } else {
          // If scrolled away before 1.5s, cancel timer
          if (dwellTimers.has(el)) {
            clearTimeout(dwellTimers.get(el));
            dwellTimers.delete(el);
          }
        }
      });
    },
    {
      threshold: 0.35, // Element must be at least 35% visible
      rootMargin: '0px 0px -10% 0px' // Slight bottom offset
    }
  );

  candidateElements.forEach((el) => observer.observe(el));
}

/**
 * Initializes tracking for high-intent copy interactions (Email, BibTeX, etc.)
 */
export function initCopyTracking(): void {
  if (typeof document === 'undefined') return;

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Contact Email Copy buttons
    const emailBtn = target.closest('#copy-email-btn, [data-copy-email], .copy-email-btn');
    if (emailBtn) {
      const location = emailBtn.getAttribute('data-copy-location') || (emailBtn.closest('#contact') ? 'home-contact' : 'page');
      trackEvent('High Intent: Copy Email', { location, path: window.location.pathname });
      return;
    }

    // BibTeX copy buttons
    const bibtexBtn = target.closest('[data-copy-bibtex], .copy-bibtex-btn');
    if (bibtexBtn) {
      const pubTitle = bibtexBtn.getAttribute('data-pub-title') || 'publication';
      trackEvent('High Intent: Copy BibTeX', { title: pubTitle.slice(0, 80), path: window.location.pathname });
    }
  });
}

/**
 * Auto-initialize when the DOM is ready
 */
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initSectionTracking();
      initCopyTracking();
    });
  } else {
    initSectionTracking();
    initCopyTracking();
  }
}
