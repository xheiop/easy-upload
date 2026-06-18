import { describe, expect, it } from 'vitest';
import parseTorrent, { toTorrentFile } from 'parse-torrent';
import { Buffer } from 'buffer/index.js';
import {
  sanitizeTorrentBuffer,
  sanitizeTorrentToDataUrl,
} from './torrent-file';

const createTorrentBuffer = () =>
  toTorrentFile({
    info: {
      name: 'example.txt',
      length: 7,
      'piece length': 16384,
      pieces: Buffer.alloc(20),
      source: 'source-site',
    },
    announce: ['https://source.example/announce'],
    comment: 'source comment',
  });

describe('torrent-file', () => {
  it('sanitizes torrent announce, comment, and source', async () => {
    const sanitized = await sanitizeTorrentBuffer(
      createTorrentBuffer().buffer,
      'https://target.example/announce',
    );
    const parsed = await parseTorrent(Buffer.from(sanitized));

    expect(parsed.announce).toEqual(['https://target.example/announce']);
    expect(parsed.comment || '').toBe('');
    expect(parsed.info.source).toHaveLength(0);
  });

  it('throws when target announce is missing', async () => {
    await expect(
      sanitizeTorrentBuffer(createTorrentBuffer().buffer),
    ).rejects.toThrow('Missing torrent announce URL');
  });

  it('returns sanitized torrent data url', async () => {
    const dataUrl = await sanitizeTorrentToDataUrl(
      createTorrentBuffer().buffer,
      'https://target.example/announce',
    );

    expect(dataUrl).toMatch(/^data:application\/x-bittorrent;base64,/);
  });
});
