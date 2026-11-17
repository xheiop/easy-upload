import { describe, it, expect, vi } from 'vitest';
import type {
  REDSearchResultGroup,
  REDSearchResultResponse,
} from '@/target/types';
import {
  buildGroupSearchQueries,
  compareArtists,
  compareReleaseTypes,
  compareTitles,
  compareYears,
  decodeHtmlEntities,
  findExistingGroup,
  matchExistingGroup,
  MAX_GROUP_CANDIDATES,
  MusicRelease,
  normalizeArtistName,
  normalizeCatalogueNumber,
  normalizeMusicText,
  stripEditionInfo,
} from '../music-group-match';

const people = (names: string[] = []): MusicJson.People[] =>
  names.map((name, index) => ({ id: index + 1, name }));

const makeRelease = ({
  name = 'OK Computer',
  year = 1997,
  releaseType = 1,
  artists = ['Radiohead'],
  dj = [],
  composers = [],
  conductor = [],
  catalogueNumber = '',
  remasterCatalogueNumber = '',
}: {
  name?: string;
  year?: number;
  releaseType?: number;
  artists?: string[];
  dj?: string[];
  composers?: string[];
  conductor?: string[];
  catalogueNumber?: string;
  remasterCatalogueNumber?: string;
} = {}): MusicRelease => ({
  group: {
    name,
    year,
    releaseType,
    catalogueNumber,
    recordLabel: '',
    musicInfo: {
      artists: people(artists),
      with: [],
      composers: people(composers),
      conductor: people(conductor),
      dj: people(dj),
      producer: [],
      remixedBy: [],
    },
  } as unknown as MusicJson.GroupInfo,
  torrent: {
    remasterCatalogueNumber,
    remasterRecordLabel: '',
    remasterTitle: '',
  } as unknown as MusicJson.Torrent,
});

const makeGroup = ({
  groupId,
  groupName = 'OK Computer',
  artist = 'Radiohead',
  groupYear = 1997,
  releaseType = 'Album',
  catalogues = [],
}: {
  groupId: number;
  groupName?: string;
  artist?: string;
  groupYear?: number;
  releaseType?: string | number;
  catalogues?: string[];
}): REDSearchResultGroup => ({
  groupId,
  groupName,
  artist,
  groupYear,
  releaseType,
  torrents: catalogues.map((remasterCatalogueNumber, index) => ({
    torrentId: groupId * 10 + index,
    remasterCatalogueNumber,
  })),
});

const success = (results: REDSearchResultGroup[]): REDSearchResultResponse => ({
  status: 'success',
  response: { results },
});

describe('normalizeMusicText', () => {
  it('decodes the HTML entities Gazelle returns', () => {
    expect(decodeHtmlEntities('Simon &amp; Garfunkel')).toBe(
      'Simon & Garfunkel',
    );
    expect(decodeHtmlEntities('Don&#39;t &#x41;&quot;')).toBe('Don\'t A"');
    expect(decodeHtmlEntities('&unknown; &#99999999;')).toBe(
      '&unknown; &#99999999;',
    );
  });

  it('ignores case, punctuation, accents and full-width forms', () => {
    expect(normalizeMusicText('ＯＫ　Ｃｏｍｐｕｔｅｒ')).toBe('ok computer');
    expect(normalizeMusicText('Beyoncé')).toBe('beyonce');
    expect(normalizeMusicText('Sigur Rós')).toBe('sigur ros');
    expect(normalizeMusicText('AC/DC')).toBe('ac dc');
    expect(normalizeMusicText('Mr. Bungle!!')).toBe('mr bungle');
    expect(normalizeMusicText('Don’t Stop')).toBe(
      normalizeMusicText("Don't Stop"),
    );
  });

  it('reads & as and', () => {
    expect(normalizeMusicText('Simon &amp; Garfunkel')).toBe(
      normalizeMusicText('Simon and Garfunkel'),
    );
  });

  it('keeps Japanese voiced kana and CJK text', () => {
    expect(normalizeMusicText('がらくた')).toBe('がらくた');
    expect(normalizeMusicText('范特西')).toBe('范特西');
    expect(normalizeMusicText('「七里香」')).toBe('七里香');
  });

  it('ignores the word "the" in artist names', () => {
    expect(normalizeArtistName('The Beatles')).toBe('beatles');
    expect(normalizeArtistName('Florence + The Machine')).toBe(
      'florence machine',
    );
    // a name made only of "the" is kept
    expect(normalizeArtistName('The The')).toBe('the the');
  });
});

