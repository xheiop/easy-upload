import parseTorrent, { toTorrentFile } from 'parse-torrent';
import { Buffer } from 'buffer/index.js';

export const TORRENT_CONTENT_TYPE = 'application/x-bittorrent';

const arrayBufferToDataUrl = (
  buffer: ArrayBuffer | Uint8Array,
  contentType = TORRENT_CONTENT_TYPE,
): string => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }

  return `data:${contentType};base64,${window.btoa(binary)}`;
};

export const sanitizeTorrentBuffer = async (
  buffer: ArrayBuffer,
  announce?: string,
) => {
  if (!announce) {
    throw new Error('Missing torrent announce URL');
  }

  const parsed = await parseTorrent(Buffer.from(buffer));

  return toTorrentFile({
    ...parsed,
    comment: '',
    announce: [announce],
    info: {
      ...parsed.info,
      source: '',
    },
  });
};

export const sanitizeTorrentToDataUrl = async (
  buffer: ArrayBuffer,
  announce?: string,
) => arrayBufferToDataUrl(await sanitizeTorrentBuffer(buffer, announce));
