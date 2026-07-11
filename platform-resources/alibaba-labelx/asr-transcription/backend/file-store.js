"use strict";

const fs = require("fs");
const path = require("path");
const { CSV_COLUMNS } = require("./csv-columns");
const { writeMergedCsv } = require("./csv-writer");
const {
  cleanCsvValue,
  cleanHealthyCsvValue,
  hasReplacementChar,
  isCorruptedText,
  preferHealthyText,
  UNKNOWN_SUPPLIER_NAME,
  resolveSupplierInfo,
  sanitizeSupplierPathSegment,
} = require("../../backend/supplier-utils");

const MERGED_CSV_FILE_NAME = "statistics-merged.csv";
const QUALITY_CRITICAL_FIELDS = new Set(["任务名称", "标注员", "审核员", "供应商"]);

function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current);
  return cells;
}

function normalizeCsvHeaderName(header) {
  const cleaned = cleanCsvValue(header);
  if (cleaned === "有效时长(秒)") {
    return "有效时长";
  }
  return cleaned;
}

function readCsvRowList(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const lines = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(function (line) {
      return line.trim() !== "";
    });
  if (lines.length <= 1) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map(function (header) {
    return normalizeCsvHeaderName(header);
  });
  const batchIdIndex = headers.indexOf("分包ID");
  if (batchIdIndex < 0) {
    return [];
  }

  const rows = [];
  lines.slice(1).forEach(function (line) {
    const cells = parseCsvLine(line);
    const batchId = cleanCsvValue(cells[batchIdIndex] || "");
    if (!batchId) {
      return;
    }

    const row = {};
    headers.forEach(function (header, index) {
      const cleanedCell = cleanCsvValue(cells[index] || "");
      if (header === "有效时长" && row[header] && !cleanedCell) {
        return;
      }
      if (QUALITY_CRITICAL_FIELDS.has(header) && hasReplacementChar(cleanedCell)) {
        row[header] = cleanHealthyCsvValue(cleanedCell);
        return;
      }
      row[header] = cleanedCell;
    });
    row["分包ID"] = batchId;
    rows.push(row);
  });
  return rows;
}

function readCsvRows(filePath) {
  const rowsByBatchId = {};
  readCsvRowList(filePath).forEach(function (row) {
    const batchId = cleanCsvValue(row?.["分包ID"] || "");
    if (!batchId) {
      return;
    }
    rowsByBatchId[batchId] = row;
  });
  return rowsByBatchId;
}

function createEmptyRow(csvColumns) {
  const row = {};
  (csvColumns || CSV_COLUMNS).forEach(function (column) {
    row[column] = "";
  });
  return row;
}

function createMergeRowId(supplierKey, batchId) {
  return String(supplierKey || "unknown-supplier") + "::" + String(batchId || "");
}

function resolveRowSupplier(row, fallbackSupplierName) {
  const fallbackName = cleanCsvValue(fallbackSupplierName || "");
  const patch = Object.assign({}, row || {});
  patch["任务名称"] = preferHealthyText(patch["任务名称"] || "", "");
  patch["供应商"] = cleanCsvValue(patch["供应商"] || "");
  if (isCorruptedText(patch["供应商"])) {
    patch["供应商"] = "";
  }
  if (!patch["供应商"] && fallbackName && fallbackName !== UNKNOWN_SUPPLIER_NAME) {
    patch["供应商"] = fallbackName;
  }
  return resolveSupplierInfo({
    csvPatch: patch,
    taskName: patch["任务名称"] || "",
  });
}

