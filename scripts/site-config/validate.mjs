import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CONFIG_DIR = path.resolve(__dirname, '../../src/config');

const SELECTOR_FIELDS = [
  'name',
  'subtitle',
  'description',
  'imdb',
  'douban',
  'tmdb',
  'mediaInfo',
  'anonymous',
  'torrent',
];
const RECOMMENDED_FIELDS = ['name', 'description', 'torrent', 'category'];
const MAP_FIELDS = [
  'category',
  'videoCodec',
  'audioCodec',
  'videoType',
  'resolution',
  'source',
  'area',
  'team',
];
// Fields whose map keys must come from easy-upload's fixed vocabulary.
const VOCAB_FIELDS = MAP_FIELDS.filter((f) => f !== 'team');
const PLACEHOLDER_RE = /^(|-+|请选择.*|choose.*|select.*|please select.*)$/i;

export const normalizeHost = (host) =>
  String(host || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');

/** Load every existing site config once: [{ name, file, data }]. */
export function loadExistingConfigs(dir = CONFIG_DIR) {
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.yaml'))
    .map((file) => {
      let data = null;
      try {
        data = YAML.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      } catch {
        // A broken existing config is not this tool's problem.
      }
      return { name: file.slice(0, -'.yaml'.length), file, data };
    });
}

/** Keys used anywhere in the existing configs, per field: the de-facto vocabulary. */
export function collectVocabulary(existing) {
  const vocab = { top: new Set(), tags: new Set() };
  for (const field of VOCAB_FIELDS) vocab[field] = new Set();
  for (const { data } of existing) {
    if (!data || typeof data !== 'object') continue;
    Object.keys(data).forEach((key) => vocab.top.add(key));
    Object.keys(data.tags || {}).forEach((key) => vocab.tags.add(key));
    for (const field of VOCAB_FIELDS) {
      Object.keys(data[field]?.map || {}).forEach((key) =>
        vocab[field].add(key),
      );
    }
  }
  return vocab;
}

/** Existing configs that already point at the same host. */
export function findSameHost(existing, host) {
  const target = normalizeHost(host);
  if (!target) return [];
  return existing
    .filter(({ data }) => {
      if (!data) return false;
      return [data.host, data.url].some((h) => normalizeHost(h) === target);
    })
    .map(({ name }) => name);
}

/** `select[name="type"]` -> "type"; null when the selector has no exact name match. */
function selectorFieldName(selector) {
  const match = String(selector).match(
    /\[name\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\]\s"']+))\s*\]/,
  );
  return match ? (match[1] ?? match[2] ?? match[3]) : null;
}

function rawFields(raw) {
  const fields = {};
  for (const [key, value] of Object.entries(raw || {})) {
    if (
      value &&
      typeof value === 'object' &&
      typeof value.selector === 'string'
    ) {
      fields[key] = value;
    }
  }
  return fields;
}

/**
 * Validate a generated config against the issue's raw config.
 * errors   = almost certainly wrong (fed back to the model for one repair round)
 * warnings = needs a human look
 */
export function validateConfig(yamlText, { raw = {}, vocab } = {}) {
  const errors = [];
  const warnings = [];
  const result = { errors, warnings, config: null, todos: 0 };

  const doc = YAML.parseDocument(yamlText);
  if (doc.errors.length) {
    errors.push(`YAML does not parse: ${doc.errors[0].message}`);
    return result;
  }
  const config = doc.toJSON();
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    errors.push('The YAML document must be a map.');
    return result;
  }
  result.config = config;
  result.todos = (yamlText.match(/#\s*TODO/gi) || []).length;

  for (const key of ['url', 'host', 'siteType']) {
    if (typeof config[key] !== 'string' || !config[key]) {
      errors.push(`Missing required top-level field \`${key}\`.`);
    }
  }
  if (config.asTarget !== true) warnings.push('`asTarget` is not `true`.');
  if (!config.uploadPath) warnings.push('`uploadPath` is missing.');
  if (
    raw.host &&
    config.host &&
    normalizeHost(raw.host) !== normalizeHost(config.host)
  ) {
    warnings.push(
      `\`host\` (${config.host}) differs from the raw config (${raw.host}).`,
    );
  }
  if (vocab) {
    const unknown = Object.keys(config).filter((key) => !vocab.top.has(key));
    if (unknown.length) {
      warnings.push(
        `Top-level keys no existing config uses: ${unknown.join(', ')}.`,
      );
    }
  }

  const fields = rawFields(raw);
  const hasRaw = Object.keys(fields).length > 0;

  /** Resolve a selector to its raw field; reports selectors that point at nothing. */
  const resolve = (label, selector, { allowImdbUrl = false } = {}) => {
    if (typeof selector !== 'string' || !selector) {
      errors.push(`\`${label}.selector\` must be a non-empty string.`);
      return null;
    }
    const name = selectorFieldName(selector);
    if (!name || !hasRaw) return null; // id/class selectors cannot be checked
    if (fields[name]) return fields[name];
    if (allowImdbUrl && name === 'url') return null; // raw config loses this field, see rules.md
    errors.push(
      `\`${label}.selector\` (${selector}) refers to a form field named "${name}" that is not in the raw config.`,
    );
    return null;
  };

  for (const key of RECOMMENDED_FIELDS) {
    if (!config[key])
      warnings.push(`\`${key}\` is missing, so it cannot be filled.`);
  }
  for (const key of SELECTOR_FIELDS) {
    if (config[key] === undefined) continue;
    if (!config[key] || typeof config[key] !== 'object') {
      errors.push(`\`${key}\` must be a map with a \`selector\`.`);
      continue;
    }
    resolve(key, config[key].selector, { allowImdbUrl: key === 'imdb' });
  }

  if (config.tags !== undefined) {
    if (!config.tags || typeof config.tags !== 'object') {
      errors.push('`tags` must be a map of tag key to selector.');
    } else {
      for (const [tag, selector] of Object.entries(config.tags)) {
        resolve(`tags.${tag}`, selector);
        if (vocab && !vocab.tags.has(tag)) {
          warnings.push(
            `\`tags.${tag}\` is not a tag key used by any existing config.`,
          );
        }
      }
    }
  }

  const optionValues = (field) =>
    field?.options ? new Set(field.options.map((o) => String(o.value))) : null;
  const placeholderValues = (field) =>
    new Set(
      (field?.options || [])
        .filter((o) => PLACEHOLDER_RE.test(String(o.text ?? '').trim()))
        .map((o) => String(o.value)),
    );

  const categoryField = config.category?.selector
    ? resolve('category', config.category.selector)
    : null;
  const categoryOptions = optionValues(categoryField);

  for (const key of MAP_FIELDS) {
    const entry = config[key];
    if (entry === undefined) continue;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`\`${key}\` must be a map with \`selector\` and/or \`map\`.`);
      continue;
    }
    if (
      entry.map !== undefined &&
      (typeof entry.map !== 'object' || Array.isArray(entry.map))
    ) {
      errors.push(`\`${key}.map\` must be a map.`);
      continue;
    }
    const ownField =
      key === 'category'
        ? categoryField
        : entry.selector !== undefined
          ? resolve(key, entry.selector)
          : null;
    const ownOptions = optionValues(ownField);
    const placeholders = new Set([
      ...placeholderValues(ownField),
      ...placeholderValues(categoryField),
    ]);
    const allowed = new Set([
      ...(ownOptions || []),
      ...(key === 'category' ? [] : categoryOptions || []),
    ]);

    for (const [semKey, value] of Object.entries(entry.map || {})) {
      const label = `${key}.map.${semKey}`;
      if (vocab && vocab[key] && !vocab[key].has(semKey)) {
        warnings.push(
          `\`${label}\`: "${semKey}" is not a key any existing config uses, so the filler will probably never look it up.`,
        );
      }
      const values = Array.isArray(value) ? value : [value];
      values.forEach((v, i) => {
        if (typeof v !== 'string') {
          warnings.push(
            `\`${label}\`: value ${JSON.stringify(v)} should be a quoted string.`,
          );
        }
        const str = String(v);
        if (str === '') return; // '' deliberately leaves the dropdown alone
        if (placeholders.has(str)) {
          errors.push(
            `\`${label}\`: "${str}" is a placeholder option, not a real choice.`,
          );
          return;
        }
        if (
          key !== 'category' &&
          ownOptions &&
          Array.isArray(value) &&
          i === 0 &&
          !ownOptions.has(str)
        ) {
          errors.push(
            `\`${label}\`: the first element must be an option of ${entry.selector}, got "${str}".`,
          );
          return;
        }
        if (allowed.size && !allowed.has(str)) {
          errors.push(
            `\`${label}\`: "${str}" is not an option value of ${key === 'category' || !ownOptions ? 'the category dropdown' : `${entry.selector} or the category dropdown`}.`,
          );
        }
      });
    }
  }

  if (result.todos)
    warnings.push(`${result.todos} TODO comment(s) left for review.`);
  return result;
}
