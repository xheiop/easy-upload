/**
 * Decides whether a music release already has a torrent group on a Gazelle
 * music site (RED, Orpheus, DicMusic), using the groups returned by
 * `ajax.php?action=browse`.
 *
 * Every function here is pure, so the rules can be unit tested without a site.
 */
import type {
  REDSearchResultGroup,
  REDSearchResultResponse,
} from '@/target/types';

export interface MusicRelease {
  group: MusicJson.GroupInfo;
  torrent: MusicJson.Torrent;
}

/** exact > edition (edition info in brackets ignored) > core (all brackets ignored) > partial */
export type TitleMatch = 'exact' | 'edition' | 'core' | 'partial' | 'none';
/** contains: every source artist is in the target, which lists more (e.g. `X performed by Y`) */
export type ArtistMatch =
  | 'exact'
  | 'contains'
  | 'various'
  | 'partial'
  | 'unknown'
  | 'none';
export type YearMatch = 'exact' | 'near' | 'mismatch' | 'unknown';
export type ReleaseTypeMatch = 'match' | 'mismatch' | 'unknown';

export interface GroupMatchDetail {
  title: TitleMatch;
  artist: ArtistMatch;
  year: YearMatch;
  releaseType: ReleaseTypeMatch;
  /** a catalogue number of the release appears in one of the group's torrents */
  catalogue: boolean;
}

export interface GroupCandidate {
  group: REDSearchResultGroup;
  detail: GroupMatchDetail;
  score: number;
  /** strong enough to merge into without asking */
  confident: boolean;
}

/**
 * - merge: exactly one group is a confident match
 * - ambiguous: several groups are confident matches and nothing tells them apart
 * - suggest: some groups look similar, none is a confident match
 * - none: nothing similar was found
 */
export type GroupMatchDecision = 'merge' | 'ambiguous' | 'suggest' | 'none';

export interface GroupMatchResult {
  decision: GroupMatchDecision;
  /** the group to merge into, only when decision is `merge` */
  group?: REDSearchResultGroup;
  /** best first */
  candidates: GroupCandidate[];
}

export const MAX_GROUP_CANDIDATES = 5;

/** release type ids shared by RED, Orpheus and DicMusic */
const RELEASE_TYPES: Record<number, string> = {
  1: 'Album',
  3: 'Soundtrack',
  5: 'EP',
  6: 'Anthology',
  7: 'Compilation',
  9: 'Single',
  11: 'Live album',
  13: 'Remix',
  14: 'Bootleg',
  15: 'Interview',
  16: 'Mixtape',
  17: 'Demo',
  18: 'Concert Recording',
  19: 'DJ Mix',
  21: 'Unknown',
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const APOSTROPHES = /['`\u00b4\u02bc\u2018\u2019]/g;
// ASCII and common Unicode punctuation and symbols. Written as ranges rather
// than \p{…} because the userscript targets old browsers.
const SEPARATORS =
  /[\s\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e\xa1-\xbf\xd7\xf7\u2000-\u206f\u2190-\u2bff\u3000-\u303f\u30fb\uff5f-\uff65]+/g;
const COMBINING_DIACRITICS = /[\u0300-\u036f]/g;
const BRACKETED =
  /\s*(\([^()]*\)|\[[^[\]]*\]|\{[^{}]*\}|【[^【】]*】|〔[^〔〕]*〕)\s*/g;
const DASH_SUFFIX = /^(.*\S)\s+[-\u2013\u2014:]\s+([^-\u2013\u2014:]+)$/;

/**
 * Words that mark a bracketed part (or a ` - …` suffix) of a title as edition
 * information. Gazelle music sites keep every edition in one group, so
 * `Abbey Road (Remastered)` belongs to the group `Abbey Road`.
 * Written in normalized form (see normalizeMusicText).
 */
const EDITION_WORDS = [
  'deluxe',
  'remaster',
  'remastered',
  'remasters',
  'remastering',
  'edition',
  'expanded',
  'anniversary',
  'bonus',
  'bonus track',
  'bonus tracks',
  'reissue',
  're issue',
  'special',
  'limited',
  'collector',
  'collectors',
  'mono',
  'stereo',
  'explicit',
  'clean',
  'version',
  'japan',
  'japanese',
  'import',
  'hi res',
  'hires',
  '24bit',
  '24 bit',
  'ep',
  'single',
  'lp',
  'cd',
  '2cd',
  'vinyl',
  'digital',
  'web',
  'legacy',
  'definitive',
  'complete',
  'extended',
  'super',
  'sacd',
  'shm cd',
  'mqa',
];
const EDITION_WORDS_CJK = [
  '豪华版',
  '重制',
  '复刻',
  '纪念版',
  '限量版',
  '特别版',
  '日版',
  '首版',
  '再版',
  '黑胶',
  '母带',
  '限定盤',
  '通常盤',
  '初回',
  'リマスター',
  'デラックス',
];

const VARIOUS_ARTISTS = new Set([
  'various',
  'various artist',
  'various artists',
  'various djs',
  'various composers',
  'various conductors',
  'va',
  'v a',
  '群星',
]);

const IGNORED_CATALOGUES = new Set([
  'NONE',
  'NA',
  'UNKNOWN',
  'NOCAT',
  'NOCATNO',
]);

/** Decodes the HTML entities that Gazelle puts in names (`&amp;`, `&#39;` …). */
export const decodeHtmlEntities = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith('#')) {
      const isHex = code[1] === 'x' || code[1] === 'X';
      const point = parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      try {
        return String.fromCodePoint(point);
      } catch {
        return entity;
      }
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
  });

