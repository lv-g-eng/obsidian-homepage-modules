const SVG_NS = "http://www.w3.org/2000/svg";
const CELL = 12;
const GAP = 3;
const LEVELS = [0.15, 0.35, 0.55, 0.78, 1];

export interface HeatmapOptions {
  /** 日历年份，默认今年 */
  year?: number;
  /** 强度归一化的上限；不传则用数据最大值 */
  max?: number;
  /** 主色 CSS 变量名，默认 --interactive-accent */
  colorVar?: string;
  /** 单位文案，用于 tooltip，如「分钟」「次」 */
  unit?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 渲染 GitHub 风格全年热力图（纯 SVG，主题自适应，移动端横向滚动）。
 * data: { 'YYYY-MM-DD': 数值 }
 */
export function renderHeatmap(
  container: HTMLElement,
  data: Record<string, number>,
  options: HeatmapOptions = {}
): void {
  // 用容器所属文档创建节点，兼容 popout 悬浮窗（不同 Document）
  const ownerDoc = container.ownerDocument;
  const el = (tag: string, attrs: Record<string, string>): SVGElement => {
    const node = ownerDoc.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };
  const year = options.year ?? new Date().getFullYear();
  const colorVar = options.colorVar ?? "--interactive-accent";
  const values = Object.values(data);
  const max = options.max ?? Math.max(1, ...values);

  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  // 网格从该年第一天所在周的周日开始
  const gridStart = new Date(start);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const totalDays = Math.round((end.getTime() - gridStart.getTime()) / 86400000) + 1;
  const weeks = Math.ceil(totalDays / 7);

  const wrap = container.createDiv({ cls: "hm-heatmap" });
  const width = weeks * (CELL + GAP) + 30;
  const height = 7 * (CELL + GAP) + 20;
  const svg = el("svg", {
    width: String(width),
    height: String(height),
    viewBox: `0 0 ${width} ${height}`,
    class: "hm-heatmap-svg",
  });

  let lastMonth = -1;
  const cur = new Date(gridStart);
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const inYear = cur.getFullYear() === year;
      const key = dateKey(cur);
      const val = data[key] ?? 0;
      const x = w * (CELL + GAP) + 28;
      const y = d * (CELL + GAP) + 16;

      const rect = el("rect", {
        x: String(x),
        y: String(y),
        width: String(CELL),
        height: String(CELL),
        rx: "2",
        class: "hm-heatmap-cell",
      });
      if (!inYear) {
        rect.setAttribute("fill", "transparent");
      } else if (val <= 0) {
        rect.setAttribute("fill", "var(--background-modifier-border)");
      } else {
        const level = Math.min(LEVELS.length - 1, Math.floor((val / max) * LEVELS.length));
        rect.setAttribute("fill", `var(${colorVar})`);
        rect.setAttribute("fill-opacity", String(LEVELS[level]));
      }
      const title = el("title", {});
      title.textContent = inYear
        ? `${key}: ${val}${options.unit ?? ""}`
        : key;
      rect.appendChild(title);
      svg.appendChild(rect);

      // 月份标签
      if (inYear && cur.getMonth() !== lastMonth && cur.getDate() <= 7) {
        lastMonth = cur.getMonth();
        const label = el("text", {
          x: String(x),
          y: "10",
          class: "hm-heatmap-label",
        });
        label.textContent = `${cur.getMonth() + 1}月`;
        svg.appendChild(label);
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  wrap.appendChild(svg);

  // 图例：少 → 多
  const legend = container.createDiv({ cls: "hm-heatmap-legend" });
  legend.createSpan({ text: "少" });
  for (const op of LEVELS) {
    const c = legend.createDiv({ cls: "hm-legend-cell" });
    c.style.background = `var(${colorVar})`;
    c.style.opacity = String(op);
  }
  legend.createSpan({ text: "多" });
}
