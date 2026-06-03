import {
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  MarkdownView,
  Notice,
} from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { genId } from "../../core/util";
import { createCard } from "../../ui/components/Card";
import { TodoStore } from "../todo/store";

class AISummaryChild extends BaseRenderChild {
  private out!: HTMLElement;

  onload(): void {
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "AI 摘要",
      icon: "sparkles",
      cls: "hm-aisum",
    });
    const sumBtn = body.createEl("button", { cls: "mod-cta", text: "摘要当前笔记" });
    sumBtn.onclick = () => void this.run(false);
    const taskBtn = body.createEl("button", { text: "提取待办 → 派单到今日" });
    taskBtn.onclick = () => void this.run(true);
    this.out = body.createDiv({ cls: "hm-aisum-out" });
  }

  private activeContent(): string | null {
    const view = this.ctx.app.workspace.getActiveViewOfType(MarkdownView);
    return view ? view.editor.getValue() : null;
  }

  private async run(extractTasks: boolean): Promise<void> {
    const content = this.activeContent();
    if (!content) {
      new Notice("请先打开一篇笔记");
      return;
    }
    if (!this.ctx.ai.isConfigured()) {
      new Notice("请先在设置中配置 AI");
      return;
    }
    this.out.setText("思考中…");

    const prompt = extractTasks
      ? `从下面的笔记中提取可执行的待办事项，每行一条，以「- 」开头，不要解释：\n\n${content}`
      : `用中文简洁总结下面的笔记，3-5 句要点：\n\n${content}`;

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
      if (extractTasks) this.dispatchTasks(acc);
    } catch (e) {
      new Notice((e as Error).message);
      this.out.setText("");
    }
  }

  private dispatchTasks(text: string): void {
    const lines = text
      .split("\n")
      .map((l) => l.replace(/^[-*•\d.\s]+/, "").trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) {
      new Notice("没有提取到待办");
      return;
    }
    const store = new TodoStore(this.ctx);
    // 找到/创建「AI 待办」项目
    let project = store.projectsOf("main").find((p) => p.name === "AI 待办");
    if (!project) {
      project = store.projects.upsert({
        id: genId(),
        boardId: "main",
        name: "AI 待办",
        order: store.nextOrder(store.projectsOf("main")),
      });
    }
    for (const title of lines) {
      store.tasks.upsert({
        id: genId(),
        boardId: "main",
        projectId: project.id,
        title,
        done: false,
        today: true,
        order: store.nextOrder(store.tasksOf(project.id)),
      });
    }
    new Notice(`已派单 ${lines.length} 条到今日`);
  }
}

export const aiSummaryModule: HMModule = {
  id: "ai-summary",
  lang: "ai-summary",
  category: "ai",
  displayName: "AI 摘要",
  description: "摘要当前笔记，或提取待办并一键派单到今日。",
  premium: true,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new AISummaryChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: AI 摘要";
  },
};
