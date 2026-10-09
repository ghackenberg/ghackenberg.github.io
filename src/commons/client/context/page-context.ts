import type { PageEnvelope, PageTocItem } from './types.ts';

const KNOWN_COLLECTIONS = [
  'posts',
  'presentations',
  'courses',
  'projects',
  'services',
  'publications',
  'visualizations',
  'interests',
] as const;

/**
 * Detects the collection type from a URL pathname
 */
export function detectCollectionType(pathname: string): string {
  const normalized = pathname.replace(/^\/+/, '').split('/')[0] || '';
  if (!normalized) {
    return 'home';
  }
  for (const collection of KNOWN_COLLECTIONS) {
    if (normalized === collection) {
      return collection;
    }
  }
  return normalized || 'general';
}

/**
 * Extracts table of contents (H2 and H3 elements) from content sections of the DOM,
 * ignoring header, navigation, and modal headings.
 */
export function extractTableOfContents(doc: Document | null): PageTocItem[] {
  if (!doc) return [];

  // Excluded selector classes or containers
  const excludedParents = [
    'footer',
    'nav',
    '#slide-list-drawer',
    '#references-modal',
    '#dev-studio-root',
    '#dev-analytics-hud',
  ].join(',');

  const headings = Array.from(doc.querySelectorAll<HTMLHeadingElement>('h2, h3'));
  const toc: PageTocItem[] = [];

  for (const el of headings) {
    if (el.closest(excludedParents)) {
      continue;
    }

    const title = el.textContent?.trim() || '';
    if (!title) continue;

    const level = el.tagName.toLowerCase() === 'h2' ? 2 : 3;
    const id = el.id || '';

    toc.push({ id, title, level });
  }

  return toc;
}

/**
 * Extracts meta information including description, article tags, and document language
 */
export function extractMetaTags(doc: Document | null): {
  description?: string;
  keywords?: string[];
  lang?: string;
} {
  if (!doc) return {};

  const descEl = doc.querySelector<HTMLMetaElement>(
    'meta[name="description"], meta[property="og:description"]'
  );
  const description = descEl?.getAttribute('content') || undefined;

  const tagElements = Array.from(
    doc.querySelectorAll<HTMLMetaElement>('meta[property="article:tag"]')
  );
  const keywordsSet = new Set<string>();

  for (const tagEl of tagElements) {
    const content = tagEl.getAttribute('content')?.trim();
    if (content) keywordsSet.add(content);
  }

  const keywordMeta = doc.querySelector<HTMLMetaElement>('meta[name="keywords"]');
  if (keywordMeta) {
    const rawKeywords = keywordMeta.getAttribute('content')?.split(',') || [];
    for (const kw of rawKeywords) {
      const trimmed = kw.trim();
      if (trimmed) keywordsSet.add(trimmed);
    }
  }

  const lang = doc.documentElement.getAttribute('lang') || 'en';

  return {
    description,
    keywords: keywordsSet.size > 0 ? Array.from(keywordsSet) : undefined,
    lang,
  };
}

/**
 * Extracts the complete page context envelope from the live DOM
 */
export function extractPageEnvelope(
  doc?: Document | null,
  overridePathname?: string
): PageEnvelope {
  const activeDoc = doc ?? (typeof document !== 'undefined' ? document : null);
  const currentPath =
    overridePathname ??
    (typeof window !== 'undefined' ? window.location.pathname : '/');

  const currentUrl =
    typeof window !== 'undefined' && window.location.href
      ? window.location.href
      : `https://hackenberg.tech${currentPath}`;

  const collectionType = detectCollectionType(currentPath);

  let title = '';
  if (activeDoc) {
    title = activeDoc.title?.trim() || '';
    if (!title) {
      const metaTitle = activeDoc.querySelector<HTMLMetaElement>(
        'meta[name="title"], meta[property="og:title"]'
      );
      title = metaTitle?.getAttribute('content')?.trim() || '';
    }
    if (!title) {
      const h1El = activeDoc.querySelector('h1');
      title = h1El?.textContent?.trim() || '';
    }
  }

  const meta = extractMetaTags(activeDoc);
  const toc = extractTableOfContents(activeDoc);

  return {
    collectionType,
    url: currentUrl,
    title: title || 'Dr. Georg Hackenberg',
    description: meta.description,
    keywords: meta.keywords,
    lang: meta.lang,
    toc,
  };
}
