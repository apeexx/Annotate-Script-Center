"use strict";

const fs = require("node:fs");
const path = require("node:path");

const MAX_RUNTIME_LOG_ENTRIES = 200;
const RUNTIME_LOG_RETENTION_DAYS = 7;
const RUNTIME_LOG_FILE_NAME_PATTERN = /^runtime-(\d{4}-\d{2}-\d{2})\.jsonl$/i;
const DEFAULT_RUNTIME_LOG_DATA_DIR = path.join(__dirname, "admin-dashboard", "runtime-data");

const runtimeLogEntries = [];
let runtimeLogStoreTestConfig = {
  runtimeDataDir: "",
};

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeLevel(value) {
  const level = normalizeText(value).toLowerCase();
  if (level === "error" || level === "warn" || level === "success") {
    return level;
  }
  return "info";
}

function normalizeScope(value) {
  return normalizeText(value) || "backend";
}

function normalizeCreatedAt(value) {
  const text = normalizeText(value);
  if (!text) {
    return new Date().toISOString();
  }
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) {
    return new Date().toISOString();
  }
  return new Date(timestamp).toISOString();
}

function sanitizeDetails(input) {
  const source = input && typeof input === "object" ? input : {};
  const entries = Object.entries(source).slice(0, 10);
  return entries.reduce(function reduceDetails(result, entry) {
    const key = normalizeText(entry[0]);
    if (!key) {
      return result;
    }
    const value = entry[1];
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      result[key] = String(value);
      return result;
    }
    try {
      result[key] = JSON.stringify(value).slice(0, 240);
    } catch (_error) {
      result[key] = "[unserializable]";
    }
    return result;
  }, {});
}

function cloneRuntimeLogEntry(item) {
  return {
    createdAt: normalizeCreatedAt(item?.createdAt),
    level: normalizeLevel(item?.level),
    scope: normalizeScope(item?.scope),
    action: normalizeText(item?.action) || "event",
    message: normalizeText(item?.message) || "运行事件",
    requestId: normalizeText(item?.requestId),
    details: sanitizeDetails(item?.details),
  };
}

function getRuntimeLogStoreConfig() {
  return {
    runtimeDataDir: normalizeText(runtimeLogStoreTestConfig.runtimeDataDir) || DEFAULT_RUNTIME_LOG_DATA_DIR,
    retentionDays: RUNTIME_LOG_RETENTION_DAYS,
  };
}

function ensureRuntimeDataDir(runtimeDataDir) {
  fs.mkdirSync(runtimeDataDir, { recursive: true });
  return runtimeDataDir;
}

function toRuntimeDateKey(createdAt) {
  return normalizeCreatedAt(createdAt).slice(0, 10);
}

function getRuntimeLogFilePath(runtimeDataDir, dateKey) {
  return path.join(runtimeDataDir, "runtime-" + dateKey + ".jsonl");
}

function getKeepAfterDateKey(referenceIso, retentionDays) {
  const referenceDate = new Date(normalizeCreatedAt(referenceIso));
  const keepDate = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate()
    )
  );
  keepDate.setUTCDate(keepDate.getUTCDate() - Math.max(0, retentionDays - 1));
  return keepDate.toISOString().slice(0, 10);
}

function cleanupRuntimeLogFiles(referenceIso) {
  const { runtimeDataDir, retentionDays } = getRuntimeLogStoreConfig();
  ensureRuntimeDataDir(runtimeDataDir);
  const keepAfterDateKey = getKeepAfterDateKey(referenceIso, retentionDays);
  fs.readdirSync(runtimeDataDir).forEach(function removeExpiredFile(fileName) {
    const matched = RUNTIME_LOG_FILE_NAME_PATTERN.exec(fileName);
    if (!matched) {
      return;
    }
    const dateKey = normalizeText(matched[1]);
    if (dateKey && dateKey < keepAfterDateKey) {
      fs.rmSync(path.join(runtimeDataDir, fileName), {
        force: true,
      });
    }
  });
}

