import { CURRENT_SITE_INFO, CURRENT_SITE_NAME } from '@/const';
import { registry } from './target-filler/registry';

import './target-filler/52pt';
import './target-filler/Bib';
import './target-filler/BTSCHOOL';
import './target-filler/Concertos';
import './target-filler/HDBits';
import './target-filler/HDFans';
import './target-filler/HDRoute';
import './target-filler/HDT';
import './target-filler/HDTime';
import './target-filler/HDU';
import './target-filler/KEEPFRDS';
import './target-filler/NYPT';
import './target-filler/PTN';
import './target-filler/SpeedApp';
import './target-filler/SSD';
import './target-filler/TTG';
import './target-filler/UHDBits';
import './target-filler/UNIT3D';
import './target-filler/NexusPHP';
import './target-filler/BeyondHD';
import './target-filler/SC';
import './target-filler/TJUPT';
import './target-filler/RED';
import './target-filler/KG';
import './target-filler/PTP';
import './target-filler/MTeam';
import './target-filler/GazelleMusic';
import './target-filler/GPW';
import './target-filler/ZHUQUE';
import './target-filler/iTS';
import './target-filler/BYR';
import './target-filler/Pter';
import './target-filler/MTV';
import './target-filler/YemaPT';
import './target-filler/shared-nexusphp-category-change';
import autofill from './autofill';

export const fillTargetForm = (info: TorrentInfo.Info): void => {
  if (!info) {
    console.warn('No torrent info provided for filling form');
    return;
  }

  console.log('Filling form with info:', info);

  autofill(info);

  const filler = registry.getApplicableFiller(
    CURRENT_SITE_NAME,
    CURRENT_SITE_INFO.siteType,
  );

  if (filler) {
    filler.fill(info);
  } else {
    console.warn(`No specialized filler found for site: ${CURRENT_SITE_NAME}`);
  }
};
