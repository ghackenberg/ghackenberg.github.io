import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';

interface SkillViolation {
  skill: string;
  rule: string;
  message: string;
}

const ROOT_DIR = process.cwd();
const SKILLS_DIR = path.resolve(ROOT_DIR, '.agents', 'skills');
const PKG_PATH = path.resolve(ROOT_DIR, 'package.json');

const GLOBAL_LIFECYCLE_COMMANDS = new Set([
  'npm run verify',
  'npm run build',
  'npm run validate',
  'npm run typecheck',
  'npm run lint',
]);

const DOMAIN_COMMAND_OWNERS: Record<string, string[]> = {
  'validate:slides': ['presentation-authoring', 'build-engineering'],
  'validate:slides:syntax': ['presentation-authoring'],
  'audio:presentations': ['presentation-authoring'],
  'audio:talks': ['presentation-authoring'],
  'export:slides': ['presentation-authoring'],
  'export:slides-thumbs': ['presentation-authoring'],

  'validate:citations:syntax': ['citation-management', 'presentation-authoring', 'post-authoring'],
  'lint:citations': ['citation-management'],
  'lint:citations:ci': ['citation-management', 'build-engineering'],

  'lighthouse': ['site-optimization'],
  'mcp:analytics': ['site-analytics', 'tool-engineering'],

  'validate:skills': ['skill-engineering', 'build-engineering'],
  'validate:scripts': ['build-engineering'],
  'validate:architecture': ['build-engineering'],
  'validate:semantic-ids': ['build-engineering'],
  'lint:styles': ['presentation-authoring', 'build-engineering'],
};

const BASH_PATTERNS = [
  /\brm\s+-rf\b/,
  /\brm\s+[a-zA-Z0-9_\-\.\/]+/,
  /\bcp\s+[a-zA-Z0-9_\-\.\/]+/,
  /\bmv\s+[a-zA-Z0-9_\-\.\/]+/,
  /\bcat\s+[a-zA-Z0-9_\-\.\/]+/,
  /\bgrep\s+/,
  /\bexport\s+[A-Z_]+=/
];

const ANTI_LEAKAGE_RULES: Array<{
  name: string;
  pattern: RegExp;
  allowedSkills: string[];
  description: string;
}> = [
  {
    name: 'Brand Color Hex Codes',
    pattern: /#(?:030712|3b82f6|f59e0b|a855f7|10b981)/i,
    allowedSkills: ['image-generation', 'svg-graphics'],
    description: 'Hardcoded brand palette hex colors belong exclusively to "image-generation" and "svg-graphics".',
  },
  {
    name: 'Telemetry Dwell & Event Specs',
    pattern: /\b(?:2\.0s dwell|1\.5s dwell|Section Viewed|Card Viewed)\b/i,
    allowedSkills: ['site-analytics'],
    description: 'Telemetry threshold metrics and internal event names belong exclusively to "site-analytics".',
  },
  {
    name: 'Austrian Legal Norms',
    pattern: /(?:§\s*5\s*ECG|§\s*14\s*UGB|§\s*345\s*GewO|§\s*25\s*Mediengesetz|TKG\s*2021)/i,
    allowedSkills: ['legal-compliance'],
    description: 'Austrian statutory disclosures belong exclusively to "legal-compliance".',
  },
  {
    name: 'Backlog RFC IDs',
    pattern: /\b(?:SYSTEM-\d+|CONTENT-\d+)\b/,
    allowedSkills: ['backlog-management'],
    description: 'RFC ID numbering conventions belong exclusively to "backlog-management".',
  },
];

