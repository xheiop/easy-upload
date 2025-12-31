import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GMFetch, $t } from '@/common/utils';
import { CONFIG } from '@/common/image/image.config';
import { urlToFile } from '../image.url';
import {
  HdBitsStrategy,
  PterClubStrategy,
  ImageBoxStrategy,
  ImageBamStrategy,
  BeyondHdStrategy,
  PixHostStrategy,
  URLStrategies,
  throwUploadError,
  ImageUploadError,
  withUploadErrorHandling,
  cachedUrlToFile,
  getImageBBCodeMatches,
} from '../image.utils';

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.resetAllMocks();
});

vi.mock('@/common/utils', () => ({
  GMFetch: vi.fn(),
  $t: vi.fn((key) => key),
}));

vi.mock('../image.url');

describe('HdBitsStrategy', () => {
  it('should match img.hdbits.org urls or not', () => {
    const strategy = new HdBitsStrategy();
    expect(strategy.matches('https://img.hdbits.org/image.jpg')).toBe(true);
    expect(strategy.matches('https://example.com/image.jpg')).toBe(false);
    expect(strategy.matches('')).toBe(false);
  });
  it('should transform img.hdbits.org urls correctly', async () => {
    const strategy = new HdBitsStrategy();
    vi.mocked(GMFetch).mockResolvedValueOnce(
      '<img id="viewimage" src="https://img.hdbits.org/image.png" />',
    );
    const result = await strategy.transform('https://img.hdbits.org/image');
    expect(result).toBe('https://img.hdbits.org/image.png');
  });
  it('should handle GMFetch errors during transformation', async () => {
    const strategy = new HdBitsStrategy();
    vi.mocked(GMFetch).mockRejectedValueOnce(new Error('Network error'));
    await expect(
      strategy.transform('https://img.hdbits.org/image'),
    ).rejects.toThrow('Network error');
  });
  it('should handle missing viewimage element', async () => {
    const strategy = new HdBitsStrategy();
    vi.mocked(GMFetch).mockResolvedValueOnce(
      '<img src="https://img.hdbits.org/image.png" />',
    );
    await expect(
      strategy.transform('https://img.hdbits.org/image'),
    ).rejects.toThrow(
      "Couldn't find image element when retrieving from HDBits",
    );
  });
  it('should handle empty src attribute', async () => {
    const strategy = new HdBitsStrategy();
    vi.mocked(GMFetch).mockResolvedValueOnce('<img id="viewimage" src="" />');
    await expect(
      strategy.transform('https://img.hdbits.org/image'),
    ).rejects.toThrow(
      'No valid image source found when retrieving from HDBits',
    );
  });
});

describe('PterClubStrategy', () => {
  it('should match pterclub.net urls or not', () => {
    const strategy = new PterClubStrategy();
    expect(
      strategy.matches('', '[img]https://img.pterclub.net/image.jpg[/img]'),
    ).toBe(true);
    expect(
      strategy.matches('', '[img]https://example.com/image.jpg[/img]'),
    ).toBe(false);
    expect(strategy.matches('', '')).toBe(false);
  });
  it('should transform pterclub.net urls correctly', async () => {
    const strategy = new PterClubStrategy();
    const result = await strategy.transform(
      '',
      '[img]https://img.pterclub.net/image.th.png[/img]',
    );
    expect(result).toBe('https://img.pterclub.net/image.png');
  });
  it('should handle invalid BBCode during transformation', async () => {
    const strategy = new PterClubStrategy();
    await expect(strategy.transform('', 'invalid bbcode')).rejects.toThrow(
      'Invalid PterClub image URL',
    );
  });
});

