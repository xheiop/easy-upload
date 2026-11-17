import { Buffer } from 'buffer/index';
import { GMFetch } from './utils';

/*
 * Rip logs (EAC, XLD, ...) end with a checksum that the trackers' logchecker
 * verifies, so a log has to reach the target site byte for byte: same
 * encoding (EAC writes UTF-16LE with a BOM), same line endings, same
 * whitespace. Only the original file, fetched as binary, is ever uploaded.
 * The HTML rendering of a log on the torrent page is never turned back into
 * a file, since that would be an edited log.
 */

export const bytesToBase64 = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString('base64');

export const base64ToBytes = (base64: string): Uint8Array =>
  new Uint8Array(Buffer.from(base64, 'base64'));

export const decodeRipLogText = (bytes: Uint8Array): string => {
  let encoding = 'utf-8';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = 'utf-16le';
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = 'utf-16be';
  }
  // TextDecoder drops the BOM itself
  return new TextDecoder(encoding).decode(bytes);
};

// A log never starts with markup or JSON: those are an error or login page
// the site served in place of the file.
export const isRipLogContent = (bytes: Uint8Array): boolean => {
  if (bytes.length === 0) {
    return false;
  }
  const head = decodeRipLogText(bytes.subarray(0, 512)).trimStart();
  return head.length > 0 && !head.startsWith('<') && !head.startsWith('{');
};

export const sha256Hex = async (bytes: Uint8Array): Promise<string | null> => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    return null;
  }
  const digest = await subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
};

interface RipLogApiResponse {
  status: string;
  response?: {
    log?: string | null;
    log_sha256?: string | null;
  };
}

// Orpheus treats a request for log id 0 as a broken scraper and ends every
// session of the account, so only real ids are ever requested.
const getValidRipLogIds = (ids: Array<number | string>) =>
  ids.map((id) => String(id).trim()).filter((id) => /^[1-9]\d*$/.test(id));

// ajax.php?action=riplog returns the stored file as base64 together with its
// sha256 (Orpheus documents it, other Gazelle sites may not have it).
const fetchRipLogFromApi = async (
  torrentId: string,
  logId: string,
): Promise<Uint8Array | null> => {
  try {
    const result = await GMFetch<RipLogApiResponse>(
      `/ajax.php?action=riplog&id=${torrentId}&logid=${logId}`,
      { responseType: 'json' },
    );
    const encoded = result?.status === 'success' ? result.response?.log : null;
    if (!encoded) {
      return null;
    }
    const bytes = base64ToBytes(encoded);
    const expected = result.response?.log_sha256?.toLowerCase();
    if (expected) {
      const actual = await sha256Hex(bytes);
      if (actual && actual !== expected) {
        console.warn(`rip log ${logId} does not match its sha256`);
        return null;
      }
    }
    return isRipLogContent(bytes) ? bytes : null;
  } catch (error) {
    console.warn(`fail to fetch rip log ${logId} from api`, error);
    return null;
  }
};

const RAW_LOG_HREF_REGEX = /type=riplog/i;
const RAW_LOG_TEXT_REGEX = /raw|download|原始|下载/i;
// links that change something (staff tools) or lead elsewhere
const UNSAFE_LOG_HREF_REGEX =
  /auth=|action=(edit|remove|delete|take_|rescore|adjust)|report/i;

// Each log on the log page sits in a .log_section that links to the stored
// file ("View Raw Log" on Orpheus). Staff see edit/remove links in the same
// section, so those are skipped.
export const findRawLogLink = (section: Element): string | null => {
  const anchors = Array.from(
    section.querySelectorAll<HTMLAnchorElement>('a[href]'),
  ).filter((anchor) => {
    const href = anchor.getAttribute('href') ?? '';
    return (
      href !== '' &&
      !href.startsWith('#') &&
      !/^javascript:/i.test(href) &&
      !UNSAFE_LOG_HREF_REGEX.test(href)
    );
  });
  const anchor =
    anchors.find((a) =>
      RAW_LOG_HREF_REGEX.test(a.getAttribute('href') ?? ''),
    ) ??
    anchors.find((a) => RAW_LOG_TEXT_REGEX.test(a.textContent ?? '')) ??
    anchors.find((a) => a.classList.contains('brackets'));
  return anchor?.getAttribute('href') ?? null;
};

