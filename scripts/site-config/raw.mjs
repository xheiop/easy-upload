/**
 * The raw config is what the "[EASY-UPLOAD] Retrieve Site Config" button
 * (src/site-dom/collect-form-controls.ts) copies on a tracker's upload page.
 * It comes in two shapes:
 *
 * v2 (current):
 *   version: 2
 *   page: { url, host, uploadPath }
 *   fields: [{ name, selector, tag, type?, id?, value?, label?, options?, index? }, ...]
 *
 * v1 (older releases, and the old "new site" issues): one map keyed by
 * control name plus top-level `url`, `host` and `uploadPath`. Same-name
 * controls overwrote each other and the page `url` overwrote a form field
 * named `url`.
 *
 * normalizeRaw() turns either into { version, page, fields } with the v2 field
 * list, so the rest of the tooling reads one shape.
 */
import YAML from 'yaml';

export const SITE_TYPES = ['NexusPHP', 'UNIT3D', 'Gazelle', 'Other'];

export class RawConfigError extends Error {}

const str = (value) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

const isMap = (value) =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const isRawV2 = (raw) =>
  isMap(raw) && isMap(raw.page) && Array.isArray(raw.fields);

function tagOf(selector) {
  const match = String(selector)
    .trim()
    .match(/^(input|select|textarea)\b/i);
  return match ? match[1].toLowerCase() : undefined;
}

const pageOf = (source) => ({
  url: str(source.url),
  host: str(source.host),
  uploadPath: str(source.uploadPath),
});

/** { version: 1 | 2, page: { url, host, uploadPath }, fields: [...] } */
export function normalizeRaw(raw) {
  if (!isMap(raw)) return { version: 1, page: pageOf({}), fields: [] };

  if (isRawV2(raw)) {
    const fields = raw.fields
      .filter((field) => isMap(field) && typeof field.selector === 'string')
      .map((field) => ({
        ...field,
        name: str(field.name),
        tag: field.tag ?? tagOf(field.selector),
      }));
    return { version: 2, page: pageOf(raw.page), fields };
  }

  const fields = [];
  for (const [name, value] of Object.entries(raw)) {
    if (isMap(value) && typeof value.selector === 'string') {
      fields.push({ ...value, name, tag: tagOf(value.selector) });
    }
  }
  return { version: 1, page: pageOf(raw), fields };
}

const isFence = (line) => /^\s*```/.test(line);

/**
 * Take the text between the first and last fence lines and drop every fence
 * line in between. Copes with a doubled fence (the button output already
 * contains ```yaml and was pasted inside another fence) and a missing closing
 * fence.
 */
function extractFenced(text) {
  const lines = text.split('\n');
  const fences = lines.flatMap((line, i) => (isFence(line) ? [i] : []));
  const end = fences.length > 1 ? fences[fences.length - 1] : undefined;
  return lines
    .slice(fences[0], end)
    .filter((line) => !isFence(line))
    .join('\n');
}

// Heading of the config section in the old "new site" issue forms.
const CONFIG_HEADING_RE = /^###[ \t]+(site configuration|站点配置)[ \t]*$/im;

/** In an old issue body, the text between the config heading and the next heading. */
function configSection(text) {
  const heading = text.match(CONFIG_HEADING_RE);
  if (!heading) return text;
  const rest = text.slice(heading.index + heading[0].length);
  // Ignore "###" lines inside code fences so a pasted config cannot end the section.
  const masked = rest.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/#/g, ' '),
  );
  const next = masked.search(/^###[ \t]/m);
  return next === -1 ? rest : rest.slice(0, next);
}

/**
 * Parse a saved raw config: the YAML the button copied (with or without its
 * ```yaml fence), or Markdown that contains it, such as an old issue body.
 * Returns { rawYaml, raw, version, page, fields }.
 */
export function parseRawConfig(text) {
  const source = configSection(String(text).replace(/\r\n?/g, '\n'));
  const rawYaml = (
    source.split('\n').some(isFence) ? extractFenced(source) : source
  ).trim();
  if (!rawYaml) throw new RawConfigError('The raw config is empty.');

  let raw;
  try {
    raw = YAML.parse(rawYaml);
  } catch (err) {
    throw new RawConfigError(
      `The raw config is not valid YAML: ${err.message}`,
    );
  }
  if (!isMap(raw))
    throw new RawConfigError('The raw config is not a YAML map.');

  const normalized = normalizeRaw(raw);
  if (!normalized.page.url && !normalized.page.host) {
    throw new RawConfigError(
      'The raw config has no `url`/`host`; it does not look like the output of the "Retrieve Site Config" button.',
    );
  }
  return { rawYaml, raw, ...normalized };
}

/** Host of the upload page, from the `page` of a normalized raw config. */
export function hostOf(page) {
  if (page.host) return page.host;
  try {
    return new URL(page.url).host;
  } catch {
    return '';
  }
}

/** A first guess at the tracker engine from the form's field names. */
export function guessSiteType({ page, fields }) {
  const names = new Set(fields.map((field) => field.name));
  const has = (...candidates) => candidates.some((name) => names.has(name));
  if (has('category_id') && has('type_id')) return 'UNIT3D';
  if (
    has('small_descr', 'uplver') ||
    (has('descr') && /upload\.php$/i.test(page.uploadPath))
  ) {
    return 'NexusPHP';
  }
  if (has('file_input', 'releasetype', 'groupid')) return 'Gazelle';
  return 'Other';
}

const SECOND_LEVEL = new Set(['com', 'net', 'org', 'edu', 'gov']);

/** "www.haidan.cc" -> "haidan", "pt.ying.us.kg" -> "ying", "foo.com.cn" -> "foo" */
export function suggestSiteName(host) {
  const labels = String(host).replace(/:\d+$/, '').split('.').filter(Boolean);
  if (labels.length > 1) labels.pop(); // TLD
  // Skip second-level suffixes such as "us" in us.kg or "com" in com.cn.
  while (
    labels.length > 1 &&
    (labels[labels.length - 1].length <= 2 ||
      SECOND_LEVEL.has(labels[labels.length - 1]))
  ) {
    labels.pop();
  }
  return (labels.pop() || '').replace(/[^A-Za-z0-9._-]/g, '') || 'NewSite';
}
