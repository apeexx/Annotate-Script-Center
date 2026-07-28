"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const modulePath = path.resolve(__dirname, "pipeline.js");

test("Aishell Cantonese raw-listen pipeline is available", function () {
  assert.equal(fs.existsSync(modulePath), true);
});

function loadModule() {
  delete require.cache[modulePath];
  return require(modulePath);
}

test("Aishell Cantonese pipeline sends only the cropped WAV and preserves raw listenText", async function () {
  const api = loadModule();
  const received = {};
  const pipeline = api.createRecommendPipeline({
    enqueueTask: async function (groupName, task) {
      received.queueGroup = groupName;
      return {
        value: await task(),
        queueMeta: { groupName: "aishell_cantonese_qwen_omni", queueWaitMs: 0, retryCount: 0 },
      };
    },
    requestOmniInputAudio: async function (input, prompt, options) {
      received.input = input;
      received.prompt = prompt;
      received.options = options;
      return {
        rawText: "冇問題 ！",
        model: "qwen3.5-omni-flash",
        usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
      };
    },
  });

  const result = await pipeline.run(
    {
      taskItemId: "item-1",
      audioUrl: "https://oss.example.com/audio.wav",
      audioDataUrl: "data:audio/wav;base64,UklGRg==",
      regionId: "region-1",
      segmentNumber: 1,
      startMs: 1830,
      endMs: 2990,
      durationMs: 1160,
      referenceText: "平台参考文本",
      fileName: "001.wav",
      duration: 1200,
      aiOmni: {
        model: "qwen3.5-omni-flash",
        prompt: "只輸出原始繁體粵語。",
        params: { temperature: 0.2 },
        enableThinking: false,
      },
    },
    { requestId: "req-1", timeoutMs: 60000 }
  );

  assert.equal(received.input.audioUrl, "data:audio/wav;base64,UklGRg==");
  assert.equal(received.queueGroup, "aishell_cantonese_qwen_omni");
  assert.equal(received.prompt.systemPrompt, "只輸出原始繁體粵語。");
  assert.doesNotMatch(received.prompt.userPrompt, /平台参考文本/);
  assert.equal(received.options.enableThinking, false);
  assert.equal(result.data.listenText, "冇問題 ！");
  assert.equal(result.data.referenceText, "平台参考文本");
  assert.equal(result.meta.models.omniModel, "qwen3.5-omni-flash");
});

test("Aishell Cantonese pipeline preserves exhausted rate-limit retry diagnostics", async function () {
  const api = loadModule();
  const upstreamError = Object.assign(new Error("上游模型限流，后端已重试仍失败。"), {
    code: "provider-rate-limited",
    providerCode: "limit_burst_rate",
    providerStatus: 429,
    summary: "limit_burst_rate",
    queueMeta: {
      groupName: "aishell_cantonese_qwen_omni",
      queueWaitMs: 2400,
      retryCount: 3,
    },
  });
  const pipeline = api.createRecommendPipeline({
    enqueueTask: async function () {
      throw upstreamError;
    },
  });

  await assert.rejects(
    pipeline.run(
      {
        taskItemId: "item-1",
        audioDataUrl: "data:audio/wav;base64,UklGRg==",
        regionId: "region-1",
        segmentNumber: 1,
        startMs: 1830,
        endMs: 2990,
        durationMs: 1160,
        selectionKey: "region-1:1830-2990",
        aiOmni: { model: "qwen3.5-omni-plus" },
      },
      { requestId: "req-rate-limit", timeoutMs: 60000 }
    ),
    function (error) {
      return (
        error?.providerStatus === 429 &&
        error?.providerCode === "limit_burst_rate" &&
        error?.meta?.retryCount === 3 &&
        error?.meta?.queue?.totalQueueWaitMs === 2400
      );
    }
  );
});
