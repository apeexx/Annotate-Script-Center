"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  appendRuntimeLog,
  clearRuntimeLogsForTest,
  configureRuntimeLogStoreForTest,
} = require("../runtime-log-store");
const { buildAdminDashboardRuntimeLogs } = require("./runtime-logs");

test("admin dashboard runtime logs payload exposes recent entries", function () {
  clearRuntimeLogsForTest();
  configureRuntimeLogStoreForTest({
    runtimeDataDir: fs.mkdtempSync(path.join(os.tmpdir(), "asc-admin-runtime-logs-")),
  });
  appendRuntimeLog({
    createdAt: "2026-06-02T09:30:00.000Z",
    level: "warn",
    scope: "admin.project_data_download",
    action: "request_failed",
    message: "项目数据下载失败",
  });

  const payload = buildAdminDashboardRuntimeLogs({
    limit: 5,
  });

  assert.equal(payload.success, true);
  assert.equal(Array.isArray(payload.data.items), true);
  assert.equal(payload.data.items.length, 1);
  assert.equal(payload.data.retentionDays, 7);
  assert.equal(payload.data.limit, 5);
  assert.equal(payload.data.items[0].scope, "admin.project_data_download");
  clearRuntimeLogsForTest();
});
