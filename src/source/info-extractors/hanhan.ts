import { registry } from './registry';
import { NexusPHPExtractor } from './base/nexusphp-base';
import {
  getTagsFromSource,
  refineCategory,
  formatTorrentTitle,
  getCategoryFromSource,
  getVideoCodecFromSourceAndVideoType,
  getVideoTypeFromSource,
  getResolutionFromSource,
} from '@/source/helper/index';
import $ from 'jquery';
import {
  convertSizeStringToBytes,
  getAudioCodecFromSource,
  getDoubanInfoByIdOrDoubanUrl,
} from '@/common';
class HanHanExtractor extends NexusPHPExtractor {
  priority = 10;

  canHandle(siteName: string): boolean {
    return siteName === 'HH';
  }

  extractTitle() {
    this.info.title = formatTorrentTitle(
      document.title.match(/"(.+)"/)?.[1] || '',
    );
  }

  extractSubtitle() {
    this.info.subtitle = $("div.font-bold.leading-6:contains('副标题')")
      .next()
      .text()
      .replace(/：/g, ':');
  }

  extractImdbUrl() {
    if (this.info.imdbUrl) return;
    this.info.imdbUrl =
      $('#kimdb a[href*="imdb.com/title"]')?.attr('href') ?? '';
  }

  extractDoubanUrl() {
    if (this.info.doubanUrl) return;
    this.info.doubanUrl =
      $('#douban_info-content')
        .prev()
        .find('a[href*="douban.com"]')
        .attr('href') ?? '';
  }

  extractMetaInfo() {
    if (this.info.category) return;
    const result = {} as Record<string, string>;
    $("div.font-bold.leading-6:contains('基本信息')")
      .next()
      .find('div span')
      .each((index, el) => {
        if (index % 2 === 0) {
          const key = $(el).text().replace(/:|：/g, '').trim();
          result[key] = $(el).next().text();
        }
      });
    const {
      类型: category,
      来源: videoType,
      编码: videoCodec,
      音频编码: audioCodec,
      分辨率: resolution,
      大小: size,
    } = result;

    const initialCategory = getCategoryFromSource(category);
    this.info.category = refineCategory(this.info, initialCategory);
    this.info.videoType = getVideoTypeFromSource(videoType);
    this.info.videoCodec = getVideoCodecFromSourceAndVideoType(
      videoCodec,
      this.info.videoType,
    );
    this.info.audioCodec = getAudioCodecFromSource(audioCodec);
    this.info.resolution = getResolutionFromSource(resolution);
    this.info.size = convertSizeStringToBytes(size);
  }

  extractTags() {
    const tagsContentFromPage = $("div.font-bold.leading-6:contains('标签')")
      .next()
      .text();
    this.info.tags = {
      ...this.info.tags,
      ...getTagsFromSource(`${this.info?.subtitle}\n${tagsContentFromPage}`),
    };
  }

  extractMediaInfos() {
    const mediaInfoContent = $('#mediainfo-raw code').text() || '';
    this.info.mediaInfos = [mediaInfoContent];
  }

  extractScreenshots() {
    const screenshots = $('#screenshot-content img')
      .toArray()
      .map((el) => $(el)?.attr('src') ?? '')
      .filter((url) => !!url);
    this.info.screenshots = screenshots;
  }

  extractMovieNames() {
    const IMDbLinkDom = $('#kimdb a[href*="imdb.com/title"]');
    const movieName = IMDbLinkDom?.text()?.replace(/\n/g, '').trim() ?? '';
    this.info.movieName = movieName;
  }

  extractPoster() {
    this.info.poster = $('#cover-content')?.attr('src') ?? '';
  }

  async extractDescription() {
    this.extractDoubanUrl();
    this.extractImdbUrl();
    this.extractMetaInfo();
    const { category, doubanUrl, imdbUrl } = this.info;
    if (!doubanUrl) {
      return;
    }
    const isTV = /tv/i.test(category);
    const imdbId = imdbUrl?.match(/tt\d+/)?.[0] ?? '';
    try {
      const doubanInfo = await getDoubanInfoByIdOrDoubanUrl(
        doubanUrl,
        isTV ? 'tv' : 'movie',
        imdbId,
      );
      if (doubanInfo) {
        this.info.doubanInfo = doubanInfo.format;
      }
    } catch (error) {
      console.warn('fail to fetch douban info for HH:', error);
    }
  }

  enhanceInfo() {
    let { mediaInfos, screenshots, description } = this.info;
    if (mediaInfos?.[0]) {
      description += `[quote]${mediaInfos[0]}[/quote]\n`;
    }
    screenshots.forEach((url) => {
      description += `[img]${url}[/img]`;
    });
    this.info.description = description;
  }
}

registry.register(new HanHanExtractor());
