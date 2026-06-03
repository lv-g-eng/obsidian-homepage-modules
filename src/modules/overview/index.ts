import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { Collection } from "../../core/storage";
import { createCard } from "../../ui/components/Card";
import { dateKey } from "../../ui/components/Heatmap";
import { TodoStore } from "../todo/store";
import { PomoSession } from "../pomodoro/model";
import { Habit, Checkin } from "../habit/model";

class OverviewChild extends BaseRenderChild {
  private todo!: TodoStore;
  private sessions!: Collection<PomoSession>;
  private habits!: Collection<Habit>;
  private checkins!: Collection<Checkin>;

  onload(): void {
    this.todo = new TodoStore(this.ctx);
    this.sessions = this.ctx.storage.collection<PomoSession>("pomodoro/sessions");
    this.habits = this.ctx.storage.collection<Habit>("habit/habits");
    this.checkins = this.ctx.storage.collection<Checkin>("habit/checkins");
    void Promise.all([
      this.todo.refreshAll(),
      this.sessions.refresh(),
      this.habits.refresh(),
      this.checkins.refresh(),
    ]).then(() => this.draw());

    for (const ev of ["storage:changed", "pomodoro:completed", "habit:checked", "todo:changed"] as const) {
      this.registerEvent(this.ctx.bus.on(ev, () => this.draw()));
    }
  }

  private draw(): void {
    this.containerEl.empty();
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "今日概览",
      icon: "layout-dashboard",
      cls: "hm-overview",
    });
    const today = dateKey(new Date());

    // 待办
    const todayTasks = this.todo.todayTasks(today);
    const doneTasks = todayTasks.filter((t) => t.done).length;
    const overdue = this.todo.dueSoon(today).overdue.length;

    // 专注
    let pomoCount = 0;
    let pomoMin = 0;
    for (const s of this.sessions.all()) if (s.date === today) (pomoCount++, (pomoMin += s.minutes));

    // 习惯（坚持型今日完成度）
    const todayVals = new Map<string, number>();
    for (const c of this.checkins.all()) if (c.date === today) todayVals.set(c.habitId, c.value);
    const doHabits = this.habits.all().filter((h) => h.type === "do");
    const habitDone = doHabits.filter((h) => (todayVals.get(h.id) ?? 0) >= (h.target ?? 1)).length;

    const grid = body.createDiv({ cls: "hm-stats-grid hm-overview-grid" });
    const cell = (label: string, value: string, danger = false) => {
      const c = grid.createDiv({ cls: "hm-stat-cell" });
      const v = c.createDiv({ cls: "hm-stat-value", text: value });
      if (danger) v.style.color = "var(--color-red, var(--text-error))";
      c.createDiv({ cls: "hm-stat-label hm-muted", text: label });
    };
    cell("今日待办", `${doneTasks}/${todayTasks.length}`);
    cell("专注", `🍅${pomoCount} · ${pomoMin}′`);
    cell("习惯", `${habitDone}/${doHabits.length}`);
    cell("逾期", String(overdue), overdue > 0);
  }
}

export const overviewModule: HMModule = {
  id: "overview",
  lang: "overview",
  category: "dashboard",
  displayName: "今日概览",
  description: "一眼看全今日待办、专注、习惯与逾期。放主页顶部最合适。",
  premium: true,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new OverviewChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 今日概览";
  },
};
