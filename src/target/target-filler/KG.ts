import { registry, TargetFiller } from './registry';
import { BaseFiller } from './base/base-filler';
import $ from 'jquery';
import {
  getIMDBData,
  GMFetch,
  parseMedia,
  getBDTypeBasedOnSize,
} from '@/common';
import { PT_SITE } from '@/const';

class KG extends BaseFiller implements TargetFiller {
  priority = 10;

  canHandle(siteName: string): boolean {
    return siteName === 'KG';
  }

  async fill(info: TorrentInfo.Info): Promise<void> {
    this.info = info;
    await this.processUpload();
  }

  private async processUpload(): Promise<void> {
    if (!this.info) return;

    const { imdbUrl, mediaInfos, resolution, source, videoType } = this.info;
    const mediaInfo = mediaInfos?.[0] ?? '';

    if (!imdbUrl) return;

    $('input[type="submit"][value="next >>"]')
      .hide()
      .after('<p>loading...</p>');

    $('input[name="title"]').val(imdbUrl);

    await this.fetchAndFillIMDbData(imdbUrl);

    this.fillSourceAndResolution(source, resolution, videoType);

    this.fillSubtitleInfo(mediaInfo, videoType);

    if (videoType === 'dvd') {
      $('input[name="dvdr"]').attr('checked', 'true');
      const dvdSpecs = this.buildDvdSpecs();
      $('#ripspecs').val(dvdSpecs);
    } else {
      $('#ripspecs').val(mediaInfo);
    }
  }

  private async fetchAndFillIMDbData(imdbUrl: string): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('upstep', '2');
      formData.append('type', '1');
      formData.append('title', imdbUrl);

      const doc = await GMFetch<string>(`${PT_SITE.KG.url}/upload.php`, {
        method: 'POST',
        data: formData,
      });

      const uploadPage = new DOMParser().parseFromString(doc, 'text/html');
      $('#upside+div').html($('#upside+div', uploadPage).html());
      await this.fillIMDbDetails(imdbUrl);
    } catch (error) {
      console.error('Error fetching IMDB data:', error);
    }
  }

  private async fillIMDbDetails(imdbUrl: string): Promise<void> {
    if (!this.info) return;
    const imdbData = await getIMDBData(imdbUrl);

    if (!imdbData) return;

    const siteInfo = PT_SITE.KG;
    const { screenshots, poster: infoPoster } = this.info;
    const { country, Languages: languages } = imdbData.details;

    $('input[name="lang"]').val(languages);

    let { description, genre, poster = '' } = imdbData;
    const genreMap = siteInfo.genres.map;
    const countryMap = siteInfo.country.map;

    let countryValue = '';
    if (country) {
      countryValue = country.split(',')[0];
      if (countryValue === 'United States') {
        countryValue = 'USA';
      } else if (countryValue === 'United Kingdom') {
        countryValue = 'UK';
      }
    }

    if (!poster) {
      poster = infoPoster || '';
    }

    $('select[name="country_id"]').val(
      countryMap[countryValue as keyof typeof countryMap],
    );

    const descriptionBBCode = `[img]${poster}[/img]
    \nSynopsis:\n[quote]${description}[/quote]
    \n\n${screenshots.map((img) => `[img]${encodeURI(img)}[/img]`).join('')}`;

    // set the value as plain text; .html() would parse and run any <script> in it
    $('#bbcodetextarea').val(descriptionBBCode);

    const [mainGenre, otherGenre = ''] = genre;
    $('select[name="genre_main_id"]').val(
      genreMap[mainGenre as keyof typeof genreMap],
    );
    $('select[name="subgenre"]').val(
      genreMap[otherGenre as keyof typeof genreMap],
    );
  }

  private fillSourceAndResolution(
    source?: string,
    resolution?: string,
    videoType?: string,
  ): void {
    if (!source || !resolution || !videoType) return;

    const siteInfo = PT_SITE.KG;
    $(siteInfo.source.selector).val(
      siteInfo.source.map[source as keyof typeof siteInfo.source.map],
    );

    if (!videoType.match('bluray')) {
      $(siteInfo.resolution.selector).val(
        siteInfo.resolution.map[
          resolution as keyof typeof siteInfo.resolution.map
        ],
      );
    } else {
      $(siteInfo.resolution.selector).val('3');
    }
  }

  private fillSubtitleInfo(mediaInfo: string, videoType?: string): void {
    if (!mediaInfo || !videoType) return;

    const isBluray = videoType.match(/bluray/i);
    const parsedMedia = parseMedia(mediaInfo, !!isBluray);
    if (!parsedMedia) return;
    const { subtitleTracks = [] } = parsedMedia;

    if (subtitleTracks.length) {
      const subtitleNames = subtitleTracks.map((track) => track.language);
      $('input[name="subs"]').val(subtitleNames.join(','));
    }
  }

  private buildDvdSpecs(): string {
    if (!this.info) return '';

    const { mediaInfos, size, audioCodec } = this.info;
    const mediaInfo = mediaInfos?.[0] ?? '';

    const scanType = mediaInfo.includes('NTSC') ? 'NTSC' : 'PAL';

    const dvdType = getBDTypeBasedOnSize(size);

    const audioChannelNumber =
      mediaInfo.match(/Channel\(s\)\s+:\s+(\d)/)?.[1] || '2';
    const audioName = `${audioCodec?.toUpperCase()} ${audioChannelNumber === '6' ? '5.1' : `${audioChannelNumber}.0`}`;

    const IFOMediaInfo =
      this.info.mediaInfos?.find((info) => info.includes('.IFO')) ?? '';
    const runtime =
      IFOMediaInfo.match(/Duration\s*?:([^\n]+)/)?.[1]?.replace(/\s/g, '') ??
      '';
    const hour = runtime.match(/(\d)+h/)?.[1] ?? '00';
    const minute = runtime.match(/(\d+)(mn|min)/)?.[1] ?? '';

    return `DVD Label:
DVD Format: ${dvdType} ${scanType}
DVD Audio: ${audioName}
Program(s): Unknown
Menus: Untouched
Video: Untouched
Audio: Untouched
DVD extras: Untouched
Extras contain: 
DVD runtime(s): ${+hour < 10 ? `0${hour}` : hour}:${minute}`;
  }
}

registry.register(new KG());
