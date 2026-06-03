import { MarkdownPostProcessorContext, MarkdownRenderChild, Notice } from "obsidian";
import { fsrs, createEmptyCard, Rating, FSRS } from "ts-fsrs";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { genId } from "../../core/util";
import { Collection } from "../../core/storage";
import { createCard } from "../../ui/components/Card";
import { renderHeatmap, dateKey } from "../../ui/components/Heatmap";
import { promptChoice } from "../../ui/components/modal-helpers";
import { VocabCard, VocabReview, serializeCard, reviveCard } from "./model";
import { WORDBANK, LEVELS, WordEntry } from "./wordbank";
import { loadFullBank } from "./wordbank-loader";

const LEVEL_LABEL: Record<string, string> = {
  cet4: "四级",
  cet6: "六级",
  ielts: "雅思",
  daily: "日常",
};
function levelName(id: string): string {
  return LEVEL_LABEL[id] ?? id;
}

class VocabChild extends BaseRenderChild {
  private cards!: Collection<VocabCard>;
  private reviews!: Collection<VocabReview>;
  private f: FSRS = fsrs();
  private revealed = false;
  private levelFilter: string | null = null; // null=全部
  private wrongOnly = false; // 错词本模式

  onload(): void {
    this.cards = this.ctx.storage.collection<VocabCard>("vocab/cards");
    this.reviews = this.ctx.storage.collection<VocabReview>("vocab/reviews");
    void Promise.all([this.cards.refresh(), this.reviews.refresh()]).then(() => this.draw());
    this.registerEvent(
      this.ctx.bus.on("storage:changed", (p) => {
        if (p.collection.startsWith("vocab/")) this.draw();
      })
    );
  }

  private matchLevel(c: VocabCard): boolean {
    return !this.levelFilter || (c.level ?? "其它") === this.levelFilter;
  }

  /** 当前复习池：错词本模式取所有错词，否则取到期词；均按等级筛选。 */
  private reviewPool(): VocabCard[] {
    const now = Date.now();
    return this.cards
      .all()
      .filter((c) => this.matchLevel(c))
      .filter((c) => (this.wrongOnly ? c.wrong : new Date(c.fsrs.due).getTime() <= now))
      .sort((a, b) => new Date(a.fsrs.due).getTime() - new Date(b.fsrs.due).getTime());
  }

  private wrongCount(): number {
    return this.cards.all().filter((c) => c.wrong).length;
  }

