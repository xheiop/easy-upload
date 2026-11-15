import { beforeEach, describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { collectFormControls } from '../../src/site-dom/collect-form-controls';
import { hostOf, IssueFormatError, parseIssue } from './issue.mjs';
import { normalizeRaw } from './raw.mjs';
import { validateConfig } from './validate.mjs';

const page = {
  origin: 'https://cc.mypt.cc',
  host: 'cc.mypt.cc',
  pathname: '/upload.php',
};

// A NexusPHP upload page with a movie section (mode 4) and a special section (mode 5).
const uploadPage = ({ imdb = true } = {}) => `
  <form id="compose" action="takeupload.php" method="post" enctype="multipart/form-data">
    <input type="file" id="torrent" name="file" />
    <input type="text" id="name" name="name" />
    <input type="text" name="small_descr" />
    ${imdb ? '<input type="text" name="url" />' : ''}
    <textarea name="descr"></textarea>
    <select name="type" id="browsecat">
      <option value="0">请选择</option>
      <option value="401">Movies/电影</option>
      <option value="402">TV Series/剧集</option>
    </select>
    <select name="medium_sel[4]">
      <option value="0">请选择一项</option>
      <option value="1">Blu-ray</option>
    </select>
    <label><input type="checkbox" name="tags[4][]" value="1" />禁转</label>
    <label><input type="checkbox" name="tags[4][]" value="5" />中字</label>
    <label><input type="checkbox" name="tags[4][]" value="6" />国语</label>
    <select name="type" id="specialcat">
      <option value="0">请选择</option>
      <option value="411">book/图书馆</option>
    </select>
    <input type="checkbox" name="uplver" value="yes" />匿名发布
  </form>`;

// How the issue form renders, with the button's own fence pasted inside the template's.
const issueBody = (rawYaml) =>
  [
    '### 站点架构',
    '',
    'NexusPHP',
    '',
    '### 站点配置',
    '',
    '```yaml',
    '```yaml',
    rawYaml.trimEnd(),
    '```',
    '```',
    '',
    '### 其他',
    '',
    '_No response_',
  ].join('\n');

const v2Raw = (options) => {
  document.body.innerHTML = uploadPage(options);
  return YAML.stringify(collectFormControls(document, page));
};

// Trimmed from a real v1 issue: `url` is the page URL, the IMDb input is
// gone, the tag checkboxes are one entry and only the second `type` survived.
const v1Raw = `
file:
  selector: input[name="file"]
  type: file
  label: null
name:
  selector: input[name="name"]
  type: text
  label: null
url: https://cc.mypt.cc
descr:
  selector: textarea[name="descr"]
type:
  selector: select[name="type"]
  options:
    - text: 请选择
      value: "0"
    - text: book/图书馆
      value: "411"
"medium_sel[4]":
  selector: select[name="medium_sel[4]"]
  options:
    - text: 请选择一项
      value: "0"
    - text: Blu-ray
      value: "1"
"tags[4][]":
  selector: input[name="tags[4][]"]
  type: checkbox
  label: 港/奥/台
uplver:
  selector: input[name="uplver"]
  type: checkbox
  label: null
host: cc.mypt.cc
uploadPath: /upload.php
`;

const config = ({
  imdb = 'input[name="url"][type="text"]',
  category = '#browsecat',
  categoryMap = { movie: ['401'], tv: ['402'] },
  tags = { chinese_subtitle: 'input[name="tags[4][]"][value="5"]' },
} = {}) =>
  YAML.stringify({
    url: 'https://cc.mypt.cc',
    host: 'cc.mypt.cc',
    siteType: 'NexusPHP',
    asTarget: true,
    uploadPath: '/upload.php',
    name: { selector: 'input[name="name"]' },
    description: { selector: 'textarea[name="descr"]' },
    imdb: { selector: imdb },
    anonymous: { selector: 'input[name="uplver"]' },
    torrent: { selector: 'input[name="file"]' },
    tags,
    category: { selector: category, map: categoryMap },
    videoType: {
      selector: 'select[name="medium_sel[4]"]',
      map: { bluray: ['1'] },
    },
  });

describe('parseIssue', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reads a v2 raw config with every control', () => {
    const parsed = parseIssue({
      title: '[新站点] 我的PT',
      body: issueBody(v2Raw()),
    });
    expect(parsed.rawVersion).toBe(2);
    expect(hostOf(parsed.raw)).toBe('cc.mypt.cc');

    const { page: rawPage, fields } = normalizeRaw(parsed.raw);
    expect(rawPage).toEqual({
      url: 'https://cc.mypt.cc',
      host: 'cc.mypt.cc',
      uploadPath: '/upload.php',
    });
    expect(fields.find((f) => f.name === 'url')?.selector).toBe(
      'input[name="url"]',
    );
    expect(
      fields.filter((f) => f.name === 'type').map((f) => f.selector),
    ).toEqual(['#browsecat', '#specialcat']);
    expect(fields.filter((f) => f.name === 'tags[4][]')).toHaveLength(3);
  });

  it('still reads a v1 raw config', () => {
    const parsed = parseIssue({
      title: '[新站点] 我的PT',
      body: issueBody(v1Raw),
    });
    expect(parsed.rawVersion).toBe(1);
    expect(hostOf(parsed.raw)).toBe('cc.mypt.cc');

    const { page: rawPage, fields } = normalizeRaw(parsed.raw);
    expect(rawPage.url).toBe('https://cc.mypt.cc');
    expect(rawPage.uploadPath).toBe('/upload.php');
    expect(fields.map((f) => f.name)).toEqual([
      'file',
      'name',
      'descr',
      'type',
      'medium_sel[4]',
      'tags[4][]',
      'uplver',
    ]);
    expect(fields.find((f) => f.name === 'type')?.tag).toBe('select');
  });

  it('rejects a v2 raw config without page url or host', () => {
    const raw = YAML.stringify({ version: 2, page: {}, fields: [] });
    expect(() => parseIssue({ body: issueBody(raw) })).toThrow(
      IssueFormatError,
    );
  });
});