describe('ImageBoxStrategy', () => {
  it('should match imgbox.com urls or not', () => {
    const strategy = new ImageBoxStrategy();
    expect(
      strategy.matches('', '[img]https://imgbox.com/image.jpg[/img]'),
    ).toBe(true);
    expect(
      strategy.matches('', '[img]https://example.com/image.jpg[/img]'),
    ).toBe(false);
    expect(strategy.matches('', '')).toBe(false);
  });
  it('should transform imgbox.com urls correctly', async () => {
    const strategy = new ImageBoxStrategy();
    const result = await strategy.transform(
      '',
      '[img]https://thumbs2.imgbox.com/aa/60/aXwtuXfH_t.png[/img]',
    );
    expect(result).toBe('https://images2.imgbox.com/aa/60/aXwtuXfH_o.png');
    const result2 = await strategy.transform(
      '',
      '[img]https://thumbs99.imgbox.com/aa/60/aXwtuXfH_t.png[/img]',
    );
    expect(result2).toBe('https://images99.imgbox.com/aa/60/aXwtuXfH_o.png');
  });
  it('should handle invalid BBCode during transformation', async () => {
    const strategy = new ImageBoxStrategy();
    await expect(strategy.transform('', 'invalid bbcode')).rejects.toThrow(
      'Invalid ImageBox image BBCode',
    );
  });
  it('should handle malformed imgbox urls', async () => {
    const strategy = new ImageBoxStrategy();
    await expect(
      strategy.transform('', '[img]https://thumbs2.imgbox.com/invalid[/img]'),
    ).rejects.toThrow('Invalid ImageBox image URL');
  });
});

describe('ImageBamStrategy', () => {
  it('should match imagebam.com urls or not', () => {
    const strategy = new ImageBamStrategy();
    expect(strategy.matches('https://imagebam.com/image.jpg')).toBe(true);
    expect(strategy.matches('https://example.com/image.jpg')).toBe(false);
    expect(strategy.matches('')).toBe(false);
  });
  it('should transform imagebam.com urls correctly', async () => {
    const strategy = new ImageBamStrategy();
    vi.mocked(GMFetch).mockResolvedValueOnce(
      '<img class="main-image" src="https://example.com/image.png" />',
    );
    const result = await strategy.transform('https://imagebam.com/image');
    expect(result).toBe('https://example.com/image.png');
  });
  it('should handle GMFetch errors during transformation', async () => {
    const strategy = new ImageBamStrategy();
    vi.mocked(GMFetch).mockRejectedValueOnce(new Error('Network error'));
    await expect(
      strategy.transform('https://imagebam.com/image'),
    ).rejects.toThrow('Network error');
  });
  it('should handle missing main-image element', async () => {
    const strategy = new ImageBamStrategy();
    vi.mocked(GMFetch).mockResolvedValueOnce(
      '<img src="https://example.com/image.png" />',
    );
    await expect(
      strategy.transform('https://imagebam.com/image'),
    ).rejects.toThrow(
      "Couldn't find image element when retrieving from ImageBam",
    );
  });
  it('should handle empty src attribute', async () => {
    const strategy = new ImageBamStrategy();
    vi.mocked(GMFetch).mockResolvedValueOnce(
      '<img class="main-image" src="" />',
    );
    await expect(
      strategy.transform('https://imagebam.com/image'),
    ).rejects.toThrow(
      'No valid image source found when retrieving from ImageBam',
    );
  });
});

describe('BeyondHdStrategy', () => {
  it('should match beyondhd.co urls or not', () => {
    const strategy = new BeyondHdStrategy();
    expect(strategy.matches('', 'https://beyondhd.co/image.jpg')).toBe(true);
    expect(strategy.matches('', 'https://example.com/image.jpg')).toBe(false);
    expect(strategy.matches('', '')).toBe(false);
  });
  it('should transform beyondhd.co urls correctly', async () => {
    const strategy = new BeyondHdStrategy();
    const resultForTh = await strategy.transform(
      '',
      '[img]https://beyondhd.co/image.th.png[/img]',
    );
    expect(resultForTh).toBe('https://beyondhd.co/image.png');
    const resultForMd = await strategy.transform(
      '',
      '[img]https://beyondhd.co/image.md.png[/img]',
    );
    expect(resultForMd).toBe('https://beyondhd.co/image.png');
  });
  it('should handle invalid BBCode during transformation', async () => {
    const strategy = new BeyondHdStrategy();
    await expect(strategy.transform('', 'invalid bbcode')).rejects.toThrow(
      'Invalid BeyondHD image BBCode',
    );
  });
  it('should handle malformed beyondhd urls', async () => {
    const strategy = new BeyondHdStrategy();
    const resultForInvalid = await strategy.transform(
      '',
      '[img]https://beyondhd.co/invalid[/img]',
    );
    expect(resultForInvalid).toBe('https://beyondhd.co/invalid');
  });
  it('should handle cache/t/ URLs', async () => {
    const strategy = new BeyondHdStrategy();
    const result = await strategy.transform(
      '',
      '[img]https://beyondhd.co/cache/t/images.beyondhd.co/i/172639778066e6bd543bab5.png[/img]',
    );
    expect(result).toBe(
      'https://beyondhd.co/cache/i/images.beyondhd.co/i/172639778066e6bd543bab5.png',
    );
  });
});

