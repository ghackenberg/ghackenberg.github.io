---
name: site-curation
description: Curate homepage sections, catalog overviews, featured showcases, preview cards, and editorial navigation flows.
---

# Site Curation (Editorial Layouts & Catalog Pages)

This skill governs the presentation, layout curation, and navigation flow of the website's landing pages and overview catalogs.

## 1. Scope & Primary Entry Points
- Homepage: `src/pages/index.astro`.
- Catalog Overviews: `src/pages/posts/index.astro`, `src/pages/presentations/index.astro`, `src/pages/projects/index.astro`, `src/pages/courses/index.astro`, `src/pages/services.astro`, `src/pages/visualizations/index.astro`, `src/pages/publications/index.astro`.
- Navigation: `src/components/Navbar.astro`.

## 2. Preview Card Discovery & CTR Contract
All preview cards in feeds and catalogs must implement the declarative CTR tracking contract:
- **Card Element**: `<article class="... preview-card ..." data-card-id="<slug>" data-collection="<collection>">`.
- **Automated Telemetry**: Cards automatically register views and clicks through the global observer in `telemetry.ts` (see `site-analytics`).
- **Card Content**: Must render title, pubDate, tags, description snippet, and cover image (if available).

## 3. Semantic Section & Heading Contract
Every section on landing pages must satisfy semantic ID integrity:
- Every `<section>` element MUST possess a unique, human-readable `id` (e.g. `<section id="featured-posts">`, `<section id="services">`).
- Compliance is verified automatically during the build process (see `build-engineering`).

## 4. Layout Ergonomics & Perceptual Stability
- **No Cumulative Layout Shifts (CLS)**: Interactive hover effects, badges, or filter buttons must never shift neighboring rows or mutate container dimensions.
- **Responsive Grids**: Use standard Tailwind grids (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`) with consistent aspect ratio containers (`aspect-video` or `aspect-[16/9]`) for card media.
- **Horizontal Carousels & Marquees**: Horizontally scrolling ribbons must implement touch axis-locking and never trap vertical page scrolling on mobile devices.

## 5. Verification Gate
Verify layout curation through the master release verification gate (see `build-engineering`).
