import { MarkdownPostProcessorContext, MarkdownRenderChild, Notice, TFile } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { Collection } from "../../core/storage";
import { createCard } from "../../ui/components/Card";
import { dateKey } from "../../ui/components/Heatmap";
import { PomoSession } from "../pomodoro/model";

class CalendarChild extends BaseRenderChild {
  private year = new Date().getFullYear();
  private month = new Date().getMonth();
  private sessions!: Collection<PomoSession>;

  onload(): void {
    this.sessions = this.ctx.storage.collection<PomoSession>("pomodoro/sessions");
    void this.sessions.refresh().then(() => this.draw());
  }

  private draw(): void {
    this.containerEl.empty();
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "日历",
      icon: "calendar",
      cls: "hm-calendar",
    });
    const head = body.createDiv({ cls: "hm-cal-head" });
    const prev = head.createEl("button", { cls: "hm-icon-btn", text: "‹" });
    prev.onclick = () => this.shift(-1);
    head.createSpan({ cls: "hm-cal-title", text: `${this.year} 年 ${this.month + 1} 月` });
    const next = head.createEl("button", { cls: "hm-icon-btn", text: "›" });
    next.onclick = () => this.shift(1);

    const grid = body.createDiv({ cls: "hm-cal-grid" });
    for (const w of ["日", "一", "二", "三", "四", "五", "六"]) {
      grid.createDiv({ cls: "hm-cal-wd hm-muted", text: w });
    }
    const first = new Date(this.year, this.month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(this.year, this.month + 1, 0).getDate();
    const todayKey = dateKey(new Date());

    const marked = new Set(this.sessions.all().map((s) => s.date));

    for (let i = 0; i < startPad; i++) grid.createDiv({ cls: "hm-cal-cell hm-empty" });
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = grid.createDiv({ cls: "hm-cal-cell" });
      const key = `${this.year}-${String(this.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cell.createSpan({ text: String(d) });
      if (key === todayKey) cell.addClass("hm-cal-today");
      if (marked.has(key)) cell.createSpan({ cls: "hm-cal-dot" });
      cell.onclick = () => this.openDaily(key);
    }
  }

  private shift(delta: number): void {
    this.month += delta;
    if (this.month < 0) {
      this.month = 11;
      this.year--;
    } else if (this.month > 11) {
      this.month = 0;
      this.year++;
    }
    this.draw();
  }

  private async openDaily(key: string): Promise<void> {
    const path = `${key}.md`;
    let file = this.ctx.app.vault.getAbstractFileByPath(path);
    if (!file) {
      file = await this.ctx.app.vault.create(path, `# ${key}\n\n`);
      new Notice(`已创建 ${path}`);
    }
    if (file instanceof TFile) await this.ctx.app.workspace.getLeaf(true).openFile(file);
  }
}

export const calendarModule: HMModule = {
  id: "calendar",
  lang: "calendar",
  category: "dashboard",
  displayName: "日历",
  description: "月视图，标记有专注记录的日子，点击打开/创建当日笔记。",
  premium: true,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new CalendarChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 日历";
  },
};
