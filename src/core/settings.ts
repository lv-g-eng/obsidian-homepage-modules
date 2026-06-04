import { Plugin } from "obsidian";
import { LicenseData } from "../license/license-manager";

export interface AISettings {
  /** 选中的服务商预设 id（deepseek/qwen/...），custom 为手填 */
  provider: string;
  baseUrl: string;
  model: string;
  /** 混淆后的 API Key（见 ai-keystore），不存明文 */
  apiKeyObf: string;
}

export interface GeneralSettings {
  zoom: number;
  language: "auto" | "zh" | "en";
}

export interface PomodoroConfig {
  focus: number; // 专注分钟
  shortBreak: number; // 短休息
  longBreak: number; // 长休息
  cycle: number; // 每多少个专注后进入长休息
  sound: boolean; // 完成提示音
}

/** 单张主页卡片的布局信息。 */
export interface HomepageCard {
  moduleId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  collapsed?: boolean;
}

/** 插件 data.json 的完整结构（设置/全局状态；大体量数据走 StorageService）。 */
export interface PluginData {
  schema: number;
  general: GeneralSettings;
  pomodoro: PomodoroConfig;
  license: LicenseData;
  ai: AISettings;
  /** 按主页实例 id 存布局 */
  homepage: Record<string, HomepageCard[]>;
  /** 模块启用状态（未列出的取模块默认） */
  moduleEnabled: Record<string, boolean>;
  /** 各模块的小型全局状态（如番茄运行态），区别于大体量集合数据 */
  moduleState: Record<string, unknown>;
  /** 首次上手引导完成的时间戳；未定义表示从未显示过引导 */
  onboardedAt?: number;
}

export const DEFAULT_DATA: PluginData = {
  schema: 1,
  general: { zoom: 1, language: "auto" },
  pomodoro: { focus: 25, shortBreak: 5, longBreak: 15, cycle: 4, sound: true },
  license: {},
  ai: { provider: "deepseek", baseUrl: "", model: "deepseek-chat", apiKeyObf: "" },
  homepage: {},
  moduleEnabled: {},
  moduleState: {},
};

/**
 * 包裹 loadData/saveData，提供防抖保存。授权管理器与各设置面板共享 data 引用。
 */
export class SettingsStore {
  data: PluginData = structuredClone(DEFAULT_DATA);
  private saveTimer: number | null = null;

  constructor(private plugin: Plugin) {}

  async load(): Promise<void> {
    const loaded = (await this.plugin.loadData()) as Partial<PluginData> | null;
    this.data = this.migrate(loaded);
  }

  private migrate(loaded: Partial<PluginData> | null): PluginData {
    const d = structuredClone(DEFAULT_DATA);
    if (!loaded) return d;
    return {
      ...d,
      ...loaded,
      general: { ...d.general, ...loaded.general },
      pomodoro: { ...d.pomodoro, ...loaded.pomodoro },
      license: { ...d.license, ...loaded.license },
      ai: { ...d.ai, ...loaded.ai },
      homepage: { ...d.homepage, ...loaded.homepage },
      moduleEnabled: { ...d.moduleEnabled, ...loaded.moduleEnabled },
      moduleState: { ...d.moduleState, ...loaded.moduleState },
    };
  }

  /** 读取某模块的小型全局状态。 */
  getState<T>(key: string): T | undefined {
    return this.data.moduleState[key] as T | undefined;
  }

  /** 写入某模块的小型全局状态并保存。 */
  async setState<T>(key: string, value: T | null): Promise<void> {
    if (value === null) delete this.data.moduleState[key];
    else this.data.moduleState[key] = value;
    await this.save();
  }

  /** 立即保存。 */
  async save(): Promise<void> {
    await this.plugin.saveData(this.data);
  }

  /** 防抖保存（用于高频 UI 改动如缩放、拖拽）。 */
  saveDebounced(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.save();
    }, 600);
  }

  isModuleEnabled(id: string, fallback = true): boolean {
    return this.data.moduleEnabled[id] ?? fallback;
  }
}
