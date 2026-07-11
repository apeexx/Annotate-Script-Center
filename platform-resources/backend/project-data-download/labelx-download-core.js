"use strict";

const fs = require("fs");
const { createCorsHeaders, sendJson } = require("../response");
const {
  resolveSupplierInfo,
  sanitizeSupplierPathSegment,
} = require("../../alibaba-labelx/backend/supplier-utils");

function formatDownloadTimestamp(date) {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map = {};
  parts.forEach(function (part) {
    map[part.type] = part.value;
  });
  return (
    String(map.year || "") +
    String(map.month || "") +
    String(map.day || "") +
    "-" +
    String(map.hour || "") +
    String(map.minute || "")
  );
}

function createLabelxDownloadFilename(prefix, supplierName, date) {
  const stamp = formatDownloadTimestamp(date || new Date());
  const safePrefix = String(prefix || "download").trim() || "download";
  if (!supplierName) {
    return safePrefix + "-statistics-merged-" + stamp + ".csv";
  }
  const safeName = sanitizeSupplierPathSegment(supplierName);
  return safePrefix + "-" + safeName + "-statistics-" + stamp + ".csv";
}

function sanitizeHeaderFilename(value) {
  const text = String(value || "download.csv")
    .replace(/[\r\n]/g, "")
    .replace(/"/g, "")
    .trim();
  return text || "download.csv";
}

function createAsciiFallbackFilename(filename) {
  const cleaned = sanitizeHeaderFilename(filename);
  const hasCsvExt = /\.csv$/i.test(cleaned);
  const base = hasCsvExt ? cleaned.replace(/\.csv$/i, "") : cleaned;
  const asciiBase = base
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/[\\/:*?<>|]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim();
  return (asciiBase || "download") + ".csv";
}

function createContentDisposition(filename) {
  const utf8Filename = sanitizeHeaderFilename(filename);
  const asciiFilename = createAsciiFallbackFilename(utf8Filename);
  return (
    'attachment; filename="' +
    asciiFilename +
    '"; filename*=UTF-8\'\'' +
    encodeURIComponent(utf8Filename)
  );
}

function createCsvDownloadHeaders(filename, fileSize) {
  const contentDisposition = createContentDisposition(filename);
  return createCorsHeaders({
    "Cache-Control": "no-store",
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Length": String(fileSize),
    "Content-Disposition": contentDisposition,
  });
}

function matchesSupplier(row, requestedInfo, requestedSafe) {
  const rowInfo = resolveSupplierInfo({
    csvPatch: row || {},
    taskName: row?.["任务名称"] || "",
  });
  return (
    String(rowInfo.key || "") === String(requestedInfo.key || "") ||
    String(rowInfo.safeName || "") === requestedSafe ||
    String(rowInfo.name || "") === String(requestedInfo.name || "")
  );
}

function buildSupplierRows(rowsByMergeRowId, supplierQuery) {
  const requested = String(supplierQuery || "").trim();
  const requestedSafe = sanitizeSupplierPathSegment(requested);
  const requestedInfo = resolveSupplierInfo({
    supplier: requested,
    taskName: requested,
    csvPatch: { 供应商: requested },
  });

  const rows = rowsByMergeRowId && typeof rowsByMergeRowId === "object" ? rowsByMergeRowId : {};
  const filteredRows = {};
  Object.keys(rows).forEach(function (mergeRowId) {
    const row = rows[mergeRowId] || {};
    if (matchesSupplier(row, requestedInfo, requestedSafe)) {
      filteredRows[mergeRowId] = row;
    }
  });
  return {
    filteredRows,
    requestedInfo,
  };
}

function createSupplierDownloadItems(items, downloadPath) {
  const list = Array.isArray(items) ? items : [];
  return list.map(function (item) {
    return {
      supplier: item.supplier,
      safeSupplier: item.safeSupplier,
      rowCount: item.rowCount,
      csvPath: item.csvPath,
      downloadPath:
        String(downloadPath || "") +
        "?supplier=" +
        encodeURIComponent(String(item.supplier || "")),
    };
  });
}

function handleLabelxSuppliers(response, store, downloadPath) {
  const data = createSupplierDownloadItems(store.listSuppliers(), downloadPath);
  sendJson(response, 200, {
    success: true,
    data,
  });
}

function handleLabelxDownloadCsv(request, response, query, store, options) {
  const config = options && typeof options === "object" ? options : {};
  const supplierQuery = String(query?.supplier || "").trim();
  const downloadFilePrefix = String(config.downloadFilePrefix || "download").trim() || "download";
  const createMergedCsvContent = config.createMergedCsvContent;

  if (!supplierQuery) {
    const targetCsvPath = String(store.getPaths().csvPath || "");
    if (!targetCsvPath || !fs.existsSync(targetCsvPath)) {
      sendJson(response, 404, {
        success: false,
        message: "统计 CSV 文件不存在，请先上传或生成统计数据。",
        csvPath: targetCsvPath,
      });
      return;
    }
    const stat = fs.statSync(targetCsvPath);
    if (!stat.isFile()) {
      sendJson(response, 404, {
        success: false,
        message: "统计 CSV 路径不是文件。",
        csvPath: targetCsvPath,
      });
      return;
    }
    const filename = createLabelxDownloadFilename(downloadFilePrefix, "", new Date());
    response.writeHead(200, createCsvDownloadHeaders(filename, stat.size));
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    fs.createReadStream(targetCsvPath).pipe(response);
    return;
  }

  const supplierRowsResult = buildSupplierRows(store.loadRows() || {}, supplierQuery);
  const supplierRows = supplierRowsResult.filteredRows || {};
  if (Object.keys(supplierRows).length === 0) {
    sendJson(response, 404, {
      success: false,
      message: "未找到该供应商数据。",
      supplier: supplierQuery,
    });
    return;
  }
  const csvContent = createMergedCsvContent(supplierRows, store.csvColumns);
  const bodyBuffer = Buffer.from(csvContent, "utf8");
  const filename = createLabelxDownloadFilename(
    downloadFilePrefix,
    supplierRowsResult.requestedInfo?.safeName || supplierQuery,
    new Date()
  );
  response.writeHead(200, createCsvDownloadHeaders(filename, bodyBuffer.length));
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  response.end(bodyBuffer);
}

module.exports = {
  buildSupplierRows,
  createAsciiFallbackFilename,
  createContentDisposition,
  createCsvDownloadHeaders,
  createLabelxDownloadFilename,
  createSupplierDownloadItems,
  formatDownloadTimestamp,
  handleLabelxDownloadCsv,
  handleLabelxSuppliers,
  sanitizeHeaderFilename,
};
