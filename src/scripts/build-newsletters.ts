import fs from 'node:fs';
import path from 'node:path';
import {
  LISTMONK_STATIC_TEMPLATE_FILENAMES,
  renderAllListmonkStaticTemplates,
} from '@commons/server/email/ListmonkTransactionalEmail';
import { compileListmonkPublicShell } from '@commons/server/email/ListmonkPublicShell';
import { renderListmonkCampaignTemplate } from '@commons/server/email/ListmonkCampaignTemplate';
import { renderNewsletterIssueEmail } from '@commons/server/email/NewsletterIssueEmail';
import { loadAllNewsletterIssues } from '@commons/server/email/newsletter-loader';

function cleanupLegacyDistArtifacts(rootDir: string): void {
  const distDir = path.resolve(rootDir, 'dist');
  const distEmailDir = path.join(distDir, 'email');
  if (fs.existsSync(distEmailDir)) {
    fs.rmSync(distEmailDir, { recursive: true, force: true });
  }

  const distNewslettersDir = path.join(distDir, 'newsletters');
  if (fs.existsSync(distNewslettersDir)) {
    for (const entry of fs.readdirSync(distNewslettersDir, { withFileTypes: true })) {
      const fullPath = path.join(distNewslettersDir, entry.name);
      if (entry.isDirectory() && entry.name === 'listmonk') {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else if (
        entry.isFile() &&
        entry.name !== 'index.html' &&
        (entry.name.endsWith('.html') || entry.name.endsWith('.txt'))
      ) {
        fs.rmSync(fullPath, { force: true });
      }
    }
  }
}

async function buildNewsletters(): Promise<void> {
  const verbose = process.argv.includes('--verbose');
  const rootDir = process.cwd();
  const buildListmonkDir = path.resolve(rootDir, '.build', 'listmonk');
  const emailTemplatesDir = path.join(buildListmonkDir, 'email-templates');
  const issuesDir = path.join(buildListmonkDir, 'issues');

  fs.mkdirSync(emailTemplatesDir, { recursive: true });
  fs.mkdirSync(issuesDir, { recursive: true });

  if (verbose) {
    console.log('[Newsletter Build] Compiling React Email Listmonk templates...');
  }

  const [staticTemplates, campaignHtml] = await Promise.all([
    renderAllListmonkStaticTemplates(),
    renderListmonkCampaignTemplate(),
  ]);

  for (const filename of LISTMONK_STATIC_TEMPLATE_FILENAMES) {
    const content = staticTemplates[filename];
    const outPath = path.join(emailTemplatesDir, filename);
    fs.writeFileSync(outPath, content, 'utf-8');
    if (verbose) {
      console.log(
        `  ✔ .build/listmonk/email-templates/${filename} (${content.length} bytes)`
      );
    }
  }

  const campaignPath = path.join(emailTemplatesDir, 'campaign-default.html');
  fs.writeFileSync(campaignPath, campaignHtml, 'utf-8');
  if (verbose) {
    console.log(
      `  ✔ .build/listmonk/email-templates/campaign-default.html (${campaignHtml.length} bytes)`
    );
    console.log('[Newsletter Build] Compiling Listmonk public web shell & static assets...');
  }

  const shellAssets = await compileListmonkPublicShell(rootDir);
  if (verbose) {
    console.log(
      `  ✔ .build/listmonk/public-templates/index.html (${fs.statSync(shellAssets.indexHtmlPath).size} bytes)`
    );
    console.log(
      `  ✔ .build/listmonk/public-static/style.css (${fs.statSync(shellAssets.styleCssPath).size} bytes)`
    );
    console.log(
      `  ✔ .build/listmonk/public-static/logo.svg (${fs.statSync(shellAssets.logoSvgPath).size} bytes)`
    );
    console.log(
      `  ✔ .build/listmonk/public-static/favicon.png (${fs.statSync(shellAssets.faviconPngPath).size} bytes)`
    );
  }

  cleanupLegacyDistArtifacts(rootDir);

  const issues = await loadAllNewsletterIssues(rootDir);
  if (verbose) {
    console.log(`[Newsletter Build] Compiling ${issues.length} newsletter issue(s)...`);
  }

  for (const issue of issues) {
    const { html, campaignBodyHtml, plainText } = await renderNewsletterIssueEmail(issue);
    const standaloneHtmlPath = path.join(issuesDir, `${issue.slug}.html`);
    const campaignFragmentPath = path.join(issuesDir, `${issue.slug}.campaign.html`);
    const issueTxtPath = path.join(issuesDir, `${issue.slug}.txt`);

    fs.writeFileSync(standaloneHtmlPath, html, 'utf-8');
    fs.writeFileSync(campaignFragmentPath, campaignBodyHtml, 'utf-8');
    fs.writeFileSync(issueTxtPath, plainText, 'utf-8');

    if (verbose) {
      console.log(
        `  ✔ Issue #${issue.issueNumber} (${issue.slug}): ${html.length}B standalone HTML, ${campaignBodyHtml.length}B campaign body HTML, ${plainText.length}B TXT (${issue.featuredItems.length} featured items)`
      );
    }
  }

  console.log(
    `✅ [Newsletter Build] Compiled ${LISTMONK_STATIC_TEMPLATE_FILENAMES.length + 1} Listmonk templates, public web shell & ${issues.length} newsletter issue(s).`
  );
}

buildNewsletters().catch((err: Error) => {
  console.error('[Newsletter Build] Fatal error:', err.message);
  process.exit(1);
});
