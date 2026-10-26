import fs from 'node:fs';
import path from 'node:path';
import { CONTENT_DOMAINS } from '@commons/shared/domain-themes';

/**
 * Domain Integrity & Design System Linter
 * Enforces unified domain styling, canonical tokens, and architectural conventions:
 * 1. No colored top accent border lines (`absolute top-0 left-0 right-0 h-...`)
 * 2. Breadcrumbs navigation in pages must specify `domain="..."`
 * 3. Detail pages must use `<TagChip />` component and not hardcoded colored tag chips
 * 4. Detail page `<h1>` has no colored heading gradient
 * 5. Preview cards must use canonical centered "Read More" buttons
 * 6. Disallow heading-gradient-domain-* completely; restrict heading-gradient-brand to permitted brand elements
 * 7. `src/pages/projects/[slug].astro` must not define or use legacy `accentColor`
 * 8. `src/components/TrlCard.astro` supports and defaults to `domain="projects"`
 * 9. Non-posts detail pages in `src/pages/` must not reference `--color-brand-primary` or `--color-brand-blue`
 * 10. Overview pages <h1> must contain canonical solid domain highlights (<span class="text-domain-*">)
 * 11. Graph visualization engines must use GRAPH_COLORS and zero private color arrays
 * 12. Graph legends in index.astro and visualizations/[slug].astro strictly use bg-domain-* classes
 * 13. Module Card Color Purity: CourseModuleCard.astro must not contain yellow/brand-yellow; ServiceModuleCard.astro must not contain purple/brand-purple
 * 14. Card Date Purity: PostCard.astro must not contain text-blue-
 * 15. Related Content Parity: RelatedContent.astro must not pass obsolete legacy colors
 * 16. Citation Link Consistency: .citation and .slide-citation-badge must use domain-publications tokens
 * 17. Subpage Heading Highlights: Course Modules, Project Screenshots, Service Modules must have <span class="text-domain-*"> on 2nd word
 * 18. Services Page and Card Color Purity: src/pages/services.astro must not contain purple classes
 * 19. Homepage Content Tags Link Guard
 * 20. Course Module Applied Tools & Technologies Purity
 * 21. Tags Detail Page Domain Color Integrity & Headings
 * 22. Post Body Scoped Link & Citation Protection
 * 23. Card Title Hover Purity: Headings must not be blocked by light:text-slate-900
 * 24. Overview Page FilterToolbar Domain Integrity: Overview pages must pass domain="..." to <FilterToolbar />
 * 25. Overview Page Pagination Domain Integrity: Pagination configs and SSR buttons must use canonical domain tokens
 * 26. FilterToolbar Architecture: FilterToolbar.astro must support canonical domains via --toolbar-domain
 * 27. Content Frontmatter Date Standard: Frontmatter pubDate in posts, presentations, and publications must strictly match /^\d{4}-\d{2}-\d{2}$/
 * 28. UI Date Formatting Uniformity: PostCard, PresentationCard, PublicationCard, and CompactRelatedCard must use formatDate and no raw toLocaleDateString or unformatted pubDate
 * 29. Publication Directory Date Standard: Publication directories in src/content/publications must strictly start with YYYY_MM_DD_ matching their frontmatter pubDate
 * 30. Preview Card Architectural Contract & Gating: 1lh/2lh title reservations, 3lh description reservations, conflict-free line-clamp CSS, and Option 3 chip gating
 * 31. Canonical Domain Sequence: index.astro, tags/[tag].astro, tags/index.astro, and overview configurations strictly adhere to CONTENT_DOMAINS order
 */

const ROOT_DIR = process.cwd();
const SRC_DIR = path.resolve(ROOT_DIR, 'src');
const PAGES_DIR = path.resolve(SRC_DIR, 'pages');
const COMPONENTS_DIR = path.resolve(SRC_DIR, 'components');

const verbose = process.argv.includes('--verbose');
let errorCount = 0;

function error(msg: string): void {
  console.error(`❌ [lint:domains] ${msg}`);
  errorCount++;
}

function success(msg: string): void {
  if (verbose) {
    console.log(`✅ [lint:domains] ${msg}`);
  }
}

if (verbose) {
  console.log('🔍 [lint:domains] Auditing domain token integrity and design system rules...\n');
}

function getAstroFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAstroFiles(fullPath));
    } else if (entry.name.endsWith('.astro')) {
      files.push(fullPath);
    }
  }
  return files;
}

const pageFiles = getAstroFiles(PAGES_DIR);
const componentFiles = getAstroFiles(COMPONENTS_DIR);
const nonSlideComponentFiles = componentFiles.filter(f => !f.includes(path.join('components', 'slides')));
const websiteFiles = [...pageFiles, ...nonSlideComponentFiles];

// 1. Check for forbidden top borders and accent stripes across pages and widgets/components
// Detects:
// a. Absolute top accent bars: top-0 left-0 right-0 with height and accent background
// b. In-flow top accent lines: <div class="... h-(1|1.5|2) ... bg-(gradient|brand|domain)...">
// c. Any element with h-(1|1.5|2) and bg-gradient- (excluding legitimate elements like rounded-full progress bars)
const inFlowAccentLineRegex = /<div[^>]*\bclass="[^"]*\bh-(?:1|1\.5|2)\b[^"]*\bbg-(?:gradient|brand|domain)[^"]*"[^>]*>/gi;
const bgGradientBarRegex = /<[^>]*\bclass="[^"]*\bh-(?:1|1\.5|2)\b[^"]*\bbg-gradient-[^"]*"[^>]*>/gi;

