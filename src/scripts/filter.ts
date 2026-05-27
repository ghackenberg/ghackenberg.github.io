export interface DropdownFilterConfig {
  selectSelector: string;
  dataAttribute: string;
  matchType?: 'exact' | 'includes';
}

export interface ButtonFilterConfig {
  buttonSelector: string;
  dataAttribute: string;
  defaultValue?: string;
  activeClass?: string;
}

export interface FilterConfig {
  itemSelector: string;
  searchFieldSelector?: string;
  searchDataAttributes?: string[];
  dropdownFilters?: DropdownFilterConfig[];
  buttonFilters?: ButtonFilterConfig[];
  noResultsSelector?: string;
}

export class ClientListFilter {
  private items: NodeListOf<HTMLElement>;
  private noResultsElement: HTMLElement | null = null;
  private searchQuery: string = '';
  private dropdownValues: Map<string, string> = new Map();
  private buttonValues: Map<string, string> = new Map();

  constructor(private config: FilterConfig) {
    this.items = document.querySelectorAll(config.itemSelector);
    if (config.noResultsSelector) {
      this.noResultsElement = document.querySelector(config.noResultsSelector);
    }
    this.init();
  }

  private init() {
    // 1. Initialize Search Input
    if (this.config.searchFieldSelector) {
      const searchInput = document.querySelector(this.config.searchFieldSelector) as HTMLInputElement | null;
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase().trim();
          this.updateFilters();
        });
      }
    }

    // 2. Initialize Dropdowns
    if (this.config.dropdownFilters) {
      this.config.dropdownFilters.forEach(dropdown => {
        const select = document.querySelector(dropdown.selectSelector) as HTMLSelectElement | null;
        if (select) {
          // Initialize state
          this.dropdownValues.set(dropdown.dataAttribute, select.value);
          
          select.addEventListener('change', (e) => {
            const val = (e.target as HTMLSelectElement).value;
            this.dropdownValues.set(dropdown.dataAttribute, val);
            this.updateFilters();
          });
        }
      });
    }

    // 3. Initialize Buttons
    if (this.config.buttonFilters) {
      this.config.buttonFilters.forEach(btnConfig => {
        const buttons = document.querySelectorAll(btnConfig.buttonSelector);
        const defVal = btnConfig.defaultValue || 'all';
        const activeCls = btnConfig.activeClass || 'active';
        
        this.buttonValues.set(btnConfig.dataAttribute, defVal);

        buttons.forEach(btn => {
          btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove(activeCls));
            btn.classList.add(activeCls);
            
            const btnVal = btn.getAttribute('data-lang') || btn.getAttribute('data-value') || btn.getAttribute('data-tag') || defVal;
            this.buttonValues.set(btnConfig.dataAttribute, btnVal);
            this.updateFilters();
          });
        });
      });
    }

    // Run initial filter check
    this.updateFilters();
  }

  private updateFilters() {
    let visibleCount = 0;

    this.items.forEach(item => {
      let isVisible = true;

      // Check Search Query
      if (this.searchQuery && this.config.searchDataAttributes) {
        const matchesSearch = this.config.searchDataAttributes.some(attr => {
          const val = item.getAttribute(attr)?.toLowerCase() || '';
          return val.includes(this.searchQuery);
        });
        if (!matchesSearch) isVisible = false;
      }

      // Check Dropdown Filters
      if (isVisible && this.config.dropdownFilters) {
        for (const dropdown of this.config.dropdownFilters) {
          const selectedValue = this.dropdownValues.get(dropdown.dataAttribute);
          if (selectedValue && selectedValue !== 'all') {
            const itemValue = item.getAttribute(dropdown.dataAttribute)?.toLowerCase() || '';
            const matchVal = selectedValue.toLowerCase();
            
            if (dropdown.matchType === 'includes') {
              if (!itemValue.includes(matchVal)) {
                isVisible = false;
                break;
              }
            } else {
              // Exact match
              if (itemValue !== matchVal) {
                isVisible = false;
                break;
              }
            }
          }
        }
      }

      // Check Button Filters
      if (isVisible && this.config.buttonFilters) {
        for (const btnConfig of this.config.buttonFilters) {
          const selectedValue = this.buttonValues.get(btnConfig.dataAttribute);
          if (selectedValue && selectedValue !== 'all') {
            const itemValue = item.getAttribute(btnConfig.dataAttribute) || '';
            if (itemValue !== selectedValue) {
              isVisible = false;
              break;
            }
          }
        }
      }

      // Apply visibility class
      if (isVisible) {
        item.classList.remove('hidden');
        visibleCount++;
      } else {
        item.classList.add('hidden');
      }
    });

    // Toggle no results element if configured
    if (this.noResultsElement) {
      if (visibleCount === 0) {
        this.noResultsElement.classList.remove('hidden');
      } else {
        this.noResultsElement.classList.add('hidden');
      }
    }
  }
}
