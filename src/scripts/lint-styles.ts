import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const STYLES_DIR = path.join(ROOT_DIR, 'src', 'styles');
const PRINT_ASTRO_PATH = path.join(ROOT_DIR, 'src', 'pages', 'presentations', '[slug]', 'print.astro');

let errorCount = 0;

function error(msg: string) {
  console.error(`❌ [lint:styles] ${msg}`);
  errorCount++;
}

function success(msg: string) {
  console.log(`✅ [lint:styles] ${msg}`);
}

console.log('🔍 [lint:styles] Validating modular stylesheet architecture...');

// 1. Check existence of modular stylesheets
const requiredStyles = ['theme.css', 'diagrams.css', 'slides.css', 'posts.css', 'components.css', 'global.css', 'graphics.css'];
for (const file of requiredStyles) {
  const filePath = path.join(STYLES_DIR, file);
  if (!fs.existsSync(filePath)) {
    error(`Missing required stylesheet: src/styles/${file}`);
  }
}

// 2. Validate theme.css composition and imports
const themeCssPath = path.join(STYLES_DIR, 'theme.css');
if (fs.existsSync(themeCssPath)) {
  const content = fs.readFileSync(themeCssPath, 'utf8');
  if (!content.includes('./diagrams.css')) {
    error('src/styles/theme.css is missing import for "./diagrams.css"');
  } else {
    success('src/styles/theme.css correctly imports modular diagrams.css.');
  }
  if (!content.includes('./graphics.css')) {
    error('src/styles/theme.css is missing import for "./graphics.css"');
  } else {
    success('src/styles/theme.css correctly imports modular graphics.css.');
  }
}

// 3. Validate posts.css does not double-import diagrams.css
const postsCssPath = path.join(STYLES_DIR, 'posts.css');
if (fs.existsSync(postsCssPath)) {
  const content = fs.readFileSync(postsCssPath, 'utf8');
  if (content.includes('diagrams.css')) {
    error('src/styles/posts.css should not import diagrams.css directly (centralized in theme.css).');
  }
}

// 4. Validate global.css composition
const globalCssPath = path.join(STYLES_DIR, 'global.css');
if (fs.existsSync(globalCssPath)) {
  const content = fs.readFileSync(globalCssPath, 'utf8');
  const codeWithoutComments = content.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  const nonImportLines = codeWithoutComments
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('@import'));

  if (nonImportLines.length > 0) {
    error(`src/styles/global.css must only contain @import statements for modular stylesheets. Found unexpected lines:\n  ${nonImportLines.slice(0, 3).join('\n  ')}`);
  } else {
    success('src/styles/global.css is a clean entrypoint importing modular layers.');
  }

  // Check required imports
  for (const module of ['./theme.css', './slides.css', './posts.css', './components.css']) {
    if (!content.includes(module)) {
      error(`src/styles/global.css is missing import for "${module}"`);
    }
  }
}

// 5. Validate print.astro isolation
if (fs.existsSync(PRINT_ASTRO_PATH)) {
  const printContent = fs.readFileSync(PRINT_ASTRO_PATH, 'utf8');
  if (printContent.includes('styles/global.css')) {
    error('src/pages/presentations/[slug]/print.astro must NOT import global.css! Import theme.css and slides.css directly.');
  } else if (!printContent.includes('styles/theme.css') || !printContent.includes('styles/slides.css')) {
    error('src/pages/presentations/[slug]/print.astro must import both theme.css and slides.css.');
  } else if (printContent.includes('styles/posts.css') || printContent.includes('styles/components.css')) {
    error('src/pages/presentations/[slug]/print.astro must NOT import posts.css or components.css.');
  } else {
    success('src/pages/presentations/[slug]/print.astro maintains clean isolation (theme.css + slides.css only).');
  }
}

interface DomainRule {
  file: string;
  forbidden: Array<{ pattern: RegExp; name: string }>;
}

// 6. Domain Boundary Rules
const domainRules: DomainRule[] = [
  {
    file: 'theme.css',
    forbidden: [
      { pattern: /\.post-body\b/, name: '.post-body (should be in posts.css)' },
      { pattern: /\.preview-card\b/, name: '.preview-card (should be in components.css)' },
      { pattern: /\.print-slide-page\b/, name: '.print-slide-page (should be in slides.css)' },
      { pattern: /\.tag-chip\b/, name: '.tag-chip (should be in components.css)' },
      { pattern: /\.markdown-alert\b/, name: '.markdown-alert (should be in posts.css)' },
    ],
  },
  {
    file: 'slides.css',
    forbidden: [
      { pattern: /\.post-body\b/, name: '.post-body (should be in posts.css)' },
      { pattern: /\.prose-custom\b/, name: '.prose-custom (should be in posts.css)' },
      { pattern: /\.markdown-alert\b/, name: '.markdown-alert (should be in posts.css)' },
      { pattern: /\.preview-card\b/, name: '.preview-card (should be in components.css)' },
      { pattern: /\.gallery-track-/, name: '.gallery-track-* (should be in components.css)' },
      { pattern: /\.tag-chip\b/, name: '.tag-chip (should be in components.css)' },
    ],
  },
  {
    file: 'posts.css',
    forbidden: [
      { pattern: /\.print-slide-page\b/, name: '.print-slide-page (should be in slides.css)' },
      { pattern: /\.slide-base-frame\b/, name: '.slide-base-frame (should be in slides.css)' },
      { pattern: /\.preview-card\b/, name: '.preview-card (should be in components.css)' },
    ],
  },
  {
    file: 'components.css',
    forbidden: [
      { pattern: /\.print-slide-page\b/, name: '.print-slide-page (should be in slides.css)' },
      { pattern: /\.slide-base-frame\b/, name: '.slide-base-frame (should be in slides.css)' },
      { pattern: /\.post-body\b/, name: '.post-body (should be in posts.css)' },
      { pattern: /\.responsive-table-wrapper\b/, name: '.responsive-table-wrapper (should be in posts.css)' },
      { pattern: /\.markdown-alert\b/, name: '.markdown-alert (should be in posts.css)' },
    ],
  },
];

for (const { file, forbidden } of domainRules) {
  const filePath = path.join(STYLES_DIR, file);
  if (!fs.existsSync(filePath)) continue;
  const content = fs.readFileSync(filePath, 'utf8');

  for (const { pattern, name } of forbidden) {
    if (pattern.test(content)) {
      error(`src/styles/${file} violates domain boundary by defining ${name}`);
    }
  }
}

if (errorCount === 0) {
  console.log('🎉 [lint:styles] All stylesheet architectural boundaries validated successfully.');
  process.exit(0);
} else {
  console.error(`💥 [lint:styles] Failed with ${errorCount} boundary violation(s).`);
  process.exit(1);
}