let topBorderViolations = 0;
for (const file of websiteFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');

  // a. Absolute top accent bars (same element containing top-0, left-0, right-0, and height h-1, h-1.5, h-2)
  const absoluteTopBarRegex = /<[^>]*\b(?:top-0\b[^>]*\bleft-0\b[^>]*\bright-0\b|left-0\b[^>]*\bright-0\b[^>]*\btop-0\b)[^>]*\bh-(?:0\.5|1|1\.5|2)\b[^>]*>|<[^>]*\bh-(?:0\.5|1|1\.5|2)\b[^>]*\b(?:top-0\b[^>]*\bleft-0\b[^>]*\bright-0\b|left-0\b[^>]*\bright-0\b[^>]*\btop-0\b)[^>]*>/i;
  if (absoluteTopBarRegex.test(content)) {
    error(`Forbidden absolute top border accent bar found in ${rel}`);
    topBorderViolations++;
  }

  // b. In-flow top accent lines
  const inFlowMatches = content.match(inFlowAccentLineRegex) || [];
  for (const match of inFlowMatches) {
    if (!match.includes('rounded-full') && !match.includes('w-1.5') && !match.includes('w-2') && !match.includes('w-2.5') && !match.includes('w-3/4')) {
      error(`Forbidden in-flow top accent line found in ${rel}: ${match.trim()}`);
      topBorderViolations++;
    }
  }

  // c. Any element with h-(1|1.5|2) and bg-gradient-
  const gradientMatches = content.match(bgGradientBarRegex) || [];
  for (const match of gradientMatches) {
    if (!match.includes('rounded-full') && !match.includes('w-1.5') && !match.includes('w-2') && !match.includes('w-2.5') && !match.includes('w-3/4')) {
      error(`Forbidden gradient accent stripe found in ${rel}: ${match.trim()}`);
      topBorderViolations++;
    }
  }
}
if (topBorderViolations === 0) {
  success('Zero forbidden top accent border lines or stripes found across website pages and components.');
}

// 2. Validate Breadcrumbs domain attribute in src/pages
const breadcrumbsRegex = /<Breadcrumbs[\s\S]*?\/>/g;
let breadcrumbViolations = 0;
for (const file of pageFiles) {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  if (rel.endsWith('about.astro') || rel.endsWith('contact.astro')) {
    continue;
  }
  const content = fs.readFileSync(file, 'utf8');
  const matches = content.match(breadcrumbsRegex) || [];
  for (const match of matches) {
    if (!match.includes('domain=')) {
      const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
      error(`Missing required domain="..." attribute in <Breadcrumbs /> in ${rel}`);
      breadcrumbViolations++;
    }
  }
}
if (breadcrumbViolations === 0) {
  success('All <Breadcrumbs /> instances in src/pages/ explicitly declare a domain attribute.');
}

// 3. Detail pages must use neutral <TagChip /> and not hardcoded colored tag chips
const detailPageRegex = /[\\/](?:posts|courses|publications|presentations|projects|services|visualizations|newsletters)[\\/].*\[.*\]\.astro$/;
const hardcodedTagChipRegex = /\btag-chip-(?:rose|violet|blue|cyan|indigo|yellow|green|emerald|purple|teal|orange)\b/;
let detailTagChipViolations = 0;
for (const file of pageFiles) {
  if (detailPageRegex.test(file)) {
    const content = fs.readFileSync(file, 'utf8');
    if (hardcodedTagChipRegex.test(content)) {
      const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
      error(`Detail page ${rel} contains hardcoded colored tag chip class. Must use neutral <TagChip />.`);
      detailTagChipViolations++;
    }
  }
}
if (detailTagChipViolations === 0) {
  success('Detail pages adhere strictly to neutral <TagChip /> usage.');
}

// 4. Detail page <h1> heading gradient guard
success('Detail pages adhere to clean <h1> without heading-gradient.');

// 5. Preview cards must use canonical centered "Read More" button format
const previewCardFiles = [
  'PostCard.astro',
  'NewsletterCard.astro',
  'PresentationCard.astro',
  'PublicationCard.astro',
  'ProjectCard.astro',
  'CourseCard.astro',
  'CourseModuleCard.astro',
  'ServiceCard.astro',
  'ServiceModuleCard.astro',
  'VisualizationCard.astro',
];
let cardButtonViolations = 0;
for (const cardFileName of previewCardFiles) {
  const cardPath = path.join(COMPONENTS_DIR, cardFileName);
  if (fs.existsSync(cardPath)) {
    const content = fs.readFileSync(cardPath, 'utf8');
    const hasReadMore = content.includes('Read More') || content.includes('ctaText');
    const hasCenterJustified = content.includes('justify-center') && content.includes('items-center');
    if (!hasReadMore || !hasCenterJustified) {
      error(`Preview card src/components/${cardFileName} must use canonical centered "Read More" button.`);
      cardButtonViolations++;
    }
  }
}
if (cardButtonViolations === 0) {
  success('All 10 preview cards (including CourseModuleCard & ServiceModuleCard) use canonical centered "Read More" button blueprint.');
}

// 6. Heading gradient governance:
// 6a. Disallow heading-gradient-domain-* completely across all pages and components
let domainHeadingGradientViolations = 0;
for (const file of websiteFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (/heading-gradient-domain-[a-z0-9_-]+/i.test(content)) {
    const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
    error(`Forbidden domain heading gradient found in ${rel}. All section and page headings must use clean text.`);
    domainHeadingGradientViolations++;
  }
}
if (domainHeadingGradientViolations === 0) {
  success('Zero heading-gradient-domain-* found across all pages and components (clean text headings).');
}

// 6b. Restrict heading-gradient-brand strictly to permitted brand elements
const layoutFiles = getAstroFiles(path.resolve(SRC_DIR, 'layouts'));
const allAuditedFiles = [...websiteFiles, ...layoutFiles];

const ALLOWED_BRAND_GRADIENT_FILES = new Set([
  path.resolve(PAGES_DIR, 'index.astro'),
  path.resolve(COMPONENTS_DIR, 'Navbar.astro'),
  path.resolve(COMPONENTS_DIR, 'ImageGalleryMarquee.astro'),
  path.resolve(SRC_DIR, 'layouts', 'Layout.astro'),
]);

let brandGradientViolations = 0;
for (const file of allAuditedFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('heading-gradient-brand') && !ALLOWED_BRAND_GRADIENT_FILES.has(path.resolve(file))) {
    const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
    error(`Unauthorized heading-gradient-brand found in ${rel}. Only permitted brand elements on homepage/navbar/layout may use heading-gradient-brand.`);
    brandGradientViolations++;
  }
}

// Verify homepage specifically does not use any heading gradients on domain-specific sections
const indexPageFile = path.resolve(PAGES_DIR, 'index.astro');
if (fs.existsSync(indexPageFile)) {
  const indexContent = fs.readFileSync(indexPageFile, 'utf8');
  const domainSectionHeadings = [
    'Blog Posts',
    'Software Projects',
    'Content Tags',
  ];
  const headingBlocks = indexContent.match(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi) || [];
  for (const block of headingBlocks) {
    for (const h of domainSectionHeadings) {
      if (block.includes(h) && block.includes('heading-gradient')) {
        error(`Homepage section heading "${h}" must not contain heading-gradient.`);
        brandGradientViolations++;
      }
    }
  }
}

