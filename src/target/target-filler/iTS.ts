import { registry, TargetFiller } from './registry';
import { BaseFiller } from './base/base-filler';
import {
  getTMDBDataByIMDBId,
  getIdByIMDbUrl,
  getIMDBData,
  getTMDBVideosById,
  getMatchRottenTomatoes,
  $t,
} from '@/common';
import { getTeamName } from '@/target/helper/index';
import $ from 'jquery';

class ITS extends BaseFiller implements TargetFiller {
  priority = 10;

  canHandle(siteName: string): boolean {
    return siteName === 'iTS';
  }

  async fill(info: TorrentInfo.Info): Promise<void> {
    this.info = info;

    if (!this.info) return;

    this.processTorrentTitle();
    this.fillTorrentTitle();

    await this.generateAndFillDescription();

    this.handleCategoryAndCollection();

    this.postProcess();
  }

  protected processTorrentTitle(): void {
    super.processTorrentTitle();
    const { title } = this.info!;
    this.info!.title = title.replace(/\s/gi, '.');
  }

  protected postProcess(): void {
    const { category, title, doubanUrl, imdbUrl, screenshots, subtitle } =
      this.info!;

    if (
      category === 'tvPack' ||
      title.match(/Trilogy|Collection/i) ||
      (subtitle && subtitle.match(/合集/))
    ) {
      $('input[name="pack"]').attr('checked', 'true');
    }

    // 填充IMDB/豆瓣链接和截图
    $(this.siteInfo.imdb.selector).val((doubanUrl || imdbUrl) as string);
    $(this.siteInfo.screenshots.selector).val(screenshots.join('\n'));
  }

  private handleCategoryAndCollection(): void {
    if (!this.info) return;

    const { resolution, category } = this.info;

    if (!resolution.match(/2160|1080|720/) && category === 'movie') {
      $('select[name="type"]').val('67');
    }

    const collectionMap = this.getCollectionMap();

    this.fillCollections(collectionMap);
  }

  private getCollectionMap(): Record<string, string> {
    const collectionMap: Record<string, string> = {};

    $('select[name="collection_id1"] option').each(function () {
      const option = $(this);
      collectionMap[option.text()] = option.val() as string;
    });

    return collectionMap;
  }

  private async fillCollections(
    collectionMap: Record<string, string>,
  ): Promise<void> {
    if (!this.info || !this.info.imdbUrl) return;

    const { category } = this.info;
    const teamName = getTeamName(this.info.title);
    const collectionValues = [];

    if (collectionMap[teamName]) {
      collectionValues.push(collectionMap[teamName]);
    }

    if (category.match(/tv|movie|cartoon|documentary/)) {
      try {
        const imdbData = await getIMDBData(this.info.imdbUrl);

        if (imdbData) {
          const { directors = [], details } = imdbData;

          let language = details.Languages || '';
          language = language?.split('|')?.[0]?.trim() ?? '';

          const director = directors.map((item) => item.name)[0];

          if (collectionMap[director]) {
            collectionValues.push(collectionMap[director]);
          }

          if (collectionMap[language]) {
            collectionValues.push(collectionMap[language]);
          }
        }
      } catch (error) {
        console.error('Error fetching IMDB data:', error);
      }
    }

    collectionValues.forEach((value, index) => {
      $(`select[name="collection_id${index + 1}"]`).val(value);
    });
  }

  private async generateAndFillDescription(): Promise<void> {
    if (!this.info) return;

    const { category, screenshots, comparisons = [] } = this.info;

    if (!category.match(/tv|movie|cartoon|documentary/)) return;

    let template = this.createDescriptionTemplate();

    template = this.fillScreenshotsInTemplate(template, screenshots);

    template = this.fillComparisonsInTemplate(template, comparisons);

    $('textarea[name="descr"]').val($t('数据加载中...'));

    try {
      template = await this.fillTemplateWithMetadata(template);

      $('textarea[name="descr"]').val(template);
    } catch (error) {
      $('textarea[name="descr"]').val((error as Error).message);
    }
  }

  private createDescriptionTemplate(): string {
    return `[center]

  [img]$poster$[/img]
  
  [url=$imdbUrl$][img]https://i.ibb.co/KD855ZM/IMDb-Logo-2016.png[/img][/url][size=3]$imdbScore$[/size][*][url=$rtUrl$][img]https://i.ibb.co/BwtmdcV/rottentomatoes-logo.png[/img][/url][size=3]$rtScore$[/size][*][size=3][url=$tmdbUrl$][img]https://i.ibb.co/HhgF1gC/tmdb-logo.png[/img][/url]$tmdbScore$[/size]


  [color=DarkOrange][size=2]◢ SYNOPSIS ◣[/size][/color]
  $synopsis$
  
  [color=DarkOrange][size=2]◢ TRAILER ◣[/size][/color]
  [youtube]$youtubeUrl$[/youtube]

  [color=DarkOrange][size=2]◢ SCREENSHOTS ◣[/size][/color]
  [box][hide]$SCREENSHOTS$[/hide][/box]
  
  [/center]`;
  }

