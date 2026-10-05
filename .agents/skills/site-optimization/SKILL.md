---
name: site-optimization
description: Optimize search engine visibility (SEO), generative engine extractability (GEO/AIO), JSON-LD structured data, llms.txt, and Core Web Vitals.
---

# Site Optimization (SEO, GEO & Generative AI Readiness)

This skill governs search engine optimization (SEO), Generative Engine Optimization (GEO/AIO), structured data schemas, machine-readable manifests, and web performance.

## 1. Scope & Primary Artefacts
- Structured Data: Schema.org JSON-LD scripts (`BreadcrumbList`, `Article`, `Course`, `Person`, `SoftwareSourceCode`, `Event`).
- OpenGraph & Social Metadata: Canonical URLs, OpenGraph (`og:*`), Twitter Cards (`twitter:*`).
- AI & LLM Manifests: `public/llms.txt`.
- Sitemap & Robots: `@astrojs/sitemap`, `public/robots.txt`.
- Performance: Core Web Vitals, Lighthouse CLI audits, image optimization.

## 2. Generative Engine Optimization (GEO / AIO)
Maximize citation probability and ground truth extraction by AI search engines (Perplexity, ChatGPT Search, Google Gemini):
- **Answer-First Definition Blocks**: Position a concise 40–55 word synthesized summary directly under the top heading (`h1` or primary `h2`).
- **High-Density Markdown**: Use markdown tables (`| Parameter | Value | Description |`) and bulleted feature manifests instead of sprawling prose.
- **Machine-Readable LLMs Manifest (`public/llms.txt`)**:
  - Keep `llms.txt` concise and structured as a curated index for AI agents.
  - Link directly to markdown sources, primary API endpoints, and core topic hubs.
  - Use `scan_aio_readiness` and `evaluate_aio_extractability` via `unified-analytics` to audit drafted markdown.

## 3. Structured Data (Schema.org JSON-LD)
All public pages must provide valid JSON-LD scripts:
- **Articles & Blog Posts**: `BlogPosting` or `TechArticle` schema with `headline`, `datePublished`, `author`, `publisher`, and `image`.
- **Courses**: `Course` schema with `name`, `description`, `provider`, and `educationalLevel`.
- **Presentations**: `Event` or `PresentationDigitalDocument`.
- **Breadcrumb Navigation**: `BreadcrumbList` on all hierarchical detail pages.

## 4. Performance & Core Web Vitals
- **Image Compression & WebP**: All rendered slide previews and thumbnails use modern WebP format with offscreen 0-diff protection.
- **Font Subsetting**: Web fonts are served locally via `@fontsource/inter`, `@fontsource/outfit`, and `@fontsource/caveat` with zero external Google Fonts network hops.
- **Performance Audits**: Run local Lighthouse checks to verify scores $>95$:
  ```powershell
  npm run lighthouse
  ```

## 5. Verification Gate
For complete site builds, follow the master release verification gate (see `build-engineering`).