describe('compareTitles', () => {
  it('matches titles that differ only in case, punctuation or width', () => {
    expect(compareTitles('OK Computer', 'Ok computer')).toBe('exact');
    expect(compareTitles('ＯＫ Ｃｏｍｐｕｔｅｒ', 'OK Computer')).toBe('exact');
    expect(compareTitles('Rock &amp; Roll', 'Rock and Roll')).toBe('exact');
  });

  it('ignores edition information in brackets or after a dash', () => {
    expect(compareTitles('Abbey Road (Remastered 2009)', 'Abbey Road')).toBe(
      'edition',
    );
    expect(compareTitles('Rumours - Deluxe Edition', 'Rumours')).toBe(
      'edition',
    );
    expect(compareTitles('Nevermind [2011]', 'Nevermind')).toBe('edition');
    expect(compareTitles('范特西 (豪华版)', '范特西')).toBe('edition');
    expect(stripEditionInfo('Kid A (Bonus Track Version) [Japan]')).toBe(
      'Kid A',
    );
  });

  it('keeps meaningful brackets apart from edition information', () => {
    expect(stripEditionInfo('Symphony No. 9 (Choral)')).toBe(
      'Symphony No. 9 (Choral)',
    );
    expect(compareTitles('Symphony No. 9 (Choral)', 'Symphony No. 9')).toBe(
      'core',
    );
  });

  it('reports a title contained in the other one as partial', () => {
    expect(compareTitles('Greatest Hits', 'Greatest Hits Vol. 2')).toBe(
      'partial',
    );
    expect(compareTitles('EP', 'EP One')).toBe('none');
  });

  it('compares titles made only of symbols', () => {
    expect(compareTitles('÷', '÷')).toBe('exact');
    expect(compareTitles('÷', '+')).toBe('none');
  });

  it('rejects different titles', () => {
    expect(compareTitles('Blue', 'Red')).toBe('none');
    expect(compareTitles('', 'Red')).toBe('none');
  });
});

describe('compareArtists', () => {
  const info = (artists: string[], extra = {}) =>
    makeRelease({ artists, ...extra }).group.musicInfo;

  it('matches the same artist written differently', () => {
    expect(compareArtists(info(['The Beatles']), { artist: 'Beatles' })).toBe(
      'exact',
    );
    expect(
      compareArtists(info(['Simon & Garfunkel']), {
        artist: 'Simon &amp; Garfunkel',
      }),
    ).toBe('exact');
    expect(compareArtists(info(['Beyoncé']), { artist: 'Beyonce' })).toBe(
      'exact',
    );
  });

  it('matches two artists shown as "A & B" in any order', () => {
    expect(
      compareArtists(info(['Jay-Z', 'Kanye West']), {
        artist: 'Kanye West &amp; Jay-Z',
      }),
    ).toBe('exact');
  });

  it('matches classical display names that add the composer', () => {
    expect(
      compareArtists(
        info(['Glenn Gould'], { composers: ['Johann Sebastian Bach'] }),
        {
          artist: 'Johann Sebastian Bach performed by Glenn Gould',
        },
      ),
    ).toBe('contains');
  });

  it('uses the DJs when the release has any', () => {
    expect(
      compareArtists(info(['A', 'B', 'C'], { dj: ['Sasha'] }), {
        artist: 'Sasha',
      }),
    ).toBe('exact');
  });

  it('matches compilations shown as Various Artists', () => {
    expect(
      compareArtists(info(['A', 'B', 'C', 'D']), { artist: 'Various Artists' }),
    ).toBe('various');
    expect(compareArtists(info(['A']), { artist: 'Various Artists' })).toBe(
      'none',
    );
  });

  it('uses the artist list of the torrents when present', () => {
    const torrents = [{ artists: [{ name: 'Radiohead' }] }];
    expect(
      compareArtists(info(['Radiohead']), { artist: 'whatever', torrents }),
    ).toBe('exact');
    expect(
      compareArtists(info(['Radiohead', 'Thom Yorke']), {
        artist: 'Radiohead',
        torrents,
      }),
    ).toBe('partial');
  });

  it('rejects another artist and reports missing data as unknown', () => {
    expect(compareArtists(info(['Queen']), { artist: 'ABBA' })).toBe('none');
    expect(compareArtists(info([]), { artist: 'ABBA' })).toBe('unknown');
    expect(compareArtists(info(['Queen']), { artist: '' })).toBe('unknown');
  });
});

