/**
 * The raw config pasted into a "new site" issue comes in two shapes, both
 * produced by the "[EASY-UPLOAD] Retrieve Site Config" button
 * (src/site-dom/collect-form-controls.ts):
 *
 * v2 (current):
 *   version: 2
 *   page: { url, host, uploadPath }
 *   fields: [{ name, selector, tag, type?, id?, value?, label?, options?, index? }, ...]
 *
 * v1 (issues filed before v2): one map keyed by control name plus top-level
 * `url`, `host` and `uploadPath`. Same-name controls overwrote each other and
 * the page `url` overwrote a form field named `url`.
 *
 * normalizeRaw() turns either into { version, page, fields } with the v2 field
 * list, so the rest of the tooling reads one shape.
 */

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

/** Page metadata ({ url, host, uploadPath }) of a raw config in either shape. */
export const rawPage = (raw) => normalizeRaw(raw).page;
