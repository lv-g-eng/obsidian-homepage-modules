import { MarkdownPostProcessorContext, MarkdownRenderChild, Notice, TFile } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { createCard } from "../../ui/components/Card";

class CaptureChild extends BaseRenderChild {
  private input!: HTMLTextAreaElement;
  private get target(): string {
    return this.params.target ?? "Inbox.md";
  }

  onload(): void {
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "快速捕获",
      icon: "inbox",
      cls: "hm-capture",
    });
    this.input = body.createEl("textarea", {
      attr: { rows: "3", placeholder: `写点什么，回车保存到 ${this.target}` },
    });
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void this.save();
      }
    });
    const btn = body.createEl("button", { cls: "mod-cta", text: "保存 (Ctrl+Enter)" });
    btn.onclick = () => void this.save();
  }

  private async save(): Promise<void> {
    const text = this.input.value.trim();
    if (!text) return;
    const vault = this.ctx.app.vault;
    const time = new Date().toLocaleTimeString();
    const line = `- [ ] ${text}  _(${time})_\n`;
    const existing = vault.getAbstractFileByPath(this.target);
    if (existing instanceof TFile) {
      await vault.append(existing, line);
    } else {
      await vault.create(this.target, `# Inbox\n\n${line}`);
    }
    this.input.value = "";
    new Notice(`已保存到 ${this.target}`);
  }
}

export const captureModule: HMModule = {
  id: "capture",
  lang: "capture",
  category: "productivity",
  displayName: "快速捕获",
  description: "随手记录追加到收件箱笔记。block 可写 target: Inbox.md",
  premium: true,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new CaptureChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 快速捕获\ntarget: Inbox.md";
  },
};
