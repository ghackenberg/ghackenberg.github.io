/**
 * Canonical Content Domain definitions and unified theme metadata.
 * Central registry for multi-domain branding, color tokens, and styling helpers across the platform.
 */

export type ContentDomain =
  | 'posts'
  | 'publications'
  | 'presentations'
  | 'courses'
  | 'projects'
  | 'services'
  | 'newsletters'
  | 'visualizations'
  | 'tags';

export const ARTIFACT_DOMAINS = [
  'posts',
  'publications',
  'presentations',
  'courses',
  'projects',
  'services',
  'newsletters',
  'visualizations',
] as const;

export type ArtifactDomain = typeof ARTIFACT_DOMAINS[number];

export interface DomainColorTokens {
  dark: string;
  light: string;
}

export interface DomainMetadata {
  id: ContentDomain;
  label: string;
  singularLabel: string;
  emoji: string;
  href: string;
  navDescription: string;
  cssVar: string;
  colors: DomainColorTokens;
  bgClass: string;
  textClass: string;
  headingGradientClass: string;
  bgGradientClass: string;
  badgeClasses: string;
  borderHoverClass: string;
  glowShadowClass: string;
  radialGlowClass: string;
}

export const DOMAIN_METADATA: Record<ContentDomain, DomainMetadata> = {
  posts: {
    id: 'posts',
    label: 'Posts',
    singularLabel: 'Post',
    emoji: '📝',
    href: '/posts/',
    navDescription: 'Articles, deep-dives & architecture guides',
    cssVar: '--color-domain-posts',
    colors: {
      dark: '#469b95',
      light: '#4ea29c',
    },
    bgClass: 'bg-domain-posts',
    textClass: 'text-domain-posts',
    headingGradientClass: 'heading-gradient-domain-posts',
    bgGradientClass: 'bg-gradient-domain-posts',
    badgeClasses: 'bg-domain-posts/10 text-domain-posts border-domain-posts/20',
    borderHoverClass: 'hover:border-domain-posts/40',
    glowShadowClass: 'group-hover:shadow-[0_12px_35px_-10px_rgba(130,196,192,0.22)]',
    radialGlowClass: 'bg-domain-posts/10',
  },
  publications: {
    id: 'publications',
    label: 'Publications',
    singularLabel: 'Publication',
    emoji: '📄',
    href: '/publications/',
    navDescription: 'Peer-reviewed papers & journal articles',
    cssVar: '--color-domain-publications',
    colors: {
      dark: '#47909e',
      light: '#5097a5',
    },
    bgClass: 'bg-domain-publications',
    textClass: 'text-domain-publications',
    headingGradientClass: 'heading-gradient-domain-publications',
    bgGradientClass: 'bg-gradient-domain-publications',
    badgeClasses: 'bg-domain-publications/10 text-domain-publications border-domain-publications/20',
    borderHoverClass: 'hover:border-domain-publications/40',
    glowShadowClass: 'group-hover:shadow-[0_12px_35px_-10px_rgba(134,187,198,0.22)]',
    radialGlowClass: 'bg-domain-publications/10',
  },
  presentations: {
    id: 'presentations',
    label: 'Presentations',
    singularLabel: 'Presentation',
    emoji: '🎙️',
    href: '/presentations/',
    navDescription: 'Conference keynotes & slide decks with audio',
    cssVar: '--color-domain-presentations',
    colors: {
      dark: '#4a81a5',
      light: '#5186a9',
    },
    bgClass: 'bg-domain-presentations',
    textClass: 'text-domain-presentations',
    headingGradientClass: 'heading-gradient-domain-presentations',
    bgGradientClass: 'bg-gradient-domain-presentations',
    badgeClasses: 'bg-domain-presentations/10 text-domain-presentations border-domain-presentations/20',
    borderHoverClass: 'hover:border-domain-presentations/40',
    glowShadowClass: 'group-hover:shadow-[0_12px_35px_-10px_rgba(137,175,200,0.22)]',
    radialGlowClass: 'bg-domain-presentations/10',
  },
  courses: {
    id: 'courses',
    label: 'Courses',
    singularLabel: 'Course',
    emoji: '🎓',
    href: '/courses/',
    navDescription: 'University lectures, syllabi & curricula',
    cssVar: '--color-domain-courses',
    colors: {
      dark: '#4f76b0',
      light: '#5679ae',
    },
    bgClass: 'bg-domain-courses',
    textClass: 'text-domain-courses',
    headingGradientClass: 'heading-gradient-domain-courses',
    bgGradientClass: 'bg-gradient-domain-courses',
    badgeClasses: 'bg-domain-courses/10 text-domain-courses border-domain-courses/20',
    borderHoverClass: 'hover:border-domain-courses/40',
    glowShadowClass: 'group-hover:shadow-[0_12px_35px_-10px_rgba(147,170,204,0.22)]',
    radialGlowClass: 'bg-domain-courses/10',
  },
  projects: {
    id: 'projects',
    label: 'Projects',
    singularLabel: 'Project',
    emoji: '🚀',
    href: '/projects/',
    navDescription: 'Open-source software, platforms & systems',
    cssVar: '--color-domain-projects',
    colors: {
      dark: '#5a6cb5',
      light: '#5a6baf',
    },
    bgClass: 'bg-domain-projects',
    textClass: 'text-domain-projects',
    headingGradientClass: 'heading-gradient-domain-projects',
    bgGradientClass: 'bg-gradient-domain-projects',
    badgeClasses: 'bg-domain-projects/10 text-domain-projects border-domain-projects/20',
    borderHoverClass: 'hover:border-domain-projects/40',
    glowShadowClass: 'group-hover:shadow-[0_12px_35px_-10px_rgba(154,165,208,0.22)]',
    radialGlowClass: 'bg-domain-projects/10',
  },
  services: {
    id: 'services',
    label: 'Services',
    singularLabel: 'Service',
    emoji: '💼',
    href: '/services/',
    navDescription: 'B2B engineering advisory & pipelines',
    cssVar: '--color-domain-services',
    colors: {
      dark: '#6161b8',
      light: '#5d5db1',
    },
    bgClass: 'bg-domain-services',
    textClass: 'text-domain-services',
    headingGradientClass: 'heading-gradient-domain-services',
    bgGradientClass: 'bg-gradient-domain-services',
    badgeClasses: 'bg-domain-services/10 text-domain-services border-domain-services/20',
    borderHoverClass: 'hover:border-domain-services/40',
    glowShadowClass: 'group-hover:shadow-[0_12px_35px_-10px_rgba(161,161,211,0.22)]',
    radialGlowClass: 'bg-domain-services/10',
  },
  newsletters: {
    id: 'newsletters',
    label: 'Newsletters',
    singularLabel: 'Newsletter',
    emoji: '✉️',
    href: '/newsletters/',
    navDescription: 'Curated updates & engineering insights',
    cssVar: '--color-domain-newsletters',
    colors: {
      dark: '#7261b8',
      light: '#7161b3',
    },
    bgClass: 'bg-domain-newsletters',
    textClass: 'text-domain-newsletters',
    headingGradientClass: 'heading-gradient-domain-newsletters',
    bgGradientClass: 'bg-gradient-domain-newsletters',
    badgeClasses: 'bg-domain-newsletters/10 text-domain-newsletters border-domain-newsletters/20',
    borderHoverClass: 'hover:border-domain-newsletters/40',
    glowShadowClass: 'group-hover:shadow-[0_12px_35px_-10px_rgba(174,165,213,0.22)]',
    radialGlowClass: 'bg-domain-newsletters/10',
  },
  visualizations: {
    id: 'visualizations',
    label: 'Visualizations',
    singularLabel: 'Visualization',
    emoji: '📊',
    href: '/visualizations/',
    navDescription: 'Interactive 3D, WebGL & graph visualizers',
    cssVar: '--color-domain-visualizations',
    colors: {
      dark: '#8261b8',
      light: '#8061b3',
    },
    bgClass: 'bg-domain-visualizations',
    textClass: 'text-domain-visualizations',
    headingGradientClass: 'heading-gradient-domain-visualizations',
    bgGradientClass: 'bg-gradient-domain-visualizations',
    badgeClasses: 'bg-domain-visualizations/10 text-domain-visualizations border-domain-visualizations/20',
    borderHoverClass: 'hover:border-domain-visualizations/40',
    glowShadowClass: 'group-hover:shadow-[0_12px_35px_-10px_rgba(183,165,213,0.22)]',
    radialGlowClass: 'bg-domain-visualizations/10',
  },
  tags: {
    id: 'tags',
    label: 'Tags',
    singularLabel: 'Tag',
    emoji: '🏷️',
    href: '/tags/',
    navDescription: 'Topic taxonomy & cross-domain index',
    cssVar: '--color-domain-tags',
    colors: {
      dark: '#9261b8',
      light: '#8f61b3',
    },
    bgClass: 'bg-domain-tags',
    textClass: 'text-domain-tags',
    headingGradientClass: 'heading-gradient-domain-tags',
    bgGradientClass: 'bg-gradient-domain-tags',
    badgeClasses: 'bg-domain-tags/10 text-domain-tags border-domain-tags/20',
    borderHoverClass: 'hover:border-domain-tags/40',
    glowShadowClass: 'group-hover:shadow-[0_12px_35px_-10px_rgba(192,165,213,0.22)]',
    radialGlowClass: 'bg-domain-tags/10',
  },
};

export const CONTENT_DOMAINS: readonly ContentDomain[] = [
  'posts',
  'publications',
  'presentations',
  'courses',
  'projects',
  'services',
  'newsletters',
  'visualizations',
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
    return '#4f76b0';
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
    nodeDefault: isLight ? '#5679ae' : '#4f76b0',
  };
}
