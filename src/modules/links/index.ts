import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { genId } from "../../core/util";
import { Collection, HMRecord } from "../../core/storage";
import { createCard } from "../../ui/components/Card";
import { promptText } from "../../ui/components/modal-helpers";

interface LinkItem extends HMRecord {
  label: string;
  url: string;
  order: number;
}

class LinksChild extends BaseRenderChild {
  private items!: Collection<LinkItem>;

  onload(): void {
    this.items = this.ctx.storage.collection<LinkItem>("links/items");
    void this.items.refresh().then(() => this.draw());
    this.registerEvent(
      this.ctx.bus.on("storage:changed", (p) => {
        if (p.collection === "links/items") this.draw();
      })
    );
  }

  private draw(): void {
    this.containerEl.empty();
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "快捷链接",
      icon: "link",
      cls: "hm-links",
    });
    const grid = body.createDiv({ cls: "hm-links-grid" });
    for (const it of this.items.all().sort((a, b) => a.order - b.order)) {
      const a = grid.createEl("a", { cls: "hm-link", text: it.label, href: it.url });
      a.setAttr("target", "_blank");
      a.oncontextmenu = (e) => {
        e.preventDefault();
        this.items.remove(it.id);
      };
    }
    const add = grid.createEl("button", { cls: "hm-link hm-link-add", text: "＋" });
    add.onclick = () => this.add();
  }

  private async add(): Promise<void> {
    const label = await promptText(this.ctx.app, "名称", "");
    if (!label) return;
    const url = await promptText(this.ctx.app, "链接 URL", "https://");
    if (!url) return;
    this.items.upsert({
      id: genId(),
      label,
      url,
      order: this.items.all().length,
    });
  }
}

export const linksModule: HMModule = {
  id: "links",
  lang: "links",
  category: "dashboard",
  displayName: "快捷链接",
  description: "常用网址/资源网格，右键删除。免费模块。",
  premium: false,
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new LinksChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 快捷链接";
  },
};
