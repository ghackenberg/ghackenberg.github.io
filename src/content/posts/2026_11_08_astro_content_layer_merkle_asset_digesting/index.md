---
title: "Content-Addressable Asset Digesting and Dependency Tracking in Astro 5 Content Layer"
pubDate: 2026-11-08
description: "How we wrapped Astro 5's glob() loader with composite Merkle asset digests, bound Vite FSWatcher proxies, and localImagePaths SVG pruning for sub-200ms HMR."
inLanguage: "en"
tags:
  - astro
  - content-engineering
  - software-architecture
  - typescript
  - web-development
image:
  src: "./hero.jpg"
  title: "Content-Addressable Merkle Asset Digesting in Astro 5 Content Layer"
  description: "Architectural blueprint in the Grünau im Almtal timber office illustrating composite Merkle tree asset digesting and Vite watcher dependency tracking for Astro 5"
references:
  - id: "mokhov-2018-build-systems-a-la-carte"
    type: "article"
    authors:
      - name: "Andrey Mokhov"
      - name: "Neil Mitchell"
      - name: "Simon Peyton Jones"
    title: "Build Systems à la Carte"
    journal: "Proceedings of the ACM on Programming Languages"
    volume: "2"
    number: "ICFP"
    pages: "79:1--79:29"
    year: 2018
    doi: "10.1145/3236774"
    url: "https://doi.org/10.1145/3236774"
  - id: "dolstra-2004-nix-safe-deployment"
    type: "inproceedings"
    authors:
      - name: "Eelco Dolstra"
      - name: "Merijn de Jonge"
      - name: "Eelco Visser"
    title: "Nix: A Safe and Policy-Free System for Software Deployment"
    booktitle: "Proceedings of the 18th USENIX Conference on System Administration (LISA '04)"
    pages: "79--92"
    year: 2004
    url: "https://www.usenix.org/legacy/publications/library/proceedings/lisa04/tech/full_papers/dolstra/dolstra.pdf"
  - id: "merkle-1988-digital-signature"
    type: "inproceedings"
    authors:
      - name: "Ralph Charles Merkle"
    title: "A Digital Signature Based on a Conventional Encryption Function"
    booktitle: "Advances in Cryptology — CRYPTO '87 (LNCS, vol. 293)"
    pages: "369--378"
    year: 1988
    doi: "10.1007/3-540-48184-2_32"
    url: "https://doi.org/10.1007/3-540-48184-2_32"
---

Astro 5's built-in `glob()` content loader computes entry digests exclusively from raw Markdown text, leaving co-located vector schematics and raster cover images untracked in the build cache [@mokhov-2018-build-systems-a-la-carte]. We engineered [`assetAwareGlob`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/content-loader.ts) to fold sorted sibling asset hashes into each entry's Merkle digest and prune build-time inlined SVGs from redundant image optimization [@merkle-1988-digital-signature].

<!-- caption: "Architectural comparison of Astro's built-in text-only glob() loader, ad-hoc DataStore cache-wipe workarounds, and our composite Merkle asset-aware loader (SYSTEM-012)." -->
| Architectural Dimension | Built-In `glob()` Loader | Ad-Hoc Dev Cache-Wipe Workaround | Composite Merkle `assetAwareGlob` (`SYSTEM-012`) |
| :--- | :--- | :--- | :--- |
| **Digest Input Scope** | Raw `.md`/`.mdx` string only | Raw `.md`/`.mdx` string only | Markdown body + co-located `.svg`/raster hashes + pipeline plugins [@merkle-1988-digital-signature] |
| **In-Place Asset Edit (`hero.jpg` / `.svg`)** | Misses mutation; serves stale `.astro/data-store.json` | Deletes entire `.astro/data-store.json` + `server.restart()` | Re-renders only the affected entry in `< 200ms` [@mokhov-2018-build-systems-a-la-carte] |
| **Vite Watcher Integration** | Watches `.md`/`.mdx` globs only | External Chokidar hooks in [`astro.config.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/astro.config.ts) | Bound `Proxy` on `context.watcher` + 100ms debounced asset mapping |
| **Build-Time Inlined SVGs** | Processed redundantly by `astro:assets` | Left in `localImagePaths` | Pruned from `vfile.data.astro.localImagePaths` in [`rehype-inline-svg.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/plugins/rehype-inline-svg.ts) |

