import { registry, TargetFiller } from './registry';
import { BaseFiller } from './base/base-filler';
import $ from 'jquery';
import { REDSearchResultResponse } from '@/target/types';
import {
  GMFetch,
  getLocationSearchValueByKey,
  keepRipLogFilesAttached,
} from '@/common';
import { CURRENT_SITE_INFO } from '@/const';
import {
  applyExistingMusicGroup,
  showAutoMergedGroupNotice,
} from '@/target/helper/music-group';

class RED extends BaseFiller implements TargetFiller {
  priority = 10;

  canHandle(siteName: string): boolean {
    return siteName === 'RED';
  }

  async fill(info: TorrentInfo.Info): Promise<void> {
    this.info = info;
    await this.fillMusicInfo();
  }

  private async fillMusicInfo(): Promise<void> {
    if (!this.info || !this.info.musicJson) {
      return;
    }

    if (document.forms.upload_table) {
      document.forms.upload_table.reset = () => {};
    }

    const { musicJson } = this.info;
    const {
      name,
      year,
      musicInfo,
      bbBody,
      tags,
      releaseType,
      categoryId,
      wikiImage,
    } = musicJson.group;

    const groupId = getLocationSearchValueByKey('groupid');

    if (!groupId) {
      // 找到可信的已有专辑时，跳转到它的添加格式页面
      if (await this.searchAndRedirectToGroup(musicJson)) {
        return;
      }

      $('#categories').val(categoryId - 1);
      $('#title').val(name);
      $('#year').val(year);
      $('#releasetype').val(releaseType);
      $('#tags').val(tags.join(', '));
      $('#album_desc').val(bbBody);
      $('#image').val(wikiImage);

      this.fillArtistsForm(musicInfo);
    } else {
      showAutoMergedGroupNotice(CURRENT_SITE_INFO, groupId);
    }

    this.fillReleaseInfo(musicJson.torrent);
    this.fillTorrentFile();
    keepRipLogFilesAttached(this.info.musicInfo?.logFiles, name);
  }

  private async searchAndRedirectToGroup(musicJson: {
    group: MusicJson.GroupInfo;
    torrent: MusicJson.Torrent;
  }): Promise<boolean> {
    return applyExistingMusicGroup({
      release: musicJson,
      siteInfo: CURRENT_SITE_INFO,
      search: (query) =>
        GMFetch<REDSearchResultResponse>(
          `/ajax.php?action=browse&searchstr=${encodeURIComponent(query)}`,
          { responseType: 'json' },
        ),
    });
  }

  private fillArtistsForm(musicInfo: MusicJson.GroupInfo['musicInfo']): void {
    const artistTypeMap = {
      artists: '1',
      with: '2',
      composers: '4',
      conductor: '5',
      dj: '6',
      producer: '7',
      remixedBy: '3',
    };

    const artists: MusicJson.People[] = [];
    Object.keys(musicInfo).forEach((key) => {
      const typeKey = key as keyof typeof artistTypeMap;
      const values = musicInfo[typeKey].map((value) => ({
        ...value,
        type: artistTypeMap[typeKey],
      }));
      artists.push(...values);
    });

    for (let i = 1; i < artists.length; i++) {
      window.AddArtistField();
    }

    artists.forEach((artist, index) => {
      const selector = index > 0 ? `#artist_${index}` : '#artist';
      $(selector)
        .val(artist.name)
        .next()
        .val(artist.type || '');
    });
  }

  private fillReleaseInfo(info: MusicJson.Torrent): void {
    const {
      remasterYear,
      remasterRecordLabel,
      remasterCatalogueNumber,
      format,
      encoding,
      media,
      description,
      scene,
      remasterTitle,
    } = info;

    $('#remaster_record_label').val(remasterRecordLabel);
    $('#remaster_catalogue_number').val(remasterCatalogueNumber);
    $('#format').val(format);
    $('#bitrate').val(encoding);
    $('#media').val(media);

    if (media === 'CD' && format === 'FLAC') {
      document.querySelector('#format')?.dispatchEvent(new Event('change'));
    }

    $('#remaster_year').val(remasterYear);
    $('#release_desc').val(description);

    if (scene) {
      $('#scene').attr('checked', 'true');
    }

    if (remasterTitle) {
      $('#remaster_title').val(remasterTitle);
    }
  }
}

registry.register(new RED());
