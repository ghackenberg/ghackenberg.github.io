/**
 * Remark plugin for strict early validation of Markdown image references.
 * Enforces that every markdown image reference has:
 *  1. An explicit, non-empty caption/description (alt text)
 *  2. An explicit, non-empty title attribute in quotes: ![alt](url "title")
 *  3. Distinct title and description (zero-fallback, no duplicates)
 */

export default function remarkValidateImages() {
  /**
   * @param {any} tree
   * @param {any} file
   */
  return function transformer(tree, file) {
    const filePath = file?.path || file?.history?.[0] || 'Unknown Markdown File';

    function visit(node) {
      if (node.type === 'image') {
        const alt = typeof node.alt === 'string' ? node.alt.trim() : '';
        const title = typeof node.title === 'string' ? node.title.trim() : '';
        const url = node.url || '';
        const line = node.position?.start?.line ?? '?';
        const col = node.position?.start?.column ?? '?';

        const issues = [];
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
        node.data = node.data || {};
        node.data.hProperties = node.data.hProperties || {};
        node.data.hProperties.title = title;
        node.data.hProperties.alt = alt;
      }

      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          visit(child);
        }
      }
    }

    visit(tree);
  };
}
