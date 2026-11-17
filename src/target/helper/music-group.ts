/**
 * On the upload page of a Gazelle music site (RED, Orpheus, DicMusic): looks
 * for an existing torrent group of the release, opens the "add format" page of
 * that group when the match is confident, and otherwise lists the possible
 * groups for the user to pick from.
 */
import { $t } from '@/common';
import type {
  REDSearchResultGroup,
  REDSearchResultResponse,
} from '@/target/types';
import {
  decodeHtmlEntities,
  findExistingGroup,
  GroupCandidate,
  GroupMatchResult,
  MusicRelease,
} from './music-group-match';

export interface MusicSiteLocation {
  url: string;
  uploadPath: string;
}

/** setting in the panel, off by default */
export const MUSIC_GROUP_MERGE_CLOSED_KEY =
  'easy-upload.music-group-merge-closed';

/** hash flags, next to `#timestamp=…` that carries the torrent info */
const AUTO_GROUP_FLAG = 'easy-upload-group=auto';
const NEW_GROUP_FLAG = 'easy-upload-group=new';
const BOX_ID = 'easy-upload-music-group';

export const isMusicGroupMergeEnabled = (): boolean =>
  !GM_getValue<boolean>(MUSIC_GROUP_MERGE_CLOSED_KEY, false);

const hasHashFlag = (flag: string): boolean =>
  location.hash.split('#').includes(flag);

const getTimestamp = (): string =>
  location.hash.match(/(^|#)timestamp=([^#]*)(#|$)/)?.[2] ?? '';

export const buildUploadUrl = (
  siteInfo: MusicSiteLocation,
  groupId?: number | string,
  flag?: string,
): string => {
  const query = groupId ? `?groupid=${groupId}` : '';
  const extra = flag ? `#${flag}` : '';
  return `${siteInfo.url}${siteInfo.uploadPath}${query}#timestamp=${getTimestamp()}${extra}`;
};

const buildGroupUrl = (siteInfo: MusicSiteLocation, groupId: number) =>
  `${siteInfo.url}/torrents.php?id=${groupId}`;

const createLink = (text: string, href: string, newTab = false) => {
  const link = document.createElement('a');
  link.textContent = text;
  link.href = href;
  if (newTab) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  return link;
};

const describeGroup = (group: REDSearchResultGroup): string => {
  const name = [group.artist, group.groupName]
    .map((text) => decodeHtmlEntities(text ?? '').trim())
    .filter(Boolean)
    .join(' - ');
  const year = group.groupYear ? ` [${group.groupYear}]` : '';
  const type =
    typeof group.releaseType === 'string' && group.releaseType
      ? ` [${decodeHtmlEntities(group.releaseType)}]`
      : '';
  return `${name}${year}${type}`;
};

const describeDifferences = ({ detail }: GroupCandidate): string[] => {
  const notes: string[] = [];
  if (detail.title !== 'exact' && detail.title !== 'edition') {
    notes.push($t('musicGroup.diffTitle'));
  }
  if (detail.artist === 'partial' || detail.artist === 'none') {
    notes.push($t('musicGroup.diffArtist'));
  }
  if (detail.year === 'near' || detail.year === 'mismatch') {
    notes.push($t('musicGroup.diffYear'));
  }
  if (detail.releaseType === 'mismatch') {
    notes.push($t('musicGroup.diffReleaseType'));
  }
  if (detail.catalogue) {
    notes.push($t('musicGroup.sameCatalogue'));
  }
  return notes;
};

const showBox = (fill: (box: HTMLDivElement) => void) => {
  document.getElementById(BOX_ID)?.remove();
  const box = document.createElement('div');
  box.id = BOX_ID;
  box.className = 'box pad';
  box.style.cssText =
    'margin: 10px 0; padding: 10px; border: 1px solid #e6a23c;';
  fill(box);

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = $t('musicGroup.close');
  close.addEventListener('click', () => box.remove());
  box.appendChild(close);

  const form = document.querySelector('#upload_table');
  if (form?.parentNode) {
    form.parentNode.insertBefore(box, form);
  } else {
    (document.querySelector('#content') ?? document.body).prepend(box);
  }
};

const createMessage = (text: string) => {
  const message = document.createElement('p');
  message.textContent = `[EASY-UPLOAD] ${text}`;
  return message;
};

export const showGroupCandidates = (
  result: GroupMatchResult,
  siteInfo: MusicSiteLocation,
): void => {
  if (result.candidates.length === 0) {
    return;
  }
  showBox((box) => {
    box.appendChild(
      createMessage(
        result.decision === 'ambiguous'
          ? $t('musicGroup.ambiguous')
          : $t('musicGroup.suggest'),
      ),
    );
    const list = document.createElement('ul');
    result.candidates.forEach((candidate) => {
      const { groupId } = candidate.group;
      const item = document.createElement('li');
      item.appendChild(
        createLink(
          describeGroup(candidate.group),
          buildGroupUrl(siteInfo, groupId),
          true,
        ),
      );
      const notes = describeDifferences(candidate);
      if (notes.length > 0) {
        item.appendChild(document.createTextNode(` (${notes.join(', ')}) `));
      } else {
        item.appendChild(document.createTextNode(' '));
      }
      item.appendChild(
        createLink(
          `[${$t('musicGroup.useGroup')}]`,
          buildUploadUrl(siteInfo, groupId),
        ),
      );
      list.appendChild(item);
    });
    box.appendChild(list);
  });
};

/**
 * On the upload page of a group that was picked automatically, tells the user
 * and offers to upload as a new group instead.
 */
export const showAutoMergedGroupNotice = (
  siteInfo: MusicSiteLocation,
  groupId: string,
): void => {
  if (!hasHashFlag(AUTO_GROUP_FLAG) || !/^\d+$/.test(groupId)) {
    return;
  }
  showBox((box) => {
    const message = createMessage(`${$t('musicGroup.autoMerged')} `);
    message.appendChild(
      createLink(
        `torrents.php?id=${groupId}`,
        buildGroupUrl(siteInfo, Number(groupId)),
        true,
      ),
    );
    box.appendChild(message);
    const paragraph = document.createElement('p');
    paragraph.appendChild(
      createLink(
        $t('musicGroup.uploadAsNewGroup'),
        buildUploadUrl(siteInfo, undefined, NEW_GROUP_FLAG),
      ),
    );
    box.appendChild(paragraph);
  });
};

/**
 * Looks for an existing group of the release. Opens its upload page when the
 * match is confident and returns true; otherwise lists the possible groups and
 * returns false. Does nothing when the user turned the feature off, or chose
 * to upload as a new group.
 */
export const applyExistingMusicGroup = async ({
  release,
  siteInfo,
  search,
  navigate = (url: string) => {
    location.href = url;
  },
}: {
  release: MusicRelease;
  siteInfo: MusicSiteLocation;
  search: (query: string) => Promise<REDSearchResultResponse | undefined>;
  navigate?: (url: string) => void;
}): Promise<boolean> => {
  if (!isMusicGroupMergeEnabled() || hasHashFlag(NEW_GROUP_FLAG)) {
    return false;
  }
  try {
    const result = await findExistingGroup(release, search);
    console.log('[easy-upload] existing music group lookup', result);
    if (result.decision === 'merge' && result.group) {
      navigate(buildUploadUrl(siteInfo, result.group.groupId, AUTO_GROUP_FLAG));
      return true;
    }
    showGroupCandidates(result, siteInfo);
  } catch (error) {
    console.error('[easy-upload] music group lookup failed', error);
  }
  return false;
};
