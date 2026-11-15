---
name: site-config
description: Write, validate or fix an easy-upload site config (src/config/<Site>.yaml) from a "new site" / "新站点" GitHub issue, then open a draft PR. Use when the user gives a new-site issue number, asks to add support for a tracker from an issue (生成站点配置, 适配新站点, 处理 issue #N), or asks to review or fix a site-config PR.
---

# Site config from a new-site issue

You write the mapping; `scripts/generate-site-config.mjs` does the deterministic parts (parsing the issue, validating map values and selectors against the raw config, fetching the icon, opening the PR). Read `scripts/site-config/rules.md` first: the schema, semantic keys, raw-config gaps and the intersection logic for combined categories are all there.

## Steps

1. **Context.** `node scripts/generate-site-config.mjs <issue> --context` prints the site type, host, suggested name, output path, reporter notes and the raw config.
   - If `alreadyConfiguredAs` is set, stop and tell the user that the site exists already.
   - Choose the name. It becomes the site key shown in the UI and stored in users' `targetSitesEnabled` setting, so it is painful to rename later. Prefer the site's own ASCII branding in the style of the existing names in `src/config/` (`HDHome`, `PTer`, `qingwa`). Confirm it with the user.
2. **References.** Read the reference configs listed in rules.md plus two or three existing configs of the same engine whose form uses the same field names (`grep -l 'name="medium_sel"' src/config/*.yaml` and similar).
3. **Check unusual fields in the filler.** When the form has a field you have not seen in other configs, check how `src/target/target-filler/base/base-filler.ts` (or the engine's filler) uses the matching key before mapping it. Example: `douban` receives the Douban URL, and `screenshots` only strips images from the description without filling any field.
4. **Write** `src/config/<Name>.yaml` following rules.md. Leave `icon: ''`. Mark everything a reviewer must check on the real site with `# TODO:`.
5. **Validate.** `node scripts/generate-site-config.mjs <issue> --name <Name>` validates the file, fetches the icon and rewrites the file in place. Fix every `✗` error and re-run until there are none. Then go through the `!` warnings and TODOs with the user.
6. **PR (ask first).** Add `--pr` to the step 5 command. It commits the file to `feat/new-site-<name>` through the GitHub API and opens a draft PR with `Closes #<issue>`, without touching the local branch. Share the PR link.

`yarn icon <Name>` refetches just the icon of an existing config, leaving the rest of the file untouched.

## Fixing a site-config PR

`gh pr checkout <pr>`, edit the YAML, re-run step 5 without `--pr`, then commit and push to the PR branch.

## Gotchas

- Check `rawFormat` in the `--context` output. A v2 raw config lists every control, including NexusPHP's IMDb input (`input[name="url"]`), each tag checkbox and both category selects of multi-section sites. Older v1 raw configs lose all three; rules.md ("Older raw configs") explains how to handle them, and the validator accepts the `input[name="url"]` IMDb guess for v1 only.
- Validator errors are deterministic facts: a value that is not an option, or a selector for a field that is not on the form. Fix them. Warnings, such as unknown keys or a missing field, need judgment.
- `yarn build` rewrites the tracked `dist/easy-upload.user.js`; restore it (`git checkout -- dist/easy-upload.user.js`) instead of committing it with a config.
- If rules.md turns out wrong or incomplete while you work on an issue, propose an edit to it.
