"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const panelModule = require("./assistant-panel.js");

test("resolveFillAllSuggestionsOutcome treats no-op fills as success", function () {
  const helper = panelModule.__test__?.resolveFillAllSuggestionsOutcome;
  assert.equal(typeof helper, "function");

  const result = helper(0, []);

  assert.deepEqual(result, {
    ok: true,
    noChanges: true,
    appliedCount: 0,
    message: "无需填入，保持当前内容。",
  });
});

test("resolveFillAllSuggestionsOutcome keeps real fill failures as errors", function () {
  const helper = panelModule.__test__?.resolveFillAllSuggestionsOutcome;
  assert.equal(typeof helper, "function");

  const result = helper(0, [{ ok: false, message: "第一行填入失败。" }]);

  assert.deepEqual(result, {
    ok: false,
    noChanges: false,
    appliedCount: 0,
    message: "第一行填入失败。",
  });
});

test("buildOverallRows includes lexicon status and mode", function () {
  const helper = panelModule.__test__?.buildOverallRows;
  assert.equal(typeof helper, "function");

  const rows = helper({
    reviewConclusion: "pass",
    lexicon: {
      status: "ready",
      rewriteMode: "aggressive",
    },
    models: {
      listenModel: "qwen3.5-omni-flash",
      reviewModel: "qwen3.5-plus",
    },
    timing: {
      totalDurationMs: 1600,
    },
  });
  const row = rows.find(function (item) {
    return item[0] === "词表状态与模式";
  });

  assert.deepEqual(row, [
    "词表状态与模式",
    "主词表已加载 / 固定携带 / 改写模式 aggressive",
  ]);
});

test("show raw output button stays enabled without result", function () {
  const helper = panelModule.__test__?.shouldDisableShowRawOutput;
  assert.equal(typeof helper, "function");

  assert.equal(helper(false, false), false);
});

test("unwrapResultEnvelope unwraps nested success data payload", function () {
  const helper = panelModule.__test__?.unwrapResultEnvelope;
  assert.equal(typeof helper, "function");

  const result = helper({
    success: true,
    data: {
      success: true,
      data: {
        requestId: "req-1",
        reviewConclusion: "need_review",
        shouldReview: true,
        models: {
          listenModel: "qwen3.5-omni-flash",
        },
      },
    },
  });

  assert.deepEqual(result, {
    requestId: "req-1",
    reviewConclusion: "need_review",
    shouldReview: true,
    models: {
      listenModel: "qwen3.5-omni-flash",
    },
  });
});
