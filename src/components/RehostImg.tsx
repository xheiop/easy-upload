import { useState, useCallback, useMemo } from 'preact/hooks';
import { CURRENT_SITE_NAME } from '@/const';
import { $t, getOriginalImgUrl, transferImgToCheveretoSite } from '@/common';
import { useTorrentInfo } from '@/hooks/useTorrentInfo';
import { ImgInfo } from '@/common/image/image.types';
import { toast } from 'sonner';

const IMAGE_HOSTS = {
  gifyu: {
    name: 'gifyu',
    url: 'https://gifyu.com/json',
  },
} as const;

type ImageHostKey = keyof typeof IMAGE_HOSTS;

const UploadImg = () => {
  const { torrentInfo, updateTorrentInfo } = useTorrentInfo();

  const [selectHost, setSelectHost] = useState<ImageHostKey>('gifyu');
  const [btnDisable, setBtnDisable] = useState(false);
  const [btnText, setBtnText] = useState('转存截图');
  const [canCopy, setCanCopy] = useState(false);
  const [screenBBCode, setScreenBBCode] = useState<string[]>([]);
  const [copyText, setCopyText] = useState('拷贝');

  const uploadImgClosed = useMemo(
    () => GM_getValue<boolean>('easy-upload.rehost-img-closed', false),
    [],
  );

  const handleCopyBBCode = useCallback(() => {
    GM_setClipboard(screenBBCode.join(''));
    setCopyText('已拷贝');
  }, [screenBBCode]);

  const extractAndUploadImages = useCallback(async () => {
    const { screenshots } = torrentInfo;

    try {
      const originalImgUrlPromises = screenshots.map((img) =>
        getOriginalImgUrl(img),
      );
      const originalImgUrls = await Promise.all(originalImgUrlPromises);

      if (originalImgUrls.length === 0) {
        throw new Error($t('图片上传失败'));
      }

      const imgData: ImgInfo[] = await (
        await transferImgToCheveretoSite
      )(originalImgUrls, IMAGE_HOSTS[selectHost].url);

      if (imgData.length === 0) {
        throw new Error($t('图片上传失败'));
      }

      return imgData;
    } catch (error) {
      console.error('fail to extract and upload images:', error);
      throw error;
    }
  }, [selectHost, torrentInfo]);

  const updateTorrentWithNewImages = useCallback(
    (imgData: ImgInfo[]) => {
      const { description, originalDescription } = torrentInfo;

      const newScreenshots = imgData.map((img) => img.original);

      const screenBBcodeArray = imgData.map(
        (img) => `[img]${img.original}[/img]`,
      );

      const allImages =
        description.match(
          /(\[url=(http(s)*:\/{2}.+?)\])?\[img\](.+?)\[\/img](\[url\])?/gi,
        ) ?? [];

      let updatedDescription = description;
      let updatedOriginalDescription = originalDescription || '';

      if (allImages.length > 0) {
        allImages.forEach((img) => {
          const imgWithUrl = img.match(/\[url=.+?\]/) ? `${img}[/url]` : img;
          updatedOriginalDescription = updatedOriginalDescription.replace(
            imgWithUrl,
            '',
          );
          updatedDescription = updatedDescription.replace(imgWithUrl, '');
        });
      }

      updateTorrentInfo({
        screenshots: newScreenshots,
        originalDescription: `${updatedOriginalDescription}\n${screenBBcodeArray.join('')}`,
        description: `${updatedDescription}\n${screenBBcodeArray.join('')}`,
      });

      return screenBBcodeArray;
    },
    [torrentInfo, updateTorrentInfo],
  );

  const handleUploadScreenshots = useCallback(async () => {
    if (btnDisable) return;

    setBtnText('上传中，请稍候...');
    setBtnDisable(true);
    setCanCopy(false);
    setCopyText('拷贝');

    try {
      const imgData = await extractAndUploadImages();

      const screenBBcodeArray = updateTorrentWithNewImages(imgData);

      setScreenBBCode(screenBBcodeArray);
      setCanCopy(true);

      toast.success($t('转存成功'));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : $t('转存失败');
      toast.error(errorMessage);
      console.error('截图转存失败:', error);
    } finally {
      setBtnText('转存截图');
      setBtnDisable(false);
    }
  }, [btnDisable, extractAndUploadImages, updateTorrentWithNewImages]);

  if (uploadImgClosed || CURRENT_SITE_NAME === 'BTN') {
    return null;
  }

  return (
    <div className="function-list-item">
      <div className="upload-section">
        <button
          disabled={btnDisable}
          className={btnDisable ? 'is-disabled' : ''}
          onClick={handleUploadScreenshots}
        >
          {$t(btnText)}
        </button>

        <select
          value={selectHost}
          onChange={(e) =>
            setSelectHost((e.target as HTMLSelectElement).value as ImageHostKey)
          }
          disabled={btnDisable}
        >
          {Object.entries(IMAGE_HOSTS).map(([key, host]) => (
            <option key={key} value={key}>
              {host.name}
            </option>
          ))}
        </select>

        {canCopy && (
          <button className="copy-img" onClick={handleCopyBBCode}>
            {$t(copyText)}
          </button>
        )}
      </div>
    </div>
  );
};

export default UploadImg;
