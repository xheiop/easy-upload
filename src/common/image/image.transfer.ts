import { CONFIG } from './image.config';
import { GMFetch } from '@/common/utils';
import { withUploadErrorHandling } from '@/common/image/image.utils';
import { ImgInfo, CheveretoResponse } from '@/common/image/image.types';
import {
  getCheveretoToken,
  createCheveretoRequestConfig,
  parseCheveretoResponse,
} from '@/common/image/image.upload.helper';

/**
 * Transfer images from other Image hostings to Chevereto site
 *
 * @async
 * @param {string} imgUrls - The image URLs to be uploaded
 * @param {string} imgHost - The image hosting service URL (default is CONFIG.URLS.IMGBB)
 * @throws {ImageUploadError} If the upload fails
 * @throws {Error} If the upload fails with a non-ImageUploadError
 * @returns {Promise<ImgInfo[]>}
 */

export const transferImgToCheveretoSite = withUploadErrorHandling(
  async (
    imgUrls: string[],
    imgHost: string = CONFIG.URLS.IMGBB,
  ): Promise<ImgInfo[]> => {
    const authToken = await getCheveretoToken(imgHost);
    const imgUploadPromises = imgUrls.map(async (imgUrl) => {
      const requestOptions = await createCheveretoRequestConfig(
        imgUrl,
        imgHost,
        authToken,
      );
      return GMFetch<CheveretoResponse>(imgHost, requestOptions);
    });
    const data = await Promise.all(imgUploadPromises);
    return parseCheveretoResponse(data);
  },
  'Chevereto',
);
