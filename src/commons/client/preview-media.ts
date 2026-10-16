/**
 * Client-side companion of `PreviewMediaBoot.astro`.
 *
 * The actual load-state logic lives in the inline head script (so it runs before first paint).
 * This module only
 *   - exposes `armMediaHost` for dynamic changes (e.g. recycled gallery cards), and
 *   - arms hosts that the boot script has not seen (safety net, e.g. when the boot script is absent).
 */

declare global {
  interface Window {
    armMediaHost?: (host: Element, force?: boolean) => void;
  }
}

const MEDIA_SELECTOR = [
  '.preview-card img',
  '.preview-card svg image',
  '[data-media-host] img',
  '[data-media-host] svg image'
].join(', ');
const HOST_SELECTOR = '[data-media-host], .aspect-video';

/** (Re-)arms the load indicator for a host, e.g. after its image `src` has changed. */
export function armMediaHost(host: Element) {
  window.armMediaHost?.(host, true);
}

function init() {
  document.querySelectorAll(MEDIA_SELECTOR).forEach((media) => {
    const host = media.closest(HOST_SELECTOR);
    if (host) {
      window.armMediaHost?.(host, false);
    }
  });
}

init();