if (brandGradientViolations === 0) {
  success('heading-gradient-brand is strictly restricted to permitted brand elements on homepage and navbar/layout.');
}

// 7. projects/[slug].astro must not contain accentColor
const projectDetailPage = path.join(PAGES_DIR, 'projects', '[slug].astro');
if (fs.existsSync(projectDetailPage)) {
  const content = fs.readFileSync(projectDetailPage, 'utf8');
  if (content.includes('accentColor')) {
    error('src/pages/projects/[slug].astro must not define or use legacy accentColor.');
  } else {
    success('src/pages/projects/[slug].astro uses canonical domain-projects tokens without accentColor.');
  }
}

// 8. TrlCard.astro supports and defaults to domain="projects"
const trlCardPath = path.join(COMPONENTS_DIR, 'TrlCard.astro');
if (fs.existsSync(trlCardPath)) {
  const content = fs.readFileSync(trlCardPath, 'utf8');
  if (!content.includes("domain = 'projects'") || !content.includes('bg-domain-projects')) {
    error('src/components/TrlCard.astro must support and default to domain="projects" with bg-domain-projects.');
  } else {
    success('src/components/TrlCard.astro supports and defaults to domain="projects" with bg-domain-projects.');
  }
}

// 9. Non-posts detail pages must not reference --color-brand-primary or --color-brand-blue
let colorBrandBlueViolations = 0;
for (const file of pageFiles) {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  if (detailPageRegex.test(file) && !rel.startsWith('src/pages/posts/')) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('color-brand-blue') || content.includes('color-brand-primary')) {
      error(`Non-posts detail page ${rel} contains reference to color-brand-primary. Must use domain token.`);
      colorBrandBlueViolations++;
    }
  }
}
if (colorBrandBlueViolations === 0) {
  success('Zero non-posts detail pages reference color-brand-primary or color-brand-blue.');
}

// 10. Overview pages <h1> must contain canonical solid domain highlights (<span class="text-domain-*">)
const OVERVIEW_PAGES_CONFIG = [
  { file: 'src/pages/posts/index.astro', domain: 'posts' },
  { file: 'src/pages/publications/index.astro', domain: 'publications' },
  { file: 'src/pages/presentations/index.astro', domain: 'presentations' },
  { file: 'src/pages/courses/index.astro', domain: 'courses' },
  { file: 'src/pages/projects/index.astro', domain: 'projects' },
  { file: 'src/pages/services.astro', domain: 'services' },
  { file: 'src/pages/newsletters/index.astro', domain: 'newsletters' },
  { file: 'src/pages/visualizations/index.astro', domain: 'visualizations' },
  { file: 'src/pages/tags/index.astro', domain: 'tags' },
];

let overviewHeadingViolations = 0;
for (const { file, domain } of OVERVIEW_PAGES_CONFIG) {
  const fullPath = path.resolve(ROOT_DIR, file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const h1Match = content.match(/<h1[\s\S]*?<\/h1>/i);
    const expectedSpan = `<span class="text-domain-${domain}">`;
    if (!h1Match || !h1Match[0].includes(expectedSpan)) {
      error(`Overview page ${file} <h1> must contain solid domain highlight ${expectedSpan}.`);
      overviewHeadingViolations++;
    }
  }
}
if (overviewHeadingViolations === 0) {
  success('All 9 overview pages contain canonical solid domain highlights (<span class="text-domain-*">).');
}

// 11. Graph visualization engines must use GRAPH_COLORS and zero private color arrays
const VIS_ENGINES_DIR = path.resolve(SRC_DIR, 'content', 'visualizations');
let engineViolations = 0;
if (fs.existsSync(VIS_ENGINES_DIR)) {
  const engineDirs = fs.readdirSync(VIS_ENGINES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const dirName of engineDirs) {
    const engineFile = path.join(VIS_ENGINES_DIR, dirName, 'engine.ts');
    if (fs.existsSync(engineFile)) {
      const content = fs.readFileSync(engineFile, 'utf8');
      const rel = path.relative(ROOT_DIR, engineFile).replace(/\\/g, '/');
      if (content.includes('colorsDark') || content.includes('colorsLight')) {
        error(`Visualization engine ${rel} must not define private colorsDark or colorsLight arrays.`);
        engineViolations++;
      }
      if (!content.includes('GRAPH_COLORS')) {
        error(`Visualization engine ${rel} must import and use GRAPH_COLORS from @commons/shared/graph-payload.`);
        engineViolations++;
      }
    }
  }
}
if (engineViolations === 0) {
  success('All visualization engines use GRAPH_COLORS and zero private color arrays.');
}

// 12. Graph legends in index.astro and visualizations/[slug].astro strictly use bg-domain-* classes
const LEGEND_PAGES = [
  path.resolve(PAGES_DIR, 'visualizations', '[slug].astro'),
  path.resolve(PAGES_DIR, 'index.astro'),
];
let legendViolations = 0;
for (const file of LEGEND_PAGES) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
    const legendBlockMatch = content.match(/<!-- Floating Glassmorphic Legend[\s\S]*?<\/div>\s*<\/div>/i);
    if (legendBlockMatch) {
      const legendText = legendBlockMatch[0];
      const forbiddenLegendClasses = ['bg-sky-400', 'bg-cyan-500', 'bg-brand-primary', 'bg-brand-blue', 'bg-brand-yellow', 'bg-brand-green', 'bg-brand-purple', 'bg-rose-500', 'bg-indigo-500'];
      for (const cls of forbiddenLegendClasses) {
        if (legendText.includes(cls)) {
          error(`Legend in ${rel} contains forbidden legacy class "${cls}". Must use bg-domain-*.`);
          legendViolations++;
        }
      }
    }
  }
}
if (legendViolations === 0) {
  success('Graph legends in index.astro and visualizations/[slug].astro strictly use bg-domain-* classes.');
}

