<!--
新增站点请先阅读 CONTRIBUTING.md。没有测试记录的新站点 PR 不会被合并。
Adding a site? Read CONTRIBUTING-en.md first. New-site PRs without a test record will not be merged.
-->

## 改动 / Changes



## 新增站点 / New site

<!-- 不是新增站点的 PR 请删除这一节 / Delete this section if the PR does not add a site -->

- 站点 / Site:
- 架构 / Engine: NexusPHP / UNIT3D / Gazelle / Other

- [ ] 已用开发版脚本在真实上传页上测试 / Tested on the real upload page with the development build
- [ ] `yarn site-config --raw <file> --name <Name>` 没有 ✗ 错误 / reports no ✗ errors
- [ ] 没有提交 `dist/easy-upload.user.js` / `dist/easy-upload.user.js` is not committed

测试过的资源 / Torrents tested with (e.g. movie 1080p Blu-ray encode, TV pack WEB-DL):

-

上传页填写结果截图 / Screenshots of the filled upload form:

<details>
<summary>原始配置 / Raw config</summary>

```yaml
# 粘贴「获取页面配置」按钮的输出 / Paste the output of the "Export page config" button
```

</details>

## 检查 / Checks

- [ ] `yarn lint`
- [ ] `yarn test --run`
