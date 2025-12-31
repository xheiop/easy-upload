import parseTorrent, { toTorrentFile } from 'parse-torrent';
import { GMFetch, $t } from '../common';
import { Buffer } from 'buffer/index.js';
import { CURRENT_SITE_INFO, PT_SITE, SiteName } from '@/const';
import { toast } from 'sonner';
import $ from 'jquery';

const getFormat = (data: string) => {
  if (data.match(/pdf/i)) {
    return 'pdf';
  } else if (data.match(/EPUB/i)) {
    return 'epub';
  } else if (data.match(/MOBI/i)) {
    return 'mobi';
  } else if (data.match(/mp3/i)) {
    return 'mp3';
  } else if (data.match(/mp4/i)) {
    return 'mp4';
  } else if (data.match(/txt/i)) {
    return 'txt';
  } else if (data.match(/azw3/i)) {
    return 'azw3';
  } else if (data.match(/镜像/i)) {
    return 'iso';
  }
  return 'other';
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    fileReader.readAsDataURL(blob);
    fileReader.onerror = () => {
      reject(new Error('blobToBase64 error'));
    };
  });
};

const getTorrentFileData = async (
  selector = '',
  torrentLink = '',
  targetSiteName: string,
) => {
  let downloadLink = torrentLink || $(selector).attr('href');
  if (!downloadLink) {
    console.warn('Failed to get torrent file download link');
    return null;
  }
  if (!downloadLink.startsWith('http') && !downloadLink.startsWith('/')) {
    downloadLink = `${CURRENT_SITE_INFO.url}/${downloadLink}`;
  } else if (downloadLink.startsWith('/')) {
    downloadLink = `${CURRENT_SITE_INFO.url}${downloadLink}`;
  }
  try {
    const file = await GMFetch<ArrayBuffer>(downloadLink, {
      method: 'GET',
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    const result = parseTorrent(Buffer.from(file));
    const siteInfo = PT_SITE[targetSiteName as SiteName] as Site.SiteInfo;
    const announceUrl = siteInfo?.torrent?.announce || 'tracker.com';
    const buf = toTorrentFile({
      ...result,
      comment: '',
      announce: [announceUrl],
      info: {
        ...result.info,
        source: '',
      },
    });
    const blob = new Blob([buf], { type: 'application/x-bittorrent' });
    const base64 = await blobToBase64(blob);
    return base64;
  } catch (error) {
    toast.error(`${$t('种子文件下载失败')} ${$t('请手动下载')}`);
    console.log(error);
    return '';
  }
};
export { getFormat, getTorrentFileData };