## Why Does Astro's Built-In Glob Loader Miss Co-Located Asset Mutations?

Astro's default `glob()` loader misses co-located asset mutations because it evaluates `generateDigest` strictly over the Markdown string and frontmatter metadata [@mokhov-2018-build-systems-a-la-carte]. When an author edits a sibling `.svg` diagram or overwrites `hero.jpg` in place, the entry digest in `.astro/data-store.json` remains unchanged and serves stale build artifacts until a manual cache wipe.

In the formal taxonomy of build systems established by Mokhov, Mitchell, and Peyton Jones [@mokhov-2018-build-systems-a-la-carte], Astro 5's Content Layer acts as a *constructive verifying trace* store backed by `.astro/data-store.json`. A constructive trace cache is only sound when its verification key captures the complete transitive closure of inputs consumed during compilation [@dolstra-2004-nix-safe-deployment]. As documented in our architectural specification [`SYSTEM-012`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/backlog/system/012-astro-content-layer-asset-hashing-and-dependency-tracking.md), two compilation paths violated this invariant: first, [`rehype-inline-svg.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/plugins/rehype-inline-svg.ts) reads co-located `.svg` files synchronously via `fs.readFileSync` outside Vite's module graph; second, replacing `hero.jpg` or `preview.jpg` with an identical filename leaves the frontmatter path string `./hero.jpg` untouched.

![Semantic vector comparison contrasting Astro built-in text-only glob digesting with our composite Merkle asset tree digesting](./stale-text-digest-vs-merkle-tree.svg "Text-Only Glob Digest vs. Composite Merkle Asset Tree")

Previously, [`astro.config.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/astro.config.ts) worked around these stale cache hits by watching `.svg` files and deleting the entire `.astro/data-store.json` cache or triggering a full `server.restart()`, which invalidated every collection simultaneously and added multi-second rebuild latency.

## How Does Our Custom Content Loader Compute Combined Merkle Asset Digests?

Our custom [`assetAwareGlob`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/content-loader.ts) wrapper intercepts `generateDigest` to combine the base Markdown digest with a sorted cryptographic fingerprint of all co-located directory assets and pipeline plugins [@merkle-1988-digital-signature; @dolstra-2004-nix-safe-deployment]. Simultaneously, it proxies Vite's file watcher with bound `this` context to map sibling asset edits directly back to the affected Markdown entry for sub-second updates.

Wired across all content collections in [`src/content.config.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/content.config.ts), `computeEntryAssetFingerprint` scans the entry directory (plus parent presentation directories for `slides/` and explicit `./` or `../` references) for `.svg`, `.png`, `.jpg`, `.webp`, `.avif`, and `.gif` files, alongside global pipeline dependencies including [`src/styles/graphics.css`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/styles/graphics.css). Using `getFileContentHash` from [`src/commons/server/content-hash.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/content-hash.ts)—which caches 16-character MD5 digests keyed by `mtimeMs` and byte `size`—the loader constructs a deterministic Merkle-style fingerprint [@merkle-1988-digital-signature]:

$$\text{digest}(\text{entry}) = H\Big(H(\text{markdown}) \;\Vert\; \bigoplus_{a \in \text{Assets}(\text{entry})} \big(\text{relPath}(a) \mathbin{\Vert} H(a)\big)\Big)$$

![Semantic vector architecture of assetAwareGlob intercepting generateDigest and proxying Vite FSWatcher for single-entry invalidation](./content-loader-digest-watcher-pipeline.svg "Composite Digest Hook and Bound FSWatcher Proxy Pipeline")

To trigger surgical single-entry rebuilds during `astro dev` without mutating Markdown file timestamps (`fs.utimesSync`), [`src/commons/server/content-loader.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/commons/server/content-loader.ts) wraps `context.watcher` in an ES `Proxy` that captures Astro's internal `globChangeHandler` while binding native Vite `FSWatcher` methods (`Reflect.get(target, prop, target).bind(target)`):

