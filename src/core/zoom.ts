import { Plugin } from "obsidian";
import { SettingsStore } from "./settings";
import { EventBus } from "./event-bus";
import { Plat } from "./platform";

const MIN = 0.5;
const MAX = 2;
const STEP = 0.05;

function clamp(n: number): number {
  return Math.min(MAX, Math.max(MIN, n));
}

/**
 * 给一个容器挂上 Ctrl+滚轮整体缩放（移动端用 +/- 按钮）。
 * 缩放比例持久化到设置，跨主页同步。
 */
export function attachZoom(
  root: HTMLElement,
  plugin: Plugin,
  settings: SettingsStore,
  bus: EventBus
): void {
  const apply = () => {
    root.style.setProperty("--hm-zoom", String(settings.data.general.zoom));
  };
  apply();

  if (Plat.isMobile) {
    const bar = root.createDiv({ cls: "hm-zoom-bar" });
    const mk = (label: string, delta: number) => {
      const b = bar.createEl("button", { text: label, cls: "hm-zoom-btn" });
      b.onclick = () => {
        settings.data.general.zoom = clamp(settings.data.general.zoom + delta);
        apply();
        settings.saveDebounced();
        bus.emit("zoom:changed", { scale: settings.data.general.zoom });
      };
    };
    mk("－", -STEP);
    mk("＋", STEP);
    return;
  }

  plugin.registerDomEvent(root, "wheel", (e: WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const dir = e.deltaY > 0 ? -STEP : STEP;
    settings.data.general.zoom = clamp(settings.data.general.zoom + dir);
    apply();
    settings.saveDebounced();
    bus.emit("zoom:changed", { scale: settings.data.general.zoom });
  });
}
