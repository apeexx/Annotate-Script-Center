"use strict";

const fs = require("fs");
const path = require("path");
const {
  normalizeCsvHeaderName,
  parseCsvText,
  readCsvRowCount,
  stringifyCsv,
} = require("../data/scripts/csv");
const {
  createCsvRowKey,
  mergeCsvRows,
  mergeRawRecords,
} = require("../data/scripts/merge");
const {
  appendUploadEventRecord,
  createUploadEventPayload,
  createUploadMeta,
  ensureExportRuntimeDirs,
  writeHistoryExportArtifacts,
  writeLatestExportArtifacts,
} = require("../data/scripts/persist");

const DEFAULT_LATEST_FILE_NAME = "latest.csv";
const DEFAULT_META_FILE_NAME = "latest.json";
const DEFAULT_RAW_FILE_NAME = "latest-raw.json";
const DEFAULT_HISTORY_DIR_NAME = "history";
const DEFAULT_EVENTS_FILE_NAME = "upload-events.jsonl";

function sanitizeFileName(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  const cleaned = text
    .replace(/[\\\/]+/g, "-")
    .replace(/\.\./g, "")
    .replace(/[^a-zA-Z0-9._\-\u4e00-\u9fa5]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return cleaned;
}

function ensureCsvExtension(fileName, fallback) {
  const text = sanitizeFileName(fileName || "");
  const base = text || sanitizeFileName(fallback || "") || "data-baker-round-one-quality-export.csv";
  if (/\.csv$/i.test(base)) {
    return base;
  }
  return base + ".csv";
}

function resolveExportStorePaths(options) {
  const config = options && typeof options === "object" ? options : {};
  const dataDir = config.dataDir || path.join(__dirname, "export-data");
  return {
    dataDir: dataDir,
    latestCsvPath: path.join(dataDir, DEFAULT_LATEST_FILE_NAME),
    latestMetaPath: path.join(dataDir, DEFAULT_META_FILE_NAME),
    latestRawPath: path.join(dataDir, DEFAULT_RAW_FILE_NAME),
    historyDirPath: path.join(dataDir, DEFAULT_HISTORY_DIR_NAME),
    eventsPath: path.join(dataDir, DEFAULT_EVENTS_FILE_NAME),
  };
}

function createExportStore(options) {
  const config = options && typeof options === "object" ? options : {};
  const resolvedPaths = resolveExportStorePaths(config);
  const dataDir = resolvedPaths.dataDir;
  const latestCsvPath = resolvedPaths.latestCsvPath;
  const latestMetaPath = resolvedPaths.latestMetaPath;
  const latestRawPath = resolvedPaths.latestRawPath;
  const historyDirPath = resolvedPaths.historyDirPath;
  const eventsPath = resolvedPaths.eventsPath;
  const persistHistory = config.persistHistory === true;
  const persistEvents = config.persistEvents === true;

  function ensureDataDir() {
    ensureExportRuntimeDirs({
      dataDir: dataDir,
      historyDirPath: historyDirPath,
      includeHistory: persistHistory,
    });
  }

  function saveUpload(payload) {
    const fileName = ensureCsvExtension(payload?.fileName, "data-baker-round-one-quality-export.csv");
    const csvText = String(payload?.csvText || "");
    const uploadedAt = new Date().toISOString();
    const rawRecords = Array.isArray(payload?.rawRecords)
      ? payload.rawRecords
      : Array.isArray(payload?.rawJson)
        ? payload.rawJson
        : [];
    const warnings = [];
    let existingCsvText = "";
    if (fs.existsSync(latestCsvPath)) {
      existingCsvText = fs.readFileSync(latestCsvPath, "utf8");
    }
    let mergeResult;
    try {
      mergeResult = mergeCsvRows(existingCsvText, csvText);
    } catch (error) {
      if (existingCsvText && String(existingCsvText || "").trim()) {
        throw new Error("latest.csv 解析失败，已拒绝覆盖：" + (error && error.message ? error.message : String(error)));
      }
      throw error;
    }
    const mergedCsvText = stringifyCsv(mergeResult.mergedRows, mergeResult.headers);

    let existingRawRecords = [];
    if (fs.existsSync(latestRawPath)) {
      try {
        const rawText = fs.readFileSync(latestRawPath, "utf8");
        const parsedRaw = JSON.parse(rawText || "[]");
        existingRawRecords = Array.isArray(parsedRaw) ? parsedRaw : [];
      } catch (error) {
        warnings.push("latest-raw.json 解析失败，已忽略旧 rawRecords。");
      }
    }
    let mergedRawRecords = existingRawRecords;
    try {
      mergedRawRecords = mergeRawRecords(existingRawRecords, rawRecords);
    } catch (error) {
      warnings.push("rawRecords 合并失败，已保留旧 rawRecords。");
      mergedRawRecords = existingRawRecords;
    }

    const meta = createUploadMeta({
      payload: payload,
      fileName: fileName,
      uploadedAt: uploadedAt,
      mergeResult: mergeResult,
      warnings: warnings,
    });

    writeLatestExportArtifacts({
      latestCsvPath: latestCsvPath,
      latestRawPath: latestRawPath,
      latestMetaPath: latestMetaPath,
      csvText: mergedCsvText,
      rawRecords: mergedRawRecords,
      meta: meta,
    });
    const historyFileName = sanitizeFileName(uploadedAt.replace(/[^\dTZ]/g, "") + "-" + fileName)
      || ("upload-" + Date.now() + ".csv");
    const history = persistHistory
      ? writeHistoryExportArtifacts({
          historyDirPath: historyDirPath,
          fileName: historyFileName,
          csvText: csvText,
          rawRecords: rawRecords,
        })
      : {
          csvPath: "",
          rawPath: "",
        };
    if (persistEvents) {
      appendUploadEventRecord({
        eventsPath: eventsPath,
        eventPayload: createUploadEventPayload({
          uploadedAt: uploadedAt,
          fileName: fileName,
          mergeResult: mergeResult,
          taskId: meta.taskId,
          latestCsvPath: latestCsvPath,
          latestRawPath: latestRawPath,
          historyPath: history.csvPath,
          historyRawJsonPath: history.rawPath,
        }),
      });
    }

    return {
      fileName: fileName,
      rowCount: mergeResult.rowCount,
      incomingRowCount: mergeResult.incomingRowCount,
      existingRowCount: mergeResult.existingRowCount,
      addedRowCount: mergeResult.addedRowCount,
      updatedRowCount: mergeResult.updatedRowCount,
      unchangedRowCount: mergeResult.unchangedRowCount,
      taskIds: mergeResult.taskIds,
      csvPath: latestCsvPath,
      rawJsonPath: latestRawPath,
      latestMetaPath: latestMetaPath,
      historyPath: history.csvPath,
      historyRawJsonPath: history.rawPath,
      uploadedAt: uploadedAt,
      warnings,
    };
  }

  function getPaths() {
    return {
      dataDir: dataDir,
      latestCsvPath: latestCsvPath,
      latestRawPath: latestRawPath,
      latestMetaPath: latestMetaPath,
      historyDirPath: persistHistory ? historyDirPath : "",
      eventsPath: persistEvents ? eventsPath : "",
    };
  }

  return {
    ensureDataDir,
    saveUpload,
    getPaths,
  };
}

module.exports = {
  DEFAULT_EVENTS_FILE_NAME,
  DEFAULT_HISTORY_DIR_NAME,
  DEFAULT_LATEST_FILE_NAME,
  DEFAULT_META_FILE_NAME,
  DEFAULT_RAW_FILE_NAME,
  MAX_CSV_BYTES: 20 * 1024 * 1024,
  createCsvRowKey,
  createExportStore,
  ensureCsvExtension,
  mergeCsvRows,
  normalizeCsvHeaderName,
  parseCsvText,
  readCsvRowCount,
  resolveExportStorePaths,
  sanitizeFileName,
  stringifyCsv,
};
