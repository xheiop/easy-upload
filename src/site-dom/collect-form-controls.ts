/**
 * Collects the controls of a tracker's upload page for the
 * "[EASY-UPLOAD] Retrieve Site Config" button. The result is pasted into a
 * "new site" issue and read by scripts/site-config (see rules.md there).
 *
 * Every named control becomes its own entry in `fields`, so controls that
 * share a name (checkbox groups, NexusPHP's two `<select name="type">`, an
 * input named `url`) no longer overwrite each other. Page metadata sits under
 * `page`, apart from the fields.
 */

export const RAW_CONFIG_VERSION = 2;

export interface RawOption {
  text: string;
  value: string;
}

export interface RawField {
  /** The control's `name` attribute. Several fields may share it. */
  name: string;
  /** A CSS selector for this control; unique on the page unless `index` is set. */
  selector: string;
  /** Set only when no unique selector was found: position among the matches of `selector`. */
  index?: number;
  tag: 'input' | 'select' | 'textarea';
  /** `type` of an `<input>`. */
  type?: string;
  id?: string;
  /** `value` attribute of a checkbox or radio button. */
  value?: string;
  label?: string;
  options?: RawOption[];
}

export interface RawSiteConfig {
  version: typeof RAW_CONFIG_VERSION;
  page: { url: string; host: string; uploadPath: string };
  fields: RawField[];
}

/** BBCode toolbar dropdowns that every NexusPHP upload page carries. */
const IGNORED_NAMES = /^(font|color|size)$/i;
const MAX_LABEL_LENGTH = 80;

const quote = (value: string) =>
  `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const idSelector = (id: string) =>
  /^[A-Za-z_][\w-]*$/.test(id) ? `#${id}` : `[id=${quote(id)}]`;

const cleanText = (text: string | null | undefined) => {
  const cleaned = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return undefined;
  return cleaned.length > MAX_LABEL_LENGTH
    ? `${cleaned.slice(0, MAX_LABEL_LENGTH)}…`
    : cleaned;
};

function isCheckable(element: Element): element is HTMLInputElement {
  return (
    element instanceof HTMLInputElement &&
    (element.type === 'checkbox' || element.type === 'radio')
  );
}

/** Label text; for checkboxes and radios also the text right after the box. */
function labelOf(element: HTMLInputElement) {
  const label = cleanText(element.labels?.[0]?.textContent);
  if (label || !isCheckable(element)) return label;
  const next = element.nextSibling;
  return cleanText(next?.textContent);
}

/** Drops undefined keys: YAML 1.x would print them as `null`. */
function compact(field: RawField): RawField {
  return Object.fromEntries(
    Object.entries(field).filter(([, value]) => value !== undefined),
  ) as unknown as RawField;
}

function matchesOnly(root: ParentNode, selector: string, element: Element) {
  try {
    const matches = root.querySelectorAll(selector);
    return matches.length === 1 && matches[0] === element;
  } catch {
    return false;
  }
}

/**
 * The first candidate that matches only `element`: the plain name selector,
 * then `[value]` for checkboxes and radios, the element's id, `[type]`, and
 * finally the name selector scoped to an ancestor with an id.
 */
function selectorFor(
  root: ParentNode,
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  tag: RawField['tag'],
  name: string,
): Pick<RawField, 'selector' | 'index'> {
  const base = `${tag}[name=${quote(name)}]`;
  const candidates = [base];
  const value = element.getAttribute('value');
  if (isCheckable(element) && value !== null) {
    candidates.push(`${base}[value=${quote(value)}]`);
  }
  if (element.id) candidates.push(idSelector(element.id));
  const type = element.getAttribute('type');
  if (tag === 'input' && type) candidates.push(`${base}[type=${quote(type)}]`);
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (node.id) candidates.push(`${idSelector(node.id)} ${base}`);
  }

  const unique = candidates.find((c) => matchesOnly(root, c, element));
  if (unique) return { selector: unique };
  const index = Array.from(root.querySelectorAll(base)).indexOf(element);
  return { selector: base, index: Math.max(index, 0) };
}

export function collectFormControls(
  doc: Document = document,
  location: {
    origin: string;
    host: string;
    pathname: string;
  } = window.location,
): RawSiteConfig {
  const fields: RawField[] = [];

  doc.querySelectorAll('input, select, textarea').forEach((element) => {
    const name = element.getAttribute('name');
    if (!name || IGNORED_NAMES.test(name)) return;

    if (element instanceof HTMLSelectElement) {
      fields.push(
        compact({
          name,
          ...selectorFor(doc, element, 'select', name),
          tag: 'select',
          id: element.id || undefined,
          options: Array.from(element.options).map((opt) => ({
            text: opt.text,
            value: opt.value,
          })),
        }),
      );
    } else if (element instanceof HTMLInputElement) {
      // Only checkbox/radio values are kept: other values (hidden tokens,
      // prefilled text) are page state and may be private.
      const value = isCheckable(element)
        ? (element.getAttribute('value') ?? undefined)
        : undefined;
      fields.push(
        compact({
          name,
          ...selectorFor(doc, element, 'input', name),
          tag: 'input',
          type: element.type,
          id: element.id || undefined,
          value,
          label: labelOf(element),
        }),
      );
    } else if (element instanceof HTMLTextAreaElement) {
      fields.push(
        compact({
          name,
          ...selectorFor(doc, element, 'textarea', name),
          tag: 'textarea',
          id: element.id || undefined,
        }),
      );
    }
  });

  return {
    version: RAW_CONFIG_VERSION,
    page: {
      url: location.origin,
      host: location.host,
      uploadPath: location.pathname,
    },
    fields,
  };
}
