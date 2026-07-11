"use strict";

const assert = require("assert");
const test = require("node:test");

const {
  MAX_RAW_RECORDS_BYTES,
  normalizeExportUploadPayload,
} = require("./upload");

test("DataBaker upload script normalizes upload payload fields and rawJson alias", function () {
  const payload = normalizeExportUploadPayload({
    schemaVersion: "2",
    source: "extension-test",
    project: "data-baker/round-one-quality",
    exportedAt: "2026-05-28T10:00:00.000Z",
    fileName: "demo.csv",
    csvText: "任务ID,文本编号\n1,001\n",
    rawJson: [{ textNumber: "001" }],
    rowCount: "5",
    taskId: 12345,
    route: { pathname: "/quality/roundOne" },
    summary: { teamName: "示例团队" },
  });

  assert.equal(payload.schemaVersion, 2);
  assert.equal(payload.fileName, "demo.csv");
  assert.equal(payload.taskId, "12345");
  assert.equal(payload.rowCount, 5);
  assert.deepEqual(payload.rawRecords, [{ textNumber: "001" }]);
  assert.deepEqual(payload.route, { pathname: "/quality/roundOne" });
  assert.deepEqual(payload.summary, { teamName: "示例团队" });
});

test("DataBaker upload script rejects empty csvText before backend store save", function () {
  assert.throws(function () {
    normalizeExportUploadPayload({
      csvText: "   ",
      rawRecords: [],
    });
  }, /csvText 不能为空/);

  assert.equal(MAX_RAW_RECORDS_BYTES, 10 * 1024 * 1024);
});
