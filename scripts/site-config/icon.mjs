/**
 * Site favicon -> 20px PNG data URI for the `icon` field of a site config.
 *
 * Also a CLI (`yarn icon <SiteName> [...]`): refetches the icon of
 * src/config/<SiteName>.yaml and rewrites only the `icon:` line, so the rest
 * of the file (comments, quoting, order) stays as it is.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import got from 'got';
import decodeIco from 'decode-ico';
import sharp from 'sharp';
import YAML from 'yaml';
import { CONFIG_DIR } from './validate.mjs';

const ICON_WIDTH = 20;
const request = got.extend({
  timeout: { request: 15000 },
  retry: { limit: 1 },
  headers: {
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  },
});

/** Smallest frame that is at least ICON_WIDTH wide, else the largest one. */
function pickFrame(frames) {
  const sorted = [...frames].sort((a, b) => a.width - b.width);
  return sorted.find((f) => f.width >= ICON_WIDTH) || sorted[sorted.length - 1];
}

function toSharp(buffer) {
  try {
    const frame = pickFrame(decodeIco(buffer));
    if (frame.type === 'png') return sharp(frame.data);
    const raw = { width: frame.width, height: frame.height, channels: 4 };
    return sharp(frame.data, { raw });
  } catch {
    // Not an ICO: favicons are often plain PNG/GIF/JPEG/SVG files.
    return sharp(buffer);
  }
}

async function iconUrlFromHomepage(siteUrl) {
  const html = await request(siteUrl).text();
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    if (!/\brel\s*=\s*["']?[^"'>]*\bicon\b/i.test(tag)) continue;
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (href) return new URL(href, siteUrl).href;
  }
  return null;
}

async function iconFrom(url) {
  const buffer = await request(url).buffer();
  const png = await toSharp(buffer)
    .resize({ width: ICON_WIDTH })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

/** Fetch the site's favicon as a 20px-wide PNG data URI. Throws when nothing usable is found. */
export async function fetchIconDataUri(siteUrl) {
  try {
    return await iconFrom(new URL('/favicon.ico', siteUrl).href);
  } catch (err) {
    // Fall back to the <link rel="icon"> of the homepage (or its login page).
    const fromPage = await iconUrlFromHomepage(siteUrl).catch(() => null);
    if (!fromPage) throw err;
    return iconFrom(fromPage);
  }
}

export function hasIcon(config) {
  return typeof config?.icon === 'string' && config.icon.startsWith('data:');
}

/** Put the icon on the `icon:` line (keeping every comment in the file). */
export function injectIcon(yamlText, dataUri) {
  const line = `icon: '${dataUri}'`;
  if (/^icon:.*$/m.test(yamlText)) {
    return yamlText.replace(/^icon:.*$/m, () => line);
  }
  const anchor = /^siteType:.*$/m.test(yamlText)
    ? /^siteType:.*$/m
    : /^url:.*$/m;
  return yamlText.replace(anchor, (match) => `${match}\n${line}`);
}

async function main(siteNames) {
  if (!siteNames.length) {
    console.error('Usage: yarn icon <SiteName> [<SiteName> ...]');
    process.exit(2);
  }
  let failed = 0;
  for (const name of siteNames) {
    const file = path.join(CONFIG_DIR, `${name}.yaml`);
    try {
      const yamlText = fs.readFileSync(file, 'utf8');
      const { url } = YAML.parse(yamlText) || {};
      if (!url) throw new Error('no `url` field');
      fs.writeFileSync(file, injectIcon(yamlText, await fetchIconDataUri(url)));
      console.log(`✓ ${name}: icon updated`);
    } catch (err) {
      failed++;
      console.error(`✗ ${name}: ${err.message}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2));
}
