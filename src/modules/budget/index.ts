import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { genId } from "../../core/util";
import { Collection, HMRecord } from "../../core/storage";
import { createCard } from "../../ui/components/Card";
import { promptText } from "../../ui/components/modal-helpers";
import { LedgerEntry } from "../ledger";

interface Budget extends HMRecord {
  category: string;
  limit: number;
}

function thisMonth(date: string): boolean {
  const now = new Date();
  return date.startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
}

class BudgetChild extends BaseRenderChild {
  private budgets!: Collection<Budget>;
  private entries!: Collection<LedgerEntry>;

  onload(): void {
    this.budgets = this.ctx.storage.collection<Budget>("budget/config");
    this.entries = this.ctx.storage.collection<LedgerEntry>("ledger/entries");
    void Promise.all([this.budgets.refresh(), this.entries.refresh()]).then(() =>
      this.draw()
    );
    this.registerEvent(
      this.ctx.bus.on("storage:changed", (p) => {
        if (p.collection === "budget/config" || p.collection === "ledger/entries") this.draw();
      })
    );
  }

  private draw(): void {
    this.containerEl.empty();
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "预算",
      icon: "piggy-bank",
      cls: "hm-budget",
    });
    const spent = new Map<string, number>();
    for (const e of this.entries.all()) {
      if (thisMonth(e.date)) spent.set(e.category, (spent.get(e.category) ?? 0) + e.amount);
    }
    for (const b of this.budgets.all()) {
      const used = spent.get(b.category) ?? 0;
      const pct = Math.min(100, (used / b.limit) * 100);
      const row = body.createDiv({ cls: "hm-budget-row" });
      row.createSpan({ text: b.category });
      const bar = row.createDiv({ cls: "hm-bar" });
      const fill = bar.createDiv({ cls: "hm-bar-fill" });
      fill.style.width = `${pct}%`;
      if (used > b.limit) fill.addClass("hm-over");
      const label = row.createSpan({
        cls: used > b.limit ? "hm-over" : "hm-muted",
        text: `¥${used.toFixed(0)} / ${b.limit}`,
      });
      const del = row.createEl("button", { cls: "hm-icon-btn", text: "🗑" });
      del.onclick = () => this.budgets.remove(b.id);
      void label;
    }
    const add = body.createEl("button", { cls: "hm-todo-add", text: "+ 预算项" });
    add.onclick = () => this.add();
  }

  private async add(): Promise<void> {
    const category = await promptText(this.ctx.app, "分类", "餐饮");
    if (!category) return;
    const limit = await promptText(this.ctx.app, "每月上限", "1000");
    this.budgets.upsert({ id: genId(), category, limit: Number(limit) || 0 });
  }
}

export const budgetModule: HMModule = {
  id: "budget",
  lang: "budget",
  category: "finance",
  displayName: "预算",
  description: "按分类设置月预算，对比记账实际花销。",
  premium: true,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new BudgetChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 预算";
  },
};