  private draw(): void {
    this.containerEl.empty();
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "背单词",
      icon: "book-open",
      cls: "hm-vocab",
    });

    const total = this.cards.all().length;
    if (total === 0) {
      body.createDiv({ cls: "hm-muted", text: "卡片库为空，选择一个分级词库导入。" });
      const imp = body.createEl("button", { cls: "mod-cta", text: "导入分级词库" });
      imp.onclick = () => this.importBank();
      return;
    }

    // 按等级进度 / 正确率
    this.drawLevelStats(body);

    // 筛选条：全部 / 各等级 / 错词本
    this.drawFilter(body);

    const pool = this.reviewPool();
    body.createDiv({
      cls: "hm-vocab-stat hm-muted",
      text: this.wrongOnly
        ? `错词本 ${pool.length} 个`
        : `待复习 ${pool.length} / 总计 ${total}`,
    });

    if (pool.length === 0) {
      body.createDiv({
        cls: "hm-vocab-done",
        text: this.wrongOnly ? "🎉 错词本已清空！" : "🎉 今天没有到期的单词了！",
      });
    } else {
      this.drawReview(body, pool[0]);
    }

    const data: Record<string, number> = {};
    for (const r of this.reviews.all()) data[r.date] = (data[r.date] ?? 0) + 1;
    renderHeatmap(body.createDiv({ cls: "hm-vocab-heatmap" }), data, { unit: " 次" });

    const more = body.createDiv({ cls: "hm-vocab-actions" });
    const imp = more.createEl("button", { text: "导入分级词库" });
    imp.onclick = () => this.importBank();
  }

  /** 各等级：已学/总数进度条 + 正确率。 */
  private drawLevelStats(parent: HTMLElement): void {
    // 按 level 分组卡片
    const byLevel = new Map<string, VocabCard[]>();
    for (const c of this.cards.all()) {
      const lv = c.level ?? "其它";
      (byLevel.get(lv) ?? byLevel.set(lv, []).get(lv)!).push(c);
    }
    if (byLevel.size === 0) return;

    // 每张卡的等级，用于汇总正确率
    const cardLevel = new Map<string, string>();
    for (const c of this.cards.all()) cardLevel.set(c.id, c.level ?? "其它");
    const reviewStat = new Map<string, { correct: number; total: number }>();
    for (const r of this.reviews.all()) {
      const lv = cardLevel.get(r.cardId);
      if (!lv) continue;
      const s = reviewStat.get(lv) ?? { correct: 0, total: 0 };
      s.total++;
      if (r.correct) s.correct++;
      reviewStat.set(lv, s);
    }

    const wrap = parent.createDiv({ cls: "hm-vocab-levels" });
    for (const [lv, cards] of byLevel) {
      const studied = cards.filter((c) => c.fsrs.reps > 0).length;
      const pct = (studied / cards.length) * 100;
      const rs = reviewStat.get(lv);
      const acc = rs && rs.total ? Math.round((rs.correct / rs.total) * 100) : null;

      const row = wrap.createDiv({ cls: "hm-vocab-level" });
      const head = row.createDiv({ cls: "hm-vocab-level-head" });
      head.createSpan({ cls: "hm-vocab-level-name", text: levelName(lv) });
      head.createSpan({
        cls: "hm-muted",
        text: `已学 ${studied}/${cards.length}${acc !== null ? ` · 正确率 ${acc}%` : ""}`,
      });
      const bar = row.createDiv({ cls: "hm-bar" });
      bar.createDiv({ cls: "hm-bar-fill" }).style.width = `${pct}%`;
    }
  }

  private drawFilter(parent: HTMLElement): void {
    const bar = parent.createDiv({ cls: "hm-vocab-filter" });
    const levels = Array.from(new Set(this.cards.all().map((c) => c.level ?? "其它"))).sort();
    const pill = (label: string, active: boolean, on: () => void) => {
      const b = bar.createEl("button", { cls: "hm-pill" + (active ? " hm-active" : ""), text: label });
      b.onclick = () => {
        on();
        this.revealed = false;
        this.draw();
      };
    };
    pill("全部", !this.levelFilter && !this.wrongOnly, () => {
      this.levelFilter = null;
      this.wrongOnly = false;
    });
    for (const lv of levels) {
      pill(levelName(lv), this.levelFilter === lv && !this.wrongOnly, () => {
        this.levelFilter = lv;
        this.wrongOnly = false;
      });
    }
    const wc = this.wrongCount();
    pill(`错词本 ${wc}`, this.wrongOnly, () => {
      this.wrongOnly = !this.wrongOnly;
    });
  }

  private drawReview(parent: HTMLElement, card: VocabCard): void {
    const box = parent.createDiv({ cls: "hm-vocab-card" });
    if (card.level) box.createSpan({ cls: "hm-badge", text: levelName(card.level) });
    box.createDiv({ cls: "hm-vocab-word", text: card.word });
    if (card.reading) box.createDiv({ cls: "hm-vocab-reading hm-muted", text: card.reading });

    if (!this.revealed) {
      const show = box.createEl("button", { cls: "mod-cta", text: "显示释义" });
      show.onclick = () => {
        this.revealed = true;
        this.draw();
      };
      return;
    }

    box.createDiv({ cls: "hm-vocab-meaning", text: card.meaning });
    const rate = box.createDiv({ cls: "hm-vocab-rate" });
    const mk = (label: string, rating: Rating, cls: string) => {
      const b = rate.createEl("button", { text: label, cls });
      b.onclick = () => this.rate(card, rating);
    };
    mk("忘记", Rating.Again, "hm-rate-again");
    mk("困难", Rating.Hard, "hm-rate-hard");
    mk("认识", Rating.Good, "hm-rate-good");
    mk("简单", Rating.Easy, "hm-rate-easy");
  }

  private rate(card: VocabCard, rating: Rating): void {
    const now = new Date();
    const record = this.f.repeat(reviveCard(card.fsrs), now) as unknown as Record<
      number,
      { card: Parameters<typeof serializeCard>[0] }
    >;
    const scheduled = record[rating].card;
    const correct = rating >= Rating.Good;
    this.cards.upsert({ ...card, fsrs: serializeCard(scheduled), wrong: !correct });
    this.reviews.upsert({
      id: genId(),
      cardId: card.id,
      date: dateKey(now),
      correct: rating >= Rating.Good,
    } as VocabReview);
    this.ctx.bus.emit("vocab:reviewed", { cardId: card.id, at: now.getTime() });
    this.revealed = false;
    this.draw();
  }

  private async importBank(): Promise<void> {
    const full = await loadFullBank(this.ctx.app, this.ctx.plugin);
    // 构造可选等级：优先用完整词库，缺失则用内置精简集
    const options: { value: string; label: string; words: WordEntry[] }[] = [];
    if (full) {
      for (const [lv, words] of Object.entries(full)) {
        options.push({ value: lv, label: `${levelName(lv)}（完整 ${words.length} 词）`, words });
      }
    } else {
      for (const l of LEVELS) {
        options.push({ value: l.id, label: `${l.name}（${l.words.length} 词）`, words: l.words });
      }
      options.push({ value: "__all__", label: `全部内置（${WORDBANK.length} 词）`, words: WORDBANK });
    }

    const choice = await promptChoice(
      this.ctx.app,
      full ? "选择要导入的完整词库" : "选择要导入的词库（未找到完整词库文件，使用内置）",
      options.map((o) => ({ value: o.value, label: o.label }))
    );
    if (!choice) return;
    const opt = options.find((o) => o.value === choice);
    if (!opt) return;

    const existing = new Set(this.cards.all().map((c) => c.word.toLowerCase()));
    const now = new Date();
    const batch: VocabCard[] = [];
    for (const word of opt.words) {
      if (existing.has(word.word.toLowerCase())) continue;
      existing.add(word.word.toLowerCase());
      batch.push({
        id: genId(),
        word: word.word,
        reading: word.reading,
        meaning: word.meaning,
        level: choice === "__all__" ? undefined : choice,
        fsrs: serializeCard(createEmptyCard(now)),
      } as VocabCard);
    }
    this.cards.upsertMany(batch); // 一次性写入 + 单次刷新，避免万词导入卡顿
    new Notice(batch.length ? `已导入 ${batch.length} 个新单词` : "没有新单词可导入");
  }
}

export const vocabModule: HMModule = {
  id: "vocab",
  lang: "vocab",
  category: "learning",
  displayName: "背单词",
  description: "FSRS 间隔重复 + 四级/六级/雅思完整词库（约 1.4 万词）+ 按等级进度与正确率。",
  premium: true,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new VocabChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 背单词";
  },
};
