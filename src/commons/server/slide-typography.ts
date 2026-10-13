import type { Page } from 'puppeteer';

export interface TypographyAuditResult {
  slideNumber: string | number;
  slideId: string;
  slideTitle: string;
  titleFontSize: number;
  maxContentFontSize: number;
  ratio: number; // maxContentFontSize / titleFontSize
  offendingElement: string; // e.g. '<div.code-scroll-area> pre.astro-code' or '<h3.bento-card-title>'
  previewText: string;
  isWarning: boolean; // true if maxContentFontSize >= titleFontSize
}

export interface PresentationTypographyReport {
  presentation: string;
  totalSlides: number;
  warningsCount: number;
  results: TypographyAuditResult[];
}

/**
 * Audits slide typography across all rendered slides in a presentation print view.
 * Ensures healthy visual hierarchy where content elements do not overpower slide titles.
 */
export async function auditSlideTypography(
  page: Page,
  presentationSlug: string
): Promise<PresentationTypographyReport> {
  // Ensure window.__name is defined in browser context in case tsx / esbuild inlines helper references
  await page.evaluate('window.__name = window.__name || function(f) { return f; };');

  const evaluated = await page.evaluate((): {
    totalSlides: number;
    results: TypographyAuditResult[];
  } => {
    const slideEls = Array.from(document.querySelectorAll<HTMLElement>('.print-slide-page'));
    const results: TypographyAuditResult[] = [];

    const candidateSelector = [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'li',
      'pre',
      'code',
      '.metric-stat-value',
      '.comp-table-cell',
      '.table-row-title',
      '.bento-card-title',
      '.bento-card-description',
      '.callout-title',
      '.callout-text',
      '.formula-box',
      '.formula-box-content',
      '.step-title',
      '.step-text',
      'td',
      'th',
    ].join(', ');

    for (let i = 0; i < slideEls.length; i++) {
      const slideEl = slideEls[i];
      const slideNumber = slideEl.getAttribute('data-slide-number') || i + 1;
      const slideId = slideEl.getAttribute('data-slide-id') || slideEl.id || `slide-${i + 1}`;

      const titleEl = slideEl.querySelector<HTMLElement>('.slide-title, h1.slide-title');
      if (!titleEl) {
        continue;
      }

      const slideTitle = (titleEl.textContent || '').trim();
      const titleFontSize = parseFloat(window.getComputedStyle(titleEl).fontSize) || 0;
      if (titleFontSize <= 0) {
        continue;
      }

      const mainStage =
        slideEl.querySelector<HTMLElement>('.slide-main-stage') ||
        slideEl.querySelector<HTMLElement>('main') ||
        slideEl;

      const rawElements = Array.from(mainStage.querySelectorAll<HTMLElement>(candidateSelector));
      const allDescendants = Array.from(mainStage.querySelectorAll<HTMLElement>('*'));
      for (const desc of allDescendants) {
        if (desc.children.length === 0 && (desc.textContent || '').trim().length > 0) {
          if (!rawElements.includes(desc)) {
            rawElements.push(desc);
          }
        }
      }

      let maxContentFontSize = 0;
      let offendingEl: HTMLElement | null = null;

      for (const el of rawElements) {
        if (el.closest('.slide-header, .slide-number-badge, .slide-footer')) {
          continue;
        }

        const tag = el.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'svg' || tag === 'path') {
          continue;
        }

        if (el.classList.contains('katex-mathml')) {
          continue;
        }

        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') {
          continue;
        }

        const text = (el.textContent || '').trim();
        if (!text) {
          continue;
        }

        const fontSize = parseFloat(style.fontSize) || 0;
        if (fontSize > maxContentFontSize) {
          maxContentFontSize = fontSize;
          offendingEl = el;
        }
      }

      const ratio =
        titleFontSize > 0
          ? parseFloat((maxContentFontSize / titleFontSize).toFixed(2))
          : 0;
      const isWarning = maxContentFontSize >= titleFontSize;

      let offendingElement = 'none';
      if (offendingEl) {
        const parts: string[] = [];
        let curr: Element | null = offendingEl;
        let count = 0;
        while (curr && count < 2) {
          const tag = curr.tagName.toLowerCase();
          const classNames = Array.from(curr.classList)
            .filter((c) => !c.includes(':') && !c.includes('[') && !c.includes('/'))
            .slice(0, 2)
            .map((c) => `.${c}`)
            .join('');
          parts.unshift(`<${tag}${classNames}>`);
          if (
            curr.parentElement &&
            (curr.parentElement.classList.contains('slide-main-stage') ||
              curr.parentElement.tagName.toLowerCase() === 'main' ||
              curr.parentElement.classList.contains('print-slide-page'))
          ) {
            break;
          }
          curr = curr.parentElement;
          count++;
        }
        offendingElement = parts.join(' ');
      }

      results.push({
        slideNumber,
        slideId,
        slideTitle,
        titleFontSize: parseFloat(titleFontSize.toFixed(1)),
        maxContentFontSize: parseFloat(maxContentFontSize.toFixed(1)),
        ratio,
        offendingElement,
        previewText: offendingEl
          ? (offendingEl.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)
          : '',
        isWarning,
      });
    }

    return {
      totalSlides: slideEls.length,
      results,
    };
  });

  const warningsCount = evaluated.results.filter((r) => r.isWarning).length;

  return {
    presentation: presentationSlug,
    totalSlides: evaluated.totalSlides,
    warningsCount,
    results: evaluated.results,
  };
}
