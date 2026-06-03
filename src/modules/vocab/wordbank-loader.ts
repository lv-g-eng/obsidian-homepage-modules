import { App, Notice, Plugin, requestUrl } from "obsidian";
import { WordEntry } from "./wordbank";

export type FullBank = Record<string, WordEntry[]>;

let cache: FullBank | null = null;

/** Release 兜底下载地址（BRAT 只装 main.js/manifest/styles，不带词库文件）。 */
const RELEASE_URL =
  "https://github.com/lv-g-eng/obsidian-homepage-modules/releases/latest/download/wordbank-full.json";

/**
 * 加载完整词库（约 1.4 万词，不打进 main.js）：
 * 1) 优先读插件目录下随发布的 wordbank-full.json；
 * 2) 本地没有（如 BRAT 安装）→ 从 GitHub Release 下载并缓存到插件目录；
 * 3) 都失败 → 返回 null，调用方回退到内置精简词库。
 */
export async function loadFullBank(app: App, plugin: Plugin): Promise<FullBank | null> {
  if (cache) return cache;
  const dir = plugin.manifest.dir ?? `${app.vault.configDir}/plugins/${plugin.manifest.id}`;
  const path = `${dir}/wordbank-full.json`;
  const adapter = app.vault.adapter;

  // 1) 本地文件
  try {
    if (await adapter.exists(path)) {
      cache = JSON.parse(await adapter.read(path)) as FullBank;
      return cache;
    }
  } catch (e) {
    console.warn("[HM] 读取本地词库失败：", e);
  }

  // 2) 从 Release 下载并缓存
  try {
    const notice = new Notice("正在下载完整词库（约 1.4 万词，仅首次）…", 0);
    const resp = await requestUrl({ url: RELEASE_URL, throw: false });
    notice.hide();
    if (resp.status >= 200 && resp.status < 300 && resp.text) {
      cache = JSON.parse(resp.text) as FullBank;
      try {
        await adapter.write(path, resp.text); // 缓存到本地，下次直接用
      } catch {
        /* 写缓存失败不影响本次使用 */
      }
      return cache;
    }
    new Notice("完整词库下载失败，已使用内置精简词库");
  } catch (e) {
    console.warn("[HM] 下载完整词库失败：", e);
    new Notice("完整词库下载失败，已使用内置精简词库");
  }
  return null;
}
