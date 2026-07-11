"use strict";

const { MAX_CSV_BYTES } = require("../../backend/export-store");

const MAX_RAW_RECORDS_BYTES = 10 * 1024 * 1024;

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeExportUploadPayload(value) {
  const body = normalizeObject(value);
  const csvText = String(body.csvText || "");
  if (!csvText.trim()) {
    throw new Error("csvText 不能为空。");
  }
  const csvBytes = Buffer.byteLength(csvText, "utf8");
  if (csvBytes > MAX_CSV_BYTES) {
    throw new Error("csvText 超过 20MB 限制。");
  }

  const rawRecords = Array.isArray(body.rawRecords)
    ? body.rawRecords
    : Array.isArray(body.rawJson)
      ? body.rawJson
      : [];
  const rawRecordsBytes = Buffer.byteLength(JSON.stringify(rawRecords), "utf8");
  if (rawRecordsBytes > MAX_RAW_RECORDS_BYTES) {
    throw new Error("rawRecords 超过 10MB 限制。");
  }

  return {
    schemaVersion: Number(body.schemaVersion) || 1,
    source: String(body.source || ""),
    project: String(body.project || ""),
    exportedAt: String(body.exportedAt || ""),
    fileName: String(body.fileName || ""),
    csvText: csvText,
    rawRecords: rawRecords,
    rowCount: Number(body.rowCount),
    taskId: String(body.taskId || ""),
    route: normalizeObject(body.route),
    summary: normalizeObject(body.summary),
  };
}

module.exports = {
  MAX_RAW_RECORDS_BYTES,
  normalizeExportUploadPayload,
};
