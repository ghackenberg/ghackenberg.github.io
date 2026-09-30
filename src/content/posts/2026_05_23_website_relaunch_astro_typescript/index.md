---
title: Website Relaunch with Astro & TypeScript on GitHub Pages
pubDate: 2026-05-23
description: "Learn how to build a static portfolio on GitHub Pages with Astro,
  TypeScript & AI agents: Automated migration, sub-second loads, and full type
  safety."
lang: en
tags:
  - web-development
  - astro
  - typescript
  - gemini
  - ai-migration
  - github-pages
icon:
  src: ./icon.png
  title: "Cover illustration: Relaunching my personal website on GitHub Pages with
    Astro and TypeScript"
  description: Discover how I relaunched my personal website on GitHub Pages using
    Astro, TypeScript, and Google Antigravity to automate legacy PHP content
    migration.
references:
  - type: online
    author: Miller, J.
    title: Islands Architecture
    url: https://jasonformat.com/islands-architecture/
    year: 2020
    siteName: Jason Format Architecture Essays. Available online at
      [jasonformat.com/islands-architecture](https://jasonformat.com/islands-architecture/)
    id: miller-2020-islands-architecture
  - type: online
    author: Astro Core Team
    title: "Astro Documentation: Content Collections, Islands Architecture, and
      Static Site Generation"
    url: https://docs.astro.build/
    year: 2024
    siteName: Available online at [docs.astro.build](https://docs.astro.build/)
    id: team-2024-astro
  - type: online
    author: Colinhacks
    title: "Zod: TypeScript-first schema validation with static type inference"
    url: https://zod.dev/
    year: 2024
    siteName: Available online at [zod.dev](https://zod.dev/)
    id: colinhacks-2024-typescriptfirst-schema
---


After many years of running my personal website on a custom, server-side template engine, I have officially relaunched it! The new website is a fully static application built with **Astro [@team-2024-astro]** and **TypeScript**, hosted entirely on **GitHub Pages**. 

This modernization represents a massive leap forward in load performance, developer experience, type-safety, and security. However, migrating over a decade of blog posts, publication records, and course materials was a daunting task. Here is the story of how I successfully automated this migration using **Google Antigravity** powered by **Gemini 3.5 Flash (High)**.

## Why Relaunch? Outgrowing the Legacy Stack

My original website was built using a custom PHP template engine that compiled XML content files into HTML pages dynamically on every client request. While this architecture [@miller-2020-islands-architecture] served me well for many years, modern web engineering has shifted expectations:

1. **Zero-Ops & Security vs. Server Maintenance**: Modern PHP with OPcache and JIT is certainly capable and remains an excellent choice for dynamic editorial teams. However, running a personal academic site on an active LAMP stack required ongoing OS patching, Apache configurations, and security maintenance. Static site generation (SSG) hosted on GitHub Pages completely eliminates the server-side attack surface and reduces hosting maintenance to zero.
2. **Global Edge CDN Performance**: Serving pre-rendered, optimized HTML directly from a distributed CDN edge delivers sub-second TTFB globally without requiring complex server-side caching layers.
3. **Compile-Time Type Safety**: My legacy content files were stored as raw XML and PHP arrays without schema [@colinhacks-2024-typescriptfirst-schema] guarantees. Transitioning to TypeScript and Zod-validated Content Collections ensures that missing tags, broken asset paths, or invalid dates cause immediate build failures rather than silent production regressions.

*Note on SSG Trade-offs:* Pure static site generation is optimal for content-driven portfolios and blogs. For platforms requiring real-time user mutations or catalogs spanning tens of thousands of pages, hybrid rendering (Astro's Server-Side Rendering / SSR adapters) or incremental builds become essential. For my personal site, static compilation remains the sweet spot.

## The Migration Workflow: Powered by AI

Manually converting over a hundred content entries—spread across different collections—from custom XML/PHP files to Astro markdown frontmatter was out of the question. 

To automate the migration, I leveraged **Google Antigravity** running **Gemini 3.5 Flash (High)**. This combination allowed me to parse the complex legacy templates, read database files, map the fields dynamically, and output perfectly structured Markdown and MDX files.

Here is the migration workflow in detail:

![Migration Workflow vom PHP-Altsystem zu Astro](./workflow.svg "Automatisierter KI-Migrations-Workflow")

1. **Legacy Source**: The migration script extracted raw XML and PHP content from my original database.
2. **AI Translation**: Using Google Antigravity's agentic workspace tools, Gemini 3.5 Flash analyzed the structure of my old files, mapped attributes (e.g., date formats, tag arrays, image assets), and converted them into clean markdown/frontmatter.
3. **Astro Schema Validation**: Since Astro supports schema validation out of the box using Zod, any incorrect format or missing field was caught during the translation phase, enabling immediate, automated fixes.

Everything ran completely smoothly in a matter of minutes, preserving all formatting, code blocks, links, and layout metadata perfectly.

## Architecture Comparison: Legacy vs. Modern

The new setup completely decouples the content creation and compilation step from the content delivery step. The architecture below showcases the contrast between the old dynamic approach and the modern, static CDN-driven approach:

![Architektur-Vergleich zwischen Legacy PHP und modernem Astro Stack](./architecture.svg "Architektur-Vergleich: Dynamisches PHP vs. Statisches Astro CDN")

- **Old (Left)**: The client had to wait for Apache to compile the PHP template engine and retrieve values from the filesystem on every request.
- **New (Right)**: The compiler runs locally or via CI/CD. The build output is a folder of optimized HTML, CSS, and JS files served directly from the GitHub Pages CDN.

## The New Foundation: Type-Safe Content Collections

One of the best features of the relaunch is Astro's type-safe **Content Collections**. Powered by TypeScript and Zod schemas, we can guarantee that all content has correct frontmatter values. For example, my blog posts schema ensures every post contains a valid title, date, and description:

```typescript
const posts = defineCollection({
  loader: glob({
    base: './src/content/posts',
    pattern: '**/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, '')
  }),
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
    icon: z.string().optional(),
  }),
});
```

If I accidentally misspell a tag or omit a required date, the build fails immediately during development or CI/CD compilation, preventing broken pages from ever reaching production.

## Conclusion & Next Steps

Relaunching on GitHub Pages with Astro and TypeScript has been an incredibly satisfying experience. The page load speeds are near-instantaneous, and publishing a new post is now as simple as running `git push`. 

Thanks to **Google Antigravity** and the impressive speed and comprehension of **Gemini 3.5 Flash (High)**, the migration of all legacy content was a flawless success.

Stay tuned for more updates as I continue to share insights on software engineering, data visualization, and web technologies!