describe('PixHostStrategy', () => {
  it('should match pixhost.to urls or not', () => {
    const strategy = new PixHostStrategy();
    expect(strategy.matches('', 'https://pixhost.to/image.jpg')).toBe(true);
    expect(strategy.matches('', 'https://example.com/image.png')).toBe(false);
    expect(strategy.matches('', '')).toBe(false);
  });
  it('should transform pixhost.to urls correctly', async () => {
    const strategy = new PixHostStrategy();
    const result = await strategy.transform(
      'https://pixhost.to/show/img.png',
      '[img]https://t12.pixhost.to/thumbs/img.png[/img]',
    );
    expect(result).toBe('https://img12.pixhost.to/images/img.png');
  });
  it('should handle different pixhost subdomain patterns', async () => {
    const strategy = new PixHostStrategy();
    await expect(
      strategy.transform(
        'https://pixhost.to/show/img.png',
        '[img]https://pixhost.to/show/img.png[/img]',
      ),
    ).rejects.toThrow('Invalid PixHost image BBCode');
  });
  it('should handle malformed pixhost urls', async () => {
    const strategy = new PixHostStrategy();
    await expect(
      strategy.transform(
        'https://pixhost.to/show/img.png',
        '[img]https://pixhost.to/invalid[/img]',
      ),
    ).rejects.toThrow('Invalid PixHost image BBCode');
    await expect(
      strategy.transform('', '[img]https://pixhost.to/invalid[/img]'),
    ).rejects.toThrow('Invalid PixHost image BBCode');
    await expect(
      strategy.transform('https://pixhost.to/show/img.png', ''),
    ).rejects.toThrow('Invalid PixHost image BBCode');
  });
});

describe('URL Strategies', () => {
  it('should export all strategy classes', () => {
    expect(URLStrategies).toBeDefined();
    expect(URLStrategies.length).toBeGreaterThan(0);

    URLStrategies.forEach((strategy) => {
      expect(typeof strategy.matches).toBe('function');
      expect(typeof strategy.transform).toBe('function');
    });
  });
});

describe('throwUploadError', () => {
  it('should throw ImageUploadError with default message', () => {
    expect(() => throwUploadError()).toThrow(
      $t(CONFIG.ERROR_MESSAGES.UPLOAD_FAILED),
    );
  });
  it('should throw ImageUploadError with custom message', () => {
    expect(() => throwUploadError('Custom message')).toThrow('Custom message');
  });
  it('should throw ImageUploadError with original error', () => {
    const originalError = new Error('Original error');
    try {
      throwUploadError('Custom message', originalError);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ImageUploadError);
      expect((error as Error).message).toBe('Custom message');
      expect((error as ImageUploadError).originalError).toBe(originalError);
    }
  });
});

