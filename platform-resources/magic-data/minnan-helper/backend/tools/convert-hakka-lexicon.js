"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_INPUT = path.join(__dirname, "..", "lexicon", "闽南语-推荐词表.xlsx");
const DEFAULT_OUTPUT = path.join(__dirname, "..", "lexicon", "minnan-lexicon.csv");
const OUTPUT_COLUMNS = [
  "序号",
  "注音",
  "语料统一用字",
  "其他可接受的写法",
  "辞典将来用字参考",
  "普通话",
  "优先级",
];

function toCsvCell(value) {
  const text = String(value === undefined || value === null ? "" : value);
  if (/[",\r\n]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

function normalizeRow(sourceRow) {
  const row = sourceRow && typeof sourceRow === "object" ? sourceRow : {};
  return {
    "序号": row["序号"] ?? row["编号"] ?? "",
    "注音": row["注音"] ?? "",
    "语料统一用字": row["语料统一用字"] ?? row["统一用字"] ?? row["建议用字"] ?? "",
    "其他可接受的写法": row["其他可接受的写法"] ?? row["可接受写法"] ?? "",
    "辞典将来用字参考": row["辞典将来用字参考"] ?? row["辞典参考"] ?? "",
    "普通话": row["普通话"] ?? row["对应华语"] ?? "",
    "优先级": row["优先级"] ?? "",
  };
}

function main() {
  const inputFile = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_INPUT;
  const outputFile = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_OUTPUT;

  if (!fs.existsSync(inputFile)) {
    console.error("[convert-minnan-lexicon] 输入文件不存在:", inputFile);
    process.exit(1);
  }

  let XLSX = null;
  try {
    XLSX = require("xlsx");
  } catch (error) {
    console.error(
      "[convert-minnan-lexicon] 未找到 xlsx 依赖，无法自动转换。请先手动将 Excel 另存为 UTF-8 CSV。"
    );
    process.exit(1);
  }

  const workbook = XLSX.readFile(inputFile);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    console.error("[convert-minnan-lexicon] Excel 中没有可用工作表。");
    process.exit(1);
  }
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
  const normalizedRows = rows.map(normalizeRow);
  const headerLine = OUTPUT_COLUMNS.map(toCsvCell).join(",");
  const dataLines = normalizedRows.map(function (row) {
    return OUTPUT_COLUMNS.map(function (column) {
      return toCsvCell(row[column]);
    }).join(",");
  });
  const csvText = "\uFEFF" + [headerLine].concat(dataLines).join("\n");

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, csvText, "utf8");
  console.info("[convert-minnan-lexicon] 转换完成:", outputFile);
}

if (require.main === module) {
  main();
}
