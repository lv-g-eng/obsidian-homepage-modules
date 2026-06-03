import { App, Plugin } from "obsidian";
import { WordEntry } from "./wordbank";

export type FullBank = Record<string, WordEntry[]>;

let cache: FullBank | null = null;
let tried = false;

/**
 * 懒加载随插件发布的完整词库 wordbank-full.json（约 1.4 万词，不打进 main.js）。
 * 文件缺失时返回 null，调用方回退到内置精简词库。
 */
export async function loadFullBank(app: App, plugin: Plugin): Promise<FullBank | null> {
  if (cache) return cache;
  if (tried) return cache;
  tried = true;
  const dir = plugin.manifest.dir ?? `${app.vault.configDir}/plugins/${plugin.manifest.id}`;
  const path = `${dir}/wordbank-full.json`;
  try {
    if (!(await app.vault.adapter.exists(path))) return null;
    cache = JSON.parse(await app.vault.adapter.read(path)) as FullBank;
    return cache;
  } catch (e) {
    console.warn("[HM] 加载完整词库失败：", e);
    return null;
  }
}
