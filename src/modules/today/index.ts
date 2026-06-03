import { MarkdownPostProcessorContext, MarkdownRenderChild, setIcon } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { createCard } from "../../ui/components/Card";
import { dateKey } from "../../ui/components/Heatmap";
import { TodoStore } from "../todo/store";

class TodayChild extends BaseRenderChild {
  private store!: TodoStore;

  onload(): void {
    this.store = new TodoStore(this.ctx);
    void this.store.refreshAll().then(() => this.draw());
    this.registerEvent(
      this.ctx.bus.on("storage:changed", (p) => {
        if (p.collection.startsWith("todo/")) this.draw();
      })
    );
  }

  private draw(): void {
    this.containerEl.empty();
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "今日清单",
      icon: "calendar-check",
      cls: "hm-today",
    });
    const today = dateKey(new Date());
    const tasks = this.store.todayTasks(today);
    const remain = tasks.filter((t) => !t.done).length;
    body.createDiv({ cls: "hm-muted", text: `待完成 ${remain} / 共 ${tasks.length}` });

    if (tasks.length === 0) {
      body.createDiv({
        cls: "hm-muted",
        text: "今日清单为空。在看板里点日历图标可派单到今日。",
      });
      return;
    }
    const list = body.createDiv({ cls: "hm-today-list" });
    for (const t of tasks) {
      const row = list.createDiv({ cls: "hm-today-row" + (t.done ? " hm-done" : "") });
      const cb = row.createEl("input", { type: "checkbox" });
      cb.checked = t.done;
      cb.onclick = () => this.store.toggleDone(t);
      const proj = this.store.projects.get(t.projectId);
      row.createSpan({ cls: "hm-today-title", text: t.title });
      if (proj) row.createSpan({ cls: "hm-badge", text: proj.name });
      const remove = row.createEl("button", { cls: "hm-icon-btn", title: "移出今日" });
      setIcon(remove.createSpan(), "calendar-minus");
      remove.onclick = () => this.store.setToday(t, false);
    }
  }
}

export const todayModule: HMModule = {
  id: "today",
  lang: "today",
  category: "productivity",
  displayName: "今日清单",
  description: "聚合所有派单到今日 / 今日截止的任务，勾选回写看板。",
  premium: true,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new TodayChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 今日清单";
  },
};
