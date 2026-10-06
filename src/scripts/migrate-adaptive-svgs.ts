import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const ROOT_DIR = process.cwd();
const CONTENT_DIR = path.join(ROOT_DIR, 'src', 'content');
const postsDir = path.join(CONTENT_DIR, 'posts');

function findSvgFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const svgs: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      svgs.push(...findSvgFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.svg')) {
      svgs.push(fullPath);
    }
  }
  return svgs;
}

const fillMap: Record<string, string> = {
  // Canvas / Background
  '#030712': 'var(--svg-bg)',
  '#070b16': 'var(--svg-bg)',
  '#020617': 'var(--svg-bg)',
  '#000000': 'var(--svg-bg)',

  // Main Card Panels
  '#0b1329': 'var(--svg-card)',
  '#0e172e': 'var(--svg-card)',
  '#0e172a': 'var(--svg-card)',
  '#111827': 'var(--svg-card)',
  '#0d1726': 'var(--svg-card)',
  '#0c1726': 'var(--svg-card)',
  '#0c172a': 'var(--svg-card)',
  '#0b172a': 'var(--svg-card)',
  '#090d1a': 'var(--svg-card)',
  '#090e1a': 'var(--svg-card)',
  '#09101f': 'var(--svg-card)',
  '#070d18': 'var(--svg-card)',
  '#070d1d': 'var(--svg-card)',
  '#061220': 'var(--svg-card)',
  '#0d0b22': 'var(--svg-card)',

  // Inner cards / Alt Backgrounds
  '#0c2242': 'var(--svg-card-alt)',
  '#111c38': 'var(--svg-card-alt)',
  '#161f38': 'var(--svg-card-alt)',
  '#1e293b': 'var(--svg-card-alt)',
  '#131e3a': 'var(--svg-card-alt)',
  '#17203b': 'var(--svg-card-alt)',
  '#131e3d': 'var(--svg-card-alt)',
  '#0b1120': 'var(--svg-card-alt)',
  '#0b192c': 'var(--svg-card-alt)',
  '#0b1b2b': 'var(--svg-card-alt)',
  '#071526': 'var(--svg-card-alt)',
  '#081526': 'var(--svg-card-alt)',
  '#071828': 'var(--svg-card-alt)',
  '#071a2e': 'var(--svg-card-alt)',
  '#07152b': 'var(--svg-card-alt)',
  '#08152c': 'var(--svg-card-alt)',
  '#081b2e': 'var(--svg-card-alt)',
  '#081b2c': 'var(--svg-card-alt)',
  '#0c1e36': 'var(--svg-card-alt)',
  '#0c233c': 'var(--svg-card-alt)',
  '#0c2b45': 'var(--svg-card-alt)',
  '#0c2d48': 'var(--svg-card-alt)',
  '#0c2e59': 'var(--svg-card-alt)',
  '#0d1b2a': 'var(--svg-card-alt)',
  '#0d1b2e': 'var(--svg-card-alt)',
  '#091322': 'var(--svg-card-alt)',
  '#091424': 'var(--svg-card-alt)',
  '#0c1222': 'var(--svg-card-alt)',
  '#0c152a': 'var(--svg-card-alt)',
  '#0c192e': 'var(--svg-card-alt)',
  '#06182c': 'var(--svg-card-alt)',
  '#041620': 'var(--svg-card-alt)',
  '#051b2c': 'var(--svg-card-alt)',
  '#082f49': 'var(--svg-card-alt)',
  '#083344': 'var(--svg-card-alt)',
  '#07202c': 'var(--svg-card-alt)',
  '#072b44': 'var(--svg-card-alt)',
  '#0b2440': 'var(--svg-card-alt)',
  '#0f2937': 'var(--svg-card-alt)',
  '#182e54': 'var(--svg-card-alt)',
  '#132338': 'var(--svg-card-alt)',
  '#13233f': 'var(--svg-card-alt)',
  '#1e3a5f': 'var(--svg-card-alt)',
  '#034d75': 'var(--svg-card-alt)',
  '#1c1917': 'var(--svg-card-alt)',
  '#1f2937': 'var(--svg-card-alt)',
  '#334155': 'var(--svg-card-alt)',
  '#475569': 'var(--svg-card-alt)',
  '#031524': 'var(--svg-card-alt)',
  '#071626': 'var(--svg-card-alt)',

  // Sub-boxes / Pills
  '#070e20': 'var(--svg-pill-bg)',
  '#0f172a': 'var(--svg-pill-bg)',

  // Primary Typography
  '#ffffff': 'var(--svg-text-primary)',
  '#f8fafc': 'var(--svg-text-primary)',
  '#f1f5f9': 'var(--svg-text-primary)',
  '#f9fafb': 'var(--svg-text-primary)',
  '#e2e8f0': 'var(--svg-text-primary)',
  '#e5e7eb': 'var(--svg-text-primary)',
  '#f3f4f6': 'var(--svg-text-primary)',

  // Secondary Typography
  '#94a3b8': 'var(--svg-text-secondary)',
  '#cbd5e1': 'var(--svg-text-secondary)',
  '#64748b': 'var(--svg-text-secondary)',
  '#9ca3af': 'var(--svg-text-secondary)',
  '#6b7280': 'var(--svg-text-secondary)',
  '#d1d5db': 'var(--svg-text-secondary)',
  '#999999': 'var(--svg-text-secondary)',
  '#4b5563': 'var(--svg-text-secondary)',

  // Blue Archetype
  // Backgrounds
  '#1e3a8a': 'var(--svg-node-blue-bg)',
  '#172554': 'var(--svg-node-blue-bg)',
  '#0c4a6e': 'var(--svg-node-blue-bg)',
  '#0369a1': 'var(--svg-node-blue-bg)',
  // Borders
  '#3b82f6': 'var(--svg-node-blue-border)',
  '#38bdf8': 'var(--svg-node-blue-border)',
  '#0284c7': 'var(--svg-node-blue-border)',
  '#60a5fa': 'var(--svg-node-blue-border)',
  '#0ea5e9': 'var(--svg-node-blue-border)',
  '#818cf8': 'var(--svg-node-blue-border)',
  '#4f46e5': 'var(--svg-node-blue-border)',
  '#4338ca': 'var(--svg-node-blue-border)',
  '#312e81': 'var(--svg-node-blue-border)',
  '#6366f1': 'var(--svg-node-blue-border)',
  '#2563eb': 'var(--svg-node-blue-border)',
  '#1d4ed8': 'var(--svg-node-blue-border)',
  // Texts
  '#bfdbfe': 'var(--svg-node-blue-subtext)',
  '#93c5fd': 'var(--svg-node-blue-subtext)',
  '#7dd3fc': 'var(--svg-node-blue-subtext)',
  '#dbeafe': 'var(--svg-node-blue-subtext)',
  '#f0f9ff': 'var(--svg-node-blue-subtext)',
  '#cffafe': 'var(--svg-node-blue-subtext)',
  '#eff6ff': 'var(--svg-node-blue-subtext)',
  '#67e8f9': 'var(--svg-node-blue-subtext)',
  '#bae6fd': 'var(--svg-node-blue-subtext)',
  '#e0f2fe': 'var(--svg-node-blue-subtext)',

  // Purple Archetype
  // Backgrounds
  '#581c87': 'var(--svg-node-purple-bg)',
  '#2e1065': 'var(--svg-node-purple-bg)',
  '#1e1035': 'var(--svg-node-purple-bg)',
  '#4c1d95': 'var(--svg-node-purple-bg)',
  '#3b0764': 'var(--svg-node-purple-bg)',
  '#180d2b': 'var(--svg-node-purple-bg)',
  '#130b24': 'var(--svg-node-purple-bg)',
  '#150a24': 'var(--svg-node-purple-bg)',
  '#1e0e38': 'var(--svg-node-purple-bg)',
  '#180c2e': 'var(--svg-node-purple-bg)',
  '#201138': 'var(--svg-node-purple-bg)',
  '#1f0a3d': 'var(--svg-node-purple-bg)',
  '#1e053a': 'var(--svg-node-purple-bg)',
  '#120e28': 'var(--svg-node-purple-bg)',
  '#200a35': 'var(--svg-node-purple-bg)',
  '#1c102b': 'var(--svg-node-purple-bg)',
  '#1e113a': 'var(--svg-node-purple-bg)',
  '#130c25': 'var(--svg-node-purple-bg)',
  '#110d18': 'var(--svg-node-purple-bg)',
  '#140d17': 'var(--svg-node-purple-bg)',
  '#160d1b': 'var(--svg-node-purple-bg)',
  '#1e1329': 'var(--svg-node-purple-bg)',
  '#1c1642': 'var(--svg-node-purple-bg)',
  '#1e1030': 'var(--svg-node-purple-bg)',
  '#170c24': 'var(--svg-node-purple-bg)',
  '#140c24': 'var(--svg-node-purple-bg)',
  '#281446': 'var(--svg-node-purple-bg)',
  '#1f1035': 'var(--svg-node-purple-bg)',
  '#170924': 'var(--svg-node-purple-bg)',
  '#1e1b4b': 'var(--svg-node-purple-bg)',
  '#24143f': 'var(--svg-node-purple-bg)',
  '#3730a3': 'var(--svg-node-purple-bg)',
  '#6b21a8': 'var(--svg-node-purple-bg)',
  // Borders
  '#a855f7': 'var(--svg-node-purple-border)',
  '#c084fc': 'var(--svg-node-purple-border)',
  '#8b5cf6': 'var(--svg-node-purple-border)',
  '#7e22ce': 'var(--svg-node-purple-border)',
  '#9333ea': 'var(--svg-node-purple-border)',
  '#7c3aed': 'var(--svg-node-purple-border)',
  '#6d28d9': 'var(--svg-node-purple-border)',
  '#a78bfa': 'var(--svg-node-purple-border)',
  // Texts
  '#e9d5ff': 'var(--svg-node-purple-subtext)',
  '#faf5ff': 'var(--svg-node-purple-subtext)',
  '#fae8ff': 'var(--svg-node-purple-subtext)',
  '#c4b5fd': 'var(--svg-node-purple-subtext)',
  '#e879f9': 'var(--svg-node-purple-subtext)',
  '#f5d0fe': 'var(--svg-node-purple-subtext)',
  '#e0e7ff': 'var(--svg-node-purple-subtext)',
  '#c7d2fe': 'var(--svg-node-purple-subtext)',
  '#a5b4fc': 'var(--svg-node-purple-subtext)',
  '#f3e8ff': 'var(--svg-node-purple-subtext)',
  '#d8b4fe': 'var(--svg-node-purple-subtext)',

  // Amber Archetype
  // Backgrounds
  '#78350f': 'var(--svg-node-amber-bg)',
  '#451a03': 'var(--svg-node-amber-bg)',
  '#1c1203': 'var(--svg-node-amber-bg)',
  '#1f1406': 'var(--svg-node-amber-bg)',
  '#281e0a': 'var(--svg-node-amber-bg)',
  '#291804': 'var(--svg-node-amber-bg)',
  '#2e1f06': 'var(--svg-node-amber-bg)',
  '#361e04': 'var(--svg-node-amber-bg)',
  '#1b1204': 'var(--svg-node-amber-bg)',
  '#241707': 'var(--svg-node-amber-bg)',
  '#1c1608': 'var(--svg-node-amber-bg)',
  '#241505': 'var(--svg-node-amber-bg)',
  '#1c1306': 'var(--svg-node-amber-bg)',
  '#291c06': 'var(--svg-node-amber-bg)',
  '#2d1d06': 'var(--svg-node-amber-bg)',
  '#1c1103': 'var(--svg-node-amber-bg)',
  '#18130a': 'var(--svg-node-amber-bg)',
  '#382506': 'var(--svg-node-amber-bg)',
  '#180e03': 'var(--svg-node-amber-bg)',
  '#3a1c04': 'var(--svg-node-amber-bg)',
  '#1e1808': 'var(--svg-node-amber-bg)',
  '#161208': 'var(--svg-node-amber-bg)',
  '#241407': 'var(--svg-node-amber-bg)',
  '#332408': 'var(--svg-node-amber-bg)',
  '#854d0e': 'var(--svg-node-amber-bg)',
  '#92400e': 'var(--svg-node-amber-bg)',
  '#291e0a': 'var(--svg-node-amber-bg)',
  // Borders
  '#f59e0b': 'var(--svg-node-amber-border)',
  '#fbbf24': 'var(--svg-node-amber-border)',
  '#d97706': 'var(--svg-node-amber-border)',
  '#b45309': 'var(--svg-node-amber-border)',
  '#f97316': 'var(--svg-node-amber-border)',
  '#ea580c': 'var(--svg-node-amber-border)',
  '#fdba74': 'var(--svg-node-amber-border)',
  // Texts
  '#fef08a': 'var(--svg-node-amber-subtext)',
  '#fcd34d': 'var(--svg-node-amber-subtext)',
  '#fffbeb': 'var(--svg-node-amber-subtext)',
  '#fed7aa': 'var(--svg-node-amber-subtext)',
  '#fde68a': 'var(--svg-node-amber-subtext)',
  '#ffedd5': 'var(--svg-node-amber-subtext)',
  '#facc15': 'var(--svg-node-amber-subtext)',
  '#fde047': 'var(--svg-node-amber-subtext)',
  '#fef3c7': 'var(--svg-node-amber-subtext)',

  // Green Archetype
  // Backgrounds
  '#064e3b': 'var(--svg-node-green-bg)',
  '#022c22': 'var(--svg-node-green-bg)',
  '#047857': 'var(--svg-node-green-bg)',
  '#042f2e': 'var(--svg-node-green-bg)',
  '#065f46': 'var(--svg-node-green-bg)',
  '#134e4a': 'var(--svg-node-green-bg)',
  '#022119': 'var(--svg-node-green-bg)',
  '#042018': 'var(--svg-node-green-bg)',
  '#032c21': 'var(--svg-node-green-bg)',
  '#062e21': 'var(--svg-node-green-bg)',
  '#071b15': 'var(--svg-node-green-bg)',
  '#061c16': 'var(--svg-node-green-bg)',
  '#091d17': 'var(--svg-node-green-bg)',
  '#0f3025': 'var(--svg-node-green-bg)',
  '#072018': 'var(--svg-node-green-bg)',
  '#0c1d18': 'var(--svg-node-green-bg)',
  '#14532d': 'var(--svg-node-green-bg)',
  '#041f1a': 'var(--svg-node-green-bg)',
  '#061b14': 'var(--svg-node-green-bg)',
  '#063226': 'var(--svg-node-green-bg)',
  '#091f1a': 'var(--svg-node-green-bg)',
  '#0d2e26': 'var(--svg-node-green-bg)',
  '#133d33': 'var(--svg-node-green-bg)',
  '#0a1f1b': 'var(--svg-node-green-bg)',
  '#061811': 'var(--svg-node-green-bg)',
  '#0d2b20': 'var(--svg-node-green-bg)',
  '#081712': 'var(--svg-node-green-bg)',
  '#061c14': 'var(--svg-node-green-bg)',
  '#092d20': 'var(--svg-node-green-bg)',
  '#072218': 'var(--svg-node-green-bg)',
  '#0f3427': 'var(--svg-node-green-bg)',
  // Borders
  '#10b981': 'var(--svg-node-green-border)',
  '#34d399': 'var(--svg-node-green-border)',
  '#059669': 'var(--svg-node-green-border)',
  '#2dd4bf': 'var(--svg-node-green-border)',
  '#06b6d4': 'var(--svg-node-green-border)',
  '#0d9488': 'var(--svg-node-green-border)',
  '#22c55e': 'var(--svg-node-green-border)',
  '#15803d': 'var(--svg-node-green-border)',
  '#4ade80': 'var(--svg-node-green-border)',
  '#14b8a6': 'var(--svg-node-green-border)',
  '#22d3ee': 'var(--svg-node-green-border)',
  '#0891b2': 'var(--svg-node-green-border)',
  // Texts
  '#a7f3d0': 'var(--svg-node-green-subtext)',
  '#6ee7b7': 'var(--svg-node-green-subtext)',
  '#bbf7d0': 'var(--svg-node-green-subtext)',
  '#ccfbf1': 'var(--svg-node-green-subtext)',
  '#5eead4': 'var(--svg-node-green-subtext)',
  '#86efac': 'var(--svg-node-green-subtext)',
  '#d1fae5': 'var(--svg-node-green-subtext)',
  '#ecfdf5': 'var(--svg-node-green-subtext)',

  // Red Archetype
  // Backgrounds
  '#450a0a': 'var(--svg-node-red-bg)',
  '#1e1315': 'var(--svg-node-red-bg)',
  '#1e1012': 'var(--svg-node-red-bg)',
  '#2d1219': 'var(--svg-node-red-bg)',
  '#7f1d1d': 'var(--svg-node-red-bg)',
  '#180a0c': 'var(--svg-node-red-bg)',
  '#140608': 'var(--svg-node-red-bg)',
  '#3f1317': 'var(--svg-node-red-bg)',
  '#831843': 'var(--svg-node-red-bg)',
  '#3b0f15': 'var(--svg-node-red-bg)',
  '#2d1217': 'var(--svg-node-red-bg)',
  '#240c12': 'var(--svg-node-red-bg)',
  '#290b0b': 'var(--svg-node-red-bg)',
  '#2d1215': 'var(--svg-node-red-bg)',
  '#150d10': 'var(--svg-node-red-bg)',
  '#1f1315': 'var(--svg-node-red-bg)',
  '#221428': 'var(--svg-node-red-bg)',
  '#1f1627': 'var(--svg-node-red-bg)',
  // Borders
  '#ef4444': 'var(--svg-node-red-border)',
  '#991b1b': 'var(--svg-node-red-border)',
  '#f87171': 'var(--svg-node-red-border)',
  '#e11d48': 'var(--svg-node-red-border)',
  '#b91c1c': 'var(--svg-node-red-border)',
  '#ec4899': 'var(--svg-node-red-border)',
  '#f43f5e': 'var(--svg-node-red-border)',
  // Texts
  '#fee2e2': 'var(--svg-node-red-subtext)',
  '#fef2f2': 'var(--svg-node-red-subtext)',
  '#fca5a5': 'var(--svg-node-red-subtext)',
  '#fce7f3': 'var(--svg-node-red-subtext)',
  '#f472b6': 'var(--svg-node-red-subtext)',
  '#fda4af': 'var(--svg-node-red-subtext)',
  '#fecaca': 'var(--svg-node-red-subtext)',
};

