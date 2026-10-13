import type { Page } from 'puppeteer';

export interface ContainerDensityResult {
  containerType: 'BentoCard' | 'MetricStat' | 'CodeContainer' | 'Pipeline' | 'Table' | 'FormulaBox' | string;
  containerTitle?: string;
  availableHeight: number; // in px
  usedHeight: number;      // in px
  fillRatio: number;       // usedHeight / availableHeight (e.g. 0.42 for 42%)
  threshold: number;       // e.g. 0.50 (50%)
  isWarning: boolean;      // true if fillRatio < threshold
  previewSnippet?: string; // brief text snippet of content
}

export interface SlideDensityResult {
  slideNumber: string | number;
  slideId: string;
  slideTitle?: string;
  containers: ContainerDensityResult[];
  warnings: ContainerDensityResult[];
}

export interface PresentationDensityReport {
  presentation: string;
  totalSlides: number;
  totalContainersScanned: number;
  warningsCount: number;
  results: SlideDensityResult[];
}

export interface AuditSlideDensityOptions {
  defaultThreshold?: number;
}

/**
 * Audits slide content density across all rendered slides in a presentation print view.
 * Detects underfilled layout containers (BentoCards, Code containers, Pipeline steps, Tables, Metric stats).
 */
export async function auditSlideDensity(
  page: Page,
  presentationSlug: string,
  options?: AuditSlideDensityOptions
): Promise<PresentationDensityReport> {
  // Ensure window.__name is defined in browser context in case tsx / esbuild inlines helper references
  await page.evaluate('window.__name = window.__name || function(f) { return f; };');

  const evaluated = await page.evaluate(
    (customDefaultThreshold?: number): {
      totalSlides: number;
      results: SlideDensityResult[];
    } => {
      const slideEls = Array.from(document.querySelectorAll<HTMLElement>('.print-slide-page'));
      const results: SlideDensityResult[] = [];

      const candidateSelector = [
        '.bento-card-root',
        '.metric-stat-card',
        '.code-container-root',
        '.step-card',
        '.step-row',
        '.comparison-table-container',
        '.slide-table-container',
        '.formula-box',
      ].join(', ');

      for (let i = 0; i < slideEls.length; i++) {
        const slideEl = slideEls[i];
        const slideNumber = slideEl.getAttribute('data-slide-number') || i + 1;
        const slideId = slideEl.getAttribute('data-slide-id') || slideEl.id || `slide-${i + 1}`;

        const titleEl = slideEl.querySelector<HTMLElement>('.slide-title, h1.slide-title');
        const slideTitle = titleEl ? (titleEl.textContent || '').trim() : undefined;

        // Query candidate content containers on the 1080p stage
        const allCandidates = Array.from(slideEl.querySelectorAll<HTMLElement>(candidateSelector));
        if (allCandidates.length === 0) {
          continue;
        }

        // Filter out nested candidate containers (e.g. formula-box or callout inside bento-card-root)
        const containerEls = allCandidates.filter((el) => {
          const parentCandidate = el.parentElement?.closest<HTMLElement>(candidateSelector);
          return !parentCandidate || !allCandidates.includes(parentCandidate);
        });

        if (containerEls.length === 0) {
          continue;
        }

        const containersOnSlide: ContainerDensityResult[] = [];

        for (const container of containerEls) {
          let containerType = 'BentoCard';
          if (container.classList.contains('bento-card-root')) {
            containerType = 'BentoCard';
          } else if (container.classList.contains('metric-stat-card')) {
            containerType = 'MetricStat';
          } else if (container.classList.contains('code-container-root')) {
            containerType = 'CodeContainer';
          } else if (container.classList.contains('step-card') || container.classList.contains('step-row')) {
            containerType = 'Pipeline';
          } else if (
            container.classList.contains('comparison-table-container') ||
            container.classList.contains('slide-table-container')
          ) {
            containerType = 'Table';
          } else if (container.classList.contains('formula-box')) {
            containerType = 'FormulaBox';
          }

          // Determine threshold
          let threshold = 0.50;
          if (containerType === 'MetricStat') {
            threshold = 0.40;
          } else if (containerType === 'CodeContainer') {
            threshold = 0.45;
          } else if (containerType === 'BentoCard') {
            threshold = 0.80;
          } else if (containerType === 'Pipeline') {
            // If the step card has a graphic area or image, use 0.40 threshold
            const hasGraphic =
              container.querySelector<HTMLElement>('.step-graphic-area, .step-image-container, img') !== null &&
              !container.classList.contains('no-graphic');
            threshold = hasGraphic ? 0.40 : 0.50;
          }

          if (customDefaultThreshold !== undefined && customDefaultThreshold > 0) {
            if (containerType === 'MetricStat') {
              threshold = Math.min(customDefaultThreshold, 0.40);
            } else if (containerType === 'CodeContainer') {
              threshold = Math.min(customDefaultThreshold, 0.45);
            } else if (containerType === 'Pipeline') {
              const hasGraphic =
                container.querySelector<HTMLElement>('.step-graphic-area, .step-image-container, img') !== null &&
                !container.classList.contains('no-graphic');
              threshold = hasGraphic ? Math.min(customDefaultThreshold, 0.40) : customDefaultThreshold;
            } else {
              threshold = customDefaultThreshold;
            }
          }

          // Extract container title
          let containerTitle: string | undefined;
          if (containerType === 'BentoCard') {
            const h = container.querySelector<HTMLElement>('h3, .bento-card-title');
            if (h) containerTitle = (h.textContent || '').trim();
          } else if (containerType === 'MetricStat') {
            const label = container.querySelector<HTMLElement>('.metric-stat-label, h4');
            if (label) containerTitle = (label.textContent || '').trim();
          } else if (containerType === 'CodeContainer') {
            const header = container.querySelector<HTMLElement>('.font-sans.font-semibold, .text-slate-400');
            if (header) containerTitle = (header.textContent || '').trim();
          } else if (containerType === 'Pipeline') {
            const title = container.querySelector<HTMLElement>('h4, .step-title');
            if (title) containerTitle = (title.textContent || '').trim();
          } else if (containerType === 'Table') {
            const caption = container.querySelector<HTMLElement>('.slide-table-caption');
            if (caption) {
              containerTitle = (caption.textContent || '').trim();
            } else {
              const firstRowTitle = container.querySelector<HTMLElement>('.table-row-title');
              if (firstRowTitle) containerTitle = (firstRowTitle.textContent || '').trim();
            }
          } else if (containerType === 'FormulaBox') {
            const fl = container.querySelector<HTMLElement>('.formula-box-label');
            if (fl) containerTitle = (fl.textContent || '').trim();
          }

          // Preview snippet
          const rawSnippet = (container.textContent || '').replace(/\s+/g, ' ').trim();
          const previewSnippet =
            rawSnippet.length > 80 ? `${rawSnippet.slice(0, 80)}...` : rawSnippet || undefined;

          // Available height
          const style = window.getComputedStyle(container);
          const paddingTop = parseFloat(style.paddingTop) || 0;
          const paddingBottom = parseFloat(style.paddingBottom) || 0;
          let availableHeight = container.clientHeight - paddingTop - paddingBottom;

          if (containerType === 'CodeContainer') {
            const scrollArea = container.querySelector<HTMLElement>('.code-scroll-area');
            if (scrollArea) {
              const saStyle = window.getComputedStyle(scrollArea);
              const saPaddingTop = parseFloat(saStyle.paddingTop) || 0;
              const saPaddingBottom = parseFloat(saStyle.paddingBottom) || 0;
              availableHeight = scrollArea.clientHeight - saPaddingTop - saPaddingBottom;
            }
          }

          // Skip small sub-boxes or rows to avoid noise
          if (availableHeight < 100) {
            continue;
          }

          // Calculate usedHeight
          let usedHeight = 0;

          if (containerType === 'BentoCard') {
            const cardRect = container.getBoundingClientRect();
            const innerContentTop = cardRect.top + paddingTop;
            const bodyEl = container.querySelector<HTMLElement>('.flex-1');
            let contentBottom = innerContentTop;

            const headerEl = container.querySelector<HTMLElement>(
              '.bento-card-root > div.mb-8, .bento-card-root > div.mb-6, .bento-card-root > div:not(.bento-top-bar):not(.flex-1)'
            );
            if (headerEl) {
              const hr = headerEl.getBoundingClientRect();
              if (hr.bottom > contentBottom) {
                contentBottom = hr.bottom;
              }
            }

            if (bodyEl) {
              // Measure actual content elements instead of outer flex wrapper containers
              const contentEls = Array.from(
                bodyEl.querySelectorAll<HTMLElement>(
                  'p, li, .bar-chart-row, tr, .table-row-item, h4, h5, pre, code, .formula-box, .callout-box, .metric-stat-card, blockquote, img, svg'
                )
              ).filter((el) => {
                if (el.tagName.toLowerCase() === 'svg' && (el.closest('.bullet-badge') || el.closest('button'))) {
                  return false;
                }
                const s = window.getComputedStyle(el);
                return s.display !== 'none' && s.visibility !== 'hidden';
              });

              if (contentEls.length > 0) {
                for (const el of contentEls) {
                  const r = el.getBoundingClientRect();
                  if (r.bottom > contentBottom) {
                    contentBottom = r.bottom;
                  }
                }
              } else {
                const bodyChildren = Array.from(bodyEl.children);
                if (bodyChildren.length > 0) {
                  for (const child of bodyChildren) {
                    const r = child.getBoundingClientRect();
                    if (r.bottom > contentBottom) {
                      contentBottom = r.bottom;
                    }
                  }
                } else {
                  contentBottom = bodyEl.getBoundingClientRect().bottom;
                }
              }
            }

            usedHeight = Math.max(0, contentBottom - innerContentTop);
          } else if (containerType === 'CodeContainer') {
            const scrollArea = container.querySelector<HTMLElement>('.code-scroll-area') || container;
            const preOrCode = scrollArea.querySelector<HTMLElement>('pre, code');
            if (preOrCode) {
              usedHeight = preOrCode.getBoundingClientRect().height;
            } else {
              usedHeight = scrollArea.scrollHeight;
            }
          } else if (containerType === 'Pipeline') {
            if (container.classList.contains('step-row')) {
              const textContainer = container.querySelector<HTMLElement>('.step-text-container') || container;
              const firstChild = textContainer.firstElementChild;
              const lastChild = textContainer.lastElementChild;
              if (firstChild && lastChild) {
                usedHeight = Math.max(0, lastChild.getBoundingClientRect().bottom - firstChild.getBoundingClientRect().top);
              } else {
                usedHeight = textContainer.getBoundingClientRect().height;
              }
            } else {
              const cardRect = container.getBoundingClientRect();
              const cardInnerTop = cardRect.top + paddingTop;
              const textContainer = container.querySelector<HTMLElement>('.step-text-container') || container;
              const lastContentItem =
                textContainer.querySelector<HTMLElement>('p:last-of-type, h4:last-of-type') ||
                textContainer.lastElementChild;
              if (lastContentItem) {
                usedHeight = Math.max(0, lastContentItem.getBoundingClientRect().bottom - cardInnerTop);
              } else {
                usedHeight = textContainer.getBoundingClientRect().height;
              }
            }
          } else if (containerType === 'Table') {
            if (container.classList.contains('comparison-table-container')) {
              const headerGrid = container.querySelector<HTMLElement>('.table-header-grid');
              const headerH = headerGrid ? headerGrid.getBoundingClientRect().height : 0;
              const rows = Array.from(container.querySelectorAll<HTMLElement>('.table-row-item'));
              let rowsH = 0;
              for (const row of rows) {
                const cells = Array.from(row.querySelectorAll<HTMLElement>('.comp-table-cell, [data-cell]'));
                if (cells.length > 0) {
                  let maxCellH = 0;
                  for (const cell of cells) {
                    const ch = cell.scrollHeight || cell.clientHeight || cell.getBoundingClientRect().height;
                    if (ch > maxCellH) maxCellH = ch;
                  }
                  rowsH += maxCellH;
                } else {
                  rowsH += row.clientHeight || 0;
                }
              }
              usedHeight = headerH + rowsH;
            } else {
              const table = container.querySelector<HTMLElement>('table');
              const caption = container.querySelector<HTMLElement>('.slide-table-caption');
              const tableH = table ? table.getBoundingClientRect().height : 0;
              const captionH = caption ? caption.getBoundingClientRect().height : 0;
              usedHeight = tableH + captionH;
            }
          } else if (containerType === 'MetricStat') {
            const firstChild = container.firstElementChild;
            const lastChild = container.lastElementChild;
            if (firstChild && lastChild) {
              usedHeight = Math.max(0, lastChild.getBoundingClientRect().bottom - firstChild.getBoundingClientRect().top);
            } else {
              usedHeight = container.clientHeight;
            }
          } else if (containerType === 'FormulaBox') {
            const label = container.querySelector<HTMLElement>('.formula-box-label');
            const content = container.querySelector<HTMLElement>('.formula-box-content') || container;
            const top = (label || content).getBoundingClientRect().top;
            const bottom = content.getBoundingClientRect().bottom;
            usedHeight = Math.max(0, bottom - top);
          } else {
            const firstChild = container.firstElementChild;
            const lastChild = container.lastElementChild;
            if (firstChild && lastChild) {
              usedHeight = Math.max(0, lastChild.getBoundingClientRect().bottom - firstChild.getBoundingClientRect().top);
            } else {
              usedHeight = container.clientHeight;
            }
          }

          usedHeight = Math.round(usedHeight);
          availableHeight = Math.round(availableHeight);
          const fillRatio =
            availableHeight > 0
              ? parseFloat(Math.min(1.0, usedHeight / availableHeight).toFixed(2))
              : 1.0;
          const isWarning = fillRatio < threshold;

          containersOnSlide.push({
            containerType,
            containerTitle,
            availableHeight,
            usedHeight,
            fillRatio,
            threshold,
            isWarning,
            previewSnippet,
          });
        }

        if (containersOnSlide.length > 0) {
          const warningsOnSlide = containersOnSlide.filter((c) => c.isWarning);
          results.push({
            slideNumber,
            slideId,
            slideTitle,
            containers: containersOnSlide,
            warnings: warningsOnSlide,
          });
        }
      }

      return {
        totalSlides: slideEls.length,
        results,
      };
    },
    options?.defaultThreshold
  );

  const totalContainersScanned = evaluated.results.reduce(
    (sum, r) => sum + r.containers.length,
    0
  );
  const warningsCount = evaluated.results.reduce(
    (sum, r) => sum + r.warnings.length,
    0
  );

  return {
    presentation: presentationSlug,
    totalSlides: evaluated.totalSlides,
    totalContainersScanned,
    warningsCount,
    results: evaluated.results,
  };
}