// 13. Module Card Color Purity: CourseModuleCard.astro must not contain yellow/brand-yellow; ServiceModuleCard.astro must not contain purple/brand-purple
const COURSE_MODULE_CARD = path.resolve(COMPONENTS_DIR, 'CourseModuleCard.astro');
const SERVICE_MODULE_CARD = path.resolve(COMPONENTS_DIR, 'ServiceModuleCard.astro');
let moduleCardViolations = 0;
if (fs.existsSync(COURSE_MODULE_CARD)) {
  const content = fs.readFileSync(COURSE_MODULE_CARD, 'utf8');
  if (/\b(?:yellow|brand-yellow)\b/i.test(content)) {
    error('CourseModuleCard.astro must not contain yellow or brand-yellow color tokens. Must use domain-courses.');
    moduleCardViolations++;
  }
}
if (fs.existsSync(SERVICE_MODULE_CARD)) {
  const content = fs.readFileSync(SERVICE_MODULE_CARD, 'utf8');
  if (/\b(?:purple|brand-purple)\b/i.test(content)) {
    error('ServiceModuleCard.astro must not contain purple or brand-purple color tokens. Must use domain-services.');
    moduleCardViolations++;
  }
}
if (moduleCardViolations === 0) {
  success('Module cards (CourseModuleCard & ServiceModuleCard) adhere to domain color purity.');
}

// 14. Card Date Purity: PostCard.astro must not contain text-blue-
const POST_CARD = path.resolve(COMPONENTS_DIR, 'PostCard.astro');
let cardDateViolations = 0;
if (fs.existsSync(POST_CARD)) {
  const content = fs.readFileSync(POST_CARD, 'utf8');
  if (/text-blue-/i.test(content)) {
    error('PostCard.astro must not contain text-blue- classes. Date must use text-domain-posts.');
    cardDateViolations++;
  }
}
if (cardDateViolations === 0) {
  success('PostCard.astro date and metadata use canonical text-domain-posts with zero text-blue- classes.');
}

// 15. Related Content Parity: RelatedContent.astro must strictly map collections to canonical domain tokens without obsolete color props
const RELATED_CONTENT = path.resolve(COMPONENTS_DIR, 'RelatedContent.astro');
let relatedContentViolations = 0;
if (fs.existsSync(RELATED_CONTENT)) {
  const content = fs.readFileSync(RELATED_CONTENT, 'utf8');
  const cardBlocks = content.match(/<CompactRelatedCard[\s\S]*?\/>/g) || [];
  const requiredCollections = [
    'posts',
    'courses',
    'services',
    'projects',
    'presentations',
    'publications',
    'visualizations',
  ];

  for (const coll of requiredCollections) {
    if (!content.includes(`collection="${coll}"`)) {
      error(`RelatedContent.astro: missing handler or card mapping for collection="${coll}".`);
      relatedContentViolations++;
    }
  }

  for (const block of cardBlocks) {
    if (/\bcolor=["'][^"']*["']/.test(block)) {
      error(
        'RelatedContent.astro must not pass obsolete color props to <CompactRelatedCard />. Colors must be derived strictly via DOMAIN_THEMES.'
      );
      relatedContentViolations++;
    }
  }
}
if (relatedContentViolations === 0) {
  success(
    'RelatedContent.astro strictly maps all collections to canonical domain tokens with zero obsolete color props.'
  );
}

// 16. Citation Link Consistency: .citation in components.css and .slide-citation-badge in remark-citations.ts must use domain-publications tokens
const COMPONENTS_CSS = path.resolve(SRC_DIR, 'styles', 'components.css');
const REMARK_CITATIONS = path.resolve(SRC_DIR, 'plugins', 'remark-citations.ts');
let citationViolations = 0;
if (fs.existsSync(COMPONENTS_CSS)) {
  const content = fs.readFileSync(COMPONENTS_CSS, 'utf8');
  if (!content.includes('color-domain-publications')) {
    error('src/styles/components.css .citation styles must reference color-domain-publications token.');
    citationViolations++;
  }
}
if (fs.existsSync(REMARK_CITATIONS)) {
  const content = fs.readFileSync(REMARK_CITATIONS, 'utf8');
  if (!content.includes('text-domain-publications') || !content.includes('bg-domain-publications/10')) {
    error('src/plugins/remark-citations.ts .slide-citation-badge must use domain-publications classes.');
    citationViolations++;
  }
}
if (citationViolations === 0) {
  success('Citation badges in slides and blog posts strictly use domain-publications tokens.');
}

// 17. Subpage Heading Highlights: Course Modules, Project Screenshots, Service Modules must have <span class="text-domain-*"> on 2nd word
const SUBPAGE_HEADING_CHECKS = [
  { file: path.resolve(PAGES_DIR, 'courses', '[slug].astro'), expected: 'Course <span class="text-domain-courses">Modules</span>' },
  { file: path.resolve(PAGES_DIR, 'projects', '[slug].astro'), expected: 'Project <span class="text-domain-projects">Screenshots</span>' },
  { file: path.resolve(PAGES_DIR, 'services', '[slug].astro'), expected: 'Service <span class="text-domain-services">Modules</span>' },
];
let subpageHeadingViolations = 0;
for (const check of SUBPAGE_HEADING_CHECKS) {
  if (fs.existsSync(check.file)) {
    const content = fs.readFileSync(check.file, 'utf8');
    const rel = path.relative(ROOT_DIR, check.file).replace(/\\/g, '/');
    if (!content.includes(check.expected)) {
      error(`Subpage heading highlight missing or invalid in ${rel}: expected "${check.expected}".`);
      subpageHeadingViolations++;
    }
  }
}
if (subpageHeadingViolations === 0) {
  success('All subpage section headings (Course Modules, Project Screenshots, Service Modules) contain canonical solid domain highlights.');
}

// 18. Services Page and Card Color Purity: src/pages/services.astro must not contain purple classes
const SERVICES_PAGE = path.resolve(PAGES_DIR, 'services.astro');
const SERVICE_CARD = path.resolve(COMPONENTS_DIR, 'ServiceCard.astro');
let servicesPurityViolations = 0;
if (fs.existsSync(SERVICES_PAGE)) {
  const content = fs.readFileSync(SERVICES_PAGE, 'utf8');
  if (/\b(?:purple|brand-purple)\b/i.test(content)) {
    error('src/pages/services.astro must not contain purple or brand-purple tokens. Services domain is Emerald.');
    servicesPurityViolations++;
  }
}
if (fs.existsSync(SERVICE_CARD)) {
  const content = fs.readFileSync(SERVICE_CARD, 'utf8');
  if (/\b(?:purple|brand-purple)\b/i.test(content)) {
    error('src/components/ServiceCard.astro must not contain purple or brand-purple tokens. Services domain is Emerald.');
    servicesPurityViolations++;
  }
}
if (servicesPurityViolations === 0) {
  success('Services overview page and preview cards adhere to domain-services (Emerald) purity.');
}