describe('validateConfig with a v2 raw config', () => {
  const validate = (yaml, options) =>
    validateConfig(yaml, { raw: YAML.parse(v2Raw(options)) });

  it('accepts a config whose selectors and values all exist', () => {
    const { errors, warnings } = validate(config());
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('checks category values against the select the id selector names', () => {
    const { errors } = validate(
      config({ categoryMap: { movie: ['401'], other: ['411'] } }),
    );
    expect(errors).toEqual([
      expect.stringContaining('`category.map.other`: "411" is not an option'),
    ]);
  });

  it('warns when a select selector matches both category selects', () => {
    const { errors, warnings } = validate(
      config({
        category: 'select[name="type"]',
        categoryMap: { movie: ['401'], other: ['411'] },
      }),
    );
    expect(errors).toEqual([]);
    expect(warnings).toEqual([
      expect.stringContaining(
        'matches 2 controls in the raw config (#browsecat, #specialcat)',
      ),
    ]);
  });

  it('rejects a tag selector that would tick the whole checkbox group', () => {
    const { errors } = validate(
      config({ tags: { chinese_subtitle: 'input[name="tags[4][]"]' } }),
    );
    expect(errors).toEqual([
      expect.stringContaining('matches 3 controls in the raw config'),
    ]);
  });

  it('rejects a tag selector whose value is not on the page', () => {
    const { errors } = validate(
      config({
        tags: { chinese_subtitle: 'input[name="tags[4][]"][value="99"]' },
      }),
    );
    expect(errors).toEqual([
      expect.stringContaining(
        'the controls named "tags[4][]" have the values "1", "5", "6"',
      ),
    ]);
  });

  it('no longer excuses a missing IMDb input', () => {
    const { errors } = validate(config(), { imdb: false });
    expect(errors).toEqual([
      expect.stringContaining(
        '`imdb.selector` (input[name="url"][type="text"]) refers to a form field named "url"',
      ),
    ]);
  });
});

describe('validateConfig with a v1 raw config', () => {
  const validate = (yaml) => validateConfig(yaml, { raw: YAML.parse(v1Raw) });

  it('keeps the old allowances: IMDb guess, unverifiable id selectors, collapsed tags', () => {
    const { errors } = validate(
      config({
        categoryMap: { other: ['411'] },
        tags: { chinese_subtitle: 'input[name="tags[4][]"]' },
      }),
    );
    expect(errors).toEqual([]);
  });

  it('still checks name selectors and option values', () => {
    const { errors } = validate(
      config({
        category: 'select[name="type"]',
        categoryMap: { movie: ['401'] },
        imdb: 'input[name="imdb"]',
      }),
    );
    expect(errors).toEqual([
      expect.stringContaining(
        '`imdb.selector` (input[name="imdb"]) refers to a form field named "imdb"',
      ),
      expect.stringContaining('`category.map.movie`: "401" is not an option'),
    ]);
  });
});
