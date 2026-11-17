import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  REDSearchResultGroup,
  REDSearchResultResponse,
} from '@/target/types';
import {
  applyExistingMusicGroup,
  isMusicGroupMergeEnabled,
  MUSIC_GROUP_MERGE_CLOSED_KEY,
  showAutoMergedGroupNotice,
} from '../music-group';
import type { MusicRelease } from '../music-group-match';

vi.mock('@/common', () => ({
  $t: (key: string) => key,
}));

const siteInfo = { url: 'https://redacted.sh', uploadPath: '/upload.php' };

const release: MusicRelease = {
  group: {
    name: 'OK Computer',
    year: 1997,
    releaseType: 1,
    catalogueNumber: '',
    musicInfo: {
      artists: [{ id: 1, name: 'Radiohead' }],
      with: [],
      composers: [],
      conductor: [],
      dj: [],
      producer: [],
      remixedBy: [],
    },
  } as unknown as MusicJson.GroupInfo,
  torrent: { remasterCatalogueNumber: '' } as unknown as MusicJson.Torrent,
};

const group = (
  groupId: number,
  artist = 'Radiohead',
): REDSearchResultGroup => ({
  groupId,
  groupName: 'OK Computer',
  artist,
  groupYear: 1997,
  releaseType: 'Album',
});

const respond = (results: REDSearchResultGroup[]) =>
  vi.fn(
    async (): Promise<REDSearchResultResponse> => ({
      status: 'success',
      response: { results },
    }),
  );

let mergeClosed = false;

beforeEach(() => {
  mergeClosed = false;
  vi.stubGlobal(
    'GM_getValue',
    vi.fn((key: string, fallback?: unknown) =>
      key === MUSIC_GROUP_MERGE_CLOSED_KEY ? mergeClosed : fallback,
    ),
  );
  vi.spyOn(console, 'log').mockImplementation(() => {});
  window.location.hash = '#timestamp=123';
  document.body.innerHTML =
    '<div id="content"><form id="upload_table"></form></div>';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.location.hash = '';
});

describe('music group merge setting', () => {
  it('is on unless the user turned it off', () => {
    expect(isMusicGroupMergeEnabled()).toBe(true);
    mergeClosed = true;
    expect(isMusicGroupMergeEnabled()).toBe(false);
  });

  it('does not search when the user turned it off', async () => {
    mergeClosed = true;
    const search = respond([group(1)]);
    const navigate = vi.fn();
    const merged = await applyExistingMusicGroup({
      release,
      siteInfo,
      search,
      navigate,
    });
    expect(merged).toBe(false);
    expect(search).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(document.getElementById('easy-upload-music-group')).toBeNull();
  });

  it('does not search after the user chose to upload as a new group', async () => {
    window.location.hash = '#timestamp=123#easy-upload-group=new';
    const search = respond([group(1)]);
    const merged = await applyExistingMusicGroup({
      release,
      siteInfo,
      search,
      navigate: vi.fn(),
    });
    expect(merged).toBe(false);
    expect(search).not.toHaveBeenCalled();
  });
});

describe('applyExistingMusicGroup', () => {
  it('opens the upload page of a confidently matched group', async () => {
    const navigate = vi.fn();
    const merged = await applyExistingMusicGroup({
      release,
      siteInfo,
      search: respond([group(42)]),
      navigate,
    });
    expect(merged).toBe(true);
    expect(navigate).toHaveBeenCalledWith(
      'https://redacted.sh/upload.php?groupid=42#timestamp=123#easy-upload-group=auto',
    );
  });

  it('lists the groups when the match is not certain', async () => {
    const navigate = vi.fn();
    const merged = await applyExistingMusicGroup({
      release,
      siteInfo,
      search: respond([
        { ...group(7), groupName: 'OK Computer &amp; More' },
        group(8, 'レディオヘッド'),
      ]),
      navigate,
    });
    expect(merged).toBe(false);
    expect(navigate).not.toHaveBeenCalled();

    const box = document.getElementById('easy-upload-music-group');
    expect(box).not.toBeNull();
    // shown above the upload form
    expect(box?.nextElementSibling?.id).toBe('upload_table');
    expect(box?.textContent).toContain('musicGroup.suggest');

    const links = Array.from(box?.querySelectorAll('a') ?? []).map((link) => [
      link.textContent,
      link.getAttribute('href'),
    ]);
    expect(links).toContainEqual([
      'レディオヘッド - OK Computer [1997] [Album]',
      'https://redacted.sh/torrents.php?id=8',
    ]);
    expect(links).toContainEqual([
      '[musicGroup.useGroup]',
      'https://redacted.sh/upload.php?groupid=8#timestamp=123',
    ]);
    // names are decoded and set as text, never as HTML
    expect(box?.textContent).toContain('OK Computer & More');
    expect(box?.textContent).toContain('musicGroup.diffArtist');
    expect(box?.textContent).toContain('musicGroup.diffTitle');
  });

  it('asks the user to choose between duplicate groups', async () => {
    const navigate = vi.fn();
    await applyExistingMusicGroup({
      release,
      siteInfo,
      search: respond([group(1), group(2)]),
      navigate,
    });
    expect(navigate).not.toHaveBeenCalled();
    const box = document.getElementById('easy-upload-music-group');
    expect(box?.textContent).toContain('musicGroup.ambiguous');
    expect(box?.querySelectorAll('li')).toHaveLength(2);
  });

  it('shows nothing when no group is similar', async () => {
    await applyExistingMusicGroup({
      release,
      siteInfo,
      search: respond([]),
      navigate: vi.fn(),
    });
    expect(document.getElementById('easy-upload-music-group')).toBeNull();
  });

  it('can close the list', async () => {
    await applyExistingMusicGroup({
      release,
      siteInfo,
      search: respond([group(1), group(2)]),
      navigate: vi.fn(),
    });
    document
      .querySelector<HTMLButtonElement>('#easy-upload-music-group button')
      ?.click();
    expect(document.getElementById('easy-upload-music-group')).toBeNull();
  });
});

describe('showAutoMergedGroupNotice', () => {
  it('offers to upload as a new group after an automatic merge', () => {
    window.location.hash = '#timestamp=123#easy-upload-group=auto';
    showAutoMergedGroupNotice(siteInfo, '42');
    const box = document.getElementById('easy-upload-music-group');
    expect(box?.textContent).toContain('musicGroup.autoMerged');
    const hrefs = Array.from(box?.querySelectorAll('a') ?? []).map((link) =>
      link.getAttribute('href'),
    );
    expect(hrefs).toEqual([
      'https://redacted.sh/torrents.php?id=42',
      'https://redacted.sh/upload.php#timestamp=123#easy-upload-group=new',
    ]);
  });

  it('stays hidden when the user opened the group page', () => {
    showAutoMergedGroupNotice(siteInfo, '42');
    expect(document.getElementById('easy-upload-music-group')).toBeNull();
  });
});
