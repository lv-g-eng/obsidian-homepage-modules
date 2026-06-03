import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { genId } from "../../core/util";
import { Collection, HMRecord } from "../../core/storage";
import { createCard } from "../../ui/components/Card";
import { promptText } from "../../ui/components/modal-helpers";

interface Sub extends HMRecord {
  name: string;
  amount: number;
  cycleDays: number; // 计费周期天数
  nextDate: string; // YYYY-MM-DD
}

function daysUntil(date: string): number {
  const t = new Date(date + "T00:00:00").getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((t - today.getTime()) / 86400000);
}

class SubsChild extends BaseRenderChild {
  private subs!: Collection<Sub>;

  onload(): void {
    this.subs = this.ctx.storage.collection<Sub>("subs/items");
    void this.subs.refresh().then(() => this.draw());
    this.registerEvent(
      this.ctx.bus.on("storage:changed", (p) => {
        if (p.collection === "subs/items") this.draw();
      })
    );
  }

  private draw(): void {
    this.containerEl.empty();
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "订阅",
      icon: "credit-card",
      cls: "hm-subs",
    });
    const monthly = this.subs
      .all()
      .reduce((s, x) => s + (x.amount / x.cycleDays) * 30, 0);
    body.createDiv({ cls: "hm-muted", text: `月均成本 ≈ ¥${monthly.toFixed(0)}` });

    for (const s of this.subs.all().sort((a, b) => daysUntil(a.nextDate) - daysUntil(b.nextDate))) {
      const row = body.createDiv({ cls: "hm-subs-row" });
      row.createSpan({ text: s.name });
      row.createSpan({ cls: "hm-muted", text: `¥${s.amount} / ${s.cycleDays}天` });
      const d = daysUntil(s.nextDate);
      row.createSpan({ cls: "hm-badge", text: d >= 0 ? `${d}天后续费` : "已到期" });
      const del = row.createEl("button", { cls: "hm-icon-btn", text: "🗑" });
      del.onclick = () => this.subs.remove(s.id);
    }
    const add = body.createEl("button", { cls: "hm-todo-add", text: "+ 订阅" });
    add.onclick = () => this.add();
  }

  private async add(): Promise<void> {
    const name = await promptText(this.ctx.app, "订阅名称", "");
    if (!name) return;
    const amount = await promptText(this.ctx.app, "金额", "");
    const cycle = await promptText(this.ctx.app, "周期天数（月=30，年=365）", "30");
    const nextDate = await promptText(this.ctx.app, "下次续费日期 YYYY-MM-DD", "");
    if (!nextDate) return;
    this.subs.upsert({
      id: genId(),
      name,
      amount: Number(amount) || 0,
      cycleDays: Number(cycle) || 30,
      nextDate,
    });
  }
}

export const subsModule: HMModule = {
  id: "subs",
  lang: "subs",
  category: "finance",
  displayName: "订阅管理",
  description: "订阅费用 + 续费倒计时 + 月均成本估算。",
  premium: true,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new SubsChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 订阅管理";
  },
};
