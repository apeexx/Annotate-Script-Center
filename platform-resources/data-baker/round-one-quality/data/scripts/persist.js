"use strict";

const fs = require("fs");
const path = require("path");

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value || {});
  } catch (error) {
    return "{}";
  }
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function ensureExportRuntimeDirs(options) {
  const config = options && typeof options === "object" ? options : {};
  const dataDir = String(config.dataDir || "");
  const historyDirPath = String(config.historyDirPath || "");
  if (dataDir) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (config.includeHistory === true && historyDirPath) {
    fs.mkdirSync(historyDirPath, { recursive: true });
  }
}

function writeLatestExportArtifacts(options) {
  const config = options && typeof options === "object" ? options : {};
  const latestCsvPath = String(config.latestCsvPath || "");
  const latestRawPath = String(config.latestRawPath || "");
  const latestMetaPath = String(config.latestMetaPath || "");
  if (!latestCsvPath || !latestRawPath || !latestMetaPath) {
    throw new Error("latest 导出路径不完整。");
  }
  ensureExportRuntimeDirs({
    dataDir: path.dirname(latestCsvPath),
  });
  fs.writeFileSync(latestCsvPath, String(config.csvText || ""), "utf8");
  fs.writeFileSync(
    latestRawPath,
    JSON.stringify(Array.isArray(config.rawRecords) ? config.rawRecords : [], null, 2),
    "utf8"
  );
  fs.writeFileSync(latestMetaPath, JSON.stringify(config.meta || {}, null, 2), "utf8");
  return {
    csvPath: latestCsvPath,
    rawJsonPath: latestRawPath,
    latestMetaPath: latestMetaPath,
  };
}

function writeHistoryExportArtifacts(options) {
  const config = options && typeof options === "object" ? options : {};
  const historyDirPath = String(config.historyDirPath || "");
  const fileName = String(config.fileName || "");
  if (!historyDirPath || !fileName) {
    return {
      csvPath: "",
      rawPath: "",
    };
  }
  ensureExportRuntimeDirs({
    dataDir: historyDirPath,
  });
  const historyCsvPath = path.join(historyDirPath, fileName);
  const rawFileName = fileName.replace(/\.csv$/i, ".raw.json");
  const historyRawPath = path.join(historyDirPath, rawFileName);
  fs.writeFileSync(historyCsvPath, String(config.csvText || ""), "utf8");
  fs.writeFileSync(
    historyRawPath,
    JSON.stringify(Array.isArray(config.rawRecords) ? config.rawRecords : [], null, 2),
    "utf8"
  );
  return {
    csvPath: historyCsvPath,
    rawPath: historyRawPath,
  };
}

function createUploadMeta(options) {
  const config = options && typeof options === "object" ? options : {};
  const payload = normalizeObject(config.payload);
  const mergeResult = normalizeObject(config.mergeResult);
  const warnings = Array.isArray(config.warnings) ? config.warnings.slice() : [];
  const fileName = String(config.fileName || "");
  const uploadedAt = String(config.uploadedAt || "");
  return {
    schemaVersion: 1,
    source: String(payload.source || ""),
    project: String(payload.project || ""),
    fileName: fileName,
    rowCount: Number(mergeResult.rowCount) || 0,
    taskId: String(payload.taskId || ""),
    exportedAt: String(payload.exportedAt || ""),
    uploadedAt: uploadedAt,
    route: normalizeObject(payload.route),
    summary: normalizeObject(payload.summary),
    mergedSummary: {
      incomingRowCount: Number(mergeResult.incomingRowCount) || 0,
      existingRowCount: Number(mergeResult.existingRowCount) || 0,
      addedRowCount: Number(mergeResult.addedRowCount) || 0,
      updatedRowCount: Number(mergeResult.updatedRowCount) || 0,
      unchangedRowCount: Number(mergeResult.unchangedRowCount) || 0,
      rowCount: Number(mergeResult.rowCount) || 0,
    },
    taskIds: Array.isArray(mergeResult.taskIds) ? mergeResult.taskIds.slice() : [],
    lastUpload: {
      fileName: fileName,
      incomingRowCount: Number(mergeResult.incomingRowCount) || 0,
      addedRowCount: Number(mergeResult.addedRowCount) || 0,
      updatedRowCount: Number(mergeResult.updatedRowCount) || 0,
      unchangedRowCount: Number(mergeResult.unchangedRowCount) || 0,
      uploadedAt: uploadedAt,
    },
    warnings: warnings,
  };
}

function createUploadEventPayload(options) {
  const config = options && typeof options === "object" ? options : {};
  const mergeResult = normalizeObject(config.mergeResult);
  return {
    uploadedAt: String(config.uploadedAt || ""),
    fileName: String(config.fileName || ""),
    rowCount: Number(mergeResult.rowCount) || 0,
    incomingRowCount: Number(mergeResult.incomingRowCount) || 0,
    existingRowCount: Number(mergeResult.existingRowCount) || 0,
    addedRowCount: Number(mergeResult.addedRowCount) || 0,
    updatedRowCount: Number(mergeResult.updatedRowCount) || 0,
    unchangedRowCount: Number(mergeResult.unchangedRowCount) || 0,
    taskId: String(config.taskId || ""),
    taskIds: Array.isArray(mergeResult.taskIds) ? mergeResult.taskIds.slice() : [],
    latestCsvPath: String(config.latestCsvPath || ""),
    rawJsonPath: String(config.latestRawPath || ""),
    historyPath: String(config.historyPath || ""),
    historyRawJsonPath: String(config.historyRawJsonPath || ""),
  };
}

function appendUploadEventRecord(options) {
  const config = options && typeof options === "object" ? options : {};
  const eventsPath = String(config.eventsPath || "");
  if (!eventsPath) {
    return;
  }
  ensureExportRuntimeDirs({
    dataDir: path.dirname(eventsPath),
  });
  fs.appendFileSync(eventsPath, safeJsonStringify(config.eventPayload) + "\n", "utf8");
}

module.exports = {
  appendUploadEventRecord,
  createUploadEventPayload,
  createUploadMeta,
  ensureExportRuntimeDirs,
  writeHistoryExportArtifacts,
  writeLatestExportArtifacts,
};
