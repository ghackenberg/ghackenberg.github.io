import type { Root, Element, ElementContent } from 'hast';

/**
 * Rehype plugin to wrap all <table> elements in a responsive scroll container.
 * This guarantees smooth horizontal scrolling on mobile viewports without breaking page layouts.
 */
export default function rehypeResponsiveTables() {
  return function (tree: Root) {
    function visit(node: any, index?: number, parent?: any) {
      if (!node || typeof node !== 'object') return;

      if (node.type === 'element' && node.tagName === 'table' && parent && typeof index === 'number') {
        // Prevent double wrapping
        const parentClass = parent.properties?.className;
        const hasClass = Array.isArray(parentClass)
          ? parentClass.includes('responsive-table-wrapper')
          : typeof parentClass === 'string' && parentClass.includes('responsive-table-wrapper');

        if (parent.type === 'element' && hasClass) {
          return;
        }

        const wrapperNode: Element = {
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['responsive-table-wrapper'],
          },
          children: [node as ElementContent],
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
