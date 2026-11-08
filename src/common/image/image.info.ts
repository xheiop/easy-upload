import { getOriginalImgUrl } from './image.url';
import { ImgInfo } from './image.types';
import { CONFIG } from './image.config';
import { getImageBBCodeMatches } from './image.utils';

/**
 * Get image information from BBCode
 *
 * @async
 * @param {string} bbcode - The BBCode string containing the image URLs
 * @throws {Error} If no valid image URLs are found in the BBCode
 * @returns {Promise<ImgInfo>} An object containing the original and thumbnail image URLs
 */

export const getImgInfoFromBBCode = async (
  bbcode: string,
): Promise<ImgInfo> => {
  if (!bbcode) {
    throw new Error('Invalid BBCode - No BBCode found');
  }
  const originalUrl = await getOriginalImgUrl(bbcode);
  if (!originalUrl) {
    throw new Error('Invalid BBCode - No original URL found');
  }
  const thumbnailUrl = bbcode.match(/\[img\]([^[]*)\[/)?.[1]?.trim() ?? '';
  if (!thumbnailUrl) {
    throw new Error('Invalid BBCode - No thumbnail URL found');
  }
  return {
    original: originalUrl,
    thumbnail: thumbnailUrl,
  };
};

/**
 * Extract and filter images from BBCode
 *
 * @param {string} bbcode - The BBCode string containing the image URLs
 * @returns {string[]} An array of filtered image URLs or image BBCode
 */

export const extractImgsFromBBCode = async (
  bbcode: string,
): Promise<string[]> => {
  if (!bbcode) {
    return [];
  }
  const imgBBCodeMatches = getImageBBCodeMatches(bbcode);
  const matchImgBBCodes = Array.from(imgBBCodeMatches);
  if (matchImgBBCodes.length < 1) {
    return [];
  }
  const extractOriginalUrlsOfScreenshotPromises = matchImgBBCodes.map(
    async (bbcode) => {
      return await getOriginalImgUrl(bbcode);
    },
  );
  const { FILTER_IMGS_NAMES } = CONFIG;
  const screenshotUrls = (
    await Promise.all(extractOriginalUrlsOfScreenshotPromises)
  ).filter((url) => !FILTER_IMGS_NAMES.some((name) => url.includes(name)));
  return screenshotUrls;
};
