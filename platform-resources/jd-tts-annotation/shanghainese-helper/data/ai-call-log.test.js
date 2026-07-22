"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

test("JD TTS call log keeps the utterance identity summary but never audio sources", function () {
  const log = require(path.resolve(__dirname, "ai-call-log.js"));
  const row = log.aiCallLogger.buildRow({
    requestId: "request-1",
    normalizedRequest: {
      utteranceId: "4881635",
      checksum: "a".repeat(32),
      audioDataUrl: "data:audio/x-wav;base64,U0VDUkVU",
      pipelineMode: "omni_single_raw_listen",
      aiOmni: { model: "qwen3.5-omni-plus" },
      aiUsageOperatorName: "tester",
    },
    result: {
      data: { utteranceId: "4881635", checksum: "a".repeat(32), listenText: "\u4f8b\u5b50" },
      meta: {
        stage: "complete",
        timing: { totalDurationMs: 321 },
        usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 },
        cost: { total: 0.01 },
        queue: { totalQueueWaitMs: 9 },
        models: { pipelineMode: "omni_single_raw_listen", omniModel: "qwen3.5-omni-plus" },
      },
    },
  });

  const serialized = JSON.stringify(row);
  assert.equal(row.utteranceId, "4881635");
  assert.equal(row.audioChecksumDigest, "a".repeat(32));
  assert.equal(row.recognizeModel, "qwen3.5-omni-plus");
  assert.doesNotMatch(serialized, /data:audio|U0VDUkVU/i);
  assert.doesNotMatch(serialized, /\u4f8b\u5b50|listenText/i);
});
