import { expect, it, vi, beforeEach, afterEach, describe } from 'vitest';

import {
  createHDBRequestConfig,
  parseHDBResponse,
  getImgboxToken,
  createImgboxRequestConfig,
  parseImgboxResponse,
  createPixhostRequestConfig,
  parsePixhostResponse,
  getCheveretoToken,
  createCheveretoRequestConfig,
  parseCheveretoResponse,
} from '../image.upload.helper';
import { cachedUrlToFile, ImageUploadError } from '../image.utils';
import { CONFIG } from '../image.config';
import { getImgInfoFromBBCode } from '../image.info';
import { GMFetch, createFormData } from '@/common/utils';

vi.mock('@/common/utils', () => {
  return {
    $t: vi.fn(),
    GMFetch: vi.fn(),
    createFormData: vi.fn(),
  };
});

vi.mock(import('../image.utils'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    cachedUrlToFile: vi.fn(),
    withUploadErrorHandling: vi.fn(),
    getImageBBCodeMatches: vi.fn(),
  };
});
vi.mock('../image.info', () => ({
  getImgInfoFromBBCode: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  vi.resetAllMocks();
});

describe('createHDBRequestConfig', () => {
  it('should create HDB request config', async () => {
    const imgUrls = [
      'http://example.com/image1.jpg',
      'http://example.com/image2.jpg',
    ];
    const files = [new File([], 'image1.jpg'), new File([], 'image2.jpg')];
    const galleryName = 'test gallery';
    vi.mocked(cachedUrlToFile)
      .mockResolvedValueOnce(files[0])
      .mockResolvedValueOnce(files[1]);
    vi.mocked(createFormData).mockReturnValueOnce(new FormData());
    const { url, options } = await createHDBRequestConfig(imgUrls, galleryName);
    expect(cachedUrlToFile).toHaveBeenCalledTimes(2);
    expect(createFormData).toHaveBeenCalledTimes(1);
    expect(createFormData).toHaveBeenCalledWith(
      {
        galleryoption: '1',
        galleryname: galleryName,
      },
      [
        {
          fieldName: 'images_files',
          file: files,
        },
      ],
    );
    expect(url).toBe(CONFIG.URLS.HDB_UPLOAD);
    expect(options.method).toBe('POST');
    expect(options.data instanceof FormData).toBe(true);
  });
  it('should throw error if cachedUrlToFile fails', async () => {
    const imgUrls = ['http://example.com/image1.jpg'];
    vi.mocked(cachedUrlToFile).mockRejectedValueOnce(
      new Error('Failed to cache URL to file'),
    );
    await expect(
      createHDBRequestConfig(imgUrls, 'test gallery'),
    ).rejects.toThrow('Failed to cache URL to file');
    expect(cachedUrlToFile).toHaveBeenCalledTimes(1);
    expect(createFormData).not.toHaveBeenCalled();
  });
});

describe('parseHDBResponse', () => {
  it('should parse HDB response correctly', async () => {
    const data = `[url=http://example.com/image1.jpg][img]http://example.com/image1.jpg[/img][/url] [url=http://example.com/image2.jpg][img]http://example.com/image2.jpg[/img][/url]`;
    const imgInfo1 = {
      original: 'http://example.com/image1.jpg',
      thumbnail: 'http://example.com/image1.jpg',
    };
    const imgInfo2 = {
      original: 'http://example.com/image2.jpg',
      thumbnail: 'http://example.com/image2.jpg',
    };
    vi.mocked(getImgInfoFromBBCode)
      .mockResolvedValueOnce(imgInfo1)
      .mockResolvedValueOnce(imgInfo2);
    const imgInfos = await parseHDBResponse(data);
    expect(getImgInfoFromBBCode).toHaveBeenCalledTimes(2);
    expect(getImgInfoFromBBCode).toHaveBeenCalledWith(data.split(' ')[0]);
    expect(getImgInfoFromBBCode).toHaveBeenCalledWith(data.split(' ')[1]);
    expect(imgInfos).toEqual([imgInfo1, imgInfo2]);
  });
  it('should throw error if data is empty', async () => {
    try {
      await parseHDBResponse('');
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ImageUploadError);
    }
  });
  it('should throw error if data contains error', async () => {
    try {
      await parseHDBResponse('error message');
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ImageUploadError);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('error message');
    }
  });
  it('should throw error if data contains empty result', async () => {
    try {
      await parseHDBResponse('    \n    ');
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ImageUploadError);
      expect((error as Error).message).toContain('Empty Result');
    }
  });
  it('should throw error if getImgInfoFromBBCode fails', async () => {
    const data = 'url1\nurl2';
    vi.mocked(getImgInfoFromBBCode).mockRejectedValueOnce(
      new Error('Failed to get image info from BBCode'),
    );
    try {
      await parseHDBResponse(data);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain(
        'Failed to get image info from BBCode',
      );
    }
  });
});
describe('getImgboxToken', () => {
  it('should parse imgbox token correctly', async () => {
    const rawHtml = '<meta content="token" name="csrf-token" />';
    vi.mocked(GMFetch).mockResolvedValueOnce(rawHtml);
    vi.mocked(GMFetch).mockResolvedValueOnce({
      token_secret: 'token secret',
      token_id: 'token id',
    });
    const { tokenSecret, authToken } = await getImgboxToken();
    expect(authToken).toBe('token');
    expect(tokenSecret).toEqual({
      token_id: 'token id',
      token_secret: 'token secret',
    });
    expect(GMFetch).toHaveBeenCalledTimes(2);
    expect(GMFetch).toHaveBeenCalledWith(CONFIG.URLS.IMGBOX);
    expect(GMFetch).toHaveBeenCalledWith(
      `${CONFIG.URLS.IMGBOX}/ajax/token/generate`,
      {
        responseType: 'json',
        method: 'POST',
        headers: {
          'X-CSRF-Token': 'token',
        },
      },
    );
  });
  it('should throw error if authToken is empty', async () => {
    const rawHtml = '<meta content="" name="csrf-token" />';
    vi.mocked(GMFetch).mockResolvedValueOnce(rawHtml);
    try {
      await getImgboxToken();
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ImageUploadError);
      expect((error as Error).message).toContain('Invalid AuthToken');
      expect(GMFetch).toHaveBeenCalledTimes(1);
    }
  });
  it('should throw error if GMFetch fails', async () => {
    vi.mocked(GMFetch).mockRejectedValueOnce(new Error('Failed to fetch'));
    try {
      await getImgboxToken();
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Failed to fetch');
      expect(GMFetch).toHaveBeenCalledTimes(1);
    }
  });
  it('should throw error when second GMFetch fails', async () => {
    vi.mocked(GMFetch).mockResolvedValueOnce(
      '<meta content="token" name="csrf-token" />',
    );
    vi.mocked(GMFetch).mockRejectedValueOnce(new Error('Failed to fetch'));
    try {
      await getImgboxToken();
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Failed to fetch');
      expect(GMFetch).toHaveBeenCalledTimes(2);
    }
  });
  it('should throw error if tokenSecret is empty', async () => {
    const rawHtml = '<meta content="token" name="csrf-token" />';
    vi.mocked(GMFetch).mockResolvedValueOnce(rawHtml);
    vi.mocked(GMFetch).mockResolvedValueOnce({});
    try {
      await getImgboxToken();
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Invalid Token');
      expect(GMFetch).toHaveBeenCalledTimes(2);
    }
  });
});
describe('createImgboxRequestConfig', () => {
  it('should create IMGBOX request config correctly', async () => {
    const tokenSecret = {
      token_id: 'token id',
      token_secret: 'token secret',
    };
    const authToken = 'token';
    const file = new File([], 'image.jpg');
    vi.mocked(createFormData).mockReturnValueOnce(new FormData());
    const options = createImgboxRequestConfig(tokenSecret, authToken, file);
    expect(createFormData).toHaveBeenCalledTimes(1);
    expect(createFormData).toHaveBeenCalledWith(
      {
        token_id: tokenSecret.token_id,
        token_secret: tokenSecret.token_secret,
        content_type: '1',
        thumbnail_size: '350c',
        gallery_id: 'null',
        gallery_secret: 'null',
        comments_enabled: '0',
      },
      [{ fieldName: 'files[]', file }],
    );
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({
      'X-CSRF-Token': authToken,
    });
    expect(options.data instanceof FormData).toBe(true);
  });
});

