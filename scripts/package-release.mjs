// 一键打包发布 zip：构建 + 收集发布文件 + 压缩。
//   node scripts/package-release.mjs
// 产物：release/homepage-modules-<version>.zip（含 main.js / manifest.json / styles.css / wordbank-full.json）
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const version = manifest.version;
const id = manifest.id;

const FILES = ["main.js", "manifest.json", "styles.css", "wordbank-full.json"];

console.log(`▶ 构建生产包 v${version} …`);
execSync("node esbuild.config.mjs production", { stdio: "inherit" });

const outDir = path.join(root, "release", id);
fs.rmSync(path.join(root, "release"), { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

let missing = [];
for (const f of FILES) {
  const src = path.join(root, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(outDir, f));
  else missing.push(f);
}
if (missing.length) {
  console.warn(`⚠ 缺少文件（将不打入）：${missing.join(", ")}`);
  if (missing.includes("wordbank-full.json"))
    console.warn("  提示：运行 node scripts/gen-wordbank.mjs 生成完整词库");
}

const zipPath = path.join(root, "release", `${id}-${version}.zip`);
// 用 PowerShell Compress-Archive（Windows 自带），跨平台可改用 zip
const psCmd = `Compress-Archive -Path "${outDir}\\*" -DestinationPath "${zipPath}" -Force`;
execSync(`powershell -NoProfile -Command "${psCmd}"`, { stdio: "inherit" });

const sizeMB = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
console.log(`✅ 已生成 ${path.relative(root, zipPath)} (${sizeMB} MB)`);
console.log(`   解压后即为插件目录，或直接作为 GitHub Release 资源上传供 BRAT 安装。`);
