import { trackEvent } from './telemetry';

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
  multiple?: boolean;
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

interface FilterWindow extends Window {
  __activeFilterInstance?: ClientListFilter;
  __popstateRegistered?: boolean;
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

function removeHighlights(root: HTMLElement) {
  const marks = root.querySelectorAll('mark.search-highlight');
  marks.forEach(mark => {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
      parent.normalize();
    }
  });
}

function highlightTextNodes(root: HTMLElement, searchWords: string[]) {
  removeHighlights(root);

  if (searchWords.length === 0) return;

  const escapedWords = searchWords
    .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(Boolean);

  if (escapedWords.length === 0) return;

  const regex = new RegExp(`(${escapedWords.join('|')})`, 'gi');

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
      const parentTag = node.parentElement?.tagName.toLowerCase();
      if (parentTag === 'script' || parentTag === 'style' || parentTag === 'mark') {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const textNodes: Text[] = [];
  let currentNode = walker.nextNode();
  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent || '';
    if (!regex.test(text)) continue;
    regex.lastIndex = 0;

    const fragment = document.createDocumentFragment();
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        fragment.appendChild(document.createTextNode(text.substring(lastIdx, match.index)));
      }
      const mark = document.createElement('mark');
      mark.className = 'search-highlight';
      mark.textContent = match[0];
      fragment.appendChild(mark);

      lastIdx = regex.lastIndex;
    }

    if (lastIdx < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIdx)));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  }
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
        if (!searchInput.dataset.filterBound) {
          searchInput.dataset.filterBound = 'true';
          searchInput.addEventListener('input', (e) => {
            this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase().trim();
            this.currentPage = 1;
            this.updateFilters(false, false);
          });
        }
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

          if (!select.dataset.filterBound) {
            select.dataset.filterBound = 'true';
            select.addEventListener('change', (e) => {
              const val = (e.target as HTMLSelectElement).value;
              this.dropdownValues.set(dropdown.dataAttribute, val);
              this.currentPage = 1;
              trackEvent('Filter Content', { type: 'dropdown', key: dropdown.dataAttribute, value: val, path: window.location.pathname });
              this.updateFilters(false, true);
            });
          }
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
        const rawVals = urlParams ? urlParams.getAll(paramKey) : [];
        const tokens = rawVals.flatMap(v => v.split(',')).map(s => s.trim().toLowerCase()).filter(s => s && s !== defVal);

        const initialVal = tokens.length > 0 ? (btnConfig.multiple ? tokens.join(',') : tokens[0]) : defVal;
        this.buttonValues.set(btnConfig.dataAttribute, initialVal);
        const initialTokens = new Set(tokens);

        buttons.forEach(btn => {
          const rawBtnVal = btn.getAttribute('data-trl') || btn.getAttribute('data-lang') || btn.getAttribute('data-value') || btn.getAttribute('data-tag') || defVal;
          const btnVal = rawBtnVal.toLowerCase();

          if (initialVal !== defVal && (btnConfig.multiple ? initialTokens.has(btnVal) : btnVal === initialVal)) {
            btn.classList.add(activeCls);
          } else {
            btn.classList.remove(activeCls);
          }

          if (!btn.dataset.filterBound) {
            btn.dataset.filterBound = 'true';
            btn.addEventListener('click', () => {
              const currentVal = this.buttonValues.get(btnConfig.dataAttribute) || defVal;
              let newVal = defVal;

              if (btnConfig.multiple) {
                const currentTokensList = currentVal !== defVal ? currentVal.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
                const tokenIndex = currentTokensList.indexOf(btnVal);
                if (tokenIndex !== -1) {
                  // Deselect
                  currentTokensList.splice(tokenIndex, 1);
                  btn.classList.remove(activeCls);
                } else {
                  // Select additionally - append to preserve selection order
                  currentTokensList.push(btnVal);
                  btn.classList.add(activeCls);
                }
                newVal = currentTokensList.length > 0 ? currentTokensList.join(',') : defVal;
              } else {
                if (currentVal === btnVal) {
                  // Deselect
                  buttons.forEach(b => b.classList.remove(activeCls));
                  newVal = defVal;
                } else {
                  // Select
                  buttons.forEach(b => {
                    const bVal = (b.getAttribute('data-trl') || b.getAttribute('data-lang') || b.getAttribute('data-value') || b.getAttribute('data-tag') || defVal).toLowerCase();
                    if (bVal === btnVal) {
                      b.classList.add(activeCls);
                    } else {
                      b.classList.remove(activeCls);
                    }
                  });
                  newVal = btnVal;
                }
              }

              this.buttonValues.set(btnConfig.dataAttribute, newVal);
              this.currentPage = 1;
              trackEvent('Filter Content', { type: 'button', key: btnConfig.dataAttribute, value: newVal, path: window.location.pathname });
              this.updateFilters(false, true);

              // Auto-scroll the tag drawer / subview back to top so selected tags are visible
              const parentContainer = btn.parentElement;
              if (parentContainer && parentContainer.scrollTop > 0) {
                parentContainer.scrollTo({ top: 0, behavior: 'smooth' });
              }
            });
          }
        });
      });
    }

    // 4. Initialize Reset Button
    if (this.resetButtonElement) {
      if (!this.resetButtonElement.dataset.filterBound) {
        this.resetButtonElement.dataset.filterBound = 'true';
        this.resetButtonElement.addEventListener('click', () => {
          trackEvent('Filter Content', { type: 'reset', path: window.location.pathname });
          this.resetAllFilters();
        });
      }
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
        if (!this.paginationNavElement.dataset.filterBound) {
          this.paginationNavElement.dataset.filterBound = 'true';
          this.paginationNavElement.addEventListener('click', (e) => {
            const target = (e.target as HTMLElement).closest('button');
            if (!target || target.disabled) return;

            const action = target.getAttribute('data-action');
            const goto = target.getAttribute('data-goto');

            if (action === 'prev') {
              this.currentPage = Math.max(1, this.currentPage - 1);
              this.updateFilters(true, true);
            } else if (action === 'next') {
              this.currentPage = this.currentPage + 1;
              this.updateFilters(true, true);
            } else if (goto) {
              const p = parseInt(goto, 10);
              if (!isNaN(p)) {
                this.currentPage = p;
                this.updateFilters(true, true);
              }
            }
          });
        }
      }
    }

    // 6. Handle Popstate (Back/Forward) & Dev Studio Shell sync
    (window as FilterWindow).__activeFilterInstance = this;
    if (this.config.urlParamSync !== false) {
      const win = window as FilterWindow;
      if (!win.__popstateRegistered) {
        win.__popstateRegistered = true;
        window.addEventListener('popstate', () => {
          if (win.__activeFilterInstance) {
            win.__activeFilterInstance.syncStateFromUrl();
          }
        });
        window.addEventListener('message', (e) => {
          if (e.data && (e.data.type === 'dev-studio-popstate' || e.data.type === 'dev-studio-url-sync-echo')) {
            if (win.__activeFilterInstance) {
              win.__activeFilterInstance.syncStateFromUrl();
            }
          }
        });
      }
    }

    // Run initial filter check
    this.updateFilters(false, false);
    document.documentElement.classList.remove('has-filter-query');
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
        buttons.forEach(b => {
          b.classList.remove(activeCls);
          b.classList.remove('hidden');
          b.style.display = '';
        });
        this.buttonValues.set(btnConfig.dataAttribute, defVal);
      });
    }

    const countEls = document.querySelectorAll<HTMLElement>('[data-tag-count], [data-tag-total]');
    countEls.forEach(el => {
      const tagButtons = document.querySelectorAll<HTMLElement>('.tag-filter-btn');
      if (tagButtons.length > 0) {
        el.textContent = String(tagButtons.length);
      }
    });

    const badges = document.querySelectorAll<HTMLElement>('.active-tag-badge');
    badges.forEach(badge => {
      badge.textContent = '';
      badge.classList.add('hidden');
      badge.style.display = 'none';
    });
    document.documentElement.classList.remove('has-active-tag-filter');

    const activeInfoEls = document.querySelectorAll<HTMLElement>('.active-tag-info');
    activeInfoEls.forEach(infoEl => {
      infoEl.classList.add('hidden');
      infoEl.style.display = 'none';
    });

    const toggleBtns = document.querySelectorAll<HTMLElement>('.tag-toggle-btn');
    toggleBtns.forEach(toggleBtn => {
      toggleBtn.classList.remove('has-active-tags');
      toggleBtn.classList.remove('active');
      toggleBtn.setAttribute('aria-expanded', 'false');
      const arrow = toggleBtn.querySelector('.toggle-arrow');
      if (arrow) arrow.classList.remove('rotate-180');
    });

    const tagContainers = document.querySelectorAll<HTMLElement>('#tag-filter-buttons, .tag-filter-details div');
    tagContainers.forEach(c => {
      if (c.scrollTop > 0) {
        c.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    // Collapse tag details drawer if open
    const detailsEls = document.querySelectorAll<HTMLDetailsElement>('details.tag-filter-details');
    detailsEls.forEach(details => {
      if (details.open) {
        details.open = false;
        details.dispatchEvent(new Event('toggle'));
      }
    });

    this.currentPage = 1;
    this.updateFilters(false, true);
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
        const rawVals = urlParams ? urlParams.getAll(paramKey) : [];
        const tokens = rawVals.flatMap(v => v.split(',')).map(s => s.trim().toLowerCase()).filter(s => s && s !== defVal);
        const val = tokens.length > 0 ? (btnConfig.multiple ? tokens.join(',') : tokens[0]) : defVal;

        this.buttonValues.set(btnConfig.dataAttribute, val);
        const selectedTokens = new Set(tokens);

        buttons.forEach(btn => {
          const rawBtnVal = btn.getAttribute('data-trl') || btn.getAttribute('data-lang') || btn.getAttribute('data-value') || btn.getAttribute('data-tag') || defVal;
          const btnVal = rawBtnVal.toLowerCase();
          if (val !== defVal && (btnConfig.multiple ? selectedTokens.has(btnVal) : btnVal === val)) {
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

    this.updateFilters(false, false);
  }

  private updateFilters(shouldScroll: boolean = false, pushToHistory: boolean = false) {
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

            if (btnConfig.multiple) {
              const selectedTokens = selectedValue.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
              if (btnConfig.matchType === 'includes') {
                const itemTokens = itemValue.trim() ? itemValue.trim().split(/[\s,]+/) : [];
                // Logical AND: Item must contain ALL selected tokens
                const matchesAll = selectedTokens.every(tok => itemTokens.includes(tok));
                if (!matchesAll) {
                  isVisible = false;
                  break;
                }
              } else {
                if (!selectedTokens.includes(itemValue)) {
                  isVisible = false;
                  break;
                }
              }
            } else {
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
      }

      if (isVisible) {
        matchingItems.push(item);
      }
    });

    const totalMatching = matchingItems.length;

    // Update faceted button filter visibility (e.g. tag drawer pruning based on logical AND)
    this.updateDynamicButtonVisibility(matchingItems);

    // Free-text search highlights across card titles, descriptions, and tags
    this.updateSearchHighlights();

    // 4. Toggle No Results Message
    if (this.noResultsElement) {
      if (totalMatching === 0) {
        this.noResultsElement.classList.remove('hidden');
        this.noResultsElement.style.display = '';
      } else {
        this.noResultsElement.classList.add('hidden');
        this.noResultsElement.style.display = 'none';
      }
    }

    // 5. Handle Groups (e.g. Year sections in publications)
    if (this.config.groupSelector) {
      const groups = document.querySelectorAll<HTMLElement>(this.config.groupSelector);
      groups.forEach(group => {
        const hasMatchingChild = matchingItems.some(item => group.contains(item));
        if (hasMatchingChild) {
          group.classList.remove('hidden');
          group.style.display = '';
        } else {
          group.classList.add('hidden');
          group.style.display = 'none';
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
      this.items.forEach(item => {
        item.classList.add('hidden');
        item.style.display = 'none';
      });

      // Show sliced matching items
      for (let i = startIndex; i < endIndex && i < totalMatching; i++) {
        matchingItems[i].classList.remove('hidden');
        matchingItems[i].style.display = '';
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
      this.items.forEach(item => {
        item.classList.add('hidden');
        item.style.display = 'none';
      });
      matchingItems.forEach(item => {
        item.classList.remove('hidden');
        item.style.display = '';
      });
    }

    // Scroll to start of list if triggered by interactive controls (pagination)
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

    // 9. Update Active Tag Indicator Badge & Chips
    this.updateActiveTagIndicators();

    // 10. Update URL Query Parameters
    if (this.config.urlParamSync !== false) {
      this.updateUrlParams(pushToHistory);
    }
  }

  private updateDynamicButtonVisibility(matchingItems: HTMLElement[]) {
    if (!this.config.buttonFilters) return;

    this.config.buttonFilters.forEach(btnConfig => {
      if (btnConfig.matchType !== 'includes') return;

      const buttons = Array.from(document.querySelectorAll<HTMLElement>(btnConfig.buttonSelector));
      if (buttons.length === 0) return;

      const container = buttons[0].parentElement;

      const selectedValue = this.buttonValues.get(btnConfig.dataAttribute);
      const defVal = btnConfig.defaultValue || 'all';
      const isAnySelected = Boolean(selectedValue && selectedValue !== defVal);

      const selectedTokensList = isAnySelected
        ? selectedValue!.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
        : [];
      const selectedTokens = new Set(selectedTokensList);
      const selectedOrderMap = new Map<string, number>();
      selectedTokensList.forEach((token, idx) => {
        selectedOrderMap.set(token, idx);
      });

      // Pre-calculate frequency of each tag in matchingItems
      const tagCountsInMatching = new Map<string, number>();
      matchingItems.forEach(item => {
        const rawTags = item.getAttribute(btnConfig.dataAttribute) || '';
        const tokens = rawTags.trim().split(/[\s,]+/);
        const itemTags = new Set(tokens.map(t => t.trim().toLowerCase()).filter(Boolean));
        itemTags.forEach(t => {
          tagCountsInMatching.set(t, (tagCountsInMatching.get(t) || 0) + 1);
        });
      });

      let visibleCount = 0;

      buttons.forEach(btn => {
        const rawVal = (btn.getAttribute('data-tag') || btn.getAttribute('data-value') || '').toLowerCase().trim();
        const isSelected = selectedTokens.has(rawVal);

        let count = 0;
        if (isSelected) {
          // bei bereits gewählten tags ist das die anzahl der contents, die alle diese tags haben
          count = matchingItems.length;
        } else {
          // bei den restlichen tags ist es die anzahl der artikelteilmenge, die zusätzlich dieses weitere tag haben
          count = tagCountsInMatching.get(rawVal) || 0;
        }

        btn.dataset.count = String(count);

        let badgeEl = btn.querySelector<HTMLElement>('.tag-badge, .tag-count');
        if (!badgeEl) {
          badgeEl = document.createElement('span');
          badgeEl.className = 'tag-badge text-[10px] font-normal opacity-75 ml-1.5 px-1.5 py-0.5 rounded bg-white/10';
          btn.appendChild(badgeEl);
        }
        badgeEl.textContent = String(count);

        if (count > 0) {
          btn.classList.remove('hidden');
          btn.style.display = '';
          visibleCount++;
        } else {
          btn.classList.add('hidden');
          btn.style.display = 'none';
        }
      });

      // Sort buttons: selected first (in exact query parameter order), then highest count first, then alphabetically
      buttons.sort((a, b) => {
        const tagA = (a.getAttribute('data-tag') || '').toLowerCase().trim();
        const tagB = (b.getAttribute('data-tag') || '').toLowerCase().trim();
        const isASelected = selectedTokens.has(tagA);
        const isBSelected = selectedTokens.has(tagB);

        // If both are selected, preserve exact query parameter sequence!
        if (isASelected && isBSelected) {
          const orderA = selectedOrderMap.get(tagA) ?? 0;
          const orderB = selectedOrderMap.get(tagB) ?? 0;
          return orderA - orderB;
        }

        if (isASelected && !isBSelected) return -1;
        if (!isASelected && isBSelected) return 1;

        const countA = parseInt(a.dataset.count || '0', 10);
        const countB = parseInt(b.dataset.count || '0', 10);
        if (countB !== countA) {
          return countB - countA;
        }
        return tagA.localeCompare(tagB);
      });

      if (container) {
        buttons.forEach(btn => container.appendChild(btn));
      }

      // Update total available tags count in the tag toggle button
      if (btnConfig.paramKey === 'tag' || btnConfig.dataAttribute === 'data-tags' || btnConfig.dataAttribute === 'data-tag') {
        const countEls = document.querySelectorAll<HTMLElement>('[data-tag-total], [data-tag-count]');
        countEls.forEach(el => {
          el.textContent = String(visibleCount);
          el.classList.add('is-synced');
        });
      }
    });
  }

  private updateSearchHighlights() {
    const query = this.searchQuery.trim();
    const searchWords = query ? query.split(/\s+/).map(w => w.trim()).filter(w => w.length > 0) : [];

    this.items.forEach(item => {
      const targetEls = item.querySelectorAll<HTMLElement>('h2, h3, p, .tag-chip, [data-tag]');
      if (targetEls.length > 0) {
        targetEls.forEach(el => {
          highlightTextNodes(el, searchWords);
        });
      } else {
        highlightTextNodes(item, searchWords);
      }
    });
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
    const activeTokens = new Set(isTagActive ? activeTag.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : []);

    // Select all tag chips in content preview cards
    const cardTagChips = document.querySelectorAll<HTMLElement>('.tag-chip, [data-tag]');
    cardTagChips.forEach(chip => {
      // Exclude sidebar and toolbar filter buttons so their active class isn't interfered with
      if (chip.classList.contains('tag-filter-btn') || chip.classList.contains('lang-filter-btn') || chip.classList.contains('tag-toggle-btn')) return;

      const rawTag = chip.getAttribute('data-tag') || chip.textContent?.replace(/^#/, '') || '';
      const chipTag = rawTag.toLowerCase().trim();

      if (isTagActive && activeTokens.has(chipTag)) {
        chip.classList.add('active-tag-match');
      } else {
        chip.classList.remove('active-tag-match');
      }
    });
  }

  private updateActiveTagIndicators() {
    if (!this.config.buttonFilters) return;

    const tagBtnConfig = this.config.buttonFilters.find(
      b => b.paramKey === 'tag' || b.dataAttribute === 'data-tags' || b.dataAttribute === 'data-tag'
    );
    if (!tagBtnConfig) return;

    const currentVal = this.buttonValues.get(tagBtnConfig.dataAttribute) || tagBtnConfig.defaultValue || 'all';
    const defVal = tagBtnConfig.defaultValue || 'all';
    const activeTokens = currentVal !== defVal ? currentVal.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];

    const badges = document.querySelectorAll<HTMLElement>('.active-tag-badge');
    badges.forEach(badge => {
      if (activeTokens.length > 0) {
        badge.textContent = String(activeTokens.length);
        badge.classList.remove('hidden');
        badge.style.display = 'inline-flex';
      } else {
        badge.textContent = '';
        badge.classList.add('hidden');
        badge.style.display = 'none';
      }
    });

    document.documentElement.classList.toggle('has-active-tag-filter', activeTokens.length > 0);

    const activeInfoEls = document.querySelectorAll<HTMLElement>('.active-tag-info');
    activeInfoEls.forEach(infoEl => {
      const countSpan = infoEl.querySelector<HTMLElement>('.active-tag-count');
      if (activeTokens.length > 0) {
        if (countSpan) countSpan.textContent = String(activeTokens.length);
        infoEl.classList.remove('hidden');
        infoEl.style.display = 'inline';
      } else {
        infoEl.classList.add('hidden');
        infoEl.style.display = 'none';
      }
    });

    const toggleBtns = document.querySelectorAll<HTMLElement>('.tag-toggle-btn');
    toggleBtns.forEach(toggleBtn => {
      toggleBtn.classList.toggle('has-active-tags', activeTokens.length > 0);
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

  private updateUrlParams(pushToHistory: boolean = false) {
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

    const newUrl = url.pathname + url.search + url.hash;
    const currentUrl = window.location.pathname + window.location.search + window.location.hash;

    if (newUrl !== currentUrl) {
      if (pushToHistory) {
        window.history.pushState({}, '', newUrl);
      } else {
        window.history.replaceState({}, '', newUrl);
      }
    }

    // Dev Studio Shell synchronization: if wrapped in dev shell iframe, synchronize outer window URL as well
    if (window.self !== window.top) {
      try {
        const topCurrent = (window.top?.location.pathname || '') + (window.top?.location.search || '') + (window.top?.location.hash || '');
        if (topCurrent !== newUrl) {
          if (pushToHistory) {
            window.top?.history.pushState({}, '', newUrl);
          } else {
            window.top?.history.replaceState({}, '', newUrl);
          }
        }
      } catch {
        // Fallback for cross-origin or if direct access is restricted
        window.parent.postMessage({ type: 'dev-studio-url-sync', url: newUrl, push: pushToHistory }, '*');
      }
    }

    try {
      const normalizedPath = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
      const storageKey = `${normalizedPath}_filter_query`;
      if (url.search) {
        sessionStorage.setItem(storageKey, url.search);
      } else {
        sessionStorage.removeItem(storageKey);
      }
    } catch {
      // In case sessionStorage is blocked or unavailable
    }
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
