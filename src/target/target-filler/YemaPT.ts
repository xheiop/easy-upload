import { getIdByIMDbUrl } from '@/common';
import {
  base64ToBlob,
  filterEmptyTags,
  getTeamName,
} from '@/target/helper/index';
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

type ReactComponentInstance = NonNullable<ReactFiberNode['stateNode']>;

export const prepareYemaPTDescription = (
  info: Pick<TorrentInfo.Info, 'description' | 'mediaInfos'>,
): string => {
  let description = filterEmptyTags(info.description || '').replace(/^\s+/, '');

  info.mediaInfos?.forEach((mediaInfo) => {
    description = description.replace(mediaInfo.trim(), '');
  });

  description = description.replace(
    /\[(mediainfo|bdinfo)\][\s\S]*?\[\/\1\]/gi,
    '',
  );

  return filterEmptyTags(description).trim();
};

export const getYemaPTSeason = (title: string): number | null => {
  const season =
    title.match(/\bS(?:eason)?\.?\s*0*(\d{1,3})(?:\b|E\d+)/i)?.[1] ||
    title.match(/\bSeason\s+0*(\d{1,3})\b/i)?.[1] ||
    title.match(/第\s*0*(\d{1,3})\s*季/)?.[1];

  if (!season) return null;

  const seasonNumber = parseInt(season, 10);
  return Number.isFinite(seasonNumber) && seasonNumber > 0
    ? seasonNumber
    : null;
};

const convertQuoteToMarkdown = (quote: string, title = ''): string => {
  const normalized = quote.trim();
  if (!normalized) return '';

  const quoteTitle = title.trim() ? `**${title.trim()}**\n` : '';
  return `${quoteTitle}${normalized}`
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
};

const convertFenceToMarkdown = (content: string): string => {
  return `\n\`\`\`text\n${content.trim()}\n\`\`\`\n`;
};

export const bbcodeToMarkdown = (text: string): string => {
  return (text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\[(?:size|font|color)=[^\]]*?\]/gi, '')
    .replace(/\[\/(?:size|font|color)\]/gi, '')
    .replace(/\[(?:left|right|center|align=[^\]]*?)\]/gi, '')
    .replace(/\[\/(?:left|right|center|align)\]/gi, '')
    .replace(/\[hr\]/gi, '\n---\n')
    .replace(/\[img(?:=[^\]]*?)?\]([\s\S]*?)\[\/img\]/gi, (_match, url) => {
      const imageUrl = url.trim();
      return imageUrl ? `![](${imageUrl})` : '';
    })
    .replace(/\[url=([^\]]*?)\]([\s\S]*?)\[\/url\]/gi, (_match, url, label) => {
      const href = url.trim();
      const textLabel = label.trim();
      return textLabel ? `[${textLabel}](${href})` : href;
    })
    .replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (_match, url) => {
      const href = url.trim();
      return href ? `[${href}](${href})` : '';
    })
    .replace(/\[(?:b|strong)\]\s*([\s\S]*?)\s*\[\/(?:b|strong)\]/gi, '**$1**')
    .replace(/\[(?:i|em)\]\s*([\s\S]*?)\s*\[\/(?:i|em)\]/gi, '*$1*')
    .replace(/\[s\]\s*([\s\S]*?)\s*\[\/s\]/gi, '~~$1~~')
    .replace(/\[u\]\s*([\s\S]*?)\s*\[\/u\]/gi, '$1')
    .replace(
      /\[(code|pre|mediainfo|bdinfo)\]([\s\S]*?)\[\/\1\]/gi,
      (_match, _tag, code) => convertFenceToMarkdown(code),
    )
    .replace(
      /\[quote=([^\]]*?)\]([\s\S]*?)\[\/quote\]/gi,
      (_match, title, quote) => `${convertQuoteToMarkdown(quote, title)}\n`,
    )
    .replace(
      /\[quote\]([\s\S]*?)\[\/quote\]/gi,
      (_match, quote) => `${convertQuoteToMarkdown(quote)}\n`,
    )
    .replace(
      /\[(?:hide|spoiler|box)(?:=([^\]]*?))?\]([\s\S]*?)\[\/(?:hide|spoiler|box)\]/gi,
      (_match, title, content) => {
        const heading = title?.trim() ? `**${title.trim()}**\n\n` : '';
        return `\n${heading}${content.trim()}\n`;
      },
    )
    .replace(
      /\[comparison(?:=([^\]]*?))?\]([\s\S]*?)\[\/comparison\]/gi,
      (_match, title, content) => {
        const heading = title?.trim() ? `**${title.trim()}**\n\n` : '';
        return `\n${heading}${content.trim()}\n`;
      },
    )
    .replace(/\[list(?:=[^\]]*?)?\]([\s\S]*?)\[\/list\]/gi, (_match, list) =>
      list.replace(/\[\*\]\s*/g, '\n- ').trim(),
    )
    .replace(/^\[\*\]\s*/gm, '- ')
    .replace(/\[\/?\w+(?:=[^\]]*?)?\]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

  private getReactComponentInstance(
    fiberNode: ReactFiberNode | null,
  ): ReactComponentInstance | null {
    if (fiberNode?.stateNode?.state !== undefined) {
      return fiberNode.stateNode;
    }

    let child = fiberNode?.child;
    while (child) {
      const instance: ReactComponentInstance | null =
        this.getReactComponentInstance(child);
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
      longDesc: bbcodeToMarkdown(prepareYemaPTDescription(info)),
    };

    const picture = this.getPoster();
    if (picture) fields.picture = picture;

    const doubanId = info.doubanUrl?.match(/subject\/(\d+)/)?.[1];
    if (doubanId) fields.douban = doubanId;

    const imdbId = getIdByIMDbUrl(info.imdbUrl || '').replace(/^tt/i, '');
    if (imdbId) fields.imdb = imdbId;

    const mediaInfo = info.mediaInfos?.[0];
    if (mediaInfo) fields.mediaInfo = mediaInfo;

    const season = getYemaPTSeason(info.title);
    if (season) fields.season = season;

    return fields;
  }

  private getPoster(): string {
    const { poster, description } = this.info!;
    if (poster) return poster;
    return description.match(/\[img\]([^[]+?)\[\/img\]/i)?.[1]?.trim() || '';
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
    if (/^(atmos)$/i.test(audioCodec)) {
      return /DDP|DD\+|E-?AC-?3/i.test(title) ? 'E-AC3 Atmos' : 'TrueHD Atmos';
    }
    if (/^truehd$/i.test(audioCodec) && /Atmos/i.test(title)) {
      return 'TrueHD Atmos';
    }
    if (/^(ac3|dd|dd\+)$/i.test(audioCodec) && /DDP|DD\+/i.test(title)) {
      return /Atmos/i.test(title)
        ? 'E-AC3 Atmos'
        : 'E-AC3 (Dolby Digital Plus)';
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
    if (tags.hdr10) result.push('HDR10');
    if (tags.hdr10_plus) result.push('HDR10+');
    if (tags.dolby_vision) result.push('杜比视界');
    if (tags.dolby_atmos) result.push('杜比全景声(Atmos)');
    if (tags.dts_x) result.push('DTS-X');
    if (tags.diy) result.push('DIY');
    if (tags.exclusive) result.push('首发');
    if (/E\d+/i.test(title)) result.push('连载中');
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
