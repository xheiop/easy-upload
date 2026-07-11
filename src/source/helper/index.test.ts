import { describe, expect, it } from 'vitest';
import { getBDInfoOrMediaInfoFromBBCode } from '.';

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
