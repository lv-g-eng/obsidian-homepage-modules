import { MarkdownRenderChild, Plugin } from "obsidian";
import { HMModule, ModuleContext } from "./module";
import { Plat } from "./platform";
import { renderLockCard, renderInfoCard } from "../ui/components/Card";

/**
 * 把模块数组接入 Obsidian：注册代码块处理器（含授权门控、桌面专属降级），
 * 并调用各模块的 onload/命令注册。
 */
export class ModuleRegistry {
  private modules: HMModule[] = [];

  constructor(
    private plugin: Plugin,
    private ctx: ModuleContext
  ) {}

  get all(): HMModule[] {
    return this.modules;
  }

  find(id: string): HMModule | undefined {
    return this.modules.find((m) => m.id === id);
  }

  registerAll(modules: HMModule[]): void {
    for (const mod of modules) this.register(mod);
  }

  private register(mod: HMModule): void {
    this.modules.push(mod);
    mod.onload?.(this.ctx);
    if (mod.onunload) this.plugin.register(() => mod.onunload?.());

    this.plugin.registerMarkdownCodeBlockProcessor(mod.lang, (source, el, mctx) => {
      // 桌面专属模块在移动端降级
      if (mod.desktopOnly && Plat.isMobile) {
        renderInfoCard(el, mod.displayName, "该模块仅在桌面端可用。");
        return;
      }
      // 授权门控：付费模块未解锁时渲染锁定卡片，绝不破坏笔记
      if (mod.premium && !this.ctx.license.unlocked) {
        renderLockCard(el, mod.displayName, this.ctx);
        return;
      }
      const child: MarkdownRenderChild = mod.createRenderChild(source, el, mctx, this.ctx);
      mctx.addChild(child);
    });
  }
}