describe('withUploadErrorHandling', () => {
  it('should call the upload function with the provided arguments', async () => {
    const mockUploadFn = vi.fn().mockResolvedValueOnce('result');
    const wrappedFn = await withUploadErrorHandling(
      mockUploadFn,
      'Test Service',
    );
    const result = await wrappedFn('arg1', 'arg2', 123);
    expect(mockUploadFn).toBeCalledTimes(1);
    expect(mockUploadFn).toBeCalledWith('arg1', 'arg2', 123);
    expect(result).toBe('result');
  });
  it('should return the default result when first argument is null and validateFirstArg is true', async () => {
    const mockUploadFn = vi.fn().mockResolvedValueOnce('result');
    const wrappedFn = await withUploadErrorHandling(
      mockUploadFn,
      'Test Service',
      { validateFirstArg: true },
    );
    const result = await wrappedFn(null, 'arg2', 123);
    expect(mockUploadFn).toBeCalledTimes(0);
    expect(result).toEqual([]);
  });
  it('should return the default result when first argument is empty array and validateFirstArg is true', async () => {
    const mockUploadFn = vi.fn().mockResolvedValue(['result']);
    const wrappedFn = await withUploadErrorHandling(
      mockUploadFn,
      'TestService',
    );
    const result = await wrappedFn([], 'arg2', 123);
    expect(mockUploadFn).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
  it('should still call the upload function with invalid first argument when validateFirstArg is false', async () => {
    const mockUploadFn = vi.fn().mockResolvedValue(['result']);
    const wrappedFn = await withUploadErrorHandling(
      mockUploadFn,
      'TestService',
      { validateFirstArg: false },
    );

    const result = await wrappedFn([], 'arg2', 123);

    expect(mockUploadFn).toHaveBeenCalledTimes(1);
    expect(mockUploadFn).toHaveBeenCalledWith([], 'arg2', 123);
    expect(result).toEqual(['result']);
  });

  it('should use custom default result when provided', async () => {
    const mockUploadFn = vi.fn().mockResolvedValue(['result']);
    const customDefault = { custom: 'default' };
    const wrappedFn = await withUploadErrorHandling(
      mockUploadFn,
      'TestService',
      { defaultResult: customDefault },
    );

    const result = await wrappedFn(undefined, 'arg2', 123);

    expect(result).toBe(customDefault);
  });
  it('should throw original error when ImageUploadError is caught', async () => {
    const uploadError = new ImageUploadError('Original upload error');
    const mockUploadFn = vi.fn().mockRejectedValue(uploadError);

    const wrappedFn = await withUploadErrorHandling(
      mockUploadFn,
      'TestService',
    );
    await expect(wrappedFn('arg1')).rejects.toBe(uploadError);
    expect(mockUploadFn).toHaveBeenCalledTimes(1);
  });

  it('should wrap non-ImageUploadError errors with throwUploadError', async () => {
    const originalError = new Error('Network error');
    const mockUploadFn = vi.fn().mockRejectedValue(originalError);
    const wrappedFn = await withUploadErrorHandling(
      mockUploadFn,
      'TestService',
    );
    try {
      await wrappedFn('arg1');
      expect.fail('Expected an error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ImageUploadError);
      expect((error as ImageUploadError).message).toContain('TestService');
      expect((error as ImageUploadError).message).toContain('Network error');
      expect((error as ImageUploadError).originalError).toBe(originalError);
    }
  });
  it('should handle upload function returning non-Promise', async () => {
    const mockUploadFn = vi.fn().mockImplementation(() => {
      return 'Not a promise';
    });

    const wrappedFn = await withUploadErrorHandling(
      mockUploadFn,
      'TestService',
    );
    const result = await wrappedFn('arg1');
    expect(result).toBe('Not a promise');
  });
  it('should handle async errors in deeply nested promises', async () => {
    const originalError = new Error('Deep nested error');
    const mockUploadFn = vi.fn().mockImplementation(() => {
      return Promise.resolve().then(() => {
        return Promise.resolve().then(() => {
          throw originalError;
        });
      });
    });
    const wrappedFn = await withUploadErrorHandling(
      mockUploadFn,
      'TestService',
    );

    try {
      await wrappedFn('arg1');
    } catch (error) {
      expect(error).toBeInstanceOf(ImageUploadError);
      expect((error as ImageUploadError).message).toContain('TestService');
      expect((error as ImageUploadError).message).toContain(
        'Deep nested error',
      );
      expect((error as ImageUploadError).originalError).toBe(originalError);
    }
  });
  it('should pass all arguments to the upload function even with complex objects', async () => {
    const mockUploadFn = vi.fn().mockResolvedValue(['result']);
    const wrappedFn = await withUploadErrorHandling(
      mockUploadFn,
      'TestService',
    );

    const complexArg = {
      nested: {
        array: [1, 2, 3],
        func: () => 'test',
      },
      date: new Date(),
    };

    await wrappedFn(['item1', 'item2'], complexArg, new Map());

    expect(mockUploadFn).toHaveBeenCalledTimes(1);
    expect(mockUploadFn).toHaveBeenCalledWith(
      ['item1', 'item2'],
      complexArg,
      new Map(),
    );
  });
  it('should handle unknown error', async () => {
    const mockUploadFn = vi.fn().mockRejectedValue('random error');
    const wrappedFn = await withUploadErrorHandling(
      mockUploadFn,
      'TestService',
    );
    try {
      await wrappedFn('arg1');
    } catch (error) {
      expect(error).toBeInstanceOf(ImageUploadError);
      expect((error as ImageUploadError).message).toContain('Unknown error');
      expect((error as ImageUploadError).message).toContain('TestService');
    }
  });
});

describe('cachedUrlToFile', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });
  it('should return cached file if it exists', async () => {
    const file = new File(['file content'], 'file.txt', { type: 'text/plain' });
    const url = 'https://example.com/file.txt';
    vi.mocked(urlToFile).mockResolvedValueOnce(file);
    const result = await cachedUrlToFile(url);
    expect(result).toStrictEqual(file);
    expect(urlToFile).toHaveBeenCalledTimes(1);
  });
  it('should cache the file after first request', async () => {
    const file = new File(['file content'], 'file.txt', { type: 'text/plain' });
    const url = 'https://example.com/file1.txt';
    vi.mocked(urlToFile).mockResolvedValueOnce(file);
    const result = await cachedUrlToFile(url);
    const cache = await cachedUrlToFile(url);

    expect(result).toStrictEqual(file);
    expect(cache).toStrictEqual(file);
    expect(urlToFile).toHaveBeenCalledTimes(1);
    expect(urlToFile).toHaveBeenCalledWith(url);
  });
  it('should handle multiple urls', async () => {
    const file1 = new File(['file content'], 'file1.txt', {
      type: 'text/plain',
    });
    const file2 = new File(['file content'], 'file2.txt', {
      type: 'text/plain',
    });
    const url1 = 'https://example.com/file3.txt';
    const url2 = 'https://example.com/file4.txt';
    vi.mocked(urlToFile).mockImplementation((url) => {
      if (url === url1) {
        return Promise.resolve(file1);
      }
      return Promise.resolve(file2);
    });
    const result1 = await cachedUrlToFile(url1);
    const result2 = await cachedUrlToFile(url2);

    expect(result1).toStrictEqual(file1);
    expect(result2).toStrictEqual(file2);
    expect(urlToFile).toHaveBeenCalledTimes(2);
    expect(urlToFile).toHaveBeenCalledWith(url1);
    expect(urlToFile).toHaveBeenCalledWith(url2);
  });
  it('should handle urlToFile errors correctly', async () => {
    const url = 'https://example.com/invalid.jpg';
    const mockError = new Error('Failed to fetch');
    vi.mocked(urlToFile).mockRejectedValue(mockError);

    await expect(cachedUrlToFile(url)).rejects.toThrow(mockError);
    expect(urlToFile).toHaveBeenCalledTimes(1);
    await expect(cachedUrlToFile(url)).rejects.toThrow(mockError);
    expect(urlToFile).toHaveBeenCalledTimes(1);
  });
  it('should handle empty URL correctly', async () => {
    const emptyUrl = '';
    await expect(cachedUrlToFile(emptyUrl)).rejects.toThrow(
      'URL is required to convert to file',
    );
    expect(urlToFile).not.toHaveBeenCalled();
  });
  it('should return the promise from cache before it resolves', async () => {
    const url = 'https://example.com/image.jpg';
    const mockFile = new File(['test content'], 'image.jpg', {
      type: 'image/jpeg',
    });

    let resolvePromise: (value: File) => void;
    const delayedPromise = new Promise<File>((resolve) => {
      resolvePromise = resolve;
    });
    vi.mocked(urlToFile).mockReturnValue(delayedPromise);

    const promise1 = cachedUrlToFile(url);
    const promise2 = cachedUrlToFile(url);
    expect(promise1).toStrictEqual(promise2);
    resolvePromise!(mockFile);
    const result1 = await promise1;
    const result2 = await promise2;
    expect(result1).toBe(mockFile);
    expect(result2).toBe(mockFile);
    expect(urlToFile).toHaveBeenCalledTimes(1);
  });
});

