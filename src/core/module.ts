import {
  App,
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  Plugin,
} from "obsidian";
import { StorageService } from "./storage";
import { EventBus } from "./event-bus";
import { t } from "./i18n";
import type { SettingsStore } from "./settings";
import type { LicenseManager } from "../license/license-manager";
import type { AIClient } from "../ai/ai-client";

export type ModuleCategory =
  | "productivity"
  | "habit"
  | "learning"
  | "ai"
  | "finance"
  | "dashboard"
  | "utility";

/** 注入给每个模块的共享服务。 */
export interface ModuleContext {
  app: App;
  plugin: Plugin;
  storage: StorageService;
  settings: SettingsStore;
  bus: EventBus;
  license: LicenseManager;
  ai: AIClient;
  t: typeof t;
}

/**
 * 一个模块 = 一个代码块语言标签 + 渲染逻辑 + 数据。
 * 新增模块只需实现此接口并在 src/modules/index.ts 注册一行。
 */
export interface HMModule {
  /** 唯一 id（也作为 storage 命名空间） */
  id: string;
  /** 代码块语言标签，如 ```pomodoro */
  lang: string;
  category: ModuleCategory;
  displayName: string;
  description?: string;
  /** true 表示付费模块，未授权时渲染锁定卡片 */
  premium: boolean;
  /** 仅桌面可用的模块（移动端渲染降级提示） */
  desktopOnly?: boolean;

  /** 插件启动时调用一次（注册命令、状态栏等） */
  onload?(ctx: ModuleContext): void;
  onunload?(): void;

  /** 为单个代码块创建渲染子组件，其生命周期由 Obsidian 管理 */
  createRenderChild(
    source: string,
    el: HTMLElement,
    mctx: MarkdownPostProcessorContext,
    ctx: ModuleContext
  ): MarkdownRenderChild;

  /** 在主页一键生成时为该模块产出默认代码块内容 */
  defaultBlock?(): string;
}

/** 解析代码块内的 `key: value` 参数行。 */
export function parseParams(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

/**
 * 渲染子组件基类：自动解析参数、提供 doc/win（兼容 popout 窗口）、
 * onunload 时由 Obsidian 自动清理订阅与定时器。
 */
export abstract class BaseRenderChild extends MarkdownRenderChild {
  protected params: Record<string, string>;

  constructor(
    public containerEl: HTMLElement,
    protected source: string,
    protected ctx: ModuleContext
  ) {
    super(containerEl);
    this.params = parseParams(source);
  }

  /** 当前块所在文档（popout 中不是全局 document） */
  protected get doc(): Document {
    return this.containerEl.doc;
  }

  /** 当前块所在窗口（popout 中不是全局 window） */
  protected get win(): Window {
    return this.containerEl.win;
  }

  /** 注册随本组件卸载自动清理的定时器。 */
  protected interval(cb: () => void, ms: number): void {
    const id = this.win.setInterval(cb, ms);
    this.register(() => this.win.clearInterval(id));
  }
}
