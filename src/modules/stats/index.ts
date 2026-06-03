import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { createCard } from "../../ui/components/Card";

class StatsChild extends BaseRenderChild {
  onload(): void {
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "库统计",
      icon: "bar-chart-3",
      cls: "hm-stats",
    });
    const md = this.ctx.app.vault.getMarkdownFiles();
    const all = this.ctx.app.vault.getFiles();
    const grid = body.createDiv({ cls: "hm-stats-grid" });

    const stat = (label: string, value: string) => {
      const cell = grid.createDiv({ cls: "hm-stat-cell" });
      cell.createDiv({ cls: "hm-stat-value", text: value });
      cell.createDiv({ cls: "hm-stat-label hm-muted", text: label });
    };
    stat("笔记数", String(md.length));
    stat("总文件", String(all.length));

    // 近 7 天新建笔记
    const weekAgo = Date.now() - 7 * 86400000;
    const recent = md.filter((f) => f.stat.ctime >= weekAgo).length;
    stat("近 7 天新建", String(recent));

    // 总附件大小（MB）
    const totalBytes = all.reduce((s, f) => s + (f.stat.size || 0), 0);
    stat("库大小", `${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
  }
}

export const statsModule: HMModule = {
  id: "stats",
  lang: "stats",
  category: "dashboard",
  displayName: "库统计",
  description: "笔记数、文件数、近 7 天新建、库大小。",
  premium: false,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new StatsChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 库统计";
  },
};
