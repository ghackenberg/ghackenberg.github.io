---
title: "Priority+ Navigation and a 10-Domain Aurora Color Spectrum"
pubDate: 2026-10-27
description: "How we replaced static media-query navigation breakpoints and ad-hoc colors with a zero-flicker Priority+ layout engine and a 10-stop Aurora color spectrum."
inLanguage: "en"
tags:
  - design-systems
  - human-computer-interaction
  - web-development
  - software-architecture
image:
  src: "./hero.jpg"
  title: "Priority+ Navigation Folding and 10-Stop Aurora Domain Spectrum"
  description: "Architectural blueprint on a timber drafting table in Grünau im Almtal illustrating Priority+ navigation folding stages and a 10-stop Aurora domain color spectrum"
references:
  - id: "miller-1956-magical-number"
    type: "article"
    authors:
      - name: "George Armitage Miller"
    title: "The Magical Number Seven, Plus or Minus Two: Some Limits on Our Capacity for Processing Information"
    journal: "Psychological Review"
    volume: "63"
    number: "2"
    pages: "81--97"
    year: 1956
    doi: "10.1037/h0043158"
    url: "https://doi.org/10.1037/h0043158"
  - id: "hick-1952-rate-of-gain"
    type: "article"
    authors:
      - name: "William Edmund Hick"
    title: "On the Rate of Gain of Information"
    journal: "Quarterly Journal of Experimental Psychology"
    volume: "4"
    number: "1"
    pages: "11--26"
    year: 1952
    doi: "10.1080/17470215208416600"
    url: "https://doi.org/10.1080/17470215208416600"
  - id: "ware-2020-information-visualization"
    type: "book"
    authors:
      - name: "Colin Ware"
    title: "Information Visualization: Perception for Design"
    publisher: "Morgan Kaufmann"
    year: 2020
    doi: "10.1016/C2016-0-02395-1"
    url: "https://doi.org/10.1016/C2016-0-02395-1"
  - id: "marcotte-2010-responsive-web-design"
    type: "online"
    authors:
      - name: "Ethan Marcotte"
    title: "Responsive Web Design"
    siteName: "A List Apart"
    year: 2010
    url: "https://alistapart.com/article/responsive-web-design/"
---

Scaling a personal knowledge platform from three initial sections to ten distinct content domains breaks static media-query navigation bars and ad-hoc color palettes [@marcotte-2010-responsive-web-design]. We engineered a zero-flicker Priority+ navigation engine in [`Navbar.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/Navbar.astro) paired with a ten-stop Aurora color spectrum in [`domain-themes.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/domain-themes.ts) to guarantee preattentive visual orientation and zero layout shifts.

<!-- caption: "Architectural comparison of static breakpoint hamburgers, multi-row wrapping navbars, and script-driven Priority+ navigation with a 10-stop Aurora color spectrum." -->
| Architectural Dimension | Static Breakpoint Hamburger | Multi-Row Wrapping Navbar | Script-Driven Priority+ & Aurora Spectrum |
| :--- | :--- | :--- | :--- |
| **Viewport Utilization** | Hides all links below `1120px` | Wraps unpredictably into 2–3 rows | Exposes $k \in \{1..10\}$ visible items dynamically |
| **First-Paint Stability** | Prone to media/font reflows | Causes vertical layout shifts (CLS) | Synchronous pre-paint `[data-nav-count]` lock |
| **Visual Choice Reaction** | High recall cost inside hidden drawer | Visual clutter across stacked rows | Bounded top-bar choices + `More ▾` megamenu [@hick-1952-rate-of-gain] |
| **Domain Color Encoding** | Ad-hoc Tailwind utility classes | Uncoordinated per-page accents | 10-stop pastel/dark spectrum + CI AST linters |

## How Does Script-Driven Priority+ Navigation Prevent Layout Collisions?

Script-driven Priority+ navigation prevents layout collisions by measuring real-time container width before first paint and progressively folding items from right to left [@hick-1952-rate-of-gain]. The synchronous `__evaluateNavbarPriority` routine in [`Navbar.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/Navbar.astro) calculates exact pixel thresholds for ten navigation items, collapsing overflow links into a glassmorphic megamenu without triggering cumulative layout shifts.

When our platform expanded to nine content collections (`posts`, `publications`, `presentations`, `courses`, `projects`, `services`, `newsletters`, `visualizations`, and `tags`) alongside [`about.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/about.astro) and [`contact.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/contact.astro) (extracted from [`index.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/index.astro) to keep the homepage lean), fixed CSS media queries (`@media (min-width: 1120px)`) failed [@marcotte-2010-responsive-web-design]. In [`Navbar.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/Navbar.astro), `__evaluateNavbarPriority` computes `availableWidth` against pre-calibrated fallback widths (`[46, 46, 92, 102, 62, 62, 62, 102, 90, 44]`) and sets `data-nav-count`, `data-mobile-sponsor`, and `data-brand-mode` (`full` $\rightarrow$ `title` $\rightarrow$ `compact`) before first paint, then re-evaluates on `ResizeObserver` and `document.fonts.ready`.

![Semantic vector infographic illustrating Priority+ navigation folding stages across 1440px desktop, 960px tablet, and 480px mobile viewports with synchronous pre-paint CLS=0 lock](./priority-plus-folding-stages.svg "Priority+ Responsive Folding Stages and Pre-Paint Lock")

Because `[data-nav-count]` is applied synchronously in the inline `<head>` script before the browser paints the document body, visitors never experience a flash of overflowing navigation links or a layout shift when switching routes.

## Why Did We Engineer a Ten-Stop Aurora Color Spectrum?

We engineered a ten-stop Aurora color spectrum to provide preattentive visual category recognition across nine content domains and the primary brand identity [@ware-2020-information-visualization; @miller-1956-magical-number]. Defined centrally in [`domain-themes.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/domain-themes.ts) and [`domains.css`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/styles/domains.css), the palette rotates hues smoothly from $164^\circ$ Soft Sage to $274^\circ$ Muted Mauve across both light and dark themes.

