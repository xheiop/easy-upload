import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const VERSION_HEADER = /^#{1,3}\s+\[?(\d+\.\d+\.\d+[^\]\s]*)\]?.*$/m;

function formatChangelog(content) {
  if (!content) return '';
  return content
    .replace(/\*{2}(.+?)\*{2}/g, '<b>$1</b>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

/**
 * 取出 CHANGELOG 中最新一个版本的内容（从第一个版本标题到下一个版本标题或文件末尾）
 */
export function getLatestRelease(changeLogData) {
  const lines = changeLogData.split(/\r?\n/);
  const start = lines.findIndex((line) => VERSION_HEADER.test(line));
  if (start === -1) {
    throw new Error('CHANGELOG 中没有找到版本标题');
  }
  let end = lines.findIndex(
    (line, index) => index > start && VERSION_HEADER.test(line),
  );
  if (end === -1) end = lines.length;
  const version = lines[start].match(VERSION_HEADER)[1];
  return { version, body: lines.slice(start + 1, end).join('\n') };
}

/**
 * 按「### 标题」拆分版本内容，返回 { 标题: 条目内容 }
 */
export function getSections(body) {
  const sections = {};
  let current = null;
  body.split('\n').forEach((line) => {
    const header = line.match(/^#{3,}\s+(.+?)\s*$/);
    if (header) {
      current = header[1];
      sections[current] = [];
    } else if (current && line.trim()) {
      sections[current].push(line);
    }
  });
  Object.keys(sections).forEach((key) => {
    sections[key] = sections[key].join('\n');
  });
  return sections;
}

function formatSection(content, emoji) {
  if (!content) return '';
  return formatChangelog(content.replace(/^\s*[*-]\s+/gm, `${emoji} `));
}

export default function createTgChannelMsg(core) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const changeLogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  const changeLogData = fs.readFileSync(changeLogPath, 'UTF-8');
  const { version, body } = getLatestRelease(changeLogData);
  const sections = getSections(body);

  const featureContent = formatSection(sections.Features, '🔨');
  const bugContent = formatSection(sections['Bug Fixes'], '🐛');
  const perfContent = formatSection(sections['Performance Improvements'], '🎉');
  let tgMsg = `
📣 <b>更新至${version}</b>

👉 <a href="https://greasyfork.org/zh-CN/scripts/423199">安装地址1</a>
👉 <a href="https://github.com/xheiop/easy-upload/raw/master/dist/easy-upload.user.js">安装地址2</a>
👉 <a href="https://github.com/xheiop/easy-upload/blob/master/CHANGELOG.md">CHANGELOG</a>
👉 <a href="https://github.com/xheiop/easy-upload/wiki/%E4%BD%BF%E7%94%A8%E6%95%99%E7%A8%8B">使用教程</a>
`;
  tgMsg += bugContent ? `\n<b>修复</b>\n${bugContent}\n` : '';
  tgMsg += featureContent ? `\n<b>功能</b>\n${featureContent}\n` : '';
  tgMsg += perfContent ? `\n<b>优化</b>\n${perfContent}\n` : '';
  core.exportVariable('tgMsg', tgMsg);
  return tgMsg;
}