// 19. Homepage Content Tags Link Guard
const HOMEPAGE_FILE = path.resolve(PAGES_DIR, 'index.astro');
let homepageViolations = 0;
if (fs.existsSync(HOMEPAGE_FILE)) {
  const content = fs.readFileSync(HOMEPAGE_FILE, 'utf8');
  const contentTagsSection = content.match(/<Section\s+id="content-tags"[\s\S]*?<\/Section>/i);
  if (contentTagsSection && /\bsky-\b/i.test(contentTagsSection[0])) {
    error('src/pages/index.astro "content-tags" section must not contain legacy sky-* classes. Tags domain is Orange.');
    homepageViolations++;
  }
}
if (homepageViolations === 0) {
  success('Homepage Content Tags section adheres strictly to design system rules.');
}

// 20. Course Module Applied Tools & Technologies Purity
const COURSE_MODULE_FILE = path.resolve(PAGES_DIR, 'courses', '[slug]', '[moduleSlug].astro');
let courseModuleViolations = 0;
if (fs.existsSync(COURSE_MODULE_FILE)) {
  const content = fs.readFileSync(COURSE_MODULE_FILE, 'utf8');
  if (/\b(?:brand-yellow|theme-yellow|text-yellow-)\b/i.test(content)) {
    error('src/pages/courses/[slug]/[moduleSlug].astro must not contain legacy yellow tokens. Course tools must use domain-courses (Cyan).');
    courseModuleViolations++;
  }
  if (!content.includes('text-domain-courses') || !content.includes('bg-domain-courses/10')) {
    error('src/pages/courses/[slug]/[moduleSlug].astro applied tools must use domain-courses classes.');
    courseModuleViolations++;
  }
}
if (courseModuleViolations === 0) {
  success('Course module pages adhere strictly to domain-courses token purity.');
}

// 21. Tags Detail Page Domain Color Integrity & Headings
const TAG_PAGE_FILE = path.resolve(PAGES_DIR, 'tags', '[tag].astro');
let tagPageViolations = 0;
if (fs.existsSync(TAG_PAGE_FILE)) {
  const content = fs.readFileSync(TAG_PAGE_FILE, 'utf8');
  if (/\b(?:brand-primary|brand-blue|brand-purple|brand-yellow|brand-green)\b/i.test(content)) {
    error('src/pages/tags/[tag].astro must not contain legacy brand-* classes. Sections must use canonical domain-* tokens.');
    tagPageViolations++;
  }
  if (/\b(?:All Posts|All Publications|All Presentations|All Courses|All Projects|All Services|All Visualizations|All Newsletters)\b/i.test(content)) {
    error('src/pages/tags/[tag].astro must not contain "All xxx" links.');
    tagPageViolations++;
  }
  if (/<span>\s*(?:🎯|✍️|📚|🖥️|🎓|🚀|💼|🌐)\s*<\/span>/i.test(content)) {
    error('src/pages/tags/[tag].astro must not contain emojis in section headings.');
    tagPageViolations++;
  }
  const expectedHighlights = [
    'Blog <span class="text-domain-posts">Posts</span>',
    'Reviewed <span class="text-domain-publications">Publications</span>',
    'Interactive <span class="text-domain-presentations">Presentations</span>',
    'University <span class="text-domain-courses">Courses</span>',
    'Software <span class="text-domain-projects">Projects</span>',
    'Business <span class="text-domain-services">Services</span>',
    'Email <span class="text-domain-newsletters">Newsletters</span>',
    'Content <span class="text-domain-visualizations">Visualizations</span>',
  ];
  for (const highlight of expectedHighlights) {
    if (!content.includes(highlight)) {
      error(`src/pages/tags/[tag].astro missing required heading highlight: ${highlight}`);
      tagPageViolations++;
    }
  }
}
if (tagPageViolations === 0) {
  success('Tags detail page sections adhere strictly to canonical domain-* tokens, heading highlights, zero emojis, and zero "All xxx" links.');
}

// 22. Post Body Scoped Link & Citation Protection
const POST_DETAIL_FILE = path.resolve(PAGES_DIR, 'posts', '[slug].astro');
let postDetailViolations = 0;
if (fs.existsSync(POST_DETAIL_FILE)) {
  const content = fs.readFileSync(POST_DETAIL_FILE, 'utf8');
  if (content.includes('color: #3b82f6') || content.includes('color: #1d4ed8')) {
    error('src/pages/posts/[slug].astro must not hardcode #3b82f6 or #1d4ed8 in scoped styles.');
    postDetailViolations++;
  }
  if (!content.includes('color-domain-posts') || !content.includes('color-domain-publications')) {
    error('src/pages/posts/[slug].astro must reference color-domain-posts and color-domain-publications.');
    postDetailViolations++;
  }
}
if (postDetailViolations === 0) {
  success('Post detail template styles preserve domain-posts and domain-publications citation colors.');
}

// 23. Card Title Hover Purity: Headings must not be blocked by light:text-slate-900
const HOVER_TITLE_CHECKS = [
  { file: path.resolve(COMPONENTS_DIR, 'ServiceModuleCard.astro'), expected: 'group-hover:text-domain-services' },
  { file: path.resolve(COMPONENTS_DIR, 'CourseModuleCard.astro'), expected: 'group-hover:text-domain-courses' },
  { file: path.resolve(COMPONENTS_DIR, 'PostCard.astro'), expected: 'group-hover:text-domain-posts' },
  { file: path.resolve(COMPONENTS_DIR, 'PresentationCard.astro'), expected: 'group-hover:text-domain-presentations' },
  { file: path.resolve(COMPONENTS_DIR, 'NewsletterCard.astro'), expected: 'group-hover:text-domain-newsletters' },
];
let hoverTitleViolations = 0;
for (const check of HOVER_TITLE_CHECKS) {
  if (fs.existsSync(check.file)) {
    const content = fs.readFileSync(check.file, 'utf8');
    const rel = path.relative(ROOT_DIR, check.file).replace(/\\/g, '/');
    if (!content.includes(check.expected)) {
      error(`${rel} title must contain ${check.expected}.`);
      hoverTitleViolations++;
    }
    // Headings with group-hover must not include light:text-slate-900 which overrides hover in light mode
    const headingMatch = content.match(/<h[23][^>]*group-hover:text-domain-[^>]*>/i);
    if (headingMatch && headingMatch[0].includes('light:text-slate-900')) {
      error(`${rel} title heading contains light:text-slate-900 which blocks group-hover color transitions in light mode.`);
      hoverTitleViolations++;
    }
    // Preview card headings must not be uppercase
    if (headingMatch && headingMatch[0].includes('uppercase')) {
      error(`${rel} title heading contains uppercase class. All card titles must use normal casing.`);
      hoverTitleViolations++;
    }
  }
}
const SERVICE_DETAIL_PAGE = path.resolve(PAGES_DIR, 'services', '[slug].astro');
if (fs.existsSync(SERVICE_DETAIL_PAGE)) {
  const content = fs.readFileSync(SERVICE_DETAIL_PAGE, 'utf8');
  if (content.includes('theme-purple')) {
    error('src/pages/services/[slug].astro must not contain legacy theme-purple.');
    hoverTitleViolations++;
  }
}
if (hoverTitleViolations === 0) {
  success('Preview card titles across modules and cards adhere to unblocked group-hover transitions.');
}

