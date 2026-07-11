import { getAudioCodecFromSource } from './index';
import { MediaInfo, VideoTrack, AudioTrack, SubtitleTrack } from './media.type';
import { convertSizeStringToBytes } from '@/common/utils';

abstract class MediaParser {
  protected source: string;
  protected result: MediaInfo;
  constructor(source: string) {
    this.source = source;
    this.result = {
      fileName: '',
      fileSize: 0,
      duration: 0,
      format: '',
      audioTracks: [],
      subtitleTracks: [],
      videoTracks: [],
    };
  }

  abstract parse(): MediaInfo;

  abstract parseVideoSection(videos: Record<string, string>[]): VideoTrack[];

  abstract parseAudioSection(audios: Record<string, string>[]): AudioTrack[];

  abstract parseSubtitleSection(
    subtitles: Record<string, string>[],
  ): SubtitleTrack[];

  abstract splitIntoSections(): Record<string, Record<string, string>[]>;

  abstract parseDuration(duration: string): number;

  getHdrType(hdrFormat: string): string {
    if (!hdrFormat) return '';

    if (/Dolby\s*Vision/i.test(hdrFormat)) return 'DV';
    if (/HDR10\+/i.test(hdrFormat)) return 'HDR10+';
    if (/HDR10/i.test(hdrFormat)) return 'HDR10';
    if (/HLG/i.test(hdrFormat)) return 'HLG';

    return '';
  }
}

