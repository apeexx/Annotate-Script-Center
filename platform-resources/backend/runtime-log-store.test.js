"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  RUNTIME_LOG_RETENTION_DAYS,
  appendRuntimeLog,
  clearRuntimeLogsForTest,
  configureRuntimeLogStoreForTest,
  listRuntimeLogs,
  summarizeRuntimeLogs,
} = require("./runtime-log-store");

function createTempRuntimeDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "asc-runtime-log-store-"));
}

test("runtime log store writes daily files, removes expired files, and returns latest entries first", function () {
  clearRuntimeLogsForTest();
  const runtimeDataDir = createTempRuntimeDataDir();
  configureRuntimeLogStoreForTest({
    runtimeDataDir,
  });
  const staleFilePath = path.join(runtimeDataDir, "runtime-2026-05-20.jsonl");
  fs.writeFileSync(staleFilePath, "{\"message\":\"stale\"}\n", "utf8");
  appendRuntimeLog({
    createdAt: "2026-06-08T10:00:00.000Z",
    level: "info",
    scope: "admin.dashboard",
    action: "read",
    message: "first",
  });
  appendRuntimeLog({
    createdAt: "2026-06-08T10:01:00.000Z",
    level: "success",
    scope: "admin.session",
    action: "unlock_success",
    message: "second",
    details: {
      ok: true,
    },
  });

  const items = listRuntimeLogs({
    limit: 1,
    now: "2026-06-08T10:01:00.000Z",
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].message, "second");
  assert.equal(items[0].level, "success");
  assert.equal(items[0].details.ok, "true");
  const runtimeFilePath = path.join(runtimeDataDir, "runtime-2026-06-08.jsonl");
  assert.equal(fs.existsSync(runtimeFilePath), true);
  assert.equal(fs.existsSync(staleFilePath), false);
  assert.equal(fs.readFileSync(runtimeFilePath, "utf8").trim().split(/\r?\n/).length, 2);
  clearRuntimeLogsForTest();
});

test("runtime log summary reports 24 hour counters and latest failure", function () {
  clearRuntimeLogsForTest();
  const runtimeDataDir = createTempRuntimeDataDir();
  configureRuntimeLogStoreForTest({
    runtimeDataDir,
  });
  appendRuntimeLog({
    createdAt: "2026-06-08T09:00:00.000Z",
    level: "success",
    scope: "backend.server",
    action: "listen",
    message: "started",
  });
  appendRuntimeLog({
    createdAt: "2026-06-08T09:30:00.000Z",
    level: "warn",
    scope: "admin.session",
    action: "unlock_failed",
    message: "unlock failed",
    requestId: "req-warn",
  });
  appendRuntimeLog({
    createdAt: "2026-06-08T09:45:00.000Z",
    level: "error",
    scope: "admin.project_data_download",
    action: "request_failed",
    message: "download failed",
    requestId: "req-error",
  });
  appendRuntimeLog({
    createdAt: "2026-06-06T09:00:00.000Z",
    level: "success",
    scope: "admin.dashboard",
    action: "read",
    message: "older success",
  });

  const summary = summarizeRuntimeLogs({
    now: "2026-06-08T10:00:00.000Z",
  });

  assert.equal(summary.retentionDays, RUNTIME_LOG_RETENTION_DAYS);
  assert.equal(summary.recent24Hours.successCount, 1);
  assert.equal(summary.recent24Hours.warnCount, 1);
  assert.equal(summary.recent24Hours.errorCount, 1);
  assert.equal(summary.latestFailure.level, "error");
  assert.equal(summary.latestFailure.scope, "admin.project_data_download");
  assert.equal(summary.latestFailure.requestId, "req-error");
  clearRuntimeLogsForTest();
});
