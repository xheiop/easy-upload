import { registry, TargetFiller } from './registry';
import { BaseFiller } from './base/base-filler';
import $ from 'jquery';
import {
  getIMDBData,
  transferImgToCheveretoSite,
  getIdByIMDbUrl,
} from '@/common';

class SC extends BaseFiller implements TargetFiller {
  priority = 10;

  canHandle(siteName: string): boolean {
    return siteName === 'SC';
  }

  async fill(info: TorrentInfo.Info) {
    this.info = info;
    const { imdbUrl = '' } = this.info;
    const imdbId = getIdByIMDbUrl(imdbUrl);
    $('#catalogue_number').val(imdbId);
    $('#imdb_autofill').trigger('click');
    this.fillMedia();
    $('.modesw').trigger('click');
    $('#release_desc').val(this.buildDescription());
    await this.fillIMDbInfo(imdbUrl);
    this.fillTorrentFile();
  }

  private buildDescription() {
    const { screenshots, mediaInfos } = this.info!;
    const parts: string[] = [];
    if (screenshots.length > 0) {
      const screenshotSection = screenshots
        .slice(0, 3)
        .map((img) => `[img]${img}[/img]`)
        .join('');
      parts.push(screenshotSection);
    }
    if (mediaInfos.length > 0) {
      const mediaInfoSection = mediaInfos
        .map((mediaInfo) => `[hide=MediaInfo]${mediaInfo}[/hide]`)
        .join('\n\n');

      parts.push(mediaInfoSection);
    }
    return parts.join('\n\n');
  }

  private fillMedia() {
    const { videoType, resolution } = this.info!;
    let mediaValue;
    if (videoType.match(/bluray/i)) {
      mediaValue = 'BDMV';
    } else if (videoType === 'DVD') {
      mediaValue = 'DVD-R';
    } else if (parseInt(resolution, 10) < 720) {
      mediaValue = 'SD';
    } else {
      mediaValue = resolution;
    }
    $('#media').val(mediaValue);
  }

  private async fillIMDbInfo(imdbUrl: string) {
    if (imdbUrl) {
      try {
        const imdbData = await getIMDBData(imdbUrl);
        if (!imdbData) {
          return;
        }
        if (imdbData?.details?.country) {
          $('#country').val(imdbData.details.country);
        }
        const akaName = imdbData && imdbData?.details?.['Also known as'];
        const originalName = imdbData?.name ?? '';

        if (akaName && akaName !== originalName) {
          $('#alternate_title').val(imdbData.details['Also known as']);
          $('#title').val(originalName);
        }
        await this.uploadPoster(imdbData.poster);
      } catch (error) {
        console.error('Error filling IMDB data:', error);
      }
    }
  }

  private async uploadPoster(posterUrl?: string): Promise<void> {
    if (!posterUrl) return;

    try {
      const data = await (
        await transferImgToCheveretoSite
      )([posterUrl], 'https://gifyu.com/json');
      const uploadedUrl = data[0]?.original;

      if (uploadedUrl) {
        $('#image').val(uploadedUrl);
      }
    } catch (error) {
      console.error('Failed to upload poster:', error);
    }
  }
}

registry.register(new SC());
