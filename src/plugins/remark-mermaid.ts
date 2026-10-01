import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import type { Root, Code, Html } from 'mdast';
import type { VFile } from 'vfile';
import type { Node, Parent } from 'unist';

interface RendererState {
  browser: Browser | null;
  page: Page | null;
  isInitializing: Promise<void> | null;
}

const renderer: RendererState = {
  browser: null,
  page: null,
  isInitializing: null,
};

const CACHE_DIR = path.resolve(process.cwd(), '.cache/mermaid');

const darkThemeConfig = {
  startOnLoad: false,
  htmlLabels: false,
  theme: 'dark',
  themeVariables: {
    darkMode: true,
    background: 'transparent',
    mainBkg: '#0f172a',
    nodeBorder: '#3b82f6',
    defaultLinkColor: '#94a3b8',
    lineColor: '#94a3b8',
    primaryColor: '#1e293b',
    primaryTextColor: '#f8fafc',
    primaryBorderColor: '#3b82f6',
    secondaryColor: '#0f172a',
    secondaryTextColor: '#f8fafc',
    secondaryBorderColor: '#60a5fa',
    tertiaryColor: '#1e293b',
    tertiaryTextColor: '#f8fafc',
    tertiaryBorderColor: '#94a3b8',
    clusterBkg: '#030712',
    clusterBorder: '#334155',
    titleColor: '#f8fafc',
    edgeLabelBackground: '#0f172a',
    actorBkg: '#1e293b',
    actorBorder: '#3b82f6',
    actorTextColor: '#f8fafc',
    actorLineColor: '#94a3b8',
    signalColor: '#94a3b8',
    signalTextColor: '#f8fafc',
    labelBoxBkgColor: '#0f172a',
    labelBoxBorderColor: '#3b82f6',
    labelTextColor: '#f8fafc',
    loopTextColor: '#f8fafc',
    noteBorderColor: '#f59e0b',
    noteBkgColor: '#1e293b',
    noteTextColor: '#f8fafc',
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    fontSize: '13px',
  },
  flowchart: {
    htmlLabels: false,
    useMaxWidth: true,
    curve: 'basis',
    nodeSpacing: 50,
    rankSpacing: 50,
    padding: 24,
  },
  sequence: {
    useMaxWidth: true,
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    fontSize: 13,
    boxMargin: 10,
    boxTextMargin: 5,
    noteMargin: 10,
    messageMargin: 35,
    mirrorActors: false,
  },
};

const lightThemeConfig = {
  startOnLoad: false,
  htmlLabels: false,
  theme: 'default',
  themeVariables: {
    darkMode: false,
    background: 'transparent',
    mainBkg: '#ffffff',
    nodeBorder: '#2563eb',
    defaultLinkColor: '#64748b',
    lineColor: '#64748b',
    primaryColor: '#ffffff',
    primaryTextColor: '#0f172a',
    primaryBorderColor: '#2563eb',
    secondaryColor: '#f8fafc',
    secondaryTextColor: '#0f172a',
    secondaryBorderColor: '#3b82f6',
    tertiaryColor: '#f1f5f9',
    tertiaryTextColor: '#0f172a',
    tertiaryBorderColor: '#64748b',
    clusterBkg: '#f8fafc',
    clusterBorder: '#cbd5e1',
    titleColor: '#0f172a',
    edgeLabelBackground: '#ffffff',
    actorBkg: '#ffffff',
    actorBorder: '#2563eb',
    actorTextColor: '#0f172a',
    actorLineColor: '#64748b',
    signalColor: '#64748b',
    signalTextColor: '#0f172a',
    labelBoxBkgColor: '#ffffff',
    labelBoxBorderColor: '#2563eb',
    labelTextColor: '#0f172a',
    loopTextColor: '#0f172a',
    noteBorderColor: '#d97706',
    noteBkgColor: '#fef3c7',
    noteTextColor: '#78350f',
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    fontSize: '13px',
  },
  flowchart: {
    htmlLabels: false,
    useMaxWidth: true,
    curve: 'basis',
    nodeSpacing: 50,
    rankSpacing: 50,
    padding: 24,
  },
  sequence: {
    useMaxWidth: true,
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    fontSize: 13,
    boxMargin: 10,
    boxTextMargin: 5,
    noteMargin: 10,
    messageMargin: 35,
    mirrorActors: false,
  },
};

