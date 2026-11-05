import { atom, map } from 'nanostores';

export type ThemeSetting = 'system' | 'light' | 'dark';
export type SankeyModelMode = 'flow' | 'markov';

export interface DevSankeyConfigState {
  levels: number;
  modelMode: SankeyModelMode;
}

interface ThemeWindow extends Window {
  applyThemeGlobal?: (setting: string, trigger?: string) => void;
}

const PLAUSIBLE_IGNORE_KEY = 'plausible_ignore';
const THEME_STORAGE_KEY = 'theme';

export const THEME_TOOLTIP_MAP: Record<ThemeSetting, string> = {
  system: 'Theme: System (Click to switch to Light)',
  light: 'Theme: Light (Click to switch to Dark)',
  dark: 'Theme: Dark (Click to switch to System)',
};

function isValidThemeSetting(value: string | null | undefined): value is ThemeSetting {
  return value === 'system' || value === 'light' || value === 'dark';
}

function readInitialTheme(): ThemeSetting {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme-setting');
    if (isValidThemeSetting(attr)) return attr;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (isValidThemeSetting(stored)) return stored;
    } catch {
      // ignore storage errors
    }
  }
  return 'system';
}

function readInitialAnalyticsConsent(): boolean {
  if (typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem(PLAUSIBLE_IGNORE_KEY) !== 'true';
    } catch {
      return true;
    }
  }
  return true;
}

export const $themeSetting = atom<ThemeSetting>(readInitialTheme());
export const $analyticsConsent = atom<boolean>(readInitialAnalyticsConsent());
export const $paginationPages = map<Record<string, number>>({});
export const $devSankeyConfig = map<DevSankeyConfigState>({
  levels: 2,
  modelMode: 'flow',
});

export function syncThemeFromDom(): ThemeSetting {
  const current = readInitialTheme();
  if ($themeSetting.get() !== current) {
    $themeSetting.set(current);
  }
  return current;
}

export function setThemeSetting(setting: ThemeSetting): void {
  $themeSetting.set(setting);
  if (typeof document === 'undefined') return;

  document.documentElement.setAttribute('data-theme-setting', setting);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, setting);
  } catch {
    // ignore storage errors
  }

  const themeWin = window as ThemeWindow;
  if (typeof themeWin.applyThemeGlobal === 'function') {
    themeWin.applyThemeGlobal(setting, 'manual');
  } else {
    let activeTheme: 'light' | 'dark' = setting === 'light' ? 'light' : 'dark';
    if (setting === 'system') {
      const systemIsLight =
        window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
      activeTheme = systemIsLight ? 'light' : 'dark';
    }

    if (activeTheme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }

    window.dispatchEvent(
      new CustomEvent('theme-changed', {
        detail: {
          themeSetting: setting,
          resolvedTheme: activeTheme,
          trigger: 'manual',
        },
      })
    );
  }
}

export function cycleThemeSetting(): ThemeSetting {
  const current = syncThemeFromDom();
  const next: ThemeSetting =
    current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system';
  setThemeSetting(next);
  return next;
}

export function syncAnalyticsConsentFromStorage(): boolean {
  const current = readInitialAnalyticsConsent();
  if ($analyticsConsent.get() !== current) {
    $analyticsConsent.set(current);
  }
  return current;
}

export function setAnalyticsConsent(consented: boolean): void {
  try {
    if (consented) {
      localStorage.removeItem(PLAUSIBLE_IGNORE_KEY);
    } else {
      localStorage.setItem(PLAUSIBLE_IGNORE_KEY, 'true');
    }
  } catch {
    // ignore storage errors
  }
  $analyticsConsent.set(consented);
}

export function toggleAnalyticsConsent(): boolean {
  const currentlyConsented = syncAnalyticsConsentFromStorage();
  const next = !currentlyConsented;
  setAnalyticsConsent(next);
  return next;
}

export function setPaginationPage(key: string, page: number): void {
  $paginationPages.setKey(key, page);
}
