/**
 * Unified 3-Band Artifact Cards & Clean Gallery-Style Fullscreen Lightbox Controller
 * Binds event listeners to build-time `.artifact-card` header controls (visible on first paint with zero CLS)
 * across Tables, SVG Diagrams, Mermaid Diagrams, Code Snippets, and Raster Images,
 * and connects them in exact DOM reading order to a native `<dialog>` gallery lightbox.
 */

type MediaArtifactType = 'table' | 'svg' | 'mermaid' | 'code' | 'image';

interface MediaDeckItem {
  index: number;
  type: MediaArtifactType;
  typeBadge: string;
  title: string;
  element: HTMLElement;
  codeText?: string;
}

const CONTENT_CONTAINER_SELECTOR =
  '.post-body, .prose-custom, .project-content, .service-content, .syllabus-content';

const ARTIFACT_SELECTOR = [
  'figure.table-figure',
  '.responsive-table-wrapper:not(figure.table-figure)',
  'figure.svg-diagram',
  'figure.mermaid-diagram',
  'figure.code-snippet',
  'pre:not(figure.code-snippet pre):not(.mermaid-source pre)',
  'figure.image-figure',
  'img:not(figure.image-figure img):not(.svg-diagram img):not(.mermaid-diagram img)',
].join(', ');

function parseSortableValue(raw: string): { num: number | null; text: string } {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  const numericCandidate = cleaned
    .replace(/,/g, '')
    .match(/^[+-]?\d+(?:\.\d+)?(?=\s*(?:%|ms|s|px|rem|em|kB|MB|GB|TB|fps|FPS|dB|W|°C|x|×|$))/i);
  if (numericCandidate) {
    const parsed = Number.parseFloat(numericCandidate[0]);
    if (!Number.isNaN(parsed)) {
      return { num: parsed, text: cleaned.toLowerCase() };
    }
  }
  return { num: null, text: cleaned.toLowerCase() };
}

function enhanceTableSorting(table: HTMLTableElement): void {
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  if (!thead || !tbody) return;

  const headerCells = Array.from(thead.querySelectorAll<HTMLTableCellElement>('th'));
  if (headerCells.length === 0) return;

  headerCells.forEach((th, colIdx) => {
    const sortIcon = th.querySelector<HTMLSpanElement>('.table-sort-icon');

    const triggerSort = () => {
      const currentSort = th.getAttribute('aria-sort');
      const nextSort: 'ascending' | 'descending' =
        currentSort === 'ascending' ? 'descending' : 'ascending';

      headerCells.forEach((otherTh) => {
        otherTh.setAttribute('aria-sort', otherTh === th ? nextSort : 'none');
        const icon = otherTh.querySelector<HTMLSpanElement>('.table-sort-icon');
        if (icon) {
          icon.textContent = otherTh === th ? (nextSort === 'ascending' ? '↑' : '↓') : '↕';
        }
      });

      if (sortIcon) {
        sortIcon.textContent = nextSort === 'ascending' ? '↑' : '↓';
      }

      const rows = Array.from(tbody.querySelectorAll<HTMLTableRowElement>('tr'));
      rows.sort((rowA, rowB) => {
        const cellA = rowA.children[colIdx] as HTMLElement | undefined;
        const cellB = rowB.children[colIdx] as HTMLElement | undefined;
        const valA = parseSortableValue(cellA?.textContent || '');
        const valB = parseSortableValue(cellB?.textContent || '');

        let cmp = 0;
        if (valA.num !== null && valB.num !== null) {
          cmp = valA.num - valB.num;
        } else {
          cmp = valA.text.localeCompare(valB.text, undefined, { numeric: true, sensitivity: 'base' });
        }
        return nextSort === 'ascending' ? cmp : -cmp;
      });

      rows.forEach((row) => tbody.appendChild(row));
    };

    th.addEventListener('click', (e) => {
      if ((e.target as HTMLElement | null)?.closest('a')) return;
      triggerSort();
    });

    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        triggerSort();
      }
    });
  });
}

function createActionBtn(label: string, ariaLabel: string, className = 'table-deck-btn'): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  btn.setAttribute('aria-label', ariaLabel);
  btn.title = ariaLabel;
  return btn;
}

