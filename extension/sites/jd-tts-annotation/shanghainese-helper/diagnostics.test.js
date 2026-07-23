"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const diagnostics = require(path.resolve(__dirname, "diagnostics.js"));

test("JD Shanghai diagnostics renders only safe success details", function () {
  const rows = diagnostics.buildSuccessDetails({
    meta: {
      models: { omniModel: "qwen3.5-omni-plus" },
      timing: { totalDurationMs: 1250 },
      usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 },
      cost: { totalEstimatedCostCny: 0.0012 },
      queue: { totalQueueWaitMs: 60 },
      cache: { hit: false },
      requestId: "request-safe-1",
    },
  });

  assert.deepEqual(rows, [
    ["模型", "qwen3.5-omni-plus"],
    ["总耗时", "1.3s"],
    ["Token", "输入 12 / 输出 8 / 合计 20"],
    ["预估人民币", "0.0012 元"],
    ["排队等待", "60ms"],
    ["缓存命中", "否"],
    ["requestId", "request-safe-1"],
  ]);
});

test("JD Shanghai diagnostics maps job failures to a named safe step", function () {
  const failure = diagnostics.buildFailureDetails(
    {
      code: "provider-rate-limited",
      phase: "poll",
      message: "上游模型限流，Authorization: Bearer SECRET",
      rawResponse: {
        success: false,
        error: {
          code: "provider-rate-limited",
          message: "上游模型限流",
          stage: "recognize",
        },
        meta: { requestId: "request-safe-2" },
      },
    },
    "等待识别结果"
  );

  assert.equal(failure.step, "等待识别结果");
  assert.equal(failure.code, "provider-rate-limited");
  assert.match(failure.summary, /上游模型限流/);
  assert.match(failure.suggestion, /限流/);
  assert.doesNotMatch(JSON.stringify(failure), /SECRET|Authorization/i);
});
