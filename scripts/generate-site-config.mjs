#!/usr/bin/env node
/**
 * Deterministic helpers for turning a "new site" GitHub issue into
 * src/config/<Name>.yaml. The mapping itself is written by hand or by Claude
 * Code (see .claude/skills/site-config and scripts/site-config/rules.md):
 *
 *   --context  issue ─► parsed raw config, site type, suggested name
 *   (default)  YAML ─► validate against the raw config ─► fetch icon ─► write
 *   --pr       ... ─► commit to feat/new-site-<name> ─► draft PR
 *
 * Run with --help for usage.
 */
import fs from 'fs';
import path from 'path';
import { parseArgs } from 'util';
import YAML from 'yaml';
import {
  parseIssue,
  suggestSiteName,
  hostOf,
  IssueFormatError,
} from './site-config/issue.mjs';
import {
  CONFIG_DIR,
  loadExistingConfigs,
  collectVocabulary,
  findSameHost,
  validateConfig,
} from './site-config/validate.mjs';
import { fetchIconDataUri, hasIcon, injectIcon } from './site-config/icon.mjs';
import {
  resolveRepo,
  fetchIssue,
  upsertDraftPR,
} from './site-config/github.mjs';

const HELP = `Usage: node scripts/generate-site-config.mjs <issue-number> [options]

Helpers for turning a "new site" issue into src/config/<Name>.yaml. Write the
mapping by hand or with Claude Code (.claude/skills/site-config), following
scripts/site-config/rules.md; this script does the deterministic parts.

Modes:
  --context            Print the parsed issue (site type, suggested name, notes, raw config)
  (default)            Validate src/config/<Name>.yaml against the issue's raw config,
                       fetch the icon if it is empty, and write the file back

Options:
  --name <Name>        Config file name = site key (default: guessed from the issue title)
  --from <file>        Validate this file instead; the result goes to src/config/<Name>.yaml
  --dry-run            Print the result instead of writing it
  --force              Ignore an already configured host or an existing file with that name
  --no-icon            Do not fetch the favicon
  --pr                 Then commit the file to feat/new-site-<name> and open a draft PR
  --repo <owner/name>  GitHub repository (default: the current gh repo)
  --body-file <file>   Read the issue body from a file instead of GitHub (title via --title)
  --title <text>       Issue title to use with --body-file
  -h, --help           Show this help

Reading issues and opening PRs needs gh to be logged in.
`;

const log = (...args) => console.error(...args);

/** An expected stop (bad issue, site already exists...): print the message, no stack. */
class Problem extends Error {}

function parseCli() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      name: { type: 'string' },
      from: { type: 'string' },
      context: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      force: { type: 'boolean' },
      'no-icon': { type: 'boolean' },
      pr: { type: 'boolean' },
      repo: { type: 'string' },
      'body-file': { type: 'string' },
      title: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const issueNumber = positionals[0];
  if (issueNumber && !/^\d+$/.test(issueNumber)) {
    throw new Error(`Invalid issue number: ${issueNumber}`);
  }
  return { opts: values, issueNumber };
}

function validationMarkdown({ errors, warnings }) {
  if (!errors.length && !warnings.length) {
    return '✅ The validator found no problems.';
  }
  return [
    ...errors.map((e) => `- ❌ ${e}`),
    ...warnings.map((w) => `- ⚠️ ${w}`),
  ].join('\n');
}

function printReport({ errors, warnings }) {
  if (!errors.length && !warnings.length) log('✓ Validator found no problems.');
  errors.forEach((e) => log(`✗ ${e}`));
  warnings.forEach((w) => log(`! ${w}`));
}

function prBody({ name, host, issue, result }) {
  return [
    `## New site: ${name} (${host})`,
    '',
    `Config for #${issue.number}, validated by \`scripts/generate-site-config.mjs\` against the raw config in the issue.`,
    '',
    '### Validator',
    validationMarkdown(result),
    '',
    '### Review checklist',
    '- [ ] Every ❌ above is fixed and every `# TODO` comment is resolved',
    '- [ ] `category` / `videoType` / `resolution` maps select the right options (watch combined categories)',
    '- [ ] `videoCodec` / `audioCodec` / `source` maps are correct',
    '- [ ] Selectors point at the right fields (`imdb`, `anonymous`, `tags` in particular)',
    '- [ ] `icon` is filled in',
    '- [ ] Tested by filling the upload form on the real site',
    '',
    `Re-validate after editing: \`node scripts/generate-site-config.mjs ${issue.number} --name ${name}\``,
    '',
    `Closes #${issue.number}`,
  ].join('\n');
}

function branchFor(name, host) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const fallback = host.replace(/[^a-z0-9.-]+/gi, '-').toLowerCase();
  return `feat/new-site-${slug || fallback}`;
}

function loadIssue(opts, issueNumber, getRepo) {
  if (opts['body-file']) {
    return {
      number: issueNumber ? Number(issueNumber) : undefined,
      title: opts.title || '',
      body: fs.readFileSync(opts['body-file'], 'utf8'),
      url: '',
    };
  }
  return fetchIssue(getRepo(), issueNumber);
}

