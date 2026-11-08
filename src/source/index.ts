import { CURRENT_SITE_INFO, CURRENT_SITE_NAME } from '@/const';
import { registry } from './info-extractors/registry';
import { applyExternalIdFallbacks } from './info-fallback';

import './info-extractors/nexusphp';
import './info-extractors/PTer';
import './info-extractors/ssd';
import './info-extractors/hdarea';
import './info-extractors/putao';
import './info-extractors/tjupt';
import './info-extractors/ourbits';
import './info-extractors/keepfrds';
import './info-extractors/tlf';
import './info-extractors/hdhome';
import './info-extractors/hdfans';
import './info-extractors/shared-nexusphp-sites';
import './info-extractors/ttg';
import './info-extractors/hanhan';
import './info-extractors/mt';
import './info-extractors/ptp';
import './info-extractors/uhd';
import './info-extractors/gpw';
import './info-extractors/unit3d';
import './info-extractors/unit3d-legacy';
import './info-extractors/avistaz';
import './info-extractors/bhd';
import './info-extractors/btn';
import './info-extractors/hdb';
import './info-extractors/kg';
import './info-extractors/hdt';
import './info-extractors/hdspace';
import './info-extractors/gazelle-music';
import './info-extractors/hdc';

export async function getTorrentInfo(): Promise<TorrentInfo.Info | null> {
  if (!CURRENT_SITE_INFO) {
    console.log('No site info found');
    return null;
  }
  const extractor = registry.getExtractor(
    CURRENT_SITE_NAME,
    CURRENT_SITE_INFO.siteType,
  );

  if (!extractor) {
    console.log(`No extractor found for this site ${CURRENT_SITE_NAME}`);
    return null;
  }

  try {
    return applyExternalIdFallbacks(await extractor.extract());
  } catch (error) {
    console.log('Error extracting torrent info', error);
    return null;
  }
}
