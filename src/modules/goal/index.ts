import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { genId } from "../../core/util";
import { Collection, HMRecord } from "../../core/storage";
import { createCard } from "../../ui/components/Card";
import { promptText } from "../../ui/components/modal-helpers";

interface Goal extends HMRecord {
  name: string;
  target: number;
  current: number;
  unit?: string;
}

class GoalChild extends BaseRenderChild {
  private goals!: Collection<Goal>;

  onload(): void {
    this.goals = this.ctx.storage.collection<Goal>("goal/goals");
    void this.goals.refresh().then(() => this.draw());
    this.registerEvent(
      this.ctx.bus.on("storage:changed", (p) => {
        if (p.collection === "goal/goals") this.draw();
      })
    );
  }

  private draw(): void {
    this.containerEl.empty();
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "目标进度",
      icon: "target",
      cls: "hm-goal",
    });
    for (const g of this.goals.all()) {
      const pct = Math.min(100, (g.current / g.target) * 100);
      const row = body.createDiv({ cls: "hm-goal-row" });
      const head = row.createDiv({ cls: "hm-goal-head" });
      head.createSpan({ text: g.name });
      head.createSpan({
        cls: "hm-muted",
        text: `${g.current}/${g.target}${g.unit ?? ""} (${pct.toFixed(0)}%)`,
      });
      const bar = row.createDiv({ cls: "hm-bar" });
      bar.createDiv({ cls: "hm-bar-fill" }).style.width = `${pct}%`;
      const ctrl = row.createDiv({ cls: "hm-goal-ctrl" });
      const minus = ctrl.createEl("button", { text: "－" });
      minus.onclick = () => this.goals.upsert({ ...g, current: Math.max(0, g.current - 1) });
      const plus = ctrl.createEl("button", { text: "＋" });
      plus.onclick = () => this.goals.upsert({ ...g, current: g.current + 1 });
      const del = ctrl.createEl("button", { cls: "hm-icon-btn", text: "🗑" });
      del.onclick = () => this.goals.remove(g.id);
    }
    const add = body.createEl("button", { cls: "hm-todo-add", text: "+ 目标" });
    add.onclick = () => this.add();
  }

  private async add(): Promise<void> {
    const name = await promptText(this.ctx.app, "目标名称", "");
    if (!name) return;
    const target = await promptText(this.ctx.app, "目标值", "100");
    const unit = (await promptText(this.ctx.app, "单位（可空）", "")) ?? "";
    this.goals.upsert({
      id: genId(),
      name,
      target: Number(target) || 100,
      current: 0,
      unit,
    });
  }
}

export const goalModule: HMModule = {
  id: "goal",
  lang: "goal",
  category: "finance",
  displayName: "目标进度",
  description: "数值目标进度条，± 调整。",
  premium: true,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new GoalChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 目标进度";
  },
};
