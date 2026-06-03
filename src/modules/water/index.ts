import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { Collection, HMRecord } from "../../core/storage";
import { createCard } from "../../ui/components/Card";
import { renderHeatmap, dateKey } from "../../ui/components/Heatmap";

interface WaterDay extends HMRecord {
  date: string;
  cups: number;
}

class WaterChild extends BaseRenderChild {
  private days!: Collection<WaterDay>;
  private get target(): number {
    return Number(this.params.target) || 8;
  }

  onload(): void {
    this.days = this.ctx.storage.collection<WaterDay>("water/days");
    void this.days.refresh().then(() => this.draw());
    this.registerEvent(
      this.ctx.bus.on("storage:changed", (p) => {
        if (p.collection === "water/days") this.draw();
      })
    );
  }

  private draw(): void {
    this.containerEl.empty();
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "喝水打卡",
      icon: "cup-soda",
      cls: "hm-water",
    });
    const today = dateKey(new Date());
    const rec = this.days.get(today);
    const cups = rec?.cups ?? 0;

    const row = body.createDiv({ cls: "hm-water-row" });
    row.createSpan({ cls: "hm-water-count", text: `${cups} / ${this.target} 杯` });
    const minus = row.createEl("button", { text: "－" });
    minus.onclick = () => this.set(today, Math.max(0, cups - 1));
    const plus = row.createEl("button", { cls: "mod-cta", text: "＋ 一杯" });
    plus.onclick = () => this.set(today, cups + 1);

    const data: Record<string, number> = {};
    for (const d of this.days.all()) data[d.date] = d.cups;
    renderHeatmap(body.createDiv(), data, { unit: " 杯", max: this.target });
  }

  private set(date: string, cups: number): void {
    this.days.upsert({ id: date, date, cups } as WaterDay);
  }
}

export const waterModule: HMModule = {
  id: "water",
  lang: "water",
  category: "habit",
  displayName: "喝水打卡",
  description: "每日喝水计数 + 全年热力图。block 可写 target: 8",
  premium: true,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new WaterChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 喝水打卡\ntarget: 8";
  },
};