describe('years, release types and catalogue numbers', () => {
  it('compares years', () => {
    expect(compareYears(1997, 1997)).toBe('exact');
    expect(compareYears(1997, 1998)).toBe('near');
    expect(compareYears(1997, 2007)).toBe('mismatch');
    expect(compareYears(0, 1997)).toBe('unknown');
  });

  it('compares release type ids with names', () => {
    expect(compareReleaseTypes(1, 'Album')).toBe('match');
    expect(compareReleaseTypes(5, '5')).toBe('match');
    expect(compareReleaseTypes(9, 'Album')).toBe('mismatch');
    expect(compareReleaseTypes(11, 'Live album')).toBe('match');
    // unknown names (another language) and the Unknown type stay neutral
    expect(compareReleaseTypes(1, '专辑')).toBe('unknown');
    expect(compareReleaseTypes(21, 'Album')).toBe('unknown');
    expect(compareReleaseTypes(1, undefined)).toBe('unknown');
  });

  it('normalizes catalogue numbers and ignores placeholders', () => {
    expect(normalizeCatalogueNumber('sicp 1234')).toBe(
      normalizeCatalogueNumber('SICP-1234'),
    );
    expect(normalizeCatalogueNumber('none')).toBe('');
    expect(normalizeCatalogueNumber('N/A')).toBe('');
    expect(normalizeCatalogueNumber('12')).toBe('');
  });
});

