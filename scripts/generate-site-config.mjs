#!/usr/bin/env node
/**
 * Deterministic helpers for adding src/config/<Name>.yaml from the raw config
 * the "[EASY-UPLOAD] Retrieve Site Config" button copies on a tracker's upload
 * page. The mapping itself is written by hand or by an AI assistant following
 * scripts/site-config/rules.md; CONTRIBUTING.md has the whole workflow.
 *
 *   --context  raw config ─► host, format, site type guess, suggested name
 *   (default)  YAML ─► validate against the raw config ─► fetch icon ─► write
 *
 * Run with --help for usage.
 */
import fs from 'fs';
import path from 'path';
import { parseArgs } from 'util';
import YAML from 'yaml';
import {
  parseRawConfig,
  hostOf,
  guessSiteType,
  suggestSiteName,
  RawConfigError,
} from './site-config/raw.mjs';
import {
  CONFIG_DIR,
  loadExistingConfigs,
  collectVocabulary,
  findSameHost,
  validateConfig,
} from './site-config/validate.mjs';
import { fetchIconDataUri, hasIcon, injectIcon } from './site-config/icon.mjs';

const HELP = `Usage: yarn site-config --raw <file> [options]
       (= node scripts/generate-site-config.mjs --raw <file> [options])

Checks a site config against the raw config that the "[EASY-UPLOAD] Retrieve
Site Config" button copies on the site's upload page. Write the config by hand
or with an AI assistant following scripts/site-config/rules.md; CONTRIBUTING.md
has the whole workflow.

Modes:
  --context            Print the host, raw config format, a site type guess, the suggested
                       name, existing configs for the same host, and the raw config
  (default)            Validate src/config/<Name>.yaml against the raw config, fetch the
                       icon if it is empty, and write the file back

Options:
  --raw <file>         The raw config: the YAML the button copied (with or without its
                       \`\`\`yaml fence), or Markdown that contains it. "-" reads stdin.
  --name <Name>        Config file name = site key (default: guessed from the host)
  --from <file>        Validate this file instead; the result goes to src/config/<Name>.yaml
  --dry-run            Print the result instead of writing it
  --force              Ignore an already configured host or an existing file with that name
  --no-icon            Do not fetch the favicon
  -h, --help           Show this help
`;

const log = (...args) => console.error(...args);

/** An expected stop (bad raw config, site already exists...): print the message, no stack. */
class Problem extends Error {}

function parseCli() {
  const { values } = parseArgs({
    options: {
      raw: { type: 'string' },
      name: { type: 'string' },
      from: { type: 'string' },
      context: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      force: { type: 'boolean' },
      'no-icon': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  return values;
}

function printReport({ errors, warnings }) {
  if (!errors.length && !warnings.length) log('✓ Validator found no problems.');
  errors.forEach((e) => log(`✗ ${e}`));
  warnings.forEach((w) => log(`! ${w}`));
}

function loadRaw(file) {
  const text =
    file === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(file, 'utf8');
  try {
    return parseRawConfig(text);
  } catch (err) {
    if (err instanceof RawConfigError) {
      throw new Problem(
        `${err.message} Save the output of the "[EASY-UPLOAD] Retrieve Site Config" button from the site's upload page and pass that file.`,
      );
    }
    throw err;
  }
}

async function run(opts) {
  if (!opts.raw) {
    throw new Problem('Pass the raw config with --raw <file>. See --help.');
  }

  // 1. Raw config
  const parsed = loadRaw(opts.raw);
  const host = hostOf(parsed.page);
  const name = opts.name || suggestSiteName(host);
  if (/[\\/]/.test(name) || name.startsWith('.')) {
    throw new Error(`Invalid site name: ${name}`);
  }
  const relPath = `src/config/${name}.yaml`;
  const outPath = path.join(CONFIG_DIR, `${name}.yaml`);

  const existing = loadExistingConfigs();
  const sameName = (e) => e.name.toLowerCase() === name.toLowerCase();

  log(`Site: ${host} -> ${relPath}`);

  // 2. Context mode
  if (opts.context) {
    const existingFile = existing.find(sameName)?.file;
    const configuredAs = findSameHost(existing, host);
    const header = {
      host,
      uploadPath: parsed.page.uploadPath || undefined,
      rawFormat:
        parsed.version === 2
          ? 'v2'
          : 'v1 (older release, see "Older raw configs" in rules.md)',
      siteTypeGuess: guessSiteType(parsed),
      suggestedName: name,
      output: existingFile
        ? `src/config/${existingFile} (exists)`
        : `${relPath} (new)`,
      alreadyConfiguredAs: configuredAs.length ? configuredAs : undefined,
    };
    process.stdout.write(
      `${YAML.stringify(JSON.parse(JSON.stringify(header)))}\n# Raw config\n${parsed.rawYaml}\n`,
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
      `${relPath} does not exist yet. Write it first (see scripts/site-config/rules.md), pass --from <file>, or run with --context.`,
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
    const siteUrl = result.config.url || parsed.page.url;
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
  } else {
    fs.writeFileSync(outPath, yamlText);
    log(`Wrote ${relPath}`);
  }
  if (result.errors.length) process.exitCode = 1;
}

async function main() {
  let opts;
  try {
    opts = parseCli();
  } catch (err) {
    log(`${err.message}\n\n${HELP}`);
    process.exit(2);
  }
  if (opts.help) {
    process.stdout.write(HELP);
    return;
  }

  try {
    await run(opts);
  } catch (err) {
    log(err instanceof Problem ? err.message : err.stack || err.message);
    process.exit(1);
  }
}

main();
