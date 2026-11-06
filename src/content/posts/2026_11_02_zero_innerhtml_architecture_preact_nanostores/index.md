---
title: "Zero-innerHTML Architecture: Preact Islands & AST Gates"
pubDate: 2026-11-02
description: "How we eliminated raw .innerHTML DOM sinks using declarative Preact .tsx islands, Nanostores state atoms, and automated ESLint and AST security gates."
inLanguage: "en"
tags:
  - software-architecture
  - web-development
  - typescript
  - cybersecurity
  - state-management
image:
  src: "./hero.jpg"
  title: "Zero-innerHTML Client Architecture with Preact Islands and AST Security Gates"
  description: "Architectural timber drafting table blueprint in the Grünau im Almtal office contrasting blocked imperative .innerHTML DOM sinks with verified Preact VDOM islands and Nanostores state atoms."
references:
  - id: "weinberger-2011-xss-sanitization"
    type: "inproceedings"
    authors:
      - name: "Joel Weinberger"
      - name: "Prateek Saxena"
      - name: "Devdatta Akhawe"
      - name: "Matthew Finifter"
      - name: "Richard Shin"
      - name: "Dawn Song"
    title: "A Systematic Analysis of XSS Sanitization in Web Application Frameworks"
    booktitle: "Computer Security – ESORICS 2011 (LNCS, vol. 6879)"
    year: 2011
    pages: "150--171"
    doi: "10.1007/978-3-642-23822-2_9"
    url: "https://doi.org/10.1007/978-3-642-23822-2_9"
  - id: "miller-2021-islands-architecture"
    type: "online"
    authors:
      - name: "Jason Miller"
    title: "Islands Architecture"
    year: 2020
    siteName: "jasonformat.com"
    url: "https://jasonformat.com/islands-architecture/"
  - id: "west-2016-csp3"
    type: "online"
    authors:
      - name: "Mike West"
      - name: "Antonio Sartori"
    title: "Content Security Policy Level 3"
    year: 2023
    siteName: "W3C Working Draft"
    url: "https://www.w3.org/TR/CSP3/"
---

A **Zero-`innerHTML` Client Architecture** eliminates cross-site scripting (XSS) sinks and untyped string concatenation by replacing imperative `.innerHTML` mutations with declarative Preact virtual DOM islands [@miller-2021-islands-architecture], reactive Nanostores state atoms, and static ESLint and filesystem gates that mechanically forbid raw HTML DOM injection across all client scripts [@weinberger-2011-xss-sanitization; @west-2016-csp3].

<!-- caption: "Architectural comparison of imperative innerHTML templates, full-page SPA hydration, and Preact/Nanostores islands guarded by a static Zero-innerHTML AST gate." -->
| Architectural Dimension | Imperative `.innerHTML` Templates | Full-Page SPA Hydration | Preact/Nanostores Islands + Zero-`innerHTML` AST Gate (`SYSTEM-009`) |
| :--- | :--- | :--- | :--- |
| **DOM XSS Surface** | High (manual `escapeHtml()` or unescaped template strings) [@weinberger-2011-xss-sanitization] | Low (automatic VDOM text escaping), but large runtime footprint | Zero raw HTML sinks; 100% contextual VDOM escaping + CI AST ban [@west-2016-csp3] |
| **Client JS Payload** | 0 KB framework overhead, but high inline script duplication | 40–130+ KB global hydration bundle across static prose | ~3 KB Preact runtime scoped strictly to interactive islands [@miller-2021-islands-architecture] |
| **State Synchronization** | Fragile `window.*` globals, `.className` overwrites, `cloneNode(true)` | Monolithic context providers and route-level re-renders | Tiny reactive `atom` and `map` stores in [`stores.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/stores.ts) |
| **Enforcement Mechanism** | Code review discipline only (prone to regression) | Framework conventions (bypassable via `dangerouslySetInnerHTML`) | Unbypassable ESLint `no-restricted-properties` + full-tree regex gate |

## What Structural Flaws Did Our 49-Script Client Audit Reveal?

Auditing all 49 client-side scripts in [`SYSTEM-009`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/backlog/system/009-client-script-deduplication-and-preact-dom-hardening.md) exposed two systemic liabilities: 7 duplicated ~75-line ES5 `<script is:inline>` pre-filter blocks across catalog pages and 6 raw `.innerHTML` sinks—including unescaped node metadata in graph tooltips and 600 lines of string-concatenated SVG/HTML in our analytics Sankey inspector [@weinberger-2011-xss-sanitization].

To eliminate copy-paste drift before touching the rendering layer, Phase 1 consolidated the 7 inline ES5 URL pre-filters (`?tag=`, `?q=`, `?page=`, `?lang=`, `?trl=`) into a single parameterized [`CatalogPreFilter.astro`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/components/CatalogPreFilter.astro) component and unified 4 scattered clipboard scripts into [`clipboard.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/clipboard.ts) with `WeakMap` timer state and `astro:page-load` lifecycle support. We then replaced all 6 imperative `.innerHTML` sinks with typed Preact `.tsx` islands [@miller-2021-islands-architecture]:

