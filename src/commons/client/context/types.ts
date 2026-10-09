/**
 * Virtual Avatar Context & Sensory System Types
 * 
 * Defines core interfaces for site blueprint taxonomy, live page context envelopes,
 * heading scroll tracking, Reveal.js slide deck inspection, and unified LLM grounding.
 */

/**
 * Site navigation collection descriptor
 */
export interface BlueprintCollection {
  id: string;
  name: string;
  path: string;
  description: string;
}

/**
 * Quick link reference in the site blueprint
 */
export interface BlueprintQuickLink {
  label: string;
  url: string;
}

/**
 * Canonical site architecture and taxonomy
 */
export interface SiteBlueprint {
  siteName: string;
  author: string;
  affiliation: string;
  role: string;
  canonicalUrl: string;
  primaryTopics: string[];
  collections: BlueprintCollection[];
  quickLinks: BlueprintQuickLink[];
}

/**
 * Heading item in page table of contents
 */
export interface PageTocItem {
  id: string;
  title: string;
  level: number;
}

/**
 * Context envelope describing the current page
 */
export interface PageEnvelope {
  collectionType: string;
  url: string;
  title: string;
  description?: string;
  keywords?: string[];
  lang?: string;
  toc: PageTocItem[];
}

/**
 * Currently visible or active section from scroll tracking
 */
export interface ActiveSection {
  id: string;
  title: string;
  level: 'h2' | 'h3' | string;
  excerpt?: string;
  index?: number;
}

/**
 * Slide reference / citation descriptor
 */
export interface SlideReferenceItem {
  id?: string;
  label?: string;
  title: string;
  author?: string;
  year?: number;
  url?: string;
}

/**
 * Active slide metadata from Reveal.js deck
 */
export interface ActiveSlide {
  deckId: string;
  index: number;
  totalSlides: number;
  id?: string;
  title: string;
  layout?: string;
  bodyText?: string;
  voiceoverText?: string;
  notes?: string;
  references?: SlideReferenceItem[];
}

/**
 * Unified context state for the virtual avatar LLM
 */
export interface UnifiedAvatarContext {
  timestamp: number;
  blueprint: SiteBlueprint;
  page: PageEnvelope;
  activeSection: ActiveSection | null;
  activeSlide: ActiveSlide | null;
}

/**
 * Listener callback for avatar context mutations
 */
export type ContextChangeListener = (context: UnifiedAvatarContext) => void;
