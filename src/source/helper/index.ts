import { htmlToBBCode } from '@/common';
import { CONFIG } from '@/source/config';
import { MediaInfo } from '@/common/media/media.type';
import { MediaDetail } from '@/source/types';

/**
 * format torrent title to remove dots
 *
 * @param {string} title
 * @returns {string}
 */
export const formatTorrentTitle = (title: string): string => {
  // preserve the dot in 5.1 H.264
  return (
    title
      // replace all dots except which are followed by digits (e.g. The.Matrix => The Matrix)
      .replace(/\.(?!(\d+))/gi, ' ')
      // replace all dots followed by digits (e.g. 1080p.BluRay => 1080p BluRay .5.1 => 5.1)
      .replace(/\.(?=\d{4}|48|57|72|2k|4k|7.1|6.1|5.1|4.1|2.0|1.0)/gi, ' ')
      .trim()
  );
};

/**
 * filter some unuseful statements from bbcode
 *
 * @param {Element} content
 * @returns {string}
 */
export const getFilterBBCode = (content: Element): string => {
  if (content) {
    const bbCodes = htmlToBBCode(content);
    return (
      bbCodes?.replace(/\[quote\]((.|\n)*?)\[\/quote\]/g, (match, p1) => {
        if (p1) {
          return CONFIG.NEXUS_FILTER_KEYWORDS.some((keyword) =>
            p1.includes(keyword),
          )
            ? ''
            : match;
        }
        return match;
      }) ?? ''
    );
  }
  return '';
};

/**
 * format video category
 *
 * @param {TorrentInfo.Info} torrentInfo
 * @param {string} category
 * @returns {string}
 */
export const refineCategory = (
  torrentInfo: TorrentInfo.Info,
  category: string,
) => {
  const { description, title, subtitle = '', doubanInfo } = torrentInfo;

  const isAnimation = (genre: string) => /动画/.test(genre);
  const isDocumentary = (genre: string) => /纪录/.test(genre);
  const isSeasonPack = (title: string, subtitle: string) =>
    /全.+?集/.test(subtitle) || title?.match(/s\d+(\s|\.)+/i)?.length;
  const isEpisode = (title: string, subtitle: string) =>
    /(s0?\d{1,2})?e(p)?\d{1,2}/i.test(title) || /第[^\s]集/.test(subtitle);

  const movieGenre =
    (description + doubanInfo).match(/(类\s+别)\s+(.+)?/)?.[2] ?? '';
  if (isAnimation(movieGenre)) {
    return 'cartoon';
  }
  if (isDocumentary(movieGenre)) {
    return 'documentary';
  }
  if (isSeasonPack(title, subtitle)) {
    return 'tvPack';
  }
  if (category?.match(/tv/)) {
    return isEpisode(title, subtitle) ? 'tv' : 'tvPack';
  }
  return category;
};

/**
 * get video type from source
 *
 * @param {string} source
 * @returns {string}
 */
export const getVideoTypeFromSource = (
  source: string,
  resolution?: string,
): string => {
  if (!source) {
    return '';
  }
  const normalized = source.replace(/[.-]/g, '').toLowerCase();
  for (const { regex, type, condition } of CONFIG.VIDEO_TYPE_MATCH_MAP(
    resolution,
  )) {
    if (regex.test(normalized) && (!condition || condition())) {
      return type;
    }
  }
  return '';
};

/**
 * get video source from title
 *
 * @param {string} title
 * @returns {string}
 */
export const getVideoSourceFromTitle = (title: string): string => {
  for (const [key, reg] of Object.entries(CONFIG.VIDEO_SOURCE_MATCH_MAP)) {
    if (reg.test(title)) {
      return key;
    }
  }
  return 'other';
};

/**
 * get media info from description bbcode
 *
 * @param {string} bbcode
 * @returns {{ bdInfo: string[]; mediaInfo: string[] }}
 */
