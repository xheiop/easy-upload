import { GazelleExtractor } from './base/gazelle-base';
import { registry } from './registry';
import { convertSizeStringToBytes, getAreaCode, htmlToBBCode } from '@/common';
import { formatTorrentTitle } from '@/source/helper/index';
import { CURRENT_SITE_INFO, PT_SITE } from '@/const';
import $ from 'jquery';

/**
 * ANT shows screenshots and posters through its image proxy,
 * images.anthelion.me/?h=…&i=<original URL>; the original is what other
 * sites can use.
 */
const getOriginalImageUrl = (img: HTMLElement): string => {
  const proxied =
    img.getAttribute('lightbox-img') || img.getAttribute('src') || '';
  try {
    const url = new URL(proxied, location.href);
    return url.searchParams.get('i') || url.href;
  } catch {
    return proxied;
  }
};

/**
 * A torrent on a film page (torrents.php?id=…&torrentid=…): the row
 * #torrent<id> holds the download links and the release line, the hidden row
 * #torrent_<id> the file list, release description, MediaInfo and
 * screenshots.
 */
class ANTExtractor extends GazelleExtractor {
  priority = 10;
  torrentDetailDom: JQuery<HTMLElement> = $();
  // "1080p / BluRay / H265 / EAC3 / HDR10 / DV / Commentary / Subs / MKV / Group"
  releaseParts: string[] = [];

  canHandle(siteName: string): boolean {
    return siteName === 'ANT';
  }

  async extract(): Promise<TorrentInfo.Info> {
    this.extractTorrentId();
    if (!this.torrentId) {
      return this.info;
    }
    this.getTorrentHeaderDom();
    this.extractMovieNames();
    this.extractYear();
    this.extractImdbUrl();
    this.extractTorrentLink();
    this.extractTitle();
    this.extractSize();
    this.extractMetaInfo();
    this.extractMediaInfos();
    this.extractScreenshotsForANT();
    this.extractDescription();
    this.extractMediaDetails();
    this.extractTags();
    this.extractArea();
    this.extractPoster();
    // Feature Film, Short Film or Miniseries: the film page doesn't say
    this.info.category = 'movie';
    return this.info;
  }

  protected getTorrentHeaderDom() {
    this.torrentHeaderDom = $(`#torrent${this.torrentId}`);
    this.torrentDetailDom = $(`#torrent_${this.torrentId}`);
  }

  protected extractMovieNames() {
    this.info.movieName = $('h2 > span').first().text().trim();
  }

  protected extractYear() {
    this.info.year =
      $('h2')
        .first()
        .text()
        .match(/\[(\d{4})\]/)?.[1] ?? '';
  }

  protected extractImdbUrl() {
    const imdbId =
      $('a[href*="imdb.com/title/tt"]')
        .first()
        .attr('href')
        ?.match(/tt\d+/)?.[0] ?? '';
    this.info.imdbUrl = imdbId ? `https://www.imdb.com/title/${imdbId}/` : '';
  }

  /** DL, not FL: FL spends a freeleech token (usetoken=1). */
  protected extractTorrentLink() {
    CURRENT_SITE_INFO.torrentLink = this.torrentHeaderDom
      .find('a[href*="action=download"]')
      .filter((_, a) => !/usetoken/.test(a.getAttribute('href') || ''))
      .first()
      .attr('href');
  }

  /** The torrent's folder, or its single file without the extension. */
  protected extractTitle() {
    const fileList = $(`#files_${this.torrentId}`);
    const folder = fileList
      .find('.filelist_path')
      .text()
      .trim()
      .replace(/^\/+|\/+$/g, '');
    const firstFile = fileList.find('tr.row > td').first().text().trim();
    const releaseName = folder || firstFile.replace(/\.[a-z0-9]{2,4}$/i, '');
    this.info.title = formatTorrentTitle(releaseName);
  }

  protected extractSize() {
    const size = this.torrentHeaderDom.find('td.number_column').first().text();
    this.info.size = convertSizeStringToBytes(size.trim());
  }

