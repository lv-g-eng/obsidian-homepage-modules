// 用桩 obsidian 加载打包后的 main.js，验证无顶层执行错误、插件类可实例化、
// 28 个代码块处理器都成功注册。仅冒烟，不替代 Obsidian 内真机测试。
const Module = require("module");

class Events {
  on() { return {}; }
  off() {}
  trigger() {}
}
class Plugin {
  constructor() { this.app = stubApp; this.manifest = { id: "homepage-modules" }; }
  registerMarkdownCodeBlockProcessor(lang) { registered.push(lang); }
  registerView() {}
  addRibbonIcon() {}
  addCommand() {}
  addSettingTab() {}
  addStatusBarItem() { return makeEl(); }
  registerInterval() {}
  register() {}
  registerDomEvent() {}
  registerEvent() {}
  async loadData() { return null; }
  async saveData() {}
}
class PluginSettingTab {}
class ItemView {}
class Modal {}
class Setting { addText(){return this;} addButton(){return this;} addToggle(){return this;} addSlider(){return this;} setName(){return this;} setDesc(){return this;} }
class MarkdownRenderChild { constructor(el){ this.containerEl = el; } register(){} registerEvent(){} }
class MarkdownView {}
class TFile {}
class Notice {}
function setIcon() {}
function normalizePath(p) { return p.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, ""); }
const Platform = { isMobile: false, isDesktopApp: true, isMobileApp: false, isPhone: false, isTablet: false, isWin: true, isMacOS: false, isLinux: false };
const moment = () => ({}); moment.locale = () => "zh-cn";
async function requestUrl() { return { status: 200, json: {}, text: "" }; }

const registered = [];
function makeEl() {
  const el = {
    children: [],
    style: { setProperty() {} },
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    createDiv(o) { return makeEl(); },
    createSpan(o) { return makeEl(); },
    createEl(t, o) { return makeEl(); },
    addClass() {}, removeClass() {}, toggleClass() {}, empty() {},
    setText() {}, setAttr() {}, appendChild() {},
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    get win() { return globalThis; }, get doc() { return { createElementNS: () => makeEl() }; },
  };
  return el;
}
// 内存文件系统，模拟 Obsidian adapter：mkdir 非递归（父目录不存在则抛错）
const mem = { files: new Map(), dirs: new Set() };
const memAdapter = {
  async exists(p) { return mem.dirs.has(p) || mem.files.has(p); },
  async read(p) { if (!mem.files.has(p)) throw new Error("ENOENT " + p); return mem.files.get(p); },
  async write(p, data) {
    const parent = p.split("/").slice(0, -1).join("/");
    if (parent && !mem.dirs.has(parent)) throw new Error("ENOENT parent " + parent);
    mem.files.set(p, data);
  },
  async mkdir(p) {
    const parent = p.split("/").slice(0, -1).join("/");
    if (parent && !mem.dirs.has(parent)) throw new Error("ENOENT parent " + parent); // 非递归
    mem.dirs.add(p);
  },
};
const stubApp = {
  workspace: { getLeavesOfType: () => [], getActiveViewOfType: () => null, on: () => ({}) },
  vault: { adapter: memAdapter, getMarkdownFiles: () => [], getFiles: () => [], getAbstractFileByPath: () => null },
};

const stub = { Events, Plugin, PluginSettingTab, ItemView, Modal, Setting, MarkdownRenderChild, MarkdownView, TFile, Notice, setIcon, normalizePath, Platform, moment, requestUrl };

globalThis.window = globalThis;
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};
globalThis.setTimeout = (fn) => 0;
globalThis.clearTimeout = () => {};
globalThis.document = { createElementNS: () => makeEl() };

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "obsidian") return stub;
  return origLoad.call(this, request, parent, isMain);
};

const mainExport = require("./main.js");
const PluginClass = mainExport.default || mainExport;
const instance = new PluginClass();
instance.onload().then(async () => {
  console.log("onload OK. registered code-block processors:", registered.length);

  // 验证存储持久化（Bug 2/3 修复）：多级目录创建 + 写盘 + 读回
  const col = instance.storage.collection("smoke/test");
  col.upsert({ id: "rec1", val: 42 });
  await instance.storage.flush();
  const path = ".homemodules/smoke/test.json";
  const wrote = mem.files.has(path);
  console.log("storage flush wrote", path, "=>", wrote);
  if (!wrote) { console.error("STORAGE FLUSH FAILED"); process.exit(1); }
  const parsed = JSON.parse(mem.files.get(path));
  console.log("readback record:", JSON.stringify(parsed.records.rec1));
  console.log("dirs created:", [...mem.dirs].join(", "));
}).catch((e) => {
  console.error("onload FAILED:", e);
  process.exit(1);
});
