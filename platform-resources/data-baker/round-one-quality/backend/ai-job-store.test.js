"use strict";

const assert = require("assert");
const test = require("node:test");

const {
  createAiRecommendJob,
  getAiRecommendJob,
  getAiRecommendJobDebug,
  markAiRecommendJobFailed,
  markAiRecommendJobRunning,
  markAiRecommendJobSucceeded,
} = require("./ai-job-store");

test("data baker ai job store adapter uses shared store for success path", function () {
  const job = createAiRecommendJob({
    requestId: "req-success",
    itemId: "item-1",
    textId: "text-1",
    sentenceNumber: 7,
  });

  assert.equal(job.status, "pending");
  assert.equal(job.sentenceNumber, 7);

  markAiRecommendJobRunning(job.jobId);
  markAiRecommendJobSucceeded(job.jobId, {
    result: {
      recommendedText: "测试结果",
    },
    runtime: {
      dedupeEnabled: true,
    },
    providerStatus: 200,
  });

  const saved = getAiRecommendJob(job.jobId);
  assert.equal(saved.status, "succeeded");
  assert.equal(saved.result.recommendedText, "测试结果");
  assert.equal(saved.runtime.dedupeEnabled, true);
  assert.equal(saved.providerStatus, 200);
});

test("data baker ai job store adapter keeps debug payload for failed jobs", function () {
  const job = createAiRecommendJob({
    requestId: "req-fail",
    itemId: "item-2",
    textId: "text-2",
  });

  markAiRecommendJobFailed(job.jobId, {
    code: "model-json-parse-failed",
    message: "模型输出 JSON 解析失败",
    providerStatus: 502,
    debugRawJson: {
      rawText: "{\"bad\":true}",
    },
  });

  const saved = getAiRecommendJob(job.jobId);
  const debug = getAiRecommendJobDebug(job.jobId);
  assert.equal(saved.status, "failed");
  assert.equal(saved.errorCode, "model-json-parse-failed");
  assert.equal(saved.hasDebugRawJson, true);
  assert.equal(debug.rawText, "{\"bad\":true}");
});
