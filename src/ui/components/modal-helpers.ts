import { App, Modal } from "obsidian";

/** 文本输入对话框，桌面与移动端均可用。 */
export function promptText(
  app: App,
  title: string,
  def = "",
  placeholder = ""
): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: string | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const modal = new Modal(app);
    modal.modalEl.addClass("hm-modal");
    modal.titleEl.setText(title);

    const input = modal.contentEl.createEl("input", {
      cls: "hm-modal-input",
      attr: { type: "text", placeholder },
    });
    input.value = def;
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        finish(input.value.trim() || null);
        modal.close();
      } else if (e.key === "Escape") {
        finish(null);
        modal.close();
      }
    });

    const footer = modal.contentEl.createDiv({ cls: "hm-modal-footer" });
    footer.createEl("button", { text: "取消" }).onclick = () => {
      finish(null);
      modal.close();
    };
    const ok = footer.createEl("button", { cls: "mod-cta", text: "确定" });
    ok.onclick = () => {
      finish(input.value.trim() || null);
      modal.close();
    };

    modal.onClose = () => finish(null);
    modal.open();
  });
}

/** 单选对话框：竖排全宽选项按钮。 */
export function promptChoice<T extends string>(
  app: App,
  title: string,
  options: { value: T; label: string; desc?: string }[]
): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: T | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const modal = new Modal(app);
    modal.modalEl.addClass("hm-modal");
    modal.titleEl.setText(title);

    const list = modal.contentEl.createDiv({ cls: "hm-modal-options" });
    for (const opt of options) {
      const b = list.createEl("button", { cls: "hm-modal-option" });
      b.createSpan({ cls: "hm-modal-option-label", text: opt.label });
      if (opt.desc) b.createSpan({ cls: "hm-modal-option-desc", text: opt.desc });
      b.onclick = () => {
        finish(opt.value);
        modal.close();
      };
    }
    modal.onClose = () => finish(null);
    modal.open();
  });
}

/** 确认对话框。 */
export function confirmDialog(app: App, title: string, message?: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: boolean) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const modal = new Modal(app);
    modal.modalEl.addClass("hm-modal");
    modal.titleEl.setText(title);
    if (message) modal.contentEl.createDiv({ cls: "hm-modal-desc", text: message });

    const footer = modal.contentEl.createDiv({ cls: "hm-modal-footer" });
    footer.createEl("button", { text: "取消" }).onclick = () => {
      finish(false);
      modal.close();
    };
    const ok = footer.createEl("button", { cls: "mod-warning", text: "确定" });
    ok.onclick = () => {
      finish(true);
      modal.close();
    };
    modal.onClose = () => finish(false);
    modal.open();
  });
}
