"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");

const { createCsvDownloadTarget } = require("../csv-file-download-core");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "asc-project-download-"));
}

test("CSV file download core derives basename and file size from an existing csv file", function () {
  const tempDir = createTempDir();
  const csvPath = path.join(tempDir, "latest.csv");
  fs.writeFileSync(csvPath, "\uFEFFa,b\n1,2\n", "utf8");

  const target = createCsvDownloadTarget(csvPath);

  assert.equal(target.filePath, csvPath);
  assert.equal(target.fileName, "latest.csv");
  assert.equal(target.fileSize, Buffer.byteLength("\uFEFFa,b\n1,2\n", "utf8"));
});

test("CSV file download core supports explicit download filename and custom missing message", function () {
  const tempDir = createTempDir();
  const csvPath = path.join(tempDir, "latest.csv");
  fs.writeFileSync(csvPath, "a,b\n1,2\n", "utf8");

  const target = createCsvDownloadTarget(csvPath, {
    fileName: "data-baker-round-one-quality-latest.csv",
  });

  assert.equal(target.fileName, "data-baker-round-one-quality-latest.csv");
  assert.throws(
    function () {
      createCsvDownloadTarget(path.join(tempDir, "missing.csv"), {
        missingMessage: "latest.csv 不存在，请先上传导出数据。",
      });
    },
    /latest\.csv 不存在，请先上传导出数据。/
  );
});
