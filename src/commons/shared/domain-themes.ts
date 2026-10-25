/**
 * Canonical Content Domain definitions and unified theme metadata.
 * Central registry for multi-domain branding, color tokens, and styling helpers across the platform.
 */

export type ContentDomain =
  | 'interests'
  | 'posts'
  | 'publications'
  | 'presentations'
  | 'courses'
  | 'projects'
  | 'services'
  | 'visualizations'
  | 'newsletters'
  | 'tags';

export interface DomainColorTokens {
  dark: string;
  light: string;
}

export interface DomainMetadata {
  id: ContentDomain;
  label: string;
  emoji: string;
  cssVar: string;
  colors: DomainColorTokens;
  headingGradientClass: string;
  bgGradientClass: string;
  badgeClasses: string;
  borderHoverClass: string;
  glowShadowClass: string;
  radialGlowClass: string;
}

export const DOMAIN_METADATA: Record<ContentDomain, DomainMetadata> = {
  interests: {
    id: 'interests',
    label: 'Interests',
    emoji: '🎯',
    cssVar: '--color-domain-interests',
    colors: {
      dark: '#10b981',
      light: '#059669',
    },
    headingGradientClass: 'heading-gradient-domain-interests',
    bgGradientClass: 'bg-gradient-domain-interests',
    badgeClasses: 'bg-domain-interests/10 text-domain-interests border-domain-interests/20',
    borderHoverClass: 'hover:border-domain-interests/40',
    glowShadowClass: 'group-hover:shadow-[0_12px_35px_-10px_rgba(59,130,246,0.25)]',
    radialGlowClass: 'bg-domain-interests/10',
  },
  posts: {
    id: 'posts',
    label: 'Posts',
    emoji: '📝',
    cssVar: '--color-domain-posts',
    colors: {
      dark: '#14b8a6',
      light: '#0d9488',
    },
    headingGradientClass: 'heading-gradient-domain-posts',
    bgGradientClass: 'bg-gradient-domain-posts',
    badgeClasses: 'bg-domain-posts/10 text-domain-posts border-domain-posts/20',
    borderHoverClass: 'hover:border-domain-posts/40',
    glowShadowClass: 'group-hover:shadow-[0_12px_35px_-10px_rgba(99,102,241,0.25)]',
    radialGlowClass: 'bg-domain-posts/10',
  },
  publications: {
    id: 'publications',
    label: 'Publications',
    emoji: '📄',
    cssVar: '--color-domain-publications',
    colors: {
      dark: '#06b6d4',
      light: '#0891b2',
    },
    headingGradientClass: 'heading-gradient-domain-publications',
    bgGradientClass: 'bg-gradient-domain-publications',
    badgeClasses: 'bg-domain-publications/10 text-domain-publications border-domain-publications/20',
    borderHoverClass: 'hover:border-domain-publications/40',
    glowShadowClass: 'group-hover:shadow-[0_12px_35px_-10px_rgba(139,92,246,0.25)]',
    radialGlowClass: 'bg-domain-publications/10',
  },
  presentations: {
    id: 'presentations',
    label: 'Presentations',
    emoji: '🎙️',
    cssVar: '--color-domain-presentations',
    colors: {
      dark: '#0ea5e9',
      light: '#0284c7',
    },
    headingGradientClass: 'heading-gradient-domain-presentations',
    bgGradientClass: 'bg-gradient-domain-presentations',
    badgeClasses: 'bg-domain-presentations/10 text-domain-presentations border-domain-presentations/20',
    borderHoverClass: 'hover:border-domain-presentations/40',
    glowShadowClass: 'group-hover:shadow-[0_12px_35px_-10px_rgba(168,85,247,0.25)]',
    radialGlowClass: 'bg-domain-presentations/10',
  },
  courses: {
    id: 'courses',
    label: 'Courses',
    emoji: '🎓',
    cssVar: '--color-domain-courses',
    colors: {
      dark: '#3b82f6',
      light: '#2563eb',
    },
    headingGradientClass: 'heading-gradient-domain-courses',
    bgGradientClass: 'bg-gradient-domain-courses',
    badgeClasses: 'bg-domain-courses/10 text-domain-courses border-domain-courses/20',
    borderHoverClass: 'hover:border-domain-courses/40',
    glowShadowClass: 'group-hover:shadow-[0_12px_35px_-10px_rgba(192,97,235,0.25)]',
    radialGlowClass: 'bg-domain-courses/10',
  },
  projects: {
    id: 'projects',
    label: 'Projects',
    emoji: '🚀',
    cssVar: '--color-domain-projects',
    colors: {
      dark: '#526bf4',
      light: '#3b52e6',
    },
    headingGradientClass: 'heading-gradient-domain-projects',
    bgGradientClass: 'bg-gradient-domain-projects',
    badgeClasses: 'bg-domain-projects/10 text-domain-projects border-domain-projects/20',
    borderHoverClass: 'hover:border-domain-projects/40',
    glowShadowClass: 'group-hover:shadow-[0_12px_35px_-10px_rgba(214,109,168,0.25)]',
    radialGlowClass: 'bg-domain-projects/10',
  },
  services: {
    id: 'services',
    label: 'Services',
    emoji: '💼',
    cssVar: '--color-domain-services',
    colors: {
      dark: '#6366f1',
      light: '#4f46e5',
    },
    headingGradientClass: 'heading-gradient-domain-services',
    bgGradientClass: 'bg-gradient-domain-services',
    badgeClasses: 'bg-domain-services/10 text-domain-services border-domain-services/20',
    borderHoverClass: 'hover:border-domain-services/40',
    glowShadowClass: 'group-hover:shadow-[0_12px_35px_-10px_rgba(230,124,107,0.25)]',
    radialGlowClass: 'bg-domain-services/10',
  },
  visualizations: {
    id: 'visualizations',
    label: 'Visualizations',
    emoji: '📊',
    cssVar: '--color-domain-visualizations',
    colors: {
      dark: '#7c5bf3',
      light: '#6540e2',
    },
    headingGradientClass: 'heading-gradient-domain-visualizations',
    bgGradientClass: 'bg-gradient-domain-visualizations',
    badgeClasses: 'bg-domain-visualizations/10 text-domain-visualizations border-domain-visualizations/20',
    borderHoverClass: 'hover:border-domain-visualizations/40',
    glowShadowClass: 'group-hover:shadow-[0_12px_35px_-10px_rgba(237,135,72,0.25)]',
    radialGlowClass: 'bg-domain-visualizations/10',
  },
  newsletters: {
    id: 'newsletters',
    label: 'Newsletters',
    emoji: '✉️',
    cssVar: '--color-domain-newsletters',
    colors: {
      dark: '#9353f7',
      light: '#7c3aed',
    },
    headingGradientClass: 'heading-gradient-domain-newsletters',
    bgGradientClass: 'bg-gradient-domain-newsletters',
    badgeClasses: 'bg-domain-newsletters/10 text-domain-newsletters border-domain-newsletters/20',
    borderHoverClass: 'hover:border-domain-newsletters/40',
    glowShadowClass: 'group-hover:shadow-[0_12px_35px_-10px_rgba(242,147,37,0.25)]',
    radialGlowClass: 'bg-domain-newsletters/10',
  },
  tags: {
    id: 'tags',
    label: 'Tags',
    emoji: '🏷️',
    cssVar: '--color-domain-tags',
    colors: {
      dark: '#a855f7',
      light: '#9333ea',
    },
    headingGradientClass: 'heading-gradient-domain-tags',
    bgGradientClass: 'bg-gradient-domain-tags',
    badgeClasses: 'bg-domain-tags/10 text-domain-tags border-domain-tags/20',
    borderHoverClass: 'hover:border-domain-tags/40',
    glowShadowClass: 'group-hover:shadow-[0_12px_35px_-10px_rgba(245,158,11,0.25)]',
    radialGlowClass: 'bg-domain-tags/10',
  },
};

