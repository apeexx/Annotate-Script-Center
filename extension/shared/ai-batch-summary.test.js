"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const batchSummary = require("./ai-batch-summary.js");

test("batch summary accumulator aggregates single-stage usage and estimated cost", function () {
  const accumulator = batchSummary.createBatchSummaryAccumulator();

  accumulator.addResult({
    usage: {
      promptTokens: 12,
      completionTokens: 5,
      totalTokens: 17,
    },
    cost: {
      estimatedCostCny: 0.001234,
    },
  });

  accumulator.addResult({
    usage: {
      promptTokens: 8,
      completionTokens: 2,
      totalTokens: 10,
    },
    cost: {
      totalEstimatedCostCny: 0.000321,
    },
  });

  assert.deepEqual(accumulator.getSnapshot(), {
    batchResultCount: 2,
    batchPromptTokens: 20,
    batchCompletionTokens: 7,
    batchTotalTokens: 27,
    batchEstimatedCostCny: 0.001555,
    batchHasUsageData: true,
    batchHasPriceData: true,
  });
});

test("batch summary accumulator aggregates nested multi-stage usage and total cost", function () {
  const accumulator = batchSummary.createBatchSummaryAccumulator();

  accumulator.addResult({
    usage: {
      listen: {
        promptTokens: 10,
        completionTokens: 6,
        totalTokens: 16,
      },
      refine: {
        promptTokens: 4,
        completionTokens: 3,
        totalTokens: 7,
      },
    },
    cost: {
      listen: {
        estimatedCostCny: 0.008935,
      },
      refine: {
        estimatedCostCny: 0.000017,
      },
      totalEstimatedCostCny: 0.008952,
    },
  });

  assert.deepEqual(accumulator.getSnapshot(), {
    batchResultCount: 1,
    batchPromptTokens: 14,
    batchCompletionTokens: 9,
    batchTotalTokens: 23,
    batchEstimatedCostCny: 0.008952,
    batchHasUsageData: true,
    batchHasPriceData: true,
  });
});

test("batch summary accumulator marks missing usage and price without emitting partial totals", function () {
  const accumulator = batchSummary.createBatchSummaryAccumulator();

  accumulator.addResult({
    usage: {
      promptTokens: 12,
      completionTokens: 5,
      totalTokens: 17,
    },
    cost: {
      totalEstimatedCostCny: 0.001234,
    },
  });
  accumulator.addResult({
    usage: {},
    cost: {
      note: "没有数据源",
    },
  });

  assert.deepEqual(accumulator.getSnapshot(), {
    batchResultCount: 2,
    batchPromptTokens: null,
    batchCompletionTokens: null,
    batchTotalTokens: null,
    batchEstimatedCostCny: null,
    batchHasUsageData: false,
    batchHasPriceData: false,
  });
});

test("batch summary rows show no-source only after batch has successful AI results", function () {
  const rows = batchSummary.buildBatchSummaryRows({
    batchResultCount: 2,
    batchHasUsageData: true,
    batchPromptTokens: 20,
    batchCompletionTokens: 7,
    batchTotalTokens: 27,
    batchHasPriceData: false,
    batchEstimatedCostCny: null,
  });

  assert.deepEqual(rows, [
    ["批量输入Token", "20"],
    ["批量输出Token", "7"],
    ["批量总Token", "27"],
    ["批量预估人民币", "没有数据源"],
  ]);
});
