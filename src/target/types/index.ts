export type SelectFillKey =
  | 'videoCodec'
  | 'videoType'
  | 'resolution'
  | 'source'
  | 'area';

export enum SiteIMDbType {
  Standard = 'standard',
  StripTT = 'strip_tt',
  UNIT3D = 'unit3d',
  IMDbID = 'imdb_id',
}

export const siteIMDbTypeMap: Record<string, SiteIMDbType> = {
  HDRoute: SiteIMDbType.StripTT,
  HDSpace: SiteIMDbType.StripTT,
  BeyondHD: SiteIMDbType.IMDbID,
  Blutopia: SiteIMDbType.UNIT3D,
  Cinematik: SiteIMDbType.UNIT3D,
  fearnopeer: SiteIMDbType.UNIT3D,
  HDPOST: SiteIMDbType.UNIT3D,
  ACM: SiteIMDbType.UNIT3D,
  Aither: SiteIMDbType.UNIT3D,
  Concertos: SiteIMDbType.UNIT3D,
  MDU: SiteIMDbType.UNIT3D,
  LST: SiteIMDbType.UNIT3D,
  HUNO: SiteIMDbType.UNIT3D,
};

/**
 * A torrent inside a group of `ajax.php?action=browse` on Gazelle music sites
 * (RED, Orpheus, DicMusic). Only the fields used for group matching are
 * listed, and all of them are optional because the sites differ.
 */
export interface REDSearchResultTorrent {
  torrentId?: number;
  artists?: { id?: number; name: string; aliasid?: number }[];
  remastered?: boolean;
  remasterYear?: number;
  remasterTitle?: string;
  remasterRecordLabel?: string;
  remasterCatalogueNumber?: string;
  media?: string;
  format?: string;
  encoding?: string;
}

export interface REDSearchResultGroup {
  groupId: number;
  groupName: string;
  /** display name, e.g. `A & B`, `Various Artists`, HTML-escaped */
  artist: string;
  groupYear: number;
  /** a name such as `Album` on RED and Orpheus, may be a number elsewhere */
  releaseType?: string | number;
  torrents?: REDSearchResultTorrent[];
}

export interface REDSearchResultResponse {
  status: string;
  response: {
    results: REDSearchResultGroup[];
  };
}
