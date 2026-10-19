import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  LISTMONK_STATIC_TEMPLATE_FILENAMES,
  renderAllListmonkStaticTemplates,
  type ListmonkStaticTemplateFilename,
} from '@commons/server/email/ListmonkTransactionalEmail';
import {
  compileListmonkPublicShell,
  type CompiledListmonkPublicShell,
} from '@commons/server/email/ListmonkPublicShell';
import { renderListmonkCampaignTemplate } from '@commons/server/email/ListmonkCampaignTemplate';
import { renderNewsletterIssueEmail } from '@commons/server/email/NewsletterIssueEmail';
import {
  loadAllNewsletterIssues,
  loadNewsletterIssue,
  type ParsedNewsletterIssue,
} from '@commons/server/email/newsletter-loader';

const PUBLIC_LIST_UUID = 'b38e9b53-59e6-4ab3-8a67-d047041a9e0e';

interface ListmonkTemplateRecord {
  id: number;
  name: string;
  type?: string;
  subject?: string;
  body: string;
  is_default: boolean;
}

interface ListmonkListRecord {
  id: number;
  uuid: string;
  name: string;
}

interface ListmonkCampaignRecord {
  id: number;
  uuid: string;
  name: string;
  subject: string;
  status: string;
  tags: string[];
}

interface ListmonkListResponse {
  data: {
    results: ListmonkListRecord[];
  };
}

interface ListmonkTemplatesResponse {
  data: ListmonkTemplateRecord[];
}

interface ListmonkCampaignsListResponse {
  data: {
    results: ListmonkCampaignRecord[];
  };
}

interface ListmonkCampaignResponse {
  data: ListmonkCampaignRecord;
}

interface CliOptions {
  syncAll: boolean;
  syncTemplates: boolean;
  issueSlug?: string;
}

interface RemoteTrackedFile {
  key: string;
  localPath: string;
  remoteRelPath: string;
  localSha256: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    syncAll: false,
    syncTemplates: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--all') {
      options.syncAll = true;
      options.syncTemplates = true;
    } else if (arg === '--templates') {
      options.syncTemplates = true;
    } else if (arg === '--issue' && i + 1 < argv.length) {
      options.issueSlug = argv[i + 1];
      i++;
    } else if (arg.startsWith('--issue=')) {
      options.issueSlug = arg.slice('--issue='.length);
    }
  }

  return options;
}

function getAuthConfig(): { baseUrl: string; authHeader: string } {
  const baseUrl = (process.env.LISTMONK_URL || 'https://news.hackenberg.tech').replace(
    /\/+$/,
    ''
  );
  const apiUser = process.env.LISTMONK_API_USER;
  const apiToken = process.env.LISTMONK_API_TOKEN;

  if (!apiUser || !apiToken) {
    throw new Error(
      'Missing Listmonk credentials. Please set LISTMONK_API_USER and LISTMONK_API_TOKEN in your .env file.'
    );
  }

  const credentials = Buffer.from(`${apiUser}:${apiToken}`, 'utf-8').toString('base64');
  return {
    baseUrl,
    authHeader: `Basic ${credentials}`,
  };
}

