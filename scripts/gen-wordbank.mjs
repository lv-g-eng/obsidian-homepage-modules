// 从 ECDICT ecdict.csv 过滤出 cet4/cet6/ielts 词，生成 wordbank-full.json
//   node scripts/gen-wordbank.mjs
import fs from "fs";
import readline from "readline";

const SRC = "ecdict.csv";
const OUT = "wordbank-full.json";
const TARGETS = { cet4: "cet4", cet6: "cet6", ielts: "ielts" };

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function cleanMeaning(translation, definition) {
  let s = (translation || "").trim();
  if (!s) s = (definition || "").trim();
  // ECDICT 用字面 \n 分隔词性行
  const lines = s
    .split("\\n")
    .map((x) => x.trim())
    .filter((x) => x && !x.startsWith("[网络]"));
  let m = (lines.length ? lines : s.split("\\n")).join(" ").trim();
  if (m.length > 60) m = m.slice(0, 58) + "…";
  return m;
}

const wordRe = /^[a-zA-Z][a-zA-Z'-]*$/;
const levels = { cet4: [], cet6: [], ielts: [] };
const seen = { cet4: new Set(), cet6: new Set(), ielts: new Set() };

const rl = readline.createInterface({ input: fs.createReadStream(SRC), crlfDelay: Infinity });
let first = true;
let total = 0;

rl.on("line", (line) => {
  if (first) {
    first = false;
    return;
  } // 跳过表头
  if (!line) return;
  const cols = parseCsvLine(line);
  const word = (cols[0] || "").trim();
  const phonetic = (cols[1] || "").trim();
  const definition = cols[2] || "";
  const translation = cols[3] || "";
  const tag = (cols[7] || "").trim();
  if (!tag) return;
  if (!wordRe.test(word) || word.length < 2 || word.length > 20) return;
  const tags = tag.split(/\s+/);
  const meaning = cleanMeaning(translation, definition);
  if (!meaning) return;
  for (const [lv, t] of Object.entries(TARGETS)) {
    if (tags.includes(t) && !seen[lv].has(word.toLowerCase())) {
      seen[lv].add(word.toLowerCase());
      levels[lv].push({ word, reading: phonetic ? `/${phonetic}/` : undefined, meaning });
      total++;
    }
  }
});

rl.on("close", () => {
  for (const lv of Object.keys(levels)) levels[lv].sort((a, b) => a.word.localeCompare(b.word));
  fs.writeFileSync(OUT, JSON.stringify(levels));
  const sz = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2);
  console.log(
    `cet4=${levels.cet4.length} cet6=${levels.cet6.length} ielts=${levels.ielts.length} total=${total} -> ${OUT} (${sz} MB)`
  );
});
