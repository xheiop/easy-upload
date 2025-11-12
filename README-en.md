# easy-upload

[Installation address 1](https://greasyfork.org/en/scripts/423199) | [Installation address 2](https://github.com/techmovie/easy-upload/raw/master/dist/easy-upload.user.js) | [Join Telegram group](https://t.me/+Ss_nJoAapvRhYTM1)

## About

Easy-upload is a userscript that supports reproducing torrents for mainstream Chinese and international private trackers sites. It reduces repetitive work, making the upload process more convenient.

## Wiki

You can learn about the project architecture and usage guidelines through the following links.

[Zread](https://zread.ai/techmovie/easy-upload)
[DeepWiki](https://deepwiki.com/techmovie/easy-upload)

## Compatibility

### [Tampermonkey](https://tampermonkey.net/) / [Violentmonkey](https://violentmonkey.github.io/)

Fully compatible, but Violentmonkey may not be able to run this script in older browsers.

### ~~[Greasemonkey](https://www.greasespot.net/)~~

Greasemonkey 4 is significantly inconsistent with the API of the above two script managers and only runs on Firefox, so this script is not supported Greasemonkey. Both of the above are highly recommended.

## Features

- Supports transfer between Chinese and international sites of different web architectures by automatically filling in info such as description, video parameters, etc.
- Supports custom configuration of transfer sites.
- Support batch transfer. Batch transfer to target sites with one-click.
- Add thumbnail transfer from original image to meet screenshot requirements by some sites.
- Support grabbing Douban movie description based on IMDB info, when some Chinese sites requires Douban info in reproducing from international sites.
- Allow filling info on upload page by unified yaml config of the site, making it easier to add an unsupported site. If you want to add an unsupported site, please turn to [Site Configuration Rules](https://github.com/techmovie/easy-upload/wiki/How-to-Add-Unsupported-Sites)
- Support quick search of current resource, and the site for searching is configurable.
- Support batch uploading screenshots to ptpimg, which can solve the problem that screenshots of some sites cannot be displayed on other sites
- Allows checking whether the target tracker has the current torrent by clicking the quick search button (only supports site based on NexusPHP by now).
- Supports torrent cleaning, and after transferring to the target site, automatically attaches the cleaned torrent file without the need for manual addition.

  ![](https://ptpimg.me/4475d0.gif)

## Settings

- Click the gear wheel icon to open settings panel.
- Enable transfer sites: define target site list to hide unregistered and unwanted sites. All sites will be displayed by default.
- Enable batch transfer: click “batch reproduce” button to open target sites for group transfer.
- Enable site search: configure the quick search list to define the searching scope.

## How to Generate Configuration for Unsupported Sites

When you find a PT site that is not supported by the script, you can follow these steps to generate a configuration file and submit it to the author:

### 1. Generate Configuration File

1. Visit the torrent upload page of the PT site you want to support
2. A green `[EASY-UPLOAD]Retrieve Site Config` button will appear in the bottom right corner
3. Click the button, and the script will automatically analyze the form elements on the page and generate a configuration
4. The configuration will be automatically copied to your clipboard

### 2. Submit Issue

1. Visit the project's [Issues page](https://github.com/techmovie/easy-upload/issues/new?template=new-site-support-request.yml)
2. Paste the content from your clipboard into the `Site Configuration` section of the Issue
3. Fill in other required information
4. Submit the Issue

## Cautions

- **PLEASE CHECK OVER YOUR TORRENT UPLOAD FOR ANY ERRORS, EASY UPLOAD IS NOT ALWAYS PERFECT FOR EVERY SITE**
- For now, transfer of music, MV and anime is not supported. The type info may not be automatically filled.
- Irrelevant pictures to screenshots may still be retained when reproduced from Chinese sites to international ones, though filtering work has been done. They need to be deleted manually.
- Most international sites require full MediaInfo data while even some official resources in Chinese sites fail to provide it. In this case, MediaInfo data needs a manual extraction.
- For the image loading strategy of ToTheGlory, wait and click the reproduce button only after the page fully loaded, otherwise resource info will be obtained partially.
- Because the type info in some Chinese upload pages is too confusing, it may not be successfully filled. Please feel free to start a new issue.

## CHANGELOG

[CHANGELOG](CHANGELOG.md)

## Todo

Please refer [Project plan](https://github.com/techmovie/easy-upload/projects)

I don't have access or upload permission to all sites, so any help, including testing and PR, would be greatly appreciated.

## Supported Sites

[SUPPORTED](SUPPORTED.md)

## Credits

## Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="20%"><a href="https://github.com/btguys"><img src="https://avatars.githubusercontent.com/u/18325797?v=4?s=75" width="75px;" alt="Yongjie"/><br /><sub><b>Yongjie</b></sub></a><br /><a href="https://github.com/techmovie/easy-upload/commits?author=btguys" title="Code">💻</a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/Purfview"><img src="https://avatars.githubusercontent.com/u/69023953?v=4?s=75" width="75px;" alt="Purfview"/><br /><sub><b>Purfview</b></sub></a><br /><a href="https://github.com/techmovie/easy-upload/commits?author=Purfview" title="Code">💻</a></td>
      <td align="center" valign="top" width="20%"><a href="http://weibo.com/mcj9"><img src="https://avatars.githubusercontent.com/u/22229456?v=4?s=75" width="75px;" alt="arvin"/><br /><sub><b>arvin</b></sub></a><br /><a href="https://github.com/techmovie/easy-upload/commits?author=ma3252788" title="Code">💻</a></td>
      <td align="center" valign="top" width="20%"><a href="https://luoyefe.com/"><img src="https://avatars.githubusercontent.com/u/11496663?v=4?s=75" width="75px;" alt="luoye"/><br /><sub><b>luoye</b></sub></a><br /><a href="https://github.com/techmovie/easy-upload/commits?author=luoye-fe" title="Code">💻</a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/sabersalv"><img src="https://avatars.githubusercontent.com/u/2525544?v=4?s=75" width="75px;" alt="Saber"/><br /><sub><b>Saber</b></sub></a><br /><a href="https://github.com/techmovie/easy-upload/commits?author=sabersalv" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="20%"><a href="https://github.com/scatking"><img src="https://avatars.githubusercontent.com/u/34273647?v=4?s=75" width="75px;" alt="scatking"/><br /><sub><b>scatking</b></sub></a><br /><a href="https://github.com/techmovie/easy-upload/commits?author=scatking" title="Code">💻</a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/kidgokugoku"><img src="https://avatars.githubusercontent.com/u/82298915?v=4?s=75" width="75px;" alt="kidgokugoku"/><br /><sub><b>kidgokugoku</b></sub></a><br /><a href="https://github.com/techmovie/easy-upload/commits?author=kidgokugoku" title="Code">💻</a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/LeiShi1313"><img src="https://avatars.githubusercontent.com/u/3712421?v=4?s=75" width="75px;" alt="Lei Shi"/><br /><sub><b>Lei Shi</b></sub></a><br /><a href="https://github.com/techmovie/easy-upload/commits?author=LeiShi1313" title="Code">💻</a></td>
      <td align="center" valign="top" width="20%"><a href="https://ted423.bitcron.com/"><img src="https://avatars.githubusercontent.com/u/7042766?v=4?s=75" width="75px;" alt="ted423"/><br /><sub><b>ted423</b></sub></a><br /><a href="https://github.com/techmovie/easy-upload/commits?author=ted423" title="Code">💻</a></td>
      <td align="center" valign="top" width="20%"><a href="http://about.me/ljy"><img src="https://avatars.githubusercontent.com/u/319494?v=4?s=75" width="75px;" alt="Adam Lau"/><br /><sub><b>Adam Lau</b></sub></a><br /><a href="https://github.com/techmovie/easy-upload/commits?author=we11adam" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="20%"><a href="https://github.com/fzlins"><img src="https://avatars.githubusercontent.com/u/100051558?v=4?s=75" width="75px;" alt="fzlins"/><br /><sub><b>fzlins</b></sub></a><br /><a href="https://github.com/techmovie/easy-upload/commits?author=fzlins" title="Code">💻</a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/LostRager"><img src="https://avatars.githubusercontent.com/u/5929772?v=4?s=75" width="75px;" alt="LostRager"/><br /><sub><b>LostRager</b></sub></a><br /><a href="https://github.com/techmovie/easy-upload/commits?author=LostRager" title="Code">💻</a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/KesaubeEire"><img src="https://avatars.githubusercontent.com/u/20382002?v=4?s=75" width="75px;" alt="KesaubeEire"/><br /><sub><b>KesaubeEire</b></sub></a><br /><a href="https://github.com/techmovie/easy-upload/commits?author=KesaubeEire" title="Code">💻</a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/jiang925"><img src="https://avatars.githubusercontent.com/u/6193639?v=4?s=75" width="75px;" alt="Tian J."/><br /><sub><b>Tian J.</b></sub></a><br /><a href="https://github.com/techmovie/easy-upload/commits?author=jiang925" title="Code">💻</a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/DDinghoya"><img src="https://avatars.githubusercontent.com/u/19677686?v=4?s=75" width="75px;" alt="DDinghoya"/><br /><sub><b>DDinghoya</b></sub></a><br /><a href="https://github.com/techmovie/easy-upload/commits?author=DDinghoya" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="20%"><a href="https://github.com/Griseo-bh3rd"><img src="https://avatars.githubusercontent.com/u/121101691?v=4?s=75" width="75px;" alt="【繁星】格蕾修"/><br /><sub><b>【繁星】格蕾修</b></sub></a><br /><a href="https://github.com/techmovie/easy-upload/commits?author=Griseo-bh3rd" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

## Donors

|  Name  |    Amount     |    Time    |
| :----: | :-----------: | :--------: |
| 韩老王 |      ¥30      | 2021/05/13 |
| \*\*特 |    ¥30.01     | 2021/05/27 |
| J\*\*e | 0.00055484BTC | 2021/06/05 |
|  西凉  |      ¥10      | 2021/07/22 |
