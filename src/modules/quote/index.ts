import { MarkdownPostProcessorContext, MarkdownRenderChild, setIcon } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { createCard } from "../../ui/components/Card";

const QUOTES: { text: string; by: string }[] = [
  { text: "种一棵树最好的时间是十年前，其次是现在。", by: "谚语" },
  { text: "你不必很厉害才能开始，但你必须开始才能很厉害。", by: "Zig Ziglar" },
  { text: "行动是治愈恐惧的良药，而犹豫拖延将不断滋养恐惧。", by: "戴尔·卡耐基" },
  { text: "我们重复做的事造就了我们，因此卓越不是行为，而是习惯。", by: "亚里士多德" },
  { text: "专注于当下你能控制的那一件小事。", by: "佚名" },
  { text: "完成胜过完美。", by: "佚名" },
  { text: "每天进步一点点，一年就是三十多倍。", by: "复利效应" },
  { text: "把大事拆成小步，小步拆成今天。", by: "佚名" },
  { text: "自律给我自由。", by: "佚名" },
  { text: "慢就是快，少就是多。", by: "佚名" },
  { text: "今天的努力，是为了让明天的选择更从容。", by: "佚名" },
  { text: "你怎么过一天，就怎么过一生。", by: "安妮·迪拉德" },
];

class QuoteChild extends BaseRenderChild {
  private idx = 0;
  private textEl!: HTMLElement;
  private byEl!: HTMLElement;

  onload(): void {
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "每日一言",
      icon: "quote",
      cls: "hm-quote",
    });
    this.textEl = body.createDiv({ cls: "hm-quote-text" });
    this.byEl = body.createDiv({ cls: "hm-quote-by hm-muted" });
    const actions = body.createDiv({ cls: "hm-quote-actions" });
    const next = actions.createEl("button", { cls: "hm-icon-btn", title: "换一句" });
    setIcon(next.createSpan(), "refresh-cw");
    next.onclick = () => {
      this.idx = (this.idx + 1) % QUOTES.length;
      this.paint();
    };

    // 按当天序号选句，保证「每日一言」稳定
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    this.idx = dayOfYear % QUOTES.length;
    this.paint();
  }

  private paint(): void {
    const q = QUOTES[this.idx];
    this.textEl.setText(`“${q.text}”`);
    this.byEl.setText(`— ${q.by}`);
  }
}

export const quoteModule: HMModule = {
  id: "quote",
  lang: "quote",
  category: "utility",
  displayName: "每日一言",
  description: "每天一句励志/效率箴言，可手动换一句。免费模块。",
  premium: false,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new QuoteChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 每日一言";
  },
};
