import YAML from 'yaml';
import { normalizeRaw, rawPage } from './raw.mjs';

export const SITE_TYPES = ['NexusPHP', 'UNIT3D', 'Gazelle', 'Other'];

// Headings rendered by .github/ISSUE_TEMPLATE/new-site-support-request{,-cn}.yml
const SECTION_ALIASES = {
  siteType: ['site based on', '站点架构'],
  config: ['site configuration', '站点配置'],
  notes: ['anything else?', '其他'],
};

export class IssueFormatError extends Error {}

const isFence = (line) => /^\s*```/.test(line);

/**
 * Take the text between the first and last fence lines and drop every fence
 * line in between. Copes with the common doubled fence (the button output
 * already contains ```yaml and gets pasted inside the template's own fence),
 * a missing closing fence, or no fence at all.
 */
function extractFenced(text) {
  const lines = text.split('\n');
  const fences = lines.flatMap((line, i) => (isFence(line) ? [i] : []));
  const end = fences.length > 1 ? fences[fences.length - 1] : undefined;
  const slice = fences.length ? lines.slice(fences[0], end) : lines;
  return slice
    .filter((line) => !isFence(line))
    .join('\n')
    .trim();
}

/** Split a GitHub issue-form body into `{ lowercased heading: content }`. */
function splitSections(body) {
  const sections = {};
  // Ignore "###" lines inside code fences so a pasted config cannot break parsing.
  const masked = body.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/#/g, ' '),
  );
  const headings = [...masked.matchAll(/^###[ \t]+(.+?)[ \t]*$/gm)];
  headings.forEach((match, i) => {
    const start = match.index + match[0].length;
    const end = i + 1 < headings.length ? headings[i + 1].index : body.length;
    sections[match[1].trim().toLowerCase()] = body.slice(start, end).trim();
  });
  return sections;
}

function pickSection(sections, aliases) {
  for (const alias of aliases) {
    if (sections[alias] !== undefined) return sections[alias];
  }
  return undefined;
}

function cleanNotes(text) {
  if (!text) return '';
  const trimmed = text.trim();
  return trimmed === '_No response_' ? '' : trimmed;
}

/**
 * Parse a "new site" issue into the pieces the generator needs.
 * Throws IssueFormatError when no usable raw config can be found.
 */
export function parseIssue({ title = '', body = '' }) {
  const text = String(body).replace(/\r\n?/g, '\n');
  const sections = splitSections(text);

  const typeSection = pickSection(sections, SECTION_ALIASES.siteType) || '';
  const siteType =
    SITE_TYPES.find((t) => t.toLowerCase() === typeSection.toLowerCase()) ||
    SITE_TYPES.find((t) => new RegExp(`\\b${t}\\b`, 'i').test(typeSection)) ||
    'Other';

  const configSection = pickSection(sections, SECTION_ALIASES.config);
  const rawYaml =
    (configSection && extractFenced(configSection)) ||
    (text.split('\n').some(isFence) ? extractFenced(text) : '');
  if (!rawYaml) {
    throw new IssueFormatError(
      'Could not find the site configuration in the issue body.',
    );
  }

  let raw;
  try {
    raw = YAML.parse(rawYaml);
  } catch (err) {
    throw new IssueFormatError(
      `The site configuration is not valid YAML: ${err.message}`,
    );
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new IssueFormatError('The site configuration is not a YAML map.');
  }
  const { version, page } = normalizeRaw(raw);
  if (!page.url && !page.host) {
    throw new IssueFormatError(
      'The site configuration has no `url`/`host`; it does not look like the output of the "Retrieve Site Config" button.',
    );
  }

  return {
    title: String(title),
    siteType,
    rawYaml,
    raw,
    rawVersion: version,
    notes: cleanNotes(pickSection(sections, SECTION_ALIASES.notes)),
  };
}

/** Host of the uploaded page, from a raw config in either shape. */
function hostOf(raw) {
  const page = rawPage(raw);
  if (page.host) return page.host;
  try {
    return new URL(page.url).host;
  } catch {
    return '';
  }
}

const SECOND_LEVEL = new Set(['com', 'net', 'org', 'edu', 'gov']);

/** "www.haidan.cc" -> "haidan", "pt.ying.us.kg" -> "ying", "foo.com.cn" -> "foo" */
function nameFromHost(host) {
  const labels = host.replace(/:\d+$/, '').split('.').filter(Boolean);
  if (labels.length > 1) labels.pop(); // TLD
  // Skip second-level suffixes such as "us" in us.kg or "com" in com.cn.
  while (
    labels.length > 1 &&
    (labels[labels.length - 1].length <= 2 ||
      SECOND_LEVEL.has(labels[labels.length - 1]))
  ) {
    labels.pop();
  }
  return labels.pop() || '';
}

const sanitize = (name) => name.replace(/[^A-Za-z0-9._-]/g, '');

/**
 * Suggest a config file name (= the site key users see) from the issue title,
 * falling back to the host. Always review it: `--name` overrides.
 */
export function suggestSiteName(title, raw) {
  const host = hostOf(raw);
  const cleaned = String(title)
    .replace(/^\s*(\[[^\]]*\]|【[^】]*】)\s*/, '')
    .trim();
  const runs = cleaned.match(/[A-Za-z0-9][A-Za-z0-9 ._-]*[A-Za-z0-9]/g) || [];
  const longest = runs
    .map((run) => run.replace(/\s+/g, ''))
    .sort((a, b) => b.length - a.length)[0];

  if (longest && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(longest)) {
    return sanitize(nameFromHost(longest));
  }
  if (longest && longest.length >= 3) return sanitize(longest);
  return sanitize(nameFromHost(host)) || 'NewSite';
}

export { hostOf };