function createStatisticsStore(options) {
  const config = options && typeof options === "object" ? options : {};
  const dataDir = config.dataDir || path.join(__dirname, "..", "statistics-data");
  const rowsPath = path.join(dataDir, "statistics-rows.json");
  const eventsPath = path.join(dataDir, "statistics-upload-events.jsonl");
  const csvPath = path.join(dataDir, MERGED_CSV_FILE_NAME);
  const csvColumns = Array.isArray(config.csvColumns) ? config.csvColumns : CSV_COLUMNS;
  const persistRowsJson = config.persistRowsJson === true;
  const persistUploadEvents = config.persistUploadEvents === true;

  function ensureDataDir() {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  function readRowsFromCsv(sourceCsvPath, fallbackSupplierName) {
    const rowsByMergeRowId = {};
    readCsvRowList(sourceCsvPath).forEach(function (csvRow) {
      const row = Object.assign(createEmptyRow(csvColumns), csvRow || {});
      const batchId = cleanCsvValue(row["分包ID"] || "");
      if (!batchId) {
        return;
      }
      const supplierInfo = resolveRowSupplier(row, fallbackSupplierName);
      row["供应商"] = cleanHealthyCsvValue(supplierInfo.name || UNKNOWN_SUPPLIER_NAME);
      row["任务名称"] = cleanHealthyCsvValue(row["任务名称"] || "");
      row["分包ID"] = batchId;
      const mergeRowId = createMergeRowId(supplierInfo.key, batchId);
      rowsByMergeRowId[mergeRowId] = row;
    });
    return rowsByMergeRowId;
  }

  function loadRows() {
    ensureDataDir();
    if (fs.existsSync(csvPath)) {
      return readRowsFromCsv(csvPath, UNKNOWN_SUPPLIER_NAME);
    }
    return readJsonFile(rowsPath, {}) || {};
  }

  function saveRows(rowsByMergeRowId) {
    if (!persistRowsJson) {
      return;
    }
    ensureDataDir();
    writeJsonFile(rowsPath, rowsByMergeRowId || {});
  }

  function writeCsv(rowsByMergeRowId) {
    ensureDataDir();
    const rowsByMergedKey = {};

    Object.keys(rowsByMergeRowId || {}).forEach(function (mergeRowId) {
      const row = Object.assign(createEmptyRow(csvColumns), rowsByMergeRowId[mergeRowId] || {});
      const batchId = cleanCsvValue(row["分包ID"] || "");
      if (!batchId) {
        return;
      }
      const supplierInfo = resolveRowSupplier(row, UNKNOWN_SUPPLIER_NAME);
      row["供应商"] = cleanHealthyCsvValue(supplierInfo.name || UNKNOWN_SUPPLIER_NAME);
      row["任务名称"] = cleanHealthyCsvValue(row["任务名称"] || "");
      row["分包ID"] = batchId;
      const stableMergeRowId = createMergeRowId(supplierInfo.key, batchId);
      rowsByMergedKey[stableMergeRowId] = row;
    });

    writeMergedCsv(csvPath, rowsByMergedKey, csvColumns);
  }

  function appendUploadEvent(payload) {
    if (!persistUploadEvents) {
      return;
    }
    ensureDataDir();
    fs.appendFileSync(eventsPath, JSON.stringify(payload) + "\n", "utf8");
  }

  function listSuppliers() {
    ensureDataDir();
    const rowsByMergeRowId = loadRows();
    const supplierMap = {};

    Object.keys(rowsByMergeRowId).forEach(function (mergeRowId) {
      const row = rowsByMergeRowId[mergeRowId] || {};
      const supplierInfo = resolveRowSupplier(row, UNKNOWN_SUPPLIER_NAME);
      const supplierName = cleanCsvValue(supplierInfo.name || UNKNOWN_SUPPLIER_NAME);
      const safeSupplier = sanitizeSupplierPathSegment(supplierInfo.safeName || supplierName);
      if (!supplierMap[safeSupplier]) {
        supplierMap[safeSupplier] = {
          supplier: supplierName,
          safeSupplier: safeSupplier,
          rowCount: 0,
          csvPath: csvPath,
        };
      }
      supplierMap[safeSupplier].rowCount += 1;
    });

    return Object.keys(supplierMap)
      .map(function (safeSupplier) {
        return supplierMap[safeSupplier];
      })
      .sort(function (left, right) {
        return String(left.supplier || "").localeCompare(String(right.supplier || ""), "zh-Hans-CN");
      });
  }

  function getPaths() {
    return {
      dataDir: dataDir,
      legacyCsvPath: "",
      rowsPath: persistRowsJson ? rowsPath : "",
      eventsPath: persistUploadEvents ? eventsPath : "",
      csvPath: csvPath,
    };
  }

  return {
    csvColumns: csvColumns,
    ensureDataDir: ensureDataDir,
    loadRows: loadRows,
    saveRows: saveRows,
    writeCsv: writeCsv,
    appendUploadEvent: appendUploadEvent,
    listSuppliers: listSuppliers,
    getPaths: getPaths,
  };
}

module.exports = {
  MERGED_CSV_FILE_NAME,
  createStatisticsStore,
  parseCsvLine,
  readCsvRowList,
  readCsvRows,
  readJsonFile,
  writeJsonFile,
};

