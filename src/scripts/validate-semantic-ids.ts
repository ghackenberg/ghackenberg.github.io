import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

function getHtmlFiles(dir: string): string[] {
  let files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

const distDir = path.resolve('dist');
const htmlFiles = getHtmlFiles(distDir);

if (htmlFiles.length === 0) {
  console.error('[validate-semantic-ids] Error: dist directory contains no HTML files. Run "npm run build" first.');
  process.exit(1);
}

console.log(`[validate-semantic-ids] Auditing ${htmlFiles.length} HTML files in dist/...`);

let errorsCount = 0;
let totalSections = 0;
let totalCheckedIds = 0;

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const $ = cheerio.load(content);
  const relPath = path.relative(distDir, file).replace(/\\/g, '/');

  // 1. Duplicate IDs
  const seenIds = new Map<string, string>();
  $('[id]').each((_, el) => {
    totalCheckedIds++;
    const rawId = $(el).attr('id');
    if (!rawId) return;
    const id = rawId.trim();
    if (!id) return;

    const tagName = $(el).prop('tagName')?.toLowerCase() || 'unknown';
    if (seenIds.has(id)) {
      console.error(`[validate-semantic-ids] ❌ Duplicate ID "${id}" in ${relPath} (<${tagName}> conflicts with earlier <${seenIds.get(id)}>)`);
      errorsCount++;
    } else {
      seenIds.set(id, tagName);
    }
  });

  // 2. Sections must use the standard <Section id="..."> component (rendered with data-page-section="true")
  // Raw <section> elements are prohibited outside presentation slides and dev modals.
  $('section').each((_, el) => {
    const $el = $(el);
    const isRevealSlide = $el.closest('.reveal .slides').length > 0 || $el.attr('data-slide-id') !== undefined || $el.attr('data-slide-index') !== undefined;
    const isDevOrModal = $el.closest('dialog, [role="dialog"], .modal, #dev-analytics-container, #dev-studio-root').length > 0;

    if (isRevealSlide || isDevOrModal) {
      return;
    }

    totalSections++;
    const isPageSection = $el.attr('data-page-section') === 'true';
    const rawId = $el.attr('id');
    const id = rawId ? rawId.trim() : '';

    if (!isPageSection) {
      const preview = $.html(el).slice(0, 120).replace(/\s+/g, ' ');
      console.error(`[validate-semantic-ids] ❌ Forbidden raw <section> element in ${relPath}: ${preview}. Use the standard <Section id="..."> component instead.`);
      errorsCount++;
    } else if (!id) {
      const preview = $.html(el).slice(0, 120).replace(/\s+/g, ' ');
      console.error(`[validate-semantic-ids] ❌ Missing Section ID in ${relPath}: ${preview}`);
      errorsCount++;
    }
  });

  // 3. Content Headings (h2, h3) must declare semantic IDs for in-text anchor navigation and telemetry
  $('h2, h3').each((_, el) => {
    const $el = $(el);
    const tagName = el.tagName.toLowerCase();

    // Universal exemptions: print views, dev overlays, modal dialogs, navigation, footer
    const isExemptContext =
      relPath.includes('/print/') ||
      $('body.print-pdf, .print-pdf, .print-slide-page').length > 0 ||
      $el.closest(
        'dialog, [role="dialog"], .modal, #whats-new-modal-container, #privacy-policy-modal-container, #dev-analytics-container, #dev-studio-root, nav, footer, #presentation-player, .slide-deck-container, .reveal, .reveal-viewport, [data-slide-id], [data-slide-index]'
      ).length > 0;

    if (isExemptContext) {
      return;
    }

    // Exempt card/widget components where h2/h3 represents an internal item label rather than a macro content heading
    const isCardOrWidget =
      $el.closest(
        '.preview-card, .gallery-card, .gallery-track, .gallery-viewport, .tag-card, .publication-card-item, .timeline-slide-entry, [data-timeline-container], [data-timeline-entry], .timeline-card, [data-card-id], .activity-card-anim, [data-screenshot-index], .screenshot-card, a[href]'
      ).length > 0;

    if (isCardOrWidget) {
      return;
    }

    const rawId = $el.attr('id');
    const id = rawId ? rawId.trim() : '';

    if (!id) {
      const text = $el.text().trim().replace(/\s+/g, ' ');
      console.error(`[validate-semantic-ids] ❌ Missing Heading ID in ${relPath}: <${tagName}>${text}</${tagName}>`);
      errorsCount++;
    }
  });
}

console.log(`\n[validate-semantic-ids] Scan summary:`);
console.log(`  - Files scanned: ${htmlFiles.length}`);
console.log(`  - Checked IDs:   ${totalCheckedIds}`);
console.log(`  - Sections:      ${totalSections}`);

if (errorsCount > 0) {
  console.error(`\n[validate-semantic-ids] 💥 Validation failed with ${errorsCount} semantic ID / structure error(s).`);
  process.exit(1);
} else {
  console.log(`\n[validate-semantic-ids] ✅ All HTML pages have valid unique IDs, semantic <Section> components, and heading IDs!`);
  process.exit(0);
}
