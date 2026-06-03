import { MarkdownPostProcessorContext, MarkdownRenderChild, Notice } from "obsidian";
import { fsrs, createEmptyCard, Rating, FSRS } from "ts-fsrs";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { genId } from "../../core/util";
import { Collection, HMRecord } from "../../core/storage";
import { createCard } from "../../ui/components/Card";
import { promptText } from "../../ui/components/modal-helpers";
import { SerializedCard, serializeCard, reviveCard } from "../vocab/model";

interface FlashCard extends HMRecord {
  front: string;
  back: string;
  fsrs: SerializedCard;
}

class FlashcardsChild extends BaseRenderChild {
  private cards!: Collection<FlashCard>;
  private f: FSRS = fsrs();
  private revealed = false;

  onload(): void {
    this.cards = this.ctx.storage.collection<FlashCard>("flashcards/cards");
    void this.cards.refresh().then(() => this.draw());
    this.registerEvent(
      this.ctx.bus.on("storage:changed", (p) => {
        if (p.collection === "flashcards/cards") this.draw();
      })
    );
  }

  private due(): FlashCard[] {
    const now = Date.now();
    return this.cards
      .all()
      .filter((c) => new Date(c.fsrs.due).getTime() <= now)
      .sort((a, b) => new Date(a.fsrs.due).getTime() - new Date(b.fsrs.due).getTime());
  }

  private draw(): void {
    this.containerEl.empty();
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "记忆卡片",
      icon: "layers",
      cls: "hm-flash",
    });
    const due = this.due();
    body.createDiv({ cls: "hm-muted", text: `待复习 ${due.length} / 总计 ${this.cards.all().length}` });

    if (due.length === 0) {
      body.createDiv({ cls: "hm-vocab-done", text: "🎉 没有到期卡片" });
    } else {
      const c = due[0];
      const box = body.createDiv({ cls: "hm-vocab-card" });
      box.createDiv({ cls: "hm-vocab-word", text: c.front });
      if (!this.revealed) {
        const show = box.createEl("button", { cls: "mod-cta", text: "翻面" });
        show.onclick = () => {
          this.revealed = true;
          this.draw();
        };
      } else {
        box.createDiv({ cls: "hm-vocab-meaning", text: c.back });
        const rate = box.createDiv({ cls: "hm-vocab-rate" });
        const mk = (label: string, r: Rating, cls: string) => {
          rate.createEl("button", { text: label, cls }).onclick = () => this.rate(c, r);
        };
        mk("忘记", Rating.Again, "hm-rate-again");
        mk("困难", Rating.Hard, "hm-rate-hard");
        mk("认识", Rating.Good, "hm-rate-good");
        mk("简单", Rating.Easy, "hm-rate-easy");
      }
    }
    const add = body.createEl("button", { cls: "hm-todo-add", text: "+ 新卡片" });
    add.onclick = () => this.add();
  }

  private rate(c: FlashCard, rating: Rating): void {
    const record = this.f.repeat(reviveCard(c.fsrs), new Date()) as unknown as Record<
      number,
      { card: Parameters<typeof serializeCard>[0] }
    >;
    this.cards.upsert({ ...c, fsrs: serializeCard(record[rating].card) });
    this.revealed = false;
    this.draw();
  }

  private async add(): Promise<void> {
    const front = await promptText(this.ctx.app, "正面（问题）", "");
    if (!front) return;
    const back = await promptText(this.ctx.app, "背面（答案）", "");
    if (!back) return;
    this.cards.upsert({
      id: genId(),
      front,
      back,
      fsrs: serializeCard(createEmptyCard(new Date())),
    } as FlashCard);
    new Notice("已添加卡片");
  }
}

export const flashcardsModule: HMModule = {
  id: "flashcards",
  lang: "flashcards",
  category: "learning",
  displayName: "记忆卡片",
  description: "自建正反面卡片，FSRS 间隔重复复习。",
  premium: true,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new FlashcardsChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 记忆卡片";
  },
};
