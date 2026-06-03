import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { genId } from "../../core/util";
import { Collection, HMRecord } from "../../core/storage";
import { createCard } from "../../ui/components/Card";
import { promptText } from "../../ui/components/modal-helpers";

interface Event extends HMRecord {
  name: string;
  date: string; // YYYY-MM-DD
}

function daysUntil(date: string): number {
  const target = new Date(date + "T00:00:00").getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / 86400000);
}

class CountdownChild extends BaseRenderChild {
  private items!: Collection<Event>;

  onload(): void {
    this.items = this.ctx.storage.collection<Event>("countdown/items");
    void this.items.refresh().then(() => this.draw());
    this.registerEvent(
      this.ctx.bus.on("storage:changed", (p) => {
        if (p.collection === "countdown/items") this.draw();
      })
    );
  }

  private draw(): void {
    this.containerEl.empty();
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "倒计时",
      icon: "hourglass",
      cls: "hm-countdown",
    });
    const list = body.createDiv({ cls: "hm-cd-list" });
    const items = this.items.all().sort((a, b) => daysUntil(a.date) - daysUntil(b.date));
    for (const it of items) {
      const row = list.createDiv({ cls: "hm-cd-row" });
      row.createSpan({ cls: "hm-cd-name", text: it.name });
      const d = daysUntil(it.date);
      const tag = row.createSpan({ cls: "hm-cd-days" });
      tag.setText(d === 0 ? "今天" : d > 0 ? `还有 ${d} 天` : `已过 ${-d} 天`);
      if (d < 0) tag.addClass("hm-muted");
      const del = row.createEl("button", { cls: "hm-icon-btn", text: "🗑" });
      del.onclick = () => this.items.remove(it.id);
    }
    const add = body.createEl("button", { cls: "hm-todo-add", text: "+ 事件" });
    add.onclick = () => this.add();
  }

  private async add(): Promise<void> {
    const name = await promptText(this.ctx.app, "事件名称", "");
    if (!name) return;
    const date = await promptText(this.ctx.app, "日期 (YYYY-MM-DD)", "");
    if (!date) return;
    this.items.upsert({ id: genId(), name, date });
  }
}

export const countdownModule: HMModule = {
  id: "countdown",
  lang: "countdown",
  category: "productivity",
  displayName: "倒计时",
  description: "重要日子倒数。免费模块。",
  premium: false,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new CountdownChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 倒计时";
  },
};
