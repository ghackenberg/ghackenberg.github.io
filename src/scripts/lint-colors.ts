import fs from 'node:fs';
import path from 'node:path';

/**
 * Color & Design Token Governance Linter
 * Enforces architectural color token conventions across the repository:
 * 1. Rule 1: No Hardcoded Hex Colors in templates, style blocks, or code files.
 * 2. Rule 2: No Deprecated Legacy Classes (.border-white/5, .border-white/10, .bg-white/5, light:!bg-white, light:!border-slate-200/90).
 * 3. Rule 3: No Ad-hoc Tailwind Palette Bypasses in Content & Components (bypassing canonical domain or brand tokens).
 * 4. Rule 4: Domain Metadata Purity in src/commons/shared/domain-themes.ts (badgeClasses canonical tokens).
 * 5. Rule 5: Card Architecture Token Integrity (CompactRelatedCard DOMAIN_THEMES, services modules domain-services purity).
 * 6. Rule 6: Presentation Slide Accent Governance (No 'neutral' accents; No manual step accents in <Pipeline>; No 'accent=' attribute on <BentoCard>; No raw Tailwind palette classes in slide MDX).
 */

const ROOT_DIR = process.cwd();
const SRC_DIR = path.resolve(ROOT_DIR, 'src');
const verbose = process.argv.includes('--verbose');

let errorCount = 0;

function error(msg: string): void {
  console.error(`❌ [lint:colors] ${msg}`);
  errorCount++;
}

function success(msg: string): void {
  if (verbose) {
    console.log(`✅ [lint:colors] ${msg}`);
  }
}

if (verbose) {
  console.log('🔍 [lint:colors] Auditing color token governance and architectural integrity...\n');
}

/**
 * Recursively retrieves all files matching given extensions in a directory.
 */
function getFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

// ============================================================================
// Rule 1: No Hardcoded Hex Colors
// ============================================================================
if (verbose) {
  console.log('Auditing Rule 1: No Hardcoded Hex Colors...');
}

const EXCLUDED_HEX_FILES = new Set(
  [
    'src/styles/theme.css',
    'src/styles/domains.css',
    'src/styles/graphics.css',
    'src/styles/slides.css',
    'src/scripts/migrate-adaptive-svgs.ts',
    'src/plugins/remark-mermaid.ts',
    'src/scripts/lint-colors.ts',
    'src/scripts/lint-domains.ts',
    'src/commons/shared/domain-themes.ts',
    'src/pages/_internal/og.astro',
    'src/pages/_internal/icon.astro',
    'src/pages/posts/[slug]/og.png.ts',
    'src/pages/presentations/[slug]/print.astro',
    'src/styles/listmonk.css',
    'src/commons/server/email/email-theme.ts',
  ].map((p) => path.resolve(ROOT_DIR, p))
);

const EXCLUDED_HEX_DIRS = ['src/components/dev'].map((p) =>
  path.resolve(ROOT_DIR, p)
);

const allSrcFiles = getFiles(SRC_DIR, ['.astro', '.ts', '.tsx', '.css']);
const hexAuditFiles = allSrcFiles.filter((f) => {
  const resolved = path.resolve(f);
  return (
    !EXCLUDED_HEX_FILES.has(resolved) &&
    !EXCLUDED_HEX_DIRS.some((dir) => resolved.startsWith(dir))
  );
});

const HEX_COLOR_REGEX = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;

let rule1Violations = 0;
for (const file of hexAuditFiles) {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, idx) => {
    let match: RegExpExecArray | null;
    HEX_COLOR_REGEX.lastIndex = 0;
    while ((match = HEX_COLOR_REGEX.exec(line)) !== null) {
      error(`Hardcoded hex color "${match[0]}" found in ${rel}:${idx + 1}\n      Offending code: ${line.trim()}`);
      rule1Violations++;
    }
  });
}

if (rule1Violations === 0) {
  success('Rule 1 passed: Zero hardcoded hex colors found outside token definition files.');
} else {
  console.log(`⚠️  Rule 1 detected ${rule1Violations} hardcoded hex color violation(s).\n`);
}

