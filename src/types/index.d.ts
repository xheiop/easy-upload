/* eslint-disable @typescript-eslint/no-explicit-any */
/// <reference types="tampermonkey" />

declare namespace TorrentInfo {
  interface MediaTags {
    hdr10?: boolean;
    hdr10_plus?: boolean;
    hlg?: boolean;
    dolby_vision?: boolean;
    chinese_audio?: boolean;
    cantonese_audio?: boolean;
    chinese_subtitle?: boolean;
    dts_x?: boolean;
    dolby_atmos?: boolean;
    diy?: boolean;
    the_criterion_collection?: boolean;
    exclusive?: boolean;
    '2_disc_set'?: boolean;
    '2d_3d_edition'?: boolean;
    '2_in_1'?: boolean;
    '3d_anaglyph'?: boolean;
    '3d_full_sbs'?: boolean;
    '3d_half_ou'?: boolean;
    '3d_half_sbs'?: boolean;
    '4k_remaster'?: boolean;
    '4k_restoration'?: boolean;
    director_s_cut?: boolean;
    dual_audio?: boolean;
    english_dub?: boolean;
    extended_edition?: boolean;
    extras?: boolean;
    masters_of_cinema?: boolean;
    scene?: boolean;
    theatrical_cut?: boolean;
    two_disc_set?: boolean;
    remux?: boolean;
    rifftrax?: boolean;
    uncut?: boolean;
    unrated?: boolean;
    warner_archive_collection?: boolean;
    with_commentary?: boolean;
    '10_bit'?: boolean;
  }
  interface comparison {
    title?: string;
    imgs: string[];
    reason?: string;
  }

  interface BookInfo {
    year: string;
    pager: string;
    translator: string[];
    author: string[];
    publisher: string;
    ISBN: string;
    book_intro: string;
    poster: string;
  }
  interface Info {
    title: string; // 标题
    subtitle?: string; // 副标题
    description: string; // 描述
    originalDescription?: string; // 原始描述
    year: string; // 电影年份
    category: string; // 电影、电视、音乐等
    videoType: string; // bluray remux encodes web-dl
    format?: string; // 文件格式
    source: string; // 视频来源
    videoCodec?: string; // 视频编码
    audioCodec?: string; // 音频编码
    resolution: string; // 分辨率
    area?: string; // 地区
    doubanUrl?: string; // 豆瓣地址
    doubanInfo?: string; // 豆瓣简介
    imdbUrl?: string; // imdb地址
    mediaInfos: Array<string>; // 多个mediainfo
    screenshots: Array<string>;
    comparisons?: Array<comparison>; // 对比图
    movieAkaName?: string; // 别名一般为电影英文名称
    movieName: string; // imdb电影原始名称 一般为拼音
    sourceSite: string; // 种子来源站点简称
    sourceSiteType: string; // 种子来源站点类型
    size: number; // 种子大小 转换成 Bytes
    isForbidden?: boolean; // 是否禁转
    poster?: string; // 海报
    tags: MediaTags;
    otherTags?: Record<string, boolean>;
    hardcodedSub?: boolean; // 是否包含硬字幕
    doubanBookInfo?: BookInfo;
    torrentData?: string;
    torrentUrl?: string;
    musicJson?: {
      group: MusicJson.GroupInfo;
      torrent: MusicJson.Torrent;
    };
    musicInfo?: {
      name: string;
      tags: string[];
      artists: string[];
      media: string;
      encoding: string;
      log: string[];
    };
    image?: string;
  }

  interface TargetTorrentInfo extends Info {
    isBluray?: boolean;
    imdbId?: string;
    image?: string;
  }
}
declare namespace Site {
  interface Selector {
    selector: string;
  }
  interface SelectorMap {
    selector: string;
    map: {
      [key: string]: string | string[];
    };
  }
  interface SiteInfo {
    url: string;
    host: string;
    siteType: string;
    icon: string;
    asSource: boolean;
    asTarget: boolean;
    uploadPath: string;
    seedDomSelector: string;
    torrentDownloadLinkSelector?: string;
    needDoubanInfo?: boolean;
    needDoubanBookInfo?: boolean;
    douban: Selector;
    area: SelectorMap;
    mediaInfo: Selector;
    bdinfo: Selector;
    screenshots: Selector;
    tmdb: Selector;
    poster: string;
    format: SelectorMap;
    image: Selector;
    source: SelectorMap;
    tags: {
      [key: string]: string;
    };
    search: {
      path: string;
      replaceKey?: string[];
      imdbOptionKey?: string;
      nameOptionKey?: string;
      params?: {
        [key: string]: string;
      };
      result?: {
        [key: string]: string;
      };
    };
    name: Selector;
    subtitle: Selector;
    description: Selector;
    imdb: Selector;
    anonymous?: {
      selector: string;
      value?: string;
    };
    torrent?: {
      selector: string;
      announce?: string;
    };
    torrentLink?: string;
    category: SelectorMap;
    videoCodec: SelectorMap;
    audioCodec: SelectorMap;
    videoType: SelectorMap;
    resolution: SelectorMap;
    team: SelectorMap;
  }
}
declare namespace Douban {
  interface Person {
    name: string;
  }
  interface DoubanData {
    imdbLink: string;
    imdbId: string;
    imdbAverageRating: string;
    imdbVotes: string;
    imdbRating: string;
    chineseTitle: string;
    foreignTitle: string;
    aka: string[];
    transTitle: string[];
    thisTitle: string[];
    year: string;
    playDate: string[];
    region: string;
    genre: string[];
    language: string[];
    episodes: string;
    duration: string;
    introduction: string;
    doubanLink: string;
    doubanRatingAverage: string | number;
    doubanVotes: string;
    doubanRating: string;
    poster: string;
    director: Person[];
    cast: Person[];
    writer: Person[];
    awards?: string;
    tags?: string[];
    format?: string;
    credits?: MobileCredits[];
  }

