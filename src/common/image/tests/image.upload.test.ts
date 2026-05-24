import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { uploadToHDB, uploadToImgbox, uploadToPixhost } from '../image.upload';
import { GMFetch } from '@/common/utils';

import { cachedUrlToFile } from '../image.utils';
import {
  createHDBRequestConfig,
  parseHDBResponse,
  getImgboxToken,
  createImgboxRequestConfig,
  parseImgboxResponse,
  createPixhostRequestConfig,
  parsePixhostResponse,
} from '../image.upload.helper';

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.resetAllMocks();
});

vi.mock('@/common/utils', () => ({
  GMFetch: vi.fn(),
  $t: vi.fn((key) => key),
  createFormData: vi.fn(),
}));

vi.mock(import('../image.utils'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    cachedUrlToFile: vi.fn(),
    withUploadErrorHandling: vi.fn((fn) => fn),
  };
});

vi.mock('../image.upload.helper', { spy: true });

describe('uploadToHDB', () => {
  it('should upload images to HDB and return image info', async () => {
    const imgUrls = [
      'http://example.com/image1.jpg',
      'http://example.com/image2.jpg',
    ];
    const galleryName = 'Test Gallery';
    const formData = new FormData();
    vi.mocked(createHDBRequestConfig).mockResolvedValueOnce({
      url: 'http://example.com/upload',
      options: { method: 'POST', data: formData },
    });
    vi.mocked(GMFetch).mockResolvedValueOnce('response data');
    const returnedData = [
      {
        original: 'https://hdbits.org/img1.png',
        thumbnail: 'https://hdbits.org/thumb1.png',
      },
      {
        original: 'https://hdbits.org/img2.png',
        thumbnail: 'https://hdbits.org/thumb2.png',
      },
    ];
    vi.mocked(parseHDBResponse).mockResolvedValueOnce(returnedData);
    const uploadFn = await uploadToHDB;
    const result = await uploadFn(imgUrls, galleryName);
    expect(result).toEqual(returnedData);
    expect(createHDBRequestConfig).toHaveBeenCalledWith(imgUrls, galleryName);
    expect(GMFetch).toHaveBeenCalledWith('http://example.com/upload', {
      method: 'POST',
      data: formData,
    });
    expect(parseHDBResponse).toHaveBeenCalledWith('response data');
  });
});

describe('uploadToImgbox', () => {
  it('should upload images to Imgbox and return image info', async () => {
    const imgUrls = [
      'http://example.com/image1.jpg',
      'http://example.com/image2.jpg',
    ];
    const tokenData = {
      tokenSecret: {
        token_id: 'token_id',
        token_secret: 'token_secret',
      },
      authToken: 'authToken',
    };
    const files = [new File([''], 'image1.jpg'), new File([''], 'image2.jpg')];
    const expectedResult = [
      {
        original: 'https://imgbox.com/img1.png',
        thumbnail: 'https://imgbox.com/thumb1.png',
      },
      {
        original: 'https://imgbox.com/img2.png',
        thumbnail: 'https://imgbox.com/thumb2.png',
      },
    ];
    const expectedResponse = [
      {
        files: {
          original_url: 'https://imgbox.com/img1.png',
          thumbnail_url: 'https://imgbox.com/thumb1.png',
        },
      },
      {
        files: {
          original_url: 'https://imgbox.com/img1.png',
          thumbnail_url: 'https://imgbox.com/thumb1.png',
        },
      },
    ];
    vi.mocked(getImgboxToken).mockResolvedValueOnce(tokenData);
    vi.mocked(cachedUrlToFile)
      .mockResolvedValueOnce(files[0])
      .mockResolvedValueOnce(files[1]);
    vi.mocked(createImgboxRequestConfig).mockReturnValueOnce({
      method: 'POST',
      headers: {
        'X-CSRF-Token': tokenData.authToken,
      },
      data: new FormData(),
    });
    vi.mocked(GMFetch)
      .mockResolvedValueOnce(expectedResponse[0])
      .mockResolvedValueOnce(expectedResponse[1]);
    vi.mocked(parseImgboxResponse).mockResolvedValueOnce(expectedResult);
    const uploadFn = await uploadToImgbox;
    const result = await uploadFn(imgUrls);
    expect(result).toBe(expectedResult);
    expect(getImgboxToken).toHaveBeenCalled();
    expect(cachedUrlToFile).toHaveBeenCalledTimes(2);
    expect(createImgboxRequestConfig).toHaveBeenCalledWith(
      tokenData.tokenSecret,
      tokenData.authToken,
      files[0],
    );
    expect(createImgboxRequestConfig).toHaveBeenCalledWith(
      tokenData.tokenSecret,
      tokenData.authToken,
      files[1],
    );
    expect(GMFetch).toHaveBeenCalledTimes(2);
    expect(parseImgboxResponse).toHaveBeenCalledWith(expectedResponse);
  });
});

describe('uploadToPixhost', () => {
  it('should upload images to Pixhost and return image info', async () => {
    const imgUrls = [
      'http://example.com/image1.jpg',
      'http://example.com/image2.jpg',
    ];
    const formData = new FormData();
    vi.mocked(createPixhostRequestConfig).mockReturnValueOnce({
      url: 'http://example.com/upload',
      options: { method: 'POST', data: formData },
    });
    vi.mocked(GMFetch).mockResolvedValueOnce('response data');
    const returnedData = [
      {
        original: 'https://pixhost.org/img1.png',
        thumbnail: 'https://pixhost.org/thumb1.png',
      },
      {
        original: 'https://pixhost.org/img2.png',
        thumbnail: 'https://pixhost.org/thumb2.png',
      },
    ];
    vi.mocked(parsePixhostResponse).mockResolvedValueOnce(returnedData);
    const uploadFn = await uploadToPixhost;
    const result = await uploadFn(imgUrls);
    expect(result).toEqual(returnedData);
    expect(createPixhostRequestConfig).toHaveBeenCalledWith(imgUrls);
    expect(GMFetch).toHaveBeenCalledWith('http://example.com/upload', {
      method: 'POST',
      data: formData,
    });
    expect(parsePixhostResponse).toHaveBeenCalledWith('response data');
  });
});
