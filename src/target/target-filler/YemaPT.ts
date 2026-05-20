import { getIdByIMDbUrl } from '@/common';
import { base64ToBlob, getTeamName } from '@/target/helper/index';
import { BaseFiller } from './base/base-filler';
import { registry, TargetFiller } from './registry';

type ReactFiberNode = {
  child?: ReactFiberNode;
  sibling?: ReactFiberNode;
  stateNode?: {
    state?: unknown;
    context?: {
      setFieldsValue?: (fields: Record<string, unknown>) => void;
    };
  };
};

class YemaPT extends BaseFiller implements TargetFiller {
  priority = 10;

  canHandle(siteName: string): boolean {
    return siteName === 'YemaPT';
  }

  fill(info: TorrentInfo.Info): void {
    this.info = info;
    window.addEventListener(
      'torrentAddPageReady',
      () => {
        this.fillYemaPTForm();
      },
      { once: true },
    );
  }

  private fillYemaPTForm(): void {
    const instance = this.getAntFormInstance();
    const setFieldsValue = instance?.context?.setFieldsValue;
    if (!setFieldsValue || !this.info) {
      console.warn('YemaPT form instance was not found');
      return;
    }

    setFieldsValue.call(instance.context, this.buildFields());
    this.fillTorrentFileByForm(setFieldsValue.bind(instance.context));
    this.fillSelects();
  }

  private getAntFormInstance() {
    const antForm = document.querySelector('form.ant-form');
    if (!antForm) return null;

    const fiber = this.getReactFiberNode(antForm);
    return this.getReactComponentInstance(fiber);
  }

  private getReactFiberNode(element: Element): ReactFiberNode | null {
    for (const key in element) {
      if (key.startsWith('__reactFiber')) {
        return (element as unknown as Record<string, ReactFiberNode>)[key];
      }
    }
    return null;
  }

  private getReactComponentInstance(fiberNode: ReactFiberNode | null) {
    if (fiberNode?.stateNode?.state !== undefined) {
      return fiberNode.stateNode;
    }

    let child = fiberNode?.child;
    while (child) {
      const instance = this.getReactComponentInstance(child);
      if (instance) return instance;
      child = child.sibling;
    }

    return null;
  }

  private buildFields(): Record<string, unknown> {
    const info = this.info!;
    const fields: Record<string, unknown> = {
      showName: info.title,
      shortDesc: info.subtitle || '',
      longDesc: this.bbcodeToMarkdown(info.description),
    };

    const picture = this.getPoster();
    if (picture) fields.picture = picture;

    const doubanId = info.doubanUrl?.match(/subject\/(\d+)/)?.[1];
    if (doubanId) fields.douban = doubanId;

    const imdbId = getIdByIMDbUrl(info.imdbUrl || '').replace(/^tt/i, '');
    if (imdbId) fields.imdb = imdbId;

    const mediaInfo = info.mediaInfos?.[0];
    if (mediaInfo) fields.mediaInfo = mediaInfo;

    return fields;
  }

