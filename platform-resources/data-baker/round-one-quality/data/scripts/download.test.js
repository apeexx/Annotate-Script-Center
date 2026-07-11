"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");

const { createLatestCsvDownloadTarget } = require("./download");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "asc-databaker-download-"));
}

test("DataBaker download script resolves latest.csv as the legacy export download target", function () {
  const tempDir = createTempDir();
  const csvPath = path.join(tempDir, "latest.csv");
  fs.writeFileSync(csvPath, "a,b\n1,2\n", "utf8");

  const target = createLatestCsvDownloadTarget({
    dataDir: tempDir,
  });

  assert.equal(target.filePath, csvPath);
  assert.equal(target.fileName, "latest.csv");
  assert.equal(typeof target.headers["Content-Disposition"], "string");
});