const fetchRipLogsFromPage = async (
  logPageUrl: string,
): Promise<{ files: Uint8Array[]; texts: string[] }> => {
  let html: string;
  try {
    html = await GMFetch<string>(logPageUrl);
  } catch (error) {
    console.warn('fail to fetch log page', error);
    return { files: [], texts: [] };
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const texts = Array.from(
    doc.querySelectorAll('pre'),
    (pre) => pre.textContent ?? '',
  ).filter(Boolean);

  const pageUrl = new URL(logPageUrl, location.href);
  const files: Uint8Array[] = [];
  for (const section of Array.from(doc.querySelectorAll('.log_section'))) {
    const href = findRawLogLink(section);
    if (!href) {
      continue;
    }
    const url = new URL(href, pageUrl);
    if (url.origin !== location.origin) {
      continue;
    }
    try {
      const buffer = await GMFetch<ArrayBuffer>(url.href, {
        responseType: 'arraybuffer',
      });
      const bytes = new Uint8Array(buffer);
      if (isRipLogContent(bytes)) {
        files.push(bytes);
      }
    } catch (error) {
      console.warn('fail to fetch raw rip log', error);
    }
  }
  return { files, texts };
};

export interface FetchRipLogsOptions {
  torrentId: string;
  ripLogIds?: Array<number | string>;
  // the page listing the torrent's logs; skipped when not given
  logPageUrl?: string;
}

export interface FetchedRipLogs {
  // the original log files, base64, in upload order
  files: string[];
  // log text for display: decoded from the files, or read from the log page
  // when no file could be fetched
  texts: string[];
}

export const fetchOriginalRipLogs = async ({
  torrentId,
  ripLogIds = [],
  logPageUrl,
}: FetchRipLogsOptions): Promise<FetchedRipLogs> => {
  let files: Uint8Array[] = [];
  // one request at a time, the sites rate limit ajax.php
  for (const logId of getValidRipLogIds(ripLogIds)) {
    const bytes = await fetchRipLogFromApi(torrentId, logId);
    if (!bytes) {
      // a partial set would score differently from the source, so the api
      // result is used only when every log came through
      files = [];
      break;
    }
    files.push(bytes);
  }

  let texts: string[] = [];
  if (files.length === 0 && logPageUrl) {
    ({ files, texts } = await fetchRipLogsFromPage(logPageUrl));
  }

  return {
    files: files.map(bytesToBase64),
    texts: files.length > 0 ? files.map(decodeRipLogText) : texts,
  };
};

const LOG_INPUT_SELECTOR = 'input[type="file"][name^="logfile"]';

const sanitizeFileName = (name: string) =>
  name
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

// Puts the log files into the upload form's log input. Returns the input the
// files went into, or null when there is nothing to attach or no input.
export const attachRipLogFiles = (
  logFiles: string[] | undefined,
  baseName: string,
): HTMLInputElement | null => {
  if (!logFiles?.length) {
    return null;
  }
  const input = document.querySelector<HTMLInputElement>(LOG_INPUT_SELECTOR);
  if (!input) {
    return null;
  }
  const name = sanitizeFileName(baseName) || 'riplog';
  const dataTransfer = new DataTransfer();
  logFiles.forEach((data, index) => {
    const fileName =
      logFiles.length > 1 ? `${name}.${index + 1}.log` : `${name}.log`;
    dataTransfer.items.add(
      new File([new Uint8Array(base64ToBytes(data))], fileName, {
        type: 'text/plain',
      }),
    );
  });
  input.files = dataTransfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return input;
};

// Gazelle rebuilds the upload form (#dynamic_form) when the category is set,
// which the JSON import does after a delay. A rebuilt form has a new, empty
// log input, so the logs are attached again whenever the input is replaced.
export const keepRipLogFilesAttached = (
  logFiles: string[] | undefined,
  baseName: string,
  { container = '#dynamic_form', duration = 30000 } = {},
): void => {
  if (!logFiles?.length) {
    return;
  }
  const attachedInputs = new WeakSet<HTMLInputElement>();
  const attach = () => {
    const current =
      document.querySelector<HTMLInputElement>(LOG_INPUT_SELECTOR);
    if (!current || attachedInputs.has(current)) {
      return;
    }
    const input = attachRipLogFiles(logFiles, baseName);
    if (input) {
      attachedInputs.add(input);
    }
  };
  attach();

  const root = document.querySelector(container);
  if (!root) {
    return;
  }
  let pending: ReturnType<typeof setTimeout> | undefined;
  const observer = new MutationObserver(() => {
    clearTimeout(pending);
    pending = setTimeout(attach, 300);
  });
  observer.observe(root, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), duration);
};
