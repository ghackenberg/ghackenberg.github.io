import { render } from 'preact';
import { generateCitationLabel } from '@commons/shared/citations.js';

export interface SlideReferenceAuthor {
  name: string;
  type?: string;
  id?: string;
  orcid?: string;
  wikidata?: string;
  url?: string;
}

export interface SlideReferenceItem {
  id?: string;
  label?: string;
  type: string;
  author?: string;
  authors?: SlideReferenceAuthor[];
  title: string;
  year?: number | string;
  url?: string;
  siteName?: string;
  booktitle?: string;
  journal?: string;
  volume?: string;
  number?: string;
  pages?: string;
  publisher?: string;
  howpublished?: string;
  doi?: string;
}

export interface SlideReferencesListProps {
  refs: SlideReferenceItem[];
  targetHighlightId?: string | null;
}

function resolveReferenceLinkText(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (
      host.includes('doi.org') ||
      host.includes('arxiv.org') ||
      host.includes('acm.org') ||
      host.includes('ieee.org')
    ) {
      return 'Publikation öffnen';
    }
    if (host.includes('w3.org') || host.includes('iso.org') || host.includes('din.de')) {
      return 'Spezifikation öffnen';
    }
    if (host.includes('github.com')) {
      return 'Repository öffnen';
    }
    return host;
  } catch {
    return 'Quelle öffnen';
  }
}

function ReferencePublicationDetails({ reference }: { reference: SlideReferenceItem }) {
  if (reference.type === 'inproceedings' && reference.booktitle) {
    return (
      <>
        {' In '}
        <span class="text-gray-200 light:text-slate-700 font-medium">{reference.booktitle}</span>
        {reference.pages ? `, pp. ${reference.pages}` : ''}.
      </>
    );
  }
  if (reference.type === 'article' && reference.journal) {
    return (
      <>
        {' '}
        <span class="text-gray-200 light:text-slate-700 font-medium">{reference.journal}</span>
        {reference.volume ? ` ${reference.volume}` : ''}
        {reference.number ? `(${reference.number})` : ''}
        {reference.pages ? `, pp. ${reference.pages}` : ''}.
      </>
    );
  }
  if (reference.type === 'book' && reference.publisher) {
    return (
      <>
        {' '}
        <span class="text-gray-200 light:text-slate-700">{reference.publisher}</span>.
      </>
    );
  }
  if (reference.type === 'online' && reference.siteName) {
    return (
      <>
        {' '}
        <span class="text-gray-200 light:text-slate-700 font-medium">{reference.siteName}</span>.
      </>
    );
  }
  if (reference.type === 'misc' && reference.howpublished) {
    return (
      <>
        {' '}
        <span class="text-gray-200 light:text-slate-700">{reference.howpublished}</span>.
      </>
    );
  }
  return null;
}

export function SlideReferencesList({ refs, targetHighlightId }: SlideReferencesListProps) {
  if (!refs || refs.length === 0) {
    return (
      <div class="p-8 text-center text-text-subtle light:text-slate-500 flex flex-col items-center justify-center gap-2.5">
        <div class="w-10 h-10 rounded-xl bg-domain-publications/15 border border-domain-publications/30 text-domain-publications flex items-center justify-center mb-1">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        </div>
        <p class="font-medium text-xs sm:text-sm">No specific citations listed for this slide.</p>
      </div>
    );
  }

  return (
    <>
      {refs.map((ref, idx) => {
        const label = generateCitationLabel(ref);
        const isTarget = Boolean(targetHighlightId && ref.id === targetHighlightId);
        const highlightClasses = isTarget
          ? 'ring-2 ring-domain-publications/80 bg-domain-publications/10'
          : '';
        const authorsText = ref.authors
          ? ref.authors.map((a) => a.name).join(', ')
          : ref.author || '';
        const linkText = ref.url ? resolveReferenceLinkText(ref.url) : '';

        return (
          <div
            key={ref.id || `ref-${idx}`}
            id={`modal-ref-${ref.id || ''}`}
            class={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-element-bg/60 hover:bg-element-bg border border-element-border shadow-sm space-y-2.5 transition-all ${highlightClasses}`}
          >
            <div class="flex items-center justify-between gap-2">
              <span class="inline-flex items-center font-mono text-domain-publications font-bold text-xs px-2.5 py-0.5 rounded-full bg-domain-publications/15 border border-domain-publications/30">
                [{label}]
              </span>
              {ref.type && (
                <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-element-bg light:bg-slate-200 text-text-subtle light:text-slate-700 border border-element-border-medium light:border-slate-300">
                  {ref.type}
                </span>
              )}
            </div>
            <div class="text-xs sm:text-sm text-gray-300 light:text-slate-600 leading-relaxed pl-2.5 border-l-2 border-domain-publications/50">
              <span class="font-bold text-white light:text-slate-900">{authorsText}</span>
              {ref.year !== undefined && ref.year !== null && String(ref.year).length > 0 && (
                <span class="text-text-subtle light:text-slate-500"> ({String(ref.year)})</span>
              )}
              :{' '}
              <span class="italic text-gray-200 light:text-slate-800">"{ref.title}"</span>.
              <span class="text-text-subtle light:text-slate-500 block sm:inline">
                <ReferencePublicationDetails reference={ref} />
              </span>
            </div>
            <div class="flex flex-wrap items-center gap-2 pt-1 pl-2.5">
              {ref.url && (
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-[11px] font-semibold text-domain-publications hover:underline"
                >
                  <span>{linkText}</span>
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M10 6H6a2 2 0 01-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              )}
              {ref.doi && (
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-domain-publications/15 text-domain-publications border border-domain-publications/30">
                  DOI: {ref.doi}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

export function renderSlideReferences(
  container: HTMLElement,
  refs: SlideReferenceItem[],
  targetHighlightId?: string | null
): void {
  render(<SlideReferencesList refs={refs} targetHighlightId={targetHighlightId} />, container);
}
