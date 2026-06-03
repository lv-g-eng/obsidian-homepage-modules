import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import { SettingsStore } from "./settings";
import { LicenseManager } from "../license/license-manager";
import { ModuleRegistry } from "./module-registry";
import { obfuscate, deobfuscate } from "../ai/ai-keystore";
import { AIClient } from "../ai/ai-client";
import { AI_PROVIDERS, findProvider } from "../ai/providers";
import type { Plugin } from "obsidian";

export class HMSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: Plugin,
    private settings: SettingsStore,
    private license: LicenseManager,
    private registry: ModuleRegistry,
    private ai: AIClient
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.licenseSection(containerEl);
    this.generalSection(containerEl);
    this.pomodoroSection(containerEl);
    this.aiSection(containerEl);
    this.moduleSection(containerEl);
  }

  private licenseSection(el: HTMLElement): void {
    el.createEl("h2", { text: "授权" });
    const l = this.license;
    const statusText =
      l.status === "active"
        ? "已激活 ✓"
        : l.status === "trial"
        ? `试用中，剩余 ${l.trialDaysLeft()} 天`
        : l.status === "expired"
        ? "试用已结束"
        : "未激活";

    new Setting(el).setName("当前状态").setDesc(`设备指纹：${l.deviceId || "（计算中）"}`).addText(
      (t) => t.setValue(statusText).setDisabled(true)
    );

    if (l.status === "none") {
      new Setting(el).setName("开始试用").setDesc("7 天全功能试用").addButton((b) =>
        b
          .setButtonText("开始 7 天试用")
          .setCta()
          .onClick(async () => {
            await l.startTrial();
            new Notice("试用已开始");
            this.display();
          })
      );
    }

    let keyInput = "";
    new Setting(el)
      .setName("授权码")
      .setDesc("形如 HM-XXXX-XXXX-XXXX，购买后获得")
      .addText((t) =>
        t.setPlaceholder("HM-XXXX-XXXX-XXXX").onChange((v) => (keyInput = v))
      )
      .addButton((b) =>
        b.setButtonText("激活").onClick(async () => {
          const res = await l.activate(keyInput);
          new Notice(res.message);
          if (res.ok) this.display();
        })
      );

    if (l.status === "active") {
      new Setting(el).setName("注销本设备").addButton((b) =>
        b.setWarning().setButtonText("注销").onClick(async () => {
          await l.deactivate();
          new Notice("已注销");
          this.display();
        })
      );
    }

    new Setting(el)
      .setName("开发者全解锁")
      .setDesc("仅用于本地开发测试")
      .addToggle((t) =>
        t.setValue(!!this.settings.data.license.devUnlock).onChange(async (v) => {
          await l.setDevUnlock(v);
          this.display();
        })
      );
  }

  private generalSection(el: HTMLElement): void {
    el.createEl("h2", { text: "通用" });
    new Setting(el)
      .setName("界面缩放")
      .setDesc("主页整体缩放（也可在主页上 Ctrl+滚轮）")
      .addSlider((s) =>
        s
          .setLimits(0.5, 2, 0.05)
          .setValue(this.settings.data.general.zoom)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.settings.data.general.zoom = v;
            await this.settings.save();
          })
      );
  }

  private pomodoroSection(el: HTMLElement): void {
    el.createEl("h2", { text: "番茄钟" });
    const p = this.settings.data.pomodoro;
    const num = (name: string, desc: string, get: () => number, set: (n: number) => void) => {
      new Setting(el)
        .setName(name)
        .setDesc(desc)
        .addText((t) => {
          t.inputEl.type = "number";
          t.setValue(String(get())).onChange(async (v) => {
            const n = Number(v);
            if (n > 0) {
              set(n);
              await this.settings.save();
            }
          });
        });
    };
    num("专注时长（分钟）", "一个番茄的长度", () => p.focus, (n) => (p.focus = n));
    num("短休息（分钟）", "", () => p.shortBreak, (n) => (p.shortBreak = n));
    num("长休息（分钟）", "", () => p.longBreak, (n) => (p.longBreak = n));
    num("长休息周期", "每完成几个专注后进入长休息", () => p.cycle, (n) => (p.cycle = n));
    new Setting(el)
      .setName("完成提示音")
      .setDesc("番茄/休息结束时播放提示音")
      .addToggle((t) =>
        t.setValue(p.sound).onChange(async (v) => {
          p.sound = v;
          await this.settings.save();
        })
      );
  }

  private aiSection(el: HTMLElement): void {
    el.createEl("h2", { text: "AI" });
    el.createEl("p", {
      cls: "hm-muted",
      text: "OpenAI 兼容接口，支持 DeepSeek / 通义千问 Qwen / Kimi / 智谱 GLM 等。API Key 仅存本地、不上传。",
    });
    const ai = this.settings.data.ai;
    const prov = findProvider(ai.provider);

    // 服务商预设
    new Setting(el)
      .setName("服务商")
      .setDesc(prov?.keyHint ? `提示：${prov.keyHint}` : "选择后自动填入 Base URL 与推荐模型")
      .addDropdown((d) => {
        for (const p of AI_PROVIDERS) d.addOption(p.id, p.name);
        d.setValue(ai.provider).onChange(async (id) => {
          ai.provider = id;
          const p = findProvider(id);
          if (p && p.id !== "custom") {
            ai.baseUrl = p.baseUrl;
            if (p.models.length) ai.model = p.models[0];
          }
          await this.settings.save();
          this.display(); // 刷新以回填 baseUrl / 模型下拉
        });
      });

    new Setting(el).setName("Base URL").addText((t) =>
      t
        .setPlaceholder("https://api.deepseek.com/v1")
        .setValue(ai.baseUrl)
        .onChange(async (v) => {
          ai.baseUrl = v.trim();
          await this.settings.save();
        })
    );

    new Setting(el)
      .setName("API Key")
      .setDesc("仅保存在本地 vault，不上传、不写日志")
      .addText((t) => {
        t.inputEl.type = "password";
        t.setPlaceholder("sk-...")
          .setValue(deobfuscate(ai.apiKeyObf))
          .onChange(async (v) => {
            ai.apiKeyObf = obfuscate(v.trim());
            await this.settings.save();
          });
      });

    // 模型：有预设则用下拉 + 允许自定义
    const modelSetting = new Setting(el).setName("模型");
    if (prov && prov.models.length) {
      modelSetting.addDropdown((d) => {
        for (const m of prov.models) d.addOption(m, m);
        if (!prov.models.includes(ai.model)) d.addOption(ai.model || "custom", ai.model || "自定义");
        d.setValue(ai.model).onChange(async (v) => {
          ai.model = v;
          await this.settings.save();
        });
      });
    }
    modelSetting.addText((t) =>
      t
        .setPlaceholder("可手填模型名")
        .setValue(ai.model)
        .onChange(async (v) => {
          ai.model = v.trim();
          await this.settings.save();
        })
    );

    // 测试连接
    new Setting(el)
      .setName("测试连接")
      .setDesc("发送一条最小请求验证 Base URL / Key / 模型是否可用")
      .addButton((b) =>
        b.setButtonText("测试").onClick(async () => {
          b.setButtonText("测试中…").setDisabled(true);
          try {
            const reply = await this.ai.chat({
              messages: [{ role: "user", content: "只回复两个字：你好" }],
              stream: false,
            });
            new Notice(`✓ 连接成功：${reply.slice(0, 30) || "（空响应）"}`);
          } catch (e) {
            new Notice(`✗ ${(e as Error).message}`);
          } finally {
            b.setButtonText("测试").setDisabled(false);
          }
        })
      );
  }

  private moduleSection(el: HTMLElement): void {
    el.createEl("h2", { text: "模块" });
    el.createEl("p", { cls: "hm-muted", text: "关闭的模块不会出现在主页与生成器中。" });
    for (const m of this.registry.all) {
      new Setting(el)
        .setName(m.displayName + (m.premium ? "（PRO）" : ""))
        .setDesc(m.description ?? `代码块：\`\`\`${m.lang}`)
        .addToggle((t) =>
          t.setValue(this.settings.isModuleEnabled(m.id)).onChange(async (v) => {
            this.settings.data.moduleEnabled[m.id] = v;
            await this.settings.save();
          })
        );
    }
  }
}
