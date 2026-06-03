import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { Collection } from "../../core/storage";
import { createCard } from "../../ui/components/Card";
import { VocabCard } from "../vocab/model";

interface DueCard {
  fsrs: { due: string };
}

class ReviewQueueChild extends BaseRenderChild {
  private vocab!: Collection<VocabCard>;
  private flash!: Collection<VocabCard>; // 结构上 due 字段相同，仅取 fsrs.due

  onload(): void {
    this.vocab = this.ctx.storage.collection<VocabCard>("vocab/cards");
    this.flash = this.ctx.storage.collection<VocabCard>("flashcards/cards");
    void Promise.all([this.vocab.refresh(), this.flash.refresh()]).then(() => this.draw());
    this.registerEvent(
      this.ctx.bus.on("storage:changed", (p) => {
        if (p.collection.startsWith("vocab/") || p.collection.startsWith("flashcards/"))
          this.draw();
      })
    );
  }

  private dueCount(items: DueCard[]): number {
    const now = Date.now();
    return items.filter((c) => new Date(c.fsrs.due).getTime() <= now).length;
  }

  private draw(): void {
    this.containerEl.empty();
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "复习队列",
      icon: "list-checks",
      cls: "hm-reviewq",
    });
    const v = this.dueCount(this.vocab.all());
    const f = this.dueCount(this.flash.all());
    const grid = body.createDiv({ cls: "hm-stats-grid" });
    const cell = (label: string, n: number) => {
      const c = grid.createDiv({ cls: "hm-stat-cell" });
      c.createDiv({ cls: "hm-stat-value", text: String(n) });
      c.createDiv({ cls: "hm-stat-label hm-muted", text: label });
    };
    cell("单词待复习", v);
    cell("卡片待复习", f);
    cell("合计", v + f);
    if (v + f === 0) body.createDiv({ cls: "hm-muted", text: "今天都复习完啦 🎉" });
    else
      body.createDiv({
        cls: "hm-muted",
        text: "打开「背单词」/「记忆卡片」模块开始复习。",
      });
  }
}

export const reviewQueueModule: HMModule = {
  id: "review-queue",
  lang: "review-queue",
  category: "learning",
  displayName: "复习队列",
  description: "汇总背单词与记忆卡片的到期数量。",
  premium: true,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new ReviewQueueChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 复习队列";
  },
};
