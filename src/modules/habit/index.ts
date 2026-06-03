import { MarkdownPostProcessorContext, MarkdownRenderChild, Notice } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { genId } from "../../core/util";
import { Collection } from "../../core/storage";
import { createCard } from "../../ui/components/Card";
import { renderHeatmap, dateKey } from "../../ui/components/Heatmap";
import { promptText, promptChoice, confirmDialog } from "../../ui/components/modal-helpers";
import { Habit, Checkin, checkinId, computeStreak, HabitType } from "./model";

class HabitChild extends BaseRenderChild {
  private habits!: Collection<Habit>;
  private checkins!: Collection<Checkin>;

  onload(): void {
    this.habits = this.ctx.storage.collection<Habit>("habit/habits");
    this.checkins = this.ctx.storage.collection<Checkin>("habit/checkins");
    // 拉取其它设备同步过来的数据后再渲染
    void Promise.all([this.habits.refresh(), this.checkins.refresh()]).then(() =>
      this.draw()
    );
    this.registerEvent(
      this.ctx.bus.on("storage:changed", (p) => {
        if (p.collection.startsWith("habit/")) this.draw();
      })
    );
  }

  private today(): string {
    return dateKey(new Date());
  }

  private draw(): void {
    this.containerEl.empty();
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "习惯打卡",
      icon: "check-circle",
      cls: "hm-habit",
    });

    const toolbar = body.createDiv({ cls: "hm-habit-toolbar" });
    const addBtn = toolbar.createEl("button", { text: "+ 新习惯", cls: "mod-cta" });
    addBtn.onclick = () => this.addHabit();

    const list = body.createDiv({ cls: "hm-habit-list" });
    const habits = this.habits.all();
    if (habits.length === 0) {
      list.createDiv({ cls: "hm-muted", text: "还没有习惯，点击「+ 新习惯」开始。" });
      return;
    }
    for (const h of habits) this.drawHabit(list, h);
  }

  private checkinMap(habitId: string): Map<string, number> {
    const m = new Map<string, number>();
    for (const c of this.checkins.all()) {
      if (c.habitId === habitId) m.set(c.date, c.value);
    }
    return m;
  }

  private drawHabit(parent: HTMLElement, h: Habit): void {
    const row = parent.createDiv({ cls: "hm-habit-row" });
    const head = row.createDiv({ cls: "hm-habit-head" });

    const map = this.checkinMap(h.id);
    const today = this.today();
    const todayVal = map.get(today) ?? 0;
    const streak = computeStreak(h, map, today);

    const info = head.createDiv({ cls: "hm-habit-info" });
    info.createSpan({ cls: "hm-habit-name", text: h.name });
    info.createSpan({
      cls: "hm-badge",
      text: h.type === "do" ? "坚持" : h.type === "limit" ? "限额" : "戒断",
    });
    info.createSpan({ cls: "hm-muted", text: `🔥 ${streak} 天` });

    const ctrl = head.createDiv({ cls: "hm-habit-ctrl" });
    if (h.type === "quit") {
      const slip = ctrl.createEl("button", {
        text: todayVal > 0 ? `今日破戒 ×${todayVal}` : "记录破戒",
      });
      slip.onclick = () => this.setCheckin(h.id, today, todayVal + 1);
      if (todayVal > 0) {
        const undo = ctrl.createEl("button", { text: "撤销" });
        undo.onclick = () => this.setCheckin(h.id, today, Math.max(0, todayVal - 1));
      }
    } else {
      const minus = ctrl.createEl("button", { text: "－" });
      minus.onclick = () => this.setCheckin(h.id, today, Math.max(0, todayVal - 1));
      const target = h.target ?? 1;
      const val = ctrl.createSpan({
        cls: "hm-habit-count",
        text: `${todayVal}${h.unit ?? ""} / ${target}`,
      });
      if (h.type === "do" && todayVal >= target) val.addClass("hm-ok");
      if (h.type === "limit" && todayVal > target) val.addClass("hm-over");
      const plus = ctrl.createEl("button", { text: "＋" });
      plus.onclick = () => this.setCheckin(h.id, today, todayVal + 1);
    }

    const del = ctrl.createEl("button", { cls: "hm-icon-btn", text: "🗑" });
    del.onclick = async () => {
      if (await confirmDialog(this.ctx.app, `删除习惯「${h.name}」？`, "打卡记录会一并隐藏。"))
        this.habits.remove(h.id);
    };

    // 本周视图（周一→周日）
    this.drawWeek(row, h, map, today);

    // 全年热力图
    const data: Record<string, number> = {};
    for (const [k, v] of map) data[k] = v;
    renderHeatmap(row.createDiv(), data, {
      colorVar: h.type === "quit" ? "--color-red" : "--interactive-accent",
      unit: h.unit ?? "",
    });
  }

  private isAchieved(h: Habit, v: number): boolean {
    return h.type === "do"
      ? v >= (h.target ?? 1)
      : h.type === "limit"
      ? v <= (h.target ?? 0)
      : v === 0;
  }

  private drawWeek(parent: HTMLElement, h: Habit, map: Map<string, number>, today: string): void {
    const week = parent.createDiv({ cls: "hm-habit-week" });
    const labels = ["一", "二", "三", "四", "五", "六", "日"];
    const d = new Date(today + "T00:00:00");
    const offset = (d.getDay() + 6) % 7; // 距本周一的天数
    d.setDate(d.getDate() - offset);
    for (let i = 0; i < 7; i++) {
      const key = dateKey(d);
      const v = map.get(key) ?? 0;
      const isFuture = key > today;
      const cell = week.createDiv({ cls: "hm-week-day" });
      cell.createSpan({ cls: "hm-week-wd", text: labels[i] });
      const dot = cell.createDiv({ cls: "hm-week-dot" });
      if (key === today) dot.addClass("hm-week-today");
      // do 型需达标(v>0)；limit/quit 型当天在限内即视为达成
      if (!isFuture && this.isAchieved(h, v)) dot.addClass("hm-week-done");
      dot.onclick = () => {
        if (isFuture) return;
        const cur = map.get(key) ?? 0;
        this.setCheckin(h.id, key, h.type === "quit" ? cur + 1 : cur >= (h.target ?? 1) ? 0 : cur + 1);
      };
      d.setDate(d.getDate() + 1);
    }
  }

  private setCheckin(habitId: string, date: string, value: number): void {
    this.checkins.upsert({ id: checkinId(habitId, date), habitId, date, value } as Checkin);
    this.ctx.bus.emit("habit:checked", { habitId, date, value });
  }

  private async addHabit(): Promise<void> {
    const name = await promptText(this.ctx.app, "习惯名称", "", "如：早睡 / 喝水 / 戒糖");
    if (!name) return;
    const type = await promptChoice<HabitType>(this.ctx.app, "选择类型", [
      { value: "do", label: "坚持做（每日目标）" },
      { value: "limit", label: "限额（每日上限）" },
      { value: "quit", label: "戒断（保持为零）" },
    ]);
    if (!type) return;
    let target: number | undefined;
    if (type !== "quit") {
      const t = await promptText(
        this.ctx.app,
        type === "do" ? "每日目标次数" : "每日上限",
        "1"
      );
      target = Number(t) || 1;
    }
    this.habits.upsert({
      id: genId(),
      name,
      type,
      target,
    } as Habit);
    new Notice("已添加习惯");
  }
}

