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

test("Aishell Cantonese resolves the current segment before starting an AI request", function () {
  const start = source.indexOf("async function handleRecommend()");
  const end = source.indexOf("async function handleBatchStop()", start);
  const block = source.slice(start, end);

  assert.ok(block.indexOf("await dataApi.getCurrentItem()") < block.indexOf("segmentClipper.createAudioClipSession"));
  assert.ok(block.indexOf("segmentClipper.createAudioClipSession") < block.indexOf("await aiClient.recommend"));
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
  const start = source.indexOf("switchResult = await dataApi.selectSegmentByNumber(task.segmentNumber");
  const end = source.indexOf("saveResult = await dataApi.fillAndSaveCurrent(", start);
  const selectionBlock = source.slice(start, end);

  assert.match(selectionBlock, /if \(batchStopRequested === true\) \{\s*break;\s*\}/);
});

test("Aishell Cantonese lets an already-started platform save finish after batch stop", function () {
  const batchStart = source.indexOf("async function runBatchRecommend(mode)");
  const batchBlock = source.slice(batchStart);
  const saveStart = source.indexOf("saveResult = await dataApi.fillAndSaveCurrent(", batchStart);
  const saveEnd = source.indexOf("if (saveResult?.ok === false)", saveStart);
  const saveBlock = source.slice(saveStart, saveEnd);

  assert.doesNotMatch(batchBlock, /abortActiveSave\(\)/);
  assert.match(batchBlock, /releaseClipSession/);
  assert.match(saveBlock, /signal:\s*saveController\.signal/);
});

test("Aishell Cantonese batches current-audio blue segments and crops before each AI request", function () {
  const batchStart = source.indexOf("async function runBatchRecommend(mode)");
  const batchBlock = source.slice(batchStart);

  assert.match(batchBlock, /getBatchSegmentPlanForCurrentAudio/);
  assert.match(batchBlock, /createAudioClipSession/);
  assert.match(batchBlock, /buildCroppedSegmentItem\(/);
  assert.match(batchBlock, /selectSegmentByNumber\(task\.segmentNumber/);
});

test("Aishell Cantonese counts segment preflight failures before launching AI tasks", function () {
  const start = source.indexOf("async function runBatchRecommend(mode)");
  const block = source.slice(start);

  assert.match(block, /getBatchSegmentPlanForCurrentAudio/);
  assert.match(block, /preflightFailures/);
  assert.match(block, /tasks:\s*tasks/);
  assert.match(block, /tasks:\s*tasks,\s*concurrency:/);
});

test("Aishell Cantonese saves completed AI responses in the Minnan-style completion order", function () {
  const batchStart = source.indexOf("async function runBatchRecommend(mode)");
  const batchBlock = source.slice(batchStart);

  assert.doesNotMatch(batchBlock, /pendingEntriesByIndex/);
  assert.doesNotMatch(batchBlock, /nextSaveIndex/);
  assert.match(batchBlock, /const entry = outcome\?\.entry \|\| null/);
});

test("Aishell Cantonese manual stop follows Minnan semantics and leaves in-flight AI requests alone", function () {
  const stopStart = source.indexOf("async function handleBatchStop()");
  const stopEnd = source.indexOf("async function runBatchRecommend(mode)", stopStart);
  const stopBlock = source.slice(stopStart, stopEnd);

  assert.match(stopBlock, /requestStream\?\.cancelPending/);
  assert.doesNotMatch(stopBlock, /abortActiveRequests/);
  assert.doesNotMatch(stopBlock, /releaseClipSession/);
});

test("Aishell Cantonese keeps the request stream available to delayed clip-session cleanup", function () {
  const batchStart = source.indexOf("async function runBatchRecommend(mode)");
  const outerTryStart = source.indexOf("try {", batchStart);
  const outerTryEnd = source.indexOf("} catch (error)", outerTryStart);
  const beforeTry = source.slice(batchStart, outerTryStart);
  const outerTryBlock = source.slice(outerTryStart, outerTryEnd);

  assert.match(beforeTry, /let requestStream = null;/);
  assert.doesNotMatch(outerTryBlock, /let requestStream = null;/);
});

test("Aishell Cantonese marks an empty or #N# segment for review without filling or saving it", function () {
  const batchStart = source.indexOf("async function runBatchRecommend(mode)");
  const emptyStart = source.indexOf("if (entry.value?.needHumanReview === true", batchStart);
  const saveStart = source.indexOf("let switchResult = null", emptyStart);
  const emptyBlock = source.slice(emptyStart, saveStart);

  assert.match(emptyBlock, /needHumanReview/);
  assert.match(emptyBlock, /processedTaskCount \+= 1;\s*completedCount \+= 1;[\s\S]*continue;/);
  assert.doesNotMatch(emptyBlock, /nextSaveIndex/);
});
