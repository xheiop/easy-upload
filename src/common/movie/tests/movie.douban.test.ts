import { expect, describe, it, vi } from 'vitest';
import {
  getDoubanAwards,
  getDoubanBasicDataByQuery,
  getDoubanBookInfo,
  getDoubanCreditsData,
  getDoubanTVItemData,
  getIMDbIDFromDouban,
  getMobileDoubanInfo,
} from '../movie.douban';
import { getIdByIMDbUrl } from '../movie.imdb';
import { CONFIG } from '../movie.config';
import { GMFetch } from '@/common/utils';

vi.mock('@/common/movie/movie.imdb');

vi.mock('@/common/utils', () => ({
  GMFetch: vi.fn(),
}));

describe('getDoubanAwards', () => {
  it('should return the awards of the movie', async () => {
    vi.mocked(GMFetch).mockResolvedValue(`
      <div id="content">
        <div>
          <div class="article">
            <div class="awards">      
              <div class="hd">       
                <h2>           
                  <a href="https://movie.douban.com/awards/daviddidonatello/69/">第69届意大利大卫奖</a>
                  <span class="year">&nbsp;(2024)</span>            
                </h2>     
                </div>        
                <ul class="award">              
                  <li>青年大卫奖</li>
                  <li>
                    <a href="https://www.douban.com/personage/27243353/" target="_blank">宝拉·柯特莱西</a>
                  </li>         
                </ul>          
                <ul class="award">
                  <li>最佳影片(提名)</li>
                  <li>
                    <a href="https://www.douban.com/personage/27243353/" target="_blank">宝拉·柯特莱西</a>
                  </li>           
                </ul>    
            </div>       
          </div>
        </div>
      </div>`);
    const awards = await getDoubanAwards('123456');
    expect(GMFetch).toHaveBeenCalledWith(
      'https://movie.douban.com/subject/123456/awards/',
    );
    expect(awards).toBe(
      '第69届意大利大卫奖  (2024)\n青年大卫奖 宝拉·柯特莱西\n最佳影片(提名) 宝拉·柯特莱西',
    );
  });

  it('should return empty string if no awards found', async () => {
    vi.mocked(GMFetch).mockResolvedValue('');
    const awards = await getDoubanAwards('123456');
    expect(GMFetch).toHaveBeenCalledWith(
      'https://movie.douban.com/subject/123456/awards/',
    );
    expect(awards).toBe('');
  });
});

describe('getIMDbIDFromDouban', () => {
  it('should return the IMDb ID of the movie', async () => {
    vi.mocked(GMFetch).mockResolvedValue(`
      <div id="info">
        <span class="pl">IMDb:</span> \n
            tt123456
      </div>`);
    const imdbId = await getIMDbIDFromDouban('123456');
    expect(GMFetch).toHaveBeenCalledWith(
      'https://movie.douban.com/subject/123456/',
    );
    expect(imdbId).toBe('tt123456');
  });

  it('should return empty string if no IMDb ID found', async () => {
    vi.mocked(GMFetch).mockResolvedValue(`
      <div id="info">
        <span class="pl">IMDb:</span>
      </div>`);
    const imdbId = await getIMDbIDFromDouban('123456');
    expect(GMFetch).toHaveBeenCalledWith(
      'https://movie.douban.com/subject/123456/',
    );
    expect(imdbId).toBe('');
  });

  it('should return empty string if no IMDb span found', async () => {
    vi.mocked(GMFetch).mockResolvedValue(`
      <div id="info">
      </div>`);
    const imdbId = await getIMDbIDFromDouban('123456');
    expect(GMFetch).toHaveBeenCalledWith(
      'https://movie.douban.com/subject/123456/',
    );
    expect(imdbId).toBe('');
  });
});

describe('getMobileDoubanInfo', () => {
  it('should return the mobile douban info of the movie', async () => {
    const mockData = {
      title: 'movie title',
      year: '2022',
      intro: 'summary',
    };
    vi.mocked(GMFetch).mockResolvedValue(mockData);
    const mobileDoubanInfo = await getMobileDoubanInfo('123456', 'movie');
    expect(GMFetch).toHaveBeenCalledWith(
      `${CONFIG.URLS.DOUBAN_MOBILE_API}/movie/123456?for_mobile=1&ck=`,
      {
        headers: {
          Referer: 'https://m.douban.com/movie/subject/123456',
        },
        responseType: 'json',
      },
    );
    expect(mobileDoubanInfo).toEqual(mockData);
  });

  it('should throw error if no douban id found', async () => {
    await expect(getMobileDoubanInfo('', 'movie')).rejects.toThrow(
      'No Douban ID found',
    );
  });

  it('should throw error if title is 未知电影', async () => {
    vi.mocked(GMFetch).mockResolvedValue({ title: '未知电影' });
    await expect(getMobileDoubanInfo('123456', 'movie')).rejects.toThrow(
      'Please login in Douban to and try again',
    );
  });
});

