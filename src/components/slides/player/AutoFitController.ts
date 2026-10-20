/**
 * AutoFitController - PowerPoint-style adaptive content auto-fitting
 *
 * Uses a fast binary search (3-4 iterations, < 2ms) to find the maximal
 * legible content scale factor (--content-scale) where all cards and pipeline
 * steps fit within their container bounds without overflow or border collisions.
 */

export interface AutoFitOptions {
  minScale?: number;      // Default 0.25 (prevents 0px invisible collapse)
  maxScale?: number;      // Default 2.50 (uncapped container-driven scaling)
  minClearance?: number;  // Minimum unscaled clearance to bottom border (default: 8px)
  iterations?: number;    // Binary search steps (default: 8)
}

export class AutoFitController {
  private options: Required<AutoFitOptions>;
  private fittedGeneration = 0;
  private priorityQueue: HTMLElement[] = [];
  private queueTimer: ReturnType<typeof setTimeout> | number | null = null;
  private usingIdleCallback = false;

  constructor(options?: AutoFitOptions) {
    this.options = {
      minScale: options?.minScale ?? 0.25,
      maxScale: options?.maxScale ?? 2.50,
      minClearance: options?.minClearance ?? 8,
      iterations: options?.iterations ?? 8,
    };
  }

  public isSlideFitted(slideEl: HTMLElement | null): boolean {
    if (!slideEl) return false;
    return slideEl.dataset.fittedGen === String(this.fittedGeneration);
  }

  public invalidateAll(deckEl?: HTMLElement | null): void {
    this.fittedGeneration++;
    this.clearQueueTimer();
    this.priorityQueue = [];
    if (deckEl) {
      deckEl.querySelectorAll<HTMLElement>('.reveal .slides > section, .slides > section').forEach((s) => {
        delete s.dataset.fittedGen;
      });
    }
  }

  private clearQueueTimer(): void {
    if (this.queueTimer !== null) {
      if (this.usingIdleCallback && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(this.queueTimer as number);
      } else {
        clearTimeout(this.queueTimer as ReturnType<typeof setTimeout>);
      }
      this.queueTimer = null;
      this.usingIdleCallback = false;
    }
  }

  /**
   * Pre-calculates slide layouts in priority order around activeIndex:
   * [activeIndex (sync), activeIndex + 1, activeIndex - 1, activeIndex + 2, activeIndex - 2, ...]
   */
  public schedulePriorityQueue(deckEl: HTMLElement | null, activeIndex: number): void {
    if (!deckEl) return;
    this.clearQueueTimer();

    const slides = Array.from(
      deckEl.querySelectorAll<HTMLElement>('.reveal .slides > section, .slides > section')
    );
    if (slides.length === 0) return;

    const clampedActive = Math.max(0, Math.min(slides.length - 1, activeIndex));
    // Always ensure the active slide is fitted synchronously before paint
    if (slides[clampedActive] && !this.isSlideFitted(slides[clampedActive])) {
      this.fitSlide(slides[clampedActive]);
    }

    const ordered: HTMLElement[] = [];
    for (let offset = 1; offset < slides.length; offset++) {
      const nextIdx = clampedActive + offset;
      const prevIdx = clampedActive - offset;
      if (nextIdx < slides.length && !this.isSlideFitted(slides[nextIdx])) {
        ordered.push(slides[nextIdx]);
      }
      if (prevIdx >= 0 && !this.isSlideFitted(slides[prevIdx])) {
        ordered.push(slides[prevIdx]);
      }
    }

    this.priorityQueue = ordered;
    if (this.priorityQueue.length > 0) {
      this.scheduleNextQueueSlice();
    }
  }

