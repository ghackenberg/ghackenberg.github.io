import type { Root, Element, ElementContent, RootContent } from 'hast';

type HastNode = Root | RootContent | ElementContent;
type HastParent = Root | Element;

/**
 * Rehype plugin to wrap all <table> elements in a responsive scroll container.
 * This guarantees smooth horizontal scrolling on mobile viewports without breaking page layouts.
 */
export default function rehypeResponsiveTables() {
  return function (tree: Root) {
    function visit(node: HastNode, index?: number, parent?: HastParent) {
      if (!node || typeof node !== 'object') return;

      if (node.type === 'element' && node.tagName === 'table' && parent && typeof index === 'number') {
        // Prevent double wrapping
        if (parent.type === 'element') {
          const parentClass = parent.properties?.className;
          const classStr = Array.isArray(parentClass) ? parentClass.join(' ') : String(parentClass || '');
          if (classStr.includes('responsive-table-wrapper')) {
            return;
          }
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

      if ('children' in node && Array.isArray(node.children)) {
        for (let i = 0; i < node.children.length; i++) {
          visit(node.children[i], i, node as HastParent);
        }
      }
    }

    visit(tree);
  };
}
