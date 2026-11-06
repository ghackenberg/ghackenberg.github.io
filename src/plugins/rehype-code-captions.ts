import type { Root as MdastRoot, Code, Html } from 'mdast';
import type { Root as HastRoot, Element, ElementContent, RootContent } from 'hast';
import type { VFile } from 'vfile';
import type { Node, Parent } from 'unist';

export interface CodeBlockCaptionMeta {
  caption: string;
  title: string;
  lang: string;
}

export interface CaptionVFileData {
  codeBlockCaptions?: CodeBlockCaptionMeta[];
  tableCaptions?: string[];
}

type HastNode = HastRoot | RootContent | ElementContent;
type HastParent = HastRoot | Element;

const TABLE_CAPTION_COMMENT_REGEX = /^<!--\s*caption:\s*"([^"]+)"\s*-->$/i;

const LANG_DISPLAY_NAMES: Record<string, string> = {
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  js: 'JavaScript',
  javascript: 'JavaScript',
  jsx: 'JSX',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  html: 'HTML',
  xml: 'XML',
  svg: 'SVG',
  css: 'CSS',
  scss: 'SCSS',
  sql: 'SQL',
  py: 'Python',
  python: 'Python',
  sh: 'Shell',
  bash: 'Bash',
  powershell: 'PowerShell',
  ps1: 'PowerShell',
  md: 'Markdown',
  markdown: 'Markdown',
  mdx: 'MDX',
  astro: 'Astro',
  dockerfile: 'Dockerfile',
  rust: 'Rust',
  go: 'Go',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  graphql: 'GraphQL',
  text: 'Code',
  plaintext: 'Text',
};

function formatLangBadge(lang: string): string {
  const key = (lang || 'text').trim().toLowerCase();
  return LANG_DISPLAY_NAMES[key] || key.toUpperCase();
}

function parseCodeFenceMeta(meta: string, lang: string): CodeBlockCaptionMeta {
  const captionMatch = meta.match(/\bcaption="([^"]+)"/) || meta.match(/\bcaption='([^']+)'/);
  const titleMatch = meta.match(/\btitle="([^"]+)"/) || meta.match(/\btitle='([^']+)'/);
  const caption = captionMatch ? captionMatch[1].trim() : '';
  const title = titleMatch ? titleMatch[1].trim() : '';
  return {
    caption,
    title,
    lang: (lang || 'text').trim(),
  };
}

/**
 * Remark plugin that:
 * 1. Extracts `caption="..."` and optional `title="..."` metadata from fenced code blocks (`node.lang !== 'mermaid'`)
 *    and records them in order on `file.data.codeBlockCaptions`.
 * 2. Extracts `<!-- caption: "..." -->` HTML comments immediately preceding Markdown `table` nodes,
 *    attaches `data-table-caption` to the table node, records `file.data.tableCaptions`, and removes the comment node.
 */
export function remarkCodeCaptions() {
  return function (tree: MdastRoot, file: VFile) {
    const filePath = (file?.path || file?.history?.[0] || '').replace(/\\/g, '/');
    if (filePath.includes('/src/content/presentations/')) {
      return;
    }
    const captions: CodeBlockCaptionMeta[] = [];
    const tableCaptions: string[] = [];

    function visit(node: Node) {
      if (!node || typeof node !== 'object') return;

      if (node.type === 'code') {
        const codeNode = node as Code;
        const lang = (codeNode.lang || '').trim().toLowerCase();
        if (lang !== 'mermaid') {
          const meta = codeNode.meta || '';
          captions.push(parseCodeFenceMeta(meta, lang));
        }
        return;
      }

      if ('children' in node && Array.isArray((node as Parent).children)) {
        const children = (node as Parent).children;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child.type === 'table') {
            let foundCaption = '';
            if (i > 0 && children[i - 1].type === 'html') {
              const rawHtml = ((children[i - 1] as Html).value || '').trim();
              const match = rawHtml.match(TABLE_CAPTION_COMMENT_REGEX);
              if (match) {
                foundCaption = match[1].trim();
                children.splice(i - 1, 1);
                i--;
              }
            }
            const tableNode = children[i] as Node & {
              data?: { hProperties?: Record<string, string | number | boolean> };
            };
            if (foundCaption) {
              tableNode.data = tableNode.data || {};
              tableNode.data.hProperties = {
                ...(tableNode.data.hProperties || {}),
                'data-table-caption': foundCaption,
              };
            }
            tableCaptions.push(foundCaption);
          }
          visit(children[i]);
        }
      }
    }

    visit(tree);
    if (file && file.data) {
      const fileData = file.data as CaptionVFileData;
      fileData.codeBlockCaptions = captions;
      fileData.tableCaptions = tableCaptions;
    }
  };
}

function getStandaloneImageChild(pNode: Element): Element | null {
  let imgChild: Element | null = null;
  for (const child of pNode.children) {
    if (child.type === 'text') {
      if ((child.value || '').trim() !== '') {
        return null;
      }
      continue;
    }
    if (child.type === 'element' && child.tagName === 'img') {
      if (imgChild) return null; // more than one image in <p>
      imgChild = child;
      continue;
    }
    return null;
  }
  return imgChild;
}

/**
 * Rehype plugin that wraps both standalone Raster Images and non-Mermaid `<pre>` Code Snippets
 * in the unified 3-band `figure.artifact-card` design:
 * 1. `.artifact-card-header` (left `.artifact-card-badge` + right `.artifact-card-controls`)
 * 2. `.artifact-card-body` (content)
 * 3. `figcaption.artifact-card-footer` (caption)
 */
