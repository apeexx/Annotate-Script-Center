"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const service = require(path.resolve(__dirname, "ai-service.js"));

test("JD TTS Shanghai defaults expose the single raw-listen Omni contract", function () {
  const defaults = service.createDefaultsPayload();
  assert.equal(defaults.scriptId, "jdTtsShanghaineseAssistant");
  assert.equal(defaults.defaults.aiOmni.model, "qwen3.5-omni-plus");
  assert.equal(defaults.defaults.aiOmni.enableThinking, false);
  assert.deepEqual(defaults.supportedModels.omni, ["qwen3.5-omni-plus", "qwen3.5-omni-flash"]);
  assert.equal(defaults.contract.outputField, "listenText");
});

test("JD TTS Shanghai accepts only numeric-string utterance identity and a WAV data URL", function () {
  const request = service.normalizeRecommendRequest({
    utteranceId: "4881635",
    checksum: "a".repeat(32),
    audioDataUrl: "data:audio/x-wav;base64,UklGRg==",
    aiUsageOperatorName: "测试使用人",
    clientRequestId: "client-request-1",
    aiOmni: {
      model: "qwen3.5-omni-flash",
      prompt: "只输出上海话原始文本。",
      enableThinking: true,
    },
  });

  assert.equal(request.utteranceId, "4881635");
  assert.equal(request.aiOmni.model, "qwen3.5-omni-flash");
  assert.equal(request.aiOmni.enableThinking, false);
  assert.equal(request.audioDataUrl, "data:audio/x-wav;base64,UklGRg==");
});

test("JD TTS Shanghai rejects source URLs and invalid audio input", function () {
  assert.throws(
    function () {
      service.normalizeRecommendRequest({
        utteranceId: "4881635",
        checksum: "a".repeat(32),
        audioDataUrl: "https://private.example.test/audio.wav",
        aiUsageOperatorName: "测试使用人",
      });
    },
    function (error) {
      return error?.code === "invalid-audio-data-url";
    }
  );
  assert.throws(
    function () {
      service.normalizeRecommendRequest({
        utteranceId: "4881635",
        checksum: "a".repeat(32),
        audioDataUrl: "data:audio/x-wav;base64,UklGRg==",
        audioUrl: "https://private.example.test/audio.wav?signature=private",
        aiUsageOperatorName: "测试使用人",
      });
    },
    function (error) {
      return error?.code === "unexpected-audio-url";
    }
  );
});

test("JD TTS Shanghai requires an AI usage operator during request validation", function () {
  assert.throws(
    function () {
      service.normalizeRecommendRequest({
        utteranceId: "4881635",
        checksum: "a".repeat(32),
        audioDataUrl: "data:audio/x-wav;base64,UklGRg==",
      });
    },
    function (error) {
      return error?.code === "missing-ai-usage-operator-name" && error?.stage === "validate";
    }
  );
});

test("JD TTS Shanghai bounds custom prompt and stop text before sending it to the provider", function () {
  const request = service.normalizeRecommendRequest({
    utteranceId: "4881635",
    checksum: "a".repeat(32),
    audioDataUrl: "data:audio/x-wav;base64,UklGRg==",
    aiUsageOperatorName: "测试使用人",
    aiOmni: {
      prompt: "p".repeat(50000),
      params: { stop: ["s".repeat(200), "ok", "ok"] },
    },
  });

  assert.equal(request.aiOmni.prompt.length, 8000);
  assert.deepEqual(request.aiOmni.params.stop, ["s".repeat(80), "ok"]);
});

test("JD TTS Shanghai success body preserves raw listenText and only returns utterance identity", function () {
  const body = service.buildRecommendSuccessBody({
    data: {
      utteranceId: "4881635",
      checksum: "a".repeat(32),
      listenText: "侬好 ！",
      needHumanReview: false,
    },
    meta: { requestId: "request-1" },
  });
  assert.deepEqual(body.data, {
    utteranceId: "4881635",
    checksum: "a".repeat(32),
    listenText: "侬好 ！",
    needHumanReview: false,
  });
});
