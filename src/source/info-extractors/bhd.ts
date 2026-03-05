import { convertSizeStringToBytes, getAreaCode } from '@/common';
import {
  formatTorrentTitle,
  getFilterBBCode,
  refineCategory,
  getCategoryFromSource,
} from '@/source/helper/index';
import { InfoExtractor, registry } from './registry';
import { BaseExtractor } from './base/base-extractor';
import $ from 'jquery';
import { CONFIG } from '../config';

class BHDExtractor extends BaseExtractor implements InfoExtractor {
  priority = 10;

  canHandle(siteName: string): boolean {
    return siteName === 'BeyondHD';
  }

  async extract(): Promise<TorrentInfo.Info> {
    this.extractBasicInfo();
    this.extractYear();
    this.extractImdbUrl();
    this.extractMediaInfos();
    this.extractMediaDetails();
    this.extractDescription();
    this.extractScreenshots();
    this.extractMovieName();
    this.extractComparisonsScreenshots();
    this.extractArea();
    this.enhanceInfo();

    return this.info;
  }

  protected extractBasicInfo() {
    const basicInfo = {
      Category: '',
      Name: '',
      Source: '',
      Type: '',
      Size: '',
      Video: '',
      Audio: '',
      Hybrid: '',
      Edition: '',
      Region: '',
      Extras: '',
    };
    $('tr.dotborder').each((_, element) => {
      const key = $(element).find('td:first').text() as keyof typeof basicInfo;
      const value = $(element).find('td:last').text();
      basicInfo[key] = value.replace(/\n/g, '').trim();
    });
    const { Category, Name, Source, Type, Size } = basicInfo;
    this.info.title = formatTorrentTitle(Name);
    const category = getCategoryFromSource(
      Category.toLowerCase().replace(/s/, ''),
    );
    this.info.category = refineCategory(this.info, category);
    this.info.size = convertSizeStringToBytes(Size.replace(/\s/g, ''));
    this.info.videoType = this.getVideoType(Source, Type);
    this.info.source = this.getSource(Source, Type);
    const { knownTags, otherTags } = this.getEditionTags(basicInfo);
    this.info.tags = {
      ...this.info.tags,
      ...knownTags,
    };
    this.info.otherTags = otherTags;
  }

  protected extractYear() {
    const year = $('.year-link').text();
    if (!year) {
      super.extractYear();
    } else {
      this.info.year = year;
    }
  }

  protected extractImdbUrl() {
    this.info.imdbUrl = $('span[title="IMDb Rating"] a').attr('href');
  }

  protected extractMediaInfos() {
    const mediaInfo = $('#stats-full .forced-nfo').text();
    this.info.mediaInfos = [mediaInfo];
  }

  protected extractDescription() {
    const descriptionDom = $('.panel-heading:contains(Description)')
      .next('.panel-body')
      .find('.forced-nfo');
    const descriptionBBCode = getFilterBBCode(descriptionDom[0]);
    const mediaInfoQuote =
      this.info.mediaInfos.length > 0
        ? `[quote]${this.info.mediaInfos[0]}[/quote]`
        : '';
    this.info.description = mediaInfoQuote + descriptionBBCode;
    this.info.originalDescription = descriptionBBCode;
  }

  protected extractMovieName() {
    const movieName = $('.bhd-title-h1 a.beta-link-blend').text();
    this.info.movieName = movieName;
  }

  protected extractArea() {
    const country = $('a[href*="library/movie?countries"]').text();
    const area = getAreaCode(country);
    this.info.area = area;
  }

  protected enhanceInfo() {}

  protected extractComparisonsScreenshots() {
    const title = $('#screenMain .screenParent')
      .text()
      ?.replace(/\[Show\]|Comparison/g, '')
      ?.trim();
    const imgs = Array.from($('.screenComparison img')).map(
      (img) => $(img)?.attr('src') ?? '',
    );
    this.info.comparisons = [
      {
        title,
        imgs,
        reason: '',
      },
    ];
  }

  getVideoType(source: string, type: string) {
    type = type.replace(/\s/g, '');
    if (type.match(/Remux/i)) {
      return 'remux';
    } else if (type.match(/BD50|BD25/i)) {
      return 'bluray';
    } else if (type.match(/UHD50|UHD66|UHD100/i)) {
      return 'uhdbluray';
    } else if (type.match(/DVD5|DVD9/i)) {
      return 'dvd';
    } else if (source.match(/WEB|WEB-DL/i)) {
      return 'web';
    } else if (type.match(/\d{3,4}p/i)) {
      return 'encode';
    }
    return type;
  }

  getSource(source: string, resolution: string) {
    if (resolution.match(/BD100|BD66/i)) {
      return 'uhdbluray';
    }
    if (source.match(/Blu-ray/i) && resolution.match(/UHD/i)) {
      return 'uhdbluray';
    }
    if (source.match(/WEB|WEB-DL/i)) {
      return 'web';
    }
    return source.replace(/-/g, '').toLowerCase();
  }

  getEditionTags(basicInfo: Record<string, string>) {
    const { common, others } = CONFIG.BHD_SOURCE_MEDIA_TAGS_MAP;
    const knownTags: TorrentInfo.MediaTags = {};
    const otherTags: Record<string, boolean> = {
      Hybrid: false,
    };
    const { Video, Audio, Edition, Extras, Hybrid } = basicInfo;
    const text = [Video, Audio, Edition, Extras]
      .filter((v) => Boolean(v))
      .join(' / ');

    for (const [source, target] of Object.entries(common)) {
      if (text.includes(source)) {
        knownTags[target as keyof TorrentInfo.MediaTags] = true;
      }
    }

    for (const [source, target] of Object.entries(others)) {
      if (text.includes(source)) {
        otherTags[target] = true;
      }
    }
    if (Hybrid) {
      otherTags.Hybrid = true;
    }
    return {
      knownTags,
      otherTags,
    };
  }
}

registry.register(new BHDExtractor());
