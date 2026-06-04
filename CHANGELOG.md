# 更新日志（Changelog）

本项目的所有重要变更都会记录在此文件中。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本（Semantic Versioning）](https://semver.org/lang/zh-CN/)。

## [未发布]

（暂无）

## [2.4.1] - 2026-06-03

### 新增（Added）
- 首次启动上手引导弹窗：新安装时自动弹出「3 步上手 + 一键生成主页」，命令面板搜索「上手引导」可随时重看；样式走 Obsidian 主题变量，深浅色自适应。

### 变更（Changed）
- manifest 合规化：补全 `author`/`authorUrl`，`description` 改为符合社区市场规范的英文（≤250 字符、句号结尾、无特殊字符），移除空的 `fundingUrl`，为上架官方社区市场做准备。
- 文档统一模块数为 30（修正 README 表格遗漏的 `overview`/`quote`）。

### 文档（Documentation）
- 新增英文 README（`README.en.md`）与中英语言切换。
- README 新增「功能速览」封面图墙。
- 新增 `docs/SUBMISSION.md`（社区市场提交手册 + 合规自查）、`docs/DEPLOY-ACTIVATION.md`（激活后端部署）、`docs/SELLING-SOP.md`（收款发货 SOP）。
- 新增 `LICENSE`、`CHANGELOG.md`、`CONTRIBUTING.md`、Issue/PR 模板。

## [2.4.0] - 2026-06-03

### 新增（Added）
- 全新发布 Homepage Modules，内置 30 个主页模块。
- 背单词模块内置 1.4 万词词库。
- 错词本：自动收集背单词过程中答错的单词，便于针对性复习。
- AI 多服务商支持：可接入多个 AI 服务提供商。
- 发布脚本：用于打包与发布插件版本。
- 词库自动下载缓存：当本地缺失完整词库时，从 GitHub Release 自动下载并缓存，
  使通过 BRAT 安装的用户也能直接使用完整的 1.4 万词词库。

### 文档（Documentation）
- README 顶部新增演示 GIF 与 BRAT 安装步骤，让新用户可在约 30 秒内完成安装上手。

[未发布]: https://github.com/lv-g-eng/obsidian-homepage-modules/compare/2.4.1...HEAD
[2.4.1]: https://github.com/lv-g-eng/obsidian-homepage-modules/compare/2.4.0...2.4.1
[2.4.0]: https://github.com/lv-g-eng/obsidian-homepage-modules/releases/tag/2.4.0