function computeFileSha256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function syncStaticTemplatesViaSsh(
  staticEmailFilePaths: Record<ListmonkStaticTemplateFilename, string>,
  publicShell: CompiledListmonkPublicShell
): void {
  const sshHost = process.env.LISTMONK_SSH_HOST;
  const sshPort = process.env.LISTMONK_SSH_PORT || '22';
  const sshUser = process.env.LISTMONK_SSH_USER || 'root';
  const dockerDir = process.env.LISTMONK_DOCKER_DIR || '/var/www/listmonk/hackenberg.tech';
  const sshKeyPath = process.env.LISTMONK_SSH_KEY_PATH;

  if (!sshHost) {
    console.log(
      '[Listmonk Sync] LISTMONK_SSH_HOST not set — skipping SSH static template deployment.'
    );
    return;
  }

  const trackedFiles: RemoteTrackedFile[] = [];

  for (const filename of LISTMONK_STATIC_TEMPLATE_FILENAMES) {
    const localPath = staticEmailFilePaths[filename];
    trackedFiles.push({
      key: `EMAIL_${filename}`,
      localPath,
      remoteRelPath: `static/email-templates/${filename}`,
      localSha256: computeFileSha256(localPath),
    });
  }

  trackedFiles.push(
    {
      key: 'PUBLIC_TPL_index.html',
      localPath: publicShell.indexHtmlPath,
      remoteRelPath: 'static/public/templates/index.html',
      localSha256: computeFileSha256(publicShell.indexHtmlPath),
    },
    {
      key: 'PUBLIC_STATIC_style.css',
      localPath: publicShell.styleCssPath,
      remoteRelPath: 'static/public/static/style.css',
      localSha256: computeFileSha256(publicShell.styleCssPath),
    },
    {
      key: 'PUBLIC_STATIC_logo.svg',
      localPath: publicShell.logoSvgPath,
      remoteRelPath: 'static/public/static/logo.svg',
      localSha256: computeFileSha256(publicShell.logoSvgPath),
    },
    {
      key: 'PUBLIC_STATIC_favicon.png',
      localPath: publicShell.faviconPngPath,
      remoteRelPath: 'static/public/static/favicon.png',
      localSha256: computeFileSha256(publicShell.faviconPngPath),
    }
  );

  const sshBaseArgs = [
    '-p',
    sshPort,
    '-o',
    'StrictHostKeyChecking=accept-new',
    ...(sshKeyPath ? ['-i', sshKeyPath] : []),
    `${sshUser}@${sshHost}`,
  ];

  const scpBaseArgs = [
    '-P',
    sshPort,
    '-o',
    'StrictHostKeyChecking=accept-new',
    ...(sshKeyPath ? ['-i', sshKeyPath] : []),
  ];

  const hashLines = trackedFiles.map(
    (item) =>
      `echo "HASH_${item.key}=$(sha256sum "${dockerDir}/${item.remoteRelPath}" 2>/dev/null | awk '{print $1}' || true)"`
  );

  const remoteCheckScript = [
    'set -e',
    'VER=$(docker exec listmonk_hackenberg_app ./listmonk --version 2>&1 | grep -oE "v[0-9]+\\.[0-9]+\\.[0-9]+" | head -n 1 || true)',
    '[ -z "$VER" ] && VER="v6.2.0"',
    `if [ ! -d "${dockerDir}/static/email-templates" ] || [ ! -d "${dockerDir}/static/public/templates" ] || [ ! -f "${dockerDir}/static/.shell-only-v2" ] || [ "$(cat "${dockerDir}/static/.listmonk-version" 2>/dev/null || true)" != "$VER" ]; then`,
    `  rm -rf "${dockerDir}/static" && mkdir -p "${dockerDir}/static" && wget -qO - "https://github.com/knadh/listmonk/archive/refs/tags/\${VER}.tar.gz" | tar xz -C "${dockerDir}/static" --strip=2 "listmonk-\${VER#v}/static" && echo "$VER" > "${dockerDir}/static/.listmonk-version" && echo "1" > "${dockerDir}/static/.shell-only-v2"`,
    'fi',
    ...hashLines,
    `HAS_STATIC_FLAG=$(grep -q -- "--static-dir=/listmonk/static" "${dockerDir}/docker-compose.yml" && echo "yes" || echo "no")`,
    'echo "HAS_STATIC_FLAG=${HAS_STATIC_FLAG}"',
  ].join('\n');

  const checkOutput = execFileSync('ssh', [...sshBaseArgs, remoteCheckScript], {
    encoding: 'utf-8',
  });

  const hasStaticFlag =
    checkOutput.match(/^HAS_STATIC_FLAG=(\S+)/m)?.[1]?.trim() === 'yes';

  const allHashesMatch = trackedFiles.every((item) => {
    const escapedKey = item.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const remoteHash =
      checkOutput.match(new RegExp(`^HASH_${escapedKey}=(\\S+)`, 'm'))?.[1]?.trim() || '';
    return remoteHash === item.localSha256;
  });

  if (allHashesMatch && hasStaticFlag) {
    console.log(
      `✔ All 12 managed static Listmonk files (8 email templates + public shell index.html + style.css, logo.svg, favicon.png) on ${sshHost} are already up-to-date (SHA-256 match) — skipping container restart.`
    );
    return;
  }

  const localEmailFiles = LISTMONK_STATIC_TEMPLATE_FILENAMES.map(
    (f) => staticEmailFilePaths[f]
  );
  execFileSync(
    'scp',
    [
      ...scpBaseArgs,
      ...localEmailFiles,
      `${sshUser}@${sshHost}:${dockerDir}/static/email-templates/`,
    ],
    { stdio: 'inherit' }
  );

  execFileSync(
    'scp',
    [
      ...scpBaseArgs,
      publicShell.indexHtmlPath,
      `${sshUser}@${sshHost}:${dockerDir}/static/public/templates/index.html`,
    ],
    { stdio: 'inherit' }
  );

  execFileSync(
    'scp',
    [
      ...scpBaseArgs,
      publicShell.styleCssPath,
      publicShell.logoSvgPath,
      publicShell.faviconPngPath,
      `${sshUser}@${sshHost}:${dockerDir}/static/public/static/`,
    ],
    { stdio: 'inherit' }
  );

  const remoteApplyScript = [
    'set -e',
    `cd "${dockerDir}"`,
    'if ! grep -q -- "--static-dir=/listmonk/static" docker-compose.yml; then',
    '  cp docker-compose.yml docker-compose.yml.bak',
    "  sed -i \"s|./listmonk --config ''|./listmonk --config '' --static-dir=/listmonk/static|g\" docker-compose.yml",
    '  grep -q "./static:/listmonk/static" docker-compose.yml || sed -i "/\\.\\/uploads:\\/listmonk\\/uploads:rw/a \\      - ./static:/listmonk/static:ro" docker-compose.yml',
    '  docker compose up -d app',
    'else',
    '  docker compose restart app',
    'fi',
    'for i in $(seq 1 30); do curl -fsS http://127.0.0.1:9002/health >/dev/null 2>&1 && break; sleep 1; done',
  ].join('\n');

  execFileSync('ssh', [...sshBaseArgs, remoteApplyScript], { stdio: 'inherit' });

  console.log(
    `✔ Deployed 8 static email templates, public shell index.html, and style.css/logo.svg/favicon.png via SSH to ${sshHost}:${dockerDir}/static/ and restarted Listmonk container.`
  );
}

