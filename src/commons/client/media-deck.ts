/**
 * Unified 3-Band Artifact Cards & In-Place Browser Fullscreen Controller
 * Binds event listeners to build-time `.artifact-card` and `.visualization-viewport` header controls
 * (visible on first paint with zero CLS) across Tables, SVG Diagrams, Mermaid Diagrams,
 * Code Snippets, Raster Images, and Interactive Graph Visualizations,
 * providing true native Browser Fullscreen (`requestFullscreen()`) with a `100vw×100dvh`
 * `.is-pseudo-fullscreen` fallback (identical to the Presentation SlideDeck architecture).
 */

interface WebkitDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface WebkitElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
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

let activeFullscreenEl: HTMLElement | null = null;
let savedScrollY = 0;
let globalFullscreenListenersBound = false;

function getNativeFullscreenElement(): Element | null {
  const webkitDoc = document as WebkitDocument;
  return document.fullscreenElement || webkitDoc.webkitFullscreenElement || null;
}

function isElementFullscreen(el: HTMLElement): boolean {
  return getNativeFullscreenElement() === el || el.classList.contains('is-pseudo-fullscreen');
}

function dispatchLayoutResize(): void {
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 80);
  });
}

function syncFullscreenUI(el: HTMLElement | null, isActive: boolean): void {
  if (!el) return;
  el.classList.toggle('is-fullscreen-active', isActive);

  const btn = el.querySelector<HTMLButtonElement>('[data-media-fullscreen]');
  if (btn) {
    if (!btn.dataset.defaultAriaLabel) {
      btn.dataset.defaultAriaLabel = btn.getAttribute('aria-label') || 'Fullscreen';
    }
    if (isActive) {
      btn.textContent = '✕';
      btn.title = 'Exit fullscreen (Esc)';
      btn.setAttribute('aria-label', 'Exit fullscreen (Esc)');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.textContent = '⤢';
      btn.title = 'Fullscreen';
      btn.setAttribute('aria-label', btn.dataset.defaultAriaLabel);
      btn.setAttribute('aria-pressed', 'false');
    }
  }
}

function enterPseudoFullscreen(targetEl: HTMLElement): void {
  const html = document.documentElement;
  savedScrollY = window.scrollY || window.pageYOffset || html.scrollTop || 0;
  targetEl.classList.add('is-pseudo-fullscreen');
  html.classList.add('overflow-hidden', 'artifact-pseudo-fullscreen');
  document.body.classList.add('overflow-hidden');
  document.body.style.position = 'fixed';
  document.body.style.top = `-${savedScrollY}px`;
  document.body.style.width = '100%';
  activeFullscreenEl = targetEl;
  syncFullscreenUI(targetEl, true);
  dispatchLayoutResize();
}

function exitPseudoFullscreen(targetEl: HTMLElement): void {
  const html = document.documentElement;
  targetEl.classList.remove('is-pseudo-fullscreen');
  html.classList.remove('overflow-hidden', 'artifact-pseudo-fullscreen');
  document.body.classList.remove('overflow-hidden');
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  const hadScrollSmooth = html.classList.contains('scroll-smooth');
  if (hadScrollSmooth) html.classList.remove('scroll-smooth');
  window.scrollTo(0, savedScrollY);
  if (hadScrollSmooth) {
    requestAnimationFrame(() => {
      html.classList.add('scroll-smooth');
    });
  }
  if (activeFullscreenEl === targetEl) {
    activeFullscreenEl = null;
  }
  syncFullscreenUI(targetEl, false);
  dispatchLayoutResize();
}

export function toggleArtifactFullscreen(targetEl: HTMLElement): void {
  const webkitDoc = document as WebkitDocument;
  const nativeFsEl = getNativeFullscreenElement();

  if (nativeFsEl === targetEl || targetEl.classList.contains('is-pseudo-fullscreen')) {
    if (nativeFsEl) {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (webkitDoc.webkitFullscreenElement && webkitDoc.webkitExitFullscreen) {
        webkitDoc.webkitExitFullscreen();
      }
    }
    if (targetEl.classList.contains('is-pseudo-fullscreen')) {
      exitPseudoFullscreen(targetEl);
    }
    return;
  }

  if (
    activeFullscreenEl &&
    activeFullscreenEl !== targetEl &&
    activeFullscreenEl.classList.contains('is-pseudo-fullscreen')
  ) {
    exitPseudoFullscreen(activeFullscreenEl);
  }

  const webkitEl = targetEl as WebkitElement;
  const reqFs = targetEl.requestFullscreen || webkitEl.webkitRequestFullscreen;
  if (typeof reqFs === 'function') {
    try {
      const result = reqFs.call(targetEl);
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>)
          .then(() => {
            activeFullscreenEl = targetEl;
            syncFullscreenUI(targetEl, true);
            dispatchLayoutResize();
          })
          .catch(() => {
            enterPseudoFullscreen(targetEl);
          });
      } else {
        activeFullscreenEl = targetEl;
        syncFullscreenUI(targetEl, true);
        dispatchLayoutResize();
      }
    } catch {
      enterPseudoFullscreen(targetEl);
    }
  } else {
    enterPseudoFullscreen(targetEl);
  }
}

