import { describe, expect, it } from 'vitest';
import { getBDInfoOrMediaInfoFromBBCode, getMediaTags } from '.';

describe('getBDInfoOrMediaInfoFromBBCode', () => {
  it('recognizes a sectioned MediaInfo without identifying fields', () => {
    const mediaInfo = [
      'General',
      'Complete name : demo.mkv',
      'Format : Matroska',
      '',
      'Video',
      'Format : AVC',
      'Width : 1 920 pixels',
      '',
      'Audio',
      'Format : AAC LC',
      'Channel(s) : 2 channels',
    ].join('\n');

    expect(
      getBDInfoOrMediaInfoFromBBCode(`[quote]${mediaInfo}[/quote]`),
    ).toEqual({ bdInfo: [], mediaInfo: [mediaInfo] });
  });

  it('recognizes MediaInfo containing square brackets', () => {
    const mediaInfo = [
      'General',
      'Unique ID : 261661174147273455199166502268741581595',
      '',
      'Video',
      'Codec ID : V_MPEG4/ISO/AVC',
      '',
      'Audio',
      'Codec ID : A_DTS',
      '',
      'Text #1',
      'Title : 简体中文&English [MT机翻]',
    ].join('\n');

    expect(
      getBDInfoOrMediaInfoFromBBCode(`[quote]${mediaInfo}[/quote]`),
    ).toEqual({ bdInfo: [], mediaInfo: [mediaInfo] });
  });

  it('does not treat an ordinary quote mentioning sections as MediaInfo', () => {
    const quote = 'General information about Video and Audio';

    expect(getBDInfoOrMediaInfoFromBBCode(`[quote]${quote}[/quote]`)).toEqual({
      bdInfo: [],
      mediaInfo: [],
    });
  });
});

describe('getMediaTags', () => {
  const baseDetail = {
    videoCodec: '',
    audioCodec: '',
    resolution: '',
    audioChannels: '',
    audioLanguages: [] as string[],
    subtitleLanguages: [] as string[],
    hdrFormats: [] as string[],
  };

  it('tags dolby_atmos for an atmos audio codec', () => {
    expect(getMediaTags({ ...baseDetail, audioCodec: 'atmos' })).toEqual({
      dolby_atmos: true,
    });
  });

  it('tags dts_x for a dtsx audio codec', () => {
    expect(getMediaTags({ ...baseDetail, audioCodec: 'dtsx' })).toEqual({
      dts_x: true,
    });
  });

  it('tags languages and hdr formats', () => {
    expect(
      getMediaTags({
        ...baseDetail,
        audioCodec: 'truehd',
        audioLanguages: ['Chinese', 'English'],
        subtitleLanguages: ['Chinese'],
        hdrFormats: ['DV', 'HDR10'],
      }),
    ).toEqual({
      chinese_audio: true,
      chinese_subtitle: true,
      hdr10: true,
      dolby_vision: true,
    });
  });
});
