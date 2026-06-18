import {
  GMFetch,
  sanitizeTorrentToDataUrl,
  TORRENT_CONTENT_TYPE,
} from '@/common';
import { CURRENT_SITE_INFO } from '@/const';

export const hydrateTorrentDataFromUrl = async (
  info: TorrentInfo.Info,
): Promise<TorrentInfo.Info> => {
  if (info.torrentData || !info.torrentUrl) {
    return info;
  }

  try {
    const torrentFile = await GMFetch<ArrayBuffer>(info.torrentUrl, {
      method: 'GET',
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    const announceUrl = CURRENT_SITE_INFO?.torrent?.announce;

    return {
      ...info,
      torrentData: await sanitizeTorrentToDataUrl(torrentFile, announceUrl),
    };
  } catch (error) {
    console.error('fail to fetch torrent from torrentUrl', error);
    return info;
  }
};

/**
 * transform base64 string to blob
 *
 * @param {string} base64
 * @param {string} [contentType='application/x-bittorrent']
 * @param {number} [sliceSize=512]
 * @returns {Blob}
 */
export const base64ToBlob = (
  base64: string,
  contentType = TORRENT_CONTENT_TYPE,
  sliceSize = 512,
): Blob => {
  const regStr = new RegExp(`data:${contentType};base64,`, 'i');
  const byteCharacters = window.atob(base64.replace(regStr, ''));
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);

    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
};

/**
 * filter empty bbcode tags for description
 *
 * @param {string} description
 * @returns {string}
 */
export const filterEmptyTags = (description: string): string => {
  // eslint-disable-next-line prefer-regex-literals
  const reg = new RegExp(
    '\\[(?!info)([a-zA-Z]+\\d?)(?:=(?:\\w|\\s)+)?\\]\\s*\\[\\/(\\w+)\\]',
    'g',
  );
  if (description.match(reg)) {
    description = description.replace(reg, (_match, p1, p2) => {
      if (p1 === p2) {
        return '';
      }
      return _match;
    });
    return filterEmptyTags(description);
  }
  return description;
};

export const getTeamName = (title: string) => {
  const teamMatch = title.match(/-([^-]+)$/);
  let teamName = teamMatch?.[1]?.replace(/-/g, '')?.split('@') ?? '';
  if (teamName) {
    teamName = teamName.length > 1 ? teamName[1] : teamName[0];
  } else {
    teamName = 'other';
  }
  return teamName;
};

export const fixTorrentTitle = (title: string, isWebSource: boolean) => {
  let fixedTitle = title.replace(' DoVi ', ' DV ').replace(' DDP ', ' DD+ ');
  if (isWebSource) fixedTitle = fixedTitle.replace(' HEVC', ' H.265');
  return fixedTitle;
};

export const extractChineseMovieName = (
  description: string,
  subtitle: string,
) => {
  const originalName = description.match(/(片\s+名)\s+(.+)?/)?.[2] ?? '';
  const translateName =
    description.match(/(译\s+名)\s+(.+)/)?.[2]?.split('/')?.[0] ?? '';
  let chineseName = originalName;
  if (!originalName.match(/[\u4e00-\u9fa5]+/)) {
    chineseName = translateName.match(/[\u4e00-\u9fa5]+/) ? translateName : '';
  }
  if (chineseName === '' && subtitle !== '' && subtitle !== undefined) {
    chineseName = subtitle?.replace(/【|】.*/g, '').split('/')?.[0] ?? '';
  }
  return chineseName?.trim() ?? '';
};

export const replaceAlignTagsToQuote = (description: string) => {
  description = description
    .replace(/\[(right|left|center)\]/gi, '[quote]')
    .replace(/\[\/(right|left|center)\]/gi, '[/quote]');
  return description;
};

export const filterNexusDescription = (
  description: string,
  screenshots: string[],
) => {
  let filterDescription = '';
  const quoteList = description.match(/\[quote(=\w+)?\](.|\n)+?\[\/quote\]/g);
  if (quoteList && quoteList.length > 0) {
    quoteList.forEach((quote) => {
      const isMediaInfoOrBDInfo = quote.match(
        /Disc\s?Size|\.mpls|Unique\s?ID|唯一ID|Resolution/i,
      );
      if (!quote.match(/[\u4e00-\u9fa5]+/i) || isMediaInfoOrBDInfo) {
        filterDescription += `${quote}\n`;
      }
    });
  }
  if (screenshots.length > 0) {
    filterDescription += `\n${screenshots.map((v) => `[img]${v}[/img]`).join('\n')}\n\n`;
  }
  return filterDescription;
};

export const buildPTPDescription = (info: TorrentInfo.Info) => {
  let text = info.originalDescription || '';

  // http://ptpimg
  text = text.replace(/http:\/\/ptpimg\.me/g, 'https://ptpimg.me');

  // mediainfo
  for (const mediainfo of info.mediaInfos as string[]) {
    text = text.replace(mediainfo, '');
  }
  text = text.replace(
    /\[(mediainfo|bdinfo)\][\s\S]*?\[\/(mediainfo|bdinfo)\]/gi,
    '',
  );

  // imgUrl without [img]
  text = text.replace(
    /^(?!\[img\])https:\/\/ptpimg.me.*?png(?!\[\/img\])$/gim,
    (imgUrl) => {
      return `[img]${imgUrl}[/img]`;
    },
  );
  // fix [comparison] [img], url同行
  text = text.replace(
    /\[comparison.*\][\s\S]*\[\/comparison\]/gi,
    (comparisonText) => {
      return comparisonText
        .replace(/\[img\]/g, '')
        .replace(/\[\/img\]/g, '')
        .split('https://ptpimg.me')
        .join('\nhttps://ptpimg.me')
        .replace(/\s*\n\s*/g, '\n');
    },
  );

  // old school comparison or more screenshots
  // [hide], [hide=]
  text = text.replace(
    /\[hide(.*)?\]\s*\[url=https:\/\/ptpimg.me.*?png\]\[img\][\s\S]*?\[\/hide\]/gi,
    (imgText) => {
      const imgs = [];
      for (const urlMatch of imgText.matchAll(/\[url=(.*?)\]/gi)) {
        imgs.push(urlMatch[1]);
      }
      const rawTitle = imgText.match(/^\[hide=(.*?)\]/)?.[1] || '';
      const comparisonTitles = rawTitle
        .trim()
        .split(/\||\/|,|vs\.?| - /i)
        .map((v) => v.trim());
      if (comparisonTitles.length >= 2) {
        return `[comparison=${comparisonTitles.join(', ')}]\n${imgs.join('\n')}\n[/comparison]\n`;
      }
      const hideTitle = rawTitle ? `=${rawTitle}` : '';
      return `[hide${hideTitle}]\n[img]${imgs.join('[/img]\n[img]')}[/img]\n[/hide]\n`;
    },
  );

  // [url][img] \n\n
  text = `${text}\n\n`;
  text = text.replace(
    /\[url=https:\/\/ptpimg.me.*?png\]\[img\][\s\S]*?\n\n/gi,
    (imgText) => {
      const imgs = [];
      for (const urlMatch of imgText.matchAll(/\[url=(.*?)\]/gi)) {
        imgs.push(urlMatch[1]);
      }
      return `[hide]\n[img]${imgs.join('[/img]\n[img]')}[/img]\n[/hide]\n`;
    },
  );

  // torrentid=88942
  text = text.replace(/\[img=(.+)?\](\n\n)?/gi, '[img]$1[/img]');

  // torrentid=851261
  text = text.replace(/\[(\/)?IMG\]/g, '[$1img]');
  // 多换行
  text = text.replace(/\n\s*\n/g, '\n\n');

  return text.trim();
};
