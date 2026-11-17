import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import { GMFetch } from './utils';
import {
  attachRipLogFiles,
  base64ToBytes,
  bytesToBase64,
  decodeRipLogText,
  fetchOriginalRipLogs,
  findRawLogLink,
  isRipLogContent,
  keepRipLogFilesAttached,
} from './riplog';

vi.mock('./utils', () => ({
  GMFetch: vi.fn(),
}));

// An EAC log as EAC writes it: UTF-16LE with a BOM and CRLF line endings,
// plus trailing spaces that an HTML rendering would not keep.
const EAC_TEXT =
  'Exact Audio Copy V1.6 from 23. October 2020\r\n\r\n' +
  'EAC extraction logfile from 1. January 2024, 0:00   \r\n\r\n' +
  'Used drive  : PLEXTOR DVDR   PX-716A   Adapter: 0  ID: 1\r\n\r\n' +
  '==== Log checksum 0123456789ABCDEF ====\r\n';

const encodeUtf16LE = (text: string) => {
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes[0] = 0xff;
  bytes[1] = 0xfe;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes[2 + i * 2] = code & 0xff;
    bytes[3 + i * 2] = code >> 8;
  }
  return bytes;
};

const EAC_BYTES = encodeUtf16LE(EAC_TEXT);
const EAC_BASE64 = bytesToBase64(EAC_BYTES);
const EAC_SHA256 = createHash('sha256').update(EAC_BYTES).digest('hex');

const XLD_TEXT =
  'X Lossless Decoder version 20230627 (156.2)\n\nXLD extraction logfile\n';
const XLD_BYTES = new TextEncoder().encode(XLD_TEXT);

const riplogResponse = (log: string, sha256?: string) => ({
  status: 'success',
  response: { id: 1, logid: 2, log, log_sha256: sha256 ?? null },
});

const LOG_PAGE = `
<table>
  <tr class="log_section"><td>
    <div style="float: right">
      <a class="brackets" href="torrents.php?action=editlog&amp;torrentid=10&amp;logid=21">Edit Log</a>
      <a class="brackets" href="torrents.php?action=removelog&amp;torrentid=10&amp;logid=21&amp;auth=abc">Delete Log</a>
    </div>
    <div style="float: left">
      <a class="brackets" name="riplog-1" href="view.php?type=riplog&amp;id=10.21" target="_blank">View Raw Log</a>
    </div>
    <blockquote><pre>Exact Audio Copy V1.6 rendered as html</pre></blockquote>
  </td></tr>
  <tr class="log_section"><td>
    <a class="brackets" href="view.php?type=riplog&amp;id=10.22">View Raw Log</a>
    <blockquote><pre>X Lossless Decoder rendered as html</pre></blockquote>
  </td></tr>
</table>`;

describe('rip log bytes', () => {
  it('round-trips the original bytes through base64', () => {
    expect(base64ToBytes(EAC_BASE64)).toEqual(EAC_BYTES);
  });

  it('decodes UTF-16LE and UTF-8 logs', () => {
    expect(decodeRipLogText(EAC_BYTES)).toBe(EAC_TEXT);
    expect(decodeRipLogText(XLD_BYTES)).toBe(XLD_TEXT);
  });

  it('tells a log from an error page', () => {
    expect(isRipLogContent(EAC_BYTES)).toBe(true);
    expect(isRipLogContent(XLD_BYTES)).toBe(true);
    expect(
      isRipLogContent(new TextEncoder().encode('\n<!DOCTYPE html><html>')),
    ).toBe(false);
    expect(
      isRipLogContent(new TextEncoder().encode('{"status":"failure"}')),
    ).toBe(false);
    expect(isRipLogContent(new Uint8Array())).toBe(false);
  });
});

