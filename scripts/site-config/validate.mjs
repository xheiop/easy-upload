import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import { normalizeRaw } from './raw.mjs';

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

/** Split `selector` where `isSeparator` holds, outside brackets, quotes and parentheses. */
function splitTopLevel(selector, isSeparator) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '[' || c === '(') depth++;
    else if (c === ']' || c === ')') depth--;
    else if (depth === 0 && isSeparator(c)) {
      parts.push(selector.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(selector.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

const ATTRIBUTE_RE =
  /^\s*([\w-]+)\s*(?:([~|^$*]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"']+))\s*[is]?)?\s*$/i;

/**
 * The constraints of one compound selector (`select#browsecat`,
 * `input[name="tags[4][]"][value="5"]`) that the raw config can check:
 * { tag, id, name, value, type }. Classes and pseudo-classes are ignored.
 */
function parseCompound(compound) {
  const result = {};
  const tag = compound.match(/^[a-z][\w-]*/i);
  let i = tag ? tag[0].length : 0;
  if (tag) result.tag = tag[0].toLowerCase();
  while (i < compound.length) {
    const c = compound[i];
    if (c === '#' || c === '.') {
      const ident = compound.slice(i + 1).match(/^(?:\\.|[\w-])+/)?.[0] ?? '';
      if (c === '#') result.id = ident.replace(/\\(.)/g, '$1');
      i += 1 + ident.length;
    } else if (c === '[') {
      let j = i + 1;
      for (let quote = null; j < compound.length; j++) {
        const d = compound[j];
        if (quote) {
          if (d === '\\') j++;
          else if (d === quote) quote = null;
        } else if (d === '"' || d === "'") quote = d;
        else if (d === ']') break;
      }
      const match = compound.slice(i + 1, j).match(ATTRIBUTE_RE);
      if (match && match[2] === '=') {
        const attr = match[1].toLowerCase();
        const value = (match[3] ?? match[4] ?? match[5]).replace(
          /\\(.)/g,
          '$1',
        );
        if (['id', 'name', 'value', 'type'].includes(attr))
          result[attr] = value;
      }
      i = j + 1;
    } else if (c === ':') {
      i++;
      while (/[\w:-]/.test(compound[i] ?? '')) i++;
      if (compound[i] === '(') {
        for (let depth = 0; i < compound.length; i++) {
          if (compound[i] === '(') depth++;
          else if (compound[i] === ')' && --depth === 0) break;
        }
        i++;
      }
    } else {
      i++;
    }
  }
  return result;
}

/**
 * The raw fields a single compound selector matches, or null when the raw
 * config cannot tell (no name, and no id/value a v2 raw config records).
 */
function matchCompound(fields, compound, version) {
  const { tag, id, name, value, type } = parseCompound(compound);
  const v2 = version === 2;
  if (name === undefined && !(v2 && (id !== undefined || value !== undefined)))
    return null;
  return fields.filter((field) => {
    if (tag && field.tag && tag !== field.tag) return false;
    if (name !== undefined && field.name !== name) return false;
    // v1 raw configs record no ids; v2 records every id there is.
    if (v2 && id !== undefined && field.id !== id) return false;
    // v2 records the value of every checkbox and radio button.
    if (
      value !== undefined &&
      (v2 || field.value !== undefined) &&
      String(field.value) !== value
    )
      return false;
    if (
      type !== undefined &&
      field.type !== undefined &&
      String(field.type).toLowerCase() !== type.toLowerCase()
    )
      return false;
    return true;
  });
}

/**
 * Raw fields matched by `selector`: { matches, ambiguous, name }, or null when
 * the selector cannot be checked (id/class selectors on a v1 raw config).
 * `ambiguous` is set when a single plain selector matches several controls;
 * a selector list (`a, b`) or descendant selector may match several on purpose.
 */
function findFields({ fields, version }, selector) {
  const trimmed = selector.trim();
  const exact = fields.filter((field) => field.selector.trim() === trimmed);
  if (exact.length) {
    return { matches: exact, ambiguous: exact.length > 1, name: exact[0].name };
  }
  const alternatives = splitTopLevel(trimmed, (c) => c === ',');
  const matches = [];
  let unverifiable = false;
  let scoped = false;
  let name;
  for (const alternative of alternatives) {
    const compounds = splitTopLevel(alternative, (c) => /[\s>+~]/.test(c));
    const last = compounds[compounds.length - 1] ?? '';
    if (compounds.length > 1) scoped = true;
    name ??= parseCompound(last).name;
    const found = matchCompound(fields, last, version);
    if (!found) unverifiable = true;
    else
      found.forEach((field) => matches.includes(field) || matches.push(field));
  }
  if (!matches.length && unverifiable) return null;
  return {
    matches,
    ambiguous: alternatives.length === 1 && !scoped && matches.length > 1,
    name,
  };
}

/** Values of a group of same-name controls, or their selectors when they have none. */
function describeGroup(group) {
  const values = group.map((f) => f.value).filter((v) => v !== undefined);
  return values.length === group.length
    ? `have the values ${values.map((v) => `"${v}"`).join(', ')}`
    : `are ${group.map((f) => f.selector).join(', ')}`;
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
  const rawHost = normalizeRaw(raw).page.host;
  if (
    rawHost &&
    config.host &&
    normalizeHost(rawHost) !== normalizeHost(config.host)
  ) {
    warnings.push(
      `\`host\` (${config.host}) differs from the raw config (${rawHost}).`,
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

  const rawConfig = normalizeRaw(raw);
  const { fields, version } = rawConfig;
  const hasRaw = fields.length > 0;

  /**
   * Resolve a selector to its raw field; reports selectors that point at
   * nothing, or at several controls when one is meant.
   * `single`: the filler ticks every match (tags), so several is an error.
   */
  const resolve = (
    label,
    selector,
    { allowImdbUrl = false, single = false } = {},
  ) => {
    if (typeof selector !== 'string' || !selector) {
      errors.push(`\`${label}.selector\` must be a non-empty string.`);
      return null;
    }
    if (!hasRaw) return null;
    const found = findFields(rawConfig, selector);
    if (!found) return null; // id/class selectors on a v1 raw config cannot be checked
    const { matches, ambiguous, name } = found;

    if (!matches.length) {
      // v1 raw configs lose the NexusPHP IMDb input, see rules.md
      if (allowImdbUrl && version === 1 && name === 'url') return null;
      const group = name ? fields.filter((f) => f.name === name) : [];
      if (group.length) {
        errors.push(
          `\`${label}.selector\` (${selector}) matches no control in the raw config; the controls named "${name}" ${describeGroup(group)}.`,
        );
      } else if (name) {
        errors.push(
          `\`${label}.selector\` (${selector}) refers to a form field named "${name}" that is not in the raw config.`,
        );
      } else {
        errors.push(
          `\`${label}.selector\` (${selector}) matches no control in the raw config.`,
        );
      }
      return null;
    }

    if (ambiguous) {
      const list = matches.map((f) => f.selector).join(', ');
      if (single) {
        errors.push(
          `\`${label}.selector\` (${selector}) matches ${matches.length} controls in the raw config (${list}), and the filler ticks all of them. Use the selector of the one you mean.`,
        );
      } else {
        warnings.push(
          `\`${label}.selector\` (${selector}) matches ${matches.length} controls in the raw config (${list}), and the filler sets all of them. Use the selector of the one you mean.`,
        );
      }
    }
    if (matches.length === 1) return matches[0];
    // The filler sets every match, so an option of any of them is a valid value.
    const options = matches.flatMap((f) => f.options || []);
    return { ...matches[0], options: options.length ? options : undefined };
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
        resolve(`tags.${tag}`, selector, { single: true });
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
