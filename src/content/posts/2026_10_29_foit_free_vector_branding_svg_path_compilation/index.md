---
title: "FOIT-Free Vector Branding: Compiling SVG Paths & the DT-1 H-Bridge"
pubDate: 2026-10-29
description: "Why external webfonts inside SVG favicons trigger Flash of Invisible Text (FOIT), and how we compile self-contained vector paths and our DT-1 H-Bridge emblem across web, PWA, Open Graph, and React Email."
inLanguage: "en"
tags:
  - design-systems
  - computer-graphics
  - web-development
  - typescript
image:
  src: "./hero.jpg"
  title: "FOIT-Free Vector Branding and DT-1 H-Bridge Path Compilation"
  description: "Architectural timber drafting table in the Grünau im Almtal office displaying a technical vector blueprint of the DT-1 H-Bridge polygon coordinates and Bezier control vertices"
references:
  - id: "bellamy-royds-2015-svg-text"
    type: "book"
    authors:
      - name: "Amelia Bellamy-Royds"
      - name: "Kurt Cagle"
    title: "SVG Text Layout: Words as Art"
    publisher: "O'Reilly Media"
    year: 2015
    isbn: "978-1-4919-3382-4"
    url: "https://books.google.com/books?vid=ISBN9781491933824"
  - id: "w3c-2018-svg2"
    type: "online"
    authors:
      - name: "Nikos Andronikos"
      - name: "Tavmjong Bah"
      - name: "Brian Birtles"
      - name: "Cyril Concolato"
      - name: "Erik Dahlström"
      - name: "Chris Lilley"
      - name: "Cameron McCormack"
      - name: "Doug Schepers"
      - name: "Dirk Schulze"
      - name: "Richard Schwerdtfeger"
      - name: "Satoru Takagi"
      - name: "Jonathan Watt"
    title: "Scalable Vector Graphics (SVG) 2"
    siteName: "W3C Candidate Recommendation"
    year: 2018
    url: "https://www.w3.org/TR/SVG2/"
  - id: "daggett-2018-css-fonts-3"
    type: "online"
    authors:
      - name: "John Daggett"
      - name: "Myles C. Maxfield"
      - name: "Chris Lilley"
    title: "CSS Fonts Module Level 3"
    siteName: "W3C Recommendation"
    year: 2018
    url: "https://www.w3.org/TR/css-fonts-3/"
---

Embedding `<text>` nodes with external `@font-face` rules inside standalone SVG favicons triggers Flash of Invisible Text (FOIT) and broken fallback glyphs in sandboxed browser contexts [@w3c-2018-svg2; @daggett-2018-css-fonts-3]. Compiling brand monograms and our DT-1 H-Bridge emblem into self-contained vector primitives at build time guarantees deterministic rendering across tabs, PWA icons, and email headers [@bellamy-royds-2015-svg-text].

| Branding Strategy | External Font Request | Favicon Sandbox Behavior | Payload Size | Multi-Target Consistency |
| :--- | :--- | :--- | :--- | :--- |
| **SVG `<text>` + Remote `@font-face`** | Blocked in `<img>` / tab icons | Blank icon (FOIT) or serif fallback | $\approx 0.6\text{ KB}$ (broken) | Low (OS-dependent fonts) |
| **SVG `<text>` + Inline Base64 WOFF2** | None (embedded data URI) | Asynchronous decode race condition | $\approx 19.4\text{ KB}$ | Medium (Chromium tab FOIT) |
| **Build-Time Vector `<path>` / `<polygon>`** | Zero font dependencies | Instant synchronous geometry | $\approx 0.4\text{ KB}$ | 100% across Web, PWA & Email |

## Why Do SVG Text Nodes Cause FOIT in Favicons and Sandboxed Contexts?

When browsers load an SVG via `<link rel="icon">` or `<img>`, strict security sandboxes block external network requests, preventing `@font-face` rules from fetching remote WOFF2 files [@w3c-2018-svg2; @daggett-2018-css-fonts-3]. Even inline Base64 font payloads trigger asynchronous decoding delays during synchronous tab rasterization, producing blank favicons or misaligned system serif fallbacks [@bellamy-royds-2015-svg-text].

