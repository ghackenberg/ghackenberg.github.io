/**
 * Rehype plugin to transform GitHub-style alert callouts (> [!NOTE], > [!TIP], etc.)
 * and editorial blockquotes into beautifully styled, accessible UI components.
 */

/** @type {Record<string, { labelDe: string, labelEn: string, iconD: string }>} */
const ALERT_CONFIGS = {
  note: {
    labelDe: 'Hinweis',
    labelEn: 'Note',
    iconD: 'M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z'
  },
  tip: {
    labelDe: 'Tipp',
    labelEn: 'Tip',
    iconD: 'M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.58-.733l-.216-.256C3.171 7.712 2.5 6.786 2.5 5.25 2.5 2.31 4.97 0 8 0s5.5 2.31 5.5 5.25c0 1.536-.671 2.462-1.316 3.226l-.216.256c-.173.205-.374.444-.58.733-.207.3-.33.565-.37.847a.75.75 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5Zm1 3h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1 0-1.5Z'
  },
  important: {
    labelDe: 'Wichtig',
    labelEn: 'Important',
    iconD: 'M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h3a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h5.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm6.25 2.25a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5a.75.75 0 0 1 .75-.75Zm0 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z'
  },
  warning: {
    labelDe: 'Warnung',
    labelEn: 'Warning',
    iconD: 'M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z'
  },
  caution: {
    labelDe: 'Achtung',
    labelEn: 'Caution',
    iconD: 'M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z'
  }
};

/**
 * @param {any} node
 * @param {string} language
 */
function processBlockquote(node, language) {
  node.properties = node.properties || {};
  const currentClasses = Array.isArray(node.properties.className)
    ? [...node.properties.className]
    : typeof node.properties.className === 'string'
    ? node.properties.className.split(' ').filter(Boolean)
    : [];

  // Prevent double processing
  if (currentClasses.includes('markdown-alert') || currentClasses.includes('markdown-quote')) {
    return;
  }

  // Find first element child (usually a <p>)
  const firstChildIndex = (node.children || []).findIndex(
    /** @param {any} child */
    child => child.type === 'element' && child.tagName === 'p'
  );

  if (firstChildIndex === -1) {
    node.properties.className = [...currentClasses, 'markdown-quote'];
    return;
  }

  const pNode = node.children[firstChildIndex];
  if (!Array.isArray(pNode.children) || pNode.children.length === 0) {
    node.properties.className = [...currentClasses, 'markdown-quote'];
    return;
  }

  // Find first text child in pNode
  const firstTextChild = pNode.children.find(/** @param {any} c */ c => c.type === 'text');
  if (!firstTextChild) {
    node.properties.className = [...currentClasses, 'markdown-quote'];
    return;
  }

  const match = firstTextChild.value.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(\r?\n)?/i);
  if (!match) {
    node.properties.className = [...currentClasses, 'markdown-quote'];
    return;
  }

  const alertType = match[1].toLowerCase();
  const config = ALERT_CONFIGS[alertType];
  if (!config) {
    node.properties.className = [...currentClasses, 'markdown-quote'];
    return;
  }

  // Strip [!TYPE] prefix from text node
  firstTextChild.value = firstTextChild.value.slice(match[0].length);

  // Clean up if firstTextChild is empty
  if (firstTextChild.value === '') {
    const idx = pNode.children.indexOf(firstTextChild);
    if (idx !== -1) {
      pNode.children.splice(idx, 1);
    }
  }

  // If next child is <br>, remove it
  if (pNode.children[0]?.type === 'element' && pNode.children[0]?.tagName === 'br') {
    pNode.children.shift();
  }

  // Trim leading whitespace from first remaining text node
  if (pNode.children[0]?.type === 'text') {
    pNode.children[0].value = pNode.children[0].value.replace(/^\s+/, '');
    if (pNode.children[0].value === '') {
      pNode.children.shift();
    }
  }

  // If pNode is now completely empty, remove it from blockquote
  if (pNode.children.length === 0) {
    node.children.splice(firstChildIndex, 1);
  }

  // Mark blockquote as alert
  node.properties.className = [...currentClasses, 'markdown-alert', `markdown-alert-${alertType}`];
  node.properties['data-alert-type'] = alertType;

  // Build title header
  const titleLabel = language === 'en' ? config.labelEn : config.labelDe;
  const titleNode = {
    type: 'element',
    tagName: 'div',
    properties: {
      className: ['markdown-alert-title']
    },
    children: [
      {
        type: 'element',
        tagName: 'svg',
        properties: {
          className: ['markdown-alert-icon'],
          viewBox: '0 0 16 16',
          width: '16',
          height: '16',
          ariaHidden: 'true',
          fill: 'currentColor'
        },
        children: [
          {
            type: 'element',
            tagName: 'path',
            properties: {
              d: config.iconD
            },
            children: []
          }
        ]
      },
      {
        type: 'element',
        tagName: 'span',
        properties: {
          className: ['markdown-alert-label']
        },
        children: [
          {
            type: 'text',
            value: titleLabel
          }
        ]
      }
    ]
  };

  // Insert title header as the first child of the blockquote
  node.children.unshift(titleNode);
}

/**
 * Detect document language from frontmatter or HAST text heuristics.
 * @param {any} file
 * @param {any} tree
 * @returns {'de' | 'en'}
 */
function detectLanguage(file, tree) {
  const fm = file?.data?.astro?.frontmatter;
  if (fm?.language) {
    return fm.language.toLowerCase() === 'en' ? 'en' : 'de';
  }
  if (fm?.lang) {
    return fm.lang.toLowerCase() === 'en' ? 'en' : 'de';
  }

  // Sample text from HAST tree
  let sampleText = `${fm?.title || ''} ${fm?.description || ''} `;
  /**
   * @param {any} n
   */
  function walk(n) {
    if (!n || sampleText.length >= 800) return;
    if (n.type === 'text' && typeof n.value === 'string') {
      sampleText += ' ' + n.value;
    }
    if (Array.isArray(n.children)) {
      for (let i = 0; i < n.children.length; i++) {
        walk(n.children[i]);
      }
    }
  }
  if (tree) walk(tree);

  sampleText = sampleText.toLowerCase();
  const enMatches = sampleText.match(/\b(the|and|is|this|that|with|for|from|are|when|we|our|you)\b/g) || [];
  const deMatches = sampleText.match(/\b(der|die|das|und|ist|wie|wir|mit|für|von|auf|ein|eine|nicht)\b/g) || [];

  if (enMatches.length > deMatches.length) {
    return 'en';
  }
  return 'de';
}

export default function rehypeCallouts() {
  /**
   * @param {any} tree
   * @param {any} [file]
   */
  return function (tree, file) {
    const language = detectLanguage(file, tree);

    /**
     * @param {any} node
     */
    function visit(node) {
      if (!node || typeof node !== 'object') return;

      if (node.type === 'element' && node.tagName === 'blockquote') {
        processBlockquote(node, language);
      }

      if (Array.isArray(node.children)) {
        for (let i = 0; i < node.children.length; i++) {
          visit(node.children[i]);
        }
      }
    }

    visit(tree);
  };
}
