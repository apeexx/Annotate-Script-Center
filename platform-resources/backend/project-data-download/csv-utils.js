"use strict";

const SENSITIVE_HEADER_PATTERN =
  /(cookie|authorization|access[_-]?token|refresh[_-]?token|signature|ossaccesskeyid|audio[_-]?url|signed[_-]?url)/i;
const SENSITIVE_VALUE_PATTERN =
  /(cookie|authorization|access[_-]?token|refresh[_-]?token|ossaccesskeyid|signature=|x-oss-signature|x-amz-signature)/i;

function normalizeText(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/\uFEFF/g, "")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\t\r\n\f\v]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeColumnName(value) {
  return normalizeText(value).replace(/\s+/g, "");
}

function parseCsv(text) {
  const input = String(text || "");
  if (!input) {
    return { headers: [], rows: [] };
  }

  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (inQuotes) {
      if (char === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = false;
        continue;
      }
      cell += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  if (rows.length <= 0) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0].map(function (header) {
    return normalizeText(header);
  });
  const dataRows = rows.slice(1).filter(function (dataRow) {
    return dataRow.some(function (item) {
      return String(item || "") !== "";
    });
  });
  return {
    headers: headers,
    rows: dataRows,
  };
}

function toCsvCell(value) {
  const text = String(value === undefined || value === null ? "" : value);
  if (text.indexOf('"') >= 0 || text.indexOf(",") >= 0 || text.indexOf("\n") >= 0 || text.indexOf("\r") >= 0) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

function stringifyCsv(headers, rows, includeBom) {
  const safeHeaders = Array.isArray(headers) ? headers : [];
  const safeRows = Array.isArray(rows) ? rows : [];
  const lines = [];
  lines.push(safeHeaders.map(toCsvCell).join(","));
  safeRows.forEach(function (row) {
    const list = Array.isArray(row) ? row : [];
    lines.push(list.map(toCsvCell).join(","));
  });
  const csvBody = lines.join("\n");
  return includeBom === false ? csvBody : "\uFEFF" + csvBody;
}

function findColumnIndex(headers, targetName) {
  const list = Array.isArray(headers) ? headers : [];
  const target = normalizeColumnName(targetName);
  if (!target) {
    return -1;
  }
  for (let index = 0; index < list.length; index += 1) {
    if (normalizeColumnName(list[index]) === target) {
      return index;
    }
  }
  return -1;
}

function collectSuppliers(parsed) {
  const headers = parsed?.headers || [];
  const rows = parsed?.rows || [];
  const supplierIndex = findColumnIndex(headers, "供应商");
  if (supplierIndex < 0) {
    return [];
  }
  const seen = new Set();
  const suppliers = [];
  rows.forEach(function (row) {
    const supplier = normalizeText(Array.isArray(row) ? row[supplierIndex] : "");
    if (!supplier || seen.has(supplier)) {
      return;
    }
    seen.add(supplier);
    suppliers.push(supplier);
  });
  return suppliers;
}

function filterRowsBySupplier(parsed, supplierName) {
  const headers = parsed?.headers || [];
  const rows = parsed?.rows || [];
  const supplierIndex = findColumnIndex(headers, "供应商");
  const targetSupplier = normalizeText(supplierName);
  if (supplierIndex < 0 || !targetSupplier) {
    return rows.slice();
  }
  return rows.filter(function (row) {
    const cell = normalizeText(Array.isArray(row) ? row[supplierIndex] : "");
    return cell === targetSupplier;
  });
}

function isSensitiveHeader(header) {
  return SENSITIVE_HEADER_PATTERN.test(normalizeText(header));
}

function sanitizeCellValue(header, value) {
  const text = String(value === undefined || value === null ? "" : value);
  const headerText = normalizeText(header);
  if (isSensitiveHeader(headerText)) {
    return "";
  }
  if (SENSITIVE_VALUE_PATTERN.test(text.toLowerCase())) {
    return "[redacted]";
  }
  if (/^https?:\/\//i.test(text.trim())) {
    return "[url-redacted]";
  }
  return text;
}

function sanitizeParsedCsv(headers, rows) {
  const safeHeaders = [];
  const sourceHeaders = Array.isArray(headers) ? headers : [];
  const sourceRows = Array.isArray(rows) ? rows : [];
  const keptIndexes = [];

  sourceHeaders.forEach(function (header, index) {
    const normalized = normalizeText(header);
    const normalizedColumn = normalizeColumnName(header);
    if (normalizedColumn === "原始JSON") {
      return;
    }
    if (isSensitiveHeader(normalized)) {
      return;
    }
    keptIndexes.push(index);
    safeHeaders.push(normalized || "列" + String(index + 1));
  });

  const safeRows = sourceRows.map(function (row) {
    return keptIndexes.map(function (sourceIndex, targetIndex) {
      const header = safeHeaders[targetIndex] || "";
      return sanitizeCellValue(header, Array.isArray(row) ? row[sourceIndex] : "");
    });
  });

  return {
    headers: safeHeaders,
    rows: safeRows,
  };
}

function appendSupplierSuffix(fileName, supplierName) {
  const base = String(fileName || "download.csv");
  const supplier = normalizeText(supplierName)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "");
  if (!supplier) {
    return base;
  }
  const dotIndex = base.lastIndexOf(".");
  if (dotIndex <= 0) {
    return base + "-" + supplier;
  }
  return base.slice(0, dotIndex) + "-" + supplier + base.slice(dotIndex);
}

module.exports = {
  appendSupplierSuffix,
  collectSuppliers,
  filterRowsBySupplier,
  findColumnIndex,
  normalizeText,
  parseCsv,
  sanitizeParsedCsv,
  stringifyCsv,
};