const strokeMap: Record<string, string> = { ...fillMap };
strokeMap['#334155'] = 'var(--svg-line)';
strokeMap['#475569'] = 'var(--svg-line)';
strokeMap['#1e293b'] = 'var(--svg-line)';
strokeMap['#1f2937'] = 'var(--svg-line)';
strokeMap['#4b5563'] = 'var(--svg-line)';
strokeMap['#9ca3af'] = 'var(--svg-line)';
strokeMap['#94a3b8'] = 'var(--svg-line)';
strokeMap['#64748b'] = 'var(--svg-line)';
strokeMap['#372023'] = 'var(--svg-line)';
strokeMap['#16382b'] = 'var(--svg-line)';
strokeMap['#1d4ed8'] = 'var(--svg-node-blue-border)';

const RGBA_WHITE_BORDER_REGEX = /rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.(?:0[568]|1[02]?)\s*\)/i;

function transformSvg(filePath: string): { changed: boolean; content: string } {
  const original = fs.readFileSync(filePath, 'utf8');
  if (original.includes('/styles/graphics.css')) {
    return { changed: false, content: original };
  }

  const $ = cheerio.load(original, { xml: true });

  // 1. Ensure <defs><style>@import url('/styles/graphics.css');</style></defs>
  const defs = $('defs').first();
  if (defs.length === 0) {
    const root = $('svg').first();
    if (root.length > 0) {
      root.prepend('<defs>\n    <style>\n      @import url(\'/styles/graphics.css\');\n    </style>\n  </defs>');
    } else {
      $.root().prepend('<defs>\n    <style>\n      @import url(\'/styles/graphics.css\');\n    </style>\n  </defs>');
    }
  } else {
    let hasImport = false;
    defs.find('style').each((_, el) => {
      if ($(el).text().includes('/styles/graphics.css')) {
        hasImport = true;
      }
    });
    if (!hasImport) {
      defs.prepend('\n    <style>\n      @import url(\'/styles/graphics.css\');\n    </style>');
    }
  }

  // 2. Transform root <svg> inline style
  const rootSvg = $('svg').first();
  if (rootSvg.length > 0) {
    let svgStyle = rootSvg.attr('style');
    if (svgStyle) {
      svgStyle = svgStyle.replace(/background-color\s*:\s*#[0-9a-fA-F]{3,8}/gi, 'background-color: var(--svg-bg)');
      rootSvg.attr('style', svgStyle);
    }
  }

  // 3. Transform all graphical elements and attributes
  $('*').each((_, el) => {
    if (!('tagName' in el) || typeof el.tagName !== 'string') return;
    const tagName = el.tagName.toLowerCase();

    // Fill transformation
    const fill = $(el).attr('fill')?.trim();
    if (fill) {
      if (fill.startsWith('#')) {
        const hex = fill.toLowerCase();
        if (fillMap[hex]) {
          $(el).attr('fill', fillMap[hex]);
        }
      } else if (RGBA_WHITE_BORDER_REGEX.test(fill)) {
        $(el).attr('fill', 'var(--svg-pill-bg)');
      }
    }

    // Stroke transformation
    const stroke = $(el).attr('stroke')?.trim();
    if (stroke) {
      if (stroke.startsWith('#')) {
        const hex = stroke.toLowerCase();
        if (strokeMap[hex]) {
          $(el).attr('stroke', strokeMap[hex]);
        }
      } else if (RGBA_WHITE_BORDER_REGEX.test(stroke)) {
        if (tagName === 'line' || tagName === 'polyline' || tagName === 'path') {
          $(el).attr('stroke', 'var(--svg-line)');
        } else {
          $(el).attr('stroke', 'var(--svg-border)');
        }
      }
    }

    // Stop-color transformation on gradients
    const stopColor = $(el).attr('stop-color')?.trim();
    if (stopColor && stopColor.startsWith('#')) {
      const hex = stopColor.toLowerCase();
      if (fillMap[hex]) {
        $(el).attr('stop-color', fillMap[hex]);
      }
    }

    // Inline style transformation
    let style = $(el).attr('style')?.trim();
    if (style) {
      // fill: #hex
      style = style.replace(/fill\s*:\s*#([0-9a-fA-F]{3,8})/gi, (_, hexStr) => {
        const hex = `#${hexStr.toLowerCase()}`;
        return `fill:${fillMap[hex] || 'var(--svg-text-primary)'}`;
      });
      // stroke: #hex
      style = style.replace(/stroke\s*:\s*#([0-9a-fA-F]{3,8})/gi, (_, hexStr) => {
        const hex = `#${hexStr.toLowerCase()}`;
        return `stroke:${strokeMap[hex] || 'var(--svg-line)'}`;
      });
      // background-color: #hex
      style = style.replace(/background-color\s*:\s*#[0-9a-fA-F]{3,8}/gi, 'background-color:var(--svg-bg)');
      $(el).attr('style', style);
    }
  });

  return { changed: true, content: $.xml() };
}

function migrateAll(): void {
  console.log('🚀 [migrate:svgs] Scanning SVGs across src/content/posts/...');
  const allSvgs = findSvgFiles(postsDir);
  console.log(`Found ${allSvgs.length} total SVGs in posts.`);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const svgFile of allSvgs) {
    const rel = path.relative(postsDir, svgFile).replace(/\\/g, '/');
    const { changed, content } = transformSvg(svgFile);

    if (changed) {
      fs.writeFileSync(svgFile, content, 'utf8');
      migratedCount++;
      console.log(`  ✓ Migrated: ${rel}`);
    } else {
      skippedCount++;
      console.log(`  - Skipped (already migrated): ${rel}`);
    }
  }

  console.log(`\n🎉 [migrate:svgs] Finished! Migrated: ${migratedCount}, Skipped: ${skippedCount}, Total: ${allSvgs.length}`);
}

migrateAll();
