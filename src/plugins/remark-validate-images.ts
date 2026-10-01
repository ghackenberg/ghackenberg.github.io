import type { Root, Image } from 'mdast';
import type { VFile } from 'vfile';
import type { Node, Parent } from 'unist';

interface ImageDataWithHProperties {
  hProperties?: Record<string, string>;
  [key: string]: string | number | boolean | Record<string, string> | undefined;
}

/**
 * Remark plugin for strict early validation of Markdown image references.
 * Enforces that every markdown image reference has:
 *  1. An explicit, non-empty caption/description (alt text)
 *  2. An explicit, non-empty title attribute in quotes: ![alt](url "title")
 *  3. Distinct title and description (zero-fallback, no duplicates)
 */
export default function remarkValidateImages() {
  return function transformer(tree: Root, file: VFile) {
    const filePath = file?.path || file?.history?.[0] || 'Unknown Markdown File';

    function visit(node: Node) {
      if (node.type === 'image') {
        const imgNode = node as Image;
        const alt = typeof imgNode.alt === 'string' ? imgNode.alt.trim() : '';
        const title = typeof imgNode.title === 'string' ? imgNode.title.trim() : '';
        const url = imgNode.url || '';
        const line = imgNode.position?.start?.line ?? '?';
        const col = imgNode.position?.start?.column ?? '?';

        const issues: string[] = [];
        if (!alt || alt.length < 3) {
          issues.push('Missing or too short description/caption in brackets: ![description](...) (min 3 chars)');
        }
        if (!title || title.length < 3) {
          issues.push('Missing or too short title in quotes: ![...](url "title") (min 3 chars)');
        }
        if (alt && title && alt.toLowerCase() === title.toLowerCase()) {
          issues.push('Description and title must be distinct (provide a concise title and a detailed descriptive caption).');
        }

        if (issues.length > 0) {
          const foundSnippet = alt && title 
            ? `![${alt}](${url} "${title}")`
            : alt 
            ? `![${alt}](${url})`
            : `![](${url})`;

          const errorMsg = [
            '================================================================================',
            '[MARKDOWN IMAGE VALIDATION ERROR]',
            `File:     ${filePath} (Line ${line}, Column ${col})`,
            `Image:    ${url}`,
            '',
            'Problems:',
            ...issues.map(i => `  [X] ${i}`),
            '',
            'Found Markdown:',
            `  ${foundSnippet}`,
            '',
            'How to Fix:',
            '  Specify BOTH a descriptive caption and an explicit, distinct title in quotes:',
            `  ![Detailed description of what is visible in the image](${url || './image.png'} "Concise Image Title")`,
            '================================================================================'
          ].join('\n');

          throw new Error(errorMsg);
        }

        // Ensure title attribute is propagated to HTML <img> properties
        const data = (imgNode.data = imgNode.data || {}) as ImageDataWithHProperties;
        const hProps = (data.hProperties = data.hProperties || {});
        hProps.title = title;
        hProps.alt = alt;
      }

      if ('children' in node && Array.isArray((node as Parent).children)) {
        for (const child of (node as Parent).children) {
          visit(child);
        }
      }
    }

    visit(tree);
  };
}
