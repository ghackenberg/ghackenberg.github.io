import type { RevealApi } from 'reveal.js';
import type { ActiveSlide, SlideReferenceItem } from './types.ts';

declare global {
  interface Window {
    __revealDeck?: RevealApi;
  }
}

interface RawSlideMeta {
  id: string;
  title?: string;
  slideLayout?: string;
  audioUrl?: string;
  durationSec?: number;
  notes?: string;
  references?: Array<{
    id?: string;
    label?: string;
    type?: string;
    author?: string;
    title: string;
    year?: number;
    url?: string;
  }>;
}

/**
 * SlideTracker detects Reveal.js slide decks rendered by SlideDeck.astro,
 * tracks slide transition events, extracts comprehensive active slide metadata,
 * and allows external programmatic navigation via deck:jump-to-slide.
 */
export class SlideTracker {
  private activeSlide: ActiveSlide | null = null;
  private onSlideChangeCallback?: (slide: ActiveSlide | null) => void;
  private slideChangedHandler?: () => void;
  private jumpToSlideHandler?: (e: Event) => void;
  private pollTimer: number | null = null;
  private boundDeck: RevealApi | null = null;

  constructor(onSlideChange?: (slide: ActiveSlide | null) => void) {
    this.onSlideChangeCallback = onSlideChange;
  }

  /**
   * Checks if a SlideDeck component is present in the DOM
   */
  public isDeckPresent(doc?: Document | null): boolean {
    const activeDoc = doc ?? (typeof document !== 'undefined' ? document : null);
    if (!activeDoc) return false;
    return (
      activeDoc.querySelector('.slide-deck-wrapper') !== null ||
      activeDoc.getElementById('slides-meta') !== null
    );
  }

  /**
   * Parses the slides metadata carrier (<script id="slides-meta">)
   */
  public parseSlidesMeta(doc?: Document | null): RawSlideMeta[] {
    const activeDoc = doc ?? (typeof document !== 'undefined' ? document : null);
    if (!activeDoc) return [];
    const metaEl = activeDoc.getElementById('slides-meta');
    if (!metaEl || !metaEl.textContent) return [];
    try {
      return JSON.parse(metaEl.textContent) as RawSlideMeta[];
    } catch {
      return [];
    }
  }

  /**
   * Identifies the current active slide index from Reveal or the DOM
   */
  public getActiveIndex(doc?: Document | null): number {
    if (typeof window !== 'undefined' && window.__revealDeck) {
      try {
        return window.__revealDeck.getIndices().h;
      } catch {
        // Fallback to DOM detection
      }
    }

    const activeDoc = doc ?? (typeof document !== 'undefined' ? document : null);
    if (!activeDoc) return 0;

    const activeItem = activeDoc.querySelector<HTMLElement>(
      'button[data-slide-index][data-active="true"]'
    );
    if (activeItem) {
      const idxAttr = activeItem.getAttribute('data-slide-index');
      if (idxAttr !== null) {
        const parsed = parseInt(idxAttr, 10);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
    }

    const sections = Array.from(
      activeDoc.querySelectorAll<HTMLElement>('.reveal .slides > section')
    );
    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      if (sec && sec.classList.contains('present')) {
        return i;
      }
    }

    return 0;
  }

  /**
   * Extracts the full active slide metadata
   */
  public extractActiveSlide(
    doc?: Document | null,
    targetIndex?: number
  ): ActiveSlide | null {
    const activeDoc = doc ?? (typeof document !== 'undefined' ? document : null);
    if (!activeDoc || !this.isDeckPresent(activeDoc)) {
      return null;
    }

    const wrapper = activeDoc.querySelector('.slide-deck-wrapper');
    const deckId = wrapper?.getAttribute('data-deck-id') || 'presentation';
    const slidesData = this.parseSlidesMeta(activeDoc);
    const index = targetIndex ?? this.getActiveIndex(activeDoc);
    const totalSlides =
      slidesData.length > 0
        ? slidesData.length
        : activeDoc.querySelectorAll('.reveal .slides > section').length || 1;

    const meta = slidesData[index];
    const slideId = meta?.id || `slide-${index + 1}`;

    // Extract slide section element
    const slideSections = activeDoc.querySelectorAll<HTMLElement>(
      '.reveal .slides > section'
    );
    const slideSection = slideSections[index] || null;

    // Slide title
    let title = meta?.title?.trim() || '';
    if (!title && slideSection) {
      const h = slideSection.querySelector('h1, h2, h3');
      title = h?.textContent?.trim() || '';
    }
    if (!title) {
      title = `Slide ${index + 1}`;
    }

    // Slide body text (excluding titles and notes)
    let bodyText = '';
    if (slideSection) {
      const clone = slideSection.cloneNode(true) as HTMLElement;
      for (const el of Array.from(clone.querySelectorAll('h1, h2, h3, aside.notes, script, style'))) {
        el.remove();
      }
      bodyText = clone.textContent?.replace(/\s+/g, ' ').trim() || '';
    }

    // Voiceover spoken script from transcript timeline
    let voiceoverText = '';
    const transcriptEl = activeDoc.getElementById(`transcript-${slideId}`);
    if (transcriptEl) {
      const voP = transcriptEl.querySelector('.transcript-voiceover p');
      voiceoverText = voP?.textContent?.replace(/\s+/g, ' ').trim() || '';
    }

    // Speaker notes
    let notes = meta?.notes?.trim() || '';
    if (!notes && slideSection) {
      const notesEl = slideSection.querySelector('aside.notes');
      notes = notesEl?.textContent?.replace(/\s+/g, ' ').trim() || '';
    }

    // Citations / References
    const references: SlideReferenceItem[] = [];
    if (meta?.references && Array.isArray(meta.references)) {
      for (const ref of meta.references) {
        references.push({
          id: ref.id,
          label: ref.label,
          title: ref.title,
          author: ref.author,
          year: ref.year,
          url: ref.url,
        });
      }
    }

    return {
      deckId,
      index,
      totalSlides,
      id: slideId,
      title,
      layout: meta?.slideLayout,
      bodyText: bodyText || undefined,
      voiceoverText: voiceoverText || undefined,
      notes: notes || undefined,
      references: references.length > 0 ? references : undefined,
    };
  }

