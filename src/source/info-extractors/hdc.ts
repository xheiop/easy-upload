import { registry } from './registry';
import { NexusPHPExtractor } from './base/nexusphp-base';
import { CONFIG } from '../config';

class HDCExtractor extends NexusPHPExtractor {
  priority = 10;

  canHandle(siteName: string): boolean {
    return siteName === 'HDChina';
  }

  extractSubtitle() {
    this.info.subtitle = $('#top').next('h3').text();
  }

  extractMetaInfo() {
    super.extractMetaInfo();
    if (!this.info.category) {
      this.info.category = 'movie';
    }
  }

  getMetaInfoRules() {
    return {
      ...CONFIG.META_INFO_MATCH_RULES,
      category: /(类型):.+?([^\u4e00-\u9fa5]+)/i,
    };
  }
}

registry.register(new HDCExtractor());
