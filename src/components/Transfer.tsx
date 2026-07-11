import { useState, useCallback, useMemo } from 'preact/hooks';
import { CURRENT_SITE_NAME } from '@/const';
import {
  $t,
  transferImgToCheveretoSite,
  uploadToPixhost,
  uploadToImgbox,
  uploadToHDB,
} from '@/common';
import { I18nKey } from '@/common/utils/utils.types';
import { useTorrentInfo } from '@/hooks/useTorrentInfo';
import { toast } from 'sonner';
import { ImgInfo } from '@/common/image/image.types';
import { clearUrlFileCache } from '@/common/image/image.utils';

const IMAGE_HOSTS = {
  imgbox: {
    url: 'https://imgbox.com',
    name: 'imgbox',
    handler: uploadToImgbox,
  },
  imgbb: {
    url: 'https://imgbb.com/json',
    name: 'imgbb',
    handler: transferImgToCheveretoSite,
  },
  gifyu: {
    url: 'https://gifyu.com/json',
    name: 'gifyu',
    handler: transferImgToCheveretoSite,
  },
  pixhost: {
    url: 'https://pixhost.to',
    name: 'pixhost',
    handler: uploadToPixhost,
  },
  HDB: {
    url: 'https://img.hdbits.org',
    name: 'HDB',
    handler: uploadToHDB,
  },
} as const;

type ImageHostKey = keyof typeof IMAGE_HOSTS;

const Transfer = () => {
  const { torrentInfo, updateTorrentInfo } = useTorrentInfo();

  const [imgHost, setImgHost] = useState<ImageHostKey>('imgbox');
  const [btnDisable, setBtnDisable] = useState(false);
  const [btnText, setBtnText] = useState<I18nKey>('transfer.btnConvert');

  const transferImgClosed = useMemo(
    () => GM_getValue<boolean>('easy-upload.transfer-img-closed'),
    [],
  );

  const getAllImages = useCallback(() => {
    const { comparisons = [], screenshots = [] } = torrentInfo;
    const allImgs = [...screenshots];

    comparisons.forEach((comparison) => {
      if (comparison.imgs && Array.isArray(comparison.imgs)) {
        allImgs.push(...comparison.imgs);
      }
    });

    return [...new Set(allImgs)];
  }, [torrentInfo]);

  const updateDescriptionImages = useCallback(
    (originalUrls: string[], newBBCodes: string[]) => {
      let { description } = torrentInfo;

      originalUrls.forEach((originalUrl, index) => {
        const newBBCode = newBBCodes[index] || '';

        if (originalUrl.match(/i\.hdbits\.org/)) {
          const imgId = originalUrl.match(/i\.hdbits\.org\/(.+)\./)?.[1] ?? '';
          const urlReg = new RegExp(
            `\\[url=https://img.hdbits.org/${imgId}\\].+?\\[\\/url\\]\n*`,
            'ig',
          );

          if (description.match(urlReg)) {
            description = description.replace(urlReg, newBBCode);
          }
        } else if (description.includes(originalUrl)) {
          const urlReg = new RegExp(
            `\\[url=${originalUrl}\\].+?\\[\\/url\\]\n*`,
            'ig',
          );

          if (description.match(urlReg)) {
            description = description.replace(urlReg, newBBCode);
          } else {
            description = description.replace(
              new RegExp(`\\[img\\]${originalUrl}\\[\\/img\\]\n*`, 'ig'),
              newBBCode,
            );
          }
        }
      });

      return description;
    },
    [torrentInfo],
  );

  const handleThumbnailConversion = useCallback(async () => {
    if (btnDisable) return;

    try {
      const images = getAllImages();

      if (images.length < 1) {
        throw new Error($t('error.imageListFetchFailed'));
      }

      setBtnText('transfer.btnConverting');
      setBtnDisable(true);

      const selectedHost = IMAGE_HOSTS[imgHost];
      let uploadedImgs: ImgInfo[] = [];

      if (imgHost === 'HDB') {
        uploadedImgs = await uploadToHDB(images, torrentInfo.title);
      } else if (imgHost === 'imgbb' || imgHost === 'gifyu') {
        uploadedImgs = await transferImgToCheveretoSite(
          images,
          selectedHost.url,
        );
      } else if (imgHost === 'pixhost') {
        uploadedImgs = await uploadToPixhost(images);
      } else if (imgHost === 'imgbox') {
        uploadedImgs = await uploadToImgbox(images);
      }
      const imgsBBCodeArray = uploadedImgs.map(
        (img) => `[url=${img.original}][img]${img.thumbnail}[/img][/url]`,
      );

      if (uploadedImgs.length) {
        const { screenshots = [] } = torrentInfo;

        const updatedDescription = updateDescriptionImages(
          images,
          imgsBBCodeArray,
        );

        updateTorrentInfo({
          screenshots: imgsBBCodeArray.slice(0, screenshots.length),
          description: updatedDescription,
        });

        toast.success($t('transfer.toastSuccess'));
      }
    } catch (error) {
      toast.error((error as Error).message);
      console.error('缩略图转换失败:', error);
    } finally {
      clearUrlFileCache();
      setBtnText('transfer.btnConvert');
      setBtnDisable(false);
    }
  }, [
    btnDisable,
    imgHost,
    getAllImages,
    updateDescriptionImages,
    torrentInfo,
    updateTorrentInfo,
  ]);

  if (transferImgClosed || CURRENT_SITE_NAME === 'BTN') {
    return null;
  }

  return (
    <div className="function-list-item">
      <div className="upload-section">
        <button
          className={btnDisable ? 'is-disabled' : ''}
          onClick={handleThumbnailConversion}
          disabled={btnDisable}
        >
          {$t(btnText)}
        </button>

        <select
          value={imgHost}
          onChange={(e) =>
            setImgHost((e.target as HTMLSelectElement).value as ImageHostKey)
          }
          disabled={btnDisable}
        >
          {Object.entries(IMAGE_HOSTS).map(([key, host]) => (
            <option key={key} value={key}>
              {host.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default Transfer;
