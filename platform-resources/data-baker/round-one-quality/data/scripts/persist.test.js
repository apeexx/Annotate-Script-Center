"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");

const {
  appendUploadEventRecord,
  createUploadEventPayload,
  createUploadMeta,
  ensureExportRuntimeDirs,
  writeHistoryExportArtifacts,
  writeLatestExportArtifacts,
} = require("./persist");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "asc-databaker-persist-"));
}

test("DataBaker persist script builds upload meta from payload, merge summary and warnings", function () {
  const meta = createUploadMeta({
    payload: {
      source: "extension-test",
      project: "data-baker/round-one-quality",
      taskId: "TASK-001",
      exportedAt: "2026-05-28T12:00:00.000Z",
      route: { pathname: "/group/detail" },
      summary: { teamName: "示例团队" },
    },
    fileName: "demo.csv",
    uploadedAt: "2026-05-28T12:00:10.000Z",
    mergeResult: {
      rowCount: 18,
      incomingRowCount: 8,
      existingRowCount: 10,
      addedRowCount: 3,
      updatedRowCount: 4,
      unchangedRowCount: 1,
      taskIds: ["TASK-001", "TASK-002"],
    },
    warnings: ["latest-raw.json 解析失败，已忽略旧 rawRecords。"],
  });

  assert.equal(meta.fileName, "demo.csv");
  assert.equal(meta.rowCount, 18);
  assert.equal(meta.taskId, "TASK-001");
  assert.equal(meta.uploadedAt, "2026-05-28T12:00:10.000Z");
  assert.deepEqual(meta.taskIds, ["TASK-001", "TASK-002"]);
  assert.deepEqual(meta.mergedSummary, {
    incomingRowCount: 8,
    existingRowCount: 10,
    addedRowCount: 3,
    updatedRowCount: 4,
    unchangedRowCount: 1,
    rowCount: 18,
  });
  assert.deepEqual(meta.lastUpload, {
    fileName: "demo.csv",
    incomingRowCount: 8,
    addedRowCount: 3,
    updatedRowCount: 4,
    unchangedRowCount: 1,
    uploadedAt: "2026-05-28T12:00:10.000Z",
  });
  assert.deepEqual(meta.warnings, ["latest-raw.json 解析失败，已忽略旧 rawRecords。"]);
});

test("DataBaker persist script writes latest/history artifacts and appends upload events", function () {
  const tempDir = createTempDir();
  const historyDir = path.join(tempDir, "history");
  const latestCsvPath = path.join(tempDir, "latest.csv");
  const latestRawPath = path.join(tempDir, "latest-raw.json");
  const latestMetaPath = path.join(tempDir, "latest.json");
  const eventsPath = path.join(tempDir, "upload-events.jsonl");

  ensureExportRuntimeDirs({
    dataDir: tempDir,
    historyDirPath: historyDir,
    includeHistory: true,
  });

  writeLatestExportArtifacts({
    latestCsvPath: latestCsvPath,
    latestRawPath: latestRawPath,
    latestMetaPath: latestMetaPath,
    csvText: "任务ID,文本编号\nTASK-001,TXT-001\n",
    rawRecords: [{ textNumber: "TXT-001" }],
    meta: { fileName: "demo.csv", rowCount: 1 },
  });

  const history = writeHistoryExportArtifacts({
    historyDirPath: historyDir,
    fileName: "20260528-demo.csv",
    csvText: "任务ID,文本编号\nTASK-001,TXT-001\n",
    rawRecords: [{ textNumber: "TXT-001" }],
  });

  appendUploadEventRecord({
    eventsPath: eventsPath,
    eventPayload: createUploadEventPayload({
      uploadedAt: "2026-05-28T12:00:10.000Z",
      fileName: "demo.csv",
      mergeResult: {
        rowCount: 1,
        incomingRowCount: 1,
        existingRowCount: 0,
        addedRowCount: 1,
        updatedRowCount: 0,
        unchangedRowCount: 0,
        taskIds: ["TASK-001"],
      },
      taskId: "TASK-001",
      latestCsvPath: latestCsvPath,
      latestRawPath: latestRawPath,
      historyPath: history.csvPath,
      historyRawJsonPath: history.rawPath,
    }),
  });

  assert.equal(fs.existsSync(latestCsvPath), true);
  assert.equal(fs.existsSync(latestRawPath), true);
  assert.equal(fs.existsSync(latestMetaPath), true);
  assert.equal(fs.existsSync(history.csvPath), true);
  assert.equal(fs.existsSync(history.rawPath), true);

  const eventLines = fs
    .readFileSync(eventsPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map(function (line) {
      return JSON.parse(line);
    });

  assert.equal(eventLines.length, 1);
  assert.equal(eventLines[0].fileName, "demo.csv");
  assert.equal(eventLines[0].historyPath, history.csvPath);
  assert.equal(eventLines[0].historyRawJsonPath, history.rawPath);
});
