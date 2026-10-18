---
name: site-curation
description: Curate homepage sections, catalog overviews, featured showcases, preview cards, and editorial navigation flows.
---

# Site Curation (Editorial Layouts & Catalog Pages)

This skill governs the presentation, layout curation, and navigation flow of the website's landing pages and overview catalogs.

## 1. Scope & Primary Entry Points
- Homepage: `src/pages/index.astro` (including inline `Professional Interests` preview cards).
- Catalog Overviews: `src/pages/posts/index.astro`, `src/pages/presentations/index.astro`, `src/pages/projects/index.astro`, `src/pages/courses/index.astro`, `src/pages/services.astro` (inline `Service` preview cards), `src/pages/visualizations/index.astro`, `src/pages/publications/index.astro`.
- Sub-Catalog Module Grids: `src/pages/courses/[slug].astro` (`CourseModuleCard`), `src/pages/services/[slug].astro` (`ServiceModuleCard`).
- Canonical Preview Card Components (10 total): `PostCard.astro`, `PublicationCard.astro`, `PresentationCard.astro`, `CourseCard.astro`, `CourseModuleCard.astro`, `ProjectCard.astro`, `ServiceCard.astro`, `ServiceModuleCard.astro`, `VisualizationCard.astro`, `InterestCard.astro` (plus compact cross-link card `CompactRelatedCard.astro`).
- Navigation: `src/components/Navbar.astro`.

## 2. Preview Card Discovery, Truncation & CTR Contract
All 10 preview card components and 2 inline preview card implementations in feeds, catalogs, and sub-catalog module grids must implement the declarative CTR tracking and deterministic height reservation contract (enforced by `npm run lint:domains`):
- **Card Element**: `<article class="... preview-card ..." data-card-id="<slug>" data-collection="<collection>">`.
- **Automated Telemetry**: Cards automatically register views and clicks through the global observer in `telemetry.ts` (see `site-analytics`).
- **Card Content & Contextual Tag/Chip Visibility**: Must render cover image (if available), metadata (`pubDate`/duration where applicable), title, description snippet (or venue + authors for publications), and full-width bottom `"Read More"` CTA button. Tag chips inside preview cards are rendered contextually via `shouldShowTags = showTags ?? Boolean(activeTag)` — omitted on homepage and domain catalog overview grids (`data-tags` on wrapper elements powers client-side faceted filtering) and displayed on `/tags/[tag]/` hub pages where `activeTag` is active. Module preview cards (`CourseModuleCard`, `ServiceModuleCard`) omit inline tool/topic/duration/format pill lists so card bodies remain clean and uniform.
- **Deterministic Height Reservation**: Multi-line editorial/academic title domains (`PostCard`, `PresentationCard`, `PublicationCard`) enforce `text-base sm:text-lg font-bold ... leading-snug line-clamp-2 min-h-[2lh]` on titles, whereas concise single-line title domains (`CourseCard`, `CourseModuleCard`, `ServiceCard`, `ServiceModuleCard`, `InterestCard`, `ProjectCard`, `VisualizationCard`, inline cards in `index.astro` and `services.astro`, and project screenshot cards in `projects/[slug].astro`) enforce `line-clamp-1 min-h-[1lh]` (all with `title={title}` tooltip) to prevent unnatural empty second title lines. Never combine `block`, `flex`, or `grid` display classes on the same element as `line-clamp-*` (which overrides `display: -webkit-box`). Card descriptions enforce `text-sm mb-3 leading-relaxed font-normal line-clamp-3 min-h-[3lh]` (for `PublicationCard`: `line-clamp-1 min-h-[1lh]` on venue `book` and `line-clamp-2 min-h-[2lh]` on `author`) so multi-column rows align symmetrically.

## 3. Semantic Section & Heading Contract
Every section on landing pages must satisfy semantic ID integrity:
- Every `<section>` element MUST possess a unique, human-readable `id` (e.g. `<section id="featured-posts">`, `<section id="services">`).
- Compliance is verified automatically during the build process (see `build-engineering`).
- **Collapsible Homepage Sections**: `<Section id="..." collapsible>` plus a `<SectionToggle sectionId label collection? />` inside the header row (`.section-header` must precede the body; the hero uses the compact `.section-bar` pattern, the gallery's full-bleed viewport is wrapped as a second body; `contact` and `tech-stack` are not collapsible). Logic lives in `@commons/client/section-collapse` (wraps the body, `aria-expanded`/`inert`, hash/anchor auto-expand, publishes `html[data-collapsed-sections]` + `gh-section-collapse-change` so animations like the gallery marquee pause). Persistence only with opt-in key `gh_home_sections_v1` (first click shows `HomeLayoutConsent`, see `legal-compliance`; journey: `backlog/system/008-privacy-user-journey.md`); the "New" pill (collapsed only, dot below `sm`, count in `aria-label`) reuses the navbar read-state via `@commons/client/unread-counts`.

## 4. Layout Ergonomics & Perceptual Stability
- **No Cumulative Layout Shifts (CLS)**: Interactive hover effects, badges, or filter buttons must never shift neighboring rows or mutate container dimensions.
- **Responsive Grids**: Use standard Tailwind grids (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`) with consistent aspect ratio containers (`aspect-video` or `aspect-[16/9]`) for card media.
- **Horizontal Carousels & Marquees**: Horizontally scrolling ribbons must implement touch axis-locking and never trap vertical page scrolling on mobile devices.

## 5. Verification Gate
Verify layout curation through the master release verification gate (see `build-engineering`).
