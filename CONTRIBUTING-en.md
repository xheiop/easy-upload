# Contributing

[中文](CONTRIBUTING.md)

Bug fixes, new features and new site support are all welcome.

## Adding a new site

Issues requesting support for a new site are no longer accepted. New sites come in as pull requests that **you have tested on the site yourself**. An AI coding assistant can write the site config for you (Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI, ...). Here is the process.

### Before you start

- An account on the site with access to its torrent upload page
- Tampermonkey or Violentmonkey with the latest easy-upload installed
- Node.js 20 or later and pnpm (see https://pnpm.io/installation; it switches to the version pinned in `packageManager` in `package.json`)
- A fork and clone of this repository, with `pnpm install` run in it

### 1. Capture the raw config of the upload page

1. Open the site's torrent upload page
2. Click the green `[EASY-UPLOAD]Export page config` button in the bottom right corner. The raw config is copied to your clipboard
3. Save it as `<SiteName>.raw.yaml` in the repository root. Git ignores `*.raw.yaml`, so it cannot be committed by accident

The raw config only records the form's field names, selectors, dropdown options and labels. It contains no passkey, hidden field values or other account data.

> The button only appears on sites that easy-upload cannot transfer to yet, on pages whose path contains `upload` or `/torrents/create`. If the upload page's URL is not covered by `match` in `vite.config.js`, the script does not run there; add a pattern first.

### 2. Let an AI assistant write the site config

Open your AI coding assistant in the repository and ask something like:

```text
Follow scripts/site-config/rules.md to write src/config/<SiteName>.yaml from <SiteName>.raw.yaml. Validate it with pnpm site-config and fix every error.
```

- The repository ships a `site-config` skill in the Agent Skills format at `.agents/skills/site-config/`. Codex, GitHub Copilot, Cursor and Gemini CLI load it on their own, and Claude Code loads it through the `.claude/skills/site-config` symlink. Tools that read `AGENTS.md` find the guide too. Point any other tool at `scripts/site-config/rules.md` first
- The site name becomes the site key shown in the UI and saved in users' settings, so it is hard to change later. Follow the style of the existing names in `src/config/`, such as `HDHome`, `PTer` or `qingwa`
- You can also write the config by hand following `scripts/site-config/rules.md`

### 3. Validate

```bash
pnpm site-config --raw <SiteName>.raw.yaml --name <SiteName>
```

The validator checks that every selector and dropdown value in the config exists in the raw config, fetches the site icon and writes `src/config/<SiteName>.yaml` back. Fix every `✗` error; go through every `!` warning and `# TODO` comment.

### 4. Test on the real site

1. Run `pnpm dev` and install the development build: on macOS and Windows the browser opens its install page, elsewhere open the address printed in the terminal. While testing, disable the released easy-upload in your script manager so the two do not run at once
2. Enable the new site under the transfer sites setting in the easy-upload settings panel
3. Open a torrent detail page on a supported site and transfer it to the new site
4. Check every field on the upload page: title, subtitle, description, IMDb/Douban link, MediaInfo, torrent file, and the category, medium, codec, audio codec, resolution, area, team, anonymous and tag controls
5. Test at least one movie and one TV series. If the site has categories for 4K, Blu-ray discs, remuxes and so on, test those too
6. You do not have to publish anything. When a field is wrong, fix the config; the development build updates by itself, so reload the page and test again. Run step 3 once more at the end

### 5. Open the pull request

1. Commit `src/config/<SiteName>.yaml` and any other change the site really needs (a `match` pattern in `vite.config.js`, a custom filler or extractor). You can run `pnpm support` to update `SUPPORTED.md`
2. Do not commit `dist/easy-upload.user.js`; `pnpm build` rewrites it
3. Use [Conventional Commits](https://www.conventionalcommits.org/) for the commit message, e.g. `feat(config): add <SiteName> site config`
4. Fill in the pull request template: the torrents you tested with, screenshots of the filled upload form, and the raw config so maintainers can check the result

New-site pull requests without a test record will not be merged.

## Other contributions

- Use the issue templates for bug reports and feature requests
- Run `pnpm lint` and `pnpm test --run` before you push
- See [AGENTS.md](AGENTS.md) for the project structure and common commands
