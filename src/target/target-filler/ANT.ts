import { registry, TargetFiller } from './registry';
import { BaseFiller } from './base/base-filler';
import $ from 'jquery';
import {
  getIdByIMDbUrl,
  getLocationSearchValueByKey,
  getTMDBDataByIMDBId,
} from '@/common';
import { base64ToBlob } from '@/target/helper/index';
import { PT_SITE } from '@/const';

// Category value of Miniseries, which the site looks up as a TMDb TV show
const MINISERIES = '2';
// What the site's validate_upload.js accepts as a screenshot URL
const PNG_URL = /^\S+\.png(\?\S*)?$/i;

/**
 * Anthelion fills most of the form itself, so this filler mostly hands the
 * data to the site's own scripts (static/functions/upload.js):
 * - TMDbAutofill() fills the film (title, year, IMDb, poster, genres, plot)
 *   from the TMDb ID.
 * - Picking the .torrent asks the server for the release group, scene and
 *   container type, then reads the MediaInfo/BDInfo (MediaInfoExtract()),
 *   which sets source, codec, audio, subtitles, resolution, language and the
 *   edition flags. Flags it did not set count as ticked by hand and get the
 *   upload reported for review, so the filler leaves them to the site.
 */
class ANT extends BaseFiller implements TargetFiller {
  priority = 10;

  canHandle(siteName: string): boolean {
    return siteName === 'ANT';
  }

  fill(info: TorrentInfo.Info): void {
    this.info = info;
    if (!this.info) return;

    // Add format (upload.php?groupid=...) already has the film
    const isNewFilm = !getLocationSearchValueByKey('groupid');
    const imdbId = getIdByIMDbUrl(this.info.imdbUrl || '');

    if (isNewFilm) {
      this.redirectToAddFormatWhenOnSite();
      this.fillCategory();
      if (imdbId) {
        this.fillFilmLookup(imdbId);
      }
    }

    this.fillMediaDetails();
    this.fillMediaInfoText();
    this.fillScreenshotUrls();

    const torrentAttached = this.attachTorrentFile();
    if (!torrentAttached) {
      this.readMediaInfo();
    }

    if (isNewFilm && imdbId) {
      // Handles its own errors
      this.fillFilmByTMDb(imdbId);
    }
  }

  /**
   * A film already on the site only takes new torrents through Add format.
   * Once Autofill has found the film, the page's own dupe check says so in
   * #dupe with a link to the film; reopen the upload page as Add format for
   * that film, keeping the hash that carries the torrent info. (The check
   * can't be made from the source site: ANT refuses ajax.php requests from
   * other sites.)
   */
  private redirectToAddFormatWhenOnSite(): void {
    const dupe = document.querySelector('#dupe');
    if (!dupe) return;

    const redirect = () => {
      const href =
        dupe
          .querySelector('a[href*="torrents.php?id="]')
          ?.getAttribute('href') || '';
      const groupId = href.match(/[?&]id=(\d+)/)?.[1];
      if (!groupId) return false;
      observer.disconnect();
      location.href = `${PT_SITE.ANT.uploadPath}?groupid=${groupId}${location.hash}`;
      return true;
    };
    const observer = new MutationObserver(redirect);
    if (!redirect()) {
      observer.observe(dupe, { childList: true, subtree: true });
    }
  }

  protected fillCategory(): void {
    const { category } = this.info!;
    const { selector, map } = PT_SITE.ANT.category;
    const value = map[category as keyof typeof map];
    // Only the value: the select's onchange (Categories()) clears the film
    if (value) {
      $(selector).val(value);
    }
  }

  /**
   * Fills the IMDb ID and the title box. Once a .torrent is picked the site
   * looks the film up by the name it reads from the release, unless the
   * title box already has something in it; that search would show posters to
   * pick from after Autofill has already found the film.
   */
  private fillFilmLookup(imdbId: string): void {
    const { movieAkaName, movieName, year } = this.info!;
    $(PT_SITE.ANT.imdb.selector).val(imdbId);
    const filmTitle = movieAkaName || movieName;
    if (filmTitle) {
      $('#title').val(filmTitle);
      $('#year').val(year || '');
    }
  }

  private async fillFilmByTMDb(imdbId: string): Promise<void> {
    try {
      const tmdbData = await getTMDBDataByIMDBId(imdbId);
      if (!tmdbData?.id) {
        throw new Error('No TMDb ID found');
      }
      if ('first_air_date' in tmdbData) {
        $(PT_SITE.ANT.category.selector).val(MINISERIES);
      }
      $(PT_SITE.ANT.tmdb.selector).val(String(tmdbData.id));
      TMDbAutofill();
    } catch (error) {
      console.warn('ANT: TMDb ID not found, falling back to Lookup', error);
      // Shows the site's search results for the title to pick the film from.
      // Without a title the site searches by the release name by itself.
      if ($('#title').val()) {
        $('#lookup')[0]?.click();
      }
    }
  }

  /**
   * Source, codec, audio and resolution, for when the site cannot read the
   * MediaInfo. Reading it sets them again.
   */
  private fillMediaDetails(): void {
    const keys = ['source', 'videoCodec', 'audioCodec', 'resolution'] as const;
    keys.forEach((key) => {
      const { selector, map } = PT_SITE.ANT[key];
      const value = map[this.info![key] as keyof typeof map];
      if (value) {
        $(selector).val(value);
      }
    });
  }

  private fillMediaInfoText(): void {
    const { mediaInfos } = this.info!;
    if (mediaInfos?.length > 0) {
      $(PT_SITE.ANT.mediaInfo.selector).val(mediaInfos[0].trim());
    }
  }

  /** PNG links only: the site refuses the upload for any other screenshot. */
  private fillScreenshotUrls(): void {
    const { screenshots = [] } = this.info!;
    const textarea = $(PT_SITE.ANT.screenshots.selector);
    const maxScreenshots = Number(textarea.data('max-ss')) || 4;
    const pngScreenshots = screenshots
      .map((url) => url.trim())
      .filter((url) => PNG_URL.test(url))
      .slice(0, maxScreenshots);
    textarea.val(pngScreenshots.join('\n'));
  }

  /**
   * Attaches the .torrent and fires change, so the site reads the release
   * name and then the MediaInfo already in the box.
   */
  private attachTorrentFile(): boolean {
    const { torrentData, title } = this.info!;
    const input = $(PT_SITE.ANT.torrent.selector)[0] as
      | HTMLInputElement
      | undefined;
    if (!torrentData || !input) {
      return false;
    }
    const blob = base64ToBlob(torrentData);
    const fileName = `${title.replace(/\s/g, '.')}.torrent`;
    const file = new File([blob], fileName, {
      type: 'application/x-bittorrent',
    });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  /**
   * Without a .torrent the MediaInfo has to be read here. Not a BDInfo: the
   * site can only read one once a .torrent tells it the release is a disc.
   */
  private readMediaInfo(): void {
    const { mediaInfos, videoType } = this.info!;
    if (!mediaInfos?.length || /bluray/i.test(videoType)) {
      return;
    }
    MediaInfoExtract();
  }
}

registry.register(new ANT());
