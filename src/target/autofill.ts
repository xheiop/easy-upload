import { h, render } from 'preact';
import { toast, Toaster } from 'sonner';
import $ from 'jquery';
import { CURRENT_SITE_INFO, CURRENT_SITE_NAME } from '@/const';
import {
  $t,
  getAreaCode,
  getDoubanBasicDataByQuery,
  getDoubanInfoByIdOrDoubanUrl,
  getDoubanTVItemData,
  getIdByIMDbUrl,
  getSubTitleFromDoubanInfo,
} from '@/common';
import { FormattedMovieData } from '@/common/movie/movie.types';
import { refineCategory } from '@/source/helper/index';
import { SiteIMDbType, siteIMDbTypeMap } from '@/target/types';

type FormField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const BUTTON_ID = 'auto-fill-douban';
const SUPPORTED_SITE_TYPE = /NexusPHP|TTG/;
// sites whose douban field only accepts the numeric id, see their fillers
const DOUBAN_ID_ONLY_SITES = ['TTG', 'BTSCHOOL'];
// SSD has no douban field, its imdb field takes the douban link as well
const DOUBAN_IN_IMDB_FIELD_SITES = ['SSD'];
// sites that build the douban description themselves
const SKIP_DESCRIPTION_SITES = ['SSD'];
const DOUBAN_INFO_REGEX = /(片|译)\s*名/;
// the quote BaseFiller puts on top of transferred descriptions
const THANKS_QUOTE_REGEX =
  /^\[quote\](转自|Torrent from)[\s\S]*?\[\/quote\]\s*/;

// What the button wrote last time. A field still holding that value is the
// button's own output: a second click (say with another link) may replace
// it, and it never counts as a link the user typed. Anything else in a field
// came from the user or the transfer and is kept.
let autoFilled = new WeakMap<FormField, string>();
let autoFilledDescription = '';

export const resetAutofillState = () => {
  autoFilled = new WeakMap();
  autoFilledDescription = '';
};

const isAutoFilled = (field: FormField) =>
  autoFilled.get(field) === field.value;

const canOverwrite = (field: FormField) =>
  !field.value.trim() || isAutoFilled(field);

export const getDoubanIdFromText = (text = ''): string => {
  const value = text.trim();
  if (/^\d+$/.test(value)) {
    return value;
  }
  if (!/douban\.com/.test(value)) {
    return '';
  }
  return value.match(/subject\/(\d+)/)?.[1] ?? '';
};

const getField = <T extends FormField = HTMLInputElement>(
  selector?: string,
): T | null => {
  if (!selector) {
    return null;
  }
  return ($(selector)[0] as T | undefined) ?? null;
};

const getFields = () => {
  const { douban, imdb, subtitle, description, name, category, area } =
    CURRENT_SITE_INFO;
  return {
    douban: getField(douban?.selector),
    imdb: getField(imdb?.selector),
    subtitle: getField(subtitle?.selector),
    description: getField<HTMLTextAreaElement>(description?.selector),
    name: getField(name?.selector),
    categories: category?.selector
      ? ($(category.selector).toArray() as HTMLSelectElement[])
      : [],
    area: getField<HTMLSelectElement>(area?.selector),
  };
};

type Fields = ReturnType<typeof getFields>;

const setFieldValue = (field: FormField, value: string) => {
  autoFilled.set(field, value);
  if (field.value === value) {
    return;
  }
  field.value = value;
  // native events, so the site's own listeners (and its own jQuery) see it
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
};

const canOverwriteSelect = (select: HTMLSelectElement) =>
  !select.value || select.value === '0' || isAutoFilled(select);

const setSelectValue = (select: HTMLSelectElement, value: string) => {
  const hasOption = Array.from(select.options).some(
    (option) => option.value === value,
  );
  if (hasOption) {
    setFieldValue(select, value);
  }
};

export const formatDoubanFieldValue = (doubanId: string, siteName: string) =>
  DOUBAN_ID_ONLY_SITES.includes(siteName)
    ? doubanId
    : `https://movie.douban.com/subject/${doubanId}/`;

