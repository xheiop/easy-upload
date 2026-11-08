import { vi, expect, beforeEach, describe, it } from 'vitest';
import { getOriginalImgUrl } from '../image.url';
import { getImgInfoFromBBCode, extractImgsFromBBCode } from '../image.info';
import { CONFIG } from '../image.config';

import { getImageBBCodeMatches } from '../image.utils';
vi.mock('../image.url', () => ({
  getOriginalImgUrl: vi.fn(),
}));
vi.mock('@/common/utils', () => ({
  GMFetch: vi.fn(),
  $t: vi.fn((key) => key),
}));
vi.mock('../image.utils', () => ({
  getImageBBCodeMatches: vi.fn(),
}));

describe('getImgInfoFromBBCode', () => {
  it('should throw error if bbcode is empty', async () => {
    await expect(getImgInfoFromBBCode('')).rejects.toThrow(
      'Invalid BBCode - No BBCode found',
    );
  });
  it('should throw error if no original image URL found', async () => {
    const bbCode = '[img]https://example.com/thumb1.png[/img]';
    vi.mocked(getOriginalImgUrl).mockResolvedValueOnce('');
    await expect(getImgInfoFromBBCode(bbCode)).rejects.toThrow(
      'Invalid BBCode - No original URL found',
    );
    expect(getOriginalImgUrl).toBeCalledTimes(1);
    expect(getOriginalImgUrl).toBeCalledWith(bbCode);
  });
  it('should throw error if no thumbnail image URL found', async () => {
    const bbCode = '[url=https://example.com/origina][/url]';
    const originalImgUrl = 'https://example.com/original.png';
    vi.mocked(getOriginalImgUrl).mockResolvedValueOnce(originalImgUrl);
    await expect(getImgInfoFromBBCode(bbCode)).rejects.toThrow(
      'Invalid BBCode - No thumbnail URL found',
    );
    expect(getOriginalImgUrl).toBeCalledTimes(1);
    expect(getOriginalImgUrl).toBeCalledWith(bbCode);
  });
  it('should return image info if original and thumbnail URLs are found', async () => {
    const bbCode =
      '[url=https://example.com/origina][img]https://example.com/thumb.jpg[/img][/url]';
    const originalImgUrl = 'https://example.com/original.png';
    vi.mocked(getOriginalImgUrl).mockResolvedValueOnce(originalImgUrl);
    const result = await getImgInfoFromBBCode(bbCode);
    expect(result).toEqual({
      original: originalImgUrl,
      thumbnail: 'https://example.com/thumb.jpg',
    });
    expect(getOriginalImgUrl).toBeCalledTimes(1);
    expect(getOriginalImgUrl).toBeCalledWith(bbCode);
  });
  it('space or new line should not affect the result', async () => {
    const bbCode = `
      [url=https://example.com/origina]
        [img] https://example.com/thumb.jpg
  [/img] 
  [/url]`;
    const originalImgUrl = 'https://example.com/original.png';
    vi.mocked(getOriginalImgUrl).mockResolvedValueOnce(originalImgUrl);
    const result = await getImgInfoFromBBCode(bbCode);
    expect(result).toEqual({
      original: originalImgUrl,
      thumbnail: 'https://example.com/thumb.jpg',
    });
    expect(getOriginalImgUrl).toBeCalledTimes(1);
    expect(getOriginalImgUrl).toBeCalledWith(bbCode);
  });
  it('should not hang on long whitespace runs after [img]', async () => {
    vi.mocked(getOriginalImgUrl).mockResolvedValue(
      'https://example.com/original.png',
    );
    const bbCode = `[url=https://example.com/original.png][img]${' '.repeat(50000)}`;
    const start = Date.now();
    await expect(getImgInfoFromBBCode(bbCode)).rejects.toThrow(
      'Invalid BBCode - No thumbnail URL found',
    );
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('should throw error if [img] BBCode is empty', async () => {
    const bbCode = '[url=https://example.com/origina][img][/img][/url]';
    const originalImgUrl = 'https://example.com/original.png';
    vi.mocked(getOriginalImgUrl).mockResolvedValueOnce(originalImgUrl);
    await expect(getImgInfoFromBBCode(bbCode)).rejects.toThrow(
      'Invalid BBCode - No thumbnail URL found',
    );
  });
});

describe('extractImgsFromBBCode', () => {
  beforeEach(() => {
    vi.spyOn(CONFIG, 'FILTER_IMGS_NAMES', 'get').mockReturnValue([
      'banner',
      'logo',
    ]);
  });

  it('should return empty array when bbcode is empty', async () => {
    const result = await extractImgsFromBBCode('');
    expect(result).toEqual([]);
    expect(getImageBBCodeMatches).not.toHaveBeenCalled();
  });

  it('should return empty array when no image BBCode matches found', async () => {
    vi.mocked(getImageBBCodeMatches).mockReturnValueOnce([]);

    const result = await extractImgsFromBBCode('some text without images');

    expect(result).toEqual([]);
    expect(getImageBBCodeMatches).toHaveBeenCalledWith(
      'some text without images',
    );
    expect(getOriginalImgUrl).not.toHaveBeenCalled();
  });

  it('should extract and return URLs from image BBCodes', async () => {
    const bbcode = '[img]image1.jpg[/img] text [img]image2.jpg[/img]';
    const imgBBCodes = ['[img]image1.jpg[/img]', '[img]image2.jpg[/img]'];

    vi.mocked(getImageBBCodeMatches).mockReturnValueOnce(imgBBCodes);
    vi.mocked(getOriginalImgUrl).mockResolvedValueOnce(
      'https://example.com/image1.jpg',
    );
    vi.mocked(getOriginalImgUrl).mockResolvedValueOnce(
      'https://example.com/image2.jpg',
    );

    const result = await extractImgsFromBBCode(bbcode);

    expect(result).toEqual([
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ]);
    expect(getImageBBCodeMatches).toHaveBeenCalledWith(bbcode);
    expect(getOriginalImgUrl).toHaveBeenCalledTimes(2);
    expect(getOriginalImgUrl).toHaveBeenCalledWith(imgBBCodes[0]);
    expect(getOriginalImgUrl).toHaveBeenCalledWith(imgBBCodes[1]);
  });

  it('should filter out URLs that contain filtered names', async () => {
    const bbcode =
      '[img]image1.jpg[/img] [img]banner.jpg[/img] [img]image3.jpg[/img] [img]logo.png[/img]';
    const imgBBCodes = [
      '[img]image1.jpg[/img]',
      '[img]banner.jpg[/img]',
      '[img]image3.jpg[/img]',
      '[img]logo.png[/img]',
    ];

    vi.mocked(getImageBBCodeMatches).mockReturnValueOnce(imgBBCodes);
    vi.mocked(getOriginalImgUrl).mockResolvedValueOnce(
      'https://example.com/image1.jpg',
    );
    vi.mocked(getOriginalImgUrl).mockResolvedValueOnce(
      'https://example.com/banner.jpg',
    );
    vi.mocked(getOriginalImgUrl).mockResolvedValueOnce(
      'https://example.com/image3.jpg',
    );
    vi.mocked(getOriginalImgUrl).mockResolvedValueOnce(
      'https://example.com/logo.png',
    );

    const result = await extractImgsFromBBCode(bbcode);

    expect(result).toEqual([
      'https://example.com/image1.jpg',
      'https://example.com/image3.jpg',
    ]);
    expect(getImageBBCodeMatches).toHaveBeenCalledWith(bbcode);
    expect(getOriginalImgUrl).toHaveBeenCalledTimes(4);
  });

  it('should handle mixed valid and invalid BBCodes', async () => {
    const bbcode = '[img]image1.jpg[/img] [invalid] [img]image2.jpg[/img]';
    const imgBBCodes = ['[img]image1.jpg[/img]', '[img]image2.jpg[/img]'];

    vi.mocked(getImageBBCodeMatches).mockReturnValueOnce(imgBBCodes);
    vi.mocked(getOriginalImgUrl).mockResolvedValueOnce(
      'https://example.com/image1.jpg',
    );
    vi.mocked(getOriginalImgUrl).mockResolvedValueOnce(
      'https://example.com/image2.jpg',
    );

    const result = await extractImgsFromBBCode(bbcode);

    expect(result).toEqual([
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ]);
  });

  it('should handle rejected promises during URL extraction', async () => {
    const bbcode =
      '[img]image1.jpg[/img] [img]image2.jpg[/img] [img]image3.jpg[/img]';
    const imgBBCodes = [
      '[img]image1.jpg[/img]',
      '[img]image2.jpg[/img]',
      '[img]image3.jpg[/img]',
    ];

    vi.mocked(getImageBBCodeMatches).mockReturnValueOnce(imgBBCodes);
    vi.mocked(getOriginalImgUrl).mockResolvedValueOnce(
      'https://example.com/image1.jpg',
    );
    vi.mocked(getOriginalImgUrl).mockRejectedValueOnce(
      new Error('Failed to extract URL'),
    );
    vi.mocked(getOriginalImgUrl).mockResolvedValueOnce(
      'https://example.com/image3.jpg',
    );

    await expect(extractImgsFromBBCode(bbcode)).rejects.toThrow(
      'Failed to extract URL',
    );
  });
});