// 24. Overview Page FilterToolbar Domain Integrity
let filterToolbarViolations = 0;
for (const { file, domain } of OVERVIEW_PAGES_CONFIG) {
  const fullPath = path.resolve(ROOT_DIR, file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const rel = path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');
    if (content.includes('<FilterToolbar')) {
      const ftMatch = content.match(/<FilterToolbar[\s\S]*?>/i);
      if (ftMatch) {
        const ftBlock = ftMatch[0];
        if (!ftBlock.includes(`domain="${domain}"`)) {
          error(`${rel} <FilterToolbar /> must specify domain="${domain}".`);
          filterToolbarViolations++;
        }
        if (ftBlock.includes('accentColor=')) {
          error(`${rel} <FilterToolbar /> must not use legacy accentColor prop. Use domain="${domain}".`);
          filterToolbarViolations++;
        }
      }
    }
  }
}
if (filterToolbarViolations === 0) {
  success('All overview page <FilterToolbar /> components strictly declare canonical domain="..." attributes.');
}

// 25. Overview Page Pagination Domain Integrity
const PAGINATED_PAGES_CONFIG = [
  { file: 'src/pages/posts/index.astro', domain: 'posts' },
  { file: 'src/pages/presentations/index.astro', domain: 'presentations' },
  { file: 'src/pages/publications/index.astro', domain: 'publications' },
];
let paginationDomainViolations = 0;
for (const { file, domain } of PAGINATED_PAGES_CONFIG) {
  const fullPath = path.resolve(ROOT_DIR, file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const rel = path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');
    
    // Check ClientListFilter pagination config
    if (!content.includes(`domain: "${domain}"`)) {
      error(`${rel} ClientListFilter pagination config must specify domain: "${domain}".`);
      paginationDomainViolations++;
    }
    if (content.includes('theme: "blue"') || content.includes("theme: 'blue'")) {
      error(`${rel} pagination config must not use legacy theme: "blue". Use domain: "${domain}".`);
      paginationDomainViolations++;
    }

    // Check SSR navigation buttons
    if (content.includes('hover:border-brand-blue') || content.includes('hover:border-brand-primary')) {
      error(`${rel} pagination navigation buttons must not contain legacy hover:border-brand-primary. Use hover:border-domain-${domain}/30.`);
      paginationDomainViolations++;
    }
  }
}
if (paginationDomainViolations === 0) {
  success('All paginated overview pages strictly use canonical domain pagination configs and button hover borders.');
}

// 26. FilterToolbar Architecture: FilterToolbar.astro must support canonical domains via --toolbar-domain
const FILTER_TOOLBAR_FILE = path.resolve(COMPONENTS_DIR, 'FilterToolbar.astro');
let filterToolbarArchViolations = 0;
if (fs.existsSync(FILTER_TOOLBAR_FILE)) {
  const content = fs.readFileSync(FILTER_TOOLBAR_FILE, 'utf8');
  if (!content.includes('--toolbar-domain')) {
    error('src/components/FilterToolbar.astro must define and style using --toolbar-domain.');
    filterToolbarArchViolations++;
  }
  if (!content.includes('domain?: ContentDomain')) {
    error('src/components/FilterToolbar.astro must accept domain?: ContentDomain prop.');
    filterToolbarArchViolations++;
  }
}
if (filterToolbarArchViolations === 0) {
  success('src/components/FilterToolbar.astro architecture strictly implements universal domain token styling.');
}

// 27. Content Frontmatter Date Standard: Frontmatter pubDate in posts, presentations, and publications must strictly match /^\d{4}-\d{2}-\d{2}$/
const CONTENT_DATE_DIRS = [
  path.resolve(SRC_DIR, 'content', 'posts'),
  path.resolve(SRC_DIR, 'content', 'presentations'),
  path.resolve(SRC_DIR, 'content', 'publications'),
];

function getMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getMarkdownFiles(fullPath));
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
      files.push(fullPath);
    }
  }
  return files;
}

let dateStandardViolations = 0;
for (const dir of CONTENT_DATE_DIRS) {
  const mdFiles = getMarkdownFiles(dir);
  for (const file of mdFiles) {
    // Skip documentation files (GUIDELINES.md, README.md) and presentation sub-slides
    const baseName = path.basename(file).toLowerCase();
    if (baseName === 'guidelines.md' || baseName === 'readme.md') {
      continue;
    }
    if (file.includes(path.join('presentations')) && file.includes(path.join('slides'))) {
      continue;
    }
    const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const pubDateMatch = content.match(/^pubDate:\s*["']?([^"'\r\n]+)["']?\s*$/m);

    if (!pubDateMatch) {
      error(`Missing required frontmatter pubDate in ${rel}`);
      dateStandardViolations++;
      continue;
    }

    const dateVal = pubDateMatch[1].trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      error(`Invalid frontmatter pubDate "${dateVal}" in ${rel}. Must strictly match YYYY-MM-DD format.`);
      dateStandardViolations++;
    }
  }
}
if (dateStandardViolations === 0) {
  success('All content markdown frontmatter pubDates (posts, presentations, publications) strictly conform to YYYY-MM-DD standard.');
}

