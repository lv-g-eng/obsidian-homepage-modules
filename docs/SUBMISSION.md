# 提交到 Obsidian 社区插件市场 —— 操作手册 + 合规自查

> 本文依据官方文档实时核对（截至 2026-06）：
> - Submit your plugin: https://docs.obsidian.md/Plugins/Releases/Submit+your+plugin
> - Submission requirements: https://docs.obsidian.md/Plugins/Releases/Submission+requirements+for+plugins
> - Plugin guidelines: https://docs.obsidian.md/Plugins/Releases/Plugin+guidelines
> - Developer policies: https://docs.obsidian.md/Developer+policies
> - obsidian-releases 仓库: https://github.com/obsidianmd/obsidian-releases

---

## 0. 重要变更：提交入口已迁移

官方现在的**主流程**是通过 **[community.obsidian.md](https://community.obsidian.md)** 网页提交（用 Obsidian 账号登录 → 绑定 GitHub → 填仓库 URL → 自动审核），**不再要求手动 fork `obsidian-releases` 并改 `community-plugins.json` 提 PR**。

不过 `obsidian-releases` 的 PR 流程在历史上长期有效，且本任务要求给出可直接复制的 `community-plugins.json` 条目，因此下文 **两条路径都给**：

- **路径 A（推荐 / 官方现行）**：community.obsidian.md 网页提交。
- **路径 B（PR 流程）**：fork obsidian-releases → 改 community-plugins.json → 提 PR。

两条路径的**前置条件完全一样**（GitHub Release + 根目录 manifest.json + 合规），先把第 1~2 节准备好再走任一路径。

---

## 1. 提交前置条件（两条路径共用）

仓库根目录必须有：

- ✅ `README.md` —— 说明插件用途和用法（本仓库已有中英双语）。
- ✅ `LICENSE` —— 决定他人如何使用（本仓库已有，注意见 §4 风险项）。
- ⚠️ `manifest.json` —— 字段必须完整且准确（**当前有空字段，见 §4，必须先补全**）。

并且必须有一个 **GitHub Release**：

- Tag 必须等于 `manifest.json` 里的 `version`（如 `2.4.0`，**不带 `v` 前缀**，纯 `x.y.z` semver）。
- Release 资产里**单独上传** `main.js`、`manifest.json`（可选 `styles.css`）作为二进制附件 —— 不能只靠源码 zip。
- 安装时 Obsidian 从「tag == manifest.version」的那个 Release 下载这三个文件。

> 注意：本插件的完整词库 `wordbank-full.json`（约 1.4 万词）首次使用时从 Release 下载缓存。**务必把 `wordbank-full.json` 也作为附件上传到该 Release**，否则 BRAT/正式用户首次加载词库会 404。

---

## 2. 创建 Release（共用）

```bash
# 1) 确认 manifest.json version 已更新为目标 semver，例如 2.4.0
# 2) 构建产物
npm run build          # 产出 main.js
# 3) 在 GitHub 上创建 Release，Tag 填 2.4.0（与 manifest.version 完全一致）
#    上传附件：main.js、manifest.json、styles.css、wordbank-full.json
```

可用 gh CLI：

```bash
gh release create 2.4.0 main.js manifest.json styles.css wordbank-full.json \
  --title "Homepage Modules 2.4.0" \
  --notes "30 modules; 14k-word vocabulary bank; multi-provider AI."
```

---

## 3. 提交流程

### 路径 A —— community.obsidian.md（官方现行，推荐）

1. 打开 https://community.obsidian.md ，用 **Obsidian 账号**登录。
2. 在 profile 里**绑定 GitHub 账号**（用于验证你拥有该仓库）。
3. 侧边栏 **Plugins → New plugin**。
4. 填仓库 URL：`https://github.com/lv-g-eng/obsidian-homepage-modules`
5. 阅读并同意 **Developer policies**，确认你会持续维护。
6. **Submit**。系统读取你**默认分支 HEAD** 上的 `manifest.json`（所以提交前确保它已 commit 且准确），并自动审核。
7. 自动审核给出需整改的提示 → 修仓库 + 发一个**递增版本号**的新 Release → 直到自动审核通过即可被安装。

> `id` 必须全局唯一、且**不能包含 `obsidian`**。本插件 id 为 `homepage-modules`，合规。

### 路径 B —— obsidian-releases PR 流程

1. Fork https://github.com/obsidianmd/obsidian-releases 。
2. 编辑根目录 `community-plugins.json`，在**数组末尾**（最后一个 `}` 后加逗号）追加下面的条目。
3. 提交 PR 到 `obsidianmd/obsidian-releases`，PR 描述用 §5 的英文文案。
4. 等待 **审核机器人**（自动检查 manifest 字段、Release 资产、id 唯一性、是否含 `obsidian` 等）+ **人工 review**（对照 Plugin guidelines / Developer policies）。机器人会在 PR 里留言指出问题，逐条修掉再 push。

#### 可直接复制的 `community-plugins.json` 条目

> 字段说明：description 必须 ≤250 字符、以英文句号结尾、不含 emoji/特殊字符、首字母动作短语。**manifest 里现有的中文 description 不符合目录规范**，下面这条用了重写后的英文版（建议同时把 manifest.json 的 description 也换成它）。

```json
  {
    "id": "homepage-modules",
    "name": "Homepage Modules",
    "author": "lv-g-eng",
    "description": "Build a modular dashboard homepage from single code blocks: todo board, pomodoro, habit tracker, FSRS vocabulary, AI assistant, ledger, calendar and more. All data stays local.",
    "repo": "lv-g-eng/obsidian-homepage-modules"
  }
```

（追加时记得在它前面那一项的 `}` 后补一个逗号。）

---

## 4. 合规自查清单（逐条对照官方，含本仓库实测结论）

| # | 检查项 | 结论 | 说明 / 整改建议 |
|---|--------|------|------------------|
| 1 | `isDesktopOnly` 正确性 | ✅ | 全仓库 **未使用** Node/Electron API（无 `fs/os/path/crypto/child_process/electron` import）；AI 移动端走 `requestUrl`，加密走 Web Crypto。`isDesktopOnly: false` 正确，且 README 宣称双端可用。 |
| 2 | 用 `const/let`，不泄漏全局 | ✅ | 未发现 `var` 声明。仅 `pomodoro/engine.ts` 有两处 `window as ...` **只读**访问 `webkitAudioContext`，不是写全局，合规。无 `window.x = ...` / `globalThis` 赋值。 |
| 3 | `onunload` 清理资源 | ✅ | `main.ts onunload` 调 `storage.dispose()`；模块 `onunload` 由 `module-registry` 通过 `this.plugin.register(...)` 自动清理。定时器全部走 `registerInterval`（`pomodoro/engine.ts`、`pomodoro/view.ts`）或组件级 `this.register(() => clearInterval(id))`（`core/module.ts`），随卸载自动回收。 |
| 4 | 不在 `onunload` 里 detach leaves | ✅ | `onunload` 内**没有** `detachLeavesOfType` / `leaf.detach()`，符合「Don't detach leaves in onunload」。 |
| 5 | 避免 `innerHTML`/`outerHTML`/`insertAdjacentHTML` 注入 | ✅ | 全仓库 **0 处** `innerHTML`/`outerHTML`/`insertAdjacentHTML`，全部用 `createEl`/DOM API 构建。合规。 |
| 6 | 不硬编码 vault 路径 | ✅ | 词库路径用 `plugin.manifest.dir ?? ${app.vault.configDir}/plugins/${plugin.manifest.id}`（`vocab/wordbank-loader.ts`），无 `C:\`/`/Users/` 等硬编码。README 里的 `C:/TestVault` 仅是开发文档示例，不在运行代码里。 |
| 7 | manifest 字段齐全 | ❌ | **`author`、`authorUrl` 为空字符串**，`author` 必填、`authorUrl` 强烈建议。**提交前必须补全**（见下方整改）。`id/name/version/minAppVersion/description/isDesktopOnly` 已有。 |
| 8 | `fundingUrl` | ⚠️ | 当前为 `""`（空）。官方规则：**不接受捐赠就删掉该字段**；接受就填真实链接（Buy Me A Coffee / GitHub Sponsors）。空字符串两不沾，须二选一。 |
| 9 | description 规范 | ⚠️ | 当前是中文、119 字符、**不以句号结尾**、含分隔符。官方要求 ≤250 字符、英文句号结尾、无 emoji/特殊字符、动作短语开头。建议替换成 §3 路径 B 里那条英文 description。 |
| 10 | 版本号 semver | ✅ | `2.4.0`，纯 `x.y.z`；`versions.json` 各版本映射 `minAppVersion` 齐全。 |
| 11 | LICENSE 存在 | ✅（⚠️风险） | 根目录有 `LICENSE`，但为**"Source-Available License v1.0 / All rights reserved"**（付费、非 OSI 开源）。官方只要求"有 LICENSE 文件"，不强制开源，故**形式上合规**；但付费 / 闭源授权可能引起人工 review 额外关注，且需自行承诺持续维护。建议在 PR/提交说明里**主动说明商业模式**避免被误判。 |
| 12 | 不含示例代码 / 占位类名 | ✅（建议抽查） | 未见 `MyPlugin`/`SampleSettingTab` 占位类。提交前可再 grep 一遍确认无 sample 残留。 |
| 13 | 不设默认快捷键 | ✅ | `addCommand` 均未带 `hotkeys`，符合「Avoid setting a default hotkey」。 |
| 14 | 不用全局 `app` | ✅ | 代码通过 `this.app` / 传参 `app` 使用，未发现 `window.app`。 |
| 15 | UI 文案 sentence case / setHeading | ⚠️（建议自查） | 本表未逐一核对所有设置项文案大小写。提交前建议过一遍 Setting 标题，确保用 sentence case，且分节用 `.setHeading()` 而非 `<h1>/<h2>`。 |

### 必须整改项（阻塞提交）

1. **补全 `manifest.json`**（# 7）：
   ```json
   "author": "lv-g-eng",
   "authorUrl": "https://github.com/lv-g-eng",
   ```
2. **处理 `fundingUrl`**（# 8）：接受赞助就填真实 URL；否则从 manifest 删除该字段。
3. **重写 description**（# 9）：建议替换为
   ```
   Build a modular dashboard homepage from single code blocks: todo board, pomodoro, habit tracker, FSRS vocabulary, AI assistant, ledger, calendar and more. All data stays local.
   ```

> 这三项改完后，记得**重新发一个 Release**（tag 与新 version 一致）再提交，否则目录拿到的仍是旧 manifest。

### 建议整改项（不阻塞，但影响人工 review）

- LICENSE 为付费/闭源（# 11）：在提交说明里主动说明商业模式与维护承诺。
- 抽查 UI 文案大小写与 `setHeading`（# 15）。
- 确认 `wordbank-full.json` 已上传到 Release（否则词库首次加载失败）。

---

## 5. 可直接用作 PR / 提交说明的英文文案

```
# Add plugin: Homepage Modules

Homepage Modules turns an Obsidian note into a modular dashboard. Each of the
30 modules works from a single fenced code block — todo board, pomodoro,
habit tracker, FSRS-based vocabulary, an OpenAI-compatible AI assistant,
ledger, calendar, weather and more — and the homepage supports drag-and-drop
layout, theme-aware styling, and Ctrl+scroll zoom. All data is stored locally.

- Repo: https://github.com/lv-g-eng/obsidian-homepage-modules
- ID: homepage-modules
- Desktop and mobile (isDesktopOnly: false; no Node/Electron APIs, uses
  requestUrl and the Web Crypto API).

Compliance notes:
- No innerHTML/outerHTML/insertAdjacentHTML; the DOM is built with createEl()
  and Obsidian helpers.
- All intervals are registered via registerInterval()/Component.register(),
  so they are cleaned up on unload. onunload does not detach leaves.
- No default hotkeys; commands use the appropriate callback types.
- The manifest ships a complete set of fields, semver versioning, and a
  matching GitHub release that bundles main.js, manifest.json and styles.css.

This plugin is source-available and offers a paid license with a 7-day free
trial; four modules (clock, links, countdown, random) are always free. I
commit to maintaining and supporting it going forward.
```