function readRuntimeLogEntries(referenceIso) {
  const { runtimeDataDir } = getRuntimeLogStoreConfig();
  ensureRuntimeDataDir(runtimeDataDir);
  cleanupRuntimeLogFiles(referenceIso || new Date().toISOString());
  const entries = [];
  fs.readdirSync(runtimeDataDir)
    .filter(function matchRuntimeLogFile(fileName) {
      return RUNTIME_LOG_FILE_NAME_PATTERN.test(fileName);
    })
    .sort()
    .reverse()
    .forEach(function readRuntimeLogFile(fileName) {
      const filePath = path.join(runtimeDataDir, fileName);
      const lines = String(fs.readFileSync(filePath, "utf8") || "")
        .split(/\r?\n/)
        .map(function trimLine(line) {
          return line.trim();
        })
        .filter(Boolean);
      lines.forEach(function parseRuntimeLogLine(line) {
        try {
          entries.push(cloneRuntimeLogEntry(JSON.parse(line)));
        } catch (_error) {
        }
      });
    });
  return entries.sort(function sortRuntimeLogEntries(left, right) {
    return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
  });
}

function appendRuntimeLog(input) {
  const source = input && typeof input === "object" ? input : {};
  const entry = cloneRuntimeLogEntry(source);
  runtimeLogEntries.unshift(
    Object.assign(
      {
        persist: source.persist !== false,
      },
      entry
    )
  );
  if (runtimeLogEntries.length > MAX_RUNTIME_LOG_ENTRIES) {
    runtimeLogEntries.length = MAX_RUNTIME_LOG_ENTRIES;
  }

  if (source.persist !== false) {
    try {
      const { runtimeDataDir } = getRuntimeLogStoreConfig();
      ensureRuntimeDataDir(runtimeDataDir);
      cleanupRuntimeLogFiles(entry.createdAt);
      fs.appendFileSync(
        getRuntimeLogFilePath(runtimeDataDir, toRuntimeDateKey(entry.createdAt)),
        JSON.stringify(entry) + "\n",
        "utf8"
      );
    } catch (_error) {
    }
  }

  return Object.assign({}, entry);
}

function listRuntimeLogs(options) {
  const config = options && typeof options === "object" ? options : {};
  const limit = Math.max(1, Math.min(100, Number(config.limit || 20) || 20));
  const fileEntries = readRuntimeLogEntries(config.now);
  const sourceEntries =
    fileEntries.length > 0
      ? fileEntries
      : runtimeLogEntries.filter(function onlyPersistentEntry(item) {
          return item && item.persist !== false;
        });
  return sourceEntries.slice(0, limit).map(cloneRuntimeLogEntry);
}

function summarizeRuntimeLogs(options) {
  const config = options && typeof options === "object" ? options : {};
  const nowIso = normalizeCreatedAt(config.now);
  const nowTimestamp = Date.parse(nowIso);
  const recentThreshold = nowTimestamp - 24 * 60 * 60 * 1000;
  const entries = readRuntimeLogEntries(nowIso);
  const summary = {
    retentionDays: RUNTIME_LOG_RETENTION_DAYS,
    recent24Hours: {
      successCount: 0,
      warnCount: 0,
      errorCount: 0,
    },
    latestFailure: null,
  };

  entries.forEach(function collectSummary(item) {
    const createdAtTimestamp = Date.parse(item.createdAt);
    if (
      Number.isFinite(createdAtTimestamp) &&
      createdAtTimestamp >= recentThreshold &&
      createdAtTimestamp <= nowTimestamp
    ) {
      if (item.level === "success") {
        summary.recent24Hours.successCount += 1;
      } else if (item.level === "warn") {
        summary.recent24Hours.warnCount += 1;
      } else if (item.level === "error") {
        summary.recent24Hours.errorCount += 1;
      }
    }
    if (!summary.latestFailure && (item.level === "warn" || item.level === "error")) {
      summary.latestFailure = {
        createdAt: item.createdAt,
        level: item.level,
        scope: item.scope,
        message: item.message,
        requestId: item.requestId,
      };
    }
  });

  return summary;
}

function configureRuntimeLogStoreForTest(options) {
  const config = options && typeof options === "object" ? options : {};
  runtimeLogStoreTestConfig = {
    runtimeDataDir: normalizeText(config.runtimeDataDir),
  };
}

function clearRuntimeLogsForTest() {
  runtimeLogEntries.length = 0;
  runtimeLogStoreTestConfig = {
    runtimeDataDir: "",
  };
}

module.exports = {
  MAX_RUNTIME_LOG_ENTRIES,
  RUNTIME_LOG_RETENTION_DAYS,
  appendRuntimeLog,
  clearRuntimeLogsForTest,
  configureRuntimeLogStoreForTest,
  listRuntimeLogs,
  summarizeRuntimeLogs,
};
