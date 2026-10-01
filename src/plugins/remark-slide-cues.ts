import type { Root, Text, Html } from 'mdast';
import type { Node, Parent } from 'unist';

/**
 * Remark plugin to transform slide cues ({cue:id}text{/cue}) into interactive highlight marks (<mark>).
 * Supports:
 *   - Paired highlight sweeps: {cue:id}marked text{/cue}
 *   - Standalone trigger points: {cue:id}
 */
export default function remarkSlideCues() {
  return function transformer(tree: Root) {
    const CUE_REGEX = /\{cue:([a-zA-Z0-9_-]+)\}([\s\S]*?)\{\/cue(?::[a-zA-Z0-9_-]+)?\}|\{cue:([a-zA-Z0-9_-]+)\}/g;

    function splitTextToNodes(text: string): (Text | Html)[] {
      const nodes: (Text | Html)[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      CUE_REGEX.lastIndex = 0;

      while ((match = CUE_REGEX.exec(text)) !== null) {
        if (match.index > lastIndex) {
          nodes.push({
            type: 'text',
            value: text.slice(lastIndex, match.index),
          });
        }

        if (match[1] !== undefined && match[2] !== undefined) {
          // Paired cue: {cue:id}content{/cue}
          const cueId = match[1];
          const content = match[2];
          nodes.push({
            type: 'html',
            value: `<mark id="${cueId}" data-cue="${cueId}" class="highlight-marker font-semibold rounded-[0.38em]">${content}</mark>`,
          });
        } else if (match[3] !== undefined) {
          // Standalone cue: {cue:id}
          const cueId = match[3];
          nodes.push({
            type: 'html',
            value: `<span id="${cueId}" data-cue="${cueId}" class="cue-target"></span>`,
          });
        }

        lastIndex = CUE_REGEX.lastIndex;
      }

      if (lastIndex < text.length) {
        nodes.push({
          type: 'text',
          value: text.slice(lastIndex),
        });
      }

      return nodes;
    }

    function visit(node: Node) {
      if (!node) return;

      if ('children' in node && Array.isArray((node as Parent).children)) {
        const parent = node as Parent;
        const newChildren: Node[] = [];
        for (const child of parent.children) {
          if (child.type === 'text' && typeof (child as Text).value === 'string' && (child as Text).value.includes('{cue:')) {
            const split = splitTextToNodes((child as Text).value);
            newChildren.push(...split);
          } else {
            newChildren.push(child);
            visit(child);
          }
        }
        parent.children = newChildren;
      }
    }

    visit(tree);
  };
}
