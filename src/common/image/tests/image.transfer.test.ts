import { vi, describe, it, expect } from 'vitest';
import { transferImgToCheveretoSite } from '../image.transfer';
import { GMFetch } from '@/common/utils';
import {
  getCheveretoToken,
  createCheveretoRequestConfig,
  parseCheveretoResponse,
} from '../image.upload.helper';

vi.mock('../image.upload.helper', { spy: true });

vi.mock('@/common/utils', () => ({
  GMFetch: vi.fn(),
  $t: vi.fn((key) => key),
}));

vi.mock(import('../image.utils'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getImageBBCodeMatches: vi.fn(),
    cachedUrlToFile: vi.fn(),
    withUploadErrorHandling: vi.fn((fn) => fn),
  };
});

describe('transferImgToCheveretoSite', () => {
  it('should transfer images to Chevereto site and return image info', async () => {
    const imgUrls = [
      'http://example.com/image1.jpg',
      'http://example.com/image2.jpg',
    ];
    const authToken = 'authToken';
    const imgHost = 'http://example.com';
    const formData = new FormData();
    vi.mocked(getCheveretoToken).mockResolvedValueOnce(authToken);
    vi.mocked(createCheveretoRequestConfig).mockResolvedValue({
      method: 'POST',
      data: formData,
    });
    const expectedResponse = [
      {
        status_txt: 'OK',
        image: {
          url: 'http://example.com/img1.png',
          thumb: {
            url: 'http://example.com/thumb1.png',
          },
        },
      },
      {
        status_txt: 'OK',
        image: {
          url: 'http://example.com/img2.png',
          thumb: {
            url: 'http://example.com/thumb2.png',
          },
        },
      },
    ];
    vi.mocked(GMFetch)
      .mockResolvedValueOnce(expectedResponse[0])
      .mockResolvedValueOnce(expectedResponse[1]);
    const expectedResult = [
      {
        original: 'http://example.com/img1.png',
        thumbnail: 'http://example.com/thumb1.png',
      },
      {
        original: 'http://example.com/img2.png',
        thumbnail: 'http://example.com/thumb2.png',
      },
    ];
    vi.mocked(parseCheveretoResponse).mockResolvedValueOnce(expectedResult);
    const uploadFn = await transferImgToCheveretoSite;
    const result = await uploadFn(imgUrls, imgHost);
    expect(result).toEqual(expectedResult);
    expect(getCheveretoToken).toHaveBeenCalledWith(imgHost);
    expect(createCheveretoRequestConfig).toHaveBeenCalledWith(
      imgUrls[0],
      imgHost,
      authToken,
    );
    expect(createCheveretoRequestConfig).toHaveBeenCalledWith(
      imgUrls[1],
      imgHost,
      authToken,
    );
    expect(GMFetch).toHaveBeenCalledTimes(2);
    expect(parseCheveretoResponse).toHaveBeenCalledWith(expectedResponse);
  });
});
