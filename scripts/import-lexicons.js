"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { importLexicons } = require("../platform-resources/backend/lexicon-database");
const ROOT = path.resolve(__dirname, "..");

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field); field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += char;
  }
  if (quoted) throw new Error("CSV has an unclosed quoted field");
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((values) => values.some((value) => value.trim()));
}

function minnanCsvDocument(text, sourceFile) {
  const [header, ...rows] = parseCsv(text);
  const columns = [["编号", "序号"], ["建议用字", "语料统一用字"], ["对应华语", "普通话"]]
    .map((names) => names.map((name) => header?.indexOf(name)).find((index) => index >= 0));
  if (columns.some((index) => index == null || index < 0)) throw new Error("Missing Minnan CSV columns");
  return {
    schemaVersion: "1", language: "闽南语", mode: "rule_lexicon",
    sourceFiles: [sourceFile], updatedAt: new Date().toISOString(),
    entries: rows.map((row, index) => {
      if (row.length !== header.length) throw new Error("Invalid CSV row " + (index + 2));
      const [id, display, mandarin] = columns.map((column) => row[column]);
      if (!id.trim()) throw new Error("Missing CSV entry id");
      const raw = Object.fromEntries(header.map((name, column) => [name, row[column]]));
      return { id: "mn-" + id, normalized: display, display, mandarin,
        aliases: raw["其他可接受的写法"] ? [raw["其他可接受的写法"]] : [],
        notes: raw["辞典将来用字参考"] ? [raw["辞典将来用字参考"]] : [], tags: [],
        attributes: { sourceIndex: index + 1, rawRow: raw,
          ...(raw["优先级"] ? { priority: raw["优先级"] } : {}),
          ...(raw["注音"] ? { pinyin: raw["注音"] } : {}) } };
    }),
  };
}

function defaultSources() {
  const sources = [
    ["data-baker/round-one-quality", "reference/minnan-lexicon.json"],
    ["aishell-tech/minnan-helper", "reference/minnan-lexicon.json"],
    ["magic-data/hakka-helper", "lexicon/hakka-lexicon.json"],
    ["magic-data/minnan-helper", "lexicon/minnan-lexicon.csv"],
    ["jd-tts-annotation/shanghainese-helper", "lexicon/shanghainese-lexicon.json"],
  ];
  return sources.map(([key, suffix]) => ({ key, load() {
    const relative = "platform-resources/" + key + "/backend/" + suffix;
    const file = key === "aishell-tech/minnan-helper" && process.env.ASC_AISHELL_MINNAN_LEXICON_JSON_PATH
      ? path.resolve(process.env.ASC_AISHELL_MINNAN_LEXICON_JSON_PATH) : path.join(ROOT, relative);
    const text = fs.readFileSync(file, "utf8");
    return suffix.endsWith(".csv") ? minnanCsvDocument(text, relative) : JSON.parse(text.replace(/^\uFEFF/, ""));
  } }));
}

function main(args = process.argv.slice(2)) {
  require("../platform-resources/backend/env-loader").loadDefaultEnvFiles();
  let replace = false, key, source;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--replace") replace = true;
    else if (args[i] === "--lexicon" && args[i + 1]) key = args[++i];
    else if (args[i] === "--source" && args[i + 1]) source = args[++i];
    else throw new Error("Usage: node scripts/import-lexicons.js [--replace] [--lexicon platform/script] [--source file.json|file.csv]");
  }
  let items = defaultSources();
  if (key) items = items.filter((item) => item.key === key);
  if (!items.length || (source && !key)) throw new Error("Specify a supported --lexicon for --source");
  if (source) items = [{ key, load() {
    const text = fs.readFileSync(path.resolve(source), "utf8");
    if (source.endsWith(".csv")) {
      if (key !== "magic-data/minnan-helper") throw new Error("CSV import is only supported for Magic Data Minnan");
      return minnanCsvDocument(text, path.basename(source));
    }
    return JSON.parse(text.replace(/^\uFEFF/, ""));
  } }];
  console.log(JSON.stringify(importLexicons(items, { replace }), null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error("词表导入失败:", error.message); process.exitCode = 1; }
}
module.exports = { defaultSources, minnanCsvDocument, parseCsv, main };
