import { render } from 'preact';
import { CURRENT_SITE_NAME, CURRENT_SITE_INFO } from './const';
import { getLocationSearchValueByKey } from '@/common';
import { fillTargetForm } from './target';
import { getTorrentInfo } from '@/source';
import { fillSearchImdb } from './site-dom/quick-search';
import { torrentInfoStore } from '@/store/torrentInfoStore';
import { hydrateTorrentDataFromUrl } from '@/target/helper';
import './site-dom/analyze-upload-page';
import './style.css';
import App from './components/Container';
import $ from 'jquery';

const SPECIAL_SITE_CONFIGS = {
  specialSiteNames: [
    'PTP',
    'BTN',
    'GPW',
    'RED',
    'DicMusic',
    'MTV',
    'Orpheus',
    'UHDBits',
  ],
  specialSelectors: {
    GPW: (torrentId: string) => `#torrent_detail_${torrentId} >td`,
    MTV: (torrentId: string) => `#torrentinfo${torrentId}>td`,
    GazelleDefault: (torrentId: string) => `#torrent_${torrentId} >td`,
  },
  appendMethods: {
    UHDBits: (app: HTMLDivElement) => {
      const torrentId = getLocationSearchValueByKey('torrentid');
      $(`#torrent_${torrentId} >td`).prepend(
        document.createElement('blockquote'),
      );
      $(`#torrent_${torrentId} >td blockquote:first`)?.prepend(app);
    },
    GazelleDefault: (app: HTMLDivElement, refNode?: HTMLElement) => {
      refNode?.prepend(app);
    },
    SpeedApp: (app: HTMLElement, refNode?: HTMLElement) => {
      const div = document.createElement('div');
      div.setAttribute('class', 'row col-md-12 mt-5');
      app.setAttribute('class', 'card-body card');
      div.appendChild(app);
      refNode?.parentNode?.insertBefore(div, refNode);
    },
    MTeam: (app: HTMLElement) => {
      setupMTeamObserver(app);
    },
    default: (app: HTMLDivElement, refNode?: HTMLElement) => {
      Array.from(app.childNodes).forEach((child) => {
        refNode?.parentNode?.insertBefore(child, refNode);
      });
    },
  },
};

function setupMTeamObserver(app: HTMLElement) {
  const targetNode = document.getElementById('root');
  if (!targetNode) return;
  if (document.querySelector(CURRENT_SITE_INFO.seedDomSelector)) {
    insertScriptDomToMT(app);
    return;
  }
  const config = { childList: true, subtree: true };
  const observer = new MutationObserver((mutationsList, observer) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        const targetElement = $(CURRENT_SITE_INFO.seedDomSelector)[0];
        if (targetElement) {
          observer.disconnect();
          insertScriptDomToMT(app);
          break;
        }
      }
    }
  });

  observer.observe(targetNode, config);
}

function insertScriptDomToMT(app: HTMLElement) {
  const refNode = $(CURRENT_SITE_INFO.seedDomSelector)[0] as HTMLElement | null;
  Array.from(app.childNodes).forEach((child) => {
    refNode?.parentNode?.insertBefore(child, refNode);
  });
}

