import {
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  MarkdownView,
  Notice,
} from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { genId } from "../../core/util";
import { Collection, HMRecord } from "../../core/storage";
import { createCard } from "../../ui/components/Card";
import { ChatMessage } from "../../ai/ai-types";

const CTX_LIMIT = 6000; // 笔记上下文截断长度，控制 token

interface ChatMsg extends HMRecord {
  threadId: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
}

class AIChatChild extends BaseRenderChild {
  private msgs!: Collection<ChatMsg>;
  private listEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private sending = false;
  private useContext = false;

  private get threadId(): string {
    return this.params.thread ?? "main";
  }

  onload(): void {
    this.msgs = this.ctx.storage.collection<ChatMsg>("ai-chat/messages");
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "AI 助手",
      icon: "bot",
      cls: "hm-aichat",
    });
    this.listEl = body.createDiv({ cls: "hm-aichat-list" });

    // 工具条：附带当前笔记作为上下文
    const toolbar = body.createDiv({ cls: "hm-aichat-toolbar" });
    const ctxLabel = toolbar.createEl("label", { cls: "hm-aichat-ctx" });
    const ctxCb = ctxLabel.createEl("input", { type: "checkbox" });
    ctxCb.checked = this.useContext;
    ctxCb.onchange = () => (this.useContext = ctxCb.checked);
    ctxLabel.createSpan({ text: " 附带当前笔记" });

    const inputRow = body.createDiv({ cls: "hm-aichat-input" });
    this.inputEl = inputRow.createEl("textarea", {
      attr: { rows: "2", placeholder: "问点什么…（Enter 发送，Shift+Enter 换行）" },
    });
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void this.send();
      }
    });
    const send = inputRow.createEl("button", { cls: "mod-cta", text: "发送" });
    send.onclick = () => void this.send();

    void this.msgs.refresh().then(() => this.draw());
  }

  private thread(): ChatMsg[] {
    return this.msgs
      .all()
      .filter((m) => m.threadId === this.threadId)
      .sort((a, b) => a.ts - b.ts);
  }

  private draw(): void {
    this.listEl.empty();
    for (const m of this.thread()) {
      const bubble = this.listEl.createDiv({ cls: `hm-aichat-msg hm-${m.role}` });
      bubble.createDiv({ cls: "hm-aichat-text", text: m.content });
      if (m.role === "assistant") {
        const tools = bubble.createDiv({ cls: "hm-aichat-msgtools" });
        const write = tools.createEl("button", { cls: "hm-icon-btn", text: "写入笔记" });
        write.onclick = () => this.writeToNote(m.content);
        const copy = tools.createEl("button", { cls: "hm-icon-btn", text: "复制" });
        copy.onclick = () => {
          void navigator.clipboard?.writeText(m.content);
          new Notice("已复制");
        };
      }
    }
    this.listEl.scrollTop = this.listEl.scrollHeight;
  }

  private activeNoteContent(): string | null {
    const view = this.ctx.app.workspace.getActiveViewOfType(MarkdownView);
    return view ? view.editor.getValue() : null;
  }

  private writeToNote(text: string): void {
    const view = this.ctx.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      new Notice("请先打开一篇笔记");
      return;
    }
    view.editor.replaceSelection(text + "\n");
    new Notice("已写入当前笔记");
  }

  private async send(): Promise<void> {
    if (this.sending) return;
    const text = this.inputEl.value.trim();
    if (!text) return;
    if (!this.ctx.ai.isConfigured()) {
      new Notice("请先在设置中配置 AI");
      return;
    }
    this.sending = true;
    this.inputEl.value = "";

    this.msgs.upsert({
      id: genId(),
      threadId: this.threadId,
      role: "user",
      content: text,
      ts: Date.now(),
    } as ChatMsg);
    this.draw();

    const history: ChatMessage[] = this.thread().map((m) => ({
      role: m.role,
      content: m.content,
    }));
    if (this.useContext) {
      const note = this.activeNoteContent();
      if (note) {
        history.unshift({
          role: "system",
          content: `以下是用户当前笔记的内容，回答时请参考：\n\n${note.slice(0, CTX_LIMIT)}`,
        });
      } else {
        new Notice("没有打开的笔记，本次未附带上下文");
      }
    }

    // 先放一个空的 assistant 气泡用于流式填充
    const live = this.listEl.createDiv({ cls: "hm-aichat-msg hm-assistant" });
    let acc = "";
    try {
      const full = await this.ctx.ai.chat({
        messages: history,
        stream: true,
        onToken: (d) => {
          acc += d;
          live.setText(acc);
          this.listEl.scrollTop = this.listEl.scrollHeight;
        },
      });
      const finalText = full || acc;
      this.msgs.upsert({
        id: genId(),
        threadId: this.threadId,
        role: "assistant",
        content: finalText,
        ts: Date.now(),
      } as ChatMsg);
    } catch (e) {
      new Notice((e as Error).message);
      live.remove();
    } finally {
      this.sending = false;
      this.draw();
    }
  }
}

export const aiChatModule: HMModule = {
  id: "ai-chat",
  lang: "ai-chat",
  category: "ai",
  displayName: "AI 助手",
  description: "OpenAI 兼容对话，桌面流式 / 移动整段，记录本地。",
  premium: true,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new AIChatChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: AI 助手\nthread: main";
  },
};
