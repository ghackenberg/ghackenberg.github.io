import type { Root, Text, Html } from 'mdast';
import type { VFile } from 'vfile';
import type { Node, Parent } from 'unist';
import { generateCitationLabel, type CitationRef } from '@shared';

interface AstroFrontmatterFile {
  astro?: {
    frontmatter?: {
      references?: CitationRef[];
      [key: string]: string | number | boolean | CitationRef[] | undefined;
    };
  };
}

/**
 * Remark plugin to transform [@id] in Markdown AST into clickable citation links.
 * In blog posts: <a href="#ref-id" class="citation ...">[Label]</a>
 * In slides: <button type="button" data-ref-id="id" class="slide-citation-badge ...">[Label]</button>
 */
export default function remarkCitations() {
  return function transformer(tree: Root, file: VFile) {
    const CITE_REGEX = /\[@([a-zA-Z0-9_\-]+)\]/g;
    const frontmatter = (file?.data as AstroFrontmatterFile | undefined)?.astro?.frontmatter || {};
    const references: CitationRef[] = Array.isArray(frontmatter.references) ? frontmatter.references : [];
    const filePath = file?.history?.[0] || '';
    const isSlide = filePath.includes('presentations') || filePath.endsWith('.mdx');

    function splitTextToNodes(text: string): (Text | Html)[] {
      const nodes: (Text | Html)[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      CITE_REGEX.lastIndex = 0;

      while ((match = CITE_REGEX.exec(text)) !== null) {
        if (match.index > lastIndex) {
          nodes.push({
            type: 'text',
            value: text.slice(lastIndex, match.index),
          });
        }

        const refId = match[1];
        const ref = references.find((r) => r.id === refId) || { id: refId };
        const label = generateCitationLabel(ref);

        if (isSlide) {
          nodes.push({
            type: 'html',
            value: `<button type="button" data-open-reference="${refId}" class="slide-citation-badge inline-flex items-center font-mono text-purple-400 light:text-purple-700 hover:text-purple-300 font-bold align-baseline px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 cursor-pointer transition-colors" title="Referenz ansehen: ${label}">[${label}]</button>`,
          });
        } else {
          nodes.push({
            type: 'html',
            value: `<a href="#ref-${refId}" class="citation" title="Quelle [${label}] anzeigen">[${label}]</a>`,
          });
        }

        lastIndex = CITE_REGEX.lastIndex;
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
          if (child.type === 'text' && typeof (child as Text).value === 'string' && (child as Text).value.includes('[@')) {
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
