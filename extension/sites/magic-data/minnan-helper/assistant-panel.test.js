"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const panelModule = require("./assistant-panel.js");

test("buildOverallRows includes lexicon status and mode", function () {
  const helper = panelModule.__test__?.buildOverallRows;
  assert.equal(typeof helper, "function");

  const rows = helper({
    reviewConclusion: "pass",
    lexicon: {
      status: "missing",
      rewriteMode: "off",
    },
    models: {
      listenModel: "qwen3.5-omni-flash",
      reviewModel: "qwen3.5-plus",
    },
    timing: {
      totalDurationMs: 1800,
    },
  });
  const row = rows.find(function (item) {
    return item[0] === "词表状态与模式";
  });

  assert.deepEqual(row, [
    "词表状态与模式",
    "主词表缺失 / 固定携带 / 改写模式 off",
  ]);
});

test("show raw output button stays enabled without result", function () {
  const helper = panelModule.__test__?.shouldDisableShowRawOutput;
  assert.equal(typeof helper, "function");

  assert.equal(helper(false, false), false);
});
