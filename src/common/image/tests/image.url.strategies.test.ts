import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getOriginalImgUrl } from '../image.url';
import { GMFetch } from '@/common/utils';

// End-to-end checks with the real URL strategies (image.url.test.ts mocks them)
vi.mock('@/common/utils', () => ({
  GMFetch: vi.fn(),
  $t: vi.fn((key) => key),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('getOriginalImgUrl with real strategies', () => {
  it('should resolve HDBits images by fetching the view page', async () => {
    vi.mocked(GMFetch).mockResolvedValue(
      '<img id="viewimage" src="https://i.hdbits.org/abc123.png" />',
    );
    const result = await getOriginalImgUrl(
      '[url=https://img.hdbits.org/abc123][img]https://t.hdbits.org/abc123.jpg[/img][/url]',
    );
    expect(GMFetch).toHaveBeenCalledWith('https://img.hdbits.org/abc123');
    expect(result).toBe('https://i.hdbits.org/abc123.png');
  });

  it('should resolve ImageBam images by fetching the view page', async () => {
    vi.mocked(GMFetch).mockResolvedValue(
      '<img class="main-image" src="https://images4.imagebam.com/ab/ME1ABCD.png" />',
    );
    const result = await getOriginalImgUrl(
      '[url=https://www.imagebam.com/view/ME1ABCD][img]https://thumbs4.imagebam.com/ab/ME1ABCD_t.png[/img][/url]',
    );
    expect(GMFetch).toHaveBeenCalledWith(
      'https://www.imagebam.com/view/ME1ABCD',
    );
    expect(result).toBe('https://images4.imagebam.com/ab/ME1ABCD.png');
  });

  it('should rewrite PterClub, ImageBox, BeyondHD and PixHost thumbnails', async () => {
    await expect(
      getOriginalImgUrl(
        '[url=https://img.pterclub.net/image/abc][img]https://img.pterclub.net/images/2023/01/01/abc.th.png[/img][/url]',
      ),
    ).resolves.toBe('https://img.pterclub.net/images/2023/01/01/abc.png');
    await expect(
      getOriginalImgUrl(
        '[url=https://imgbox.com/aXwtuXfH][img]https://thumbs2.imgbox.com/aa/60/aXwtuXfH_t.png[/img][/url]',
      ),
    ).resolves.toBe('https://images2.imgbox.com/aa/60/aXwtuXfH_o.png');
    await expect(
      getOriginalImgUrl(
        '[url=https://beyondhd.co/image/abc][img]https://beyondhd.co/images/2023/01/01/abc.th.png[/img][/url]',
      ),
    ).resolves.toBe('https://beyondhd.co/images/2023/01/01/abc.png');
    await expect(
      getOriginalImgUrl(
        '[url=https://pixhost.to/show/77/123_a.png][img]https://t77.pixhost.to/thumbs/77/123_a.png[/img][/url]',
      ),
    ).resolves.toBe('https://img77.pixhost.to/images/77/123_a.png');
    expect(GMFetch).not.toHaveBeenCalled();
  });

  it('should still match protocol-relative image urls', async () => {
    await expect(
      getOriginalImgUrl(
        '[url=https://example.com/x][img]//thumbs2.imgbox.com/aa/60/aXwtuXfH_t.png[/img][/url]',
      ),
    ).resolves.toBe('//images2.imgbox.com/aa/60/aXwtuXfH_o.png');
  });

  it('should not fetch spoofed hosts and return the link as-is', async () => {
    const spoofed = [
      '[url=https://evil.com/?img.hdbits.org][img]https://evil.com/a.jpg[/img][/url]',
      '[url=https://img.hdbits.org.evil.com/a][img]https://evil.com/a.jpg[/img][/url]',
      '[url=https://evil.com/imagebam.com/a][img]https://evil.com/a.jpg[/img][/url]',
    ];
    for (const bbcode of spoofed) {
      const link = bbcode.match(/\[url=([^\]]+)\]/)![1];
      await expect(getOriginalImgUrl(bbcode)).resolves.toBe(link);
    }
    expect(GMFetch).not.toHaveBeenCalled();
  });

  it('should not rewrite thumbnails that only mention a host in the path', async () => {
    const bbcode =
      '[url=https://evil.com/x][img]https://evil.com/imgbox.com/thumbs2/a_t.png[/img][/url]';
    await expect(getOriginalImgUrl(bbcode)).resolves.toBe('https://evil.com/x');
  });
});
