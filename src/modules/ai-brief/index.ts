import { MarkdownPostProcessorContext, MarkdownRenderChild, Notice } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { createCard } from "../../ui/components/Card";
import { dateKey } from "../../ui/components/Heatmap";
import { TodoStore } from "../todo/store";

class AIBriefChild extends BaseRenderChild {
  private out!: HTMLElement;

  onload(): void {
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "今日晨报",
      icon: "sunrise",
      cls: "hm-aibrief",
    });
    const btn = body.createEl("button", { cls: "mod-cta", text: "生成今日晨报" });
    btn.onclick = () => void this.run();
    this.out = body.createDiv({ cls: "hm-aibrief-out" });
  }

  private async run(): Promise<void> {
    if (!this.ctx.ai.isConfigured()) {
      new Notice("请先在设置中配置 AI");
      return;
    }
    const store = new TodoStore(this.ctx);
    await store.refreshAll();
    const today = dateKey(new Date());
    const tasks = store.todayTasks(today).filter((t) => !t.done);
    const taskList = tasks.length
      ? tasks.map((t) => `- ${t.title}`).join("\n")
      : "（今天还没有安排任务）";

    const prompt = `你是我的私人效率助手。今天是 ${today}。这是我今天的待办：\n${taskList}\n\n请用中文写一段简短、积极的晨间简报（不超过 5 句），帮我聚焦今天最重要的事，并给一句鼓励。`;

    this.out.setText("生成中…");
    try {
      let acc = "";
      await this.ctx.ai.chat({
        messages: [{ role: "user", content: prompt }],
        stream: true,
        onToken: (d) => {
          acc += d;
          this.out.setText(acc);
        },
      });
    } catch (e) {
      new Notice((e as Error).message);
      this.out.setText("");
    }
  }
}

export const aiBriefModule: HMModule = {
  id: "ai-brief",
  lang: "ai-brief",
  category: "ai",
  displayName: "今日晨报",
  description: "根据今日待办自动生成一段积极的晨间简报。",
  premium: true,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new AIBriefChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 今日晨报";
  },
};
