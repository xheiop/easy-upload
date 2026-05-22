import { describe, expect, it } from 'vitest';
import { bbcodeToMarkdown, prepareYemaPTDescription } from './YemaPT';

describe('YemaPT target filler helpers', () => {
  it('converts common BBCode tags to Markdown', () => {
    const bbcode = [
      '[size=12][color=red][b]标题[/b][/color][/size]',
      '[img]https://example.com/a.jpg[/img]',
      '[img=350x350]https://example.com/b.jpg[/img]',
      '[url=https://example.com]站点[/url]',
      '[quote=发布组]第一行\n第二行[/quote]',
      '[list][*]A[*]B[/list]',
      '[hide=截图][comparison=Source / Encode][img]https://example.com/c.png[/img][/comparison][/hide]',
    ].join('\n');

    expect(bbcodeToMarkdown(bbcode)).toBe(
      [
        '**标题**',
        '![](https://example.com/a.jpg)',
        '![](https://example.com/b.jpg)',
        '[站点](https://example.com)',
        '> **发布组**',
        '> 第一行',
        '> 第二行',
        '',
        '- A',
        '- B',
        '',
        '**截图**',
        '',
        '**Source / Encode**',
        '',
        '![](https://example.com/c.png)',
      ].join('\n'),
    );
  });

  it('keeps code-like blocks as fenced Markdown', () => {
    expect(bbcodeToMarkdown('[mediainfo]General\nUnique ID[/mediainfo]')).toBe(
      '```text\nGeneral\nUnique ID\n```',
    );
  });

  it('removes media info from long description before conversion', () => {
    const mediaInfo = 'General\nComplete name: demo.mkv';
    expect(
      prepareYemaPTDescription({
        description: `简介\n[quote]${mediaInfo}[/quote]\n[mediainfo]${mediaInfo}[/mediainfo]`,
        mediaInfos: [mediaInfo],
      }),
    ).toBe('简介');
  });
});
