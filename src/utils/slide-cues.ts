/**
 * Utility functions for rendering slide cues inline
 */

/**
 * Transforms {cue:id}text{/cue} into <mark> tags,
 * and standalone {cue:id} into <span class="cue-target"> tags.
 */
export function renderSlideCues(text: string | undefined | null): string {
  if (!text) return '';

  // 1. Matched span highlights: {cue:id}text{/cue}
  let result = text.replace(
    /\{cue:([a-zA-Z0-9_-]+)\}([\s\S]*?)\{\/cue(?::[a-zA-Z0-9_-]+)?\}/g,
    (_, cueId, content) => {
      return `<mark id="${cueId}" data-cue="${cueId}" class="highlight-marker font-semibold rounded-[0.38em]">${content}</mark>`;
    }
  );

  // 2. Standalone cue anchor triggers: {cue:id}
  result = result.replace(
    /\{cue:([a-zA-Z0-9_-]+)\}/g,
    (_, cueId) => {
      return `<span id="${cueId}" data-cue="${cueId}" class="cue-target"></span>`;
    }
  );

  return result;
}
