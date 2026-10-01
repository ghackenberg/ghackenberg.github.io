import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findProjectRoot(startDir: string): string {
  let curr = startDir;
  while (curr !== path.dirname(curr)) {
    if (fs.existsSync(path.join(curr, 'package.json'))) {
      return curr;
    }
    curr = path.dirname(curr);
  }
  return process.cwd();
}

export const PROJECT_ROOT = findProjectRoot(__dirname);

// Load .env from project root, with fallback to legacy sub-package path
const projectEnv = path.join(PROJECT_ROOT, '.env');
const legacyEnv = path.join(PROJECT_ROOT, 'scripts/mcp-unified-analytics/.env');

if (fs.existsSync(projectEnv)) {
  dotenv.config({ path: projectEnv });
} else if (fs.existsSync(legacyEnv)) {
  dotenv.config({ path: legacyEnv });
} else {
  dotenv.config(); // default fallback
}

export interface AppConfig {
  projectRoot: string;
  siteBaseUrl: string;
  gsc: {
    siteUrl: string;
    keyFile?: string;
    credentialsJson?: string;
  };
  plausible: {
    apiKey?: string;
    siteId: string;
    host: string;
  };
}

export function getConfig(): AppConfig {
  const siteBaseUrl = process.env.SITE_BASE_URL || 'https://hackenberg.tech';
  const gscSiteUrl = process.env.GSC_SITE_URL || 'sc-domain:hackenberg.tech';
  
  let keyFile = process.env.GSC_SERVICE_ACCOUNT_KEY_FILE;
  if (keyFile && !path.isAbsolute(keyFile)) {
    const inProj = path.resolve(PROJECT_ROOT, keyFile);
    const inLegacy = path.resolve(PROJECT_ROOT, 'scripts/mcp-unified-analytics', keyFile);
    if (fs.existsSync(inProj)) {
      keyFile = inProj;
    } else if (fs.existsSync(inLegacy)) {
      keyFile = inLegacy;
    } else {
      keyFile = inProj;
    }
  }

  const credentialsJson = process.env.GSC_SERVICE_ACCOUNT_JSON;

  const plausibleApiKey = process.env.PLAUSIBLE_API_KEY;
  const plausibleSiteId = process.env.PLAUSIBLE_SITE_ID || 'hackenberg.tech';
  const plausibleHost = (process.env.PLAUSIBLE_HOST || 'https://plausible.io').replace(/\/$/, '');

  return {
    projectRoot: PROJECT_ROOT,
    siteBaseUrl,
    gsc: {
      siteUrl: gscSiteUrl,
      keyFile,
      credentialsJson,
    },
    plausible: {
      apiKey: plausibleApiKey,
      siteId: plausibleSiteId,
      host: plausibleHost,
    },
  };
}
