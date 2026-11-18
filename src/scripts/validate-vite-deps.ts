import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT_DIR = process.cwd();
const VIS_DIR = path.resolve(ROOT_DIR, 'src', 'content', 'visualizations');
const ASTRO_CONFIG_PATH = path.resolve(ROOT_DIR, 'astro.config.ts');
const TSCONFIG_PATH = path.resolve(ROOT_DIR, 'tsconfig.json');

/**
 * Loads configured TypeScript path alias prefixes (e.g. "@commons/") from tsconfig.json.
 */
function loadPathAliasPrefixes(): string[] {
  if (!fs.existsSync(TSCONFIG_PATH)) {
    return ['@commons/', '@components/', '@layouts/', '@assets/', '@styles/', '@content/', '@plugins/', '@tools/'];
  }
  const raw = JSON.parse(fs.readFileSync(TSCONFIG_PATH, 'utf8')) as {
    compilerOptions?: { paths?: Record<string, string[]> };
  };
  const paths = raw.compilerOptions?.paths ?? {};
  return Object.keys(paths).map((key) => key.replace(/\*$/, ''));
}

/**
 * Extracts all runtime external npm package specifiers imported by a TypeScript file.
 */
function extractExternalImports(filePath: string, aliasPrefixes: string[]): string[] {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];

  function isExternalSpecifier(specifier: string): boolean {
    if (specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/')) {
      return false;
    }
    if (specifier.startsWith('node:')) {
      return false;
    }
    if (aliasPrefixes.some((prefix) => specifier.startsWith(prefix))) {
      return false;
    }
    return true;
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      if (node.importClause?.phaseModifier !== ts.SyntaxKind.TypeKeyword && ts.isStringLiteral(node.moduleSpecifier)) {
        const spec = node.moduleSpecifier.text;
        if (isExternalSpecifier(spec)) {
          specifiers.push(spec);
        }
      }
    } else if (ts.isExportDeclaration(node)) {
      if (!node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const spec = node.moduleSpecifier.text;
        if (isExternalSpecifier(spec)) {
          specifiers.push(spec);
        }
      }
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg)) {
        const spec = arg.text;
        if (isExternalSpecifier(spec)) {
          specifiers.push(spec);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

/**
 * Extracts string entries from `vite.optimizeDeps.include` in astro.config.ts.
 */
function extractOptimizeDepsInclude(configPath: string): Set<string> {
  if (!fs.existsSync(configPath)) {
    throw new Error(`astro.config.ts not found at ${configPath}`);
  }
  const sourceText = fs.readFileSync(configPath, 'utf8');
  const sourceFile = ts.createSourceFile(configPath, sourceText, ts.ScriptTarget.Latest, true);
  const included = new Set<string>();
  let foundOptimizeDepsInclude = false;

  function visit(node: ts.Node): void {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'optimizeDeps' &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const prop of node.initializer.properties) {
        if (
          ts.isPropertyAssignment(prop) &&
          ts.isIdentifier(prop.name) &&
          prop.name.text === 'include' &&
          ts.isArrayLiteralExpression(prop.initializer)
        ) {
          foundOptimizeDepsInclude = true;
          for (const elem of prop.initializer.elements) {
            if (ts.isStringLiteral(elem) || ts.isNoSubstitutionTemplateLiteral(elem)) {
              included.add(elem.text);
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!foundOptimizeDepsInclude) {
    throw new Error('Could not locate vite.optimizeDeps.include array in astro.config.ts');
  }

  return included;
}

function validateViteDeps(): void {
  const aliasPrefixes = loadPathAliasPrefixes();
  const optimizeDepsInclude = extractOptimizeDepsInclude(ASTRO_CONFIG_PATH);

  if (!fs.existsSync(VIS_DIR)) {
    console.log('✅ [validate:vite-deps] No visualizations directory found; nothing to check.');
    return;
  }

  const entries = fs.readdirSync(VIS_DIR, { withFileTypes: true });
  const errors: string[] = [];
  let engineCount = 0;
  let checkedImports = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const enginePath = path.join(VIS_DIR, entry.name, 'engine.ts');
    if (!fs.existsSync(enginePath)) continue;

    engineCount++;
    const externalImports = extractExternalImports(enginePath, aliasPrefixes);
    for (const pkg of externalImports) {
      checkedImports++;
      if (!optimizeDepsInclude.has(pkg)) {
        const relPath = path.relative(ROOT_DIR, enginePath).replace(/\\/g, '/');
        errors.push(
          `${relPath} imports "${pkg}", which is missing from vite.optimizeDeps.include in astro.config.ts.`
        );
      }
    }
  }

  if (errors.length > 0) {
    console.error('❌ [validate:vite-deps] Vite optimizeDeps validation failed:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log(
    `✅ [validate:vite-deps] Verified ${checkedImports} external npm import(s) across ${engineCount} visualization engine(s) against vite.optimizeDeps.include.`
  );
}

validateViteDeps();
