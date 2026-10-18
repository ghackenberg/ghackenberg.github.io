/**
 * Collapsible homepage sections.
 *
 * - Progressive enhancement: without JS (or without a stored layout) every section is expanded.
 * - Collapsing always works within the current page view (in memory only).
 * - The layout is PERSISTED in localStorage (`gh_home_sections_v1`) only after explicit opt-in
 *   via the Privacy modal. The existence of a valid key IS the consent; removing it revokes it.
 * - A small "New" pill is shown on collapsed sections whose collection has unread content
 *   (same read-state logic as the navbar badges; no count is shown visually, see aria-label).
 */
import { readUnreadCounts } from '@commons/client/unread-counts';

export const HOME_SECTIONS_STORAGE_KEY = 'gh_home_sections_v1';

interface HomeSectionsState {
  v: 1;
  collapsed: string[];
}

const COLLECTION_NOUNS: Record<string, string> = {
  posts: 'posts',
  presentations: 'presentations',
  courses: 'courses',
  projects: 'projects',
  services: 'services',
  publications: 'publications',
  visualizations: 'visualizations',
  interests: 'interests'
};

const ANIMATION_MS = 320;

/** Reads the persisted layout; null means no consent (or invalid data, which is discarded). */
function readPersisted(): Set<string> | null {
  try {
    const raw = localStorage.getItem(HOME_SECTIONS_STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<HomeSectionsState> | null;
    if (parsed && parsed.v === 1 && Array.isArray(parsed.collapsed)) {
      return new Set(parsed.collapsed.filter((id): id is string => typeof id === 'string'));
    }
    localStorage.removeItem(HOME_SECTIONS_STORAGE_KEY);
  } catch {
    // ignore storage errors (private mode etc.)
  }
  return null;
}

/** Writes the layout only if consent exists (key already present). Never creates the key. */
function persist(collapsed: Set<string>): void {
  if (readPersisted() === null) return;
  try {
    const state: HomeSectionsState = { v: 1, collapsed: Array.from(collapsed) };
    localStorage.setItem(HOME_SECTIONS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

interface SectionEntry {
  id: string;
  section: HTMLElement;
  wrappers: HTMLElement[];
  /** All toggles of the section (e.g. hero: heading-row toggle + collapsed title-bar toggle). */
  buttons: HTMLButtonElement[];
  pills: HTMLElement[];
  collection: string | null;
  label: string;
}

const entries = new Map<string, SectionEntry>();
const collapsedIds = new Set<string>();
let unreadCounts: Record<string, number> | null = null;
/** In-memory only: consent prompt already answered ("Just this time") during this page view. */
let promptDismissed = false;

function createWrapper(bodyId: string | null): { wrapper: HTMLElement; inner: HTMLElement } {
  const wrapper = document.createElement('div');
  wrapper.className = 'section-collapse';
  if (bodyId) {
    wrapper.id = bodyId;
    wrapper.setAttribute('role', 'region');
  }
  wrapper.dataset.state = 'open';
  const inner = document.createElement('div');
  inner.className = 'section-collapse-inner';
  wrapper.appendChild(inner);
  return { wrapper, inner };
}

/**
 * Wraps everything after the header into collapsible bodies: the header's following siblings,
 * plus (for full-bleed content such as the gallery) the non-decorative siblings of the header's
 * top-level container inside the section.
 */
function buildWrappers(section: HTMLElement, bodyId: string): HTMLElement[] {
  const header = section.querySelector<HTMLElement>('.section-header');
  const parent = header?.parentElement;
  if (!header || !parent) return [];
  const wrappers: HTMLElement[] = [];

  const first = createWrapper(bodyId);
  let node = header.nextSibling;
  while (node) {
    const next: ChildNode | null = node.nextSibling;
    first.inner.appendChild(node);
    node = next;
  }
  parent.appendChild(first.wrapper);
  wrappers.push(first.wrapper);

  let top: HTMLElement = header;
  while (top.parentElement && top.parentElement !== section) top = top.parentElement;
  const extra = Array.from(section.children).filter(
    (el): el is HTMLElement =>
      el instanceof HTMLElement &&
      el !== top &&
      !el.classList.contains('absolute') &&
      !(top.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING)
  );
  if (top !== section && extra.length > 0) {
    const second = createWrapper(first.inner.childNodes.length === 0 ? bodyId : null);
    extra.forEach((el) => second.inner.appendChild(el));
    section.appendChild(second.wrapper);
    wrappers.push(second.wrapper);
  }
  if (first.inner.childNodes.length === 0 && wrappers.length > 1) {
    first.wrapper.remove();
    wrappers.shift();
  }
  return wrappers;
}

function updateButtonLabel(entry: SectionEntry): void {
  const isOpen = !collapsedIds.has(entry.id);
  const count = entry.collection && unreadCounts ? unreadCounts[entry.collection] ?? 0 : 0;
  let text = `${isOpen ? 'Collapse' : 'Expand'} section ${entry.label}`;
  if (!isOpen && count > 0 && entry.collection) {
    text += `, ${count} new ${COLLECTION_NOUNS[entry.collection] ?? 'items'} since your last visit`;
  }
  entry.buttons.forEach((button) => {
    button.setAttribute('aria-label', text);
    button.title = text;
  });
  entry.pills.forEach((pill) => pill.classList.toggle('hidden', isOpen || count === 0));
}

/** Publishes the collapsed ids for other modules (e.g. the gallery pauses while collapsed). */
function publishState(changedId: string | null): void {
  document.documentElement.dataset.collapsedSections = Array.from(collapsedIds).join(' ');
  window.dispatchEvent(new CustomEvent('gh-section-collapse-change', { detail: { id: changedId } }));
}

function applyState(entry: SectionEntry, animate: boolean): void {
  const isOpen = !collapsedIds.has(entry.id);
  entry.section.classList.toggle('is-collapsed', !isOpen);
  entry.buttons.forEach((button) => button.setAttribute('aria-expanded', String(isOpen)));
  entry.wrappers.forEach((wrapper) => {
    wrapper.toggleAttribute('inert', !isOpen);
    if (animate) {
      wrapper.dataset.animating = 'true';
      window.setTimeout(() => {
        delete wrapper.dataset.animating;
      }, ANIMATION_MS);
    }
    wrapper.dataset.state = isOpen ? 'open' : 'closed';
  });
  updateButtonLabel(entry);
}

function setOpen(id: string, open: boolean, options: { animate: boolean; persist: boolean }): void {
  const entry = entries.get(id);
  if (!entry) return;
  if (open) collapsedIds.delete(id);
  else collapsedIds.add(id);
  applyState(entry, options.animate);
  if (options.persist) persist(collapsedIds);
  publishState(id);
  // Header CTA shortening depends on available row width
  window.dispatchEvent(new Event('resize'));
}

// ---------------------------------------------------------------------------
// Consent prompt (non-blocking, nothing is stored before an explicit choice)
// ---------------------------------------------------------------------------
const PROMPT_ID = 'home-layout-consent';
let promptAnchor: HTMLElement | null = null;

function getPrompt(): HTMLElement | null {
  return document.getElementById(PROMPT_ID);
}

function positionPrompt(): void {
  const prompt = getPrompt();
  if (!prompt || prompt.classList.contains('hidden')) return;
  if (!promptAnchor || window.innerWidth < 640) {
    // Mobile: bottom snackbar via CSS classes
    prompt.style.top = '';
    prompt.style.left = '';
    return;
  }
  const rect = promptAnchor.getBoundingClientRect();
  const left = Math.min(Math.max(8, rect.right - prompt.offsetWidth), window.innerWidth - prompt.offsetWidth - 8);
  const top = Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - prompt.offsetHeight - 8));
  prompt.style.left = `${left}px`;
  prompt.style.top = `${top}px`;
}

function showPrompt(anchor: HTMLElement): void {
  const prompt = getPrompt();
  if (!prompt || promptDismissed || readPersisted() !== null) return;
  promptAnchor = anchor;
  prompt.classList.remove('hidden');
  positionPrompt();
  prompt.focus({ preventScroll: true });
  window.addEventListener('scroll', positionPrompt, { passive: true });
  window.addEventListener('resize', positionPrompt);
}

function hidePrompt(returnFocus: boolean): void {
  const prompt = getPrompt();
  if (!prompt || prompt.classList.contains('hidden')) return;
  prompt.classList.add('hidden');
  window.removeEventListener('scroll', positionPrompt);
  window.removeEventListener('resize', positionPrompt);
  if (returnFocus) promptAnchor?.focus({ preventScroll: true });
  promptAnchor = null;
}

/** "Remember": identical grant to the Privacy-modal toggle (writes the key, then notifies listeners). */
function grantConsentFromPrompt(): void {
  try {
    const state: HomeSectionsState = { v: 1, collapsed: Array.from(collapsedIds) };
    localStorage.setItem(HOME_SECTIONS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent('gh-home-layout-toggle', { detail: { enabled: true } }));
}

document.addEventListener('click', (event) => {
  const action = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-home-layout-action]');
  if (!action || !getPrompt()?.contains(action)) return;
  const kind = action.dataset.homeLayoutAction;
  if (kind === 'remember') {
    grantConsentFromPrompt();
    hidePrompt(true);
  } else if (kind === 'decline') {
    // Decision kept in memory only (persisting a refusal would itself require storage)
    promptDismissed = true;
    hidePrompt(true);
  } else if (kind === 'settings') {
    promptDismissed = true;
    hidePrompt(false);
  }
});

document.addEventListener('keydown', (event) => {
  const prompt = getPrompt();
  if (event.key === 'Escape' && prompt && !prompt.classList.contains('hidden')) {
    promptDismissed = true;
    hidePrompt(true);
  }
});

/** Expands the section that contains the element targeted by the URL hash (not persisted). */
function revealHashTarget(scroll: boolean): void {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  if (!hash) return;
  revealElementById(hash, scroll);
}

function revealElementById(elementId: string, scroll: boolean): void {
  const target = document.getElementById(elementId);
  if (!target) return;
  const sectionEl = target.closest<HTMLElement>('section[data-collapsible]');
  if (!sectionEl || !collapsedIds.has(sectionEl.id)) return;
  setOpen(sectionEl.id, true, { animate: false, persist: false });
  if (scroll) target.scrollIntoView();
}

function refreshPills(): void {
  unreadCounts = readUnreadCounts();
  entries.forEach(updateButtonLabel);
  window.dispatchEvent(new Event('resize'));
}

function initSection(section: HTMLElement): void {
  const id = section.id;
  if (!id || entries.has(id)) return;
  const buttons = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-section-toggle]'));
  const button = buttons[0];
  if (!button) return;
  const wrappers = buildWrappers(section, `${id}-body`);
  if (wrappers.length === 0) return;

  const entry: SectionEntry = {
    id,
    section,
    wrappers,
    buttons,
    pills: Array.from(section.querySelectorAll<HTMLElement>('[data-section-pill]')),
    collection: button.dataset.collection || null,
    label: button.dataset.label || id
  };
  entries.set(id, entry);
  wrappers[0].setAttribute('aria-label', entry.label);
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setOpen(id, collapsedIds.has(id), { animate: true, persist: true });
      showPrompt(btn);
    });
  });
}

