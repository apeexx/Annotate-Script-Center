"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sourcePath = path.resolve(__dirname, "content.js");

test("Aishell Vietnamese single result includes displayed text and speed", function () {
  const source = fs.readFileSync(sourcePath, "utf8");
  const start = source.indexOf("async function handleRecommend()");
  const end = source.indexOf("async function handleBatchStop()", start);
  const block = start >= 0 && end > start ? source.slice(start, end) : "";

  assert.match(block, /panel\.renderResult\([\s\S]*currentDisplayText:/);
  assert.match(block, /currentDisplaySpeed:/);
});

test("Aishell Vietnamese batch save passes recommended text and speed", function () {
  const source = fs.readFileSync(sourcePath, "utf8");
  const start = source.indexOf("saveResult = await dataApi.fillAndSaveCurrent(");
  const block = start >= 0 ? source.slice(start, start + 420) : "";

  assert.match(block, /text:\s*entry\.value\.recommendedText/);
  assert.match(block, /speed:\s*entry\.value\.recommendedSpeed/);
});