export const CONTENT_DOMAINS: readonly ContentDomain[] = [
  'interests',
  'posts',
  'publications',
  'presentations',
  'courses',
  'projects',
  'services',
  'visualizations',
  'newsletters',
  'tags',
] as const;

/**
 * Checks whether a given string is a valid ContentDomain.
 */
export function isContentDomain(domain: string): domain is ContentDomain {
  return domain in DOMAIN_METADATA;
}

/**
 * Retrieves the full metadata record for a domain.
 */
export function getDomainMetadata(domain: ContentDomain): DomainMetadata {
  return DOMAIN_METADATA[domain];
}

/**
 * Retrieves the active color hex for a given domain.
 * Inspects `getComputedStyle(document.documentElement).getPropertyValue(...)` at runtime
 * in browser environments to automatically adapt to dark/light theme shifts.
 * Falls back to static color definition if run in SSR or variable is unset.
 */
export function getDomainColorHex(domain: ContentDomain, mode: 'dark' | 'light' = 'dark'): string {
  const meta = DOMAIN_METADATA[domain];
  if (!meta) {
    return '#3b82f6';
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const computed = window.getComputedStyle(document.documentElement).getPropertyValue(meta.cssVar).trim();
      if (computed) {
        return computed;
      }
      const isLight = document.documentElement.classList.contains('light');
      return isLight ? meta.colors.light : meta.colors.dark;
    } catch {
      // Fallback to static mapping
    }
  }

  return meta.colors[mode];
}

/**
 * Returns Tailwind badge classes for a domain.
 */
export function getDomainBadgeClasses(domain: ContentDomain): string {
  return DOMAIN_METADATA[domain]?.badgeClasses ?? 'bg-domain-presentations/10 text-domain-presentations border-domain-presentations/20';
}

/**
 * Returns unified heading gradient class for a domain.
 */
export function getDomainHeadingGradientClass(domain: ContentDomain): string {
  return DOMAIN_METADATA[domain]?.headingGradientClass ?? 'heading-gradient-brand';
}

/**
 * Returns unified background gradient class for a domain.
 */
export function getDomainBgGradientClass(domain: ContentDomain): string {
  return DOMAIN_METADATA[domain]?.bgGradientClass ?? 'bg-gradient-brand';
}

/**
 * Returns hover border styling class for a domain.
 */
export function getDomainBorderHoverClass(domain: ContentDomain): string {
  return DOMAIN_METADATA[domain]?.borderHoverClass ?? 'hover:border-domain-posts/40';
}

export interface ThemeTokens {
  textHeading: string;
  textMain: string;
  textSubtle: string;
  background: string;
  canvasBg: string;
  border: string;
  nodeDefault: string;
}

/**
 * Returns dynamic theme color tokens for canvas, graph, and visualization engines.
 */
export function getThemeTokens(isLight: boolean): ThemeTokens {
  return {
    textHeading: isLight ? '#0f172a' : '#f8fafc',
    textMain: isLight ? '#334155' : '#f3f4f6',
    textSubtle: isLight ? '#475569' : '#94a3b8',
    background: isLight ? '#ffffff' : '#030712',
    canvasBg: isLight ? '#f8fafc' : '#090d16',
    border: isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.1)',
    nodeDefault: isLight ? '#2563eb' : '#3b82f6',
  };
}
