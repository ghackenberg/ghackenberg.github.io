---
name: newsletter-authoring
description: Author, curate, compile, and synchronize English-language technical newsletters, React Email templates, and Listmonk campaigns.
---

# Newsletter Authoring (React Email, Public Shell & Listmonk Pipeline)

This skill governs the authoring, curation, React Email compilation, upgrade-safe public web shell compilation, and stateless Listmonk REST API/SSH synchronization of technical newsletter issues in `src/content/newsletters/`.

## 1. Directory Structure & Frontmatter Schema
Every newsletter issue lives in `src/content/newsletters/<slug>/index.md` using the canonical date-and-topic slug (`YYYY_MM_DD_<topic_slug>`, e.g. `src/content/newsletters/2026_10_19_sovereign_agentic_workflows_slide_as_code_sdf/index.md`).

```yaml
issueNumber: 1
title: "Sovereign Agentic Workflows, Slide-as-Code & Real-Time Web Geometry"
subtitle: "Architecture notes and recent deep-dives from hackenberg.tech"
description: "Inaugural engineering dispatch covering reliable multi-agent control planes, Slide-as-Code lecture engines with neural voiceovers, and line-exact 2D Signed Distance Field hero typography."
pubDate: 2026-10-19
icon:
  src: ./preview.jpg
  title: "Issue #1 Cover — Sovereign Agentic Workflows, Slide-as-Code & Real-Time Web Geometry"
  description: "Editorial magazine cover illustration depicting a central multi-agent orchestrator hub, a Slide-as-Code presentation deck with neural audio waves, and a 2D Signed Distance Field geometric contour grid."
featuredPosts:
  - 2026_10_14_treewalker_text_geometrie_sdf_hero_grid
featuredPresentations:
  - 2026_10_05_wie_promptet_man_richtig
featuredPublications: []
featuredCourses: []
featuredProjects: []
featuredVisualizations: []
```

- **Required Fields**: `title`, `description`, `issueNumber` (positive integer), `pubDate` (ISO date), and `icon` (`src: ./preview.jpg`, `title`, `description` following the Editorial Magazine Illustration archetype in `.agents/skills/image-generation/resources/archetypes/newsletters.md`).
- **Optional Fields**: `subtitle` and the six `featured*` slug arrays (`featuredPosts`, `featuredPresentations`, `featuredPublications`, `featuredCourses`, `featuredProjects`, `featuredVisualizations`).
- **Git-Branch Lifecycle & Stateless Tag Matching**:
  - There are **no** `draft` or `listmonkCampaignId` frontmatter fields.
  - Draft vs. published state is governed strictly by Git branches (`dev`/feature branches for drafting and previewing; merging to `main` publishes the issue on `hackenberg.tech`).
  - Listmonk campaign synchronization is 100% stateless: campaigns are matched via Listmonk tags (`slug:<slug>` and `issue-<N>`) without ever mutating `index.md` files.

## 2. Editorial & Curation Standards
- **Strict English (`en`)**: All newsletter issue prose, subject lines, greetings, transactional templates, and call-to-action buttons are authored in English for international accessibility.
- **High-Signal Synthesis**: Open with a concise architectural introduction and 2–4 thematic highlights synthesizing why the featured engineering or research releases matter in practice.
- **Automatic Content Card Resolution**: Never hardcode duplicate card titles, descriptions, or dates inside the Markdown body for featured items. Both the static web archive (`src/pages/newsletters/[slug].astro`) and the React Email compiler (`src/commons/server/email/newsletter-loader.ts`) resolve metadata directly from the referenced Astro Content Collections.
- **Web Permalink Parity**: Every issue renders a static web archive page at `/newsletters/<slug>/` (with `icon.src` as its OpenGraph image, no inline hero image) and is listed with its `16:9` cover card on `/newsletters/`. Every email includes a top-bar link (`View in browser ↗`) pointing to its canonical permalink.

