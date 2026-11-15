# 贡献指南

[English](CONTRIBUTING-en.md)

欢迎提交 Bug 修复、新功能和新站点支持。

## 新增支持站点

本项目不再接受「请求支持新站点」的 Issue，只接受**自己在站点上实际测试过**的 PR。站点配置可以交给 AI 编程工具生成（Claude Code、Codex、Cursor、GitHub Copilot、Gemini CLI 等都可以），流程如下。

### 准备

- 在该站点有账号，能打开种子上传页面
- 浏览器装有 Tampermonkey 或 Violentmonkey，并安装了最新版 easy-upload
- Node.js 20 及以上，Yarn（执行 `corepack enable` 即可）
- fork 并克隆本仓库，在仓库目录执行 `yarn install`

### 1. 获取页面的原始配置

1. 打开站点的种子上传页面
2. 点击页面右下角绿色的 `[EASY-UPLOAD]获取页面配置` 按钮，原始配置会复制到剪贴板
3. 把剪贴板内容保存到仓库根目录的 `<站点名>.raw.yaml`。`*.raw.yaml` 已被 git 忽略，不会被误提交

原始配置只记录表单字段的名称、选择器、下拉选项和标签，不包含 passkey、隐藏字段的值等账号信息。

> 按钮只在脚本还不能作为转种目标的站点、且地址包含 `upload` 或 `/torrents/create` 的页面上出现。如果上传页的地址不在 `vite.config.js` 的 `match` 规则里，脚本不会运行，需要先补一条规则。

### 2. 用 AI 生成站点配置

在仓库目录打开你的 AI 编程工具，发送类似下面的提示词：

```text
按照 scripts/site-config/rules.md，根据 <站点名>.raw.yaml 生成 src/config/<站点名>.yaml，用 yarn site-config 校验并修复所有错误。
```

- 仓库带有 `site-config` skill（Agent Skills 格式，位于 `.agents/skills/site-config/`），Codex、GitHub Copilot、Cursor、Gemini CLI 会自动加载，Claude Code 通过软链接 `.claude/skills/site-config` 加载；读取 `AGENTS.md` 的工具也能找到这份规则。其他工具先让它读 `scripts/site-config/rules.md` 即可
- 站点名会成为界面上显示、用户设置里保存的站点 key，之后很难修改。请参考 `src/config/` 里已有的命名，例如 `HDHome`、`PTer`、`qingwa`
- 不用 AI 也可以，按 `scripts/site-config/rules.md` 手写

### 3. 校验

```bash
yarn site-config --raw <站点名>.raw.yaml --name <站点名>
```

校验会检查配置里的选择器和下拉框取值是否都能在原始配置里找到，自动获取站点图标，并写回 `src/config/<站点名>.yaml`。所有 `✗` 错误都必须修复；`!` 警告和配置里的 `# TODO` 注释需要逐条确认。

### 4. 在真实站点上测试

1. 执行 `yarn dev`，安装开发版脚本：macOS 和 Windows 上浏览器会自动打开安装页，其他系统按终端输出的地址打开。测试期间在脚本管理器里停用正式版 easy-upload，避免两个脚本同时运行
2. 在 easy-upload 设置面板的「转种站点启用」里勾选新站点
3. 打开一个已支持站点的种子详情页，点击转载到新站点
4. 逐项检查上传页：标题、副标题、简介、IMDb/豆瓣链接、MediaInfo、种子文件，以及类型、媒介、编码、音频编码、分辨率、地区、制作组、匿名和标签
5. 至少测试一部电影和一部剧集；站点有 4K、原盘、Remux 等分类的，也用对应的资源测一下
6. 不需要真的发布。发现填错就修改配置，开发版脚本会自动更新，刷新页面后重新测试，最后再执行一次第 3 步

### 5. 提交 PR

1. 提交 `src/config/<站点名>.yaml`，以及确实需要的其他改动（`vite.config.js` 的 `match` 规则、自定义的 filler/extractor 等）。可以执行 `yarn support` 更新 `SUPPORTED.md`
2. 不要提交 `dist/easy-upload.user.js`，`yarn build` 会改写它
3. 提交信息使用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 格式，例如 `feat(config): add <站点名> site config`
4. 按 PR 模板填写：测试过的资源、上传页填写结果的截图，以及原始配置（方便维护者复核）

没有测试记录的新站点 PR 不会被合并。

## 其他贡献

- Bug 反馈和功能建议请使用 Issue 模板
- 提交代码前请执行 `yarn lint` 和 `yarn test --run`
- 项目结构和常用命令见 [AGENTS.md](AGENTS.md)
