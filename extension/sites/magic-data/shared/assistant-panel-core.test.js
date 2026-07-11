"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const panelModule = require("./assistant-panel-core.js");

test("Magic Data shared result rows include lexicon status and mode", function () {
  const helper = panelModule.__test__?.buildResultRows;
  assert.equal(typeof helper, "function");

  const rows = helper(
    {
      shouldReview: false,
      textRuleCheck: {},
      audioCheck: {},
      models: {
        listenModel: "qwen3.5-omni-flash",
        reviewModel: "qwen3.5-flash",
      },
      timing: {
        totalDurationMs: 1200,
      },
      lexicon: {
        status: "missing",
        rewriteMode: "off",
      },
    },
    {}
  );
  const row = rows.find(function (item) {
    return item[0] === "词表状态与模式";
  });

  assert.deepEqual(row, [
    "词表状态与模式",
    "主词表缺失 / 固定携带 / 改写模式 off",
  ]);
});

test("Magic Data shared result rows include multi-stage estimated RMB rows", function () {
  const helper = panelModule.__test__?.buildResultRows;
  const rows = helper(
    {
      shouldReview: false,
      textRuleCheck: {},
      audioCheck: {},
      models: {
        listenModel: "qwen3.5-omni-flash",
        reviewModel: "qwen3.5-flash",
        modelMode: "two_stage",
      },
      timing: {
        listenDurationMs: 800,
        compareDurationMs: 400,
        totalDurationMs: 1200,
      },
      cost: {
        listen: {
          estimatedCostCny: 0.001762,
        },
        compare: {
          estimatedCostCny: 0.000321,
        },
        totalEstimatedCostCny: 0.002083,
      },
    },
    {}
  );

  assert.deepEqual(
    rows.filter(function (item) {
      return /预估人民币/.test(item[0]);
    }),
    [
      ["听音预估人民币", "0.001762 元"],
      ["复核预估人民币", "0.000321 元"],
      ["总预估人民币", "0.002083 元"],
    ]
  );
});

test("Magic Data shared result rows keep single-stage RMB row only", function () {
  const helper = panelModule.__test__?.buildResultRows;
  const rows = helper(
    {
      shouldReview: false,
      textRuleCheck: {},
      audioCheck: {},
      models: {
        modelMode: "omni_single",
        singleModel: "qwen3.5-omni-flash",
      },
      cost: {
        single: {
          reason: "没有数据源",
        },
      },
    },
    {}
  );

  assert.deepEqual(
    rows.filter(function (item) {
      return /预估人民币/.test(item[0]);
    }),
    [["预估人民币", "没有数据源"]]
  );
});