## 3. React Email & Upgrade-Safe Public Shell Architecture
All compiled Listmonk build artifacts are written to `.build/listmonk/` (outside `dist/`, so `dist/` only contains genuine website pages):
- **Shared Email Theme & Shell** (`src/commons/server/email/email-theme.ts` & `src/commons/server/email/EmailShell.tsx`):
  - `email-theme.ts` is the single source of truth for all React Email `CSSProperties` tokens (`emailStyles`, `emailMarkdownStyles`, `EMAIL_BUTTON_INLINE_STYLE`).
  - `EmailShell.tsx` renders the shared `GH` brand header and campaign/transactional footer across all email templates.
- **Transactional & System Static Email Templates** (`src/commons/server/email/ListmonkTransactionalEmail.tsx`):
  - Compiles all 8 static Listmonk HTML email templates in `.build/listmonk/email-templates/` (`base.html`, `subscriber-optin.html`, `subscriber-optin-campaign.html`, `subscriber-data.html`, `campaign-status.html`, `import-status.html`, `forgot-password.html`, and `smtp-test.html`) using `EmailShell`, `emailStyles`, neutral `'Hello,'` greeting, and zero `listmonk.app` branding.
- **Default Campaign Wrapper** (`src/commons/server/email/ListmonkCampaignTemplate.tsx`):
  - Renders `.build/listmonk/email-templates/campaign-default.html` via `EmailShell` preserving `{{ template "content" . }}`, `{{ UnsubscribeURL }}`, and `{{ TrackLink "https://hackenberg.tech" }}`.
- **Upgrade-Safe Public Web Shell** (`src/layouts/listmonk.html`, `src/styles/listmonk.css`, & `src/commons/server/email/ListmonkPublicShell.ts`):
  - Maintains `src/layouts/listmonk.html`, `src/styles/listmonk.css`, and the generated branding icons from `src/commons/server/branding-assets.ts` (`favicon.svg` and `favicon-32x32.png` in `.cache/branding/`) and copies them to `.build/listmonk/public-templates/index.html` (`{{ define "header" }}` and `{{ define "footer" }}`) and `.build/listmonk/public-static/` (`style.css`, `logo.svg`, `favicon.png`) while keeping all 11 functional templates (`optin.html`, `message.html`, `subscription.html`, `subscription-form.html`, `archive.html`, `home.html`, `login.html`, `login-setup.html`, `forgot-password.html`, `reset-password.html`, `twofa.html`) 100% untouched from the official Listmonk release archive.
- **Issue Compiler** (`src/commons/server/email/NewsletterIssueEmail.tsx`):
  - `NewsletterIssueContent` renders the inner campaign HTML fragment (`campaignBodyHtml`) injected into `{{ template "content" . }}` (`.build/listmonk/issues/<slug>.campaign.html`).
  - `NewsletterIssueEmail` wraps `NewsletterIssueContent` in `EmailShell` to render the full standalone HTML email (`.build/listmonk/issues/<slug>.html`) and plain-text `altbody` fallback (`.build/listmonk/issues/<slug>.txt`).

## 4. Build & Stateless Listmonk API Synchronization
Compile all React Email templates, the public web shell, and newsletter issues to `.build/listmonk/`:
```powershell
npm run newsletter:build
```

Synchronize the default campaign template, all 12 managed static files (8 email templates + `.build/listmonk/public-templates/index.html` + `.build/listmonk/public-static/style.css`, `logo.svg`, `favicon.png`), and all newsletter issues:
```powershell
npm run newsletter:sync -- --all
```

Synchronize only templates or a single issue:
```powershell
npm run newsletter:sync -- --templates
npm run newsletter:sync -- --issue 2026_10_19_sovereign_agentic_workflows_slide_as_code_sdf
```
- Requires `LISTMONK_URL` (defaults to `https://news.hackenberg.tech`), `LISTMONK_API_USER`, and `LISTMONK_API_TOKEN` in `.env` (or GitHub Actions secrets on `main` push).
- Supports idempotent SHA-256 SSH static deployment to `--static-dir=/listmonk/static` when `LISTMONK_SSH_HOST` is set.
- Never auto-starts a campaign; always review and send a test email in the Listmonk admin UI before dispatching.
