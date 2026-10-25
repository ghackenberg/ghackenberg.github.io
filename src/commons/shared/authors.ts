import { z } from 'astro/zod';

export const authorObjectSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['Person', 'Organization']).default('Person'),
  id: z.url().optional(),
  orcid: z.string().regex(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/).optional(),
  wikidata: z.string().regex(/^(https:\/\/www\.wikidata\.org\/wiki\/)?Q\d+$/).optional(),
  url: z.url().optional(),
});

export type RawAuthorObject = z.input<typeof authorObjectSchema>;

export const publicationAuthorSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['Person', 'Organization']).default('Person'),
  id: z.url(),
  orcid: z.string().regex(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/).optional(),
  wikidata: z.string().regex(/^(https:\/\/www\.wikidata\.org\/wiki\/)?Q\d+$/).optional(),
  url: z.url(),
});

export type RawPublicationAuthor = z.input<typeof publicationAuthorSchema>;

export const authorEntrySchema = z
  .union([
    z.string().min(1).transform((name) => ({ name: name.trim(), type: 'Person' as const })),
    authorObjectSchema,
  ])
  .transform((entry) => {
    const id = 'id' in entry ? entry.id : undefined;
    const orcid = 'orcid' in entry ? entry.orcid : undefined;
    const wikidata = 'wikidata' in entry ? entry.wikidata : undefined;
    const url = 'url' in entry ? entry.url : undefined;

    const isGeorg =
      id === 'https://hackenberg.tech/#person' ||
      orcid === '0000-0002-0096-2484' ||
      /^Georg Hackenberg$/i.test(entry.name.trim());

    let normalizedWikidata = wikidata;
    if (normalizedWikidata && !normalizedWikidata.startsWith('http')) {
      normalizedWikidata = `https://www.wikidata.org/wiki/${normalizedWikidata}`;
    }

    if (isGeorg) {
      return {
        ...entry,
        name: 'Georg Hackenberg',
        type: 'Person' as const,
        id: 'https://hackenberg.tech/#person',
        orcid: orcid || '0000-0002-0096-2484',
        wikidata: normalizedWikidata,
        url: url || 'https://hackenberg.tech/',
      };
    }

    return {
      ...entry,
      name: entry.name.trim(),
      wikidata: normalizedWikidata,
      id,
      url,
    };
  });

export const publicationAuthorEntrySchema = publicationAuthorSchema.transform((entry) => {
  const isGeorg =
    entry.id === 'https://hackenberg.tech/#person' ||
    entry.orcid === '0000-0002-0096-2484' ||
    /^Georg Hackenberg$/i.test(entry.name.trim());

  let normalizedWikidata = entry.wikidata;
  if (normalizedWikidata && !normalizedWikidata.startsWith('http')) {
    normalizedWikidata = `https://www.wikidata.org/wiki/${normalizedWikidata}`;
  }

  if (isGeorg) {
    return {
      ...entry,
      name: 'Georg Hackenberg',
      type: 'Person' as const,
      id: 'https://hackenberg.tech/#person',
      orcid: entry.orcid || '0000-0002-0096-2484',
      wikidata: normalizedWikidata,
      url: entry.url || 'https://hackenberg.tech/',
    };
  }

  return {
    ...entry,
    name: entry.name.trim(),
    wikidata: normalizedWikidata,
    id: entry.id,
    url: entry.url,
  };
});

export type AuthorEntry = z.infer<typeof authorEntrySchema>;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Joins author names cleanly with zero HTML tags (e.g. "A", "A and B", or "A, B and C").
 */
export function formatAuthorsPlain(authors: AuthorEntry[]): string {
  if (!authors || authors.length === 0) return '';
  const names = authors.map((a) => a.name.trim()).filter(Boolean);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Formats author names for HTML rendering, wrapping Georg Hackenberg in `<strong>` tags.
 */
export function formatAuthorsHtml(authors: AuthorEntry[]): string {
  if (!authors || authors.length === 0) return '';
  const formatted = authors.map((a) => {
    const isGeorg = a.id === 'https://hackenberg.tech/#person' || /^Georg Hackenberg$/i.test(a.name.trim());
    const escaped = escapeHtml(a.name.trim());
    return isGeorg ? `<strong>${escaped}</strong>` : escaped;
  });

  if (formatted.length === 0) return '';
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]} and ${formatted[1]}`;
  return `${formatted.slice(0, -1).join(', ')} and ${formatted[formatted.length - 1]}`;
}