function extractTorrentInfoFromHash() {
  const hash = location.hash || '';

  const torrentInfoMatch = hash.match(/(^|#)torrentInfo=([^#]+)/);
  const torrentInfoRaw = torrentInfoMatch?.[2] || null;

  const timestampMatch = hash.match(/(^|#)timestamp=([^#]+)/);
  const timestamp = timestampMatch?.[2] || null;

  return { torrentInfoRaw, timestamp };
}

async function retrieveTorrentInfo() {
  const { torrentInfoRaw, timestamp } = extractTorrentInfoFromHash();

  if (torrentInfoRaw) {
    try {
      return JSON.parse(decodeURIComponent(torrentInfoRaw));
    } catch (e) {
      console.error('fail to parse torrent info', e);
    }
  } else if (timestamp) {
    return GM_getValue('cachedTorrentInfo');
  }

  return null;
}

function determineReferenceNode() {
  let refNode = $(CURRENT_SITE_INFO.seedDomSelector)[0] as HTMLElement | null;
  const { specialSelectors, specialSiteNames } = SPECIAL_SITE_CONFIGS;
  if (specialSiteNames.includes(CURRENT_SITE_NAME)) {
    const torrentId = getLocationSearchValueByKey('torrentid');
    if (!torrentId) return refNode;

    const selectorFn =
      specialSelectors[CURRENT_SITE_NAME as keyof typeof specialSelectors] ||
      specialSelectors.GazelleDefault;

    const selector = selectorFn(torrentId);
    refNode = document.querySelector(selector);
  }

  return refNode;
}

function renderApp() {
  const app = document.createElement('div');
  render(<App />, app);

  const refNode = determineReferenceNode();
  if (!refNode) {
    return;
  }

  const { appendMethods, specialSiteNames } = SPECIAL_SITE_CONFIGS;

  if (specialSiteNames.includes(CURRENT_SITE_NAME)) {
    const appendMethod = appendMethods.GazelleDefault;
    appendMethod(app, refNode);
    return;
  }
  const specialHandler =
    appendMethods[CURRENT_SITE_NAME as keyof typeof appendMethods];
  if (specialHandler) {
    specialHandler(app, refNode);
    return;
  }
  appendMethods.default(app, refNode);
}

function shouldInitialize() {
  if (!CURRENT_SITE_NAME || !CURRENT_SITE_INFO) {
    return false;
  }

  if (
    CURRENT_SITE_INFO.search &&
    location.pathname.match(CURRENT_SITE_INFO.search.path) &&
    (getLocationSearchValueByKey('imdb') || getLocationSearchValueByKey('name'))
  ) {
    return false;
  }

  if (location.href.match(/upload|offer|create/gi)) {
    return false;
  }

  return true;
}

function transferLegacySettings() {
  const legacySettingExists = GM_getValue<string>(
    'easy-seed.enabled-target-sites',
    '',
  );
  if (!legacySettingExists) return;
  const settingKeys = {
    'easy-seed.enabled-target-sites': 'string[]',
    'easy-seed.enabled-search-site-list': 'string[]',
    'easy-seed.enabled-batch-seed-sites': 'string[]',
    'easy-seed.quick-search-closed': 'boolean',
    'easy-seed.site-favicon-closed': 'boolean',
    'easy-seed.thanks-quote-closed': 'boolean',
    'easy-seed.transfer-img-closed': 'boolean',
    'easy-seed.douban-closed': 'boolean',
    'easy-seed.upload-img-closed': 'boolean',
  };
  for (const [key, type] of Object.entries(settingKeys)) {
    const value = GM_getValue(key);
    if (value !== undefined) {
      let replacedKey = key.replace('easy-seed', 'easy-upload');
      if (key === 'easy-seed.upload-img-closed') {
        replacedKey = 'easy-upload.rehost-img-closed';
      }
      if (type === 'string[]') {
        GM_setValue(replacedKey, JSON.parse((value as string) || '[]'));
      } else if (type === 'string') {
        GM_setValue(replacedKey, value || '');
      } else if (type === 'boolean') {
        GM_setValue(replacedKey, !!value);
      }
    }
    GM_deleteValue(key);
  }
}

async function initialize() {
  transferLegacySettings();
  if (!CURRENT_SITE_NAME) return;

  fillSearchImdb();

  if (CURRENT_SITE_INFO.asTarget) {
    const torrentInfo = await retrieveTorrentInfo();
    if (torrentInfo) {
      const hydratedInfo = await hydrateTorrentDataFromUrl(
        torrentInfo as TorrentInfo.Info,
      );
      fillTargetForm(hydratedInfo);
    }
  }

  if (CURRENT_SITE_INFO.asSource && shouldInitialize()) {
    try {
      const info = await getTorrentInfo();
      if (info) {
        console.log('torrent info was retrieved', info);
        torrentInfoStore.setInfo(info);
        renderApp();
      }
    } catch (error) {
      console.error('fail to get torrent info', error);
    }
  }
}

initialize().catch((error) => {
  console.error('fail to initialize Easy-Upload', error);
});
