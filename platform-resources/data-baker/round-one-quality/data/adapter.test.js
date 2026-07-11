"use strict";

const assert = require("assert");
const path = require("path");
const test = require("node:test");

const {
  createLegacyExportDownloadTarget,
  createProjectDownloadDataset,
} = require("./adapter");

test("DataBaker data adapter exposes shared project download dataset metadata", function () {
  const dataset = createProjectDownloadDataset({
    dataDir: "C:\\demo\\export-data",
  });

  assert.equal(dataset.id, "data-baker-round-one-export");
  assert.equal(dataset.label, "闽南语助手导出数据");
  assert.equal(dataset.defaultFileName, "data-baker-round-one-quality-latest.csv");
  assert.equal(dataset.getCsvPath(), path.join("C:\\demo\\export-data", "latest.csv"));
});

test("DataBaker data adapter exposes legacy export download target for current route", function () {
  const target = createLegacyExportDownloadTarget({
    dataDir: "C:\\demo\\export-data",
  });

  assert.equal(target.fileName, "latest.csv");
  assert.equal(target.filePath, path.join("C:\\demo\\export-data", "latest.csv"));
});
