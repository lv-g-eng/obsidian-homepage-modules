# 贡献指南

感谢你愿意为 Homepage Modules 贡献代码或想法！本指南帮助你快速上手。

## 本地开发与加载

1. 克隆仓库到本地，安装依赖：

   ```bash
   npm install
   ```

2. 启动开发模式（自动监听并增量构建，详见 README 的开发说明）：

   ```bash
   npm run dev
   ```

3. 将本仓库放入（或软链接到）你的测试库的
   `<你的库>/.obsidian/plugins/obsidian-homepage-modules/` 目录下，
   在 Obsidian 的「设置 → 第三方插件」中启用，即可加载本地构建产物进行调试。
   修改源码后重新加载 Obsidian（或使用热重载工具）即可看到效果。

## 提交 Pull Request 前

请确保以下命令在本地均运行通过：

```bash
npx tsc -noEmit -skipLibCheck   # 类型检查
npm run build                   # 构建
node smoke-test.cjs             # 冒烟测试
```

并在 Obsidian 中实际加载、冒烟验证你改动涉及的模块。

提交 PR 时请按 PR 模板填写变更说明、关联 Issue、测试方式，并勾选自检清单。

## 提 Issue

- Bug 报告与功能建议请使用对应的 Issue 模板。
- Bug 报告请尽量附上 Obsidian 版本、操作系统、复现步骤与控制台报错。

## 许可证

本项目采用「源码可见但禁止再分发 / 转售」的专有许可证
（Source-Available License v1.0，详见 [LICENSE](./LICENSE)）。

**提交贡献即表示你同意：你的贡献将按本仓库的许可证授权，
并且你拥有提交该贡献所需的权利。**
