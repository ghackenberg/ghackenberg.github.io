import fs from 'node:fs';
import path from 'node:path';

/**
 * Recursively retrieves all .ts files in a directory
 */
function getAllTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Validates that EVERY TypeScript file in the scripts/ directory (including any subdirectories)
 * is registered as a CLI command in package.json under "scripts", and that every scripts/ target exists.
 */
function validateScripts(): void {
  const rootDir = process.cwd();
  const pkgPath = path.resolve(rootDir, 'package.json');
  const scriptsDir = path.resolve(rootDir, 'src', 'scripts');

  if (!fs.existsSync(pkgPath)) {
    throw new Error('package.json not found');
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const scripts: Record<string, string> = pkg.scripts || {};

  // 1. Get all .ts files in src/scripts/ recursively
  const allScriptFiles = getAllTsFiles(scriptsDir);
  const scriptValues = Object.values(scripts);

  const errors: string[] = [];

  // Check 1: Every script in src/scripts/ must be referenced in at least one package.json script
  for (const file of allScriptFiles) {
    const relPath = path.relative(rootDir, file).replace(/\\/g, '/');
    const isReferenced = scriptValues.some((cmd) => {
      const normalizedCmd = cmd.replace(/\\/g, '/');
      return normalizedCmd.includes(relPath);
    });

    if (!isReferenced) {
      errors.push(`Orphan script found: "${relPath}" has no corresponding entry in package.json "scripts". Helper libraries belong in src/commons/.`);
    }
  }

  // Check 2: Every reference to src/scripts/ in package.json must exist on disk
  const SCRIPT_PATH_REGEX = /src\/scripts\/([a-zA-Z0-9_\-\.\/]+\.ts)\b/g;
  for (const [name, cmd] of Object.entries(scripts)) {
    const normalizedCmd = cmd.replace(/\\/g, '/');
    let match: RegExpExecArray | null;
    while ((match = SCRIPT_PATH_REGEX.exec(normalizedCmd)) !== null) {
      const targetRelPath = `src/scripts/${match[1]}`;
      const targetAbsPath = path.resolve(rootDir, targetRelPath);
      if (!fs.existsSync(targetAbsPath)) {
        errors.push(`Broken script command "${name}": references "${targetRelPath}", which does not exist on disk.`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('❌ Script contract validation failed:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log(`✅ All ${allScriptFiles.length} scripts in src/scripts/ are registered in package.json, and all targets exist.`);
}

validateScripts();
