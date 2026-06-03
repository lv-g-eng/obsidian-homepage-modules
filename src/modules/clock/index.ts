import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { createCard } from "../../ui/components/Card";

class ClockChild extends BaseRenderChild {
  private timeEl!: HTMLElement;
  private dateEl!: HTMLElement;

  onload(): void {
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "时钟",
      icon: "clock",
      cls: "hm-clock",
    });
    this.timeEl = body.createDiv({ cls: "hm-clock-time" });
    this.dateEl = body.createDiv({ cls: "hm-clock-date hm-muted" });
    this.tick();
    this.interval(() => this.tick(), 1000);
  }

  private tick(): void {
    const now = new Date();
    const hms = now.toLocaleTimeString();
    const ymd = now.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
    this.timeEl.setText(hms);
    this.dateEl.setText(ymd);
  }
}

export const clockModule: HMModule = {
  id: "clock",
  lang: "clock",
  category: "utility",
  displayName: "时钟",
  description: "实时时钟与日期，免费模块。",
  premium: false,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new ClockChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 时钟";
  },
};
