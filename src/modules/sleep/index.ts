import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { Collection, HMRecord } from "../../core/storage";
import { createCard } from "../../ui/components/Card";
import { promptText } from "../../ui/components/modal-helpers";
import { renderHeatmap, dateKey } from "../../ui/components/Heatmap";

interface SleepDay extends HMRecord {
  date: string;
  hours: number;
}

class SleepChild extends BaseRenderChild {
  private days!: Collection<SleepDay>;

  onload(): void {
    this.days = this.ctx.storage.collection<SleepDay>("sleep/days");
    void this.days.refresh().then(() => this.draw());
    this.registerEvent(
      this.ctx.bus.on("storage:changed", (p) => {
        if (p.collection === "sleep/days") this.draw();
      })
    );
  }

  private draw(): void {
    this.containerEl.empty();
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "睡眠记录",
      icon: "moon",
      cls: "hm-sleep",
    });
    const all = this.days.all();
    const last7 = all
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7);
    const avg = last7.length ? last7.reduce((s, d) => s + d.hours, 0) / last7.length : 0;
    body.createDiv({ cls: "hm-muted", text: `近 7 天平均 ${avg.toFixed(1)} 小时` });

    const add = body.createEl("button", { cls: "mod-cta", text: "记录今晚睡眠" });
    add.onclick = () => this.add();

    const data: Record<string, number> = {};
    for (const d of all) data[d.date] = d.hours;
    renderHeatmap(body.createDiv(), data, { unit: " 小时", max: 10 });
  }

  private async add(): Promise<void> {
    const h = await promptText(this.ctx.app, "睡了几小时？", "8");
    if (!h) return;
    const today = dateKey(new Date());
    this.days.upsert({ id: today, date: today, hours: Number(h) || 0 } as SleepDay);
  }
}

export const sleepModule: HMModule = {
  id: "sleep",
  lang: "sleep",
  category: "habit",
  displayName: "睡眠记录",
  description: "每日睡眠时长 + 近 7 天平均 + 热力图。",
  premium: true,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new SleepChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 睡眠记录";
  },
};
