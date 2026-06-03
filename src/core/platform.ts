import { Platform } from "obsidian";

/**
 * 平台特性检测的统一入口。所有桌面专属能力（状态栏、悬浮窗、Node fs、
 * 流式 fetch）都必须先过这里，避免在移动端崩溃。
 */
export const Plat = {
  get isMobile(): boolean {
    return Platform.isMobile;
  },
  get isDesktopApp(): boolean {
    return Platform.isDesktopApp;
  },
  get isMobileApp(): boolean {
    return Platform.isMobileApp;
  },
  get isPhone(): boolean {
    return Platform.isPhone;
  },
  get isTablet(): boolean {
    return Platform.isTablet;
  },
  /** 状态栏仅桌面可用 */
  get canUseStatusBar(): boolean {
    return Platform.isDesktopApp;
  },
  /** 悬浮窗（moveLeafToPopout）仅桌面可用 */
  get canUsePopout(): boolean {
    return Platform.isDesktopApp;
  },
  /**
   * 原生 fetch 流式仅在桌面可靠（移动端 WebView 受 CORS 限制）。
   * 移动端必须改用 requestUrl 非流式。
   */
  get canStreamFetch(): boolean {
    return Platform.isDesktopApp;
  },
};