Early iterations relied on four ad-hoc Tailwind utility colors, causing semantic collisions once nine content domains were introduced. While working memory comfortably tracks roughly seven chunks [@miller-1956-magical-number], preattentive hue progression in [`theme.css`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/styles/theme.css) (`--color-accent-1` through `--color-accent-10`) and [`domains.css`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/styles/domains.css) groups adjacent domains along a continuous cool-toned arc [@ware-2020-information-visualization], while `getThemeTokens` in [`domain-themes.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/domain-themes.ts) adapts interactive WebGL and Canvas surfaces:

- **Soft Nordic Pastel Light Mode (`:root.light`)**: Pairs desaturated pastel accents (`#4ea28b` Soft Sage to `#8f61b3` Muted Mauve) against an `#ebf2f8` surface for glare-free reading.
- **Ultra-Subtle Dark Mode (`:root`)**: Pairs calibrated luminous stops (`#469b84` to `#9261b8`) with translucent `bg-domain-*/10` badges and `hover:border-domain-*/40` card frames on `#030712`.

The diagram below maps all ten hue stops from $164^\circ$ Soft Sage to $274^\circ$ Muted Mauve alongside the dual-surface light and dark mode calibration:

![Semantic vector infographic of the 10-stop Aurora domain color spectrum rotating from 164 degree Soft Sage to 274 degree Muted Mauve across Nordic Pastel Light and Ultra-Subtle Dark modes](./aurora-ten-domain-spectrum.svg "10-Stop Aurora Domain Color Spectrum and Dual-Theme Calibration")

## Enforcing Domain Parity and Color Tokens via Static Linters

Static linters enforce domain sequence parity and color token hygiene by scanning every Astro component, stylesheet, and TypeScript module during continuous integration. Our verification scripts [`lint-colors.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/lint-colors.ts) and [`lint-domains.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/lint-domains.ts) execute thirty-eight deterministic governance rules that reject hardcoded hexadecimal literals, raw Tailwind palette classes, and out-of-order domain sections before build compilation.

Design systems decay rapidly when components bypass semantic tokens with raw Tailwind utilities (`text-blue-500`) or reorder domain sections across overview pages. By anchoring `CONTENT_DOMAINS` in [`domain-themes.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/shared/domain-themes.ts), [`lint-colors.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/lint-colors.ts) (7 token rules) and [`lint-domains.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/lint-domains.ts) (31 structural rules) enforce 100% cross-site parity.

![Semantic vector infographic showing CONTENT_DOMAINS feeding into lint-colors.ts 7 token rules and lint-domains.ts 31 sequence parity rules to enforce design system integrity](./domain-color-linter-gates.svg "38-Rule Static Domain and Color Token Governance Pipeline")

The TypeScript excerpt below illustrates how `CONTENT_DOMAINS` anchors both the raw palette regex check in `lint-colors.ts` and the canonical sequence verification in `lint-domains.ts`:

```typescript caption="Canonical CONTENT_DOMAINS tuple anchoring raw Tailwind palette rejection in lint-colors.ts and sequence verification in lint-domains.ts."
export const CONTENT_DOMAINS: readonly ContentDomain[] = [
  'posts', 'publications', 'presentations', 'courses',
  'projects', 'services', 'newsletters', 'visualizations', 'tags',
] as const;

// Rule 3 in src/scripts/lint-colors.ts: Reject ad-hoc Tailwind palette classes
const RAW_PALETTE_REGEX =
  /\b(?:[a-zA-Z0-9_-]+:)*(?:text|bg|border|ring|fill|stroke)-(?:sky|cyan|teal|emerald|blue|indigo|violet|purple)-(?:50|[1-9]00|950)\b/g;

// Rule 31 in src/scripts/lint-domains.ts: Enforce canonical CONTENT_DOMAINS sequence
for (let i = 0; i < CONTENT_DOMAINS.length; i++) {
  if (overviewDomains[i] !== CONTENT_DOMAINS[i]) {
    error(`OVERVIEW_PAGES_CONFIG[${i}] "${overviewDomains[i]}" != "${CONTENT_DOMAINS[i]}".`);
  }
}
```
