---
name: site-config
description: Write, validate or fix an easy-upload site config (src/config/<Site>.yaml) from the raw config copied by the "[EASY-UPLOAD] Retrieve Site Config" button. Use when asked to add support for a tracker, generate or adapt a site config (生成站点配置, 适配新站点, 新增站点), or review or fix a site-config pull request.
---

# Site config

Follow `scripts/site-config/rules.md`. It holds the workflow, the raw config format, the output schema and the mapping rules. `CONTRIBUTING.md` holds the contributor's side: testing on the real site and opening the pull request.

This skill follows the Agent Skills format. It lives in `.agents/skills/`, which Codex, GitHub Copilot, Cursor and Gemini CLI read; `.claude/skills/site-config` is a symlink to it for Claude Code. Tools without skill support reach the same guide through `AGENTS.md`. Keep project knowledge in `rules.md`, not here.