describe('parseImgboxResponse', () => {
  it('should parse imgbox response correctly', async () => {
    const data = [
      {
        files: [
          {
            original_url: 'http://example.com/original.jpg',
            thumbnail_url: 'http://example.com/thumb.jpg',
          },
        ],
      },
    ];
    const imgInfo = await parseImgboxResponse(data);
    expect(imgInfo).toEqual([
      {
        original: 'http://example.com/original.jpg',
        thumbnail: 'http://example.com/thumb.jpg',
      },
    ]);
  });
  it("should throw error if provided data doesn't contain files", async () => {
    try {
      await parseImgboxResponse([
        {
          files: [],
        },
      ]);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ImageUploadError);
      expect((error as Error).message).toContain('Empty Data to Parse');
    }
  });
  it('should return [] if provided parameter is empty array', () => {
    const imgInfo = parseImgboxResponse([]);
    expect(imgInfo).toEqual([]);
  });
});

describe('createPixhostRequestConfig', () => {
  it('should create Pixhost request config correctly', () => {
    const imgUrls = [
      'http://example.com/image1.jpg',
      'http://example.com/image2.jpg',
    ];
    const params = encodeURI(
      `imgs=${imgUrls.join('\n')}&content_type=1&max_th_size=300`,
    );
    const { url, options } = createPixhostRequestConfig(imgUrls);
    expect(url).toBe(CONFIG.URLS.PIXHOST_UPLOAD);
    expect(options.method).toBe('POST');
    expect(options.data).toBe(params);
    expect(options.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    });
  });
  it('should throw error if imgUrls is empty', () => {
    try {
      createPixhostRequestConfig([]);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ImageUploadError);
      expect((error as Error).message).toContain('Empty URLs');
    }
  });
});

