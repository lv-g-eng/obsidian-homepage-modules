import { moment } from "obsidian";

type Dict = Record<string, string>;

const zh: Dict = {
  "settings.title": "Homepage Modules 设置",
  "settings.license": "授权",
  "settings.ai": "AI",
  "settings.modules": "模块",
  "settings.general": "通用",
  "license.trial": "试用中",
  "license.trial.days": "试用剩余 {0} 天",
  "license.active": "已激活",
  "license.expired": "试用已结束",
  "license.enterKey": "输入授权码",
  "license.activate": "激活",
  "license.startTrial": "开始 7 天试用",
  "license.locked.title": "专业版模块",
  "license.locked.desc": "开始免费试用，或在设置中输入授权码以解锁。",
  "homepage.generate": "一键生成工具箱主页",
  "homepage.empty": "主页还是空的，添加模块代码块或点击「一键生成工具箱主页」。",
  "common.save": "保存",
  "common.cancel": "取消",
  "common.delete": "删除",
  "common.add": "添加",
  "common.today": "今天",
};

const en: Dict = {
  "settings.title": "Homepage Modules Settings",
  "settings.license": "License",
  "settings.ai": "AI",
  "settings.modules": "Modules",
  "settings.general": "General",
  "license.trial": "Trial",
  "license.trial.days": "{0} trial days left",
  "license.active": "Activated",
  "license.expired": "Trial ended",
  "license.enterKey": "Enter license key",
  "license.activate": "Activate",
  "license.startTrial": "Start 7-day trial",
  "license.locked.title": "Premium module",
  "license.locked.desc": "Start the free trial, or enter a license key in settings to unlock.",
  "homepage.generate": "Generate toolkit homepage",
  "homepage.empty": "Homepage is empty. Add module code blocks or click \"Generate toolkit homepage\".",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.add": "Add",
  "common.today": "Today",
};

let active: Dict = zh;

export function initI18n(): void {
  const lang = (moment.locale() || "en").toLowerCase();
  active = lang.startsWith("zh") ? zh : en;
}

/** 取一条翻译，支持 {0} {1} 占位符替换。 */
export function t(key: string, ...args: (string | number)[]): string {
  let s = active[key] ?? key;
  args.forEach((a, i) => {
    s = s.replace(`{${i}}`, String(a));
  });
  return s;
}
