import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getIMDBData, GMFetch } from '@/common';
import { registry } from './registry';
import './KG';

vi.mock(import('@/common'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getIMDBData: vi.fn(),
    GMFetch: vi.fn(),
  };
});

const uploadPage = `
  <div id="upside"></div>
  <div>
    <input name="lang" />
    <select name="country_id"></select>
    <select name="genre_main_id"></select>
    <select name="subgenre"></select>
    <textarea id="bbcodetextarea"></textarea>
  </div>`;

describe('KG target filler', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input type="submit" value="next >>" />
      <input name="title" />
      <textarea id="ripspecs"></textarea>
      ${uploadPage}`;
    vi.mocked(GMFetch).mockResolvedValue(uploadPage);
    delete (window as unknown as { kgXss?: boolean }).kgXss;
  });

  it('fills the description as plain text without running markup', async () => {
    vi.mocked(getIMDBData).mockResolvedValue({
      description:
        'A plot <script>window.kgXss = true</script><img src=x onerror="window.kgXss = true">',
      genre: ['Drama'],
      poster: 'https://example.com/poster.jpg',
      details: { country: 'United States', Languages: 'English' },
    } as unknown as Awaited<ReturnType<typeof getIMDBData>>);

    const filler = registry.getApplicableFiller('KG', '');
    expect(filler).not.toBeNull();
    await filler!.fill({
      imdbUrl: 'https://www.imdb.com/title/tt0000001/',
      mediaInfos: [''],
      screenshots: ['https://example.com/s 1.png'],
      resolution: '1080p',
      source: 'bluray',
      videoType: 'encode',
    } as unknown as TorrentInfo.Info);

    const textarea =
      document.querySelector<HTMLTextAreaElement>('#bbcodetextarea')!;
    expect(textarea.value).toContain(
      '[img]https://example.com/poster.jpg[/img]',
    );
    expect(textarea.value).toContain(
      '[quote]A plot <script>window.kgXss = true</script>',
    );
    expect(textarea.value).toContain(
      '[img]https://example.com/s%201.png[/img]',
    );
    expect(document.querySelector('script, img')).toBeNull();
    expect((window as unknown as { kgXss?: boolean }).kgXss).toBeUndefined();
  });
});
