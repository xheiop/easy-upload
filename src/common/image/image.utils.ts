import { $t, GMFetch } from '@/common/utils';
import { CONFIG } from './image.config';
import { UrlTransformStrategy } from './image.types';
import { urlToFile } from './image.url';
export class ImageUploadError extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'ImageUploadError';
  }
}

export const throwUploadError = (
  message?: string,
  originalError?: unknown,
): never => {
  const errorMessage = message || $t(CONFIG.ERROR_MESSAGES.UPLOAD_FAILED);
  throw new ImageUploadError(errorMessage, originalError);
};

const urlFileCache = new Map<string, Promise<File>>();

export const cachedUrlToFile = async (url: string): Promise<File> => {
  if (!url) {
    throw new Error('URL is required to convert to file');
  }
  if (!urlFileCache.has(url)) {
    urlFileCache.set(url, urlToFile(url));
  }
  return urlFileCache.get(url)!;
};

export class HdBitsStrategy implements UrlTransformStrategy {
  matches(url: string): boolean {
    return url.includes('img.hdbits.org');
  }

  async transform(url: string): Promise<string> {
    const data = await GMFetch<string>(url);
    const doc = new DOMParser().parseFromString(data, 'text/html');
    const imgElem = doc.querySelector('#viewimage');
    if (!imgElem) {
      throw new Error(
        "Couldn't find image element when retrieving from HDBits",
      );
    }
    const imgSrc = imgElem.getAttribute('src');
    if (!imgSrc) {
      throw new Error(
        'No valid image source found when retrieving from HDBits',
      );
    }
    return imgSrc;
  }
}

export class PterClubStrategy implements UrlTransformStrategy {
  matches(url: string, bbCode: string): boolean {
    return bbCode.includes('img.pterclub.net');
  }

  async transform(url: string, bbCode: string): Promise<string> {
    const imgUrl = bbCode.match(/img\](([^[])+)/)?.[1] ?? '';
    if (!imgUrl) {
      throw new Error('Invalid PterClub image URL');
    }
    return imgUrl.replace(/\.th/g, '');
  }
}

export class ImageBoxStrategy implements UrlTransformStrategy {
  matches(url: string, bbCode: string): boolean {
    return bbCode.includes('imgbox.com');
  }

  async transform(url: string, bbCode: string): Promise<string> {
    const imgUrl = bbCode.match(/img\](([^[])+)/)?.[1] ?? '';
    if (!imgUrl) {
      throw new Error('Invalid ImageBox image BBCode');
    }
    if (!imgUrl.match(/thumbs\d.+?_t\.(png|jpg)/)) {
      throw new Error('Invalid ImageBox image URL');
    }
    return imgUrl
      .replace(/thumbs(\d)/, 'images$1')
      .replace(/_t(\.(png|jpg))/, '_o.$2');
  }
}

export class ImageBamStrategy implements UrlTransformStrategy {
  matches(url: string): boolean {
    return url.includes('imagebam.com');
  }

  async transform(url: string): Promise<string> {
    const originalPage = await GMFetch<string>(url);
    const doc = new DOMParser().parseFromString(originalPage, 'text/html');
    const imgElem = doc.querySelector('.main-image');
    if (!imgElem) {
      throw new Error(
        "Couldn't find image element when retrieving from ImageBam",
      );
    }
    const imgSrc = imgElem.getAttribute('src');
    if (!imgSrc) {
      throw new Error(
        'No valid image source found when retrieving from ImageBam',
      );
    }
    return imgSrc;
  }
}

export class BeyondHdStrategy implements UrlTransformStrategy {
  matches(url: string, bbCode: string): boolean {
    return bbCode.includes('beyondhd.co');
  }

  async transform(url: string, bbCode: string): Promise<string> {
    const imgUrl = bbCode.match(/img\](([^[])+)/)?.[1] ?? '';
    if (!imgUrl) {
      throw new Error('Invalid BeyondHD image BBCode');
    }

    return imgUrl
      .replace(/\.(th|md)\.(png|jpg|gif)/, '.$2')
      .replace(/cache\/t\//, 'cache/i/');
  }
}

export class PixHostStrategy implements UrlTransformStrategy {
  matches(url: string, bbCode: string): boolean {
    return bbCode.includes('pixhost.to');
  }

  async transform(url: string, bbCode: string): Promise<string> {
    const hostNumber = bbCode.match(/img\]https:\/\/t(\d+)\./)?.[1];
    if (!hostNumber || !url.includes('show')) {
      throw new Error('Invalid PixHost image BBCode');
    }
    return url.replace(/(pixhost\.to)\/show/, `img${hostNumber}.$1/images`);
  }
}

export const URLStrategies: UrlTransformStrategy[] = [
  new HdBitsStrategy(),
  new PterClubStrategy(),
  new ImageBoxStrategy(),
  new ImageBamStrategy(),
  new BeyondHdStrategy(),
  new PixHostStrategy(),
];

/**
 * Base image upload handler with error handling and validation
 *
 * @template P - Types of parameters for the upload function
 * @template R - Type of results returned by the upload function
 * @param {((...args: P) => Promise<R>)} uploadFn - Actual upload implementation
 * @param {string} serviceName - Name of upload service for error context
 * @param {object} options - Additional options
 * @param {boolean} options.validateFirstArg - Whether to validate the first argument (default: true)
 * @param {R} options.defaultResult - Default result to return on error
 * @returns {(...args: P) => Promise<R>} Wrapped function with error handling
 */
export const withUploadErrorHandling = async <P extends unknown[], R>(
  uploadFn: (...args: P) => Promise<R>,
  serviceName: string,
  options: {
    validateFirstArg?: boolean;
    defaultResult?: R;
  } = {},
): Promise<(...args: P) => Promise<R>> => {
  const { validateFirstArg = true, defaultResult = [] as unknown as R } =
    options;

  return async (...args: P): Promise<R> => {
    try {
      if (validateFirstArg) {
        const firstArg = args[0];
        if (
          firstArg === undefined ||
          firstArg === null ||
          (Array.isArray(firstArg) && firstArg.length === 0)
        ) {
          return defaultResult;
        }
      }

      return await uploadFn(...args);
    } catch (error) {
      if (error instanceof ImageUploadError) {
        throw error;
      }
      const errorMessage =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : 'Unknown error';
      throwUploadError(
        `${$t(
          CONFIG.ERROR_MESSAGES.UPLOAD_FAILED,
        )} - ${serviceName}. ${errorMessage}`,
        error,
      );

      return defaultResult;
    }
  };
};

/**
 * Get image BBCode matches
 *
 * @param {string} bbcode
 * @returns {string[]}
 */
export const getImageBBCodeMatches = (bbcode: string): string[] => {
  const matches = bbcode.match(
    /(\[url=(http(s)*:\/{2}.+?)\])?\[img\](http(s)?:.+?)\[\/img](\[\/url\])?/gi,
  );
  if (!matches) {
    return [];
  }
  return Array.from(matches);
};
