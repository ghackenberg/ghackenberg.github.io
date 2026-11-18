import { spawnSync } from 'node:child_process';

interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

/**
 * Executes a CLI command with piped stdio and cross-platform Windows shell support.
 */
function runCommand(command: string, args: string[]): CommandResult {
  const fullCommand = [command, ...args].join(' ');
  const result = spawnSync(fullCommand, {
    stdio: 'pipe',
    encoding: 'utf8',
    shell: true,
  });

  if (result.error) {
    return {
      status: 1,
      stdout: result.stdout ?? '',
      stderr: result.error.message,
    };
  }

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/**
 * Returns the major version of the local npm CLI, or null if unavailable.
 */
function getNpmMajorVersion(): number | null {
  const res = runCommand('npm', ['--version']);
  if (res.status !== 0) return null;
  const major = Number.parseInt(res.stdout.trim().split('.')[0] ?? '', 10);
  return Number.isNaN(major) ? null : major;
}

function reportFailure(label: string, res: CommandResult, hint?: string): never {
  console.error(`❌ Lockfile validation failed (${label}):`);
  if (res.stderr.trim()) console.error(res.stderr.trim());
  if (res.stdout.trim()) console.error(res.stdout.trim());
  if (hint) console.error(`\n💡 ${hint}`);
  process.exit(1);
}

/**
 * Validates that package-lock.json is synchronized with package.json, including
 * an npm@10.9.2 compatibility check when running locally on npm >= 11.
 */
function validateLockfile(): void {
  const localRes = runCommand('npm', ['ci', '--dry-run', '--ignore-scripts']);
  if (localRes.status !== 0) {
    reportFailure('npm ci --dry-run --ignore-scripts', localRes);
  }

  const isCi = Boolean(process.env.CI) || process.argv.includes('--ci');
  const npmMajor = getNpmMajorVersion();
  const checkedNpm10 = !isCi && npmMajor !== null && npmMajor >= 11;

  if (checkedNpm10) {
    const ciRes = runCommand('npx', ['-y', 'npm@10.9.2', 'ci', '--dry-run', '--ignore-scripts']);
    if (ciRes.status !== 0) {
      reportFailure(
        'npx -y npm@10.9.2 ci --dry-run --ignore-scripts',
        ciRes,
        'Run "npx -y npm@10.9.2 install --package-lock-only" to regenerate package-lock.json for GitHub Actions (Node 22 / npm 10).'
      );
    }
  }

  const suffix = checkedNpm10 ? ' + npm@10.9.2 CI check' : '';
  console.log(`✅ Lockfile is in sync with package.json (local npm v${npmMajor ?? 'unknown'}${suffix}).`);
}

validateLockfile();