describe('parsePixhostResponse', () => {
  it('should parse Pixhost response correctly', () => {
    const data =
      'upload_results = {"images":[{"th_url":"http://example.com/thumb.jpg","show_url":"http://example.com/original.jpg"}]};';
    const imgInfo = parsePixhostResponse(data);
    expect(imgInfo).toEqual([
      {
        thumbnail: 'http://example.com/thumb.jpg',
        original: 'http://example.com/original.jpg',
      },
    ]);
  });
  it('should throw error if data is empty', () => {
    try {
      parsePixhostResponse('');
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ImageUploadError);
      expect((error as Error).message).toContain('Empty Result');
    }
  });
  it("should throw error if data doesn't contain images", () => {
    try {
      parsePixhostResponse('upload_results =');
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ImageUploadError);
      expect((error as Error).message).toContain('Empty Result');
    }
  });
  it('should throw error if images is empty', () => {
    try {
      parsePixhostResponse('upload_results = {"images":[]};');
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ImageUploadError);
      expect((error as Error).message).toContain(
        'No images found in the response',
      );
    }
  });
});

describe('getCheveretoToken', () => {
  it('should parse Chevereto token correctly', async () => {
    const imgHost = 'http://example.com/json';
    vi.mocked(GMFetch).mockResolvedValueOnce(
      'PF.obj.config.auth_token = "token";',
    );
    const authToken = await getCheveretoToken(imgHost);
    expect(authToken).toBe('token');
    expect(GMFetch).toHaveBeenCalledTimes(1);
    expect(GMFetch).toHaveBeenCalledWith('http://example.com');
  });
  it('should throw error if authToken is empty', async () => {
    const imgHost = 'http://example.com/json';
    vi.mocked(GMFetch).mockResolvedValueOnce('');
    try {
      await getCheveretoToken(imgHost);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ImageUploadError);
      expect((error as Error).message).toContain('Invalid AuthToken');
      expect(GMFetch).toHaveBeenCalledTimes(1);
    }
  });
  it('should throw error if GMFetch fails', async () => {
    const imgHost = 'http://example.com/json';
    vi.mocked(GMFetch).mockRejectedValueOnce(new Error('Failed to fetch'));
    try {
      await getCheveretoToken(imgHost);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(GMFetch).toHaveBeenCalledTimes(1);
    }
  });
  it('should throw error if tokenSecret is empty', async () => {
    const imgHost = 'http://example.com/json';
    vi.mocked(GMFetch).mockResolvedValueOnce('PF.obj.config.auth_token = "";');
    try {
      await getCheveretoToken(imgHost);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Invalid AuthToken');
      expect(GMFetch).toHaveBeenCalledTimes(1);
    }
  });
});

