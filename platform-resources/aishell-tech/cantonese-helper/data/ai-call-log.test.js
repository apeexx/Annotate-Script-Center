"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const callLog = require("./ai-call-log.js");

test("Cantonese AI call log keeps per-stage models, tokens, and RMB estimates", function () {
  assert.ok(Array.isArray(callLog.CSV_COLUMNS));
  const headers = callLog.CSV_COLUMNS.map(function (column) {
    return column.header;
  });
  [
    "转换模型",
    "听音模型",
    "比较模型",
    "转换输入Token",
    "听音输出Token",
    "比较总Token",
    "总预估人民币",
  ].forEach(function (header) {
    assert.ok(headers.includes(header), "missing CSV header: " + header);
  });

  const row = callLog.buildAishellCantoneseAiCallLogRow({
    normalizedRequest: {
      taskId: "task-1",
      packageId: "package-1",
      taskItemId: "item-1",
      pipelineMode: "three_stage_parallel",
    },
    result: {
      meta: {
        cancelled: false,
        stage: "complete",
        models: {
          convertModel: "qwen3.5-plus",
          listenModel: "qwen3.5-omni-flash",
          compareModelFamily: "qwen",
          compareModel: "qwen3.5-plus",
        },
        usage: {
          convert: { promptTokens: 11, completionTokens: 12, totalTokens: 23 },
          listen: { promptTokens: 21, completionTokens: 22, totalTokens: 43 },
          compare: { promptTokens: 31, completionTokens: 32, totalTokens: 63 },
        },
        cost: {
          convert: { estimatedCostCny: 0.000111 },
          listen: { estimatedCostCny: 0.000222 },
          compare: { estimatedCostCny: 0.000333 },
          totalEstimatedCostCny: 0.000666,
        },
      },
    },
  });

  assert.equal(row.convertModel, "qwen3.5-plus");
  assert.equal(row.listenModel, "qwen3.5-omni-flash");
  assert.equal(row.compareModel, "qwen3.5-plus");
  assert.equal(row.convertPromptTokens, "11");
  assert.equal(row.listenCompletionTokens, "22");
  assert.equal(row.compareTotalTokens, "63");
  assert.equal(row.totalEstimatedCostCny, "0.000666");
});