![Semantic vector infographic contrasting 49-script client sprawl and 6 raw innerHTML XSS sinks with consolidated CatalogPreFilter.astro, clipboard.ts, and typed Preact .tsx VDOM islands](./client-script-deduplication-islands.svg "49-Script Client Audit Deduplication and Preact Island Migration")

Replacing string-concatenated DOM templates with typed Preact `.tsx` islands guarantees automatic contextual text escaping across every tooltip, pagination bar, and analytics inspector while shrinking duplicated inline scripts.

## How Do Preact Islands Coexist with Server-Side React Email?

We configure `"jsxImportSource": "preact"` globally in [`tsconfig.json`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/tsconfig.json) so interactive client `.tsx` islands compile into lightweight Preact virtual DOM nodes, while explicitly annotating our four server-side newsletter templates under `src/commons/server/email/` with `/** @jsxImportSource react */` compiler pragmas and synchronizing cross-island browser state through tiny, framework-agnostic Nanostores reactive state atoms [@miller-2021-islands-architecture].

This Dual-JSX routing keeps server-only `@react-email/components` rendering in our [Newsletter-as-Code Listmonk Pipeline](/posts/2026_10_20_newsletter_as_code_react_email_listmonk_altcha_pow/) untouched while allowing interactive browser components—such as [`pagination.tsx`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/pagination.tsx), [`vis-tooltip.tsx`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/vis-tooltip.tsx) (powering our [Five Graph Engines Unified Interaction Physics](/posts/2026_11_05_five_graph_engines_unified_interaction_physics/) and [Voronoi Proximity Picking](/posts/2026_11_06_voronoi_proximity_picking_touch_graph_interaction/)), and [`dev-sankey-view.tsx`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/dev-sankey-view.tsx) (visualizing [Consent-Free Plausible Markov Visitor Flows](/posts/2026_10_18_consent_free_markov_chain_visitor_flows_plausible/))—to share a tiny ~3 KB VDOM runtime and centralized reactive state in [`stores.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/client/stores.ts) that hardens the DOM against [Emergent AI Security Incidents](/posts/2026_10_22_emergent_properties_history_theory_ai_security_incidents/) and [In-Browser WebMCP Injection Vectors](/posts/2026_10_23_webmcp_w3c_standard_architecture_history_future/).

![Semantic vector infographic showing Dual-JSX compiler routing between client Preact .tsx islands synchronized via Nanostores and server-side React Email templates](./dual-jsx-preact-nanostores.svg "Dual-JSX Compiler Routing and Nanostores Reactive State Bus")

The simplified excerpt below shows how `stores.ts` and `pagination.tsx` combine Nanostores atoms and maps with Preact's `render()` entrypoint:

```tsx caption="Reactive Nanostores state atoms and declarative Preact JSX pagination rendering in stores.ts and pagination.tsx."
// src/commons/client/stores.ts & pagination.tsx (simplified)
import { atom, map } from 'nanostores';
import { render } from 'preact';

export const $themeSetting = atom<'system' | 'light' | 'dark'>('system');
export const $paginationPages = map<Record<string, number>>({});

export function mountPaginationNumbers(
  container: HTMLElement,
  navId: string,
  pages: (number | string)[],
  currentPage: number
): void {
  render(
    <>
      {pages.map((p, i) =>
        typeof p === 'string' ? <span key={i}>...</span> : <button key={p} data-goto={p}>{p}</button>
      )}
    </>,
    container
  );
  $paginationPages.setKey(navId, currentPage);
}
```

## Enforcing a Zero-innerHTML Policy via ESLint and AST Gates

Because manual code review alone cannot prevent future contributors or autonomous AI agents from reintroducing `.innerHTML` mutations, we enforce a two-layer mechanical gate: AST-level ESLint restrictions in [`eslint.config.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/eslint.config.ts) coupled with a full-directory source scanner in [`validate-architecture.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/scripts/validate-architecture.ts) that also inspects raw `<script is:inline>` blocks [@weinberger-2011-xss-sanitization; @west-2016-csp3].

![Semantic vector infographic of the two-layer mechanical Zero-innerHTML security gate combining ESLint AST restrictions with the validate-architecture.ts inline script scanner](./zero-innerhtml-ast-security-gate.svg "Two-Layer Mechanical Zero-innerHTML ESLint and AST Security Gate")

Because [`eslint.config.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/eslint.config.ts) simultaneously sets `'eslint-comments/no-use': ['error', { allow: [] }]`, neither human developers nor autonomous coding agents can suppress the ban with `eslint-disable` comments:

```ts caption="Unbypassable ESLint AST rules forbidding innerHTML, outerHTML, and insertAdjacentHTML in eslint.config.ts."
// eslint.config.ts — Unbypassable Zero-innerHTML AST Gate
'no-restricted-properties': [
  'error',
  {
    property: 'innerHTML',
    message: 'Direct .innerHTML assignment is forbidden. Use Preact JSX (.tsx) or textContent/replaceChildren.',
  },
  { property: 'outerHTML', message: 'Direct .outerHTML assignment is forbidden.' },
],
'no-restricted-syntax': [
  'error',
  {
    selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
    message: 'insertAdjacentHTML() is forbidden. Use Preact JSX (.tsx) or safe DOM APIs.',
  },
],
```
