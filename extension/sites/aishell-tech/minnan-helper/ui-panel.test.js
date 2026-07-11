"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const panelModule = require("./ui-panel.js");

test("Aishell Minnan batch rows include aggregated token and estimated RMB rows", function () {
  const helper = panelModule.__test__?.buildBatchRows;
  assert.equal(typeof helper, "function");

  const rows = helper({
    phaseText: "全部AI批量识别已完成",
    total: 3,
    completed: 3,
    failed: 0,
    currentText: "条目-3",
    batchResultCount: 3,
    batchHasUsageData: true,
    batchPromptTokens: 466,
    batchCompletionTokens: 53,
    batchTotalTokens: 519,
    batchHasPriceData: true,
    batchEstimatedCostCny: 0.001762,
  });

  assert.deepEqual(
    rows.slice(-4),
    [
      ["批量输入Token", "466"],
      ["批量输出Token", "53"],
      ["批量总Token", "519"],
      ["批量预估人民币", "0.001762 元"],
    ]
  );
});

test("Aishell Minnan batch rows show no-source label when price data is missing", function () {
  const helper = panelModule.__test__?.buildBatchRows;
  const rows = helper({
    phaseText: "全部AI批量识别已完成",
    total: 1,
    completed: 1,
    failed: 0,
    currentText: "条目-1",
    batchResultCount: 1,
    batchHasUsageData: true,
    batchPromptTokens: 10,
    batchCompletionTokens: 5,
    batchTotalTokens: 15,
    batchHasPriceData: false,
    batchEstimatedCostCny: null,
  });
  const priceRow = rows.find(function (item) {
    return item[0] === "批量预估人民币";
  });

  assert.deepEqual(priceRow, ["批量预估人民币", "没有数据源"]);
});
