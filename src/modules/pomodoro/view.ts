import { ItemView, WorkspaceLeaf } from "obsidian";
import { ModuleContext } from "../../core/module";
import { PomodoroEngine } from "./engine";
import { createPomoFace, PomoFace } from "./face";

export const POMODORO_VIEW_TYPE = "hm-pomodoro-view";

/**
 * 番茄钟独立视图。桌面端通过 openPopoutLeaf 弹成独立 OS 悬浮窗，
 * 显示环形进度盘与控制按钮。读取引擎单例状态，每秒刷新。
 */
export class PomodoroView extends ItemView {
  private face!: PomoFace;
  private ctrlEl!: HTMLElement;

  constructor(
    leaf: WorkspaceLeaf,
    private ctx: ModuleContext,
    private getEngine: () => PomodoroEngine | null
  ) {
    super(leaf);
  }

  getViewType(): string {
    return POMODORO_VIEW_TYPE;
  }
  getDisplayText(): string {
    return "番茄钟";
  }
  getIcon(): string {
    return "timer";
  }

  async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.addClass("hm-pomo-view");
    this.face = createPomoFace(root);
    this.ctrlEl = root.createDiv({ cls: "hm-pomo-controls" });
    this.draw();
    this.registerInterval(window.setInterval(() => this.tick(), 1000));
    this.registerEvent(this.ctx.bus.on("pomodoro:changed", () => this.draw()));
  }

  private tick(): void {
    const e = this.getEngine();
    const s = e?.state();
    if (e && s) this.face.update(e.remainingSec(), s.durationMin * 60, s.mode);
  }

  private draw(): void {
    const e = this.getEngine();
    if (!e) return;
    const s = e.state();
    const fm = this.ctx.settings.data.pomodoro.focus;
    if (s) this.face.update(e.remainingSec(), s.durationMin * 60, s.mode);
    else this.face.update(fm * 60, fm * 60, null);

    this.ctrlEl.empty();
    const cfg = this.ctx.settings.data.pomodoro;
    if (s) {
      const stop = this.ctrlEl.createEl("button", { cls: "mod-warning", text: "停止" });
      stop.onclick = () => void e.stop();
    } else {
      const focus = this.ctrlEl.createEl("button", { cls: "mod-cta", text: `专注 ${cfg.focus}′` });
      focus.onclick = () => void e.startFocus();
      const long = e.isLongBreakNext();
      const brk = this.ctrlEl.createEl("button", {
        text: long ? `长休息 ${cfg.longBreak}′` : `休息 ${cfg.shortBreak}′`,
      });
      brk.onclick = () => void e.startBreak();
    }
  }
}
