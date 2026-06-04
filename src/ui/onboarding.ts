import { App, Modal, setIcon } from "obsidian";

export interface OnboardingActions {
  /** 一键生成工具箱主页 */
  onGenerate: () => void;
  /** 打开独立模块面板 */
  onOpenPanel: () => void;
  /** 弹窗关闭后回调（用于标记已引导并持久化） */
  onDismiss: () => void;
}

interface Step {
  icon: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: "layout-dashboard",
    title: "一键生成主页",
    body: "点下方按钮，自动新建一篇带常用模块的主页笔记，开箱即用。",
  },
  {
    icon: "code",
    title: "或手动添加模块",
    body: "在任意笔记里写代码块，例如 ```pomodoro、```todo、```vocab、```habit，保存即渲染。",
  },
  {
    icon: "gift",
    title: "免费试用 7 天",
    body: "全部 30 个模块解锁体验；背单词首次使用会自动下载完整词库（四级/六级/雅思）。",
  },
];

/** 首次启动 / 命令触发的上手引导弹窗。样式全部走 Obsidian 主题变量，自动适配深浅色。 */
export class OnboardingModal extends Modal {
  private acted = false;

  constructor(app: App, private actions: OnboardingActions) {
    super(app);
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    modalEl.addClass("hm-onboard-modal");
    contentEl.empty();

    // 头部 banner
    const hero = contentEl.createDiv({ cls: "hm-onboard-hero" });
    const logo = hero.createDiv({ cls: "hm-onboard-logo" });
    for (let i = 0; i < 4; i++) logo.createSpan();
    const htext = hero.createDiv({ cls: "hm-onboard-hero-text" });
    htext.createEl("h2", { text: "欢迎使用 Homepage Modules" });
    htext.createEl("p", { text: "30 个模块，一个代码块即用 · 数据全本地" });

    // 步骤
    const list = contentEl.createDiv({ cls: "hm-onboard-steps" });
    STEPS.forEach((s, i) => {
      const row = list.createDiv({ cls: "hm-onboard-step" });
      const badge = row.createDiv({ cls: "hm-onboard-badge" });
      setIcon(badge, s.icon);
      badge.createSpan({ cls: "hm-onboard-num", text: String(i + 1) });
      const txt = row.createDiv({ cls: "hm-onboard-step-text" });
      txt.createEl("strong", { text: s.title });
      txt.createEl("div", { cls: "hm-onboard-step-body", text: s.body });
    });

    // 操作按钮
    const foot = contentEl.createDiv({ cls: "hm-onboard-foot" });
    const cta = foot.createEl("button", {
      cls: "mod-cta hm-onboard-cta",
      text: "✨ 一键生成主页",
    });
    cta.onclick = () => {
      this.acted = true;
      this.actions.onGenerate();
      this.close();
    };
    const panel = foot.createEl("button", { text: "打开模块面板" });
    panel.onclick = () => {
      this.acted = true;
      this.actions.onOpenPanel();
      this.close();
    };
    const later = foot.createEl("button", { cls: "hm-onboard-later", text: "稍后再说" });
    later.onclick = () => this.close();

    const hint = contentEl.createDiv({ cls: "hm-onboard-hint" });
    hint.setText("想再看一遍？命令面板搜索「上手引导」即可重新打开。");
  }

  onClose(): void {
    this.contentEl.empty();
    // 无论点了哪个按钮（或直接关闭），都标记为已引导，不再自动弹出
    this.actions.onDismiss();
    void this.acted;
  }
}
