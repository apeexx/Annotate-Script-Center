"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.resolve(__dirname, "content.js"), "utf8");

test("Aishell Cantonese uses listenText and only fills a single item", function () {
  const start = source.indexOf("async function handleRecommend()");
  const end = source.indexOf("async function handleBatchStop()", start);
  const block = source.slice(start, end);

  assert.match(block, /listenText/);
  assert.doesNotMatch(block, /fillAndSaveCurrent/);
});

test("Aishell Cantonese single-item action fills raw listenText without saving", function () {
  const panelSource = fs.readFileSync(path.resolve(__dirname, "ui-panel.js"), "utf8");
  const start = panelSource.indexOf("function fillCurrentRecommendedText()");
  const end = panelSource.indexOf("function ignoreCurrentResult()", start);
  const block = panelSource.slice(start, end);

  assert.match(block, /fillPageText\(result\.listenText/);
  assert.doesNotMatch(block, /fillAndSaveCurrent/);
});

test("Aishell Cantonese batch serially uses the platform save button with raw listenText", function () {
  const start = source.indexOf("async function runBatchRecommend(mode)");
  const block = source.slice(start);

  assert.match(block, /fillAndSaveCurrent\(\s*entry\.value\.listenText/);
  assert.doesNotMatch(block, /recommendedSpeed/);
});

test("Aishell Cantonese stops after selecting a batch target before starting a new save", function () {
  const start = source.indexOf("switchResult = await dataApi.selectTask(task");
  const end = source.indexOf("saveResult = await dataApi.fillAndSaveCurrent(", start);
  const selectionBlock = source.slice(start, end);

  assert.match(selectionBlock, /if \(batchStopRequested === true\) \{\s*break;\s*\}/);
});

test("Aishell Cantonese aborts a pending save when batch stop is requested", function () {
  const batchStart = source.indexOf("async function runBatchRecommend(mode)");
  const batchBlock = source.slice(batchStart);
  const saveStart = source.indexOf("saveResult = await dataApi.fillAndSaveCurrent(", batchStart);
  const saveEnd = source.indexOf("if (saveResult?.ok === false)", saveStart);
  const saveBlock = source.slice(saveStart, saveEnd);

  assert.match(batchBlock, /abortActiveSave/);
  assert.match(saveBlock, /signal:\s*saveController\.signal/);
});