  private scheduleNextQueueSlice(): void {
    if (this.priorityQueue.length === 0) return;
    const step = () => {
      this.queueTimer = null;
      this.usingIdleCallback = false;
      while (this.priorityQueue.length > 0) {
        const nextSlide = this.priorityQueue.shift()!;
        if (!this.isSlideFitted(nextSlide)) {
          this.fitSlide(nextSlide);
          break;
        }
      }
      if (this.priorityQueue.length > 0) {
        this.scheduleNextQueueSlice();
      }
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      this.usingIdleCallback = true;
      this.queueTimer = (
        window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }
      ).requestIdleCallback(step, { timeout: 60 });
    } else {
      this.usingIdleCallback = false;
      this.queueTimer = setTimeout(step, 16);
    }
  }

  public checkCardFits(card: HTMLElement): boolean {
    const cardRect = card.getBoundingClientRect();
    const lastChild = card.lastElementChild;
    if (!lastChild) return true;

    // Check for direct scroll overflow
    if (card.scrollHeight > card.clientHeight + 1) return false;

    // Check inner scroll container if present (e.g. .bento-hyphens, .code-scroll-area, .metric-stat-hero)
    const scrollableChild = card.querySelector<HTMLElement>(
      '.bento-hyphens, .code-scroll-area, .metric-stat-hero, .overflow-y-auto, .overflow-auto'
    );
    if (scrollableChild && scrollableChild.scrollHeight > scrollableChild.clientHeight + 1) {
      return false;
    }

    // Specific geometry check for MetricStat cards (Used in both Pass 1 and Pass 2)
    if (card.classList.contains('metric-stat-card')) {
      const heroEl = card.querySelector<HTMLElement>('.metric-stat-hero');
      const valueRow = card.querySelector<HTMLElement>('.metric-stat-value-row');
      const labelEl = card.querySelector<HTMLElement>('.metric-stat-label');
      if (heroEl && valueRow && labelEl) {
        if (heroEl.scrollHeight > heroEl.clientHeight + 1) return false;
        if (valueRow.scrollWidth > heroEl.clientWidth + 1) return false;
        if (labelEl.scrollWidth > labelEl.clientWidth + 1) return false;

        const labelStyle = window.getComputedStyle(labelEl);
        const labelMarginTop = parseFloat(labelStyle.marginTop) || 0;
        const heroContentH = valueRow.offsetHeight + labelMarginTop + labelEl.offsetHeight;
        if (heroContentH + 16 > heroEl.clientHeight) return false;
      }
    }

    // Check horizontal and vertical overflow for code blocks and pre elements
    const pre = card.querySelector<HTMLElement>('pre');
    const isCodeCard = card.classList.contains('code-container-root') || !!pre || !!card.querySelector('.code-scroll-area');
    if (isCodeCard) {
      if (pre) {
        if (pre.scrollWidth > pre.clientWidth + 2) return false;
        if (pre.scrollHeight > pre.clientHeight + 1) return false;
        if (scrollableChild && pre.scrollHeight > scrollableChild.clientHeight) return false;
      }
      if (scrollableChild) {
        if (scrollableChild.scrollWidth > scrollableChild.clientWidth + 2) return false;
        if (scrollableChild.scrollHeight > scrollableChild.clientHeight + 1) return false;
      }
    }

    // Check for row overflow in comparison and slide tables
    const tableRows = card.querySelectorAll<HTMLElement>('.table-row-item, .slide-table-tr');
    if (tableRows.length > 0) {
      for (const row of tableRows) {
        if (row.scrollHeight > row.clientHeight + 1) return false;
      }
    }
    const tableWrapper = card.querySelector<HTMLElement>('.slide-table-wrapper');
    if (tableWrapper) {
      if (tableWrapper.scrollWidth > tableWrapper.clientWidth + 2) return false;
      if (tableWrapper.scrollHeight > tableWrapper.clientHeight + 1) return false;
    }

    // Check horizontal overflow in BarChart row headers (labels + sublabels + values must never clip or truncate)
    const barHeaders = card.querySelectorAll<HTMLElement>('.bar-chart-header, .chart-label-text');
    if (barHeaders.length > 0) {
      for (const header of barHeaders) {
        if (header.scrollWidth > header.clientWidth + 2) return false;
      }
    }

    // Check clearance to bottom edge in unscaled canvas coordinates
    const revealScale = cardRect.height / card.clientHeight;
    if (revealScale <= 0) return true;

    // For pipeline steps, measure the actual text element (e.g. p) rather than full-height flex container
    const textContainer = card.querySelector<HTMLElement>(
      '.step-text-container, .step-text'
    );

    // If text container has scroll overflow, it definitely does not fit
    if (textContainer && textContainer.scrollHeight > textContainer.clientHeight + 1) {
      return false;
    }

    // For horizontal pipeline step cards with a bottom progress bar
    const barContainer = card.querySelector<HTMLElement>('.step-bar-container');
    if (barContainer && textContainer) {
      const measuredContentEl = textContainer.lastElementChild || textContainer;
      const contentRect = measuredContentEl.getBoundingClientRect();
      const barRect = barContainer.getBoundingClientRect();

      // Check gap between text bottom and bar top (minimum 14px clearance)
      const unscaledBarGap = (barRect.top - contentRect.bottom) / revealScale;
      if (unscaledBarGap < 14) {
        return false;
      }

      // Check gap between bar bottom and card bottom (minimum 14px clearance)
      const unscaledBottomGap = (cardRect.bottom - barRect.bottom) / revealScale;
      if (unscaledBottomGap < 14) {
        return false;
      }

      // Check gap between text top and graphic area bottom (minimum 14px clearance)
      const graphicArea = card.querySelector<HTMLElement>('.step-graphic-area');
      if (graphicArea) {
        const firstTextEl = textContainer.firstElementChild || textContainer;
        const topRect = firstTextEl.getBoundingClientRect();
        const graphicRect = graphicArea.getBoundingClientRect();
        const unscaledTopGap = (topRect.top - graphicRect.bottom) / revealScale;
        if (unscaledTopGap < 14) {
          return false;
        }
      }

      return true;
    }

    const measuredContentEl = textContainer
      ? (textContainer.lastElementChild || textContainer)
      : (scrollableChild?.lastElementChild || lastChild);

    const contentRect = measuredContentEl.getBoundingClientRect();
    const unscaledBottomGap = (cardRect.bottom - contentRect.bottom) / revealScale;
    const isTable = (card.classList.contains('comparison-table-container') || card.classList.contains('slide-table-container')) && !card.classList.contains('bento-card-root');
    const isStep = card.classList.contains('step-row') || card.classList.contains('step-card') || !!textContainer;
    const cardPadBottom = parseFloat(window.getComputedStyle(card).paddingBottom) || 0;
    const requiredClearance = isStep ? 14 : isTable ? 10 : Math.max(this.options.minClearance, cardPadBottom - 2);

    return unscaledBottomGap >= requiredClearance;
  }

  public fitCard(card: HTMLElement): void {
    const clientH = card.clientHeight;
    if (clientH <= 0) return;

    card.style.removeProperty('--metric-scale');

    const minScale = this.options.minScale;
    const maxScale = this.options.maxScale;
    const iterations = this.options.iterations;

    // 1. Test at maxScale (allows upscaling if plenty of room)
    card.style.setProperty('--content-scale', maxScale.toFixed(3), 'important');

    if (this.checkCardFits(card)) {
      return; // Naturally fits even at maxScale!
    }

    // 2. Binary search for maximal scale where it fits
    let low = minScale;
    let high = maxScale;
    let best = minScale;

    for (let i = 0; i < iterations; i++) {
      const mid = (low + high) / 2;
      card.style.setProperty('--content-scale', mid.toFixed(3), 'important');

      if (this.checkCardFits(card)) {
        best = mid;
        low = mid; // Can we fit an even larger scale?
      } else {
        high = mid; // Still overflowing, shrink further
      }
    }

    card.style.setProperty('--content-scale', best.toFixed(3), 'important');
  }

  public fitCards(cards: HTMLElement[]): void {
    if (cards.length === 0) return;

    for (const card of cards) {
      card.style.removeProperty('--metric-scale');
    }

    const minScale = this.options.minScale;
    const maxScale = this.options.maxScale;
    const iterations = this.options.iterations;

    const checkAllCardsFit = (scale: number): boolean => {
      for (const card of cards) {
        card.style.setProperty('--content-scale', scale.toFixed(3), 'important');
      }
      for (const card of cards) {
        if (!this.checkCardFits(card)) {
          return false;
        }
      }
      return true;
    };

    if (checkAllCardsFit(maxScale)) {
      return;
    }

    let low = minScale;
    let high = maxScale;
    let best = minScale;

    for (let i = 0; i < iterations; i++) {
      const mid = (low + high) / 2;
      if (checkAllCardsFit(mid)) {
        best = mid;
        low = mid;
      } else {
        high = mid;
      }
    }

    for (const card of cards) {
      card.style.setProperty('--content-scale', best.toFixed(3), 'important');
    }
  }

  /**
   * Pass 2 for MetricStat cards:
   * Keeps --content-scale fixed for normal text (.metric-stat-badge, .metric-stat-sublabel)
   * and finds a unified --metric-scale >= --content-scale across all MetricStat cards on the slide
   * for the hero metric number (.metric-stat-value, .metric-stat-unit) and KPI name (.metric-stat-label).
   */
  public fitMetricCards(metricCards: HTMLElement[]): void {
    if (metricCards.length === 0) return;

    const baseScale = parseFloat(metricCards[0].style.getPropertyValue('--content-scale')) || 1;
    const maxScale = this.options.maxScale;
    if (baseScale >= maxScale) return;

    // Determine allowed line count per metric card label so single-word/multi-column KPI labels don't awkwardly wrap
    const maxLinesPerCard = metricCards.map((card) => {
      const labelEl = card.querySelector<HTMLElement>('.metric-stat-label');
      if (!labelEl) return 1;
      const text = (labelEl.textContent || '').trim();
      if (!text.includes(' ')) return 1;
      if (metricCards.length > 1) {
        const labelStyle = window.getComputedStyle(labelEl);
        const lh = parseFloat(labelStyle.lineHeight) || (parseFloat(labelStyle.fontSize) || 32) * 1.25;
        const baseLines = lh > 0 ? Math.max(1, Math.round(labelEl.offsetHeight / lh)) : 1;
        return baseLines;
      }
      return 2;
    });

    const checkMetricCardFits = (card: HTMLElement, idx: number): boolean => {
      if (!this.checkCardFits(card)) return false;

      const heroEl = card.querySelector<HTMLElement>('.metric-stat-hero');
      const valueRow = card.querySelector<HTMLElement>('.metric-stat-value-row');
      const labelEl = card.querySelector<HTMLElement>('.metric-stat-label');
      if (!heroEl || !valueRow || !labelEl) return true;

      if (heroEl.scrollHeight > heroEl.clientHeight + 1) return false;
      if (valueRow.scrollWidth > heroEl.clientWidth + 1) return false;
      if (labelEl.scrollWidth > labelEl.clientWidth + 1) return false;

      const labelStyle = window.getComputedStyle(labelEl);
      const labelFontSize = parseFloat(labelStyle.fontSize) || 0;
      const lineHeight = parseFloat(labelStyle.lineHeight) || labelFontSize * 1.25;
      if (lineHeight > 0) {
        const lineCount = Math.round(labelEl.offsetHeight / lineHeight);
        if (lineCount > maxLinesPerCard[idx]) return false;
      }

      const labelMarginTop = parseFloat(labelStyle.marginTop) || 0;
      const heroContentH = valueRow.offsetHeight + labelMarginTop + labelEl.offsetHeight;
      if (heroContentH + 24 > heroEl.clientHeight) return false;

      return true;
    };

    const checkAllMetricsFit = (scale: number): boolean => {
      for (const card of metricCards) {
        card.style.setProperty('--metric-scale', scale.toFixed(3), 'important');
      }
      for (let i = 0; i < metricCards.length; i++) {
        if (!checkMetricCardFits(metricCards[i], i)) {
          return false;
        }
      }
      return true;
    };

    if (checkAllMetricsFit(maxScale)) {
      return;
    }

    let low = baseScale;
    let high = maxScale;
    let best = baseScale;

    for (let i = 0; i < this.options.iterations; i++) {
      const mid = (low + high) / 2;
      if (checkAllMetricsFit(mid)) {
        best = mid;
        low = mid;
      } else {
        high = mid;
      }
    }

    for (const card of metricCards) {
      card.style.setProperty('--metric-scale', best.toFixed(3), 'important');
    }
  }

  public fitPipeline(pipeline: HTMLElement): void {
    const isVertical = pipeline.classList.contains('pipeline-container-vertical') ||
                       pipeline.querySelector('.step-row') !== null;

    if (isVertical) {
      this.fitVerticalPipeline(pipeline);
    } else {
      this.fitHorizontalPipeline(pipeline);
    }
  }

  private fitVerticalPipeline(pipeline: HTMLElement): void {
    const steps = Array.from(pipeline.querySelectorAll<HTMLElement>('.step-row'));
    if (steps.length === 0) return;

    // Helper to check if ALL step rows fit cleanly at the given scale
    const checkAllFit = (scale: number): boolean => {
      for (const step of steps) {
        step.style.setProperty('--content-scale', scale.toFixed(3), 'important');
      }
      for (const step of steps) {
        if (!this.checkCardFits(step)) {
          return false;
        }
      }
      return true;
    };

    // 1. Try maxScale
    if (checkAllFit(this.options.maxScale)) {
      return; // All step rows fit comfortably even at maximum scale!
    }

    // 2. Binary search for maximal uniform scale where all step rows fit
    let low = this.options.minScale;
    let high = this.options.maxScale;
    let best = this.options.minScale;

    for (let i = 0; i < this.options.iterations; i++) {
      const mid = (low + high) / 2;
      if (checkAllFit(mid)) {
        best = mid;
        low = mid;
      } else {
        high = mid;
      }
    }

    for (const step of steps) {
      step.style.setProperty('--content-scale', best.toFixed(3), 'important');
    }
  }

  private fitHorizontalPipeline(pipeline: HTMLElement): void {
    const cards = Array.from(pipeline.querySelectorAll<HTMLElement>('.step-card'));
    if (cards.length === 0) return;

    const firstCard = cards[0];
    const cardH = firstCard.clientHeight;
    if (cardH <= 0) return;

    const graphicAreas = cards.map(c => c.querySelector<HTMLElement>('.step-graphic-area'));
    const hasGraphicAreas = graphicAreas.some((ga) => ga !== null);
    if (!hasGraphicAreas) {
      this.fitCards(cards);
      return;
    }

    const textContainers = cards.map(c => c.querySelector<HTMLElement>('.step-text-container'));
    const barContainers = cards.map(c => c.querySelector<HTMLElement>('.step-bar-container'));

    const cardWidth = firstCard.clientWidth || 380;
    const base169Height = Math.round(cardWidth * (9 / 16));
    const minImgHeight = Math.min(base169Height, 280);
    const maxImgHeight = Math.min(Math.floor(cardH * 0.60), 435);

    // Precise geometric spacing parameters:
    // P = 32px: uniform inset (left, right, top below graphic, and bottom to colored bar for longest text)
    // P_bottom = 32px: clearance from colored bar to card bottom
    // H_bar = 8px
    const P = 32;
    const P_bottom = 32;
    const H_bar = barContainers[0]?.offsetHeight || 8;
    const chrome = P + P + H_bar + P_bottom; // 32 + 32 + 8 + 32 = 104px

    // Helper: measure longest text height across all cards at a given scale
    const getLongestTextHeight = (scale: number): number => {
      for (const card of cards) {
        card.style.setProperty('--content-scale', scale.toFixed(3), 'important');
      }
      let maxH = 0;
      for (let idx = 0; idx < cards.length; idx++) {
        const textEl = textContainers[idx];
        const h4 = textEl ? textEl.querySelector<HTMLElement>('h4') : null;
        const p = textEl ? textEl.querySelector<HTMLElement>('p') : null;
        const h4H = h4 ? h4.offsetHeight : 0;
        const pH = p ? p.offsetHeight : 0;
        const textGap = (h4 && p) ? 14 : 0;
        const textH = h4H + pH + textGap;
        if (textH > maxH) maxH = textH;
      }
      return maxH;
    };

    // Coupled image height formula:
    // H_img = H_card - (P + H_longestText(S) + P + H_bar + P_bottom)
    const computeImgHeightForScale = (scale: number): { imgH: number; textH: number } => {
      const textH = getLongestTextHeight(scale);
      const imgH = cardH - (chrome + textH);
      return { imgH, textH };
    };

    const targetMaxScale = this.options.maxScale;
    const targetMinScale = this.options.minScale;

    // 1. Try maximum scale (1.45)
    let bestScale = targetMaxScale;
    let { imgH: targetImgH } = computeImgHeightForScale(targetMaxScale);

    if (targetImgH >= minImgHeight) {
      // At maxScale, image height meets or exceeds 16:9 base!
      targetImgH = Math.min(maxImgHeight, targetImgH);
      bestScale = targetMaxScale;
    } else {
      // Long text: search for the maximal scale in [targetMinScale, targetMaxScale]
      // where image height stays at least 16:9 base (minImgHeight)
      let low = targetMinScale;
      let high = targetMaxScale;

      for (let i = 0; i < this.options.iterations; i++) {
        const mid = (low + high) / 2;
        const { imgH } = computeImgHeightForScale(mid);
        if (imgH >= minImgHeight) {
          bestScale = mid;
          low = mid;
        } else {
          high = mid;
        }
      }

      const res = computeImgHeightForScale(bestScale);
      targetImgH = Math.max(80, Math.min(maxImgHeight, res.imgH));
    }

    // Apply uniform targetImgH to all graphic areas in this pipeline
    graphicAreas.forEach(ga => {
      if (ga) {
        ga.style.height = `${targetImgH}px`;
        ga.style.minHeight = `${targetImgH}px`;
      }
    });

    // Apply uniform bestScale to all cards in this pipeline
    for (const card of cards) {
      card.style.setProperty('--content-scale', bestScale.toFixed(3), 'important');
    }
  }

  public fitTable(table: HTMLElement): void {
    // If the table is contained inside a BentoCard, the outer BentoCard's fitCard manages it
    if (table.closest('.bento-card-root')) return;

    const isComparisonTable = table.classList.contains('comparison-table-container');
    const isSlideTable = table.classList.contains('slide-table-container') || !!table.querySelector('.slide-table');
    const rows = Array.from(table.querySelectorAll<HTMLElement>('.table-row-item, .slide-table-tr'));
    if (rows.length === 0) return;

    // Reset scale before initial geometry readings so re-fits (e.g. on slide navigation) are idempotent
    table.style.setProperty('--content-scale', '1', 'important');

    const header = table.querySelector<HTMLElement>('.table-header-grid, thead');
    const caption = table.querySelector<HTMLElement>('.slide-table-caption');
    const captionH = caption ? caption.offsetHeight : 0;

    const tableStyle = window.getComputedStyle(table);
    const padTop = parseFloat(tableStyle.paddingTop) || (isSlideTable ? 0 : 24);
    const padBottom = parseFloat(tableStyle.paddingBottom) || (isSlideTable ? 0 : 24);

    if (table.clientHeight <= 0) return;

    // Container-driven uncapped scaling for tables
    const maxTableScale = this.options.maxScale;

    // Clear any residual child-level scale overrides to ensure single global cascading scale
    for (const row of rows) {
      row.style.removeProperty('--content-scale');
      const cells = row.querySelectorAll<HTMLElement>('[data-cell], .comp-table-cell, .table-cell, .slide-table-td');
      for (const cell of cells) {
        cell.style.removeProperty('--content-scale');
      }
    }

    // Inner feasibility check at a given global content scale
    const checkTableFits = (scale: number): boolean => {
      table.style.setProperty('--content-scale', scale.toFixed(3), 'important');

      if (table.scrollHeight > table.clientHeight + 1) return false;
      if (table.scrollWidth > table.clientWidth + 1) return false;

      const currentHeaderH = header ? header.offsetHeight : 50;
      if (header) {
        if (header.scrollWidth > header.clientWidth + 2) return false;
        const hCells = Array.from(header.children) as HTMLElement[];
        for (const hc of hCells) {
          if (hc.scrollWidth > hc.clientWidth + 2) return false;
        }
      }

      const currentAvailH = table.clientHeight - currentHeaderH - captionH - padTop - padBottom;
      if (currentAvailH <= 0) return false;

      const currentTargetRowH = currentAvailH / rows.length;

      const currentRowPad = isSlideTable ? 16 : Math.max(24, Math.round(32 * scale));

      for (const row of rows) {
        // Inline highlight markers (padding: 0.14em 0.45em; box-decoration-break: clone) add up to ~16px
        // visual paint box overhang on wrapped lines inside grid cells; check cells directly with 18px tolerance
        if (row.scrollWidth > row.clientWidth + 18) return false;
        if (currentTargetRowH > 0 && row.scrollHeight > Math.max(row.clientHeight, currentTargetRowH) + 2) return false;

        const currentMaxCellH = Math.max(24, currentTargetRowH - currentRowPad);

        const col0Title = row.querySelector<HTMLElement>('.table-row-title');
        const col0Cell = row.querySelector<HTMLElement>('.table-col-discipline');
        if (col0Title && col0Cell) {
          if (col0Title.scrollWidth > col0Title.clientWidth + 1) return false;
          const titleStyle = window.getComputedStyle(col0Title);
          const titleLh = parseFloat(titleStyle.lineHeight) || (parseFloat(titleStyle.fontSize) || 30) * 1.15;
          const titleWords = (col0Title.textContent || '').trim().split(/\s+/).length;
          const maxAllowedTitleLines = Math.min(2, titleWords);
          if (titleLh > 0 && Math.round(col0Title.offsetHeight / titleLh) > maxAllowedTitleLines) return false;
        }

        const cells = Array.from(row.querySelectorAll<HTMLElement>('[data-cell], .comp-table-cell, .table-cell, .slide-table-td'));
        for (const cell of cells) {
          // Allow inline highlight badge padding overhang on wrapped text cells (up to 18px)
          if (cell.scrollWidth > cell.clientWidth + 18) return false;
          if (currentMaxCellH > 0 && cell.scrollHeight > currentMaxCellH + 2) return false;
        }
      }
      return true;
    };

    // Inner 1D solver: find maximal scale factor S*(w) given current column widths
    const solveOptimalScale = (): number => {
      if (checkTableFits(maxTableScale)) {
        return maxTableScale;
      }
      let low = this.options.minScale;
      let high = maxTableScale;
      let best = this.options.minScale;

      const iterations = Math.max(this.options.iterations, 6);
      for (let i = 0; i < iterations; i++) {
        const mid = (low + high) / 2;
        if (checkTableFits(mid)) {
          best = mid;
          low = mid;
        } else {
          high = mid;
        }
      }
      return best;
    };

    // Stage 1 & Stage 2: Bilevel Optimization (Optimal Column Distribution maximizing S*)
    if (isComparisonTable) {
      const headerEl = table.querySelector<HTMLElement>('.table-header-grid');
      const headerCells = headerEl ? (Array.from(headerEl.children) as HTMLElement[]) : [];
      const colCount = headerCells.length || (rows[0] ? rows[0].children.length : 0);

      const hasAuthorWidths = table.dataset.authorWidths === 'true' ||
        (table.style.getPropertyValue('--col-widths') !== '' && table.dataset.autoColWidths !== 'true');

      if (!hasAuthorWidths && colCount > 1) {
        // Step 1: Initial distribution w^(0) based on content volume & visual weight
        const colWeights: number[] = [];
        for (let c = 0; c < colCount; c++) {
          const cells: HTMLElement[] = [];
          if (headerCells[c]) cells.push(headerCells[c]);
          for (const row of rows) {
            const cell = row.children[c] as HTMLElement | undefined;
            if (cell) cells.push(cell);
          }

          let maxLen = 0;
          let totalLen = 0;
          for (const cell of cells) {
            let lineEls = Array.from(
              cell.querySelectorAll<HTMLElement>('.table-row-title, .table-row-subtitle, p, div, span.block')
            );
            if (lineEls.length > 1) {
              lineEls = lineEls.filter(el => !lineEls.some(other => other !== el && el.contains(other)));
            }

            let cellMaxLine = 0;
            if (lineEls.length > 0) {
              for (const lineEl of lineEls) {
                const t = (lineEl.textContent || '').replace(/\s+/g, ' ').trim();
                if (t.length > cellMaxLine) cellMaxLine = t.length;
              }
            }
            if (cellMaxLine === 0) {
              cellMaxLine = (cell.textContent || '').replace(/\s+/g, ' ').trim().length;
            }

            if (cellMaxLine > maxLen) maxLen = cellMaxLine;
            totalLen += cellMaxLine;
          }
          const avgLen = cells.length > 0 ? totalLen / cells.length : 0;
          // Col 0 has bold title and accent bar, requiring a slight 1.05 padding factor
          const colMultiplier = c === 0 ? 1.05 : 1.0;
          const weight = Math.max(1, (0.5 * avgLen + 0.5 * maxLen) * colMultiplier);
          colWeights.push(weight);
        }

        const sumWeights = colWeights.reduce((acc, w) => acc + w, 0);
        let ratios = colWeights.map(w => w / (sumWeights || 1));

        const minColumnRatio = Math.min(0.12, 1 / colCount);
        const maxColumnRatio = Math.max(0.48, 1 / colCount);

        const projectRatios = (r: number[]): number[] => {
          const curr = [...r];
          for (let iter = 0; iter < 10; iter++) {
            let clampedSum = 0;
            let unclampedCount = 0;
            let unclampedSum = 0;

            for (let c = 0; c < colCount; c++) {
              if (curr[c] <= minColumnRatio) {
                curr[c] = minColumnRatio;
                clampedSum += minColumnRatio;
              } else if (curr[c] >= maxColumnRatio) {
                curr[c] = maxColumnRatio;
                clampedSum += maxColumnRatio;
              } else {
                unclampedSum += curr[c];
                unclampedCount++;
              }
            }

            const remainingBudget = 1.0 - clampedSum;
            if (unclampedCount === 0 || Math.abs(unclampedSum - remainingBudget) < 0.0001) {
              break;
            }

            const factor = remainingBudget / unclampedSum;
            for (let c = 0; c < colCount; c++) {
              if (curr[c] > minColumnRatio && curr[c] < maxColumnRatio) {
                curr[c] *= factor;
              }
            }
          }
          const finalSum = curr.reduce((acc, val) => acc + val, 0);
          return curr.map(val => val / (finalSum || 1));
        };

        ratios = projectRatios(ratios);

        const applyColWidths = (r: number[]): void => {
          table.style.setProperty(
            '--col-widths',
            r.map(val => `${(val * 100).toFixed(1)}fr`).join(' '),
            'important'
          );
        };

        // Evaluate baseline scale S*(w^(0))
        applyColWidths(ratios);
        let bestScale = solveOptimalScale();
        let bestRatios = [...ratios];

        // Step 2: Outer Optimization via Bottleneck-driven Coordinate Descent (max 6 rounds)
        if (bestScale < maxTableScale - 0.02) {
          for (let outerRound = 0; outerRound < 6; outerRound++) {
            applyColWidths(bestRatios);
            // Test at a scale slightly above bestScale to identify the limiting bottleneck column
            const probeScale = Math.min(maxTableScale, bestScale + 0.06);
            table.style.setProperty('--content-scale', probeScale.toFixed(3), 'important');

            const probeHeaderH = header ? header.offsetHeight : 50;
            const probeAvailH = Math.max(1, table.clientHeight - probeHeaderH - captionH - padTop - padBottom);
            const probeTargetRowH = probeAvailH / rows.length;
            const probeRowPad = isSlideTable ? 16 : Math.max(24, Math.round(32 * probeScale));
            const probeMaxCellH = Math.max(24, probeTargetRowH - probeRowPad);

            // Calculate stress metric per column: height ratio + horizontal penalty
            const colStresses: number[] = [];
            let maxStress = -1;
            let bottleneckCol = -1;

            for (let c = 0; c < colCount; c++) {
              let colMaxH = 0;
              let hasHorizOverflow = false;

              if (headerCells[c] && headerCells[c].scrollWidth > headerCells[c].clientWidth + 2) {
                hasHorizOverflow = true;
              }

              for (const row of rows) {
                const cell = row.children[c] as HTMLElement | undefined;
                if (!cell) continue;
                if (cell.scrollWidth > cell.clientWidth + 18) {
                  hasHorizOverflow = true;
                }
                if (c === 0) {
                  const col0Title = cell.querySelector<HTMLElement>('.table-row-title');
                  if (col0Title) {
                    if (col0Title.scrollWidth > col0Title.clientWidth + 1) {
                      hasHorizOverflow = true;
                    }
                    const titleStyle = window.getComputedStyle(col0Title);
                    const titleLh = parseFloat(titleStyle.lineHeight) || (parseFloat(titleStyle.fontSize) || 30) * 1.15;
                    const titleWords = (col0Title.textContent || '').trim().split(/\s+/).length;
                    const maxAllowedTitleLines = Math.min(2, titleWords);
                    if (titleLh > 0 && Math.round(col0Title.offsetHeight / titleLh) > maxAllowedTitleLines) {
                      hasHorizOverflow = true;
                    }
                  }
                }
                if (cell.scrollHeight > colMaxH) {
                  colMaxH = cell.scrollHeight;
                }
              }

              // Stress: cell height relative to target max height + heavy penalty if overflowing
              const stress = (colMaxH / probeMaxCellH) + (hasHorizOverflow ? 10.0 : 0);
              colStresses.push(stress);

              if (stress > maxStress && bestRatios[c] < maxColumnRatio - 0.008) {
                maxStress = stress;
                bottleneckCol = c;
              }
            }

            if (bottleneckCol === -1) break;

            // Sort potential slack columns by lowest stress that still have budget above minColumnRatio
            const slackCandidates = Array.from({ length: colCount }, (_, c) => c)
              .filter(c => c !== bottleneckCol && bestRatios[c] > minColumnRatio + 0.008 && (maxStress - colStresses[c]) >= 0.12)
              .sort((a, b) => colStresses[a] - colStresses[b]);

            if (slackCandidates.length === 0) break;

            let improvedInRound = false;
            for (const slackCol of slackCandidates) {
              const stepDelta = 0.035;
              const maxAdd = maxColumnRatio - bestRatios[bottleneckCol];
              const maxSub = bestRatios[slackCol] - minColumnRatio;
              const transfer = Math.min(stepDelta, Math.max(0, maxAdd), Math.max(0, maxSub));

              if (transfer < 0.008) continue;

              const candidateRatios = [...bestRatios];
              candidateRatios[bottleneckCol] += transfer;
              candidateRatios[slackCol] -= transfer;
              const projectedCandidate = projectRatios(candidateRatios);

              applyColWidths(projectedCandidate);
              const candidateScale = solveOptimalScale();

              if (candidateScale > bestScale + 0.003) {
                bestScale = candidateScale;
                bestRatios = projectedCandidate;
                improvedInRound = true;
                break;
              }
            }

            if (!improvedInRound || bestScale >= maxTableScale) {
              break;
            }
          }
        }

        // Apply global optimal column distribution and scale
        applyColWidths(bestRatios);
        table.style.setProperty('--content-scale', bestScale.toFixed(3), 'important');
        table.dataset.autoColWidths = 'true';
        return;
      }
    }

    // Standard SlideTable or Author-Widths Table: Solve 1D scale directly
    const finalScale = solveOptimalScale();
    table.style.setProperty('--content-scale', finalScale.toFixed(3), 'important');
  }

  public fitSlide(slideEl: HTMLElement | null, force = false): void {
    if (!slideEl) return;
    if (!force && this.isSlideFitted(slideEl)) return;

    const isHidden = window.getComputedStyle(slideEl).display === 'none';
    if (isHidden) {
      slideEl.style.setProperty('display', 'block', 'important');
      slideEl.style.setProperty('visibility', 'hidden', 'important');
    }

    slideEl.classList.add('is-autofitting');
    try {
      // 1. Fit comparison and slide tables at the individual cell or table level
      const tables = slideEl.querySelectorAll<HTMLElement>(
        '.comparison-table-container, .slide-table-container:not(.bento-card-root .slide-table-container)'
      );
      tables.forEach((table) => this.fitTable(table));

      // 2. Fit pipelines uniformly across all steps
      const pipelines = slideEl.querySelectorAll<HTMLElement>('.pipeline-container, .pipeline-container-vertical');
      pipelines.forEach((pipeline) => this.fitPipeline(pipeline));

      // 3a. Fit code containers uniformly across all code windows on the slide
      const codeCards = Array.from(
        slideEl.querySelectorAll<HTMLElement>('.code-container-root')
      );
      if (codeCards.length > 0) {
        this.fitCards(codeCards);
      }

      // 3b. Pass 1: Fit remaining individual cards jointly with unified content scale across the slide
      const allCards = Array.from(
        slideEl.querySelectorAll<HTMLElement>(
          '.bento-card-root, .metric-stat-card, .speaker-profile-card, [data-autofit]:not(.comparison-table-container):not(.slide-table-container):not(.step-row):not(.step-card):not(.code-container-root)'
        )
      );

      if (allCards.length > 0) {
        this.fitCards(allCards);
      }

      // 4. Pass 2: Separate unified scaling for MetricStat hero numbers and KPI names
      const slideTitleEl = slideEl.querySelector('.slide-title');
      const titleSize = slideTitleEl ? (parseFloat(window.getComputedStyle(slideTitleEl).fontSize) || 0) : 0;
      const metricCards = allCards.filter((c) => c.classList.contains('metric-stat-card'));
      if (metricCards.length > 0) {
        this.fitMetricCards(metricCards);
      }

      // Typographic hierarchy audit (dev-mode warning)
      if (slideTitleEl && titleSize > 0) {
        let maxContentSize = 0;
        const candidateSelector =
          'h2, h3, h4, h5, h6, p, li, pre, code, .comp-table-cell, .table-row-title, .bento-card-title, .formula-box-content, .step-title';
        const contentCandidates = slideEl.querySelectorAll<HTMLElement>(candidateSelector);
        for (const el of contentCandidates) {
          if (el.closest('.slide-header, .slide-number-badge, .slide-footer, .metric-stat-hero')) continue;
          if (!el.textContent?.trim()) continue;
          const size = parseFloat(window.getComputedStyle(el).fontSize) || 0;
          if (size > maxContentSize) {
            maxContentSize = size;
          }
        }
        if (maxContentSize >= titleSize) {
          console.warn(
            `[Slide Typography Warning] Slide "${slideTitleEl.textContent?.trim()}": Content font size (${maxContentSize.toFixed(1)}px) >= Title font size (${titleSize.toFixed(1)}px)`
          );
        }
      }
      slideEl.dataset.fittedGen = String(this.fittedGeneration);
    } finally {
      slideEl.classList.remove('is-autofitting');
      if (isHidden) {
        slideEl.style.removeProperty('display');
        slideEl.style.removeProperty('visibility');
      }
    }
  }

  public fitAll(deckEl: HTMLElement | null): void {
    if (!deckEl) return;
    this.clearQueueTimer();
    this.priorityQueue = [];
    const slides = deckEl.querySelectorAll<HTMLElement>('.reveal .slides > section');
    slides.forEach((slide) => this.fitSlide(slide, true));
  }
}
