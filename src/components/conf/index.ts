import { I18nKey } from '@/common/utils/utils.types';

interface SiteListConfigItem {
  name: string;
  class: string;
  title: I18nKey;
  key: string;
  des?: I18nKey;
}

interface FeatureSwitchItem {
  name: string;
  des: I18nKey;
  type: string;
  key: string;
}

const SiteListConfig: SiteListConfigItem[] = [
  {
    name: 'enabled-target-sites',
    class: 'target-sites-enable-list',
    title: 'settings.targetSites',
    key: 'targetEnabled',
  },
  {
    name: 'enabled-search-site-list',
    class: 'search-sites-enable-list',
    title: 'settings.searchSites',
    key: 'searchEnabled',
  },
  {
    name: 'enabled-batch-seed-sites',
    class: 'batch-seed-sites-enable-list',
    title: 'settings.batchSites',
    key: 'batchEnabled',
    des: 'settings.batchSitesDesc',
  },
];
const FeatureSwitchList: FeatureSwitchItem[] = [
  {
    name: 'quick-transfer-closed',
    des: 'feature.disableQuickTransfer',
    type: 'checkbox',
    key: 'quickTransferClosed',
  },
  {
    name: 'quick-search-closed',
    des: 'feature.disableQuickSearch',
    type: 'checkbox',
    key: 'quickSearchClosed',
  },
  {
    name: 'transfer-img-closed',
    des: 'feature.disableTransferImg',
    type: 'checkbox',
    key: 'transferImgClosed',
  },
  {
    name: 'rehost-img-closed',
    des: 'feature.disableRehostImg',
    type: 'checkbox',
    key: 'rehostImgClosed',
  },
  {
    name: 'site-favicon-closed',
    des: 'feature.disableSiteFavicon',
    type: 'checkbox',
    key: 'siteFaviconClosed',
  },
  {
    name: 'thanks-quote-closed',
    des: 'feature.hideThanksQuote',
    type: 'checkbox',
    key: 'thanksQuoteClosed',
  },
  {
    name: 'douban-closed',
    des: 'feature.hideDouban',
    type: 'checkbox',
    key: 'doubanClosed',
  },
  {
    name: 'music-group-merge-closed',
    des: 'feature.disableMusicGroupMerge',
    type: 'checkbox',
    key: 'musicGroupMergeClosed',
  },
];
export { FeatureSwitchList, SiteListConfig };
