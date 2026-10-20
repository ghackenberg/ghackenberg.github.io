import type { Page } from 'puppeteer';

export interface TypographyWarning {
  type: 'TOO_LARGE' | 'TOO_SMALL';
  element: string;
  fontSize: number;
  threshold: number;
  ratio?: number;
  previewText: string;
}

export interface TypographyAuditResult {
  slideNumber: string | number;
  slideId: string;
  slideTitle: string;
  titleFontSize: number;
  maxContentFontSize: number;
  minContentFontSize: number;
  ratio: number; // maxContentFontSize / titleFontSize
  maxRatio: number;
  offendingElement: string; // primary offending element for backward compatibility
  previewText: string;
  largestElement: string;
  largestPreviewText: string;
  smallestElement: string;
  smallestPreviewText: string;
  isTooLargeWarning: boolean;
  isTooSmallWarning: boolean;
  isWarning: boolean;
  warnings: TypographyWarning[];
}

export interface PresentationTypographyReport {
  presentation: string;
  totalSlides: number;
  warningsCount: number;
  tooLargeCount: number;
  tooSmallCount: number;
  results: TypographyAuditResult[];
}

export interface SlideTypographyOptions {
  maxRatioThreshold?: number; // default: 0.85 (85% of slide title)
  minFontSizeThreshold?: number; // default: 18 (18px for primary reading content)
}

/**
 * Audits slide typography across all rendered slides in a presentation print view.
 * Ensures healthy visual hierarchy:
 * 1. Content elements do not overpower slide titles (ratio < maxRatioThreshold).
 * 2. Primary reading text remains readable after content scaling (fontSize >= minFontSizeThreshold).
 */
