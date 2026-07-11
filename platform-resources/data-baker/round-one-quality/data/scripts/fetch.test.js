"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");

const {
  listHistoryCsvFiles,
  readLatestExportMeta,
  readLatestExportSnapshot,
  readUploadEventEntries,
} = require("./fetch");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "asc-databaker-fetch-"));
}

test("DataBaker fetch script reads latest export snapshot paths and existence flags", function () {
  const tempDir = createTempDir();
  fs.writeFileSync(path.join(tempDir, "latest.csv"), "a,b\n1,2\n", "utf8");
  fs.writeFileSync(path.join(tempDir, "latest.json"), "{\"ok\":true}", "utf8");

  const snapshot = readLatestExportSnapshot({
    dataDir: tempDir,
  });

  assert.equal(snapshot.paths.latestCsvPath, path.join(tempDir, "latest.csv"));
  assert.equal(snapshot.exists.latestCsv, true);
  assert.equal(snapshot.exists.latestRawJson, false);
});

test("DataBaker fetch script lists only history csv files and sorts them by modifiedAt desc", function () {
  const tempDir = createTempDir();
  const historyDir = path.join(tempDir, "history");
  fs.mkdirSync(historyDir, { recursive: true });

  const firstCsv = path.join(historyDir, "20260528-first.csv");
  const secondCsv = path.join(historyDir, "20260528-second.csv");
  const ignoredRaw = path.join(historyDir, "20260528-second.raw.json");

  fs.writeFileSync(firstCsv, "a,b\n1,2\n", "utf8");
  fs.writeFileSync(secondCsv, "a,b\n3,4\n", "utf8");
  fs.writeFileSync(ignoredRaw, "{}", "utf8");

  fs.utimesSync(firstCsv, new Date("2026-05-28T09:00:00.000Z"), new Date("2026-05-28T09:00:00.000Z"));
  fs.utimesSync(secondCsv, new Date("2026-05-28T10:00:00.000Z"), new Date("2026-05-28T10:00:00.000Z"));

  const items = listHistoryCsvFiles({
    dataDir: tempDir,
  });

  assert.deepEqual(
    items.map(function (item) {
      return item.name;
    }),
    ["20260528-second.csv", "20260528-first.csv"]
  );
  assert.equal(items[0].rawJsonExists, true);
  assert.equal(items[0].rawJsonName, "20260528-second.raw.json");
  assert.equal(items[1].rawJsonExists, false);
});

test("DataBaker fetch script reads latest export meta and recent upload events", function () {
  const tempDir = createTempDir();
  fs.writeFileSync(
    path.join(tempDir, "latest.json"),
    JSON.stringify(
      {
        fileName: "latest.csv",
        rowCount: 12,
        taskIds: ["TASK-001"],
      },
      null,
      2
    ),
    "utf8"
  );
  fs.writeFileSync(
    path.join(tempDir, "upload-events.jsonl"),
    [
      JSON.stringify({
        uploadedAt: "2026-05-28T10:00:00.000Z",
        fileName: "20260528-a.csv",
      }),
      "not-json",
      JSON.stringify({
        uploadedAt: "2026-05-28T11:00:00.000Z",
        fileName: "20260528-b.csv",
      }),
    ].join("\n"),
    "utf8"
  );

  const latestMeta = readLatestExportMeta({
    dataDir: tempDir,
  });
  const recentEvents = readUploadEventEntries({
    dataDir: tempDir,
  });

  assert.equal(latestMeta.fileName, "latest.csv");
  assert.equal(latestMeta.rowCount, 12);
  assert.deepEqual(
    recentEvents.map(function (item) {
      return item.fileName;
    }),
    ["20260528-b.csv", "20260528-a.csv"]
  );
});
