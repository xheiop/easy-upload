import { GMFetch } from '@/common/utils';
import { CONFIG } from './movie.config';
import {
  DoubanMobileData,
  DoubanBasicData,
  DoubanMobileCreditsResponse,
  DoubanBookData,
  FormattedMovieData,
} from './movie.types';
import { getIdByIMDbUrl } from './movie.imdb';
import { DoubanFormatter } from './movie.douban.format';

/**
 * Get Douban Awards by Douban ID
 *
 * @async
 * @param {string} doubanId
 * @returns {Promise<string>}
 */
export const getDoubanAwards = async (doubanId: string): Promise<string> => {
  const url = `${CONFIG.URLS.DOUBAN_SUBJECT(doubanId)}awards/`;
  const data = await GMFetch<string>(url);
  const doc = new DOMParser().parseFromString(data, 'text/html');
  const awardsDom = doc.querySelector('#content > div > div.article');
  if (!awardsDom) {
    return '';
  }
  return awardsDom?.innerHTML
    .replace(/[ \n]/g, '')
    .replace(/<\/li><li>/g, '</li> <li>')
    .replace(/<\/a><span/g, '</a> <span')
    .replace(/<(div|ul)[^>]*>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/ +\n/g, '\n')
    .trim();
};

/**
 * Get IMDb ID from Douban URL
 *
 * @async
 * @param {string} doubanId
 * @returns {Promise<string>}
 */
export const getIMDbIDFromDouban = async (
  doubanId: string,
): Promise<string> => {
  const doubanPage = await GMFetch<string>(
    CONFIG.URLS.DOUBAN_SUBJECT(doubanId),
  );
  const dom = new DOMParser().parseFromString(doubanPage, 'text/html');
  const spans = dom.querySelectorAll('#info > span.pl');
  const spansContainsIMDb = Array.from(spans).filter((span) =>
    span.textContent?.includes('IMDb'),
  );
  const imdbId = spansContainsIMDb[0]?.nextSibling?.nodeValue?.trim() ?? '';
  return imdbId;
};

/**
 * Get douban movie data from mobile api
 *
 * @async
 * @param {string} id
 * @param {('movie' | 'tv')} type
 * @returns {Promise<DoubanMobileData>}
 */
export const getMobileDoubanInfo = async (
  id: string,
  type: 'movie' | 'tv',
): Promise<DoubanMobileData> => {
  if (!id) {
    throw new Error('No Douban ID found');
  }
  const url = `${CONFIG.URLS.DOUBAN_MOBILE_API}/${type}/${id}`;

  const data = await GMFetch<DoubanMobileData>(`${url}?for_mobile=1&ck=`, {
    headers: {
      Referer: `https://m.douban.com/${type}/subject/${id}`,
    },
    responseType: 'json',
  });
  if (data && data.title === '未知电影') {
    throw new Error('Please login in Douban to and try again');
  }
  return data;
};

/**
 * Get Douban Basic Data by Query
 *
 * @async
 * @param {string} query imdbUrl or keyword
 * @returns {Promise<DoubanBasicData>}
 */
export const getDoubanBasicDataByQuery = async (
  query: string,
): Promise<DoubanBasicData> => {
  if (!query) {
    throw new Error('No query provided');
  }
  const imdbId = getIdByIMDbUrl(query);
  const searchParams = imdbId || query;
  const url = CONFIG.URLS.DOUBAN_SUGGEST_API(searchParams);
  const data = await GMFetch<string>(url);
  const doc = new DOMParser().parseFromString(data, 'text/html');
  const linkDom = doc.querySelector('.result-list .result h3 a');
  if (!linkDom) {
    throw new Error('No Douban Item was found');
  } else {
    const { href, textContent } = linkDom as HTMLAnchorElement;
    const season = textContent?.match(/第(.+?)季/)?.[1] ?? '';
    const doubanId =
      decodeURIComponent(href).match(/subject\/(\d+)/)?.[1] ?? '';
    return {
      id: doubanId,
      season,
      isTV: !!season,
      title: textContent as string,
    };
  }
};

/**
 * Get TV Season Data from Douban
 *
 * @async
 * @param {DoubanBasicData} doubanData
 * @param {string} torrentTitle
 * @returns {Promise<DoubanBasicData>}
 */
export const getDoubanTVItemData = async (
  doubanData: DoubanBasicData,
  torrentTitle: string,
): Promise<DoubanBasicData> => {
  const { title } = doubanData;
  const seasonNumber =
    torrentTitle?.match(/S(?:eason)?\s*0?(\d+)/i)?.[1] ?? '1';
  if (parseInt(seasonNumber, 10) === 1) {
    return doubanData;
  }
  const query = title?.replace(/第.+?季/, `第${seasonNumber}季`);
  const response = await getDoubanBasicDataByQuery(query);
  return response;
};

/**
 * Get Douban Credits Data
 *
 * @async
 * @param {string} url
 * @param {('tv' | 'movie')} type
 * @returns {Promise<DoubanMobileCreditsResponse>}
 */
export const getDoubanCreditsData = async (
  id: string,
  type: 'tv' | 'movie',
): Promise<DoubanMobileCreditsResponse> => {
  const url = `${CONFIG.URLS.DOUBAN_MOBILE_API}/${type}/${id}/credits?for_mobile=1&ck=`;
  const data = await GMFetch<DoubanMobileCreditsResponse>(url, {
    headers: {
      Referer: `https://m.douban.com/${type}/subject/${id}`,
    },
    responseType: 'json',
  });
  return data;
};

/**
 * Get Douban Book Info
 * @todo: update title
 * @async
 * @param {string} doubanUrl
 * @returns {Promise<DoubanBookData>}
 */
export const getDoubanBookInfo = async (
  doubanUrl: string,
): Promise<DoubanBookData> => {
  const reqUrl = CONFIG.URLS.PT_GEN_API(doubanUrl);
  const data = await GMFetch<DoubanBookData>(reqUrl, {
    responseType: 'json',
  });
  return data;
};

export const getDoubanInfoByIdOrDoubanUrl = async (
  query: string,
  type: 'movie' | 'tv' = 'movie',
  imdbId?: string,
): Promise<FormattedMovieData> => {
  let doubanId = query;
  if (!/^\d/.test(query)) {
    doubanId = query?.match(/douban\.com\/subject\/(\d+)/)?.[1] ?? '';
  }
  const parser = new DoubanFormatter(doubanId, type, imdbId);
  return await parser.format();
};
