import type { Root, Element, ElementContent, RootContent } from 'hast';
import type { VFile } from 'vfile';

type HastNode = Root | RootContent | ElementContent;
type HastParent = Root | Element;

interface TableCaptionVFileData {
  tableCaptions?: string[];
}

function extractPlainText(node: HastNode): string {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'text') {
    return node.value || '';
  }
  if ('children' in node && Array.isArray(node.children)) {
    return node.children.map((child) => extractPlainText(child)).join('');
  }
  return '';
}

function createButtonElement(
  label: string,
  ariaLabel: string,
  className: string,
  extraProps: Record<string, string> = {}
): Element {
  return {
    type: 'element',
    tagName: 'button',
    properties: {
      type: 'button',
      className: [className],
      'aria-label': ariaLabel,
      title: ariaLabel,
      ...extraProps,
    },
    children: [{ type: 'text', value: label }],
  };
}

function enrichTableElement(tableNode: Element): string[] {
  const headers: string[] = [];

  for (const child of tableNode.children) {
    if (child.type !== 'element') continue;

    if (child.tagName === 'thead') {
      for (const row of child.children) {
        if (row.type === 'element' && row.tagName === 'tr') {
          let colIdx = 0;
          for (const cell of row.children) {
            if (cell.type === 'element' && (cell.tagName === 'th' || cell.tagName === 'td')) {
              const label = extractPlainText(cell).replace(/\s+/g, ' ').trim();
              headers[colIdx] = label;
              cell.properties = cell.properties || {};
              cell.properties['data-col-index'] = String(colIdx);
              cell.properties['data-sortable'] = 'true';
              cell.properties.tabIndex = 0;
              cell.properties.role = 'button';
              cell.properties['aria-sort'] = 'none';

              const hasSortIcon = cell.children.some(
                (c) =>
                  c.type === 'element' &&
                  Array.isArray(c.properties?.className) &&
                  c.properties.className.includes('table-sort-icon')
              );
              if (!hasSortIcon) {
                cell.children.push({
                  type: 'element',
                  tagName: 'span',
                  properties: {
                    className: ['table-sort-icon'],
                    'aria-hidden': 'true',
                  },
                  children: [{ type: 'text', value: '↕' }],
                });
              }

              colIdx++;
            }
          }
        }
      }
    }
  }

  for (const child of tableNode.children) {
    if (child.type !== 'element') continue;

    if (child.tagName === 'tbody') {
      for (const row of child.children) {
        if (row.type === 'element' && row.tagName === 'tr') {
          let colIdx = 0;
          for (const cell of row.children) {
            if (cell.type === 'element' && (cell.tagName === 'td' || cell.tagName === 'th')) {
              cell.properties = cell.properties || {};
              cell.properties['data-label'] = headers[colIdx] || '';
              cell.properties['data-col-index'] = String(colIdx);
              colIdx++;
            }
          }
        }
      }
    } else if (child.tagName === 'tr') {
      let colIdx = 0;
      for (const cell of child.children) {
        if (cell.type === 'element' && (cell.tagName === 'td' || cell.tagName === 'th')) {
          cell.properties = cell.properties || {};
          cell.properties['data-label'] = headers[colIdx] || '';
          cell.properties['data-col-index'] = String(colIdx);
          colIdx++;
        }
      }
    }
  }

  return headers.filter(Boolean);
}

/**
 * Rehype plugin to enrich all <table> elements with column data-labels, build-time sort icons,
 * and wrap them in the unified 3-band `figure.table-figure.artifact-card.responsive-table-wrapper`:
 * 1. `.artifact-card-header` (`Table` badge + view toggle buttons + scroll buttons + fullscreen button)
 * 2. `.artifact-card-body.responsive-table-scroll` (scrollable / container-query table)
 * 3. `figcaption.artifact-card-footer` (caption)
 */
export default function rehypeResponsiveTables() {
  return function (tree: Root, file?: VFile) {
    const filePath = (file?.path || file?.history?.[0] || '').replace(/\\/g, '/');
    if (filePath.includes('/src/content/presentations/')) {
      return;
    }
    const fileData = file?.data as TableCaptionVFileData | undefined;
    const tableCaptions: string[] = Array.isArray(fileData?.tableCaptions)
      ? fileData.tableCaptions
      : [];

    let tableIndex = 0;

    function visit(node: HastNode, index?: number, parent?: HastParent) {
      if (!node || typeof node !== 'object') return;

      if (node.type === 'element' && node.tagName === 'table' && parent && typeof index === 'number') {
        if (parent.type === 'element') {
          const parentClass = parent.properties?.className;
          const classStr = Array.isArray(parentClass) ? parentClass.join(' ') : String(parentClass || '');
          if (
            classStr.includes('responsive-table-wrapper') ||
            classStr.includes('responsive-table-scroll') ||
            classStr.includes('artifact-card-body') ||
            classStr.includes('table-figure')
          ) {
            return;
          }
        }

        const headers = enrichTableElement(node);
        const propCaption = String(node.properties?.['data-table-caption'] || '').trim();
        const fileCaption = (tableCaptions[tableIndex] || '').trim();
        tableIndex++;
        const captionText = propCaption || fileCaption;

        const ariaLabel =
          captionText || (headers.length > 0 ? `Table: ${headers.slice(0, 3).join(', ')}` : 'Data table');

        const headerNode: Element = {
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['artifact-card-header'],
          },
          children: [
            {
              type: 'element',
              tagName: 'span',
              properties: { className: ['artifact-card-badge'] },
              children: [{ type: 'text', value: 'Table' }],
            },
            {
              type: 'element',
              tagName: 'div',
              properties: { className: ['artifact-card-controls'] },
              children: [
                createButtonElement('▤ Cards', 'Switch to stacked cards view', 'table-deck-btn', {
                  'data-table-view-btn': 'cards',
                }),
                createButtonElement('⊞ Table', 'Switch to scrollable table view', 'table-deck-btn', {
                  'data-table-view-btn': 'grid',
                }),
                createButtonElement('‹', 'Scroll table left', 'table-deck-btn', {
                  'data-table-scroll': 'left',
                }),
                createButtonElement('›', 'Scroll table right', 'table-deck-btn', {
                  'data-table-scroll': 'right',
                }),
                createButtonElement(
                  '⤢',
                  captionText ? `Open fullscreen view: ${captionText}` : 'Open table in fullscreen',
                  'table-deck-btn',
                  {
                    'data-media-fullscreen': 'true',
                  }
                ),
              ],
            },
          ],
        };

        const bodyNode: Element = {
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['artifact-card-body', 'responsive-table-scroll'],
          },
          children: [node as ElementContent],
        };

        const figureChildren: ElementContent[] = [headerNode, bodyNode];
        if (captionText) {
          figureChildren.push({
            type: 'element',
            tagName: 'figcaption',
            properties: {
              className: ['artifact-card-footer'],
            },
            children: [
              {
                type: 'text',
                value: captionText,
              },
            ],
          });
        }

        const figureNode: Element = {
          type: 'element',
          tagName: 'figure',
          properties: {
            className: ['table-figure', 'artifact-card', 'responsive-table-wrapper', 'my-8'],
            tabIndex: 0,
            role: 'region',
            'aria-label': ariaLabel,
            ...(captionText ? { 'data-table-caption': captionText } : {}),
          },
          children: figureChildren,
        };

        parent.children[index] = figureNode;
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
