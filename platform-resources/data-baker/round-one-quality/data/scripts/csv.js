"use strict";

const { LEGACY_HEADER_ALIAS } = require("../field-mappings");

const UTF8_BOM = "\uFEFF";

function stripBom(text) {
  const value = String(text || "");
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function normalizeCsvHeaderName(header) {
  const value = stripBom(header).trim();
  return LEGACY_HEADER_ALIAS[value] || value;
}

function parseCsvText(csvText) {
  const text = stripBom(csvText);
  if (!text.trim()) {
    throw new Error("CSV 为空。");
  }
  const rows = [];
  let field = "";
  let record = [];
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      record.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\n") {
      record.push(field);
      rows.push(record);
      record = [];
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  record.push(field);
  rows.push(record);

  const nonEmptyRows = rows.filter(function (row) {
    return row.some(function (cell) {
      return String(cell || "").trim() !== "";
    });
  });
  if (nonEmptyRows.length === 0) {
    throw new Error("CSV 无有效内容。");
  }
  const rawHeaders = nonEmptyRows[0].map(normalizeCsvHeaderName).filter(Boolean);
  if (rawHeaders.length === 0) {
    throw new Error("CSV 表头缺失或无法解析。");
  }
  const headers = [];
  const headerSet = new Set();
  for (let idx = 0; idx < rawHeaders.length; idx += 1) {
    const name = rawHeaders[idx];
    if (!name || headerSet.has(name)) {
      continue;
    }
    headers.push(name);
    headerSet.add(name);
  }
  if (headers.length === 0) {
    throw new Error("CSV 表头缺失或无法解析。");
  }
  const dataRows = [];
  for (let rowIndex = 1; rowIndex < nonEmptyRows.length; rowIndex += 1) {
    const sourceRow = nonEmptyRows[rowIndex];
    const rowObj = {};
    let hasValue = false;
    for (let col = 0; col < rawHeaders.length; col += 1) {
      const header = rawHeaders[col];
      if (!header) {
        continue;
      }
      const value = sourceRow[col] != null ? String(sourceRow[col]) : "";
      if (value.trim() !== "") {
        hasValue = true;
      }
      rowObj[header] = value;
    }
    if (hasValue) {
      dataRows.push(rowObj);
    }
  }
  return {
    headers,
    rows: dataRows,
  };
}

function toCsvCell(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

function stringifyCsv(rows, headers) {
  const safeHeaders = (Array.isArray(headers) ? headers : []).filter(Boolean);
  if (safeHeaders.length === 0) {
    throw new Error("CSV 表头缺失或无法写出。");
  }
  const lines = [];
  lines.push(safeHeaders.map(toCsvCell).join(","));
  const list = Array.isArray(rows) ? rows : [];
  for (let i = 0; i < list.length; i += 1) {
    const row = list[i] || {};
    lines.push(
      safeHeaders
        .map(function (header) {
          return toCsvCell(row[header] == null ? "" : row[header]);
        })
        .join(",")
    );
  }
  return UTF8_BOM + lines.join("\n");
}

function readCsvRowCount(csvText) {
  const parsed = parseCsvText(csvText);
  return parsed.rows.length;
}

module.exports = {
  normalizeCsvHeaderName,
  parseCsvText,
  readCsvRowCount,
  stringifyCsv,
};
