import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { genId } from "../../core/util";
import { Collection, HMRecord } from "../../core/storage";
import { createCard } from "../../ui/components/Card";
import { promptText } from "../../ui/components/modal-helpers";
import { dateKey } from "../../ui/components/Heatmap";

interface Block extends HMRecord {
  date: string;
  start: string; // HH:MM
  end: string;
  label: string;
}

class TimeblockChild extends BaseRenderChild {
  private blocks!: Collection<Block>;

  onload(): void {
    this.blocks = this.ctx.storage.collection<Block>("timeblock/blocks");
    void this.blocks.refresh().then(() => this.draw());
    this.registerEvent(
      this.ctx.bus.on("storage:changed", (p) => {
        if (p.collection === "timeblock/blocks") this.draw();
      })
    );
  }

  private draw(): void {
    this.containerEl.empty();
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "时间块",
      icon: "calendar-clock",
      cls: "hm-timeblock",
    });
    const today = dateKey(new Date());
    const todayBlocks = this.blocks
      .all()
      .filter((b) => b.date === today)
      .sort((a, b) => a.start.localeCompare(b.start));

    if (todayBlocks.length === 0) {
      body.createDiv({ cls: "hm-muted", text: "今天还没有时间块。" });
    }
    const list = body.createDiv({ cls: "hm-tb-list" });
    for (const b of todayBlocks) {
      const row = list.createDiv({ cls: "hm-tb-row" });
      row.createSpan({ cls: "hm-tb-time", text: `${b.start}–${b.end}` });
      row.createSpan({ cls: "hm-tb-label", text: b.label });
      const del = row.createEl("button", { cls: "hm-icon-btn", text: "🗑" });
      del.onclick = () => this.blocks.remove(b.id);
    }
    const add = body.createEl("button", { cls: "mod-cta", text: "+ 时间块" });
    add.onclick = () => this.add(today);
  }

  private async add(today: string): Promise<void> {
    const start = await promptText(this.ctx.app, "开始 HH:MM", "09:00");
    if (!start) return;
    const end = await promptText(this.ctx.app, "结束 HH:MM", "10:00");
    if (!end) return;
    const label = await promptText(this.ctx.app, "做什么", "");
    if (!label) return;
    this.blocks.upsert({ id: genId(), date: today, start, end, label });
  }
}

export const timeblockModule: HMModule = {
  id: "timeblock",
  lang: "timeblock",
  category: "productivity",
  displayName: "时间块",
  description: "今日时间块规划。",
  premium: true,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new TimeblockChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 时间块";
  },
};
