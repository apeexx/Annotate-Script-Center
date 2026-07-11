"use strict";

const fs = require("fs");
const {
  cleanCsvValue,
  cleanHealthyCsvValue,
  hasReplacementChar,
  isCorruptedText,
  preferHealthyText,
  resolveSupplierInfo,
  UNKNOWN_SUPPLIER_NAME,
} = require("../../backend/supplier-utils");

const QUALITY_CRITICAL_FIELDS = new Set(["任务名称", "标注员_P", "审核员_P", "供应商"]);

function escapeCsvCell(value) {
  const text = cleanCsvValue(value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function cleanCsvRow(row) {
  const source = row && typeof row === "object" ? row : {};
  const result = {};
  Object.keys(source).forEach(function (key) {
    const cleaned = cleanCsvValue(source[key]);
    if (QUALITY_CRITICAL_FIELDS.has(key) && hasReplacementChar(cleaned)) {
      result[key] = cleanHealthyCsvValue(cleaned);
      return;
    }
    result[key] = cleaned;
  });
  return result;
}

function collectDistinctSuppliers(rows) {
  const supplierSet = new Set();
  rows.forEach(function (row) {
    const supplierInfo = resolveSupplierInfo({
      csvPatch: row || {},
      taskName: row?.["任务名称"] || "",
    });
    const supplierName = String(supplierInfo?.name || "").trim();
    if (!supplierName) {
      return;
    }
    supplierSet.add(supplierName);
  });
  return supplierSet;
}

function enrichRowsWithSuppliers(rows) {
  return (Array.isArray(rows) ? rows : []).map(function (row) {
    const normalizedRow = cleanCsvRow(row || {});
    normalizedRow["任务名称"] = preferHealthyText(
      normalizedRow["任务名称"] || "",
      row?.["任务名称"] || ""
    );
    const supplierInfo = resolveSupplierInfo({
      csvPatch: normalizedRow,
      taskName: normalizedRow["任务名称"] || "",
    });
    normalizedRow["供应商"] = cleanHealthyCsvValue(
      String(supplierInfo?.name || UNKNOWN_SUPPLIER_NAME)
    );
    if (isCorruptedText(normalizedRow["供应商"])) {
      normalizedRow["供应商"] = UNKNOWN_SUPPLIER_NAME;
    }
    return normalizedRow;
  });
}

function getOutputCsvColumns(baseColumns, rows) {
  const columns = Array.isArray(baseColumns) ? baseColumns.slice() : [];
  const columnsWithoutSupplier = columns.filter(function (column) {
    return column !== "供应商";
  });
  const suppliers = collectDistinctSuppliers(rows);
  if (suppliers.size > 1) {
    return columnsWithoutSupplier.concat("供应商");
  }
  if (suppliers.size === 1) {
    const onlySupplier = Array.from(suppliers)[0];
    if (onlySupplier && onlySupplier !== UNKNOWN_SUPPLIER_NAME) {
      return columnsWithoutSupplier;
    }
  }
  return columnsWithoutSupplier;
}

function createMergedCsvContent(rowsByBatchId, csvColumns) {
  const rows = enrichRowsWithSuppliers(
    Object.keys(rowsByBatchId)
    .sort()
    .map(function (batchId) {
      return rowsByBatchId[batchId] || {};
    })
  );
  const outputColumns = getOutputCsvColumns(csvColumns, rows);

  const lines = [outputColumns.map(escapeCsvCell).join(",")].concat(
    rows.map(function (row) {
      return outputColumns
        .map(function (column) {
          return escapeCsvCell(row[column]);
        })
        .join(",");
    })
  );

  return "\uFEFF" + lines.join("\n");
}

function writeMergedCsv(filePath, rowsByBatchId, csvColumns) {
  const csvContent = createMergedCsvContent(rowsByBatchId, csvColumns);
  fs.writeFileSync(filePath, csvContent, "utf8");
}

module.exports = {
  cleanCsvRow,
  enrichRowsWithSuppliers,
  collectDistinctSuppliers,
  createMergedCsvContent,
  escapeCsvCell,
  getOutputCsvColumns,
  writeMergedCsv,
};

