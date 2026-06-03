import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { genId } from "../../core/util";
import { Collection, HMRecord } from "../../core/storage";
import { createCard } from "../../ui/components/Card";
import { promptText } from "../../ui/components/modal-helpers";
import { dateKey } from "../../ui/components/Heatmap";

export interface LedgerEntry extends HMRecord {
  amount: number; // 正=支出
  category: string;
  date: string;
  note?: string;
}

function thisMonth(date: string): boolean {
  const now = new Date();
  return date.startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
}

class LedgerChild extends BaseRenderChild {
  private entries!: Collection<LedgerEntry>;

  onload(): void {
    this.entries = this.ctx.storage.collection<LedgerEntry>("ledger/entries");
    void this.entries.refresh().then(() => this.draw());
    this.registerEvent(
      this.ctx.bus.on("storage:changed", (p) => {
        if (p.collection === "ledger/entries") this.draw();
      })
    );
  }

  private draw(): void {
    this.containerEl.empty();
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "记账",
      icon: "wallet",
      cls: "hm-ledger",
    });

    const month = this.entries.all().filter((e) => thisMonth(e.date));
    const total = month.reduce((s, e) => s + e.amount, 0);
    body.createDiv({ cls: "hm-ledger-total", text: `本月支出 ¥${total.toFixed(2)}` });

    // 分类汇总
    const byCat = new Map<string, number>();
    for (const e of month) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
    const cats = body.createDiv({ cls: "hm-ledger-cats" });
    const max = Math.max(1, ...byCat.values());
    for (const [cat, sum] of [...byCat.entries()].sort((a, b) => b[1] - a[1])) {
      const row = cats.createDiv({ cls: "hm-ledger-cat" });
      row.createSpan({ text: cat });
      const bar = row.createDiv({ cls: "hm-bar" });
      bar.createDiv({ cls: "hm-bar-fill" }).style.width = `${(sum / max) * 100}%`;
      row.createSpan({ cls: "hm-muted", text: `¥${sum.toFixed(0)}` });
    }

    const add = body.createEl("button", { cls: "mod-cta", text: "+ 记一笔" });
    add.onclick = () => this.add();
  }

  private async add(): Promise<void> {
    const amt = await promptText(this.ctx.app, "金额（支出为正）", "");
    if (!amt) return;
    const category = (await promptText(this.ctx.app, "分类", "餐饮")) ?? "其它";
    const note = (await promptText(this.ctx.app, "备注（可空）", "")) ?? "";
    this.entries.upsert({
      id: genId(),
      amount: Number(amt) || 0,
      category,
      note,
      date: dateKey(new Date()),
    });
  }
}

export const ledgerModule: HMModule = {
  id: "ledger",
  lang: "ledger",
  category: "finance",
  displayName: "记账",
  description: "快速记账 + 本月分类条形汇总。",
  premium: true,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new LedgerChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 记账";
  },
};
