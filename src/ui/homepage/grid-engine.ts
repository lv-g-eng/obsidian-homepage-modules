import { MarkdownRenderChild } from "obsidian";
import { ModuleContext } from "../../core/module";
import { ModuleRegistry } from "../../core/module-registry";
import { SettingsStore, HomepageCard } from "../../core/settings";
import { Plat } from "../../core/platform";
import { renderInfoCard, renderLockCard } from "../components/Card";
import { t } from "../../core/i18n";

/** 把渲染子组件挂到宿主（代码块用 mctx.addChild，ItemView 用 this.addChild）。 */
export type AddChild = (child: MarkdownRenderChild) => void;

const COL_W = 280; // 估算单列宽（与 CSS minmax 对应）
const MAX_SPAN = 4;
const MIN_H = 120;

/**
 * 渲染主页网格：每个模块一张卡片，支持拖拽重排 + 右下角自由缩放（列跨度 w / 高度 h），
 * 布局持久化。移动端走单列堆叠（CSS）并禁用缩放。
 */
export function renderHomepageGrid(
  el: HTMLElement,
  addChild: AddChild,
  ctx: ModuleContext,
  registry: ModuleRegistry,
  settings: SettingsStore,
  instanceId: string,
  explicitModuleIds: string[] | null
): void {
  const grid = el.createDiv({ cls: "hm-homepage hm-grid" });

  const saved = settings.data.homepage[instanceId] ?? [];
  const layout = new Map(saved.map((c) => [c.moduleId, c]));

  let moduleIds = explicitModuleIds;
  if (!moduleIds || moduleIds.length === 0) {
    moduleIds = registry.all.filter((m) => settings.isModuleEnabled(m.id)).map((m) => m.id);
  }
  if (saved.length) {
    moduleIds = [...moduleIds].sort(
      (a, b) => (layout.get(a)?.x ?? 999) - (layout.get(b)?.x ?? 999)
    );
  }

  if (moduleIds.length === 0) {
    grid.createDiv({ cls: "hm-muted", text: t("homepage.empty") });
    return;
  }

  let idx = 0;
  for (const id of moduleIds) {
    const mod = registry.find(id);
    if (!mod) continue;
    const conf = layout.get(id);
    const cell = grid.createDiv({ cls: "hm-grid-cell" });
    cell.style.setProperty("--i", String(idx++)); // 错峰入场动画序号
    cell.dataset.moduleId = id;
    const w = Math.min(MAX_SPAN, Math.max(1, conf?.w ?? 1));
    const h = conf?.h ?? 0;
    cell.dataset.w = String(w);
    cell.dataset.h = String(h);
    if (!Plat.isMobile) cell.style.gridColumn = `span ${w}`;
    if (h > 0) cell.style.height = `${h}px`;

    const handle = cell.createDiv({ cls: "hm-grid-handle" });
    handle.createSpan({ text: mod.displayName });

    const content = cell.createDiv({ cls: "hm-grid-content" });
    if (mod.desktopOnly && Plat.isMobile) {
      renderInfoCard(content, mod.displayName, "该模块仅在桌面端可用。");
    } else if (mod.premium && !ctx.license.unlocked) {
      renderLockCard(content, mod.displayName, ctx);
    } else {
      const source = mod.defaultBlock?.() ?? "";
      addChild(mod.createRenderChild(source, content, dummyCtx(), ctx));
    }

    enableDrag(grid, cell, handle, settings, instanceId);
    if (!Plat.isMobile) enableResize(grid, cell, settings, instanceId);
  }
}

/** ItemView 没有 MarkdownPostProcessorContext；模块只用到 addChild，这里给个占位。 */
function dummyCtx(): import("obsidian").MarkdownPostProcessorContext {
  return {
    docId: "",
    sourcePath: "",
    frontmatter: null,
    addChild() {},
    getSectionInfo() {
      return null;
    },
  } as unknown as import("obsidian").MarkdownPostProcessorContext;
}

function enableDrag(
  grid: HTMLElement,
  cell: HTMLElement,
  handle: HTMLElement,
  settings: SettingsStore,
  instanceId: string
): void {
  handle.addEventListener("pointerdown", (e: PointerEvent) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId); // 捕获到 handle，监听随其 DOM 卸载而消失
    cell.addClass("hm-dragging");
    const move = (ev: PointerEvent) => {
      const after = getCellAfter(grid, ev.clientY, ev.clientX);
      if (after == null) grid.appendChild(cell);
      else if (after !== cell) grid.insertBefore(cell, after);
    };
    const up = () => {
      cell.removeClass("hm-dragging");
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      persistLayout(grid, settings, instanceId);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  });
}

function enableResize(
  grid: HTMLElement,
  cell: HTMLElement,
  settings: SettingsStore,
  instanceId: string
): void {
  const grip = cell.createDiv({ cls: "hm-grid-resize" });
  grip.addEventListener("pointerdown", (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    grip.setPointerCapture(e.pointerId);
    cell.addClass("hm-resizing");
    const move = (ev: PointerEvent) => {
      const box = cell.getBoundingClientRect();
      const w = Math.min(MAX_SPAN, Math.max(1, Math.round((ev.clientX - box.left) / COL_W)));
      const h = Math.max(MIN_H, Math.round(ev.clientY - box.top));
      cell.dataset.w = String(w);
      cell.dataset.h = String(h);
      cell.style.gridColumn = `span ${w}`;
      cell.style.height = `${h}px`;
    };
    const up = () => {
      cell.removeClass("hm-resizing");
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      grip.removeEventListener("pointercancel", up);
      persistLayout(grid, settings, instanceId);
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", up);
  });
}

function getCellAfter(grid: HTMLElement, y: number, x: number): HTMLElement | null {
  const cells = Array.from(
    grid.querySelectorAll<HTMLElement>(".hm-grid-cell:not(.hm-dragging)")
  );
  let closest: { dist: number; el: HTMLElement } | null = null;
  for (const c of cells) {
    const box = c.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    if (y < cy || (Math.abs(y - cy) < box.height / 2 && x < cx)) {
      const dist = Math.hypot(x - cx, y - cy);
      if (!closest || dist < closest.dist) closest = { dist, el: c };
    }
  }
  return closest?.el ?? null;
}

function persistLayout(grid: HTMLElement, settings: SettingsStore, instanceId: string): void {
  const cards: HomepageCard[] = Array.from(
    grid.querySelectorAll<HTMLElement>(".hm-grid-cell")
  ).map((c, i) => ({
    moduleId: c.dataset.moduleId ?? "",
    x: i,
    y: 0,
    w: Number(c.dataset.w) || 1,
    h: Number(c.dataset.h) || 0,
  }));
  settings.data.homepage[instanceId] = cards;
  settings.saveDebounced();
}