function bindGlobalFullscreenListeners(): void {
  if (globalFullscreenListenersBound) return;
  globalFullscreenListenersBound = true;

  const handleFullscreenChange = () => {
    const nativeFsEl = getNativeFullscreenElement() as HTMLElement | null;
    if (nativeFsEl) {
      if (activeFullscreenEl && activeFullscreenEl !== nativeFsEl) {
        syncFullscreenUI(activeFullscreenEl, false);
      }
      activeFullscreenEl = nativeFsEl;
      syncFullscreenUI(nativeFsEl, true);
    } else if (activeFullscreenEl && !activeFullscreenEl.classList.contains('is-pseudo-fullscreen')) {
      const prevEl = activeFullscreenEl;
      activeFullscreenEl = null;
      syncFullscreenUI(prevEl, false);
    }
    dispatchLayoutResize();
  };

  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  window.addEventListener('keydown', (e) => {
    if (
      e.key === 'Escape' &&
      activeFullscreenEl &&
      activeFullscreenEl.classList.contains('is-pseudo-fullscreen')
    ) {
      exitPseudoFullscreen(activeFullscreenEl);
    }
  });
}

export function initMediaDeck(): void {
  if (typeof document === 'undefined') return;

  bindGlobalFullscreenListeners();

  const containers = Array.from(document.querySelectorAll<HTMLElement>(CONTENT_CONTAINER_SELECTOR));
  const discoveredNodes: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  // 1. Discover Visualization Viewports (.visualization-viewport)
  const visViewports = Array.from(document.querySelectorAll<HTMLElement>('.visualization-viewport'));
  for (const vp of visViewports) {
    if (seen.has(vp)) continue;
    seen.add(vp);
    const expandBtn = vp.querySelector<HTMLButtonElement>('[data-media-fullscreen]');
    expandBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleArtifactFullscreen(vp);
    });
  }

  // 2. Discover Content Artifacts across Prose & Detail Pages
  for (const container of containers) {
    const matches = Array.from(container.querySelectorAll<HTMLElement>(ARTIFACT_SELECTOR));
    for (const el of matches) {
      if (seen.has(el)) continue;
      seen.add(el);
      discoveredNodes.push(el);
    }
  }

  discoveredNodes.forEach((el) => {
    // 1. Table Artifact (figure.table-figure or .responsive-table-wrapper)
    if (el.matches('figure.table-figure, .responsive-table-wrapper')) {
      const wrapper = el.matches('.responsive-table-wrapper')
        ? el
        : el.querySelector<HTMLElement>('.responsive-table-wrapper') || el;
      const table = wrapper.querySelector<HTMLTableElement>('table');
      if (!table) return;

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
      expandBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleArtifactFullscreen(el);
      });

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
      return;
    }

    // 2. SVG Diagram (figure.svg-diagram)
    if (el.matches('figure.svg-diagram')) {
      const expandBtn = el.querySelector<HTMLButtonElement>('[data-media-fullscreen]');
      expandBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleArtifactFullscreen(el);
      });

      const svgEl = el.querySelector('svg');
      svgEl?.addEventListener('click', () => {
        if (!isElementFullscreen(el)) {
          toggleArtifactFullscreen(el);
        }
      });
      return;
    }

    // 3. Mermaid Diagram (figure.mermaid-diagram)
    if (el.matches('figure.mermaid-diagram')) {
      const expandBtn = el.querySelector<HTMLButtonElement>('[data-media-fullscreen]');
      expandBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleArtifactFullscreen(el);
      });

      el.querySelectorAll<HTMLElement>('.mermaid-svg').forEach((mSvg) => {
        mSvg.addEventListener('click', () => {
          if (!isElementFullscreen(el)) {
            toggleArtifactFullscreen(el);
          }
        });
      });
      return;
    }

    // 4. Code Snippet (figure.code-snippet or pre)
    if (el.matches('figure.code-snippet, pre')) {
      const preEl = el.matches('pre') ? el : el.querySelector<HTMLPreElement>('pre');
      if (!preEl) return;

      const codeText = (preEl.querySelector('code') || preEl).textContent || '';

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
        toggleArtifactFullscreen(el);
      });
      return;
    }

    // 5. Content Image (figure.image-figure or standalone img)
    if (el.matches('figure.image-figure, img')) {
      const imgEl = el.matches('img') ? (el as HTMLImageElement) : el.querySelector<HTMLImageElement>('img');
      if (!imgEl) return;

      const expandBtn = el.querySelector<HTMLButtonElement>('[data-media-fullscreen]');
      expandBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleArtifactFullscreen(el);
      });

      imgEl.addEventListener('click', () => {
        if (!isElementFullscreen(el)) {
          toggleArtifactFullscreen(el);
        }
      });
    }
  });
}
