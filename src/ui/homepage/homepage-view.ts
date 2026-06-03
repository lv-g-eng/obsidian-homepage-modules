import {
  ItemView,
  WorkspaceLeaf,
  Notice,
  MarkdownView,
  MarkdownRenderChild,
  setIcon,
} from "obsidian";
import { ModuleContext, ModuleCategory } from "../../core/module";
import { ModuleRegistry } from "../../core/module-registry";
import { SettingsStore } from "../../core/settings";
import { generateToolkitHomepage } from "./toolkit-generator";
import { renderHomepageGrid } from "./grid-engine";

export const HOMEPAGE_VIEW_TYPE = "hm-homepage-view";
const PANEL_INSTANCE = "panel";

const CATEGORY_LABEL: Record<ModuleCategory, string> = {
  productivity: "效率",
  habit: "习惯健康",
  learning: "学习记忆",
  ai: "AI",
  finance: "财务",
  dashboard: "仪表盘",
  utility: "工具",
};

/**
 * 侧边「主页」标签页：直接渲染可拖拽/缩放的模块仪表盘，并提供
 * 一键生成主页 + 可折叠的模块目录（启用开关 / 插入到当前笔记）。
 */
export class HomepageView extends ItemView {
  private rendered: MarkdownRenderChild[] = [];
  private showCatalog = false;

  constructor(
    leaf: WorkspaceLeaf,
    private ctx: ModuleContext,
    private registry: ModuleRegistry,
    private settings: SettingsStore
  ) {
    super(leaf);
  }

  getViewType(): string {
    return HOMEPAGE_VIEW_TYPE;
  }
  getDisplayText(): string {
    return "Homepage Modules";
  }
  getIcon(): string {
    return "layout-dashboard";
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  async onClose(): Promise<void> {
    this.clearChildren();
  }

  private clearChildren(): void {
    for (const c of this.rendered) this.removeChild(c);
    this.rendered = [];
  }

  private render(): void {
    this.clearChildren();
    const root = this.contentEl;
    root.empty();
    root.addClass("hm-panel");

    const head = root.createDiv({ cls: "hm-panel-head" });
    head.createEl("h2", { text: "Homepage Modules" });
    head.createDiv({ cls: "hm-muted", text: this.licenseLine() });

    const bar = root.createDiv({ cls: "hm-panel-bar" });
    const gen = bar.createEl("button", { cls: "mod-cta", text: "一键生成主页笔记" });
    gen.onclick = () =>
      generateToolkitHomepage(this.app, this.ctx, this.registry, this.settings);
    const toggle = bar.createEl("button", {
      text: this.showCatalog ? "收起模块目录" : "管理模块",
    });
    toggle.onclick = () => {
      this.showCatalog = !this.showCatalog;
      this.render();
    };

    if (this.showCatalog) {
      this.renderCatalog(root);
      return;
    }

    // 真正的仪表盘：渲染启用的模块，支持拖拽 + 缩放
    renderHomepageGrid(
      root,
      (child) => {
        this.addChild(child);
        this.rendered.push(child);
      },
      this.ctx,
      this.registry,
      this.settings,
      PANEL_INSTANCE,
      null
    );
  }

  private renderCatalog(root: HTMLElement): void {
    const byCat = new Map<ModuleCategory, typeof this.registry.all>();
    for (const m of this.registry.all) {
      const arr = byCat.get(m.category) ?? [];
      arr.push(m);
      byCat.set(m.category, arr);
    }
    for (const [cat, mods] of byCat) {
      root.createEl("h3", { text: CATEGORY_LABEL[cat] ?? cat });
      const list = root.createDiv({ cls: "hm-module-list" });
      for (const m of mods) {
        const row = list.createDiv({ cls: "hm-module-row" });
        const left = row.createDiv({ cls: "hm-module-meta" });
        left.createSpan({ cls: "hm-module-name", text: m.displayName });
        if (m.premium) left.createSpan({ cls: "hm-badge", text: "PRO" });
        if (m.desktopOnly) left.createSpan({ cls: "hm-badge", text: "桌面" });
        if (m.description)
          row.createDiv({ cls: "hm-muted hm-module-desc", text: m.description });

        const actions = row.createDiv({ cls: "hm-module-actions" });
        // 启用开关
        const enabled = this.settings.isModuleEnabled(m.id);
        const en = actions.createEl("button", {
          text: enabled ? "已启用" : "已关闭",
          cls: enabled ? "hm-active" : "",
        });
        en.onclick = async () => {
          this.settings.data.moduleEnabled[m.id] = !enabled;
          await this.settings.save();
          this.render();
        };
        const insert = actions.createEl("button");
        setIcon(insert.createSpan(), "plus");
        insert.appendText("插入");
        insert.onclick = () => this.insertBlock(m.lang, m.defaultBlock?.() ?? "");
      }
    }
  }

  private licenseLine(): string {
    const l = this.ctx.license;
    if (l.status === "active") return "已激活";
    if (l.status === "trial") return `试用剩余 ${l.trialDaysLeft()} 天`;
    if (l.status === "expired") return "试用已结束";
    return "未激活（付费模块锁定）";
  }

  private insertBlock(lang: string, body: string): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      new Notice("请先打开一篇笔记");
      return;
    }
    const block = "```" + lang + "\n" + (body ? body + "\n" : "") + "```\n";
    view.editor.replaceSelection(block);
    new Notice(`已插入 ${lang} 代码块`);
  }
}