describe('createCheveretoRequestConfig', () => {
  it('should create Chevereto request correctly when images are hosted on HDB', async () => {
    const imgUrl = 'http://i.hdbits.org/image.jpg';
    const imgHost = 'http://example.com/json';
    const authToken = 'token';
    const fileData = new File([], 'image.jpg');
    vi.mocked(cachedUrlToFile).mockResolvedValueOnce(fileData);
    vi.mocked(createFormData).mockReturnValueOnce(new FormData());
    const options = await createCheveretoRequestConfig(
      imgUrl,
      imgHost,
      authToken,
    );
    expect(cachedUrlToFile).toHaveBeenCalledTimes(1);
    expect(cachedUrlToFile).toHaveBeenCalledWith(imgUrl);
    expect(createFormData).toHaveBeenCalledTimes(1);
    expect(createFormData).toHaveBeenCalledWith(
      {
        type: 'file',
        action: 'upload',
        timestamp: expect.any(String),
        auth_token: authToken,
      },
      [{ fieldName: 'source', file: fileData }],
    );
    expect(options.method).toBe('POST');
    expect(options.data).toBeInstanceOf(FormData);
  });
  it('should create Chevereto request correctly when images are to upload to Gifyu', async () => {
    const imgUrl = 'http://example.com/image.jpg';
    const imgHost = 'http://gifyu.com/json';
    const authToken = 'token';
    const fileData = new File([], 'image.jpg');
    vi.mocked(cachedUrlToFile).mockResolvedValueOnce(fileData);
    vi.mocked(createFormData).mockReturnValueOnce(new FormData());
    const options = await createCheveretoRequestConfig(
      imgUrl,
      imgHost,
      authToken,
    );
    expect(cachedUrlToFile).toHaveBeenCalledTimes(1);
    expect(cachedUrlToFile).toHaveBeenCalledWith(imgUrl);
    expect(createFormData).toHaveBeenCalledTimes(1);
    expect(createFormData).toHaveBeenCalledWith(
      {
        type: 'file',
        action: 'upload',
        timestamp: expect.any(String),
        auth_token: authToken,
      },
      [{ fieldName: 'source', file: fileData }],
    );
    expect(options.method).toBe('POST');
    expect(options.data).toBeInstanceOf(FormData);
  });
  it('should create Chevereto request correctly when images are to upload from URL', async () => {
    const imgUrl = 'http://example.com/image.jpg';
    const imgHost = 'http://example.com/json';
    const authToken = 'token';
    vi.mocked(createFormData).mockReturnValueOnce(new FormData());
    const options = await createCheveretoRequestConfig(
      imgUrl,
      imgHost,
      authToken,
    );
    expect(createFormData).toHaveBeenCalledTimes(1);
    expect(createFormData).toHaveBeenCalledWith({
      type: 'url',
      source: imgUrl,
      action: 'upload',
      timestamp: expect.any(String),
      auth_token: authToken,
    });
    expect(options.method).toBe('POST');
    expect(options.data).toBeInstanceOf(FormData);
    expect(cachedUrlToFile).not.toHaveBeenCalled();
  });
});

describe('parseCheveretoResponse', () => {
  it('should parse Chevereto response correctly', () => {
    const data = [
      {
        status_txt: 'OK',
        image: {
          url: 'http://example.com/image.jpg',
          thumb: {
            url: 'http://example.com/thumb.jpg',
          },
        },
      },
    ];
    const imgInfo = parseCheveretoResponse(data);
    expect(imgInfo).toEqual([
      {
        original: 'http://example.com/image.jpg',
        thumbnail: 'http://example.com/thumb.jpg',
      },
    ]);
  });
  it('should throw error if status_txt is not OK', () => {
    const data = [
      {
        status_txt: 'Error',
      },
    ];
    try {
      // @ts-expect-error - Testing invalid data
      parseCheveretoResponse(data);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ImageUploadError);
    }
  });
  it('should throw error if image is empty', () => {
    const data = [
      {
        status_txt: 'OK',
        image: null,
      },
    ];
    try {
      // @ts-expect-error - Testing invalid data
      parseCheveretoResponse(data);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ImageUploadError);
    }
  });
});
