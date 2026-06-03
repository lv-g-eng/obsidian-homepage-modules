import { Notice, setIcon } from "obsidian";
import type { ModuleContext } from "../../core/module";
import { t } from "../../core/i18n";

/** 创建一张统一风格的模块卡片，返回内容区供模块填充。 */
export function createCard(
  el: HTMLElement,
  opts: { title?: string; icon?: string; cls?: string } = {}
): { card: HTMLElement; header: HTMLElement; body: HTMLElement } {
  const card = el.createDiv({ cls: `hm-card ${opts.cls ?? ""}`.trim() });
  const header = card.createDiv({ cls: "hm-card-header" });
  if (opts.icon) {
    const ic = header.createSpan({ cls: "hm-card-icon" });
    setIcon(ic, opts.icon);
  }
  if (opts.title) header.createSpan({ cls: "hm-card-title", text: opts.title });
  const body = card.createDiv({ cls: "hm-card-body" });
  return { card, header, body };
}

/** 桌面专属模块在移动端的降级提示。 */
export function renderInfoCard(el: HTMLElement, title: string, message: string): void {
  const { body } = createCard(el, { title, cls: "hm-card-info" });
  body.createDiv({ cls: "hm-muted", text: message });
}

/** 付费模块未解锁时的锁定卡片。 */
export function renderLockCard(
  el: HTMLElement,
  moduleName: string,
  ctx: ModuleContext
): void {
  const { body } = createCard(el, {
    title: `🔒 ${moduleName}`,
    cls: "hm-card-lock",
  });
  body.createDiv({ cls: "hm-lock-title", text: t("license.locked.title") });
  body.createDiv({ cls: "hm-muted", text: t("license.locked.desc") });

  const actions = body.createDiv({ cls: "hm-lock-actions" });
  if (ctx.license.status === "none") {
    const trial = actions.createEl("button", {
      cls: "mod-cta",
      text: t("license.startTrial"),
    });
    trial.onclick = async () => {
      await ctx.license.startTrial();
      new Notice(t("license.trial.days", ctx.license.trialDaysLeft()));
      rerenderActiveNote(ctx);
    };
  }
  const settingsBtn = actions.createEl("button", { text: t("license.enterKey") });
  settingsBtn.onclick = () => {
    // 打开本插件设置页
    const setting = (ctx.app as unknown as { setting: { open(): void; openTabById(id: string): void } })
      .setting;
    setting.open();
    setting.openTabById(ctx.plugin.manifest.id);
  };
}

/** 触发当前阅读视图重渲染（用于授权状态变化后刷新锁定卡片）。 */
function rerenderActiveNote(ctx: ModuleContext): void {
  const leaves = ctx.app.workspace.getLeavesOfType("markdown");
  for (const leaf of leaves) {
    const view = leaf.view as unknown as {
      previewMode?: { rerender(full: boolean): void };
    };
    view.previewMode?.rerender(true);
  }
  new Notice("已更新授权状态，若未刷新请切换阅读/编辑模式");
}
