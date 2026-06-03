import { fmt } from "./engine";

const SVG_NS = "http://www.w3.org/2000/svg";
const R = 44;
const C = 2 * Math.PI * R;

export interface PomoFace {
  wrap: HTMLElement;
  /** 更新环形进度与中心文字。total<=0 时显示满环占位。 */
  update(remainingSec: number, totalSec: number, mode: "focus" | "break" | null): void;
}

/**
 * 创建番茄环形进度盘（纯 SVG，主题自适应，popout 安全）。
 * 环随剩余时间排空，中心显示倒计时与模式。
 */
export function createPomoFace(parent: HTMLElement): PomoFace {
  const doc = parent.ownerDocument;
  const wrap = parent.createDiv({ cls: "hm-pomo-ring-wrap" });

  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("class", "hm-pomo-ring");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");

  const track = doc.createElementNS(SVG_NS, "circle");
  track.setAttribute("class", "hm-pomo-ring-track");
  track.setAttribute("cx", "50");
  track.setAttribute("cy", "50");
  track.setAttribute("r", String(R));

  const prog = doc.createElementNS(SVG_NS, "circle");
  prog.setAttribute("class", "hm-pomo-ring-prog");
  prog.setAttribute("cx", "50");
  prog.setAttribute("cy", "50");
  prog.setAttribute("r", String(R));
  prog.setAttribute("stroke-dasharray", String(C));
  prog.setAttribute("stroke-dashoffset", String(C));

  svg.appendChild(track);
  svg.appendChild(prog);
  wrap.appendChild(svg);

  const center = wrap.createDiv({ cls: "hm-pomo-center" });
  const timeEl = center.createDiv({ cls: "hm-pomo-time" });
  const modeEl = center.createDiv({ cls: "hm-pomo-mode" });

  return {
    wrap,
    update(remainingSec, totalSec, mode) {
      const frac = totalSec > 0 ? Math.max(0, Math.min(1, remainingSec / totalSec)) : 1;
      prog.setAttribute("stroke-dashoffset", String(C * (1 - frac)));
      wrap.toggleClass("hm-pomo-break", mode === "break");
      timeEl.setText(fmt(remainingSec));
      modeEl.setText(mode === "break" ? "休息" : mode === "focus" ? "专注" : "就绪");
    },
  };
}