export function initMediaDeck(): void {
  if (typeof document === 'undefined') return;

  const containers = Array.from(document.querySelectorAll<HTMLElement>(CONTENT_CONTAINER_SELECTOR));
  if (containers.length === 0) return;

  const discoveredNodes: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  for (const container of containers) {
    const matches = Array.from(container.querySelectorAll<HTMLElement>(ARTIFACT_SELECTOR));
    for (const el of matches) {
      if (seen.has(el)) continue;
      if (el.closest('dialog.media-lightbox-dialog')) continue;
      seen.add(el);
      discoveredNodes.push(el);
    }
  }

  if (discoveredNodes.length === 0) return;

  const deckItems: MediaDeckItem[] = [];
  let openLightboxAt: (idx: number) => void = () => {};

  discoveredNodes.forEach((el) => {
    const itemIndex = deckItems.length;

    // 1. Table Artifact (figure.table-figure or .responsive-table-wrapper)
    if (el.matches('figure.table-figure, .responsive-table-wrapper')) {
      const wrapper = el.matches('.responsive-table-wrapper')
        ? el
        : el.querySelector<HTMLElement>('.responsive-table-wrapper') || el;
      const table = wrapper.querySelector<HTMLTableElement>('table');
      if (!table) return;

      const captionText =
        el.getAttribute('data-table-caption') ||
        wrapper.getAttribute('data-table-caption') ||
        el.querySelector('figcaption')?.textContent?.trim() ||
        wrapper.getAttribute('aria-label') ||
        'Data Table';

      enhanceTableSorting(table);

      const scrollBox = wrapper.querySelector<HTMLElement>('.responsive-table-scroll') || wrapper;
      const cardsBtn = el.querySelector<HTMLButtonElement>('[data-table-view-btn="cards"]');
      const gridBtn = el.querySelector<HTMLButtonElement>('[data-table-view-btn="grid"]');
      const scrollLeftBtn = el.querySelector<HTMLButtonElement>('[data-table-scroll="left"]');
      const scrollRightBtn = el.querySelector<HTMLButtonElement>('[data-table-scroll="right"]');
      const expandBtn = el.querySelector<HTMLButtonElement>('[data-media-fullscreen]');

      const syncViewButtons = () => {
        const explicit = wrapper.dataset.tableView;
        const isNarrow = wrapper.clientWidth > 0 && wrapper.clientWidth < 640;
        const activeMode = explicit || (isNarrow ? 'cards' : 'grid');
        cardsBtn?.setAttribute('aria-pressed', String(activeMode === 'cards'));
        gridBtn?.setAttribute('aria-pressed', String(activeMode === 'grid'));
      };

      const updateScrollButtons = () => {
        if (!scrollLeftBtn || !scrollRightBtn) return;
        const isCards =
          wrapper.dataset.tableView === 'cards' ||
          (!wrapper.dataset.tableView && wrapper.clientWidth > 0 && wrapper.clientWidth < 640);
        const maxScroll = scrollBox.scrollWidth - scrollBox.clientWidth;
        if (isCards || maxScroll <= 2) {
          scrollLeftBtn.disabled = true;
          scrollRightBtn.disabled = true;
        } else {
          scrollLeftBtn.disabled = scrollBox.scrollLeft <= 2;
          scrollRightBtn.disabled = scrollBox.scrollLeft >= maxScroll - 2;
        }
      };

      cardsBtn?.addEventListener('click', () => {
        wrapper.dataset.tableView = 'cards';
        syncViewButtons();
        updateScrollButtons();
      });

      gridBtn?.addEventListener('click', () => {
        wrapper.dataset.tableView = 'grid';
        syncViewButtons();
        updateScrollButtons();
      });

      scrollLeftBtn?.addEventListener('click', () => {
        scrollBox.scrollBy({ left: -Math.max(180, scrollBox.clientWidth * 0.65), behavior: 'smooth' });
      });
      scrollRightBtn?.addEventListener('click', () => {
        scrollBox.scrollBy({ left: Math.max(180, scrollBox.clientWidth * 0.65), behavior: 'smooth' });
      });
      expandBtn?.addEventListener('click', () => openLightboxAt(itemIndex));

      scrollBox.addEventListener('scroll', updateScrollButtons, { passive: true });
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => {
          syncViewButtons();
          updateScrollButtons();
        });
        ro.observe(wrapper);
      }

      syncViewButtons();
      updateScrollButtons();

      deckItems.push({
        index: itemIndex,
        type: 'table',
        typeBadge: 'Table',
        title: captionText,
        element: el,
      });
      return;
    }

    // 2. SVG Diagram (figure.svg-diagram)
    if (el.matches('figure.svg-diagram')) {
      const title =
        el.querySelector('figcaption')?.textContent?.trim() ||
        el.getAttribute('data-diagram-caption') ||
        el.getAttribute('data-diagram-title') ||
        el.getAttribute('aria-label') ||
        'SVG Diagram';

      const expandBtn = el.querySelector<HTMLButtonElement>('[data-media-fullscreen]');
      expandBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        openLightboxAt(itemIndex);
      });

      const svgEl = el.querySelector('svg');
      svgEl?.addEventListener('click', () => openLightboxAt(itemIndex));

      deckItems.push({
        index: itemIndex,
        type: 'svg',
        typeBadge: 'SVG',
        title,
        element: el,
      });
      return;
    }

    // 3. Mermaid Diagram (figure.mermaid-diagram)
    if (el.matches('figure.mermaid-diagram')) {
      const title =
        el.getAttribute('data-diagram-caption') ||
        el.querySelector('figcaption')?.textContent?.trim() ||
        el.getAttribute('data-diagram-title') ||
        el.getAttribute('aria-label') ||
        'Mermaid Diagram';

      const expandBtn = el.querySelector<HTMLButtonElement>('[data-media-fullscreen]');
      expandBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        openLightboxAt(itemIndex);
      });

      el.querySelectorAll<HTMLElement>('.mermaid-svg').forEach((mSvg) => {
        mSvg.addEventListener('click', () => openLightboxAt(itemIndex));
      });

      deckItems.push({
        index: itemIndex,
        type: 'mermaid',
        typeBadge: 'Mermaid',
        title,
        element: el,
      });
      return;
    }

    // 4. Code Snippet (figure.code-snippet or pre)
    if (el.matches('figure.code-snippet, pre')) {
      const preEl = el.matches('pre') ? el : el.querySelector<HTMLPreElement>('pre');
      if (!preEl) return;

      const codeText = (preEl.querySelector('code') || preEl).textContent || '';
      const badgeLabel = el.querySelector('.artifact-card-badge')?.textContent?.trim() || 'Code';
      const title =
        el.getAttribute('data-code-caption') ||
        el.querySelector('figcaption')?.textContent?.trim() ||
        el.getAttribute('data-code-title') ||
        `Code Snippet (${badgeLabel})`;

      const copyBtn = el.querySelector<HTMLButtonElement>('[data-copy-code]');
      copyBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (navigator.clipboard) {
          void navigator.clipboard.writeText(codeText).then(() => {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
              copyBtn.textContent = 'Copy';
            }, 1600);
          });
        }
      });

      const expandBtn = el.querySelector<HTMLButtonElement>('[data-media-fullscreen]');
      expandBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        openLightboxAt(itemIndex);
      });

      deckItems.push({
        index: itemIndex,
        type: 'code',
        typeBadge: badgeLabel,
        title,
        element: el,
        codeText,
      });
      return;
    }

    // 5. Content Image (figure.image-figure or standalone img)
    if (el.matches('figure.image-figure, img')) {
      const imgEl = el.matches('img') ? (el as HTMLImageElement) : el.querySelector<HTMLImageElement>('img');
      if (!imgEl) return;

      const title =
        el.getAttribute('data-image-caption') ||
        el.querySelector('figcaption')?.textContent?.trim() ||
        imgEl.getAttribute('alt') ||
        imgEl.getAttribute('title') ||
        'Image';

      const expandBtn = el.querySelector<HTMLButtonElement>('[data-media-fullscreen]');
      expandBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        openLightboxAt(itemIndex);
      });

      imgEl.addEventListener('click', () => openLightboxAt(itemIndex));

      deckItems.push({
        index: itemIndex,
        type: 'image',
        typeBadge: 'Image',
        title,
        element: el,
      });
    }
  });

  if (deckItems.length === 0) return;

  // Build Singleton Native <dialog id="media-lightbox-dialog" closedby="any" aria-labelledby="media-lightbox-title">
  let dialog = document.getElementById('media-lightbox-dialog') as HTMLDialogElement | null;
  if (dialog) {
    dialog.remove();
  }

  dialog = document.createElement('dialog');
  dialog.id = 'media-lightbox-dialog';
  dialog.className = 'media-lightbox-dialog glass-panel';
  dialog.setAttribute('closedby', 'any');
  dialog.setAttribute('aria-labelledby', 'media-lightbox-title');

  // 1. Top Head-Bar: Left Type Badge + Right Controls (Copy for Code + Close ✕)
  const header = document.createElement('header');
  header.className = 'media-lightbox-header artifact-card-header';

  const badgeEl = document.createElement('span');
  badgeEl.className = 'artifact-card-badge';

  const controlsEl = document.createElement('div');
  controlsEl.className = 'artifact-card-controls';

  const modalCopyBtn = createActionBtn('Copy', 'Copy code to clipboard', 'table-deck-btn');
  modalCopyBtn.style.display = 'none';

  const closeForm = document.createElement('form');
  closeForm.method = 'dialog';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'submit';
  closeBtn.autofocus = true;
  closeBtn.className = 'table-deck-btn';
  closeBtn.setAttribute('aria-label', 'Close fullscreen view');
  closeBtn.title = 'Close fullscreen view (Esc)';
  closeBtn.textContent = '✕';
  closeForm.appendChild(closeBtn);

  controlsEl.appendChild(modalCopyBtn);
  controlsEl.appendChild(closeForm);
  header.appendChild(badgeEl);
  header.appendChild(controlsEl);

  // 2. Center Content Stage (fills 100% between Head-Bar and Foot-Bar)
  const stage = document.createElement('div');
  stage.className = 'media-lightbox-stage';

  // 3. Bottom Foot-Bar: Centered Single-Line Caption Only
  const footer = document.createElement('footer');
  footer.className = 'media-lightbox-footer artifact-card-footer';

  const titleEl = document.createElement('h2');
  titleEl.id = 'media-lightbox-title';
  titleEl.className = 'media-lightbox-title';

  footer.appendChild(titleEl);

  dialog.appendChild(header);
  dialog.appendChild(stage);
  dialog.appendChild(footer);
  document.body.appendChild(dialog);

  // Mandatory closedBy fallback for browsers without native HTMLDialogElement.prototype.closedBy
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const isOutside = (e: PointerEvent, dlg: HTMLDialogElement) => {
      const r = dlg.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    let pressedOutside = false;
    dialog.addEventListener('pointerdown', (e) => {
      pressedOutside = isOutside(e, dialog!);
    });
    dialog.addEventListener('pointerup', (e) => {
      if (pressedOutside && isOutside(e, dialog!)) {
        dialog!.close();
      }
    });
  }

  // Mandatory returnValue reset on close
  dialog.addEventListener('close', () => {
    dialog!.returnValue = '';
  });

  let activeIndex = 0;

  function renderActiveItem(idx: number): void {
    activeIndex = (idx + deckItems.length) % deckItems.length;
    const item = deckItems[activeIndex];

    badgeEl.textContent = item.typeBadge;
    titleEl.textContent = item.title;
    titleEl.title = item.title;
    stage.dataset.stageType = item.type;

    if (item.type === 'code' && item.codeText) {
      modalCopyBtn.style.display = 'inline-flex';
      modalCopyBtn.textContent = 'Copy';
      modalCopyBtn.onclick = () => {
        if (navigator.clipboard && item.codeText) {
          void navigator.clipboard.writeText(item.codeText).then(() => {
            modalCopyBtn.textContent = 'Copied!';
            setTimeout(() => {
              modalCopyBtn.textContent = 'Copy';
            }, 1600);
          });
        }
      };
    } else {
      modalCopyBtn.style.display = 'none';
      modalCopyBtn.onclick = null;
    }

    const bodyEl = item.element.querySelector<HTMLElement>('.artifact-card-body') || item.element;
    const cloned = bodyEl.cloneNode(true) as HTMLElement;
    cloned
      .querySelectorAll(
        '.artifact-card-header, .artifact-card-footer, figcaption, .media-floating-actions, .table-deck-toolbar, .code-deck-toolbar, [data-media-fullscreen]'
      )
      .forEach((node) => node.remove());

    if (item.type === 'svg') {
      cloned.style.removeProperty('max-width');
      const svg = cloned.querySelector<SVGElement>('svg');
      if (svg) {
        svg.style.removeProperty('max-width');
        svg.style.cursor = 'default';
      }
    } else if (item.type === 'mermaid') {
      cloned.querySelectorAll<HTMLElement>('.mermaid-svg').forEach((mSvg) => {
        mSvg.style.cursor = 'default';
      });
    } else if (item.type === 'table') {
      cloned.classList.add('responsive-table-wrapper');
      cloned.dataset.tableView = 'grid';
      const clonedTable = cloned.querySelector<HTMLTableElement>('table');
      if (clonedTable) {
        enhanceTableSorting(clonedTable);
      }
    } else if (item.type === 'image') {
      const img = cloned.matches('img') ? (cloned as HTMLImageElement) : cloned.querySelector<HTMLImageElement>('img');
      if (img) {
        img.style.cursor = 'default';
      }
    }

    stage.replaceChildren(cloned);
  }

  document.addEventListener('keydown', (e) => {
    if (!dialog || !dialog.open) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      renderActiveItem(activeIndex - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      renderActiveItem(activeIndex + 1);
    }
  });

  let touchStartX = 0;
  let touchStartY = 0;
  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  };
  const handleTouchEnd = (e: TouchEvent) => {
    if (e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) {
          renderActiveItem(activeIndex + 1);
        } else {
          renderActiveItem(activeIndex - 1);
        }
      }
    }
  };
  header.addEventListener('touchstart', handleTouchStart, { passive: true });
  header.addEventListener('touchend', handleTouchEnd, { passive: true });
  footer.addEventListener('touchstart', handleTouchStart, { passive: true });
  footer.addEventListener('touchend', handleTouchEnd, { passive: true });

  openLightboxAt = (idx: number) => {
    renderActiveItem(idx);
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  };
}
