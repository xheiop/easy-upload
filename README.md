# easy-upload

[English Version](README-en.md)

[安装地址 1](https://greasyfork.org/zh-CN/scripts/423199) | [安装地址 2](https://github.com/techmovie/easy-upload/raw/master/dist/easy-upload.user.js) | [加入 Telegram 群组](https://t.me/+Ss_nJoAapvRhYTM1)

## 关于

支持国内外主流 PT 站的转载种子脚本，尽可能减少不必要的重复工作，让发种更易上手。

## Wiki

可以通过以下链接了解项目架构和使用指南等信息。

[Zread](https://zread.ai/techmovie/easy-upload)
[DeepWiki](https://deepwiki.com/techmovie/easy-upload)

## 兼容性

### [Tampermonkey](https://tampermonkey.net/) / [Violentmonkey](https://violentmonkey.github.io/)

完全兼容, 但在较旧的浏览器中 Violentmonkey 可能无法运行此脚本.

### ~~[Greasemonkey](https://www.greasespot.net/)~~

Greasemonkey 4 与以上两种脚本管理器的 API 严重不一致且只能在 Firefox 上运行，因此本脚本不做支持。强烈建议安装以上两种。

## 使用教程

[教程](https://github.com/techmovie/easy-upload/wiki/%E4%BD%BF%E7%94%A8%E6%95%99%E7%A8%8B)

## 功能

- 支持国内外不同架构的站点互转，自动填写简介、视频参数等信息
- 支持转载站点的自定义配置
- 支持批量转种，一键批量转发到选中的站点
- 一些站点规则要求截图必须为缩略图，增加了原图转缩略图功能
- 外站向内站转载时，需要补充豆瓣简介，增加了根据 IMDB 获取豆瓣简介的功能
- 可以通过站点的 yaml 统一配置来进行上传页的内容填写，新增支持站点更容易。如果需要自行添加目前项目还不支持的站点，可以参考[站点配置规则](https://github.com/techmovie/easy-upload/wiki/%E5%A6%82%E4%BD%95%E5%A2%9E%E5%8A%A0%E7%9B%AE%E5%89%8D%E8%BF%98%E4%B8%8D%E6%94%AF%E6%8C%81%E7%9A%84%E7%AB%99%E7%82%B9%E9%85%8D%E7%BD%AE)
- 支持对当前资源的快速检索，检索站点可配置
- 支持批量将截图转存至 ptpimg，可以解决部分站点截图无法在其他站点显示的问题
- NexusPHP 站点上传页增加获取豆瓣简介按钮，可以一键填写副标题和简介，可用于自己发种和外站转种
- 通过点击快速检索按钮，可以检测是否目标站有当前种子(目前仅支持 NexusPHP 站点)
- 支持清洗种子，并在转载到目标站点后自动附上清洗完后的种子文件，无需手动添加种子文件

  ![](https://ptpimg.me/4475d0.gif)

## 设置

- 点击「齿轮」图标打开设置面板
- 转种站点启用: 定义需要在页面显示的转种站点列表，隐藏无帐号及不需要的站点，默认显示全部。
- 批量转种启用: 点击页面的「一键群转」按钮将同时打开选中的站点转发。
- 站点搜索启用: 定义需要在页面显示的快速搜索列表。

## 如何生成脚本未支持新站点的配置文件

当你发现脚本不支持某个 PT 站点时,可以按照以下步骤生成配置文件并提交给作者:

### 1. 生成配置文件

1. 访问你想要支持的 PT 站点的种子上传页面
2. 在页面右下角会出现一个绿色的`[EASY-UPLOAD]获取页面配置`按钮
3. 点击该按钮,脚本会自动分析页面上的表单元素并生成配置文件
4. 配置文件会自动复制到你的剪贴板

### 2. 提交 Issue

1. 访问项目的 [Issues 页面](https://github.com/techmovie/easy-upload/issues/new?template=new-site-support-request-cn.yml)
2. 将剪贴板中的内容粘贴到 Issue 的`站点配置`内容框中
3. 填写其他必要信息
4. 提交 Issue

## 注意事项

- **任何情况下都不要完全依赖脚本，脚本不可能做到对每个站点都完美适配，发布前需要自己认真检查是否有填写错误或者不符合站点规则的地方**
- 目前对音乐、MV、动漫的种子转载不支持(分类可能不会自动填写)
- 内站的简介中会有一些跟视频截图无关的图片，虽然做了一些过滤，转载到外站后这些无关的图片可能仍会保留下来，需要手动删除。
- 大部分外站需要完整的 MediaInfo，而部分内站的官组都没提供，转载到外站时，需要手动获取 MediaInfo
- 由于 TTG 的图片加载策略，需要等页面完全加载完整后再点击转载到其他站，否则种子信息会获取不完整。
- 由于部分内站上传页的分类填写过于混乱，会有部分种子分类填写不上的问题，欢迎提 Issue

## CHANGELOG

[CHANGELOG](CHANGELOG.md)

## 后续计划

参考[项目规划](https://github.com/techmovie/easy-upload/projects)

很多站点由于没有账号或者发布权限，欢迎大佬帮忙测试以及提 PR

## 支持站点

[SUPPORTED](SUPPORTED.md)

## 致谢

### 协作者

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

### 捐赠者

|  姓名  |     金额      |    时间    |
| :----: | :-----------: | :--------: |
| 韩老王 |      ¥30      | 2021/05/13 |
| \*\*特 |    ¥30.01     | 2021/05/27 |
| J\*\*e | 0.00055484BTC | 2021/06/05 |
|  西凉  |      ¥10      | 2021/07/22 |
