import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { genId } from "../../core/util";
import { Collection, HMRecord } from "../../core/storage";
import { createCard } from "../../ui/components/Card";
import { promptText } from "../../ui/components/modal-helpers";

type ReadStatus = "want" | "reading" | "done";
interface Book extends HMRecord {
  title: string;
  status: ReadStatus;
  progress: number; // 0-100
}

const STATUS_LABEL: Record<ReadStatus, string> = {
  want: "想读",
  reading: "在读",
  done: "读完",
};

class ReadingChild extends BaseRenderChild {
  private books!: Collection<Book>;

  onload(): void {
    this.books = this.ctx.storage.collection<Book>("reading/items");
    void this.books.refresh().then(() => this.draw());
    this.registerEvent(
      this.ctx.bus.on("storage:changed", (p) => {
        if (p.collection === "reading/items") this.draw();
      })
    );
  }

  private draw(): void {
    this.containerEl.empty();
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "读书清单",
      icon: "book-marked",
      cls: "hm-reading",
    });
    for (const b of this.books.all()) {
      const row = body.createDiv({ cls: "hm-reading-row" });
      const head = row.createDiv({ cls: "hm-reading-head" });
      head.createSpan({ text: b.title });
      const st = head.createEl("button", { cls: "hm-badge", text: STATUS_LABEL[b.status] });
      st.onclick = () => {
        const order: ReadStatus[] = ["want", "reading", "done"];
        const next = order[(order.indexOf(b.status) + 1) % 3];
        this.books.upsert({ ...b, status: next, progress: next === "done" ? 100 : b.progress });
      };
      const bar = row.createDiv({ cls: "hm-bar" });
      bar.createDiv({ cls: "hm-bar-fill" }).style.width = `${b.progress}%`;
      const ctrl = row.createDiv({ cls: "hm-goal-ctrl" });
      const minus = ctrl.createEl("button", { text: "－10%" });
      minus.onclick = () => this.books.upsert({ ...b, progress: Math.max(0, b.progress - 10) });
      const plus = ctrl.createEl("button", { text: "＋10%" });
      plus.onclick = () =>
        this.books.upsert({ ...b, progress: Math.min(100, b.progress + 10) });
      const del = ctrl.createEl("button", { cls: "hm-icon-btn", text: "🗑" });
      del.onclick = () => this.books.remove(b.id);
    }
    const add = body.createEl("button", { cls: "hm-todo-add", text: "+ 书" });
    add.onclick = () => this.add();
  }

  private async add(): Promise<void> {
    const title = await promptText(this.ctx.app, "书名", "");
    if (!title) return;
    this.books.upsert({ id: genId(), title, status: "want", progress: 0 });
  }
}

export const readingModule: HMModule = {
  id: "reading",
  lang: "reading",
  category: "learning",
  displayName: "读书清单",
  description: "想读/在读/读完 + 进度条。",
  premium: true,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new ReadingChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 读书清单";
  },
};