describe('getDoubanBasicDataByQuery', () => {
  it('should return the douban basic data by query', async () => {
    const mockDocData = `
      <div class="result-list">
        <div class="result">
          <h3>
            <a href="https://movie.douban.com/subject/123456/">movie title</a>
          </h3>
        </div>
      </div>`;
    vi.mocked(getIdByIMDbUrl).mockReturnValue('');
    vi.mocked(GMFetch).mockResolvedValue(mockDocData);
    const expectedData = {
      title: 'movie title',
      id: '123456',
      isTV: false,
      season: '',
    };
    const doubanBasicData = await getDoubanBasicDataByQuery('123456');
    expect(GMFetch).toHaveBeenCalledWith(
      CONFIG.URLS.DOUBAN_SUGGEST_API('123456'),
    );
    expect(doubanBasicData).toEqual(expectedData);
  });

  it('should throw error if no douban item found', async () => {
    vi.mocked(GMFetch).mockResolvedValue('<div></div>');
    await expect(getDoubanBasicDataByQuery('123456')).rejects.toThrow(
      'No Douban Item was found',
    );
  });

  it('should return the tv season related data if tv type result found', async () => {
    const mockDocData = `
      <div class="result-list">
        <div class="result">
          <h3>
            <a href="https://movie.douban.com/subject/123456/">movie title 第1季</a>
          </h3>
        </div>
      </div>`;
    vi.mocked(getIdByIMDbUrl).mockReturnValue('');
    vi.mocked(GMFetch).mockResolvedValue(mockDocData);
    const expectedData = {
      title: 'movie title 第1季',
      id: '123456',
      isTV: true,
      season: '1',
    };
    const doubanBasicData = await getDoubanBasicDataByQuery('123456');
    expect(GMFetch).toHaveBeenCalledWith(
      CONFIG.URLS.DOUBAN_SUGGEST_API('123456'),
    );
    expect(doubanBasicData).toEqual(expectedData);
  });

  it('should handle the case when no valid douban url found', async () => {
    const mockDocData = `
    <div class="result-list">
      <div class="result">
        <h3>
          <a href="https://example.com">movie title</a>
        </h3>
      </div>
    </div>`;
    vi.mocked(getIdByIMDbUrl).mockReturnValue('');
    vi.mocked(GMFetch).mockResolvedValue(mockDocData);
    const result = await getDoubanBasicDataByQuery('123456');
    expect(result).toEqual({
      id: '',
      isTV: false,
      season: '',
      title: 'movie title',
    });
  });

  it('should use  imdb to search if query is imdb url', async () => {
    vi.mocked(getIdByIMDbUrl).mockReturnValue('tt123456');
    vi.mocked(GMFetch).mockResolvedValue('<div></div>');
    await expect(
      getDoubanBasicDataByQuery('https://www.imdb.com/title/tt123456/'),
    ).rejects.toThrow('No Douban Item was found');
    expect(getIdByIMDbUrl).toHaveBeenCalledWith(
      'https://www.imdb.com/title/tt123456/',
    );
    expect(GMFetch).toHaveBeenCalledWith(
      CONFIG.URLS.DOUBAN_SUGGEST_API('tt123456'),
    );
  });

  it('should throw error if no query provided', async () => {
    await expect(getDoubanBasicDataByQuery('')).rejects.toThrow(
      'No query provided',
    );
  });
});

describe('getDoubanCreditsData', () => {
  it('should return the douban credits data of the movie', async () => {
    vi.mocked(GMFetch).mockResolvedValue('mockData');
    const creditsData = await getDoubanCreditsData('123456', 'movie');
    expect(creditsData).toEqual('mockData');
  });
});

describe('getDoubanBookInfo', () => {
  it('should return the douban book info of the movie', async () => {
    const mockData = 'mockData';
    vi.mocked(GMFetch).mockResolvedValue(mockData);
    const url = 'https://book.douban.com/subject/123456/';
    const bookInfo = await getDoubanBookInfo(url);
    expect(GMFetch).toHaveBeenCalledWith(CONFIG.URLS.PT_GEN_API(url), {
      responseType: 'json',
    });
    expect(bookInfo).toBe(mockData);
  });
});

describe('getDoubanTVItemData', () => {
  const suggestHtml = `
    <div class="result-list">
      <div class="result">
        <h3><a href="https://movie.douban.com/subject/456789/">某剧 第2季</a></h3>
      </div>
    </div>`;

  it('returns the original data for season 1 without searching', async () => {
    vi.mocked(GMFetch).mockClear();
    const doubanData = {
      id: '123',
      season: '1',
      isTV: true,
      title: '某剧 第1季',
    };
    const result = await getDoubanTVItemData(
      doubanData,
      'Some.Show.S01.1080p.WEB-DL',
    );
    expect(result).toBe(doubanData);
    expect(GMFetch).not.toHaveBeenCalled();
  });

  it('searches the matching season for SXX style titles', async () => {
    vi.mocked(GMFetch).mockClear();
    vi.mocked(GMFetch).mockResolvedValue(suggestHtml);
    const doubanData = {
      id: '123',
      season: '1',
      isTV: true,
      title: '某剧 第1季',
    };
    const result = await getDoubanTVItemData(
      doubanData,
      'Some.Show.S02.1080p.WEB-DL',
    );
    expect(result.id).toBe('456789');
  });

  it('extracts the season from "Season N" style titles', async () => {
    vi.mocked(GMFetch).mockClear();
    vi.mocked(GMFetch).mockResolvedValue(suggestHtml);
    const doubanData = {
      id: '123',
      season: '1',
      isTV: true,
      title: '某剧 第1季',
    };
    const result = await getDoubanTVItemData(
      doubanData,
      'Some Show Season 2 1080p WEB-DL',
    );
    expect(result.id).toBe('456789');
  });
});