describe('matchExistingGroup', () => {
  it('finds no group in an empty result', () => {
    expect(matchExistingGroup(makeRelease(), [])).toEqual({
      decision: 'none',
      candidates: [],
    });
  });

  it('skips a newer group of another artist with the same title', () => {
    // the old code took results[0], which the site sorts by upload time
    const release = makeRelease({
      name: 'Greatest Hits',
      year: 1981,
      artists: ['Queen'],
    });
    const result = matchExistingGroup(release, [
      makeGroup({
        groupId: 1,
        groupName: 'Greatest Hits',
        artist: 'ABBA',
        groupYear: 1981,
      }),
      makeGroup({
        groupId: 2,
        groupName: 'Greatest Hits',
        artist: 'Queen',
        groupYear: 1981,
      }),
    ]);
    expect(result.decision).toBe('merge');
    expect(result.group?.groupId).toBe(2);
  });

  it('does not merge an album into the single of the same name', () => {
    const release = makeRelease({
      name: 'Paranoid',
      year: 1970,
      artists: ['Black Sabbath'],
    });
    const single = makeGroup({
      groupId: 1,
      groupName: 'Paranoid',
      artist: 'Black Sabbath',
      groupYear: 1970,
      releaseType: 'Single',
    });
    expect(matchExistingGroup(release, [single]).decision).toBe('suggest');

    const album = makeGroup({
      groupId: 2,
      groupName: 'Paranoid',
      artist: 'Black Sabbath',
      groupYear: 1970,
    });
    const result = matchExistingGroup(release, [single, album]);
    expect(result.decision).toBe('merge');
    expect(result.group?.groupId).toBe(2);
  });

  it('only suggests a group of another artist with the same title and year', () => {
    const release = makeRelease({
      name: 'Untitled',
      year: 2004,
      artists: ['坂本龍一'],
    });
    const result = matchExistingGroup(release, [
      makeGroup({
        groupId: 7,
        groupName: 'Untitled',
        artist: 'Ryuichi Sakamoto',
        groupYear: 2004,
      }),
    ]);
    expect(result.decision).toBe('suggest');
    expect(result.candidates[0].detail.artist).toBe('none');
  });

  it('ignores a group of another artist with another year', () => {
    const release = makeRelease({ name: 'Untitled', year: 2004 });
    const result = matchExistingGroup(release, [
      makeGroup({
        groupId: 7,
        groupName: 'Untitled',
        artist: 'Someone',
        groupYear: 1990,
      }),
    ]);
    expect(result.decision).toBe('none');
  });

  it('merges into the group of another edition of the same album', () => {
    const release = makeRelease({ name: 'OK Computer (OKNOTOK 1997 2017)' });
    const okComputer = makeGroup({ groupId: 3 });
    expect(compareTitles(release.group.name, okComputer.groupName)).toBe(
      'core',
    );
    expect(matchExistingGroup(release, [okComputer]).decision).toBe('suggest');

    const deluxe = makeRelease({ name: 'OK Computer (Deluxe Edition)' });
    expect(matchExistingGroup(deluxe, [okComputer]).group?.groupId).toBe(3);
  });

  it('prefers the group with the exact title over another edition group', () => {
    const release = makeRelease({
      name: 'Abbey Road',
      year: 1969,
      artists: ['The Beatles'],
    });
    const result = matchExistingGroup(release, [
      makeGroup({
        groupId: 1,
        groupName: 'Abbey Road (Super Deluxe Edition)',
        artist: 'The Beatles',
        groupYear: 1969,
      }),
      makeGroup({
        groupId: 2,
        groupName: 'Abbey Road',
        artist: 'The Beatles',
        groupYear: 1969,
      }),
    ]);
    expect(result.decision).toBe('merge');
    expect(result.group?.groupId).toBe(2);
  });

  it('does not pick between duplicate groups', () => {
    const result = matchExistingGroup(makeRelease(), [
      makeGroup({ groupId: 1 }),
      makeGroup({ groupId: 2 }),
    ]);
    expect(result.decision).toBe('ambiguous');
    expect(result.group).toBeUndefined();
    expect(result.candidates.map((c) => c.group.groupId).sort()).toEqual([
      1, 2,
    ]);
  });

  it('uses the catalogue number to tell duplicate groups apart', () => {
    const release = makeRelease({ remasterCatalogueNumber: 'NODATA 02' });
    const result = matchExistingGroup(release, [
      makeGroup({ groupId: 1, catalogues: ['CDP 7243 8 55229 2 5'] }),
      makeGroup({ groupId: 2, catalogues: ['', 'nodata-02'] }),
    ]);
    expect(result.decision).toBe('merge');
    expect(result.group?.groupId).toBe(2);
  });

  it('needs the catalogue number when the year differs', () => {
    const release = makeRelease({ year: 1998, catalogueNumber: 'NODATA 02' });
    expect(
      matchExistingGroup(release, [makeGroup({ groupId: 1 })]).decision,
    ).toBe('suggest');
    expect(
      matchExistingGroup(release, [
        makeGroup({ groupId: 1, catalogues: ['NODATA02'] }),
      ]).decision,
    ).toBe('merge');
  });

  it('merges a compilation into a Various Artists group with the same title', () => {
    const release = makeRelease({
      name: 'Now That&#39;s What I Call Music! 100',
      year: 2018,
      releaseType: 7,
      artists: ['A', 'B', 'C', 'D'],
    });
    const group = makeGroup({
      groupId: 9,
      groupName: 'Now That’s What I Call Music 100',
      artist: 'Various Artists',
      groupYear: 2018,
      releaseType: 'Compilation',
    });
    expect(matchExistingGroup(release, [group]).decision).toBe('merge');

    const deluxe = {
      ...release,
      group: { ...release.group, name: 'Now 100 (Deluxe)' },
    };
    expect(
      matchExistingGroup(deluxe, [{ ...group, groupName: 'Now 100' }]).decision,
    ).toBe('suggest');
  });

  it('counts a group returned by several searches once', () => {
    const group = makeGroup({ groupId: 1 });
    const result = matchExistingGroup(makeRelease(), [group, { ...group }]);
    expect(result.decision).toBe('merge');
    expect(result.candidates).toHaveLength(1);
  });

  it('lists the best candidates first, at most MAX_GROUP_CANDIDATES', () => {
    const release = makeRelease({
      name: 'Live',
      year: 2000,
      artists: ['Band'],
    });
    const groups = Array.from({ length: 8 }, (_, index) =>
      makeGroup({
        groupId: index + 1,
        groupName: `Live ${index + 1}`,
        artist: 'Band',
        groupYear: 2000 + index,
      }),
    );
    const result = matchExistingGroup(release, groups);
    expect(result.decision).toBe('suggest');
    expect(result.candidates).toHaveLength(MAX_GROUP_CANDIDATES);
    expect(result.candidates[0].group.groupId).toBe(1);
  });
});