async function initRenderer(): Promise<void> {
  if (renderer.page) return;
  if (renderer.isInitializing) return renderer.isInitializing;

  renderer.isInitializing = (async () => {
    try {
      renderer.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      renderer.page = await renderer.browser.newPage();
      await renderer.page.setContent(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
            <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
            <style>
              body { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
            </style>
          </head>
          <body>
            <div id="container"></div>
          </body>
        </html>
      `, { waitUntil: 'domcontentloaded' });
    } catch (err) {
      console.error('[remark-mermaid] Failed to initialize Puppeteer renderer:', err);
      throw err;
    } finally {
      renderer.isInitializing = null;
    }
  })();

  return renderer.isInitializing;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface MermaidThemeConfig {
  startOnLoad?: boolean;
  htmlLabels?: boolean;
  theme?: string;
  themeVariables?: Record<string, string | boolean | number>;
  flowchart?: Record<string, string | boolean | number>;
  sequence?: Record<string, string | boolean | number>;
  [key: string]: string | number | boolean | Record<string, string | boolean | number> | undefined;
}

async function renderSingleTheme(code: string, mode: 'dark' | 'light', config: MermaidThemeConfig): Promise<string> {
  const hash = crypto.createHash('sha256')
    .update(code)
    .update(JSON.stringify(config))
    .update(mode)
    .update('v4')
    .digest('hex');

  const cacheFile = path.join(CACHE_DIR, `${hash}.svg`);
  if (fs.existsSync(cacheFile)) {
    return fs.readFileSync(cacheFile, 'utf8');
  }

  await initRenderer();
  if (!renderer.page) {
    throw new Error('Mermaid renderer page could not be initialized');
  }

  const diagramId = `mermaid-${mode}-${hash.slice(0, 8)}`;

  await renderer.page.evaluate((themeConf) => {
    // @ts-ignore
    window.mermaid.initialize(themeConf);
  }, config);

  const result = await renderer.page.evaluate(async (diagramCode, id) => {
    try {
      // @ts-ignore
      const { svg } = await window.mermaid.render(id, diagramCode);
      return { svg, error: null };
    } catch (err) {
      return { svg: null, error: (err as Error)?.message || String(err) };
    }
  }, code, diagramId);

  if (result.error || !result.svg) {
    throw new Error(`Mermaid [${mode}] render failed: ${result.error}`);
  }

  let svg = result.svg;
  if (!svg.includes('style=')) {
    svg = svg.replace('<svg ', '<svg style="max-width: 100%; height: auto;" ');
  }

  fs.writeFileSync(cacheFile, svg, 'utf8');
  return svg;
}

function parseMermaidMetadata(code: string): { title: string | null; caption: string | null } {
  const match = code.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { title: null, caption: null };
  const header = match[1];
  let title: string | null = null;
  let caption: string | null = null;
  for (const line of header.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('title:')) {
      title = trimmed.slice(6).trim().replace(/^["']|["']$/g, '');
    } else if (trimmed.startsWith('caption:')) {
      caption = trimmed.slice(8).trim().replace(/^["']|["']$/g, '');
    }
  }
  return { title, caption };
}

async function renderMermaidDiagrams(code: string): Promise<{ darkSvg: string; lightSvg: string; hash: string }> {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  const diagramHash = crypto.createHash('sha256')
    .update(code)
    .update('v4')
    .digest('hex')
    .slice(0, 32);

  const darkSvg = await renderSingleTheme(code, 'dark', darkThemeConfig);
  const lightSvg = await renderSingleTheme(code, 'light', lightThemeConfig);

  const publicDir = path.resolve(process.cwd(), 'public/diagrams');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  fs.writeFileSync(path.join(publicDir, `${diagramHash}.svg`), lightSvg, 'utf8');

  const distDir = path.resolve(process.cwd(), 'dist/diagrams');
  if (fs.existsSync(path.resolve(process.cwd(), 'dist'))) {
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }
    fs.writeFileSync(path.join(distDir, `${diagramHash}.svg`), lightSvg, 'utf8');
  }

  return { darkSvg, lightSvg, hash: diagramHash };
}

interface MermaidNodeToProcess {
  node: Code;
  parent: Parent;
  index: number;
}

export default function remarkMermaid() {
  return async function transformer(tree: Root, file: VFile) {
    const filePath = file?.path || file?.history?.[0] || 'Unknown Markdown File';
    const nodesToProcess: MermaidNodeToProcess[] = [];

    function visitNodes(node: Node, parent: Parent | null, index: number | null) {
      if (node.type === 'code' && (node as Code).lang === 'mermaid' && parent !== null && index !== null) {
        nodesToProcess.push({ node: node as Code, parent, index });
      }
      if ('children' in node && Array.isArray((node as Parent).children)) {
        const p = node as Parent;
        for (let i = 0; i < p.children.length; i++) {
          visitNodes(p.children[i], p, i);
        }
      }
    }

    visitNodes(tree, null, null);

    if (nodesToProcess.length === 0) {
      return;
    }

    for (let i = 0; i < nodesToProcess.length; i++) {
      const { node, parent, index } = nodesToProcess[i];
      const code = node.value.trim();
      const line = node.position?.start?.line ?? '?';

      const { title, caption } = parseMermaidMetadata(code);
      const issues: string[] = [];
      if (!title || title.trim().length < 3) {
        issues.push("Missing 'title' in frontmatter: title: \"Concise Diagram Title\" (min 3 chars)");
      }
      if (!caption || caption.trim().length < 5) {
        issues.push("Missing 'caption' in frontmatter: caption: \"Detailed explanation of diagram topology\" (min 5 chars)");
      }
      if (title && caption && title.trim().toLowerCase() === caption.trim().toLowerCase()) {
        issues.push("Title and caption must be distinct (provide a concise title and a detailed descriptive caption).");
      }

      if (issues.length > 0) {
        const errorMsg = [
          '================================================================================',
          '[MERMAID DIAGRAM VALIDATION ERROR]',
          `File:          ${filePath} (Line ${line})`,
          `Diagram Index: #${i + 1} in document`,
          '',
          'Problems:',
          ...issues.map(iss => `  [X] ${iss}`),
          '',
          'Found Diagram Code:',
          `  \`\`\`mermaid\n${code.slice(0, 160)}${code.length > 160 ? '...' : ''}\n  \`\`\``,
          '',
          'How to Fix:',
          '  Add a YAML header at the very top of your ```mermaid code block:',
          '  ```mermaid',
          '  ---',
          '  title: "Concise Diagram Title"',
          '  caption: "Detailed description of what the diagram shows and its key components."',
          '  ---',
          '  flowchart TD',
          '    ...',
          '  ```',
          '================================================================================'
        ].join('\n');

        throw new Error(errorMsg);
      }

      const { darkSvg, lightSvg, hash } = await renderMermaidDiagrams(code);

      const html = `
<figure class="mermaid-diagram my-8 flex flex-col items-center w-full overflow-x-auto" role="figure" aria-label="${escapeHtml(title!)}" itemscope itemtype="https://schema.org/ImageObject" data-diagram-title="${escapeHtml(title!)}" data-diagram-caption="${escapeHtml(caption!)}">
  <meta itemprop="contentUrl" content="/diagrams/${hash}.svg" />
  <meta itemprop="name" content="${escapeHtml(title!)}" />
  <meta itemprop="description" content="${escapeHtml(caption!)}" />
  <div class="mermaid-svg mermaid-dark justify-center w-full max-w-full">
    ${darkSvg}
  </div>
  <div class="mermaid-svg mermaid-light justify-center w-full max-w-full">
    ${lightSvg}
  </div>
  <figcaption class="sr-only">${escapeHtml(caption!)}</figcaption>
  <details class="mermaid-source mt-3 text-xs text-slate-400 w-full text-center group">
    <summary class="cursor-pointer hover:text-slate-200 transition-colors select-none py-1 inline-block">View Diagram Source</summary>
    <pre class="bg-slate-900/80 p-3 mt-1 rounded text-left overflow-x-auto border border-slate-800 text-slate-300 font-mono text-xs"><code>${escapeHtml(code)}</code></pre>
  </details>
</figure>`.trim();

      const htmlNode: Html = {
        type: 'html',
        value: html,
      };

      parent.children[index] = htmlNode;
    }
  };
}
