"use strict";

const assert = require("assert");
const test = require("node:test");

const {
  buildSupplierRows,
  createLabelxDownloadFilename,
  createSupplierDownloadItems,
} = require("../labelx-download-core");

test("LabelX download core creates merged and supplier filenames with Shanghai timestamp", function () {
  const date = new Date("2026-05-28T04:05:00.000Z");

  assert.equal(
    createLabelxDownloadFilename("asr-transcription", "", date),
    "asr-transcription-statistics-merged-20260528-1205.csv"
  );
  assert.equal(
    createLabelxDownloadFilename("asr-judgement", "希尔贝壳", date),
    "asr-judgement-希尔贝壳-statistics-20260528-1205.csv"
  );
});

test("LabelX download core filters rows by supplier query", function () {
  const rowsByMergeRowId = {
    "qs::batch-1": {
      "分包ID": "batch-1",
      "任务名称": "棋燊 普通话任务",
      "供应商": "棋燊",
    },
    "bk::batch-2": {
      "分包ID": "batch-2",
      "任务名称": "希尔贝壳 普通话任务",
      "供应商": "希尔贝壳",
    },
  };

  const result = buildSupplierRows(rowsByMergeRowId, "棋燊");

  assert.deepEqual(Object.keys(result.filteredRows), ["qs::batch-1"]);
  assert.equal(result.requestedInfo.name, "棋燊");
});

test("LabelX download core maps supplier list into stable download items", function () {
  const items = createSupplierDownloadItems(
    [
      {
        supplier: "棋燊",
        safeSupplier: "qishen",
        rowCount: 12,
        csvPath: "C:/demo/statistics-merged.csv",
      },
    ],
    "/api/alibaba-labelx/asr-transcription/statistics/download"
  );

  assert.deepEqual(items, [
    {
      supplier: "棋燊",
      safeSupplier: "qishen",
      rowCount: 12,
      csvPath: "C:/demo/statistics-merged.csv",
      downloadPath:
        "/api/alibaba-labelx/asr-transcription/statistics/download?supplier=%E6%A3%8B%E7%87%8A",
    },
  ]);
});