  private fillScreenshotsInTemplate(
    template: string,
    screenshots: string[],
  ): string {
    const screenshotsBBCode = screenshots.map((img) => `[img]${img}[/img]`);
    return template.replace('$SCREENSHOTS$', screenshotsBBCode.join('\n'));
  }

  private fillComparisonsInTemplate(
    template: string,
    comparisons: TorrentInfo.comparison[],
  ): string {
    const comparisonImgs = comparisons.flatMap((v) => v.imgs);

    if (comparisonImgs.length > 0) {
      const comparisonImgsBBCode = comparisonImgs.map(
        (img) => `[img]${img}[/img]`,
      );

      return template.replace(
        /(\[\/center\])$/,
        `[color=DarkOrange][size=2]◢ COMPARISONS ◣[/size][/color]\n\n
    [box][hide]${comparisonImgsBBCode.join(' ')}[/hide][/box]\n\n$1`,
      );
    }

    return template;
  }

  private async fillTemplateWithMetadata(template: string): Promise<string> {
    if (!this.info || !this.info.imdbUrl) return template;

    const { imdbUrl } = this.info;

    const replaceParams = {
      tmdbUrl: '',
      tmdbScore: '0',
      imdbScore: '0',
      imdbUrl,
      poster: '',
      synopsis: '',
      rtUrl: '',
      rtScore: '0',
      youtubeUrl: '',
    };

    await this.fillIMDBData(replaceParams);

    await this.fillTMDBData(replaceParams);

    Object.keys(replaceParams).forEach((key) => {
      template = template.replace(
        `$${key}$`,
        replaceParams[key as keyof typeof replaceParams] || '',
      );
    });

    return template;
  }

  private async fillIMDBData(
    replaceParams: Record<string, string>,
  ): Promise<void> {
    if (!this.info || !this.info.imdbUrl) return;

    const { category, movieName } = this.info;

    try {
      const imdbData = await getIMDBData(this.info.imdbUrl);

      if (imdbData) {
        const {
          poster = '',
          imdb_rating_average: imdbRate,
          description = '',
          aka,
          year,
        } = imdbData;

        replaceParams.poster = poster;
        replaceParams.synopsis = description;
        replaceParams.imdbScore = imdbRate;

        const searchMovieName =
          movieName ||
          aka.filter((item) => item.country.match(/(World-wide)|UK|USA/))?.[0]
            ?.title;

        await this.fillRottenTomatoesData(
          replaceParams,
          searchMovieName,
          category,
          year,
        );
      }
    } catch (error) {
      console.error('Error fetching IMDB data:', error);
    }
  }

  private async fillRottenTomatoesData(
    replaceParams: Record<string, string>,
    movieName: string | undefined,
    category: string,
    year: string | undefined,
  ): Promise<void> {
    if (!movieName) return;

    try {
      const rtInfo = await getMatchRottenTomatoes(
        movieName,
        year,
        !!category.match(/tv/),
      );
      if (!rtInfo) return;

      const { rottenTomatoes, rtId = '' } = rtInfo;
      replaceParams.rtScore = `${rottenTomatoes.audienceScore}%`;
      replaceParams.rtUrl = `https://www.rottentomatoes.com/${rtId}`;
    } catch (error) {
      console.error('Error fetching Rotten Tomatoes data:', error);
    }
  }

  private async fillTMDBData(
    replaceParams: Record<string, string>,
  ): Promise<void> {
    if (!this.info || !this.info.imdbUrl) return;

    try {
      const imdbId = getIdByIMDbUrl(this.info.imdbUrl);
      const { id: tmdbId, vote_average: tmdbRate } =
        await getTMDBDataByIMDBId(imdbId);

      if (tmdbId) {
        replaceParams.tmdbUrl = `https://www.themoviedb.org/movie/${tmdbId}`;
        replaceParams.tmdbScore = `${tmdbRate}`;

        await this.fillTrailerData(replaceParams, tmdbId);
      }
    } catch (error) {
      console.error('Error fetching TMDB data:', error);
    }
  }

  private async fillTrailerData(
    replaceParams: Record<string, string>,
    tmdbId: number,
  ): Promise<void> {
    try {
      interface Video {
        site: string;
        key: string;
      }

      const videos: Video[] = await getTMDBVideosById(`${tmdbId}`);
      const youtubeVideo = videos.find((video) => video.site === 'YouTube');

      if (youtubeVideo?.key) {
        replaceParams.youtubeUrl = `https://www.youtube.com/watch?v=${youtubeVideo.key}`;
      }
    } catch (error) {
      console.error('Error fetching trailer data:', error);
    }
  }
}

registry.register(new ITS());
