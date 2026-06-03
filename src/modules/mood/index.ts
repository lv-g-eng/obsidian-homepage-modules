import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { Collection, HMRecord } from "../../core/storage";
import { createCard } from "../../ui/components/Card";
import { renderHeatmap, dateKey } from "../../ui/components/Heatmap";

interface MoodDay extends HMRecord {
  date: string;
  score: number; // 1-5
  note?: string;
}

const FACES = ["😢", "😕", "😐", "🙂", "😄"];

class MoodChild extends BaseRenderChild {
  private days!: Collection<MoodDay>;

  onload(): void {
    this.days = this.ctx.storage.collection<MoodDay>("mood/days");
    void this.days.refresh().then(() => this.draw());
    this.registerEvent(
      this.ctx.bus.on("storage:changed", (p) => {
        if (p.collection === "mood/days") this.draw();
      })
    );
  }

  private draw(): void {
    this.containerEl.empty();
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "心情记录",
      icon: "smile",
      cls: "hm-mood",
    });
    const today = dateKey(new Date());
    const cur = this.days.get(today);

    const picker = body.createDiv({ cls: "hm-mood-picker" });
    FACES.forEach((face, i) => {
      const b = picker.createEl("button", { text: face, cls: "hm-mood-face" });
      if (cur?.score === i + 1) b.addClass("hm-active");
      b.onclick = () => this.days.upsert({ id: today, date: today, score: i + 1 } as MoodDay);
    });

    const data: Record<string, number> = {};
    for (const d of this.days.all()) data[d.date] = d.score;
    renderHeatmap(body.createDiv(), data, { max: 5 });
  }
}

export const moodModule: HMModule = {
  id: "mood",
  lang: "mood",
  category: "habit",
  displayName: "心情记录",
  description: "每日心情打分（1-5）+ 全年热力图。",
  premium: true,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new MoodChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 心情记录";
  },
};