In Chromium's image decoding pipeline, tab favicons are rasterized synchronously on the first frame before asynchronous font streams resolve [@daggett-2018-css-fonts-3]. Converting typography and geometric emblems into explicit `<path>` and `<polygon>` coordinates eliminates runtime font resolution altogether [@bellamy-royds-2015-svg-text; @w3c-2018-svg2].

![Comparison between runtime SVG text failure (FOIT) in sandboxed browser contexts and build-time vector path compilation with the DT-1 H-Bridge emblem](./foit-vector-path-compilation.svg "FOIT-Free Vector Path Compilation and DT-1 H-Bridge Geometry")

## How Do We Compile Glyphs and the DT-1 H-Bridge Logo into Vector Paths?

We eliminate runtime font dependencies by compiling TrueType glyph contours (`cmap`, `hmtx`, `loca`, `glyf`) into cubic and quadratic Bezier `<path>` outlines or synthesizing our pure geometric DT-1 H-Bridge `<polygon>` emblem in [`src/commons/server/branding-assets.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/branding-assets.ts) [@w3c-2018-svg2; @bellamy-royds-2015-svg-text]. A SHA-256 content-addressed Puppeteer pipeline then rasterizes deterministic PNG derivatives only when source templates change.

Instead of shipping a 19 KB Base64 font inside `favicon.svg`, we first built an on-the-fly WOFF1 TrueType outline compiler before unifying on the borderless plain-color **DT-1 H-Bridge** geometry in [`src/pages/_internal/icon.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/_internal/icon.astro) and [`src/pages/_internal/og.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/_internal/og.astro): a Soft Sage rounded square (`rx="22"`, `#469b84`), two slanted white pillars (`18,78 30,22 44,22 32,78` and `56,78 68,22 82,22 70,78`), and a recessed `#cae8df` crossbar (`30,58 34,42 70,42 66,58`). When rasterizing PNG icons in [`src/commons/server/branding-assets.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/branding-assets.ts), we inject transparent viewport overrides via `style.textContent` rather than `innerHTML` to satisfy our strict zero-`innerHTML` gate:

```typescript
// src/commons/server/branding-assets.ts
await page.evaluateOnNewDocument(() => {
  const style = document.createElement('style');
  style.textContent = 'html, body { background: transparent !important; }';
  document.head.appendChild(style);
});

const fullUrl = `http://127.0.0.1:${port}${urlPath}`;
await page.goto(fullUrl, { waitUntil: 'networkidle0' });
await page.evaluateHandle(() => document.fonts.ready);

const buffer = (await page.screenshot({ omitBackground: true })) as Buffer;
```

## Unifying Brand Geometry Across React Email and Institution Logos

To maintain visual parity beyond browser tabs, [`src/commons/server/email/EmailShell.tsx`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/email/EmailShell.tsx) replaces legacy CSS text badges with our pre-rendered `icon-192x192.png` H-Bridge asset across all transactional and campaign email headers. Simultaneously, [`src/pages/about.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/about.astro) and [`src/components/InstitutionLogo.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/InstitutionLogo.astro) harmonize academic and industry marks on a normalized `100x100` coordinate grid using adaptive Nordic pastel tokens [@w3c-2018-svg2; @bellamy-royds-2015-svg-text].

Email clients frequently strip custom webfonts and CSS gradients, so [`src/commons/server/email/EmailShell.tsx`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/email/EmailShell.tsx) embeds the deterministic `40x40` rasterized DT-1 badge directly alongside the header lockup. On [`src/pages/about.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/pages/about.astro), [`src/components/InstitutionLogo.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/InstitutionLogo.astro) pairs the self-hosted H-Bridge geometry (`color-mix(in srgb, var(--color-brand-primary) 28%, white)`) with optically centered institution marks (`--color-inst-*`):

```tsx
// src/commons/server/email/EmailShell.tsx
<table role="presentation" cellPadding="0" cellSpacing="0" border={0}>
  <tbody>
    <tr>
      <td style={emailStyles.headerBadgeCell}>
        <Img
          src="https://hackenberg.tech/icon-192x192.png"
          width="40"
          height="40"
          alt="Dr. Georg Hackenberg"
          style={emailStyles.brandBadge}
        />
      </td>
    </tr>
  </tbody>
</table>
```
