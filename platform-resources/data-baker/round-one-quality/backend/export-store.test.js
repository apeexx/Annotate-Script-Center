"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");

const { createExportStore } = require("./export-store");
const { parseCsvText } = require("../data/scripts/csv");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "asc-databaker-export-store-"));
}

test("DataBaker export store saves latest artifacts and appends history/events", function () {
  const tempDir = createTempDir();
  const store = createExportStore({
    dataDir: tempDir,
    persistHistory: true,
    persistEvents: true,
  });

  store.ensureDataDir();

  const result = store.saveUpload({
    fileName: "demo.csv",
    csvText: "\uFEFF任务ID,文本编号,质检人_P\nTASK-001,TXT-001,张三\n",
    rawRecords: [{ textNumber: "TXT-001", taskId: "TASK-001" }],
    taskId: "TASK-001",
  });

  const paths = store.getPaths();
  const parsed = parseCsvText(fs.readFileSync(paths.latestCsvPath, "utf8"));
  const latestMeta = JSON.parse(fs.readFileSync(paths.latestMetaPath, "utf8"));
  const eventLines = fs
    .readFileSync(paths.eventsPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map(function (line) {
      return JSON.parse(line);
    });

  assert.equal(result.rowCount, 1);
  assert.equal(result.addedRowCount, 1);
  assert.equal(fs.existsSync(paths.latestCsvPath), true);
  assert.equal(fs.existsSync(paths.latestRawPath), true);
  assert.equal(fs.existsSync(paths.latestMetaPath), true);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]["文本编号"], "TXT-001");
  assert.equal(latestMeta.rowCount, 1);
  assert.equal(eventLines.length, 1);
  assert.equal(eventLines[0].taskId, "TASK-001");
  assert.equal(Boolean(result.historyPath), true);
  assert.equal(Boolean(result.historyRawJsonPath), true);
});

test("DataBaker export store updates existing latest row by textNumber", function () {
  const tempDir = createTempDir();
  const store = createExportStore({
    dataDir: tempDir,
    persistHistory: false,
    persistEvents: false,
  });

  store.ensureDataDir();

  store.saveUpload({
    fileName: "first.csv",
    csvText: "\uFEFF任务ID,文本编号,质检人_P\nTASK-001,TXT-001,张三\n",
    rawRecords: [{ textNumber: "TXT-001", taskId: "TASK-001", reviewer: "张三" }],
    taskId: "TASK-001",
  });

  const result = store.saveUpload({
    fileName: "second.csv",
    csvText: "\uFEFF任务ID,文本编号,质检人_P\nTASK-002,TXT-001,李四\n",
    rawRecords: [{ textNumber: "TXT-001", taskId: "TASK-002", reviewer: "李四" }],
    taskId: "TASK-002",
  });

  const paths = store.getPaths();
  const parsed = parseCsvText(fs.readFileSync(paths.latestCsvPath, "utf8"));
  const latestRaw = JSON.parse(fs.readFileSync(paths.latestRawPath, "utf8"));

  assert.equal(result.rowCount, 1);
  assert.equal(result.updatedRowCount, 1);
  assert.equal(result.addedRowCount, 0);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]["任务ID"], "TASK-002");
  assert.equal(parsed.rows[0]["质检人_P"], "李四");
  assert.equal(latestRaw.length, 1);
  assert.equal(latestRaw[0].reviewer, "李四");
});