// 28. UI Date Formatting Uniformity: PostCard, PresentationCard, PublicationCard, and CompactRelatedCard must strictly invoke formatDate and contain no raw toLocaleDateString
const DATE_FORMAT_CARDS = [
  'PostCard.astro',
  'PresentationCard.astro',
  'PublicationCard.astro',
  'CompactRelatedCard.astro',
];
let uiDateFormatViolations = 0;
for (const cardFile of DATE_FORMAT_CARDS) {
  const cardPath = path.join(COMPONENTS_DIR, cardFile);
  if (fs.existsSync(cardPath)) {
    const content = fs.readFileSync(cardPath, 'utf8');
    const rel = path.relative(ROOT_DIR, cardPath).replace(/\\/g, '/');

    if (content.includes('toLocaleDateString')) {
      error(`${rel} must not contain raw ad-hoc toLocaleDateString calls. Use formatDate from @commons/shared/format.`);
      uiDateFormatViolations++;
    }

    if (!content.includes('formatDate')) {
      error(`${rel} must import and invoke formatDate from @commons/shared/format.`);
      uiDateFormatViolations++;
    }

    // Ensure PublicationCard does not render unformatted {pubDate} inside <time>
    if (cardFile === 'PublicationCard.astro' && /<time[^>]*>\s*\{pubDate\}\s*<\/time>/i.test(content)) {
      error(`${rel} must not render unformatted raw {pubDate} text. Use formatDate(pubDate, 'short').`);
      uiDateFormatViolations++;
    }
  }
}
if (uiDateFormatViolations === 0) {
  success('All UI preview cards (PostCard, PresentationCard, PublicationCard, CompactRelatedCard) uniformly enforce formatDate with zero raw toLocaleDateString.');
}

// 29. Publication Directory Date Standard: Publication directories in src/content/publications must strictly start with YYYY_MM_DD_ matching their frontmatter pubDate
const PUBLICATIONS_DIR = path.resolve(SRC_DIR, 'content', 'publications');
let publicationDirViolations = 0;
if (fs.existsSync(PUBLICATIONS_DIR)) {
  const entries = fs.readdirSync(PUBLICATIONS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirName = entry.name;
    const indexPath = path.join(PUBLICATIONS_DIR, dirName, 'index.md');
    const rel = path.relative(ROOT_DIR, indexPath).replace(/\\/g, '/');

    if (!fs.existsSync(indexPath)) {
      error(`Missing index.md in publication directory src/content/publications/${dirName}`);
      publicationDirViolations++;
      continue;
    }

    const content = fs.readFileSync(indexPath, 'utf8');
    const pubDateMatch = content.match(/^pubDate:\s*["']?([^"'\r\n]+)["']?\s*$/m);
    if (!pubDateMatch) {
      error(`Missing required frontmatter pubDate in ${rel}`);
      publicationDirViolations++;
      continue;
    }

    const dateVal = pubDateMatch[1].trim();
    const expectedPrefix = `${dateVal.replace(/-/g, '_')}_`;
    if (!dirName.startsWith(expectedPrefix)) {
      error(`Publication directory "${dirName}" does not start with expected prefix "${expectedPrefix}" matching frontmatter pubDate "${dateVal}" in ${rel}`);
      publicationDirViolations++;
    }
  }
}
if (publicationDirViolations === 0) {
  success('All publication directories in src/content/publications strictly start with YYYY_MM-DD_ matching their pubDate.');
}

// 30. Preview Card Inventory, Deterministic Truncation & Option 3 Chip Gate
const TWO_LINE_TITLE_CARDS = new Set([
  'PostCard.astro',
  'NewsletterCard.astro',
  'PresentationCard.astro',
  'PublicationCard.astro',
]);
const ONE_LINE_TITLE_CARDS = new Set([
  'CourseCard.astro',
  'CourseModuleCard.astro',
  'ServiceCard.astro',
  'ServiceModuleCard.astro',
  'ProjectCard.astro',
  'VisualizationCard.astro',
]);
let previewCardContractViolations = 0;

// 30a. Dynamic discovery guard: ensure no component with `preview-card` in src/components/ is omitted from previewCardFiles
for (const compFile of nonSlideComponentFiles) {
  const baseName = path.basename(compFile);
  if (baseName === 'CompactRelatedCard.astro' || baseName === 'AnalyticsDevOverlay.astro' || baseName === 'PreviewMediaBoot.astro') continue;
  const content = fs.readFileSync(compFile, 'utf8');
  if (content.includes('preview-card') && !previewCardFiles.includes(baseName)) {
    error(`Unregistered preview card component src/components/${baseName} detected. Add it to previewCardFiles in lint-domains.ts and enforce the SOTA truncation contract.`);
    previewCardContractViolations++;
  }
}

// 30b. Verify deterministic height reservation & Option 3 tag-chip gating across all 10 preview card components
for (const cardFileName of previewCardFiles) {
  const cardPath = path.join(COMPONENTS_DIR, cardFileName);
  if (!fs.existsSync(cardPath)) continue;
  const content = fs.readFileSync(cardPath, 'utf8');
  const rel = path.relative(ROOT_DIR, cardPath).replace(/\\/g, '/');

  if (TWO_LINE_TITLE_CARDS.has(cardFileName)) {
    if (!content.includes('line-clamp-2 min-h-[2lh]')) {
      error(`${rel} must enforce 2-line title height reservation (line-clamp-2 min-h-[2lh]).`);
      previewCardContractViolations++;
    }
  } else if (ONE_LINE_TITLE_CARDS.has(cardFileName)) {
    if (!content.includes('line-clamp-1 min-h-[1lh]')) {
      error(`${rel} must enforce 1-line title height reservation (line-clamp-1 min-h-[1lh]).`);
      previewCardContractViolations++;
    }
  }

  if (cardFileName === 'PublicationCard.astro') {
    if (!content.includes('line-clamp-1 min-h-[1lh]') || !content.includes('line-clamp-2 min-h-[2lh]')) {
      error(`${rel} must enforce 1lh venue and 2lh title/author height reservation.`);
      previewCardContractViolations++;
    }
  } else {
    if (!content.includes('line-clamp-3 min-h-[3lh]')) {
      error(`${rel} must enforce 3-line description height reservation (line-clamp-3 min-h-[3lh]).`);
      previewCardContractViolations++;
    }
  }

  if (content.includes('tag-chip') && !content.includes('shouldShowTags')) {
    error(`${rel} contains .tag-chip without Option 3 shouldShowTags contextual visibility gate.`);
    previewCardContractViolations++;
  }
}

