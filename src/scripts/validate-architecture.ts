import fs from 'node:fs';
import path from 'node:path';

/**
 * Architectural Integrity & Filesystem Structure Validator
 * Enforces repository architectural boundaries, plural naming conventions,
 * and component hygiene across src/.
 */

const ROOT_DIR = process.cwd();
const SRC_DIR = path.resolve(ROOT_DIR, 'src');

const ALLOWED_SRC_SUBDIRS = new Set([
  'assets',
  'commons',
  'components',
  'content',
  'layouts',
  'pages',
  'plugins',
  'scripts',
  'styles',
  'tools',
]);

const ALLOWED_COMMONS_SUBDIRS = new Set([
  'client',
  'server',
  'shared',
]);

const FORBIDDEN_ROOT_DIRS = ['scripts', 'shared', 'mcp', 'modules'];

let errorCount = 0;

function error(msg: string): void {
  console.error(`❌ [validate:architecture] ${msg}`);
  errorCount++;
}

function success(msg: string): void {
  console.log(`✅ [validate:architecture] ${msg}`);
}

console.log('🔍 [validate:architecture] Auditing architectural constraints and directory rules...\n');

// 1. Check for legacy/forbidden directories in repository root
for (const dirName of FORBIDDEN_ROOT_DIRS) {
  const dirPath = path.resolve(ROOT_DIR, dirName);
  if (fs.existsSync(dirPath)) {
    error(`Forbidden legacy directory "${dirName}/" found in repository root. All source code must reside under src/.`);
  }
}
if (errorCount === 0) {
  success('Repository root contains zero forbidden source directories.');
}

// 2. Check src/ direct subdirectories (Plural Naming Convention)
if (fs.existsSync(SRC_DIR)) {
  const srcEntries = fs.readdirSync(SRC_DIR, { withFileTypes: true });
  for (const entry of srcEntries) {
    if (entry.isDirectory()) {
      if (!ALLOWED_SRC_SUBDIRS.has(entry.name)) {
        error(`Unexpected directory "src/${entry.name}/". Allowed plural subdirectories under src/ are: ${Array.from(ALLOWED_SRC_SUBDIRS).sort().join(', ')}.`);
      }
    } else if (entry.isFile()) {
      // Allow root-level Astro files like env.d.ts, middleware.ts, content.config.ts
      const allowedRootFiles = new Set(['env.d.ts', 'middleware.ts', 'content.config.ts']);
      if (!allowedRootFiles.has(entry.name)) {
        error(`Unexpected file "src/${entry.name}". Root-level files in src/ are restricted to: ${Array.from(allowedRootFiles).sort().join(', ')}.`);
      }
    }
  }
  success(`src/ subdirectories strictly adhere to the whitelisted plural domains (${Array.from(ALLOWED_SRC_SUBDIRS).length} domains).`);
}

// 3. Check src/commons/ directory structure
const commonsDir = path.resolve(SRC_DIR, 'commons');
if (fs.existsSync(commonsDir)) {
  const commonsEntries = fs.readdirSync(commonsDir, { withFileTypes: true });
  for (const entry of commonsEntries) {
    if (entry.isDirectory()) {
      if (!ALLOWED_COMMONS_SUBDIRS.has(entry.name)) {
        error(`Unexpected directory "src/commons/${entry.name}/". Allowed subdirectories are: ${Array.from(ALLOWED_COMMONS_SUBDIRS).sort().join(', ')}.`);
      }
    } else if (entry.isFile()) {
      error(`Unexpected file "src/commons/${entry.name}". src/commons/ must only contain subdirectories (client/, server/, shared/).`);
    }
  }
  success('src/commons/ contains only client/, server/, and shared/ domains.');
}

// 4. Check src/components/ root hygiene
const componentsDir = path.resolve(SRC_DIR, 'components');
if (fs.existsSync(componentsDir)) {
  const componentEntries = fs.readdirSync(componentsDir, { withFileTypes: true });
  for (const entry of componentEntries) {
    if (entry.isFile()) {
      if (!entry.name.endsWith('.astro')) {
        error(`Forbidden non-astro file "src/components/${entry.name}". Direct files under src/components/ must strictly be .astro components.`);
      }
    }
  }
  success('src/components/ root contains strictly .astro component files.');
}

// 5. Summary and exit code
console.log('');
if (errorCount > 0) {
  console.error(`💥 [validate:architecture] Validation failed with ${errorCount} error(s).`);
  process.exit(1);
} else {
  console.log('🎉 [validate:architecture] All architectural gates passed successfully!');
}
