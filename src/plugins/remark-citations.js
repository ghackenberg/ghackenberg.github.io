// @ts-check
import { generateCitationLabel } from '../utils/citations.js';

/**
 * Remark plugin to transform [@id] in Markdown AST into clickable citation links.
 * In blog posts: <a href="#ref-id" class="citation ...">[Label]</a>
 * In slides: <button type="button" data-ref-id="id" class="slide-citation-badge ...">[Label]</button>
 */
export default function remarkCitations() {
  /**
   * @param {any} tree
   * @param {any} file
   */
  return function transformer(tree, file) {
    const CITE_REGEX = /\[@([a-zA-Z0-9_\-]+)\]/g;
    const frontmatter = file?.data?.astro?.frontmatter || {};
    const references = Array.isArray(frontmatter.references) ? frontmatter.references : [];
    const filePath = file?.history?.[0] || '';
    const isSlide = filePath.includes('presentations') || filePath.endsWith('.mdx');

    /**
     * @param {string} text
     * @returns {any[]}
     */
    function splitTextToNodes(text) {
      const nodes = [];
      let lastIndex = 0;
      let match;
      CITE_REGEX.lastIndex = 0;

      while ((match = CITE_REGEX.exec(text)) !== null) {
        if (match.index > lastIndex) {
          nodes.push({
            type: 'text',
            value: text.slice(lastIndex, match.index)
          });
        }

        const refId = match[1];
        const ref = references.find((/** @type {{ id?: string }} */ r) => r.id === refId) || { id: refId };
        const label = generateCitationLabel(ref);

        if (isSlide) {
          nodes.push({
            type: 'html',
            value: `<button type="button" data-open-reference="${refId}" class="slide-citation-badge inline-flex items-center font-mono text-purple-400 light:text-purple-700 hover:text-purple-300 font-bold align-baseline px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 cursor-pointer transition-colors" title="Referenz ansehen: ${label}">[${label}]</button>`
          });
        } else {
          nodes.push({
            type: 'html',
            value: `<a href="#ref-${refId}" class="citation" title="Quelle [${label}] anzeigen">[${label}]</a>`
          });
        }

        lastIndex = CITE_REGEX.lastIndex;
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
          if (child.type === 'text' && typeof child.value === 'string' && child.value.includes('[@')) {
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