describe('getImageBBCodeMatches', () => {
  it('should return matches for [img] bbcode', () => {
    const bbcode = '[img]https://example.com/image.jpg[/img]';
    const matches = getImageBBCodeMatches(bbcode);
    expect(matches).toHaveLength(1);
    expect(matches![0]).toBe('[img]https://example.com/image.jpg[/img]');
  });
  it('should return matches for [img] bbcode with multiple URLs', () => {
    const bbcode =
      '[img]https://example.com/image1.jpg[/img][img]https://example.com/image2.jpg[/img]';
    const matches = getImageBBCodeMatches(bbcode);
    expect(matches).toHaveLength(2);
    expect(matches![0]).toBe('[img]https://example.com/image1.jpg[/img]');
    expect(matches![1]).toBe('[img]https://example.com/image2.jpg[/img]');
  });
  it('should return matches for [img] bbcode with multiple URLs and other text', () => {
    const bbcode =
      'Some text [img]https://example.com/image1.jpg[/img] and [img]https://example.com/image2.jpg[/img]';
    const matches = getImageBBCodeMatches(bbcode);
    expect(matches).toHaveLength(2);
    expect(matches![0]).toBe('[img]https://example.com/image1.jpg[/img]');
    expect(matches![1]).toBe('[img]https://example.com/image2.jpg[/img]');
  });
  it('should return null for [img] bbcode with invalid URLs', () => {
    const bbcode = '[img]invalid[/img]';
    const matches = getImageBBCodeMatches(bbcode);
    expect(matches).toEqual([]);
  });
  it('should return matches for combined [url] and [img] bbcode', () => {
    const bbcode =
      '[url=https://example.com/image.jpg][img]https://example.com/image.jpg[/img][/url]';
    const matches = getImageBBCodeMatches(bbcode);
    expect(matches).toHaveLength(1);
    expect(matches![0]).toBe(bbcode);
  });
  it('should return matches for combined [url] and [img] bbcode with multiple URLs', () => {
    const bbcode = `[url=https://example.com/image1.jpg][img]https://example.com/image1.jpg[/img][/url]
      '[url=https://example.com/image2.jpg][img]https://example.com/image2.jpg[/img][/url]`;
    const matches = getImageBBCodeMatches(bbcode);
    expect(matches).toHaveLength(2);
    expect(matches![0]).toBe(
      '[url=https://example.com/image1.jpg][img]https://example.com/image1.jpg[/img][/url]',
    );
    expect(matches![1]).toBe(
      '[url=https://example.com/image2.jpg][img]https://example.com/image2.jpg[/img][/url]',
    );
  });
  it('should return [] for combined [url] and [img] bbcode with invalid URLs', () => {
    const bbcode = '[url=invalid][img]invalid[/img][/url]';
    const matches = getImageBBCodeMatches(bbcode);
    expect(matches).toEqual([]);
  });
  it('should return [] for [url] bbcode', () => {
    const bbcode = '[url=https://example.com/image.jpg]Link text[/url]';
    const matches = getImageBBCodeMatches(bbcode);
    expect(matches).toEqual([]);
  });
  it('should return [] for empty string', () => {
    const matches = getImageBBCodeMatches('');
    expect(matches).toEqual([]);
  });
  it('should return [] for invalid bbcode', () => {
    const matches = getImageBBCodeMatches('invalid bbcode');
    expect(matches).toEqual([]);
  });
});