export const getBDInfoOrMediaInfoFromBBCode = (
  bbcode: string,
): { bdInfo: string[]; mediaInfo: string[] } => {
  const quoteList: string[] = [];
  const quoteRegex = /\[quote\]([^[\]])+?\[\/quote\]/gi;
  while (bbcode?.match(quoteRegex)?.length) {
    const matchContent = bbcode?.match(quoteRegex)?.[0] ?? '';
    quoteList.push(matchContent);
    bbcode = bbcode.replace(matchContent, '');
  }
  const cleanQuoteContent = (quote: string) =>
    quote
      .replace(/\[\/?quote\]/g, '')
      .replace(/\u200D/g, '')
      .trim();

  const isBDInfo = (content: string) =>
    /Disc\s?Size|\.mpls/i.test(content) ||
    /Disc\s+(Info|Title|Label)[^[]+/i.test(content);

  const isMediaInfo = (content: string) =>
    /(Unique\s*ID)|(Codec\s*ID)|(Stream\s*size)/i.test(content);

  const { bdInfo, mediaInfo } = quoteList.reduce(
    (acc, quote) => {
      const content = cleanQuoteContent(quote);
      if (isBDInfo(content)) {
        acc.bdInfo.push(content);
      }
      if (isMediaInfo(content)) {
        acc.mediaInfo.push(content);
      }
      return acc;
    },
    { bdInfo: [] as string[], mediaInfo: [] as string[] },
  );

  // fallback if bdinfo is empty
  if (!bdInfo.length) {
    const fallback = bbcode
      .match(/Disc\s+(Info|Title|Label)[^[]+/i)?.[0]
      ?.trim();
    if (fallback) {
      bdInfo.push(fallback);
    }
  }

  return { bdInfo, mediaInfo };
};

/**
 * extract media details from media info
 *
 * @param {MediaInfo} source
 * @returns {(MediaDetail | null)}
 */
export const extractDetailsFromMediaInfo = (
  source: MediaInfo,
): MediaDetail | null => {
  if (!source) {
    return null;
  }
  const result: MediaDetail = {
    videoCodec: source.videoTracks?.[0]?.codec,
    audioCodec: source.audioTracks?.[0]?.codec,
    resolution: source.videoTracks?.[0]?.resolution,
    audioChannels: source.audioTracks?.[0]?.channelName,
    audioLanguages: source.audioTracks.map((track) => track.language),
    subtitleLanguages: source.subtitleTracks.map((track) => track.language),
    hdrFormats: source.videoTracks
      .map((track) => track?.hdrType ?? '')
      .filter(Boolean),
  };
  return result;
};

/**
 * get media tags from media detail
 *
 * @param {MediaDetail} param0 - MediaDetail
 * @param {MediaDetail} param0.audioCodec
 * @param {MediaDetail} param0.audioLanguages
 * @param {MediaDetail} param0.subtitleLanguages
 * @param {MediaDetail} param0.hdrFormats
 * @returns {TorrentInfo.MediaTags}
 */
export const getMediaTags = ({
  audioCodec,
  audioLanguages,
  subtitleLanguages,
  hdrFormats,
}: MediaDetail): TorrentInfo.MediaTags => {
  const hasChineseAudio = audioLanguages.includes('Chinese');
  const hasChineseSubtitle = subtitleLanguages.includes('Chinese');
  const hasCantoneseAudio = audioLanguages.includes('Cantonese');
  const mediaTags: TorrentInfo.MediaTags = {};
  if (hasChineseAudio) mediaTags.chinese_audio = true;
  if (hasCantoneseAudio) mediaTags.cantonese_audio = true;
  if (hasChineseSubtitle) mediaTags.chinese_subtitle = true;

  const hdrMap = {
    HDR10: 'hdr10',
    HDR: 'hdr',
    HLG: 'hlg',
    DV: 'dolby_vision',
  };
  if (hdrFormats) {
    for (const [key, value] of Object.entries(hdrMap)) {
      if (hdrFormats.includes(key)) {
        mediaTags[value as keyof TorrentInfo.MediaTags] = true;
      }
    }
  }
  if (/dtsx|atmos/gi.test(audioCodec)) {
    mediaTags.dts_x = true;
  } else if (/atmos/gi.test(audioCodec)) {
    mediaTags.dolby_atmos = true;
  }
  return mediaTags;
};

export const getTagsFromSource = (source: string) => {
  const tags: TorrentInfo.MediaTags = {};

  for (const rule of CONFIG.MEDIA_TAG_RULES(source)) {
    if (rule.regex.test(source) && (!rule.condition || rule.condition())) {
      tags[rule.tag as keyof TorrentInfo.MediaTags] = true;
    }
  }

  return tags;
};

/**
 * get resolution from source string
 *
 * @param {string} source
 * @returns {string}
 */
export const getResolutionFromSource = (source: string): string => {
  for (const [resolution, reg] of Object.entries(CONFIG.RESOLUTION_MAP)) {
    if (reg.test(source)) {
      return resolution;
    }
  }
  return '';
};

/**
 * get video codec from source and video type
 *
 * @param {string} source
 * @param {string} [videoType='']
 * @returns {*}
 */
export const getVideoCodecFromSourceAndVideoType = (
  source: string,
  videoType = '',
) => {
  const formattedSource = source.replace(/\.|-/g, '');
  for (const { codec, regex, condition } of CONFIG.VIDEO_CODEC_RULES(
    formattedSource,
    videoType,
  )) {
    if (regex.test(formattedSource) || (condition && condition())) {
      return codec;
    }
  }
  return '';
};

/**
 * get category from source
 *
 * @param {string} source
 * @returns {string}
 */
export const getCategoryFromSource = (source: string): string => {
  if (!source) {
    return '';
  }
  const formattedSource = source.replace(/[.-]/g, '').toLowerCase();
  for (const [key, reg] of Object.entries(CONFIG.VIDEO_CATEGORY_MAP)) {
    if (reg.test(formattedSource)) {
      return key;
    }
  }
  return '';
};

export const replaceRegSymbols = (string: string) => {
  return string.replace(/([*.?+$^[\](){}|\\/])/g, '\\$1');
};
