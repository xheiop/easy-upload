import { registry, TargetFiller } from './registry';
import { BaseFiller } from './base/base-filler';

class HdChina extends BaseFiller implements TargetFiller {
  priority = 10;

  canHandle(siteName: string): boolean {
    return siteName === 'HDChina';
  }

  protected processTorrentTitle() {
    super.processTorrentTitle();
    const { title } = this.info!;
    this.info!.title = title.replace(/\s/gi, '.');
  }

  protected postProcess() {
    const { category, resolution } = this.info!;
    if (category === 'movie' && resolution === '2160p') {
      $(this.siteInfo.category.selector).val('410');
    }
  }
}

registry.register(new HdChina());