/**
 * Normalizes a title or an artist name for comparison: decodes HTML entities,
 * turns full-width characters into half-width ones, drops Latin accents,
 * lowercases, reads `&` as `and`, drops apostrophes and turns other
 * punctuation into spaces.
 */
export const normalizeMusicText = (text: string): string =>
  decodeHtmlEntities(text || '')
    .normalize('NFKC')
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(APOSTROPHES, '')
    .replace(/&/g, ' and ')
    .replace(SEPARATORS, ' ')
    .trim();

/** Falls back to the raw text for titles made of symbols only, like `÷`. */
const titleKey = (text: string): string =>
  normalizeMusicText(text) ||
  decodeHtmlEntities(text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const containsPhrase = (haystack: string, needle: string): boolean =>
  !!needle && ` ${haystack} `.includes(` ${needle} `);

const isEditionText = (text: string): boolean => {
  const normalized = normalizeMusicText(text);
  if (!normalized) {
    return false;
  }
  if (/^\d{4}$/.test(normalized)) {
    return true;
  }
  return (
    EDITION_WORDS.some((word) => containsPhrase(normalized, word)) ||
    EDITION_WORDS_CJK.some((word) => normalized.includes(word))
  );
};

const prepareTitle = (title: string): string =>
  decodeHtmlEntities(title || '')
    .normalize('NFKC')
    .trim();

/** Removes bracketed parts and ` - …` suffixes that only describe the edition. */
export const stripEditionInfo = (title: string): string => {
  let result = prepareTitle(title).replace(BRACKETED, (segment) =>
    isEditionText(segment) ? ' ' : segment,
  );
  const suffix = result.trim().match(DASH_SUFFIX);
  if (suffix && isEditionText(suffix[2])) {
    result = suffix[1];
  }
  return result.replace(/\s+/g, ' ').trim();
};

/** Removes every bracketed part of a title. */
export const stripAllBrackets = (title: string): string =>
  prepareTitle(title).replace(BRACKETED, ' ').replace(/\s+/g, ' ').trim();

export const compareTitles = (source: string, target: string): TitleMatch => {
  const sourceKey = titleKey(source);
  const targetKey = titleKey(target);
  if (!sourceKey || !targetKey) {
    return 'none';
  }
  if (sourceKey === targetKey) {
    return 'exact';
  }
  const sourceEdition = normalizeMusicText(stripEditionInfo(source));
  if (
    sourceEdition &&
    sourceEdition === normalizeMusicText(stripEditionInfo(target))
  ) {
    return 'edition';
  }
  const sourceCore = normalizeMusicText(stripAllBrackets(source));
  const targetCore = normalizeMusicText(stripAllBrackets(target));
  if (sourceCore && sourceCore === targetCore) {
    return 'core';
  }
  const [shorter, longer] =
    sourceCore.length <= targetCore.length
      ? [sourceCore, targetCore]
      : [targetCore, sourceCore];
  if (shorter.length >= 3 && containsPhrase(longer, shorter)) {
    return 'partial';
  }
  return 'none';
};

/** Like normalizeMusicText, also ignoring the word `the` (`The Beatles` = `Beatles`). */
export const normalizeArtistName = (name: string): string => {
  const normalized = normalizeMusicText(name);
  const withoutThe = normalized
    .replace(/(^| )the(?= |$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return withoutThe || normalized;
};

const unique = <T>(items: T[]): T[] => Array.from(new Set(items));

/**
 * The artists a Gazelle site shows as the group's artist: the DJs when there
 * are any, otherwise the main artists, otherwise the composers and conductors.
 */
export const getPrimaryArtists = (
  musicInfo?: Partial<MusicJson.MusicInfo>,
): string[] => {
  if (!musicInfo) {
    return [];
  }
  const names = (people?: MusicJson.People[]) =>
    (people ?? []).map((person) => person?.name).filter(Boolean) as string[];
  const dj = names(musicInfo.dj);
  if (dj.length > 0) {
    return dj;
  }
  const main = names(musicInfo.artists);
  if (main.length > 0) {
    return main;
  }
  return [...names(musicInfo.composers), ...names(musicInfo.conductor)];
};

export const compareArtists = (
  musicInfo: Partial<MusicJson.MusicInfo> | undefined,
  target: Pick<REDSearchResultGroup, 'artist' | 'torrents'>,
): ArtistMatch => {
  const primary = unique(
    getPrimaryArtists(musicInfo).map(normalizeArtistName).filter(Boolean),
  );
  if (primary.length === 0) {
    return 'unknown';
  }
  const display = normalizeArtistName(target.artist ?? '');
  const listed = unique(
    (target.torrents ?? [])
      .flatMap((torrent) => torrent?.artists ?? [])
      .map((artist) => normalizeArtistName(artist?.name ?? ''))
      .filter(Boolean),
  );
  if (!display && listed.length === 0) {
    return 'unknown';
  }

  // the torrents of a browse result may list the main artists one by one
  const main = unique(
    (musicInfo?.artists ?? [])
      .map((artist) => normalizeArtistName(artist?.name ?? ''))
      .filter(Boolean),
  );
  if (listed.length > 0 && main.length > 0) {
    const common = main.filter((name) => listed.includes(name));
    if (common.length === main.length && common.length === listed.length) {
      return 'exact';
    }
    if (common.length === main.length) {
      return 'contains';
    }
    if (common.length > 0) {
      return 'partial';
    }
  }

  if (!display) {
    return listed.length > 0 ? 'none' : 'unknown';
  }
  const sourceIsVarious =
    primary.length >= 3 || primary.some((name) => VARIOUS_ARTISTS.has(name));
  if (VARIOUS_ARTISTS.has(display)) {
    return sourceIsVarious ? 'various' : 'none';
  }
  const found = primary.filter((name) => containsPhrase(display, name));
  if (primary.length >= 3) {
    // the site would normally show `Various Artists`
    return found.length > 0 ? 'partial' : 'none';
  }
  if (found.length === primary.length) {
    const joined = [
      primary.join(' and '),
      [...primary].reverse().join(' and '),
    ];
    return joined.includes(display) ? 'exact' : 'contains';
  }
  return found.length > 0 ? 'partial' : 'none';
};

export const compareYears = (source?: number, target?: number): YearMatch => {
  const a = Number(source) || 0;
  const b = Number(target) || 0;
  if (!a || !b) {
    return 'unknown';
  }
  const diff = Math.abs(a - b);
  if (diff === 0) {
    return 'exact';
  }
  return diff === 1 ? 'near' : 'mismatch';
};

const KNOWN_RELEASE_TYPES = new Set(
  Object.values(RELEASE_TYPES).map(normalizeMusicText),
);

/** Release type id or name → normalized name, '' when unknown. */
export const getReleaseTypeName = (value?: string | number | null): string => {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  const text = String(value).trim();
  const name = /^\d+$/.test(text) ? (RELEASE_TYPES[Number(text)] ?? '') : text;
  const normalized = normalizeMusicText(name);
  return KNOWN_RELEASE_TYPES.has(normalized) && normalized !== 'unknown'
    ? normalized
    : '';
};

export const compareReleaseTypes = (
  source?: string | number | null,
  target?: string | number | null,
): ReleaseTypeMatch => {
  const a = getReleaseTypeName(source);
  const b = getReleaseTypeName(target);
  if (!a || !b) {
    return 'unknown';
  }
  return a === b ? 'match' : 'mismatch';
};

export const normalizeCatalogueNumber = (value?: string | null): string => {
  const normalized = decodeHtmlEntities(value ?? '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');
  return normalized.length >= 3 && !IGNORED_CATALOGUES.has(normalized)
    ? normalized
    : '';
};

export const hasSameCatalogueNumber = (
  release: MusicRelease,
  target: Pick<REDSearchResultGroup, 'torrents'>,
): boolean => {
  const source = [
    release.torrent?.remasterCatalogueNumber,
    release.group?.catalogueNumber,
  ]
    .map(normalizeCatalogueNumber)
    .filter(Boolean);
  if (source.length === 0) {
    return false;
  }
  return (target.torrents ?? []).some((torrent) =>
    source.includes(normalizeCatalogueNumber(torrent?.remasterCatalogueNumber)),
  );
};

const TITLE_SCORE: Record<TitleMatch, number> = {
  exact: 40,
  edition: 34,
  core: 22,
  partial: 12,
  none: 0,
};
const ARTIST_SCORE: Record<ArtistMatch, number> = {
  exact: 30,
  contains: 26,
  various: 18,
  partial: 12,
  unknown: 6,
  none: 0,
};
const YEAR_SCORE: Record<YearMatch, number> = {
  exact: 15,
  near: 6,
  unknown: 3,
  mismatch: -10,
};
const RELEASE_TYPE_SCORE: Record<ReleaseTypeMatch, number> = {
  match: 10,
  unknown: 0,
  mismatch: -20,
};
const CATALOGUE_SCORE = 15;

/**
 * Confident means: the same title (edition info aside), the same artists, the
 * same year (or the same catalogue number), and no conflicting release type.
 */
export const isConfidentMatch = (detail: GroupMatchDetail): boolean => {
  const titleOk = detail.title === 'exact' || detail.title === 'edition';
  const artistOk =
    detail.artist === 'exact' ||
    detail.artist === 'contains' ||
    (detail.artist === 'various' &&
      (detail.title === 'exact' || detail.catalogue));
  const yearOk = detail.year === 'exact' || detail.catalogue;
  return titleOk && artistOk && yearOk && detail.releaseType !== 'mismatch';
};

/** Whether a group is worth showing to the user as a possible match. */
export const isPossibleMatch = (detail: GroupMatchDetail): boolean => {
  if (detail.title === 'none') {
    return false;
  }
  const artistEvidence =
    detail.artist === 'exact' ||
    detail.artist === 'contains' ||
    detail.artist === 'various' ||
    detail.artist === 'partial';
  if (artistEvidence) {
    return !(detail.title === 'partial' && detail.artist === 'partial');
  }
  // same title and year, artist spelled differently (romanization, alias …)
  const strongTitle = detail.title === 'exact' || detail.title === 'edition';
  return strongTitle && (detail.year === 'exact' || detail.catalogue);
};

export const scoreGroup = (
  release: MusicRelease,
  group: REDSearchResultGroup,
): GroupCandidate => {
  const detail: GroupMatchDetail = {
    title: compareTitles(release.group?.name ?? '', group.groupName ?? ''),
    artist: compareArtists(release.group?.musicInfo, group),
    year: compareYears(release.group?.year, group.groupYear),
    releaseType: compareReleaseTypes(
      release.group?.releaseType,
      group.releaseType,
    ),
    catalogue: hasSameCatalogueNumber(release, group),
  };
  const score =
    TITLE_SCORE[detail.title] +
    ARTIST_SCORE[detail.artist] +
    YEAR_SCORE[detail.year] +
    RELEASE_TYPE_SCORE[detail.releaseType] +
    (detail.catalogue ? CATALOGUE_SCORE : 0);
  return { group, detail, score, confident: isConfidentMatch(detail) };
};

/** Ranks confident matches against each other: catalogue number, then exact title. */
const confidenceRank = ({ detail }: GroupCandidate): number =>
  (detail.catalogue ? 2 : 0) + (detail.title === 'exact' ? 1 : 0);

export const matchExistingGroup = (
  release: MusicRelease,
  groups: REDSearchResultGroup[],
): GroupMatchResult => {
  const seen = new Set<number>();
  const candidates = groups
    .filter((group) => {
      if (!group || !group.groupId || seen.has(group.groupId)) {
        return false;
      }
      seen.add(group.groupId);
      return true;
    })
    .map((group) => scoreGroup(release, group))
    .filter((candidate) => isPossibleMatch(candidate.detail))
    .sort(
      (a, b) =>
        Number(b.confident) - Number(a.confident) ||
        confidenceRank(b) - confidenceRank(a) ||
        b.score - a.score,
    );

  const confident = candidates.filter((candidate) => candidate.confident);
  if (confident.length > 0) {
    const best = confidenceRank(confident[0]);
    const top = confident.filter(
      (candidate) => confidenceRank(candidate) === best,
    );
    if (top.length === 1) {
      return {
        decision: 'merge',
        group: top[0].group,
        candidates: candidates.slice(0, MAX_GROUP_CANDIDATES),
      };
    }
    return {
      decision: 'ambiguous',
      candidates: candidates.slice(0, MAX_GROUP_CANDIDATES),
    };
  }
  if (candidates.length > 0) {
    return {
      decision: 'suggest',
      candidates: candidates.slice(0, MAX_GROUP_CANDIDATES),
    };
  }
  return { decision: 'none', candidates: [] };
};

/** Turns text into words for the site's search box (no brackets or punctuation). */
export const toSearchText = (text: string): string =>
  decodeHtmlEntities(text || '')
    .normalize('NFKC')
    .replace(APOSTROPHES, ' ')
    .replace(SEPARATORS, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * The searches to run, most specific first: artist + title, then title + year.
 * Bracketed parts are left out of the title because the site requires every
 * word to match, so `Abbey Road (Remastered)` would miss the group `Abbey Road`.
 */
export const buildGroupSearchQueries = (
  group: MusicJson.GroupInfo,
): string[] => {
  const name = decodeHtmlEntities(group?.name ?? '');
  const title =
    toSearchText(stripAllBrackets(name)) || toSearchText(name) || name.trim();
  if (!title) {
    return [];
  }
  const queries: string[] = [];
  const artists = getPrimaryArtists(group.musicInfo);
  if (artists.length > 0 && artists.length <= 2) {
    const artist = toSearchText(artists[0]);
    if (artist) {
      queries.push(`${artist} ${title}`);
    }
  }
  queries.push(group.year ? `${title} ${group.year}` : title);
  return unique(queries);
};

/**
 * Runs the searches one by one until a group is a confident match, and
 * matches the release against every group found.
 */
export const findExistingGroup = async (
  release: MusicRelease,
  search: (query: string) => Promise<REDSearchResultResponse | undefined>,
): Promise<GroupMatchResult> => {
  const groups: REDSearchResultGroup[] = [];
  let result: GroupMatchResult = { decision: 'none', candidates: [] };
  for (const query of buildGroupSearchQueries(release.group)) {
    try {
      const response = await search(query);
      const results = response?.response?.results;
      if (response?.status === 'success' && Array.isArray(results)) {
        groups.push(...results);
      }
    } catch (error) {
      console.error('[easy-upload] music group search failed', query, error);
    }
    result = matchExistingGroup(release, groups);
    if (result.decision === 'merge') {
      break;
    }
  }
  return result;
};
