import type {
  ContextChangeListener,
  PageEnvelope,
  SiteBlueprint,
  UnifiedAvatarContext,
} from './types.ts';
import { getSiteBlueprint, formatBlueprintEnvelope } from './site-blueprint.ts';
import { extractPageEnvelope } from './page-context.ts';
import { ScrollTracker } from './scroll-tracker.ts';
import { SlideTracker } from './slide-tracker.ts';

/**
 * Pure function to format a UnifiedAvatarContext into a token-efficient system grounding prompt for an LLM.
 */
export function formatAvatarPrompt(context: UnifiedAvatarContext): string {
  const parts: string[] = [];

  // 1. Site Blueprint Envelope
  parts.push(formatBlueprintEnvelope(context.blueprint));

  // 2. Current Page Envelope
  const pageLines: string[] = [
    `[CURRENT PAGE CONTEXT]`,
    `Collection: ${context.page.collectionType}`,
    `URL: ${context.page.url}`,
    `Title: "${context.page.title}"`,
  ];

  if (context.page.description) {
    pageLines.push(`Description: ${context.page.description}`);
  }

  if (context.page.keywords && context.page.keywords.length > 0) {
    pageLines.push(`Tags: ${context.page.keywords.join(', ')}`);
  }

  if (context.page.toc.length > 0) {
    const tocPreview = context.page.toc
      .slice(0, 10)
      .map((item) => `  - ${'#'.repeat(item.level)} ${item.title}`)
      .join('\n');
    const remaining = context.page.toc.length - 10;
    const suffix = remaining > 0 ? `\n  - ... (${remaining} more sections)` : '';
    pageLines.push(`Table of Contents (${context.page.toc.length} sections):\n${tocPreview}${suffix}`);
  }

  parts.push(pageLines.join('\n'));

  // 3. User Reading Position (Active Section)
  if (context.activeSection) {
    const secLines: string[] = [
      `[USER READING POSITION]`,
      `Active Section: "${context.activeSection.title}" (${context.activeSection.level.toUpperCase()})`,
    ];
    if (context.activeSection.excerpt) {
      secLines.push(`Visible Excerpt: "${context.activeSection.excerpt}"`);
    }
    parts.push(secLines.join('\n'));
  }

  // 4. Active Presentation Slide (if slide deck is present)
  if (context.activeSlide) {
    const slide = context.activeSlide;
    const slideLines: string[] = [
      `[ACTIVE PRESENTATION SLIDE]`,
      `Deck: "${slide.deckId}" | Slide ${slide.index + 1} of ${slide.totalSlides}: "${slide.title}"`,
    ];

    if (slide.layout) {
      slideLines.push(`Layout: ${slide.layout}`);
    }

    if (slide.voiceoverText) {
      slideLines.push(`Spoken Voiceover: "${slide.voiceoverText}"`);
    }

    if (slide.bodyText) {
      slideLines.push(`Slide Content: "${slide.bodyText}"`);
    }

    if (slide.notes) {
      slideLines.push(`Speaker Notes: "${slide.notes}"`);
    }

    if (slide.references && slide.references.length > 0) {
      const refStr = slide.references
        .map((r) => (r.label ? `[${r.label}] ${r.title}` : r.title))
        .join('; ');
      slideLines.push(`Referenced Citations: ${refStr}`);
    }

    parts.push(slideLines.join('\n'));
  }

  return parts.join('\n\n');
}

/**
 * AvatarContextProvider
 * 
 * Unified singleton coordinating live sensory context:
 * - Canonical site blueprint
 * - Live DOM page envelope (collection, title, meta, TOC)
 * - Scroll position and active section excerpt
 * - Reveal.js active slide state and synchronized transcript voiceover
 * - Dispatches state changes to subscribers and generates LLM prompts.
 */
export class AvatarContextProvider {
  private static instance: AvatarContextProvider | null = null;

  private blueprint: SiteBlueprint;
  private pageEnvelope: PageEnvelope;
  private scrollTracker: ScrollTracker;
  private slideTracker: SlideTracker;
  private listeners: Set<ContextChangeListener> = new Set();
  private initialized = false;

  private constructor() {
    this.blueprint = getSiteBlueprint();
    this.pageEnvelope = {
      collectionType: 'home',
      url: 'https://hackenberg.tech/',
      title: 'Dr. Georg Hackenberg',
      toc: [],
    };

    this.scrollTracker = new ScrollTracker(() => {
      this.notifyListeners();
    });

    this.slideTracker = new SlideTracker(() => {
      this.notifyListeners();
    });
  }

  /**
   * Retrieves the singleton AvatarContextProvider instance
   */
  public static getInstance(): AvatarContextProvider {
    if (!AvatarContextProvider.instance) {
      AvatarContextProvider.instance = new AvatarContextProvider();
    }
    return AvatarContextProvider.instance;
  }

  /**
   * Initializes context tracking on the active DOM
   */
  public initialize(doc?: Document | null, pathname?: string): void {
    this.refreshPageContext(doc, pathname);
    this.scrollTracker.start(doc);
    this.slideTracker.start(doc);
    this.initialized = true;
    this.notifyListeners();
  }

  /**
   * Refreshes page metadata from DOM (e.g. after client-side navigation)
   */
  public refreshPageContext(
    doc?: Document | null,
    pathname?: string
  ): PageEnvelope {
    this.pageEnvelope = extractPageEnvelope(doc, pathname);
    this.notifyListeners();
    return this.pageEnvelope;
  }

  /**
   * Returns the complete current unified context
   */
  public getContext(): UnifiedAvatarContext {
    return {
      timestamp: Date.now(),
      blueprint: this.blueprint,
      page: this.pageEnvelope,
      activeSection: this.scrollTracker.getActiveSection(),
      activeSlide: this.slideTracker.getActiveSlide(),
    };
  }

  /**
   * Generates the grounded system context prompt for the LLM
   */
  public generateSystemPrompt(): string {
    return formatAvatarPrompt(this.getContext());
  }

  /**
   * Programmatically requests slide navigation in presentation player
   */
  public jumpToSlide(index: number, autoPlay = false): void {
    this.slideTracker.jumpToSlide(index, autoPlay);
  }

  /**
   * Exposes the internal scroll tracker (e.g. for testing or manual setting)
   */
  public getScrollTracker(): ScrollTracker {
    return this.scrollTracker;
  }

  /**
   * Exposes the internal slide tracker (e.g. for testing or manual setting)
   */
  public getSlideTracker(): SlideTracker {
    return this.slideTracker;
  }

  /**
   * Registers a subscriber callback for context changes
   */
  public subscribe(listener: ContextChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notifies all registered subscribers
   */
  private notifyListeners(): void {
    if (this.listeners.size === 0) return;
    const currentContext = this.getContext();
    for (const listener of this.listeners) {
      try {
        listener(currentContext);
      } catch (err) {
        console.error('Error in AvatarContext listener:', err);
      }
    }
  }

  /**
   * Cleans up trackers and subscribers
   */
  public destroy(): void {
    this.scrollTracker.stop();
    this.slideTracker.stop();
    this.listeners.clear();
    this.initialized = false;
  }

  /**
   * Checks if tracker has been initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Default singleton instance export
 */
export const avatarContextProvider = AvatarContextProvider.getInstance();
