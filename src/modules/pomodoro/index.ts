import { MarkdownPostProcessorContext, MarkdownRenderChild, WorkspaceLeaf } from "obsidian";
import { BaseRenderChild, HMModule, ModuleContext } from "../../core/module";
import { Plat } from "../../core/platform";
import { createCard } from "../../ui/components/Card";
import { PomodoroEngine } from "./engine";
import { createPomoFace, PomoFace } from "./face";
import { PomodoroView, POMODORO_VIEW_TYPE } from "./view";

let engine: PomodoroEngine | null = null;

export function getPomodoroEngine(): PomodoroEngine | null {
  return engine;
}

/** 在桌面端把番茄钟弹成独立悬浮窗。 */
async function openPopout(ctx: ModuleContext): Promise<void> {
  const ws = ctx.app.workspace;
  // 已开则聚焦
  const existing = ws.getLeavesOfType(POMODORO_VIEW_TYPE)[0];
  if (existing) {
    ws.revealLeaf(existing);
    return;
  }
  const leaf = ws.openPopoutLeaf();
  await leaf.setViewState({ type: POMODORO_VIEW_TYPE, active: true });
}

class PomodoroChild extends BaseRenderChild {
  private face!: PomoFace;
  private tally!: HTMLElement;
  private controls!: HTMLElement;

  private get focusMin(): number {
    return Number(this.params.focus) || this.ctx.settings.data.pomodoro.focus;
  }

  onload(): void {
    const { body } = createCard(this.containerEl, {
      title: this.params.title ?? "番茄专注",
      icon: "timer",
      cls: "hm-pomo",
    });
    this.face = createPomoFace(body);
    this.tally = body.createDiv({ cls: "hm-pomo-tally" });
    this.controls = body.createDiv({ cls: "hm-pomo-controls" });
    void engine?.refreshSessions().then(() => this.draw());
    this.draw();
    this.interval(() => this.tickView(), 1000);
    this.registerEvent(this.ctx.bus.on("pomodoro:changed", () => this.draw()));
    this.registerEvent(this.ctx.bus.on("pomodoro:completed", () => this.draw()));
  }

  private tickView(): void {
    if (!engine) return;
    const s = engine.state();
    if (s) this.face.update(engine.remainingSec(), s.durationMin * 60, s.mode);
  }

  private draw(): void {
    if (!engine) return;
    const s = engine.state();
    if (s) this.face.update(engine.remainingSec(), s.durationMin * 60, s.mode);
    else this.face.update(this.focusMin * 60, this.focusMin * 60, null);

    const { count, minutes } = engine.todayStats();
    this.tally.empty();
    this.tally.createSpan({ text: "今日 " });
    this.tally.createEl("b", { text: `🍅 ${count}` });
    this.tally.createSpan({ text: ` · ${minutes} 分钟` });

    this.controls.empty();
    if (s) {
      const stop = this.controls.createEl("button", { cls: "mod-warning", text: "停止" });
      stop.onclick = () => void engine?.stop();
    } else {
      const focus = this.controls.createEl("button", {
        cls: "mod-cta",
        text: `专注 ${this.focusMin}′`,
      });
      focus.onclick = () => void engine?.startFocus(this.focusMin);
      const long = engine.isLongBreakNext();
      const cfg = this.ctx.settings.data.pomodoro;
      const brk = this.controls.createEl("button", {
        text: long ? `长休息 ${cfg.longBreak}′` : `休息 ${cfg.shortBreak}′`,
      });
      brk.onclick = () => void engine?.startBreak();
    }
    if (Plat.canUsePopout) {
      const pop = this.controls.createEl("button", { cls: "hm-icon-btn", title: "弹出悬浮窗" });
      pop.setText("⧉");
      pop.onclick = () => void openPopout(this.ctx);
    }
  }
}

export const pomodoroModule: HMModule = {
  id: "pomodoro",
  lang: "pomodoro",
  category: "productivity",
  displayName: "番茄专注",
  description: "番茄钟，绝对时间戳持久化、关掉也不丢；桌面状态栏显示；完成汇入热力图。",
  premium: true,
  onload(ctx: ModuleContext): void {
    engine = new PomodoroEngine(ctx);
    engine.onload();
    // 注册悬浮窗视图（桌面端用）
    ctx.plugin.registerView(
      POMODORO_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new PomodoroView(leaf, ctx, getPomodoroEngine)
    );
    if (Plat.canUsePopout) {
      ctx.plugin.addCommand({
        id: "pomodoro-popout",
        name: "番茄钟：弹出悬浮窗",
        callback: () => void openPopout(ctx),
      });
    }
  },
  createRenderChild(
    source: string,
    el: HTMLElement,
    _mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild {
    return new PomodoroChild(el, source, ctx);
  },
  defaultBlock(): string {
    return "title: 番茄专注\nfocus: 25\nbreak: 5";
  },
};
