import { Notice, setIcon } from "obsidian";
import { ModuleContext } from "../../core/module";
import { genId } from "../../core/util";
import { Collection } from "../../core/storage";
import { Plat } from "../../core/platform";
import { dateKey } from "../../ui/components/Heatmap";
import { PomoRunning, PomoSession } from "./model";

const STATE_KEY = "pomodoro";
const COUNT_KEY = "pomodoroFocusCount";

/** 完成提示音：Web Audio 合成短促双音，无需打包音频文件。 */
function playBeep(): void {
  try {
    const Ctx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    beep(880, 0, 0.18);
    beep(1175, 0.2, 0.25);
    setTimeout(() => ctx.close(), 700);
  } catch {
    /* 静默失败 */
  }
}

/**
 * 番茄钟单例引擎：拥有运行态（存 data.json 的绝对时间戳，关掉 Obsidian 也能续上）、
 * 每秒 tick、桌面状态栏、完成时记录会话并发出事件。各渲染块只读状态 + 调用控制方法。
 */
export class PomodoroEngine {
  private statusBar: HTMLElement | null = null;
  private sessions: Collection<PomoSession>;

  constructor(private ctx: ModuleContext) {
    this.sessions = ctx.storage.collection<PomoSession>("pomodoro/sessions");
  }

  onload(): void {
    if (Plat.canUseStatusBar) {
      this.statusBar = this.ctx.plugin.addStatusBarItem();
      this.statusBar.addClass("hm-pomo-status");
      this.statusBar.onclick = () => {
        if (this.state()) this.stop();
      };
    }
    // 每秒检查（registerInterval 随插件卸载自动清理）
    const id = window.setInterval(() => this.tick(), 1000);
    this.ctx.plugin.registerInterval(id);
    // 启动时立即结算一次（处理「关掉期间已完成」的情况）
    this.tick();
  }

  state(): PomoRunning | null {
    return this.ctx.settings.getState<PomoRunning>(STATE_KEY) ?? null;
  }

  private get cfg() {
    return this.ctx.settings.data.pomodoro;
  }

  private focusCount(): number {
    return this.ctx.settings.getState<number>(COUNT_KEY) ?? 0;
  }

  /** 下一个休息是否应为长休息（按周期）。 */
  isLongBreakNext(): boolean {
    const c = this.focusCount();
    return c > 0 && c % this.cfg.cycle === 0;
  }

  /** 今日已完成番茄的数量与累计分钟。 */
  todayStats(): { count: number; minutes: number } {
    const today = dateKey(new Date());
    let count = 0;
    let minutes = 0;
    for (const s of this.sessions.all()) {
      if (s.date === today) {
        count++;
        minutes += s.minutes;
      }
    }
    return { count, minutes };
  }

  /** 确保会话数据已从磁盘载入（供 UI 统计）。 */
  async refreshSessions(): Promise<void> {
    await this.sessions.refresh();
  }

  /** 剩余秒数（基于绝对时间戳，重启后依然正确）。 */
  remainingSec(): number {
    const s = this.state();
    if (!s) return 0;
    const end = s.startedAt + s.durationMin * 60000;
    return Math.max(0, Math.round((end - Date.now()) / 1000));
  }

  async start(durationMin: number, mode: "focus" | "break", taskId?: string): Promise<void> {
    const running: PomoRunning = { startedAt: Date.now(), durationMin, mode, taskId };
    await this.ctx.settings.setState(STATE_KEY, running);
    this.ctx.bus.emit("pomodoro:changed", { running: true });
    this.updateStatusBar();
  }

  /** 取消当前番茄（不记录会话）。 */
  async stop(): Promise<void> {
    await this.ctx.settings.setState(STATE_KEY, null);
    this.ctx.bus.emit("pomodoro:changed", { running: false });
    this.updateStatusBar();
  }

  private async complete(s: PomoRunning): Promise<void> {
    await this.ctx.settings.setState(STATE_KEY, null);
    if (s.mode === "focus") {
      const startDate = new Date(s.startedAt);
      this.sessions.upsert({
        id: genId(),
        startedAt: s.startedAt,
        minutes: s.durationMin,
        date: dateKey(startDate),
        taskId: s.taskId,
      } as PomoSession);
      await this.ctx.settings.setState(COUNT_KEY, this.focusCount() + 1);
      this.ctx.bus.emit("pomodoro:completed", {
        minutes: s.durationMin,
        at: Date.now(),
        taskId: s.taskId,
      });
      new Notice(`🍅 专注完成 ${s.durationMin} 分钟！`);
    } else {
      new Notice("休息结束，开始下一个番茄吧！");
    }
    if (this.cfg.sound) playBeep();
    this.ctx.bus.emit("pomodoro:changed", { running: false });
    this.updateStatusBar();
  }

  /** 开始一个专注（时长来自参数或配置）。 */
  startFocus(min?: number): Promise<void> {
    return this.start(min ?? this.cfg.focus, "focus");
  }

  /** 开始休息：按周期自动选择长/短休息，长休息后重置周期计数。 */
  async startBreak(): Promise<void> {
    const long = this.isLongBreakNext();
    if (long) await this.ctx.settings.setState(COUNT_KEY, 0);
    return this.start(long ? this.cfg.longBreak : this.cfg.shortBreak, "break");
  }

  private tick(): void {
    const s = this.state();
    if (!s) {
      this.updateStatusBar();
      return;
    }
    if (Date.now() >= s.startedAt + s.durationMin * 60000) {
      void this.complete(s);
    } else {
      this.updateStatusBar();
    }
  }

  private updateStatusBar(): void {
    if (!this.statusBar) return;
    this.statusBar.empty();
    const s = this.state();
    if (!s) {
      this.statusBar.style.display = "none";
      return;
    }
    this.statusBar.style.display = "";
    const ic = this.statusBar.createSpan();
    setIcon(ic, s.mode === "focus" ? "timer" : "coffee");
    this.statusBar.createSpan({ text: " " + fmt(this.remainingSec()) });
  }
}

export function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