export const formatIMDbFieldValue = (imdbLink: string, siteName: string) => {
  const imdbId = getIdByIMDbUrl(imdbLink);
  if (!imdbId) {
    return '';
  }
  switch (siteIMDbTypeMap[siteName]) {
    case SiteIMDbType.StripTT:
      return imdbId.replace('tt', '');
    case SiteIMDbType.IMDbID:
      return imdbId;
    default:
      return `https://www.imdb.com/title/${imdbId}/`;
  }
};

export const getCategoryFromDouban = (
  data: FormattedMovieData,
  torrentTitle: string,
) => {
  const genres = data.genres?.join(' / ') ?? '';
  if (data.is_tv && /真人秀|脱口秀/.test(genres)) {
    return 'variety';
  }
  return refineCategory(
    {
      title: torrentTitle,
      subtitle: '',
      description: `◎类\u3000\u3000别\u3000${genres}`,
    } as TorrentInfo.Info,
    data.is_tv ? 'tv' : 'movie',
  );
};

/**
 * Put the douban info at the top of the description, below the thanks quote
 * of a transfer like the fillers do, or swap the block this button wrote
 * earlier. Descriptions that already carry douban info are left alone.
 */
export const mergeDoubanDescription = (
  current: string,
  doubanInfo: string,
  previous = '',
) => {
  const thanksQuote = current.match(THANKS_QUOTE_REGEX)?.[0] ?? '';
  const body = current.slice(thanksQuote.length);
  if (previous && body.startsWith(previous)) {
    return `${thanksQuote}${doubanInfo}${body.slice(previous.length)}`;
  }
  if (DOUBAN_INFO_REGEX.test(current)) {
    return null;
  }
  return `${thanksQuote}${body ? `${doubanInfo}\n${body}` : doubanInfo}`;
};

/**
 * The first link found decides the title. Links the user typed come before
 * links the button filled in last time, so changing either field and
 * clicking again looks up the new title.
 */
const readLinks = (fields: Fields, info?: TorrentInfo.Info) => {
  const values = [fields.douban, fields.imdb]
    .filter((field): field is HTMLInputElement => !!field?.value.trim())
    .sort((a, b) => Number(isAutoFilled(a)) - Number(isAutoFilled(b)))
    .map((field) => field.value.trim());
  for (const value of values) {
    const doubanId = getDoubanIdFromText(value);
    if (doubanId) {
      return { doubanId, imdbId: '' };
    }
    const imdbId = getIdByIMDbUrl(value);
    if (imdbId) {
      return { doubanId: '', imdbId };
    }
  }
  return {
    doubanId: getDoubanIdFromText(info?.doubanUrl),
    imdbId: getIdByIMDbUrl(info?.imdbUrl ?? ''),
  };
};

const resolveDoubanId = async (
  imdbId: string,
  movieName: string,
  torrentTitle: string,
) => {
  const query = imdbId || movieName;
  if (!query) {
    throw new Error($t('douban.errorNoLink'));
  }
  const doubanData = await getDoubanBasicDataByQuery(query);
  if (doubanData.isTV) {
    const seasonData = await getDoubanTVItemData(doubanData, torrentTitle);
    return seasonData?.id || doubanData.id;
  }
  return doubanData.id;
};

const fetchDoubanData = async (doubanId: string, imdbId?: string) => {
  try {
    return await getDoubanInfoByIdOrDoubanUrl(doubanId, 'movie', imdbId);
  } catch {
    // douban redirects tv subjects to the tv endpoint, retry it directly
    // in case the redirect was not followed
    return await getDoubanInfoByIdOrDoubanUrl(doubanId, 'tv', imdbId);
  }
};

