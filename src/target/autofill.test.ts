import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  getDoubanBasicDataByQuery,
  getDoubanInfoByIdOrDoubanUrl,
  getDoubanTVItemData,
} from '@/common';
import { FormattedMovieData } from '@/common/movie/movie.types';
import { toast } from 'sonner';
import autofill, {
  autoFillDoubanInfo,
  formatIMDbFieldValue,
  getCategoryFromDouban,
  getDoubanIdFromText,
  mergeDoubanDescription,
  resetAutofillState,
} from './autofill';

const site = vi.hoisted(() => ({ name: 'PTer' }));

vi.mock(import('@/const'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    get CURRENT_SITE_NAME() {
      return site.name as typeof actual.CURRENT_SITE_NAME;
    },
    get CURRENT_SITE_INFO() {
      return actual.PT_SITE[
        site.name as keyof typeof actual.PT_SITE
      ] as Site.SiteInfo;
    },
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}));

vi.mock(import('@/common'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getDoubanBasicDataByQuery: vi.fn(),
    getDoubanInfoByIdOrDoubanUrl: vi.fn(),
    getDoubanTVItemData: vi.fn(),
  };
});

const DOUBAN_FORMAT = [
  '[img]https://img1.doubanio.com/view/photo/l_ratio_poster/public/p480747492.jpg[/img]',
  '◎译　　名　月黑高飞(港) / 刺激1995(台)',
  '◎片　　名　The Shawshank Redemption',
].join('\n');

const movieData = (
  overrides: Partial<FormattedMovieData> = {},
): FormattedMovieData =>
  ({
    title: '肖申克的救赎',
    originalTitle: 'The Shawshank Redemption',
    translatedTitle: ['月黑高飞(港)', '刺激1995(台)'],
    genres: ['剧情', '犯罪'],
    countries: ['美国'],
    is_tv: false,
    imdbLink: 'https://www.imdb.com/title/tt0111161/',
    format: DOUBAN_FORMAT,
    ...overrides,
  }) as FormattedMovieData;

const PTER_UPLOAD_FORM = `
  <form>
    <input type="text" name="name" />
    <input type="text" name="small_descr" />
    <input type="text" name="url" />
    <input type="text" name="douban" />
    <select name="type" id="browsecat">
      <option value="0">请选择</option>
      <option value="401">电影</option>
      <option value="404">电视剧</option>
      <option value="403">动画</option>
    </select>
    <select name="team_sel">
      <option value="0">请选择</option>
      <option value="1">大陆</option>
      <option value="4">欧美</option>
    </select>
    <textarea id="descr"></textarea>
  </form>`;

const $field = <T extends HTMLElement = HTMLInputElement>(selector: string) =>
  document.querySelector(selector) as unknown as T;

