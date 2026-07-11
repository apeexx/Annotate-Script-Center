"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const panelModule = require("./ui-panel.js");

test("DataBaker result rows include lexicon status and mode", function () {
  const helper = panelModule.__test__?.buildResultRows;
  assert.equal(typeof helper, "function");

  const rows = helper({
    pageText: "页面文本",
    heardText: "听音文本",
    recommendedText: "推荐文本。",
    isChanged: true,
    listenConfidence: 0.9,
    compareConfidence: 0.8,
    model: {
      listen: "fun-asr",
      compare: "qwen3.5-plus",
    },
    pipelineMode: "fun_asr_compare",
    decision: "minor_edit",
    requestId: "req-1",
    lexicon: {
      status: "ready",
      rewriteMode: "aggressive",
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

test("DataBaker result rows include multi-stage estimated RMB rows", function () {
  const helper = panelModule.__test__?.buildResultRows;
  const rows = helper({
    pageText: "页面文本",
    heardText: "听音文本",
    recommendedText: "推荐文本。",
    isChanged: true,
    listenConfidence: 0.9,
    compareConfidence: 0.8,
    model: {
      listen: "qwen3.5-omni-flash",
      compare: "qwen3.5-plus",
    },
    pipelineMode: "two_stage",
    cost: {
      listen: {
        estimatedCostCny: 0.001762,
      },
      compare: {
        estimatedCostCny: 0.000114,
      },
      totalEstimatedCostCny: 0.001876,
    },
  });

  assert.deepEqual(
    rows.filter(function (item) {
      return /预估人民币/.test(item[0]);
    }),
    [
      ["听音预估人民币", "0.001762 元"],
      ["对比预估人民币", "0.000114 元"],
      ["总预估人民币", "0.001876 元"],
    ]
  );
});

test("DataBaker omni single rows include single estimated RMB row only", function () {
  const helper = panelModule.__test__?.buildResultRows;
  const rows = helper({
    pageText: "页面文本",
    heardText: "听音文本",
    recommendedText: "推荐文本。",
    isChanged: false,
    listenConfidence: 0.9,
    compareConfidence: 0.9,
    model: {
      listen: "qwen3.5-omni-flash",
    },
    pipelineMode: "omni_single",
    cost: {
      single: {
        estimatedCostCny: 0.002345,
      },
      totalEstimatedCostCny: 0.002345,
    },
  });

  assert.deepEqual(
    rows.filter(function (item) {
      return /预估人民币/.test(item[0]);
    }),
    [["预估人民币", "0.002345 元"]]
  );
});

test("DataBaker rows show no-source label when pricing is unavailable", function () {
  const helper = panelModule.__test__?.buildResultRows;
  const rows = helper({
    pageText: "页面文本",
    heardText: "听音文本",
    recommendedText: "推荐文本。",
    isChanged: false,
    listenConfidence: 0.9,
    compareConfidence: 0.9,
    model: {
      listen: "fun-asr",
      compare: "qwen-max",
    },
    pipelineMode: "fun_asr_compare",
    cost: {
      listen: {
        reason: "没有数据源",
      },
      compare: {
        reason: "没有数据源",
      },
    },
  });
  const totalRow = rows.find(function (item) {
    return item[0] === "总预估人民币";
  });

  assert.deepEqual(totalRow, ["总预估人民币", "没有数据源"]);
});

test("DataBaker batch floating rows include aggregated token and estimated RMB rows", function () {
  const helper = panelModule.__test__?.buildBatchFloatingRows;
  assert.equal(typeof helper, "function");

  const rows = helper({
    phase: "completed",
    batchResultCount: 2,
    batchHasUsageData: true,
    batchPromptTokens: 20,
    batchCompletionTokens: 7,
    batchTotalTokens: 27,
    batchHasPriceData: true,
    batchEstimatedCostCny: 0.001555,
  });

  assert.deepEqual(
    rows.slice(-4).map(function (item) {
      return [item.label, item.value];
    }),
    [
      ["批量输入Token", "20"],
      ["批量输出Token", "7"],
      ["批量总Token", "27"],
      ["批量预估人民币", "0.001555 元"],
    ]
  );
});
