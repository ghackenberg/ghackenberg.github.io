import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root is two levels up from scripts/mcp-unified-analytics
export const PACKAGE_ROOT = path.resolve(__dirname, '..');
export const PROJECT_ROOT = path.resolve(PACKAGE_ROOT, '../..');

// Try loading .env from package root first, then project root
const packageEnv = path.join(PACKAGE_ROOT, '.env');
const projectEnv = path.join(PROJECT_ROOT, '.env');

if (fs.existsSync(packageEnv)) {
  dotenv.config({ path: packageEnv });
} else if (fs.existsSync(projectEnv)) {
  dotenv.config({ path: projectEnv });
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
    // If relative, check package root first, then project root
    const inPkg = path.resolve(PACKAGE_ROOT, keyFile);
    const inProj = path.resolve(PROJECT_ROOT, keyFile);
    if (fs.existsSync(inPkg)) {
      keyFile = inPkg;
    } else if (fs.existsSync(inProj)) {
      keyFile = inProj;
    } else {
      keyFile = inPkg; // default to package root
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
