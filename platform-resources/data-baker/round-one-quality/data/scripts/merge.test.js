"use strict";

const assert = require("assert");
const test = require("node:test");

const {
  createCsvRowKey,
  mergeCsvRows,
  mergeRawRecords,
} = require("./merge");

test("DataBaker merge script keeps textNumber precedence and reports merge statistics", function () {
  const result = mergeCsvRows(
    "任务ID,文本编号,质检人_P\nTASK-001,TXT-001,张三\n",
    "任务ID,文本编号,质检人\nTASK-002,TXT-001,李四\nTASK-003,TXT-002,王五\n"
  );

  assert.equal(result.rowCount, 2);
  assert.equal(result.existingRowCount, 1);
  assert.equal(result.incomingRowCount, 2);
  assert.equal(result.addedRowCount, 1);
  assert.equal(result.updatedRowCount, 1);
  assert.equal(result.unchangedRowCount, 0);
  assert.deepEqual(result.taskIds, ["TASK-002", "TASK-003"]);
  assert.equal(
    createCsvRowKey({
      文本编号: "TXT-001",
      文件名: "a.wav",
      段编号: "1",
    }),
    "textNumber:TXT-001"
  );
});

test("DataBaker merge script merges raw records by textNumber", function () {
  const merged = mergeRawRecords(
    [
      { textNumber: "TXT-001", text: "旧值" },
      { textNumber: "TXT-002", text: "保留值" },
    ],
    [
      { textNumber: "TXT-001", text: "新值" },
      { textNumber: "TXT-003", text: "新增值" },
    ]
  );

  assert.equal(merged.length, 3);
  assert.deepEqual(
    merged.find(function (item) {
      return item.textNumber === "TXT-001";
    }),
    { textNumber: "TXT-001", text: "新值" }
  );
});
