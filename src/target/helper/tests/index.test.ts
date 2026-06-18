import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import parseTorrent, { toTorrentFile } from 'parse-torrent';
import { Buffer } from 'buffer/index.js';
import { GMFetch } from '@/common/utils';
import { hydrateTorrentDataFromUrl } from '@/target/helper';

vi.mock('@/common/utils', () => ({
  GMFetch: vi.fn(),
}));

vi.mock('@/const', () => ({
  CURRENT_SITE_INFO: {
    torrent: {
      announce: 'https://target.example/announce',
    },
  },
}));

const createTorrentInfo = (
  overrides: Partial<TorrentInfo.Info> = {},
): TorrentInfo.Info => ({
  title: 'Example.Movie.2026.1080p',
  description: 'description',
  year: '2026',
  category: 'movie',
  videoType: 'encode',
  source: 'Blu-ray',
  resolution: '1080p',
  mediaInfos: [],
  screenshots: [],
  movieName: 'Example Movie',
  sourceSite: 'Differential',
  sourceSiteType: 'NexusPHP',
  size: 1024,
  tags: {},
  ...overrides,
});

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

const parseTorrentDataUrl = (dataUrl: string) =>
  parseTorrent(Buffer.from(dataUrl.split(',')[1], 'base64'));

describe('hydrateTorrentDataFromUrl', () => {
  beforeEach(() => {
    vi.mocked(GMFetch).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps existing torrentData without fetching torrentUrl', async () => {
    const info = createTorrentInfo({
      torrentData: 'data:application/x-bittorrent;base64,existing',
      torrentUrl: 'http://127.0.0.1:8765/torrent/example.torrent',
    });

    const result = await hydrateTorrentDataFromUrl(info);

    expect(result).toBe(info);
    expect(result.torrentData).toBe(
      'data:application/x-bittorrent;base64,existing',
    );
    expect(GMFetch).not.toHaveBeenCalled();
  });

  it('fetches torrentUrl and stores it as torrentData', async () => {
    vi.mocked(GMFetch).mockResolvedValueOnce(createTorrentBuffer().buffer);

    const info = createTorrentInfo({
      torrentUrl: 'http://127.0.0.1:8765/torrent/example.torrent',
    });

    const result = await hydrateTorrentDataFromUrl(info);

    expect(GMFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8765/torrent/example.torrent',
      {
        method: 'GET',
        responseType: 'arraybuffer',
        timeout: 10000,
      },
    );
    expect(result).not.toBe(info);
    expect(result.torrentData).toMatch(
      /^data:application\/x-bittorrent;base64,/,
    );
    const parsed = await parseTorrentDataUrl(result.torrentData as string);
    expect(parsed.announce).toEqual(['https://target.example/announce']);
    expect(parsed.comment || '').toBe('');
    expect(parsed.info.source).toHaveLength(0);
  });

  it('returns the original torrent info when torrentUrl fetch fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const error = new Error('failed to fetch torrent');
    vi.mocked(GMFetch).mockRejectedValueOnce(error);
    const info = createTorrentInfo({
      torrentUrl: 'http://127.0.0.1:8765/torrent/example.torrent',
    });

    const result = await hydrateTorrentDataFromUrl(info);

    expect(result).toBe(info);
    expect(result.torrentData).toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      'fail to fetch torrent from torrentUrl',
      error,
    );
  });
});