  protected extractMetaInfo() {
    this.releaseParts = this.torrentHeaderDom
      .find('> td > a')
      .first()
      .text()
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean);
    const [resolution = '', media = ''] = this.releaseParts;
    const container =
      this.releaseParts.find((part) =>
        /^(MKV|MP4|AVI|M2TS|ISO|VOB|IFO|TS|MPG|WMV)$/i.test(part),
      ) ?? '';
    const isUHD = resolution === '2160p';

    // SD has no number; the MediaInfo gives the resolution
    this.info.resolution = resolution === 'SD' ? '' : resolution;
    this.info.source = this.getSourceFromMedia(media, isUHD);
    this.info.videoType = this.getVideoTypeFromRelease(media, container, isUHD);
  }

  private getSourceFromMedia(media: string, isUHD: boolean) {
    const sourceMap: Record<string, string> = {
      BluRay: isUHD ? 'uhdbluray' : 'bluray',
      WEB: 'web',
      DVD: 'dvd',
      HDDVD: 'hddvd',
      HDTV: 'hdtv',
      TV: 'hdtv',
      VHS: 'vhs',
    };
    return sourceMap[media] ?? '';
  }

  private getVideoTypeFromRelease(
    media: string,
    container: string,
    isUHD: boolean,
  ) {
    if (media === 'WEB') return 'web';
    if (this.releaseParts.includes('Remux')) return 'remux';
    if (media === 'BluRay' && /^(M2TS|ISO)$/i.test(container)) {
      return isUHD ? 'uhdbluray' : 'bluray';
    }
    if (media === 'DVD') {
      return /^(VOB|IFO|ISO)$/i.test(container) ? 'dvd' : 'dvdrip';
    }
    if (media === 'HDTV' || media === 'TV') return 'hdtv';
    return 'encode';
  }

  protected extractMediaInfos() {
    this.info.mediaInfos = this.torrentDetailDom
      .find('blockquote.mediainfoRaw')
      .map((_, el) => el.textContent?.trim() ?? '')
      .get()
      .filter(Boolean);
  }

  private extractScreenshotsForANT() {
    this.info.screenshots = this.torrentDetailDom
      .find('blockquote.torrent_screenshots img')
      .map((_, img) => getOriginalImageUrl(img))
      .get()
      .filter(Boolean);
  }

  /**
   * The film page has no BBCode of the description, so it is put together:
   * the release description (the blockquotes without a class that aren't the
   * MediaInfo), then the MediaInfo and the screenshots.
   */
  protected extractDescription() {
    const { mediaInfos, screenshots } = this.info;
    const releaseNotes = this.torrentDetailDom
      .find('> td > blockquote')
      .filter((_, el) => !el.className && !$(el).find('.mediainfoRaw').length)
      .map((_, el) => htmlToBBCode(el).trim())
      .get()
      .filter(Boolean);
    const sections = [
      ...releaseNotes,
      ...mediaInfos.map((mediaInfo) => `[quote]${mediaInfo}[/quote]`),
    ];
    if (screenshots.length > 0) {
      sections.push(screenshots.map((img) => `[img]${img}[/img]`).join('\n'));
    }
    this.info.description = sections.join('\n\n');
  }

  protected extractTags() {
    const { editionTags } = PT_SITE.ANT.sourceInfo;
    const tags: TorrentInfo.MediaTags = { ...this.info.tags };
    this.releaseParts.forEach((part) => {
      const tag = editionTags[part as keyof typeof editionTags];
      if (tag) {
        tags[tag as keyof TorrentInfo.MediaTags] = true;
      }
    });
    this.info.tags = tags;
  }

  protected extractArea() {
    const country = $('.box_details li')
      .filter((_, li) => /^\s*Country:/.test($(li).text()))
      .first()
      .text()
      .replace(/^\s*Country:\s*/, '')
      .split(',')[0]
      .trim();
    this.info.area = getAreaCode(country);
  }

  protected extractPoster() {
    const poster = $('.box_albumart img.lightbox-init')[0];
    this.info.poster = poster ? getOriginalImageUrl(poster) : '';
  }
}

registry.register(new ANTExtractor());
