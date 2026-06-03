import { Plugin, WorkspaceLeaf } from "obsidian";
import { initI18n, t } from "./core/i18n";
import { SettingsStore } from "./core/settings";
import { StorageService } from "./core/storage";
import { EventBus } from "./core/event-bus";
import { ModuleContext } from "./core/module";
import { ModuleRegistry } from "./core/module-registry";
import { HMSettingTab } from "./core/settings-tab";
import { LicenseManager } from "./license/license-manager";
import { AIClient } from "./ai/ai-client";
import { deobfuscate } from "./ai/ai-keystore";
import { registerAICommands } from "./ai/ai-commands";
import { HomepageView, HOMEPAGE_VIEW_TYPE } from "./ui/homepage/homepage-view";
import { renderHomepageGrid } from "./ui/homepage/grid-engine";
import { generateToolkitHomepage } from "./ui/homepage/toolkit-generator";
import { MODULES } from "./modules";

export default class HomepageModulesPlugin extends Plugin {
  settings!: SettingsStore;
  storage!: StorageService;
  bus!: EventBus;
  license!: LicenseManager;
  ai!: AIClient;
  registry!: ModuleRegistry;
  ctx!: ModuleContext;

  async onload(): Promise<void> {
    initI18n();

    // 1. 设置
    this.settings = new SettingsStore(this);
    await this.settings.load();

    // 2. 事件总线
    this.bus = new EventBus();

    // 3. 授权（计算设备指纹、评估试用/激活）
    this.license = new LicenseManager(
      this.settings.data.license,
      () => this.settings.save(),
      this.bus
    );
    await this.license.init();

    // 4. 存储（用设备指纹做 LWW 裁决）
    this.storage = new StorageService(this.app, this.bus, this.license.deviceId);

    // 5. AI
    this.ai = new AIClient(() => ({
      baseUrl: this.settings.data.ai.baseUrl,
      apiKey: deobfuscate(this.settings.data.ai.apiKeyObf),
      model: this.settings.data.ai.model,
    }));
    // AI 文本命令（命令面板 + 编辑器右键：翻译/润色/总结选中文本）
    registerAICommands(this, this.ai);

    // 6. 模块上下文 + 注册
    this.ctx = {
      app: this.app,
      plugin: this,
      storage: this.storage,
      settings: this.settings,
      bus: this.bus,
      license: this.license,
      ai: this.ai,
      t,
    };
    this.registry = new ModuleRegistry(this, this.ctx);
    this.registry.registerAll(MODULES);

    // 7. 主页代码块处理器
    this.registerMarkdownCodeBlockProcessor("homepage", (source, el, mctx) => {
      const params = parseHomepageParams(source);
      renderHomepageGrid(
        el,
        (child) => mctx.addChild(child),
        this.ctx,
        this.registry,
        this.settings,
        params.id,
        params.modules
      );
    });

    // 8. 独立面板视图
    this.registerView(
      HOMEPAGE_VIEW_TYPE,
      (leaf: WorkspaceLeaf) =>
        new HomepageView(leaf, this.ctx, this.registry, this.settings)
    );
    this.addRibbonIcon("layout-dashboard", "Homepage Modules", () =>
      this.activatePanel()
    );

    // 9. 命令
    this.addCommand({
      id: "open-homepage-panel",
      name: "打开模块面板",
      callback: () => this.activatePanel(),
    });
    this.addCommand({
      id: "generate-toolkit-homepage",
      name: t("homepage.generate"),
      callback: () =>
        generateToolkitHomepage(this.app, this.ctx, this.registry, this.settings),
    });

    // 10. 设置页
    this.addSettingTab(
      new HMSettingTab(this.app, this, this.settings, this.license, this.registry, this.ai)
    );
  }

  async onunload(): Promise<void> {
    await this.storage?.dispose();
  }

  private async activatePanel(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(HOMEPAGE_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type: HOMEPAGE_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }
}

function parseHomepageParams(source: string): { id: string; modules: string[] | null } {
  let id = "main";
  let modules: string[] | null = null;
  for (const line of source.split("\n")) {
    const [k, ...rest] = line.split(":");
    const key = k.trim();
    const val = rest.join(":").trim();
    if (key === "id" && val) id = val;
    if (key === "modules" && val)
      modules = val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  }
  return { id, modules };
}
