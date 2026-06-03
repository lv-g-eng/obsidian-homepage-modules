import { ModuleContext } from "../../core/module";
import { Collection } from "../../core/storage";
import { Project, Task, Subtask, COLLECTIONS, PRIORITY_RANK } from "./model";

function rank(t: Task): number {
  return t.priority ? PRIORITY_RANK[t.priority] : 3;
}
function byPriorityDueOrder(a: Task, b: Task): number {
  if (a.done !== b.done) return Number(a.done) - Number(b.done);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  const ad = a.due ?? "9999";
  const bd = b.due ?? "9999";
  if (ad !== bd) return ad < bd ? -1 : 1;
  return a.order - b.order;
}

/** 待办数据访问层，被 todo 与 today 两个模块共享，保证双向同步。 */
export class TodoStore {
  projects: Collection<Project>;
  tasks: Collection<Task>;
  subtasks: Collection<Subtask>;

  constructor(private ctx: ModuleContext) {
    this.projects = ctx.storage.collection<Project>(COLLECTIONS.projects);
    this.tasks = ctx.storage.collection<Task>(COLLECTIONS.tasks);
    this.subtasks = ctx.storage.collection<Subtask>(COLLECTIONS.subtasks);
  }

  async refreshAll(): Promise<void> {
    await Promise.all([
      this.projects.refresh(),
      this.tasks.refresh(),
      this.subtasks.refresh(),
    ]);
  }

  projectsOf(boardId: string): Project[] {
    return this.projects
      .all()
      .filter((p) => p.boardId === boardId)
      .sort((a, b) => a.order - b.order);
  }

  tasksOf(projectId: string): Task[] {
    return this.tasks
      .all()
      .filter((t) => t.projectId === projectId)
      .sort(byPriorityDueOrder);
  }

  /** 今日到期 + 已逾期且未完成的任务（用于提醒）。 */
  dueSoon(today: string): { dueToday: Task[]; overdue: Task[] } {
    const dueToday: Task[] = [];
    const overdue: Task[] = [];
    for (const t of this.tasks.all()) {
      if (t.done || !t.due) continue;
      if (t.due === today) dueToday.push(t);
      else if (t.due < today) overdue.push(t);
    }
    return { dueToday, overdue };
  }

  subtasksOf(taskId: string): Subtask[] {
    return this.subtasks
      .all()
      .filter((s) => s.taskId === taskId)
      .sort((a, b) => a.order - b.order);
  }

  todayTasks(today: string): Task[] {
    return this.tasks
      .all()
      .filter((t) => t.today || t.due === today)
      .sort(byPriorityDueOrder);
  }

  toggleDone(t: Task): void {
    this.tasks.upsert({ ...t, done: !t.done });
    this.ctx.bus.emit("todo:changed", { boardId: t.boardId });
  }

  setToday(t: Task, on: boolean): void {
    this.tasks.upsert({ ...t, today: on });
    if (on) this.ctx.bus.emit("todo:dispatched", { taskId: t.id, boardId: t.boardId });
    this.ctx.bus.emit("todo:changed", { boardId: t.boardId });
  }

  nextOrder(items: { order: number }[]): number {
    return items.reduce((m, i) => Math.max(m, i.order), 0) + 1;
  }
}