export class MediaInfoParser extends MediaParser {
  splitIntoSections() {
    const lines = this.source.split('\n');
    const sections: Record<string, Record<string, string>[]> = {};

    let currentSectionLines: Record<string, string> = {};
    let currentSectionType = '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      const sectionHeaderMatch = trimmedLine.match(/^([a-zA-Z]+)(\s*#\d+)?$/);
      if (sectionHeaderMatch) {
        if (currentSectionType && Object.keys(currentSectionLines).length > 0) {
          if (sections[currentSectionType]) {
            sections[currentSectionType].push(currentSectionLines);
          } else {
            sections[currentSectionType] = [currentSectionLines];
          }
        }
        currentSectionType = sectionHeaderMatch[1];
        currentSectionLines = {};
        continue;
      }
      if (currentSectionType) {
        // split on the first colon only so values like "16:9" or paths keep intact
        const [key, value] = trimmedLine
          .split(/:([\s\S]*)/)
          .map((s) => s?.trim());
        if (key && value) {
          currentSectionLines[key] = value;
        }
      }
    }
    if (currentSectionType && Object.keys(currentSectionLines).length > 0) {
      if (sections[currentSectionType]) {
        sections[currentSectionType].push(currentSectionLines);
      } else {
        sections[currentSectionType] = [currentSectionLines];
      }
    }
    return sections;
  }

  parseGeneralSection(general: Record<string, string>) {
    if (!general) return;
    this.result.fileSize = convertSizeStringToBytes(general['File size']);
    this.result.duration = this.parseDuration(general.Duration);
    this.result.format = general.Format;
    this.result.fileName = general['Complete name'];
  }

  parseVideoSection(videos: Record<string, string>[]) {
    if (!videos || videos.length === 0) return [];
    const videoTracks: VideoTrack[] = [];
    for (const video of videos) {
      videoTracks.push(this.parseVideo(video, this.result.format));
    }
    return videoTracks;
  }

  parseAudioSection(audios: Record<string, string>[]) {
    if (!audios || audios.length === 0) return [];
    const audioTracks: AudioTrack[] = [];
    for (const audio of audios) {
      audioTracks.push(this.parseAudio(audio));
    }
    return audioTracks;
  }

  parseSubtitleSection(subtitles: Record<string, string>[]) {
    if (!subtitles || subtitles.length === 0) return [];
    const subtitleTracks: SubtitleTrack[] = [];
    for (const subtitle of subtitles) {
      const {
        ID: id = '',
        Title: title = '',
        Language: language = '',
        Default: isDefault = '',
        Forced: isForced = '',
      } = subtitle;
      subtitleTracks.push({
        id,
        title,
        language,
        default: isDefault === 'Yes',
        forced: isForced === 'Yes',
      });
    }
    return subtitleTracks;
  }

  parseAudio(audio: Record<string, string>): AudioTrack {
    const {
      Format: audioFormat = '',
      'Format profile': formatProfile = '',
      'Commercial name': commercialName = '',
      'Channel(s)': audioChannels = '',
      ID: id = '',
      Default: isDefault = '',
      Forced: isForced = '',
      Language: language = '',
    } = audio;
    let channelName = '';
    const channelNumber = parseInt(audioChannels, 10);
    if (channelNumber >= 6) {
      channelName = `${channelNumber - 1}.1`;
    } else if (channelNumber) {
      channelName = `${channelNumber}.0`;
    }

    const codec = this.determineAudioCodec(
      audioFormat,
      commercialName,
      formatProfile,
    );
    return {
      channelName,
      language,
      default: isDefault === 'Yes',
      forced: isForced === 'Yes',
      id,
      codec,
    };
  }

  parseVideo(video: Record<string, string>, generalFormat: string): VideoTrack {
    const {
      Format: videoFormat = '',
      'Format version': videoFormatVersion = '',
      'Codec ID': videoCodeId = '',
      'HDR format': hdrFormat = '',
      'Encoding settings': encodingSettings,
      Default: isDefault = '',
      Forced: isForced = '',
      ID: id = '',
      Width = '',
      Height = '',
      'Scan type': scanType = '',
    } = video;
    const isEncoded = !!encodingSettings;

    const formatCodecMap: Record<string, string> = {
      'DVD Video': 'mpeg2',
      'MPEG-4': 'mpeg4',
    };
    let videoCodec = formatCodecMap[generalFormat] || '';

    if (!videoCodec) {
      if (videoFormat === 'MPEG Video' && videoFormatVersion === 'Version 2') {
        videoCodec = 'mpeg2';
      } else if (/xvid/i.test(videoCodeId)) {
        videoCodec = 'xvid';
      } else if (/HEVC/i.test(videoFormat)) {
        videoCodec = isEncoded ? 'x265' : 'hevc';
      } else if (/AVC/i.test(videoFormat)) {
        videoCodec = isEncoded ? 'x264' : 'h264';
      } else if (/VC-1/i.test(videoFormat)) {
        videoCodec = 'vc1';
      } else if (/vvc/i.test(videoFormat)) {
        videoCodec = 'vvc';
      }
    }
    const hdrType = this.getHdrType(hdrFormat);
    const videoWidth = parseInt(Width.replace(/\s/g, ''), 10);
    const videoHeight = parseInt(Height.replace(/\s/g, ''), 10);
    const resolution = this.parseResolution(videoWidth, videoHeight, scanType);

    return {
      hdrType,
      codec: videoCodec,
      isEncoded,
      default: isDefault === 'Yes',
      forced: isForced === 'Yes',
      id,
      resolution,
    };
  }

  parseDuration(duration: string) {
    const hour = duration.match(/(\d+)\s*h/)?.[1] ?? '0';
    const minute = duration.match(/(\d+)\s*min/)?.[1] ?? '0';
    const second = duration.match(/(\d+)\s*s/)?.[1] ?? '0';
    return (
      parseInt(hour, 10) * 3600 +
      parseInt(minute, 10) * 60 +
      parseInt(second, 10)
    );
  }

  parseResolution(
    width: number,
    height: number,
    scanType: string = '',
  ): string {
    if (!width || !height || isNaN(width) || isNaN(height)) {
      return '';
    }
    if (width === 7680 && height === 4320) return '4320p';
    if (width === 3840 && height === 2160) return '2160p';

    if (height >= 2160 || width >= 3840) {
      return '2160p';
    } else if (height >= 1080 || width >= 1920) {
      const isProgressive = scanType === 'Progressive' || !scanType;
      return `1080${isProgressive ? 'p' : 'i'}`;
    } else if (height >= 720 || width >= 1280) {
      return '720p';
    } else if (height >= 576 || width >= 1024) {
      return '576p';
    } else if (width >= 840 || height === 480) {
      return '480p';
    } else if (height >= 360) {
      return '360p';
    } else if (height >= 240) {
      return '240p';
    }
    return `${width}x${height}`;
  }

  private determineAudioCodec(
    format: string,
    commercialName: string,
    formatProfile: string,
  ): string {
    const codecRules = [
      {
        match: () =>
          /MLP FBA/i.test(format) && /Dolby Atmos/i.test(commercialName),
        codec: 'atmos',
      },
      { match: () => /MLP FBA/i.test(format), codec: 'truehd' },
      {
        match: () =>
          /AC-3/i.test(format) && /Dolby Digital Plus/i.test(commercialName),
        codec: 'dd+',
      },
      { match: () => /E-AC-3/i.test(format), codec: 'dd+' },
      {
        match: () =>
          /AC-3/i.test(format) && /Dolby Digital/i.test(commercialName),
        codec: 'dd',
      },
      { match: () => /AC-3/i.test(format), codec: 'ac3' },
      { match: () => /DTS XLL X/i.test(format), codec: 'dtsx' },
      {
        match: () =>
          /DTS/i.test(format) && /DTS-HD Master Audio/i.test(commercialName),
        codec: 'dtshdma',
      },
      {
        match: () => /DTS/i.test(format) && /MA \/ Core/i.test(formatProfile),
        codec: 'dtshdma',
      },
      {
        match: () =>
          /DTS/i.test(format) && /High Resolution/i.test(commercialName),
        codec: 'dtshd',
      },
      { match: () => /DTS/i.test(format), codec: 'dts' },
      { match: () => /FLAC/i.test(format), codec: 'flac' },
      { match: () => /AAC/i.test(format), codec: 'aac' },
      { match: () => /LPCM/i.test(format), codec: 'lpcm' },
      { match: () => /MP3/i.test(format), codec: 'mp3' },
      { match: () => /Opus/i.test(format), codec: 'opus' },
      { match: () => /Vorbis/i.test(format), codec: 'vorbis' },
    ];

    const matchedRule = codecRules.find((rule) => rule.match());
    return matchedRule ? matchedRule.codec : '';
  }

  parse(): MediaInfo {
    const sections = this.splitIntoSections();
    this.parseGeneralSection(sections?.General?.[0]);
    const videoTracks = this.parseVideoSection(sections?.Video);
    const audioTracks = this.parseAudioSection(sections?.Audio);
    const subtitleTracks = this.parseSubtitleSection(sections?.Text);

    return {
      ...this.result,
      videoTracks,
      audioTracks,
      subtitleTracks,
    };
  }
}

