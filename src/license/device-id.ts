import { Platform } from "obsidian";
import { sha256Hex, randomUuid } from "./crypto";

/**
 * 生成稳定但非硬件相关的设备指纹（移动端拿不到 MAC，也不应该拿）。
 * = hash(持久化的随机安装盐 + 平台标识)。盐由调用方持久化到 data.json。
 */
export async function computeDeviceId(salt: string): Promise<string> {
  const platformTag = [
    Platform.isDesktopApp ? "desktop" : "mobile",
    Platform.isWin ? "win" : Platform.isMacOS ? "mac" : Platform.isLinux ? "linux" : "other",
    Platform.isPhone ? "phone" : Platform.isTablet ? "tablet" : "pc",
  ].join("-");
  const hex = await sha256Hex(`${salt}::${platformTag}`);
  return hex.slice(0, 32);
}

export function newDeviceSalt(): string {
  return randomUuid();
}
