# AGENTS.md

This file provides guidance to AI coding assistants (Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI, and others) working with code in this repository. `CLAUDE.md` imports it.

## What This Project Is

**easy-upload** is a Tampermonkey/Violentmonkey userscript that automates cross-tracker torrent uploading between private torrent trackers (PT sites). It extracts torrent metadata from a source tracker's detail page, then auto-fills the upload form on a target tracker.

## Commands

```bash
yarn build          # Build production userscript to dist/
yarn dev            # Dev server with hot reload
yarn test           # Run Vitest tests (watch mode)
yarn test --run     # Run tests once
yarn coverage       # Run tests with coverage report
yarn lint           # ESLint check
yarn site-config --raw <file> --name <Name>   # Validate a new site config, see below
```

To run a single test file:
```bash
yarn test src/common/movie/tests/douban.test.ts --run
```

## Architecture Overview

### Source → Target Data Flow

1. **Source tracker detail page**: `index.tsx` detects the current site, calls `getTorrentInfo()` → an extractor reads the DOM, returns a `TorrentInfo.Info` object, which is cached to `GM_setValue` + `sessionStorage` and displayed in the Preact UI.
2. **User clicks "Transfer to [Site]"**: Target tracker URL is opened with torrent info encoded in the URL hash (`#torrentInfo=<encoded>&timestamp=<ts>`).
3. **Target tracker upload page**: `index.tsx` decodes the torrent info from hash/cache, calls `fillTargetForm()` → a filler reads from `TorrentInfo.Info` and fills DOM form fields using selectors from the site's YAML config.

### Registry Pattern (Extractors & Fillers)

Both extractors (`src/source/info-extractors/`) and fillers (`src/target/target-filler/`) use a registry pattern:

- Each class implements `canHandle(siteName, siteType): boolean` and a `priority` number
- `registry.getExtractor()` / `registry.getApplicableFiller()` picks the highest-priority match
- Base classes (`BaseExtractor`, `BaseFiller`) provide default behavior that site-specific subclasses override

### YAML Site Configuration

Each supported tracker has a YAML file in `src/config/` (e.g., `TTG.yaml`, `RED.yaml`). These define:
- Site metadata (`url`, `host`, `siteType`, `asSource`, `asTarget`)
- DOM selectors for each upload form field
- Value maps for dropdowns (e.g., mapping `movie` → `['51', '52', ...]` for a category `<select>`)

At build time, `scripts/helper.js` compiles all YAMLs into `src/config.json` (via a Vite plugin hook). `src/const.ts` imports this compiled JSON as `PT_SITE`.

### Key Source Directories

- `src/source/info-extractors/` — Per-site/type extractors; `base/` has the base class
- `src/target/target-filler/` — Per-site/type fillers; `base/` has the base class
- `src/config/` — YAML configs for 90+ PT sites
- `src/components/` — Preact UI components (settings panel, site list, image rehost, etc.)
- `src/common/` — Shared utilities: `movie/` (IMDb, Douban, TMDB), `media/` (MediaInfo parsing), `image/` (screenshot upload)
- `src/store/torrentInfoStore.ts` — Central state singleton

### TorrentInfo.Info Shape

The core data structure passed between source and target. Key fields: `title`, `subtitle`, `description`, `category` (movie|tv|tvPack|...), `videoType` (bluray|remux|encode|web-dl|...), `source`, `videoCodec`, `audioCodec`, `resolution`, `area`, `imdbUrl`, `doubanUrl`, `doubanInfo`, `mediaInfos[]`, `screenshots[]`, `tags` (MediaTags with 40+ flags), `torrentData` (base64), `sourceSite`, `sourceSiteType`.

### Adding a New Supported Site

New sites arrive as pull requests that the contributor has tested on the real upload page; new-site issues are no longer accepted. `CONTRIBUTING.md` describes the process for contributors.

To write or fix a site config, follow `scripts/site-config/rules.md`: the workflow, the raw config format produced by the "[EASY-UPLOAD] Retrieve Site Config" button, the output schema and the mapping rules. `yarn site-config --raw <file> --name <Name>` validates the config against the raw config and fetches the icon; `yarn icon <SiteName>` refetches an icon. In short:

1. Create `src/config/<SITENAME>.yaml` with selectors and value maps
2. If the site uses a standard engine (NexusPHP, Unit3D, AVistaZ), existing extractors/fillers may work automatically
3. For custom behavior, create `src/source/info-extractors/<SiteName>.ts` and/or `src/target/target-filler/<SiteName>.ts` extending the base class and registering with the registry
4. The YAML is compiled automatically on next build

### Build System

Vite + `vite-plugin-monkey` bundles everything into a single userscript file (`dist/easy-upload.user.js`). The `@preact/preset-vite` plugin handles JSX. SVGs are imported as React components via `vite-plugin-svgr`. TypeScript path alias `@/*` resolves to `src/*`.