describe('findRawLogLink', () => {
  it('picks the raw log link and skips the staff links', () => {
    const doc = new DOMParser().parseFromString(LOG_PAGE, 'text/html');
    const [first, second] = Array.from(doc.querySelectorAll('.log_section'));
    expect(findRawLogLink(first)).toBe('view.php?type=riplog&id=10.21');
    expect(findRawLogLink(second)).toBe('view.php?type=riplog&id=10.22');
  });

  it('falls back to a download link without a riplog url', () => {
    const doc = new DOMParser().parseFromString(
      `<div class="log_section">
        <a class="brackets" href="torrents.php?action=rescore&amp;logid=1">Rescore</a>
        <a href="logs.php?id=1">Download</a>
      </div>`,
      'text/html',
    );
    expect(findRawLogLink(doc.querySelector('.log_section')!)).toBe(
      'logs.php?id=1',
    );
  });

  // DicMusic's log page markup
  it('picks the 查看原始 Log link and skips the show/hide toggle', () => {
    const doc = new DOMParser().parseFromString(
      `<table><tr class='log_section'><td>
        <a class='brackets' href='logs/209639_118505.log' target='_blank'>查看原始 Log</a>
        <a class='brackets' style="float: right;" href='javascript:void()' onclick='$(".log_118505").toggle()'>显隐 Log</a>
        <blockquote class="log_118505"><pre>Exact Audio Copy rendered as html</pre></blockquote>
      </td></tr></table>`,
      'text/html',
    );
    const href = findRawLogLink(doc.querySelector('.log_section')!);
    expect(href).toBe('logs/209639_118505.log');
    const pageUrl = new URL(
      '/torrents.php?action=viewlog&logscore=100&torrentid=209639',
      'https://tracker.example/',
    );
    expect(new URL(href!, pageUrl).href).toBe(
      'https://tracker.example/logs/209639_118505.log',
    );
  });
});

describe('fetchOriginalRipLogs', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the api log byte for byte', async () => {
    vi.mocked(GMFetch).mockResolvedValueOnce(
      riplogResponse(EAC_BASE64, EAC_SHA256),
    );

    const result = await fetchOriginalRipLogs({
      torrentId: '10',
      ripLogIds: [21],
      logPageUrl: '/torrents.php?action=viewlog&torrentid=10',
    });

    expect(GMFetch).toHaveBeenCalledTimes(1);
    expect(GMFetch).toHaveBeenCalledWith(
      '/ajax.php?action=riplog&id=10&logid=21',
      { responseType: 'json' },
    );
    expect(result.files).toEqual([EAC_BASE64]);
    expect(base64ToBytes(result.files[0])).toEqual(EAC_BYTES);
    expect(result.texts).toEqual([EAC_TEXT]);
  });

  it('fetches every log, the first one included', async () => {
    vi.mocked(GMFetch)
      .mockResolvedValueOnce(riplogResponse(EAC_BASE64))
      .mockResolvedValueOnce(riplogResponse(bytesToBase64(XLD_BYTES)));

    const result = await fetchOriginalRipLogs({
      torrentId: '10',
      ripLogIds: ['21', '22'],
    });

    expect(result.files).toEqual([EAC_BASE64, bytesToBase64(XLD_BYTES)]);
  });

  it('never requests log id 0', async () => {
    const result = await fetchOriginalRipLogs({
      torrentId: '10',
      ripLogIds: [0, '0'],
    });

    expect(GMFetch).not.toHaveBeenCalled();
    expect(result).toEqual({ files: [], texts: [] });
  });

  it('drops a log whose sha256 does not match', async () => {
    vi.mocked(GMFetch).mockResolvedValueOnce(
      riplogResponse(EAC_BASE64, '0'.repeat(64)),
    );

    const result = await fetchOriginalRipLogs({
      torrentId: '10',
      ripLogIds: [21],
    });

    expect(result.files).toEqual([]);
  });

  it('downloads the raw files from the log page when the api fails', async () => {
    vi.mocked(GMFetch)
      .mockResolvedValueOnce({ status: 'failure', error: 'bad parameters' })
      .mockResolvedValueOnce(LOG_PAGE)
      .mockResolvedValueOnce(EAC_BYTES.buffer)
      .mockResolvedValueOnce(XLD_BYTES.buffer);

    const result = await fetchOriginalRipLogs({
      torrentId: '10',
      ripLogIds: [21, 22],
      logPageUrl: '/torrents.php?action=loglist&torrentid=10',
    });

    expect(GMFetch).toHaveBeenNthCalledWith(
      3,
      `${location.origin}/view.php?type=riplog&id=10.21`,
      { responseType: 'arraybuffer' },
    );
    expect(GMFetch).toHaveBeenNthCalledWith(
      4,
      `${location.origin}/view.php?type=riplog&id=10.22`,
      { responseType: 'arraybuffer' },
    );
    expect(result.files).toEqual([EAC_BASE64, bytesToBase64(XLD_BYTES)]);
    expect(result.texts).toEqual([EAC_TEXT, XLD_TEXT]);
  });

  it('does not turn the html rendering into a file', async () => {
    vi.mocked(GMFetch).mockResolvedValueOnce(
      '<div><pre>Exact Audio Copy V1.0 beta 3</pre></div>',
    );

    const result = await fetchOriginalRipLogs({
      torrentId: '10',
      logPageUrl: '/torrents.php?action=viewlog&torrentid=10',
    });

    expect(GMFetch).toHaveBeenCalledTimes(1);
    expect(result.files).toEqual([]);
    expect(result.texts).toEqual(['Exact Audio Copy V1.0 beta 3']);
  });

  it('skips a raw link that serves an error page', async () => {
    vi.mocked(GMFetch)
      .mockResolvedValueOnce(
        '<div class="log_section"><a href="view.php?type=riplog&amp;id=10.21">View Raw Log</a></div>',
      )
      .mockResolvedValueOnce(
        new TextEncoder().encode('<html>login</html>').buffer,
      );

    const result = await fetchOriginalRipLogs({
      torrentId: '10',
      logPageUrl: '/torrents.php?action=viewlog&torrentid=10',
    });

    expect(result.files).toEqual([]);
  });
});