  interface BookData {
    year: string;
    pager: string;
    translator: string[];
    author: string[];
    publisher: string;
    ISBN: string;
    book_intro: string;
    poster: string;
    chineseTitle: string;
    foreignTitle: string;
  }
  interface DataInfo {
    poster: string;
    name: string;
    genre: string;
    description: string;
    language: string;
    country: string;
    shareImage: string;
  }
  interface MobilePerson {
    name: string;
  }

  interface MobilePic {
    large: string;
    normal: string;
  }

  interface Celebrity {
    latin_name: string;
    name: string;
    cover_url: string;
    abstract: string;
    url: string;
  }
  interface MobileCredits {
    title: string;
    celebrities: Celebrity[];
  }
  interface Rating {
    count: number;
    max: number;
    start_count: number;
    value: number;
  }
  interface DoubanMobileData {
    rating: Rating;
    pubdate: string[];
    pic: MobilePic;
    is_tv: boolean;
    year: string;
    card_subtitle: string;
    id: string;
    languages: string[];
    genres: string[];
    title: string;
    intro: string;
    actors: MobilePerson[];
    durations: string[];
    cover_url: string;
    countries: string[];
    type: 'movie' | 'tv';
    url: string;
    original_title: string;
    directors: MobilePerson[];
    aka: string[];
    episodes_info: string;
    episodes_count: number;
    credits: MobileCredits[];
    awards: string;
  }
  interface Season {
    season: string;
    title: string;
    id: string;
  }
}

declare namespace IMDB {
  interface People {
    url: string;
    name: string;
  }

  interface Aka {
    country: string;
    title: string;
  }

  interface Detail {
    'Release date': string;
    Languages: string;
    'Also known as': string;
    country: string;
  }

  interface ImdbData {
    name: string;
    year: string;
    genre: string[];
    directors: People[];
    actors: People[];
    description: string;
    poster: string;
    details: Detail;
    aka: Aka[];
    imdb_rating_average: string;
  }
}

declare namespace MusicJson {
  interface Info {
    response: {
      group: GroupInfo;
      torrent: Torrent;
    };
    status: string;
  }
  interface GroupInfo {
    bbBody: string;
    categoryId: 1 | 2 | 3 | 4 | 5 | 6 | 7;
    categoryName:
      | 'Music'
      | 'Applications'
      | 'E-Books'
      | 'Audiobooks'
      | 'E-Learning Videos'
      | 'Comedy'
      | 'Comics';
    id: number;
    musicInfo: MusicInfo;
    name: string;
    tags: string[];
    wikiBody: string;
    wikiBBcode?: string; // Orpheus
    wikiImage: string;
    year: number;
    releaseType:
      | 1
      | 3
      | 5
      | 6
      | 7
      | 9
      | 11
      | 13
      | 14
      | 15
      | 16
      | 17
      | 18
      | 19
      | 21;
    recordLabel: string;
    catalogueNumber: string;
  }
  interface Torrent {
    description: string;
    encoding:
      | '192'
      | 'APS (VBR)'
      | 'V2 (VBR)'
      | 'V1 (VBR)'
      | 'APX (VBR)'
      | 'V0 (VBR)'
      | '320'
      | 'Lossless'
      | '24bit Lossless';
    format: 'MP3' | 'FLAC' | 'AAC' | 'AC3' | 'DTS';
    categoryName: string;
    id: number;
    media:
      | 'CD'
      | 'DVD'
      | 'Vinyl'
      | 'Soundboard'
      | ' SACD'
      | 'DAT'
      | 'Cassette'
      | 'WEB'
      | 'Blu-Ray';
    size: number;
    remasterYear: number;
    remasterRecordLabel: string;
    remasterCatalogueNumber: string;
    scene: boolean;
    remastered: boolean;
    remasterTitle: string;
    logScore: number;
    log: string[];
    ripLogIds: string[];
  }
  interface MusicInfo {
    artists: People[];
    with: People[];
    composers: People[];
    conductor: People[];
    dj: People[];
    producer: People[];
    remixedBy: People[];
  }
  interface People {
    id: number;
    name: string;
    type?: string;
  }
}

declare module '*.svg';
declare module '*.css';

declare function Remaster(): void;
declare function AutoFill(): void;
declare function fill_field(selector: number, value: string): void;
declare function add_screenshot(): void;
declare function fillField(selector: string, value: string): void;
declare function getcheckboxvalue(selector: string): void;
declare function getradiovalue(selector: string): void;
declare function AddArtistField(): void;
declare function AddLogField(formats: string): void;
declare let CKEDITOR: any;
declare let layui: any;
declare let tinymce: any;