```typescript caption="Composite Merkle digest interception and bound FSWatcher proxy in src/commons/server/content-loader.ts."
const wrappedWatcher: FSWatcher | undefined = context.watcher
  ? new Proxy(context.watcher, {
      get(target, prop) {
        if (prop === 'on') {
          return (event: string, listener: (changedPath: string) => void) => {
            if (event === 'change' && !globChangeHandler) globChangeHandler = listener;
            return target.on(event, listener);
          };
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    })
  : undefined;

const enhancedContext: LoaderContext = {
  ...context,
  watcher: wrappedWatcher,
  generateDigest: (data) => {
    const baseDigest = String(originalGenerateDigest(data));
    const mdFilePath = typeof data === 'string' ? mdFileByBaseDigest.get(baseDigest) : undefined;
    const assetFp = mdFilePath ? computeEntryAssetFingerprint(mdFilePath, data as string) : '';
    return assetFp ? String(originalGenerateDigest(`${baseDigest}:${assetFp}`)) : baseDigest;
  },
};
```

When a co-located `.svg` or raster image changes on disk, `findAffectedMarkdownFiles` resolves the owning `.md`/`.mdx` entry within a 100ms debounce window, refreshes `mdFileByBaseDigest`, and invokes `globChangeHandler(mdFile)` so Astro re-renders only that entry in under 200ms.

## Why Must Build-Time Inlined SVGs Be Pruned From Astro's Image Pipeline?

Build-time inlined SVGs must be pruned from `vfile.data.astro.localImagePaths` because Astro's Remark pass registers every Markdown image syntax node for asset optimization before Rehype plugins execute. Filtering out inlined `.svg` paths in [`rehype-inline-svg.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/plugins/rehype-inline-svg.ts) prevents redundant `astro:assets` processing while keeping theme-adaptive vector diagrams inside the document DOM.

Because our diagrams rely on CSS custom properties (`var(--svg-*)` from [`src/styles/graphics.css`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/styles/graphics.css)) to switch seamlessly between Soft Nordic Pastel light mode and dark mode, [`src/plugins/rehype-inline-svg.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/plugins/rehype-inline-svg.ts) replaces `<p><img src="./diagram.svg"></p>` with an inline `<figure class="svg-diagram">` tree. During this transformation, the plugin computes an 8-character SHA-256 scope prefix (`svg-${hash}-`) over both the normalized path and SVG content (`data-svg-hash`) so internal `<marker>` and `<clipPath>` IDs never collide across multiple diagrams on a page.

![Semantic vector schematic showing Remark image registration followed by rehype-inline-svg DOM replacement and localImagePaths pruning](./svg-inlining-local-image-pruning.svg "Two-Stage Remark Registration and Rehype SVG Pruning")

However, Astro's internal Remark image plugin runs *before* Rehype and pushes every `![alt](./diagram.svg)` path into `vfile.data.astro.localImagePaths`. By filtering `inlinedSrcs` and `.svg` entries out of `astroData.localImagePaths` at the end of [`rehype-inline-svg.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/src/plugins/rehype-inline-svg.ts) and recording `inlineSvgDependencies`, Astro's image pipeline only optimizes genuine raster assets like `hero.jpg`, while [`astro.config.ts`](https://github.com/ghackenberg/ghackenberg.github.io/blob/main/astro.config.ts) remains completely free of manual `.astro/data-store.json` deletion hacks—unifying our [Schema.org ImageObject Metadata Pipeline](/posts/2026_10_16_schema_org_image_object_metadata_asset_governance/), [Zero-Artifact Content-Addressable Build Caching](/posts/2026_10_24_zero_artifact_repositories_content_addressable_build_caching/), [Single-Root JSON-LD 1.1 Knowledge Graph Validator](/posts/2026_10_25_single_root_json_ld_knowledge_graph_validator/), and [Three-Band Adaptive SVG Color Governance](/posts/2026_11_07_three_band_figures_adaptive_svg_color_governance/).
