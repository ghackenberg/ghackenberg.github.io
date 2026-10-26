import { z } from 'astro/zod';

export const authorObjectSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['Person', 'Organization']).default('Person'),
  id: z.url().optional(),
});

export type RawAuthorObject = z.input<typeof authorObjectSchema>;

export const authorEntrySchema = z
  .union([
    z.string().min(1).transform((name) => ({ name: name.trim(), type: 'Person' as const })),
    authorObjectSchema,
  ])
  .transform((entry) => {
    const id = 'id' in entry ? entry.id : undefined;

    const isGeorg =
      id === 'https://hackenberg.tech/#person' ||
      /^Georg Hackenberg$/i.test(entry.name.trim());

    if (isGeorg) {
      return {
        ...entry,
        name: 'Georg Hackenberg',
        type: 'Person' as const,
        id: 'https://hackenberg.tech/#person',
      };
    }

    return {
      ...entry,
      name: entry.name.trim(),
      id,
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