async function syncTemplates(baseUrl: string, authHeader: string): Promise<void> {
  const rootDir = process.cwd();
  const emailTemplatesDir = path.resolve(
    rootDir,
    '.build',
    'listmonk',
    'email-templates'
  );
  fs.mkdirSync(emailTemplatesDir, { recursive: true });

  const [staticTemplates, campaignHtml] = await Promise.all([
    renderAllListmonkStaticTemplates(),
    renderListmonkCampaignTemplate(),
  ]);

  const staticEmailFilePaths = {} as Record<ListmonkStaticTemplateFilename, string>;
  for (const filename of LISTMONK_STATIC_TEMPLATE_FILENAMES) {
    const outPath = path.join(emailTemplatesDir, filename);
    fs.writeFileSync(outPath, staticTemplates[filename], 'utf-8');
    staticEmailFilePaths[filename] = outPath;
  }

  const campaignPath = path.join(emailTemplatesDir, 'campaign-default.html');
  fs.writeFileSync(campaignPath, campaignHtml, 'utf-8');

  const publicShell = compileListmonkPublicShell(rootDir);

  syncStaticTemplatesViaSsh(staticEmailFilePaths, publicShell);

  console.log('[Listmonk Sync] Fetching existing templates from GET /api/templates...');
  const getRes = await fetch(`${baseUrl}/api/templates`, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
  });

  if (!getRes.ok) {
    const errText = await getRes.text();
    throw new Error(`GET /api/templates failed (${getRes.status}): ${errText}`);
  }

  const parsed = (await getRes.json()) as ListmonkTemplatesResponse;
  const templates = parsed.data || [];
  const defaultTemplate =
    templates.find((t) => t.is_default && (!t.type || t.type === 'campaign')) ||
    templates.find((t) => t.is_default) ||
    templates[0];

  if (!defaultTemplate) {
    throw new Error('No campaign template found in Listmonk GET /api/templates response.');
  }

  console.log(
    `[Listmonk Sync] Updating default campaign template #${defaultTemplate.id} ("${defaultTemplate.name}")...`
  );

  const putRes = await fetch(`${baseUrl}/api/templates/${defaultTemplate.id}`, {
    method: 'PUT',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      name: defaultTemplate.name,
      type: defaultTemplate.type || 'campaign',
      subject: defaultTemplate.subject || '{{ .Campaign.Subject }}',
      body: campaignHtml,
      is_default: defaultTemplate.is_default,
    }),
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(
      `PUT /api/templates/${defaultTemplate.id} failed (${putRes.status}): ${errText}`
    );
  }

  console.log(
    `✔ Default campaign template #${defaultTemplate.id} updated on ${baseUrl}.`
  );
}

async function resolveTargetListId(baseUrl: string, authHeader: string): Promise<number> {
  const res = await fetch(`${baseUrl}/api/lists?per_page=all`, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GET /api/lists failed (${res.status}): ${errText}`);
  }

  const parsed = (await res.json()) as ListmonkListResponse;
  const lists = parsed.data?.results || [];
  const matching = lists.find((l) => l.uuid === PUBLIC_LIST_UUID);

  if (!matching) {
    throw new Error(
      `Could not find Listmonk mailing list matching UUID ${PUBLIC_LIST_UUID} on ${baseUrl}.`
    );
  }

  return matching.id;
}

async function fetchExistingCampaigns(
  baseUrl: string,
  authHeader: string
): Promise<ListmonkCampaignRecord[]> {
  const res = await fetch(`${baseUrl}/api/campaigns?per_page=all`, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GET /api/campaigns failed (${res.status}): ${errText}`);
  }

  const parsed = (await res.json()) as ListmonkCampaignsListResponse;
  return parsed.data?.results || [];
}

