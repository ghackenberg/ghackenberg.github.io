/**
 * Rehype plugin to wrap all <table> elements in a responsive scroll container.
 * This guarantees smooth horizontal scrolling on mobile viewports without breaking page layouts.
 */
export default function rehypeResponsiveTables() {
  /**
   * @param {any} tree
   */
  return function (tree) {
    /**
     * @param {any} node
     * @param {number} [index]
     * @param {any} [parent]
     */
    function visit(node, index, parent) {
      if (!node || typeof node !== 'object') return;

      if (node.type === 'element' && node.tagName === 'table' && parent && typeof index === 'number') {
        // Prevent double wrapping
        if (parent.type === 'element' && parent.properties?.className?.includes('responsive-table-wrapper')) {
          return;
        }

        const wrapperNode = {
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['responsive-table-wrapper'],
          },
          children: [node],
        };

        parent.children[index] = wrapperNode;
        return;
      }

      if (Array.isArray(node.children)) {
        for (let i = 0; i < node.children.length; i++) {
          visit(node.children[i], i, node);
        }
      }
    }

    visit(tree);
  };
}