// ============================================================================
// Rule 2: No Deprecated Legacy Classes
// ============================================================================
if (verbose) {
  console.log('Auditing Rule 2: No Deprecated Legacy Classes...');
}

const DEPRECATED_CLASSES = [
  { name: 'border-white/5', pattern: /\bborder-white\/5\b/ },
  { name: 'border-white/10', pattern: /\bborder-white\/10\b/ },
  { name: 'bg-white/5', pattern: /\bbg-white\/5\b/ },
  { name: 'light:!bg-white', pattern: /\blight:!bg-white\b/ },
  { name: 'light:!border-slate-200/90', pattern: /\blight:!border-slate-200\/90\b/ },
];

let rule2Violations = 0;
for (const file of allSrcFiles) {
  // Exclude the linter script itself
  if (path.relative(ROOT_DIR, file).replace(/\\/g, '/').toLowerCase() === 'src/scripts/lint-colors.ts') continue;

  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, idx) => {
    for (const { name, pattern } of DEPRECATED_CLASSES) {
      if (pattern.test(line)) {
        error(`Deprecated class "${name}" found in ${rel}:${idx + 1}\n      Offending code: ${line.trim()}`);
        rule2Violations++;
      }
    }
  });
}

if (rule2Violations === 0) {
  success('Rule 2 passed: Zero deprecated legacy classes found in components, pages, or styles.');
} else {
  console.log(`⚠️  Rule 2 detected ${rule2Violations} deprecated legacy class violation(s).\n`);
}

// ============================================================================
// Rule 3: No Ad-hoc Tailwind Palette Bypasses in Content & Components
// ============================================================================
if (verbose) {
  console.log('Auditing Rule 3: No Ad-hoc Tailwind Palette Bypasses...');
}

const RAW_PALETTE_REGEX = /\b(?:[a-zA-Z0-9_-]+:)*(?:text|bg|border|from|to|via|ring|outline|fill|stroke)-(?:rose|pink|fuchsia|purple|violet|indigo|blue|sky|cyan|teal|emerald|green|lime|yellow|amber|orange|red)-(?:50|100|200|300|400|500|600|700|800|900|950)(?:\/\d+)?\b/g;

const RULE3_DIRECTORIES = ['src/components', 'src/layouts', 'src/pages'].map((p) =>
  path.resolve(ROOT_DIR, p)
);
const RULE3_EXCLUDED_DIRECTORIES = ['src/components/dev'].map((p) =>
  path.resolve(ROOT_DIR, p)
);
const RULE3_EXCLUDED_FILES = new Set(
  ['src/pages/presentations/[slug]/print.astro'].map((p) => path.resolve(ROOT_DIR, p))
);
const rule3Files = allSrcFiles.filter((f) => {
  const resolved = path.resolve(f);
  return (
    RULE3_DIRECTORIES.some((dir) => resolved.startsWith(dir)) &&
    !RULE3_EXCLUDED_DIRECTORIES.some((dir) => resolved.startsWith(dir)) &&
    !RULE3_EXCLUDED_FILES.has(resolved) &&
    (f.endsWith('.astro') || f.endsWith('.ts'))
  );
});

let rule3Violations = 0;
for (const file of rule3Files) {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, idx) => {
    let match: RegExpExecArray | null;
    RAW_PALETTE_REGEX.lastIndex = 0;
    while ((match = RAW_PALETTE_REGEX.exec(line)) !== null) {
      error(`Raw Tailwind palette class "${match[0]}" found in ${rel}:${idx + 1}\n      Offending code: ${line.trim()}`);
      rule3Violations++;
    }
  });
}

if (rule3Violations === 0) {
  success('Rule 3 passed: Zero ad-hoc Tailwind palette bypasses found in components, layouts, or pages.');
} else {
  console.log(`⚠️  Rule 3 detected ${rule3Violations} raw Tailwind palette bypass violation(s).\n`);
}

