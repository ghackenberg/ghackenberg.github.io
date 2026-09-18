/**
 * AutoFitController - PowerPoint-style adaptive content auto-fitting
 *
 * Uses a fast binary search (3-4 iterations, < 2ms) to find the maximal
 * legible content scale factor (--content-scale) where all cards fit within
 * their container bounds without overflow or border collisions.
 */

export interface AutoFitOptions {
  minScale?: number;      // Default 0.65 (minimum readable presentation text/code)
  maxScale?: number;      // Default 1.0 (standard presentation scale)
  minClearance?: number;  // Minimum unscaled clearance to bottom border (default: 16px)
  iterations?: number;    // Binary search steps (default: 5)
}

export class AutoFitController {
  private options: Required<AutoFitOptions>;

  constructor(options?: AutoFitOptions) {
    this.options = {
      minScale: options?.minScale ?? 0.65,
      maxScale: options?.maxScale ?? 1.0,
      minClearance: options?.minClearance ?? 16,
      iterations: options?.iterations ?? 5,
    };
  }

  public fitCard(card: HTMLElement): void {
    const clientH = card.clientHeight;
    if (clientH <= 0) return;

    // Helper to check if card content fits cleanly
    const checkFits = (): boolean => {
      const cardRect = card.getBoundingClientRect();
      const lastChild = card.lastElementChild;
      if (!lastChild) return true;

      // Check for direct scroll overflow
      if (card.scrollHeight > card.clientHeight + 1) return false;

      // Check inner scroll container if present (e.g. .bento-hyphens, .code-scroll-area)
      const scrollableChild = card.querySelector<HTMLElement>(
        '.bento-hyphens, .code-scroll-area, .overflow-y-auto, .overflow-auto'
      );
      if (scrollableChild && scrollableChild.scrollHeight > scrollableChild.clientHeight + 1) {
        return false;
      }

      // Check pre / code element scroll overflow if present inside code cards
      const pre = card.querySelector<HTMLElement>('pre');
      if (pre && scrollableChild && pre.scrollHeight > scrollableChild.clientHeight) {
        return false;
      }

      // Check clearance to bottom edge in unscaled canvas coordinates
      const revealScale = cardRect.height / card.clientHeight;
      if (revealScale <= 0) return true;

      const contentEl = scrollableChild?.lastElementChild || lastChild;
      const contentRect = contentEl.getBoundingClientRect();
      const unscaledBottomGap = (cardRect.bottom - contentRect.bottom) / revealScale;

      return unscaledBottomGap >= this.options.minClearance;
    };

    // 1. Reset to base scale 1.0 to test natural fit
    card.style.setProperty('--content-scale', '1');

    if (checkFits()) {
      return; // Naturally fits comfortably!
    }

    // 2. Binary search for maximal scale where it fits
    let low = this.options.minScale;
    let high = this.options.maxScale;
    let best = this.options.minScale;

    for (let i = 0; i < this.options.iterations; i++) {
      const mid = (low + high) / 2;
      card.style.setProperty('--content-scale', mid.toFixed(3));

      if (checkFits()) {
        best = mid;
        low = mid; // Can we fit an even larger scale?
      } else {
        high = mid; // Still overflowing, shrink further
      }
    }

    card.style.setProperty('--content-scale', best.toFixed(3));
  }

  public fitSlide(slideEl: HTMLElement | null): void {
    if (!slideEl) return;

    const isHidden = window.getComputedStyle(slideEl).display === 'none';
    if (isHidden) {
      slideEl.style.setProperty('display', 'flex', 'important');
      slideEl.style.setProperty('visibility', 'hidden', 'important');
    }

    try {
      const cards = slideEl.querySelectorAll<HTMLElement>(
        '.bento-card-root, .metric-stat-card, .code-container-root, [data-autofit]'
      );
      cards.forEach((card) => this.fitCard(card));
    } finally {
      if (isHidden) {
        slideEl.style.removeProperty('display');
        slideEl.style.removeProperty('visibility');
      }
    }
  }

  public fitAll(deckEl: HTMLElement | null): void {
    if (!deckEl) return;
    const slides = deckEl.querySelectorAll<HTMLElement>('.reveal .slides > section');
    slides.forEach((slide) => this.fitSlide(slide));
  }
}