  private getPoster(): string {
    const { poster, description } = this.info!;
    if (poster) return poster;
    return description.match(/\[img\]([^[]+?)\[\/img\]/i)?.[1]?.trim() || '';
  }

  private bbcodeToMarkdown(text: string): string {
    return text
      .replace(/\[size=\d\]/gi, '')
      .replace(/\[\/size\]/gi, '')
      .replace(/\[font=.+?\]/gi, '')
      .replace(/\[\/font\]/gi, '')
      .replace(/\[color=.+?\]/gi, '')
      .replace(/\[\/color\]/gi, '')
      .replace(/\[img\](.*?)\[\/img\]/gi, '![_]($1)')
      .replace(/\[b\]\s*/gi, '**')
      .replace(/\s*\[\/b\]/gi, '**')
      .replace(/\[i\]\s*/gi, '*')
      .replace(/\s*\[\/i\]/gi, '*')
      .replace(/\[url=([^\]]*?)\](.*?)\[\/url\]/gi, '[$2]($1)')
      .replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, (_match, quote) => {
        return `> ${quote.split('\n').join('\n> ')}\n\n`;
      });
  }

  private fillTorrentFileByForm(
    setFieldsValue: (fields: Record<string, unknown>) => void,
  ): void {
    const { torrentData, title } = this.info!;
    if (!torrentData) return;

    const blob = base64ToBlob(torrentData);
    const torrentFileName = title
      .replace(/^\[.*?\](\.| )?/, '')
      .replace(/\s/g, '.');
    const file = new File([blob], `${torrentFileName}.torrent`, {
      type: 'application/x-bittorrent',
    }) as File & { originFileObj?: File };

    file.originFileObj = file;
    setFieldsValue({ fileList: [file] });
  }

  private async fillSelects(): Promise<void> {
    const sequence = [
      ['medium', 0, this.getVideoType()],
      ['standard', 1, this.getResolution()],
      ['codec', 2, this.getVideoCodec()],
      ['audiocodec', 3, this.getAudioCodec()],
      ['regionList', 4, this.getRegions()],
      ['team', 5, this.getTeam()],
      ['tagList', 6, this.getTags()],
      ['categoryId', 7, this.getCategory()],
    ] as const;

    for (const [id, index, value] of sequence) {
      await this.selectDropdownOption(id, index, value);
    }
  }

  private getCategory(): string {
    const map = this.siteInfo.category?.map ?? {};
    return (map[this.info!.category] as string) || '未分类';
  }

  private getVideoType(): string {
    const { videoType } = this.info!;
    return (this.siteInfo.videoType?.map?.[videoType] as string) || 'Other';
  }

  private getResolution(): string {
    const { resolution } = this.info!;
    return (this.siteInfo.resolution?.map?.[resolution] as string) || 'Other';
  }

  private getVideoCodec(): string {
    const { videoCodec = '', videoType } = this.info!;
    if (
      /^(h264|x264)$/i.test(videoCodec) &&
      /^(bluray|uhdbluray)$/i.test(videoType)
    ) {
      return 'Bluray(AVC)';
    }
    if (
      /^(hevc|h265|x265)$/i.test(videoCodec) &&
      /^(bluray|uhdbluray)$/i.test(videoType)
    ) {
      return 'Bluray(HEVC)';
    }
    return (this.siteInfo.videoCodec?.map?.[videoCodec] as string) || 'Other';
  }

  private getAudioCodec(): string {
    const { audioCodec = '', title } = this.info!;
    if (/^(ac3|dd|\+?dd)$/i.test(audioCodec) && /DDP|DD\+/i.test(title)) {
      return /Atmos/i.test(title) ? 'E-AC3 Atmos' : 'E-AC3(DDP)';
    }
    return (this.siteInfo.audioCodec?.map?.[audioCodec] as string) || 'Other';
  }

  private getRegions(): string[] {
    const area = this.info!.area;
    const areaMap: Record<string, string> = {
      CN: 'CN(中国)',
      HK: 'HK/CN(香港)',
      TW: 'TW/CN(台湾)',
      JP: 'JP(日本)',
      KR: 'KR(韩国)',
      US: 'US(美国)',
      EU: 'EU(欧洲)',
      UK: 'UK(英国)',
      CA: 'CA(加拿大)',
      AU: 'AU(澳大利亚)',
    };

    return area && areaMap[area] ? [areaMap[area]] : ['Other'];
  }

  private getTeam(): string {
    const teamName = getTeamName(this.info!.title)?.toLowerCase();
    if (!teamName) return 'Other';
    return (this.siteInfo.team?.map?.[teamName] as string) || 'Other';
  }

  private getTags(): string[] {
    const { tags, title } = this.info!;
    const result: string[] = [];
    if (tags.chinese_audio) result.push('国语');
    if (tags.chinese_subtitle) result.push('中字');
    if (tags.cantonese_audio) result.push('粤语');
    if (tags.hdr10 || tags.hdr10_plus) result.push('HDR10');
    if (tags.dolby_vision) result.push('杜比视界');
    if (/E\d+/i.test(title)) result.push('分集');
    if (/complete|S\d{2}(?!E\d{2})/i.test(title)) result.push('完结');
    return result;
  }

  private async selectDropdownOption(
    id: string,
    index: number,
    targetTitle: string | string[],
  ): Promise<void> {
    if (
      !targetTitle ||
      (Array.isArray(targetTitle) && targetTitle.length === 0)
    ) {
      return;
    }

    const element = document.getElementById(id);
    if (!element) return;

    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const listHolder = await this.waitForListHolder(index);
    if (!listHolder) return;

    const titles = Array.isArray(targetTitle) ? targetTitle : [targetTitle];
    for (const title of titles) {
      await this.clickOption(listHolder, title);
    }
  }

  private async waitForListHolder(index: number): Promise<Element | null> {
    for (let i = 0; i < 10; i += 1) {
      await this.sleep(200);
      const listHolder = document.querySelectorAll('.rc-virtual-list-holder')[
        index
      ];
      if (listHolder) return listHolder;
    }
    return null;
  }

  private async clickOption(listHolder: Element, title: string): Promise<void> {
    const findAndClick = () => {
      const option = Array.from(
        listHolder.querySelectorAll<HTMLElement>('.ant-select-item-option'),
      ).find((item) => item.getAttribute('title') === title);
      if (!option) return false;
      option.click();
      return true;
    };

    if (findAndClick()) return;

    const holder = listHolder as HTMLElement;
    let currentScroll = 0;
    let totalHeight = holder.scrollHeight;
    holder.scrollTop = 0;

    while (currentScroll < totalHeight) {
      holder.scrollTop += 100;
      currentScroll += 100;
      await this.sleep(100);
      if (findAndClick()) return;
      totalHeight = holder.scrollHeight;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

registry.register(new YemaPT());
