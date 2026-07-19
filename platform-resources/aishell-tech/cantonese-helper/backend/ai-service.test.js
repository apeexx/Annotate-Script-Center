"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const modulePath = path.resolve(__dirname, "ai-service.js");

test("Aishell Cantonese AI service is available", function () {
  assert.equal(fs.existsSync(modulePath), true);
});

function loadModule() {
  delete require.cache[modulePath];
  return require(modulePath);
}

test("Aishell Cantonese defaults use a direct raw-listen Omni contract", function () {
  const api = loadModule();
  const defaults = api.createDefaultsPayload();

  assert.equal(defaults.defaults.aiOmni.model, "qwen3.5-omni-plus");
  assert.match(defaults.defaults.aiOmni.prompt, /繁體粵語口語/);
  assert.equal(defaults.contract.stages[0], "omni");
  assert.equal(defaults.contract.outputField, "listenText");
  assert.equal(defaults.contract.enableThinking, false);
});

test("Aishell Cantonese request keeps a saved prompt but always disables thinking", function () {
  const api = loadModule();
  const request = api.normalizeRecommendRequest({
    taskItemId: "item-1",
    audioUrl: "https://example.com/audio.wav",
    audioDataUrl: "data:audio/wav;base64,UklGRg==",
    regionId: "region-1",
    segmentNumber: 1,
    startMs: 1830,
    endMs: 2990,
    durationMs: 1160,
    selectionKey: "region-1:1830-2990",
    referenceText: "平台参考文本",
    aiOmni: {
      model: "qwen3.5-omni-flash",
      prompt: "只输出原始繁體粵語。",
      enableThinking: true,
    },
  });

  assert.equal(request.aiOmni.model, "qwen3.5-omni-flash");
  assert.equal(request.aiOmni.prompt, "只输出原始繁體粵語。");
  assert.equal(request.aiOmni.enableThinking, false);
  assert.equal(request.pipelineMode, "omni_single_raw_listen");
});

test("Aishell Cantonese applies the published Omni parameter defaults when Options leaves them blank", function () {
  const api = loadModule();
  const request = api.normalizeRecommendRequest({
    taskItemId: "item-default-params",
    audioUrl: "https://example.com/audio.wav",
    audioDataUrl: "data:audio/wav;base64,UklGRg==",
    regionId: "region-1",
    segmentNumber: 1,
    startMs: 1830,
    endMs: 2990,
    durationMs: 1160,
    selectionKey: "region-1:1830-2990",
    aiOmni: { params: {} },
  });

  assert.equal(request.aiOmni.params.temperature, 0.1);
  assert.equal(request.aiOmni.params.top_p, 0.8);
  assert.equal(request.aiOmni.params.max_tokens, 1200);
});

test("Aishell Cantonese accepts an audio item without platform reference text", function () {
  const api = loadModule();
  const request = api.normalizeRecommendRequest({
    taskItemId: "item-without-reference",
    audioUrl: "https://example.com/audio.wav",
    audioDataUrl: "data:audio/wav;base64,UklGRg==",
    regionId: "region-1",
    segmentNumber: 1,
    startMs: 1830,
    endMs: 2990,
    durationMs: 1160,
    selectionKey: "region-1:1830-2990",
  });

  assert.equal(request.taskItemId, "item-without-reference");
  assert.equal(request.referenceText, "");
});

test("Aishell Cantonese rejects a full-audio URL when the cropped segment audio is missing", function () {
  const api = loadModule();
  assert.throws(
    function () {
      api.normalizeRecommendRequest({
        taskItemId: "item-full-audio-only",
        audioUrl: "https://example.com/audio.wav",
        regionId: "region-1",
        segmentNumber: 1,
        startMs: 1830,
        endMs: 2990,
        durationMs: 1160,
      });
    },
    function (error) {
      return error?.code === "missing-audio-data-url";
    }
  );
});

test("Aishell Cantonese rejects a segment identity that does not match its exact range", function () {
  const api = loadModule();
  assert.throws(
    function () {
      api.normalizeRecommendRequest({
        taskItemId: "item-1",
        audioUrl: "https://example.com/audio.wav",
        audioDataUrl: "data:audio/wav;base64,UklGRg==",
        regionId: "region-1",
        segmentNumber: 1,
        startMs: 1830,
        endMs: 2990,
        durationMs: 1160,
        selectionKey: "region-1:0-9999",
      });
    },
    function (error) {
      return error?.code === "invalid-segment-identity";
    }
  );
});

test("Aishell Cantonese success body preserves raw listenText", function () {
  const api = loadModule();
  const rawListenText = "冇問題 ！";
  const body = api.buildRecommendSuccessBody({
    data: {
      taskItemId: "item-1",
      referenceText: "没有问题。",
      listenText: rawListenText,
    },
    meta: { requestId: "req-1" },
  });

  assert.equal(body.success, true);
  assert.equal(body.data.listenText, rawListenText);
  assert.equal(body.data.referenceText, "没有问题。");
});
