"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const modulePath = path.resolve(__dirname, "asr-judgement-server.js");

function loadServerExports() {
  delete require.cache[modulePath];
  delete globalThis.__ASREdgeAlibabaLabelxJudgementServer;
  require(modulePath);
  return globalThis.__ASREdgeAlibabaLabelxJudgementServer || {};
}

test("ASR judgement server classifies exact label match as complete-skip", function () {
  const server = loadServerExports();
  const action = server.classifyExistingStatus("label", {
    exists: true,
    complete: true,
    missingFields: [],
  });

  assert.equal(action, "complete-skip");
});

test("ASR judgement server classifies label subTaskId conflict as conflict-skip", function () {
  const server = loadServerExports();
  const action = server.classifyExistingStatus("label", {
    exists: true,
    complete: false,
    missingFields: ["标注员双键冲突:子任务ID命中但用户名不一致"],
  });

  assert.equal(action, "conflict-skip");
});

test("ASR judgement server classifies label userName conflict as conflict-skip", function () {
  const server = loadServerExports();
  const action = server.classifyExistingStatus("label", {
    exists: true,
    complete: false,
    missingFields: ["标注员双键冲突:用户名命中但子任务ID不一致"],
  });

  assert.equal(action, "conflict-skip");
});

test("ASR judgement server keeps incomplete non-conflict rows in fetch-detail", function () {
  const server = loadServerExports();
  const action = server.classifyExistingStatus("label", {
    exists: true,
    complete: false,
    missingFields: ["题数"],
  });

  assert.equal(action, "fetch-detail");
});

test("ASR judgement server only re-fetches complete-skip entries during force replace", function () {
  const server = loadServerExports();

  assert.equal(server.shouldFetchDetailForExistingStatus("complete-skip", true), true);
  assert.equal(server.shouldFetchDetailForExistingStatus("complete-skip", false), false);
  assert.equal(server.shouldFetchDetailForExistingStatus("conflict-skip", true), false);
  assert.equal(server.shouldFetchDetailForExistingStatus("fetch-detail", true), true);
});