export async function auditSlideTypography(
  page: Page,
  presentationSlug: string,
  options: SlideTypographyOptions = {}
): Promise<PresentationTypographyReport> {
  const maxRatioThreshold = options.maxRatioThreshold ?? 0.85;
  const minFontSizeThreshold = options.minFontSizeThreshold ?? 18;

  // Ensure window.__name is defined in browser context in case tsx / esbuild inlines helper references
  await page.evaluate('window.__name = window.__name || function(f) { return f; };');

  const evaluated = await page.evaluate(
    (maxRatioLimit: number, minSizeLimit: number): {
      totalSlides: number;
      results: TypographyAuditResult[];
    } => {
      const slideEls = Array.from(document.querySelectorAll<HTMLElement>('.print-slide-page'));
      const results: TypographyAuditResult[] = [];

      function getElementPath(el: HTMLElement | null): string {
        if (!el) return 'none';
        const parts: string[] = [];
        let curr: Element | null = el;
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
        return parts.join(' ');
      }

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

        const allElements = Array.from(mainStage.querySelectorAll<HTMLElement>('*'));

        let maxContentFontSize = 0;
        let largestEl: HTMLElement | null = null;
        let minContentFontSize = Infinity;
        let smallestEl: HTMLElement | null = null;

        for (const el of allElements) {
          // Exclude header, number badge, footer
          if (el.closest('.slide-header, .slide-number-badge, .slide-footer')) {
            continue;
          }

          const tag = el.tagName.toLowerCase();
          if (tag === 'script' || tag === 'style' || tag === 'svg' || tag === 'path') {
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
          if (fontSize <= 0) {
            continue;
          }

          // === AUDIT 1: Upper Bound (Too Large) ===
          // Check text elements against slide title.
          // Exclude monumental statistics (.metric-stat-value, .metric-stat-unit),
          // pipeline step numbers (.step-num-badge, .step-circle),
          // and math formulas (KaTeX, .formula-box-formula).
          const isStatNumber = !!el.closest('.metric-stat-value, .metric-stat-unit, .metric-stat-label');
          const isStepBadge = !!el.closest('.step-num-badge, .step-circle');
          const isMathFormula =
            el.classList.contains('katex-mathml') ||
            !!el.closest('.katex, .katex-display, math, .formula-box-formula');

          if (!isStatNumber && !isStepBadge && !isMathFormula) {
            if (fontSize > maxContentFontSize) {
              maxContentFontSize = fontSize;
              largestEl = el;
            }
          }

          // === AUDIT 2: Lower Bound (Too Small After Scaling) ===
          // Audit primary reading content: paragraphs, list items, card titles, table cells, code.
          // Exclude intentional micro-typography: citations, superscripts/subscripts, formula labels, tiny tags/badges.
          const isFootnoteOrCitation = !!el.closest('.citation, sup, sub, .footnote, small');
          const isFormulaLabel = !!el.closest('.formula-box-label');
          const isMicroTag = !!el.closest('.tag-pill, .status-badge, kbd, .avatar-wrapper');

          if (!isFootnoteOrCitation && !isFormulaLabel && !isMicroTag) {
            const isPrimaryContent =
              tag === 'p' ||
              tag === 'li' ||
              tag === 'td' ||
              tag === 'th' ||
              tag === 'pre' ||
              tag === 'code' ||
              tag === 'h3' ||
              tag === 'h4' ||
              tag === 'h5' ||
              tag === 'h6' ||
              el.classList.contains('comp-table-cell') ||
              el.classList.contains('table-row-title') ||
              el.classList.contains('table-row-subtitle') ||
              el.classList.contains('bento-card-title') ||
              el.classList.contains('bento-card-description') ||
              el.classList.contains('callout-text') ||
              el.classList.contains('callout-title') ||
              el.classList.contains('step-text') ||
              el.classList.contains('step-title');

            if (isPrimaryContent && text.length > 2) {
              if (el.children.length === 0 || tag === 'code' || tag === 'p' || tag === 'li') {
                if (fontSize < minContentFontSize) {
                  minContentFontSize = fontSize;
                  smallestEl = el;
                }
              }
            }
          }
        }

        if (minContentFontSize === Infinity) {
          minContentFontSize = 0;
        }

        const maxRatio =
          titleFontSize > 0
            ? parseFloat((maxContentFontSize / titleFontSize).toFixed(2))
            : 0;

        const maxAllowedSize = titleFontSize * maxRatioLimit;
        const isTooLargeWarning = maxRatio >= maxRatioLimit;
        const isTooSmallWarning = minContentFontSize > 0 && minContentFontSize < minSizeLimit;
        const isWarning = isTooLargeWarning || isTooSmallWarning;

        const largestElement = getElementPath(largestEl);
        const smallestElement = getElementPath(smallestEl);
        const largestPreviewText = largestEl
          ? (largestEl.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)
          : '';
        const smallestPreviewText = smallestEl
          ? (smallestEl.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)
          : '';

        const warnings: TypographyWarning[] = [];
        if (isTooLargeWarning) {
          warnings.push({
            type: 'TOO_LARGE',
            element: largestElement,
            fontSize: parseFloat(maxContentFontSize.toFixed(1)),
            threshold: parseFloat(maxAllowedSize.toFixed(1)),
            ratio: maxRatio,
            previewText: largestPreviewText,
          });
        }
        if (isTooSmallWarning) {
          warnings.push({
            type: 'TOO_SMALL',
            element: smallestElement,
            fontSize: parseFloat(minContentFontSize.toFixed(1)),
            threshold: minSizeLimit,
            previewText: smallestPreviewText,
          });
        }

        const offendingElement = isTooLargeWarning
          ? largestElement
          : isTooSmallWarning
            ? smallestElement
            : 'none';
        const previewText = isTooLargeWarning
          ? largestPreviewText
          : isTooSmallWarning
            ? smallestPreviewText
            : '';

        results.push({
          slideNumber,
          slideId,
          slideTitle,
          titleFontSize: parseFloat(titleFontSize.toFixed(1)),
          maxContentFontSize: parseFloat(maxContentFontSize.toFixed(1)),
          minContentFontSize: parseFloat(minContentFontSize.toFixed(1)),
          ratio: maxRatio,
          maxRatio,
          offendingElement,
          previewText,
          largestElement,
          largestPreviewText,
          smallestElement,
          smallestPreviewText,
          isTooLargeWarning,
          isTooSmallWarning,
          isWarning,
          warnings,
        });
      }

      return {
        totalSlides: slideEls.length,
        results,
      };
    },
    maxRatioThreshold,
    minFontSizeThreshold
  );

  const warningsCount = evaluated.results.filter((r) => r.isWarning).length;
  const tooLargeCount = evaluated.results.filter((r) => r.isTooLargeWarning).length;
  const tooSmallCount = evaluated.results.filter((r) => r.isTooSmallWarning).length;

  return {
    presentation: presentationSlug,
    totalSlides: evaluated.totalSlides,
    warningsCount,
    tooLargeCount,
    tooSmallCount,
    results: evaluated.results,
  };
}
