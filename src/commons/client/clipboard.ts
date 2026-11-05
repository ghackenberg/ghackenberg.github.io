const IDLE_CANDIDATE_CLASSES = [
  'bg-element-bg',
  'text-gray-200',
  'text-gray-300',
  'border-element-border-medium',
] as const;

const ACTIVE_FEEDBACK_CLASSES = [
  'bg-brand-primary/20',
  'text-brand-primary',
  'border-brand-primary/30',
  'border-brand-primary/40',
] as const;

interface ButtonFeedbackState {
  timerId: number;
  originalText: string;
  removedIdleClasses: string[];
}

const activeTimers = new WeakMap<HTMLElement, ButtonFeedbackState>();
let lifecycleListenersRegistered = false;

function resolveCopyText(button: HTMLElement): string {
  const targetSelector = button.getAttribute('data-copy-target');
  if (targetSelector) {
    const targetEl = document.querySelector<HTMLElement>(targetSelector);
    const targetText = targetEl?.textContent?.trim();
    if (targetText) return targetText;
  }

  return (
    button.getAttribute('data-copy-text') ||
    button.getAttribute('data-copy-email') ||
    ''
  ).trim();
}

function bindClipboardButtons(): void {
  const buttons = document.querySelectorAll<HTMLElement>(
    '[data-copy-text], [data-copy-target], [data-copy-email]'
  );

  buttons.forEach((btn) => {
    if (btn.dataset.clipboardInitialized === 'true') return;
    btn.dataset.clipboardInitialized = 'true';

    btn.addEventListener('click', () => {
      const text = resolveCopyText(btn);
      if (!text) return;

      const labelEl =
        btn.querySelector<HTMLElement>('[data-copy-label]') ||
        btn.querySelector<HTMLElement>('.copy-email-text') ||
        btn;

      const feedbackText = btn.getAttribute('data-copy-feedback') || 'Copied!';
      const durationMs = parseInt(btn.getAttribute('data-copy-duration') || '2500', 10);

      navigator.clipboard
        .writeText(text)
        .then(() => {
          const existing = activeTimers.get(btn);
          const originalText = existing
            ? existing.originalText
            : labelEl.textContent || '';
          const removedIdleClasses = existing
            ? existing.removedIdleClasses
            : IDLE_CANDIDATE_CLASSES.filter((cls) => btn.classList.contains(cls));

          if (existing) {
            window.clearTimeout(existing.timerId);
          } else {
            removedIdleClasses.forEach((cls) => btn.classList.remove(cls));
            btn.classList.add(
              'bg-brand-primary/20',
              'text-brand-primary',
              'border-brand-primary/30'
            );
          }

          labelEl.textContent = feedbackText;

          const timerId = window.setTimeout(() => {
            labelEl.textContent = originalText;
            ACTIVE_FEEDBACK_CLASSES.forEach((cls) => btn.classList.remove(cls));
            removedIdleClasses.forEach((cls) => btn.classList.add(cls));
            activeTimers.delete(btn);
          }, durationMs);

          activeTimers.set(btn, {
            timerId,
            originalText,
            removedIdleClasses,
          });
        })
        .catch((err) => {
          console.error('Failed to copy text to clipboard:', err);
        });
    });
  });
}

export function initClipboard(): void {
  if (typeof document === 'undefined') return;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindClipboardButtons, { once: true });
  } else {
    bindClipboardButtons();
  }

  if (!lifecycleListenersRegistered) {
    lifecycleListenersRegistered = true;
    document.addEventListener('astro:page-load', bindClipboardButtons);
  }
}
