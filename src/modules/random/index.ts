import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { createCard } from "../../ui/components/Card";

class RandomChild extends BaseRenderChild {
  onload(): void {
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "随机决定",
      icon: "dices",
      cls: "hm-random",
    });
    const result = body.createDiv({ cls: "hm-random-result", text: "—" });

    const list = (this.params.list ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const row = body.createDiv({ cls: "hm-random-actions" });
    const dice = row.createEl("button", { cls: "mod-cta", text: "🎲 掷骰子" });
    dice.onclick = () => {
      result.setText(String(1 + Math.floor(Math.random() * 6)));
    };
    if (list.length) {
      const pick = row.createEl("button", { text: "🎯 抽一个" });
      pick.onclick = () => {
        result.setText(list[Math.floor(Math.random() * list.length)]);
      };
    }
    const coin = row.createEl("button", { text: "🪙 抛硬币" });
    coin.onclick = () => result.setText(Math.random() < 0.5 ? "正面" : "反面");
  }
}

export const randomModule: HMModule = {
  id: "random",
  lang: "random",
  category: "utility",
  displayName: "随机决定",
  description: "骰子 / 抛硬币 / 从清单抽选。免费模块。block 可写 list: a,b,c",
  premium: false,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new RandomChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 随机决定\nlist: 吃面, 吃饭, 点外卖";
  },
};