export function initSectionCollapse(): void {
  const sections = document.querySelectorAll<HTMLElement>('section[data-collapsible]');
  if (sections.length === 0) return;

  const persisted = readPersisted();
  unreadCounts = readUnreadCounts();
  collapsedIds.clear();
  persisted?.forEach((id) => collapsedIds.add(id));

  sections.forEach(initSection);
  entries.forEach((entry) => applyState(entry, false));
  publishState(null);


  // Remove the pre-paint boot style: the real state is now applied via classes.
  document.getElementById('section-collapse-boot')?.remove();

  revealHashTarget(true);
}

// Anchor links (navbar, in-page) must auto-expand their target section synchronously, before the browser scrolls.
document.addEventListener(
  'click',
  (event) => {
    const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href*="#"]');
    if (!link) return;
    const url = new URL(link.href, window.location.href);
    if (url.pathname.replace(/\/$/, '') !== window.location.pathname.replace(/\/$/, '') || !url.hash) return;
    revealElementById(decodeURIComponent(url.hash.slice(1)), false);
  },
  true
);
window.addEventListener('hashchange', () => revealHashTarget(true));

// Opt-in changes from the Privacy modal
window.addEventListener('gh-home-layout-toggle', (event) => {
  const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
  if (detail?.enabled) persist(collapsedIds);
  hidePrompt(false);
});

// Read-state changes (opt-in toggle, mark all read, manifest refresh)
window.addEventListener('gh-notifications-toggle', refreshPills);
window.addEventListener('gh-unread-updated', refreshPills);

initSectionCollapse();
document.addEventListener('astro:page-load', () => {
  entries.forEach((entry, key) => {
    if (!entry.section.isConnected) entries.delete(key);
  });
  initSectionCollapse();
});