async function run({ opts, issueNumber, getRepo }) {
  if (!issueNumber && !opts['body-file']) {
    throw new Error('Pass an issue number (or --body-file). See --help.');
  }
  if (opts.pr && !issueNumber) throw new Error('--pr needs an issue number.');
  if (opts.pr && opts['dry-run']) {
    throw new Error('--pr and --dry-run cannot be combined.');
  }

  // 1. Issue
  const issue = loadIssue(opts, issueNumber, getRepo);
  let parsed;
  try {
    parsed = parseIssue(issue);
  } catch (err) {
    if (err instanceof IssueFormatError) {
      throw new Problem(
        `${err.message} Ask the reporter to paste the output of the "[EASY-UPLOAD] Retrieve Site Config" button.`,
      );
    }
    throw err;
  }
  const host = hostOf(parsed.raw);
  const name = opts.name || suggestSiteName(issue.title, parsed.raw);
  if (/[\\/]/.test(name) || name.startsWith('.')) {
    throw new Error(`Invalid site name: ${name}`);
  }
  const relPath = `src/config/${name}.yaml`;
  const outPath = path.join(CONFIG_DIR, `${name}.yaml`);

  const existing = loadExistingConfigs();
  const sameName = (e) => e.name.toLowerCase() === name.toLowerCase();

  log(`Issue ${issue.number ? `#${issue.number} ` : ''}${issue.title}`);
  log(`Site: ${host} (${parsed.siteType}) -> ${relPath}`);

  // 2. Context mode
  if (opts.context) {
    const existingFile = existing.find(sameName)?.file;
    const configuredAs = findSameHost(existing, host);
    const header = {
      issue: issue.number ? `#${issue.number} ${issue.title}` : issue.title,
      issueUrl: issue.url || undefined,
      siteType: parsed.siteType,
      host,
      suggestedName: name,
      output: existingFile
        ? `src/config/${existingFile} (exists)`
        : `${relPath} (new)`,
      alreadyConfiguredAs: configuredAs.length ? configuredAs : undefined,
      notes: parsed.notes || undefined,
    };
    process.stdout.write(
      `${YAML.stringify(JSON.parse(JSON.stringify(header)))}\n# Raw config from the issue\n${parsed.rawYaml}\n`,
    );
    return;
  }

  // 3. Refuse to duplicate an existing site. The file being validated does not
  // count when it lives in src/config (real on-disk name: macOS is case-insensitive).
  const inputPath = opts.from
    ? fs.realpathSync.native(opts.from)
    : fs.existsSync(outPath) && fs.realpathSync.native(outPath);
  const inputName =
    inputPath && path.dirname(inputPath) === fs.realpathSync.native(CONFIG_DIR)
      ? path.basename(inputPath, '.yaml')
      : null;
  const others = existing.filter((e) => e.name !== inputName);
  const clash = others.find(sameName);
  const sameHost = findSameHost(others, host);
  if (!inputPath) {
    throw new Problem(
      `${relPath} does not exist yet. Write it first (see .claude/skills/site-config), pass --from <file>, or run with --context.`,
    );
  }
  if (sameHost.length && !opts.force) {
    const where = sameHost.map((n) => `src/config/${n}.yaml`).join(', ');
    throw new Problem(
      `${host} is already configured in ${where}. Use --force to continue anyway.`,
    );
  }
  if (clash && !opts.force && !opts['dry-run']) {
    throw new Problem(
      `src/config/${clash.file} already exists. Pick another --name or pass --force.`,
    );
  }

  // 4. Validate
  let yamlText = fs.readFileSync(inputPath, 'utf8');
  const vocab = collectVocabulary(existing);
  const result = validateConfig(yamlText, { raw: parsed.raw, vocab });

  // 5. Icon
  if (!opts['no-icon'] && result.config && !hasIcon(result.config)) {
    const siteUrl = result.config.url || parsed.raw.url;
    try {
      yamlText = injectIcon(yamlText, await fetchIconDataUri(siteUrl));
      log('Icon fetched.');
    } catch (err) {
      result.warnings.push(
        `Could not fetch the favicon from ${siteUrl} (${err.message}); retry later with \`yarn icon ${name}\`.`,
      );
    }
  }

  printReport(result);

  // 6. Output
  if (opts['dry-run']) {
    process.stdout.write(yamlText);
    return;
  }
  fs.writeFileSync(outPath, yamlText);
  log(`Wrote ${relPath}`);

  // 7. Draft PR
  if (!opts.pr) return;
  if (!result.config) {
    throw new Problem('The YAML does not parse, so no PR was opened.');
  }
  const pr = upsertDraftPR({
    repo: getRepo(),
    branch: branchFor(name, host),
    filePath: relPath,
    content: yamlText,
    commitMessage: `feat(config): add ${name} site config\n\nCloses #${issue.number}.`,
    title: `feat(config): add ${name} (${host}) site config`,
    body: prBody({ name, host, issue, result }),
    log,
  });
  log(`${pr.created ? 'Opened' : 'Updated'} draft PR: ${pr.url}`);
}

async function main() {
  let cli;
  try {
    cli = parseCli();
  } catch (err) {
    log(`${err.message}\n\n${HELP}`);
    process.exit(2);
  }
  if (cli.opts.help) {
    process.stdout.write(HELP);
    return;
  }

  let repo;
  const getRepo = () => (repo ??= resolveRepo(cli.opts.repo));
  try {
    await run({ ...cli, getRepo });
  } catch (err) {
    log(err instanceof Problem ? err.message : err.stack || err.message);
    process.exit(1);
  }
}

main();