export class BDInfoParser extends MediaParser {
  splitIntoSections() {
    const lines = this.source.split('\n');
    const sectionTypeConfig = [
      { match: /Disc Label|DISC INFO/i, typeName: 'general' },
      { match: /\*?VIDEO:/i, typeName: 'video' },
      { match: /\*?AUDIO:/i, typeName: 'audio' },
      { match: /\*?SUBTITLE(S)?/i, typeName: 'subtitle' },
    ];

    const sections: Record<string, Record<string, string>[]> = {};

    let currentSectionLines: Record<string, string> = {};
    let currentSectionType = '';
    let currentSectionLineIndex = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      const sectionHeaderMatch = sectionTypeConfig.filter((config) =>
        trimmedLine.match(config.match),
      );

      if (sectionHeaderMatch.length > 0) {
        currentSectionLineIndex = 0;
        if (currentSectionType && Object.keys(currentSectionLines).length > 0) {
          if (sections[currentSectionType]) {
            sections[currentSectionType].push(currentSectionLines);
          } else {
            sections[currentSectionType] = [currentSectionLines];
          }
        }
        currentSectionType = sectionHeaderMatch[0].typeName;
        const [key, value, ...extra] = trimmedLine.split(':');
        if (key && value) {
          if (extra.length > 0) {
            currentSectionLines = {
              [key]: `${value}:${extra.join(':').trim()}`,
            };
          } else {
            currentSectionLines = {
              [key]: value.trim(),
            };
          }
        } else {
          currentSectionLines = {};
        }
        continue;
      }
      if (currentSectionType) {
        const [key, value, ...extra] = trimmedLine
          .split(':')
          .map((s) => s.trim());
        if (key && value && !key.includes('/') && !value.includes('/')) {
          if (extra.length > 0) {
            currentSectionLines[key] = `${value}:${extra.join(':').trim()}`;
          } else {
            currentSectionLines[key] = value.trim();
          }
        } else if (key.trim()) {
          if (
            !key.includes('--') &&
            !key.match(/Bitrate\s*Description|PLAYLIST REPORT/i)
          ) {
            if (!sections[currentSectionType]) {
              sections[currentSectionType] = [];
            }
            sections[currentSectionType].push({
              [currentSectionLineIndex]: trimmedLine,
            });
          }
        }
      }
    }
    if (currentSectionType && Object.keys(currentSectionLines).length > 0) {
      if (sections[currentSectionType]) {
        sections[currentSectionType].push(currentSectionLines);
      } else {
        sections[currentSectionType] = [currentSectionLines];
      }
    }
    return sections;
  }

  parseGeneralSection(general: Record<string, string>) {
    if (!general) {
      return;
    }
    this.result.fileSize = convertSizeStringToBytes(
      general?.['Disc Size']?.replace(/,/g, ''),
    );
    this.result.duration = this.parseDuration(
      general?.Length?.replace(/\s/g, ''),
    );
    this.result.fileName = general?.['Disc Label'];
  }

  parseVideoSection(videos: Record<string, string>[]): VideoTrack[] {
    if (!videos || videos.length === 0) return [];
    const videoTracks: VideoTrack[] = [];
    for (const video of videos) {
      videoTracks.push(this.parseVideo(Object.values(video)[0]));
    }
    return videoTracks;
  }

  parseVideo(video: string): VideoTrack {
    const videoCodec = video.match(/(\w|\s|-|\/)+?Video/i)?.[0] ?? '';
    const codec = /HEVC/i.test(videoCodec) ? 'hevc' : 'h264';
    const resolution = video.match(/(\d+)p/i)?.[0] ?? '';
    const hdrType = this.getHdrType(video);
    return {
      hdrType,
      codec,
      resolution,
      default: false,
      forced: false,
      isEncoded: false,
    };
  }

  parseAudioSection(audios: Record<string, string>[]): AudioTrack[] {
    if (!audios || audios.length === 0) return [];
    const audioTracks: AudioTrack[] = [];
    for (const audio of audios) {
      audioTracks.push(this.parseAudio(Object.values(audio)[0]));
    }
    return audioTracks;
  }

  private parseAudio(audio: string): AudioTrack {
    const audioCodec = audio.match(/(\w|\s|-|\/)+?Audio/i)?.[0] ?? '';
    const codec = getAudioCodecFromSource(audioCodec);
    const isQuickSummaryType = /Audio\s*\//.test(audio);
    let language;
    if (isQuickSummaryType) {
      language = audio.split('/')[0].trim();
    } else {
      language = audio.match(/Audio\s*(\w+)/i)?.[1] ?? '';
    }
    const channelName = audio.match(/(\d+\.\d)/)?.[0] ?? '';
    return {
      channelName,
      language,
      codec,
    };
  }

  parseSubtitleSection(subtitles: Record<string, string>[]): SubtitleTrack[] {
    if (!subtitles || subtitles.length === 0) return [];
    const subtitleTracks: SubtitleTrack[] = [];
    for (const subtitle of subtitles) {
      subtitleTracks.push(this.parseSubtitle(Object.values(subtitle)[0]));
    }
    return subtitleTracks;
  }

  private parseSubtitle(subtitle: string): SubtitleTrack {
    const subtitleSplits = subtitle.split('/');
    const firstAudioSplit = subtitleSplits?.[0]?.trim();
    let language = firstAudioSplit;
    if (subtitleSplits.length < 2) {
      language = subtitle.match(/Graphics\s*(\w+)/)?.[1] ?? '';
    }
    return {
      language,
    };
  }

  parseDuration(duration: string) {
    if (!duration) return 0;
    const [hour, minute, second] = duration.split(':');
    return (
      parseFloat(hour) * 3600 + parseFloat(minute) * 60 + parseFloat(second)
    );
  }

  parse(): MediaInfo {
    const sections = this.splitIntoSections();
    this.parseGeneralSection(
      sections?.general?.[sections?.general?.length > 1 ? 1 : 0],
    );
    const videoTracks = this.parseVideoSection(sections?.video);
    const audioTracks = this.parseAudioSection(sections?.audio);
    const subtitleTracks = this.parseSubtitleSection(sections?.subtitle);
    return {
      ...this.result,
      videoTracks,
      audioTracks,
      subtitleTracks,
    };
  }
}
