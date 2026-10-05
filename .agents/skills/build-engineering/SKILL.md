---
name: build-engineering
description: Manage Astro build pipelines, npm script orchestration, CI/CD verification gates, and cross-platform Windows I/O resilience.
---

# Build Engineering (Pipelines, Script Contracts & CI/CD)

This skill governs the build lifecycle, script contracts, architectural boundary enforcement, and cross-platform I/O safety.

## 1. Core Verification Pipelines
All builds and releases adhere to a strict tiered gate hierarchy:
- **Fast Syntax & Validation Gate**:
  ```powershell
  npm run validate
  ```
  Aggregates ESLint (`--max-warnings=0`), Astro typecheck, script contracts, slide syntax, citation syntax, style isolation, and architecture boundaries.
- **Production Build Gate**:
  ```powershell
  npm run build
  ```
  Runs typecheck, SSG page generation, asset builds, and automatically triggers the `postbuild` semantic ID audit.
- **Master Release Gate**:
  ```powershell
  npm run verify
  ```
  Aggregates `npm run validate` and `npm run build`. Must pass with 0 errors before merging feature branches to `main`.

## 2. Scripts & CLI Architecture Contract
- **CLI Entrypoints**: `src/scripts/` is exclusively reserved for standalone executable CLI entrypoints.
- **1:1 Package.json Mapping**: Every `.ts` file inside `src/scripts/` MUST have at least one corresponding script command in `package.json`. Strictly verified by `npm run validate:scripts`.
- **Internal Helper Modules**: Shared logic, parsers, and utilities for scripts MUST live in `src/commons/` (e.g. `@commons/server/...`) and be imported via `@commons/*`.
- **No Reverse Imports**: Never import from `src/scripts/` inside web application code (`src/pages/`, `src/components/`, `src/layouts/`) or `astro.config.ts`.

## 3. Path Aliases & Cohesion Boundaries
- Always use configured path aliases (`@commons/*`, `@components/*`, `@layouts/*`, `@assets/*`, `@styles/*`, `@content/*`, `@plugins/*`, `@tools/*`) across directory boundaries.
- Never use parent traversal imports (`../..`). Enforced by ESLint `no-restricted-imports`.
- Co-located sibling imports (`./...`) are permitted within the same folder for private sub-modules.

## 4. Cross-Platform Hashing & Path Normalization
- **Line Endings**: Cryptographic hashes computed over source text files (`.astro`, `.css`, `.js`, `.ts`, `.md`, `.mdx`) MUST normalize line endings via `.replace(/\r\n/g, '\n')` before hashing to prevent Windows CRLF vs. Linux LF divergence.
- **POSIX Path Normalization**: Relative file paths included in hash seeds MUST be normalized to POSIX format via `.replace(/\\/g, '/')`.

## 5. Windows File I/O Resilience
- Writes to cache, thumbnails, PDFs, or generated metadata (`.visual-cache.json`, audio caches) must handle transient file locks from OS indexers.
- Use backoff retry loops (5–6 attempts with 200–250ms backoff) rather than bare unhandled writes.
