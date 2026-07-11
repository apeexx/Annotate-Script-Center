"use strict";

const assert = require("assert");
const test = require("node:test");

const {
  normalizeCsvHeaderName,
  parseCsvText,
  readCsvRowCount,
  stringifyCsv,
} = require("./csv");

test("DataBaker csv script normalizes legacy headers and parses rows with BOM", function () {
  const parsed = parseCsvText(
    "\uFEFF任务ID,质检人,有效时长\r\nTASK-001,张三,3.2\r\n"
  );

  assert.deepEqual(parsed.headers, ["任务ID", "质检人_P", "有效合格时长_S"]);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]["质检人_P"], "张三");
  assert.equal(normalizeCsvHeaderName("有效时长"), "有效合格时长_S");
});

test("DataBaker csv script stringifies rows with BOM and supports row count helper", function () {
  const csvText = stringifyCsv(
    [
      {
        任务ID: "TASK-001",
        文本编号: "TXT-001",
      },
    ],
    ["任务ID", "文本编号"]
  );

  assert.equal(csvText.charCodeAt(0), 0xfeff);
  assert.equal(readCsvRowCount(csvText), 1);
});
