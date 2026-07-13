"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_INPUT = path.join(__dirname, "..", "lexicon", "客家话-正字表.xlsx");
const DEFAULT_CSV_OUTPUT = path.join(__dirname, "..", "lexicon", "hakka-lexicon.csv");
const DEFAULT_JSON_OUTPUT = path.join(__dirname, "..", "lexicon", "hakka-lexicon.json");
const SOURCE_SHEETS = ["正字", "补充正字"];
const OUTPUT_COLUMNS = [
  "序号",
  "注音",
  "语料统一用字",
  "其他可接受的写法",
  "辞典将来用字参考",
  "普通话",
  "优先级",
];

function normalizeText(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/\r\n|\r|\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueTerms(values) {
  const result = [];
  (Array.isArray(values) ? values : [values]).forEach(function (value) {
    const text = normalizeText(value);
    if (text && !result.includes(text)) {
      result.push(text);
    }
  });
  return result;
}

function splitOrthography(value) {
  return uniqueTerms(normalizeText(value).split(/[／/]/));
}

function toCsvCell(value) {
  const text = String(value === undefined || value === null ? "" : value);
  if (/[",\r\n]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

function convertWorkbookRows(workbookRows) {
  const source = workbookRows && typeof workbookRows === "object" ? workbookRows : {};
  const rows = [];
  const ignoredSheets = Object.keys(source).filter(function (sheetName) {
    return !SOURCE_SHEETS.includes(sheetName);
  });

  SOURCE_SHEETS.forEach(function (sheetName) {
    const sheetRows = Array.isArray(source[sheetName]) ? source[sheetName] : [];
    sheetRows.forEach(function (sourceRow) {
      const row = sourceRow && typeof sourceRow === "object" ? sourceRow : {};
      const orthographies = splitOrthography(row["客家话正字（转写内容）"]);
      const normalized = orthographies[0] || "";
      const mandarin = normalizeText(row["普通话字/意思"]);
      if (!normalized || !mandarin) {
        return;
      }
      rows.push({
        "序号": String(rows.length + 1),
        "注音": normalizeText(row["参考读音"]),
        "语料统一用字": normalized,
        "其他可接受的写法": orthographies.slice(1).join("、"),
        "辞典将来用字参考": "",
        "普通话": mandarin,
        "优先级": String(rows.length + 1),
        "备注": normalizeText(row["备注"]),
      });
    });
  });

  return { rows, ignoredSheets };
}

function buildLexiconDocument(rows, sourceFileName, updatedAt) {
  return {
    schemaVersion: "1",
    language: "客家话",
    mode: "rule_lexicon",
    sourceFiles: [normalizeText(sourceFileName) || path.basename(DEFAULT_INPUT)],
    updatedAt: normalizeText(updatedAt) || new Date().toISOString(),
    entries: rows.map(function (row) {
      const aliases = uniqueTerms(
        normalizeText(row["其他可接受的写法"]).split(/[、，,；;]/)
      ).filter(function (term) {
        return term !== row["语料统一用字"];
      });
      const notes = uniqueTerms([row["备注"]]);
      return {
        id: "hakka-" + row["序号"],
        normalized: row["语料统一用字"],
        display: row["语料统一用字"],
        mandarin: row["普通话"],
        aliases,
        notes,
        tags: [],
        attributes: {
          pinyin: row["注音"],
          sourceIndex: Number(row["序号"]),
        },
      };
    }),
  };
}

function requireXlsx() {
  try {
    return require("xlsx");
  } catch (error) {
    console.error(
      "[convert-hakka-lexicon] 未找到 xlsx 依赖，无法自动转换。请在具备 xlsx 依赖的维护环境运行此脚本。"
    );
    process.exit(1);
  }
}

function main() {
  const inputFile = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_INPUT;
  const csvOutputFile = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_CSV_OUTPUT;
  const jsonOutputFile = process.argv[4] ? path.resolve(process.argv[4]) : DEFAULT_JSON_OUTPUT;
  if (!fs.existsSync(inputFile)) {
    console.error("[convert-hakka-lexicon] 输入文件不存在:", inputFile);
    process.exit(1);
  }

  const XLSX = requireXlsx();
  const workbook = XLSX.readFile(inputFile);
  const workbookRows = {};
  SOURCE_SHEETS.forEach(function (sheetName) {
    if (workbook.Sheets[sheetName]) {
      workbookRows[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
    }
  });
  const converted = convertWorkbookRows(workbookRows);
  if (converted.rows.length === 0) {
    console.error("[convert-hakka-lexicon] 未读取到可用的正字词条。");
    process.exit(1);
  }
  const csvText = "\uFEFF" + [OUTPUT_COLUMNS.map(toCsvCell).join(",")]
    .concat(converted.rows.map(function (row) {
      return OUTPUT_COLUMNS.map(function (column) { return toCsvCell(row[column]); }).join(",");
    }))
    .join("\n");
  const document = buildLexiconDocument(converted.rows, path.basename(inputFile));

  fs.mkdirSync(path.dirname(csvOutputFile), { recursive: true });
  fs.writeFileSync(csvOutputFile, csvText, "utf8");
  fs.writeFileSync(jsonOutputFile, JSON.stringify(document, null, 2) + "\n", "utf8");
  console.info("[convert-hakka-lexicon] 转换完成:", { csvOutputFile, jsonOutputFile, entryCount: converted.rows.length });
}

if (require.main === module) {
  main();
}

module.exports = {
  buildLexiconDocument,
  convertWorkbookRows,
};
