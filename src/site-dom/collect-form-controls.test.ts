import { beforeEach, describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { collectFormControls, RawField } from './collect-form-controls';

const page = {
  origin: 'https://pt.example.com',
  host: 'pt.example.com',
  pathname: '/upload.php',
};

// A trimmed NexusPHP upload page with a movie section (mode 4) and a
// special section (mode 5), plus the header search box.
const nexusUploadPage = `
  <form action="torrents.php"><input type="text" name="search" /></form>
  <form id="compose" action="takeupload.php" method="post" enctype="multipart/form-data">
    <input type="hidden" name="_token" value="private-csrf-token" />
    <input type="file" id="torrent" name="file" />
    <input type="text" id="name" name="name" />
    <input type="text" name="url" />
    <select name="color"><option value="0">--- 颜色 ---</option></select>
    <textarea name="descr"></textarea>
    <div id="mode_4">
      <select name="type" id="browsecat">
        <option value="0">请选择</option>
        <option value="401">Movies/电影</option>
        <option value="402">TV Series/剧集</option>
      </select>
      <select name="medium_sel[4]"><option value="1">Blu-ray</option></select>
      <label><input type="checkbox" name="tags[4][]" value="1" />禁转</label>
      <label><input type="checkbox" name="tags[4][]" value="5" />中字</label>
      <input type="checkbox" name="tags[4][]" value="6" /> 国语
    </div>
    <div id="mode_5">
      <select name="type" id="specialcat">
        <option value="0">请选择</option>
        <option value="411">book/图书馆</option>
      </select>
    </div>
    <input type="checkbox" name="uplver" value="yes" />匿名发布
  </form>`;

const byName = (fields: RawField[], name: string) =>
  fields.filter((field) => field.name === name);

describe('collectFormControls', () => {
  beforeEach(() => {
    document.body.innerHTML = nexusUploadPage;
  });

  it('keeps page metadata apart from the fields', () => {
    const config = collectFormControls(document, page);
    expect(config.version).toBe(2);
    expect(config.page).toEqual({
      url: 'https://pt.example.com',
      host: 'pt.example.com',
      uploadPath: '/upload.php',
    });
    expect(Array.isArray(config.fields)).toBe(true);
  });

  it('keeps a form field named url (the NexusPHP IMDb input)', () => {
    const { fields } = collectFormControls(document, page);
    expect(byName(fields, 'url')).toEqual([
      {
        name: 'url',
        selector: 'input[name="url"]',
        tag: 'input',
        type: 'text',
      },
    ]);
  });

  it('keeps both NexusPHP category selects with id selectors and their own options', () => {
    const { fields } = collectFormControls(document, page);
    const types = byName(fields, 'type');
    expect(types.map((field) => field.selector)).toEqual([
      '#browsecat',
      '#specialcat',
    ]);
    expect(types[0].options?.map((o) => o.value)).toEqual(['0', '401', '402']);
    expect(types[1].options?.map((o) => o.value)).toEqual(['0', '411']);
  });

  it('keeps every checkbox of a group with its value and label', () => {
    const { fields } = collectFormControls(document, page);
    expect(byName(fields, 'tags[4][]')).toEqual([
      {
        name: 'tags[4][]',
        selector: 'input[name="tags[4][]"][value="1"]',
        tag: 'input',
        type: 'checkbox',
        value: '1',
        label: '禁转',
      },
      {
        name: 'tags[4][]',
        selector: 'input[name="tags[4][]"][value="5"]',
        tag: 'input',
        type: 'checkbox',
        value: '5',
        label: '中字',
      },
      {
        name: 'tags[4][]',
        selector: 'input[name="tags[4][]"][value="6"]',
        tag: 'input',
        type: 'checkbox',
        value: '6',
        label: '国语',
      },
    ]);
  });

  it('uses the plain name selector for a single checkbox and labels it from the following text', () => {
    const { fields } = collectFormControls(document, page);
    expect(byName(fields, 'uplver')[0]).toMatchObject({
      selector: 'input[name="uplver"]',
      value: 'yes',
      label: '匿名发布',
    });
  });

  it('gives every field a selector that matches only that control', () => {
    const { fields } = collectFormControls(document, page);
    const controls = document.querySelectorAll('input, select, textarea');
    fields.forEach((field) => {
      expect(field.index).toBeUndefined();
      const matches = document.querySelectorAll(field.selector);
      expect(matches).toHaveLength(1);
      expect(Array.from(controls)).toContain(matches[0]);
    });
  });

  it('records no value for hidden or text inputs and skips BBCode toolbar selects', () => {
    const { fields } = collectFormControls(document, page);
    expect(byName(fields, '_token')[0]).not.toHaveProperty('value');
    expect(JSON.stringify(fields)).not.toContain('private-csrf-token');
    expect(byName(fields, 'color')).toEqual([]);
  });

  it('scopes same-name controls without ids to an ancestor id, else reports an index', () => {
    document.body.innerHTML = `
      <div id="a"><input type="text" name="dup" /></div>
      <div id="b"><input type="text" name="dup" /></div>
      <p><textarea name="twin"></textarea><textarea name="twin"></textarea></p>`;
    const { fields } = collectFormControls(document, page);
    expect(byName(fields, 'dup').map((field) => field.selector)).toEqual([
      '#a input[name="dup"]',
      '#b input[name="dup"]',
    ]);
    expect(
      byName(fields, 'twin').map(({ selector, index }) => ({
        selector,
        index,
      })),
    ).toEqual([
      { selector: 'textarea[name="twin"]', index: 0 },
      { selector: 'textarea[name="twin"]', index: 1 },
    ]);
  });

  it('survives a YAML round trip', () => {
    const config = collectFormControls(document, page);
    const parsed = YAML.parse(YAML.stringify(config));
    expect(parsed).toEqual(JSON.parse(JSON.stringify(config)));
  });
});
