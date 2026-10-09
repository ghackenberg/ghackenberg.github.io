import type { ActiveSection } from './types.ts';

export interface ScrollTrackerOptions {
  rootMargin?: string;
  threshold?: number | number[];
  maxExcerptLength?: number;
}

export interface HeadingSiblingNode {
  tagName: string;
  textContent?: string | null;
  nextElementSibling?: HeadingSiblingNode | null;
}

export interface HeadingLikeElement {
  tagName: string;
  nextElementSibling?: HeadingSiblingNode | null;
}

/**
 * Extracts a concise text excerpt for the section immediately following a heading element.
 */
export function extractSectionExcerpt(
  headingEl: HTMLElement | HeadingLikeElement,
  maxChars = 300
): string {
  const headingLevel = headingEl.tagName.toUpperCase();
  const stopTags = headingLevel === 'H2' ? ['H1', 'H2'] : ['H1', 'H2', 'H3'];

  let sibling = headingEl.nextElementSibling;
  const textChunks: string[] = [];
  let accumulatedLength = 0;

  while (sibling) {
    const tagName = sibling.tagName.toUpperCase();
    if (stopTags.includes(tagName)) {
      break;
    }

    // Skip script, style, navigation, or hidden elements
    if (!['SCRIPT', 'STYLE', 'NAV', 'BUTTON', 'ASIDE'].includes(tagName)) {
      const text = sibling.textContent?.replace(/\s+/g, ' ').trim();
      if (text) {
        textChunks.push(text);
        accumulatedLength += text.length;
        if (accumulatedLength >= maxChars) {
          break;
        }
      }
    }

    sibling = sibling.nextElementSibling;
  }

  const combined = textChunks.join(' ');
  if (!combined) {
    return '';
  }

  if (combined.length > maxChars) {
    return `${combined.slice(0, maxChars - 3).trim()}...`;
  }
  return combined;
}

/**
 * ScrollTracker observes headings in the active document and tracks which section
 * is currently visible in the reading viewport using IntersectionObserver.
 */
export class ScrollTracker {
  private observer: IntersectionObserver | null = null;
  private activeSection: ActiveSection | null = null;
  private trackedHeadings: HTMLElement[] = [];
  private onSectionChangeCallback?: (section: ActiveSection | null) => void;
  private options: Required<ScrollTrackerOptions>;

  constructor(
    onSectionChange?: (section: ActiveSection | null) => void,
    options?: ScrollTrackerOptions
  ) {
    this.onSectionChangeCallback = onSectionChange;
    this.options = {
      rootMargin: options?.rootMargin ?? '-10% 0px -70% 0px',
      threshold: options?.threshold ?? 0,
      maxExcerptLength: options?.maxExcerptLength ?? 300,
    };
  }

  /**
   * Starts observing headings in the live document
   */
  public start(doc?: Document | null): void {
    const activeDoc = doc ?? (typeof document !== 'undefined' ? document : null);
    if (!activeDoc || typeof window === 'undefined') {
      return;
    }

    this.stop();

    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    const excludedParents = [
      'footer',
      'nav',
      '#slide-list-drawer',
      '#references-modal',
      '#dev-studio-root',
      '#dev-analytics-hud',
    ].join(',');

    const headings = Array.from(activeDoc.querySelectorAll<HTMLElement>('h2, h3'));
    this.trackedHeadings = headings.filter((el) => !el.closest(excludedParents));

    if (this.trackedHeadings.length === 0) {
      return;
    }

    const visibleEntries = new Map<HTMLElement, IntersectionObserverEntry>();

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            visibleEntries.set(target, entry);
          } else {
            visibleEntries.delete(target);
          }
        }

        this.updateActiveFromVisible(visibleEntries);
      },
      {
        rootMargin: this.options.rootMargin,
        threshold: this.options.threshold,
      }
    );

    for (const heading of this.trackedHeadings) {
      this.observer.observe(heading);
    }
  }

  /**
   * Determines the active heading from visible intersection entries
   */
  private updateActiveFromVisible(
    visibleEntries: Map<HTMLElement, IntersectionObserverEntry>
  ): void {
    if (visibleEntries.size === 0) {
      return;
    }

    // Find the heading that is closest to the top of the viewport
    let topHeading: HTMLElement | null = null;
    let minTop = Number.POSITIVE_INFINITY;

    for (const [el, entry] of visibleEntries.entries()) {
      const top = entry.boundingClientRect.top;
      if (top >= 0 && top < minTop) {
        minTop = top;
        topHeading = el;
      }
    }

    // Fallback: take the first intersecting heading
    if (!topHeading) {
      topHeading = visibleEntries.keys().next().value ?? null;
    }

    if (!topHeading) return;

    const id = topHeading.id || '';
    const title = topHeading.textContent?.trim() || '';
    const level = topHeading.tagName.toLowerCase();
    const index = this.trackedHeadings.indexOf(topHeading);
    const excerpt = extractSectionExcerpt(topHeading, this.options.maxExcerptLength);

    const newSection: ActiveSection = {
      id,
      title,
      level,
      excerpt,
      index: index >= 0 ? index : undefined,
    };

    if (
      !this.activeSection ||
      this.activeSection.id !== newSection.id ||
      this.activeSection.title !== newSection.title
    ) {
      this.activeSection = newSection;
      this.onSectionChangeCallback?.(this.activeSection);
    }
  }

  /**
   * Retrieves the current active section
   */
  public getActiveSection(): ActiveSection | null {
    return this.activeSection;
  }

  /**
   * Manually sets the active section (useful for testing or direct navigation)
   */
  public setActiveSection(section: ActiveSection | null): void {
    this.activeSection = section;
    this.onSectionChangeCallback?.(this.activeSection);
  }

  /**
   * Disconnects the observer and clears tracked elements
   */
  public stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.trackedHeadings = [];
  }
}
