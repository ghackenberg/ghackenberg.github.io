export type PaginationTheme = 'blue' | 'purple' | 'yellow' | 'green' | 'indigo';

export interface RenderPaginationOptions {
  navElement: HTMLElement;
  currentPage: number;
  totalPages: number;
  domain?: string;
  theme?: PaginationTheme;
}

export interface SectionPaginationOptions {
  sectionId: string;
  itemSelector: string;
  paginationId: string;
  paramKey: string;
  totalPages: number;
  domain: 'posts' | 'publications';
}

export function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
}

export function renderPaginationControls({
  navElement,
  currentPage,
  totalPages,
  domain,
  theme = 'blue',
}: RenderPaginationOptions): void {
  const activeClass = domain
    ? `bg-domain-${domain} shadow-lg shadow-domain-${domain}/20`
    : `bg-gradient-${theme} shadow-lg shadow-brand-${theme}/20`;
  const hoverBorderClass = domain
    ? `hover:border-domain-${domain}/30`
    : `hover:border-brand-${theme}/30`;

  const prevBtn = navElement.querySelector<HTMLButtonElement>('[data-action="prev"]');
  const nextBtn = navElement.querySelector<HTMLButtonElement>('[data-action="next"]');
  const numbersContainer = navElement.querySelector<HTMLElement>('.page-numbers-container');

  if (prevBtn) {
    if (currentPage <= 1) {
      prevBtn.disabled = true;
      prevBtn.className =
        'prev-btn inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-element-bg border border-element-border text-gray-600 text-sm font-semibold cursor-not-allowed opacity-40 w-full sm:w-auto transition-all duration-200';
    } else {
      prevBtn.disabled = false;
      prevBtn.className = `prev-btn inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-element-bg border border-element-border-medium text-gray-300 hover:text-gray-100 ${hoverBorderClass} hover:bg-element-bg-hover transition-all duration-200 text-sm font-semibold group w-full sm:w-auto cursor-pointer`;
    }
  }

  if (nextBtn) {
    if (currentPage >= totalPages) {
      nextBtn.disabled = true;
      nextBtn.className =
        'next-btn inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-element-bg border border-element-border text-gray-600 text-sm font-semibold cursor-not-allowed opacity-40 w-full sm:w-auto transition-all duration-200';
    } else {
      nextBtn.disabled = false;
      nextBtn.className = `next-btn inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-element-bg border border-element-border-medium text-gray-300 hover:text-gray-100 ${hoverBorderClass} hover:bg-element-bg-hover transition-all duration-200 text-sm font-semibold group w-full sm:w-auto cursor-pointer`;
    }
  }

  if (numbersContainer) {
    const pageNumbers = getPageNumbers(currentPage, totalPages);
    numbersContainer.innerHTML = pageNumbers
      .map((num) => {
        if (typeof num === 'string') {
          return '<span class="px-3 py-2 text-gray-500 text-sm font-medium">...</span>';
        }
        if (num === currentPage) {
          return `<span class="px-3.5 py-2 rounded-xl text-sm font-bold text-white ${activeClass} cursor-default select-none min-w-[38px] text-center" aria-current="page" data-page-btn="${num}">${num}</span>`;
        }
        return `<button type="button" data-goto="${num}" class="px-3.5 py-2 rounded-xl text-sm font-medium bg-element-bg border border-element-border-medium text-gray-400 hover:text-gray-100 ${hoverBorderClass} hover:bg-element-bg-hover transition-all duration-200 min-w-[38px] text-center cursor-pointer">${num}</button>`;
      })
      .join('');
  }
}

export function setupSectionPagination({
  sectionId,
  itemSelector,
  paginationId,
  paramKey,
  totalPages,
  domain,
}: SectionPaginationOptions): void {
  if (totalPages <= 1) return;

  const sectionEl = document.getElementById(sectionId);
  const navEl = document.getElementById(paginationId);
  if (!sectionEl || !navEl) return;

  const items = sectionEl.querySelectorAll<HTMLElement>(itemSelector);
  if (items.length === 0) return;

  let currentPage = 1;

  function setPage(page: number, shouldScroll: boolean) {
    if (!navEl) return;
    currentPage = page;
    items.forEach((item) => {
      const p = parseInt(item.getAttribute('data-page') || '1', 10);
      if (p === currentPage) {
        item.classList.remove('hidden');
      } else {
        item.classList.add('hidden');
      }
    });

    renderPaginationControls({
      navElement: navEl,
      currentPage,
      totalPages,
      domain,
    });

    const url = new URL(window.location.href);
    if (currentPage === 1) {
      url.searchParams.delete(paramKey);
    } else {
      url.searchParams.set(paramKey, String(currentPage));
    }
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);

    if (shouldScroll && sectionEl) {
      sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Read initial page from URL
  const urlParams = new URLSearchParams(window.location.search);
  const initialParam = urlParams.get(paramKey);
  if (initialParam) {
    const parsed = parseInt(initialParam, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      setPage(parsed, false);
    }
  }

  if (navEl.dataset.paginationInitialized === 'true') return;
  navEl.dataset.paginationInitialized = 'true';

  // Attach click handler with event delegation
  navEl.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button');
    if (!target || target.disabled) return;

    const action = target.getAttribute('data-action');
    const goto = target.getAttribute('data-goto');

    let targetPage = currentPage;
    if (action === 'prev') {
      targetPage = Math.max(1, currentPage - 1);
    } else if (action === 'next') {
      targetPage = Math.min(totalPages, currentPage + 1);
    } else if (goto) {
      targetPage = parseInt(goto, 10);
    }

    if (targetPage !== currentPage && targetPage >= 1 && targetPage <= totalPages) {
      setPage(targetPage, true);
    }
  });

  // Handle back/forward navigation
  window.addEventListener('popstate', () => {
    const currentParams = new URLSearchParams(window.location.search);
    const paramVal = currentParams.get(paramKey);
    const targetPage = paramVal ? Math.min(totalPages, Math.max(1, parseInt(paramVal, 10) || 1)) : 1;
    if (targetPage !== currentPage) {
      setPage(targetPage, false);
    }
  });
}
