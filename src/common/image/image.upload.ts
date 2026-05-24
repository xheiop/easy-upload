import { GMFetch } from '@/common/utils';
import { CONFIG } from './image.config';
import { cachedUrlToFile, withUploadErrorHandling } from './image.utils';
import { ImgInfo, ImgBoxResponse } from './image.types';
import {
  createHDBRequestConfig,
  parseHDBResponse,
  getImgboxToken,
  createImgboxRequestConfig,
  parseImgboxResponse,
  createPixhostRequestConfig,
  parsePixhostResponse,
} from './image.upload.helper';

/**
 * Upload images to HDBits
 *
 * @async
 * @param {string[]} imgUrls
 * @param {string} galleryName
 * @throws {ImageUploadError} If the upload fails
 * @throws {Error} If the upload fails with a non-ImageUploadError
 * @returns {Promise<ImgInfo[]>}
 */
export const uploadToHDB = withUploadErrorHandling(
  async (imgUrls: string[], galleryName: string): Promise<ImgInfo[]> => {
    const { url, options } = await createHDBRequestConfig(imgUrls, galleryName);
    const data = await GMFetch<string>(url, options);
    return await parseHDBResponse(data);
  },
  'HDB',
);

/**
 * Upload images to Imgbox
 *
 * @async
 * @param {string[]} imgUrls
 * @throws {ImageUploadError} If the upload fails
 * @throws {Error} If the upload fails with a non-ImageUploadError
 * @returns {Promise<ImgInfo[]>}
 */

export const uploadToImgbox = withUploadErrorHandling(
  async (imgUrls: string[]): Promise<ImgInfo[]> => {
    const { tokenSecret, authToken } = await getImgboxToken();
    const files = await Promise.all(
      imgUrls.map((item) => cachedUrlToFile(item)),
    );
    const fileUploadPromises = files.map((file) => {
      const requestOptions = createImgboxRequestConfig(
        tokenSecret,
        authToken,
        file,
      );
      return GMFetch<ImgBoxResponse>(CONFIG.URLS.IMGBOX_UPLOAD, requestOptions);
    });
    const data = await Promise.all(fileUploadPromises);
    return parseImgboxResponse(data);
  },
  'Imgbox',
);

/**
 * Upload images to Pixhost
 *
 * @async
 * @param {string[]} imgUrls
 * @throws {ImageUploadError} If the upload fails
 * @throws {Error} If the upload fails with a non-ImageUploadError
 * @returns {Promise<ImgInfo[]>}
 */
export const uploadToPixhost = withUploadErrorHandling(
  async (imgUrls: string[]): Promise<ImgInfo[]> => {
    const { url, options } = createPixhostRequestConfig(imgUrls);
    const data = await GMFetch<string>(url, options);
    return parsePixhostResponse(data);
  },
  'Pixhost',
  { validateFirstArg: true, defaultResult: [] },
);
