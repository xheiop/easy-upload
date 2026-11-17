import { registry, TargetFiller } from './registry';
import { BaseFiller } from './base/base-filler';
import { CURRENT_SITE_INFO, CURRENT_SITE_NAME } from '@/const';
import {
  getLocationSearchValueByKey,
  GMFetch,
  keepRipLogFilesAttached,
} from '@/common';
import $ from 'jquery';
import { Buffer } from 'buffer/index';
import { base64ToBlob } from '@/target/helper/index';
import { REDSearchResultResponse } from '../types';

class GazelleMusic extends BaseFiller implements TargetFiller {
  priority = 10;

  canHandle(siteName: string): boolean {
    return siteName.match(/(DicMusic|Orpheus)/) !== null;
  }

  async fill(info: TorrentInfo.Info): Promise<void> {
    this.info = info;

    const { musicJson } = info;
    if (!musicJson) {
      return;
    }

    const { name, year } = musicJson.group;

    // 检查是否有组ID，如果没有，尝试搜索现有专辑
    const groupId = getLocationSearchValueByKey('groupid');
    if (!groupId) {
      // 搜索现有专辑并重定向
      await this.searchAndRedirectToGroup(name, year);
    }

    // 针对不同站点的特殊处理
    await this.processSiteSpecificLogic(musicJson);

    // 填充JSON数据到上传表单
    this.fillJsonToUploadTable(musicJson, name);

    this.fillTorrentFile();

    // the JSON import rebuilds the form, so the logs are kept attached
    keepRipLogFilesAttached(info.musicInfo?.logFiles, name);
  }

  private async searchAndRedirectToGroup(
    name: string,
    year: number,
  ): Promise<boolean> {
    try {
      const searchResult = await GMFetch<REDSearchResultResponse>(
        `/ajax.php?action=browse&searchstr=${encodeURIComponent(name)} ${year}`,
        {
          responseType: 'json',
        },
      );

      if (
        searchResult.status === 'success' &&
        searchResult.response.results.length > 0
      ) {
        const groupId = searchResult.response.results[0].groupId;
        const timestampMatchArray =
          location.hash && location.hash.match(/(^|#)timestamp=([^#]*)(#|$)/);
        const timestamp = timestampMatchArray?.[2] ?? '';

        location.href = `${CURRENT_SITE_INFO.url}${CURRENT_SITE_INFO.uploadPath}?groupid=${groupId}#timestamp=${timestamp}`;
        return true;
      }
    } catch (error) {
      console.error('Error searching for group:', error);
    }

    return false;
  }

  private async processSiteSpecificLogic(musicJson: {
    group: MusicJson.GroupInfo;
    torrent: MusicJson.Torrent;
  }): Promise<void> {
    // Orpheus特殊处理
    if (CURRENT_SITE_NAME === 'Orpheus') {
      const { remasterTitle, remasterCatalogueNumber, remasterRecordLabel } =
        musicJson.torrent;
      const { recordLabel, catalogueNumber } = musicJson.group;

      // 如果没有任何重制信息和原始标签信息，则标记为非重制版本
      if (
        !remasterCatalogueNumber &&
        !remasterRecordLabel &&
        !remasterTitle &&
        !recordLabel &&
        !catalogueNumber
      ) {
        musicJson.torrent.remastered = false;
      }
    }
    // DicMusic特殊处理
    else if (CURRENT_SITE_NAME === 'DicMusic') {
      // 将wiki正文转换为Unicode实体
      musicJson.group.wikiBody = this.toUnicodeEntities(
        musicJson.group.wikiBody,
      );
    }
  }

  private fillJsonToUploadTable(
    musicJson: {
      group: MusicJson.GroupInfo;
      torrent: MusicJson.Torrent;
    },
    name: string,
  ): void {
    const buf = Buffer.from(
      JSON.stringify({
        status: 'success',
        response: musicJson,
      }),
    );

    this.attachFile({
      data: buf,
      selector: '#torrent-json-file',
      contentType: 'application/json',
      fileName: name,
      format: 'json',
    });
  }

  private attachFile(options: {
    data: Buffer | string;
    selector: string;
    contentType: string;
    fileName: string;
    format: string;
    charset?: string;
  }): void {
    const {
      data,
      selector,
      contentType,
      fileName,
      format,
      charset = 'UTF-8',
    } = options;

    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, charset);
    const base64Data = buf.toString('base64');
    const fileInput = $(selector);

    if (base64Data && fileInput.length > 0) {
      const blob = base64ToBlob(base64Data, contentType);
      const file = new File([blob], `${fileName}.${format}`, {
        type: contentType,
      });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const uploadInput = fileInput[0] as HTMLInputElement;
      uploadInput.files = dataTransfer.files;
      uploadInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  private toUnicodeEntities(str: string): string {
    const excludedChars = ['<', '>', '&', ';', '/'];

    return str
      .split('')
      .map((char) => {
        const code = char.charCodeAt(0);
        if (code > 127 && !excludedChars.includes(char)) {
          const hexCode = code.toString(16);
          return `&#${parseInt(hexCode, 16)};`;
        }
        return char;
      })
      .join('');
  }
}

registry.register(new GazelleMusic());