function validateSkills(): void {
  const violations: SkillViolation[] = [];

  if (!fs.existsSync(PKG_PATH)) {
    throw new Error('package.json not found in working directory');
  }
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  const registeredScripts: Record<string, string> = pkg.scripts || {};

  if (!fs.existsSync(SKILLS_DIR)) {
    throw new Error(`.agents/skills directory not found at ${SKILLS_DIR}`);
  }

  const skillDirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const skillDirSet = new Set(skillDirs);

  for (const skillName of skillDirs) {
    const skillPath = path.join(SKILLS_DIR, skillName);
    const skillFile = path.join(skillPath, 'SKILL.md');

    // Rule 1: Strict 2-word hyphenated naming
    if (!/^[a-z0-9]+-[a-z0-9]+$/.test(skillName)) {
      violations.push({
        skill: skillName,
        rule: 'naming-convention',
        message: `Directory "${skillName}" violates strict 2-word hyphenated naming (must match ^[a-z0-9]+-[a-z0-9]+$).`
      });
    }

    if (!fs.existsSync(skillFile)) {
      violations.push({
        skill: skillName,
        rule: 'missing-skill-file',
        message: `Missing SKILL.md in directory "${skillName}".`
      });
      continue;
    }

    const content = fs.readFileSync(skillFile, 'utf8');
    const lines = content.split(/\r?\n/);

    // Rule 2: Anti-bloat line cap (<200 lines)
    if (lines.length > 200) {
      violations.push({
        skill: skillName,
        rule: 'line-count-cap',
        message: `SKILL.md has ${lines.length} lines, exceeding the 200-line anti-bloat cap.`
      });
    }

    // Rule 3: Frontmatter extraction & Level-1 metadata
    if (!content.startsWith('---')) {
      violations.push({
        skill: skillName,
        rule: 'frontmatter-missing',
        message: 'SKILL.md must start with YAML frontmatter delimiter "---".'
      });
      continue;
    }

    const closingIndex = content.indexOf('\n---', 3);
    if (closingIndex === -1) {
      violations.push({
        skill: skillName,
        rule: 'frontmatter-unterminated',
        message: 'YAML frontmatter does not have a closing "---" delimiter.'
      });
      continue;
    }

    const rawFrontmatter = content.substring(3, closingIndex).trim();
    const body = content.substring(closingIndex + 4);

    interface ParsedFrontmatter {
      name?: string;
      description?: string;
      [key: string]: string | number | boolean | null | undefined | Record<string, string>;
    }

    let frontmatter: ParsedFrontmatter = {};
    try {
      frontmatter = (yaml.parse(rawFrontmatter) || {}) as ParsedFrontmatter;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      violations.push({
        skill: skillName,
        rule: 'frontmatter-yaml-error',
        message: `Malformed YAML frontmatter: ${errMsg}`
      });
      continue;
    }

    // Rule 3b: Frontmatter name matches directory name
    if (frontmatter.name !== skillName) {
      violations.push({
        skill: skillName,
        rule: 'frontmatter-name-mismatch',
        message: `Frontmatter "name: ${String(frontmatter.name)}" does not match directory name "${skillName}".`
      });
    }

    // Rule 3c: Description length & action verb
    const description = typeof frontmatter.description === 'string' ? frontmatter.description.trim() : '';
    if (!description || description.length < 30 || description.length > 250) {
      violations.push({
        skill: skillName,
        rule: 'description-economy',
        message: `Frontmatter description must be between 30 and 250 characters (currently ${description.length} chars).`
      });
    }

    // Rule 4: No horizontal dividers in markdown body (outside code blocks)
    const bodyLines = body.split(/\r?\n/);
    let inFencedBlock = false;
    for (let i = 0; i < bodyLines.length; i++) {
      const line = bodyLines[i].trim();
      if (line.startsWith('```')) {
        inFencedBlock = !inFencedBlock;
        continue;
      }
      if (!inFencedBlock && (line === '---' || line === '***' || line === '___')) {
        violations.push({
          skill: skillName,
          rule: 'markdown-divider-ban',
          message: `Forbidden horizontal divider "${line}" at body line ${i + 1}. Use semantic headings instead.`
        });
      }
    }

    // Rule 5: Anti-Bash / PowerShell syntax guard
    const codeBlockRegex = /```(?:powershell|bash|sh|ps1)?\r?\n([\s\S]*?)```/g;
    let codeMatch: RegExpExecArray | null;
    while ((codeMatch = codeBlockRegex.exec(body)) !== null) {
      const code = codeMatch[1];
      for (const pattern of BASH_PATTERNS) {
        if (pattern.test(code)) {
          violations.push({
            skill: skillName,
            rule: 'bash-syntax-ban',
            message: `Forbidden bash syntax "${pattern.source}" in code block. The project execution environment is Windows PowerShell.`
          });
        }
      }

      // Check chained bash commands (&&)
      if (code.includes('&&')) {
        violations.push({
          skill: skillName,
          rule: 'bash-chaining-ban',
          message: 'Forbidden bash command chaining "&&" in code block. Use PowerShell syntax (";" or independent commands).'
        });
      }

      // Rule 6: Command Governance & Verification Ownership
      const npmRunRegex = /\bnpm\s+run\s+([a-zA-Z0-9_\-:]+)\b/g;
      let npmMatch: RegExpExecArray | null;
      while ((npmMatch = npmRunRegex.exec(code)) !== null) {
        const cmdName = npmMatch[1];
        const fullCmd = `npm run ${cmdName}`;

        // Check if script exists in package.json
        if (!registeredScripts[cmdName]) {
          violations.push({
            skill: skillName,
            rule: 'unknown-npm-script',
            message: `Command "${fullCmd}" is not registered in package.json "scripts".`
          });
          continue;
        }

        // Check global lifecycle command restriction
        if (GLOBAL_LIFECYCLE_COMMANDS.has(fullCmd)) {
          if (skillName !== 'build-engineering') {
            violations.push({
              skill: skillName,
              rule: 'global-command-quarantine',
              message: `Forbidden global lifecycle command "${fullCmd}". Global build and verification belongs exclusively to "build-engineering". Specialist skills must rely on the global release gate.`
            });
          }
        }

        // Check domain command ownership
        if (DOMAIN_COMMAND_OWNERS[cmdName]) {
          const allowed = DOMAIN_COMMAND_OWNERS[cmdName];
          if (!allowed.includes(skillName)) {
            violations.push({
              skill: skillName,
              rule: 'domain-command-restriction',
              message: `Command "${fullCmd}" is restricted to [${allowed.join(', ')}], but referenced in "${skillName}".`
            });
          }
        }
      }
    }

    // Rule 7: Single Source of Truth / Anti-Leakage
    for (const rule of ANTI_LEAKAGE_RULES) {
      if (!rule.allowedSkills.includes(skillName)) {
        if (rule.pattern.test(body)) {
          violations.push({
            skill: skillName,
            rule: 'anti-leakage',
            message: `Violation of "${rule.name}": ${rule.description} Found pattern matching ${rule.pattern.source}.`
          });
        }
      }
    }

    // Rule 8: Physical Path Existence in Repository
    const pathRegex = /`((?:src\/|public\/|backlog\/|\.agents\/skills\/)[a-zA-Z0-9_\-\.\/]+)`/g;
    let pathMatch: RegExpExecArray | null;
    while ((pathMatch = pathRegex.exec(body)) !== null) {
      const referencedPath = pathMatch[1];
      // Skip paths that include wildcards or placeholders (e.g. <id>, [id], *, [slug])
      if (/[<\[*]/.test(referencedPath)) continue;

      const fullReferencedPath = path.resolve(ROOT_DIR, referencedPath);
      if (!fs.existsSync(fullReferencedPath)) {
        violations.push({
          skill: skillName,
          rule: 'dead-repository-path',
          message: `Referenced repository path "${referencedPath}" does not exist on disk.`
        });
      }
    }

    // Rule 9: Cross-Skill Reference Validation
    const skillRefRegex = /`([a-z0-9]+-[a-z0-9]+)`/g;
    let skillRefMatch: RegExpExecArray | null;
    while ((skillRefMatch = skillRefRegex.exec(body)) !== null) {
      const referencedSkill = skillRefMatch[1];
      if (referencedSkill === skillName) continue;
      if (referencedSkill.includes(':')) continue;

      const matchIndex = skillRefMatch.index;
      const snippet = body.substring(Math.max(0, matchIndex - 20), Math.min(body.length, matchIndex + referencedSkill.length + 20));
      if (/\bskill\b/i.test(snippet) || /\bsee\s+`/i.test(snippet) || /\bunder\s+`/i.test(snippet)) {
        if (!skillDirSet.has(referencedSkill)) {
          violations.push({
            skill: skillName,
            rule: 'dead-skill-reference',
            message: `Referenced skill "${referencedSkill}" does not exist in .agents/skills/.`
          });
        }
      }
    }

function dedent(str: string): string {
  const lines = str.split(/\r?\n/);
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  if (lines.length === 0) return '';
  const minIndent = lines
    .filter((l) => l.trim().length > 0)
    .reduce((min, l) => Math.min(min, l.match(/^(\s*)/)?.[1].length || 0), Infinity);
  return lines.map((l) => (l.length >= minIndent ? l.substring(minIndent) : l)).join('\n');
}

    // Rule 10: YAML Code Block Syntax Validation
    const yamlBlockRegex = /```yaml\r?\n([\s\S]*?)```/g;
    let yamlMatch: RegExpExecArray | null;
    while ((yamlMatch = yamlBlockRegex.exec(body)) !== null) {
      let yamlCode = dedent(yamlMatch[1]);
      // Strip outer frontmatter delimiters if presented inside example block
      if (yamlCode.startsWith('---')) {
        yamlCode = yamlCode.replace(/^---\r?\n/, '');
      }
      if (yamlCode.endsWith('---')) {
        yamlCode = yamlCode.replace(/\r?\n---$/, '');
      }
      yamlCode = dedent(yamlCode);
      if (yamlCode.includes('...') || yamlCode.includes('<')) continue;
      try {
        yaml.parse(yamlCode);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        violations.push({
          skill: skillName,
          rule: 'invalid-yaml-example',
          message: `YAML code example failed syntax validation: ${errMsg}`
        });
      }
    }
  }

  // Summary & Reporting
  console.log(`\n[validate-skills] Audited ${skillDirs.length} skills in .agents/skills/...\n`);

  if (violations.length > 0) {
    console.error(`[validate-skills] ❌ Found ${violations.length} skill quality violation(s):\n`);
    for (const v of violations) {
      console.error(`  - [${v.skill}] (${v.rule}): ${v.message}`);
    }
    console.error('');
    process.exit(1);
  }

  console.log(`[validate-skills] ✅ All ${skillDirs.length} skills passed all structural, semantic, and command-governance checks!\n`);
}

validateSkills();
