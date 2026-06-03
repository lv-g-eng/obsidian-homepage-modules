import { App, Notice, TFile } from "obsidian";
import { ModuleContext } from "../../core/module";
import { ModuleRegistry } from "../../core/module-registry";
import { SettingsStore } from "../../core/settings";

/**
 * 一键生成工具箱主页：创建一篇 Homepage.md，内含一个 homepage 代码块，
 * 自动罗列所有已启用 + 已授权的模块，然后打开它。
 */
export async function generateToolkitHomepage(
  app: App,
  ctx: ModuleContext,
  registry: ModuleRegistry,
  settings: SettingsStore
): Promise<void> {
  const ids = registry.all
    .filter((m) => settings.isModuleEnabled(m.id))
    .filter((m) => !m.premium || ctx.license.unlocked)
    .map((m) => m.id);

  const content = [
    "# 我的工具箱主页",
    "",
    "> 由 Homepage Modules 生成。拖拽卡片可重排，Ctrl+滚轮缩放。",
    "",
    "```homepage",
    "id: main",
    `modules: ${ids.join(", ")}`,
    "```",
    "",
  ].join("\n");

  let path = "Homepage.md";
  let i = 1;
  while (app.vault.getAbstractFileByPath(path)) {
    path = `Homepage ${++i}.md`;
  }

  const file = (await app.vault.create(path, content)) as TFile;
  await app.workspace.getLeaf(true).openFile(file);
  new Notice(`已生成主页：${path}`);
}
