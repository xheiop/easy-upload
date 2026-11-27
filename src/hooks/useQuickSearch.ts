import { useCallback } from 'preact/hooks';
import { SORTED_SITE_KEYS, PT_SITE, SiteName } from '@/const';
import { convertSizeStringToBytes, GMFetch } from '@/common';
import { getQuickSearchUrl } from '@/components/common';
import { torrentInfoStore } from '@/store/torrentInfoStore';
import $ from 'jquery';

export const useQuickSearch = () => {
  const checkQuickResult = useCallback(async () => {
    try {
      let searchListSetting = GM_getValue<string[]>(
        'easy-upload.enabled-search-site-list',
        [],
      );

      if (searchListSetting.length === 0) {
        searchListSetting = SORTED_SITE_KEYS;
      }

      searchListSetting.map(async (site) => {
        const siteInfo = PT_SITE[site as SiteName] as Site.SiteInfo;
        const resultConfig = siteInfo.search?.result;
        const siteUrl = siteInfo.url;

        if (!resultConfig) return;

        try {
          const url = getQuickSearchUrl(site as SiteName);
          const domString = await GMFetch<string>(url);
          const dom = new DOMParser().parseFromString(domString, 'text/html');

          const { list, name, size, url: urlDom } = resultConfig;
          const { title, size: searchSize } = torrentInfoStore.getInfo();

          const torrentList = $(list, dom);
          const sameTorrent = Array.prototype.find.call(torrentList, (item) => {
            let torrentName;
            if (site === 'TTG') {
              torrentName =
                $(item).find(name).prop('firstChild')?.textContent?.trim() ??
                '';
            } else {
              torrentName =
                $(item).find(name).attr('title') || $(item).find(name).text();
            }

            if (site === 'TJUPT') {
              const matchArray: string[] =
                torrentName.match(/\[[^\]]+(\.|\s)+[^\]]+\]/g) || [];
              const realTitle =
                matchArray.filter((item) => item.match(/\.| /))?.[0] ?? '';
              torrentName = realTitle.replace(/\[|\]/g, '');
            }

            torrentName = torrentName?.replace(/\s|\./g, '');
            const sizeBytes = convertSizeStringToBytes(
              $(item).find(size).text(),
            );

            return (
              torrentName === title?.replace(/\s|\./g, '') &&
              Math.abs(sizeBytes - searchSize) < Math.pow(1024, 2) * 1000
            );
          });

          if (sameTorrent) {
            const href = $(sameTorrent).find(urlDom).attr('href') ?? '';
            const url = new URL(href, `${siteUrl}/`).href;
            $(`.search-list li>a[data-site=${site}]`)
              .attr('data-url', url)
              .css('color', '#218380');
          } else {
            $(`.search-list li>a[data-site=${site}]`).css('color', '#D81159');
          }
        } catch (error) {
          console.error(`Error checking ${site}:`, error);
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Quick search error:', error);
    }
  }, []);

  return { checkQuickResult };
};