describe('douban autofill on the upload page', () => {
  beforeEach(() => {
    site.name = 'PTer';
    resetAutofillState();
    window.history.replaceState({}, '', '/upload.php');
    document.body.innerHTML = PTER_UPLOAD_FORM;
    vi.mocked(getDoubanInfoByIdOrDoubanUrl).mockResolvedValue(movieData());
  });

  it('adds one button next to the douban field without transfer info', () => {
    autofill();
    autofill();
    const buttons = document.querySelectorAll('#auto-fill-douban');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].tagName).toBe('BUTTON');
    expect((buttons[0] as HTMLButtonElement).type).toBe('button');
    expect(buttons[0].previousElementSibling).toBe(
      $field('input[name="douban"]'),
    );
  });

  it('skips pages that are not upload pages', () => {
    window.history.replaceState({}, '', '/details.php?id=1');
    autofill();
    expect(document.querySelector('#auto-fill-douban')).toBeNull();
  });

  it('skips transferred torrents that already carry douban info', () => {
    autofill({ doubanInfo: '◎片　　名' } as TorrentInfo.Info);
    expect(document.querySelector('#auto-fill-douban')).toBeNull();
  });

  it('fills the empty fields from a douban link typed by the user', async () => {
    $field('input[name="name"]').value =
      'The Shawshank Redemption 1994 1080p BluRay x264-WiKi';
    $field('input[name="douban"]').value =
      'https://movie.douban.com/subject/1292052/';
    $field<HTMLTextAreaElement>('#descr').value = '[quote]mediainfo[/quote]';

    await autoFillDoubanInfo();

    expect(getDoubanInfoByIdOrDoubanUrl).toHaveBeenCalledWith(
      '1292052',
      'movie',
      undefined,
    );
    expect(getDoubanBasicDataByQuery).not.toHaveBeenCalled();
    expect($field('input[name="douban"]').value).toBe(
      'https://movie.douban.com/subject/1292052/',
    );
    expect($field('input[name="url"]').value).toBe(
      'https://www.imdb.com/title/tt0111161/',
    );
    expect($field('input[name="small_descr"]').value).toBe(
      '肖申克的救赎/The Shawshank Redemption/月黑高飞(港)/刺激1995(台)',
    );
    expect($field<HTMLTextAreaElement>('#descr').value).toBe(
      `${DOUBAN_FORMAT}\n[quote]mediainfo[/quote]`,
    );
    expect($field<HTMLSelectElement>('#browsecat').value).toBe('401');
    expect($field<HTMLSelectElement>('select[name="team_sel"]').value).toBe(
      '4',
    );
  });

  it('finds the douban subject from an IMDb link and fills the douban field', async () => {
    $field('input[name="url"]').value = 'https://www.imdb.com/title/tt0111161/';
    vi.mocked(getDoubanBasicDataByQuery).mockResolvedValue({
      id: '1292052',
      season: '',
      isTV: false,
      title: '肖申克的救赎',
    });

    await autoFillDoubanInfo();

    expect(getDoubanBasicDataByQuery).toHaveBeenCalledWith('tt0111161');
    expect(getDoubanInfoByIdOrDoubanUrl).toHaveBeenCalledWith(
      '1292052',
      'movie',
      'tt0111161',
    );
    expect($field('input[name="douban"]').value).toBe(
      'https://movie.douban.com/subject/1292052/',
    );
  });

  it('picks the douban season that matches the torrent title', async () => {
    $field('input[name="name"]').value = 'Game of Thrones S02 1080p BluRay';
    $field('input[name="url"]').value = 'tt0944947';
    vi.mocked(getDoubanBasicDataByQuery).mockResolvedValue({
      id: '3016187',
      season: '一',
      isTV: true,
      title: '权力的游戏 第一季',
    });
    vi.mocked(getDoubanTVItemData).mockResolvedValue({
      id: '6390825',
      season: '二',
      isTV: true,
      title: '权力的游戏 第二季',
    });
    vi.mocked(getDoubanInfoByIdOrDoubanUrl).mockResolvedValue(
      movieData({ is_tv: true, genres: ['剧情', '奇幻'] }),
    );

    await autoFillDoubanInfo();

    expect(getDoubanTVItemData).toHaveBeenCalledWith(
      expect.objectContaining({ id: '3016187' }),
      'Game of Thrones S02 1080p BluRay',
    );
    expect($field('input[name="douban"]').value).toBe(
      'https://movie.douban.com/subject/6390825/',
    );
    expect($field<HTMLSelectElement>('#browsecat').value).toBe('404');
  });

  it('keeps what the user already filled in', async () => {
    $field('input[name="douban"]').value = '1292052';
    $field('input[name="url"]').value = 'https://www.imdb.com/title/tt0000001/';
    $field('input[name="small_descr"]').value = '我自己写的副标题';
    $field<HTMLSelectElement>('#browsecat').value = '403';
    $field<HTMLTextAreaElement>('#descr').value = '◎片　　名　Old';

    await autoFillDoubanInfo();

    expect($field('input[name="douban"]').value).toBe('1292052');
    expect($field('input[name="url"]').value).toBe(
      'https://www.imdb.com/title/tt0000001/',
    );
    expect($field('input[name="small_descr"]').value).toBe('我自己写的副标题');
    expect($field<HTMLSelectElement>('#browsecat').value).toBe('403');
    expect($field<HTMLTextAreaElement>('#descr').value).toBe('◎片　　名　Old');
  });

  it('replaces its own output when clicked again with another link', async () => {
    $field('input[name="douban"]').value = '1292052';
    $field<HTMLTextAreaElement>('#descr').value = 'my notes';
    await autoFillDoubanInfo();

    const other = movieData({
      title: '阿甘正传',
      originalTitle: 'Forrest Gump',
      translatedTitle: [],
      format: '◎片　　名　Forrest Gump',
    });
    vi.mocked(getDoubanInfoByIdOrDoubanUrl).mockResolvedValue(other);
    $field('input[name="douban"]').value = '1292720';
    await autoFillDoubanInfo();

    expect($field('input[name="small_descr"]').value).toBe(
      '阿甘正传/Forrest Gump',
    );
    expect($field<HTMLTextAreaElement>('#descr').value).toBe(
      '◎片　　名　Forrest Gump\nmy notes',
    );
  });

  it('looks up the new title when the typed IMDb link changes', async () => {
    $field('input[name="url"]').value = 'tt0111161';
    vi.mocked(getDoubanBasicDataByQuery).mockResolvedValueOnce({
      id: '1292052',
      season: '',
      isTV: false,
      title: '肖申克的救赎',
    });
    await autoFillDoubanInfo();
    expect($field('input[name="douban"]').value).toBe(
      'https://movie.douban.com/subject/1292052/',
    );

    $field('input[name="url"]').value = 'tt0944947';
    vi.mocked(getDoubanBasicDataByQuery).mockResolvedValueOnce({
      id: '3016187',
      season: '一',
      isTV: true,
      title: '权力的游戏 第一季',
    });
    vi.mocked(getDoubanTVItemData).mockImplementation(async (data) => data);
    vi.mocked(getDoubanInfoByIdOrDoubanUrl).mockResolvedValue(
      movieData({
        title: '权力的游戏  第一季',
        originalTitle: 'Game of Thrones Season 1',
        translatedTitle: [],
        is_tv: true,
        imdbLink: 'https://www.imdb.com/title/tt0944947/',
      }),
    );
    await autoFillDoubanInfo();

    expect(getDoubanBasicDataByQuery).toHaveBeenLastCalledWith('tt0944947');
    expect($field('input[name="douban"]').value).toBe(
      'https://movie.douban.com/subject/3016187/',
    );
    expect($field('input[name="url"]').value).toBe('tt0944947');
    expect($field('input[name="small_descr"]').value).toBe(
      '权力的游戏 第一季/Game of Thrones Season 1',
    );
    expect($field<HTMLSelectElement>('#browsecat').value).toBe('404');
  });

  it('replaces the IMDb link it filled when the douban link changes', async () => {
    $field('input[name="douban"]').value = '1292052';
    await autoFillDoubanInfo();
    expect($field('input[name="url"]').value).toBe(
      'https://www.imdb.com/title/tt0111161/',
    );

    $field('input[name="douban"]').value = '1292720';
    vi.mocked(getDoubanInfoByIdOrDoubanUrl).mockResolvedValue(
      movieData({ imdbLink: 'https://www.imdb.com/title/tt0109830/' }),
    );
    await autoFillDoubanInfo();

    expect(getDoubanInfoByIdOrDoubanUrl).toHaveBeenLastCalledWith(
      '1292720',
      'movie',
      undefined,
    );
    expect($field('input[name="url"]').value).toBe(
      'https://www.imdb.com/title/tt0109830/',
    );
  });

  it('notifies the page with native input and change events', async () => {
    $field('input[name="douban"]').value = '1292052';
    const onChange = vi.fn();
    $field('input[name="small_descr"]').addEventListener('change', onChange);

    await autoFillDoubanInfo();

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('asks for a link when neither field has one', async () => {
    await expect(autoFillDoubanInfo()).rejects.toThrow(/IMDb/);
    expect(getDoubanInfoByIdOrDoubanUrl).not.toHaveBeenCalled();
  });

  it('retries the tv endpoint when the movie endpoint fails', async () => {
    $field('input[name="douban"]').value = '3016187';
    vi.mocked(getDoubanInfoByIdOrDoubanUrl)
      .mockRejectedValueOnce(new Error('redirect'))
      .mockResolvedValueOnce(movieData({ is_tv: true }));

    await autoFillDoubanInfo();

    expect(getDoubanInfoByIdOrDoubanUrl).toHaveBeenLastCalledWith(
      '3016187',
      'tv',
      undefined,
    );
    expect($field('input[name="small_descr"]').value).not.toBe('');
  });

  it('writes the douban id only on sites whose field takes the id', async () => {
    site.name = 'TTG';
    document.body.innerHTML = `
      <input name="name" />
      <input name="subtitle" />
      <input name="imdb_c" value="tt0111161" />
      <input name="douban_id" />
      <textarea name="descr"></textarea>`;
    vi.mocked(getDoubanBasicDataByQuery).mockResolvedValue({
      id: '1292052',
      season: '',
      isTV: false,
      title: '肖申克的救赎',
    });

    await autoFillDoubanInfo();

    expect($field('input[name="douban_id"]').value).toBe('1292052');
    expect($field('input[name="subtitle"]').value).toContain('肖申克的救赎');
  });

  it('runs the whole flow from a button click', async () => {
    autofill();
    $field('input[name="douban"]').value = '1292052';
    const button = $field<HTMLButtonElement>('#auto-fill-douban');
    button.click();
    expect(button.disabled).toBe(true);
    await vi.waitFor(() => expect(button.disabled).toBe(false));
    expect($field('input[name="small_descr"]').value).toContain('肖申克的救赎');
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it('shows the error when the click fails', async () => {
    autofill();
    const button = $field<HTMLButtonElement>('#auto-fill-douban');
    const label = button.textContent;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    button.click();
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(vi.mocked(toast.error).mock.calls[0][0]).toMatch(/IMDb/);
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe(label);
  });
});

describe('douban autofill helpers', () => {
  it('reads douban ids from links and bare ids', () => {
    expect(
      getDoubanIdFromText('https://movie.douban.com/subject/1292052/'),
    ).toBe('1292052');
    expect(
      getDoubanIdFromText('https://m.douban.com/movie/subject/1292052'),
    ).toBe('1292052');
    expect(getDoubanIdFromText(' 1292052 ')).toBe('1292052');
    expect(getDoubanIdFromText('https://www.imdb.com/title/tt0111161/')).toBe(
      '',
    );
    expect(getDoubanIdFromText('https://example.com/subject/1')).toBe('');
  });

  it('formats the IMDb value the way the site expects', () => {
    const link = 'https://www.imdb.com/title/tt0111161/';
    expect(formatIMDbFieldValue(link, 'PTer')).toBe(link);
    expect(formatIMDbFieldValue(link, 'HDRoute')).toBe('0111161');
    expect(formatIMDbFieldValue(link, 'BeyondHD')).toBe('tt0111161');
    expect(formatIMDbFieldValue('', 'PTer')).toBe('');
  });

  it('merges the douban block into the description', () => {
    expect(mergeDoubanDescription('', 'INFO')).toBe('INFO');
    expect(mergeDoubanDescription('body', 'INFO')).toBe('INFO\nbody');
    expect(mergeDoubanDescription('◎译　　名 x', 'INFO')).toBeNull();
    expect(mergeDoubanDescription('OLD\nbody', 'NEW', 'OLD')).toBe('NEW\nbody');
    const thanks = '[quote]转自[b]RED[/b]，感谢原发布者！[/quote]\n\n';
    expect(mergeDoubanDescription(`${thanks}body`, 'INFO')).toBe(
      `${thanks}INFO\nbody`,
    );
    expect(mergeDoubanDescription(thanks, 'INFO')).toBe(`${thanks}INFO`);
    expect(mergeDoubanDescription(`${thanks}OLD\nbody`, 'NEW', 'OLD')).toBe(
      `${thanks}NEW\nbody`,
    );
  });

  it('derives the category from douban genres', () => {
    expect(getCategoryFromDouban(movieData(), 'Movie 1994 1080p')).toBe(
      'movie',
    );
    expect(
      getCategoryFromDouban(
        movieData({ genres: ['动画', '奇幻'] }),
        'Movie 2001 1080p',
      ),
    ).toBe('cartoon');
    expect(
      getCategoryFromDouban(
        movieData({ genres: ['纪录片'] }),
        'Planet 2006 1080p',
      ),
    ).toBe('documentary');
    expect(
      getCategoryFromDouban(movieData({ is_tv: true }), 'Show S01 1080p'),
    ).toBe('tvPack');
    expect(
      getCategoryFromDouban(movieData({ is_tv: true }), 'Show S01E03 1080p'),
    ).toBe('tv');
    expect(
      getCategoryFromDouban(
        movieData({ is_tv: true, genres: ['真人秀'] }),
        'Show S01 1080p',
      ),
    ).toBe('variety');
  });
});