describe('buildGroupSearchQueries', () => {
  it('searches by artist and title, then by title and year', () => {
    expect(buildGroupSearchQueries(makeRelease().group)).toEqual([
      'Radiohead OK Computer',
      'OK Computer 1997',
    ]);
  });

  it('leaves out brackets, entities and punctuation', () => {
    const { group } = makeRelease({
      name: 'Rock &amp; Roll (Deluxe Edition)',
      year: 2001,
      artists: ['AC/DC'],
    });
    expect(buildGroupSearchQueries(group)).toEqual([
      'AC DC Rock Roll',
      'Rock Roll 2001',
    ]);
  });

  it('searches compilations by title and year only', () => {
    const { group } = makeRelease({
      name: 'Hits',
      year: 2020,
      artists: ['A', 'B', 'C'],
    });
    expect(buildGroupSearchQueries(group)).toEqual(['Hits 2020']);
  });

  it('keeps titles made only of symbols', () => {
    const { group } = makeRelease({
      name: '÷',
      year: 2017,
      artists: ['Ed Sheeran'],
    });
    expect(buildGroupSearchQueries(group)).toEqual(['Ed Sheeran ÷', '÷ 2017']);
  });
});

describe('findExistingGroup', () => {
  it('stops after the first search when it finds a confident match', async () => {
    const search = vi
      .fn()
      .mockResolvedValue(success([makeGroup({ groupId: 4 })]));
    const result = await findExistingGroup(makeRelease(), search);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('Radiohead OK Computer');
    expect(result.group?.groupId).toBe(4);
  });

  it('runs the next search and matches the groups of both', async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce(success([]))
      .mockResolvedValueOnce(
        success([makeGroup({ groupId: 5, artist: 'レディオヘッド' })]),
      );
    const result = await findExistingGroup(makeRelease(), search);
    expect(search).toHaveBeenNthCalledWith(2, 'OK Computer 1997');
    expect(result.decision).toBe('suggest');
  });

  it('survives failed searches', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const search = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ status: 'failure', response: { results: [] } });
    const result = await findExistingGroup(makeRelease(), search);
    expect(result).toEqual({ decision: 'none', candidates: [] });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