// ============================================================================
// Rule 4: Domain Metadata Purity in src/commons/shared/domain-themes.ts
// ============================================================================
if (verbose) {
  console.log('Auditing Rule 4: Domain Metadata Purity...');
}

const DOMAIN_THEMES_PATH = path.resolve(SRC_DIR, 'commons', 'shared', 'domain-themes.ts');
let rule4Violations = 0;

if (fs.existsSync(DOMAIN_THEMES_PATH)) {
  const rel = path.relative(ROOT_DIR, DOMAIN_THEMES_PATH).replace(/\\/g, '/');
  const content = fs.readFileSync(DOMAIN_THEMES_PATH, 'utf8');
  const lines = content.split(/\r?\n/);

  // Check DOMAIN_METADATA badgeClasses for raw palette classes or non-domain tokens
  lines.forEach((line, idx) => {
    if (line.includes('badgeClasses:')) {
      const match = line.match(/badgeClasses:\s*['"`]([^'"`]+)['"`]/);
      if (match) {
        const badgeClasses = match[1];
        // Must use canonical bg-domain-*, text-domain-*, border-domain-*
        const hasDomainBg = /bg-domain-[a-z0-9_-]+/i.test(badgeClasses);
        const hasDomainText = /text-domain-[a-z0-9_-]+/i.test(badgeClasses);
        const hasDomainBorder = /border-domain-[a-z0-9_-]+/i.test(badgeClasses);

        RAW_PALETTE_REGEX.lastIndex = 0;
        const rawPaletteMatch = RAW_PALETTE_REGEX.test(badgeClasses);

        if (!hasDomainBg || !hasDomainText || !hasDomainBorder || rawPaletteMatch) {
          error(
            `DOMAIN_METADATA badgeClasses in ${rel}:${idx + 1} must strictly use canonical domain tokens (bg-domain-*, text-domain-*, border-domain-*) and zero raw palette classes.\n      Offending code: ${line.trim()}`
          );
          rule4Violations++;
        }
      }
    }
  });
} else {
  error(`Missing required file: ${DOMAIN_THEMES_PATH}`);
  rule4Violations++;
}

if (rule4Violations === 0) {
  success('Rule 4 passed: DOMAIN_METADATA badgeClasses strictly adhere to canonical domain tokens.');
} else {
  console.log(`⚠️  Rule 4 detected ${rule4Violations} domain metadata purity violation(s).\n`);
}

// ============================================================================
// Rule 5: Card Architecture Token Integrity
// ============================================================================
if (verbose) {
  console.log('Auditing Rule 5: Card Architecture Token Integrity...');
}

let rule5Violations = 0;

// 5a. CompactRelatedCard.astro must strictly use DOMAIN_THEMES and not declare private COLOR_THEMES
const COMPACT_RELATED_CARD_PATH = path.resolve(SRC_DIR, 'components', 'CompactRelatedCard.astro');
if (fs.existsSync(COMPACT_RELATED_CARD_PATH)) {
  const rel = path.relative(ROOT_DIR, COMPACT_RELATED_CARD_PATH).replace(/\\/g, '/');
  const content = fs.readFileSync(COMPACT_RELATED_CARD_PATH, 'utf8');

  if (content.includes('COLOR_THEMES')) {
    error(
      `${rel} must not declare or use private COLOR_THEMES. It must strictly use canonical DOMAIN_THEMES.`
    );
    rule5Violations++;
  }

  if (!content.includes('DOMAIN_THEMES')) {
    error(`${rel} must strictly import or define and use canonical DOMAIN_THEMES.`);
    rule5Violations++;
  }
} else {
  error(`Missing required component: ${COMPACT_RELATED_CARD_PATH}`);
  rule5Violations++;
}

// 5b. Services modules (src/pages/services/[slug]/[moduleSlug].astro) must not use .theme-purple or purple classes
const SERVICE_MODULE_PAGE = path.resolve(
  SRC_DIR,
  'pages',
  'services',
  '[slug]',
  '[moduleSlug].astro'
);
if (fs.existsSync(SERVICE_MODULE_PAGE)) {
  const rel = path.relative(ROOT_DIR, SERVICE_MODULE_PAGE).replace(/\\/g, '/');
  const content = fs.readFileSync(SERVICE_MODULE_PAGE, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, idx) => {
    if (/\btheme-purple\b/i.test(line) || /\b(?:text|bg|border|hover:border)-purple-[0-9]+\b/i.test(line)) {
      error(
        `${rel}:${idx + 1} contains forbidden legacy purple styling ("theme-purple" or purple classes). Services domain must strictly use canonical domain-services tokens.\n      Offending code: ${line.trim()}`
      );
      rule5Violations++;
    }
  });

  if (!content.includes('domain-services') && !content.includes("domain='services'") && !content.includes('domain="services"')) {
    error(`${rel} must use canonical domain-services tokens.`);
    rule5Violations++;
  }
} else {
  error(`Missing required page: ${SERVICE_MODULE_PAGE}`);
  rule5Violations++;
}

if (rule5Violations === 0) {
  success('Rule 5 passed: Card architecture and services modules strictly adhere to canonical tokens.');
} else {
  console.log(`⚠️  Rule 5 detected ${rule5Violations} card architecture integrity violation(s).\n`);
}

// ============================================================================
// Rule 6: Presentation Slide Accent Governance
// ============================================================================
if (verbose) {
  console.log('Auditing Rule 6: Presentation Slide Accent Governance...');
}

let rule6Violations = 0;

// 6a. No "neutral" accents in presentation MDX and slide components
const PRESENTATIONS_DIR = path.resolve(SRC_DIR, 'content', 'presentations');
const SLIDE_COMPONENTS_DIR = path.resolve(SRC_DIR, 'components', 'slides');

const slideMdxFiles = getFiles(PRESENTATIONS_DIR, ['.mdx']);
const slideAstroFiles = getFiles(SLIDE_COMPONENTS_DIR, ['.astro']);
const slideAuditFiles = [...slideMdxFiles, ...slideAstroFiles];

const NEUTRAL_ACCENT_REGEX = /(?<![-\w])accent\s*[:=]\s*["'`]neutral["'`]/i;

for (const file of slideAuditFiles) {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, idx) => {
    if (NEUTRAL_ACCENT_REGEX.test(line)) {
      error(
        `Forbidden "neutral" accent found in ${rel}:${idx + 1}. Presentations must strictly use canonical 9-accent spectrum or pure CSS progression.\n      Offending code: ${line.trim()}`
      );
      rule6Violations++;
    }
  });
}

// 6b. No manual step accents in <Pipeline steps={[...]}>
// Pipeline steps must follow deterministic CSS progression / cycle, not manual per-step accents.
const PIPELINE_BLOCK_REGEX = /<Pipeline\b[\s\S]*?(?:\/>|<\/Pipeline>)/g;
const PIPELINE_STEPS_REGEX = /steps=\{\s*\[([\s\S]*?)\]\s*\}/;
const MANUAL_STEP_ACCENT_REGEX = /(?<![-\w])accent\s*[:=]/;

for (const file of slideMdxFiles) {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');

  let match: RegExpExecArray | null;
  PIPELINE_BLOCK_REGEX.lastIndex = 0;
  while ((match = PIPELINE_BLOCK_REGEX.exec(content)) !== null) {
    const pipelineBlock = match[0];
    const stepsMatch = PIPELINE_STEPS_REGEX.exec(pipelineBlock);
    if (stepsMatch && MANUAL_STEP_ACCENT_REGEX.test(stepsMatch[1])) {
      const beforeMatch = content.slice(0, match.index);
      const startLine = beforeMatch.split(/\r?\n/).length;
      error(
        `Manual step accent found inside <Pipeline steps={[...]}> in ${rel}:${startLine}. Pipeline steps must use automatic CSS progression / cycle, not manual per-step accents.`
      );
      rule6Violations++;
    }
  }
}

// 6c. No "accent" attribute on <BentoCard> or <BentoBox>
// Card colors are never controlled individually in MDX/Astro, but exclusively via Slide/Frontmatter and CSS progression.
const BENTO_CONTAINER_TAG_REGEX = /<(?:BentoCard|BentoBox)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

for (const file of slideAuditFiles) {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');

  let match: RegExpExecArray | null;
  BENTO_CONTAINER_TAG_REGEX.lastIndex = 0;
  while ((match = BENTO_CONTAINER_TAG_REGEX.exec(content)) !== null) {
    const attrs = match[1];
    if (/(?<![-\w])accent\s*=/.test(attrs)) {
      const beforeMatch = content.slice(0, match.index);
      const lineNum = beforeMatch.split(/\r?\n/).length;
      error(
        `<BentoCard>/<BentoBox> must not have an accent attribute in ${rel}:${lineNum}. Colors are controlled exclusively at slide level and via CSS progression.`
      );
      rule6Violations++;
    }
  }
}

// 6d. No "accent" or "color" attribute on <MetricStat>
// Stat colors strictly cascade from container / slide accent.
const METRIC_STAT_TAG_REGEX = /<MetricStat\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

for (const file of slideAuditFiles) {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');

  let match: RegExpExecArray | null;
  METRIC_STAT_TAG_REGEX.lastIndex = 0;
  while ((match = METRIC_STAT_TAG_REGEX.exec(content)) !== null) {
    const attrs = match[1];
    if (/(?<![-\w])(accent|color)\s*=/.test(attrs)) {
      const beforeMatch = content.slice(0, match.index);
      const lineNum = beforeMatch.split(/\r?\n/).length;
      error(
        `<MetricStat> must not have an accent or color attribute in ${rel}:${lineNum}. Accent styling strictly cascades from container / slide accent.`
      );
      rule6Violations++;
    }
  }
}

// 6e. No manual item accents in <BarChart items={[...]}>
const BARCHART_BLOCK_REGEX = /<BarChart\b[\s\S]*?(?:\/>|<\/BarChart>)/g;
const BARCHART_ITEMS_REGEX = /items=\{\s*\[([\s\S]*?)\]\s*\}/;
const MANUAL_ITEM_ACCENT_REGEX = /(?<![-\w])(accent|color|highlightColor)\s*[:=]/;

for (const file of slideMdxFiles) {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');

  let match: RegExpExecArray | null;
  BARCHART_BLOCK_REGEX.lastIndex = 0;
  while ((match = BARCHART_BLOCK_REGEX.exec(content)) !== null) {
    const block = match[0];
    const itemsMatch = BARCHART_ITEMS_REGEX.exec(block);
    if (itemsMatch && MANUAL_ITEM_ACCENT_REGEX.test(itemsMatch[1])) {
      const beforeMatch = content.slice(0, match.index);
      const startLine = beforeMatch.split(/\r?\n/).length;
      error(
        `Manual item accent found inside <BarChart items={[...]}> in ${rel}:${startLine}. BarChart items must use automatic cycle or slide accent.`
      );
      rule6Violations++;
    }
  }
}

// 6f. No manual row accents in <ComparisonTable rows={[...]}>
const COMPARISON_TABLE_BLOCK_REGEX = /<ComparisonTable\b[\s\S]*?(?:\/>|<\/ComparisonTable>)/g;
const COMPARISON_TABLE_ROWS_REGEX = /rows=\{\s*\[([\s\S]*?)\]\s*\}/;
const MANUAL_ROW_ACCENT_REGEX = /(?<![-\w])accent\s*[:=]/;

for (const file of slideMdxFiles) {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');

  let match: RegExpExecArray | null;
  COMPARISON_TABLE_BLOCK_REGEX.lastIndex = 0;
  while ((match = COMPARISON_TABLE_BLOCK_REGEX.exec(content)) !== null) {
    const block = match[0];
    const rowsMatch = COMPARISON_TABLE_ROWS_REGEX.exec(block);
    if (rowsMatch && MANUAL_ROW_ACCENT_REGEX.test(rowsMatch[1])) {
      const beforeMatch = content.slice(0, match.index);
      const startLine = beforeMatch.split(/\r?\n/).length;
      error(
        `Manual row accent found inside <ComparisonTable rows={[...]}> in ${rel}:${startLine}. ComparisonTable rows must use automatic cycle or slide accent.`
      );
      rule6Violations++;
    }
  }
}

// 6g. No manual data-accent="..." in presentation MDX content elements
const DATA_ACCENT_REGEX = /\bdata-accent\s*=\s*["'`][^"'`]+["'`]/;

for (const file of slideMdxFiles) {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, idx) => {
    if (DATA_ACCENT_REGEX.test(line)) {
      error(
        `Forbidden manual data-accent attribute found in ${rel}:${idx + 1}. Slide accent is strictly controlled at Slide/Frontmatter level only!\n      Offending code: ${line.trim()}`
      );
      rule6Violations++;
    }
  });
}

// 6h. No nesting <MetricStat> inside <BentoCard> or <BentoBox>
// Metric cards are standalone top-level presentation primitives and must never be nested inside Bento containers.
const BENTO_NESTED_METRIC_REGEX = /<(?:BentoCard|BentoBox)\b[\s\S]*?<\/(?:BentoCard|BentoBox)>/g;

for (const file of slideMdxFiles) {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');

  let match: RegExpExecArray | null;
  BENTO_NESTED_METRIC_REGEX.lastIndex = 0;
  while ((match = BENTO_NESTED_METRIC_REGEX.exec(content)) !== null) {
    const bentoContent = match[0];
    if (bentoContent.includes('<MetricStat')) {
      const beforeMatch = content.slice(0, match.index);
      const lineNum = beforeMatch.split(/\r?\n/).length;
      error(
        `Forbidden nested <MetricStat> found inside <BentoCard>/<BentoBox> in ${rel}:${lineNum}. MetricStat must be a standalone top-level component (e.g. in MetricSlide or SplitSlide).`
      );
      rule6Violations++;
    }
  }
}

// 6i. No raw Tailwind palette classes in Presentation MDX (src/content/presentations/**/*.mdx)
// Slide styling must strictly use CSS variables (var(--card-accent), var(--slide-accent)), canonical domain tokens (text-domain-*, border-domain-*), or neutral tokens (text-white, text-slate-*, bg-black/*).
for (const file of slideMdxFiles) {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, idx) => {
    let match: RegExpExecArray | null;
    RAW_PALETTE_REGEX.lastIndex = 0;
    while ((match = RAW_PALETTE_REGEX.exec(line)) !== null) {
      error(
        `Raw Tailwind palette class "${match[0]}" found in ${rel}:${idx + 1}. Slide styling must strictly use CSS variables (var(--card-accent), var(--slide-accent)), canonical domain tokens (text-domain-*, border-domain-*), or neutral tokens (text-white, text-slate-*, bg-black/*).\n      Offending code: ${line.trim()}`
      );
      rule6Violations++;
    }
  });
}

if (rule6Violations === 0) {
  success('Rule 6 passed: Presentation slides and slide components strictly adhere to accent governance (zero manual accents on BentoCard/BentoBox, MetricStat, Pipeline, BarChart, ComparisonTable, zero manual data-accent attributes, zero nested MetricStat inside BentoCard/BentoBox, and zero raw Tailwind palette classes in slide MDX).');
} else {
  console.log(`⚠️  Rule 6 detected ${rule6Violations} presentation accent governance violation(s).\n`);
}

// ============================================================================
// Final Evaluation
// ============================================================================
if (verbose || errorCount > 0) {
  console.log('----------------------------------------------------------------------');
}
if (errorCount === 0) {
  console.log('✅ [lint:colors] All 6 color token governance rules passed (0 errors).');
  process.exit(0);
} else {
  console.error(`💥 [lint:colors] Color token governance audit failed with ${errorCount} total violation(s).`);
  process.exit(1);
}
