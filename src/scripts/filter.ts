export interface DropdownFilterConfig {
  selectSelector: string;
  dataAttribute: string;
  matchType?: 'exact' | 'includes';
  paramKey?: string;
}

export interface ButtonFilterConfig {
  buttonSelector: string;
  dataAttribute: string;
  defaultValue?: string;
  activeClass?: string;
  matchType?: 'exact' | 'includes';
  paramKey?: string;
}

export interface PaginationConfig {
  pageSize: number;
  navSelector: string;
  pageParamKey?: string;
  theme?: 'blue' | 'purple' | 'yellow' | 'green';
  scrollToSelector?: string;
}

export interface FilterConfig {
  itemSelector: string;
  searchFieldSelector?: string;
  searchDataAttributes?: string[];
  searchParamKey?: string;
  dropdownFilters?: DropdownFilterConfig[];
  buttonFilters?: ButtonFilterConfig[];
  noResultsSelector?: string;
  groupSelector?: string;
  resetButtonSelector?: string;
  pagination?: PaginationConfig;
  urlParamSync?: boolean;
  scrollToSelector?: string;
}

function getPageNumbers(current: number, total: number): (number | string)[] {
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

export class ClientListFilter {
  private items: NodeListOf<HTMLElement>;
  private noResultsElement: HTMLElement | null = null;
  private resetButtonElement: HTMLElement | null = null;
  private paginationNavElement: HTMLElement | null = null;
  private searchQuery: string = '';
  private dropdownValues: Map<string, string> = new Map();
  private buttonValues: Map<string, string> = new Map();
  private currentPage: number = 1;
  private isInitialized: boolean = false;

  constructor(private config: FilterConfig) {
    this.items = document.querySelectorAll(config.itemSelector);
    if (config.noResultsSelector) {
      this.noResultsElement = document.querySelector(config.noResultsSelector);
    }
    if (config.resetButtonSelector) {
      this.resetButtonElement = document.querySelector(config.resetButtonSelector);
    }
    if (config.pagination) {
      this.paginationNavElement = document.querySelector(config.pagination.navSelector);
    }
    this.init();
  }

  private init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Read initial state from URL if sync is enabled (default: true)
    const urlParams = this.config.urlParamSync !== false ? new URLSearchParams(window.location.search) : null;

    // Initial Search
    const searchKey = this.config.searchParamKey || 'q';
    if (urlParams && urlParams.has(searchKey)) {
      this.searchQuery = (urlParams.get(searchKey) || '').toLowerCase().trim();
    }

    if (this.config.searchFieldSelector) {
      const searchInput = document.querySelector(this.config.searchFieldSelector) as HTMLInputElement | null;
      if (searchInput) {
        if (this.searchQuery) {
          searchInput.value = this.searchQuery;
        }
        searchInput.addEventListener('input', (e) => {
          this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase().trim();
          this.currentPage = 1;
          this.updateFilters();
        });
      }
    }

    // 2. Initialize Dropdowns
    if (this.config.dropdownFilters) {
      this.config.dropdownFilters.forEach(dropdown => {
        const select = document.querySelector(dropdown.selectSelector) as HTMLSelectElement | null;
        if (select) {
          const paramKey = dropdown.paramKey || dropdown.dataAttribute.replace('data-', '');
          const initialVal = urlParams?.get(paramKey) || select.value || 'all';
          this.dropdownValues.set(dropdown.dataAttribute, initialVal);
          select.value = initialVal;

          select.addEventListener('change', (e) => {
            const val = (e.target as HTMLSelectElement).value;
            this.dropdownValues.set(dropdown.dataAttribute, val);
            this.currentPage = 1;
            this.updateFilters();
          });
        }
      });
    }

    // 3. Initialize Buttons
    if (this.config.buttonFilters) {
      this.config.buttonFilters.forEach(btnConfig => {
        const buttons = document.querySelectorAll<HTMLElement>(btnConfig.buttonSelector);
        const defVal = btnConfig.defaultValue || 'all';
        const activeCls = btnConfig.activeClass || 'active';
        const paramKey = btnConfig.paramKey || btnConfig.dataAttribute.replace('data-', '');
        const urlVal = urlParams?.get(paramKey);

        const initialVal = urlVal ? urlVal.toLowerCase() : defVal;
        this.buttonValues.set(btnConfig.dataAttribute, initialVal);

        buttons.forEach(btn => {
          const rawBtnVal = btn.getAttribute('data-lang') || btn.getAttribute('data-value') || btn.getAttribute('data-tag') || defVal;
          const btnVal = rawBtnVal.toLowerCase();

          if (initialVal !== defVal && btnVal === initialVal) {
            btn.classList.add(activeCls);
          } else {
            btn.classList.remove(activeCls);
          }

          btn.addEventListener('click', () => {
            const currentVal = this.buttonValues.get(btnConfig.dataAttribute);
            if (currentVal === btnVal) {
              // Deselect
              buttons.forEach(b => b.classList.remove(activeCls));
              this.buttonValues.set(btnConfig.dataAttribute, defVal);
            } else {
              // Select
              buttons.forEach(b => b.classList.remove(activeCls));
              btn.classList.add(activeCls);
              this.buttonValues.set(btnConfig.dataAttribute, btnVal);
            }
            this.currentPage = 1;
            this.updateFilters(true);
          });
        });
      });
    }

    // 4. Initialize Reset Button
    if (this.resetButtonElement) {
      this.resetButtonElement.addEventListener('click', () => {
        this.resetAllFilters();
      });
    }

    // 5. Initialize Pagination Navigation
    if (this.config.pagination) {
      const pageKey = this.config.pagination.pageParamKey || 'page';
      const pageInUrl = urlParams?.get(pageKey);
      if (pageInUrl) {
        const parsed = parseInt(pageInUrl, 10);
        if (!isNaN(parsed) && parsed >= 1) {
          this.currentPage = parsed;
        }
      }

      if (this.paginationNavElement) {
        this.paginationNavElement.addEventListener('click', (e) => {
          const target = (e.target as HTMLElement).closest('button');
          if (!target || target.disabled) return;

          const action = target.getAttribute('data-action');
          const goto = target.getAttribute('data-goto');

          if (action === 'prev') {
            this.currentPage = Math.max(1, this.currentPage - 1);
            this.updateFilters(true);
          } else if (action === 'next') {
            this.currentPage = this.currentPage + 1;
            this.updateFilters(true);
          } else if (goto) {
            const p = parseInt(goto, 10);
            if (!isNaN(p)) {
              this.currentPage = p;
              this.updateFilters(true);
            }
          }
        });
      }
    }

    // 6. Handle Popstate (Back/Forward)
    if (this.config.urlParamSync !== false) {
      window.addEventListener('popstate', () => {
        this.syncStateFromUrl();
      });
    }

    // Run initial filter check
    this.updateFilters();
  }

  public resetAllFilters() {
    this.searchQuery = '';
    if (this.config.searchFieldSelector) {
      const searchInput = document.querySelector(this.config.searchFieldSelector) as HTMLInputElement | null;
      if (searchInput) searchInput.value = '';
    }

    if (this.config.dropdownFilters) {
      this.config.dropdownFilters.forEach(dropdown => {
        const select = document.querySelector(dropdown.selectSelector) as HTMLSelectElement | null;
        if (select) {
          select.value = 'all';
          this.dropdownValues.set(dropdown.dataAttribute, 'all');
        }
      });
    }

    if (this.config.buttonFilters) {
      this.config.buttonFilters.forEach(btnConfig => {
        const buttons = document.querySelectorAll<HTMLElement>(btnConfig.buttonSelector);
        const defVal = btnConfig.defaultValue || 'all';
        const activeCls = btnConfig.activeClass || 'active';
        buttons.forEach(b => b.classList.remove(activeCls));
        this.buttonValues.set(btnConfig.dataAttribute, defVal);
      });
    }

    this.currentPage = 1;
    this.updateFilters(true);
  }

  private syncStateFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);

    // Search
    const searchKey = this.config.searchParamKey || 'q';
    this.searchQuery = (urlParams.get(searchKey) || '').toLowerCase().trim();
    if (this.config.searchFieldSelector) {
      const searchInput = document.querySelector(this.config.searchFieldSelector) as HTMLInputElement | null;
      if (searchInput) searchInput.value = this.searchQuery;
    }

    // Dropdowns
    if (this.config.dropdownFilters) {
      this.config.dropdownFilters.forEach(dropdown => {
        const select = document.querySelector(dropdown.selectSelector) as HTMLSelectElement | null;
        const paramKey = dropdown.paramKey || dropdown.dataAttribute.replace('data-', '');
        const val = urlParams.get(paramKey) || 'all';
        this.dropdownValues.set(dropdown.dataAttribute, val);
        if (select) select.value = val;
      });
    }

    // Buttons
    if (this.config.buttonFilters) {
      this.config.buttonFilters.forEach(btnConfig => {
        const buttons = document.querySelectorAll<HTMLElement>(btnConfig.buttonSelector);
        const defVal = btnConfig.defaultValue || 'all';
        const activeCls = btnConfig.activeClass || 'active';
        const paramKey = btnConfig.paramKey || btnConfig.dataAttribute.replace('data-', '');
        const val = (urlParams.get(paramKey) || defVal).toLowerCase();

        this.buttonValues.set(btnConfig.dataAttribute, val);
        buttons.forEach(btn => {
          const rawBtnVal = btn.getAttribute('data-lang') || btn.getAttribute('data-value') || btn.getAttribute('data-tag') || defVal;
          if (val !== defVal && rawBtnVal.toLowerCase() === val) {
            btn.classList.add(activeCls);
          } else {
            btn.classList.remove(activeCls);
          }
        });
      });
    }

    // Page
    if (this.config.pagination) {
      const pageKey = this.config.pagination.pageParamKey || 'page';
      const pageInUrl = urlParams.get(pageKey);
      this.currentPage = pageInUrl ? parseInt(pageInUrl, 10) || 1 : 1;
    }

    this.updateFilters();
  }

  private updateFilters(shouldScroll: boolean = false) {
    const matchingItems: HTMLElement[] = [];

    this.items.forEach(item => {
      let isVisible = true;

      // 1. Search filter
      if (this.searchQuery && this.config.searchDataAttributes) {
        const matchesSearch = this.config.searchDataAttributes.some(attr => {
          const val = item.getAttribute(attr)?.toLowerCase() || '';
          return val.includes(this.searchQuery);
        });
        if (!matchesSearch) isVisible = false;
      }

      // 2. Dropdown filters
      if (isVisible && this.config.dropdownFilters) {
        for (const dropdown of this.config.dropdownFilters) {
          const selectedValue = this.dropdownValues.get(dropdown.dataAttribute);
          if (selectedValue && selectedValue !== 'all') {
            const itemValue = item.getAttribute(dropdown.dataAttribute)?.toLowerCase() || '';
            const matchVal = selectedValue.toLowerCase();

            if (dropdown.matchType === 'includes') {
              const tokens = itemValue.trim() ? itemValue.trim().split(/[\s,]+/) : [];
              if (!tokens.includes(matchVal)) {
                isVisible = false;
                break;
              }
            } else {
              if (itemValue !== matchVal) {
                isVisible = false;
                break;
              }
            }
          }
        }
      }

      // 3. Button filters
      if (isVisible && this.config.buttonFilters) {
        for (const btnConfig of this.config.buttonFilters) {
          const selectedValue = this.buttonValues.get(btnConfig.dataAttribute);
          const defVal = btnConfig.defaultValue || 'all';

          if (selectedValue && selectedValue !== defVal) {
            const itemValue = item.getAttribute(btnConfig.dataAttribute)?.toLowerCase() || '';
            const matchVal = selectedValue.toLowerCase();

            if (btnConfig.matchType === 'includes') {
              const tokens = itemValue.trim() ? itemValue.trim().split(/[\s,]+/) : [];
              if (!tokens.includes(matchVal)) {
                isVisible = false;
                break;
              }
            } else {
              if (itemValue !== matchVal) {
                isVisible = false;
                break;
              }
            }
          }
        }
      }

      if (isVisible) {
        matchingItems.push(item);
      }
    });

    const totalMatching = matchingItems.length;

    // 4. Toggle No Results Message
    if (this.noResultsElement) {
      if (totalMatching === 0) {
        this.noResultsElement.classList.remove('hidden');
      } else {
        this.noResultsElement.classList.add('hidden');
      }
    }

    // 5. Handle Groups (e.g. Year sections in publications)
    if (this.config.groupSelector) {
      const groups = document.querySelectorAll<HTMLElement>(this.config.groupSelector);
      groups.forEach(group => {
        const hasMatchingChild = matchingItems.some(item => group.contains(item));
        if (hasMatchingChild) {
          group.classList.remove('hidden');
        } else {
          group.classList.add('hidden');
        }
      });
    }

    // 6. Handle Pagination or Direct Visibility
    if (this.config.pagination) {
      const { pageSize, theme = 'blue' } = this.config.pagination;
      const totalPages = Math.max(1, Math.ceil(totalMatching / pageSize));

      if (this.currentPage > totalPages) {
        this.currentPage = totalPages;
      }
      if (this.currentPage < 1) {
        this.currentPage = 1;
      }

      const startIndex = (this.currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;

      // Hide all items
      this.items.forEach(item => item.classList.add('hidden'));

      // Show sliced matching items
      for (let i = startIndex; i < endIndex && i < totalMatching; i++) {
        matchingItems[i].classList.remove('hidden');
      }

      // Update Pagination Navigation Elements
      if (this.paginationNavElement) {
        if (totalPages <= 1) {
          this.paginationNavElement.classList.add('hidden');
        } else {
          this.paginationNavElement.classList.remove('hidden');
          this.renderPaginationControls(totalPages, theme);
        }
      }
    } else {
      // Direct visibility without pagination
      this.items.forEach(item => item.classList.add('hidden'));
      matchingItems.forEach(item => item.classList.remove('hidden'));
    }

    // Scroll to start of list if triggered by interactive controls (pagination, tag buttons)
    if (shouldScroll) {
      this.scrollToStart();
    }

    // 7. Toggle Reset Button
    if (this.resetButtonElement) {
      const isSearchActive = Boolean(this.searchQuery);
      let isDropdownActive = false;
      if (this.config.dropdownFilters) {
        isDropdownActive = Array.from(this.dropdownValues.values()).some(v => v && v !== 'all');
      }
      let isButtonActive = false;
      if (this.config.buttonFilters) {
        isButtonActive = this.config.buttonFilters.some(btnConfig => {
          const val = this.buttonValues.get(btnConfig.dataAttribute);
          const defVal = btnConfig.defaultValue || 'all';
          return val && val !== defVal;
        });
      }

      if (isSearchActive || isDropdownActive || isButtonActive) {
        this.resetButtonElement.classList.remove('hidden');
      } else {
        this.resetButtonElement.classList.add('hidden');
      }
    }

    // 8. Update Tag Highlights in Preview Cards
    this.updateTagHighlights();

    // 9. Update URL Query Parameters
    if (this.config.urlParamSync !== false) {
      this.updateUrlParams();
    }
  }

  private updateTagHighlights() {
    let activeTag = (this.buttonValues.get('data-tags') || '').toLowerCase().trim();
    if (!activeTag || activeTag === 'all') {
      const tagBtnConfig = this.config.buttonFilters?.find(b => b.paramKey === 'tag' || b.dataAttribute === 'data-tags' || b.dataAttribute === 'data-tag');
      if (tagBtnConfig) {
        activeTag = (this.buttonValues.get(tagBtnConfig.dataAttribute) || '').toLowerCase().trim();
      }
    }
    const isTagActive = Boolean(activeTag && activeTag !== 'all');

    // Select all tag chips in content preview cards
    const cardTagChips = document.querySelectorAll<HTMLElement>('.tag-chip, [data-tag]');
    cardTagChips.forEach(chip => {
      // Exclude sidebar filter buttons so their active class isn't interfered with
      if (chip.classList.contains('tag-filter-btn') || chip.classList.contains('lang-filter-btn')) return;

      const rawTag = chip.getAttribute('data-tag') || chip.textContent?.replace(/^#/, '') || '';
      const chipTag = rawTag.toLowerCase().trim();

      if (isTagActive && chipTag === activeTag) {
        chip.classList.add('active-tag-match');
      } else {
        chip.classList.remove('active-tag-match');
      }
    });
  }

  private renderPaginationControls(totalPages: number, theme: 'blue' | 'purple' | 'yellow' | 'green') {
    if (!this.paginationNavElement) return;

    const prevBtn = this.paginationNavElement.querySelector<HTMLButtonElement>('[data-action="prev"]');
    const nextBtn = this.paginationNavElement.querySelector<HTMLButtonElement>('[data-action="next"]');
    const numbersContainer = this.paginationNavElement.querySelector<HTMLElement>('.page-numbers-container');

    if (prevBtn) {
      if (this.currentPage <= 1) {
        prevBtn.disabled = true;
        prevBtn.className = "prev-btn inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-element-bg border border-element-border text-gray-600 text-sm font-semibold cursor-not-allowed opacity-40 w-full sm:w-auto transition-all duration-200";
      } else {
        prevBtn.disabled = false;
        prevBtn.className = `prev-btn inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-element-bg border border-element-border-medium text-gray-300 hover:text-gray-100 hover:border-brand-${theme}/30 hover:bg-element-bg-hover transition-all duration-200 text-sm font-semibold group w-full sm:w-auto cursor-pointer`;
      }
    }

    if (nextBtn) {
      if (this.currentPage >= totalPages) {
        nextBtn.disabled = true;
        nextBtn.className = "next-btn inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-element-bg border border-element-border text-gray-600 text-sm font-semibold cursor-not-allowed opacity-40 w-full sm:w-auto transition-all duration-200";
      } else {
        nextBtn.disabled = false;
        nextBtn.className = `next-btn inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-element-bg border border-element-border-medium text-gray-300 hover:text-gray-100 hover:border-brand-${theme}/30 hover:bg-element-bg-hover transition-all duration-200 text-sm font-semibold group w-full sm:w-auto cursor-pointer`;
      }
    }

    if (numbersContainer) {
      const pageNumbers = getPageNumbers(this.currentPage, totalPages);
      numbersContainer.innerHTML = pageNumbers.map((num) => {
        if (typeof num === 'string') {
          return '<span class="px-3 py-2 text-gray-500 text-sm font-medium">...</span>';
        }
        if (num === this.currentPage) {
          return `<span class="px-3.5 py-2 rounded-xl text-sm font-bold text-white bg-gradient-${theme} shadow-lg shadow-brand-${theme}/20 cursor-default select-none min-w-[38px] text-center" aria-current="page" data-page-btn="${num}">${num}</span>`;
        }
        return `<button type="button" data-goto="${num}" class="px-3.5 py-2 rounded-xl text-sm font-medium bg-element-bg border border-element-border-medium text-gray-400 hover:text-gray-100 hover:border-brand-${theme}/30 hover:bg-element-bg-hover transition-all duration-200 min-w-[38px] text-center cursor-pointer">${num}</button>`;
      }).join('');
    }
  }

  private updateUrlParams() {
    const url = new URL(window.location.href);

    // Search query
    const searchKey = this.config.searchParamKey || 'q';
    if (this.searchQuery) {
      url.searchParams.set(searchKey, this.searchQuery);
    } else {
      url.searchParams.delete(searchKey);
    }

    // Dropdowns
    if (this.config.dropdownFilters) {
      this.config.dropdownFilters.forEach(dropdown => {
        const val = this.dropdownValues.get(dropdown.dataAttribute);
        const paramKey = dropdown.paramKey || dropdown.dataAttribute.replace('data-', '');
        if (val && val !== 'all') {
          url.searchParams.set(paramKey, val);
        } else {
          url.searchParams.delete(paramKey);
        }
      });
    }

    // Buttons
    if (this.config.buttonFilters) {
      this.config.buttonFilters.forEach(btnConfig => {
        const val = this.buttonValues.get(btnConfig.dataAttribute);
        const defVal = btnConfig.defaultValue || 'all';
        const paramKey = btnConfig.paramKey || btnConfig.dataAttribute.replace('data-', '');
        if (val && val !== defVal) {
          url.searchParams.set(paramKey, val);
        } else {
          url.searchParams.delete(paramKey);
        }
      });
    }

    // Page
    if (this.config.pagination) {
      const pageKey = this.config.pagination.pageParamKey || 'page';
      if (this.currentPage > 1) {
        url.searchParams.set(pageKey, String(this.currentPage));
      } else {
        url.searchParams.delete(pageKey);
      }
    }

    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }

  private scrollToStart() {
    const selector = this.config.scrollToSelector || this.config.pagination?.scrollToSelector;
    if (!selector) return;

    const target = document.querySelector<HTMLElement>(selector);
    if (!target) return;

    const header = document.querySelector('header');
    const headerHeight = header ? header.getBoundingClientRect().height : 80;
    const offset = headerHeight + 24; // 24px comfortable breathing room below sticky navbar

    const elementPosition = target.getBoundingClientRect().top + window.scrollY;
    const offsetPosition = elementPosition - offset;

    if (Math.abs(window.scrollY - offsetPosition) > 15) {
      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth'
      });
    }
  }
}
