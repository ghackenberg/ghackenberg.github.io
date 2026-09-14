import { getConfig } from '../config.js';

/**
 * Normalizes any incoming URL, path, or relative reference to a canonical relative path
 * with a leading slash and trailing slash (consistent with Astro's trailingSlash: 'always').
 *
 * Examples:
 * - "https://hackenberg.tech/posts/my-article" -> "/posts/my-article/"
 * - "https://hackenberg.tech/posts/my-article/" -> "/posts/my-article/"
 * - "/posts/my-article" -> "/posts/my-article/"
 * - "posts/my-article/" -> "/posts/my-article/"
 * - "/" -> "/"
 * - "/index.html" -> "/"
 * - "/posts/my-article?ref=twitter#heading" -> "/posts/my-article/"
 */
export function normalizePath(input: string): string {
  if (!input || typeof input !== 'string') {
    return '/';
  }

  let cleaned = input.trim();

  // If it's a full URL, parse the pathname
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    try {
      const parsed = new URL(cleaned);
      cleaned = parsed.pathname;
    } catch {
      // If URL parsing fails, strip protocol and host manually
      cleaned = cleaned.replace(/^https?:\/\/[^/]+/, '');
    }
  }

  // Strip query parameters and hash fragments
  cleaned = cleaned.split('?')[0].split('#')[0];

  // Strip index.html / index.htm
  cleaned = cleaned.replace(/\/index\.html?$/i, '/');

  // Ensure leading slash
  if (!cleaned.startsWith('/')) {
    cleaned = '/' + cleaned;
  }

  // Ensure trailing slash for paths other than empty/root
  if (cleaned.length > 1 && !cleaned.endsWith('/')) {
    cleaned = cleaned + '/';
  }

  // Lowercase for consistent key matching
  return cleaned.toLowerCase();
}

/**
 * Constructs the canonical full URL for a normalized path.
 */
export function toFullUrl(normalizedPath: string, customBaseUrl?: string): string {
  const config = getConfig();
  const base = (customBaseUrl || config.siteBaseUrl).replace(/\/$/, '');
  const path = normalizedPath.startsWith('/') ? normalizedPath : '/' + normalizedPath;
  return `${base}${path}`;
}
