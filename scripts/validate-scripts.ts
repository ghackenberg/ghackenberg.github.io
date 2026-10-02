import fs from 'node:fs';
import path from 'node:path';

/**
 * Validates that every top-level TypeScript file in scripts/ is referenced
 * in package.json under "scripts", and that every scripts/ target exists.
 */
function validateScripts(): void {
  const rootDir = process.cwd();
  const pkgPath = path.resolve(rootDir, 'package.json');
  const scriptsDir = path.resolve(rootDir, 'scripts');

  if (!fs.existsSync(pkgPath)) {
    throw new Error('package.json not found');
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const scripts: Record<string, string> = pkg.scripts || {};

  // 1. Get all top-level .ts files in scripts/ (excluding subdirectories like lib/, sync/, templates/)
  const scriptFiles = fs
    .readdirSync(scriptsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => entry.name);

  const scriptValues = Object.values(scripts);

  const errors: string[] = [];

  // Check 1: Every scripts/*.ts must be referenced in at least one package.json script
  for (const file of scriptFiles) {
    const isReferenced = scriptValues.some((cmd) => {
      const normalizedCmd = cmd.replace(/\\/g, '/');
      return normalizedCmd.includes(`scripts/${file}`);
    });

    if (!isReferenced) {
      errors.push(`Orphan script found: "scripts/${file}" has no corresponding entry in package.json "scripts".`);
    }
  }

  // Check 2: Every reference to scripts/ in package.json must exist
  const SCRIPT_PATH_REGEX = /scripts\/([a-zA-Z0-9_\-\.\/]+\.ts)\b/g;
  for (const [name, cmd] of Object.entries(scripts)) {
    const normalizedCmd = cmd.replace(/\\/g, '/');
    let match: RegExpExecArray | null;
    while ((match = SCRIPT_PATH_REGEX.exec(normalizedCmd)) !== null) {
      const targetRelPath = `scripts/${match[1]}`;
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

  console.log(`✅ All ${scriptFiles.length} scripts in scripts/ are registered in package.json, and all targets exist.`);
}

validateScripts();