// jsdom's File has no arrayBuffer()
const readFileBytes = (file: File) =>
  new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });

// jsdom has no DataTransfer
class FakeDataTransfer {
  private list: File[] = [];
  items = { add: (file: File) => this.list.push(file) };
  get files() {
    return this.list as unknown as FileList;
  }
}

const mockFilesProperty = (input: HTMLInputElement) => {
  let files: FileList | null = null;
  Object.defineProperty(input, 'files', {
    configurable: true,
    get: () => files,
    set: (value: FileList) => {
      files = value;
    },
  });
};

const renderLogInput = (container: HTMLElement) => {
  container.innerHTML =
    '<input id="logfile_1" type="file" multiple name="logfiles[]">';
  const input = container.querySelector('input') as HTMLInputElement;
  mockFilesProperty(input);
  return input;
};

describe('attaching rip logs', () => {
  beforeEach(() => {
    vi.stubGlobal('DataTransfer', FakeDataTransfer);
    document.body.innerHTML =
      '<input id="file" type="file" name="file_input"><div id="dynamic_form"></div>';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('puts the original bytes into the log input', async () => {
    const torrentInput = document.querySelector('#file') as HTMLInputElement;
    const input = renderLogInput(
      document.querySelector('#dynamic_form') as HTMLElement,
    );

    expect(
      attachRipLogFiles(
        [EAC_BASE64, bytesToBase64(XLD_BYTES)],
        'Album: Name / Live?',
      ),
    ).toBe(input);

    const files = Array.from(input.files as unknown as File[]);
    expect(files.map((file) => file.name)).toEqual([
      'Album Name Live.1.log',
      'Album Name Live.2.log',
    ]);
    expect(Array.from(await readFileBytes(files[0]))).toEqual(
      Array.from(EAC_BYTES),
    );
    expect(Array.from(await readFileBytes(files[1]))).toEqual(
      Array.from(XLD_BYTES),
    );
    expect(torrentInput.files?.length ?? 0).toBe(0);
  });

  it('does nothing without logs or a log input', () => {
    expect(attachRipLogFiles([], 'Album')).toBeNull();
    expect(attachRipLogFiles([EAC_BASE64], 'Album')).toBeNull();
  });

  it('attaches again when the form is rebuilt', async () => {
    vi.useFakeTimers();
    const form = document.querySelector('#dynamic_form') as HTMLElement;
    const first = renderLogInput(form);

    keepRipLogFilesAttached([EAC_BASE64], 'Album');
    expect(first.files).toHaveLength(1);

    const rebuilt = renderLogInput(form);
    expect(rebuilt.files).toBeNull();
    await vi.advanceTimersByTimeAsync(300);

    expect(rebuilt.files).toHaveLength(1);
    expect((rebuilt.files as unknown as File[])[0].name).toBe('Album.log');
  });

  it('leaves an input the user cleared alone', async () => {
    vi.useFakeTimers();
    const form = document.querySelector('#dynamic_form') as HTMLElement;
    const input = renderLogInput(form);

    keepRipLogFilesAttached([EAC_BASE64], 'Album');
    input.files = null as unknown as FileList;
    form.appendChild(document.createElement('span'));
    await vi.advanceTimersByTimeAsync(300);

    expect(input.files).toBeNull();
  });
});