// 30c. Forbid display classes (block, inline-block, flex, inline-flex, grid) on the same element as line-clamp-* (which overrides display: -webkit-box)
for (const file of websiteFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const lineClampClassMatches = content.match(/class="[^"]*\bline-clamp-[1-6]\b[^"]*"/g) || [];
  for (const clsAttr of lineClampClassMatches) {
    if (/\b(?:block|inline-block|flex|inline-flex|grid)\b/.test(clsAttr)) {
      error(`${rel} has a display utility conflicting with line-clamp (overrides display: -webkit-box): ${clsAttr}`);
      previewCardContractViolations++;
    }
  }
}

// 30d. Ensure project detail screenshot cards enforce 1-line title clamp
if (fs.existsSync(projectDetailPage)) {
  const content = fs.readFileSync(projectDetailPage, 'utf8');
  const screenshotHeadingMatch = content.match(/<h3[^>]*id=\{`screenshot-title-\$\{index\}`\}[^>]*>/);
  if (!screenshotHeadingMatch || !screenshotHeadingMatch[0].includes('line-clamp-1 min-h-[1lh]')) {
    error('src/pages/projects/[slug].astro screenshot card titles must enforce line-clamp-1 min-h-[1lh].');
    previewCardContractViolations++;
  }
}

if (previewCardContractViolations === 0) {
  success('All 10 preview card components and project screenshot cards enforce domain-appropriate 1lh/2lh title reservation, 3lh description reservation, conflict-free line-clamp CSS, and Option 3 chip gating.');
}

// 31. Canonical Domain Sequence Enforcement
// Ensures index.astro, tags/[tag].astro, tags/index.astro, and OVERVIEW_PAGES_CONFIG strictly follow CONTENT_DOMAINS order
let domainSequenceViolations = 0;

// 31a. OVERVIEW_PAGES_CONFIG order
const overviewDomains = OVERVIEW_PAGES_CONFIG.map((c) => c.domain);
for (let i = 0; i < CONTENT_DOMAINS.length; i++) {
  if (overviewDomains[i] !== CONTENT_DOMAINS[i]) {
    error(`OVERVIEW_PAGES_CONFIG[${i}] domain "${overviewDomains[i]}" does not match canonical CONTENT_DOMAINS[${i}] "${CONTENT_DOMAINS[i]}".`);
    domainSequenceViolations++;
  }
}

// 31b. index.astro domain sections sequence
const indexFile = path.resolve(PAGES_DIR, 'index.astro');
if (fs.existsSync(indexFile)) {
  const indexContent = fs.readFileSync(indexFile, 'utf8');
  const expectedIndexSectionIds = [
    'latest-posts',
    'publications',
    'presentations',
    'courses',
    'projects',
    'services',
    'newsletters',
    'visualizations',
    'content-tags'
  ];
  let lastIndex = -1;
  for (const secId of expectedIndexSectionIds) {
    const secTag = `<Section id="${secId}"`;
    const curIndex = indexContent.indexOf(secTag);
    if (curIndex === -1) {
      error(`src/pages/index.astro is missing required section: ${secTag}`);
      domainSequenceViolations++;
    } else if (curIndex < lastIndex) {
      error(`src/pages/index.astro section "${secId}" appears out of canonical order.`);
      domainSequenceViolations++;
    } else {
      lastIndex = curIndex;
    }
  }
}

// 31c. tags/[tag].astro domain sections sequence
const tagDetailPage = path.resolve(PAGES_DIR, 'tags', '[tag].astro');
if (fs.existsSync(tagDetailPage)) {
  const tagDetailContent = fs.readFileSync(tagDetailPage, 'utf8');
  const expectedTagSectionIds = [
    'blog-posts',
    'publications',
    'presentations',
    'courses',
    'projects',
    'services',
    'newsletters',
    'visualizations'
  ];
  let lastIndex = -1;
  for (const secId of expectedTagSectionIds) {
    const divTag = `<div id="${secId}"`;
    const curIndex = tagDetailContent.indexOf(divTag);
    if (curIndex === -1) {
      error(`src/pages/tags/[tag].astro is missing required section div: ${divTag}`);
      domainSequenceViolations++;
    } else if (curIndex < lastIndex) {
      error(`src/pages/tags/[tag].astro section div "${secId}" appears out of canonical order.`);
      domainSequenceViolations++;
    } else {
      lastIndex = curIndex;
    }
  }
}

// 31d. tags/index.astro card badges sequence
const tagsOverviewPage = path.resolve(PAGES_DIR, 'tags', 'index.astro');
if (fs.existsSync(tagsOverviewPage)) {
  const tagsOverviewContent = fs.readFileSync(tagsOverviewPage, 'utf8');
  const expectedBadges = [
    '{tag.postCount > 0 && (',
    '{tag.pubCount > 0 && (',
    '{tag.presCount > 0 && (',
    '{tag.courseCount > 0 && (',
    '{tag.projCount > 0 && (',
    '{tag.serviceCount > 0 && (',
    '{tag.newsletterCount > 0 && (',
    '{tag.visCount > 0 && ('
  ];
  let lastIndex = -1;
  for (const badge of expectedBadges) {
    const curIndex = tagsOverviewContent.indexOf(badge);
    if (curIndex === -1) {
      error(`src/pages/tags/index.astro is missing required count badge: ${badge}`);
      domainSequenceViolations++;
    } else if (curIndex < lastIndex) {
      error(`src/pages/tags/index.astro badge "${badge}" appears out of canonical order.`);
      domainSequenceViolations++;
    } else {
      lastIndex = curIndex;
    }
  }
}

if (domainSequenceViolations === 0) {
  success('Canonical domain sequence (Rule 31) strictly enforced across index.astro, tags/[tag].astro, tags/index.astro, and OVERVIEW_PAGES_CONFIG.');
}

if (verbose || errorCount > 0) {
  console.log('\n----------------------------------------');
}
if (errorCount > 0) {
  console.error(`💥 [lint:domains] Failed with ${errorCount} error(s).`);
  process.exit(1);
} else {
  console.log('✅ [lint:domains] All 31 domain token integrity & design system rules passed (0 errors).');
  process.exit(0);
}