async function syncIssueRecord(
  issue: ParsedNewsletterIssue,
  listId: number,
  existingCampaigns: ListmonkCampaignRecord[],
  baseUrl: string,
  authHeader: string
): Promise<void> {
  const rootDir = process.cwd();
  const { html, campaignBodyHtml, plainText } = await renderNewsletterIssueEmail(issue);

  const issuesDir = path.resolve(rootDir, '.build', 'listmonk', 'issues');
  fs.mkdirSync(issuesDir, { recursive: true });
  fs.writeFileSync(path.join(issuesDir, `${issue.slug}.html`), html, 'utf-8');
  fs.writeFileSync(
    path.join(issuesDir, `${issue.slug}.campaign.html`),
    campaignBodyHtml,
    'utf-8'
  );
  fs.writeFileSync(path.join(issuesDir, `${issue.slug}.txt`), plainText, 'utf-8');

  const slugTag = `slug:${issue.slug}`;
  const issueTag = `issue-${issue.issueNumber}`;
  const campaignName = `Issue #${issue.issueNumber}: ${issue.title}`;
  const campaignSubject = `[Issue #${issue.issueNumber}] ${issue.title}`;

  const payload = {
    name: campaignName,
    subject: campaignSubject,
    lists: [listId],
    type: 'regular',
    content_type: 'html',
    body: campaignBodyHtml,
    altbody: plainText,
    tags: ['newsletter', issueTag, slugTag],
  };

  const existing = existingCampaigns.find(
    (c) => c.tags?.includes(slugTag) || c.tags?.includes(issueTag)
  );

  if (existing) {
    if (existing.status !== 'draft') {
      console.log(
        `✔ Campaign #${existing.id} ("${issue.slug}") has status "${existing.status}" — skipping mutation.`
      );
      return;
    }

    console.log(
      `[Listmonk Sync] Updating existing draft campaign #${existing.id} for "${issue.slug}"...`
    );
    const putRes = await fetch(`${baseUrl}/api/campaigns/${existing.id}`, {
      method: 'PUT',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error(
        `PUT /api/campaigns/${existing.id} failed (${putRes.status}): ${errText}`
      );
    }

    console.log(
      `✔ Updated draft campaign #${existing.id} on Listmonk (tags: ${payload.tags.join(', ')}).`
    );
    console.log(`  Review & test at: ${baseUrl}/admin/campaigns/${existing.id}`);
    return;
  }

  console.log(`[Listmonk Sync] Creating new draft campaign for "${issue.slug}"...`);
  const postRes = await fetch(`${baseUrl}/api/campaigns`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!postRes.ok) {
    const errText = await postRes.text();
    throw new Error(`POST /api/campaigns failed (${postRes.status}): ${errText}`);
  }

  const parsed = (await postRes.json()) as ListmonkCampaignResponse;
  const createdId = parsed.data.id;

  console.log(
    `✔ Created draft campaign #${createdId} (status: ${parsed.data.status}, tags: ${payload.tags.join(', ')}).`
  );
  console.log(`  Review & test at: ${baseUrl}/admin/campaigns/${createdId}`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options.syncAll && !options.syncTemplates && !options.issueSlug) {
    console.log('Usage:');
    console.log('  npm run newsletter:sync -- --all');
    console.log('  npm run newsletter:sync -- --templates');
    console.log('  npm run newsletter:sync -- --issue <slug>');
    process.exit(1);
  }

  const { baseUrl, authHeader } = getAuthConfig();

  if (options.syncTemplates) {
    await syncTemplates(baseUrl, authHeader);
  }

  if (options.syncAll || options.issueSlug) {
    const rootDir = process.cwd();
    const [listId, existingCampaigns] = await Promise.all([
      resolveTargetListId(baseUrl, authHeader),
      fetchExistingCampaigns(baseUrl, authHeader),
    ]);

    if (options.syncAll) {
      const issues = await loadAllNewsletterIssues(rootDir);
      console.log(
        `[Listmonk Sync] Synchronizing ${issues.length} newsletter issue(s) via stateless tag matching...`
      );
      for (const issue of issues) {
        await syncIssueRecord(issue, listId, existingCampaigns, baseUrl, authHeader);
      }
    } else if (options.issueSlug) {
      const issue = await loadNewsletterIssue(options.issueSlug, rootDir);
      await syncIssueRecord(issue, listId, existingCampaigns, baseUrl, authHeader);
    }
  }
}

main().catch((err: Error) => {
  console.error('[Listmonk Sync] Error:', err.message);
  process.exit(1);
});
