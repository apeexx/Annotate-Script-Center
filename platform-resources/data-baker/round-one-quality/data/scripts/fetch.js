"use strict";

const fs = require("fs");
const path = require("path");
const { resolveDataBakerExportPaths } = require("../adapter");

function readLatestExportSnapshot(options) {
  const paths = resolveDataBakerExportPaths(options && typeof options === "object" ? options : {});
  return {
    paths,
    exists: {
      latestCsv: fs.existsSync(paths.latestCsvPath),
      latestMetaJson: fs.existsSync(paths.latestMetaPath),
      latestRawJson: fs.existsSync(paths.latestRawPath),
      historyDir: Boolean(paths.historyDirPath) && fs.existsSync(paths.historyDirPath),
      uploadEvents: Boolean(paths.eventsPath) && fs.existsSync(paths.eventsPath),
    },
  };
}

function readLatestExportMeta(options) {
  const snapshot = readLatestExportSnapshot(options && typeof options === "object" ? options : {});
  const metaPath = snapshot.paths.latestMetaPath;
  if (!metaPath || !fs.existsSync(metaPath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(metaPath, "utf8") || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    return null;
  }
}

function listHistoryCsvFiles(options) {
  const snapshot = readLatestExportSnapshot(options && typeof options === "object" ? options : {});
  const historyDir = snapshot.paths.historyDirPath;
  if (!historyDir || !fs.existsSync(historyDir)) {
    return [];
  }
  return fs
    .readdirSync(historyDir)
    .map(function (name) {
      const filePath = path.join(historyDir, name);
      const stat = fs.statSync(filePath);
      const rawJsonName = name.replace(/\.csv$/i, ".raw.json");
      const rawJsonPath = path.join(historyDir, rawJsonName);
      return {
        name: name,
        csvPath: filePath,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        rawJsonName: rawJsonName,
        rawJsonPath: rawJsonPath,
        rawJsonExists: fs.existsSync(rawJsonPath),
      };
    })
    .filter(function (entry) {
      return /\.csv$/i.test(entry.name);
    })
    .sort(function (a, b) {
      return String(b.modifiedAt).localeCompare(String(a.modifiedAt));
    });
}

function readUploadEventEntries(options) {
  const config = options && typeof options === "object" ? options : {};
  const snapshot = readLatestExportSnapshot(config);
  const eventsPath = snapshot.paths.eventsPath;
  if (!eventsPath || !fs.existsSync(eventsPath)) {
    return [];
  }
  const limit = Math.max(1, Number(config.limit) || 20);
  const lines = String(fs.readFileSync(eventsPath, "utf8") || "")
    .split(/\r?\n/)
    .map(function (line) {
      return line.trim();
    })
    .filter(Boolean);
  return lines
    .map(function (line) {
      try {
        const parsed = JSON.parse(line);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean)
    .sort(function (a, b) {
      return String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || ""));
    })
    .slice(0, limit);
}

module.exports = {
  listHistoryCsvFiles,
  readLatestExportMeta,
  readLatestExportSnapshot,
  readUploadEventEntries,
};