  /**
   * Programmatically requests navigation to a specific slide index
   */
  public jumpToSlide(index: number, autoPlay = false): void {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(
      new CustomEvent('deck:jump-to-slide', {
        detail: { index, autoPlay },
      })
    );

    // Direct invocation fallback if window.__revealDeck is ready
    if (typeof window !== 'undefined' && window.__revealDeck) {
      try {
        window.__revealDeck.slide(index);
      } catch {
        // Fall back to event dispatch
      }
    }
  }

  /**
   * Initializes slide tracking and hooks Reveal.js events
   */
  public start(doc?: Document | null): void {
    const activeDoc = doc ?? (typeof document !== 'undefined' ? document : null);
    if (!activeDoc || !this.isDeckPresent(activeDoc) || typeof window === 'undefined') {
      return;
    }

    this.stop();

    const updateCurrentSlide = () => {
      const slide = this.extractActiveSlide(activeDoc);
      if (
        !this.activeSlide ||
        this.activeSlide.index !== slide?.index ||
        this.activeSlide.id !== slide?.id
      ) {
        this.activeSlide = slide;
        this.onSlideChangeCallback?.(this.activeSlide);
      }
    };

    // Initial extraction
    updateCurrentSlide();

    // Hook Reveal.js deck when available
    this.slideChangedHandler = () => {
      updateCurrentSlide();
    };

    const tryBindDeck = () => {
      if (typeof window !== 'undefined' && window.__revealDeck && !this.boundDeck && this.slideChangedHandler) {
        this.boundDeck = window.__revealDeck;
        this.boundDeck.on('slidechanged', this.slideChangedHandler);
        updateCurrentSlide();
        if (this.pollTimer !== null) {
          window.clearInterval(this.pollTimer);
          this.pollTimer = null;
        }
      }
    };

    tryBindDeck();

    // Poll for deck readiness if not ready at start time
    if (!this.boundDeck) {
      this.pollTimer = window.setInterval(tryBindDeck, 200);
      // Timeout after 10s
      window.setTimeout(() => {
        if (this.pollTimer !== null) {
          window.clearInterval(this.pollTimer);
          this.pollTimer = null;
        }
      }, 10000);
    }

    // Also listen to external jump events
    this.jumpToSlideHandler = (e: Event) => {
      const customEvent = e as CustomEvent<{ index: number; autoPlay?: boolean }>;
      const targetIdx = customEvent.detail?.index;
      if (typeof targetIdx === 'number') {
        const slide = this.extractActiveSlide(activeDoc, targetIdx);
        this.activeSlide = slide;
        this.onSlideChangeCallback?.(this.activeSlide);
      }
    };

    window.addEventListener('deck:jump-to-slide', this.jumpToSlideHandler);
  }

  /**
   * Retrieves the current active slide
   */
  public getActiveSlide(): ActiveSlide | null {
    return this.activeSlide;
  }

  /**
   * Manually sets active slide state (useful for tests and mocking)
   */
  public setActiveSlide(slide: ActiveSlide | null): void {
    this.activeSlide = slide;
    this.onSlideChangeCallback?.(this.activeSlide);
  }

  /**
   * Cleans up observers and listeners
   */
  public stop(): void {
    if (this.boundDeck && this.slideChangedHandler) {
      this.boundDeck.off?.('slidechanged', this.slideChangedHandler);
      this.boundDeck = null;
    }
    if (this.pollTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.jumpToSlideHandler && typeof window !== 'undefined') {
      window.removeEventListener('deck:jump-to-slide', this.jumpToSlideHandler);
      this.jumpToSlideHandler = undefined;
    }
  }
}
