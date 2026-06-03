import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { Collection } from "../../core/storage";
import { createCard } from "../../ui/components/Card";
import { renderHeatmap } from "../../ui/components/Heatmap";
import { PomoSession } from "../pomodoro/model";

class PomoHeatmapChild extends BaseRenderChild {
  private sessions!: Collection<PomoSession>;

  onload(): void {
    this.sessions = this.ctx.storage.collection<PomoSession>("pomodoro/sessions");
    void this.sessions.refresh().then(() => this.draw());
    this.registerEvent(
      this.ctx.bus.on("pomodoro:completed", () => this.draw())
    );
    this.registerEvent(
      this.ctx.bus.on("storage:changed", (p) => {
        if (p.collection === "pomodoro/sessions") this.draw();
      })
    );
  }

  private draw(): void {
    this.containerEl.empty();
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "专注热力图",
      icon: "flame",
      cls: "hm-pomo-heatmap",
    });
    const data: Record<string, number> = {};
    let total = 0;
    for (const s of this.sessions.all()) {
      data[s.date] = (data[s.date] ?? 0) + s.minutes;
      total += s.minutes;
    }
    body.createDiv({
      cls: "hm-muted",
      text: `${new Date().getFullYear()} 年累计专注 ${total} 分钟（${Math.round(
        (total / 60) * 10
      ) / 10} 小时）`,
    });
    renderHeatmap(body, data, { unit: " 分钟", colorVar: "--interactive-accent" });
  }
}

export const pomodoroHeatmapModule: HMModule = {
  id: "pomodoro-heatmap",
  lang: "pomodoro-heatmap",
  category: "productivity",
  displayName: "专注热力图",
  description: "全年专注分钟数热力图，随番茄完成实时更新。",
  premium: true,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new PomoHeatmapChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 专注热力图";
  },
};
