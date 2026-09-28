import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

function getHtmlFiles(dir) {
  let files = [];
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
  const seenIds = new Map();
  $('[id]').each((_, el) => {
    totalCheckedIds++;
    const rawId = $(el).attr('id');
    if (!rawId) return;
    const id = rawId.trim();
    if (!id) return;

    if (seenIds.has(id)) {
      console.error(`[validate-semantic-ids] ❌ Duplicate ID "${id}" in ${relPath} (<${el.tagName}> conflicts with earlier <${seenIds.get(id)}>)`);
      errorsCount++;
    } else {
      seenIds.set(id, el.tagName);
    }
  });

  // 2. Sections must declare semantic IDs for section dwell tracking and accessibility
  $('section').each((_, el) => {
    totalSections++;
    const id = $(el).attr('id');
    if (!id || !id.trim()) {
      const preview = $.html(el).slice(0, 120).replace(/\s+/g, ' ');
      console.error(`[validate-semantic-ids] ❌ Missing Section ID in ${relPath}: ${preview}`);
      errorsCount++;
    }
  });
}

console.log(`\n[validate-semantic-ids] Scan summary:`);
console.log(`  - Files scanned: ${htmlFiles.length}`);
console.log(`  - Checked IDs:   ${totalCheckedIds}`);
console.log(`  - Sections:      ${totalSections}`);

if (errorsCount > 0) {
  console.error(`\n[validate-semantic-ids] 💥 Validation failed with ${errorsCount} semantic ID error(s).`);
  process.exit(1);
} else {
  console.log(`\n[validate-semantic-ids] ✅ All HTML pages have valid unique IDs and all sections have semantic IDs!`);
  process.exit(0);
}
