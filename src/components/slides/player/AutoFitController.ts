/**
 * AutoFitController - PowerPoint-style adaptive content auto-fitting
 *
 * Uses a fast binary search (3-4 iterations, < 2ms) to find the maximal
 * legible content scale factor (--content-scale) where all cards and pipeline
 * steps fit within their container bounds without overflow or border collisions.
 */

export interface AutoFitOptions {
  minScale?: number;      // Default 0.70 (readable presentation text/code)
  maxScale?: number;      // Default 1.45 (upscaling for spacious presentation layouts)
  minClearance?: number;  // Minimum unscaled clearance to bottom border (default: 8px)
  iterations?: number;    // Binary search steps (default: 5)
}

export class AutoFitController {
  private options: Required<AutoFitOptions>;

  constructor(options?: AutoFitOptions) {
    this.options = {
      minScale: options?.minScale ?? 0.70,
      maxScale: options?.maxScale ?? 1.65,
      minClearance: options?.minClearance ?? 8,
      iterations: options?.iterations ?? 6,
    };
  }

  public checkCardFits(card: HTMLElement): boolean {
    const cardRect = card.getBoundingClientRect();
    const lastChild = card.lastElementChild;
    if (!lastChild) return true;

    // Check for direct scroll overflow
    if (card.scrollHeight > card.clientHeight + 1) return false;

    // Check inner scroll container if present (e.g. .bento-hyphens, .code-scroll-area)
    const scrollableChild = card.querySelector<HTMLElement>(
      '.bento-hyphens, .code-scroll-area, .overflow-y-auto, .overflow-auto'
    );
    if (scrollableChild && scrollableChild.scrollHeight > scrollableChild.clientHeight + 1) {
      return false;
    }

    // Check horizontal and vertical overflow for code blocks and pre elements
    const pre = card.querySelector<HTMLElement>('pre');
    const isCodeCard = card.classList.contains('code-container-root') || !!pre || !!card.querySelector('.code-scroll-area');
    if (isCodeCard) {
      if (pre) {
        if (pre.scrollWidth > pre.clientWidth + 1) return false;
        if (pre.scrollHeight > pre.clientHeight + 1) return false;
        if (scrollableChild && pre.scrollHeight > scrollableChild.clientHeight) return false;
      }
      if (scrollableChild) {
        if (scrollableChild.scrollWidth > scrollableChild.clientWidth + 1) return false;
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
    const isTable = card.classList.contains('comparison-table-container') || card.classList.contains('slide-table-container') || tableRows.length > 0;
    const isStep = card.classList.contains('step-row') || card.classList.contains('step-card') || !!textContainer;
    const cardPadBottom = parseFloat(window.getComputedStyle(card).paddingBottom) || 0;
    const requiredClearance = isStep ? 14 : isTable ? 10 : Math.max(this.options.minClearance, cardPadBottom - 2);

    return unscaledBottomGap >= requiredClearance;
  }

  public fitCard(card: HTMLElement): void {
    const clientH = card.clientHeight;
    if (clientH <= 0) return;

    const isCodeCard = card.classList.contains('code-container-root') || !!card.querySelector('pre, .code-scroll-area');
    const minScale = isCodeCard ? Math.min(this.options.minScale, 0.45) : this.options.minScale;
    const iterations = isCodeCard ? Math.max(this.options.iterations, 6) : this.options.iterations;

    // 1. Test at maxScale (allows upscaling if plenty of room)
    card.style.setProperty('--content-scale', this.options.maxScale.toFixed(3), 'important');

    if (this.checkCardFits(card)) {
      return; // Naturally fits even at maxScale!
    }

    // 2. Binary search for maximal scale where it fits
    let low = minScale;
    let high = this.options.maxScale;
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

    const isCodeCard = cards.some(
      (c) => c.classList.contains('code-container-root') || !!c.querySelector('pre, .code-scroll-area')
    );
    const minScale = isCodeCard ? Math.min(this.options.minScale, 0.45) : this.options.minScale;
    const iterations = isCodeCard ? Math.max(this.options.iterations, 6) : this.options.iterations;

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

    if (checkAllCardsFit(this.options.maxScale)) {
      return;
    }

    let low = minScale;
    let high = this.options.maxScale;
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
    const textContainers = cards.map(c => c.querySelector<HTMLElement>('.step-text-container'));
    const barContainers = cards.map(c => c.querySelector<HTMLElement>('.step-bar-container'));

    const cardWidth = firstCard.clientWidth || 380;
    const base169Height = Math.round(cardWidth * (9 / 16));
    const minImgHeight = Math.min(base169Height, 280);
    const maxImgHeight = Math.min(Math.floor(cardH * 0.60), 435);

    // Precise geometric spacing parameters:
    // P = 28px: uniform inset (left, right, top below graphic, and bottom to colored bar for longest text)
    // P_bottom = 24px: clearance from colored bar to card bottom
    // H_bar = 8px
    const P = 28;
    const P_bottom = 24;
    const H_bar = barContainers[0]?.offsetHeight || 8;
    const chrome = P + P + H_bar + P_bottom; // 28 + 28 + 8 + 24 = 88px

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

    const targetMaxScale = Math.min(this.options.maxScale, 1.45);
    const targetMinScale = Math.min(0.80, this.options.minScale);

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

    const header = table.querySelector<HTMLElement>('.table-header-grid, thead');
    const headerH = header ? header.offsetHeight : 50;
    const caption = table.querySelector<HTMLElement>('.slide-table-caption');
    const captionH = caption ? caption.offsetHeight : 0;

    const tableStyle = window.getComputedStyle(table);
    const padTop = parseFloat(tableStyle.paddingTop) || (isSlideTable ? 0 : 24);
    const padBottom = parseFloat(tableStyle.paddingBottom) || (isSlideTable ? 0 : 24);

    const availH = table.clientHeight - headerH - captionH - padTop - padBottom;
    if (availH <= 0) return;

    // Available target height per row
    const targetRowH = availH / rows.length;

    // Available height for cell content (subtracting row padding ~24px)
    const rowPad = isSlideTable ? 16 : 24;
    const maxCellH = Math.max(36, targetRowH - rowPad);

    // Allow generous upscaling up to 1.65 for spacious tables (e.g. 3 rows) to eliminate dead white space
    const maxTableScale = rows.length <= 3 ? Math.min(this.options.maxScale, 1.65) : Math.min(this.options.maxScale, 1.35);

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

      for (const row of rows) {
        if (row.scrollWidth > row.clientWidth + 1) return false;
        if (targetRowH > 0 && row.scrollHeight > targetRowH + 6) return false;
        const cells = Array.from(row.querySelectorAll<HTMLElement>('[data-cell], .comp-table-cell, .table-cell, .slide-table-td'));
        for (const cell of cells) {
          // Allow subpixel inline badge padding tolerance on wrapped text cells (up to 12px)
          if (cell.scrollWidth > cell.clientWidth + 12) return false;
          if (maxCellH > 0 && cell.scrollHeight > maxCellH + 4) return false;
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
            const text = (cell.textContent || '').replace(/\s+/g, ' ').trim();
            const len = text.length;
            if (len > maxLen) maxLen = len;
            totalLen += len;
          }
          const avgLen = cells.length > 0 ? totalLen / cells.length : 0;
          // Col 0 has bold title and accent bar, requiring more visual width per character
          const colMultiplier = c === 0 ? 1.4 : 1.0;
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

        // Step 2: Outer Optimization via Bottleneck-driven Coordinate Descent (max 3 rounds)
        if (bestScale < maxTableScale - 0.02) {
          for (let outerRound = 0; outerRound < 3; outerRound++) {
            // Test at a scale slightly above bestScale to identify the limiting bottleneck column
            const probeScale = Math.min(maxTableScale, bestScale + 0.06);
            table.style.setProperty('--content-scale', probeScale.toFixed(3), 'important');

            // Calculate stress metric per column: height ratio + horizontal penalty
            let maxStress = -1;
            let minStress = Infinity;
            let bottleneckCol = -1;
            let slackCol = -1;

            for (let c = 0; c < colCount; c++) {
              let colMaxH = 0;
              let hasHorizOverflow = false;

              for (const row of rows) {
                const cell = row.children[c] as HTMLElement | undefined;
                if (!cell) continue;
                if (cell.scrollWidth > cell.clientWidth + 12) {
                  hasHorizOverflow = true;
                }
                if (cell.scrollHeight > colMaxH) {
                  colMaxH = cell.scrollHeight;
                }
              }

              // Stress: cell height relative to target max height + heavy penalty if overflowing
              const stress = (colMaxH / maxCellH) + (hasHorizOverflow ? 10.0 : 0);

              if (stress > maxStress) {
                maxStress = stress;
                bottleneckCol = c;
              }
              if (stress < minStress) {
                minStress = stress;
                slackCol = c;
              }
            }

            // If bottleneck and slack are identical or difference is negligible, equilibrium reached
            if (bottleneckCol === -1 || slackCol === -1 || bottleneckCol === slackCol || (maxStress - minStress) < 0.12) {
              break;
            }

            // Transfer budget delta from slack column to bottleneck column
            const stepDelta = 0.035;
            const maxAdd = maxColumnRatio - bestRatios[bottleneckCol];
            const maxSub = bestRatios[slackCol] - minColumnRatio;
            const transfer = Math.min(stepDelta, Math.max(0, maxAdd), Math.max(0, maxSub));

            if (transfer < 0.008) {
              break; // Constraints reached
            }

            const candidateRatios = [...bestRatios];
            candidateRatios[bottleneckCol] += transfer;
            candidateRatios[slackCol] -= transfer;
            const projectedCandidate = projectRatios(candidateRatios);

            applyColWidths(projectedCandidate);
            const candidateScale = solveOptimalScale();

            if (candidateScale > bestScale + 0.005) {
              bestScale = candidateScale;
              bestRatios = projectedCandidate;
              if (bestScale >= maxTableScale) break; // Maximum achievable scale reached!
            } else {
              break; // No further improvement
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

  public fitSlide(slideEl: HTMLElement | null): void {
    if (!slideEl) return;

    const isHidden = window.getComputedStyle(slideEl).display === 'none';
    if (isHidden) {
      slideEl.style.setProperty('display', 'block', 'important');
      slideEl.style.setProperty('visibility', 'hidden', 'important');
    }

    try {
      // 1. Fit comparison and slide tables at the individual cell or table level
      const tables = slideEl.querySelectorAll<HTMLElement>(
        '.comparison-table-container, .slide-table-container:not(.bento-card-root .slide-table-container)'
      );
      tables.forEach((table) => this.fitTable(table));

      // 2. Fit pipelines uniformly across all steps
      const pipelines = slideEl.querySelectorAll<HTMLElement>('.pipeline-container, .pipeline-container-vertical');
      pipelines.forEach((pipeline) => this.fitPipeline(pipeline));

      // 3. Fit remaining individual cards (excluding tables and pipeline steps already handled)
      const cards = Array.from(
        slideEl.querySelectorAll<HTMLElement>(
          '.bento-card-root, .metric-stat-card, .code-container-root, [data-autofit]:not(.comparison-table-container):not(.slide-table-container):not(.step-row):not(.step-card)'
        )
      );
      this.fitCards(cards);
    } finally {
      if (isHidden) {
        slideEl.style.removeProperty('display');
        slideEl.style.removeProperty('visibility');
      }
    }
  }

  public fitAll(deckEl: HTMLElement | null): void {
    if (!deckEl) return;
    const slides = deckEl.querySelectorAll<HTMLElement>('.reveal .slides > section');
    slides.forEach((slide) => this.fitSlide(slide));
  }
}