export const habitModule: HMModule = {
  id: "habit",
  lang: "habit",
  category: "habit",
  displayName: "习惯打卡",
  description: "坚持/限额/戒断三类习惯 + 本周视图 + 连续天数 + 全年热力图 + 每日提醒。",
  premium: true,
  onload(ctx: ModuleContext): void {
    // 每日提醒：加载后扫描今日未完成的「坚持」型习惯，每天只提醒一次
    window.setTimeout(async () => {
      try {
        const habits = ctx.storage.collection<Habit>("habit/habits");
        const checkins = ctx.storage.collection<Checkin>("habit/checkins");
        await Promise.all([habits.refresh(), checkins.refresh()]);
        const today = dateKey(new Date());
        if (ctx.settings.getState<string>("habitReminded") === today) return;
        const todayVals = new Map<string, number>();
        for (const c of checkins.all()) if (c.date === today) todayVals.set(c.habitId, c.value);
        const pending = habits
          .all()
          .filter((h) => h.type === "do" && (todayVals.get(h.id) ?? 0) < (h.target ?? 1));
        if (pending.length) {
          new Notice(`✅ 习惯提醒：今天还有 ${pending.length} 个习惯未完成`, 8000);
          await ctx.settings.setState("habitReminded", today);
        }
      } catch (e) {
        console.warn("[HM] habit reminder failed", e);
      }
    }, 3500);
  },
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new HabitChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 习惯打卡";
  },
};