const fillFields = (
  fields: Fields,
  data: FormattedMovieData,
  doubanId: string,
  torrentInfo: Pick<TorrentInfo.Info, 'title' | 'hardcodedSub'>,
) => {
  const siteName = CURRENT_SITE_NAME;
  const doubanField = DOUBAN_IN_IMDB_FIELD_SITES.includes(siteName)
    ? fields.imdb
    : fields.douban;

  if (doubanField && canOverwrite(doubanField)) {
    setFieldValue(doubanField, formatDoubanFieldValue(doubanId, siteName));
  }

  if (
    fields.imdb &&
    fields.imdb !== doubanField &&
    canOverwrite(fields.imdb) &&
    data.imdbLink
  ) {
    setFieldValue(fields.imdb, formatIMDbFieldValue(data.imdbLink, siteName));
  }

  if (fields.subtitle && canOverwrite(fields.subtitle)) {
    const subtitle = getSubTitleFromDoubanInfo(
      data,
      torrentInfo as TorrentInfo.Info,
    )
      .replace(/\s+/g, ' ')
      .trim();
    setFieldValue(fields.subtitle, subtitle);
  }

  if (fields.description && !SKIP_DESCRIPTION_SITES.includes(siteName)) {
    const description = mergeDoubanDescription(
      fields.description.value,
      data.format,
      autoFilledDescription,
    );
    if (description !== null) {
      setFieldValue(fields.description, description);
      autoFilledDescription = data.format;
    }
  }

  const { category: categoryConfig, area: areaConfig } = CURRENT_SITE_INFO;
  const emptyCategories = fields.categories.filter(canOverwriteSelect);
  if (categoryConfig?.map && emptyCategories.length > 0) {
    const category = getCategoryFromDouban(data, torrentInfo.title);
    const value = categoryConfig.map[category];
    // a list means the category also depends on the resolution or source,
    // which douban cannot tell
    const categoryValue = Array.isArray(value)
      ? value.length === 1
        ? value[0]
        : ''
      : value;
    if (categoryValue) {
      emptyCategories.forEach((select) =>
        setSelectValue(select, `${categoryValue}`),
      );
    }
  }

  if (
    areaConfig?.map &&
    fields.area?.tagName === 'SELECT' &&
    canOverwriteSelect(fields.area)
  ) {
    const areaCode = getAreaCode(data.countries?.[0] ?? '');
    const value = areaConfig.map[areaCode] ?? areaConfig.map.OT;
    if (value && !Array.isArray(value)) {
      setSelectValue(fields.area, `${value}`);
    }
  }
};

export const autoFillDoubanInfo = async (info?: TorrentInfo.Info) => {
  const fields = getFields();
  const torrentTitle = fields.name?.value.trim() || info?.title || '';
  const { doubanId: inputDoubanId, imdbId } = readLinks(fields, info);
  const doubanId =
    inputDoubanId ||
    (await resolveDoubanId(imdbId, info?.movieName ?? '', torrentTitle));
  if (!doubanId) {
    throw new Error($t('douban.errorNoLink'));
  }
  const data = await fetchDoubanData(
    doubanId,
    inputDoubanId ? undefined : imdbId,
  );
  if (!data?.format) {
    throw new Error('failed to fetch douban info');
  }
  fillFields(fields, data, doubanId, {
    title: torrentTitle,
    hardcodedSub: info?.hardcodedSub,
  });
};

let toasterMounted = false;
const mountToaster = () => {
  if (toasterMounted) {
    return;
  }
  toasterMounted = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  render(h(Toaster, { position: 'top-right', richColors: true }), container);
};

const createButton = (info?: TorrentInfo.Info) => {
  const label = $t('douban.btnFetchIntro');
  const button = document.createElement('button');
  button.type = 'button';
  button.id = BUTTON_ID;
  button.textContent = label;
  button.title = $t('douban.autofillTip');
  button.addEventListener('click', async () => {
    if (button.disabled) {
      return;
    }
    mountToaster();
    button.disabled = true;
    button.textContent = $t('common.fetching');
    try {
      await autoFillDoubanInfo(info);
      toast.success($t('common.retrieveSuccess'));
    } catch (error) {
      console.error('[easy-upload] douban autofill failed', error);
      toast.error(
        `${$t('common.retrieveFailed')}: ${(error as Error).message}`,
      );
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });
  return button;
};

const isUploadPage = () =>
  /upload|offer/i.test(`${location.pathname}${location.search}`);

/**
 * Add a button next to the douban (or IMDb) field of the upload form that
 * fills the subtitle, description, links, category and area from douban.
 * Works both for transferred torrents and for torrents uploaded by hand.
 */
export default function autofill(info?: TorrentInfo.Info) {
  if (info?.doubanInfo) {
    return;
  }
  if (
    !CURRENT_SITE_INFO?.siteType?.match(SUPPORTED_SITE_TYPE) ||
    !isUploadPage() ||
    document.getElementById(BUTTON_ID)
  ) {
    return;
  }
  const { douban, imdb } = getFields();
  const anchor = douban ?? imdb;
  if (!anchor) {
    return;
  }
  anchor.after(createButton(info));
}