export default function rehypeCodeCaptions() {
  return function (tree: HastRoot, file: VFile) {
    const filePath = (file?.path || file?.history?.[0] || '').replace(/\\/g, '/');
    if (filePath.includes('/src/content/presentations/')) {
      return;
    }
    const fileData = file?.data as CaptionVFileData | undefined;
    const captions: CodeBlockCaptionMeta[] = Array.isArray(fileData?.codeBlockCaptions)
      ? fileData.codeBlockCaptions
      : [];

    let preIndex = 0;

    function visit(node: HastNode, index?: number, parent?: HastParent) {
      if (!node || typeof node !== 'object') return;

      // 1. Standalone Raster Image inside <p><img ...></p>
      if (node.type === 'element' && node.tagName === 'p' && parent && typeof index === 'number') {
        const imgEl = getStandaloneImageChild(node);
        if (imgEl) {
          const src = String(imgEl.properties?.src || '');
          const cleanSrc = src.split('?')[0].split('#')[0].toLowerCase();
          if (!cleanSrc.endsWith('.svg')) {
            const altText = String(imgEl.properties?.alt || '').trim();
            const titleText = String(imgEl.properties?.title || altText || '').trim();
            const captionText = altText || titleText;

            const headerBar: Element = {
              type: 'element',
              tagName: 'div',
              properties: { className: ['artifact-card-header'] },
              children: [
                {
                  type: 'element',
                  tagName: 'span',
                  properties: { className: ['artifact-card-badge'] },
                  children: [{ type: 'text', value: 'Image' }],
                },
                {
                  type: 'element',
                  tagName: 'div',
                  properties: { className: ['artifact-card-controls'] },
                  children: [
                    {
                      type: 'element',
                      tagName: 'button',
                      properties: {
                        type: 'button',
                        className: ['table-deck-btn'],
                        'data-media-fullscreen': 'true',
                        'aria-label': `Open fullscreen image: ${titleText || captionText || 'Image'}`,
                        title: 'Fullscreen',
                      },
                      children: [{ type: 'text', value: '⤢' }],
                    },
                  ],
                },
              ],
            };

            const bodyContainer: Element = {
              type: 'element',
              tagName: 'div',
              properties: { className: ['artifact-card-body'] },
              children: [imgEl],
            };

            const figureChildren: ElementContent[] = [headerBar, bodyContainer];
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
                className: ['image-figure', 'image-deck-wrapper', 'artifact-card', 'my-8'],
                'data-image-caption': captionText,
                'data-image-title': titleText || captionText,
              },
              children: figureChildren,
            };

            parent.children[index] = figureNode;
            return;
          }
        }
      }

      // 2. Non-Mermaid <pre> Code Blocks
      if (node.type === 'element' && node.tagName === 'pre' && parent && typeof index === 'number') {
        if (parent.type === 'element') {
          const parentClass = parent.properties?.className;
          const classStr = Array.isArray(parentClass) ? parentClass.join(' ') : String(parentClass || '');
          if (
            classStr.includes('code-snippet') ||
            classStr.includes('artifact-card-body') ||
            classStr.includes('mermaid-source')
          ) {
            return;
          }
        }

        const meta = captions[preIndex] || { caption: '', title: '', lang: 'text' };
        preIndex++;

        const displayCaption = meta.caption || meta.title;
        const displayTitle = meta.title || meta.caption || `Code (${meta.lang || 'text'})`;
        const langLabel = formatLangBadge(meta.lang || 'text');

        const headerBar: Element = {
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['artifact-card-header'],
          },
          children: [
            {
              type: 'element',
              tagName: 'span',
              properties: {
                className: ['artifact-card-badge'],
              },
              children: [{ type: 'text', value: langLabel }],
            },
            {
              type: 'element',
              tagName: 'div',
              properties: {
                className: ['artifact-card-controls'],
              },
              children: [
                {
                  type: 'element',
                  tagName: 'button',
                  properties: {
                    type: 'button',
                    className: ['table-deck-btn'],
                    'data-copy-code': 'true',
                    'aria-label': 'Copy code to clipboard',
                    title: 'Copy code to clipboard',
                  },
                  children: [{ type: 'text', value: 'Copy' }],
                },
                {
                  type: 'element',
                  tagName: 'button',
                  properties: {
                    type: 'button',
                    className: ['table-deck-btn'],
                    'data-media-fullscreen': 'true',
                    'aria-label': `Open fullscreen code: ${displayTitle}`,
                    title: 'Fullscreen',
                  },
                  children: [{ type: 'text', value: '⤢' }],
                },
              ],
            },
          ],
        };

        const bodyContainer: Element = {
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['artifact-card-body'],
          },
          children: [node as ElementContent],
        };

        const figureChildren: ElementContent[] = [headerBar, bodyContainer];

        if (displayCaption) {
          figureChildren.push({
            type: 'element',
            tagName: 'figcaption',
            properties: {
              className: ['artifact-card-footer'],
            },
            children: [
              {
                type: 'text',
                value: displayCaption,
              },
            ],
          });
        }

        const figureNode: Element = {
          type: 'element',
          tagName: 'figure',
          properties: {
            className: ['code-snippet', 'code-deck-wrapper', 'artifact-card', 'my-8'],
            'data-code-caption': displayCaption,
            'data-code-title': displayTitle,
            'data-code-lang': meta.lang || 'text',
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
