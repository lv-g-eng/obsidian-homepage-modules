import { MarkdownPostProcessorContext, MarkdownRenderChild, Notice, setIcon } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { genId } from "../../core/util";
import { createCard } from "../../ui/components/Card";
import { promptText, confirmDialog } from "../../ui/components/modal-helpers";
import { dateKey } from "../../ui/components/Heatmap";
import { TodoStore } from "./store";
import { Project, Task, Priority, PRIORITY_LABEL } from "./model";

const PRIORITY_CYCLE: (Priority | undefined)[] = ["high", "med", "low", undefined];

class TodoChild extends BaseRenderChild {
  private store!: TodoStore;
  private get boardId(): string {
    return this.params.board ?? "main";
  }

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
      title: this.params.title ?? "待办看板",
      icon: "kanban-square",
      cls: "hm-todo",
    });

    const bar = body.createDiv({ cls: "hm-todo-toolbar" });
    const addProj = bar.createEl("button", { cls: "mod-cta", text: "+ 项目" });
    addProj.onclick = () => this.addProject();

    const board = body.createDiv({ cls: "hm-todo-board" });
    const projects = this.store.projectsOf(this.boardId);
    if (projects.length === 0) {
      board.createDiv({ cls: "hm-muted", text: "还没有项目，点击「+ 项目」开始。" });
      return;
    }
    for (const p of projects) this.drawColumn(board, p);
  }

  private drawColumn(board: HTMLElement, p: Project): void {
    const col = board.createDiv({ cls: "hm-todo-col" });
    const head = col.createDiv({ cls: "hm-todo-col-head" });
    head.createSpan({ cls: "hm-todo-col-name", text: p.name });
    const del = head.createEl("button", { cls: "hm-icon-btn", text: "🗑" });
    del.onclick = async () => {
      if (await confirmDialog(this.ctx.app, `删除项目「${p.name}」？`))
        this.store.projects.remove(p.id);
    };

    const tasks = this.store.tasksOf(p.id);
    const listEl = col.createDiv({ cls: "hm-todo-tasks" });
    for (const t of tasks) this.drawTask(listEl, t);

    const add = col.createEl("button", { cls: "hm-todo-add", text: "+ 任务" });
    add.onclick = () => this.addTask(p);
  }

  private drawTask(parent: HTMLElement, t: Task): void {
    const card = parent.createDiv({
      cls: "hm-todo-task" + (t.done ? " hm-done" : "") + (t.priority ? ` hm-pri-${t.priority}` : ""),
    });
    const top = card.createDiv({ cls: "hm-todo-task-top" });

    const cb = top.createEl("input", { type: "checkbox" });
    cb.checked = t.done;
    cb.onclick = () => this.store.toggleDone(t);

    // 优先级彩标（点击循环 高→中→低→无）
    const pri = top.createEl("button", {
      cls: "hm-pri-dot" + (t.priority ? ` hm-pri-${t.priority}` : ""),
      title: t.priority ? `优先级：${PRIORITY_LABEL[t.priority]}` : "设优先级",
    });
    pri.onclick = () => {
      const i = PRIORITY_CYCLE.indexOf(t.priority);
      this.store.tasks.upsert({ ...t, priority: PRIORITY_CYCLE[(i + 1) % PRIORITY_CYCLE.length] });
    };

    top.createSpan({ cls: "hm-todo-task-title", text: t.title });

    // 截止日期徽章（逾期红 / 今日橙）
    const today = dateKey(new Date());
    const dueBtn = top.createEl("button", { cls: "hm-due-badge" });
    if (t.due) {
      dueBtn.setText(t.due === today ? "今天" : t.due.slice(5));
      if (t.due < today) dueBtn.addClass("hm-overdue");
      else if (t.due === today) dueBtn.addClass("hm-due-today");
    } else {
      dueBtn.addClass("hm-due-empty");
      setIcon(dueBtn, "calendar");
    }
    dueBtn.onclick = async () => {
      const v = await promptText(this.ctx.app, "截止日期 YYYY-MM-DD（留空清除）", t.due ?? "");
      this.store.tasks.upsert({ ...t, due: v || undefined });
    };

    const actions = top.createDiv({ cls: "hm-todo-task-actions" });
    const todayBtn = actions.createEl("button", {
      cls: "hm-icon-btn" + (t.today ? " hm-active" : ""),
      title: t.today ? "已在今日" : "派单到今日",
    });
    setIcon(todayBtn.createSpan(), t.today ? "calendar-check" : "calendar-plus");
    todayBtn.onclick = () => this.store.setToday(t, !t.today);

    const sub = this.store.subtasksOf(t.id);
    const subBtn = actions.createEl("button", {
      cls: "hm-icon-btn",
      text: sub.length ? `☰ ${sub.filter((s) => s.done).length}/${sub.length}` : "+子",
    });

    const subWrap = card.createDiv({ cls: "hm-todo-subs" });
    subWrap.style.display = "none";
    subBtn.onclick = () => {
      subWrap.style.display = subWrap.style.display === "none" ? "" : "none";
    };
    for (const s of sub) {
      const row = subWrap.createDiv({ cls: "hm-todo-sub" + (s.done ? " hm-done" : "") });
      const scb = row.createEl("input", { type: "checkbox" });
      scb.checked = s.done;
      scb.onclick = () => this.store.subtasks.upsert({ ...s, done: !s.done });
      row.createSpan({ text: s.title });
    }
    const addSub = subWrap.createEl("button", { cls: "hm-todo-add", text: "+ 子任务" });
    addSub.onclick = async () => {
      const title = await promptText(this.ctx.app, "子任务", "");
      if (!title) return;
      this.store.subtasks.upsert({
        id: genId(),
        taskId: t.id,
        title,
        done: false,
        order: this.store.nextOrder(this.store.subtasksOf(t.id)),
      });
    };

    const del = actions.createEl("button", { cls: "hm-icon-btn", text: "🗑" });
    del.onclick = () => this.store.tasks.remove(t.id);
  }

  private async addProject(): Promise<void> {
    const name = await promptText(this.ctx.app, "项目名称", "");
    if (!name) return;
    this.store.projects.upsert({
      id: genId(),
      boardId: this.boardId,
      name,
      order: this.store.nextOrder(this.store.projectsOf(this.boardId)),
    });
  }

  private async addTask(p: Project): Promise<void> {
    const title = await promptText(this.ctx.app, "任务标题", "");
    if (!title) return;
    this.store.tasks.upsert({
      id: genId(),
      boardId: this.boardId,
      projectId: p.id,
      title,
      done: false,
      today: false,
      order: this.store.nextOrder(this.store.tasksOf(p.id)),
    });
  }
}

export const todoModule: HMModule = {
  id: "todo",
  lang: "todo",
  category: "productivity",
  displayName: "待办看板",
  description: "项目→任务→子任务，优先级彩标 + 截止日期 + 到期提醒，一键派单到今日。",
  premium: true,
  onload(ctx: ModuleContext): void {
    // 到期提醒：加载后扫描今日到期/逾期任务，每天只提醒一次
    window.setTimeout(async () => {
      try {
        const store = new TodoStore(ctx);
        await store.refreshAll();
        const today = dateKey(new Date());
        if (ctx.settings.getState<string>("todoReminded") === today) return;
        const { dueToday, overdue } = store.dueSoon(today);
        if (dueToday.length || overdue.length) {
          new Notice(`📋 待办提醒：今日到期 ${dueToday.length}，已逾期 ${overdue.length}`, 8000);
          await ctx.settings.setState("todoReminded", today);
        }
      } catch (e) {
        console.warn("[HM] todo reminder failed", e);
      }
    }, 3000);
  },
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new TodoChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 待办看板\nboard: main";
  },
};

export { TodoStore };
export const todayLabel = (): string => dateKey(new Date());
