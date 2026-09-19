// @ts-check

/**
 * Remark plugin to transform slide cues ({cue:id}text{/cue}) into interactive highlight marks (<mark>).
 * Supports:
 *   - Paired highlight sweeps: {cue:id}marked text{/cue} or {cue:id:color}marked text{/cue}
 *   - Standalone trigger points: {cue:id} or {cue:id:color}
 */
export default function remarkSlideCues() {
  /**
   * @param {any} tree
   */
  return function transformer(tree) {
    const CUE_REGEX = /\{cue:([a-zA-Z0-9_-]+)(?::([a-zA-Z0-9_-]+))?\}([\s\S]*?)\{\/cue(?::[a-zA-Z0-9_-]+)?\}|\{cue:([a-zA-Z0-9_-]+)(?::([a-zA-Z0-9_-]+))?\}/g;

    /**
     * @param {string} text
     * @returns {any[]}
     */
    function splitTextToNodes(text) {
      const nodes = [];
      let lastIndex = 0;
      let match;
      CUE_REGEX.lastIndex = 0;

      while ((match = CUE_REGEX.exec(text)) !== null) {
        if (match.index > lastIndex) {
          nodes.push({
            type: 'text',
            value: text.slice(lastIndex, match.index)
          });
        }

        if (match[3] !== undefined) {
          // Paired cue: {cue:id:color}content{/cue}
          const cueId = match[1];
          const color = match[2];
          const content = match[3];
          const colorAttr = color ? ` data-color="${color}"` : '';
          nodes.push({
            type: 'html',
            value: `<mark id="${cueId}" data-cue="${cueId}"${colorAttr} class="highlight-marker font-semibold rounded-md">${content}</mark>`
          });
        } else {
          // Standalone cue: {cue:id:color}
          const cueId = match[4];
          const color = match[5];
          const colorAttr = color ? ` data-color="${color}"` : '';
          nodes.push({
            type: 'html',
            value: `<span id="${cueId}" data-cue="${cueId}"${colorAttr} class="cue-target"></span>`
          });
        }

        lastIndex = CUE_REGEX.lastIndex;
      }

      if (lastIndex < text.length) {
        nodes.push({
          type: 'text',
          value: text.slice(lastIndex)
        });
      }

      return nodes;
    }

    /**
     * @param {any} node
     */
    function visit(node) {
      if (!node) return;

      if (Array.isArray(node.children)) {
        const newChildren = [];
        for (const child of node.children) {
          if (child.type === 'text' && typeof child.value === 'string' && child.value.includes('{cue:')) {
            const split = splitTextToNodes(child.value);
            newChildren.push(...split);
          } else {
            newChildren.push(child);
            visit(child);
          }
        }
        node.children = newChildren;
      }
    }

    visit(tree);
  };
}
